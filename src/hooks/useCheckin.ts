import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { readFunctionsErrorPayload } from '@/lib/function-error';
import { getCheckinToday, type CheckinDailyReward, type CheckinStatus } from '@/lib/checkin';

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

function publicCheckinStatus(daily_rewards: CheckinDailyReward[]): CheckinStatus {
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
    big_reward: null,
    makeup_window_open: currentDay > 28,
  };
}

export type CheckinActionResult =
  | { ok: true; reward?: Record<string, unknown>; big_reward_granted?: boolean }
  | { ok: false; error: string };

export function useCheckin(discordId: string | undefined) {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(discordId));
  const [acting, setActing] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const refresh = useCallback(async () => {
    if (!discordId) {
      try {
        const daily_rewards = await fetchPublicDailyRewards();
        setStatus(publicCheckinStatus(daily_rewards));
      } catch (err) {
        console.error('Failed to fetch check-in rewards:', err);
        setStatus(null);
      }
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('missing_auth');

      const { data, error } = await supabase.functions.invoke('get-checkin-status', {
        headers,
        body: { discord_id: discordId },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'fetch_failed');

      setStatus({
        cycle: data.cycle,
        daily_rewards: data.daily_rewards ?? [],
        big_reward: data.big_reward ?? null,
        makeup_window_open: Boolean(data.makeup_window_open),
      });
    } catch (err) {
      console.error('Failed to fetch check-in status:', err);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [discordId, getAuthHeaders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

        await refresh();
        return {
          ok: true,
          reward: data.reward,
          big_reward_granted: data.big_reward_granted,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'action_failed';
        return { ok: false, error: message };
      } finally {
        setActing(false);
      }
    },
    [discordId, getAuthHeaders, refresh],
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
