/**
 * moderate-chat — Bear Cafe AI Content Moderation
 * Uses OpenAI Moderation API ONLY (FREE — zero token cost)
 * https://platform.openai.com/docs/api-reference/moderations
 *
 * Auto-injected Supabase secrets (no manual setup needed):
 *   SUPABASE_URL              — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for DB writes
 *
 * Manual secret (set in Dashboard → Project Settings → Edge Functions → Secrets):
 *   OPENAI_API_KEY
 *
 * Request:  POST { text: string, session_id: string, user_id: string }
 * Response: { isFlagged: boolean, categories: Record<string, boolean> }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Sentinel UUID for system messages — must not match any real user
const SYSTEM_SENDER_ID = "00000000-0000-0000-0000-000000000000";

// ── DB helper using service role (bypasses RLS) ───────────────────────────────
async function dbInsert(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey":        serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[moderate-chat] INSERT ${table} failed (${res.status}): ${body}`);
  }
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text       = (body.text       ?? "").trim();
    const session_id = body.session_id  ?? null;
    const user_id    = body.user_id     ?? null;

    if (!text) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey   = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey) {
      console.warn("[moderate-chat] OPENAI_API_KEY not configured — skipping");
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call OpenAI /v1/moderations (FREE) ────────────────────────────────────
    console.log("[moderate-chat] calling OpenAI for session:", session_id);
    const modRes = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    if (!modRes.ok) {
      const errBody = await modRes.text();
      console.error("[moderate-chat] OpenAI error:", modRes.status, errBody);
      // Fail CLOSED on OpenAI error — return error so frontend blocks the send
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {}, error: "moderation_unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modData = await modRes.json();
    const result  = modData.results?.[0];

    if (!result) {
      console.error("[moderate-chat] unexpected OpenAI response shape:", JSON.stringify(modData));
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build flagged categories ───────────────────────────────────────────────
    const flaggedCategories: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(result.categories ?? {})) {
      if (val === true) flaggedCategories[key] = true;
    }
    const isFlagged = result.flagged === true;

    console.log("[moderate-chat] result:", { isFlagged, flaggedCategories });

    // ── If flagged: write violation log + system warning (both await'd) ───────
    if (isFlagged && session_id && user_id && supabaseUrl && serviceKey) {
      const categoryLabels = Object.keys(flaggedCategories)
        .map(k => CATEGORY_TH[k] ?? k)
        .join(", ");

      const warningText = categoryLabels
        ? `🐻 รปภ. หมี: ติ๊ดๆ! ข้อความเมื่อครู่ถูกบล็อกเนื่องจากมีเนื้อหาสุ่มเสี่ยง (หมวดหมู่: ${categoryLabels}) รบกวนใช้คำสุภาพน้า`
        : "🐻 รปภ. หมี: ติ๊ดๆ! ข้อความเมื่อครู่ถูกบล็อกเนื่องจากมีเนื้อหาสุ่มเสี่ยง รบกวนใช้คำสุภาพน้า";

      // Both inserts must succeed — await them so errors surface in logs
      const results = await Promise.allSettled([
        dbInsert(supabaseUrl, serviceKey, "chat_violations", {
          session_id,
          user_id,
          word:          "__ai_flagged__",
          message:       text,
          ai_categories: flaggedCategories,
        }),
        dbInsert(supabaseUrl, serviceKey, "chat_messages", {
          session_id,
          sender_id: SYSTEM_SENDER_ID,
          content:   warningText,
          is_system: true,
        }),
      ]);

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[moderate-chat] DB write failed:", r.reason);
        }
      }
    }

    return new Response(
      JSON.stringify({ isFlagged, categories: flaggedCategories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[moderate-chat] unhandled error:", err);
    return new Response(
      JSON.stringify({ isFlagged: false, categories: {}, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
