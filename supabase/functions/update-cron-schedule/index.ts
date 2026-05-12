/**
 * update-cron-schedule
 * Saves interval_minutes + is_enabled to campaign_schedule_config.
 *
 * POST body:
 *   { interval_minutes: number, is_enabled: boolean }
 *
 * interval_minutes: 5 – 10080 (5 min to 1 week)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildLabel(minutes: number): string {
  if (minutes < 60) return `ส่งทุก ${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) {
    if (h === 24) return "ส่งทุก 24 ชั่วโมง (วันละครั้ง)";
    if (h === 48) return "ส่งทุก 48 ชั่วโมง (2 วัน)";
    if (h === 168) return "ส่งทุก 168 ชั่วโมง (สัปดาห์ละครั้ง)";
    return `ส่งทุก ${h} ชั่วโมง`;
  }
  return `ส่งทุก ${h} ชั่วโมง ${m} นาที`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { interval_minutes?: number; is_enabled?: boolean };
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    }); }

    const { interval_minutes, is_enabled } = body;

    if (interval_minutes !== undefined) {
      if (
        typeof interval_minutes !== "number" ||
        !Number.isInteger(interval_minutes) ||
        interval_minutes < 5 ||
        interval_minutes > 10080
      ) {
        return new Response(
          JSON.stringify({ error: "interval_minutes must be an integer between 5 and 10080" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const minutes = interval_minutes ?? 1440;
    const label = buildLabel(minutes);

    const updatePayload: Record<string, unknown> = {
      label,
      updated_at: new Date().toISOString(),
    };
    if (interval_minutes !== undefined) {
      updatePayload.interval_minutes = interval_minutes;
      // keep interval_hours in sync for backward compat
      updatePayload.interval_hours = Math.max(1, Math.round(interval_minutes / 60));
    }
    if (is_enabled !== undefined) updatePayload.is_enabled = is_enabled;

    const { error: updateError } = await supabase
      .from("campaign_schedule_config")
      .update(updatePayload)
      .eq("id", "00000000-0000-0000-0000-000000000001");

    if (updateError) {
      console.error("[update-cron] Failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update config", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, interval_minutes: minutes, is_enabled, label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal server error", details: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
