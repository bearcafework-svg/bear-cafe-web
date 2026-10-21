/**
 * reset-campaign-queue
 * Recalculates next_send_at for all active campaigns based on current
 * sort_order and interval_minutes from campaign_schedule_config.
 *
 * Use when:
 *   - Adding a new campaign (so it joins the queue correctly)
 *   - Changing interval_minutes (so all timings update)
 *   - Reordering campaigns (drag-and-drop)
 *   - Manually resetting the queue
 *
 * Result:
 *   sort_order=0 → next_send_at = NULL (send immediately on next cron tick)
 *   sort_order=1 → next_send_at = now + 1×interval
 *   sort_order=2 → next_send_at = now + 2×interval
 *   ...
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Read current interval ────────────────────────────────────────────────
    const { data: config } = await supabase
      .from("campaign_schedule_config")
      .select("interval_minutes")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    const intervalMinutes: number = config?.interval_minutes ?? 1440;
    const intervalMs = intervalMinutes * 60 * 1000;

    // ─── Fetch active campaigns ordered by sort_order ─────────────────────────
    const { data: campaigns, error: fetchError } = await supabase
      .from("campaign_messages")
      .select("id, internal_name, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No active campaigns", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Recalculate next_send_at for each campaign ───────────────────────────
    // Position 0 → NULL (send immediately)
    // Position N → now + N × interval
    const now = Date.now();
    const updates = campaigns.map((c, index) => ({
      id: c.id,
      name: c.internal_name,
      next_send_at: index === 0 ? null : new Date(now + index * intervalMs).toISOString(),
    }));

    // Batch update
    const results = await Promise.all(
      updates.map(({ id, next_send_at }) =>
        supabase
          .from("campaign_messages")
          .update({ next_send_at })
          .eq("id", id)
      )
    );

    const errors = results.filter((r) => r.error).map((r) => r.error?.message);
    if (errors.length > 0) {
      console.error("[reset-queue] Some updates failed:", errors);
    }

    console.log(
      `[reset-queue] Reset ${campaigns.length} campaigns with interval=${intervalMinutes}min`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        interval_minutes: intervalMinutes,
        updated: campaigns.length,
        queue: updates.map((u) => ({
          name: u.name,
          next_send_at: u.next_send_at ?? "now (immediate)",
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reset-queue] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
