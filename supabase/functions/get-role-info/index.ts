/**
 * get-role-info — ดึงชื่อและไอคอนของ role จาก Discord Bot API โดยใช้ role_id
 * ไม่ต้องการ admin permission — authenticated user ทุกคนเรียกได้
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
    const guildId = Deno.env.get("DISCORD_GUILD_ID") ?? "";

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Missing bot configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const roleId: string = body.role_id ?? "";

    if (!roleId) {
      return new Response(
        JSON.stringify({ error: "role_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all guild roles — Discord has no single-role endpoint
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!res.ok) {
      console.error("Discord roles API error:", res.status);
      return new Response(
        JSON.stringify({ error: `Discord API error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roles: any[] = await res.json();
    const role = roles.find((r) => r.id === roleId);

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Role not found", role_id: roleId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const iconUrl = role.icon
      ? `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png?size=64`
      : null;

    const colorHex = role.color && role.color !== 0
      ? `#${role.color.toString(16).padStart(6, "0")}`
      : null;

    return new Response(
      JSON.stringify({
        id: role.id,
        name: role.name,
        icon: iconUrl,
        unicode_emoji: role.unicode_emoji ?? null,
        color: colorHex,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("get-role-info error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
