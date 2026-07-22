// Check-in Flow Optimization service-integration-e2e Test
// Design Doc: checkin-flow-optimization-backend-design.md (+ FE hybrid patch consumer contract)
// ADR: ADR-0001-checkin-hybrid-patch-shared-cache.md
// Generated: 2026-07-22 | Budget Used: service-integration-e2e 1/2 (1 reserved; no additional ROI>50)
// Naming: *.service.e2e.test.skeleton.ts until implementation — rename to *.service.e2e.test.ts when adding describe/it
// Harness: Local Supabase stack (db + functions serve) — real PostgREST; stub Discord grant
// @real-dependency: Postgres / local Supabase (Do NOT mock DB for contract soak — BE Design Doc Test Boundaries)
// @mock-boundary: Discord role grant / discordFetch (Yes — assert role_grant_error nesting); auth.getUser may use real local JWT or stub only for pure auth-order unit checks
//
// ---------------------------------------------------------------------------
// SE2E-1 [RESERVED] Local-stack claim contract + get-checkin-status Promise.all equivalence
// ---------------------------------------------------------------------------
// Multi-step service journey: auth status load → perform-checkin (persist cycle) → optional status reconcile on MVP flags;
//               FR-7 Should: parallel status reads remain field-equivalent to sequential baseline
// AC-BE-001: "When an authenticated get-checkin-status request passes auth, the system shall fetch checkin_cycles, checkin_daily_rewards, and checkin_big_reward concurrently (e.g. Promise.all), not as three dependent sequential awaits." (Should)
// AC-BE-002: parallel success returns same logical shape: ok, cycle, daily_rewards, big_reward, makeup_window_open
// AC-BE-003 (boundary): auth errors (missing_auth / invalid_token / forbidden) occur before DB reads
// AC-BE-004: perform-checkin success returns ok, reward, cycle { year, month, completed_days, makeup_days, big_reward_claimed }, big_reward_granted
// AC-BE-006: role grant failure still ok:true with reward.role_grant_error string (Discord stubbed)
// AC-BE-007: 28th day union grant success → big_reward_granted true and cycle.big_reward_claimed true
// FE enablement: happy-path FE requires 0 mandatory get-checkin-status after action except MVP triggers (verified in fixture-e2e; here prove edge payloads make that safe)
// ROI: 81 (BV:9 × Freq:8 + Legal:0 + Defect:9) — reserved: correctness depends on real DB persistence + edge contracts fixture-e2e cannot prove
// Behavior: Against local Supabase, authenticated claim writes checkin_cycles day membership and returns patchable cycle/flags; get-checkin-status after auth overlaps independent selects without shape drift; auth failures never hit user/config reads
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: full-system: get-checkin-status, perform-checkin, perform-makeup-checkin (optional), grantBigReward, local Postgres tables checkin_cycles / checkin_daily_rewards / checkin_big_reward / user_points
// @complexity: high
// Primary failure mode: action omits/breaks cycle fields or reconcile flags so FE hybrid patch is unsafe; OR Promise.all changes success JSON semantics; OR auth runs after DB reads; OR day not persisted in DB despite ok:true
// Proof obligation: (1) Real DB: after perform-checkin ok, checkin_cycles row contains the claimed day in completed_days (persistence). (2) Response includes patchable cycle + boolean big_reward_granted. (3) With Discord stub failing role grant, ok:true and reward.role_grant_error nested string. (4) When FR-7 polish is deployed, capture get-checkin-status JSON for known user and assert field-equivalence to sequential baseline on cycle / daily_rewards / big_reward / makeup_window_open. (5) Boundary path: unauthorized invoke returns missing_auth|invalid_token|forbidden with zero dependent table reads (auth-before-DB) — must fail if reads move before auth even when happy-path claim stays green. (6) Optional high-value path: 28-day fixture → big_reward_granted true + claimed flag.
// Verification points:
// - DB row / PostgREST select confirms day membership after claim
// - Action JSON contract checklist (cycle fields + flags) matches AC-BE-004/006/007
// - Status success JSON deep-equal (field semantics) vs baseline when Promise.all applied
// - Auth-negative: error codes before DB (logs/instrumentation or query spy)
// - Guest public table reads remain available (non-regression smoke; edges stay auth-only for status)
// Expected results: Persisted cycle + stable hybrid-patch contracts + parallel status equivalence + auth-before-DB
// Pass criteria: Persistence + payload + (when FR-7 shipped) shape equivalence + auth-before-DB boundary all pass on local stack
//
// Note: No second service-integration-e2e emitted — remaining candidates (isolated auth-before-DB-only ROI ~41) are below ROI>50 additional-slot threshold and are covered as boundary path in SE2E-1.
