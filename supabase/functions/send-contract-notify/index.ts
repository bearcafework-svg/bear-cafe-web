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
    // Channel ที่บอทจะส่งข้อความแจ้งเตือนสัญญาเช่าบ้าน
    // ต้องเป็น Channel ID จริงที่บอทมีสิทธิ์ส่งข้อความ
    const channelId: string = body.channel_id ?? Deno.env.get("DISCORD_CONTRACT_NOTIFY_CHANNEL_ID") ?? "1168874550889566228";

    if (!member_id || !end_unix) {
      return new Response(
        JSON.stringify({ error: "member_id and end_unix are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: "Missing channel_id — set DISCORD_CONTRACT_NOTIFY_CHANNEL_ID env var or pass channel_id in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      flags: 32768,
      components: [{
        type: 17,
        components: [
          {
            type: 12,
            items: [{
              media: {
                url: "https://cdn.discordapp.com/attachments/1144675871798591569/1517912045306118395/1.png?ex=6a380141&is=6a36afc1&hm=00ddb1a90f5b3dc0f98df846214403c4bc5446bdd3a3a271e152a9203d392f7a&",
              },
            }],
          },
          { type: 14, spacing: 2 },
          {
            type: 10,
            content: `## <a:bearg11:1396016056035840140>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ จากเซอร์วิส 𓂃 \`__\n-# **สาเหตุ:** บ้านเช่าของคุณใกล้หมดแล้ว หากไม่อยากให้บ้านถูกยึด ต่อด่วน ต่อด่วน ต่อด่วน! <:cuteplant:1152834055528783872>\n\n> (👤)︰<@${member_id}> — ${member_id}\n> (⏰)︰<t:${end_unix}:F> (<t:${end_unix}:R>)\n> (🏡)︰${room_link}`,
          },
          { type: 14, spacing: 2 },
          {
            type: 1,
            components: [{
              type: 2,
              style: 5,
              url: "https://discord.com/channels/1144251788493602848/1202239170219868190",
              custom_id: "p_315510557929115666",
              label: "คลิกเพื่อต่อบ้านเช่า",
            }],
          },
        ],
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