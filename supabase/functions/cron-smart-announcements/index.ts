/**
 * cron-smart-announcements
 * Scheduled function (pg_cron) that sends active campaign messages to target channels.
 * 
 * Features:
 * - Maps DB rows to Discord Component-Based UI (type 17 container)
 * - Checks recent channel activity (skips inactive channels)
 * - 1000ms delay between requests to avoid rate limits
 * - Updates last_sent_at timestamp after successful send
 * 
 * Required env vars:
 *   DISCORD_BOT_TOKEN
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * 
 * Setup pg_cron (run in Supabase SQL editor):
 * 
 * SELECT cron.schedule(
 *   'smart-announcements-daily',
 *   '0 10 * * *',  -- Every day at 10:00 AM UTC
 *   $$
 *   SELECT net.http_post(
 *     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-smart-announcements',
 *     headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
 *   );
 *   $$
 * );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

/**
 * Build Discord Component-Based Payload (type 17 container)
 */
function buildCampaignPayload(campaign: CampaignMessage): Record<string, unknown> {
  const components: unknown[] = [];

  // ─── Image carousel (type 12) ─────────────────────────────────────────────
  if (campaign.image_url) {
    components.push({
      type: 12,
      items: [
        {
          media: {
            url: campaign.image_url,
          },
        },
      ],
    });
  }

  // ─── Spacer (type 14) ─────────────────────────────────────────────────────
  if (campaign.image_url) {
    components.push({
      type: 14,
      spacing: 2,
    });
  }

  // ─── Text content (type 10) ───────────────────────────────────────────────
  components.push({
    type: 10,
    content: campaign.content_text,
  });

  // ─── Divider spacer (type 14) ─────────────────────────────────────────────
  components.push({
    type: 14,
    spacing: 2,
    divider: true,
  });

  // ─── Button (type 1 wrapper + type 2 button) ──────────────────────────────
  if (campaign.has_button && campaign.button_label && campaign.button_url) {
    const button: Record<string, unknown> = {
      type: 2,
      style: 5, // Link button
      label: campaign.button_label,
      url: campaign.button_url,
    };

    // Add emoji if provided
    if (campaign.button_emoji_id || campaign.button_emoji_name) {
      button.emoji = {
        id: campaign.button_emoji_id ?? undefined,
        name: campaign.button_emoji_name ?? undefined,
        animated: false,
      };
    }

    components.push({
      type: 1,
      components: [button],
    });
  }

  return {
    flags: 32768, // Ephemeral flag (optional, remove if you want persistent messages)
    components: [
      {
        type: 17, // Container
        components,
      },
    ],
  };
}

/**
 * Check if a channel has recent activity (messages in last 7 days)
 */
async function hasRecentActivity(
  channelId: string,
  botToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=1`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );

    if (!res.ok) {
      console.warn(`[activity-check] Failed to fetch messages for channel ${channelId}: ${res.status}`);
      return false; // Skip inactive/inaccessible channels
    }

    const messages: DiscordMessage[] = await res.json();
    if (messages.length === 0) return false;

    const lastMessageTime = new Date(messages[0].timestamp).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return lastMessageTime > sevenDaysAgo;
  } catch (err) {
    console.error(`[activity-check] Error checking channel ${channelId}:`, err);
    return false;
  }
}

/**
 * Send campaign message to a Discord channel
 */
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
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[send] Failed to send to channel ${channelId}: ${res.status}`, errorText.slice(0, 200));
      return { success: false, error: `Discord API error: ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[send] Network error for channel ${channelId}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Delay helper (1000ms between requests)
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
      console.error("[cron-smart-announcements] Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Fetch active campaigns ───────────────────────────────────────────────
    const { data: campaigns, error: fetchError } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      console.error("[cron-smart-announcements] Failed to fetch campaigns:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaigns", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("[cron-smart-announcements] No active campaigns found");
      return new Response(
        JSON.stringify({ message: "No active campaigns to send", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[cron-smart-announcements] Processing ${campaigns.length} active campaigns`);

    const results: Record<string, unknown>[] = [];
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // ─── Process each campaign ────────────────────────────────────────────────
    for (const campaign of campaigns as CampaignMessage[]) {
      const payload = buildCampaignPayload(campaign);
      const channelResults: Record<string, unknown>[] = [];

      console.log(`[campaign:${campaign.internal_name}] Targeting ${campaign.target_channels.length} channels`);

      // ─── Send to each target channel ──────────────────────────────────────────
      for (const channelId of campaign.target_channels) {
        // Check recent activity
        const isActive = await hasRecentActivity(channelId, botToken);
        if (!isActive) {
          console.log(`[campaign:${campaign.internal_name}] Skipping inactive channel ${channelId}`);
          channelResults.push({ channel_id: channelId, status: "skipped", reason: "no_recent_activity" });
          totalSkipped++;
          continue;
        }

        // Send message
        const sendResult = await sendToChannel(channelId, payload, botToken);
        if (sendResult.success) {
          console.log(`[campaign:${campaign.internal_name}] Sent to channel ${channelId}, messageId=${sendResult.messageId}`);
          channelResults.push({ channel_id: channelId, status: "sent", message_id: sendResult.messageId });
          totalSent++;
        } else {
          console.error(`[campaign:${campaign.internal_name}] Failed to send to channel ${channelId}: ${sendResult.error}`);
          channelResults.push({ channel_id: channelId, status: "failed", error: sendResult.error });
          totalFailed++;
        }

        // Delay 1000ms between requests
        await delay(1000);
      }

      // ─── Update last_sent_at ──────────────────────────────────────────────────
      const { error: updateError } = await supabase
        .from("campaign_messages")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", campaign.id);

      if (updateError) {
        console.error(`[campaign:${campaign.internal_name}] Failed to update last_sent_at:`, updateError);
      }

      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.internal_name,
        channels: channelResults,
      });
    }

    console.log(`[cron-smart-announcements] Completed: ${totalSent} sent, ${totalSkipped} skipped, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_processed: campaigns.length,
        total_sent: totalSent,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        results,
        executed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron-smart-announcements] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
