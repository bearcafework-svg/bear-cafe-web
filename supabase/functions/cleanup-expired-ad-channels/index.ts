import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanResultItem {
  id: string;
  channel_id: string;
  status: "deleted" | "already_deleted" | "error";
  details?: string;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Optional Auth check if called by user from Dashboard
    let operatorName = "ระบบอัตโนมัติ (Cleanup Service)";
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (user) {
        const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
        const { data: profile } = await adminClient
          .from("profiles")
          .select("id, username, discord_username")
          .eq("discord_id", discordId)
          .maybeSingle();

        if (profile) {
          operatorName = profile.discord_username || profile.username || "Admin";
        }
      }
    }

    let requestBody: any = {};
    if (req.method === "POST") {
      try {
        requestBody = await req.json();
      } catch {
        requestBody = {};
      }
    }

    const contractId = requestBody?.contract_id;
    let query = adminClient
      .from("contracts")
      .select("*")
      .eq("type", "ad")
      .not("channel_id", "is", null)
      .is("channel_deleted_at", null);

    if (contractId) {
      query = query.eq("id", contractId);
    } else {
      // Find all expired contracts
      query = query.lte("end_at", new Date().toISOString());
    }

    const { data: contracts, error: dbError } = await query;
    if (dbError) throw dbError;

    if (!contracts || contracts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ไม่พบห้องโฆษณาที่ครบกำหนดเวลาที่ต้องลบ",
          deletedCount: 0,
          results: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: CleanResultItem[] = [];
    let deletedCount = 0;

    for (const contract of contracts) {
      const channelId = String(contract.channel_id ?? "").trim();
      if (!channelId) continue;

      try {
        // Discord API: DELETE /channels/{channel.id}
        const discordRes = await discordFetch(
          `https://discord.com/api/v10/channels/${channelId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
              "X-Audit-Log-Reason": "สัญญาโฆษณาครบกำหนดเวลาแล้ว ลบห้องอัตโนมัติ",
            },
          }
        );

        // 200 OK: Channel successfully deleted
        // 404 Not Found: Channel already deleted or does not exist
        if (discordRes.status === 200 || discordRes.status === 404) {
          const nowIso = new Date().toISOString();
          const editLog = Array.isArray(contract.edit_log) ? contract.edit_log : [];
          const statusText = discordRes.status === 200 ? "deleted" : "already_deleted";

          const newLog = [
            ...editLog,
            {
              editor: operatorName,
              avatar: null,
              timestamp: nowIso,
              action:
                discordRes.status === 200
                  ? `ลบห้อง Discord (${channelId}) สำเร็จเนื่องจากหมดอายุสัญญา`
                  : `ไม่พบห้อง Discord (${channelId}) ในระบบแล้ว ปรับสถานะเป็นลบเรียบร้อย`,
            },
          ];

          await adminClient
            .from("contracts")
            .update({
              channel_deleted_at: nowIso,
              updated_at: nowIso,
              edit_log: newLog,
            })
            .eq("id", contract.id);

          deletedCount++;
          results.push({
            id: contract.id,
            channel_id: channelId,
            status: statusText,
          });
        } else {
          const errText = await discordRes.text().catch(() => "");
          console.error(
            `[cleanup-expired-ad-channels] Failed to delete channel ${channelId}: HTTP ${discordRes.status}`,
            errText
          );
          results.push({
            id: contract.id,
            channel_id: channelId,
            status: "error",
            details: `HTTP ${discordRes.status}: ${errText}`,
          });
        }
      } catch (err: any) {
        console.error(`[cleanup-expired-ad-channels] Exception for channel ${channelId}:`, err);
        results.push({
          id: contract.id,
          channel_id: channelId,
          status: "error",
          details: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `ดำเนินการเสร็จสิ้น (ลบห้องสำเร็จ ${deletedCount}/${contracts.length} รายการ)`,
        deletedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cleanup-expired-ad-channels] Server error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
