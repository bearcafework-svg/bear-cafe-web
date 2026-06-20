/**
 * send-contract-notify
 * ส่งการแจ้งเตือนสัญญาเช่าบ้านใกล้หมดผ่าน Discord Bot API (Components V2)
 * รับ: { member_id, end_unix, room_link, channel_id? }
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
    const body = await req.json();
    const member_id: string = String(body.member_id ?? "").trim();
    const end_unix: number = Number(body.end_unix ?? 0);
    const room_link: string = String(body.room_link ?? "-").trim() || "-";
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
          error: "Missing channel_id — set DISCORD_CONTRACT_NOTIFY_CHANNEL_ID env var or pass channel_id in body",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textContent = [
      `## <a:bearg11:1396016056035840140>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ จากเซอร์วิส 𓂃 \`__`,
      `-# **สาเหตุ:** บ้านเช่าของคุณใกล้หมดแล้ว หากไม่อยากให้บ้านถูกยึด ต่อด่วน ต่อด่วน ต่อด่วน! <:cuteplant:1152834055528783872>`,
      ``,
      `> (👤)︰<@${member_id}> — ${member_id}`,
      `> (⏰)︰<t:${end_unix}:F> (<t:${end_unix}:R>)`,
      `> (🏡)︰${room_link}`,
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
                    url: "https://cdn.discordapp.com/attachments/1144675871798591569/1517912045306118395/1.png",
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
                  label: "คลิกเพื่อต่อบ้านเช่า",
                  url: "https://discord.com/channels/1144251788493602848/1202239170219868190",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await sendDiscordBotMessage(channelId, payload, {
      dedupKey: `contract-notify:${member_id}:${end_unix}`,
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