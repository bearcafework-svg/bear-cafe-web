/**
 * moderate-chat — Bear Cafe AI Content Moderation
 * Uses OpenAI Moderation API (FREE — no token cost)
 * https://platform.openai.com/docs/api-reference/moderations
 *
 * Required secret: OPENAI_API_KEY
 * Set via: Supabase Dashboard → Project Settings → Edge Functions → Secrets
 *
 * Request body:  { text: string }
 * Response body: { isFlagged: boolean, categories: Record<string, boolean> }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // If no API key is configured, fail open (allow message through)
    // so the chat still works during initial setup
    if (!openaiKey) {
      console.warn("[moderate-chat] OPENAI_API_KEY not set — skipping moderation");
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest", // free, most accurate
        input: text.trim(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[moderate-chat] OpenAI error:", res.status, errText);
      // Fail open on API error — don't block users due to upstream issues
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const result = data.results?.[0];

    if (!result) {
      return new Response(
        JSON.stringify({ isFlagged: false, categories: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only return categories that are actually flagged (true)
    const flaggedCategories: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(result.categories ?? {})) {
      if (value === true) flaggedCategories[key] = true;
    }

    return new Response(
      JSON.stringify({
        isFlagged: result.flagged === true,
        categories: flaggedCategories,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[moderate-chat] Unexpected error:", err);
    // Fail open — never block a message due to our own errors
    return new Response(
      JSON.stringify({ isFlagged: false, categories: {} }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
