import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncContractRoleBody {
  action: "grant" | "revoke" | "cleanup_expired" | "sync_single";
  contract_id?: string;
  member_id?: string;
  role_id?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      return new Response(
        JSON.stringify({ error: "Missing Discord configuration (DISCORD_BOT_TOKEN or DISCORD_GUILD_ID)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check Authorization: either Service Role or User with 'contracts' permission
    const authHeader = req.headers.get("Authorization");
    let operatorName = "ระบบอัตโนมัติ";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== supabaseServiceKey) {
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: "Unauthorized - Invalid token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
        const { data: profile } = await adminClient
          .from("profiles")
          .select("id, username, nickname")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          operatorName = profile.nickname || profile.username || "แอดมิน";
          const { data: hasAccess } = await adminClient.rpc("has_page_access", {
            _user_id: profile.id,
            _page: "contracts",
          });

          if (!hasAccess) {
            return new Response(
              JSON.stringify({ error: "Access denied - No permission for contracts" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    const body = (await req.json().catch(() => ({}))) as SyncContractRoleBody;
    const action = body.action || "sync_single";

    // ──────────────────────────────────────────────────────────────────
    // Action 1: Grant Role
    // ──────────────────────────────────────────────────────────────────
    if (action === "grant") {
      const memberId = String(body.member_id ?? "").trim();
      const roleId = String(body.role_id ?? "").trim();

      if (!memberId || !roleId) {
        return new Response(
          JSON.stringify({ error: "Missing member_id or role_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
            "X-Audit-Log-Reason": `สัญญาเช่ายศ โดย ${operatorName}`,
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[sync-contract-roles] Grant error: HTTP ${res.status}`, errorText);

        if (res.status === 404) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "user_not_in_guild",
              message: "ไม่พบผู้ใช้ในเซิร์ฟเวอร์ Discord (ผู้ใช้อาจออกจากเซิร์ฟเวอร์ไปแล้ว)",
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (res.status === 403) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "bot_permission_denied",
              message: "Bot ไม่มีสิทธิ์จัดการยศนี้ (ตำแหน่งยศของ Bot อาจอยู่ต่ำกว่ายศที่ต้องการมอบ)",
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "discord_api_error", message: `Discord API Error: HTTP ${res.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If contract_id provided, record into edit_log
      if (body.contract_id) {
        const { data: contract } = await adminClient
          .from("contracts")
          .select("edit_log")
          .eq("id", body.contract_id)
          .maybeSingle();

        const editLog = Array.isArray(contract?.edit_log) ? contract.edit_log : [];
        const newLog = [
          ...editLog,
          {
            editor: operatorName,
            timestamp: new Date().toISOString(),
            action: `มอบยศ Discord (${roleId}) ให้สมาชิกเรียบร้อยแล้ว`,
          },
        ];

        await adminClient
          .from("contracts")
          .update({ edit_log: newLog, updated_at: new Date().toISOString() })
          .eq("id", body.contract_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "มอบยศ Discord ให้สมาชิกสำเร็จเรียบร้อย" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // Action 2: Revoke Role
    // ──────────────────────────────────────────────────────────────────
    if (action === "revoke") {
      const memberId = String(body.member_id ?? "").trim();
      const roleId = String(body.role_id ?? "").trim();

      if (!memberId || !roleId) {
        return new Response(
          JSON.stringify({ error: "Missing member_id or role_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
            "X-Audit-Log-Reason": `สิ้นสุดสัญญาเช่ายศ โดย ${operatorName}`,
          },
        }
      );

      // 204 No Content: successfully removed; 404: user or role not found (already revoked/left)
      if (res.status !== 204 && res.status !== 404 && !res.ok) {
        const errorText = await res.text();
        console.error(`[sync-contract-roles] Revoke error: HTTP ${res.status}`, errorText);
        return new Response(
          JSON.stringify({ success: false, error: "discord_api_error", message: `Discord API Error: HTTP ${res.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body.contract_id) {
        const { data: contract } = await adminClient
          .from("contracts")
          .select("edit_log")
          .eq("id", body.contract_id)
          .maybeSingle();

        const editLog = Array.isArray(contract?.edit_log) ? contract.edit_log : [];
        const newLog = [
          ...editLog,
          {
            editor: operatorName,
            timestamp: new Date().toISOString(),
            action: `ถอดยศ Discord (${roleId}) จากสมาชิกเรียบร้อยแล้ว`,
          },
        ];

        await adminClient
          .from("contracts")
          .update({ edit_log: newLog, updated_at: new Date().toISOString() })
          .eq("id", body.contract_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "ถอดยศ Discord จากสมาชิกสำเร็จเรียบร้อย" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // Action 3: Cleanup Expired Roles
    // ──────────────────────────────────────────────────────────────────
    if (action === "cleanup_expired") {
      const nowIso = new Date().toISOString();

      // Find contracts of role types that are expired
      const { data: expiredContracts, error: fetchErr } = await adminClient
        .from("contracts")
        .select("*")
        .in("type", ["personal_role", "boost_role"])
        .not("discord_role_id", "is", null)
        .lte("end_at", nowIso);

      if (fetchErr) throw fetchErr;

      if (!expiredContracts || expiredContracts.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "ไม่พบสัญญายศที่ครบกำหนดเวลาที่ต้องถอดยศ",
            revokedCount: 0,
            results: [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let revokedCount = 0;
      const results: { id: string; member_id: string; role_id: string; status: string }[] = [];

      for (const contract of expiredContracts) {
        const memberId = String(contract.member_id ?? "").trim();
        const roleId = String(contract.discord_role_id ?? "").trim();
        if (!memberId || !roleId) continue;

        // Check if already revoked in edit_log
        const editLog = Array.isArray(contract.edit_log) ? contract.edit_log : [];
        const alreadyRevoked = editLog.some(
          (log: any) => typeof log?.action === "string" && log.action.includes("ถอดยศ Discord สำเร็จเนื่องจากหมดอายุสัญญา")
        );

        if (alreadyRevoked) {
          results.push({ id: contract.id, member_id: memberId, role_id: roleId, status: "already_revoked" });
          continue;
        }

        try {
          const res = await discordFetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
                "X-Audit-Log-Reason": "สัญญายศครบกำหนดเวลาแล้ว ถอดยศอัตโนมัติ",
              },
            }
          );

          if (res.status === 204 || res.status === 404) {
            const newLog = [
              ...editLog,
              {
                editor: operatorName,
                timestamp: new Date().toISOString(),
                action:
                  res.status === 204
                    ? `ถอดยศ Discord (${roleId}) สำเร็จเนื่องจากหมดอายุสัญญา`
                    : `ผู้ใช้ไม่อยู่ในเซิร์ฟเวอร์หรือไม่มีบทบาทนี้แล้ว (${roleId}) บันทึกสถานะถอดยศเรียบร้อย`,
              },
            ];

            await adminClient
              .from("contracts")
              .update({ edit_log: newLog, updated_at: new Date().toISOString() })
              .eq("id", contract.id);

            revokedCount++;
            results.push({ id: contract.id, member_id: memberId, role_id: roleId, status: "revoked" });
          } else {
            results.push({ id: contract.id, member_id: memberId, role_id: roleId, status: `failed_status_${res.status}` });
          }
        } catch (err: any) {
          results.push({ id: contract.id, member_id: memberId, role_id: roleId, status: `error_${err.message}` });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `ดำเนินการเสร็จสิ้น (ถอดยศสำเร็จ ${revokedCount} รายการ)`,
          revokedCount,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // Action 4: Sync Single Contract
    // ──────────────────────────────────────────────────────────────────
    if (action === "sync_single") {
      const contractId = body.contract_id;
      if (!contractId) {
        return new Response(
          JSON.stringify({ error: "Missing contract_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: contract, error: contractErr } = await adminClient
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .single();

      if (contractErr || !contract) {
        return new Response(
          JSON.stringify({ error: "Contract not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const memberId = contract.member_id;
      const roleId = contract.discord_role_id;

      if (!memberId || !roleId) {
        return new Response(
          JSON.stringify({ error: "Contract has no member_id or discord_role_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isExpired = contract.end_at && new Date(contract.end_at).getTime() <= Date.now();

      if (isExpired) {
        // Revoke role
        const res = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
              "X-Audit-Log-Reason": `สัญญายศหมดอายุ โดย ${operatorName}`,
            },
          }
        );

        const editLog = Array.isArray(contract.edit_log) ? contract.edit_log : [];
        const newLog = [
          ...editLog,
          {
            editor: operatorName,
            timestamp: new Date().toISOString(),
            action: `ถอดยศ Discord (${roleId}) สำเร็จเนื่องจากสัญญาหมดอายุ`,
          },
        ];

        await adminClient
          .from("contracts")
          .update({ edit_log: newLog, updated_at: new Date().toISOString() })
          .eq("id", contract.id);

        return new Response(
          JSON.stringify({ success: true, action: "revoked", message: "สัญญาสิ้นสุดแล้ว ทำการถอดยศเรียบร้อยแล้ว" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Grant role
        const res = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
              "X-Audit-Log-Reason": `ซิงค์มอบยศตามสัญญา โดย ${operatorName}`,
            },
          }
        );

        if (!res.ok) {
          const errorText = await res.text();
          return new Response(
            JSON.stringify({
              success: false,
              error: "discord_error",
              message: `ไม่สามารถมอบยศได้ (HTTP ${res.status}): ${errorText}`,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const editLog = Array.isArray(contract.edit_log) ? contract.edit_log : [];
        const newLog = [
          ...editLog,
          {
            editor: operatorName,
            timestamp: new Date().toISOString(),
            action: `ซิงค์มอบยศ Discord (${roleId}) ให้สมาชิกเรียบร้อยแล้ว`,
          },
        ];

        await adminClient
          .from("contracts")
          .update({ edit_log: newLog, updated_at: new Date().toISOString() })
          .eq("id", contract.id);

        return new Response(
          JSON.stringify({ success: true, action: "granted", message: "ซิงค์มอบยศ Discord ให้สมาชิกสำเร็จเรียบร้อย" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sync-contract-roles] Internal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
