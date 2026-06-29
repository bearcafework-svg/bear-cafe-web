/**
 * sync-product-catalog
 * ดึง role list จาก Discord Guild แล้ว sync เข้า product_catalog:
 *   - role ใหม่ที่ไม่มีใน DB → INSERT (is_purchasable=false รอ admin ตั้งราคา)
 *   - role ที่มีใน DB แต่หายจาก Discord → SET is_active=false (soft delete)
 *   - display_name ใน DB ≠ ชื่อใน Discord → UPDATE display_name ให้ตรง
 *
 * ต้องเรียกด้วย authenticated JWT ที่มีสิทธิ์ has_page_access('trading-history')
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGuildRoles } from "../_shared/guild-roles-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// These role names are system / managed and should not appear in product_catalog
const SKIP_ROLE_NAMES = new Set(["@everyone"]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) return respond({ error: "Invalid token" }, 401);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) return respond({ error: "Profile not found" }, 404);

    // Check permission
    const { data: hasAccess, error: accessError } = await supabaseAdmin.rpc("has_page_access", {
      _user_id: profile.id,
      _page: "trading-history",
    });
    if (accessError || !hasAccess) {
      return respond({ error: "Access denied" }, 403);
    }

    let body: any = {};
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        body = await req.json();
      } catch (e) {
        // ignore
      }
    }
    const action = body.action || "sync_all"; // 'fetch', 'sync', or 'sync_all'
    const selectedRoleIds: string[] = body.selectedRoleIds || [];

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (!botToken || !guildId) {
      return respond({ error: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not configured" }, 500);
    }

    // ---- 1. Fetch all Discord guild roles ----
    const guildRoles = await getGuildRoles(guildId, botToken, 0); // ttl=0 → always fresh

    // Filter out system roles
    const relevantRoles = guildRoles.filter(
      (r: any) => !SKIP_ROLE_NAMES.has(r.name) && !r.managed
    );

    // Build a map: discord role_id → display_name
    const discordRoleMap = new Map(relevantRoles.map((r: any) => [r.id, r.name]));

    // ---- 2. Fetch current product_catalog rows that have a role_id ----
    const { data: existingRows, error: fetchError } = await supabaseAdmin
      .from("product_catalog")
      .select("id, role_id, display_name, is_active")
      .not("role_id", "is", null);

    if (fetchError) throw fetchError;

    const existingByRoleId = new Map(
      (existingRows ?? []).map((r) => [r.role_id as string, r])
    );

    // If action is fetch, just return the list of roles to the frontend
    if (action === "fetch") {
      const roles = relevantRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        inDb: existingByRoleId.has(r.id),
      }));
      return respond({ ok: true, roles });
    }

    const inserted: string[] = [];
    const deactivated: string[] = [];
    const renamed: string[] = [];

    // ---- 3. Insert new roles (not in product_catalog yet) ----
    for (const [roleId, roleName] of discordRoleMap) {
      if (!existingByRoleId.has(roleId)) {
        // If action is sync, only insert selected roles
        if (action === "sync" && !selectedRoleIds.includes(roleId)) {
          continue;
        }

        const { error: insertError } = await supabaseAdmin.from("product_catalog").insert({
          role_id: roleId,
          display_name: roleName,
          product_type: "other",
          current_price: null,
          is_purchasable: false, // รอ admin ตั้งราคาและประเภทเอง
          is_active: true,
          sort_order: 0,
        });
        if (insertError) {
          console.error(`Failed to insert role ${roleId} (${roleName}):`, insertError);
        } else {
          inserted.push(`${roleName} (${roleId})`);
        }
      }
    }

    // ---- 4. Process existing rows ----
    for (const row of existingRows ?? []) {
      const roleId = row.role_id as string;
      const discordName = discordRoleMap.get(roleId);

      if (!discordName) {
        // Role no longer exists in Discord → soft delete
        if (row.is_active) {
          const { error: deactivateError } = await supabaseAdmin
            .from("product_catalog")
            .update({ is_active: false })
            .eq("id", row.id);
          if (!deactivateError) deactivated.push(`${row.display_name} (${roleId})`);
        }
      } else {
        // Role still exists — re-activate if it was deactivated before
        const updates: Record<string, unknown> = {};
        if (!row.is_active) updates.is_active = true;
        if (row.display_name !== discordName) {
          updates.display_name = discordName;
          renamed.push(`${row.display_name} → ${discordName}`);
        }
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from("product_catalog")
            .update(updates)
            .eq("id", row.id);
        }
      }
    }

    console.log(
      `[sync-product-catalog] guild=${guildId} inserted=${inserted.length} deactivated=${deactivated.length} renamed=${renamed.length}`
    );

    return respond({
      ok: true,
      summary: {
        total_discord_roles: relevantRoles.length,
        inserted: inserted.length,
        deactivated: deactivated.length,
        renamed: renamed.length,
      },
      details: { inserted, deactivated, renamed },
    });
  } catch (err) {
    console.error("[sync-product-catalog] Error:", err);
    return respond({ error: "Internal server error", detail: String(err) }, 500);
  }
});
