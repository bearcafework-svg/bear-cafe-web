/**
 * send-daily-quest-announcement
 * ส่ง Discord Component V2 การ์ดประกาศภารกิจประจำวัน (Daily Quests)
 * รับ: { quest_date?: string, channel_id?: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { sendDiscordBotMessage } from "../_shared/discord-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CHANNEL_ID = "1529885509260673034";
const BANNER_IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1524704267015819274/1550771948592701500/ChatGPT_Image_19_.._2569_13_54_04.png?ex=6ab380ec&is=6ab22f6c&hm=aa882b8c0feaf2104b4d078998ab385af499e9a24803e3a0d7b70f4541c55f1a&";
const SPECIAL_REWARD_ICON_URL =
  "https://cdn.discordapp.com/attachments/1524704267015819274/1551949346981806090/06b20e483bfac611d837c1db30d5fbad.png?ex=6ab3d4f6&is=6ab28376&hm=c9873c872cb823c9a7c41ff041eb4ff0ba44b8287f3a588acbeecda8c973551b&";
const POINT_ICON_STR = "<:strawberryv2:1520439075100688614>";
const FULL_COMPLETION_BONUS_POINTS = 50;
const CUSTOM_ID_PROGRESS = "daily_quest_progress";
const ANNOUNCE_PING_ROLE_ID = "1144700895020462200";

function getBangkokTodayDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function getNextMidnightTimestamp(): number {
  const now = new Date();
  const bkkNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const nextMidnight = new Date(bkkNow);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = nextMidnight.getTime() - bkkNow.getTime();
  return Math.floor((now.getTime() + diffMs) / 1000);
}

function formatThaiDate(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const day = d.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", day: "numeric" });
  const monthIdx = parseInt(d.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", month: "numeric" }), 10) - 1;
  const year = parseInt(d.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }), 10) + 543;
  return `${day} ${thaiMonths[monthIdx]} ${year}`;
}

export function buildAnnouncementPayload(questDate: string, quests: any[], nextResetTs: number) {
  const thaiDate = formatThaiDate(questDate);

  const questComponents: any[] = [];
  for (const q of quests) {
    questComponents.push({
      type: 10,
      content: `## ${q.title}\n- __\`วิธีทำเควส\`__ : ${q.description}\n- __\`รางวัล\`__ : ${POINT_ICON_STR} **+${q.reward_points}**`,
    });
    questComponents.push({
      type: 14,
      spacing: 2,
    });
  }

  return {
    flags: 32768, // Component V2
    components: [
      {
        type: 17,
        components: [
          {
            type: 12,
            items: [
              {
                media: {
                  url: BANNER_IMAGE_URL,
                },
              },
            ],
          },
          {
            type: 9,
            components: [
              {
                type: 10,
                content:
                  `## <:bee20000:1256669436350562355>︲__\` เควสประจำวันที่ ${thaiDate} 𓂃 \`__\n` +
                  `> (<a:7596clock:1160230591892029510>)⠀รีเซ็ตเควสในอีก: <t:${nextResetTs}:R>`,
              },
            ],
            accessory: {
              style: 3,
              type: 2,
              flow: {
                actions: [],
              },
              custom_id: CUSTOM_ID_PROGRESS,
              label: "ดูความคืบหน้าเควส",
            },
          },
          {
            type: 14,
            spacing: 1,
            divider: false,
          },
          ...questComponents,
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `# > รับข้อความพิเศษเมื่อทำเควสครบทั้งหมด ${POINT_ICON_STR} +${FULL_COMPLETION_BONUS_POINTS}`,
              },
            ],
            accessory: {
              type: 11,
              media: {
                url: SPECIAL_REWARD_ICON_URL,
              },
            },
          },
        ],
      },
    ],
  };
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is okay, use defaults
    }

    const questDate = String(body.quest_date || getBangkokTodayDate()).trim();
    const channelId = String(
      body.channel_id || Deno.env.get("DISCORD_DAILY_QUEST_CHANNEL_ID") || DEFAULT_CHANNEL_ID
    ).trim();

    // 1. ดึงชุดเควสของวันที่ระบุ
    let { data: currentSet } = await supabase
      .from("daily_quest_sets")
      .select("*")
      .eq("quest_date", questDate)
      .maybeSingle();

    // 2. ถ้ายังไม่มีชุดเควส ให้สุ่มสร้างใหม่ 3 เควส
    if (!currentSet || !Array.isArray(currentSet.quest_ids) || currentSet.quest_ids.length === 0) {
      const { data: allTemplates } = await supabase
        .from("daily_quest_templates")
        .select("*")
        .eq("active", true);

      if (!allTemplates || allTemplates.length === 0) {
        return new Response(
          JSON.stringify({ error: "No active quest templates found in database" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const chatPool = allTemplates.filter((q) => q.category === "chat");
      const voiceCommPool = allTemplates.filter(
        (q) => q.category === "voice" || q.category === "community"
      );
      const irlPool = allTemplates.filter((q) => q.category === "irl");

      const q1 = chatPool[Math.floor(Math.random() * chatPool.length)] || chatPool[0];
      const q2 = voiceCommPool[Math.floor(Math.random() * voiceCommPool.length)] || voiceCommPool[0];
      const q3 = irlPool[Math.floor(Math.random() * irlPool.length)] || irlPool[0];

      const questIds = [q1?.id, q2?.id, q3?.id].filter(Boolean);

      const { data: newSet, error: insertErr } = await supabase
        .from("daily_quest_sets")
        .upsert(
          {
            quest_date: questDate,
            quest_ids: questIds,
            bonus_points: 50,
          },
          { onConflict: "quest_date" }
        )
        .select()
        .single();

      if (insertErr) throw insertErr;
      currentSet = newSet;
    }

    // 3. ดึงรายการเควสตาม quest_ids
    const { data: questsData } = await supabase
      .from("daily_quest_templates")
      .select("*")
      .in("id", currentSet.quest_ids);

    const orderedQuests = currentSet.quest_ids
      .map((qid: string) => questsData?.find((q: any) => q.id === qid))
      .filter(Boolean);

    if (!orderedQuests || orderedQuests.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not resolve quest templates for current set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. สร้าง Payload Component V2
    const nextResetTs = getNextMidnightTimestamp();
    const payload = buildAnnouncementPayload(questDate, orderedQuests, nextResetTs);

    // 5. ส่งข้อความแจ้งเตือนและแท็กบทบาทก่อน
    const pingContent = `<a:3602exclamationmarkbubble:1372837492205555812> เควสประจำวัน ${formatThaiDate(questDate)} มาแล้ว! <@&${ANNOUNCE_PING_ROLE_ID}>`;
    await sendDiscordBotMessage(channelId, { content: pingContent });

    // 6. ส่งผ่าน Discord Bot Message Utility
    const result = await sendDiscordBotMessage(channelId, payload, {
      dedupKey: `daily-quest-announcement:${questDate}:${Date.now()}`,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.error || "Failed to send message via Discord Bot API",
          details: result,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. อัปเดต announcement_message_id ใน daily_quest_sets
    await supabase
      .from("daily_quest_sets")
      .update({
        announcement_message_id: result.messageId,
        published_at: new Date().toISOString(),
      })
      .eq("id", currentSet.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        channelId,
        questDate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-daily-quest-announcement] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
