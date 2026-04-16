import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Parse Thai timestamp "DD/MM/YYYY HH:mm:ss" or other formats to ISO string */
function parseTimestamp(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.split(" ");
  if (parts.length >= 2) {
    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");
    if (dateParts.length === 3 && timeParts.length >= 2) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      let year = parseInt(dateParts[2], 10);
      // Convert Buddhist Era to CE if needed
      if (year > 2400) year -= 543;
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      const second = parseInt(timeParts[2] || "0", 10);
      const d = new Date(year, month, day, hour, minute, second);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  // Fallback
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return respond({ ok: false, error: "invalid_body" }, 400);

    // Verify shared secret
    const secret = Deno.env.get("TAG_WARN_APPS_SCRIPT_SECRET");
    if (!secret || body.secret !== secret) {
      return respond({ ok: false, error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return respond({ ok: false, error: "config_missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logTimestamp = parseTimestamp(String(body.log_timestamp || "")) || new Date().toISOString();

    const { error } = await supabase.from("trading_history").insert({
      log_timestamp: logTimestamp,
      service_id: body.service_id ? String(body.service_id) : null,
      transaction: body.transaction ? String(body.transaction) : null,
      member_id: String(body.member_id),
      amount: typeof body.amount === "number" ? body.amount : parseFloat(String(body.amount || "0")) || 0,
      type_bill: body.type_bill ? String(body.type_bill) : null,
      item: body.item ? String(body.item) : null,
      slip_url: body.slip_url ? String(body.slip_url) : null,
    });

    if (error) {
      console.error("Insert error", error);
      return respond({ ok: false, error: "insert_failed", detail: error.message }, 500);
    }

    return respond({ ok: true }, 200);
  } catch (err) {
    console.error("Trading history ingest error", err);
    return respond({ ok: false, error: String(err) }, 500);
  }
});
