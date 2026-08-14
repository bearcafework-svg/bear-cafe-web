/**
 * send-broadcast-test
 * ส่งข้อความโฆษณาบรอดแคสต์ทดสอบ (Components V2) ไปยังช่อง Discord ผ่าน Discord Bot API
 * รับ: { channel_id, payload }
 */
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const channelId: string = String(body.channel_id ?? "").trim();
    const payload: Record<string, unknown> = body.payload ?? {};

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: "channel_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "payload object is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

function sanitizeDiscordComponents(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDiscordComponents);
  }

  const copy = { ...obj };

  // If it's a Button component (type 2)
  if (copy.type === 2) {
    if (copy.style === 5 || (copy.url && typeof copy.url === "string" && copy.url.trim() !== "")) {
      // Link button (style 5) MUST NOT have custom_id
      delete copy.custom_id;
      copy.style = 5;
    } else if (copy.custom_id && typeof copy.custom_id === "string" && copy.custom_id.trim() !== "") {
      // Action button (style 1-4) MUST NOT have url
      delete copy.url;
    }
  }

  for (const key of Object.keys(copy)) {
    if (typeof copy[key] === "object" && copy[key] !== null) {
      copy[key] = sanitizeDiscordComponents(copy[key]);
    }
  }

  return copy;
}

    const cleanPayload = sanitizeDiscordComponents(payload);
    const result = await sendDiscordBotMessage(channelId, cleanPayload);

    if (!result.success) {
      console.error("[send-broadcast-test] Discord send failed", result);
      return new Response(
        JSON.stringify({
          error: "Discord API failed",
          details: result.error,
          errorCode: result.errorCode ?? null,
          discordErrorCode: result.discordErrorCode ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-broadcast-test] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
