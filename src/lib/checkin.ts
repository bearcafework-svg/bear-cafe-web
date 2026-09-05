import { formatNumber } from '@/lib/utils';

export type CheckinRewardType = 'points' | 'ticket_point' | 'ticket_piece_point' | 'role';

export interface CheckinDailyReward {
  day_number: number;
  reward_type: CheckinRewardType;
  reward_amount: number | null;
  role_id: string | null;
  role_name?: string | null;
  makeup_cost: number;
  is_active: boolean;
}

export interface CheckinCycle {
  year: number;
  month: number;
  completed_days: number[];
  makeup_days: number[];
  big_reward_claimed: boolean;
}

export interface CheckinBigReward {
  reward_type: CheckinRewardType;
  reward_amount: number | null;
  role_id: string | null;
  description: string | null;
}

export interface CheckinStatus {
  cycle: CheckinCycle;
  daily_rewards: CheckinDailyReward[];
  big_reward: CheckinBigReward | null;
  makeup_window_open: boolean;
  /** Max makeup (re-checkin) uses per month; from site_settings. */
  makeup_max: number;
}

/** site_settings key for monthly makeup quota. */
export const CHECKIN_MAX_MAKEUP_DAYS_KEY = 'checkin_max_makeup_days';

/** Default when setting is missing or invalid. */
export const DEFAULT_CHECKIN_MAKEUP_MAX = 3;

/**
 * Parse site_settings value for checkin_max_makeup_days.
 * Accepts `{ "days": N }` or a bare number. Clamps to 0–28; falls back to 3.
 */
export function parseCheckinMakeupMax(value: unknown): number {
  if (value == null) return DEFAULT_CHECKIN_MAKEUP_MAX;
  let raw: unknown = value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    raw = (value as Record<string, unknown>).days;
    if (raw == null) return DEFAULT_CHECKIN_MAKEUP_MAX;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_CHECKIN_MAKEUP_MAX;
  return Math.min(28, Math.max(0, Math.floor(n)));
}

export const CHECKIN_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const REWARD_TYPE_LABELS: Record<CheckinRewardType, string> = {
  points: 'แต้ม',
  ticket_point: 'ตั๋วสุ่ม',
  ticket_piece_point: 'เศษตั๋วสุ่ม',
  role: 'Role',
};

export function formatCheckinRewardGranted(type: CheckinRewardType, amount: number): string {
  const n = formatNumber(amount);
  switch (type) {
    case 'points':
      return `+ ${n} แต้ม`;
    case 'ticket_point':
      return `+ ${n} ตั๋วสุ่ม`;
    case 'ticket_piece_point':
      return `+ ${n} เศษตั๋วสุ่ม`;
    default:
      return '';
  }
}

export function formatCheckinMakeupCost(cost: number): string {
  return `- ${formatNumber(cost)} แต้ม`;
}

export function formatCheckinRewardBalance(type: CheckinRewardType, balance: number): string {
  const n = formatNumber(balance);
  switch (type) {
    case 'points':
      return `${n} แต้ม`;
    case 'ticket_point':
      return `${n} ตั๋วสุ่ม`;
    case 'ticket_piece_point':
      return `${n} เศษตั๋วสุ่ม`;
    default:
      return '';
  }
}

export const CHECKIN_TIMEZONE = 'Asia/Bangkok';

export function getCheckinToday(now = new Date()) {
  const [year, month, day] = now
    .toLocaleDateString('en-CA', { timeZone: CHECKIN_TIMEZONE })
    .split('-')
    .map(Number);

  return { year, month, day };
}

/** @deprecated Use getCheckinToday — check-in uses Bangkok time, not UTC. */
export function getUtcToday() {
  return getCheckinToday();
}

export function computeCheckinStreak(completedDays: Set<number>, todayDay: number): number {
  const cap = Math.min(todayDay, 28);
  let streak = 0;
  for (let day = cap; day >= 1; day--) {
    if (completedDays.has(day)) streak++;
    else break;
  }
  return streak;
}

/** Days in the current cycle (1–28) that have passed without a check-in. */
export function computeMissedCheckinDays(completedDays: Set<number>, todayDay: number): number {
  const cap = Math.min(todayDay, 28);
  let count = 0;
  for (let day = 1; day <= cap; day++) {
    if (completedDays.has(day)) continue;
    if (day === todayDay && todayDay <= 28) continue;
    count++;
  }
  return count;
}

export function getCheckinWeekIndex(day: number) {
  return Math.min(3, Math.floor((Math.min(day, 28) - 1) / 7));
}

export function getCheckinWeekDays(weekIndex: number) {
  const start = weekIndex * 7 + 1;
  return Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= 28);
}

export function getCheckinMobilePageIndex(day: number) {
  return Math.min(6, Math.floor((Math.min(day, 28) - 1) / 4));
}

export function getCheckinMobilePageDays(pageIndex: number) {
  const start = pageIndex * 4 + 1;
  return Array.from({ length: 4 }, (_, i) => start + i).filter((d) => d <= 28);
}

export function isCheckinMilestoneDay(day: number) {
  return day === 7 || day === 14 || day === 21 || day === 28;
}

export function formatCheckinReward(reward: CheckinDailyReward | undefined) {
  if (!reward) return null;
  if (reward.reward_type === 'role') return 'Role';
  return `${formatNumber(reward.reward_amount ?? 0)} ${REWARD_TYPE_LABELS[reward.reward_type]}`;
}

export function formatSelectedDayRewardDetail(reward: CheckinDailyReward | undefined) {
  if (!reward) return null;
  const amount = formatNumber(reward.reward_amount ?? 0);
  switch (reward.reward_type) {
    case 'points':
      return `สตรอว์เบอร์รี ${amount} แต้ม`;
    case 'ticket_piece_point':
      return `เศษตั๋วสุ่ม ${amount} ตั๋ว`;
    case 'ticket_point':
      return `ตั๋วสุ่ม ${amount} ตั๋ว`;
    case 'role':
      return `บทบาท ${reward.role_name ?? reward.role_id ?? 'Role'}`;
    default:
      return null;
  }
}

export function formatSelectedDayRewardTitle(reward: CheckinDailyReward | undefined) {
  if (!reward) return 'รางวัล';
  const amount = formatNumber(reward.reward_amount ?? 0);
  switch (reward.reward_type) {
    case 'points':
      return `รางวัล สตรอว์เบอร์รี ${amount} แต้ม`;
    case 'ticket_piece_point':
      return `รางวัล เศษตั๋วสุ่ม ${amount} ตั๋ว`;
    case 'ticket_point':
      return `รางวัล ตั๋วสุ่ม ${amount} ตั๋ว`;
    case 'role':
      return `รางวัล บทบาท ${reward.role_name ?? reward.role_id ?? 'Role'}`;
    default:
      return 'รางวัล';
  }
}

export function formatBigRewardDetail(
  bigReward: CheckinBigReward | null | undefined,
  roleName?: string | null,
) {
  if (!bigReward) return null;
  if (bigReward.reward_type === 'role') {
    return `บทบาท ${roleName ?? bigReward.role_id ?? 'Role'}`;
  }
  const amount = formatNumber(bigReward.reward_amount ?? 0);
  switch (bigReward.reward_type) {
    case 'points':
      return `สตรอว์เบอร์รี ${amount} แต้ม`;
    case 'ticket_piece_point':
      return `เศษตั๋วสุ่ม ${amount} ตั๋ว`;
    case 'ticket_point':
      return `ตั๋วสุ่ม ${amount} ตั๋ว`;
    default:
      return null;
  }
}

export function formatSelectedDayRewardSubtitle(
  state: CheckinDayState,
  selectedDay: number,
  todayDay: number,
) {
  switch (state) {
    case 'today':
      return 'รางวัลพิเศษสำหรับการเช็กอินวันนี้';
    case 'future': {
      const daysUntil = selectedDay - todayDay;
      return `รางวัลพิเศษนี้จะได้รับในอีก ${daysUntil} วัน อย่าลืมมาเช็กอินน้า`;
    }
    case 'completed':
      return 'รับรางวัลวันนี้เรียบร้อยแล้ว ขอบคุณที่มาเช็กอินทุกวันนะ!';
    case 'missed':
      return 'พลาดการเช็กอินวันนี้ไปแล้ว รอบนี้ไม่สามารถเติมย้อนหลังได้';
    case 'makeup':
      return 'ยังเติมเช็กอินวันนี้ได้อยู่ ใช้แต้มเพื่อรับรางวัลที่พลาดไปนะ';
    default:
      return 'รางวัลพิเศษสำหรับการเช็กอินวันนี้';
  }
}

export type CheckinDayState = 'completed' | 'today' | 'missed' | 'future' | 'makeup';

/** Rolling makeup window size (days back from today). */
export const MAKEUP_WINDOW_DAYS = 10;

/**
 * Whether the rolling makeup window applies for this cycle.
 * Unlimited same-month makeup until Aug 2026; limited from Sep 2026 onward.
 */
export function isMakeupWindowLimited(year: number, month: number): boolean {
  return year > 2026 || (year === 2026 && month >= 9);
}

export function getCheckinDayState(
  day: number,
  completedDays: Set<number>,
  todayDay: number,
  makeupWindowOpen: boolean,
  windowLimited = false,
  /** When false, past days that would be makeup become missed (quota exhausted). */
  quotaAvailable = true,
): CheckinDayState {
  if (completedDays.has(day)) return 'completed';
  if (day === todayDay && todayDay <= 28) return 'today';
  if (day < todayDay || (todayDay > 28 && day <= 28)) {
    const inWindow = !windowLimited || todayDay - day <= MAKEUP_WINDOW_DAYS;
    return makeupWindowOpen && inWindow && quotaAvailable ? 'makeup' : 'missed';
  }
  return 'future';
}

/** Claim button label based on day state and action progress. */
export function getCheckinClaimButtonLabel(
  acting: boolean,
  selectedCheckedIn: boolean,
  selectedDay: number,
  selectedState: CheckinDayState,
): string {
  if (acting) return '';
  if (selectedCheckedIn) return 'รับรางวัลแล้ว';
  if (selectedDay > 28) return 'หมดรอบเช็กอิน';
  if (selectedState === 'makeup') return 'เติมเช็กอิน';
  if (selectedState === 'future') return 'ยังรับรางวัลไม่ได้';
  if (selectedState === 'missed') return 'พลาดเช็กอินแล้ว';
  return 'รับรางวัลวันนี้';
}

export const CHECKIN_ERROR_MESSAGES: Record<string, string> = {
  missing_discord_id: 'ไม่พบข้อมูล Discord',
  missing_auth: 'กรุณาเข้าสู่ระบบก่อน',
  invalid_token: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  forbidden: 'ไม่มีสิทธิ์ดำเนินการ',
  already_checked_in: 'เช็กอินวันนี้แล้ว',
  reward_not_configured: 'ยังไม่มีรางวัลสำหรับวันนี้',
  day_mismatch: 'ไม่สามารถเช็กอินวันนี้ได้',
  insufficient_points: 'แต้มไม่พอสำหรับเติมเช็กอิน',
  makeup_window_not_open: 'ยังไม่ถึงช่วงเติมเช็กอิน',
  makeup_day_not_past: 'ยังเติมเช็กอินวันนี้ไม่ได้',
  makeup_day_too_old: 'เกินช่วงเติมย้อนหลังแล้ว (ย้อนหลังได้ไม่เกิน 10 วัน)',
  makeup_quota_exceeded: 'เติมเช็กอินครบจำนวนครั้งแล้ว',
  makeup_window_expired: 'หมดเวลาเติมเช็กอินแล้ว',
  day_already_filled: 'วันนี้เช็กอินแล้ว',
  cycle_not_found: 'ไม่พบข้อมูลรอบเช็กอิน',
};
