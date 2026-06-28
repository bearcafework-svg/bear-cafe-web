/**
 * bulk-role-migrate — Supabase Edge Function
 *
 * All heavy actions (dry_run, execute) return { job_id } immediately and
 * process in the background via EdgeRuntime.waitUntil() to avoid 504 timeout.
 *
 * Actions:
 *   dry_run          — Preview what would happen (no Discord API calls)
 *   execute          — Actually assign new class roles via Discord API
 *   progress         — Poll current job state by job_id
 *   get_error_members — Fetch per-member error rows for a job
 *   export_csv        — Download full log as CSV
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

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

const OLD_ROLE_PRIORITY = [
  "1304347182362660904", // S
  "1304347185646927915", // A
  "1304347189488910459", // B
  "1304347192651157514", // C
  "1304347196275298355", // D
  "1305120410106462228", // E
];

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

function analyseMember(member: any): MemberAnalysis {
  const roles: string[] = member.roles ?? [];
  const userId: string = member.user?.id ?? "unknown";
  const username: string =
    member.nick ??
    member.user?.global_name ??
    member.user?.username ??
    "Unknown";

  const heldOldRoles = OLD_ROLE_PRIORITY.filter((r) => roles.includes(r));

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

  const resolvedOldRole = heldOldRoles[0];
  const targetNewRole = ROLE_MAPPING[resolvedOldRole];
  const isAnomaly = heldOldRoles.length > 1;

  if (roles.includes(targetNewRole)) {
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

function buildSummary(analyses: MemberAnalysis[]) {
  const toAssign = analyses.filter(
    (a) =>
      a.result_status === "will_assign" ||
      a.result_status === "anomaly_multiple_old",
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
    class1_count: toAssign.filter(
      (a) => a.new_role_id === "1520600682179199116",
    ).length,
    class2_count: toAssign.filter(
      (a) => a.new_role_id === "1520598680690884644",
    ).length,
    class3_count: toAssign.filter(
      (a) => a.new_role_id === "1520607360836435988",
    ).length,
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
// Background workers
// ──────────────────────────────────────────────────────────────────

async function runDryRun(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
) {
  try {
    const members = await fetchAllGuildMembers(guildId, botToken);
    const analyses = members.filter((m: any) => !m.user?.bot).map(analyseMember);
    const summary = buildSummary(analyses);

    // Insert log rows in batches of 500
    const logRows = analyses.map((a) => ({
      job_id: jobId,
      discord_user_id: a.discord_user_id,
      username: a.username,
      old_role_ids: a.old_role_ids,
      resolved_old_role_id: a.resolved_old_role_id,
      new_role_id: a.new_role_id,
      result_status: a.result_status,
      error_message: a.error_message,
    }));

    for (let i = 0; i < logRows.length; i += 500) {
      await supabase.from("role_migration_log").insert(logRows.slice(i, i + 500));
    }

    await supabase
      .from("role_migration_jobs")
      .update({
        status: "completed",
        total_members: members.length,
        processed: analyses.length,
        success_count: summary.to_assign,
        skip_count: summary.already_has_count + summary.no_old_role_count,
        error_count: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error("[dry_run bg error]", err);
    await supabase
      .from("role_migration_jobs")
      .update({ status: "failed" })
      .eq("id", jobId);
  }
}

async function runExecute(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
  retryErrorsOnly: boolean,
  sourceJobId: string | null,
) {
  try {
    let membersToProcess: MemberAnalysis[];

    if (retryErrorsOnly && sourceJobId) {
      const { data: errorLogs } = await supabase
        .from("role_migration_log")
        .select(
          "discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id",
        )
        .eq("job_id", sourceJobId)
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

      await supabase
        .from("role_migration_jobs")
        .update({ total_members: membersToProcess.length })
        .eq("id", jobId);
    } else {
      const members = await fetchAllGuildMembers(guildId, botToken);
      membersToProcess = members
        .filter((m: any) => !m.user?.bot)
        .map(analyseMember)
        .filter(
          (a) =>
            a.result_status === "will_assign" ||
            a.result_status === "anomaly_multiple_old",
        );

      await supabase
        .from("role_migration_jobs")
        .update({ total_members: members.length })
        .eq("id", jobId);
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const logRows: any[] = [];

    for (let idx = 0; idx < membersToProcess.length; idx++) {
      const analysis = membersToProcess[idx];

      if (!analysis.new_role_id) {
        skipCount++;
        logRows.push({
          job_id: jobId,
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
            job_id: jobId,
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
            job_id: jobId,
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
          job_id: jobId,
          discord_user_id: analysis.discord_user_id,
          username: analysis.username,
          old_role_ids: analysis.old_role_ids,
          resolved_old_role_id: analysis.resolved_old_role_id,
          new_role_id: analysis.new_role_id,
          result_status: "error",
          error_message:
            (memberErr as Error).message?.slice(0, 200) ?? "Unknown error",
        });
      }

      // Flush every 100 members
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
          .eq("id", jobId);
      }
    }

    if (logRows.length > 0) {
      await supabase.from("role_migration_log").insert(logRows);
    }

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
      .eq("id", jobId);
  } catch (err) {
    console.error("[execute bg error]", err);
    await supabase
      .from("role_migration_jobs")
      .update({ status: "failed" })
      .eq("id", jobId);
  }
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
    // ── Auth ────────────────────────────────────────────────────────
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

    // ── Page access check ───────────────────────────────────────────
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

    // ── Discord env ─────────────────────────────────────────────────
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

    // ════════════════════════════════════════════════════════════════
    // ACTION: progress — poll job state
    // ════════════════════════════════════════════════════════════════
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

    // ════════════════════════════════════════════════════════════════
    // ACTION: dry_run — background preview (returns job_id immediately)
    // ════════════════════════════════════════════════════════════════
    if (action === "dry_run") {
      const { data: job, error: jobErr } = await supabase
        .from("role_migration_jobs")
        .insert({
          status: "running",
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

      // Fire-and-forget in background
      EdgeRuntime.waitUntil(
        runDryRun(supabase, job.id, guildId, botToken),
      );

      // Return job_id immediately — client polls via `progress`
      return new Response(
        JSON.stringify({ job_id: job.id }),
        { status: 202, headers: jsonHeaders },
      );
    }

    // ════════════════════════════════════════════════════════════════
    // ACTION: execute — background role assignment (returns job_id immediately)
    // ════════════════════════════════════════════════════════════════
    if (action === "execute") {
      const { retry_errors_only, source_job_id } = body;

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

      EdgeRuntime.waitUntil(
        runExecute(
          supabase,
          job.id,
          guildId,
          botToken,
          !!retry_errors_only,
          source_job_id ?? null,
        ),
      );

      return new Response(
        JSON.stringify({ job_id: job.id }),
        { status: 202, headers: jsonHeaders },
      );
    }

    // ════════════════════════════════════════════════════════════════
    // ACTION: get_error_members
    // ════════════════════════════════════════════════════════════════
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

    // ════════════════════════════════════════════════════════════════
    // ACTION: export_csv
    // ════════════════════════════════════════════════════════════════
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
        const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
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
