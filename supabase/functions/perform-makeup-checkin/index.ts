import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";
import { ensureUserPoints } from "../_shared/ensure-user-points.ts";
import { getCheckinToday } from "../_shared/checkin-date.ts";
import { grantBigReward } from "../_shared/checkin-big-reward.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const POINT_COLUMN: Record<string, string> = {
  points: "points",
  ticket_point: "ticket_point",
  ticket_piece_point: "ticket_piece_point",
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { discord_id, day_number, year, month } = await req.json();
    if (!discord_id || day_number == null || year == null || month == null) {
      return json({ ok: false, error: "missing_params" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "missing_auth" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return json({ ok: false, error: "invalid_token" }, 401);

    const userDiscordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (userDiscordId !== discord_id) return json({ ok: false, error: "forbidden" }, 403);

    if (day_number < 1 || day_number > 28) {
      return json({ ok: false, error: "invalid_day" }, 400);
    }

    // Makeup window: must be past day 28 of the current month, same month as target
    const { year: nowYear, month: nowMonth, day: nowDay } = getCheckinToday();

    if (year !== nowYear || month !== nowMonth) {
      return json({ ok: false, error: "makeup_window_expired" }, 400);
    }
    if (nowDay <= 28) {
      return json({ ok: false, error: "makeup_window_not_open" }, 400);
    }

    await ensureUserPoints(sb, discord_id);

    // Load or create cycle (users who never daily-checked-in still need a row for makeup)
    let { data: cycle } = await sb
      .from("checkin_cycles")
      .select("*")
      .eq("discord_id", discord_id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (!cycle) {
      const { data: newCycle, error: insertErr } = await sb
        .from("checkin_cycles")
        .insert({ discord_id, year, month })
        .select()
        .single();
      if (insertErr) throw new Error(insertErr.message);
      cycle = newCycle;
    }

    if (cycle.completed_days.includes(day_number) || cycle.makeup_days.includes(day_number)) {
      return json({ ok: false, error: "day_already_filled" }, 409);
    }

    // Load daily reward for this day to get makeup cost
    const { data: reward } = await sb
      .from("checkin_daily_rewards")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .eq("day_number", day_number)
      .eq("is_active", true)
      .maybeSingle();

    if (!reward) {
      return json({ ok: false, error: "reward_not_configured" }, 404);
    }

    const costPerDay: number = reward.makeup_cost ?? 50;

    // Deduct points atomically with optimistic lock
    const { data: userPoints } = await sb
      .from("user_points")
      .select("points")
      .eq("discord_id", discord_id)
      .maybeSingle();

    const currentPoints: number = (userPoints as unknown as Record<string, number>)?.points ?? 0;
    if (currentPoints < costPerDay) {
      return json({ ok: false, error: "insufficient_points", required: costPerDay, current: currentPoints }, 400);
    }

    const { error: deductErr } = await sb
      .from("user_points")
      .update({ points: currentPoints - costPerDay })
      .eq("discord_id", discord_id)
      .eq("points", currentPoints); // optimistic lock

    if (deductErr) {
      return json({ ok: false, error: "points_deduction_conflict" }, 409);
    }

    // Grant the daily reward
    const rewardSnapshot: Record<string, unknown> = {};

    if (reward) {
      rewardSnapshot.reward_type = reward.reward_type;

      if (reward.reward_type in POINT_COLUMN) {
        const col = POINT_COLUMN[reward.reward_type];
        const amount: number = reward.reward_amount ?? 0;
        rewardSnapshot.reward_amount = amount;

        const { data: up } = await sb
          .from("user_points")
          .select(col)
          .eq("discord_id", discord_id)
          .maybeSingle();

        const current = (up as unknown as Record<string, number>)?.[col] ?? 0;
        await sb
          .from("user_points")
          .update({ [col]: current + amount })
          .eq("discord_id", discord_id);
      } else if (reward.reward_type === "role" && reward.role_id) {
        rewardSnapshot.role_id = reward.role_id;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const grantRes = await discordFetch(
          `${supabaseUrl}/functions/v1/grant-discord-role`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeader },
            body: JSON.stringify({ discordUserId: discord_id, discordRoleId: reward.role_id }),
          },
        );
        if (!grantRes.ok) {
          const errBody = await grantRes.json().catch(() => ({}));
          rewardSnapshot.role_grant_error = (errBody as Record<string, string>).error ?? "unknown";
        }
      }
    }

    // Append day to makeup_days
    const updatedMakeup = [...cycle.makeup_days, day_number];
    await sb
      .from("checkin_cycles")
      .update({ makeup_days: updatedMakeup })
      .eq("id", cycle.id);

    await sb.from("checkin_logs").insert({
      discord_id,
      year,
      month,
      day_number,
      action: "makeup",
      reward_type: reward?.reward_type ?? null,
      reward_value: rewardSnapshot,
      points_cost: costPerDay,
    });

    // Check big reward
    const allDays = new Set([...cycle.completed_days, ...updatedMakeup]);
    let bigRewardGranted = false;

    if (allDays.size === 28 && !cycle.big_reward_claimed) {
      bigRewardGranted = await grantBigReward(sb, discord_id, authHeader, cycle.id, year, month);
    }

    // Return updated points balance
    const { data: finalPoints } = await sb
      .from("user_points")
      .select("points, ticket_point, ticket_piece_point")
      .eq("discord_id", discord_id)
      .maybeSingle();

    return json({
      ok: true,
      reward: rewardSnapshot,
      points_spent: costPerDay,
      points_now: finalPoints ?? {},
      cycle: {
        year,
        month,
        completed_days: cycle.completed_days,
        makeup_days: updatedMakeup,
        big_reward_claimed: bigRewardGranted ? true : cycle.big_reward_claimed,
      },
      big_reward_granted: bigRewardGranted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
