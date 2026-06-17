/**
 * send-tag-warn-embed
 * ส่ง Components V2 แจ้งเตือนแท็กเตือนผ่าน Discord Bot API
 * รับ: { member_id, message, punish, image_url_1, image_url_2?, barista_discord_id?, is_spoiler? }
 */
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAG_WARN_CHANNEL_ID = "1168874550889566228";
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
    const memberId: string = String(body.member_id ?? "").trim();
    const message: string = String(body.message ?? "").trim();
    const punish: string = String(body.punish ?? "").trim();
    const imageUrl1: string = String(body.image_url_1 ?? "").trim();
    const imageUrl2: string | null = body.image_url_2 ? String(body.image_url_2).trim() || null : null;
    const isSpoiler: boolean = Boolean(body.is_spoiler ?? false);
    const channelId: string = String(body.channel_id ?? TAG_WARN_CHANNEL_ID).trim();

    if (!memberId || !message || !punish || !imageUrl1) {
      return new Response(
        JSON.stringify({ error: "member_id, message, punish, image_url_1 are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const discordTimestamp = `<t:${nowSeconds}:F> (<t:${nowSeconds}:R>)`;

    const textContent = `\n## <a:bearg22:1396016006572412998>︲__\` 𝖭𝗈𝗍𝗂𝖼𝖾 ₊ จากบาริสต้า 𓂃 \`__\n-# **สาเหตุ:** ${message} <:cuteplant:1152834055528783872>\n\n> (👤)︰<@${memberId}> — ${memberId}\n> (⏰)︰${discordTimestamp}\n> (📝)︰${punish}`;

    // สร้าง media gallery items
    type MediaItem = { media: { url: string }; spoiler?: boolean };
    const mediaItems: MediaItem[] = [{ media: { url: imageUrl1 }, ...(isSpoiler ? { spoiler: true } : {}) }];
    if (imageUrl2) {
      mediaItems.push({ media: { url: imageUrl2 }, ...(isSpoiler ? { spoiler: true } : {}) });
    }

    const payload: Record<string, unknown> = {
      flags: 32768,
      components: [
        {
          type: 17, // Container
          components: [
            {
              type: 12, // Media Gallery
              items: mediaItems,
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
                  type: 2, // Button
                  style: 5, // Link
                  label: "วิธีปลดถ้วยความผิด",
                  url: GUIDE_CHANNEL_URL,
                },
              ],
            },
          ],
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
          discordErrorCode: result.discordErrorCode ?? null,
          discordStatus: result.status ?? null,
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
