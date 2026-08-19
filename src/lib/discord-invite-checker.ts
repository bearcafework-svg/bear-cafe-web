import { supabase } from '@/integrations/supabase/client';

export interface DiscordInviteInfo {
  valid: boolean;
  status: number;
  error?: string;
  guild?: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    banner: string | null;
    splash: string | null;
  };
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

/**
 * Extract invite code from various Discord invite URL formats
 */
export function extractInviteCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const cleaned = url.trim();
  const patterns = [
    /discord\.gg\/([a-zA-Z0-9-]+)/i,
    /discord\.com\/invite\/([a-zA-Z0-9-]+)/i,
    /discordapp\.com\/invite\/([a-zA-Z0-9-]+)/i,
  ];

  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m && m[1]) return m[1];
  }

  // Fallback: if user provided just the raw code
  if (/^[a-zA-Z0-9-]+$/.test(cleaned) && !cleaned.includes('/') && !cleaned.includes('.')) {
    return cleaned;
  }

  return null;
}

function buildIconUrl(guildId: string, iconHash: string | null): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=256`;
}

function buildBannerUrl(guildId: string, bannerHash: string | null): string | null {
  if (!bannerHash) return null;
  const ext = bannerHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${ext}?size=512`;
}

function buildSplashUrl(guildId: string, splashHash: string | null): string | null {
  if (!splashHash) return null;
  return `https://cdn.discordapp.com/splashes/${guildId}/${splashHash}.png?size=512`;
}

/**
 * Check Discord invite validity via public Discord API
 */
export async function checkDiscordInvite(inviteUrl: string): Promise<DiscordInviteInfo> {
  const code = extractInviteCode(inviteUrl);
  if (!code) {
    return {
      valid: false,
      status: 400,
      error: 'รูปแบบลิงก์เชิญไม่ถูกต้อง',
    };
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${code}?with_counts=true&with_expiration=true`
    );

    if (res.status === 200) {
      const data = await res.json();
      return {
        valid: true,
        status: 200,
        guild: data.guild,
        approximate_member_count: data.approximate_member_count,
        approximate_presence_count: data.approximate_presence_count,
      };
    }

    if (res.status === 404 || res.status === 400 || res.status === 403) {
      return {
        valid: false,
        status: res.status,
        error: 'ลิงก์เชิญหมดอายุ ถูกลบ หรือเซิร์ฟเวอร์ไม่เปิดให้เข้า',
      };
    }

    if (res.status === 429) {
      return {
        valid: true, // Don't mark as broken on rate limit
        status: 429,
        error: 'Discord ติด Rate limit กรุณาลองใหม่อีกครั้งภายหลัง',
      };
    }

    return {
      valid: false,
      status: res.status,
      error: `Discord API ตอบกลับสถานะ ${res.status}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      status: 0,
      error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Discord API',
    };
  }
}

/**
 * Validates a server invite and updates the `discord_servers` row in Supabase
 */
export async function validateAndUpdateServerInvite(
  serverId: string,
  inviteUrl: string
): Promise<{
  success: boolean;
  valid: boolean;
  status: 'valid' | 'expired' | 'rate_limited' | 'error';
  error?: string;
  updatedData?: Record<string, any>;
}> {
  const check = await checkDiscordInvite(inviteUrl);
  const now = new Date().toISOString();

  if (check.status === 429) {
    return {
      success: false,
      valid: true,
      status: 'rate_limited',
      error: 'Discord Rate Limit (ลองใหม่อีกครั้ง)',
    };
  }

  if (!check.valid) {
    // Mark as expired in DB
    try {
      await (supabase as any)
        .from('discord_servers')
        .update({
          invite_status: 'expired',
          invite_last_checked_at: now,
        })
        .eq('id', serverId);
    } catch (dbErr) {
      console.error('Failed to update expired invite status in DB:', dbErr);
    }

    return {
      success: true,
      valid: false,
      status: 'expired',
      error: check.error,
    };
  }

  // Link is valid — update DB with fresh server details if available
  const updatePayload: Record<string, any> = {
    invite_status: 'valid',
    invite_last_checked_at: now,
  };

  if (check.guild) {
    updatePayload.name = check.guild.name;
    if (check.guild.description !== undefined) {
      updatePayload.description = check.guild.description;
    }
    if (check.approximate_member_count != null) {
      updatePayload.member_count = check.approximate_member_count;
    }
    const icon = buildIconUrl(check.guild.id, check.guild.icon);
    if (icon) updatePayload.icon_url = icon;
    const banner =
      buildBannerUrl(check.guild.id, check.guild.banner) ||
      buildSplashUrl(check.guild.id, check.guild.splash);
    if (banner) updatePayload.banner_url = banner;
  }

  try {
    await (supabase as any)
      .from('discord_servers')
      .update(updatePayload)
      .eq('id', serverId);
  } catch (dbErr) {
    console.error('Failed to update valid invite status in DB:', dbErr);
  }

  return {
    success: true,
    valid: true,
    status: 'valid',
    updatedData: updatePayload,
  };
}

/**
 * Scan a list of servers sequentially with rate limiting delay
 */
export async function batchScanDiscordServers(
  servers: Array<{ id: string; invite_url: string; name: string }>,
  onProgress?: (
    current: number,
    total: number,
    server: { id: string; name: string },
    result: { valid: boolean; status: string; error?: string }
  ) => void,
  delayMs = 600
): Promise<{
  total: number;
  validCount: number;
  expiredCount: number;
  errorCount: number;
  expiredServers: Array<{ id: string; name: string; invite_url: string; reason?: string }>;
}> {
  let validCount = 0;
  let expiredCount = 0;
  let errorCount = 0;
  const expiredServers: Array<{ id: string; name: string; invite_url: string; reason?: string }> = [];

  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    const res = await validateAndUpdateServerInvite(s.id, s.invite_url);

    if (res.status === 'valid') {
      validCount++;
    } else if (res.status === 'expired') {
      expiredCount++;
      expiredServers.push({
        id: s.id,
        name: s.name,
        invite_url: s.invite_url,
        reason: res.error,
      });
    } else {
      errorCount++;
    }

    if (onProgress) {
      onProgress(i + 1, servers.length, s, {
        valid: res.valid,
        status: res.status,
        error: res.error,
      });
    }

    // Wait between calls to avoid Discord rate limiting
    if (i < servers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    total: servers.length,
    validCount,
    expiredCount,
    errorCount,
    expiredServers,
  };
}
