import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVITY_REFERENCE_CHANNEL = "1524124134387224828";

interface ScheduleConfig {
  interval_minutes: number;
  is_enabled: boolean;
}

interface CampaignMessage {
  id: string;
  internal_name: string;
  content_text: string;
  image_url: string | null;
  image_url_2: string | null;
  has_button: boolean;
  button_label: string | null;
  button_url: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  button_2_label: string | null;
  button_2_url: string | null;
  button_2_emoji_id: string | null;
  button_2_emoji_name: string | null;
  target_channels: string[];
  sort_order: number;
  last_sent_at: string | null;
  next_send_at: string | null;
}

interface DiscordMessage {
  id: string;
  timestamp: string;
}

interface ActivityStats {
  count_24h: number;
  count_7d: number;
  count_30d: number;
  oldest_sampled: string | null;
  is_active: boolean;
}

function buildCampaignPayload(campaign: CampaignMessage): Record<string, unknown> {
  const components: unknown[] = [];

  // ── Image 1 ──
  if (campaign.image_url) {
    components.push({ type: 12, items: [{ media: { url: campaign.image_url } }] });
  }

  // ── Image 2 ──
  if (campaign.image_url_2) {
    components.push({ type: 12, items: [{ media: { url: campaign.image_url_2 } }] });
  }

  // ── Divider (หลัง image) ──
  components.push({ type: 14, spacing: 2, divider: true });

  // ── Text ──
  components.push({ type: 10, content: campaign.content_text });

  // ── Divider (หลัง text) ──
  components.push({ type: 14, spacing: 2, divider: true });

  // ── Buttons ──
  const buttons: Record<string, unknown>[] = [];

  if (campaign.has_button && campaign.button_label && campaign.button_url) {
    const btn: Record<string, unknown> = {
      type: 2, style: 5,
      label: campaign.button_label,
      url: campaign.button_url,
    };
    if (campaign.button_emoji_id || campaign.button_emoji_name) {
      btn.emoji = {
        id: campaign.button_emoji_id ?? undefined,
        name: campaign.button_emoji_name ?? undefined,
        animated: false,
      };
    }
    buttons.push(btn);
  }

  if (campaign.button_2_label && campaign.button_2_url) {
    const btn2: Record<string, unknown> = {
      type: 2, style: 5,
      label: campaign.button_2_label,
      url: campaign.button_2_url,
    };
    if (campaign.button_2_emoji_id || campaign.button_2_emoji_name) {
      btn2.emoji = {
        id: campaign.button_2_emoji_id ?? undefined,
        name: campaign.button_2_emoji_name ?? undefined,
        animated: false,
      };
    }
    buttons.push(btn2);
  }

  if (buttons.length > 0) {
    components.push({ type: 1, components: buttons });
  }

  return { flags: 32768, components: [{ type: 17, components }] };
}

// ─── Pick the ONE campaign that is due to send right now ─────────────────────
// Selects: next_send_at IS NULL OR next_send_at <= now
// Ordered: next_send_at ASC NULLS FIRST, then sort_order ASC
function pickDueCampaign(campaigns: CampaignMessage[]): CampaignMessage | null {
  const now = Date.now();
  const due = campaigns.filter((c) =>
    !c.next_send_at || new Date(c.next_send_at).getTime() <= now
  );
  if (due.length === 0) return null;

  due.sort((a, b) => {
    // NULL next_send_at = highest priority (never scheduled)
    if (!a.next_send_at && !b.next_send_at) return a.sort_order - b.sort_order;
    if (!a.next_send_at) return -1;
    if (!b.next_send_at) return 1;
    const diff = new Date(a.next_send_at).getTime() - new Date(b.next_send_at).getTime();
    return diff !== 0 ? diff : a.sort_order - b.sort_order;
  });

  return due[0];
}

// ─── Format ms remaining as human-readable string ────────────────────────────
function formatRemaining(nextSendAt: string): string {
  const ms = new Date(nextSendAt).getTime() - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Fetch activity stats from reference channel ──────────────────────────────
async function fetchActivityStats(botToken: string): Promise<ActivityStats> {
  const now = Date.now();
  const cut24h = now - 1  * 24 * 60 * 60 * 1000;
  const cut7d  = now - 7  * 24 * 60 * 60 * 1000;
  const cut30d = now - 30 * 24 * 60 * 60 * 1000;

  let count24h = 0, count7d = 0, count30d = 0;
  let oldestSampled: string | null = null;
  let beforeId: string | undefined;
  let reachedOlderThan30d = false;

  for (let page = 0; page < 5 && !reachedOlderThan30d; page++) {
    const url = new URL(`https://discord.com/api/v10/channels/${ACTIVITY_REFERENCE_CHANNEL}/messages`);
    url.searchParams.set("limit", "100");
    if (beforeId) url.searchParams.set("before", beforeId);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bot ${botToken}` } });
    if (!res.ok) {
      // ★ เพิ่มใหม่: log รายละเอียด error ตอนดึง activity stats ไม่สำเร็จ
      const text = await res.text().catch(() => "");
      console.warn(`[activity] Page ${page} → ${res.status} ${text.slice(0, 200)}`);
      break;
    }

    const messages: DiscordMessage[] = await res.json();
    if (messages.length === 0) break;

    for (const msg of messages) {
      const ts = new Date(msg.timestamp).getTime();
      oldestSampled = msg.timestamp;
      if (ts >= cut24h) count24h++;
      if (ts >= cut7d)  count7d++;
      if (ts >= cut30d) count30d++;
      else { reachedOlderThan30d = true; break; }
    }

    beforeId = messages[messages.length - 1].id;
    if (messages.length < 100) break;
  }

  return { count_24h: count24h, count_7d: count7d, count_30d: count30d, oldest_sampled: oldestSampled, is_active: count7d > 0 };
}

// ─── Send to a single Discord channel ────────────────────────────────────────
async function sendToChannel(
  channelId: string,
  payload: Record<string, unknown>,
  botToken: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      const errMsg = `Discord ${res.status}: ${text.slice(0, 300)}`;
      // ★ เพิ่มใหม่: log สาเหตุ error แบบเต็มๆ ทันทีที่เกิด ไม่ต้องรอไปดูใน response JSON
      console.error(`[cron] sendToChannel(${channelId}) failed → ${errMsg}`);
      return { success: false, error: `Discord ${res.status}: ${text.slice(0, 100)}` };
    }
    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // ★ เพิ่มใหม่: log กรณี fetch เอง throw exception (network error ฯลฯ)
    console.error(`[cron] sendToChannel(${channelId}) threw exception → ${message}`);
    return { success: false, error: message };
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
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 1. Read schedule config ──────────────────────────────────────────────
    const { data: configRow } = await supabase
      .from("campaign_schedule_config")
      .select("interval_minutes, is_enabled")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    const config = configRow as ScheduleConfig | null;
    if (!config?.is_enabled) {
      return new Response(JSON.stringify({ message: "Schedule disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intervalMinutes = config.interval_minutes ?? 1440;
    const intervalMs = intervalMinutes * 60 * 1000;

    // ─── 2. Fetch active campaigns ────────────────────────────────────────────
    const { data: campaigns, error: fetchError } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (fetchError || !campaigns?.length) {
      return new Response(JSON.stringify({ message: "No active campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 3. Pick the ONE due campaign ────────────────────────────────────────
    const campaign = pickDueCampaign(campaigns as CampaignMessage[]);

    if (!campaign) {
      const queue = (campaigns as CampaignMessage[]).map((c) => ({
        name: c.internal_name,
        next_in: c.next_send_at ? formatRemaining(c.next_send_at) : "now",
      }));
      console.log(`[cron] No campaign due — all waiting`);
      return new Response(
        JSON.stringify({ message: "No campaign due", queue }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[cron] Sending: "${campaign.internal_name}" (next_send_at=${campaign.next_send_at ?? "null"})`);

    // ─── 4. Activity check + stats ────────────────────────────────────────────
    let activityStats: ActivityStats;
    try {
      activityStats = await fetchActivityStats(botToken);
    } catch (err) {
      // ★ เพิ่มใหม่: log เมื่อ fetchActivityStats throw exception (เดิม catch เงียบๆ)
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron] fetchActivityStats threw exception → ${message}`);
      activityStats = { count_24h: 0, count_7d: 0, count_30d: 0, oldest_sampled: null, is_active: true };
    }

    // Save stats to DB (non-blocking)
    supabase.from("channel_activity_stats").upsert({
      channel_id: ACTIVITY_REFERENCE_CHANNEL,
      count_24h: activityStats.count_24h,
      count_7d: activityStats.count_7d,
      count_30d: activityStats.count_30d,
      oldest_sampled: activityStats.oldest_sampled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "channel_id" }).then(({ error }) => {
      if (error) console.error("[cron] Stats save error:", error);
    });

    if (!activityStats.is_active) {
      console.log("[cron] Reference channel inactive — skipping");
      return new Response(
        JSON.stringify({ message: "Reference channel inactive", activity: activityStats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 5. Send to target channels ───────────────────────────────────────────
    const payload = buildCampaignPayload(campaign);
    const channelResults: Record<string, unknown>[] = [];
    let totalSent = 0, totalFailed = 0;
    let anySent = false;

    for (const channelId of campaign.target_channels) {
      const result = await sendToChannel(channelId, payload, botToken);
      if (result.success) {
        channelResults.push({ channel_id: channelId, status: "sent", message_id: result.messageId });
        totalSent++;
        anySent = true;
      } else {
        channelResults.push({ channel_id: channelId, status: "failed", error: result.error });
        totalFailed++;
      }
      await delay(1000);
    }

    // ─── 6. Update this campaign's next_send_at ───────────────────────────────
    // next_send_at = now + (total_campaigns × interval)
    // This ensures this campaign won't fire again until all others have had a turn
    const nowIso = new Date().toISOString();
    const totalCampaigns = campaigns.length;
    const nextSendAt = new Date(Date.now() + totalCampaigns * intervalMs).toISOString();

    if (anySent) {
      await supabase
        .from("campaign_messages")
        .update({ last_sent_at: nowIso, next_send_at: nextSendAt })
        .eq("id", campaign.id);

      console.log(
        `[cron] "${campaign.internal_name}" next_send_at = ${nextSendAt} ` +
        `(${totalCampaigns} campaigns × ${intervalMinutes}min)`,
      );
    } else {
      // ★ เพิ่มใหม่: log ชัดเจนเมื่อไม่มีช่องไหนส่งสำเร็จเลย เพื่อเตือนว่า
      // next_send_at จะไม่ถูกอัปเดต และ campaign นี้จะถูกเลือกมาส่งซ้ำในรอบถัดไป
      console.error(
        `[cron] "${campaign.internal_name}" — ALL channels failed (0/${campaign.target_channels.length} sent). ` +
        `next_send_at NOT updated → this campaign will retry next run.`,
      );
    }

    // ─── 7. Queue status of all campaigns ────────────────────────────────────
    const updatedCampaigns = (campaigns as CampaignMessage[]).map((c) =>
      c.id === campaign.id ? { ...c, next_send_at: nextSendAt } : c
    );
    const queue = updatedCampaigns.map((c) => ({
      name: c.internal_name,
      next_in: c.next_send_at ? formatRemaining(c.next_send_at) : "now",
      next_send_at: c.next_send_at,
    }));

    console.log(`[cron] Done — sent=${totalSent} failed=${totalFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        selected_campaign: campaign.internal_name,
        interval_minutes: intervalMinutes,
        total_sent: totalSent,
        total_failed: totalFailed,
        channels: channelResults,
        queue,
        activity: {
          count_24h: activityStats.count_24h,
          count_7d: activityStats.count_7d,
          count_30d: activityStats.count_30d,
        },
        executed_at: nowIso,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] Unexpected error:", message);
    return new Response(JSON.stringify({ error: "Internal server error", details: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});