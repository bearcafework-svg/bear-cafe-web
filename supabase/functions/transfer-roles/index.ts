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

    // Check admin
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

    // Check page access (supports owner, admin, and custom permissions)
    const { data: hasAccess } = await supabase.rpc('has_page_access', {
      _user_id: profile.id,
      _page: 'role-transfer',
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { sourceDiscordId, targetDiscordId, action } = body;

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');
    if (!botToken || !guildId) {
      return new Response(JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: preview - get roles of source user and show what will be transferred
    if (action === 'preview') {
      if (!sourceDiscordId) {
        return new Response(JSON.stringify({ error: 'Missing sourceDiscordId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get source member's roles
      const memberRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${sourceDiscordId}`,
        { headers: { 'Authorization': `Bot ${botToken}` } }
      );

      if (!memberRes.ok) {
        const errText = await memberRes.text();
        console.error('Discord member fetch error:', memberRes.status, errText);
        return new Response(JSON.stringify({ error: 'ไม่พบผู้ใช้ในเซิร์ฟเวอร์ Discord' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const member = await memberRes.json();
      const memberRoles: string[] = member.roles || [];

      // Get guild roles for names (cached)
      const guildRoles = await getGuildRoles(guildId, botToken).catch(() => []);

      // Get non-transferable roles
      const { data: nonTransferable } = await supabase
        .from('non_transferable_roles')
        .select('discord_role_id');
      const blockedIds = new Set((nonTransferable || []).map((r: any) => r.discord_role_id));

      // Map roles
      const rolesDetail = memberRoles.map((roleId: string) => {
        const guildRole = guildRoles.find((gr: any) => gr.id === roleId);
        return {
          id: roleId,
          name: guildRole?.name || roleId,
          color: guildRole?.color === 0 ? null : `#${(guildRole?.color || 0).toString(16).padStart(6, '0')}`,
          managed: guildRole?.managed || false,
          blocked: blockedIds.has(roleId) || guildRole?.managed || false,
          blockReason: blockedIds.has(roleId) ? 'non_transferable' : guildRole?.managed ? 'bot_managed' : null,
        };
      }).filter((r: any) => r.name !== '@everyone');

      return new Response(JSON.stringify({
        member: {
          id: member.user?.id,
          username: member.user?.username || member.user?.global_name,
          avatar: member.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
            : null,
        },
        roles: rolesDetail,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Action: transfer - bulk transfer roles
    if (action === 'transfer') {
      if (!sourceDiscordId || !targetDiscordId) {
        return new Response(JSON.stringify({ error: 'Missing sourceDiscordId or targetDiscordId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const rolesToTransfer: string[] = body.rolesToTransfer || [];
      if (rolesToTransfer.length === 0) {
        return new Response(JSON.stringify({ error: 'No roles to transfer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get non-transferable roles to double-check
      const { data: nonTransferable } = await supabase
        .from('non_transferable_roles')
        .select('discord_role_id');
      const blockedIds = new Set((nonTransferable || []).map((r: any) => r.discord_role_id));

      // Filter out blocked roles
      const safeRoles = rolesToTransfer.filter(id => !blockedIds.has(id));
      const skippedRoles = rolesToTransfer.filter(id => blockedIds.has(id));

      if (safeRoles.length === 0) {
        return new Response(JSON.stringify({ error: 'All selected roles are non-transferable' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get current roles of target user
      const targetMemberRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${targetDiscordId}`,
        { headers: { 'Authorization': `Bot ${botToken}` } }
      );

      if (!targetMemberRes.ok) {
        const errText = await targetMemberRes.text();
        console.error('Target member fetch error:', targetMemberRes.status, errText);
        return new Response(JSON.stringify({ error: 'ไม่พบผู้ใช้ปลายทางในเซิร์ฟเวอร์ Discord' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const targetMember = await targetMemberRes.json();
      const targetCurrentRoles: string[] = targetMember.roles || [];

      // Merge: add transferred roles to target's existing roles
      const newTargetRoles = [...new Set([...targetCurrentRoles, ...safeRoles])];

      // Get source member current roles
      const sourceMemberRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${sourceDiscordId}`,
        { headers: { 'Authorization': `Bot ${botToken}` } }
      );

      if (!sourceMemberRes.ok) {
        return new Response(JSON.stringify({ error: 'ไม่พบผู้ใช้ต้นทางในเซิร์ฟเวอร์ Discord' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sourceMember = await sourceMemberRes.json();
      const sourceCurrentRoles: string[] = sourceMember.roles || [];

      // Remove transferred roles AND non-transferable roles from source
      // Non-transferable roles are deleted from source but not added to target
      const rolesToRemoveFromSource = [...safeRoles, ...skippedRoles];
      const newSourceRoles = sourceCurrentRoles.filter(id => !rolesToRemoveFromSource.includes(id));

      // BULK update: PATCH target (add roles)
      const patchTarget = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${targetDiscordId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roles: newTargetRoles }),
        }
      );

      if (!patchTarget.ok) {
        const errText = await patchTarget.text();
        console.error('PATCH target error:', patchTarget.status, errText);
        return new Response(JSON.stringify({ error: 'ไม่สามารถเพิ่มยศให้ผู้ใช้ปลายทางได้', details: errText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // BULK update: PATCH source (remove roles)
      const patchSource = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${sourceDiscordId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roles: newSourceRoles }),
        }
      );

      if (!patchSource.ok) {
        const errText = await patchSource.text();
        console.error('PATCH source error:', patchSource.status, errText);
        // Target already updated, log partial success
      }

      // Log the transfer
      await supabase.from('role_transfer_logs').insert({
        source_discord_id: sourceDiscordId,
        source_username: sourceMember.user?.username || null,
        target_discord_id: targetDiscordId,
        target_username: targetMember.user?.username || null,
        roles_transferred: safeRoles,
        roles_skipped: skippedRoles,
        status: patchSource.ok ? 'completed' : 'partial',
        transferred_by: profile.id,
        completed_at: new Date().toISOString(),
      });

      console.log(`Transferred ${safeRoles.length} roles from ${sourceDiscordId} to ${targetDiscordId}, removed ${skippedRoles.length} non-transferable roles from source`);

      const parts: string[] = [`ย้ายยศสำเร็จ ${safeRoles.length} ยศ`];
      if (skippedRoles.length > 0) {
        parts.push(`ลบยศห้ามย้าย ${skippedRoles.length} ยศออกจากต้นทาง`);
      }

      return new Response(JSON.stringify({
        success: true,
        transferred: safeRoles.length,
        skipped: skippedRoles.length,
        message: parts.join(', '),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in transfer-roles:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
