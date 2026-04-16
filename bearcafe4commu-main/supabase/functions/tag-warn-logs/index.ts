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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return respond({ error: "Supabase configuration missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid token" }, 401);
    }

    // Check admin access
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);

    if (!roles || roles.length === 0) {
      return respond({ error: "Admin access required" }, 403);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const query = typeof body.query === "string" ? body.query.toLowerCase() : undefined;

    const dbQuery = supabase
      .from("tag_warn_logs")
      .select("*")
      .order("log_timestamp", { ascending: false });

    const { data: rows, error: dbError } = await dbQuery;

    if (dbError) {
      console.error("DB query error", dbError);
      return respond({ error: "Failed to fetch logs" }, 500);
    }

    const records = (rows ?? [])
      .map((row: Record<string, unknown>) => ({
        index: String(row.id ?? ""),
        timestamp: row.log_timestamp ? String(row.log_timestamp) : String(row.created_at ?? ""),
        admin_id: String(row.barista_id ?? ""),
        member_id: String(row.member_id ?? ""),
        reason: String(row.message ?? ""),
        punishment: String(row.punish ?? ""),
        punish_link: String(row.punish_link ?? ""),
        image_url: String(row.image_url ?? ""),
      }))
      .filter((r: Record<string, string>) => {
        if (!query) return true;
        const haystack = `${r.admin_id} ${r.member_id} ${r.reason}`.toLowerCase();
        return haystack.includes(query);
      });

    return respond({ ok: true, records }, 200);
  } catch (error) {
    console.error("Tag warn logs error", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
