import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, code } = await req.json()
    if (!userId || !code) return json({ ok: false, error: 'missing_code' }, 400)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find code (case-insensitive)
    const trimmedCode = String(code).trim().toUpperCase()
    const { data: codeData } = await sb
      .from('redeem_codes')
      .select('*')
      .eq('code', trimmedCode)
      .maybeSingle()

    if (!codeData) return json({ ok: false, error: 'invalid_code' })
    if (!codeData.is_enabled) return json({ ok: false, error: 'disabled' })

    const now = new Date()
    if (codeData.start_at && new Date(codeData.start_at) > now) {
      return json({ ok: false, error: 'not_started' })
    }
    if (codeData.end_at && new Date(codeData.end_at) < now) {
      return json({ ok: false, error: 'expired' })
    }
    if (codeData.max_uses && codeData.max_uses > 0 && (codeData.used_count ?? 0) >= codeData.max_uses) {
      return json({ ok: false, error: 'limit_reached' })
    }

    // Check already redeemed
    const { data: existingLog } = await sb
      .from('redeem_logs')
      .select('id')
      .eq('discord_id', userId)
      .eq('code', codeData.code)
      .maybeSingle()

    if (existingLog) return json({ ok: false, error: 'already_redeemed' })

    // Get current user points
    const { data: userRow } = await sb
      .from('user_points')
      .select('*')
      .eq('discord_id', userId)
      .maybeSingle()

    let currentPoints = userRow?.points ?? 0
    const currentCap = Math.max(userRow?.max_cap ?? 750, 750)

    const granted: { pointsAdded?: number; roleGranted?: string } = {}

    // Add points
    if (codeData.reward_type === 'points' || codeData.reward_type === 'both') {
      const pointsToAdd = codeData.points ?? 0
      granted.pointsAdded = pointsToAdd
      const newPoints = Math.min(currentPoints + pointsToAdd, currentCap)
      await sb.from('user_points').upsert({
        discord_id: userId,
        points: newPoints,
        max_cap: currentCap,
        updated_at: new Date().toISOString(),
      })
      currentPoints = newPoints
    }

    // Role grant
    if ((codeData.reward_type === 'role' || codeData.reward_type === 'both') && codeData.role_id) {
      granted.roleGranted = codeData.role_id
    }

    // Log redemption
    await sb.from('redeem_logs').insert({
      discord_id: userId,
      code: codeData.code,
      reward_details: granted,
    })

    // Increment used_count
    await sb.from('redeem_codes').update({
      used_count: (codeData.used_count ?? 0) + 1,
    }).eq('code', codeData.code)

    return json({
      ok: true,
      userId,
      code: codeData.code,
      granted,
      pointsNow: currentPoints,
    })
  } catch (err: any) {
    return json({ ok: false, error: err.message }, 500)
  }
})
