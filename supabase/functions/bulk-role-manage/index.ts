import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";
import { getGuildRoles } from "../_shared/guild-roles-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check admin access
    const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) {
      return new Response(JSON.stringify({ error: 'No Discord ID found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: profile } = await supabase.from('profiles').select('id').eq('discord_id', discordId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: hasAccess } = await supabase.rpc('has_page_access', {
      _user_id: profile.id,
      _page: 'bulk-role-manage',
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');
    if (!botToken || !guildId) {
      return new Response(JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action } = body;

    // Action: search - find members with a specific role
    if (action === 'search') {
      const { searchRoleId } = body;
      if (!searchRoleId) {
        return new Response(JSON.stringify({ error: 'Missing searchRoleId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch all guild members (paginated, max 1000 per request)
      const allMembers: any[] = [];
      let after = '0';
      let hasMore = true;

      while (hasMore) {
        const res = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
          { headers: { 'Authorization': `Bot ${botToken}` } }
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error('Member list error:', res.status, errText);
          return new Response(JSON.stringify({ error: 'ไม่สามารถดึงรายชื่อสมาชิกได้' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const members = await res.json();
        if (members.length === 0) {
          hasMore = false;
        } else {
          allMembers.push(...members);
          after = members[members.length - 1].user.id;
          if (members.length < 1000) hasMore = false;
        }
      }

      // Filter members who have the search role
      const matchedMembers = allMembers
        .filter((m: any) => m.roles?.includes(searchRoleId))
        .map((m: any) => ({
          id: m.user?.id,
          username: m.user?.username || m.user?.global_name || 'Unknown',
          avatar: m.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
            : null,
          roles: m.roles || [],
        }));

      // Get guild roles for display
      const guildRoles = await getGuildRoles(guildId, botToken).catch(() => []);

      return new Response(JSON.stringify({
        members: matchedMembers,
        totalGuildMembers: allMembers.length,
        guildRoles: guildRoles.map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color === 0 ? null : `#${r.color.toString(16).padStart(6, '0')}`,
          managed: r.managed || false,
        })).filter((r: any) => r.name !== '@everyone'),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: execute - bulk add or remove a role from selected members
    if (action === 'execute') {
      const { targetRoleId, memberIds, mode } = body; // mode: 'add' | 'remove'
      if (!targetRoleId || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing targetRoleId or memberIds' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (mode !== 'add' && mode !== 'remove') {
        return new Response(JSON.stringify({ error: 'Invalid mode, must be "add" or "remove"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const memberId of memberIds) {
        try {
          // Get current roles
          const memberRes = await discordFetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}`,
            { headers: { 'Authorization': `Bot ${botToken}` } }
          );

          if (!memberRes.ok) {
            failCount++;
            errors.push(`${memberId}: ไม่พบสมาชิก`);
            continue;
          }

          const member = await memberRes.json();
          const currentRoles: string[] = member.roles || [];

          let newRoles: string[];
          if (mode === 'add') {
            newRoles = [...new Set([...currentRoles, targetRoleId])];
          } else {
            newRoles = currentRoles.filter((r: string) => r !== targetRoleId);
          }

          // Skip if no change needed
          if (newRoles.length === currentRoles.length && mode === 'add' && currentRoles.includes(targetRoleId)) {
            successCount++;
            continue;
          }
          if (newRoles.length === currentRoles.length && mode === 'remove' && !currentRoles.includes(targetRoleId)) {
            successCount++;
            continue;
          }

          // PATCH member roles
          const patchRes = await discordFetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ roles: newRoles }),
            }
          );

          if (patchRes.ok) {
            successCount++;
          } else {
            const errText = await patchRes.text();
            failCount++;
            errors.push(`${member.user?.username || memberId}: ${errText}`);
          }
        } catch (e) {
          failCount++;
          errors.push(`${memberId}: ${(e as Error).message}`);
        }
      }

      console.log(`Bulk role ${mode}: ${successCount} success, ${failCount} fail for role ${targetRoleId}`);

      return new Response(JSON.stringify({
        success: true,
        mode,
        successCount,
        failCount,
        errors: errors.slice(0, 10), // limit error details
        message: `${mode === 'add' ? 'เพิ่ม' : 'ถอด'}ยศสำเร็จ ${successCount} คน${failCount > 0 ? ` (ล้มเหลว ${failCount} คน)` : ''}`,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in bulk-role-manage:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
