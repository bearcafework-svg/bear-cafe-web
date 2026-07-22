// Check-in Flow Optimization integration Test
// Design Doc: checkin-flow-optimization-frontend-design.md (+ backend contracts via hybrid patch)
// UI Spec: checkin-flow-optimization-delta-ui-spec.md
// Generated: 2026-07-22 | Budget Used: integration 3/3, fixture-e2e (see sibling), service-e2e (see sibling)
// Harness: Vitest + RTL + vi.mock on supabase.functions.invoke (project convention; MSW optional)
// @real-dependency: QueryClient / React Query cache (Do NOT mock QueryClient — FE Design Doc Test Boundaries)
//
// ---------------------------------------------------------------------------
// INT-1 Happy-path claim hybrid patch — 0 get-checkin-status  [IMPLEMENTED]
// ---------------------------------------------------------------------------
// AC-FE-004: "When today’s claim succeeds with `cycle` in the action response and no MVP reconcile trigger, the system shall patch shared status `cycle`, update day cards + big-reward progress, open `CheckinRewardModal`, and shall not await `get-checkin-status`."
// AC-FE-005 (boundary / same invokeAction path): "When makeup succeeds with `cycle` and no MVP trigger, the system shall patch shared status, open makeup success UI, and shall not await full status refetch."
// AC-FE-014: "While a claim/makeup request is in flight, `acting` shall cover action RTT only (not a follow-up status round-trip on the happy path)."
// AC-BE-004 / AC-BE-005 (contract consumed): action success returns patchable `cycle` (+ makeup points fields).
// ROI: 90 (BV:9 × Freq:9 + Legal:0 + Defect:9)
// Behavior: Member claims today (or confirms makeup) → action ok+cycle → shared RQ cycle patched → day/progress/modal update → 0 get-checkin-status invokes
// @category: core-functionality
// @lane: integration
// @dependency: useCheckin, useCheckinFlow, patchCheckinStatusCycle, checkinStatusQueryKey, QueryClient (real), supabase.functions.invoke (mocked)
// @complexity: high
// @mock-boundary: supabase.functions.invoke (Yes); QueryClient (No / real); invalidateBalances (spy)
// Primary failure mode: happy-path claim/makeup still awaits refresh()/get-checkin-status, or cycle is not patched into shared cache so day stays incomplete
// Proof obligation: After ok action fixture WITHOUT big_reward_granted and WITHOUT reward.role_grant_error, assert (1) spy count for get-checkin-status === 0 attributable to the action, (2) RQ cache at checkinStatusQueryKey(discordId) has updated completed_days/makeup_days from action cycle, (3) sibling fields daily_rewards / big_reward / makeup_window_open preserved from pre-action cache, (4) acting clears in finally without waiting on status. Boundary path: run the same assertions for perform-makeup-checkin success (AC-FE-005) so makeup cannot regress while claim stays green.
// Verification points:
// - perform-checkin (and perform-makeup-checkin) mocked success includes cycle { year, month, completed_days, makeup_days, big_reward_claimed }
// - get-checkin-status invoke count after action === 0
// - setQueryData / cache cycle matches action cycle; siblings unchanged
// - invalidateBalances called once on success (AC-FE-010 related spy)
// Expected results: Day set reflects action cycle; no status network; balances invalidated
// Pass criteria: All verification points hold for claim and makeup happy-path fixtures
//
// ---------------------------------------------------------------------------
// INT-2 Shared RQ status identity — Home + Full Calendar dual mount  [IMPLEMENTED]
// ---------------------------------------------------------------------------
// AC-FE-009: "When status is patched or reconciled, both DailyCheckinCard and FullCheckInCalendar shall observe the same authoritative status for that discord_id."
// AC-FE-008 (in-process proof of shared key; navigation warm-cache reserved for fixture-e2e): shared key identity enables warm Home ↔ Calendar
// ROI: 64 (BV:8 × Freq:7 + Legal:0 + Defect:8)
// Behavior: Patch (or seed) status under checkinStatusQueryKey(discordId) → both surfaces reading useCheckinFlow/useCheckin see identical cycle day sets
// @category: integration
// @lane: integration
// @dependency: checkinStatusQueryKey, useCheckin / useCheckinFlow, DailyCheckinCard, FullCheckInCalendar (or dual hook mounts), QueryClient (real)
// @complexity: medium
// @mock-boundary: supabase.functions.invoke / status queryFn (Yes for deterministic seed); QueryClient (No / real)
// Primary failure mode: dual useState / separate query keys so a patch on one surface is invisible to the other
// Proof obligation: Mount two consumers under one QueryClient; apply patchCheckinStatusCycle (or setQueryData) once; assert both observe the same completed_days/makeup_days. Boundary path: if one mount still used a local-only status fork, this test must fail even when a single-mount claim test stays green.
// Verification points:
// - Both mounts resolve status from ['checkin-status', discordId]
// - After patch, completed_days equal on both
// - No second cold get-checkin-status required for the second mount to see the patch (within staleTime / seeded cache)
// Expected results: Single authoritative CheckinStatus per discord_id across surfaces
// Pass criteria: Dual-mount assertions pass with one QueryClient
//
// ---------------------------------------------------------------------------
// INT-3 MVP reconcile gates only — big_reward_granted / role_grant_error  [IMPLEMENTED]
// ---------------------------------------------------------------------------
// AC-FE-006: "When action success indicates big_reward_granted === true or role_grant_error on reward, the system shall show success UI first (modal/toast), then require a non-blocking targeted reconcile that includes get-checkin-status; happy path without those flags must not await status."
// AC-BE-006 / AC-BE-007 / AC-BE-010 (flags contract + no new triggers): role_grant_error nested under reward; big_reward_granted boolean; no extra MVP trigger keys
// UI Spec FB-BIG-REWARD / FB-ROLE-GRANT-ERR
// ROI: 63 (BV:9 × Freq:6 + Legal:0 + Defect:9)
// Behavior: Action ok with MVP flag → success modal/toast scheduled → refetchQueries(checkinStatusQueryKey) → ≥1 get-checkin-status; without flags → 0 status calls
// @category: core-functionality
// @lane: integration
// @dependency: needsCheckinStatusReconcile, useCheckinFlow.handleActionResult, queryClient.refetchQueries, supabase.functions.invoke (mocked)
// @complexity: high
// @mock-boundary: supabase.functions.invoke (Yes); QueryClient (No / real)
// Primary failure mode: flags remain toast-only after removing await refresh (no get-checkin-status), OR happy path incorrectly always reconciles
// Proof obligation: (A) Fixture with big_reward_granted true → ≥1 get-checkin-status via refetchQueries (not invalidateQueries-only); success UI path not blocked on reconcile Promise. (B) Fixture with reward.role_grant_error present → same ≥1 status call. (C) Fixture without either flag → 0 status calls (boundary: proves gate is exclusive). Use needsCheckinStatusReconcile normalization matching edge nesting.
// Verification points:
// - needsCheckinStatusReconcile true only for the two MVP triggers
// - On true: spy get-checkin-status ≥ 1 after success handling
// - On false: spy get-checkin-status === 0 after success handling
// - Success modal/toast path invoked without awaiting reconcile completion
// Expected results: Reconcile network iff MVP flags; success UI first
// Pass criteria: A/B/C fixtures all pass

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import {
  checkinStatusQueryKey,
  needsCheckinStatusReconcile,
  patchCheckinStatusCycle,
} from '@/lib/checkin-status-cache';
import { getCheckinToday, type CheckinDailyReward, type CheckinStatus } from '@/lib/checkin';
import {
  FIXTURE_CLAIM_DAY,
  FIXTURE_MAKEUP_DAY,
  buildCheckinCycle,
  buildCheckinStatus,
  buildPointsReward,
  fixtureDiscordId,
  happyPathClaimOk,
  happyPathMakeupOk,
  memberCheckinStatusBeforeClaim,
  mvpControlClaimOk,
  mvpFixtureABigRewardGranted,
  mvpFixtureBRoleGrantError,
} from '../../tests/e2e/fixtures/checkin-flow-optimization';
import { createCheckinInvokeRouter } from '../../tests/e2e/fixtures/checkin-invoke-mock';

const mockGetSession = vi.fn();
const mockInvalidateBalances = vi.fn();
const invokeRouter = createCheckinInvokeRouter();

/** When set, delays perform-* invoke resolution so `acting` can be observed mid-flight. */
let actionInvokeGate: Promise<void> | null = null;
/**
 * When set (and armed after a perform-* success), delays get-checkin-status so INT-3
 * can prove success UI is not blocked on reconcile.
 */
let reconcileInvokeGate: Promise<void> | null = null;
let postActionReconcileGateArmed = false;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    functions: {
      invoke: async (
        fn: string,
        options?: { body?: Record<string, unknown>; headers?: Record<string, string> },
      ) => {
        if (
          actionInvokeGate &&
          (fn === 'perform-checkin' || fn === 'perform-makeup-checkin')
        ) {
          await actionInvokeGate;
        }
        const resultPromise = invokeRouter.invoke(fn, options);
        if (fn === 'perform-checkin' || fn === 'perform-makeup-checkin') {
          // Arm after action invoke starts so the subsequent reconcile status call is gated
          const result = await resultPromise;
          postActionReconcileGateArmed = true;
          return result;
        }
        if (
          reconcileInvokeGate &&
          postActionReconcileGateArmed &&
          fn === 'get-checkin-status'
        ) {
          // Count the call immediately; delay resolution so success UI can settle first
          const pending = resultPromise;
          await reconcileInvokeGate;
          return pending;
        }
        return resultPromise;
      },
    },
    from: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('@/hooks/useUserBalances', () => ({
  useInvalidateUserBalances: () => mockInvalidateBalances,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';
import { useCheckinFlow } from './useCheckinFlow';

const { year, month } = getCheckinToday();

/** Align T0.3 fixtures to Bangkok "today" period so makeup body year/month match. */
function statusSeedForToday(): CheckinStatus {
  return buildCheckinStatus({
    ...memberCheckinStatusBeforeClaim,
    cycle: buildCheckinCycle({
      year,
      month,
      completed_days: [],
      makeup_days: [],
      big_reward_claimed: false,
    }),
  });
}

function statusOkPayload(status: CheckinStatus) {
  return { ok: true as const, ...status };
}

function claimOkAligned() {
  return {
    ...happyPathClaimOk,
    cycle: buildCheckinCycle({
      year,
      month,
      completed_days: [FIXTURE_CLAIM_DAY],
      makeup_days: [],
      big_reward_claimed: false,
    }),
  };
}

function makeupOkAligned() {
  return {
    ...happyPathMakeupOk,
    cycle: buildCheckinCycle({
      year,
      month,
      completed_days: [],
      makeup_days: [FIXTURE_MAKEUP_DAY],
      big_reward_claimed: false,
    }),
  };
}

/** INT-3 Fixture A — big_reward_granted (aligned to Bangkok period). */
function claimOkBigRewardGrantedAligned() {
  return {
    ...mvpFixtureABigRewardGranted,
    cycle: buildCheckinCycle({
      ...mvpFixtureABigRewardGranted.cycle,
      year,
      month,
    }),
  };
}

/** INT-3 Fixture B — reward.role_grant_error (aligned to Bangkok period). */
function claimOkRoleGrantErrorAligned() {
  return {
    ...mvpFixtureBRoleGrantError,
    cycle: buildCheckinCycle({
      ...mvpFixtureBRoleGrantError.cycle,
      year,
      month,
    }),
  };
}

/** INT-3 Fixture C / control — neither MVP flag. */
function claimOkControlAligned() {
  return {
    ...mvpControlClaimOk,
    cycle: claimOkAligned().cycle,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, children),
    );
  }
  return { queryClient, Wrapper };
}

function rewardForDay(status: CheckinStatus, day: number): CheckinDailyReward | undefined {
  return status.daily_rewards.find((r) => r.day_number === day);
}

function wireHappyPathRouter(opts: {
  status: CheckinStatus;
  claimOk?:
    | ReturnType<typeof claimOkAligned>
    | ReturnType<typeof claimOkBigRewardGrantedAligned>
    | ReturnType<typeof claimOkRoleGrantErrorAligned>
    | ReturnType<typeof claimOkControlAligned>;
  makeupOk?: ReturnType<typeof makeupOkAligned>;
}) {
  invokeRouter.setHandlers({
    getCheckinStatus: () => statusOkPayload(opts.status),
    performCheckin: () => opts.claimOk ?? claimOkAligned(),
    performMakeupCheckin: () => opts.makeupOk ?? makeupOkAligned(),
    other: (fn) => {
      if (fn === 'get-role-info') {
        return {
          name: 'Fixture Role',
          icon: null,
          unicode_emoji: null,
        };
      }
      return { ok: false, error: `unmocked:${fn}` };
    },
  });
}

describe('INT-1 Happy-path claim hybrid patch — 0 get-checkin-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeRouter.reset();
    actionInvokeGate = null;
    reconcileInvokeGate = null;
    postActionReconcileGateArmed = false;
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'fixture-access-token' } },
    });
  });

  it('claim: 0 get-checkin-status after success; cache cycle patched; siblings preserved; acting clears; invalidateBalances', async () => {
    const status = statusSeedForToday();
    const expectedCycle = claimOkAligned().cycle;
    const claimDay = FIXTURE_CLAIM_DAY;
    const selectedReward = rewardForDay(status, claimDay) ?? {
      day_number: claimDay,
      reward_type: 'points' as const,
      reward_amount: 20,
      role_id: null,
      makeup_cost: 5,
      is_active: true,
    };

    let releaseAction: () => void;
    actionInvokeGate = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });

    wireHappyPathRouter({
      status,
      claimOk: claimOkAligned(),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const preCache = queryClient.getQueryData<CheckinStatus>(
      checkinStatusQueryKey(fixtureDiscordId),
    );
    expect(preCache).toBeDefined();
    const preSiblings = {
      daily_rewards: preCache!.daily_rewards,
      big_reward: preCache!.big_reward,
      makeup_window_open: preCache!.makeup_window_open,
    };
    // Output Comparison baseline: prior post-refresh would have carried these siblings + empty completed set
    expect(preCache!.cycle.completed_days).toEqual([]);
    expect(result.current.completedDays.has(claimDay)).toBe(false);

    const statusCallsAfterLoad = invokeRouter.countCalls('get-checkin-status');

    let claimSettled = false;
    const claimPromise = result.current
      .handleClaimSelected(claimDay, 'today', selectedReward)
      .then(() => {
        claimSettled = true;
      });

    await waitFor(() => expect(result.current.acting).toBe(true));
    // No day complete before ok:true + cycle patch
    expect(result.current.completedDays.has(claimDay)).toBe(false);
    expect(
      queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey(fixtureDiscordId))?.cycle
        .completed_days,
    ).toEqual([]);

    await act(async () => {
      releaseAction!();
      await claimPromise;
    });

    expect(claimSettled).toBe(true);
    await waitFor(() => expect(result.current.acting).toBe(false));

    // (1) 0 get-checkin-status attributable to the action
    expect(invokeRouter.countCalls('get-checkin-status')).toBe(statusCallsAfterLoad);
    expect(invokeRouter.countCalls('perform-checkin')).toBe(1);

    // (2) RQ cache cycle matches action cycle (Output Comparison)
    const cached = queryClient.getQueryData<CheckinStatus>(
      checkinStatusQueryKey(fixtureDiscordId),
    );
    expect(cached?.cycle).toEqual(expectedCycle);
    expect(cached?.cycle.completed_days).toEqual([claimDay]);
    expect(cached?.cycle.makeup_days).toEqual([]);
    expect(cached?.cycle.big_reward_claimed).toBe(false);

    // (3) siblings preserved from pre-action cache
    expect(cached?.daily_rewards).toEqual(preSiblings.daily_rewards);
    expect(cached?.big_reward).toEqual(preSiblings.big_reward);
    expect(cached?.makeup_window_open).toBe(preSiblings.makeup_window_open);

    // Day UI completed set reflects patch
    expect(result.current.completedDays.has(claimDay)).toBe(true);
    expect(result.current.rewardModal).not.toBeNull();

    // invalidateBalances on every ok success
    expect(mockInvalidateBalances).toHaveBeenCalledTimes(1);
    expect(mockInvalidateBalances).toHaveBeenCalledWith(fixtureDiscordId);

    // Sanity: fixture control has no MVP flags
    expect(happyPathClaimOk.big_reward_granted).toBe(false);
    expect(happyPathClaimOk.reward && 'role_grant_error' in happyPathClaimOk.reward).toBe(false);
  });

  it('makeup: same hybrid-patch assertions on perform-makeup-checkin (AC-FE-005)', async () => {
    const status = statusSeedForToday();
    const expectedCycle = makeupOkAligned().cycle;
    const makeupDay = FIXTURE_MAKEUP_DAY;
    const selectedReward = rewardForDay(status, makeupDay) ?? {
      day_number: makeupDay,
      reward_type: 'points' as const,
      reward_amount: 10,
      role_id: null,
      makeup_cost: 5,
      is_active: true,
    };

    wireHappyPathRouter({
      status,
      makeupOk: makeupOkAligned(),
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const preCache = queryClient.getQueryData<CheckinStatus>(
      checkinStatusQueryKey(fixtureDiscordId),
    );
    const preSiblings = {
      daily_rewards: preCache!.daily_rewards,
      big_reward: preCache!.big_reward,
      makeup_window_open: preCache!.makeup_window_open,
    };
    expect(result.current.completedDays.has(makeupDay)).toBe(false);

    const statusCallsAfterLoad = invokeRouter.countCalls('get-checkin-status');

    // Open confirm then confirm — exercises makeup path through flow
    await act(async () => {
      await result.current.handleClaimSelected(makeupDay, 'makeup', selectedReward);
    });
    expect(result.current.makeupModal).not.toBeNull();

    let releaseAction: () => void;
    actionInvokeGate = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });

    let makeupSettled = false;
    const confirmPromise = result.current.handleMakeupConfirm().then(() => {
      makeupSettled = true;
    });

    await waitFor(() => expect(result.current.acting).toBe(true));
    expect(result.current.completedDays.has(makeupDay)).toBe(false);

    await act(async () => {
      releaseAction!();
      await confirmPromise;
    });

    expect(makeupSettled).toBe(true);
    await waitFor(() => expect(result.current.acting).toBe(false));

    expect(invokeRouter.countCalls('get-checkin-status')).toBe(statusCallsAfterLoad);
    expect(invokeRouter.countCalls('perform-makeup-checkin')).toBe(1);

    const cached = queryClient.getQueryData<CheckinStatus>(
      checkinStatusQueryKey(fixtureDiscordId),
    );
    expect(cached?.cycle).toEqual(expectedCycle);
    expect(cached?.cycle.makeup_days).toEqual([makeupDay]);
    expect(cached?.cycle.completed_days).toEqual([]);

    expect(cached?.daily_rewards).toEqual(preSiblings.daily_rewards);
    expect(cached?.big_reward).toEqual(preSiblings.big_reward);
    expect(cached?.makeup_window_open).toBe(preSiblings.makeup_window_open);

    expect(result.current.completedDays.has(makeupDay)).toBe(true);
    expect(result.current.makeupSuccessModal).not.toBeNull();

    expect(mockInvalidateBalances).toHaveBeenCalledTimes(1);
    expect(mockInvalidateBalances).toHaveBeenCalledWith(fixtureDiscordId);

    expect(happyPathMakeupOk.points_spent).toBe(5);
    expect(buildPointsReward(makeupDay)).toEqual(happyPathMakeupOk.reward);
  });
});

describe('INT-2 Shared RQ status identity — Home + Full Calendar dual mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeRouter.reset();
    actionInvokeGate = null;
    reconcileInvokeGate = null;
    postActionReconcileGateArmed = false;
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'fixture-access-token' } },
    });
  });

  it('Home + Calendar share checkinStatusQueryKey; one patch updates both; no second cold status within staleTime', async () => {
    const status = statusSeedForToday();
    const patchedCompleted = [FIXTURE_CLAIM_DAY];
    const patchedMakeup = [FIXTURE_MAKEUP_DAY];

    wireHappyPathRouter({ status });

    const { queryClient, Wrapper } = createWrapper();

    // Home surface (DailyCheckinCard → useCheckinFlow)
    const { result: home } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(home.current.loading).toBe(false));

    const statusCallsAfterHome = invokeRouter.countCalls('get-checkin-status');
    expect(statusCallsAfterHome).toBeGreaterThanOrEqual(1);
    // Both mounts resolve status from ['checkin-status', discordId]
    expect(checkinStatusQueryKey(fixtureDiscordId)).toEqual([
      'checkin-status',
      fixtureDiscordId,
    ]);
    expect(
      queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey(fixtureDiscordId)),
    ).toBeDefined();

    // Full Calendar surface — same QueryClient / shared RQ identity
    const { result: calendar } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(calendar.current.loading).toBe(false));

    // No second cold get-checkin-status within staleTime for second mount
    expect(invokeRouter.countCalls('get-checkin-status')).toBe(statusCallsAfterHome);
    expect([...home.current.completedDays]).toEqual([]);
    expect([...calendar.current.completedDays]).toEqual([]);

    const patchedCycle = buildCheckinCycle({
      year,
      month,
      completed_days: patchedCompleted,
      makeup_days: patchedMakeup,
      big_reward_claimed: false,
    });

    // Single patch — must be visible on both mounts (fails if either still forks local useState)
    await act(() => {
      const key = checkinStatusQueryKey(fixtureDiscordId);
      const prev = queryClient.getQueryData<CheckinStatus>(key);
      const next = patchCheckinStatusCycle(prev, patchedCycle);
      expect(next).toBeDefined();
      queryClient.setQueryData(key, next);
    });

    await waitFor(() => {
      expect(home.current.completedDays.has(FIXTURE_CLAIM_DAY)).toBe(true);
      expect(calendar.current.completedDays.has(FIXTURE_CLAIM_DAY)).toBe(true);
    });

    expect(home.current.completedDays.has(FIXTURE_MAKEUP_DAY)).toBe(true);
    expect(calendar.current.completedDays.has(FIXTURE_MAKEUP_DAY)).toBe(true);
    expect([...home.current.completedDays].sort((a, b) => a - b)).toEqual(
      [...calendar.current.completedDays].sort((a, b) => a - b),
    );

    const cached = queryClient.getQueryData<CheckinStatus>(
      checkinStatusQueryKey(fixtureDiscordId),
    );
    expect(cached?.cycle.completed_days).toEqual(patchedCompleted);
    expect(cached?.cycle.makeup_days).toEqual(patchedMakeup);

    // Patch does not require another cold status fetch for either mount to observe it
    expect(invokeRouter.countCalls('get-checkin-status')).toBe(statusCallsAfterHome);
  });
});

describe('INT-3 MVP reconcile gates only — big_reward_granted / role_grant_error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeRouter.reset();
    actionInvokeGate = null;
    reconcileInvokeGate = null;
    postActionReconcileGateArmed = false;
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'fixture-access-token' } },
    });
  });

  it('needsCheckinStatusReconcile: true only for MVP A/B triggers (exclusivity / no expand)', () => {
    // Binding: contract_schema — assert only the two frozen triggers (+ control)
    expect(needsCheckinStatusReconcile(claimOkBigRewardGrantedAligned())).toBe(true);
    expect(needsCheckinStatusReconcile(claimOkRoleGrantErrorAligned())).toBe(true);
    expect(needsCheckinStatusReconcile(claimOkControlAligned())).toBe(false);
    expect(needsCheckinStatusReconcile(mvpFixtureABigRewardGranted)).toBe(true);
    expect(needsCheckinStatusReconcile(mvpFixtureBRoleGrantError)).toBe(true);
    expect(needsCheckinStatusReconcile(mvpControlClaimOk)).toBe(false);
  });

  it('A: big_reward_granted → ≥1 get-checkin-status via refetchQueries; success UI not blocked on reconcile', async () => {
    const status = statusSeedForToday();
    const claimDay = FIXTURE_CLAIM_DAY;
    const selectedReward = rewardForDay(status, claimDay) ?? {
      day_number: claimDay,
      reward_type: 'points' as const,
      reward_amount: 20,
      role_id: null,
      makeup_cost: 5,
      is_active: true,
    };
    const claimOk = claimOkBigRewardGrantedAligned();

    let releaseReconcile: () => void;
    reconcileInvokeGate = new Promise<void>((resolve) => {
      releaseReconcile = resolve;
    });

    wireHappyPathRouter({ status, claimOk });

    const { queryClient, Wrapper } = createWrapper();
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const { result } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusCallsAfterLoad = invokeRouter.countCalls('get-checkin-status');

    await act(async () => {
      await result.current.handleClaimSelected(claimDay, 'today', selectedReward);
    });

    // Success UI first — modal + toast + balances — without awaiting reconcile Promise
    expect(result.current.rewardModal).not.toBeNull();
    expect(toast.success).toHaveBeenCalled();
    expect(mockInvalidateBalances).toHaveBeenCalledWith(fixtureDiscordId);
    await waitFor(() => expect(result.current.acting).toBe(false));

    // Gate fired: ≥1 get-checkin-status via refetchQueries (not invalidateQueries-only)
    expect(invokeRouter.countCalls('get-checkin-status')).toBeGreaterThan(statusCallsAfterLoad);
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: checkinStatusQueryKey(fixtureDiscordId),
    });

    // Release pending reconcile so the background promise settles
    await act(async () => {
      releaseReconcile!();
    });
  });

  it('B: reward.role_grant_error → ≥1 get-checkin-status via refetchQueries; success UI first', async () => {
    const status = statusSeedForToday();
    const claimDay = FIXTURE_CLAIM_DAY;
    const selectedReward = rewardForDay(status, claimDay) ?? {
      day_number: claimDay,
      reward_type: 'role' as const,
      reward_amount: null,
      role_id: 'fixture-day-role',
      makeup_cost: 5,
      is_active: true,
    };
    const claimOk = claimOkRoleGrantErrorAligned();

    let releaseReconcile: () => void;
    reconcileInvokeGate = new Promise<void>((resolve) => {
      releaseReconcile = resolve;
    });

    wireHappyPathRouter({ status, claimOk });

    const { queryClient, Wrapper } = createWrapper();
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const { result } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusCallsAfterLoad = invokeRouter.countCalls('get-checkin-status');

    await act(async () => {
      await result.current.handleClaimSelected(claimDay, 'today', selectedReward);
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(toast.error).toHaveBeenCalled();
    expect(mockInvalidateBalances).toHaveBeenCalledWith(fixtureDiscordId);
    await waitFor(() => expect(result.current.acting).toBe(false));

    expect(invokeRouter.countCalls('get-checkin-status')).toBeGreaterThan(statusCallsAfterLoad);
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: checkinStatusQueryKey(fixtureDiscordId),
    });

    await act(async () => {
      releaseReconcile!();
    });
  });

  it('C: neither MVP flag → 0 get-checkin-status after action (exclusive gate / always-reconcile barred)', async () => {
    const status = statusSeedForToday();
    const claimDay = FIXTURE_CLAIM_DAY;
    const selectedReward = rewardForDay(status, claimDay) ?? {
      day_number: claimDay,
      reward_type: 'points' as const,
      reward_amount: 20,
      role_id: null,
      makeup_cost: 5,
      is_active: true,
    };
    const claimOk = claimOkControlAligned();

    wireHappyPathRouter({ status, claimOk });

    const { queryClient, Wrapper } = createWrapper();
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const { result } = renderHook(() => useCheckinFlow(fixtureDiscordId), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusCallsAfterLoad = invokeRouter.countCalls('get-checkin-status');

    await act(async () => {
      await result.current.handleClaimSelected(claimDay, 'today', selectedReward);
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(mockInvalidateBalances).toHaveBeenCalledWith(fixtureDiscordId);
    await waitFor(() => expect(result.current.acting).toBe(false));

    // Control: 0 status attributable to action — proves gate exclusivity
    expect(invokeRouter.countCalls('get-checkin-status')).toBe(statusCallsAfterLoad);
    expect(refetchSpy).not.toHaveBeenCalled();
  });
});
