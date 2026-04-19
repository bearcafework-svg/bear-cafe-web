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
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const guildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ✅ OPTIONAL AUTH (ไม่บังคับแล้ว)
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { error } = await adminClient.auth.getUser(token);
      if (error) {
        console.warn("Invalid token but allowed:", error.message);
      }
    }

    const body = await req.json();
    const roleId: string = body.role_id ?? "";
    const channelUrl: string = body.channel_url ?? "";

    const result: Record<string, unknown> = {};

    // ─── FIX LOOP + RATE LIMIT ───
    if (roleId) {
      let after = "0";
      let totalWithRole = 0;
      const members: any[] = [];
      let page = 0;

      while (true) {
        page++;
        if (page > 100) break; // กัน infinite

        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members?limit=100&after=${after}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );

        if (res.status === 429) {
          const retry = Number((await res.json()).retry_after ?? 1);
          await new Promise(r => setTimeout(r, retry * 1000));
          continue;
        }

        if (!res.ok) break;

        const batch = await res.json();
        if (!batch.length) break;

        for (const m of batch) {
          if ((m.roles ?? []).includes(roleId)) {
            totalWithRole++;

            if (members.length < 5) {
              const avatar = m.user.avatar;
              members.push({
                id: m.user.id,
                username: m.nick || m.user.global_name || m.user.username,
                avatar: avatar
                  ? `https://cdn.discordapp.com/avatars/${m.user.id}/${avatar}.png?size=64`
                  : null,
              });
            }
          }
        }

        after = batch[batch.length - 1].user.id;

        if (batch.length < 100) break;
      }

      result.members = members;
      result.total = totalWithRole;
    }

    // ─── CHANNEL ───
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
          result.channel_name = ch.name;
          result.channel_id = channelId;
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});