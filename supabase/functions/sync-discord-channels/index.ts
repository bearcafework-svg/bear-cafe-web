import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscordChannel {
  id: string;
  type: number;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  guild_id?: string;
}

interface TextChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  guild_id: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ─── CORS preflight ───────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── Only allow POST / GET ────────────────────────────────────────────────
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const defaultGuildId = Deno.env.get("DISCORD_GUILD_ID") || "1144251788493602848";

    if (!botToken) {
      console.error("[sync-discord-channels] Missing DISCORD_BOT_TOKEN");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing Discord credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target Guild ID from body, query param, or default
    let targetGuildId = defaultGuildId;
    let customBotToken: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.guild_id && typeof body.guild_id === "string" && body.guild_id.trim()) {
          targetGuildId = body.guild_id.trim();
        }
        if (body?.bot_token && typeof body.bot_token === "string" && body.bot_token.trim()) {
          customBotToken = body.bot_token.trim();
        }
      } catch {
        // No JSON body provided or parse error, keep targetGuildId
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      const qGuildId = url.searchParams.get("guild_id");
      if (qGuildId && qGuildId.trim()) {
        targetGuildId = qGuildId.trim();
      }
      const qToken = url.searchParams.get("bot_token");
      if (qToken && qToken.trim()) {
        customBotToken = qToken.trim();
      }
    }

    // Determine the active bot token:
    // For HealJai (1536199707922141254), prioritize DISCORD_HEALJAI_TOKEN
    const isHealJai = targetGuildId === "1536199707922141254";
    const activeToken = isHealJai
      ? (Deno.env.get("DISCORD_HEALJAI_TOKEN") || Deno.env.get("SECONDARY_BOT_TOKEN") || customBotToken || botToken)
      : (customBotToken || botToken);

    if (!activeToken) {
      console.error("[sync-discord-channels] Missing Discord bot token for guild", targetGuildId);
      return new Response(
        JSON.stringify({ error: "Missing Discord bot token for the requested guild" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Fetch all channels from Discord for targetGuildId ─────────────────
    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${targetGuildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${activeToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error("[sync-discord-channels] Discord API error", {
        guildId: targetGuildId,
        status: discordRes.status,
        body: errorText.slice(0, 300),
      });
      return new Response(
        JSON.stringify({
          error: "Failed to fetch channels from Discord",
          status: discordRes.status,
          guild_id: targetGuildId,
          details: errorText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allChannels: DiscordChannel[] = await discordRes.json();

    // ─── Filter: GUILD_TEXT (0), GUILD_ANNOUNCEMENT (5), GUILD_FORUM (15) ─
    const textChannels: TextChannel[] = allChannels
      .filter((ch) => ch.type === 0 || ch.type === 5 || ch.type === 15)
      .sort((a, b) => a.position - b.position)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        parent_id: ch.parent_id,
        position: ch.position,
        topic: ch.topic ?? null,
        nsfw: ch.nsfw ?? false,
        guild_id: targetGuildId,
      }));

    console.log(`[sync-discord-channels] Guild ${targetGuildId}: Fetched ${allChannels.length} total channels, ${textChannels.length} text channels`);

    return new Response(
      JSON.stringify({
        channels: textChannels,
        total: textChannels.length,
        guild_id: targetGuildId,
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-discord-channels] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
