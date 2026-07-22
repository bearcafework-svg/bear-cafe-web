import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { checkinStatusQueryKey } from '@/lib/checkin-status-cache';
import { getCheckinToday, type CheckinStatus } from '@/lib/checkin';

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockInvalidateBalances = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
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
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

import { useCheckinFlow } from './useCheckinFlow';

const { year, month, day: todayDay } = getCheckinToday();

const authStatus: CheckinStatus = {
  cycle: {
    year,
    month,
    completed_days: [1],
    makeup_days: [],
    big_reward_claimed: false,
  },
  daily_rewards: [
    {
      day_number: todayDay,
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
    description: 'Big',
  },
  makeup_window_open: true,
};

const patchedCycle = {
  year,
  month,
  completed_days: [1, todayDay],
  makeup_days: [],
  big_reward_claimed: false,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

function statusInvokeResult(overrides?: Record<string, unknown>) {
  return {
    data: {
      ok: true,
      cycle: authStatus.cycle,
      daily_rewards: authStatus.daily_rewards,
      big_reward: authStatus.big_reward,
      makeup_window_open: true,
      ...overrides,
    },
    error: null,
  };
}

function countStatusCalls() {
  return mockInvoke.mock.calls.filter(([fn]) => fn === 'get-checkin-status').length;
}

describe('useCheckinFlow MVP reconcile gates (T3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
  });

  it('refetches get-checkin-status after success UI when big_reward_granted (non-blocking)', async () => {
    mockInvoke.mockResolvedValueOnce(statusInvokeResult());

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();

    let resolveReconcile: (value: unknown) => void;
    const reconcilePending = new Promise((resolve) => {
      resolveReconcile = resolve;
    });

    mockInvoke
      .mockResolvedValueOnce({
        data: {
          ok: true,
          reward: { reward_type: 'points', reward_amount: 10 },
          cycle: { ...patchedCycle, big_reward_claimed: true },
          big_reward_granted: true,
        },
        error: null,
      })
      .mockImplementationOnce(() => reconcilePending);

    await act(async () => {
      await result.current.handleClaimSelected(todayDay, 'today', authStatus.daily_rewards[0]);
    });

    // Success UI first — modal + toast + balances — without awaiting reconcile
    expect(result.current.rewardModal).not.toBeNull();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockInvalidateBalances).toHaveBeenCalledWith('user-1');

    // Gate fired: status refetch in flight (pending) — ≥1 beyond load
    expect(countStatusCalls()).toBeGreaterThan(statusAfterLoad);

    // Patched cycle retained while reconcile pending
    expect(
      queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'))?.cycle
        .completed_days,
    ).toEqual([1, todayDay]);

    resolveReconcile!(
      statusInvokeResult({
        cycle: { ...patchedCycle, big_reward_claimed: true },
      }),
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'))?.cycle
          .big_reward_claimed,
      ).toBe(true);
    });
  });

  it('refetches get-checkin-status when reward.role_grant_error present', async () => {
    mockInvoke.mockResolvedValueOnce(statusInvokeResult());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();

    mockInvoke
      .mockResolvedValueOnce({
        data: {
          ok: true,
          reward: {
            reward_type: 'role',
            role_id: 'role-1',
            role_grant_error: 'discord_api_error',
          },
          cycle: patchedCycle,
          big_reward_granted: false,
        },
        error: null,
      })
      .mockResolvedValueOnce(statusInvokeResult());

    await act(async () => {
      await result.current.handleClaimSelected(todayDay, 'today', authStatus.daily_rewards[0]);
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(mockToastError).toHaveBeenCalled();
    expect(mockInvalidateBalances).toHaveBeenCalledWith('user-1');

    await waitFor(() => {
      expect(countStatusCalls()).toBeGreaterThan(statusAfterLoad);
    });
  });

  it('does not call get-checkin-status after happy-path success without MVP flags', async () => {
    mockInvoke.mockResolvedValueOnce(statusInvokeResult());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();

    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        reward: { reward_type: 'points', reward_amount: 10 },
        cycle: patchedCycle,
        big_reward_granted: false,
      },
      error: null,
    });

    await act(async () => {
      await result.current.handleClaimSelected(todayDay, 'today', authStatus.daily_rewards[0]);
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(mockInvalidateBalances).toHaveBeenCalledWith('user-1');
    expect(countStatusCalls()).toBe(statusAfterLoad);
  });

  it('leaves patched cycle when reconcile refetch fails', async () => {
    mockInvoke.mockResolvedValueOnce(statusInvokeResult());

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockInvoke
      .mockResolvedValueOnce({
        data: {
          ok: true,
          reward: { reward_type: 'points', reward_amount: 10 },
          cycle: { ...patchedCycle, big_reward_claimed: true },
          big_reward_granted: true,
        },
        error: null,
      })
      .mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await result.current.handleClaimSelected(todayDay, 'today', authStatus.daily_rewards[0]);
    });

    expect(result.current.rewardModal).not.toBeNull();

    await waitFor(() => {
      expect(countStatusCalls()).toBeGreaterThan(1);
    });

    // RQ retains previous successful data on refetch error
    expect(
      queryClient.getQueryData<CheckinStatus>(checkinStatusQueryKey('user-1'))?.cycle
        .completed_days,
    ).toEqual([1, todayDay]);
  });
});
