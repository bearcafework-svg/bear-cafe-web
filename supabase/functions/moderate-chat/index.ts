/**
 * moderate-chat — Bear Cafe AI Content Moderation
 * Uses OpenAI Moderation API ONLY (FREE — zero token cost)
 * https://platform.openai.com/docs/api-reference/moderations
 *
 * Required secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   OPENAI_API_KEY            — your OpenAI key
 *   SUPABASE_URL              — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *
 * Request body:
 *   { text: string, session_id: string, user_id: string }
 *
 * Response body:
 *   { isFlagged: boolean, categories: Record<string, boolean> }
 *
 * When isFlagged === true, this function:
 *   1. Inserts a violation log into chat_violations (triggers Realtime for admin)
 *   2. Inserts a system warning message into chat_messages (visible to both users)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenAI category key → Thai label
const CATEGORY_TH: Record<string, string> = {
  "harassment":             "คุกคาม",
  "harassment/threatening": "คุกคาม/ข่มขู่",
  "hate":                   "สร้างความเกลียดชัง",
  "hate/threatening":       "เกลียดชัง/ข่มขู่",
  "illicit":                "ผิดกฎหมาย",
  "illicit/violent":        "ผิดกฎหมาย/รุนแรง",
  "self-harm":              "ทำร้ายตัวเอง",
  "self-harm/intent":       "ตั้งใจทำร้ายตัวเอง",
  "self-harm/instructions": "วิธีทำร้ายตัวเอง",
  "sexual":                 "อนาจาร",
  "sexual/minors":          "อนาจาร/เด็ก",
  "violence":               "ความรุนแรง",
  "violence/graphic":       "ความรุนแรง/กราฟิก",
};

// Sentinel UUID used as sender_id for system messages
// Must not match any real user UUID
const SYSTEM_SENDER_ID = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, session_id, user_id } = await req.json();

    // ── Validate input ────────────────────────────────────────────────────────
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey   = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // ── No API key → fail open (allow message, skip moderation) ──────────────
    if (!openaiKey) {
      console.warn("[moderate-chat] OPENAI_API_KEY not set — skipping moderation");
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call OpenAI Moderation API (FREE endpoint) ────────────────────────────
    const modRes = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text.trim(),
      }),
    });

    if (!modRes.ok) {
      const errText = await modRes.text();
      console.error("[moderate-chat] OpenAI error:", modRes.status, errText);
      // Fail open on upstream error
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modData = await modRes.json();
    const result  = modData.results?.[0];

    if (!result) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build flagged categories map ──────────────────────────────────────────
    const flaggedCategories: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(result.categories ?? {})) {
      if (value === true) flaggedCategories[key] = true;
    }

    const isFlagged = result.flagged === true;

    // ── If flagged: log violation + insert system warning message ─────────────
    if (isFlagged && session_id && user_id && supabaseUrl && serviceKey) {
      const dbHeaders = {
        "apikey":        serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
      };

      // 1. Log to chat_violations → triggers Realtime for admin "สังเกตการณ์" tab
      const violationInsert = fetch(`${supabaseUrl}/rest/v1/chat_violations`, {
        method: "POST",
        headers: dbHeaders,
        body: JSON.stringify({
          session_id,
          user_id,
          word:          "__ai_flagged__",
          message:       text.trim(),
          ai_categories: flaggedCategories,
        }),
      });

      // 2. Build Thai category label string for the warning message
      const categoryLabels = Object.keys(flaggedCategories)
        .map(k => CATEGORY_TH[k] ?? k)
        .join(", ");

      const warningText = categoryLabels
        ? `🐻 รปภ. หมี: ติ๊ดๆ! ข้อความเมื่อครู่ถูกบล็อกเนื่องจากมีเนื้อหาสุ่มเสี่ยง (หมวดหมู่: ${categoryLabels}) รบกวนใช้คำสุภาพน้า`
        : "🐻 รปภ. หมี: ติ๊ดๆ! ข้อความเมื่อครู่ถูกบล็อกเนื่องจากมีเนื้อหาสุ่มเสี่ยง รบกวนใช้คำสุภาพน้า";

      // 3. Insert system warning into chat_messages (both users see it via Realtime)
      const systemMsgInsert = fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
        method: "POST",
        headers: dbHeaders,
        body: JSON.stringify({
          session_id,
          sender_id: SYSTEM_SENDER_ID,
          content:   warningText,
          is_system: true,
        }),
      });

      // Run both inserts in parallel
      const [vRes, mRes] = await Promise.all([violationInsert, systemMsgInsert]);

      if (!vRes.ok) {
        console.error("[moderate-chat] violation insert error:", await vRes.text());
      }
      if (!mRes.ok) {
        console.error("[moderate-chat] system message insert error:", await mRes.text());
      }
    }

    return new Response(
      JSON.stringify({ isFlagged, categories: flaggedCategories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[moderate-chat] Unexpected error:", err);
    return new Response(
      JSON.stringify({ isFlagged: false, categories: {} }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
