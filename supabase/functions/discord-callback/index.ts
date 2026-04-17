import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { code } = await req.json();
    
    // ตรวจสอบค่าที่จำเป็น
    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    // redirect_uri ต้องอ่านจาก env var เสมอ — ห้ามรับจาก client
    const redirectUri = Deno.env.get('DISCORD_REDIRECT_URI');

    if (!code || !clientId || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ครบถ้วน" }), { status: 400, headers: corsHeaders });
    }

    // 1. แลก Code เป็น Token
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

    // 2. ดึงข้อมูล Profile จาก Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    // 3. ดึงชื่อเล่นจาก Server
    let nickname = discordUser.global_name || discordUser.username;
    if (guildId && botToken) {
      const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        nickname = memberData.nick || nickname;
      }
    }

    // 4. บันทึกลงตาราง profiles (ย้ายจาก discord_username ไป nickname)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: discordUser.id, // สมมติว่าใช้ Discord ID เป็น Primary Key หรือเชื่อมกับ Auth
        discord_id: discordUser.id,
        username: discordUser.username, // ชื่อจริง Discord
        nickname: nickname,             // ชื่อเล่นในเซิร์ฟเวอร์
        avatar_url: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'discord_id' })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ ok: true, profile }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
