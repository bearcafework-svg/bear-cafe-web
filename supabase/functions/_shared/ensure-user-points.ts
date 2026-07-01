// deno-lint-ignore no-explicit-any
export async function ensureUserPoints(sb: any, discordId: string): Promise<void> {
  const { error } = await sb
    .from("user_points")
    .upsert({ discord_id: discordId }, { onConflict: "discord_id", ignoreDuplicates: true });

  if (error) throw new Error(error.message);
}
