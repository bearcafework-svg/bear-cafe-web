/**
 * update-cron-schedule
 * Saves interval_hours + is_enabled to campaign_schedule_config.
 * The pg_cron job always runs every hour ('0 * * * *') —
 * the actual send frequency is enforced inside cron-smart-announcements
 * by comparing last_sent_at against interval_hours.
 *
 * POST body:
 *   { interval_hours: number, is_enabled: boolean }
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: { interval_hours?: number; is_enabled?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { interval_hours, is_enabled } = body;

    // Validate interval_hours
    if (interval_hours !== undefined) {
      if (
        typeof interval_hours !== "number" ||
        !Number.isInteger(interval_hours) ||
        interval_hours < 1 ||
        interval_hours > 168
      ) {
        return new Response(
          JSON.stringify({ error: "interval_hours must be an integer between 1 and 168" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build label from interval_hours
    const hours = interval_hours ?? 24;
    let label: string;
    if (hours < 24) label = `ส่งทุก ${hours} ชั่วโมง`;
    else if (hours === 24) label = "ส่งทุก 24 ชั่วโมง (วันละครั้ง)";
    else if (hours === 48) label = "ส่งทุก 48 ชั่วโมง (2 วัน)";
    else if (hours === 72) label = "ส่งทุก 72 ชั่วโมง (3 วัน)";
    else if (hours === 168) label = "ส่งทุก 168 ชั่วโมง (สัปดาห์ละครั้ง)";
    else label = `ส่งทุก ${hours} ชั่วโมง`;

    // Update config table
    const updatePayload: Record<string, unknown> = {
      label,
      updated_at: new Date().toISOString(),
    };
    if (interval_hours !== undefined) updatePayload.interval_hours = interval_hours;
    if (is_enabled !== undefined) updatePayload.is_enabled = is_enabled;

    const { error: updateError } = await supabase
      .from("campaign_schedule_config")
      .update(updatePayload)
      .eq("id", "00000000-0000-0000-0000-000000000001");

    if (updateError) {
      console.error("[update-cron] Failed to update config:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update config", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[update-cron] Updated: interval_hours=${hours}, is_enabled=${is_enabled}`);

    return new Response(
      JSON.stringify({
        success: true,
        interval_hours: hours,
        is_enabled: is_enabled ?? true,
        label,
        note: "Config saved. pg_cron runs every hour; actual send frequency is enforced by interval_hours.",
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
