import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readFunctionsErrorPayload } from '@/lib/function-error';
import {
  getCheckinToday,
  type CheckinCycle,
  type CheckinDailyReward,
  type CheckinStatus,
} from '@/lib/checkin';
import {
  checkinPublicStatusQueryKey,
  checkinStatusQueryKey,
  fetchCheckinStatus,
  patchCheckinStatusCycle,
} from '@/lib/checkin-status-cache';

/** FE Design Doc § staleTime / gc — auth + guest check-in status. */
const CHECKIN_STATUS_STALE_TIME = 60_000;

async function fetchPublicDailyRewards(): Promise<CheckinDailyReward[]> {
  const { year, month } = getCheckinToday();
  const { data, error } = await supabase
    .from('checkin_daily_rewards' as never)
    .select('day_number, reward_type, reward_amount, role_id, makeup_cost, is_active')
    .eq('year', year)
    .eq('month', month)
    .order('day_number');

  if (error) throw error;
  return (data ?? []) as CheckinDailyReward[];
}

async function fetchPublicBigReward(): Promise<CheckinStatus['big_reward']> {
  const { year, month } = getCheckinToday();
  const { data, error } = await supabase
    .from('checkin_big_reward' as never)
    .select('reward_type, reward_amount, role_id, description')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as CheckinStatus['big_reward'];
}

function publicCheckinStatus(
  daily_rewards: CheckinDailyReward[],
  big_reward: CheckinStatus['big_reward'],
): CheckinStatus {
  const { year, month, day: currentDay } = getCheckinToday();
  return {
    cycle: {
      year,
      month,
      completed_days: [],
      makeup_days: [],
      big_reward_claimed: false,
    },
    daily_rewards,
    big_reward,
    makeup_window_open: currentDay > 1,
  };
}

async function fetchPublicCheckinStatus(): Promise<CheckinStatus> {
  const [daily_rewards, big_reward] = await Promise.all([
    fetchPublicDailyRewards(),
    fetchPublicBigReward(),
  ]);
  return publicCheckinStatus(daily_rewards, big_reward);
}

export type CheckinActionResult =
  | {
      ok: true;
      /** Present when edge contract held; absent on soft-failure (ok without cycle). */
      cycle?: CheckinCycle;
      reward?: Record<string, unknown>;
      big_reward_granted?: boolean;
      points_spent?: number;
      points_now?: unknown;
    }
  | { ok: false; error: string };

function isCheckinCycle(value: unknown): value is CheckinCycle {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.year === 'number' &&
    typeof c.month === 'number' &&
    Array.isArray(c.completed_days) &&
    Array.isArray(c.makeup_days) &&
    typeof c.big_reward_claimed === 'boolean'
  );
}

export function useCheckin(discordId: string | undefined) {
  const queryClient = useQueryClient();
  const [acting, setActing] = useState(false);

  const authQuery = useQuery({
    queryKey: checkinStatusQueryKey(discordId ?? ''),
    queryFn: async () => {
      try {
        return await fetchCheckinStatus(discordId!);
      } catch (err) {
        console.error('Failed to fetch check-in status:', err);
        throw err;
      }
    },
    enabled: Boolean(discordId),
    staleTime: CHECKIN_STATUS_STALE_TIME,
  });

  const guestQuery = useQuery({
    queryKey: checkinPublicStatusQueryKey(),
    queryFn: async () => {
      try {
        return await fetchPublicCheckinStatus();
      } catch (err) {
        console.error('Failed to fetch check-in rewards:', err);
        throw err;
      }
    },
    enabled: !discordId,
    staleTime: CHECKIN_STATUS_STALE_TIME,
  });

  const activeQuery = discordId ? authQuery : guestQuery;
  // Initial pending / no-data only — never claim or background isFetching flash.
  const loading = activeQuery.isPending;
  const status = activeQuery.data ?? null;

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const refresh = useCallback(async () => {
    if (discordId) {
      await queryClient.refetchQueries({ queryKey: checkinStatusQueryKey(discordId) });
      return;
    }
    await queryClient.refetchQueries({ queryKey: checkinPublicStatusQueryKey() });
  }, [discordId, queryClient]);

  const invokeAction = useCallback(
    async (fn: string, body: Record<string, unknown>): Promise<CheckinActionResult> => {
      if (!discordId) return { ok: false, error: 'missing_discord_id' };

      const headers = await getAuthHeaders();
      if (!headers) return { ok: false, error: 'missing_auth' };

      setActing(true);
      try {
        const { data, error } = await supabase.functions.invoke(fn, {
          headers,
          body: { discord_id: discordId, ...body },
        });

        if (error) {
          const payload = await readFunctionsErrorPayload(error);
          return { ok: false, error: payload?.error ?? 'action_failed' };
        }
        if (!data?.ok) return { ok: false, error: data?.error ?? 'action_failed' };

        const reward =
          data.reward && typeof data.reward === 'object'
            ? (data.reward as Record<string, unknown>)
            : undefined;
        const big_reward_granted =
          typeof data.big_reward_granted === 'boolean' ? data.big_reward_granted : undefined;
        const points_spent =
          typeof data.points_spent === 'number' ? data.points_spent : undefined;
        const points_now = data.points_now;

        // Soft-failure: ok without cycle — show success UI from reward if possible;
        // force reconcile; do not speculative-complete the day (Design Doc § CheckinActionResult).
        if (!isCheckinCycle(data.cycle)) {
          console.error('checkin action missing cycle; forcing status reconcile', {
            fn,
            error: 'missing_cycle',
          });
          void refresh();
          return {
            ok: true,
            reward,
            big_reward_granted,
            points_spent,
            points_now,
          };
        }

        const cycle = data.cycle;
        const key = checkinStatusQueryKey(discordId);
        const prev = queryClient.getQueryData<CheckinStatus>(key);
        const next = patchCheckinStatusCycle(prev, cycle);
        if (next) {
          queryClient.setQueryData(key, next);
        } else {
          // No cached prev — do not invent incomplete entries; force reconcile.
          void refresh();
        }

        // MVP reconcile gates (big_reward_granted / role_grant_error) wired in T3.1 — not here.
        return {
          ok: true,
          cycle,
          reward,
          big_reward_granted,
          points_spent,
          points_now,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'action_failed';
        return { ok: false, error: message };
      } finally {
        setActing(false);
      }
    },
    [discordId, getAuthHeaders, queryClient, refresh],
  );

  const performCheckin = useCallback(
    (dayNumber: number) => invokeAction('perform-checkin', { day_number: dayNumber }),
    [invokeAction],
  );

  const performMakeupCheckin = useCallback(
    (dayNumber: number, year: number, month: number) =>
      invokeAction('perform-makeup-checkin', { day_number: dayNumber, year, month }),
    [invokeAction],
  );

  return {
    status,
    loading,
    acting,
    refresh,
    performCheckin,
    performMakeupCheckin,
  };
}
