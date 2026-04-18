import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractInviteCode(input: string): string | null {
  // Handle full URLs: discord.gg/abc, discord.com/invite/abc, etc.
  const patterns = [
    /discord\.gg\/([a-zA-Z0-9-]+)/,
    /discord\.com\/invite\/([a-zA-Z0-9-]+)/,
    /discordapp\.com\/invite\/([a-zA-Z0-9-]+)/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  // If it looks like a plain code (no slashes)
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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use adminClient with service role to verify token — bypasses ES256 JWT algorithm issue
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { invite_url, category_id } = await req.json();
    if (!invite_url || !category_id) {
      return new Response(JSON.stringify({ error: 'invite_url and category_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const inviteCode = extractInviteCode(invite_url);
    if (!inviteCode) {
      return new Response(JSON.stringify({ error: 'ลิงก์เชิญไม่ถูกต้อง กรุณาใช้ลิงก์ discord.gg/...' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch invite data from Discord public API (no bot needed!)
    const discordRes = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`,
    );

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error('Discord invite API error:', discordRes.status, errText);
      if (discordRes.status === 404) {
        return new Response(JSON.stringify({ error: 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'ไม่สามารถดึงข้อมูลจาก Discord ได้' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const inviteData = await discordRes.json();
    const guild = inviteData.guild;
    if (!guild) {
      return new Response(JSON.stringify({ error: 'ไม่พบข้อมูลเซิร์ฟเวอร์จากลิงก์นี้' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's discord_id from profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('discord_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'ไม่พบโปรไฟล์ผู้ใช้' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const guildId = guild.id;
    const serverName = guild.name;
    const iconUrl = buildIconUrl(guildId, guild.icon);
    const bannerUrl = buildBannerUrl(guildId, guild.banner) || buildSplashUrl(guildId, guild.splash);
    const memberCount = inviteData.approximate_member_count || 0;
    const onlineCount = inviteData.approximate_presence_count || 0;

    // Normalize invite URL to a clean format
    const cleanInviteUrl = `https://discord.gg/${inviteCode}`;

    // Check if server already exists
    const { data: existing } = await adminClient
      .from('discord_servers')
      .select('id, owner_id')
      .eq('discord_id', guildId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'เซิร์ฟเวอร์นี้ถูกเพิ่มไปแล้ว' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert new server
    const { data: newServer, error: insertError } = await adminClient
      .from('discord_servers')
      .insert({
        discord_id: guildId,
        name: serverName,
        description: guild.description || null,
        icon_url: iconUrl,
        banner_url: bannerUrl,
        member_count: memberCount,
        invite_url: cleanInviteUrl,
        owner_id: profile.discord_id,
        category_id,
        status: 'pending',
        bumped_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      server: {
        id: newServer.id,
        name: serverName,
        icon_url: iconUrl,
        banner_url: bannerUrl,
        member_count: memberCount,
        online_count: onlineCount,
        description: guild.description,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in resolve-discord-invite:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
