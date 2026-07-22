/**
 * Smoke coverage for FE2E Arrange fixtures (T0.3).
 * Does not mount UI or implement FE2E journeys — only proves payload variants exist.
 */
import { describe, it, expect } from 'vitest';
import {
  authSessionAbsent,
  authSessionPresent,
  fixtureDiscordId,
  guestPublicCheckinStatus,
  happyPathClaimOk,
  happyPathMakeupOk,
  mvpControlClaimOk,
  mvpFixtureABigRewardGranted,
  mvpFixtureBRoleGrantError,
  memberCheckinStatusBeforeClaim,
} from './checkin-flow-optimization';
import {
  AUTH_EDGE_FUNCTIONS,
  createCheckinInvokeRouter,
} from './checkin-invoke-mock';

describe('checkin-flow-optimization fixtures (FE2E Arrange)', () => {
  it('exports happy-path claim/makeup with BE-aligned cycle fields and no MVP flags', () => {
    expect(happyPathClaimOk.ok).toBe(true);
    expect(happyPathClaimOk.cycle).toMatchObject({
      year: expect.any(Number),
      month: expect.any(Number),
      completed_days: expect.any(Array),
      makeup_days: expect.any(Array),
      big_reward_claimed: expect.any(Boolean),
    });
    expect(happyPathClaimOk.big_reward_granted).toBeFalsy();
    expect(happyPathClaimOk.reward).not.toHaveProperty('role_grant_error');

    expect(happyPathMakeupOk.ok).toBe(true);
    expect(happyPathMakeupOk.cycle.makeup_days.length).toBeGreaterThan(0);
    expect(happyPathMakeupOk.points_spent).toEqual(expect.any(Number));
    expect(happyPathMakeupOk.big_reward_granted).toBeFalsy();
    expect(happyPathMakeupOk.reward).not.toHaveProperty('role_grant_error');
  });

  it('exports MVP A/B plus control exclusivity variants', () => {
    expect(mvpFixtureABigRewardGranted.big_reward_granted).toBe(true);
    expect(mvpFixtureBRoleGrantError.reward).toHaveProperty('role_grant_error');
    expect(mvpFixtureBRoleGrantError.big_reward_granted).toBeFalsy();

    expect(mvpControlClaimOk.big_reward_granted).toBeFalsy();
    expect(mvpControlClaimOk.reward).not.toHaveProperty('role_grant_error');
    expect(mvpControlClaimOk.cycle.completed_days).toEqual(
      happyPathClaimOk.cycle.completed_days,
    );
  });

  it('exports guest public rewards and auth present/absent sessions', () => {
    expect(authSessionPresent.discordId).toBe(fixtureDiscordId);
    expect(authSessionPresent.session?.access_token).toBeTruthy();
    expect(authSessionPresent.user?.discord_id).toBe(fixtureDiscordId);

    expect(authSessionAbsent.discordId).toBeUndefined();
    expect(authSessionAbsent.session).toBeNull();
    expect(authSessionAbsent.user).toBeNull();

    expect(guestPublicCheckinStatus.daily_rewards.length).toBeGreaterThan(0);
    expect(guestPublicCheckinStatus.big_reward).not.toBeNull();
    expect(guestPublicCheckinStatus.cycle.completed_days).toEqual([]);
  });

  it('member status seed includes siblings needed for hybrid patch Arrange', () => {
    expect(memberCheckinStatusBeforeClaim.daily_rewards.length).toBeGreaterThan(0);
    expect(memberCheckinStatusBeforeClaim.big_reward).not.toBeNull();
    expect(memberCheckinStatusBeforeClaim.makeup_window_open).toBe(true);
    expect(memberCheckinStatusBeforeClaim.cycle.completed_days).not.toContain(
      happyPathClaimOk.cycle.completed_days.at(-1),
    );
  });
});

describe('createCheckinInvokeRouter (mock boundary)', () => {
  it('routes by function name and counts get-checkin-status vs action invokes', async () => {
    const router = createCheckinInvokeRouter({
      getCheckinStatus: () => ({
        ok: true,
        ...memberCheckinStatusBeforeClaim,
      }),
      performCheckin: () => happyPathClaimOk,
      performMakeupCheckin: () => happyPathMakeupOk,
    });

    await router.invoke('get-checkin-status', {
      body: { discord_id: fixtureDiscordId },
    });
    await router.invoke('perform-checkin', {
      body: { discord_id: fixtureDiscordId, day_number: 2 },
    });
    await router.invoke('perform-makeup-checkin', {
      body: { discord_id: fixtureDiscordId, day_number: 1, year: 2026, month: 7 },
    });

    expect(router.countCalls('get-checkin-status')).toBe(1);
    expect(router.countCalls('perform-checkin')).toBe(1);
    expect(router.countCalls('perform-makeup-checkin')).toBe(1);
    expect(AUTH_EDGE_FUNCTIONS).toEqual(
      expect.arrayContaining([
        'get-checkin-status',
        'perform-checkin',
        'perform-makeup-checkin',
      ]),
    );
  });

  it('returns unmocked error for unknown functions without inventing auth status', async () => {
    const router = createCheckinInvokeRouter({});
    const result = await router.invoke('not-a-checkin-fn');
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
    expect(router.countCalls('get-checkin-status')).toBe(0);
  });
});
