import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const VALID_REWARD_TYPES = ["points", "ticket_point", "ticket_piece_point", "role"];

interface RewardEntry {
  day_number: number;
  reward_type: string;
  reward_amount?: number | null;
  role_id?: string | null;
  makeup_cost?: number | null;
}

function validateRewardEntry(entry: RewardEntry): string | null {
  if (entry.day_number == null || entry.day_number < 1 || entry.day_number > 28) {
    return "invalid_day";
  }
  if (!entry.reward_type || !VALID_REWARD_TYPES.includes(entry.reward_type)) {
    return "invalid_reward_type";
  }
  if (entry.reward_type !== "role" && (entry.reward_amount == null || entry.reward_amount < 0)) {
    return "reward_amount_required";
  }
  if (entry.reward_type === "role" && !entry.role_id) {
    return "role_id_required";
  }
  if (entry.makeup_cost != null && entry.makeup_cost < 0) {
    return "invalid_makeup_cost";
  }
  return null;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, month, rewards } = await req.json();

    if (year == null || month == null || !Array.isArray(rewards) || rewards.length === 0) {
      return json({ ok: false, error: "missing_params" }, 400);
    }
    if (month < 1 || month > 12) {
      return json({ ok: false, error: "invalid_month" }, 400);
    }

    for (const entry of rewards) {
      const validationError = validateRewardEntry(entry);
      if (validationError) {
        return json({ ok: false, error: validationError }, 400);
      }
    }

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

    const now = new Date().toISOString();
    const payloads = rewards.map((entry: RewardEntry) => ({
      year,
      month,
      day_number: entry.day_number,
      reward_type: entry.reward_type,
      reward_amount: entry.reward_type !== "role" ? entry.reward_amount : null,
      role_id: entry.reward_type === "role" ? entry.role_id : null,
      makeup_cost: entry.makeup_cost ?? 50,
      is_active: true,
      updated_at: now,
      updated_by: discordId,
    }));

    const { data, error } = await sb
      .from("checkin_daily_rewards")
      .upsert(payloads, { onConflict: "year,month,day_number" })
      .select();

    if (error) throw new Error(error.message);

    return json({ ok: true, rewards: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
