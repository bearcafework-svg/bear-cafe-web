import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { requireRoleBanGuard } from "../_shared/role-ban.ts";
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";
import { buildSessionActionRow, normalizeSessionMode } from "../_shared/sessionDiscordMessage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionData {
  sessionId?: string;
  categoryIcon: string;
  categoryName: string;
  duration: number;
  note?: string;
  roleName?: string;
  roleEmoji?: string;
  discordRoleId?: string;
  voiceChannelName?: string;
  voiceChannelId?: string;
  appUrl?: string;
  turnstileToken?: string;
  sessionMode?: string;
}

interface SessionComponentValidation {
  actionRow: ReturnType<typeof buildSessionActionRow>;
  fallbackReason?: 'missing_guild_id' | 'missing_discord_id' | 'missing_voice_channel_id';
}

const cooldownMs = 5 * 60 * 1000;
const cooldownTracker = new Map<string, number>();

function buildValidatedSessionActionRow(params: {
  sessionMode?: string;
  guildId?: string | null;
  voiceChannelId?: string | null;
  discordUserId?: string | null;
}): SessionComponentValidation {
  const sessionMode = normalizeSessionMode(params.sessionMode);

  if (sessionMode === 'voice_room') {
    if (!params.guildId) {
      return { actionRow: null, fallbackReason: 'missing_guild_id' };
    }

    if (!params.voiceChannelId) {
      return { actionRow: null, fallbackReason: 'missing_voice_channel_id' };
    }
  }

  if (sessionMode === 'dm' && !params.discordUserId) {
    return { actionRow: null, fallbackReason: 'missing_discord_id' };
  }

  return {
    actionRow: buildSessionActionRow({
      sessionMode,
      guildId: params.guildId,
      voiceChannelId: params.voiceChannelId,
      discordUserId: params.discordUserId,
    }),
  };
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guardResult = await requireRoleBanGuard(req, corsHeaders);
    if ("response" in guardResult) {
      return guardResult.response as Response;
    }

    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`session:${ip}`, 12, 60_000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'ส่งคำขอถี่เกินไป กรุณาลองใหม่อีกครั้ง', retryAfterSeconds: rateLimit.retryAfterSeconds }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ดึงค่า Config จาก Environment Variables
    const channelId = Deno.env.get('DISCORD_SESSION_CHANNEL_ID');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!channelId) {
      console.error('CRITICAL: DISCORD_SESSION_CHANNEL_ID not configured');
      return new Response(
        JSON.stringify({ error: 'ระบบส่งข้อความยังไม่พร้อมใช้งาน' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData: SessionData = await req.json();

    console.log('[session-bot-webhook] Processing Bot API request', {
      sessionId: sessionData.sessionId ?? null,
      sessionMode: sessionData.sessionMode ?? 'unknown',
      hasNote: Boolean(sessionData.note),
      hasRole: Boolean(sessionData.discordRoleId),
      hasGuildId: Boolean(guildId),
      hasVoiceChannelId: Boolean(sessionData.voiceChannelId),
    });

    const turnstile = await verifyTurnstile(sessionData.turnstileToken);
    if (!turnstile.success) {
      return new Response(
        JSON.stringify({ error: 'ยืนยันความปลอดภัยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionData.categoryName || !sessionData.duration) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: categoryName, duration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cooldownKey = sessionData.sessionId ?? guardResult.user.id;
    const now = Date.now();
    const lastSentAt = cooldownTracker.get(cooldownKey);
    if (lastSentAt && now - lastSentAt < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - (now - lastSentAt)) / 1000);
      return new Response(
        JSON.stringify({ error: 'Cooldown active. Please wait before sending again.', retryAfterSeconds }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const discordTimestamp = Math.floor(Date.now() / 1000);
    const sessionMode = normalizeSessionMode(sessionData.sessionMode);
    const isVoiceRoom = sessionMode === 'voice_room';

    let voiceStatus: string;
    if (isVoiceRoom && sessionData.voiceChannelId && guildId) {
      voiceStatus = `https://discord.com/channels/${guildId}/${sessionData.voiceChannelId}`;
    } else {
      voiceStatus = '> สมาชิกท่านนี้ยังไม่ลงห้อง ลองทักส่วนตัวดูนะคะ <a:bearg14:1396016043490672711>';
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url, discord_id')
      .eq('id', guardResult.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { actionRow, fallbackReason } = buildValidatedSessionActionRow({
      sessionMode,
      guildId,
      voiceChannelId: sessionData.voiceChannelId,
      discordUserId: profile.discord_id,
    });

    if (fallbackReason) {
      console.warn('[session-bot-webhook] Skipping session button due to missing data', {
        sessionId: sessionData.sessionId ?? null,
        sessionMode,
        fallbackReason,
        hasGuildId: Boolean(guildId),
        hasVoiceChannelId: Boolean(sessionData.voiceChannelId),
        hasDiscordUserId: Boolean(profile.discord_id),
      });
    }

    // 🎨 สร้าง Embed
    const embed: Record<string, unknown> = {
      description: `\n### <:bear_star1:1152782839671169184>︲__\`${profile.username} กำลังหาเพื่อน!\`__\n`,
      color: 16773103,
      fields: [
        { name: 'หมวดหมู่', value: sessionData.categoryName, inline: true },
        { name: 'บทบาท', value: sessionData.discordRoleId ? `<@&${sessionData.discordRoleId}>` : 'ไม่ระบุ', inline: true },
        { name: 'วัน/เวลา', value: `<t:${discordTimestamp}:F> — <t:${discordTimestamp}:R>`, inline: true },
        { name: 'สถานะ', value: voiceStatus, inline: true },
      ],
      thumbnail: {
        url: profile.avatar_url || `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discord_id || '0') % 5}.png`
      }
    };

    // ✨ เพิ่ม Footer เฉพาะตอนเลือก "ลงห้องคุย"
    if (isVoiceRoom) {
      embed.footer = {
        text: "กรุณาตรวจสอบก่อนดำเนินการว่าผู้ใช้ยังอยู่ในห้องหรือไม่ เนื่องจากอาจมีกรณีที่ผู้ใช้ออกจากห้องไปแล้วค่ะ",
        icon_url: "https://cdn.discordapp.com/attachments/1144675871798591569/1481646391771004958/image.png"
      };
    }

    let content = '';
    if (sessionData.discordRoleId) content += `<@&${sessionData.discordRoleId}>`;
    if (sessionData.note) {
      const sanitizedNote = sessionData.note.slice(0, 500).replace(/[<>]/g, '');
      content += content ? ` ${sanitizedNote}` : sanitizedNote;
    }
    if (profile.discord_id) {
      content += content ? ` ||<@${profile.discord_id}>||` : `||<@${profile.discord_id}>||`;
    }

    // ประกอบร่าง Payload สำหรับ Bot API พร้อม action row แบบเดียวกับหน้า preview
    const botPayload = {
      content: content,
      embeds: [embed],
      components: actionRow ? [actionRow] : [],
      allowed_mentions: {
        roles: sessionData.discordRoleId ? [sessionData.discordRoleId] : [],
        users: profile.discord_id ? [profile.discord_id] : [],
      }
    };

    // 🚀 ส่งผ่าน Bot API แทน Webhook URL เดิม
    const dedupKey = `send-session-webhook:${sessionData.sessionId ?? guardResult.user.id}:${sessionData.sessionMode ?? 'unknown'}`;

    const result = await sendDiscordBotMessage(channelId, botPayload, { dedupKey });

    if (!result.success) {
      console.error('[session-bot-webhook] Discord send failed', {
        sessionId: sessionData.sessionId ?? null,
        sessionMode,
        error: result.error,
        errorCode: result.errorCode ?? null,
        errorCategory: result.errorCategory ?? null,
        status: result.status ?? null,
        discordErrorCode: result.discordErrorCode ?? null,
        fallbackReason: fallbackReason ?? null,
      });

      return new Response(
        JSON.stringify({
          error: 'Discord API failed',
          details: result.error,
          errorCode: result.errorCode ?? null,
          errorCategory: result.errorCategory ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    cooldownTracker.set(cooldownKey, now);

    await supabase.from('action_logs').insert({
      user_id: guardResult.user.id,
      action_type: 'session_bot_webhook_sent',
      details: {
        session_id: sessionData.sessionId ?? null,
        session_mode: sessionData.sessionMode ?? 'unknown',
        marker: 'bot_session_webhook',
        transport: 'discord_bot_api',
        channel_id: channelId,
        message_id: result.messageId ?? null,
        component_fallback_reason: fallbackReason ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        transport: 'discord_bot_api',
        componentFallbackReason: fallbackReason ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-session-webhook:', message);
    return new Response(
      JSON.stringify({ error: 'Unable to send message via Bot' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
