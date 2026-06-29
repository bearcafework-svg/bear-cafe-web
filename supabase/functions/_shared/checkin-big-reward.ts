import { discordFetch } from "./discord-fetch.ts";

export const DEFAULT_BIG_REWARD = {
  reward_type: "points" as const,
  reward_amount: 100,
  role_id: null as string | null,
  description: "Perfect attendance reward — checked in all 28 days!",
};

const POINT_COLUMN: Record<string, string> = {
  points: "points",
  ticket_point: "ticket_point",
  ticket_piece_point: "ticket_piece_point",
};

// deno-lint-ignore no-explicit-any
export async function getOrSeedBigReward(sb: any, year: number, month: number) {
  const { data: existing, error: fetchError } = await sb
    .from("checkin_big_reward")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: seeded, error: seedError } = await sb
    .from("checkin_big_reward")
    .insert({
      year,
      month,
      ...DEFAULT_BIG_REWARD,
    })
    .select()
    .single();

  if (seedError) throw seedError;
  return seeded;
}

export async function grantBigReward(
  // deno-lint-ignore no-explicit-any
  sb: any,
  discord_id: string,
  authHeader: string,
  cycleId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const bigReward = await getOrSeedBigReward(sb, year, month);
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
