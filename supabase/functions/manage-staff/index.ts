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

        // Send Discord notification asynchronously or safely catch errors
        try {
          const avatarUrl = await getDiscordMemberAvatar(botToken, guildId, discord_id);
          await sendAddStaffNotification(
            botToken,
            discord_id,
            nickname || '',
            joined_at || new Date().toISOString(),
            intern_start_at,
            intern_end_at,
            position.discord_role_id || '0',
            avatarUrl
          );
        } catch (notifErr) {
          console.error('Failed to send add staff notification:', notifErr);
        }

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

          // Send Discord notification for level change (Upgrade/Downgrade)
          try {
            const avatarUrl = await getDiscordMemberAvatar(botToken, guildId, discord_id);
            if (isUpgrade) {
              await sendLevelUpNotification(
                botToken,
                discord_id,
                newPosition.discord_role_id || '0',
                operatorDiscordId || '0',
                avatarUrl
              );
            } else if (isDowngrade) {
              await sendLevelDownNotification(
                botToken,
                discord_id,
                newPosition.discord_role_id || '0',
                operatorDiscordId || '0',
                avatarUrl
              );
            }
          } catch (notifErr) {
            console.error('Failed to send level change notification:', notifErr);
          }
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

// Helper to get Discord member's avatar URL (checks guild member first, then user, fallbacks to default)
async function getDiscordMemberAvatar(botToken: string, guildId: string, userId: string): Promise<string> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { 'Authorization': `Bot ${botToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.avatar) {
        const ext = data.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${data.avatar}.${ext}`;
      }
      if (data.user?.avatar) {
        const ext = data.user.avatar.startsWith('a_') ? 'gif' : 'png';
        return `https://cdn.discordapp.com/avatars/${userId}/${data.user.avatar}.${ext}`;
      }
    }
  } catch (e) {
    console.error('Error fetching member avatar:', e);
  }
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

// Generic channel message sender using bot token
async function sendDiscordChannelMessage(botToken: string, channelId: string, payload: any) {
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to send Discord message to channel ${channelId}: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error(`Error sending Discord message:`, err);
  }
}

// Notification payload when adding staff
async function sendAddStaffNotification(
  botToken: string,
  userId: string,
  nickname: string,
  joinedAt: string,
  internStart: string | null,
  internEnd: string | null,
  roleId: string,
  avatarUrl: string
) {
  const channelId = "1524123413122125964";
  const joinedUnix = Math.floor(new Date(joinedAt).getTime() / 1000);
  const startStr = internStart ? `<t:${Math.floor(new Date(internStart).getTime() / 1000)}:f>` : '-';
  const endStr = internEnd ? `<t:${Math.floor(new Date(internEnd).getTime() / 1000)}:f>` : '-';

  const content = `## <:bear9:1148271110132072598> ︲__\` 𝖭𝖾𝗐 𝗌𝗍𝖺𝖿𝖿 ₊ กำเนิดพี่เลี้ยงหมีตัวใหม่ 𓂃 \`__\n-# <@&1144697989986791576> <@&1360874841317576886> <@&1144698080239829092>\n<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲<@${userId}> *!*\n  - __\`𝐦𝐬𝐠\`__ : หวัดดีเราชื่อ **'${nickname}'** (<t:${joinedUnix}:R>) <:cuteplant:1152834055528783872>\n  -  __\`𝐬𝐭𝐚𝐫𝐭\`__ : ${startStr}\n  -  __\`𝐞𝐧𝐝\`__ : ${endStr}\n\n-# กำลังติดต่อพี่สตาฟ <@&${roleId}> ให้คุณ สามารถนั่งรอได้ที่ https://discord.com/channels/1144251788493602848/1524123213884293211`;

  const payload = {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "components": [
          {
            "type": 9,
            "components": [
              {
                "type": 10,
                "content": content
              }
            ],
            "accessory": {
              "type": 11,
              "media": {
                "url": avatarUrl
              }
            }
          },
          {
            "type": 14,
            "spacing": 2
          }
        ]
      }
    ]
  };

  await sendDiscordChannelMessage(botToken, channelId, payload);
}

// Notification payload when promoting staff (Level Up)
async function sendLevelUpNotification(
  botToken: string,
  userId: string,
  roleId: string,
  operatorId: string,
  avatarUrl: string
) {
  const channelId = "1524123413122125964";
  const content = `## <:95323thumbs:1310598361459462175>︲__\` 𝖲𝗍𝖺𝗍𝗎𝗌 ₊ พี่เลี้ยงหมีเลื่อนขั้นแล้ว 𓂃 \`__\n-# <@&1144697989986791576> <@&1360874841317576886> <@&1144698080239829092>\n<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲<@${userId}> *!*\n  - __\`ตำแหน่ง\`__: <@&${roleId}>\n  - __\`อนุมัติโดย\`__: <@${operatorId}> <:cuteplant:1152834055528783872>`;

  const payload = {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "components": [
          {
            "type": 9,
            "components": [
              {
                "type": 10,
                "content": content
              }
            ],
            "accessory": {
              "type": 11,
              "media": {
                "url": avatarUrl
              }
            }
          },
          {
            "type": 14,
            "spacing": 2
          }
        ]
      }
    ]
  };

  await sendDiscordChannelMessage(botToken, channelId, payload);
}

// Notification payload when demoting staff (Level Down)
async function sendLevelDownNotification(
  botToken: string,
  userId: string,
  roleId: string,
  operatorId: string,
  avatarUrl: string
) {
  const channelId = "1524123413122125964";
  const content = `## <:2531thumbsdown:1310598359152857199>︲__\` 𝖲𝗍𝖺𝗍𝗎𝗌 ₊ คำเตือน! คุณถูกลดขั้น 𓂃 \`__\n-# <@&1144697989986791576> <@&1360874841317576886> <@&1144698080239829092>\n<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲<@${userId}> *!*\n  - __\`ตำแหน่ง\`__: <@&${roleId}>\n  - __\`อนุมัติโดย\`__: <@${operatorId}> <:cuteplant:1152834055528783872>`;

  const payload = {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "components": [
          {
            "type": 9,
            "components": [
              {
                "type": 10,
                "content": content
              }
            ],
            "accessory": {
              "type": 11,
              "media": {
                "url": avatarUrl
              }
            }
          },
          {
            "type": 14,
            "spacing": 2
          }
        ]
      }
    ]
  };

  await sendDiscordChannelMessage(botToken, channelId, payload);
}
