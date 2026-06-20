import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, month } = await req.json();

    if (year == null || month == null) {
      return json({ ok: false, error: "missing_params" }, 400);
    }
    if (month < 1 || month > 12) {
      return json({ ok: false, error: "invalid_month" }, 400);
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

    // Fetch daily rewards for the specified month
    const { data: dailyRewards, error: dailyError } = await sb
      .from("checkin_daily_rewards")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .order("day_number");

    if (dailyError) throw dailyError;

    // Fetch big reward (global, not per-month)
    const { data: bigReward, error: bigError } = await sb
      .from("checkin_big_reward")
      .select("*")
      .maybeSingle();

    if (bigError) throw bigError;

    // If no rewards exist for this month, auto-seed with defaults
    if (!dailyRewards || dailyRewards.length === 0) {
      const defaultRewards = Array.from({ length: 28 }, (_, i) => ({
        year,
        month,
        day_number: i + 1,
        reward_type: "points",
        reward_amount: 10,
        makeup_cost: 50,
        is_active: true,
      }));

      const { data: seeded, error: seedError } = await sb
        .from("checkin_daily_rewards")
        .insert(defaultRewards)
        .select();

      if (seedError) throw seedError;

      return json({
        ok: true,
        daily_rewards: seeded || [],
        big_reward: bigReward,
      });
    }

    return json({
      ok: true,
      daily_rewards: dailyRewards || [],
      big_reward: bigReward,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
