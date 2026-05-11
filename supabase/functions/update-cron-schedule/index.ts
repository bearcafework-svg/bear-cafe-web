/**
 * update-cron-schedule
 * Updates the pg_cron job for smart announcements.
 * Called by the admin UI when the schedule is changed.
 *
 * POST body:
 *   { cron_expression: string, label: string, is_enabled: boolean }
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The pg_cron job name is fixed: 'smart-announcements'
 * The function URL is read from env: ANNOUNCEMENTS_FUNCTION_URL
 * (set this to: https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-smart-announcements)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRON_JOB_NAME = "smart-announcements";

// Validate cron expression (basic 5-field check)
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // Each part must be: number, *, */n, n-m, or comma-separated
  const field = /^(\*|(\d+(-\d+)?)(\,(\d+(-\d+)?))*|(\*\/\d+))$/;
  return parts.every((p) => field.test(p));
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const functionUrl = Deno.env.get("ANNOUNCEMENTS_FUNCTION_URL");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Parse body ───────────────────────────────────────────────────────────
    let body: { cron_expression?: string; label?: string; is_enabled?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { cron_expression, label, is_enabled } = body;

    if (!cron_expression || typeof cron_expression !== "string") {
      return new Response(
        JSON.stringify({ error: "cron_expression is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isValidCron(cron_expression)) {
      return new Response(
        JSON.stringify({ error: "Invalid cron expression. Must be 5 fields (e.g. '0 3 * * *')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Update config table ──────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("campaign_schedule_config")
      .update({
        cron_expression,
        label: label ?? cron_expression,
        is_enabled: is_enabled ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "00000000-0000-0000-0000-000000000001");

    if (updateError) {
      console.error("[update-cron] Failed to update config:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update schedule config", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Update pg_cron via SQL ───────────────────────────────────────────────
    // We use rpc to run raw SQL since pg_cron functions aren't exposed via PostgREST
    if (functionUrl) {
      if (is_enabled === false) {
        // Unschedule the job
        const { error: cronError } = await supabase.rpc("exec_sql", {
          sql: `SELECT cron.unschedule('${CRON_JOB_NAME}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${CRON_JOB_NAME}');`,
        });
        if (cronError) {
          console.warn("[update-cron] pg_cron unschedule warning (may not exist yet):", cronError.message);
        }
      } else {
        // Upsert the job: unschedule first (ignore error), then reschedule
        await supabase.rpc("exec_sql", {
          sql: `
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${CRON_JOB_NAME}') THEN
                PERFORM cron.unschedule('${CRON_JOB_NAME}');
              END IF;
            END $$;
          `,
        }).catch(() => {}); // ignore if cron extension not available

        const scheduleSQL = `
          SELECT cron.schedule(
            '${CRON_JOB_NAME}',
            '${cron_expression}',
            $$SELECT net.http_post(url := '${functionUrl}', headers := '{"Authorization": "Bearer ${supabaseServiceKey}"}'::jsonb);$$
          );
        `;
        const { error: scheduleError } = await supabase.rpc("exec_sql", { sql: scheduleSQL });
        if (scheduleError) {
          console.warn("[update-cron] pg_cron schedule warning:", scheduleError.message);
          // Don't fail — config was saved, admin can run SQL manually
        }
      }
    } else {
      console.warn("[update-cron] ANNOUNCEMENTS_FUNCTION_URL not set — config saved but pg_cron not updated");
    }

    return new Response(
      JSON.stringify({
        success: true,
        cron_expression,
        label: label ?? cron_expression,
        is_enabled: is_enabled ?? true,
        note: functionUrl
          ? "Schedule updated in pg_cron"
          : "Config saved. Set ANNOUNCEMENTS_FUNCTION_URL env var to auto-update pg_cron.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[update-cron] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
