import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRoleBanGuard } from "../_shared/role-ban.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 3 session creations per 15 minutes per IP
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type SessionCreatePayload = {
  category_id: string;
  selected_role_id?: string | null;
  duration_minutes: number;
  ends_at: string;
  note?: string | null;
  include_voice_channel?: boolean;
  voice_channel_id?: string | null;
  voice_channel_name?: string | null;
  session_mode?: string;
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IP-based rate limiting
    const clientIp = getClientIp(req);
    const rateLimitKey = `session-create:${clientIp}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many session creations. Please wait before trying again.",
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const guardResult = await requireRoleBanGuard(req, corsHeaders);
    if ("response" in guardResult) {
      return guardResult.response as Response;
    }

    const payload = (await req.json()) as SessionCreatePayload;
    if (!payload.category_id || !payload.duration_minutes || !payload.ends_at) {
      return new Response(
        JSON.stringify({ error: "Missing required session data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

const { data: hasActiveSession, error: activeSessionError } = await supabase.rpc(
      "has_active_session",
      {
        _user_id: guardResult.user.id,
      },
    );
    if (activeSessionError) {
      console.error("Failed to check active session:", activeSessionError.message);
      return new Response(
        JSON.stringify({ error: "Failed to validate active session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (hasActiveSession) {
      return new Response(
        JSON.stringify({
          error: "ACTIVE_SESSION_EXISTS",
          message:
            "คุณมีแมตช์ที่ยังไม่หมดเวลาอยู่แล้ว กรุณารอให้หมดเวลา หรือยุติแมตช์ก่อนสร้างใหม่",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert([
        {
          user_id: guardResult.user.id,
          category_id: payload.category_id,
          selected_role_id: payload.selected_role_id ?? null,
          duration_minutes: payload.duration_minutes,
          ends_at: payload.ends_at,
          note: payload.note ?? null,
          include_voice_channel: Boolean(payload.include_voice_channel),
          voice_channel_id: payload.voice_channel_id ?? null,
          voice_channel_name: payload.voice_channel_name ?? null,
          session_mode: payload.session_mode || 'dm',
          status: "active",
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error("Session insert failed:", error?.message);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ session: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in session-create:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
