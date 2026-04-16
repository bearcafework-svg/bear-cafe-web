import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Missing Discord configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Discord ID from metadata
    const discordId =
      user.user_metadata?.discord_id || user.user_metadata?.provider_id;

    if (!discordId) {
      return new Response(
        JSON.stringify({ error: "No Discord ID found for user" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch member data from Discord
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!memberRes.ok) {
      console.error("Discord member fetch failed:", memberRes.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Discord member data" }),
        {
          status: memberRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const member = await memberRes.json();
    const userRoleIds: string[] = member.roles || [];

    // Fetch all guild roles to map names and colors
    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!rolesRes.ok) {
      console.error("Discord roles fetch failed:", rolesRes.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Discord roles" }),
        {
          status: rolesRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allRoles: any[] = await rolesRes.json();

    // Map user roles to details
    const roles = userRoleIds
      .map((roleId) => {
        const role = allRoles.find((r) => r.id === roleId);
        if (!role) return null;
        return {
          id: role.id,
          name: role.name,
          color: role.color, // Integer color
          position: role.position,
          icon: role.icon
            ? `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png`
            : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.position || 0) - (a?.position || 0)); // Sort by hierarchy

    return new Response(JSON.stringify({ roles }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
