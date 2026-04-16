import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = getClientIp(req);
    const rateLimitKey = `login:${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60_000);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'พยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่อีกครั้ง', retryAfterSeconds: rateLimit.retryAfterSeconds }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    const { redirectUrl, turnstileToken } = await req.json();
    const redirectUri = redirectUrl;

    if (!clientId) {
      console.error('DISCORD_CLIENT_ID not configured');
      throw new Error('Discord OAuth not configured');
    }

    const turnstile = await verifyTurnstile(turnstileToken);
    if (!turnstile.success) {
      return new Response(
        JSON.stringify({ error: 'ยืนยันความปลอดภัยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Discord OAuth2 authorization URL (identify + guilds for ownership verification)
    const scope = encodeURIComponent('identify guilds');
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

    console.log('Generated Discord auth URL for redirect:', redirectUri);

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in discord-auth:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
