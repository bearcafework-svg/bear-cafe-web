import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "./discord-fetch.ts";

type CachedRoles = {
  expiresAt: number;
  roles: string[];
};

type CachedGuildRoles = {
  expiresAt: number;
  roles: { id: string; name: string }[];
};

type CachedBannedRoles = {
  expiresAt: number;
  bannedRoleIds: Set<string>;
  bannedRoleNames: Map<string, string>; // roleId -> roleName
};

type RoleBanDecision = {
  banned: boolean;
  reason?: string;
  bannedRoleName?: string; // Name of the banned role for display
};

const DEFAULT_CACHE_TTL_SECONDS = 120;
const DEFAULT_ROLE_LIST_TTL_SECONDS = 600;
const DEFAULT_DB_BANNED_ROLES_TTL_SECONDS = 60;
const DEFAULT_DISCORD_TIMEOUT_MS = 4500;

const memberRolesCache = new Map<string, CachedRoles>();
const guildRolesCache = new Map<string, CachedGuildRoles>();
const dbBannedRolesCache = new Map<string, CachedBannedRoles>();

const parseList = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getEnvNumber = (key: string, fallback: number) => {
  const raw = Deno.env.get(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const corsJson = (
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const loadGuildRoles = async (
  guildId: string,
  botToken: string,
  timeoutMs: number,
  cacheTtlMs: number,
): Promise<CachedGuildRoles> => {
  const cacheKey = `guild:${guildId}`;
  const cached = guildRolesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const response = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/roles`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord roles fetch failed: ${response.status} ${errorText}`);
  }

  const roles = (await response.json()) as { id: string; name: string }[];
  const entry = {
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
    expiresAt: Date.now() + cacheTtlMs,
  };
  guildRolesCache.set(cacheKey, entry);
  return entry;
};

/**
 * Load banned roles from the database table `banned_discord_roles`
 * This is cached to reduce database load
 */
const loadDbBannedRoles = async (): Promise<CachedBannedRoles> => {
  const cacheKey = "db_banned_roles";
  const cached = dbBannedRolesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("[role-ban] Supabase config missing, skipping DB banned roles check");
    return {
      expiresAt: Date.now() + 30000, // Short TTL on error
      bannedRoleIds: new Set(),
      bannedRoleNames: new Map(),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("banned_discord_roles")
    .select("discord_role_id, role_name");

  if (error) {
    console.error("[role-ban] Failed to fetch banned roles from DB:", error.message);
    return {
      expiresAt: Date.now() + 30000, // Short TTL on error
      bannedRoleIds: new Set(),
      bannedRoleNames: new Map(),
    };
  }

  const bannedRoleIds = new Set<string>();
  const bannedRoleNames = new Map<string, string>();
  
  for (const row of data || []) {
    bannedRoleIds.add(row.discord_role_id);
    bannedRoleNames.set(row.discord_role_id, row.role_name);
  }

  const ttlSeconds = getEnvNumber("DB_BANNED_ROLES_TTL_SECONDS", DEFAULT_DB_BANNED_ROLES_TTL_SECONDS);
  const entry = {
    bannedRoleIds,
    bannedRoleNames,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  
  dbBannedRolesCache.set(cacheKey, entry);
  console.log(`[role-ban] Loaded ${bannedRoleIds.size} banned roles from database`);
  return entry;
};

/**
 * Resolve all banned role IDs from both environment variables and database
 */
const resolveBannedRoleIds = async (
  guildId: string,
  botToken: string,
  timeoutMs: number,
  cacheTtlMs: number,
): Promise<{ ids: Set<string>; names: Map<string, string> }> => {
  // Start with env-based banned role IDs
  const ids = new Set(parseList(Deno.env.get("DISCORD_BANNED_ROLE_IDS")));
  const names = new Map<string, string>();
  
  // Resolve env-based banned role names to IDs
  const envNames = parseList(Deno.env.get("DISCORD_BANNED_ROLE_NAMES")).map((name) =>
    name.toLowerCase(),
  );

  if (envNames.length > 0) {
    const guildRoles = await loadGuildRoles(guildId, botToken, timeoutMs, cacheTtlMs);
    for (const role of guildRoles.roles) {
      if (envNames.includes(role.name.toLowerCase())) {
        ids.add(role.id);
        names.set(role.id, role.name);
      }
    }
  }

  // Add database-based banned roles
  try {
    const dbBanned = await loadDbBannedRoles();
    for (const roleId of dbBanned.bannedRoleIds) {
      ids.add(roleId);
      const roleName = dbBanned.bannedRoleNames.get(roleId);
      if (roleName) {
        names.set(roleId, roleName);
      }
    }
  } catch (err) {
    console.error("[role-ban] Error loading DB banned roles:", err);
    // Continue with env-based roles only
  }

  return { ids, names };
};

export const getMemberRoles = async (
  userId: string,
  guildId: string,
  botToken: string,
): Promise<string[]> => {
  const ttlSeconds = getEnvNumber("ROLE_BAN_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS);
  const cacheKey = `${guildId}:${userId}`;
  const cached = memberRolesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  const timeoutMs = getEnvNumber("DISCORD_API_TIMEOUT_MS", DEFAULT_DISCORD_TIMEOUT_MS);
  const response = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (response.status === 404) {
    throw new Error("Discord member not found");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord member fetch failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { roles?: string[] };
  const roles = data.roles ?? [];
  memberRolesCache.set(cacheKey, {
    roles,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return roles;
};

/**
 * Clear the member roles cache for a specific user
 * Useful when you want to force a fresh check
 */
export const clearMemberRolesCache = (userId: string, guildId: string) => {
  const cacheKey = `${guildId}:${userId}`;
  memberRolesCache.delete(cacheKey);
};

/**
 * Clear all caches - useful for testing or admin actions
 */
export const clearAllCaches = () => {
  memberRolesCache.clear();
  guildRolesCache.clear();
  dbBannedRolesCache.clear();
};

export const isRoleBanned = async (
  userId: string,
  guildId: string,
  botToken: string,
): Promise<RoleBanDecision> => {
  const timeoutMs = getEnvNumber("DISCORD_API_TIMEOUT_MS", DEFAULT_DISCORD_TIMEOUT_MS);
  const roleListTtlMs =
    getEnvNumber("ROLE_BAN_ROLE_LIST_TTL_SECONDS", DEFAULT_ROLE_LIST_TTL_SECONDS) * 1000;
  const failClosed = Deno.env.get("ROLE_BAN_FAIL_CLOSED") !== "false";

  try {
    const { ids: bannedRoleIds, names: bannedRoleNames } = await resolveBannedRoleIds(
      guildId,
      botToken,
      timeoutMs,
      roleListTtlMs,
    );

    if (bannedRoleIds.size === 0) {
      return { banned: false };
    }

    const roles = await getMemberRoles(userId, guildId, botToken);
    
    // Find the first banned role the user has
    let matchedBannedRoleId: string | undefined;
    for (const roleId of roles) {
      if (bannedRoleIds.has(roleId)) {
        matchedBannedRoleId = roleId;
        break;
      }
    }

    if (matchedBannedRoleId) {
      const bannedRoleName = bannedRoleNames.get(matchedBannedRoleId);
      return {
        banned: true,
        reason: "role_match",
        bannedRoleName: bannedRoleName || undefined,
      };
    }

    return { banned: false };
  } catch (error) {
    console.error("[role-ban] Failed to evaluate role ban:", error);
    return {
      banned: failClosed,
      reason: failClosed ? "role_check_failed" : "role_check_skipped",
    };
  }
};

export const requireRoleBanGuard = async (
  req: Request,
  corsHeaders: Record<string, string>,
) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      response: corsJson({ error: "Unauthorized - Missing token" }, 401, corsHeaders),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[role-ban] Supabase configuration missing");
    return {
      response: corsJson({ error: "Service unavailable" }, 503, corsHeaders),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error("[role-ban] JWT verification failed:", error?.message);
    return {
      response: corsJson({ error: "Unauthorized - Invalid token" }, 401, corsHeaders),
    };
  }

  const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
  if (!discordId) {
    return {
      response: corsJson({ error: "Discord ID missing" }, 400, corsHeaders),
    };
  }

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const guildId = Deno.env.get("DISCORD_GUILD_ID");

  if (!botToken || !guildId) {
    console.error("[role-ban] Discord configuration missing");
    return {
      response: corsJson({ error: "Discord not configured" }, 500, corsHeaders),
    };
  }

  const decision = await isRoleBanned(discordId, guildId, botToken);
  if (decision.banned) {
    const message = decision.reason === "role_check_failed"
      ? "ไม่สามารถยืนยันสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง"
      : decision.bannedRoleName
        ? `บัญชีถูกระงับการใช้งานเนื่องจากยศ "${decision.bannedRoleName}"`
        : "บัญชีถูกระงับการใช้งาน";
    
    return {
      response: corsJson(
        {
          code: "ROLE_BANNED",
          message,
          banned_role_name: decision.bannedRoleName || null,
        },
        403,
        corsHeaders,
      ),
    };
  }

  return { user, discordId };
};
