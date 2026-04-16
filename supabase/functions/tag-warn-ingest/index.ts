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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return respond({ ok: false, error: "invalid_body" }, 400);
    }

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

    // Parse the timestamp from Thai format "DD/MM/YYYY HH:mm:ss"
    let logTimestamp: string | null = null;
    if (body.timestamp) {
      const raw = String(body.timestamp);
      const parts = raw.split(" ");
      if (parts.length >= 2) {
        const dateParts = parts[0].split("/");
        const timeParts = parts[1].split(":");
        if (dateParts.length === 3 && timeParts.length >= 2) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const year = parseInt(dateParts[2], 10);
          const hour = parseInt(timeParts[0], 10);
          const minute = parseInt(timeParts[1], 10);
          const second = parseInt(timeParts[2] || "0", 10);
          const d = new Date(year, month, day, hour, minute, second);
          if (!isNaN(d.getTime())) {
            logTimestamp = d.toISOString();
          }
        }
      }
      // Fallback: try direct ISO parse
      if (!logTimestamp) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          logTimestamp = d.toISOString();
        }
      }
    }

    const { error } = await supabase.from("tag_warn_logs").insert({
      barista_id: body.barista_id ? String(body.barista_id) : null,
      member_id: body.member_id ? String(body.member_id) : null,
      message: body.message ? String(body.message) : null,
      punish: body.punish ? String(body.punish) : null,
      punish_link: body.punish_link ? String(body.punish_link) : null,
      image_url: body.image_url ? String(body.image_url) : null,
      log_timestamp: logTimestamp,
    });

    if (error) {
      console.error("Insert error", error);
      return respond({ ok: false, error: "insert_failed" }, 500);
    }

    return respond({ ok: true }, 200);
  } catch (error) {
    console.error("Tag warn ingest error", error);
    return respond({ ok: false, error: "internal_error" }, 500);
  }
});
