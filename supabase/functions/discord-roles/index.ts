import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRoleBanGuard } from "../_shared/role-ban.ts";
import { getGuildRoles } from "../_shared/guild-roles-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
}

Deno.serve(async (req): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guardResult = await requireRoleBanGuard(req, corsHeaders);
    if ("response" in guardResult) {
      return guardResult.response as Response;
    }

    // Verify the user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and check if user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's discord_id from metadata
    const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) {
      return new Response(
        JSON.stringify({ error: 'No Discord ID found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has page access (supports owner, admin, and custom permissions)
    const { data: hasAccess } = await supabase.rpc('has_page_access', {
      _user_id: profile.id,
      _page: 'roles',
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch roles from Discord API
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let roles: DiscordRole[];
    try {
      roles = await getGuildRoles(guildId, botToken) as DiscordRole[];
    } catch (err) {
      console.error('Discord API error:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Discord roles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out @everyone role and bot-managed roles, sort by position
    const filteredRoles = roles
      .filter(role => role.name !== '@everyone' && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map(role => {
        // Build icon URL if role has a custom icon
        let iconUrl: string | null = null;
        if (role.icon) {
          // Discord CDN URL for role icons
          iconUrl = `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png`;
        }

        return {
          id: role.id,
          name: role.name,
          color: role.color === 0 ? null : `#${role.color.toString(16).padStart(6, '0')}`,
          icon: iconUrl,
          unicode_emoji: role.unicode_emoji || null,
        };
      });

    console.log(`Fetched ${filteredRoles.length} roles from Discord`);

    return new Response(
      JSON.stringify({ roles: filteredRoles }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Discord roles:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
