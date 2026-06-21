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

interface SessionAd {
  image_url: string;
  link_url: string;
}

// ── Global CTA Button (จาก site_settings key: global_cta_buttons) ─────────────
interface GlobalCtaButton {
  id: string;
  type: number;
  style: number;
  url: string;
  label: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  is_active: boolean;
  placement: string[];
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

/**
 * สร้าง Component v2 payload สำหรับ Discord Message
 * flags: 32768 = IS_COMPONENTS_V2
 */
function buildComponentV2Payload(params: {
  discordId: string;
  discordRoleId?: string;
  username: string;
  avatarUrl: string;
  categoryName: string;
  note?: string;
  voiceStatus: string;
  ads: SessionAd[];
  ctaButtons: GlobalCtaButton[];
  sessionActionRow: ReturnType<typeof buildSessionActionRow>;
}): Record<string, unknown> {
  const {
    discordId,
    discordRoleId,
    username,
    avatarUrl,
    categoryName,
    note,
    voiceStatus,
    ads,
    ctaButtons,
    sessionActionRow,
  } = params;

  // ── Section text ───────────────────────────────────────────────────────
  const roleTag = discordRoleId
    ? `<@&${discordRoleId}>`
    : 'ไม่ระบุ';

  const sectionText =
    `## <a:27073hispeechbubble:1518217054711189644>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ แจ้งเตือนหาเพื่อนลงห้อง 𓂃 \`__\n` +
    `-# <a:59217leaf:1512014878796152862> — ถึง: ${roleTag}\n\n` +
    `> (👤)︰<@${discordId}>` + (note ? ` ${note.slice(0, 300)}` : '') + `\n` +
    `> (💭)︰${categoryName}\n` +
    `> (🌱)︰${voiceStatus}`;

  // ── Components ────────────────────────────────────────────────────────
  const components: unknown[] = [];

  // Container (type 17)
  const containerChildren: unknown[] = [];

  // Separator บนสุด
  containerChildren.push({ type: 14, spacing: 1, divider: false });

  // Section: text + avatar thumbnail
  containerChildren.push({
    type: 9,
    components: [
      {
        type: 10,
        content: sectionText,
      },
    ],
    accessory: {
      type: 11,
      media: { url: avatarUrl },
    },
  });

  // ปุ่มหลัก: "หาเพื่อนลงห้อง" + ปุ่ม session (ทัก/ลงห้อง)
  const mainButtonRow: unknown[] = [
    {
      type: 2,
      style: 5,
      url: "https://bearcafe4commu.vercel.app/create-session",
      label: "หาเพื่อนลงห้อง",
    },
  ];

  if (sessionActionRow && sessionActionRow.components?.[0]) {
    mainButtonRow.push(sessionActionRow.components[0]);
  }

  containerChildren.push({
    type: 1,
    components: mainButtonRow,
  });

  // Separator
  containerChildren.push({ type: 14, spacing: 2 });

  // ── โฆษณา (ads) แทรกตามลำดับ ────────────────────────────────────────
  for (const ad of ads) {
    // รูปโฆษณา (media gallery)
    containerChildren.push({
      type: 12,
      items: [
        {
          media: { url: ad.image_url },
          spoiler: false,
        },
      ],
    });

    // Separator บาง
    containerChildren.push({ type: 14, divider: false });

    // ปุ่มดูรายละเอียด + CTA จาก site_settings
    const adRowComponents: unknown[] = [
      {
        type: 2,
        style: 5,
        label: "ดูรายละเอียด",
        emoji: { name: "🔎" },
        url: ad.link_url,
      },
      ...ctaButtons.map((b) => ({
        type: b.type,
        style: b.style,
        url: b.url,
        label: b.label,
        ...(b.emoji ? { emoji: b.emoji } : {}),
      })),
    ];
    containerChildren.push({
      type: 1,
      components: adRowComponents,
    });
  }

  // ถ้าไม่มีโฆษณาเลย แสดง CTA จาก site_settings แถวเดียว (ถ้ามี)
  if (ads.length === 0 && ctaButtons.length > 0) {
    containerChildren.push({
      type: 1,
      components: ctaButtons.map((b) => ({
        type: b.type,
        style: b.style,
        url: b.url,
        label: b.label,
        ...(b.emoji ? { emoji: b.emoji } : {}),
      })),
    });
  }

  components.push({
    type: 17,
    components: containerChildren,
  });

  // NOTE: Components v2 (flags: 32768) does NOT allow the top-level `content` field.
  // Mentions must live inside a text component instead.
  return {
    flags: 32768, // IS_COMPONENTS_V2
    components,
    allowed_mentions: {
      roles: discordRoleId ? [discordRoleId] : [],
      users: discordId ? [discordId] : [],
    },
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

    console.log('[session-webhook] Processing Component v2 request', {
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

    const sessionMode = normalizeSessionMode(sessionData.sessionMode);
    const isVoiceRoom = sessionMode === 'voice_room';

    // ── voice status text ─────────────────────────────────────────────
    let voiceStatus: string;
    if (isVoiceRoom && sessionData.voiceChannelId && guildId) {
      voiceStatus = `https://discord.com/channels/${guildId}/${sessionData.voiceChannelId}`;
    } else {
      voiceStatus = 'ทักแชทส่วนตัวเรามาเลย';
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── ดึง profile + placement + global CTA พร้อมกัน ────────────────
    const [profileRes, placementRes, ctaRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, avatar_url, discord_id')
        .eq('id', guardResult.user.id)
        .maybeSingle(),
      supabase
        .from('ad_placements')
        .select(`
          delivery_mode,
          ad_placement_items (
            sort_order,
            session_ads ( image_url, link_url, is_active )
          )
        `)
        .eq('key', 'session_webhook')
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'global_cta_buttons')
        .maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = profileRes.data;

    // ── parse global CTA buttons ──────────────────────────────────────
    const allCtaButtons: GlobalCtaButton[] = Array.isArray(ctaRes.data?.value)
      ? (ctaRes.data!.value as GlobalCtaButton[])
      : [];
    // กรองเฉพาะปุ่มที่ active และ placement ครอบคลุม session_webhook
    const ctaButtons = allCtaButtons.filter(
      (b) => b.is_active && Array.isArray(b.placement) && b.placement.includes('session_webhook'),
    );
    if (ctaRes.error) {
      console.warn('[session-webhook] Failed to fetch global_cta_buttons, continuing without CTA', {
        error: ctaRes.error.message,
      });
    }

    // ── สร้างโฆษณา 1 ชิ้นตาม delivery_mode ──────────────────────────
    let ads: SessionAd[] = [];
    let deliveryMode = 'random_one';

    if (placementRes.error) {
      console.warn('[session-webhook] Failed to fetch placement, continuing without ads', {
        error: placementRes.error.message,
      });
    } else if (!placementRes.data) {
      console.warn('[session-webhook] placement session_webhook not found or inactive');
    } else {
      deliveryMode = placementRes.data.delivery_mode ?? 'random_one';

      if (deliveryMode === 'random_one') {
        // สุ่ม 1 ชิ้นจาก session_ads ทั้งหมดที่ is_active = true โดยตรง
        const { data: allAds, error: allAdsError } = await supabase
          .from('session_ads')
          .select('image_url, link_url')
          .eq('is_active', true);

        if (allAdsError) {
          console.warn('[session-webhook] Failed to fetch session_ads for random_one', {
            error: allAdsError.message,
          });
        } else if (allAds && allAds.length > 0) {
          ads = [allAds[Math.floor(Math.random() * allAds.length)]];
        }
      } else if (deliveryMode === 'ordered') {
        // เอาอันดับแรกจาก ad_placement_items ตาม sort_order
        const items: Array<{ sort_order: number; session_ads: { image_url: string; link_url: string; is_active: boolean } | null }> =
          (placementRes.data.ad_placement_items as any) ?? [];

        const first = items
          .filter((item) => item.session_ads?.is_active === true)
          .sort((a, b) => a.sort_order - b.sort_order)[0];

        if (first) {
          ads = [{
            image_url: first.session_ads!.image_url,
            link_url: first.session_ads!.link_url,
          }];
        }
        // ถ้าไม่มี item → ads = [] ไม่ fallback
      }
    }

    // ── session action row (ทักส่วนตัว / ลงห้อง) ──────────────────────
    const { actionRow, fallbackReason } = buildValidatedSessionActionRow({
      sessionMode,
      guildId,
      voiceChannelId: sessionData.voiceChannelId,
      discordUserId: profile.discord_id,
    });

    if (fallbackReason) {
      console.warn('[session-webhook] Skipping session button due to missing data', {
        sessionId: sessionData.sessionId ?? null,
        sessionMode,
        fallbackReason,
      });
    }

    // ── avatar fallback ────────────────────────────────────────────────
    const avatarUrl = profile.avatar_url ||
      `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discord_id || '0') % 5}.png`;
    // ── สร้าง Component v2 payload ────────────────────────────────────
    // NOTE: top-level `content` is forbidden with IS_COMPONENTS_V2 (flags 32768)
    // Mentions are embedded inside the text component instead.
    const botPayload = buildComponentV2Payload({
      discordId: profile.discord_id || '',
      discordRoleId: sessionData.discordRoleId,
      username: profile.username || 'ผู้ใช้',
      avatarUrl,
      categoryName: sessionData.categoryName,
      note: sessionData.note,
      voiceStatus,
      ads,
      ctaButtons,
      sessionActionRow: actionRow,
    });

    // ── ส่งผ่าน Bot API ────────────────────────────────────────────────
    const dedupKey = `send-session-webhook:${sessionData.sessionId ?? guardResult.user.id}:${sessionData.sessionMode ?? 'unknown'}`;

    const result = await sendDiscordBotMessage(channelId, botPayload, { dedupKey });

    if (!result.success) {
      console.error('[session-webhook] Discord send failed', {
        sessionId: sessionData.sessionId ?? null,
        sessionMode,
        error: result.error,
        errorCode: result.errorCode ?? null,
        errorCategory: result.errorCategory ?? null,
        status: result.status ?? null,
        discordErrorCode: result.discordErrorCode ?? null,
        fallbackReason: fallbackReason ?? null,
        adsCount: ads.length,
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
        marker: 'bot_session_webhook_v2',
        transport: 'discord_bot_api',
        channel_id: channelId,
        message_id: result.messageId ?? null,
        component_fallback_reason: fallbackReason ?? null,
        placement_key: 'session_webhook',
        delivery_mode: deliveryMode,
        ads_count: ads.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        transport: 'discord_bot_api_v2',
        componentFallbackReason: fallbackReason ?? null,
        adsCount: ads.length,
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
