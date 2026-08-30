import { describe, expect, it } from 'vitest';
import {
  CHECKIN_ERROR_MESSAGES,
  getCheckinDayState,
  isMakeupWindowLimited,
  MAKEUP_WINDOW_DAYS,
} from './checkin';

describe('isMakeupWindowLimited', () => {
  it('is false before September 2026', () => {
    expect(isMakeupWindowLimited(2026, 8)).toBe(false);
    expect(isMakeupWindowLimited(2025, 12)).toBe(false);
  });

  it('is true from September 2026 onward', () => {
    expect(isMakeupWindowLimited(2026, 9)).toBe(true);
    expect(isMakeupWindowLimited(2026, 12)).toBe(true);
    expect(isMakeupWindowLimited(2027, 1)).toBe(true);
  });
});

describe('getCheckinDayState makeup window', () => {
  const empty = new Set<number>();
  const todayDay = 20;

  it('marks day exactly MAKEUP_WINDOW_DAYS back as makeup when limited', () => {
    expect(
      getCheckinDayState(todayDay - MAKEUP_WINDOW_DAYS, empty, todayDay, true, true),
    ).toBe('makeup');
  });

  it('marks day older than MAKEUP_WINDOW_DAYS as missed when limited', () => {
    expect(
      getCheckinDayState(todayDay - MAKEUP_WINDOW_DAYS - 1, empty, todayDay, true, true),
    ).toBe('missed');
  });

  it('keeps unlimited makeup when windowLimited is false', () => {
    expect(getCheckinDayState(1, empty, todayDay, true, false)).toBe('makeup');
    expect(getCheckinDayState(1, empty, todayDay, true)).toBe('makeup');
  });

  it('treats past days as missed when makeup window is closed', () => {
    expect(getCheckinDayState(15, empty, todayDay, false, true)).toBe('missed');
  });

  it('after day 28, past days within window are makeup when limited', () => {
    // todayDay > 28 means cycle days 1–28 are all past
    expect(getCheckinDayState(25, empty, 30, true, true)).toBe('makeup'); // 30 - 25 = 5 <= 10
    expect(getCheckinDayState(19, empty, 30, true, true)).toBe('missed'); // 30 - 19 = 11 > 10
  });

  it('still returns today / completed / future correctly', () => {
    expect(getCheckinDayState(20, empty, 20, true, true)).toBe('today');
    expect(getCheckinDayState(20, new Set([20]), 20, true, true)).toBe('completed');
    expect(getCheckinDayState(21, empty, 20, true, true)).toBe('future');
  });
});

describe('CHECKIN_ERROR_MESSAGES', () => {
  it('includes makeup_day_too_old', () => {
    expect(CHECKIN_ERROR_MESSAGES.makeup_day_too_old).toMatch(/10/);
  });
});
