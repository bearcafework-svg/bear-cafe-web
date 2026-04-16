import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRoleBanGuard } from "../_shared/role-ban.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LegacyWebhookRequest {
  sessionId?: string;
  appUrl?: string;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  let requestData: LegacyWebhookRequest = {};

  try {
    requestData = await req.json().catch(() => ({}));

    console.warn('[legacy-discord-webhook] Deprecated endpoint invoked', {
      requestId,
      sessionId: requestData.sessionId ?? null,
      hasAppUrl: typeof requestData.appUrl === 'string' && requestData.appUrl.length > 0,
    });

    const guardResult = await requireRoleBanGuard(req, corsHeaders);
    if ('response' in guardResult) {
      return guardResult.response as Response;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('action_logs').insert({
      user_id: guardResult.user.id,
      action_type: 'legacy_discord_webhook_invoked',
      details: {
        request_id: requestId,
        session_id: requestData.sessionId ?? null,
        app_url: requestData.appUrl ?? null,
        endpoint: 'discord-webhook',
        marker: 'legacy_session_webhook',
        status: 'blocked_deprecated',
        migration_target: 'send-session-webhook',
      },
    });

    return new Response(
      JSON.stringify({
        error: 'The discord-webhook endpoint has been deprecated. Use send-session-webhook (Bot API) for all session messages, especially messages with buttons/components.',
        deprecated: true,
        migrationTarget: 'send-session-webhook',
        requestId,
      }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[legacy-discord-webhook] Error while handling deprecated endpoint', {
      requestId,
      sessionId: requestData.sessionId ?? null,
      message,
    });
    return new Response(
      JSON.stringify({ error: 'Unable to process deprecated endpoint request', deprecated: true, requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
