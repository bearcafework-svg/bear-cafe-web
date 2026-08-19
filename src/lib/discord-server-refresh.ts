import { validateAndUpdateServerInvite } from './discord-invite-checker';

interface RefreshResult {
  success: boolean;
  isExpired?: boolean;
  updated?: {
    name: string;
    description: string | null;
    member_count: number | null;
    icon_url: string | null;
    banner_url: string | null;
    invite_status?: 'valid' | 'expired' | 'unknown';
  };
  error?: string;
}

/**
 * Fetch latest data from Discord invite API and update discord_servers table.
 * Works for both admin and owner — uses the invite_url to get fresh data and validate status.
 */
export async function refreshServerFromDiscord(
  serverId: string,
  inviteUrl: string
): Promise<RefreshResult> {
  try {
    const res = await validateAndUpdateServerInvite(serverId, inviteUrl);

    if (res.status === 'expired') {
      return {
        success: false,
        isExpired: true,
        error: res.error || 'ลิงก์เชิญหมดอายุหรือไม่ถูกต้อง',
      };
    }

    if (!res.success || !res.valid) {
      return {
        success: false,
        error: res.error || 'ไม่สามารถตรวจสอบลิงก์ได้',
      };
    }

    return {
      success: true,
      updated: {
        name: res.updatedData?.name,
        description: res.updatedData?.description ?? null,
        member_count: res.updatedData?.member_count ?? null,
        icon_url: res.updatedData?.icon_url ?? null,
        banner_url: res.updatedData?.banner_url ?? null,
        invite_status: 'valid',
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' };
  }
}

