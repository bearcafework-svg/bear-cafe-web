import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractInviteCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.trim();
  const patterns = [
    /discord\.gg\/([a-zA-Z0-9-]+)/i,
    /discord\.com\/invite\/([a-zA-Z0-9-]+)/i,
    /discordapp\.com\/invite\/([a-zA-Z0-9-]+)/i,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m && m[1]) return m[1];
  }
  if (/^[a-zA-Z0-9-]+$/.test(cleaned) && !cleaned.includes('/') && !cleaned.includes('.')) {
    return cleaned;
  }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('[cleanup-discord-servers] Starting batch verification...');

    // Fetch all approved servers
    const { data: servers, error: fetchError } = await supabase
      .from('discord_servers')
      .select('id, name, invite_url, bumped_at, status, invite_status')
      .eq('status', 'approved');

    if (fetchError) {
      console.error('Failed to fetch servers:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch servers' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let validCount = 0;
    let expiredCount = 0;
    let rateLimitCount = 0;
    let errorCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < (servers || []).length; i++) {
      const server = servers[i];
      const inviteCode = extractInviteCode(server.invite_url);

      if (!inviteCode) {
        console.log(`[cleanup] Server "${server.name}" has invalid invite format`);
        await supabase
          .from('discord_servers')
          .update({ invite_status: 'expired', invite_last_checked_at: now })
          .eq('id', server.id);
        expiredCount++;
        continue;
      }

      try {
        const res = await fetch(
          `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`
        );

        if (res.status === 200) {
          const data = await res.json();
          const guild = data.guild;

          const updatePayload: Record<string, any> = {
            invite_status: 'valid',
            invite_last_checked_at: now,
          };

          if (guild) {
            updatePayload.name = guild.name;
            if (guild.description !== undefined) {
              updatePayload.description = guild.description;
            }
            if (data.approximate_member_count != null) {
              updatePayload.member_count = data.approximate_member_count;
            }
            const icon = buildIconUrl(guild.id, guild.icon);
            if (icon) updatePayload.icon_url = icon;
            const banner = buildBannerUrl(guild.id, guild.banner) || buildSplashUrl(guild.id, guild.splash);
            if (banner) updatePayload.banner_url = banner;
          }

          await supabase
            .from('discord_servers')
            .update(updatePayload)
            .eq('id', server.id);

          validCount++;
        } else if (res.status === 404 || res.status === 403 || res.status === 400) {
          console.log(`[cleanup] Server "${server.name}" invite expired/invalid (${res.status})`);
          await supabase
            .from('discord_servers')
            .update({ invite_status: 'expired', invite_last_checked_at: now })
            .eq('id', server.id);
          expiredCount++;
        } else if (res.status === 429) {
          console.warn(`[cleanup] Rate limit encountered on "${server.name}"`);
          rateLimitCount++;
          // Wait longer on rate limit
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          console.warn(`[cleanup] Unexpected status ${res.status} for "${server.name}"`);
          errorCount++;
        }

        // Rate limit protection: 500ms delay between requests
        if (i < servers.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        console.error(`[cleanup] Error checking invite for "${server.name}":`, err);
        errorCount++;
      }
    }

    const summary = {
      total_checked: servers?.length ?? 0,
      valid_invites: validCount,
      expired_invites: expiredCount,
      rate_limits: rateLimitCount,
      errors: errorCount,
      timestamp: now,
    };

    console.log('[cleanup-discord-servers] Completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in cleanup-discord-servers:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
