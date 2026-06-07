import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// Default reward for every day when seeding — admin can edit each one afterwards.
const DEFAULT_REWARD = { reward_type: "points", reward_amount: 10, role_id: null };

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT + admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "missing_auth" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return json({ ok: false, error: "invalid_token" }, 401);

    const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) return json({ ok: false, error: "no_discord_id" }, 401);

    // Check admin/moderator role
    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (!profile) return json({ ok: false, error: "profile_not_found" }, 403);

    const { data: hasRole } = await sb.rpc("has_role", {
      _user_id: profile.id,
      _role: "admin",
    });
    const { data: hasMod } = await sb.rpc("has_role", {
      _user_id: profile.id,
      _role: "moderator",
    });

    if (!hasRole && !hasMod) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    // Check how many rows already exist
    const { data: existing } = await sb
      .from("checkin_daily_rewards")
      .select("day_number");

    const existingDays = new Set((existing ?? []).map((r: { day_number: number }) => r.day_number));
    const missingDays = Array.from({ length: 28 }, (_, i) => i + 1).filter(
      (d) => !existingDays.has(d),
    );

    if (missingDays.length === 0) {
      return json({ ok: true, message: "all_28_days_already_seeded", seeded: [] });
    }

    const rows = missingDays.map((day_number) => ({
      day_number,
      ...DEFAULT_REWARD,
      is_active: true,
      updated_by: discordId,
    }));

    const { data: inserted, error: insertErr } = await sb
      .from("checkin_daily_rewards")
      .insert(rows)
      .select("day_number");

    if (insertErr) throw new Error(insertErr.message);

    return json({
      ok: true,
      seeded: (inserted ?? []).map((r: { day_number: number }) => r.day_number),
      message: `seeded ${(inserted ?? []).length} missing day(s)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
