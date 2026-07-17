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

    // Using service role client to operate RPCs and update tables
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

    // Checking if user has access to either 'submit-promotion' page or is Owner/Admin
    const { data: hasAccess } = await adminClient.rpc('has_any_page_access', {
      _user_id: operatorProfile.id,
      _pages: ['submit-promotion'],
    });

    // Submissions review is owner/admin only
    const { data: isModerator } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', operatorProfile.id)
      .in('role', ['admin', 'moderator']);
      
    const isOwner = (isModerator && isModerator.length > 0) || user.user_metadata?.role === 'owner';

    if (!hasAccess && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { submission_id } = body;

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: submission_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Invoke database approval RPC function (atomic point increase & status change)
    const { data: rpcResult, error: rpcError } = await adminClient.rpc('approve_promotion_submission', {
      p_operator_id: operatorProfile.id,
      p_submission_id: submission_id
    });

    if (rpcError || !rpcResult?.success) {
      console.error('Approval RPC failed:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Database approval transaction failed', details: rpcError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { discord_id, points_awarded, user_id } = rpcResult;

    // Fetch submission details to craft DM message
    const { data: submission } = await adminClient
      .from('promotion_submissions')
      .select('*')
      .eq('id', submission_id)
      .single();

    try {
      // 2. Send Discord DM to notify the user of point increase
      const textMessage = [
        `## 🐻︲__\` การตรวจงานโปรโมท 𓂃 \`__`,
        `-# **สถานะ:** งานของคุณผ่านการอนุมัติแล้ว! 🎉`,
        ``,
        `> **ประเภทงาน:** ${submission.submission_type}`,
        `> **รอบงาน:** สัปดาห์ที่ ${submission.week_number} (${submission.month}/${submission.year})`,
        `> **จำนวนงาน:** ${submission.count} ครั้ง`,
        `> **แต้มที่ได้รับ:** +${points_awarded} แต้มสะสม`,
        ``,
        `ขอบคุณที่ช่วยสนับสนุนเซิร์ฟเวอร์หมีคาเฟ่นะคะ! 🧸`
      ].join('\n');

      await sendDiscordDM(botToken, discord_id, textMessage);

      return new Response(
        JSON.stringify({ success: true, message: 'Submission approved and notified successfully', points: points_awarded }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (dmError: any) {
      console.error('Discord DM failed. Initiating database rollback...', dmError);

      // 3. Rollback point increase & status change in DB
      const { data: rollbackSuccess, error: rollbackError } = await adminClient.rpc('rollback_promotion_approval', {
        p_operator_id: operatorProfile.id,
        p_submission_id: submission_id
      });

      if (rollbackError || !rollbackSuccess) {
        console.error('Rollback RPC failed:', rollbackError);
      }

      return new Response(
        JSON.stringify({
          error: 'discord_dm_failed',
          message: `ไม่สามารถส่งข้อความแจ้งเตือนทาง Discord DM ได้: ${dmError.message}. ได้โรลแบ็กการอนุมัติและแต้มคืนแล้ว`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in approve-promotion:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: send DM message using discord Bot token
async function sendDiscordDM(botToken: string, userId: string, content: string) {
  // 1. Create DM channel
  const channelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!channelRes.ok) {
    const errText = await channelRes.text();
    throw new Error(`เปิดห้อง DM ล้มเหลว (403/404): ${channelRes.status} ${errText}`);
  }

  const channelData = await channelRes.json();
  const dmChannelId = channelData.id;

  // 2. Send message
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`ส่งข้อความ DM ล้มเหลว: ${msgRes.status} ${errText}`);
  }

  return await msgRes.json();
}
