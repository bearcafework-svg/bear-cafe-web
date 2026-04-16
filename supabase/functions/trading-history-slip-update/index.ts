import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const expectedSecret = Deno.env.get("TAG_WARN_APPS_SCRIPT_SECRET");

    if (!expectedSecret || body.secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { member_id, transaction, slip_url, slip_url_2 } = body;

    if (!member_id || !transaction || (!slip_url && !slip_url_2)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: member_id, transaction, and at least one slip_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updatePayload: Record<string, string> = {};
    if (slip_url) updatePayload.slip_url = slip_url;
    if (slip_url_2) updatePayload.slip_url_2 = slip_url_2;

    const { data, error } = await supabase
      .from("trading_history")
      .update(updatePayload)
      .eq("member_id", member_id)
      .eq("transaction", transaction)
      .select("id")
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ status: "not_found", member_id, transaction }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "updated", id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
