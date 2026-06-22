/**
 * send-trading-embed
 * ส่ง Components V2 embed ขอบคุณการโดเนทผ่าน Discord Bot API
 * รับ: { member_id, latest_amount, total_amount, avatar_url, channel_id? }
 */
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toUnicodeNumber(n: number): string {
  const unicodeDigits = ["𝟢", "𝟣", "𝟤", "𝟥", "𝟦", "𝟧", "𝟨", "𝟩", "𝟪", "𝟫"];
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatted.replace(/[0-9]/g, (d) => unicodeDigits[parseInt(d)]);
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const memberId: string = body.member_id ?? "";
    const latestAmount: number = Number(body.latest_amount ?? 0);
    const totalAmount: number = Number(body.total_amount ?? latestAmount);
    const avatarUrl: string = body.avatar_url ?? "";

    const channelId: string =
      body.channel_id ??
      Deno.env.get("DISCORD_TRADING_EMBED_CHANNEL_ID") ??
      "";

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: "member_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({
          error: "Missing channel_id — set DISCORD_TRADING_EMBED_CHANNEL_ID env var or pass channel_id in body",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const latestAmountStr = toUnicodeNumber(latestAmount);
    const totalAmountStr = toUnicodeNumber(totalAmount);

    const isDiscordCdnUrl =
      avatarUrl.startsWith("https://cdn.discordapp.com/") ||
      avatarUrl.startsWith("https://media.discordapp.net/");
    const safeAvatarUrl = isDiscordCdnUrl ? avatarUrl : "";

    const textContent = `## 🐟︲__\` 𝖳𝗁𝖺𝗇𝗄 𝗒𝗈𝗎 𝟦 𝗌𝗎𝗉𝗉𝗈𝗋𝗍 𓂃 \`__\n-# <:line:1144701793989840997> <@${memberId}> ขอขอบคุณสำหรับการสนับสนุนให้กับทางคาเฟ่หมี **${latestAmountStr} บาท** นะคะ ตอนนี้ยอดรวมการโดเนทของคุณทั้งหมด **${totalAmountStr} บาท** <:cuteplant:1152834055528783872>`;

    // ถ้ามี avatar ใช้ Section (type 9) + Thumbnail, ถ้าไม่มีใช้ Text Display (type 10) ตรงๆ
    const contentComponent: Record<string, unknown> = safeAvatarUrl
      ? {
          type: 9, // Section
          components: [{ type: 10, content: textContent }],
          accessory: {
            type: 11, // Thumbnail
            media: { url: safeAvatarUrl },
          },
        }
      : {
          type: 10, // Text Display
          content: textContent,
        };

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
                    url: "https://cdn.discordapp.com/attachments/1164188104182210670/1194160352099844097/20240109_130631_0000.png",
                  },
                },
              ],
            },
            { type: 14, divider: true, spacing: 2 }, // Separator
            contentComponent,
            { type: 14, divider: true, spacing: 2 }, // Separator
            {
              type: 1, // Action Row
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: "︲เช็คยอดโดเนทของคุณ",
                  emoji: { id: "1256669436350562355", name: "bee20000", animated: false },
                  url: "https://discord.com/channels/1144251788493602848/1508608796967305216",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await sendDiscordBotMessage(channelId, payload, {
      dedupKey: `trading-embed:${memberId}:${latestAmount}:${Date.now()}`,
    });

    if (!result.success) {
      console.error("[send-trading-embed] Discord send failed", {
        memberId,
        error: result.error,
        errorCode: result.errorCode ?? null,
        errorCategory: result.errorCategory ?? null,
        status: result.status ?? null,
        discordErrorCode: result.discordErrorCode ?? null,
        avatarUrl,
        safeAvatarUrl,
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
    console.error("[send-trading-embed] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
