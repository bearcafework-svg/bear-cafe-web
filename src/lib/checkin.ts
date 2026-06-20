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
}

export const CHECKIN_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const REWARD_TYPE_LABELS: Record<CheckinRewardType, string> = {
  points: 'แต้ม',
  ticket_point: 'แต้มตั๋ว',
  ticket_piece_point: 'แต้มชิ้นตั๋ว',
  role: 'Role',
};

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

export function getCheckinWeekIndex(day: number) {
  return Math.min(3, Math.floor((Math.min(day, 28) - 1) / 7));
}

export function getCheckinWeekDays(weekIndex: number) {
  const start = weekIndex * 7 + 1;
  return Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= 28);
}

export function isCheckinMilestoneDay(day: number) {
  return day === 7 || day === 14 || day === 21 || day === 28;
}

export function formatCheckinReward(reward: CheckinDailyReward | undefined) {
  if (!reward) return null;
  if (reward.reward_type === 'role') return 'Role';
  return `${reward.reward_amount ?? 0} ${REWARD_TYPE_LABELS[reward.reward_type]}`;
}

export function formatSelectedDayRewardDetail(reward: CheckinDailyReward | undefined) {
  if (!reward) return null;
  const amount = reward.reward_amount ?? 0;
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
  const amount = reward.reward_amount ?? 0;
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

export function formatSelectedDayRewardSubtitle(
  state: CheckinDayState,
  selectedDay: number,
  todayDay: number,
) {
  switch (state) {
    case 'today':
      return 'รางวัลพิเศษสำหรับการเช็คอินวันนี้';
    case 'future': {
      const daysUntil = selectedDay - todayDay;
      return `รางวัลพิเศษนี้จะได้รับในอีก ${daysUntil} วัน อย่าลืมมาเช็คอินน้า`;
    }
    case 'completed':
      return 'รับรางวัลวันนี้เรียบร้อยแล้ว ขอบคุณที่มาเช็คอินทุกวันนะ!';
    case 'missed':
      return 'พลาดการเช็คอินวันนี้ไปแล้ว รอบนี้ไม่สามารถเติมย้อนหลังได้';
    case 'makeup':
      return 'ยังเติมเช็คอินวันนี้ได้อยู่ ใช้แต้มเพื่อรับรางวัลที่พลาดไปนะ';
    default:
      return 'รางวัลพิเศษสำหรับการเช็คอินวันนี้';
  }
}

export type CheckinDayState = 'completed' | 'today' | 'missed' | 'future' | 'makeup';

export function getCheckinDayState(
  day: number,
  completedDays: Set<number>,
  todayDay: number,
  makeupWindowOpen: boolean,
): CheckinDayState {
  if (completedDays.has(day)) return 'completed';
  if (day === todayDay && todayDay <= 28) return 'today';
  if (day < todayDay || (todayDay > 28 && day <= 28)) {
    return makeupWindowOpen ? 'makeup' : 'missed';
  }
  return 'future';
}

export const CHECKIN_ERROR_MESSAGES: Record<string, string> = {
  missing_discord_id: 'ไม่พบข้อมูล Discord',
  missing_auth: 'กรุณาเข้าสู่ระบบก่อน',
  invalid_token: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  forbidden: 'ไม่มีสิทธิ์ดำเนินการ',
  already_checked_in: 'เช็คอินวันนี้แล้ว',
  reward_not_configured: 'ยังไม่มีรางวัลสำหรับวันนี้',
  day_mismatch: 'ไม่สามารถเช็คอินวันนี้ได้',
  insufficient_points: 'แต้มไม่พอสำหรับเติมเช็คอิน',
  makeup_window_not_open: 'ยังไม่ถึงช่วงเติมเช็คอิน',
  makeup_window_expired: 'หมดเวลาเติมเช็คอินแล้ว',
  day_already_filled: 'วันนี้เช็คอินแล้ว',
  cycle_not_found: 'ไม่พบข้อมูลรอบเช็คอิน',
};
