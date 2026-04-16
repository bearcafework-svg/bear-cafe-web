import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[cleanup-discord-servers] Starting cleanup...');

    // 1. Check all approved servers' invite links
    const { data: servers, error: fetchError } = await supabase
      .from('discord_servers')
      .select('id, invite_url, bumped_at, name, status')
      .in('status', ['approved', 'pending']);

    if (fetchError) {
      console.error('Failed to fetch servers:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch servers' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let invalidInvites = 0;
    let expiredBumps = 0;
    let checkedCount = 0;
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const server of (servers || [])) {
      checkedCount++;

      // Check bump expiry (30 days without bump = hide)
      if (server.bumped_at && server.status === 'approved') {
        const bumpAge = now - new Date(server.bumped_at).getTime();
        if (bumpAge > THIRTY_DAYS_MS) {
          console.log(`[cleanup] Server "${server.name}" expired (no bump in 30 days)`);
          await supabase
            .from('discord_servers')
            .update({ status: 'expired' })
            .eq('id', server.id);
          expiredBumps++;
          continue; // Skip invite check for expired servers
        }
      }

      // Check invite validity (only for approved servers)
      if (server.status === 'approved') {
        try {
          // Extract invite code from URL
          const match = server.invite_url.match(/discord\.gg\/([a-zA-Z0-9-]+)/);
          if (!match) {
            console.log(`[cleanup] Server "${server.name}" has invalid invite URL format`);
            continue;
          }
          const inviteCode = match[1];

          const res = await fetch(`https://discord.com/api/v10/invites/${inviteCode}`);
          
          if (res.status === 404 || res.status === 403) {
            console.log(`[cleanup] Server "${server.name}" invite is invalid/expired`);
            await supabase
              .from('discord_servers')
              .update({ status: 'invite_expired' })
              .eq('id', server.id);
            invalidInvites++;
          }

          // Rate limit: wait 500ms between Discord API calls
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`[cleanup] Error checking invite for "${server.name}":`, e);
        }
      }
    }

    const summary = {
      checked: checkedCount,
      invalid_invites: invalidInvites,
      expired_bumps: expiredBumps,
      total_cleaned: invalidInvites + expiredBumps,
    };
    console.log('[cleanup-discord-servers] Complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in cleanup-discord-servers:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
