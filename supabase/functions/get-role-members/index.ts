import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const guildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

    // botToken หรือ guildId ไม่มี → return error ทันที ไม่ต้อง loop
    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const roleId: string = body.role_id ?? "";
    const channelUrl: string = body.channel_url ?? "";

    const result: Record<string, unknown> = {};

    // ─── Fetch role members ───────────────────────────────────────────────
    if (roleId) {
      let after = "0";
      let totalWithRole = 0;
      const members: Array<{ id: string; username: string; avatar: string | null }> = [];
      let page = 0;
      const MAX_PAGES = 50; // safety: max 5000 members

      while (page < MAX_PAGES) {
        page++;

        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members?limit=100&after=${after}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );

        // Rate limited — wait and retry (don't increment page)
        if (res.status === 429) {
          let retryAfter = 1;
          try {
            const body = await res.json();
            retryAfter = Number(body.retry_after ?? 1);
          } catch { /* ignore */ }
          await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 5000)));
          page--; // don't count this as a page
          continue;
        }

        if (!res.ok) {
          console.error("Discord members API error:", res.status, await res.text());
          break;
        }

        const batch: any[] = await res.json();
        if (!Array.isArray(batch) || batch.length === 0) break;

        for (const m of batch) {
          const roles: string[] = m.roles ?? [];
          if (roles.includes(roleId)) {
            totalWithRole++;
            if (members.length < 5) {
              const avatarHash = m.user?.avatar;
              members.push({
                id: m.user.id,
                username: m.nick || m.user?.global_name || m.user?.username || "Unknown",
                avatar: avatarHash
                  ? `https://cdn.discordapp.com/avatars/${m.user.id}/${avatarHash}.png?size=64`
                  : null,
              });
            }
          }
        }

        after = batch[batch.length - 1].user.id;
        if (batch.length < 100) break; // last page
      }

      result.members = members;
      result.total = totalWithRole;
    }

    // ─── Resolve channel name ─────────────────────────────────────────────
    if (channelUrl) {
      const match = channelUrl.match(/channels\/\d+\/(\d+)/);
      if (match) {
        const channelId = match[1];
        const res = await fetch(
          `https://discord.com/api/v10/channels/${channelId}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (res.ok) {
          const ch = await res.json();
          result.channel_name = ch.name ?? null;
          result.channel_id = channelId;
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("get-role-members error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
