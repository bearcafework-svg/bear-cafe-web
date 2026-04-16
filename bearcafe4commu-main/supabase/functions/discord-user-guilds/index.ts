import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Discord permission flags
const ADMINISTRATOR = 0x8;
const MANAGE_GUILD = 0x20;

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  approximate_member_count?: number;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's Discord access token from the stored metadata
    const discordAccessToken = user.user_metadata?.discord_access_token;
    if (!discordAccessToken) {
      return new Response(JSON.stringify({ 
        error: 'no_guilds_scope',
        message: 'กรุณาเข้าสู่ระบบใหม่เพื่อให้สิทธิ์เข้าถึงรายชื่อเซิร์ฟเวอร์' 
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch user's guilds from Discord
    const guildsRes = await discordFetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });

    if (!guildsRes.ok) {
      const errText = await guildsRes.text();
      console.error('Failed to fetch guilds:', guildsRes.status, errText);
      
      if (guildsRes.status === 401) {
        return new Response(JSON.stringify({ 
          error: 'token_expired',
          message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' 
        }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'ไม่สามารถดึงรายชื่อเซิร์ฟเวอร์ได้' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const guilds: DiscordGuild[] = await guildsRes.json();

    // Filter: only guilds where user is Owner or has ADMINISTRATOR/MANAGE_GUILD permission
    const ownedGuilds = guilds
      .filter(g => {
        if (g.owner) return true;
        const perms = BigInt(g.permissions);
        return (perms & BigInt(ADMINISTRATOR)) !== 0n || (perms & BigInt(MANAGE_GUILD)) !== 0n;
      })
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon 
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=128`
          : null,
        owner: g.owner,
        member_count: g.approximate_member_count || 0,
      }));

    // Check which guilds are already registered
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const guildIds = ownedGuilds.map(g => g.id);
    
    let registeredIds: string[] = [];
    if (guildIds.length > 0) {
      const { data: existing } = await adminClient
        .from('discord_servers')
        .select('discord_id')
        .in('discord_id', guildIds);
      registeredIds = (existing || []).map((e: any) => e.discord_id);
    }

    const result = ownedGuilds.map(g => ({
      ...g,
      already_registered: registeredIds.includes(g.id),
    }));

    return new Response(JSON.stringify({ guilds: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in discord-user-guilds:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
