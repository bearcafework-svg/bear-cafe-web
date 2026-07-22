import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { roleInfoQueryKey } from '@/lib/checkin-status-cache';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { useRoleInfo, ROLE_INFO_STALE_TIME } from './useRoleInfo';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

describe('useRoleInfo (FR-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports role-info staleTime of 300_000', () => {
    expect(ROLE_INFO_STALE_TIME).toBe(300_000);
  });

  it('coalesces duplicate role_ids to one get-role-info invoke (AC-FE-013)', async () => {
    mockInvoke.mockResolvedValue({
      data: { id: 'role-a', name: 'Barista', icon: 'https://cdn.example/a.png', unicode_emoji: null },
      error: null,
    });

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useRoleInfo(['role-a', 'role-a', 'role-a']), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current['role-a']?.name).toBe('Barista');
    });

    const roleCalls = mockInvoke.mock.calls.filter(([fn]) => fn === 'get-role-info');
    expect(roleCalls).toHaveLength(1);
    expect(roleCalls[0][1]).toEqual({ body: { role_id: 'role-a' } });
    expect(queryClient.getQueryData(roleInfoQueryKey('role-a'))).toEqual({
      icon: 'https://cdn.example/a.png',
      name: 'Barista',
    });
  });

  it('reuses cached role meta for the same role_id across mounts (AC-FE-013)', async () => {
    mockInvoke.mockResolvedValue({
      data: { id: 'role-b', name: 'Patron', icon: null, unicode_emoji: '🍵' },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const first = renderHook(() => useRoleInfo(['role-b']), { wrapper: Wrapper });
    await waitFor(() => {
      expect(first.result.current['role-b']?.icon).toBe('🍵');
    });

    const second = renderHook(() => useRoleInfo(['role-b']), { wrapper: Wrapper });
    await waitFor(() => {
      expect(second.result.current['role-b']?.name).toBe('Patron');
    });

    expect(mockInvoke.mock.calls.filter(([fn]) => fn === 'get-role-info')).toHaveLength(1);
  });

  it('omits failed role meta so consumers keep TeaBag fallback', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Role not found', role_id: 'missing' },
      error: null,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRoleInfo(['missing']), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // Settle: no entry → CheckinRoleIcon renders TeaBag
    await waitFor(() => {
      expect(result.current['missing']).toBeUndefined();
    });
  });

  it('fills progressively without blocking — empty map while pending', async () => {
    let resolveInvoke: (value: unknown) => void;
    mockInvoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRoleInfo(['role-pending']), { wrapper: Wrapper });

    // Progressive fill: pending → no meta yet (TeaBag); claim path independent of this map
    expect(result.current['role-pending']).toBeUndefined();
    expect(Object.keys(result.current)).toHaveLength(0);

    resolveInvoke!({
      data: { id: 'role-pending', name: 'Later', icon: 'https://cdn.example/later.png' },
      error: null,
    });

    await waitFor(() => {
      expect(result.current['role-pending']?.name).toBe('Later');
    });
  });
});
