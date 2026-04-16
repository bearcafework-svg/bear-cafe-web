import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRoleBanGuard } from "../_shared/role-ban.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration missing");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

// deno-lint-ignore no-explicit-any
const ensureAdminAccess = async (supabase: any, user: any) => {
  const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
  if (!discordId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("discord_id", discordId)
    .single();

  if (!profile) return false;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.id)
    .in("role", ["admin", "moderator"]);

  if (error) {
    console.error("Failed to check roles", error);
    return false;
  }

  return (roles ?? []).length > 0;
};

const fetchDiscordUser = async (id: string, botToken: string, retryCount = 0): Promise<any> => {
  try {
    const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      const retryAfter = (body.retry_after ?? 1) * 1000;
      console.warn(`Rate limited for ${id}, retrying after ${retryAfter}ms (attempt ${retryCount + 1})`);
      if (retryCount < 3) {
        await new Promise((r) => setTimeout(r, retryAfter));
        return fetchDiscordUser(id, botToken, retryCount + 1);
      }
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Discord API error for ${id}:`, errorText);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn(`Fetch error for ${id}:`, err);
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guardResult = await requireRoleBanGuard(req, corsHeaders);
    if ("response" in guardResult) {
      return guardResult.response as Response;
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Missing authorization header" }, 401);
    }

    const supabase = getSupabaseClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid token" }, 401);
    }

    const isAdmin = await ensureAdminAccess(supabase, user);
    if (!isAdmin) {
      return respond({ error: "Admin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id).trim()).filter(Boolean) : [];
    const uniqueIds: string[] = Array.from(new Set(ids));

    if (uniqueIds.length === 0) {
      return respond({ profiles: {} }, 200);
    }

    const now = Date.now();
    const { data: cachedRows } = await supabase
      .from("discord_user_cache")
      .select("discord_id, username, global_name, avatar_url, expires_at")
      .in("discord_id", uniqueIds);

    const profiles: Record<string, { id: string; display_name: string; username: string; avatar_url: string; profile_url: string }> = {};
    const validCachedIds = new Set<string>();

    for (const row of cachedRows ?? []) {
      const expiresAt = new Date(row.expires_at).getTime();
      if (Number.isNaN(expiresAt) || expiresAt < now) continue;
      validCachedIds.add(row.discord_id);
      const displayName = row.global_name || row.username || row.discord_id;
      profiles[row.discord_id] = {
        id: row.discord_id,
        display_name: displayName,
        username: row.username || row.discord_id,
        avatar_url: row.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png",
        profile_url: `https://discord.com/users/${row.discord_id}`,
      };
    }

    const missingIds = uniqueIds.filter((id) => !validCachedIds.has(id));
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    const fetchedProfiles: Array<{ id: string; username: string; global_name: string | null; avatar_url: string }> = [];

    if (missingIds.length > 0 && botToken) {
      for (let i = 0; i < missingIds.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 200));
        const id = missingIds[i];
        const userData = await fetchDiscordUser(id, botToken);
        if (!userData) continue;
        const avatarExt = userData.avatar?.startsWith('a_') ? 'gif' : 'png';
        const avatarUrl = userData.avatar
          ? `https://cdn.discordapp.com/avatars/${id}/${userData.avatar}.${avatarExt}?size=64`
          : "https://cdn.discordapp.com/embed/avatars/0.png";
        fetchedProfiles.push({
          id,
          username: userData.username,
          global_name: userData.global_name || null,
          avatar_url: avatarUrl,
        });

        const displayName = userData.global_name || userData.username || id;
        profiles[id] = {
          id,
          display_name: displayName,
          username: userData.username || id,
          avatar_url: avatarUrl,
          profile_url: `https://discord.com/users/${id}`,
        };
      }
    }

    if (fetchedProfiles.length > 0) {
      const expiresAt = new Date(Date.now() + DEFAULT_CACHE_TTL_MS).toISOString();
      const upserts = fetchedProfiles.map((profile) => ({
        discord_id: profile.id,
        username: profile.username,
        global_name: profile.global_name,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt,
      }));

      const { error: upsertError } = await supabase
        .from("discord_user_cache")
        .upsert(upserts, { onConflict: "discord_id" });

      if (upsertError) {
        console.warn("Failed to update discord user cache", upsertError);
      }
    }

    return respond({ profiles }, 200);
  } catch (error) {
    console.error("Discord users error", error);
    return respond({ error: "Internal server error" }, 500);
  }
});
