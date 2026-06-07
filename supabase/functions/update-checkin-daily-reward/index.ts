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

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { day_number, reward_type, reward_amount, role_id } = await req.json();

    if (day_number == null || !reward_type) {
      return json({ ok: false, error: "missing_params" }, 400);
    }
    if (day_number < 1 || day_number > 28) {
      return json({ ok: false, error: "invalid_day" }, 400);
    }
    if (!VALID_REWARD_TYPES.includes(reward_type)) {
      return json({ ok: false, error: "invalid_reward_type" }, 400);
    }
    if (reward_type !== "role" && (reward_amount == null || reward_amount < 0)) {
      return json({ ok: false, error: "reward_amount_required" }, 400);
    }
    if (reward_type === "role" && !role_id) {
      return json({ ok: false, error: "role_id_required" }, 400);
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

    // Upsert the reward row for this day
    const payload: Record<string, unknown> = {
      day_number,
      reward_type,
      reward_amount: reward_type !== "role" ? reward_amount : null,
      role_id: reward_type === "role" ? role_id : null,
      updated_at: new Date().toISOString(),
      updated_by: discordId,
    };

    const { data, error } = await sb
      .from("checkin_daily_rewards")
      .upsert(payload, { onConflict: "day_number" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return json({ ok: true, reward: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return json({ ok: false, error: message }, 500);
  }
});
