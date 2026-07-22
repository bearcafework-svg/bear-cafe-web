import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { roleInfoQueryKey } from '@/lib/checkin-status-cache';
import type { RoleMeta } from '@/lib/checkin-modal-data';

/** FE Design Doc § staleTime / gc — role-info (FR-6). */
export const ROLE_INFO_STALE_TIME = 300_000;

type RoleInfoEdgePayload = {
  error?: string;
  name?: string;
  icon?: string | null;
  unicode_emoji?: string | null;
};

export async function fetchRoleInfo(roleId: string): Promise<RoleMeta> {
  const { data, error } = await supabase.functions.invoke('get-role-info', {
    body: { role_id: roleId },
  });

  if (error) throw error;

  const payload = data as RoleInfoEdgePayload | null | undefined;
  if (!payload || payload.error) {
    throw new Error(payload?.error ?? 'role_info_failed');
  }

  const icon = payload.icon || payload.unicode_emoji;
  return {
    icon: icon || undefined,
    name: payload.name,
  };
}

/**
 * Progressive role-meta via RQ-by-role_id (FR-6 / AC-FE-012–013).
 * Returns a Record compatible with existing CheckinRoleIcon consumers;
 * missing/failed entries stay absent → TeaBag fallback. Does not gate claim.
 */
export function useRoleInfo(roleIds: string[]): Record<string, RoleMeta> {
  const uniqueRoleIds = useMemo(
    () => [...new Set(roleIds.filter(Boolean))],
    [roleIds],
  );

  const results = useQueries({
    queries: uniqueRoleIds.map((roleId) => ({
      queryKey: roleInfoQueryKey(roleId),
      queryFn: () => fetchRoleInfo(roleId),
      staleTime: ROLE_INFO_STALE_TIME,
    })),
  });

  return useMemo(() => {
    const map: Record<string, RoleMeta> = {};
    uniqueRoleIds.forEach((roleId, index) => {
      const data = results[index]?.data;
      if (data) {
        map[roleId] = data;
      }
    });
    return map;
  }, [uniqueRoleIds, results]);
}
