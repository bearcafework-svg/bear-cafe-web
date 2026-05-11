/**
 * sync-discord-channels
 * Fetches all GUILD_TEXT channels (type === 0) from the configured Discord guild.
 * Excludes voice channels, categories, threads, and any other channel types.
 *
 * Required env vars (set in Supabase dashboard):
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 */

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
}

interface TextChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
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
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      console.error("[sync-discord-channels] Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing Discord credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Fetch all channels from Discord ─────────────────────────────────────
    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error("[sync-discord-channels] Discord API error", {
        status: discordRes.status,
        body: errorText.slice(0, 300),
      });
      return new Response(
        JSON.stringify({
          error: "Failed to fetch channels from Discord",
          status: discordRes.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allChannels: DiscordChannel[] = await discordRes.json();

    // ─── Filter: GUILD_TEXT only (type === 0) ─────────────────────────────────
    // Discord channel types:
    //   0  = GUILD_TEXT
    //   2  = GUILD_VOICE
    //   4  = GUILD_CATEGORY
    //   5  = GUILD_ANNOUNCEMENT
    //   10 = ANNOUNCEMENT_THREAD
    //   11 = PUBLIC_THREAD
    //   12 = PRIVATE_THREAD
    //   13 = GUILD_STAGE_VOICE
    //   15 = GUILD_FORUM
    const textChannels: TextChannel[] = allChannels
      .filter((ch) => ch.type === 0)
      .sort((a, b) => a.position - b.position)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        parent_id: ch.parent_id,
        position: ch.position,
        topic: ch.topic ?? null,
        nsfw: ch.nsfw ?? false,
      }));

    console.log(`[sync-discord-channels] Fetched ${allChannels.length} total channels, ${textChannels.length} text channels`);

    return new Response(
      JSON.stringify({
        channels: textChannels,
        total: textChannels.length,
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-discord-channels] Unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
