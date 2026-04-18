import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')!;
    const guildId = Deno.env.get('DISCORD_GUILD_ID')!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { role_id, channel_url } = body;

    const result: Record<string, unknown> = {};

    // ─── Fetch role members (up to 10, we'll return first 5+count) ───────────
    if (role_id) {
      // Discord doesn't have a direct "get members by role" endpoint without pagination
      // Use guild members search with limit and filter by role
      let after = '0';
      const members: Array<{ id: string; username: string; avatar: string | null }> = [];
      let totalWithRole = 0;

      // Paginate up to 1000 members to count role holders (max 10 pages of 100)
      for (let page = 0; page < 10; page++) {
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members?limit=100&after=${after}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (!res.ok) break;
        const batch: any[] = await res.json();
        if (batch.length === 0) break;

        for (const m of batch) {
          if ((m.roles as string[]).includes(role_id)) {
            totalWithRole++;
            if (members.length < 5) {
              members.push({
                id: m.user.id,
                username: m.nick || m.user.global_name || m.user.username,
                avatar: m.user.avatar
                  ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
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

    // ─── Resolve channel name from URL ────────────────────────────────────────
    if (channel_url) {
      // Extract channel ID from URL like https://discord.com/channels/GUILD/CHANNEL
      const match = channel_url.match(/channels\/\d+\/(\d+)/);
      if (match) {
        const channelId = match[1];
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (res.ok) {
          const ch = await res.json();
          result.channel_name = ch.name ?? null;
          result.channel_id = channelId;
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-role-members error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: corsHeaders,
    });
  }
});
