import { createClient } from "@supabase/supabase-js";
import { getCheckinToday } from "../_shared/checkin-date.ts";

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
    const { discord_id } = await req.json();
    if (!discord_id) return json({ ok: false, error: "missing_discord_id" }, 400);

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

    const { year, month, day: currentDay } = getCheckinToday();

    // Independent PostgREST selects — parallelize after auth (FR-7 / AC-BE-001).
    // Per-query errors stay soft ({ data } only), matching prior sequential semantics.
    const [
      { data: cycle },
      { data: dailyRewards },
      { data: bigReward },
    ] = await Promise.all([
      sb
        .from("checkin_cycles")
        .select("id, year, month, completed_days, makeup_days, big_reward_claimed")
        .eq("discord_id", discord_id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
      sb
        .from("checkin_daily_rewards")
        .select("day_number, reward_type, reward_amount, role_id, makeup_cost, is_active")
        .eq("year", year)
        .eq("month", month)
        .order("day_number"),
      sb
        .from("checkin_big_reward")
        .select("reward_type, reward_amount, role_id, description")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
    ]);

    const makeupWindowOpen = currentDay > 1;

    return json({
      ok: true,
      cycle: cycle ?? {
        year,
        month,
        completed_days: [],
        makeup_days: [],
        big_reward_claimed: false,
      },
      daily_rewards: dailyRewards ?? [],
      big_reward: bigReward ?? null,
      makeup_window_open: makeupWindowOpen,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
