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

const DEFAULT_CHANNEL_ID = "1524124428454203553";

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
      DEFAULT_CHANNEL_ID;

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

    const formattedAmount = Number(latestAmount).toLocaleString("th-TH");
    const salmonPoints = Math.floor(Number(latestAmount) / 100);

    const THX_BANNER_IMAGE =
      "https://cdn.discordapp.com/attachments/1565777850022232075/1566788367277101067/thx.png?ex=6aef16e0&is=6aedc560&hm=e7117e860f326c3602f3944ca7af9121259907dd231bcd19e9104332753c1366&";

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
                    url: THX_BANNER_IMAGE,
                  },
                },
              ],
            },
            {
              type: 10, // Text Display - Header
              content:
                "## <:bee20000:1256669436350562355>︲__` 𝖳𝗁𝖺𝗇𝗄𝗌 𝖿𝗈𝗋 𝗒𝗈𝗎𝗋 𝗈𝗋𝖽𝖾𝗋  ₊ ขอบคุณนะคะ 𓂃 `__\n-# ขอบคุณสำหรับการอุดหนุนและโดเนทให้กับคาเฟ่หมีนะคะ การสนับสนุนของคุณช่วยให้พวกเราสามารถพัฒนาและดูแลคอมมูนิตี้ให้ดียิ่งขึ้นต่อไปค่ะ <:cuteplant:1152834055528783872>",
            },
            { type: 14, divider: true, spacing: 2 }, // Separator
            {
              type: 10, // Text Display - Details
              content:
                `> (👤)︰<@${memberId}>\n` +
                `> (<:bankmoney:1567217849968234658>)︰**+${formattedAmount} บาท**\n` +
                `> (<:fishicon:1568281136675823817>)︰**+${salmonPoints} แต้ม**`,
            },
            { type: 14, divider: false, spacing: 1 }, // Separator
            {
              type: 1, // Action Row
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: "︲เช็กยอดโดเนทของคุณ",
                  emoji: {
                    id: "1522154708200849449",
                    name: "bagpack_icon",
                    animated: false,
                  },
                  url: "https://discord.com/channels/1144251788493602848/1524124513728598178",
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
