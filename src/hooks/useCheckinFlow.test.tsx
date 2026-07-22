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

function defaultRoleInfoResult(roleId = 'role-big') {
  return {
    data: { id: roleId, name: 'Big Role', icon: null, unicode_emoji: null },
    error: null,
  };
}

type InvokeRouter = {
  status?: () => unknown;
  roleInfo?: (roleId?: string) => unknown;
  performCheckin?: () => unknown;
  performMakeup?: () => unknown;
};

/** Route edge invokes by name so FR-6 get-role-info does not steal status/action mocks. */
function mockInvokeRouter(routes: InvokeRouter) {
  mockInvoke.mockImplementation((fn: string, opts?: { body?: { role_id?: string } }) => {
    if (fn === 'get-checkin-status') {
      return Promise.resolve(routes.status ? routes.status() : statusInvokeResult());
    }
    if (fn === 'get-role-info') {
      return Promise.resolve(
        routes.roleInfo
          ? routes.roleInfo(opts?.body?.role_id)
          : defaultRoleInfoResult(opts?.body?.role_id),
      );
    }
    if (fn === 'perform-checkin' && routes.performCheckin) {
      return Promise.resolve(routes.performCheckin());
    }
    if (fn === 'perform-makeup-checkin' && routes.performMakeup) {
      return Promise.resolve(routes.performMakeup());
    }
    return Promise.resolve({ data: null, error: null });
  });
}

describe('useCheckinFlow MVP reconcile gates (T3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
  });

  it('refetches get-checkin-status after success UI when big_reward_granted (non-blocking)', async () => {
    mockInvokeRouter({ status: () => statusInvokeResult() });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();

    let resolveReconcile: (value: unknown) => void;
    const reconcilePending = new Promise((resolve) => {
      resolveReconcile = resolve;
    });
    let performDone = false;

    mockInvokeRouter({
      status: () => {
        if (!performDone) return statusInvokeResult();
        return reconcilePending;
      },
      performCheckin: () => {
        performDone = true;
        return {
          data: {
            ok: true,
            reward: { reward_type: 'points', reward_amount: 10 },
            cycle: { ...patchedCycle, big_reward_claimed: true },
            big_reward_granted: true,
          },
          error: null,
        };
      },
    });

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
    mockInvokeRouter({ status: () => statusInvokeResult() });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();
    let performDone = false;

    mockInvokeRouter({
      status: () => {
        if (!performDone) return statusInvokeResult();
        return statusInvokeResult();
      },
      performCheckin: () => {
        performDone = true;
        return {
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
        };
      },
    });

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
    mockInvokeRouter({ status: () => statusInvokeResult() });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const statusAfterLoad = countStatusCalls();

    mockInvokeRouter({
      status: () => statusInvokeResult(),
      performCheckin: () => ({
        data: {
          ok: true,
          reward: { reward_type: 'points', reward_amount: 10 },
          cycle: patchedCycle,
          big_reward_granted: false,
        },
        error: null,
      }),
    });

    await act(async () => {
      await result.current.handleClaimSelected(todayDay, 'today', authStatus.daily_rewards[0]);
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(mockInvalidateBalances).toHaveBeenCalledWith('user-1');
    expect(countStatusCalls()).toBe(statusAfterLoad);
  });

  it('leaves patched cycle when reconcile refetch fails', async () => {
    mockInvokeRouter({ status: () => statusInvokeResult() });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let performDone = false;
    mockInvoke.mockImplementation((fn: string, opts?: { body?: { role_id?: string } }) => {
      if (fn === 'get-role-info') {
        return Promise.resolve(defaultRoleInfoResult(opts?.body?.role_id));
      }
      if (fn === 'perform-checkin') {
        performDone = true;
        return Promise.resolve({
          data: {
            ok: true,
            reward: { reward_type: 'points', reward_amount: 10 },
            cycle: { ...patchedCycle, big_reward_claimed: true },
            big_reward_granted: true,
          },
          error: null,
        });
      }
      if (fn === 'get-checkin-status') {
        if (!performDone) return Promise.resolve(statusInvokeResult());
        return Promise.reject(new Error('network'));
      }
      return Promise.resolve({ data: null, error: null });
    });

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

describe('useCheckinFlow FR-6 progressive role meta (T4.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
  });

  it('keeps loading false and claim callable while get-role-info is pending (AC-FE-012)', async () => {
    const statusWithRole: CheckinStatus = {
      ...authStatus,
      daily_rewards: [
        {
          day_number: todayDay,
          reward_type: 'role',
          reward_amount: null,
          role_id: 'role-slow',
          makeup_cost: 5,
          is_active: true,
        },
      ],
    };

    let resolveRole: (value: unknown) => void;
    const rolePending = new Promise((resolve) => {
      resolveRole = resolve;
    });

    mockInvoke.mockImplementation((fn: string) => {
      if (fn === 'get-checkin-status') {
        return Promise.resolve({
          data: {
            ok: true,
            cycle: statusWithRole.cycle,
            daily_rewards: statusWithRole.daily_rewards,
            big_reward: statusWithRole.big_reward,
            makeup_window_open: true,
          },
          error: null,
        });
      }
      if (fn === 'get-role-info') {
        return rolePending;
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).not.toBeNull();
    // Icons still pending — TeaBag path (no roleMeta entry yet)
    expect(result.current.roleMeta['role-slow']).toBeUndefined();
    // Claim path must remain callable (not gated on icons)
    expect(typeof result.current.handleClaimSelected).toBe('function');
    expect(result.current.acting).toBe(false);

    mockInvoke.mockImplementation((fn: string) => {
      if (fn === 'perform-checkin') {
        return Promise.resolve({
          data: {
            ok: true,
            reward: { reward_type: 'role', role_id: 'role-slow' },
            cycle: patchedCycle,
            big_reward_granted: false,
          },
          error: null,
        });
      }
      if (fn === 'get-checkin-status') {
        return Promise.resolve({
          data: {
            ok: true,
            cycle: statusWithRole.cycle,
            daily_rewards: statusWithRole.daily_rewards,
            big_reward: statusWithRole.big_reward,
            makeup_window_open: true,
          },
          error: null,
        });
      }
      if (fn === 'get-role-info') {
        return rolePending;
      }
      return Promise.resolve({ data: null, error: null });
    });

    await act(async () => {
      await result.current.handleClaimSelected(
        todayDay,
        'today',
        statusWithRole.daily_rewards[0],
      );
    });

    expect(result.current.rewardModal).not.toBeNull();
    expect(countStatusCalls()).toBe(1); // load only — happy path

    resolveRole!({
      data: { id: 'role-slow', name: 'Slow Role', icon: 'https://cdn.example/slow.png' },
      error: null,
    });

    await waitFor(() => {
      expect(result.current.roleMeta['role-slow']?.name).toBe('Slow Role');
    });
  });

  it('dedupes get-role-info for the same role_id across daily + big reward (AC-FE-013)', async () => {
    const sharedRoleId = 'role-shared';
    const statusShared: CheckinStatus = {
      ...authStatus,
      daily_rewards: [
        {
          day_number: todayDay,
          reward_type: 'role',
          reward_amount: null,
          role_id: sharedRoleId,
          makeup_cost: 5,
          is_active: true,
        },
      ],
      big_reward: {
        reward_type: 'role',
        reward_amount: null,
        role_id: sharedRoleId,
        description: 'Same role',
      },
    };

    mockInvokeRouter({
      status: () => ({
        data: {
          ok: true,
          cycle: statusShared.cycle,
          daily_rewards: statusShared.daily_rewards,
          big_reward: statusShared.big_reward,
          makeup_window_open: true,
        },
        error: null,
      }),
      roleInfo: (roleId) => ({
        data: {
          id: roleId,
          name: 'Shared',
          icon: 'https://cdn.example/shared.png',
        },
        error: null,
      }),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCheckinFlow('user-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => {
      expect(result.current.roleMeta[sharedRoleId]?.name).toBe('Shared');
    });

    const roleCalls = mockInvoke.mock.calls.filter(([fn]) => fn === 'get-role-info');
    expect(roleCalls).toHaveLength(1);
  });
});
