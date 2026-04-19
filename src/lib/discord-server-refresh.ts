import { supabase } from '@/integrations/supabase/client';

interface RefreshResult {
  success: boolean;
  updated?: {
    name: string;
    description: string | null;
    member_count: number | null;
    icon_url: string | null;
    banner_url: string | null;
  };
  error?: string;
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
 * Fetch latest data from Discord invite API and update discord_servers table.
 * Works for both admin and owner — uses the invite_url to get fresh data.
 */
export async function refreshServerFromDiscord(
  serverId: string,
  inviteUrl: string
): Promise<RefreshResult> {
  // Extract invite code
  const match = inviteUrl.match(/discord\.gg\/([a-zA-Z0-9-]+)/);
  if (!match) return { success: false, error: 'ลิงก์เชิญไม่ถูกต้อง' };

  const inviteCode = match[1];

  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`
    );

    if (!res.ok) {
      if (res.status === 404) return { success: false, error: 'ลิงก์เชิญหมดอายุหรือไม่ถูกต้อง' };
      return { success: false, error: `Discord API error: ${res.status}` };
    }

    const data = await res.json();
    const guild = data.guild;
    if (!guild) return { success: false, error: 'ไม่พบข้อมูลเซิร์ฟเวอร์' };

    const updated = {
      name: guild.name,
      description: guild.description ?? null,
      member_count: data.approximate_member_count ?? null,
      icon_url: buildIconUrl(guild.id, guild.icon ?? null),
      banner_url:
        buildBannerUrl(guild.id, guild.banner ?? null) ||
        buildSplashUrl(guild.id, guild.splash ?? null),
    };

    const { error: updateError } = await (supabase as any)
      .from('discord_servers')
      .update(updated)
      .eq('id', serverId);

    if (updateError) return { success: false, error: updateError.message };

    return { success: true, updated };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'เกิดข้อผิดพลาด' };
  }
}
