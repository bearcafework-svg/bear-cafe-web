/**
 * cron-smart-announcements
 * Runs every hour via pg_cron ('0 * * * *').
 * The actual send frequency is controlled by `interval_hours` in campaign_schedule_config.
 *
 * Anti-spam logic (per campaign):
 *   - If last_sent_at is NULL → send (first time)
 *   - If now - last_sent_at < interval_hours → skip (cooldown active)
 *   - If now - last_sent_at >= interval_hours → send
 *
 * Channel activity check:
 *   - Fetches the last message in the channel
 *   - Skips if no message in the last 7 days (dead channel)
 *
 * pg_cron setup (run once in Supabase SQL Editor):
 *
 *   SELECT cron.schedule(
 *     'smart-announcements',
 *     '0 * * * *',   -- every hour; interval_hours controls actual frequency
 *     $$
 *     SELECT net.http_post(
 *       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-smart-announcements',
 *       headers := '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleConfig {
  interval_minutes: number;
  is_enabled: boolean;
}

interface CampaignMessage {
  id: string;
  internal_name: string;
  content_text: string;
  image_url: string | null;
  has_button: boolean;
  button_label: string | null;
  button_url: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  target_channels: string[];
  sort_order: number;
  last_sent_at: string | null;
}

interface DiscordMessage {
  id: string;
  timestamp: string;
}

// ─── Build Discord Component-Based Payload (type 17 container) ───────────────
function buildCampaignPayload(campaign: CampaignMessage): Record<string, unknown> {
  const components: unknown[] = [];

  if (campaign.image_url) {
    components.push({
      type: 12,
      items: [{ media: { url: campaign.image_url } }],
    });
    components.push({ type: 14, spacing: 2 });
  }

  components.push({ type: 10, content: campaign.content_text });
  components.push({ type: 14, spacing: 2, divider: true });

  if (campaign.has_button && campaign.button_label && campaign.button_url) {
    const button: Record<string, unknown> = {
      type: 2,
      style: 5,
      label: campaign.button_label,
      url: campaign.button_url,
    };
    if (campaign.button_emoji_id || campaign.button_emoji_name) {
      button.emoji = {
        id: campaign.button_emoji_id ?? undefined,
        name: campaign.button_emoji_name ?? undefined,
        animated: false,
      };
    }
    components.push({ type: 1, components: [button] });
  }

  return {
    flags: 32768,
    components: [{ type: 17, components }],
  };
}

// ─── Check if campaign is past its cooldown ───────────────────────────────────
function isCooldownExpired(lastSentAt: string | null, intervalMinutes: number): boolean {
  if (!lastSentAt) return true;
  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  return elapsed >= intervalMinutes * 60 * 1000;
}

// ─── Human-readable time until next send ─────────────────────────────────────
function timeUntilNext(lastSentAt: string, intervalMinutes: number): string {
  const remaining = intervalMinutes * 60 * 1000 - (Date.now() - new Date(lastSentAt).getTime());
  if (remaining <= 0) return "now";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Check if channel has recent activity (last 7 days) ──────────────────────
async function hasRecentActivity(channelId: string, botToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=1`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (!res.ok) {
      console.warn(`[activity] Channel ${channelId} returned ${res.status} — skipping`);
      return false;
    }
    const messages: DiscordMessage[] = await res.json();
    if (messages.length === 0) return false;
    const lastMs = new Date(messages[0].timestamp).getTime();
    return Date.now() - lastMs < 7 * 24 * 60 * 60 * 1000;
  } catch (err) {
    console.error(`[activity] Error checking channel ${channelId}:`, err);
    return false;
  }
}

// ─── Send to a single Discord channel ────────────────────────────────────────
async function sendToChannel(
  channelId: string,
  payload: Record<string, unknown>,
  botToken: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[send] Channel ${channelId} error ${res.status}:`, text.slice(0, 200));
      return { success: false, error: `Discord ${res.status}` };
    }
    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
      console.error("[cron] Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 1. Read schedule config ──────────────────────────────────────────────
    const { data: configRow, error: configError } = await supabase
      .from("campaign_schedule_config")
      .select("interval_minutes, is_enabled")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    if (configError) {
      console.error("[cron] Failed to read schedule config:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to read schedule config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = configRow as ScheduleConfig | null;

    // If schedule is disabled, exit early
    if (!config?.is_enabled) {
      console.log("[cron] Schedule is disabled — exiting");
      return new Response(
        JSON.stringify({ message: "Schedule disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const intervalMinutes = config.interval_minutes ?? 1440;
    console.log(`[cron] Running with interval_minutes=${intervalMinutes}`);

    // ─── 2. Fetch active campaigns ────────────────────────────────────────────
    const { data: campaigns, error: fetchError } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      console.error("[cron] Failed to fetch campaigns:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaigns" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active campaigns", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Record<string, unknown>[] = [];
    let totalSent = 0;
    let totalCooldown = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // ─── 3. Process each campaign ─────────────────────────────────────────────
    for (const campaign of campaigns as CampaignMessage[]) {

      // ── Anti-spam: check cooldown ──────────────────────────────────────────
      if (!isCooldownExpired(campaign.last_sent_at, intervalMinutes)) {
        const remaining = timeUntilNext(campaign.last_sent_at!, intervalMinutes);
        console.log(
          `[cron] "${campaign.internal_name}" cooldown active — next in ${remaining}`,
        );
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.internal_name,
          status: "cooldown",
          next_send_in: remaining,
        });
        totalCooldown++;
        continue;
      }

      const payload = buildCampaignPayload(campaign);
      const channelResults: Record<string, unknown>[] = [];
      let anySent = false;

      console.log(
        `[cron] "${campaign.internal_name}" — targeting ${campaign.target_channels.length} channels`,
      );

      // ── Send to each target channel ────────────────────────────────────────
      for (const channelId of campaign.target_channels) {

        // Activity check — skip dead channels
        const active = await hasRecentActivity(channelId, botToken);
        if (!active) {
          console.log(`[cron] Channel ${channelId} inactive — skipping`);
          channelResults.push({ channel_id: channelId, status: "skipped", reason: "inactive_7d" });
          totalSkipped++;
          continue;
        }

        // Send
        const result = await sendToChannel(channelId, payload, botToken);
        if (result.success) {
          console.log(`[cron] Sent to ${channelId}, messageId=${result.messageId}`);
          channelResults.push({ channel_id: channelId, status: "sent", message_id: result.messageId });
          totalSent++;
          anySent = true;
        } else {
          console.error(`[cron] Failed ${channelId}: ${result.error}`);
          channelResults.push({ channel_id: channelId, status: "failed", error: result.error });
          totalFailed++;
        }

        // 1 second between Discord API calls
        await delay(1000);
      }

      // ── Update last_sent_at only if at least one channel was sent ──────────
      if (anySent) {
        const { error: updateError } = await supabase
          .from("campaign_messages")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", campaign.id);

        if (updateError) {
          console.error(`[cron] Failed to update last_sent_at for "${campaign.internal_name}":`, updateError);
        }
      }

      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.internal_name,
        channels: channelResults,
      });
    }

    console.log(
      `[cron] Done — sent=${totalSent} cooldown=${totalCooldown} skipped=${totalSkipped} failed=${totalFailed}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        interval_minutes: intervalMinutes,
        campaigns_processed: campaigns.length,
        total_sent: totalSent,
        total_cooldown: totalCooldown,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        results,
        executed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
