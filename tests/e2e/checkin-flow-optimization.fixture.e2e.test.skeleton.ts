// Check-in Flow Optimization fixture-e2e Test
// Design Doc: checkin-flow-optimization-frontend-design.md
// UI Spec: checkin-flow-optimization-delta-ui-spec.md (S-01 ↔ S-02, FB-*, skeleton contract)
// Generated: 2026-07-22 | Budget Used: fixture-e2e 3/3 (1 reserved journey + 2 ROI≥20)
// Naming: *.fixture.e2e.test.skeleton.ts until implementation — rename to *.fixture.e2e.test.ts when adding describe/it
// Harness: Vitest + RTL + MemoryRouter (project has no Playwright; adapt browser journey in jsdom)
//            Mock backend via vi.mock / fixture invoke handlers — no live Supabase
// Arrange fixtures (T0.3): tests/e2e/fixtures/checkin-flow-optimization.ts
//            + invoke router: tests/e2e/fixtures/checkin-invoke-mock.ts
//            (happy claim/makeup, MVP A/B/control, guest public, auth present/absent)
// @real-dependency: QueryClient (real shared cache); App routes / MemoryRouter for S-01→S-02
//
// ---------------------------------------------------------------------------
// FE2E-1 [RESERVED] Home claim → Full Calendar warm shared cache
// ---------------------------------------------------------------------------
// Screen Transition: S-06 skeleton → S-01 DailyCheckinCard → claim FB-CLAIM-OK → S-02 FullCheckInCalendar
// AC-FE-004: claim patches cycle without awaiting get-checkin-status
// AC-FE-008: "When a member claims on Home then opens Full Calendar within staleTime with warm cache, the system shall show the updated cycle without requiring a cold get-checkin-status as the only way to see the claim."
// AC-FE-001 / UI Spec skeleton contract: claim must not re-show day-row skeletons (isInitialLoad / no-data only)
// AC-FE-009: both surfaces observe same authoritative status
// UI Spec golden states 2 + 5; FB-CLAIM-OK
// ROI: 85 (BV:9 × Freq:8 + Legal:0 + Defect:9) — reserved multi-step user-facing journey (emitted regardless of ROI)
// Behavior: Auth member on Home → claim today ok → day completed + reward modal + progress update with 0 status refetch → navigate /full-checkin-calendar → same completed day visible from warm RQ cache
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend): DailyCheckinCard, FullCheckInCalendar, App routes, useCheckinFlow, shared RQ
// @complexity: high
// @mock-boundary: supabase.functions.invoke / status queryFn (Yes fixtures); QueryClient (No / real)
// Primary failure mode: Calendar cold-loads or misses Home patch; or claim re-flashes CheckInDayCardSkeleton; or claim still awaits get-checkin-status before modal/day update
// Proof obligation: Traverse S-01 claim → S-02 navigation with state carried in shared RQ. Assert (1) after claim, get-checkin-status count attributable to action === 0, (2) today/selected day shows completed without CheckInDayCardSkeleton remount flash, (3) CheckinRewardModal opens from action payload, (4) after navigate to Full Calendar within staleTime (60s), completed_days visible without requiring a cold status-only path. Boundary path: skeleton forever contract on claim (AC-FE-001 content rule) must be asserted — main claim success alone must not stay green if day skeletons reappear.
// Verification points:
// - Initial content skeletons clear once; claim does not remount day-row skeletons
// - Network spy: 0 get-checkin-status after happy-path claim
// - Day cell + CheckinBigRewardPreview update in same beat as modal open
// - S-02 shows same completed set from cache
// Expected results: FB-CLAIM-OK + warm cross-surface consistency + no skeleton re-flash
// Pass criteria: All verification points hold under fixture-driven auth + action responses
//
// ---------------------------------------------------------------------------
// FE2E-2 MVP reconcile UI — success first, then required get-checkin-status
// ---------------------------------------------------------------------------
// Screen Transition: S-01 or S-02 → S-03 (or makeup S-05) success UI → background reconcile (non-blocking)
// AC-FE-006 / UI Spec AC-006 / FB-BIG-REWARD / FB-ROLE-GRANT-ERR
// ROI: 63 (BV:9 × Freq:6 + Legal:0 + Defect:9) — ≥20 additional slot
// Behavior: Claim/makeup ok with big_reward_granted OR role_grant_error → success modal/toast visible first → ≥1 get-checkin-status via refetchQueries without blocking success UI
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend): useCheckinFlow, success modals/toasts, refetchQueries
// @complexity: high
// @mock-boundary: supabase.functions.invoke (Yes — fixtures with/without MVP flags)
// Primary failure mode: success UI blocked on status round-trip, OR MVP flags do not trigger get-checkin-status after refresh removal
// Proof obligation: Fixture A big_reward_granted=true and Fixture B reward.role_grant_error set — for each, assert success UI appears before reconcile settles and spy get-checkin-status ≥ 1. Boundary path: control fixture without flags must keep 0 status calls so always-reconcile regressions fail this test.
// Verification points:
// - Success modal or toast present without waiting for status resolve
// - get-checkin-status ≥ 1 when either MVP flag present
// - get-checkin-status === 0 when neither flag present
// - Claimed badge / role-grant UI may converge after reconcile (non-blocking)
// Expected results: FB-BIG-REWARD / FB-ROLE-GRANT-ERR catalog behavior
// Pass criteria: Both MVP fixtures + control fixture pass
//
// ---------------------------------------------------------------------------
// FE2E-3 Guest path non-regression — public rewards, claim gated
// ---------------------------------------------------------------------------
// Screen Transition: S-06 → S-01 (guest) / S-02 (guest)
// AC-FE-011: "When a guest loads Home or Full Calendar, the system shall show public rewards after skeleton and keep claim gated."
// AC-FE-001 (guest skeleton → content swap preserved)
// Backend BE-FR-3 / guest direct table reads unchanged by edge auth work
// ROI: 36 (BV:6 × Freq:5 + Legal:0 + Defect:6) — ≥20 additional slot
// Behavior: Unauthenticated guest → skeleton then public daily_rewards / big_reward via checkinPublicStatusQueryKey → claim CTA gated (login), no authenticated get-checkin-status / perform-checkin
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked public table reads / queryFn); guest auth state
// @complexity: medium
// @mock-boundary: public reward fetches (Yes fixtures); auth session absent; do not call auth edges
// Primary failure mode: guest path broken by RQ migration (blank rewards, false claim enabled, or accidental auth edge invoke)
// Proof obligation: Guest mount Home (and Calendar if in scope) with checkinPublicStatusQueryKey data; assert public rewards visible after skeleton and claim remains gated. Boundary path: assert no perform-checkin / get-checkin-status auth invokes for guest browse — auth-only edge regression must fail even if authenticated happy path stays green.
// Verification points:
// - After skeleton, public reward content visible
// - Claim requires login / is gated for guest
// - No authenticated get-checkin-status or perform-* invokes during guest browse
// Expected results: Guest browse non-regressing under shared RQ public key
// Pass criteria: Home guest path passes; Calendar guest parity if both surfaces exposed to guests
