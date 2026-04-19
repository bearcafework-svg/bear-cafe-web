import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractInviteCode(input: string): string | null {
  const patterns = [
    /discord\.gg\/([a-zA-Z0-9-]+)/,
    /discord\.com\/invite\/([a-zA-Z0-9-]+)/,
    /discordapp\.com\/invite\/([a-zA-Z0-9-]+)/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9-]+$/.test(input.trim())) return input.trim();
  return null;
}

function buildIconUrl(guildId: string, iconHash: string | null): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=256`;
}

function buildBannerUrl(guildId: string, bannerHash: string | null): string | null {
  if (!bannerHash) return null;
  const ext = bannerHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${ext}?size=512`;
}

function buildSplashUrl(guildId: string, splashHash: string | null): string | null {
  if (!splashHash) return null;
  return `https://cdn.discordapp.com/splashes/${guildId}/${splashHash}.png?size=512`;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ใช้ service role เพื่อ bypass RLS — verify user ด้วย getUser(token)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify JWT จาก Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    let userId: string | null = null;
    if (token) {
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      if (error) {
        console.warn("Auth warning:", error.message);
      } else if (user) {
        userId = user.id;
      }
    }

    // Parse body
    let invite_url: string;
    let category_id: string;
    try {
      const body = await req.json();
      invite_url = body.invite_url ?? "";
      category_id = body.category_id ?? "";
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invite_url || !category_id) {
      return new Response(
        JSON.stringify({ error: "invite_url and category_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteCode = extractInviteCode(invite_url);
    if (!inviteCode) {
      return new Response(
        JSON.stringify({ error: "ลิงก์เชิญไม่ถูกต้อง" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invite from Discord (no bot token needed for public invites)
    const discordRes = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`
    );

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord invite API error:", discordRes.status, errText);
      return new Response(
        JSON.stringify({ error: "ไม่สามารถดึงข้อมูลจาก Discord ได้", status: discordRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteData = await discordRes.json();
    const guild = inviteData.guild;

    if (!guild) {
      return new Response(
        JSON.stringify({ error: "ไม่พบเซิร์ฟเวอร์ในลิงก์เชิญนี้" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guildId: string = guild.id;

    // Lookup owner discord_id from profiles
    let ownerDiscordId: string | null = null;
    if (userId) {
      const { data: profile, error: profileErr } = await adminClient
        .from("profiles")
        .select("discord_id")
        .eq("id", userId)
        .single();
      if (profileErr) {
        console.warn("Profile lookup error:", profileErr.message);
      } else {
        ownerDiscordId = profile?.discord_id ?? null;
      }
    }

    // Check duplicate
    const { data: existing } = await adminClient
      .from("discord_servers")
      .select("id")
      .eq("discord_id", guildId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "เซิร์ฟเวอร์นี้ถูกเพิ่มแล้ว" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert
    const { data: newServer, error: insertError } = await adminClient
      .from("discord_servers")
      .insert({
        discord_id: guildId,
        name: guild.name,
        icon_url: buildIconUrl(guildId, guild.icon ?? null),
        banner_url:
          buildBannerUrl(guildId, guild.banner ?? null) ||
          buildSplashUrl(guildId, guild.splash ?? null),
        invite_url: `https://discord.gg/${inviteCode}`,
        owner_id: ownerDiscordId,
        category_id,
        status: "pending",
      })
      .select("id, name")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError.message, insertError.details);
      return new Response(
        JSON.stringify({ error: "บันทึกข้อมูลไม่สำเร็จ", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: newServer.id, server: { name: guild.name } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("resolve-discord-invite unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
