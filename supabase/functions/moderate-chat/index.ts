/**
 * moderate-chat — Bear Cafe AI Content Moderation
 * Uses OpenAI Moderation API ONLY (FREE — zero token cost)
 *
 * Auto-injected secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Manual secret: OPENAI_API_KEY
 *
 * POST { text: string, session_id: string, user_id: string }
 * -> { isFlagged: boolean, categories: Record<string, boolean> }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenAI category key -> Thai label (kept as runtime values, not source literals)
function getCategoryTh(key: string): string {
  const map: Record<string, string> = {
    "harassment":             "\u0e04\u0e38\u0e01\u0e04\u0e32\u0e21",
    "harassment/threatening": "\u0e04\u0e38\u0e01\u0e04\u0e32\u0e21/\u0e02\u0e48\u0e21\u0e02\u0e39\u0e48",
    "hate":                   "\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e04\u0e27\u0e32\u0e21\u0e40\u0e01\u0e25\u0e35\u0e22\u0e14\u0e0a\u0e31\u0e07",
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

// Sentinel UUID for system messages
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

    if (!text) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey   = Deno.env.get("OPENAI_API_KEY")   ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")      ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!openaiKey) {
      console.warn("[moderate-chat] OPENAI_API_KEY not set — skipping");
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI /v1/moderations (FREE endpoint)
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
      // Fail open — don't block users when OpenAI is down
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

    // Build flagged categories map
    const flaggedCategories: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(result.categories ?? {})) {
      if (val === true) flaggedCategories[key] = true;
    }
    const isFlagged: boolean = result.flagged === true;

    console.log("[moderate-chat] result:", { isFlagged, keys: Object.keys(flaggedCategories) });

    // If flagged: log violation + insert system warning
    if (isFlagged && session_id && user_id && supabaseUrl && serviceKey) {
      const categoryLabels = Object.keys(flaggedCategories)
        .map(k => getCategoryTh(k))
        .join(", ");

      // Build warning text using unicode escapes to avoid encoding issues
      const prefix  = "\u0e15\u0e34\u0e4a\u0e14\u0e46! \u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e04\u0e23\u0e39\u0e48\u0e16\u0e39\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e40\u0e19\u0e37\u0e48\u0e2d\u0e07\u0e08\u0e32\u0e01\u0e21\u0e35\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e2a\u0e38\u0e48\u0e21\u0e40\u0e2a\u0e35\u0e48\u0e22\u0e07";
      const suffix  = "\u0e23\u0e1a\u0e01\u0e27\u0e19\u0e43\u0e0a\u0e49\u0e04\u0e33\u0e2a\u0e38\u0e20\u0e32\u0e1e\u0e19\u0e49\u0e32";
      const catPart = categoryLabels ? ` (\u0e2b\u0e21\u0e27\u0e14\u0e2b\u0e21\u0e39\u0e48: ${categoryLabels})` : "";
      const warningText = `\ud83d\udc3b \u0e23\u0e1b\u0e20. \u0e2b\u0e21\u0e35: ${prefix}${catPart} ${suffix}`;

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

    return new Response(
      JSON.stringify({ isFlagged, categories: flaggedCategories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[moderate-chat] unhandled error:", err);
    return new Response(
      JSON.stringify({ isFlagged: false, categories: {} }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
