/**
 * send-tag-warn-embed
 * ส่ง Components V2 แจ้งเตือนแท็กเตือนผ่าน Discord Bot API
 * รับ: { member_id, message, punish, image_url_1, image_url_2?, barista_discord_id?, is_spoiler? }
 * หรือ Ticket Notice: { action: 'ticket_notice', member_id, channel_id, source?: 'barista' | 'service' }
 */
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAG_WARN_CHANNEL_ID = "1524123469011357705";
const GUIDE_CHANNEL_URL = "https://discord.com/channels/1144251788493602848/1231153445944168518";

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth — ต้องมี Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();

    // ── Mode: แท็กแจ้งเตือนตั๋ว (Ticket Notice) ──
    if (body.action === "ticket_notice" || body.type === "ticket_notice") {
      const targetMemberId: string = String(body.member_id ?? "").trim();
      const targetChannelId: string = String(body.channel_id ?? "").trim();
      const noticeSource: string = String(body.source ?? "barista").trim();

      if (!targetMemberId || !targetChannelId) {
        return new Response(
          JSON.stringify({ error: "member_id and channel_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const deadlineSeconds = nowSeconds + 24 * 60 * 60; // นับไปข้างหน้าอีก 24 ชั่วโมงหลังแท็กเตือน
      const titleLabel = noticeSource === "service" ? "จากเซอร์วิส" : "จากบาริสต้า";

      const TICKET_BANNER_IMAGE =
        "https://cdn.discordapp.com/attachments/1565840974737973428/1568279453040246836/fdf7bf3da4fdfcd2.png?ex=6aef3d8e&is=6aedec0e&hm=581811a45f0d910e52d9b6a60f425c27559c7a927282d2b2dd033c57d30d0803&";

      const ticketPayload: Record<string, unknown> = {
        flags: 32768,
        components: [
          {
            type: 17,
            components: [
              {
                type: 12,
                items: [
                  {
                    media: { url: TICKET_BANNER_IMAGE },
                  },
                ],
              },
              {
                type: 10,
                content: `## <a:bearg11:1396016056035840140>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ ${titleLabel} 𓂃 \`__\n-# ตอนนี้สมาชิกทำการเปิดห้องตั๋วไว้ รบกวนทำรายการให้เรียบร้อยตามข้อมูลด้านล่างด้วยค่ะ <:cuteplant:1152834055528783872>`,
              },
              {
                type: 14,
                spacing: 2,
              },
              {
                type: 10,
                content:
                  `- **\` 📌 รายละเอียด \`** *!*\n` +
                  `>>> (👤)︰<@${targetMemberId}> — ${targetMemberId}\n` +
                  `(<a:7596clock:1160230591892029510>)︰<t:${deadlineSeconds}:f> (<t:${deadlineSeconds}:R>)`,
              },
              {
                type: 14,
                divider: false,
              },
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    url: `https://discord.com/channels/1144251788493602848/${targetChannelId}`,
                    custom_id: "p_365877444575498244",
                    label: "︲คลิกไปที่ห้อง",
                    emoji: {
                      id: "1563093703168360479",
                      name: "pingroleicon",
                      animated: false,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await sendDiscordBotMessage(targetChannelId, ticketPayload, {
        dedupKey: `ticket-notice:${targetMemberId}:${targetChannelId}:${nowSeconds}`,
      });

      if (!result.success) {
        console.error("[send-tag-warn-embed] Discord send ticket notice failed", {
          targetMemberId,
          targetChannelId,
          error: result.error,
          errorCode: result.errorCode ?? null,
        });
        return new Response(
          JSON.stringify({
            error: "Discord API failed",
            details: result.error,
            errorCode: result.errorCode ?? null,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id: result.messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const memberId: string = String(body.member_id ?? "").trim();
    const message: string = String(body.message ?? "").trim();
    const punish: string = String(body.punish ?? "").trim();
    const sequenceStr: string = body.sequence !== undefined ? String(body.sequence) : "-";
    const imageUrl1: string = String(body.image_url_1 ?? "").trim();
    const imageUrl2: string | null = body.image_url_2 ? String(body.image_url_2).trim() || null : null;
    const isSpoiler1: boolean = Boolean(body.is_spoiler_1 ?? body.is_spoiler ?? false);
    const isSpoiler2: boolean = Boolean(body.is_spoiler_2 ?? body.is_spoiler ?? false);
    const channelId: string = String(body.channel_id ?? TAG_WARN_CHANNEL_ID).trim();

    if (!memberId || !message || !punish) {
      return new Response(
        JSON.stringify({ error: "member_id, message, punish are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const FALLBACK_WARN_IMAGE =
      "https://cdn.discordapp.com/attachments/1565840974737973428/1568275494611189790/90faf4784f1eebbb.png";
    const finalImageUrl1 = imageUrl1 || FALLBACK_WARN_IMAGE;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const discordTimestamp = `<t:${nowSeconds}:F> (<t:${nowSeconds}:R>)`;

    // สร้าง media gallery items
    type MediaItem = { media: { url: string }; spoiler?: boolean };
    const mediaItems: MediaItem[] = [
      {
        media: { url: finalImageUrl1 },
        ...(finalImageUrl1 === FALLBACK_WARN_IMAGE ? { spoiler: false } : (isSpoiler1 ? { spoiler: true } : {})),
      },
    ];
    if (imageUrl2) {
      mediaItems.push({ media: { url: imageUrl2 }, ...(isSpoiler2 ? { spoiler: true } : {}) });
    }

    const isGeneralNotice = punish.trim() === "แท็กบอกทั่วไป";

    const containerInnerComponents: Record<string, unknown>[] = [
      {
        type: 12, // Media Gallery
        items: mediaItems,
      },
      {
        type: 10, // Text Display - Header
        content:
          "## <a:bearg22:1396016006572412998>︲__` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ จากบาริสต้า 𓂃 `__\n-# แจ้งเตือนนี้เป็นการแจ้งเตือนอย่างเป็นทางการจากระบบ โดยระบบตรวจพบการดำเนินการบางส่วนที่อาจไม่เป็นไปตามเงื่อนไขที่กำหนด กรุณาอ่านรายละเอียดให้ครบถ้วนและปฏิบัติตามคำแนะนำของระบบเพื่อดำเนินการต่อ <:cuteplant:1152834055528783872>",
      },
      { type: 14, spacing: 2 }, // Separator
      {
        type: 10, // Text Display - Case info
        content:
          `- **\` 📌 เคสอ้างอิง #${sequenceStr} \`** *!*\n` +
          `  - **สาเหตุ:** ${message}\n` +
          ` > (👤)︰<@${memberId}> — ${memberId}\n` +
          ` > (📝)︰${punish}\n` +
          ` > (<a:7596clock:1160230591892029510>)︰${discordTimestamp}`,
      },
    ];

    // ถ้าเป็น "แท็กบอกทั่วไป" จะไม่ต้องมีปุ่มลิงก์แก้ถ้วยความผิด
    if (!isGeneralNotice) {
      containerInnerComponents.push(
        { type: 14, spacing: 1, divider: false }, // Separator
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 5, // Link
              label: "︲แก้ถ้วยความผิด",
              emoji: {
                id: "1563093703168360479",
                name: "pingroleicon",
                animated: false,
              },
              url: "https://discord.com/channels/1144251788493602848/1524123796825706506",
              custom_id: "p_365873459160420355",
            },
          ],
        },
      );
    }

    const payload: Record<string, unknown> = {
      flags: 32768,
      components: [
        {
          type: 17, // Container
          components: containerInnerComponents,
        },
      ],
    };

    const result = await sendDiscordBotMessage(channelId, payload, {
      dedupKey: `tag-warn:${memberId}:${nowSeconds}`,
    });

    if (!result.success) {
      console.error("[send-tag-warn-embed] Discord send failed", {
        memberId,
        error: result.error,
        errorCode: result.errorCode ?? null,
        status: result.status ?? null,
        discordErrorCode: result.discordErrorCode ?? null,
      });
      return new Response(
        JSON.stringify({
          error: "Discord API failed",
          details: result.error,
          errorCode: result.errorCode ?? null,
          status: result.status ?? null,
          discordErrorCode: result.discordErrorCode ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-tag-warn-embed] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
