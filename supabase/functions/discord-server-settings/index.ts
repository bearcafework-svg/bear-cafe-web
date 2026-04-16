import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const botToken   = Deno.env.get("NOTIFICATION_BOT_TOKEN");

  // Verify caller
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve caller's discord_id from profiles
  const { data: profile } = await admin
    .from("profiles")
    .select("discord_id")
    .eq("id", user.id)
    .single();

  if (!profile?.discord_id) return json({ error: "Profile not found" }, 400);

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action, server_discord_id } = body;

  if (!action || !server_discord_id) {
    return json({ error: "action and server_discord_id are required" }, 400);
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  // Look up the server row by its Discord guild ID
  const { data: serverRow } = await admin
    .from("discord_servers")
    .select("id, owner_id, notify_channel_id")
    .eq("discord_id", server_discord_id)
    .maybeSingle();

  if (!serverRow) return json({ error: "Server not found" }, 404);

  if (serverRow.owner_id !== profile.discord_id) {
    return json({ error: "Forbidden: you are not the owner of this server" }, 403);
  }

  // ── Action: get_channels ──────────────────────────────────────────────────
  if (action === "get_channels") {
    if (!botToken) {
      console.error("NOTIFICATION_BOT_TOKEN is not set");
      return json({ success: false, reason: "bot_not_configured" });
    }

    const discordRes = await fetch(
      `https://discord.com/api/v10/guilds/${server_discord_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (discordRes.status === 403 || discordRes.status === 404) {
      return json({ success: false, reason: "bot_not_found" });
    }

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord channels API error:", discordRes.status, errText);
      return json({ success: false, reason: "discord_api_error" });
    }

    const allChannels: Array<{ id: string; name: string; type: number }> =
      await discordRes.json();

    // type 0 = GUILD_TEXT
    const textChannels = allChannels
      .filter((c) => c.type === 0)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return json({ success: true, channels: textChannels });
  }

  // ── Action: send_notification ─────────────────────────────────────────────
  if (action === "send_notification") {
    const { channel_id, message } = body as any;
    const targetChannel = channel_id ?? serverRow.notify_channel_id;

    if (!targetChannel) {
      return json({ success: false, reason: "no_channel_configured" });
    }
    if (!botToken) {
      return json({ success: false, reason: "bot_not_configured" });
    }

    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${targetChannel}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message ?? "🐻 มีเพื่อนใหม่จาก Bear Cafe กำลังเข้าร่วมเซิร์ฟเวอร์ของคุณ!",
        }),
      },
    );

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      console.error("Discord send message error:", msgRes.status, errText);
      return json({ success: false, reason: "send_failed" });
    }

    return json({ success: true });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
