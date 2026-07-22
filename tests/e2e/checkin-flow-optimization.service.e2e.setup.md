# SE2E-1 — Local stack env prerequisites

**Lane:** service-integration-e2e  
**Skeleton:** `tests/e2e/checkin-flow-optimization.service.e2e.test.skeleton.ts`  
**Design Doc:** `docs/design/checkin-flow-optimization-backend-design.md` (§ Test Boundaries, § Verification Strategy)  
**General local edge setup:** `supabase/functions/README.md`

**Mock boundary (frozen):** Postgres / PostgREST = **real** (do not mock). Discord role grant / `discordFetch` = **stubbed** so AC-BE-006 can assert `reward.role_grant_error` nesting.

**Residual:** Runnable `describe`/`it` for SE2E-1 is deferred to Final QA (TQA.1). This doc only makes Arrange reachable.

---

## Quick readiness check (copy-paste)

```bash
# From repo root
npm run supabase:status
# Expect JSON with API_URL http://127.0.0.1:54321 and DB_URL …:54322

# Functions must respond (401 without JWT is healthy for auth-before-DB)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST 'http://127.0.0.1:54321/functions/v1/get-checkin-status' \
  -H 'Content-Type: application/json' -d '{}'
# Expect: 401

# Current year/month daily rewards (28 rows)
YEAR=$(date +%Y); MONTH=$(date +%-m)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT year, month, COUNT(*) FROM checkin_daily_rewards
   WHERE year=$YEAR AND month=$MONTH GROUP BY 1,2;"
# Expect: count = 28
```

| Check | Healthy signal | If blocked |
|-------|----------------|------------|
| Docker / OrbStack running | `docker info` succeeds | Start Docker; else use **Staging fallback** below |
| `supabase status` | Keys + `API_URL` / `DB_URL` printed | `npm run supabase:start` |
| Functions serve | `get-checkin-status` → **401** without auth | Ensure `supabase:start` finished (it runs `functions serve --env-file ./supabase/functions/.env`) |
| Seeds for current month | 28 `checkin_daily_rewards` rows | Re-seed (see § Seed rewards) |
| `.env` for functions | `supabase/functions/.env` exists | `cp supabase/functions/.env.example supabase/functions/.env` then fill keys |

**Status snapshot (T0.4, 2026-07-22):** Local stack **available** — `supabase status` returned demo keys; `checkin_daily_rewards` had 28 rows for `2026-7`; `checkin_big_reward` rows present for 2026-7/8/9; unauthenticated `get-checkin-status` returned **401**. No escalate required for local Arrange at that time. Re-run the quick check before Final QA.

---

## 1. Start local Supabase + serve functions

Canonical script (start + permissions + serve):

```bash
cp supabase/functions/.env.example supabase/functions/.env   # once
# Fill SUPABASE_* + Discord vars from team lead / `supabase status` local keys — never commit secrets

npm run supabase:start
```

What `package.json` `supabase:start` does:

1. `npx supabase start`
2. `npx supabase db query --local --file ./supabase/dev/grant_all_table_permissions.sql`
3. `npx supabase functions serve --env-file ./supabase/functions/.env`

Useful companions:

```bash
npm run supabase:status
npm run supabase:stop
npm run supabase:reset    # WARNING: wipes local DB; re-applies migrations + permissions
```

More detail: `supabase/functions/README.md`.

### Serve / env vars required for check-in edges

From `supabase/functions/.env.example` (values via Secret Store / local `.env` only):

| Var | Why SE2E needs it |
|-----|-------------------|
| `SUPABASE_URL` | Edge clients + `grantBigReward` / role grant URL (`http://127.0.0.1:54321`) |
| `SUPABASE_ANON_KEY` | Client-style invokes if used |
| `SUPABASE_SERVICE_ROLE_KEY` | Service client inside edges (auth.getUser, table writes) |
| `DISCORD_BOT_TOKEN` | Real Discord path; leave invalid / unused when stubbing grant |
| `DISCORD_GUILD_ID` | Used by `grant-discord-role` when not stubbed |
| `ALLOWED_ORIGINS` | CORS for browser invokes (optional for curl-based SE2E) |

After `supabase status`, paste local anon + service_role into `.env` if empty.

---

## 2. Seed rewards (current year / month)

**Schema tables:** `checkin_daily_rewards`, `checkin_big_reward` (both keyed by `year` + `month`).

### Preferred: migrations already applied on `supabase start` / `reset`

| Artifact | Path | What it does |
|----------|------|----------------|
| Legacy defaults | `supabase/migrations/20260606000005_seed_checkin_defaults.sql` | Historical day/big defaults (pre year-month uniqueness) |
| Month window seed | `supabase/migrations/20260615000003_seed_next_months_rewards.sql` | Inserts 28 daily rewards for **current month + next 2** (`ON CONFLICT DO NOTHING`) |
| Big reward year/month | `supabase/migrations/20260629000000_add_year_month_to_big_reward.sql` | Adds year/month + seeds nearby months |

After reset, confirm current month:

```bash
YEAR=$(date +%Y); MONTH=$(date +%-m)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres <<SQL
SELECT year, month, COUNT(*) AS days
FROM checkin_daily_rewards WHERE year=$YEAR AND month=$MONTH GROUP BY 1,2;
SELECT year, month, reward_type, reward_amount, role_id
FROM checkin_big_reward WHERE year=$YEAR AND month=$MONTH;
SQL
```

### Optional admin edge (document invocation only)

```bash
# Requires admin/moderator JWT — fills missing day_number rows (legacy shape; prefer SQL month seed above)
curl -s -X POST 'http://127.0.0.1:54321/functions/v1/seed-checkin-daily-rewards' \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H 'Content-Type: application/json'
```

Source: `supabase/functions/seed-checkin-daily-rewards/index.ts`.

### Manual SQL if current month missing (copy-paste)

```bash
YEAR=$(date +%Y); MONTH=$(date +%-m)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres <<SQL
INSERT INTO public.checkin_daily_rewards
  (year, month, day_number, reward_type, reward_amount, makeup_cost, is_active)
SELECT $YEAR, $MONTH, day_number, 'points'::public.checkin_reward_type, 10, 50, true
FROM generate_series(1, 28) AS day_number
ON CONFLICT (year, month, day_number) DO NOTHING;

INSERT INTO public.checkin_big_reward
  (year, month, reward_type, reward_amount, description)
VALUES ($YEAR, $MONTH, 'points'::public.checkin_reward_type, 100,
        'Perfect attendance reward — checked in all 28 days!')
ON CONFLICT (year, month) DO NOTHING;
SQL
```

**AC-BE-006 role-failure Arrange:** for one day (or big reward), set `reward_type = 'role'` and a dummy `role_id`, then use the Discord stub (§ 4) so `perform-checkin` still returns `ok: true` with `reward.role_grant_error` string.

**AC-BE-007 28th-day Arrange:** ensure days 1–27 already in `checkin_cycles.completed_days` for the test user/month, then claim day 28 (points big reward is fine for `big_reward_granted`).

---

## 3. Test user + `user_points`

Edges call `ensureUserPoints` (`supabase/functions/_shared/ensure-user-points.ts`) which upserts `user_points` on `discord_id`. Explicit seed still helps Arrange / makeup balances:

```bash
# Replace TEST_DISCORD_ID with the Discord id in the JWT user_metadata
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres <<SQL
INSERT INTO public.user_points (discord_id, points, ticket_point, ticket_piece_point)
VALUES ('TEST_DISCORD_ID', 1000, 0, 0)
ON CONFLICT (discord_id) DO UPDATE
  SET points = GREATEST(user_points.points, EXCLUDED.points);
SQL
```

### Auth JWT for authenticated invoke

SE2E-1 needs a Bearer JWT whose `user_metadata.discord_id` (or `provider_id`) matches the body `discord_id` and the `user_points` / cycle rows.

Options:

1. Sign in via local app (`yarn dev` + Discord OAuth per `supabase/functions/README.md`) and copy the session access token.
2. Create a local Auth user and set `raw_user_meta_data` → `{ "discord_id": "TEST_DISCORD_ID" }` in Studio (`http://127.0.0.1:54323`), then obtain a JWT.

Smoke invoke (expect `ok: true` or a domain error — not `missing_auth` / `invalid_token`):

```bash
curl -s -X POST 'http://127.0.0.1:54321/functions/v1/get-checkin-status' \
  -H "Authorization: Bearer <MEMBER_JWT>" \
  -H 'Content-Type: application/json' \
  -d '{"discord_id":"TEST_DISCORD_ID"}'
```

Auth-negative (AC-BE-003): omit Authorization → `missing_auth` | `invalid_token` | `forbidden` with **no** dependent table reads.

---

## 4. Discord grant stub (`role_grant_error`)

**Production path:** `perform-checkin` / makeup role rewards call `discordFetch` → `…/functions/v1/grant-discord-role` (`supabase/functions/perform-checkin/index.ts`). On `!grantRes.ok`, snapshot sets `reward.role_grant_error` from JSON `error` (else `"unknown"`). Big-reward role path: `supabase/functions/_shared/checkin-big-reward.ts` → same grant edge via `discordFetch`.

**Stub strategies (pick one for Final QA; do not change production edge behavior in T0.4):**

| Strategy | How | Assert |
|----------|-----|--------|
| **A. Invalid bot token (local)** | Keep `DISCORD_BOT_TOKEN` empty/wrong in `.env`; configure a day reward as `reward_type='role'` + fake `role_id`; claim that day | `ok: true`, `reward.role_grant_error` is a string (e.g. Discord / grant error code) |
| **B. Test double at `discordFetch`** | When implementing `*.service.e2e.test.ts`, inject/mock `discordFetch` (or grant edge) to return `{ ok: false, json: async () => ({ error: 'discord_failed' }) }` | Nested `role_grant_error === 'discord_failed'` |
| **C. Staging forced failure** | Non-prod checklist step 4 in BE Verification Strategy | Same nesting on staging invoke |

Do **not** mock Postgres / PostgREST for persistence proof.

---

## 5. SE2E-1 Arrange → Act map (for Final QA)

| Proof (from skeleton) | Arrange need | Act / assert |
|-----------------------|--------------|--------------|
| (1) Persistence | Seeds + JWT + user_points | After `perform-checkin` ok, `checkin_cycles.completed_days` contains claimed day |
| (2) Patchable cycle | Same | Response has `cycle` + boolean `big_reward_granted` |
| (3) `role_grant_error` | Role-type day + Discord stub | `ok: true` and `reward.role_grant_error` string |
| (4) Promise.all equivalence | FR-7 deployed; known user | Status JSON field-eq baseline on `cycle` / `daily_rewards` / `big_reward` / `makeup_window_open` |
| (5) Auth-before-DB | No/invalid JWT | Error codes; zero dependent reads |
| (6) Day 28 big grant | 27 days pre-claimed | `big_reward_granted === true` and `cycle.big_reward_claimed === true` |

Rename when implementing:  
`checkin-flow-optimization.service.e2e.test.skeleton.ts` → `checkin-flow-optimization.service.e2e.test.ts`

---

## Staging fallback (if local stack blocked)

Use when Docker / CLI / seeds cannot reach authenticated invoke. Source: Backend Design Doc **Verification Strategy** L1 checklist (required without Deno CI):

1. Capture sequential baseline `get-checkin-status` JSON for a known staging user.
2. Deploy parallel version (when FR-7 scheduled); capture again; diff fields (`cycle`, `daily_rewards`, `big_reward`, `makeup_window_open`).
3. Invoke claim (points reward) → assert cycle arrays + `big_reward_granted === false`.
4. Invoke claim/makeup with stubbed/forced role failure in non-prod → assert `reward.role_grant_error` string.
5. Complete 28 days in test month → assert `big_reward_granted === true`.
6. Unauthorized invoke → still 401/403 (auth-before-DB).

Record evidence path in Final QA completion notes. Must FE hybrid-patch path continues even if SE2E local is escalated; Final QA owns staging evidence.

---

## Out of scope (T0.4)

- No `Promise.all` / action edge behavior changes
- No production Discord stub code in repo
- No renaming or implementing the service-e2e skeleton (Final QA)
