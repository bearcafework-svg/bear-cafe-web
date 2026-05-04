/**
 * moderate-chat — Bear Cafe AI Content Moderation
 * Uses OpenAI Moderation API ONLY (FREE — zero token cost)
 *
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Manual secret: OPENAI_API_KEY
 *
 * POST { text: string, session_id: string, user_id: string }
 * -> { isFlagged: boolean, categories: Record<string, boolean> }
 *
 * DEBUG MODE: fail-closed — errors are returned explicitly so the
 * frontend can surface them in the console for diagnosis.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Thai labels as unicode escapes to avoid any encoding issues at deploy time
function getCategoryTh(key: string): string {
  const map: Record<string, string> = {
    "harassment":             "\u0e04\u0e38\u0e01\u0e04\u0e32\u0e21",
    "harassment/threatening": "\u0e04\u0e38\u0e01\u0e04\u0e32\u0e21/\u0e02\u0e48\u0e21\u0e02\u0e39\u0e48",
    "hate":                   "\u0e40\u0e01\u0e25\u0e35\u0e22\u0e14\u0e0a\u0e31\u0e07",
    "hate/threatening":       "\u0e40\u0e01\u0e25\u0e35\u0e22\u0e14\u0e0a\u0e31\u0e07/\u0e02\u0e48\u0e21\u0e02\u0e39\u0e48",
    "illicit":                "\u0e1c\u0e34\u0e14\u0e01\u0e0e\u0e2b\u0e21\u0e32\u0e22",
    "illicit/violent":        "\u0e1c\u0e34\u0e14\u0e01\u0e0e\u0e2b\u0e21\u0e32\u0e22/\u0e23\u0e38\u0e19\u0e41\u0e23\u0e07",
    "self-harm":              "\u0e17\u0e33\u0e23\u0e49\u0e32\u0e22\u0e15\u0e31\u0e27\u0e40\u0e2d\u0e07",
    "self-harm/intent":       "\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e17\u0e33\u0e23\u0e49\u0e32\u0e22\u0e15\u0e31\u0e27\u0e40\u0e2d\u0e07",
    "self-harm/instructions": "\u0e27\u0e34\u0e18\u0e35\u0e17\u0e33\u0e23\u0e49\u0e32\u0e22\u0e15\u0e31\u0e27\u0e40\u0e2d\u0e07",
    "sexual":                 "\u0e2d\u0e19\u0e32\u0e08\u0e32\u0e23",
    "sexual/minors":          "\u0e2d\u0e19\u0e32\u0e08\u0e32\u0e23/\u0e40\u0e14\u0e47\u0e01",
    "violence":               "\u0e04\u0e27\u0e32\u0e21\u0e23\u0e38\u0e19\u0e41\u0e23\u0e07",
    "violence/graphic":       "\u0e04\u0e27\u0e32\u0e21\u0e23\u0e38\u0e19\u0e41\u0e23\u0e07/\u0e01\u0e23\u0e32\u0e1f\u0e34\u0e01",
  };
  return map[key] ?? key;
}

const SYSTEM_SENDER_ID = "00000000-0000-0000-0000-000000000000";

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
    throw new Error(`INSERT ${table} failed (${res.status}): ${body}`);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text: string       = (body.text       ?? "").trim();
    const session_id: string = body.session_id  ?? "";
    const user_id: string    = body.user_id     ?? "";

    console.log("[moderate-chat] received:", { textLen: text.length, session_id, user_id });

    if (!text) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey   = Deno.env.get("OPENAI_API_KEY")            ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")               ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  ?? "";

    if (!openaiKey) {
      console.error("[moderate-chat] OPENAI_API_KEY is not set!");
      // Fail-closed: return error so frontend blocks the message
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {}, error: "OPENAI_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call OpenAI /v1/moderations ───────────────────────────────────────────
    console.log("[moderate-chat] calling OpenAI...");
    const modRes = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    const modRawText = await modRes.text();
    console.log("[moderate-chat] OpenAI status:", modRes.status, "body:", modRawText.slice(0, 300));

    if (!modRes.ok) {
      // Fail-closed: surface the error explicitly
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {}, error: `OpenAI ${modRes.status}: ${modRawText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modData = JSON.parse(modRawText);
    const result  = modData.results?.[0];

    if (!result) {
      console.error("[moderate-chat] unexpected OpenAI shape:", modRawText);
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {}, error: "unexpected_openai_shape" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse result ──────────────────────────────────────────────────────────
    const flaggedCategories: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(result.categories ?? {})) {
      if (val === true) flaggedCategories[key] = true;
    }
    const isFlagged: boolean = result.flagged === true;

    console.log("[moderate-chat] isFlagged:", isFlagged, "categories:", Object.keys(flaggedCategories));

    // ── If flagged: write to DB ───────────────────────────────────────────────
    if (isFlagged && session_id && user_id && supabaseUrl && serviceKey) {
      const categoryLabels = Object.keys(flaggedCategories).map(k => getCategoryTh(k)).join(", ");
      const warningText = categoryLabels
        ? `\ud83d\udc3b \u0e23\u0e1b\u0e20. \u0e2b\u0e21\u0e35: \u0e15\u0e34\u0e4a\u0e14\u0e46! \u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01 (\u0e2b\u0e21\u0e27\u0e14: ${categoryLabels}) \u0e23\u0e1a\u0e01\u0e27\u0e19\u0e43\u0e0a\u0e49\u0e04\u0e33\u0e2a\u0e38\u0e20\u0e32\u0e1e\u0e19\u0e49\u0e32`
        : `\ud83d\udc3b \u0e23\u0e1b\u0e20. \u0e2b\u0e21\u0e35: \u0e15\u0e34\u0e4a\u0e14\u0e46! \u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01 \u0e23\u0e1a\u0e01\u0e27\u0e19\u0e43\u0e0a\u0e49\u0e04\u0e33\u0e2a\u0e38\u0e20\u0e32\u0e1e\u0e19\u0e49\u0e32`;

      const dbResults = await Promise.allSettled([
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

      for (const r of dbResults) {
        if (r.status === "rejected") {
          console.error("[moderate-chat] DB write failed:", r.reason);
        }
      }
    }

    // Always return 200 with the result — frontend decides what to do
    return new Response(
      JSON.stringify({ isFlagged, categories: flaggedCategories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[moderate-chat] unhandled error:", msg);
    // Fail-closed: return 500 so frontend blocks the message
    return new Response(
      JSON.stringify({ isFlagged: false, categories: {}, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
