import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  checkinPublicStatusQueryKey,
  checkinStatusQueryKey,
} from '@/lib/checkin-status-cache';
import type { CheckinStatus } from '@/lib/checkin';

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { useCheckin } from './useCheckin';

const authStatus: CheckinStatus = {
  cycle: {
    year: 2026,
    month: 7,
    completed_days: [1],
    makeup_days: [],
    big_reward_claimed: false,
  },
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
  big_reward: null,
  makeup_window_open: true,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

function mockPublicTables() {
  mockFrom.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(),
      maybeSingle: vi.fn(),
    };
    if (table === 'checkin_daily_rewards') {
      chain.order.mockResolvedValue({
        data: [
          {
            day_number: 1,
            reward_type: 'points',
            reward_amount: 10,
            role_id: null,
            makeup_cost: 5,
            is_active: true,
          },
        ],
        error: null,
      });
    } else {
      chain.maybeSingle.mockResolvedValue({
        data: {
          reward_type: 'role',
          reward_amount: null,
          role_id: 'role-1',
          description: 'Big',
        },
        error: null,
      });
      // big_reward path uses .eq().eq().maybeSingle — keep chain fluent
      chain.eq.mockReturnValue(chain);
    }
    return chain;
  });
}

describe('useCheckin shared RQ status load (T1.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
  });

  it('loads auth status via checkinStatusQueryKey and get-checkin-status', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        cycle: authStatus.cycle,
        daily_rewards: authStatus.daily_rewards,
        big_reward: null,
        makeup_window_open: true,
      },
      error: null,
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status?.cycle.completed_days).toEqual([1]);
    expect(mockInvoke).toHaveBeenCalledWith(
      'get-checkin-status',
      expect.objectContaining({
        body: { discord_id: 'user-1' },
      }),
    );

    const cached = queryClient.getQueryData(checkinStatusQueryKey('user-1'));
    expect(cached).toMatchObject({ cycle: authStatus.cycle });

    const query = queryClient.getQueryCache().find({
      queryKey: checkinStatusQueryKey('user-1'),
    });
    expect((query?.options as { staleTime?: number }).staleTime).toBe(60_000);
  });

  it('does not run auth get-checkin-status when discordId is missing (guest public path)', async () => {
    mockPublicTables();

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin(undefined), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.status?.daily_rewards.length).toBeGreaterThan(0);
    expect(result.current.status?.cycle.completed_days).toEqual([]);

    const cached = queryClient.getQueryData(checkinPublicStatusQueryKey());
    expect(cached).toBeDefined();

    const query = queryClient.getQueryCache().find({
      queryKey: checkinPublicStatusQueryKey(),
    });
    expect((query?.options as { staleTime?: number }).staleTime).toBe(60_000);
  });

  it('keeps loading false on refetch when status data already exists (no skeleton flash)', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        cycle: authStatus.cycle,
        daily_rewards: authStatus.daily_rewards,
        big_reward: null,
        makeup_window_open: true,
      },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.status).not.toBeNull();
    });

    let resolveSecond: (value: unknown) => void;
    const secondFetch = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    mockInvoke.mockImplementationOnce(() => secondFetch);

    const refreshPromise = result.current.refresh();

    // Still have data — loading must stay false while refetch is in flight
    expect(result.current.status).not.toBeNull();
    expect(result.current.loading).toBe(false);

    resolveSecond!({
      data: {
        ok: true,
        cycle: { ...authStatus.cycle, completed_days: [1, 2] },
        daily_rewards: authStatus.daily_rewards,
        big_reward: null,
        makeup_window_open: true,
      },
      error: null,
    });

    await refreshPromise;
    await waitFor(() => {
      expect(result.current.status?.cycle.completed_days).toEqual([1, 2]);
    });
    expect(result.current.loading).toBe(false);
  });

  it('preserves return shape for DailyCheckinCard / FullCheckInCalendar consumers', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        cycle: authStatus.cycle,
        daily_rewards: authStatus.daily_rewards,
        big_reward: null,
        makeup_window_open: true,
      },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toEqual(
      expect.objectContaining({
        status: expect.any(Object),
        loading: false,
        acting: false,
        refresh: expect.any(Function),
        performCheckin: expect.any(Function),
        performMakeupCheckin: expect.any(Function),
      }),
    );
  });

  it('shares auth cache identity across dual mounts under one QueryClient', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        cycle: authStatus.cycle,
        daily_rewards: authStatus.daily_rewards,
        big_reward: null,
        makeup_window_open: true,
      },
      error: null,
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result: home } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(home.current.loading).toBe(false));

    const invokeCountAfterFirst = mockInvoke.mock.calls.length;

    const { result: calendar } = renderHook(() => useCheckin('user-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(calendar.current.loading).toBe(false));

    expect(calendar.current.status?.cycle.completed_days).toEqual(
      home.current.status?.cycle.completed_days,
    );
    // Warm cache within staleTime — no second cold get-checkin-status
    expect(mockInvoke.mock.calls.length).toBe(invokeCountAfterFirst);
    expect(queryClient.getQueryData(checkinStatusQueryKey('user-1'))).toBeDefined();
  });
});

const patchedCycle = {
  year: 2026,
  month: 7,
  completed_days: [1, 2],
  makeup_days: [],
  big_reward_claimed: false,
};

function authStatusInvokeResult(overrides?: Record<string, unknown>) {
  return {
    data: {
      ok: true,
      cycle: authStatus.cycle,
      daily_rewards: authStatus.daily_rewards,
      big_reward: {
        reward_type: 'role',
        reward_amount: null,
        role_id: 'role-big',
        description: 'Big',
      },
      makeup_window_open: true,
      ...overrides,
    },
    error: null,
  };
}

describe('useCheckin hybrid patch invokeAction (T2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
  });

  it('patches shared RQ cycle on happy-path claim without get-checkin-status', async () => {
    mockInvoke.mockResolvedValueOnce(authStatusInvokeResult());

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusCallsAfterLoad = mockInvoke.mock.calls.filter(
      ([fn]) => fn === 'get-checkin-status',
    ).length;

    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        reward: { reward_type: 'points', reward_amount: 10 },
        cycle: patchedCycle,
        big_reward_granted: false,
      },
      error: null,
    });

    const actionResult = await act(async () => result.current.performCheckin(2));

    expect(actionResult).toEqual(
      expect.objectContaining({
        ok: true,
        cycle: patchedCycle,
        big_reward_granted: false,
      }),
    );

    const cached = queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'));
    expect(cached?.cycle).toEqual(patchedCycle);
    // Siblings preserved (ADR / patchCheckinStatusCycle)
    expect(cached?.daily_rewards).toEqual(authStatus.daily_rewards);
    expect(cached?.big_reward).toEqual({
      reward_type: 'role',
      reward_amount: null,
      role_id: 'role-big',
      description: 'Big',
    });
    expect(cached?.makeup_window_open).toBe(true);

    const statusCallsAfterAction = mockInvoke.mock.calls.filter(
      ([fn]) => fn === 'get-checkin-status',
    ).length;
    expect(statusCallsAfterAction).toBe(statusCallsAfterLoad);

    expect(mockInvoke).toHaveBeenCalledWith(
      'perform-checkin',
      expect.objectContaining({
        body: { discord_id: 'user-1', day_number: 2 },
      }),
    );
  });

  it('does not patch cache when action returns ok:false', async () => {
    mockInvoke.mockResolvedValueOnce(authStatusInvokeResult());

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'));

    mockInvoke.mockResolvedValueOnce({
      data: { ok: false, error: 'already_checked_in' },
      error: null,
    });

    const actionResult = await act(async () => result.current.performCheckin(1));
    expect(actionResult).toEqual({ ok: false, error: 'already_checked_in' });
    expect(queryClient.getQueryData(checkinStatusQueryKey('user-1'))).toEqual(before);
  });

  it('soft-fails when ok without cycle: force reconcile, no speculative complete', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockResolvedValueOnce(authStatusInvokeResult());

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'));

    mockInvoke
      .mockResolvedValueOnce({
        data: {
          ok: true,
          reward: { reward_type: 'points', reward_amount: 10 },
          big_reward_granted: false,
          // cycle intentionally missing
        },
        error: null,
      })
      .mockResolvedValueOnce(authStatusInvokeResult());

    const actionResult = await act(async () => result.current.performCheckin(2));

    expect(actionResult.ok).toBe(true);
    if (actionResult.ok) {
      expect(actionResult.cycle).toBeUndefined();
      expect(actionResult.reward).toEqual({ reward_type: 'points', reward_amount: 10 });
    }

    // No speculative day complete from missing cycle
    expect(
      queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'))?.cycle
        .completed_days,
    ).toEqual(before?.cycle.completed_days);

    await waitFor(() => {
      expect(
        mockInvoke.mock.calls.filter(([fn]) => fn === 'get-checkin-status').length,
      ).toBeGreaterThan(1);
    });

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toMatch(/Bearer|token/i);
    errorSpy.mockRestore();
  });

  it('returns makeup points fields and clears acting without awaiting status RTT', async () => {
    mockInvoke.mockResolvedValueOnce(authStatusInvokeResult());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckin('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolveAction: (value: unknown) => void;
    const actionPending = new Promise((resolve) => {
      resolveAction = resolve;
    });
    mockInvoke.mockImplementationOnce(() => actionPending);

    let settled: Awaited<ReturnType<typeof result.current.performMakeupCheckin>> | undefined;
    const actionPromise = result.current.performMakeupCheckin(1, 2026, 7).then((r) => {
      settled = r;
      return r;
    });

    await waitFor(() => expect(result.current.acting).toBe(true));

    await act(async () => {
      resolveAction!({
        data: {
          ok: true,
          reward: { reward_type: 'points', reward_amount: 10 },
          cycle: { ...patchedCycle, makeup_days: [1], completed_days: [] },
          big_reward_granted: false,
          points_spent: 50,
          points_now: { points: 100 },
        },
        error: null,
      });
      await actionPromise;
    });

    expect(settled).toEqual(
      expect.objectContaining({
        ok: true,
        points_spent: 50,
        points_now: { points: 100 },
        cycle: expect.objectContaining({ makeup_days: [1] }),
      }),
    );
    await waitFor(() => expect(result.current.acting).toBe(false));
    // Happy path: no get-checkin-status after the initial load
    expect(mockInvoke.mock.calls.filter(([fn]) => fn === 'get-checkin-status')).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'perform-makeup-checkin',
      expect.objectContaining({
        body: { discord_id: 'user-1', day_number: 1, year: 2026, month: 7 },
      }),
    );
  });
});
