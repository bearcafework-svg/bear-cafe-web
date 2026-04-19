import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
  const guildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

  // Use adminClient.auth.getUser(token) — supports ES256 JWT natively
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const roleId: string = body.role_id ?? "";
  const channelUrl: string = body.channel_url ?? "";

  const result: Record<string, unknown> = {};

  // ─── Fetch role members ───────────────────────────────────────────────────
  if (roleId) {
    let after = "0";
    const members: Array<{ id: string; username: string; avatar: string | null }> = [];
    let totalWithRole = 0;
    let page = 0;

    while (true) {
      page++;
      if (page > 50) break; // safety limit

      const membersRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=100&after=${after}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      // Handle rate limit
      if (membersRes.status === 429) {
        const retryAfter = Number((await membersRes.json()).retry_after ?? 1);
        await new Promise(res => setTimeout(res, retryAfter * 1000));
        continue;
      }

      if (!membersRes.ok) break;
      const batch: any[] = await membersRes.json();
      if (batch.length === 0) break;

      for (const m of batch) {
        const roles: string[] = m.roles ?? [];
        if (roles.includes(roleId)) {
          totalWithRole++;
          if (members.length < 5) {
            const avatarHash = m.user.avatar;
            members.push({
              id: m.user.id,
              username: m.nick || m.user.global_name || m.user.username,
              avatar: avatarHash
                ? `https://cdn.discordapp.com/avatars/${m.user.id}/${avatarHash}.png?size=64`
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

  // ─── Resolve channel name ─────────────────────────────────────────────────
  if (channelUrl) {
    const match = channelUrl.match(/channels\/\d+\/(\d+)/);
    if (match) {
      const channelId = match[1];
      const channelRes = await fetch(
        `https://discord.com/api/v10/channels/${channelId}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );
      if (channelRes.ok) {
        const ch = await channelRes.json();
        result.channel_name = ch.name ?? null;
        result.channel_id = channelId;
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
