/**
 * fortune-test — Bear Cafe Tarot AI Fortune Teller
 * Uses OpenAI GPT (swap to Claude/Gemini by changing the fetch call)
 * Set env: OPENAI_API_KEY (or ANTHROPIC_API_KEY / GEMINI_API_KEY)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `คุณคือน้องหมีพยากรณ์แห่ง Bear Cafe หน้าที่ของคุณคือ นำข้อความ 'prediction' ที่ได้รับไปขัดเกลาให้นุ่มนวลและเป็นธรรมชาติ โดยใช้สำนวนแบบน้องหมีที่อบอุ่น (ใช้คำว่า นะคะ/น้า) และเชื่อมโยงกับคำถามของผู้ใช้สั้นๆ ตอบเป็นภาษาไทยเท่านั้น ความยาวไม่เกิน 3-4 ประโยค`;

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, cardName, meaning, prediction } = await req.json();

    if (!cardName || !prediction) {
      return new Response(
        JSON.stringify({ error: "cardName and prediction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      // Fallback: return prediction as-is if no AI key
      return new Response(
        JSON.stringify({ fortune: prediction }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMessage = `คำถามของผู้ใช้: "${question || "ไม่ได้ระบุคำถาม"}"
ไพ่ที่ได้: ${cardName}
ความหมาย: ${meaning}
คำทำนาย: ${prediction}

กรุณาขัดเกลาคำทำนายนี้ให้นุ่มนวลและเชื่อมโยงกับคำถามของผู้ใช้`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI error:", res.status, err);
      // Fallback to raw prediction on AI error
      return new Response(
        JSON.stringify({ fortune: prediction }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const fortune = data.choices?.[0]?.message?.content ?? prediction;

    return new Response(
      JSON.stringify({ fortune }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("fortune-test error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
