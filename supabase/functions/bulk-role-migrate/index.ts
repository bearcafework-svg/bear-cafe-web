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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

      // Fire-and-forget to worker — worker has its own request lifecycle,
      // so the full pagination loop is not subject to this function's CPU limit
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-role-migrate-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-worker-secret": Deno.env.get("WORKER_SECRET")!,
        },
        body: JSON.stringify({
          action: "dry_run",
          job_id: job.id,
          guild_id: guildId,
          bot_token: botToken,
        }),
      }).catch((e) => console.error("Worker invoke failed:", e));

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

      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-role-migrate-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-worker-secret": Deno.env.get("WORKER_SECRET")!,
        },
        body: JSON.stringify({
          action: "execute",
          job_id: job.id,
          guild_id: guildId,
          bot_token: botToken,
          retry_errors_only: !!retry_errors_only,
          source_job_id: source_job_id ?? null,
        }),
      }).catch((e) => console.error("Worker invoke failed:", e));

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
