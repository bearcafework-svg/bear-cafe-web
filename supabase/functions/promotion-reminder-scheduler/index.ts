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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Using service role client to operate scans and insertions
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: 'Discord configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get current date in Bangkok timezone
    const bangkokNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const year = bangkokNow.getFullYear();
    const month = bangkokNow.getMonth() + 1; // 1-12
    const day = bangkokNow.getDate();

    // 2. Fetch promotion settings from system_settings
    const { data: settingsRow } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'promotion_settings')
      .single();

    const settings = settingsRow?.value || {
      weeks: [
        { week: 1, start: 1, end: 7 },
        { week: 2, start: 8, end: 14 },
        { week: 3, start: 15, end: 21 },
        { week: 4, start: 22, end: 31 }
      ],
      reminder_rounds: [
        { id: "3_days", hours_before: 72, label: "เหลือ 3 วัน" },
        { id: "1_day", hours_before: 24, label: "เหลือ 1 วัน" },
        { id: "12_hours", hours_before: 12, label: "เหลือ 12 ชั่วโมง" }
      ]
    };

    // Find the current week based on settings
    const activeWeekConfig = settings.weeks.find((w: any) => day >= w.start && day <= w.end);
    if (!activeWeekConfig) {
      return new Response(
        JSON.stringify({ message: 'No active week configured for this day' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentWeekNumber = activeWeekConfig.week;
    const endDay = activeWeekConfig.end;

    // Get deadline date object in Bangkok time
    // If endDay is 31, but month has 30 days, adjust to last day of month
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const actualEndDay = Math.min(endDay, lastDayOfMonth);

    const deadline = new Date(`${year}-${month.toString().padStart(2, '0')}-${actualEndDay.toString().padStart(2, '0')}T23:59:59+07:00`);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Fetch active staff members
    const { data: activeStaff } = await adminClient
      .from('staff_members')
      .select('*, profiles(id, username)')
      .eq('status', 'Active');

    if (!activeStaff || activeStaff.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active staff members found', remindersSent: 0, missedMarked: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let remindersSentCount = 0;
    let missedMarkedCount = 0;

    // Check deadlines and reminders
    for (const member of activeStaff) {
      const profile = member.profiles;
      if (!profile) continue; // No profile mapping

      // Find user's submission for this week
      const { data: submission } = await adminClient
        .from('promotion_submissions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('year', year)
        .eq('month', month)
        .eq('week_number', currentWeekNumber)
        .maybeSingle();

      // Case A: Week is already past deadline (diffHours <= 0)
      if (diffHours <= 0) {
        if (!submission) {
          // If no submission exists, mark as Missed
          const { error: missedErr } = await adminClient
            .from('promotion_submissions')
            .insert({
              user_id: profile.id,
              discord_id: member.discord_id,
              year,
              month,
              week_number: currentWeekNumber,
              submission_type: 'none',
              count: 0,
              status: 'missed',
              notes: 'หมดเขตส่งงาน'
            });

          if (!missedErr) {
            missedMarkedCount++;
            // Send DM notifying user they missed the deadline
            const missedMessage = [
              `## 🐻︲__\` การส่งงานโปรโมท 𓂃 \`__`,
              `-# **สถานะ:** หมดเวลาส่งงานประจำสัปดาห์ ⚠️`,
              ``,
              `> **สัปดาห์ที่:** ${currentWeekNumber} (${month}/${year})`,
              `> **สถานะ:** Missed (ขาดการส่งงาน)`,
              ``,
              `สัปดาห์ปัจจุบันหมดเขตแล้ว ระบบบันทึกประวัติการขาดงานเรียบร้อยแล้วค่ะ`
            ].join('\n');
            await sendDiscordDM(botToken, member.discord_id, missedMessage).catch(() => {});
          }
        }
        continue;
      }

      // Case B: Week is active, check reminders
      // If user already submitted (pending/approved), do not remind them!
      // (If rejected, they should submit again, so check if submission is approved/pending. If missed, skip as well).
      if (submission && (submission.status === 'approved' || submission.status === 'pending')) {
        continue;
      }

      // Check which reminder round matches the remaining hours
      for (const round of settings.reminder_rounds) {
        if (diffHours <= round.hours_before) {
          // Check if this specific reminder was already sent
          const { data: reminderLog } = await adminClient
            .from('promotion_reminder_logs')
            .select('*')
            .eq('user_id', profile.id)
            .eq('year', year)
            .eq('month', month)
            .eq('week_number', currentWeekNumber)
            .eq('reminder_type', round.id)
            .maybeSingle();

          if (!reminderLog) {
            // Send Discord DM reminder
            let timeLeftLabel = '';
            if (round.id === '3_days') timeLeftLabel = '3 วัน';
            else if (round.id === '1_day') timeLeftLabel = '24 ชั่วโมง (1 วัน)';
            else if (round.id === '12_hours') timeLeftLabel = '12 ชั่วโมง';

            const reminderMessage = [
              `## 🐻︲__\` แจ้งเตือนการส่งงานโปรโมท 𓂃 \`__`,
              `-# **เวลาที่เหลือ:** เหลืออีกประมาณ __${timeLeftLabel}__ จะหมดเขต! ⏳`,
              ``,
              `> **สัปดาห์ที่:** ${currentWeekNumber} (${month}/${year})`,
              `> **วันหมดเขต:** <t:${Math.floor(deadline.getTime() / 1000)}:F> (<t:${Math.floor(deadline.getTime() / 1000)}:R>)`,
              ``,
              `กรุณาส่งงานโปรโมทประจำสัปดาห์ (โพสต์ 5 ครั้ง หรือ คอมเมนต์ 5 ครั้ง) ผ่านทางระบบบนเว็บไซต์ด้วยนะคะ! 🧸`
            ].join('\n');

            const sendResult = await sendDiscordDM(botToken, member.discord_id, reminderMessage)
              .then(() => true)
              .catch((err) => {
                console.error(`Failed to remind member ${member.discord_id}:`, err.message);
                return false;
              });

            if (sendResult) {
              // Log the sent reminder
              await adminClient.from('promotion_reminder_logs').insert({
                user_id: profile.id,
                year,
                month,
                week_number: currentWeekNumber,
                reminder_type: round.id
              });
              remindersSentCount++;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reminder scan completed',
        remindersSent: remindersSentCount,
        missedMarked: missedMarkedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reminder scheduler:', error);
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
