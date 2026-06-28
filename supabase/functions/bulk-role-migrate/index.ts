/**
 * bulk-role-migrate — Supabase Edge Function
 *
 * Handles three actions:
 *   dry_run  — Fetch all guild members, compute what would happen, write preview
 *              records to role_migration_log (is_dry_run=true), return summary.
 *   execute  — Same logic but actually calls Discord API to assign new class roles.
 *              Writes real records. Supports retry-only-errors mode.
 *   progress — Poll current state of a job by job_id.
 *
 * Role mapping (old rank → new class):
 *   S (1304347182362660904) → Class 1 (1520600682179199116)
 *   A (1304347185646927915) → Class 1
 *   B (1304347189488910459) → Class 1
 *   C (1304347192651157514) → Class 2 (1520598680690884644)
 *   D (1304347196275298355) → Class 2
 *   E (1305120410106462228) → Class 3 (1520607360836435988)
 *
 * Priority order (highest first): S > A > B > C > D > E
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

/** Old rank role IDs in descending priority (S → E) */
const OLD_ROLE_PRIORITY = [
  "1304347182362660904", // S
  "1304347185646927915", // A
  "1304347189488910459", // B
  "1304347192651157514", // C
  "1304347196275298355", // D
  "1305120410106462228", // E
];

/** Map old role ID → new class role ID */
const ROLE_MAPPING: Record<string, string> = {
  "1304347182362660904": "1520600682179199116", // S → Class 1
  "1304347185646927915": "1520600682179199116", // A → Class 1
  "1304347189488910459": "1520600682179199116", // B → Class 1
  "1304347192651157514": "1520598680690884644", // C → Class 2
  "1304347196275298355": "1520598680690884644", // D → Class 2
  "1305120410106462228": "1520607360836435988", // E → Class 3
};

const NEW_CLASS_ROLE_IDS = new Set(Object.values(ROLE_MAPPING));

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface MemberAnalysis {
  discord_user_id: string;
  username: string;
  old_role_ids: string[];
  resolved_old_role_id: string | null;
  new_role_id: string | null;
  result_status: string;
  error_message: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Fetch ALL guild members using after-cursor pagination (max 1000/req) */
async function fetchAllGuildMembers(
  guildId: string,
  botToken: string,
): Promise<any[]> {
  const all: any[] = [];
  let after = "0";

  while (true) {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord members fetch failed (${res.status}): ${text}`);
    }

    const batch: any[] = await res.json();
    if (batch.length === 0) break;

    all.push(...batch);
    after = batch[batch.length - 1].user.id;
    if (batch.length < 1000) break;
  }

  return all;
}

/** Analyse a single member and determine what action to take */
function analyseMember(member: any): MemberAnalysis {
  const roles: string[] = member.roles ?? [];
  const userId: string = member.user?.id ?? "unknown";
  const username: string =
    member.nick ??
    member.user?.global_name ??
    member.user?.username ??
    "Unknown";

  const heldOldRoles = OLD_ROLE_PRIORITY.filter((r) => roles.includes(r));
  const heldNewClassRoles = [...NEW_CLASS_ROLE_IDS].filter((r) =>
    roles.includes(r),
  );

  // No old role at all — skip
  if (heldOldRoles.length === 0) {
    return {
      discord_user_id: userId,
      username,
      old_role_ids: [],
      resolved_old_role_id: null,
      new_role_id: null,
      result_status: "skipped_no_old_role",
      error_message: null,
    };
  }

  // Resolve winning role (highest priority = first in OLD_ROLE_PRIORITY)
  const resolvedOldRole = heldOldRoles[0];
  const targetNewRole = ROLE_MAPPING[resolvedOldRole];
  const isAnomaly = heldOldRoles.length > 1;

  // Already has the target new class role → skip (idempotent)
  const alreadyHasNewRole = roles.includes(targetNewRole);
  if (alreadyHasNewRole) {
    return {
      discord_user_id: userId,
      username,
      old_role_ids: heldOldRoles,
      resolved_old_role_id: resolvedOldRole,
      new_role_id: targetNewRole,
      result_status: "skipped_already_has",
      error_message: null,
    };
  }

  return {
    discord_user_id: userId,
    username,
    old_role_ids: heldOldRoles,
    resolved_old_role_id: resolvedOldRole,
    new_role_id: targetNewRole,
    result_status: isAnomaly ? "anomaly_multiple_old" : "will_assign",
    error_message: null,
  };
}

/** Build a preview summary from analysis list */
function buildSummary(analyses: MemberAnalysis[]) {
  const toAssign = analyses.filter(
    (a) =>
      a.result_status === "will_assign" ||
      a.result_status === "anomaly_multiple_old",
  );
  const class1 = toAssign.filter(
    (a) => a.new_role_id === "1520600682179199116",
  );
  const class2 = toAssign.filter(
    (a) => a.new_role_id === "1520598680690884644",
  );
  const class3 = toAssign.filter(
    (a) => a.new_role_id === "1520607360836435988",
  );
  const anomalies = analyses.filter(
    (a) => a.result_status === "anomaly_multiple_old",
  );
  const alreadyHas = analyses.filter(
    (a) => a.result_status === "skipped_already_has",
  );
  const noOldRole = analyses.filter(
    (a) => a.result_status === "skipped_no_old_role",
  );

  return {
    total_members: analyses.length,
    to_assign: toAssign.length,
    class1_count: class1.length,
    class2_count: class2.length,
    class3_count: class3.length,
    anomaly_count: anomalies.length,
    already_has_count: alreadyHas.length,
    no_old_role_count: noOldRole.length,
    anomaly_members: anomalies.map((a) => ({
      discord_user_id: a.discord_user_id,
      username: a.username,
      old_role_ids: a.old_role_ids,
      resolved_old_role_id: a.resolved_old_role_id,
      new_role_id: a.new_role_id,
    })),
    already_has_members: alreadyHas.map((a) => ({
      discord_user_id: a.discord_user_id,
      username: a.username,
      new_role_id: a.new_role_id,
    })),
  };
}

// ──────────────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────────────

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const discordId =
      user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) {
      return new Response(
        JSON.stringify({ error: "No Discord ID found" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("discord_id", discordId)
      .single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    // ── Page access check ─────────────────────────────────────────
    const { data: hasAccess } = await supabase.rpc("has_page_access", {
      _user_id: profile.id,
      _page: "role-migration",
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // ── Discord env ───────────────────────────────────────────────
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Discord configuration missing" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const body = await req.json();
    const { action } = body;

    // ══════════════════════════════════════════════════════════════
    // ACTION: progress — poll job state
    // ══════════════════════════════════════════════════════════════
    if (action === "progress") {
      const { job_id } = body;
      if (!job_id) {
        return new Response(JSON.stringify({ error: "Missing job_id" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: job, error: jobErr } = await supabase
        .from("role_migration_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (jobErr || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: jsonHeaders,
        });
      }

      // Count errors for this job from log
      const { count: errorCount } = await supabase
        .from("role_migration_log")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job_id)
        .eq("result_status", "error");

      return new Response(
        JSON.stringify({ job, error_count: errorCount ?? 0 }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: dry_run — preview without changing Discord roles
    // ══════════════════════════════════════════════════════════════
    if (action === "dry_run") {
      // Create job record
      const { data: job, error: jobErr } = await supabase
        .from("role_migration_jobs")
        .insert({
          status: "dry_run",
          is_dry_run: true,
          initiated_by: profile.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobErr || !job) {
        return new Response(
          JSON.stringify({ error: "Failed to create job record" }),
          { status: 500, headers: jsonHeaders },
        );
      }

      try {
        // Fetch all members
        const members = await fetchAllGuildMembers(guildId, botToken);

        // Analyse each member
        const analyses = members
          .filter((m: any) => !m.user?.bot) // skip bots
          .map(analyseMember);

        const summary = buildSummary(analyses);

        // Write preview log records
        const logRows = analyses.map((a) => ({
          job_id: job.id,
          discord_user_id: a.discord_user_id,
          username: a.username,
          old_role_ids: a.old_role_ids,
          resolved_old_role_id: a.resolved_old_role_id,
          new_role_id: a.new_role_id,
          result_status: a.result_status,
          error_message: a.error_message,
        }));

        // Insert in batches of 500 to avoid payload limits
        for (let i = 0; i < logRows.length; i += 500) {
          await supabase
            .from("role_migration_log")
            .insert(logRows.slice(i, i + 500));
        }

        // Update job as completed
        await supabase
          .from("role_migration_jobs")
          .update({
            status: "completed",
            total_members: members.length,
            processed: analyses.length,
            success_count: summary.to_assign,
            skip_count:
              summary.already_has_count + summary.no_old_role_count,
            error_count: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return new Response(
          JSON.stringify({ job_id: job.id, summary }),
          { status: 200, headers: jsonHeaders },
        );
      } catch (err) {
        await supabase
          .from("role_migration_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        throw err;
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: execute — actually assign new class roles
    // ══════════════════════════════════════════════════════════════
    if (action === "execute") {
      const { retry_errors_only, source_job_id } = body;

      // Create a new execution job
      const { data: job, error: jobErr } = await supabase
        .from("role_migration_jobs")
        .insert({
          status: "running",
          is_dry_run: false,
          initiated_by: profile.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobErr || !job) {
        return new Response(
          JSON.stringify({ error: "Failed to create job record" }),
          { status: 500, headers: jsonHeaders },
        );
      }

      try {
        let membersToProcess: MemberAnalysis[];

        if (retry_errors_only && source_job_id) {
          // Retry mode: fetch only members that had errors in the source job
          const { data: errorLogs } = await supabase
            .from("role_migration_log")
            .select("discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id")
            .eq("job_id", source_job_id)
            .eq("result_status", "error");

          membersToProcess = (errorLogs ?? []).map((row: any) => ({
            discord_user_id: row.discord_user_id,
            username: row.username ?? "Unknown",
            old_role_ids: row.old_role_ids ?? [],
            resolved_old_role_id: row.resolved_old_role_id,
            new_role_id: row.new_role_id,
            result_status: "will_assign",
            error_message: null,
          }));
        } else {
          // Full run: fetch all guild members fresh
          const members = await fetchAllGuildMembers(guildId, botToken);
          membersToProcess = members
            .filter((m: any) => !m.user?.bot)
            .map(analyseMember)
            .filter(
              (a) =>
                a.result_status === "will_assign" ||
                a.result_status === "anomaly_multiple_old",
            );

          // Update total count
          await supabase
            .from("role_migration_jobs")
            .update({ total_members: members.length })
            .eq("id", job.id);
        }

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        const logRows: any[] = [];

        for (let idx = 0; idx < membersToProcess.length; idx++) {
          const analysis = membersToProcess[idx];

          // Skip members without a valid new role target
          if (!analysis.new_role_id) {
            skipCount++;
            logRows.push({
              job_id: job.id,
              discord_user_id: analysis.discord_user_id,
              username: analysis.username,
              old_role_ids: analysis.old_role_ids,
              resolved_old_role_id: analysis.resolved_old_role_id,
              new_role_id: null,
              result_status: "skipped_no_old_role",
              error_message: null,
            });
            continue;
          }

          try {
            // Use ADD Guild Member Role endpoint (PUT) — minimal, single role add
            // This is idempotent: Discord returns 204 if already has the role too.
            const res = await discordFetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${analysis.discord_user_id}/roles/${analysis.new_role_id}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bot ${botToken}`,
                  "Content-Type": "application/json",
                  "X-Audit-Log-Reason": "Bulk class role migration",
                },
              },
            );

            if (res.ok || res.status === 204) {
              successCount++;
              logRows.push({
                job_id: job.id,
                discord_user_id: analysis.discord_user_id,
                username: analysis.username,
                old_role_ids: analysis.old_role_ids,
                resolved_old_role_id: analysis.resolved_old_role_id,
                new_role_id: analysis.new_role_id,
                result_status: "assigned",
                error_message: null,
              });
            } else {
              const errText = await res.text();
              errorCount++;
              logRows.push({
                job_id: job.id,
                discord_user_id: analysis.discord_user_id,
                username: analysis.username,
                old_role_ids: analysis.old_role_ids,
                resolved_old_role_id: analysis.resolved_old_role_id,
                new_role_id: analysis.new_role_id,
                result_status: "error",
                error_message: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
              });
            }
          } catch (memberErr) {
            errorCount++;
            logRows.push({
              job_id: job.id,
              discord_user_id: analysis.discord_user_id,
              username: analysis.username,
              old_role_ids: analysis.old_role_ids,
              resolved_old_role_id: analysis.resolved_old_role_id,
              new_role_id: analysis.new_role_id,
              result_status: "error",
              error_message: (memberErr as Error).message?.slice(0, 200) ?? "Unknown error",
            });
          }

          // Flush log batch every 100 members and update progress
          if (logRows.length >= 100) {
            await supabase.from("role_migration_log").insert(logRows.splice(0));
            await supabase
              .from("role_migration_jobs")
              .update({
                processed: idx + 1,
                success_count: successCount,
                skip_count: skipCount,
                error_count: errorCount,
              })
              .eq("id", job.id);
          }
        }

        // Flush remaining log rows
        if (logRows.length > 0) {
          await supabase.from("role_migration_log").insert(logRows);
        }

        // Mark job as completed
        await supabase
          .from("role_migration_jobs")
          .update({
            status: "completed",
            processed: membersToProcess.length,
            success_count: successCount,
            skip_count: skipCount,
            error_count: errorCount,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return new Response(
          JSON.stringify({
            job_id: job.id,
            success_count: successCount,
            skip_count: skipCount,
            error_count: errorCount,
            message: `ย้ายสำเร็จ ${successCount} คน${errorCount > 0 ? ` (error ${errorCount} คน)` : ""}`,
          }),
          { status: 200, headers: jsonHeaders },
        );
      } catch (err) {
        await supabase
          .from("role_migration_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        throw err;
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: get_error_members — fetch error log entries for a job
    // ══════════════════════════════════════════════════════════════
    if (action === "get_error_members") {
      const { job_id } = body;
      if (!job_id) {
        return new Response(JSON.stringify({ error: "Missing job_id" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: rows, error: rowErr } = await supabase
        .from("role_migration_log")
        .select(
          "discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id, error_message, processed_at",
        )
        .eq("job_id", job_id)
        .eq("result_status", "error")
        .order("processed_at", { ascending: true });

      if (rowErr) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch error logs" }),
          { status: 500, headers: jsonHeaders },
        );
      }

      return new Response(JSON.stringify({ members: rows ?? [] }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION: export_csv — stream CSV of all log rows for a job
    // ══════════════════════════════════════════════════════════════
    if (action === "export_csv") {
      const { job_id } = body;
      if (!job_id) {
        return new Response(JSON.stringify({ error: "Missing job_id" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: rows } = await supabase
        .from("role_migration_log")
        .select(
          "discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id, result_status, error_message, processed_at",
        )
        .eq("job_id", job_id)
        .order("processed_at", { ascending: true });

      const header =
        "discord_user_id,username,old_role_ids,resolved_old_role_id,new_role_id,result_status,error_message,processed_at\n";
      const lines = (rows ?? []).map((r: any) => {
        const escape = (v: any) =>
          `"${String(v ?? "").replace(/"/g, '""')}"`;
        return [
          escape(r.discord_user_id),
          escape(r.username),
          escape((r.old_role_ids ?? []).join("|")),
          escape(r.resolved_old_role_id),
          escape(r.new_role_id),
          escape(r.result_status),
          escape(r.error_message),
          escape(r.processed_at),
        ].join(",");
      });

      return new Response(header + lines.join("\n"), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="role_migration_${job_id}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Error in bulk-role-migrate:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
