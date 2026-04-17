import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

type DiscordGuildMember = {
  user?: DiscordUser;
  nick?: string | null;
  roles?: string[];
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });
}

function parseCsvEnv(name: string): string[] {
  return (Deno.env.get(name) ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function fetchDiscordToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as DiscordTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `oauth_exchange_failed:${data.error_description ?? data.error ?? `HTTP ${res.status}`}`,
    );
  }
  return data;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(`discord_user_failed:HTTP_${res.status}`);
  }

  return data as DiscordUser;
}

async function fetchGuildMember(params: {
  guildId: string;
  botToken: string;
  discordUserId: string;
}): Promise<DiscordGuildMember | null> {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${params.guildId}/members/${params.discordUserId}`,
    {
      headers: { Authorization: `Bot ${params.botToken}` },
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`discord_member_failed:HTTP_${res.status}`);
  }

  return (await res.json()) as DiscordGuildMember;
}

/**
 * Inline role-ban check:
 * - DISCORD_BANNED_ROLE_IDS=1,2,3
 * - DISCORD_BANNED_ROLE_NAMES=Muted,Banned
 */
async function isRoleBanned(params: {
  guildId: string;
  botToken: string;
  memberRoles: string[];
}): Promise<{ banned: boolean; bannedRoleName?: string }> {
  const bannedRoleIds = new Set(parseCsvEnv("DISCORD_BANNED_ROLE_IDS"));
  const bannedRoleNames = parseCsvEnv("DISCORD_BANNED_ROLE_NAMES").map((n) => n.toLowerCase());

  // Resolve role names -> IDs if names are configured
  const roleIdToName = new Map<string, string>();
  if (bannedRoleNames.length > 0) {
    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${params.guildId}/roles`,
      {
        headers: { Authorization: `Bot ${params.botToken}` },
      },
    );

    if (rolesRes.ok) {
      const guildRoles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
      for (const role of guildRoles) {
        if (bannedRoleNames.includes(role.name.toLowerCase())) {
          bannedRoleIds.add(role.id);
          roleIdToName.set(role.id, role.name);
        }
      }
    }
  }

  if (bannedRoleIds.size === 0) return { banned: false };

  const matched = params.memberRoles.find((roleId) => bannedRoleIds.has(roleId));
  if (!matched) return { banned: false };

  return {
    banned: true,
    bannedRoleName: roleIdToName.get(matched),
  };
}

async function getOrCreateSupabaseSession(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  discordUser: DiscordUser;
}) {
  const supabaseAdmin = createClient(params.supabaseUrl, params.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseAnon = createClient(params.supabaseUrl, params.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use bear-cafe.internal domain — consistent with discord-callback
  const email = `discord_${params.discordUser.id}@bear-cafe.internal`;
  const password = `discord_auth_${params.discordUser.id}_bear`;

  // Step 1: Try sign in with existing credentials
  const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError && signInData.session) {
    return { session: signInData.session, userId: signInData.user!.id };
  }

  // Step 2: Try to create new user
  const createResult = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      discord_id: params.discordUser.id,
      discord_username: params.discordUser.username,
    },
  });

  if (!createResult.error && createResult.data.user) {
    // Sign in with the newly created user
    const { data: newSignIn, error: newSignInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });
    if (newSignInError || !newSignIn.session) {
      throw new Error(`auth_sign_in_failed:${newSignInError?.message ?? "session_not_created"}`);
    }
    return { session: newSignIn.session, userId: createResult.data.user.id };
  }

  const createMsg = createResult.error?.message ?? "";
  const alreadyExists = createMsg.toLowerCase().includes("already") ||
    createMsg.toLowerCase().includes("registered");

  if (!alreadyExists) {
    throw new Error(`auth_create_user_failed:${createMsg}`);
  }

  // Step 3: User exists but password may be wrong — find and reset
  let foundUserId: string | null = null;
  let page = 1;
  while (!foundUserId) {
    const listResult = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (listResult.error) throw new Error(`auth_list_users_failed:${listResult.error.message}`);
    const users = listResult.data?.users ?? [];
    if (users.length === 0) break;
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) { foundUserId = found.id; break; }
    if (users.length < 200) break;
    page++;
    if (page > 50) break;
  }

  if (!foundUserId) throw new Error("auth_existing_user_not_found");

  const updateResult = await supabaseAdmin.auth.admin.updateUserById(foundUserId, { password });
  if (updateResult.error) throw new Error(`auth_update_user_failed:${updateResult.error.message}`);

  const { data: retrySignIn, error: retryError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });
  if (retryError || !retrySignIn.session) {
    throw new Error(`auth_sign_in_failed:${retryError?.message ?? "session_not_created"}`);
  }

  return { session: retrySignIn.session, userId: foundUserId };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error_type: "method_not_allowed" }, 405);
  }

  const debugId = crypto.randomUUID();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const DISCORD_CLIENT_ID = Deno.env.get("DISCORD_CLIENT_ID");
    const DISCORD_CLIENT_SECRET = Deno.env.get("DISCORD_CLIENT_SECRET");
    const DISCORD_GUILD_ID = Deno.env.get("DISCORD_GUILD_ID");
    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");

    if (
      !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY ||
      !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_GUILD_ID || !DISCORD_BOT_TOKEN
    ) {
      return jsonResponse({
        ok: false,
        error_type: "internal_error",
        message: "Server OAuth configuration is incomplete",
        debug_id: debugId,
      }, 500);
    }

    // redirect_uri is resolved server-side from DISCORD_REDIRECT_URI env var.
    // ALLOWED_ORIGINS (comma-separated) is used to validate the request Origin header
    // so only known front-end domains can trigger the OAuth flow.
    const DISCORD_REDIRECT_URI = Deno.env.get("DISCORD_REDIRECT_URI") ?? "";
    const ALLOWED_ORIGINS = parseCsvEnv("ALLOWED_ORIGINS");

    if (!DISCORD_REDIRECT_URI) {
      return jsonResponse({
        ok: false,
        error_type: "internal_error",
        message: "DISCORD_REDIRECT_URI is not configured",
        debug_id: debugId,
      }, 500);
    }

    // Validate request Origin against ALLOWED_ORIGINS whitelist
    const requestOrigin = req.headers.get("origin") ?? "";
    if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(requestOrigin)) {
      console.warn(`[discord-auth] Blocked origin: ${requestOrigin}`);
      return jsonResponse({
        ok: false,
        error_type: "internal_error",
        message: "Origin not allowed",
        debug_id: debugId,
      }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code : "";

    if (!code) {
      return jsonResponse({
        ok: false,
        error_type: "oauth_invalid_code",
        message: "Missing code",
        debug_id: debugId,
      }, 400);
    }

    // redirect_uri comes from server-side env var — guaranteed to match Discord Portal
    const redirectUri = DISCORD_REDIRECT_URI;

    // 1) Exchange OAuth code -> token
    const tokenData = await fetchDiscordToken({
      code,
      redirectUri,
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
    });

    // 2) Fetch Discord profile
    const discordUser = await fetchDiscordUser(tokenData.access_token);

    // 3) Must be in guild
    const member = await fetchGuildMember({
      guildId: DISCORD_GUILD_ID,
      botToken: DISCORD_BOT_TOKEN,
      discordUserId: discordUser.id,
    });

    if (!member) {
      return jsonResponse({
        ok: false,
        error_type: "not_member",
        message: "User is not in Discord server",
        debug_id: debugId,
      }, 403);
    }

    const memberRoles = member.roles ?? [];

    // 4) Role-ban check
    const roleBan = await isRoleBanned({
      guildId: DISCORD_GUILD_ID,
      botToken: DISCORD_BOT_TOKEN,
      memberRoles,
    });

    if (roleBan.banned) {
      return jsonResponse({
        ok: false,
        error_type: "banned_role",
        message: roleBan.bannedRoleName
          ? `Blocked by banned role: ${roleBan.bannedRoleName}`
          : "Blocked by banned role",
        debug_id: debugId,
      }, 403);
    }

    // 5) Create real Supabase auth session
    const { session, userId: authUserId } = await getOrCreateSupabaseSession({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      discordUser,
    });

    // 6) Upsert profiles using auth UUID as id (matches profiles.id = auth.uid() constraint)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    const nickname = discordUser.global_name || discordUser.username;

    // Check if profile already exists by discord_id (for existing 800 members)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("discord_id", discordUser.id)
      .maybeSingle();

    let profile;
    if (existingProfile) {
      // Update existing profile — keep id intact, just refresh data
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          username: discordUser.username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", discordUser.id)
        .select("*")
        .single();
      if (updateError) throw new Error(`profile_update_failed:${updateError.message}`);
      profile = updated;
    } else {
      // Insert new profile with auth UUID as id
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authUserId,
          discord_id: discordUser.id,
          username: discordUser.username,
          avatar_url: avatarUrl,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(`profile_insert_failed:${insertError.message}`);
      profile = inserted;
    }

    return jsonResponse({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
      },
      profile,
      debug_id: debugId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const mappedType = message.startsWith("oauth_exchange_failed")
      ? "oauth_exchange_failed"
      : "internal_error";

    return jsonResponse({
      ok: false,
      error_type: mappedType,
      message,
      debug_id: debugId,
    }, 400);
  }
});
