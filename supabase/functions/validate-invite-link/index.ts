import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS headers ──────────────────────────────────────────────────────────────
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helper: JSON response shorthand ──────────────────────────────────────────
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Helper: extractInviteCode ─────────────────────────────────────────────────
// Extracts the invite code from any supported Discord invite URL format or bare code.
// Supported formats:
//   - https://discord.gg/{code}
//   - https://discord.com/invite/{code}
//   - https://discordapp.com/invite/{code}
//   - {code}  (bare alphanumeric/hyphen string)
// Returns null if the input does not match any supported format.
export function extractInviteCode(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // Try URL patterns first (order matters — most specific first)
  const urlPatterns = [
    /(?:https?:\/\/)?discord\.gg\/([a-zA-Z0-9-]{2,32})(?:[/?#].*)?$/,
    /(?:https?:\/\/)?discord\.com\/invite\/([a-zA-Z0-9-]{2,32})(?:[/?#].*)?$/,
    /(?:https?:\/\/)?discordapp\.com\/invite\/([a-zA-Z0-9-]{2,32})(?:[/?#].*)?$/,
  ];

  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  // Bare code: must be exactly 2–32 alphanumeric/hyphen characters
  if (/^[a-zA-Z0-9-]{2,32}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// ── Helper: isValidInviteCodeFormat ──────────────────────────────────────────
// Returns true if the code matches the pattern ^[a-zA-Z0-9-]{2,32}$
export function isValidInviteCodeFormat(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  return /^[a-zA-Z0-9-]{2,32}$/.test(code);
}

// ── Helper: isServiceRole ─────────────────────────────────────────────────────
// Returns true if the Authorization header value matches the service role key.
// authHeader should be the raw "Authorization" header value (e.g. "Bearer <key>").
export function isServiceRole(authHeader: string, serviceKey: string): boolean {
  if (!authHeader || !serviceKey) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === serviceKey;
}

// ── Helper: resolveInvite ─────────────────────────────────────────────────────
// Calls the Discord API to resolve an invite code.
// Uses a 5-second AbortController timeout.
// Returns { ok, status, guildId? }
export async function resolveInvite(
  code: string
): Promise<{ ok: boolean; status: number; guildId?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${code}?with_counts=true`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      let guildId: string | undefined;
      try {
        const data = await res.json();
        guildId = data?.guild?.id ?? undefined;
      } catch {
        // JSON parse failure — still treat as ok but no guildId
      }
      return { ok: true, status: res.status, guildId };
    }

    // Consume body to avoid resource leaks
    try { await res.text(); } catch { /* ignore */ }
    return { ok: false, status: res.status };
  } catch (err) {
    clearTimeout(timeoutId);
    // AbortError means timeout; any other error is also treated as unavailable
    return { ok: false, status: 503 };
  }
}

// ── Action: validate ─────────────────────────────────────────────────────────
// Handles { action: "validate", server_id: string }
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
async function handleValidate(
  body: Record<string, unknown>,
  authHeader: string
): Promise<Response> {
  const serverId = body.server_id as string | undefined;
  if (!serverId) {
    return json({ error: "server_id is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Step 1: Verify JWT via anon client (Req 3.6) ──────────────────────────
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: authError } = await anonClient.auth.getUser();
  if (authError || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // ── Step 2: Create service-role client for DB operations ──────────────────
  const serviceClient = createClient(supabaseUrl, serviceKey);

  // ── Step 3: Get caller's discord_id from profiles (Req 3.8) ──────────────
  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("discord_id")
    .eq("id", userId)
    .single();

  const callerDiscordId = profileData?.discord_id ?? null;

  // ── Step 4: Lookup server from discord_servers (Req 3.7) ─────────────────
  const { data: server, error: serverError } = await serviceClient
    .from("discord_servers")
    .select("id, owner_id, invite_url, discord_id")
    .eq("id", serverId)
    .single();

  if (serverError || !server) {
    return json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  // ── Step 5: Check invite_url (Req 3.7) ───────────────────────────────────
  if (!server.invite_url || server.invite_url.trim() === "") {
    return json({ error: "No invite URL configured", code: "NO_INVITE_URL" }, 422);
  }

  // ── Step 6: Authorization — owner or service-role (Req 3.8) ──────────────
  const callerIsOwner = callerDiscordId !== null && server.owner_id === callerDiscordId;
  const callerIsServiceRole = isServiceRole(authHeader, serviceKey);

  if (!callerIsOwner && !callerIsServiceRole) {
    return json({ error: "Forbidden" }, 403);
  }

  // ── Step 7: Extract invite code (Req 3.1) ────────────────────────────────
  const code = extractInviteCode(server.invite_url);
  if (!code) {
    return json({ error: "Invalid invite URL format" }, 400);
  }

  // ── Step 8: Call Discord API (Req 3.1) ───────────────────────────────────
  const result = await resolveInvite(code);

  // ── Step 9: Map result and update DB (Req 3.2, 3.3, 3.4, 3.5) ───────────
  if (result.ok && result.status === 200) {
    // Valid invite — update DB
    const now = new Date().toISOString();
    await serviceClient
      .from("discord_servers")
      .update({ invite_status: "valid", invite_last_checked_at: now })
      .eq("id", serverId);

    return json({
      success: true,
      invite_status: "valid",
      invite_last_checked_at: now,
    });
  }

  if (result.status === 404 || result.status === 400) {
    // Expired invite — update DB
    const now = new Date().toISOString();
    await serviceClient
      .from("discord_servers")
      .update({ invite_status: "expired", invite_last_checked_at: now })
      .eq("id", serverId);

    return json({
      success: true,
      invite_status: "expired",
      invite_last_checked_at: now,
    });
  }

  if (result.status === 429) {
    // Rate limited — do NOT update DB (Req 3.4)
    return json(
      { error: "Discord API rate limited", code: "RATE_LIMITED" },
      429
    );
  }

  // 5xx or timeout (503) — do NOT update DB (Req 3.5)
  return json(
    { error: "Discord service temporarily unavailable", code: "DISCORD_UNAVAILABLE" },
    503
  );
}

// ── Action: update-link ───────────────────────────────────────────────────────
// Handles { action: "update-link", server_id: string, new_invite_url: string }
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
async function handleUpdateLink(
  body: Record<string, unknown>,
  authHeader: string
): Promise<Response> {
  const serverId = body.server_id as string | undefined;
  const newInviteUrl = body.new_invite_url as string | undefined;

  // ── Step 1: Validate required fields ─────────────────────────────────────
  if (!serverId || !newInviteUrl) {
    return json({ error: "server_id and new_invite_url are required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Step 2: Verify JWT via anon client (Req 6.7) ──────────────────────────
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: authError } = await anonClient.auth.getUser();
  if (authError || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // ── Step 3: Create service-role client for DB operations ──────────────────
  const serviceClient = createClient(supabaseUrl, serviceKey);

  // ── Step 4: Get caller's discord_id from profiles ─────────────────────────
  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("discord_id")
    .eq("id", userId)
    .single();

  const callerDiscordId = profileData?.discord_id ?? null;

  // ── Step 5: Extract invite code from new_invite_url (Req 6.9) ────────────
  const code = extractInviteCode(newInviteUrl);
  if (!code) {
    return json({ error: "รูปแบบ URL ไม่ถูกต้อง" }, 400);
  }

  // ── Step 6: Validate code format (Req 6.9) ────────────────────────────────
  if (!isValidInviteCodeFormat(code)) {
    return json({ error: "รูปแบบ URL ไม่ถูกต้อง" }, 400);
  }

  // ── Step 7: Lookup server from discord_servers ────────────────────────────
  const { data: server, error: serverError } = await serviceClient
    .from("discord_servers")
    .select("id, owner_id, discord_id")
    .eq("id", serverId)
    .single();

  if (serverError || !server) {
    return json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  // ── Step 8: Check caller is owner — update-link is owner-only (Req 6.8) ──
  const callerIsOwner = callerDiscordId !== null && server.owner_id === callerDiscordId;
  if (!callerIsOwner) {
    return json({ error: "Forbidden" }, 403);
  }

  // ── Step 9: Call Discord API on the new invite code (Req 6.1) ────────────
  const result = await resolveInvite(code);

  // ── Step 10: Map results ──────────────────────────────────────────────────

  // Discord returned 404 or 400 — link is invalid or expired (Req 6.4)
  if (!result.ok && (result.status === 404 || result.status === 400)) {
    return json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, 400);
  }

  // Rate limited (Req 6.5)
  if (result.status === 429) {
    return json({ error: "Discord API rate limited", code: "RATE_LIMITED" }, 429);
  }

  // Discord unavailable — 5xx or timeout (Req 6.6)
  if (result.status >= 500 || result.status === 503) {
    return json(
      { error: "Discord service temporarily unavailable", code: "DISCORD_UNAVAILABLE" },
      503
    );
  }

  // Successful resolution — compare Guild IDs (Req 6.2, 6.3)
  if (result.ok) {
    if (result.guildId === server.discord_id) {
      // Guild ID matches — update DB (Req 6.2)
      const now = new Date().toISOString();
      await serviceClient
        .from("discord_servers")
        .update({
          invite_url: newInviteUrl,
          invite_status: "valid",
          invite_last_checked_at: now,
        })
        .eq("id", serverId);

      return json({
        success: true,
        invite_status: "valid",
        invite_last_checked_at: now,
      });
    } else {
      // Guild ID mismatch — reject (Req 6.3)
      return json({ error: "ลิงก์นี้ไม่ใช่ของเซิร์ฟเวอร์เดิม" }, 422);
    }
  }

  // Fallback for any other unexpected error from Discord
  return json(
    { error: "Discord service temporarily unavailable", code: "DISCORD_UNAVAILABLE" },
    503
  );
}

// ── Action: batch ─────────────────────────────────────────────────────────────
// Handles { action: "batch", server_ids?: string[] }
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
async function handleBatch(
  body: Record<string, unknown>,
  authHeader: string
): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Step 1: Service-role only (Req 8.3) ──────────────────────────────────
  if (!isServiceRole(authHeader, serviceKey)) {
    return json({ error: "Forbidden — service-role required" }, 403);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);

  // ── Step 2: Determine server list (Req 8.1, 8.2) ─────────────────────────
  const serverIdsInput = body.server_ids as string[] | undefined;
  const hasExplicitIds = Array.isArray(serverIdsInput) && serverIdsInput.length > 0;

  // Collect the ordered list of server IDs to process
  let orderedServerIds: string[];

  if (hasExplicitIds) {
    // Use the caller-supplied list (up to 50)
    orderedServerIds = serverIdsInput!.slice(0, 50);
  } else {
    // Auto-select: approved servers that are unknown OR last checked > 24h ago (Req 8.2)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: staleServers, error: queryError } = await serviceClient
      .from("discord_servers")
      .select("id")
      .eq("status", "approved")
      .or(`invite_status.eq.unknown,invite_last_checked_at.lt.${cutoff}`)
      .order("invite_last_checked_at", { ascending: true, nullsFirst: true })
      .limit(50);

    if (queryError) {
      return json({ error: "Failed to query servers", details: queryError.message }, 500);
    }

    orderedServerIds = (staleServers ?? []).map((s: { id: string }) => s.id);
  }

  // ── Step 3: Process each server sequentially (Req 8.1, 8.4, 8.5, 8.6, 8.7) ─
  const results: Array<{
    server_id: string;
    status: "valid" | "expired" | "skipped" | "error";
    error?: string;
  }> = [];

  let processedCount = 0;
  let rateLimited = false;
  let unprocessed: string[] = [];

  for (let i = 0; i < orderedServerIds.length; i++) {
    const serverId = orderedServerIds[i];

    // Fetch server record
    const { data: server, error: serverError } = await serviceClient
      .from("discord_servers")
      .select("id, invite_url")
      .eq("id", serverId)
      .single();

    // Skip if not found (Req 8.5)
    if (serverError || !server) {
      results.push({ server_id: serverId, status: "skipped", error: "Server not found" });
      continue;
    }

    // Skip if invite_url is null/empty (Req 8.5)
    if (!server.invite_url || server.invite_url.trim() === "") {
      results.push({ server_id: serverId, status: "skipped", error: "No invite URL" });
      continue;
    }

    // Extract invite code; skip if invalid format
    const code = extractInviteCode(server.invite_url);
    if (!code) {
      results.push({ server_id: serverId, status: "skipped", error: "Invalid invite URL format" });
      continue;
    }

    // Call Discord API
    const result = await resolveInvite(code);

    if (result.status === 429) {
      // Rate limited — stop immediately (Req 8.7)
      rateLimited = true;
      unprocessed = orderedServerIds.slice(i); // remaining servers including current
      break;
    }

    if (result.ok && result.status === 200) {
      // Valid — update DB before continuing (Req 8.4)
      const now = new Date().toISOString();
      await serviceClient
        .from("discord_servers")
        .update({ invite_status: "valid", invite_last_checked_at: now })
        .eq("id", serverId);

      results.push({ server_id: serverId, status: "valid" });
      processedCount++;
      continue;
    }

    if (result.status === 404 || result.status === 400) {
      // Expired — update DB before continuing (Req 8.4)
      const now = new Date().toISOString();
      await serviceClient
        .from("discord_servers")
        .update({ invite_status: "expired", invite_last_checked_at: now })
        .eq("id", serverId);

      results.push({ server_id: serverId, status: "expired" });
      processedCount++;
      continue;
    }

    // 5xx / timeout — record error, leave DB unchanged, continue (Req 8.6)
    results.push({
      server_id: serverId,
      status: "error",
      error: result.status === 503
        ? "Discord unavailable or timeout"
        : `Discord error ${result.status}`,
    });
  }

  // ── Step 4: Build response ────────────────────────────────────────────────
  const response: Record<string, unknown> = {
    success: true,
    processed: processedCount,
    results,
  };

  if (rateLimited) {
    response.rate_limited = true;
    response.unprocessed = unprocessed;
  }

  return json(response);
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth header is required for all non-OPTIONS requests
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;

  if (!action) {
    return json({ error: "action is required" }, 400);
  }

  if (action === "validate") {
    return handleValidate(body, authHeader);
  }

  if (action === "update-link") {
    return handleUpdateLink(body, authHeader);
  }

  if (action === "batch") {
    return handleBatch(body, authHeader);
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
