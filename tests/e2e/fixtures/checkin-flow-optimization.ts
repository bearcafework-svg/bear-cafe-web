/**
 * Reusable Arrange fixtures for check-in flow optimization fixture-e2e (FE2E-1/2/3).
 *
 * Cycle field names align with BE contract / FE Data Contracts:
 * `{ year, month, completed_days, makeup_days, big_reward_claimed }`.
 *
 * Do not mock QueryClient here — later FE2E keeps a real shared cache.
 */
import type {
  CheckinBigReward,
  CheckinCycle,
  CheckinDailyReward,
  CheckinStatus,
} from '@/lib/checkin';

export const fixtureDiscordId = 'fixture-discord-checkin-001';

export const FIXTURE_YEAR = 2026;
export const FIXTURE_MONTH = 7;
/** Day claimed on happy-path FE2E-1 Arrange. */
export const FIXTURE_CLAIM_DAY = 2;
/** Past day used for makeup happy-path Arrange. */
export const FIXTURE_MAKEUP_DAY = 1;

export type CheckinActionOkPayload = {
  ok: true;
  cycle: CheckinCycle;
  reward?: Record<string, unknown>;
  big_reward_granted?: boolean;
  points_spent?: number;
  points_now?: Record<string, unknown>;
};

export type CheckinActionFailPayload = {
  ok: false;
  error: string;
};

export type CheckinActionPayload = CheckinActionOkPayload | CheckinActionFailPayload;

export type CheckinStatusOkPayload = {
  ok: true;
  cycle: CheckinCycle;
  daily_rewards: CheckinDailyReward[];
  big_reward: CheckinBigReward | null;
  makeup_window_open: boolean;
};

/** Minimal auth-context / getSession shape for FE2E auth present Arrange. */
export type FixtureAuthSession = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: { id: string };
};

export type FixtureAuthUser = {
  id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  discord_id: string;
  is_admin: boolean;
  is_owner: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  allowed_pages: string[];
};

export type FixtureAuthState = {
  discordId: string | undefined;
  session: FixtureAuthSession | null;
  user: FixtureAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

// ---------------------------------------------------------------------------
// Shared builders (deduped payload construction)
// ---------------------------------------------------------------------------

export function buildCheckinCycle(
  overrides: Partial<CheckinCycle> = {},
): CheckinCycle {
  return {
    year: FIXTURE_YEAR,
    month: FIXTURE_MONTH,
    completed_days: [],
    makeup_days: [],
    big_reward_claimed: false,
    ...overrides,
  };
}

export function buildDailyRewards(
  count = 3,
): CheckinDailyReward[] {
  return Array.from({ length: count }, (_, i) => {
    const day_number = i + 1;
    return {
      day_number,
      reward_type: 'points' as const,
      reward_amount: 10 * day_number,
      role_id: null,
      makeup_cost: 5,
      is_active: true,
    };
  });
}

export function buildBigReward(
  overrides: Partial<CheckinBigReward> = {},
): CheckinBigReward {
  return {
    reward_type: 'role',
    reward_amount: null,
    role_id: 'fixture-big-reward-role',
    description: 'Fixture big reward',
    ...overrides,
  };
}

export function buildCheckinStatus(
  overrides: Partial<CheckinStatus> = {},
): CheckinStatus {
  return {
    cycle: buildCheckinCycle(),
    daily_rewards: buildDailyRewards(),
    big_reward: buildBigReward(),
    makeup_window_open: true,
    ...overrides,
  };
}

export function buildPointsReward(dayNumber: number): Record<string, unknown> {
  return {
    reward_type: 'points',
    reward_amount: 10 * dayNumber,
  };
}

function buildActionOk(
  cycle: CheckinCycle,
  extras: Omit<CheckinActionOkPayload, 'ok' | 'cycle'> = {},
): CheckinActionOkPayload {
  return {
    ok: true,
    cycle,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Auth session present / absent (FE2E-1 auth member; FE2E-3 guest)
// ---------------------------------------------------------------------------

export const authSessionPresent: FixtureAuthState = {
  discordId: fixtureDiscordId,
  isAuthenticated: true,
  isLoading: false,
  session: {
    access_token: 'fixture-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fixture-refresh-token',
    user: { id: 'fixture-user-uuid' },
  },
  user: {
    id: 'fixture-user-uuid',
    username: 'Fixture Member',
    discord_username: 'fixture_member',
    avatar_url: null,
    banner_url: null,
    discord_id: fixtureDiscordId,
    is_admin: false,
    is_owner: false,
    is_banned: false,
    ban_reason: null,
    allowed_pages: [],
  },
};

export const authSessionAbsent: FixtureAuthState = {
  discordId: undefined,
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

// ---------------------------------------------------------------------------
// Status seeds (auth member before claim; guest public)
// ---------------------------------------------------------------------------

/** Auth member Ready status before FE2E-1 claim (day 2 not yet completed). */
export const memberCheckinStatusBeforeClaim: CheckinStatus = buildCheckinStatus({
  cycle: buildCheckinCycle({ completed_days: [] }),
});

/** Edge-shaped get-checkin-status success wrapping the member seed. */
export const memberGetCheckinStatusOk: CheckinStatusOkPayload = {
  ok: true,
  ...memberCheckinStatusBeforeClaim,
};

/**
 * Guest public aggregate (checkinPublicStatusQueryKey shape).
 * Empty completed_days; public rewards visible; claim gated by auth-absent.
 */
export const guestPublicCheckinStatus: CheckinStatus = buildCheckinStatus({
  cycle: buildCheckinCycle({
    completed_days: [],
    makeup_days: [],
    big_reward_claimed: false,
  }),
  makeup_window_open: true,
});

/** Row payloads for public table / queryFn Arrange (guest path). */
export const guestPublicDailyRewards: CheckinDailyReward[] =
  guestPublicCheckinStatus.daily_rewards;

export const guestPublicBigReward: CheckinBigReward | null =
  guestPublicCheckinStatus.big_reward;

// ---------------------------------------------------------------------------
// Action payloads — happy path, MVP A/B, control (FE2E-1 / FE2E-2)
// ---------------------------------------------------------------------------

/** FB-CLAIM-OK: today claim ok + cycle, no MVP reconcile triggers. */
export const happyPathClaimOk: CheckinActionOkPayload = buildActionOk(
  buildCheckinCycle({
    completed_days: [FIXTURE_CLAIM_DAY],
    makeup_days: [],
    big_reward_claimed: false,
  }),
  {
    reward: buildPointsReward(FIXTURE_CLAIM_DAY),
    big_reward_granted: false,
  },
);

/** Makeup happy path (AC-FE-005): cycle with makeup_days + points fields; no MVP flags. */
export const happyPathMakeupOk: CheckinActionOkPayload = buildActionOk(
  buildCheckinCycle({
    completed_days: [],
    makeup_days: [FIXTURE_MAKEUP_DAY],
    big_reward_claimed: false,
  }),
  {
    reward: buildPointsReward(FIXTURE_MAKEUP_DAY),
    big_reward_granted: false,
    points_spent: 5,
    points_now: { points: 95, ticket_point: 0, ticket_piece_point: 0 },
  },
);

/** FE2E-2 Fixture A — big_reward_granted requires non-blocking get-checkin-status. */
export const mvpFixtureABigRewardGranted: CheckinActionOkPayload = buildActionOk(
  buildCheckinCycle({
    completed_days: Array.from({ length: 28 }, (_, i) => i + 1),
    makeup_days: [],
    big_reward_claimed: true,
  }),
  {
    reward: buildPointsReward(28),
    big_reward_granted: true,
  },
);

/** FE2E-2 Fixture B — reward.role_grant_error requires non-blocking get-checkin-status. */
export const mvpFixtureBRoleGrantError: CheckinActionOkPayload = buildActionOk(
  buildCheckinCycle({
    completed_days: [FIXTURE_CLAIM_DAY],
    makeup_days: [],
    big_reward_claimed: false,
  }),
  {
    reward: {
      reward_type: 'role',
      role_id: 'fixture-day-role',
      role_grant_error: 'discord_failed',
    },
    big_reward_granted: false,
  },
);

/**
 * FE2E-2 control — neither MVP flag; must keep 0 get-checkin-status after action
 * so always-reconcile regressions fail.
 */
export const mvpControlClaimOk: CheckinActionOkPayload = happyPathClaimOk;

/** Named aliases matching skeleton Preconditions wording. */
export const fixturesForFe2e = {
  /** FE2E-1: auth + claim ok → warm calendar */
  fe2e1: {
    auth: authSessionPresent,
    statusBefore: memberCheckinStatusBeforeClaim,
    statusOk: memberGetCheckinStatusOk,
    claimOk: happyPathClaimOk,
  },
  /** FE2E-2: MVP A / B / control */
  fe2e2: {
    auth: authSessionPresent,
    fixtureA: mvpFixtureABigRewardGranted,
    fixtureB: mvpFixtureBRoleGrantError,
    control: mvpControlClaimOk,
  },
  /** FE2E-3: guest public + auth absent */
  fe2e3: {
    auth: authSessionAbsent,
    publicStatus: guestPublicCheckinStatus,
    dailyRewards: guestPublicDailyRewards,
    bigReward: guestPublicBigReward,
  },
} as const;
