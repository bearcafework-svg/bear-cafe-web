/**
 * cron-smart-announcements
 * Runs every minute via pg_cron ('* * * * *').
 *
 * Round-robin logic — sends ONE campaign per invocation:
 *   1. Filter active campaigns whose cooldown has expired
 *   2. Pick the one with the oldest last_sent_at (NULL = never sent = highest priority)
 *   3. Send it to all target channels (skip inactive ones)
 *   4. Update last_sent_at
 *
 * This guarantees campaigns rotate in order and never all fire at once.
 *
 * Anti-spam:
 *   - Cooldown per campaign: interval_minutes from campaign_schedule_config
 *   - Channel activity check: skip channels with no message in last 7 days
 *   - 1000ms delay between Discord API calls
 *
 * pg_cron setup (run once in Supabase SQL Editor):
 *
 *   SELECT cron.schedule(
 *     'smart-announcements',
 *     '* * * * *',
 *     $$
 *     SELECT net.http_post(
 *       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-smart-announcements',
 *       headers := jsonb_build_object(
 *         'Content-Type',  'application/json',
 *         'Authorization', 'Bearer ' || (
 *           SELECT decrypted_secret FROM vault.decrypted_secrets
 *           WHERE name = 'service_role_key' LIMIT 1
 *         )
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
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

// ─── Pick the next campaign to send (round-robin by oldest last_sent_at) ─────
// Returns null if no campaign is ready (all on cooldown)
function pickNextCampaign(
  campaigns: CampaignMessage[],
  intervalMinutes: number,
): CampaignMessage | null {
  const nowMs = Date.now();
  const intervalMs = intervalMinutes * 60 * 1000;

  // Filter to only campaigns whose cooldown has expired
  const ready = campaigns.filter((c) => {
    if (!c.last_sent_at) return true; // never sent → always ready
    return nowMs - new Date(c.last_sent_at).getTime() >= intervalMs;
  });

  if (ready.length === 0) return null;

  // Sort: null last_sent_at first (never sent), then oldest last_sent_at
  ready.sort((a, b) => {
    if (!a.last_sent_at && !b.last_sent_at) return a.sort_order - b.sort_order;
    if (!a.last_sent_at) return -1;
    if (!b.last_sent_at) return 1;
    return new Date(a.last_sent_at).getTime() - new Date(b.last_sent_at).getTime();
  });

  return ready[0];
}

// ─── Human-readable time until next send ─────────────────────────────────────
function timeUntilNext(lastSentAt: string, intervalMinutes: number): string {
  const remaining = intervalMinutes * 60 * 1000 - (Date.now() - new Date(lastSentAt).getTime());
  if (remaining <= 0) return "now";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Check if the activity channel has recent messages (last 7 days) ─────────
// Uses a fixed reference channel instead of checking each target channel individually.
const ACTIVITY_REFERENCE_CHANNEL = "1144585665883938927";

interface ActivityStats {
  count_24h: number;
  count_7d: number;
  count_30d: number;
  oldest_sampled: string | null;
  is_active: boolean; // true if any message in last 7 days
}

/**
 * Fetch up to 500 recent messages from the reference channel (5 pages × 100),
 * count how many fall within 24h / 7d / 30d windows,
 * and return whether the channel is considered "active" (message in last 7 days).
 */
async function fetchActivityStats(botToken: string): Promise<ActivityStats> {
  const now = Date.now();
  const cut24h  = now - 1  * 24 * 60 * 60 * 1000;
  const cut7d   = now - 7  * 24 * 60 * 60 * 1000;
  const cut30d  = now - 30 * 24 * 60 * 60 * 1000;

  let count24h = 0;
  let count7d  = 0;
  let count30d = 0;
  let oldestSampled: string | null = null;
  let beforeId: string | undefined;
  let reachedOlderThan30d = false;

  // Paginate up to 5 pages (500 messages) — enough for most active channels
  for (let page = 0; page < 5 && !reachedOlderThan30d; page++) {
    const url = new URL(
      `https://discord.com/api/v10/channels/${ACTIVITY_REFERENCE_CHANNEL}/messages`,
    );
    url.searchParams.set("limit", "100");
    if (beforeId) url.searchParams.set("before", beforeId);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) {
      console.warn(`[activity-stats] Page ${page} returned ${res.status}`);
      break;
    }

    const messages: DiscordMessage[] = await res.json();
    if (messages.length === 0) break;

    for (const msg of messages) {
      const ts = new Date(msg.timestamp).getTime();
      oldestSampled = msg.timestamp; // messages are newest-first
      if (ts >= cut24h)  count24h++;
      if (ts >= cut7d)   count7d++;
      if (ts >= cut30d)  count30d++;
      else { reachedOlderThan30d = true; break; }
    }

    beforeId = messages[messages.length - 1].id;
    if (messages.length < 100) break; // no more pages
  }

  return {
    count_24h: count24h,
    count_7d:  count7d,
    count_30d: count30d,
    oldest_sampled: oldestSampled,
    is_active: count7d > 0,
  };
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

    if (!config?.is_enabled) {
      console.log("[cron] Schedule is disabled — exiting");
      return new Response(
        JSON.stringify({ message: "Schedule disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const intervalMinutes = config.interval_minutes ?? 1440;

    // ─── 2. Fetch all active campaigns ────────────────────────────────────────
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

    // ─── 3. Round-robin: pick ONE campaign to send this invocation ────────────
    const campaign = pickNextCampaign(campaigns as CampaignMessage[], intervalMinutes);

    if (!campaign) {
      // All campaigns are on cooldown — report when each will be ready
      const nextTimes = (campaigns as CampaignMessage[])
        .filter((c) => c.last_sent_at)
        .map((c) => ({
          name: c.internal_name,
          next_in: timeUntilNext(c.last_sent_at!, intervalMinutes),
        }));

      console.log(`[cron] All ${campaigns.length} campaigns on cooldown`);
      return new Response(
        JSON.stringify({
          message: "All campaigns on cooldown",
          interval_minutes: intervalMinutes,
          campaigns_on_cooldown: campaigns.length,
          next_sends: nextTimes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[cron] Round-robin selected: "${campaign.internal_name}" ` +
      `(last_sent_at=${campaign.last_sent_at ?? "never"}, ` +
      `interval=${intervalMinutes}min, ` +
      `channels=${campaign.target_channels.length})`,
    );

    // ─── 4. Fetch activity stats + check if server is active ─────────────────
    let activityStats: ActivityStats;
    try {
      activityStats = await fetchActivityStats(botToken);
    } catch (err) {
      console.error("[cron] Failed to fetch activity stats:", err);
      // Fail open — don't block sends if stats fetch errors
      activityStats = { count_24h: 0, count_7d: 0, count_30d: 0, oldest_sampled: null, is_active: true };
    }

    // Persist stats to DB (upsert — non-blocking, don't await failure)
    supabase.from("channel_activity_stats").upsert({
      channel_id:     ACTIVITY_REFERENCE_CHANNEL,
      count_24h:      activityStats.count_24h,
      count_7d:       activityStats.count_7d,
      count_30d:      activityStats.count_30d,
      oldest_sampled: activityStats.oldest_sampled,
      updated_at:     new Date().toISOString(),
    }, { onConflict: "channel_id" }).then(({ error }) => {
      if (error) console.error("[cron] Failed to save activity stats:", error);
    });

    console.log(
      `[activity] 24h=${activityStats.count_24h} 7d=${activityStats.count_7d} 30d=${activityStats.count_30d} active=${activityStats.is_active}`,
    );

    if (!activityStats.is_active) {
      console.log(`[cron] Reference channel inactive (7d) — skipping all sends`);
      return new Response(
        JSON.stringify({
          message: "Reference channel inactive — no sends",
          reference_channel: ACTIVITY_REFERENCE_CHANNEL,
          activity: activityStats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 5. Send to each target channel ──────────────────────────────────────
    const payload = buildCampaignPayload(campaign);
    const channelResults: Record<string, unknown>[] = [];
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let anySent = false;

    for (const channelId of campaign.target_channels) {
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

      // 1 second between Discord API calls to avoid rate limits
      await delay(1000);
    }

    // ─── 5. Update last_sent_at (only if at least one channel succeeded) ─────
    if (anySent) {
      const { error: updateError } = await supabase
        .from("campaign_messages")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", campaign.id);

      if (updateError) {
        console.error(`[cron] Failed to update last_sent_at:`, updateError);
      }
    }

    // ─── 6. Report cooldown status of remaining campaigns ────────────────────
    const remaining = (campaigns as CampaignMessage[])
      .filter((c) => c.id !== campaign.id && c.last_sent_at)
      .map((c) => ({
        name: c.internal_name,
        next_in: timeUntilNext(c.last_sent_at!, intervalMinutes),
      }));

    console.log(
      `[cron] Done — sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        mode: "round_robin",
        interval_minutes: intervalMinutes,
        activity_reference_channel: ACTIVITY_REFERENCE_CHANNEL,
        activity: {
          count_24h: activityStats.count_24h,
          count_7d:  activityStats.count_7d,
          count_30d: activityStats.count_30d,
        },
        selected_campaign: campaign.internal_name,
        total_sent: totalSent,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        channels: channelResults,
        other_campaigns_cooldown: remaining,
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
