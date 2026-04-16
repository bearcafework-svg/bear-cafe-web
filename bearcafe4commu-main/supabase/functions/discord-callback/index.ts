import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRoleBanned } from "../_shared/role-ban.ts";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  global_name?: string;
  banner: string | null;
  banner_color: string | null;
  accent_color: number | null;
}

interface DiscordGuildMember {
  user: DiscordUser;
  nick?: string;
  roles: string[];
}

type ErrorType =
  | "banned_admin"
  | "not_member"
  | "banned_role"
  | "oauth_invalid_code"
  | "oauth_exchange_failed"
  | "internal_error";

type ErrorResponse = {
  ok: false;
  error_type: ErrorType;
  banned_role_name?: string | null;
};

type SuccessResponse = {
  ok: true;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number | null | undefined;
    expires_in: number | null | undefined;
  };
  profile: {
    id: string;
    username: string;
    avatar_url: string;
    is_banned: boolean;
  };
};

const jsonResponse = (payload: ErrorResponse | SuccessResponse, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const timing = (label: string, start: number) => {
  const elapsed = Math.round((performance.now() - start) * 100) / 100;
  console.log(`[discord-callback] ${label}: ${elapsed}ms`);
};

Deno.serve(async (req): Promise<Response> => {
  const reqStart = performance.now();
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (level: string, msg: string, extra?: Record<string, unknown>) => {
    const elapsed = Math.round((performance.now() - reqStart) * 100) / 100;
    const payload = { reqId, elapsed_ms: elapsed, ...extra };
    if (level === 'error') console.error(`[discord-callback][${reqId}] ${msg}`, JSON.stringify(payload));
    else if (level === 'warn') console.warn(`[discord-callback][${reqId}] ${msg}`, JSON.stringify(payload));
    else console.log(`[discord-callback][${reqId}] ${msg}`, JSON.stringify(payload));
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();

    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET');
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!clientId || !clientSecret || !botToken || !guildId) {
      log('error', 'Missing Discord configuration', { clientId: !!clientId, clientSecret: !!clientSecret, botToken: !!botToken, guildId: !!guildId });
      return jsonResponse({ ok: false, error_type: "internal_error" });
    }

    if (!code || !redirectUri) {
      log('warn', 'Missing code or redirectUri', { hasCode: !!code, hasRedirectUri: !!redirectUri });
      return jsonResponse({ ok: false, error_type: "oauth_invalid_code" });
    }

    log('info', 'Processing callback', { redirectUri });

    // Exchange code for access token
    const exchangeStart = performance.now();
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    timing("exchange_code", exchangeStart);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      log('error', 'Token exchange failed', { status: tokenResponse.status, body: errorText });
      const errorType =
        tokenResponse.status === 400 ? "oauth_invalid_code" : "oauth_exchange_failed";
      return jsonResponse({ ok: false, error_type: errorType });
    }

    const tokenData = await tokenResponse.json();
    log('info', 'Token exchange successful');

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      log('error', 'Failed to get user info', { status: userResponse.status });
      return jsonResponse({ ok: false, error_type: "internal_error" });
    }

    const discordUser: DiscordUser = await userResponse.json();
    log('info', 'Got Discord user', { username: discordUser.username, hasAvatar: !!discordUser.avatar, hasBanner: !!discordUser.banner });

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const adminBanStart = performance.now();
    const adminBanResult = await supabase
      .from("profiles")
      .select("id, is_banned")
      .eq("discord_id", discordUser.id)
      .maybeSingle();
    timing("db_adminban", adminBanStart);

    if (adminBanResult.error) {
      log('error', 'Failed to fetch existing profile', { error: adminBanResult.error.message, code: adminBanResult.error.code });
      return jsonResponse({ ok: false, error_type: "internal_error" });
    }

    const existingProfile = adminBanResult.data;
    log('info', 'Profile lookup', { found: !!existingProfile, isBanned: existingProfile?.is_banned ?? false });

    if (existingProfile?.is_banned) {
      log('warn', 'User is admin-banned');
      return jsonResponse({ ok: false, error_type: "banned_admin" });
    }

    const memberStart = performance.now();
    const memberResponse = await discordFetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );
    timing("fetch_member", memberStart);

    if (memberResponse.status === 404) {
      log('warn', 'User is not a member of the guild');
      return jsonResponse({ ok: false, error_type: "not_member" });
    }

    if (!memberResponse.ok) {
      log('error', 'Failed to fetch guild member', { status: memberResponse.status });
      return jsonResponse({ ok: false, error_type: "internal_error" });
    }

    const memberData: DiscordGuildMember = await memberResponse.json();
    log('info', 'Guild member fetched', { roles: memberData.roles, nick: memberData.nick ?? null });

    const roleBanDecision = await isRoleBanned(discordUser.id, guildId, botToken);
    if (roleBanDecision.banned) {
      log('warn', 'User is role-banned', { reason: roleBanDecision.reason, roleName: roleBanDecision.bannedRoleName });
      return jsonResponse({ 
        ok: false, 
        error_type: "banned_role",
        banned_role_name: roleBanDecision.bannedRoleName || null,
      });
    }

    log('info', 'User passed all checks');

    // Get avatar URL (always use PNG to avoid GIF performance issues)
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`;

    // Get banner URL (if user has Nitro and a banner)
    const bannerUrl = discordUser.banner
      ? `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.${discordUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=600`
      : null;

    const email = `discord_${discordUser.id}@bear-cafe.internal`;
    const password = `discord_auth_${discordUser.id}_${clientSecret?.slice(0, 8)}`;
    const displayName = memberData.nick || discordUser.global_name || discordUser.username;
    const discordUsername = discordUser.username; // The actual Discord handle

    // === AUTH FLOW: sign in → sign up → password reset fallback ===
    let authUser;
    let session;

    // Step 1: Try sign in
    const signInStart = performance.now();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    timing("sign_in", signInStart);

    if (!signInError && signInData.user) {
      authUser = signInData.user;
      session = signInData.session;
      log('info', 'Auth: signed in existing user', { authId: authUser.id });
    } else {
      log('info', 'Auth: sign in failed, trying sign up', { error: signInError?.message, code: (signInError as any)?.code });

      // Step 2: Try sign up
      const signUpStart = performance.now();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            discord_id: discordUser.id,
            username: displayName,
            avatar_url: avatarUrl,
          },
        },
      });
      timing("sign_up", signUpStart);

      if (!signUpError && signUpData.user) {
        authUser = signUpData.user;
        session = signUpData.session;
        log('info', 'Auth: new user created', { authId: authUser.id });
      } else if (signUpError?.message?.includes('already registered')) {
        // Step 3: Password mismatch — reset via admin API
        log('warn', 'Auth: user exists but password mismatch, resetting via admin', { error: signUpError.message });

        const pwResetStart = performance.now();

        // Use existingProfile.id (which IS the auth user UUID) if available
        // Otherwise fall back to admin listUsers with pagination
        let authUserId: string | null = existingProfile?.id ?? null;

        if (!authUserId) {
          log('info', 'Auth: no existing profile, searching auth users by email');
          // Paginate through all users to find by email
          let page = 1;
          const perPage = 500;
          let found = false;
          while (!found) {
            const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
            if (listError) {
              log('error', 'Auth: failed to list users for password reset', { error: listError.message, page });
              return jsonResponse({ ok: false, error_type: "internal_error" });
            }
            const match = userList.users.find((u: any) => u.email === email);
            if (match) {
              authUserId = match.id;
              found = true;
            } else if (userList.users.length < perPage) {
              break; // No more pages
            } else {
              page++;
            }
          }
        }

        if (!authUserId) {
          log('error', 'Auth: could not find auth user by any method', { email });
          return jsonResponse({ ok: false, error_type: "internal_error" });
        }

        log('info', 'Auth: found auth user for password reset', { authUserId });

        const { error: updatePwError } = await supabase.auth.admin.updateUserById(authUserId, { password });
        if (updatePwError) {
          log('error', 'Auth: failed to update password', { error: updatePwError.message, authId: authUserId });
          return jsonResponse({ ok: false, error_type: "internal_error" });
        }

        const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        timing("pw_reset_signin", pwResetStart);

        if (retryError || !retrySignIn.user) {
          log('error', 'Auth: sign in after password reset failed', { error: retryError?.message });
          return jsonResponse({ ok: false, error_type: "internal_error" });
        }

        authUser = retrySignIn.user;
        session = retrySignIn.session;
        log('info', 'Auth: signed in after password reset', { authId: authUser.id });
      } else {
        log('error', 'Auth: sign up failed unexpectedly', { error: signUpError?.message, code: (signUpError as any)?.code });
        return jsonResponse({ ok: false, error_type: "internal_error" });
      }
    }

    if (!authUser) {
      log('error', 'Auth: no auth user after all attempts');
      return jsonResponse({ ok: false, error_type: "internal_error" });
    }

    // === PROFILE UPSERT ===
    let profile;
    const profileStart = performance.now();
    if (existingProfile) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: displayName,
          discord_username: discordUsername,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('discord_id', discordUser.id)
        .select()
        .single();

      if (updateError) {
        log('error', 'Profile update failed', { error: updateError.message, code: updateError.code });
        return jsonResponse({ ok: false, error_type: "internal_error" });
      }
      profile = updatedProfile;
    } else {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          discord_id: discordUser.id,
          username: displayName,
          discord_username: discordUsername,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
        })
        .select()
        .single();

      if (insertError) {
        log('error', 'Profile insert failed', { error: insertError.message, code: insertError.code });
        return jsonResponse({ ok: false, error_type: "internal_error" });
      }
      profile = newProfile;
    }
    timing("profile_upsert", profileStart);
    log('info', 'Profile upserted', { profileId: profile.id, username: displayName });

    // Log action + update metadata with Discord access token for guilds API (non-blocking)
    await Promise.all([
      supabase.from('action_logs').insert({
        user_id: profile.id,
        action_type: 'login',
        details: { method: 'discord_oauth' },
      }),
      supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          discord_id: discordUser.id,
          username: displayName,
          avatar_url: avatarUrl,
          discord_access_token: tokenData.access_token,
        },
      }).then(({ error }) => {
        if (error) log('warn', 'Failed to update user metadata', { error: error.message });
      }),
    ]);

    // Ensure we have a session
    if (!session) {
      log('warn', 'No session after auth flow, creating one');
      const sessionStart = performance.now();
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
      timing("fallback_session", sessionStart);

      if (sessionError || !sessionData.session) {
        log('error', 'Failed to create fallback session', { error: sessionError?.message });
        return jsonResponse({ ok: false, error_type: "internal_error" });
      }
      session = sessionData.session;
    }

    const totalElapsed = Math.round((performance.now() - reqStart) * 100) / 100;
    log('info', 'Login complete', { profileId: profile.id, username: displayName, totalMs: totalElapsed });

    return jsonResponse({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
      },
      profile: {
        id: profile.id,
        username: displayName,
        avatar_url: avatarUrl,
        is_banned: profile.is_banned,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`[discord-callback] Unhandled error: ${message}`, stack);
    return jsonResponse({ ok: false, error_type: "internal_error" });
  }
});
