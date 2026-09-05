import { describe, expect, it } from 'vitest';
import {
  CHECKIN_ERROR_MESSAGES,
  DEFAULT_CHECKIN_MAKEUP_MAX,
  getCheckinDayState,
  isMakeupWindowLimited,
  MAKEUP_WINDOW_DAYS,
  parseCheckinMakeupMax,
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

  it('marks in-window day as missed when quota is exhausted', () => {
    expect(
      getCheckinDayState(todayDay - 3, empty, todayDay, true, true, false),
    ).toBe('missed');
  });

  it('keeps in-window day as makeup when quota remains', () => {
    expect(
      getCheckinDayState(todayDay - 3, empty, todayDay, true, true, true),
    ).toBe('makeup');
  });
});

describe('parseCheckinMakeupMax', () => {
  it('parses { days: N } and clamps to 0–28', () => {
    expect(parseCheckinMakeupMax({ days: 3 })).toBe(3);
    expect(parseCheckinMakeupMax({ days: 0 })).toBe(0);
    expect(parseCheckinMakeupMax({ days: 28 })).toBe(28);
    expect(parseCheckinMakeupMax({ days: 99 })).toBe(28);
    expect(parseCheckinMakeupMax({ days: -1 })).toBe(0);
  });

  it('falls back to 3 for invalid values', () => {
    expect(parseCheckinMakeupMax(undefined)).toBe(DEFAULT_CHECKIN_MAKEUP_MAX);
    expect(parseCheckinMakeupMax(null)).toBe(DEFAULT_CHECKIN_MAKEUP_MAX);
    expect(parseCheckinMakeupMax({})).toBe(DEFAULT_CHECKIN_MAKEUP_MAX);
    expect(parseCheckinMakeupMax('x')).toBe(DEFAULT_CHECKIN_MAKEUP_MAX);
  });
});

describe('CHECKIN_ERROR_MESSAGES', () => {
  it('includes makeup_day_too_old', () => {
    expect(CHECKIN_ERROR_MESSAGES.makeup_day_too_old).toMatch(/10/);
  });

  it('includes makeup_quota_exceeded', () => {
    expect(CHECKIN_ERROR_MESSAGES.makeup_quota_exceeded).toMatch(/ครบ/);
  });
});
