// Check-in Flow Optimization integration Test
// Design Doc: checkin-flow-optimization-frontend-design.md (+ backend contracts via hybrid patch)
// UI Spec: checkin-flow-optimization-delta-ui-spec.md
// Generated: 2026-07-22 | Budget Used: integration 3/3, fixture-e2e (see sibling), service-e2e (see sibling)
// Naming: *.int.test.skeleton.ts until implementation — rename to *.int.test.ts when adding describe/it (keeps yarn test green)
// Harness: Vitest + RTL + vi.mock on supabase.functions.invoke (project convention; MSW optional)
// @real-dependency: QueryClient / React Query cache (Do NOT mock QueryClient — FE Design Doc Test Boundaries)
//
// ---------------------------------------------------------------------------
// INT-1 Happy-path claim hybrid patch — 0 get-checkin-status
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
// INT-2 Shared RQ status identity — Home + Full Calendar dual mount
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
// INT-3 MVP reconcile gates only — big_reward_granted / role_grant_error
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
