import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";
import { getGuildRoles } from "../_shared/guild-roles-cache.ts";

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

const WARN_ROLE_ID = "1318580353752895583";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbycKl_xUfYzwRwRNRH2D9P-nRlx-KClzRRInEVHBWqZfCjzMmmuM9Yt9UfY_e1cjsQV1A/exec";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      return respond({ hasRole: false, records: [], roleIconUrl: null });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid token" }, 401);
    }

    const discordId =
      user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) {
      return respond({ hasRole: false, records: [], roleIconUrl: null });
    }

    // Check if user has the warn role on Discord
    const memberRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!memberRes.ok) {
      console.error("Discord member fetch failed:", memberRes.status);
      return respond({ hasRole: false, records: [], roleIconUrl: null });
    }

    const member = await memberRes.json();
    const hasRole =
      Array.isArray(member.roles) && member.roles.includes(WARN_ROLE_ID);

    if (!hasRole) {
      return respond({ hasRole: false, records: [], roleIconUrl: null });
    }

    // Fetch role icon from guild roles (cached)
    let roleIconUrl: string | null = null;
    try {
      const roles = await getGuildRoles(guildId!, botToken!);
      const warnRole = roles.find((r) => r.id === WARN_ROLE_ID);
      if (warnRole?.icon) {
        roleIconUrl = `https://cdn.discordapp.com/role-icons/${WARN_ROLE_ID}/${warnRole.icon}.png?size=64`;
      }
    } catch (e) {
      console.error("Failed to fetch role icon:", e);
    }

    // Fetch warn logs from Database (source of truth)
    let records: Array<Record<string, string>> = [];
    try {
      const { data: userRows, error: dbError } = await supabase
        .from('tag_warn_logs')
        .select('log_timestamp, message, image_url, punish')
        .eq('member_id', discordId)
        .order('log_timestamp', { ascending: false })
        .limit(1);

      if (dbError) {
        console.error("Database fetch failed:", dbError);
      } else if (userRows && userRows.length > 0) {
        records = userRows.map((r) => {
          // Handle potentially multiple images (comma separated)
          let imageUrl = r.image_url || "";
          if (imageUrl.includes(",")) {
            const urls = imageUrl.split(",").map((u: string) => u.trim()).filter((u: string) => u !== "");
            imageUrl = urls[0] || "";
          }

          return {
            timestamp: r.log_timestamp || "",
            message: r.message || "",
            image_url: imageUrl,
            punish: r.punish || "",
          };
        });
      }
    } catch (e) {
      console.error("Failed to fetch from Database:", e);
    }

    return respond({ hasRole: true, records, roleIconUrl });
  } catch (error) {
    console.error("check-user-warn-role error:", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
