import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Count approved messages
    const { count, error: countError } = await client
      .from("healing_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    if (countError || !count || count === 0) {
      return new Response(
        JSON.stringify({ message: null, discord_id: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Pick a truly random offset
    const randomOffset = Math.floor(Math.random() * count);

    // Step 3: Fetch that single row
    const { data, error } = await client
      .from("healing_messages")
      .select("message, author_id")
      .eq("status", "approved")
      .range(randomOffset, randomOffset)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ message: null, discord_id: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Get discord_id from profiles
    let discord_id: string | null = null;
    if (data.author_id) {
      const { data: profile } = await client
        .from("profiles")
        .select("discord_id")
        .eq("id", data.author_id)
        .single();
      discord_id = profile?.discord_id ?? null;
    }

    return new Response(
      JSON.stringify({ message: data.message, discord_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
