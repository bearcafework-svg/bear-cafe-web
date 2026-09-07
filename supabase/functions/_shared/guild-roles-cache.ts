/**
 * Shared in-memory cache for Discord guild roles.
 * Reduces redundant Discord API calls across repeated invocations
 * within the same Edge Function isolate.
 */
import { discordFetch } from "./discord-fetch.ts";

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
}

interface CachedGuildRoles {
  roles: GuildRole[];
  expiresAt: number;
  lastFetchedAt: number;
}

const cache = new Map<string, CachedGuildRoles>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_REFRESH_INTERVAL_MS = 10 * 1000; // 10 seconds rate limit guard

/**
 * Fetch guild roles with automatic in-memory caching.
 * @param guildId Discord guild ID
 * @param botToken Discord bot token
 * @param ttlMs Cache TTL in milliseconds (default 10 min)
 */
export async function getGuildRoles(
  guildId: string,
  botToken: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<GuildRole[]> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  const response = await discordFetch(
    `https://discord.com/api/v10/guilds/${guildId}/roles`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch guild roles: ${response.status} ${errorText}`);
  }

  const roles: GuildRole[] = await response.json();
  const now = Date.now();
  cache.set(guildId, { roles, expiresAt: now + ttlMs, lastFetchedAt: now });
  console.log(`[guild-roles-cache] Cached ${roles.length} roles for guild ${guildId}`);
  return roles;
}

/** 
 * Clear the cache (useful for admin refresh actions).
 * Includes safety throttle to avoid spamming Discord API if called repeatedly.
 */
export function clearGuildRolesCache(guildId?: string, force = false): boolean {
  if (guildId) {
    const existing = cache.get(guildId);
    // If fetched less than MIN_REFRESH_INTERVAL_MS ago and not forced, keep cache to prevent rate limit
    if (!force && existing && Date.now() - existing.lastFetchedAt < MIN_REFRESH_INTERVAL_MS) {
      console.warn(`[guild-roles-cache] Skipped clearing cache for guild ${guildId} (rate-limit throttle active)`);
      return false;
    }
    cache.delete(guildId);
    return true;
  } else {
    cache.clear();
    return true;
  }
}
