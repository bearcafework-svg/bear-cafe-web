import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";
import { ensureUserPoints } from "../_shared/ensure-user-points.ts";
import { getCheckinToday } from "../_shared/checkin-date.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// Maps reward_type to the user_points column name
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
    const { discord_id, day_number } = await req.json();
    if (!discord_id || day_number == null) {
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

    const { year, month, day: todayDay } = getCheckinToday();

    if (day_number !== todayDay) {
      return json({ ok: false, error: "day_mismatch" }, 400);
    }

    await ensureUserPoints(sb, discord_id);

    // Load or create cycle
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

    if (cycle.completed_days.includes(day_number)) {
      return json({ ok: false, error: "already_checked_in" }, 409);
    }

    // Load daily reward for this day
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

    // Grant reward
    const rewardSnapshot: Record<string, unknown> = { reward_type: reward.reward_type };

    if (reward.reward_type in POINT_COLUMN) {
      const col = POINT_COLUMN[reward.reward_type];
      const amount = reward.reward_amount ?? 0;
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

    // Append day to completed_days
    const updatedCompleted = [...cycle.completed_days, day_number];
    await sb
      .from("checkin_cycles")
      .update({ completed_days: updatedCompleted })
      .eq("id", cycle.id);

    // Write audit log
    await sb.from("checkin_logs").insert({
      discord_id,
      year,
      month,
      day_number,
      action: "daily",
      reward_type: reward.reward_type,
      reward_value: rewardSnapshot,
    });

    // Check big reward: all 28 days filled
    const allDays = new Set([...updatedCompleted, ...cycle.makeup_days]);
    let bigRewardGranted = false;

    if (allDays.size === 28 && !cycle.big_reward_claimed) {
      bigRewardGranted = await grantBigReward(sb, discord_id, authHeader, cycle.id, year, month);
    }

    return json({
      ok: true,
      reward: rewardSnapshot,
      cycle: {
        year,
        month,
        completed_days: updatedCompleted,
        makeup_days: cycle.makeup_days,
        big_reward_claimed: bigRewardGranted ? true : cycle.big_reward_claimed,
      },
      big_reward_granted: bigRewardGranted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});

async function grantBigReward(
  // deno-lint-ignore no-explicit-any
  sb: any,
  discord_id: string,
  authHeader: string,
  cycleId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const { data: bigReward } = await sb
    .from("checkin_big_reward")
    .select("*")
    .maybeSingle();

  if (!bigReward) return false;

  const rewardSnapshot: Record<string, unknown> = { reward_type: bigReward.reward_type };

  try {
    if (bigReward.reward_type in POINT_COLUMN) {
      const col = POINT_COLUMN[bigReward.reward_type];
      const amount = bigReward.reward_amount ?? 0;
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
    } else if (bigReward.reward_type === "role" && bigReward.role_id) {
      rewardSnapshot.role_id = bigReward.role_id;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await discordFetch(`${supabaseUrl}/functions/v1/grant-discord-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ discordUserId: discord_id, discordRoleId: bigReward.role_id }),
      });
    }

    await sb
      .from("checkin_cycles")
      .update({ big_reward_claimed: true })
      .eq("id", cycleId);

    await sb.from("checkin_logs").insert({
      discord_id,
      year,
      month,
      day_number: 28,
      action: "big_reward",
      reward_type: bigReward.reward_type,
      reward_value: rewardSnapshot,
    });

    return true;
  } catch (err) {
    console.error("grantBigReward error:", err);
    return false;
  }
}
