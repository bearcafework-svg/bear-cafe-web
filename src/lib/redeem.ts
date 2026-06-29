import type { RewardPopupData } from '@/components/bear-cafe/RewardPopup';
import { formatNumber } from '@/lib/utils';

export const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  code_used: 'โค้ดนี้ถูกใช้ไปแล้ว',
  invalid_code: 'ไม่พบโค้ดนี้',
  expired: 'โค้ดหมดอายุแล้ว',
  not_started: 'โค้ดยังไม่ถึงเวลาใช้งาน',
  limit_reached: 'โค้ดถูกใช้ครบโควต้าแล้ว',
  already_redeemed: 'คุณเคยใช้โค้ดนี้ไปแล้ว',
  disabled: 'โค้ดนี้ถูกปิดใช้งาน',
  misconfigured_code: 'โค้ดไม่ถูกต้อง กรุณาติดต่อแอดมิน',
  missing_code: 'กรุณากรอกโค้ด',
};

/** Thai keyword → popup title for RewardPopup error display (icons mapped in component). */
export const REDEEM_ERROR_PATTERNS: { pattern: string; title: string }[] = [
  { pattern: 'หมดอายุ', title: 'โค้ดหมดอายุแล้ว' },
  { pattern: 'ยังไม่ถึงเวลา', title: 'ยังไม่ถึงเวลาใช้งาน' },
  { pattern: 'ถูกใช้ไปแล้ว', title: 'โค้ดถูกใช้แล้ว' },
  { pattern: 'เคยใช้โค้ดนี้', title: 'ใช้โค้ดนี้แล้ว' },
  { pattern: 'ครบโควต้า', title: 'โค้ดถูกใช้ครบแล้ว' },
  { pattern: 'ปิดใช้งาน', title: 'โค้ดถูกปิดใช้งาน' },
  { pattern: 'ไม่พบโค้ด', title: 'ไม่พบโค้ดนี้' },
  { pattern: 'ติดต่อแอดมิน', title: 'โค้ดมีปัญหา' },
  { pattern: 'กรุณากรอกโค้ด', title: 'ยังไม่ได้กรอกโค้ด' },
  { pattern: 'ขัดข้อง', title: 'เกิดข้อผิดพลาด' },
  { pattern: 'ยังไม่พบข้อมูล', title: 'ไม่พบข้อมูลผู้ใช้' },
];

export function getRedeemErrorInfo(message?: string) {
  if (!message) return null;
  for (const entry of REDEEM_ERROR_PATTERNS) {
    if (message.includes(entry.pattern)) return entry;
  }
  return null;
}

export function isRedeemErrorMessage(reward: RewardPopupData): boolean {
  return !reward.pointsAdded && !reward.roleName && !!reward.message && getRedeemErrorInfo(reward.message) !== null;
}

export function buildRewardMessage(granted?: { pointsAdded?: number; roleGranted?: string }) {
  if (!granted) return 'รับรางวัลสำเร็จ';

  const pointsText = granted.pointsAdded
    ? `ได้รับ +${formatNumber(granted.pointsAdded)} 🍓`
    : '';
  const roleText = granted.roleGranted ? 'ได้รับยศใหม่' : '';

  if (granted.pointsAdded && granted.roleGranted) {
    return [pointsText, roleText].filter(Boolean).join(' และ ');
  }
  if (granted.roleGranted) return 'ได้รับยศใหม่แล้ว 🎭';
  return pointsText || 'ได้รับสตอเบอรี่แล้ว 🍓';
}

export function buildRewardType(
  granted?: { pointsAdded?: number; roleGranted?: string },
): RewardPopupData['type'] {
  if (granted?.pointsAdded && granted?.roleGranted) return 'both';
  if (granted?.roleGranted) return 'role';
  return 'points';
}

export interface ResolvedRoleMeta {
  roleName?: string;
  roleEmoji?: string;
  roleColor?: string;
}

export function buildRedeemRewardPopupData(
  granted: { pointsAdded?: number; roleGranted?: string } | undefined,
  roleMeta: ResolvedRoleMeta,
  message?: string,
): RewardPopupData {
  return {
    type: buildRewardType(granted),
    pointsAdded: granted?.pointsAdded,
    roleName: roleMeta.roleName,
    roleEmoji: roleMeta.roleEmoji,
    roleColor: roleMeta.roleColor,
    message: message ?? buildRewardMessage(granted),
  };
}
