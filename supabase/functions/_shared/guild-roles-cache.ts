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
}

const cache = new Map<string, CachedGuildRoles>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  cache.set(guildId, { roles, expiresAt: Date.now() + ttlMs });
  console.log(`[guild-roles-cache] Cached ${roles.length} roles for guild ${guildId}`);
  return roles;
}

/** Clear the cache (useful for admin refresh actions) */
export function clearGuildRolesCache(guildId?: string) {
  if (guildId) {
    cache.delete(guildId);
  } else {
    cache.clear();
  }
}
