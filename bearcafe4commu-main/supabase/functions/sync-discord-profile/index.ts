import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      return respond({ error: "Missing Discord configuration" }, 500);
    }

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid token" }, 401);
    }

    // Get current profile to find discord_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("discord_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return respond({ error: "Profile not found" }, 404);
    }

    const discordId = profile.discord_id;

    // Fetch latest member data from Discord using Bot token
    const memberRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!memberRes.ok) {
      console.warn("Failed to fetch Discord member:", memberRes.status);
      return respond({ error: "Discord API error" }, 502);
    }

    const member = await memberRes.json();
    const discordUser = member.user;

    // Build avatar URL (always PNG to avoid GIF performance issues)
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    // Build banner URL with GIF support
    const bannerUrl = discordUser.banner
      ? `https://cdn.discordapp.com/banners/${discordId}/${discordUser.banner}.${discordUser.banner.startsWith("a_") ? "gif" : "png"}?size=600`
      : null;

    const displayName =
      member.nick || discordUser.global_name || discordUser.username;
    const discordUsername = discordUser.username;

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: displayName,
        discord_username: discordUsername,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return respond({ error: "Failed to update profile" }, 500);
    }

    // Also update auth user_metadata so JWT stays in sync
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        discord_id: discordId,
        username: displayName,
        avatar_url: avatarUrl,
      },
    });

    return respond({
      updated: true,
      username: displayName,
      discord_username: discordUsername,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
    });
  } catch (error) {
    console.error("sync-discord-profile error:", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
