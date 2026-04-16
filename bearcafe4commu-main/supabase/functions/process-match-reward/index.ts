import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";
import { getGuildRoles } from "../_shared/guild-roles-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MILESTONES = [25, 50, 100, 500, 1000];

const MILESTONE_ROLES: Record<number, { add: string; remove?: string }> = {
  25:   { add: "1481231547385253920" },
  50:   { add: "1481231551847993467", remove: "1481231547385253920" },
  100:  { add: "1481231560152846399", remove: "1481231551847993467" },
  500:  { add: "1481231564447682610", remove: "1481231560152846399" },
  1000: { add: "1481232289366147146", remove: "1481231564447682610" },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { discord_id } = await req.json();
    if (!discord_id) throw new Error('Missing discord_id');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get current stats
    let { data: stats, error: fetchError } = await supabase
      .from('user_gacha_stats')
      .select('*')
      .eq('discord_id', discord_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (!stats) {
      const { data: newStats, error: createError } = await supabase
        .from('user_gacha_stats')
        .insert({ discord_id, match_count: 0 })
        .select()
        .single();
      if (createError) throw createError;
      stats = newStats;
    }

    // 2. Increment
    const newMatchCount = (stats.match_count || 0) + 1;

    // 3. Milestone check & Role Grant
    let roleGranted = null;
    let roleRemoved = null;
    let milestoneRoleInfo: { name: string; icon: string | null; color: string | null } | null = null;

    if (MILESTONES.includes(newMatchCount)) {
      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
      const guildId = Deno.env.get('DISCORD_GUILD_ID');
      const milestone = MILESTONE_ROLES[newMatchCount];

      if (botToken && guildId && milestone) {
        // Remove previous role
        if (milestone.remove) {
          const resRemove = await discordFetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${discord_id}/roles/${milestone.remove}`,
            { method: 'DELETE', headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' } }
          );
          if (resRemove.ok) {
            roleRemoved = milestone.remove;
          } else {
            console.error(`Failed to remove role ${milestone.remove}: ${resRemove.status}`);
          }
        }

        // Add new role
        const resAdd = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${discord_id}/roles/${milestone.add}`,
          { method: 'PUT', headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' } }
        );
        if (resAdd.ok) {
          roleGranted = milestone.add;
          console.log(`Granted milestone role ${milestone.add} to ${discord_id} for ${newMatchCount} matches`);
        } else {
          console.error(`Failed to grant role ${milestone.add}: ${resAdd.status}`);
        }

        // Fetch role info for the popup
        try {
          const guildRoles = await getGuildRoles(guildId, botToken);
          const grantedRole = guildRoles.find(r => r.id === milestone.add);
          if (grantedRole) {
            const colorHex = grantedRole.color ? `#${grantedRole.color.toString(16).padStart(6, '0')}` : null;
            milestoneRoleInfo = {
              name: grantedRole.name,
              icon: grantedRole.unicode_emoji || grantedRole.icon || null,
              color: colorHex === '#000000' ? null : colorHex,
            };
          }
        } catch (e) {
          console.error('Failed to fetch role info:', e);
        }
      }
    }

    // 4. Update DB
    const { data: updatedStats, error: updateError } = await supabase
      .from('user_gacha_stats')
      .update({ match_count: newMatchCount, updated_at: new Date().toISOString() })
      .eq('discord_id', discord_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedStats,
        milestone_reached: MILESTONES.includes(newMatchCount),
        milestone_count: MILESTONES.includes(newMatchCount) ? newMatchCount : null,
        role_granted: roleGranted,
        role_removed: roleRemoved,
        role_info: milestoneRoleInfo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
