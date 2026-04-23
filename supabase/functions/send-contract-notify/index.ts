/**
 * send-contract-notify
 * ส่งการแจ้งเตือนสัญญาเช่าบ้านใกล้หมดผ่าน Discord Bot API
 * รับ: { member_id, end_unix, room_link, channel_id? }
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
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const member_id: string = body.member_id ?? "";
    const end_unix: number = body.end_unix ?? 0;
    const room_link: string = body.room_link ?? "-";
    // Default to the contracts notification channel
    const channelId: string = body.channel_id ?? "1495041976918216734";

    if (!member_id || !end_unix) {
      return new Response(
        JSON.stringify({ error: "member_id and end_unix are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      content: `<@${member_id}>`,
      embeds: [{
        color: 16758671,
        description: `## <a:bearg11:1396016056035840140>︲__\` แท็กเตือนจากเซอร์วิส \`__\n<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲บ้านเช่าของคุณใกล้หมดแล้ว *!*\n- __\`แท็ก\`__: <@${member_id}> — \`${member_id}\`\n- __\`ห้องของคุณ\`__: ${room_link}\n- __\`ระยะสัญญา\`__: <t:${end_unix}:F> (<t:${end_unix}:R>)\n<:line:1144701793989840997>`,
      }],
      attachments: [],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          emoji: { id: "1212856675053346897", name: "bearcafe_star" },
          label: "︲ต่อบ้านเช่าของคุณ",
          url: "https://discord.com/channels/1144251788493602848/1202239170219868190",
        }],
      }],
    };

    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord Bot API error:", discordRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Discord error: ${discordRes.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await discordRes.json();
    return new Response(
      JSON.stringify({ success: true, message_id: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-contract-notify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
