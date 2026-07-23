const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const guildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const roleId: string = body.role_id ?? "";
    const channelUrl: string = body.channel_url ?? "";

    const result: Record<string, unknown> = {};

    // ─── Get role member count via /guilds/{id}/roles ─────────────────────
    // This endpoint returns member_count per role directly — no pagination needed.
    // Works even for servers with 30,000+ members.
    if (roleId) {
      const rolesRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/roles`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (rolesRes.ok) {
        const roles: any[] = await rolesRes.json();
        const role = roles.find((r: any) => r.id === roleId);

        if (role) {
          // member_count is available when the bot has GUILD_MEMBERS intent
          // or via the roles endpoint with counts
          result.total = role.member_count ?? null;
          result.role_name = role.name ?? null;
          result.members = []; // no member list — count only
        } else {
          result.total = null;
          result.role_name = null;
          result.members = [];
        }
      } else {
        console.error("Discord roles API error:", rolesRes.status);
        result.total = null;
        result.members = [];
      }
    }

    // ─── Resolve channel name ─────────────────────────────────────────────
    if (channelUrl) {
      const match = channelUrl.match(/channels\/\d+\/(\d+)/);
      if (match) {
        const channelId = match[1];
        const res = await fetch(
          `https://discord.com/api/v10/channels/${channelId}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (res.ok) {
          const ch = await res.json();
          result.channel_name = ch.name ?? null;
          result.channel_id = channelId;
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("get-role-members error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
