/**
 * bulk-role-migrate-worker — Internal worker (page-per-invocation)
 *
 * Each invocation processes exactly ONE page (1,000 Discord members) then
 * self-invokes for the next page via fire-and-forget fetch().
 *
 * This sidesteps the 150s wall-clock limit entirely: each invocation only
 * needs ~2-10s (Discord fetch + up to ~10 PUT role calls × 200ms delay).
 *
 * State carried across invocations via request body:
 *   after        — Discord pagination cursor (user ID)
 *   total_fetched — cumulative members fetched so far
 *   global_idx   — cumulative members processed (execute only)
 *   success_count / skip_count / error_count
 *
 * Protected by WORKER_SECRET header.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

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
    member.nick ?? member.user?.global_name ?? member.user?.username ?? "Unknown";

  const heldOldRoles = OLD_ROLE_PRIORITY.filter((r) => roles.includes(r));

  if (heldOldRoles.length === 0) {
    return { discord_user_id: userId, username, old_role_ids: [], resolved_old_role_id: null, new_role_id: null, result_status: "skipped_no_old_role", error_message: null };
  }

  const resolvedOldRole = heldOldRoles[0];
  const targetNewRole = ROLE_MAPPING[resolvedOldRole];
  const isAnomaly = heldOldRoles.length > 1;

  if (roles.includes(targetNewRole)) {
    return { discord_user_id: userId, username, old_role_ids: heldOldRoles, resolved_old_role_id: resolvedOldRole, new_role_id: targetNewRole, result_status: "skipped_already_has", error_message: null };
  }

  return { discord_user_id: userId, username, old_role_ids: heldOldRoles, resolved_old_role_id: resolvedOldRole, new_role_id: targetNewRole, result_status: isAnomaly ? "anomaly_multiple_old" : "will_assign", error_message: null };
}

function selfInvoke(payload: Record<string, unknown>) {
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-role-migrate-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "x-worker-secret": Deno.env.get("WORKER_SECRET")!,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("[worker] self-invoke failed:", e));
}

// ──────────────────────────────────────────────────────────────────
// dry_run page handler
// ──────────────────────────────────────────────────────────────────

async function runDryRunPage(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
  after: string,
  totalFetched: number,
  totalProcessed: number,
) {
  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord fetch failed (${res.status}): ${text}`);
    }

    const batch: any[] = await res.json();

    if (batch.length === 0) {
      // No more members — finalize
      await supabase.from("role_migration_jobs").update({
        status: "completed",
        total_members: totalFetched,
        processed: totalProcessed,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      console.log(`[worker dry_run] completed jobId=${jobId} total=${totalFetched}`);
      return;
    }

    const newTotalFetched = totalFetched + batch.length;
    const analyses = batch.filter((m: any) => !m.user?.bot).map(analyseMember);
    const newTotalProcessed = totalProcessed + analyses.length;

    // Update running counters on job
    let toAssign = 0, alreadyHas = 0, noOldRole = 0;
    for (const a of analyses) {
      if (a.result_status === "will_assign" || a.result_status === "anomaly_multiple_old") toAssign++;
      if (a.result_status === "skipped_already_has") alreadyHas++;
      if (a.result_status === "skipped_no_old_role") noOldRole++;
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

    await supabase.from("role_migration_jobs").update({
      total_members: newTotalFetched,
      processed: newTotalProcessed,
    }).eq("id", jobId);

    if (batch.length < 1000) {
      // Last page — finalize
      await supabase.from("role_migration_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      console.log(`[worker dry_run] completed jobId=${jobId} total=${newTotalFetched}`);
    } else {
      // More pages — self-invoke with next cursor
      const nextAfter = batch[batch.length - 1].user.id;
      selfInvoke({
        action: "dry_run",
        job_id: jobId,
        guild_id: guildId,
        bot_token: botToken,
        after: nextAfter,
        total_fetched: newTotalFetched,
        total_processed: newTotalProcessed,
      });
    }
  } catch (err) {
    console.error("[worker dry_run error]", err);
    await supabase.from("role_migration_jobs").update({ status: "failed" }).eq("id", jobId);
  }
}

// ──────────────────────────────────────────────────────────────────
// execute page handler
// ──────────────────────────────────────────────────────────────────

async function runExecutePage(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
  after: string,
  totalFetched: number,
  globalIdx: number,
  successCount: number,
  skipCount: number,
  errorCount: number,
) {
  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord fetch failed (${res.status}): ${text}`);
    }

    const batch: any[] = await res.json();
    const newTotalFetched = totalFetched + batch.length;

    if (batch.length === 0) {
      await supabase.from("role_migration_jobs").update({
        status: "completed",
        total_members: totalFetched,
        processed: globalIdx,
        success_count: successCount,
        skip_count: skipCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      console.log(`[worker execute] completed jobId=${jobId} total=${totalFetched} success=${successCount} error=${errorCount}`);
      return;
    }

    // Update total estimate
    await supabase.from("role_migration_jobs").update({ total_members: newTotalFetched }).eq("id", jobId);

    const toProcess = batch
      .filter((m: any) => !m.user?.bot)
      .map(analyseMember)
      .filter((a) => a.result_status === "will_assign" || a.result_status === "anomaly_multiple_old");

    const logRows: any[] = [];
    let newGlobalIdx = globalIdx;
    let newSuccess = successCount;
    let newSkip = skipCount;
    let newError = errorCount;

    for (const analysis of toProcess) {
      newGlobalIdx++;

      if (!analysis.new_role_id) {
        newSkip++;
        logRows.push({ job_id: jobId, discord_user_id: analysis.discord_user_id, username: analysis.username, old_role_ids: analysis.old_role_ids, resolved_old_role_id: analysis.resolved_old_role_id, new_role_id: null, result_status: "skipped_no_old_role", error_message: null });
        continue;
      }

      try {
        const roleRes = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${analysis.discord_user_id}/roles/${analysis.new_role_id}`,
          { method: "PUT", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "Bulk class role migration" } },
        );

        if (roleRes.ok || roleRes.status === 204) {
          newSuccess++;
          logRows.push({ job_id: jobId, discord_user_id: analysis.discord_user_id, username: analysis.username, old_role_ids: analysis.old_role_ids, resolved_old_role_id: analysis.resolved_old_role_id, new_role_id: analysis.new_role_id, result_status: "assigned", error_message: null });
          // Respect Discord rate limit: ~5 PUT role requests/sec per guild
          await new Promise((r) => setTimeout(r, 200));
        } else {
          const errText = await roleRes.text();
          newError++;
          logRows.push({ job_id: jobId, discord_user_id: analysis.discord_user_id, username: analysis.username, old_role_ids: analysis.old_role_ids, resolved_old_role_id: analysis.resolved_old_role_id, new_role_id: analysis.new_role_id, result_status: "error", error_message: `HTTP ${roleRes.status}: ${errText.slice(0, 200)}` });
        }
      } catch (memberErr) {
        newError++;
        logRows.push({ job_id: jobId, discord_user_id: analysis.discord_user_id, username: analysis.username, old_role_ids: analysis.old_role_ids, resolved_old_role_id: analysis.resolved_old_role_id, new_role_id: analysis.new_role_id, result_status: "error", error_message: (memberErr as Error).message?.slice(0, 200) ?? "Unknown error" });
      }
    }

    if (logRows.length > 0) {
      await supabase.from("role_migration_log").insert(logRows);
    }
    await supabase.from("role_migration_jobs").update({
      processed: newGlobalIdx,
      success_count: newSuccess,
      skip_count: newSkip,
      error_count: newError,
    }).eq("id", jobId);

    if (batch.length < 1000) {
      // Last page — finalize
      await supabase.from("role_migration_jobs").update({
        status: "completed",
        total_members: newTotalFetched,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      console.log(`[worker execute] completed jobId=${jobId} success=${newSuccess} error=${newError}`);
    } else {
      // More pages — self-invoke with next cursor + accumulated state
      const nextAfter = batch[batch.length - 1].user.id;
      selfInvoke({
        action: "execute",
        job_id: jobId,
        guild_id: guildId,
        bot_token: botToken,
        after: nextAfter,
        total_fetched: newTotalFetched,
        global_idx: newGlobalIdx,
        success_count: newSuccess,
        skip_count: newSkip,
        error_count: newError,
      });
    }
  } catch (err) {
    console.error("[worker execute error]", err);
    await supabase.from("role_migration_jobs").update({ status: "failed" }).eq("id", jobId);
  }
}

// ──────────────────────────────────────────────────────────────────
// retry-errors-only handler (small set, single invocation is fine)
// ──────────────────────────────────────────────────────────────────

async function runRetryErrors(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  guildId: string,
  botToken: string,
  sourceJobId: string,
) {
  try {
    const { data: errorLogs } = await supabase
      .from("role_migration_log")
      .select("discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id")
      .eq("job_id", sourceJobId)
      .eq("result_status", "error");

    const members: MemberAnalysis[] = (errorLogs ?? []).map((row: any) => ({
      discord_user_id: row.discord_user_id,
      username: row.username ?? "Unknown",
      old_role_ids: row.old_role_ids ?? [],
      resolved_old_role_id: row.resolved_old_role_id,
      new_role_id: row.new_role_id,
      result_status: "will_assign",
      error_message: null,
    }));

    await supabase.from("role_migration_jobs").update({ total_members: members.length }).eq("id", jobId);

    let success = 0, skip = 0, error = 0;
    const logRows: any[] = [];

    for (let idx = 0; idx < members.length; idx++) {
      const a = members[idx];
      if (!a.new_role_id) { skip++; logRows.push({ job_id: jobId, discord_user_id: a.discord_user_id, username: a.username, old_role_ids: a.old_role_ids, resolved_old_role_id: a.resolved_old_role_id, new_role_id: null, result_status: "skipped_no_old_role", error_message: null }); continue; }

      try {
        const res = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${a.discord_user_id}/roles/${a.new_role_id}`,
          { method: "PUT", headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "Bulk class role migration" } },
        );
        if (res.ok || res.status === 204) {
          success++;
          logRows.push({ job_id: jobId, discord_user_id: a.discord_user_id, username: a.username, old_role_ids: a.old_role_ids, resolved_old_role_id: a.resolved_old_role_id, new_role_id: a.new_role_id, result_status: "assigned", error_message: null });
          await new Promise((r) => setTimeout(r, 200));
        } else {
          const errText = await res.text();
          error++;
          logRows.push({ job_id: jobId, discord_user_id: a.discord_user_id, username: a.username, old_role_ids: a.old_role_ids, resolved_old_role_id: a.resolved_old_role_id, new_role_id: a.new_role_id, result_status: "error", error_message: `HTTP ${res.status}: ${errText.slice(0, 200)}` });
        }
      } catch (e) {
        error++;
        logRows.push({ job_id: jobId, discord_user_id: a.discord_user_id, username: a.username, old_role_ids: a.old_role_ids, resolved_old_role_id: a.resolved_old_role_id, new_role_id: a.new_role_id, result_status: "error", error_message: (e as Error).message?.slice(0, 200) ?? "Unknown" });
      }

      if (logRows.length >= 100) {
        await supabase.from("role_migration_log").insert(logRows.splice(0));
        await supabase.from("role_migration_jobs").update({ processed: idx + 1, success_count: success, skip_count: skip, error_count: error }).eq("id", jobId);
      }
    }

    if (logRows.length > 0) await supabase.from("role_migration_log").insert(logRows);

    await supabase.from("role_migration_jobs").update({
      status: "completed",
      processed: members.length,
      success_count: success,
      skip_count: skip,
      error_count: error,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    console.error("[worker retry error]", err);
    await supabase.from("role_migration_jobs").update({ status: "failed" }).eq("id", jobId);
  }
}

// ──────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────

Deno.serve(async (req): Promise<Response> => {
  const secret = req.headers.get("x-worker-secret");
  if (secret !== Deno.env.get("WORKER_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    action,
    job_id,
    guild_id,
    bot_token,
    retry_errors_only,
    source_job_id,
    after = "0",
    total_fetched = 0,
    total_processed = 0,
    global_idx = 0,
    success_count = 0,
    skip_count = 0,
    error_count = 0,
  } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (action === "dry_run") {
    await runDryRunPage(supabase, job_id, guild_id, bot_token, after, total_fetched, total_processed);
  } else if (retry_errors_only && source_job_id) {
    await runRetryErrors(supabase, job_id, guild_id, bot_token, source_job_id);
  } else {
    await runExecutePage(supabase, job_id, guild_id, bot_token, after, total_fetched, global_idx, success_count, skip_count, error_count);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
