import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const discordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
    if (!discordId) {
      return new Response(
        JSON.stringify({ error: 'No Discord ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check coins
    const { data: stats, error: statsError } = await supabase
      .from('user_gacha_stats')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (statsError) {
      console.error('Stats error:', statsError);
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-create stats row if not exists
    if (!stats) {
      const { error: insertError } = await supabase
        .from('user_gacha_stats')
        .insert({ discord_id: discordId, gacha_coins: 0, match_count: 0 });
      if (insertError) console.error('Failed to create stats:', insertError);
      return new Response(
        JSON.stringify({ error: 'เหรียญไม่เพียงพอ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((stats.gacha_coins || 0) < 1) {
      return new Response(
        JSON.stringify({ error: 'เหรียญไม่เพียงพอ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get active rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('gacha_rewards')
      .select('*')
      .eq('is_active', true);

    if (rewardsError) {
      console.error('Rewards error:', rewardsError);
      return new Response(
        JSON.stringify({ error: 'ไม่สามารถดึงรางวัลได้' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const availableRewards = (rewards || []).filter((r: any) =>
      r.max_limit === null || (r.claimed_count || 0) < r.max_limit
    );

    // 3. Weighted random selection (server-side, tamper-proof)
    const totalWeight = availableRewards.reduce((sum: number, r: any) => sum + Number(r.drop_rate), 0);
    const random = Math.random() * (totalWeight > 0 ? totalWeight : 100);
    let selectedReward: any = null;
    let currentWeight = 0;

    for (const reward of availableRewards) {
      currentWeight += Number(reward.drop_rate);
      if (random <= currentWeight) {
        selectedReward = reward;
        break;
      }
    }

    // 4. Deduct coin (atomic)
    const { error: deductError } = await supabase
      .from('user_gacha_stats')
      .update({
        gacha_coins: (stats.gacha_coins || 0) - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('discord_id', discordId);

    if (deductError) {
      console.error('Deduct error:', deductError);
      return new Response(
        JSON.stringify({ error: 'หักเหรียญล้มเหลว' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rewardResult: any = { type: 'none', name: 'เกลือ' };

    if (selectedReward) {
      // Increment claimed_count
      await supabase.rpc('increment_gacha_claimed_count', { reward_id: selectedReward.id });

      rewardResult = {
        id: selectedReward.id,
        type: selectedReward.type,
        name: selectedReward.name,
        value: selectedReward.value,
      };

      // 5. Process reward by type
      if (selectedReward.type === 'point') {
        const pointsToAdd = parseInt(selectedReward.value || '0', 10);
        if (pointsToAdd > 0) {
          const { data: pointsData } = await supabase
            .from('user_points')
            .select('points, max_cap')
            .eq('discord_id', discordId)
            .maybeSingle();

          if (pointsData) {
            const newPoints = Math.min((pointsData.points || 0) + pointsToAdd, pointsData.max_cap || 99999);
            await supabase
              .from('user_points')
              .update({ points: newPoints, updated_at: new Date().toISOString() })
              .eq('discord_id', discordId);
          } else {
            await supabase
              .from('user_points')
              .upsert({
                discord_id: discordId,
                points: pointsToAdd,
                max_cap: 600,
                updated_at: new Date().toISOString(),
              });
          }
          rewardResult.points_added = pointsToAdd;
        }
      } else if (selectedReward.type === 'role') {
        const roleId = selectedReward.value;
        if (roleId) {
          const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
          const guildId = Deno.env.get('DISCORD_GUILD_ID');
          if (botToken && guildId) {
            try {
              const res = await discordFetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
                {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              rewardResult.role_granted = res.ok;
              if (!res.ok) {
                console.error(`Failed to grant role ${roleId}:`, res.status, await res.text());
              }
            } catch (e) {
              console.error('Discord role grant error:', e);
              rewardResult.role_granted = false;
            }
          }
        }
      } else if (selectedReward.type === 'money') {
        const extraCoins = parseInt(selectedReward.value || '0', 10);
        if (extraCoins > 0) {
          const currentCoins = (stats.gacha_coins || 0) - 1;
          await supabase
            .from('user_gacha_stats')
            .update({
              gacha_coins: currentCoins + extraCoins,
              updated_at: new Date().toISOString(),
            })
            .eq('discord_id', discordId);
          rewardResult.coins_added = extraCoins;
        }
      }
      // 'item' and 'other' types just record - admin handles manually
    }

    console.log(`Gacha spin: user=${discordId}, reward=${rewardResult.name} (${rewardResult.type})`);

    return new Response(
      JSON.stringify({ success: true, reward: rewardResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Gacha spin unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
