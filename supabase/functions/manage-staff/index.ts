import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Using service role client to enable rollback deletes and audits
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify operator profile & permission
    const operatorDiscordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    const { data: operatorProfile } = await adminClient
      .from('profiles')
      .select('id, username')
      .eq('discord_id', operatorDiscordId)
      .single();

    if (!operatorProfile) {
      return new Response(
        JSON.stringify({ error: 'Operator profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasAccess } = await adminClient.rpc('has_any_page_access', {
      _user_id: operatorProfile.id,
      _pages: ['manage-staff'],
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')!;
    const guildId = Deno.env.get('DISCORD_GUILD_ID')!;

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // Action: ADD STAFF
    // ============================================================
    if (action === 'add') {
      const {
        discord_id, nickname, position_id, level_id,
        joined_at, intern_start_at, intern_end_at, notes
      } = body;

      if (!discord_id || !position_id || !level_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: discord_id, position_id, level_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Fetch Discord roles from position and level tables
      const { data: position } = await adminClient.from('staff_positions').select('*').eq('id', position_id).single();
      const { data: level } = await adminClient.from('staff_levels').select('*').eq('id', level_id).single();

      if (!position || !level) {
        return new Response(
          JSON.stringify({ error: 'Invalid position_id or level_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Insert member to database
      const { data: newMember, error: insertError } = await adminClient
        .from('staff_members')
        .insert({
          discord_id,
          nickname,
          position_id,
          level_id,
          joined_at: joined_at || new Date().toISOString(),
          intern_start_at,
          intern_end_at,
          notes,
          status: 'Active'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Add staff db error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to insert member to database', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Track created entities for manual rollback
      const createdTimelineIds: string[] = [];

      try {
        // 3. Add Discord roles
        // Position Role
        if (position.discord_role_id) {
          await addDiscordRole(botToken, guildId, discord_id, position.discord_role_id);
        }

        // Level Role
        if (level.discord_role_id) {
          await addDiscordRole(botToken, guildId, discord_id, level.discord_role_id);
        }

        // 4. Create timeline logs
        const { data: timelineJoin } = await adminClient.from('staff_timeline').insert({
          staff_member_id: newMember.id,
          event_type: 'join',
          details: `เข้าทีมงาน: ตำแหน่ง ${position.name}, ระดับ ${level.name}`,
          created_by: operatorProfile.id
        }).select('id').single();
        if (timelineJoin) createdTimelineIds.push(timelineJoin.id);

        // 5. Create audit logs
        await adminClient.from('staff_audit_logs').insert({
          staff_member_id: newMember.id,
          action: 'add_staff',
          operator_id: operatorProfile.id,
          operator_name: operatorProfile.username,
          before_data: null,
          after_data: newMember
        });

        return new Response(
          JSON.stringify({ success: true, member: newMember }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (discordError: any) {
        console.error('Discord assignment failed. Rolling back database changes...', discordError);

        // ROLLBACK: Delete newly inserted staff member and timeline records
        await adminClient.from('staff_members').delete().eq('id', newMember.id);
        if (createdTimelineIds.length > 0) {
          await adminClient.from('staff_timeline').delete().in('id', createdTimelineIds);
        }

        return new Response(
          JSON.stringify({ 
            error: 'discord_role_assignment_failed', 
            message: `ไม่สามารถปรับเปลี่ยนยศใน Discord ได้: ${discordError.message}. โรลแบ็กข้อมูลทั้งหมดแล้ว`
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================
    // Action: UPDATE STAFF
    // ============================================================
    if (action === 'update') {
      const {
        member_id, nickname, position_id, level_id,
        joined_at, intern_start_at, intern_end_at, notes, status, level_change_reason
      } = body;

      if (!member_id || !position_id || !level_id || !status) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields for update: member_id, position_id, level_id, status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Fetch current database record for rollback & diff
      const { data: beforeMember, error: fetchError } = await adminClient
        .from('staff_members')
        .select('*')
        .eq('id', member_id)
        .single();

      if (fetchError || !beforeMember) {
        return new Response(
          JSON.stringify({ error: 'Member not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch positions and levels
      const { data: newPosition } = await adminClient.from('staff_positions').select('*').eq('id', position_id).single();
      const { data: newLevel } = await adminClient.from('staff_levels').select('*').eq('id', level_id).single();
      const { data: oldPosition } = await adminClient.from('staff_positions').select('*').eq('id', beforeMember.position_id).single();
      const { data: oldLevel } = await adminClient.from('staff_levels').select('*').eq('id', beforeMember.level_id).single();

      if (!newPosition || !newLevel) {
        return new Response(
          JSON.stringify({ error: 'Invalid position_id or level_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Update member in database
      const { data: afterMember, error: updateError } = await adminClient
        .from('staff_members')
        .update({
          nickname,
          position_id,
          level_id,
          joined_at,
          intern_start_at,
          intern_end_at,
          notes,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', member_id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update member in DB', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timelineInserts: any[] = [];
      let levelHistoryId = null;

      try {
        const discord_id = beforeMember.discord_id;

        // 3. Diff & Update Discord Roles
        // Position changed
        if (beforeMember.position_id !== position_id) {
          if (oldPosition?.discord_role_id) {
            await removeDiscordRole(botToken, guildId, discord_id, oldPosition.discord_role_id).catch(() => {});
          }
          if (newPosition.discord_role_id) {
            await addDiscordRole(botToken, guildId, discord_id, newPosition.discord_role_id);
          }
          timelineInserts.push({
            staff_member_id: member_id,
            event_type: 'change_position',
            details: `เปลี่ยนตำแหน่งจาก ${oldPosition?.name || 'ไม่มี'} เป็น ${newPosition.name}`,
            created_by: operatorProfile.id
          });
        }

        // Level changed
        if (beforeMember.level_id !== level_id) {
          if (oldLevel?.discord_role_id) {
            await removeDiscordRole(botToken, guildId, discord_id, oldLevel.discord_role_id).catch(() => {});
          }
          if (newLevel.discord_role_id) {
            await addDiscordRole(botToken, guildId, discord_id, newLevel.discord_role_id);
          }

          const isUpgrade = oldLevel?.next_level_id === level_id || newLevel.prev_level_id === beforeMember.level_id;
          const isDowngrade = oldLevel?.prev_level_id === level_id || newLevel.next_level_id === beforeMember.level_id;
          const eventType = isUpgrade ? 'level_up' : (isDowngrade ? 'level_down' : 'change_level');
          const actionLabel = isUpgrade ? 'เลื่อนระดับ' : (isDowngrade ? 'ลดระดับ' : 'เปลี่ยนระดับ');

          timelineInserts.push({
            staff_member_id: member_id,
            event_type: eventType,
            details: `${actionLabel}จาก ${oldLevel?.name || 'ไม่มี'} เป็น ${newLevel.name}. เหตุผล: ${level_change_reason || '-'}`,
            created_by: operatorProfile.id
          });

          // Insert staff level history record
          const { data: levelHistory } = await adminClient.from('staff_level_history').insert({
            staff_member_id: member_id,
            operator_id: operatorProfile.id,
            from_level_id: beforeMember.level_id,
            to_level_id: level_id,
            reason: level_change_reason || 'เปลี่ยนระดับทีมงาน'
          }).select('id').single();
          if (levelHistory) levelHistoryId = levelHistory.id;
        }

        // Status changed
        if (beforeMember.status !== status) {
          let eventType = 'change_status';
          let ThaiStatus = status;
          if (status === 'Vacation') {
            eventType = 'vacation';
            ThaiStatus = 'พักงาน (Vacation)';
          } else if (status === 'Suspended') {
            eventType = 'suspend';
            ThaiStatus = 'ระงับงาน (Suspended)';
          } else if (status === 'Resigned') {
            eventType = 'resign';
            ThaiStatus = 'ลาออก (Resigned)';
          } else if (status === 'Active') {
            eventType = 'active';
            ThaiStatus = 'ทำงานปกติ (Active)';
          }

          timelineInserts.push({
            staff_member_id: member_id,
            event_type: eventType,
            details: `เปลี่ยนสถานะการทำงานจาก ${beforeMember.status} เป็น ${ThaiStatus}`,
            created_by: operatorProfile.id
          });
        }

        // 4. Save timeline inserts to database
        if (timelineInserts.length > 0) {
          await adminClient.from('staff_timeline').insert(timelineInserts);
        }

        // 5. Create audit logs
        await adminClient.from('staff_audit_logs').insert({
          staff_member_id: member_id,
          action: 'edit_info',
          operator_id: operatorProfile.id,
          operator_name: operatorProfile.username,
          before_data: beforeMember,
          after_data: afterMember
        });

        return new Response(
          JSON.stringify({ success: true, member: afterMember }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (discordError: any) {
        console.error('Update Discord roles failed. Rolling back database updates...', discordError);

        // ROLLBACK: Revert DB member to before state
        await adminClient
          .from('staff_members')
          .update({
            nickname: beforeMember.nickname,
            position_id: beforeMember.position_id,
            level_id: beforeMember.level_id,
            joined_at: beforeMember.joined_at,
            intern_start_at: beforeMember.intern_start_at,
            intern_end_at: beforeMember.intern_end_at,
            notes: beforeMember.notes,
            status: beforeMember.status,
            updated_at: beforeMember.updated_at
          })
          .eq('id', member_id);

        if (levelHistoryId) {
          await adminClient.from('staff_level_history').delete().eq('id', levelHistoryId);
        }

        return new Response(
          JSON.stringify({ 
            error: 'discord_role_update_failed', 
            message: `ไม่สามารถอัปเดตยศใน Discord ได้: ${discordError.message}. โรลแบ็กข้อมูลในระบบแล้ว`
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-staff:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper Discord API actions
async function addDiscordRole(botToken: string, guildId: string, userId: string, roleId: string) {
  if (!roleId) return;
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${botToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to add role ${roleId}: ${res.status} ${text}`);
  }
}

async function removeDiscordRole(botToken: string, guildId: string, userId: string, roleId: string) {
  if (!roleId) return;
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bot ${botToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to remove role ${roleId}: ${res.status} ${text}`);
  }
}
