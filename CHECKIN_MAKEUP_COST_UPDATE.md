# Check-in System: Per-Day Makeup Cost Update

## Summary
Modified the check-in system to support **per-day makeup costs** instead of a single global cost. Now admins must configure both the reward AND makeup cost for each individual day (1-28).

## Changes Made

### 1. Database Schema
**New Migration: `20260615000000_add_makeup_cost_per_day.sql`**
- Added `makeup_cost` column to `checkin_daily_rewards` table
- Default value: 50 points
- Validation: must be >= 0

**New Migration: `20260615000001_remove_global_makeup_cost.sql`**
- Removed `makeup_cost_per_day` column from `checkin_big_reward` table
- Updated table comment to reflect new structure

### 2. Edge Functions Updated

#### `get-checkin-status/index.ts`
- Now returns `makeup_cost` per day in `daily_rewards` array
- Removed `makeup_cost_per_day` from `big_reward` response
- Removed deprecated field from query

#### `perform-makeup-checkin/index.ts`
- Loads makeup cost from the specific day's `checkin_daily_rewards` record
- Uses `reward.makeup_cost` instead of global `bigRewardConfig.makeup_cost_per_day`
- Consolidated reward loading (was loading twice, now loads once)

#### `update-checkin-daily-reward/index.ts`
- Added `makeup_cost` parameter to API
- Validates `makeup_cost >= 0`
- Defaults to 50 if not provided
- Saves `makeup_cost` when upserting daily reward

#### `update-checkin-big-reward/index.ts`
- Removed `makeup_cost_per_day` parameter (no longer needed)
- Removed validation for makeup cost
- Simplified payload structure

### 3. Seed Data
**Updated: `20260606000005_seed_checkin_defaults.sql`**
- Seeds all 28 days with default `makeup_cost = 50`
- Removed `makeup_cost_per_day` from big reward insert

## API Changes

### Admin: Update Daily Reward
**Endpoint:** `update-checkin-daily-reward`

**New Request Body:**
```json
{
  "day_number": 1,
  "reward_type": "points",
  "reward_amount": 10,
  "makeup_cost": 50  // ← NEW: per-day makeup cost
}
```

### Admin: Update Big Reward
**Endpoint:** `update-checkin-big-reward`

**Old Request Body:**
```json
{
  "reward_type": "points",
  "reward_amount": 100,
  "description": "...",
  "makeup_cost_per_day": 50  // ← REMOVED
}
```

**New Request Body:**
```json
{
  "reward_type": "points",
  "reward_amount": 100,
  "description": "..."
}
```

### User: Get Check-in Status
**Endpoint:** `get-checkin-status`

**Old Response:**
```json
{
  "daily_rewards": [
    {"day_number": 1, "reward_type": "points", "reward_amount": 10}
  ],
  "makeup_cost_per_day": 50  // ← REMOVED (global)
}
```

**New Response:**
```json
{
  "daily_rewards": [
    {
      "day_number": 1,
      "reward_type": "points",
      "reward_amount": 10,
      "makeup_cost": 50  // ← NEW: per-day cost
    }
  ]
}
```

### User: Perform Makeup Check-in
**Endpoint:** `perform-makeup-checkin`

**No API changes** - still accepts `{discord_id, day_number, year, month}`
- Now uses the specific day's `makeup_cost` instead of global cost

## Migration Path

### For Existing Databases
1. Run `20260615000000_add_makeup_cost_per_day.sql` first
   - Adds column with default value of 50
   - Updates existing rows to 50 points
2. Run `20260615000001_remove_global_makeup_cost.sql` second
   - Removes deprecated column from `checkin_big_reward`

### For Fresh Installations
- All migrations run in order
- Days 1-28 seeded with 50 points makeup cost by default

## Admin Workflow

### Before (Global Cost)
1. Set rewards for days 1-28
2. Set ONE global makeup cost in big reward config

### After (Per-Day Cost)
1. Set rewards AND makeup costs for days 1-28
2. Big reward config only contains the perfect attendance reward

### Example Admin Setup
```typescript
// Day 1: Easy makeup cost
await updateDailyReward({
  day_number: 1,
  reward_type: "points",
  reward_amount: 10,
  makeup_cost: 25  // Cheaper makeup
});

// Day 28: Expensive makeup cost
await updateDailyReward({
  day_number: 28,
  reward_type: "points",
  reward_amount: 50,
  makeup_cost: 100  // More expensive makeup
});
```

## Benefits
1. **Flexibility**: Different days can have different makeup costs
2. **Strategy**: Create incentives (e.g., early days cheaper, later days more expensive)
3. **Balance**: Match makeup cost to reward value
4. **Admin Control**: Fine-tune economy per day

## Notes
- Default makeup cost remains 50 points (no breaking change for existing behavior)
- All validation and security measures remain intact
- Audit logs continue tracking makeup transactions with costs
