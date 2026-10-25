/**
 * send-contract-notify
 * ส่งการแจ้งเตือนสัญญา (บ้านเช่า / ยศบูสต์ / ยศส่วนตัว / โฆษณา) ใกล้หมดผ่าน Discord Bot API (Components V2)
 * รับ: { member_id, end_unix, room_link?, channel_id?, type?, role_name?, package_name? }
 */
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const member_id: string = String(body.member_id ?? "").trim();
    const end_unix: number = Number(body.end_unix ?? 0);
    const room_link: string = String(body.room_link ?? "-").trim() || "-";
    const type: string = String(body.type ?? "house").trim();
    const role_name: string = String(body.role_name ?? "").trim();
    const package_name: string = String(body.package_name ?? "").trim();
    const channelId: string = String(
      body.channel_id ?? Deno.env.get("DISCORD_CONTRACT_NOTIFY_CHANNEL_ID") ?? ""
    ).trim();

    if (!member_id || !end_unix) {
      return new Response(
        JSON.stringify({ error: "member_id and end_unix are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({
          error: "ยังไม่ได้ตั้งค่าห้องแจ้งเตือน (กรุณาระบุ DISCORD_CONTRACT_NOTIFY_CHANNEL_ID ใน Environment Variables หรือระบุ channel_id ใน request)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // สร้างเนื้อหาแจ้งเตือนตามประเภทสัญญา
    let causeText = "บ้านเช่าของคุณใกล้หมดแล้ว หากไม่อยากให้บ้านถูกยึด ต่อด่วน ต่อด่วน ต่อด่วน! <:cuteplant:1152834055528783872>";
    const detailLines: string[] = [
      `> (👤)︰<@${member_id}> — ${member_id}`,
      `> (⏰)︰<t:${end_unix}:F> (<t:${end_unix}:R>)`,
    ];

    if (type === "boost_role") {
      causeText = `สัญญายศบูสต์ ${role_name ? `**${role_name}** ` : ""}ของคุณใกล้หมดอายุแล้ว หากต้องการต่ออายุยศ อย่าลืมต่อสัญญานะคะ <:cuteplant:1152834055528783872>`;
      if (role_name) detailLines.push(`> (🎖️)︰ยศ ${role_name}`);
    } else if (type === "personal_role") {
      causeText = `สัญญายศส่วนตัว ${role_name ? `**${role_name}** ` : ""}ของคุณใกล้หมดอายุแล้ว หากต้องการต่ออายุยศ อย่าลืมต่อสัญญานะคะ <:cuteplant:1152834055528783872>`;
      if (role_name) detailLines.push(`> (🎖️)︰ยศ ${role_name}`);
    } else if (type === "ad") {
      causeText = `สัญญาโฆษณา ${package_name ? `**${package_name}** ` : ""}ของคุณใกล้หมดอายุแล้ว ห้องโฆษณาจะถูกลบอัตโนมัติเมื่อสิ้นสุดสัญญา <:cuteplant:1152834055528783872>`;
      if (package_name) detailLines.push(`> (📢)︰แพ็กเกจ ${package_name}`);
    } else {
      if (room_link && room_link !== "-") {
        detailLines.push(`> (🏡)︰${room_link}`);
      }
    }

    const textContent = [
      `## <a:bearg11:1396016056035840140>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ แจ้งเตือนสัญญาใกล้หมดอายุ 𓂃 \`__`,
      `-# **สาเหตุ:** ${causeText}`,
      ``,
      ...detailLines,
    ].join("\n");

    const payload: Record<string, unknown> = {
      flags: 32768,
      components: [
        {
          type: 17, // Container
          components: [
            {
              type: 12, // Media Gallery
              items: [
                {
                  media: {
                    url: "https://cdn.discordapp.com/attachments/1524704267015819274/1532076197175890202/NewsBoard_-_bearcafe_18.png?ex=6a6b88a6&is=6a6a3726&hm=ef43133d686f69bf503f1714d46b357579a945a28a9011e6827cc491f9ecf503&",
                  },
                },
              ],
            },
            { type: 14, spacing: 2 }, // Separator
            {
              type: 10, // Text Display
              content: textContent,
            },
            { type: 14, spacing: 2 }, // Separator
            {
              type: 1, // Action Row
              components: [
                {
                  type: 2,  // Button
                  style: 5, // Link — ห้ามมี custom_id
                  label: "คลิกเพื่อติดต่อต่อสัญญา",
                  url: "https://discord.com/channels/1144251788493602848/1524124116053917747",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await sendDiscordBotMessage(channelId, payload, {
      dedupKey: `contract-notify:${member_id}:${end_unix}:${type}`,
    });

    if (!result.success) {
      console.error("[send-contract-notify] Discord send failed", {
        member_id,
        error: result.error,
        errorCode: result.errorCode ?? null,
        errorCategory: result.errorCategory ?? null,
        status: result.status ?? null,
        discordErrorCode: result.discordErrorCode ?? null,
      });
      return new Response(
        JSON.stringify({
          error: "Discord API failed",
          details: result.error,
          errorCode: result.errorCode ?? null,
          errorCategory: result.errorCategory ?? null,
          discordErrorCode: result.discordErrorCode ?? null,
          discordStatus: result.status ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-contract-notify] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
