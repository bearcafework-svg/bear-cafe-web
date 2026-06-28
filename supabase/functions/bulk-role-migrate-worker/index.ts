/**
 * bulk-role-migrate-worker — Internal worker function
 *
 * Called by bulk-role-migrate via fire-and-forget fetch().
 * Receives its own HTTP request lifecycle, so the full pagination loop
 * runs without being subject to the parent function's CPU time limit.
 *
 * Protected by WORKER_SECRET header — not callable from the public internet.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

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
    let after = "0";
    let totalFetched = 0;
    let totalProcessed = 0;
    let toAssign = 0;
    let alreadyHasCount = 0;
    let noOldRoleCount = 0;

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

      totalFetched += batch.length;

      const analyses = batch
        .filter((m: any) => !m.user?.bot)
        .map(analyseMember);

      totalProcessed += analyses.length;

      for (const a of analyses) {
        if (a.result_status === "will_assign" || a.result_status === "anomaly_multiple_old") toAssign++;
        if (a.result_status === "skipped_already_has") alreadyHasCount++;
        if (a.result_status === "skipped_no_old_role") noOldRoleCount++;
      }

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

      if (logRows.length > 0) {
        await supabase.from("role_migration_log").insert(logRows);
      }

      await supabase
        .from("role_migration_jobs")
        .update({ processed: totalProcessed })
        .eq("id", jobId);

      if (batch.length < 1000) break;
      after = batch[batch.length - 1].user.id;

      // Pace Discord API (5 req/s for this endpoint)
      await new Promise((r) => setTimeout(r, 250));
    }

    await supabase
      .from("role_migration_jobs")
      .update({
        status: "completed",
        total_members: totalFetched,
        processed: totalProcessed,
        success_count: toAssign,
        skip_count: alreadyHasCount + noOldRoleCount,
        error_count: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`[worker dry_run] done jobId=${jobId} total=${totalFetched} toAssign=${toAssign}`);
  } catch (err) {
    console.error("[worker dry_run error]", err);
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
    if (retryErrorsOnly && sourceJobId) {
      const { data: errorLogs } = await supabase
        .from("role_migration_log")
        .select("discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id")
        .eq("job_id", sourceJobId)
        .eq("result_status", "error");

      const membersToProcess: MemberAnalysis[] = (errorLogs ?? []).map((row: any) => ({
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

      await processMembers(supabase, jobId, guildId, botToken, membersToProcess);
    } else {
      let after = "0";
      let totalFetched = 0;
      let globalIdx = 0;
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

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

        totalFetched += batch.length;

        await supabase
          .from("role_migration_jobs")
          .update({ total_members: totalFetched })
          .eq("id", jobId);

        const toProcess = batch
          .filter((m: any) => !m.user?.bot)
          .map(analyseMember)
          .filter(
            (a) =>
              a.result_status === "will_assign" ||
              a.result_status === "anomaly_multiple_old",
          );

        const logRows: any[] = [];

        for (const analysis of toProcess) {
          globalIdx++;
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
            const roleRes = await discordFetch(
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

            if (roleRes.ok || roleRes.status === 204) {
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
              const errText = await roleRes.text();
              errorCount++;
              logRows.push({
                job_id: jobId,
                discord_user_id: analysis.discord_user_id,
                username: analysis.username,
                old_role_ids: analysis.old_role_ids,
                resolved_old_role_id: analysis.resolved_old_role_id,
                new_role_id: analysis.new_role_id,
                result_status: "error",
                error_message: `HTTP ${roleRes.status}: ${errText.slice(0, 200)}`,
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
              error_message: (memberErr as Error).message?.slice(0, 200) ?? "Unknown error",
            });
          }
        }

        if (logRows.length > 0) {
          await supabase.from("role_migration_log").insert(logRows);
        }
        await supabase
          .from("role_migration_jobs")
          .update({
            processed: globalIdx,
            success_count: successCount,
            skip_count: skipCount,
            error_count: errorCount,
          })
          .eq("id", jobId);

        if (batch.length < 1000) break;
        after = batch[batch.length - 1].user.id;

        await new Promise((r) => setTimeout(r, 250));
      }

      await supabase
        .from("role_migration_jobs")
        .update({
          status: "completed",
          total_members: totalFetched,
          processed: globalIdx,
          success_count: successCount,
          skip_count: skipCount,
          error_count: errorCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`[worker execute] done jobId=${jobId} total=${totalFetched} success=${successCount} error=${errorCount}`);
    }
  } catch (err) {
    console.error("[worker execute error]", err);
    await supabase
      .from("role_migration_jobs")
      .update({ status: "failed" })
      .eq("id", jobId);
  }
}

async function processMembers(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
  membersToProcess: MemberAnalysis[],
) {
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
          job_id: jobId, discord_user_id: analysis.discord_user_id,
          username: analysis.username, old_role_ids: analysis.old_role_ids,
          resolved_old_role_id: analysis.resolved_old_role_id,
          new_role_id: analysis.new_role_id, result_status: "assigned", error_message: null,
        });
      } else {
        const errText = await res.text();
        errorCount++;
        logRows.push({
          job_id: jobId, discord_user_id: analysis.discord_user_id,
          username: analysis.username, old_role_ids: analysis.old_role_ids,
          resolved_old_role_id: analysis.resolved_old_role_id,
          new_role_id: analysis.new_role_id, result_status: "error",
          error_message: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
        });
      }
    } catch (memberErr) {
      errorCount++;
      logRows.push({
        job_id: jobId, discord_user_id: analysis.discord_user_id,
        username: analysis.username, old_role_ids: analysis.old_role_ids,
        resolved_old_role_id: analysis.resolved_old_role_id,
        new_role_id: analysis.new_role_id, result_status: "error",
        error_message: (memberErr as Error).message?.slice(0, 200) ?? "Unknown error",
      });
    }

    if (logRows.length >= 100) {
      await supabase.from("role_migration_log").insert(logRows.splice(0));
      await supabase
        .from("role_migration_jobs")
        .update({ processed: idx + 1, success_count: successCount, skip_count: skipCount, error_count: errorCount })
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
}

// ──────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────

Deno.serve(async (req): Promise<Response> => {
  // Verify internal secret — reject all public calls
  const secret = req.headers.get("x-worker-secret");
  if (secret !== Deno.env.get("WORKER_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { action, job_id, guild_id, bot_token, retry_errors_only, source_job_id } =
    await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const workPromise = action === "dry_run"
    ? runDryRun(supabase, job_id, guild_id, bot_token)
    : runExecute(supabase, job_id, guild_id, bot_token, !!retry_errors_only, source_job_id ?? null);

  // waitUntil keeps the worker alive for the full wall-clock duration
  // (up to 400s on paid, 150s on free) while the response returns immediately
  EdgeRuntime.waitUntil(workPromise);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
