import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractInviteCode(input: string): string | null {
  const patterns = [
    /discord\.gg\/([a-zA-Z0-9-]+)/,
    /discord\.com\/invite\/([a-zA-Z0-9-]+)/,
    /discordapp\.com\/invite\/([a-zA-Z0-9-]+)/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9-]+$/.test(input.trim())) return input.trim();
  return null;
}

function buildIconUrl(guildId: string, iconHash: string | null): string | null {
  if (!iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=256`;
}

function buildBannerUrl(guildId: string, bannerHash: string | null): string | null {
  if (!bannerHash) return null;
  const ext = bannerHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${ext}?size=512`;
}

function buildSplashUrl(guildId: string, splashHash: string | null): string | null {
  if (!splashHash) return null;
  return `https://cdn.discordapp.com/splashes/${guildId}/${splashHash}.png?size=512`;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ✅ FIX: ใช้ anon key + auth header (ไม่ใช้ service role verify)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    // ✅ OPTIONAL AUTH
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        userId = user.id;
      }
    }

    const { invite_url, category_id } = await req.json();

    if (!invite_url || !category_id) {
      return new Response(JSON.stringify({ error: 'invite_url and category_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const inviteCode = extractInviteCode(invite_url);
    if (!inviteCode) {
      return new Response(JSON.stringify({ error: 'ลิงก์เชิญไม่ถูกต้อง' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const discordRes = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`,
    );

    if (!discordRes.ok) {
      return new Response(JSON.stringify({ error: 'ไม่สามารถดึงข้อมูลจาก Discord ได้' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const inviteData = await discordRes.json();
    const guild = inviteData.guild;

    if (!guild) {
      return new Response(JSON.stringify({ error: 'ไม่พบเซิร์ฟเวอร์' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let ownerDiscordId: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('discord_id')
        .eq('id', userId)
        .single();
      ownerDiscordId = profile?.discord_id ?? null;
    }

    const guildId = guild.id;

    const { data: existing } = await supabase
      .from('discord_servers')
      .select('id')
      .eq('discord_id', guildId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'เซิร์ฟเวอร์นี้ถูกเพิ่มแล้ว' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: newServer, error: insertError } = await supabase
      .from('discord_servers')
      .insert({
        discord_id: guildId,
        name: guild.name,
        icon_url: buildIconUrl(guildId, guild.icon),
        banner_url: buildBannerUrl(guildId, guild.banner) || buildSplashUrl(guildId, guild.splash),
        invite_url: `https://discord.gg/${inviteCode}`,
        owner_id: ownerDiscordId,
        category_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: 'insert failed', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, id: newServer.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
