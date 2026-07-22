import { supabase } from '@/integrations/supabase/client';
import type { CheckinCycle, CheckinStatus } from '@/lib/checkin';

/** Mirror useUserBalances — shared RQ identity for Home + Full Calendar. */
export function checkinStatusQueryKey(discordId: string) {
  return ['checkin-status', discordId] as const;
}

/** Guest / public browse — parity with auth RQ (AC-FE-011). */
export function checkinPublicStatusQueryKey() {
  return ['checkin-status', 'public'] as const;
}

/** FR-6 Should — progressive role-meta by role_id. */
export function roleInfoQueryKey(roleId: string) {
  return ['role-info', roleId] as const;
}

/** hybrid_patch_from_action_response_only — cycle only; preserve siblings */
export function patchCheckinStatusCycle(
  prev: CheckinStatus | undefined,
  cycle: CheckinCycle,
): CheckinStatus | undefined {
  if (!prev) return undefined; // do not create dead/incomplete cache entries
  return {
    daily_rewards: prev.daily_rewards,
    big_reward: prev.big_reward,
    makeup_window_open: prev.makeup_window_open,
    cycle: {
      year: cycle.year,
      month: cycle.month,
      completed_days: cycle.completed_days,
      makeup_days: cycle.makeup_days,
      big_reward_claimed: cycle.big_reward_claimed,
    },
  };
}

export function needsCheckinStatusReconcile(result: {
  big_reward_granted?: boolean;
  reward?: Record<string, unknown>;
}): boolean {
  if (result.big_reward_granted === true) return true;
  const reward = result.reward;
  if (reward && typeof reward === 'object' && 'role_grant_error' in reward) {
    return true;
  }
  return false;
}

type CheckinStatusEdgePayload = {
  ok?: boolean;
  error?: string;
  cycle?: CheckinCycle;
  daily_rewards?: CheckinStatus['daily_rewards'];
  big_reward?: CheckinStatus['big_reward'];
  makeup_window_open?: boolean;
};

/** Auth status queryFn — Bearer + discord_id → CheckinStatus. */
export async function fetchCheckinStatus(discordId: string): Promise<CheckinStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('missing_auth');

  const { data, error } = await supabase.functions.invoke('get-checkin-status', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { discord_id: discordId },
  });

  if (error) throw error;

  const payload = data as CheckinStatusEdgePayload | null | undefined;
  if (!payload?.ok) throw new Error(payload?.error ?? 'fetch_failed');
  if (!payload.cycle) throw new Error('fetch_failed');

  return {
    cycle: payload.cycle,
    daily_rewards: payload.daily_rewards ?? [],
    big_reward: payload.big_reward ?? null,
    makeup_window_open: Boolean(payload.makeup_window_open),
  };
}
