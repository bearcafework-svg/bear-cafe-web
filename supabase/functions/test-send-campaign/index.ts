/**
 * test-send-campaign
 * Sends a single campaign to a single channel immediately (no activity check).
 * Used by the admin UI "ทดลองส่ง" button.
 *
 * POST body:
 *   { campaign_id: string, channel_id: string }
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
}

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
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!botToken || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Parse body ───────────────────────────────────────────────────────────
    let body: { campaign_id?: string; channel_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { campaign_id, channel_id } = body;
    if (!campaign_id || !channel_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id and channel_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Fetch campaign from DB ───────────────────────────────────────────────
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: campaign, error: fetchError } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();

    if (fetchError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Build and send payload ───────────────────────────────────────────────
    const payload = buildCampaignPayload(campaign as CampaignMessage);

    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${channel_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error(`[test-send] Discord API error ${discordRes.status}:`, errorText.slice(0, 300));
      return new Response(
        JSON.stringify({
          error: "Discord API error",
          status: discordRes.status,
          details: errorText.slice(0, 300),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const discordData = await discordRes.json();
    console.log(`[test-send] Sent campaign "${campaign.internal_name}" to channel ${channel_id}, messageId=${discordData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: discordData.id,
        campaign_name: campaign.internal_name,
        channel_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[test-send] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
