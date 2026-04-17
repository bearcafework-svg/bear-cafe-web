import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { code } = await req.json();

    const clientId = Deno.env.get('DISCORD_CLIENT_ID')!;
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('DISCORD_REDIRECT_URI')!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. แลก code เป็น token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error("Discord token exchange failed");
    }

    // 2. ดึง user จาก Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const discordUser = await userRes.json();

    if (!discordUser?.id) {
      throw new Error("Discord user fetch failed");
    }

    const displayName =
      discordUser.global_name || discordUser.username;

    // 3. หา profile เดิม
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('discord_id', discordUser.id)
      .maybeSingle();

    let userId: string;

    if (!existing) {
      // 4. สร้าง auth user
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: `${discordUser.id}@discord.local`,
          email_confirm: true,
          user_metadata: {
            discord_id: discordUser.id
          }
        });

      if (createError && !createError.message.includes("already registered")) {
        throw createError;
      }

      userId = newUser?.user?.id;

      if (!userId) {
        throw new Error("Failed to create user");
      }

    } else {
      userId = existing.id;
    }

    // 5. upsert profile (insert/update ทีเดียว)
    await supabase.from('profiles').upsert({
      id: userId,
      discord_id: discordUser.id,
      username: discordUser.username,
      discord_username: discordUser.username,
      nickname: displayName,
      avatar_url: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // 6. สร้าง session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: `${discordUser.id}@discord.local`
      });

    if (sessionError) throw sessionError;

    return new Response(JSON.stringify({
      ok: true,
      redirect: sessionData.properties.action_link
    }));

  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message
    }), { status: 400 });
  }
});