import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_URL = 'https://script.google.com/macros/s/AKfycbycKl_xUfYzwRwRNRH2D9P-nRlx-KClzRRInEVHBWqZfCjzMmmuM9Yt9UfY_e1cjsQV1A/exec';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid token" }, 401);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"]);

    if (!roles || roles.length === 0) {
      return respond({ error: "Admin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const approvedBy = typeof body.approved_by === "string" ? body.approved_by : user.id;

    if (!requestId) {
      return respond({ error: "request_id is required" }, 400);
    }

    if (approvedBy !== user.id) {
      return respond({ error: "approved_by must match current user" }, 400);
    }

    const nowIso = new Date().toISOString();

    const { data: approvedRow, error: approveError } = await supabase
      .from("tag_warn_cancel_requests")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: nowIso,
        rejected_by: null,
        rejected_at: null,
        external_sync_status: "pending",
        external_synced_at: null,
        external_sync_error: null,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (approveError) {
      return respond({ error: "Failed to approve request", details: approveError.message }, 500);
    }

    if (!approvedRow) {
      return respond({ error: "Pending request not found" }, 404);
    }

    try {
      const externalResponse = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "cancel", timestamp: approvedRow.warn_timestamp }),
      });

      if (!externalResponse.ok) {
        throw new Error(`TagWarn API returned HTTP ${externalResponse.status}`);
      }

      const { data: syncedRow, error: syncUpdateError } = await supabase
        .from("tag_warn_cancel_requests")
        .update({
          external_sync_status: "success",
          external_synced_at: new Date().toISOString(),
          external_sync_error: null,
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (syncUpdateError) {
        return respond({ error: "Approved but failed to update sync status", details: syncUpdateError.message }, 500);
      }

      return respond({ ok: true, sync_success: true, request: syncedRow });
    } catch (syncError) {
      const syncMessage = syncError instanceof Error ? syncError.message : "Unknown sync error";

      const { data: failedRow, error: failedUpdateError } = await supabase
        .from("tag_warn_cancel_requests")
        .update({
          external_sync_status: "failed",
          external_synced_at: null,
          external_sync_error: syncMessage,
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (failedUpdateError) {
        return respond({
          ok: false,
          sync_success: false,
          error: "Approved but failed to persist sync error",
          details: failedUpdateError.message,
          sync_error: syncMessage,
        }, 500);
      }

      return respond({
        ok: true,
        sync_success: false,
        request: failedRow,
        sync_error: syncMessage,
      }, 200);
    }
  } catch (error) {
    console.error("tag-warn-cancel-sync error", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
