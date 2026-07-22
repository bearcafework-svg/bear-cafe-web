import { describe, it, expect } from 'vitest';
import type { CheckinCycle, CheckinStatus } from '@/lib/checkin';
import {
  checkinPublicStatusQueryKey,
  checkinStatusQueryKey,
  needsCheckinStatusReconcile,
  patchCheckinStatusCycle,
} from '@/lib/checkin-status-cache';

describe('checkin status query keys', () => {
  it('returns auth key as [checkin-status, discordId]', () => {
    expect(checkinStatusQueryKey('user-1')).toEqual(['checkin-status', 'user-1']);
  });

  it('returns public key as [checkin-status, public]', () => {
    expect(checkinPublicStatusQueryKey()).toEqual(['checkin-status', 'public']);
  });
});

/** Fixtures for planned hybrid patch merge (FE Design Doc § Patch merge function). */
function makePrevStatus(overrides?: Partial<CheckinStatus>): CheckinStatus {
  return {
    daily_rewards: [
      {
        day_number: 1,
        reward_type: 'points',
        reward_amount: 10,
        role_id: null,
        makeup_cost: 5,
        is_active: true,
      },
    ],
    big_reward: {
      reward_type: 'role',
      reward_amount: null,
      role_id: 'role-big',
      description: 'Big reward',
    },
    makeup_window_open: true,
    cycle: {
      year: 2026,
      month: 7,
      completed_days: [1],
      makeup_days: [],
      big_reward_claimed: false,
    },
    ...overrides,
  };
}

const patchedCycle: CheckinCycle = {
  year: 2026,
  month: 7,
  completed_days: [1, 2],
  makeup_days: [3],
  big_reward_claimed: true,
};

describe('patchCheckinStatusCycle', () => {
  it('returns undefined when prev is undefined (no dead/incomplete cache entry)', () => {
    expect(patchCheckinStatusCycle(undefined, patchedCycle)).toBeUndefined();
  });

  it('preserves sibling fields and replaces only cycle fields from the patch', () => {
    const prev = makePrevStatus();
    const next = patchCheckinStatusCycle(prev, patchedCycle);

    expect(next).toBeDefined();
    expect(next!.daily_rewards).toEqual(prev.daily_rewards);
    expect(next!.big_reward).toEqual(prev.big_reward);
    expect(next!.makeup_window_open).toBe(prev.makeup_window_open);
    expect(next!.cycle).toEqual({
      year: patchedCycle.year,
      month: patchedCycle.month,
      completed_days: patchedCycle.completed_days,
      makeup_days: patchedCycle.makeup_days,
      big_reward_claimed: patchedCycle.big_reward_claimed,
    });
    // Siblings must not be taken from the cycle argument (cycle-only merge).
    expect(next!.daily_rewards).not.toBeUndefined();
    expect(next!.cycle.completed_days).not.toEqual(prev.cycle.completed_days);
  });
});

describe('needsCheckinStatusReconcile', () => {
  it('returns true when big_reward_granted === true (trigger A)', () => {
    expect(needsCheckinStatusReconcile({ big_reward_granted: true })).toBe(true);
  });

  it('returns true when reward has role_grant_error (trigger B)', () => {
    expect(
      needsCheckinStatusReconcile({
        reward: { role_grant_error: 'discord_failed' },
      }),
    ).toBe(true);
  });

  it('returns false when neither MVP trigger is present (exclusivity C)', () => {
    expect(needsCheckinStatusReconcile({})).toBe(false);
    expect(needsCheckinStatusReconcile({ big_reward_granted: false })).toBe(false);
    expect(needsCheckinStatusReconcile({ reward: { reward_type: 'points' } })).toBe(false);
  });

  it('returns false for unrelated reward fields (gate exclusivity)', () => {
    expect(
      needsCheckinStatusReconcile({
        big_reward_granted: false,
        reward: { points_awarded: 10 },
      }),
    ).toBe(false);
  });
});
