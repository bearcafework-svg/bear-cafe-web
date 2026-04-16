import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const ROLE_CAPS: Record<string, number> = {
  "1144701122053951498": 1000,
  "1211006403569786923": 1500,
  "1144701288257433781": 2000,
  "1144701473549201419": 2500,
  "1211007323456274592": 3000,
  "1211007327348592723": 4000,
  "1144701644479676569": 5000,
  "1211007334755864576": 6000,
  "1144701834842361927": 7500,
  "1211007331219804171": 9000,
  "1144702027474149447": 10000,
  "1211007338321023026": 12000
};
const DEFAULT_CAP = 750;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const discordId = url.searchParams.get('userId') || '';
    const amountStr = url.searchParams.get('amount') || '0';
    const amount = parseInt(amountStr, 10);
    const roleIdsStr = url.searchParams.get('roles') || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // ⭐ 1. แยก Action: Healing ออกมาไว้บนสุด ไม่ต้องเช็ค userId
    if (action === 'healing') {
      const { data, error } = await supabaseAdmin.rpc('get_random_healing_message');
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const fallbackMessage = 'คุณเก่งมากที่ผ่านวันนี้มาได้ 💛';

      return new Response(JSON.stringify({
        ok: true,
        message: row?.message || fallbackMessage,
        author_discord_id: row?.discord_id || '',
        author_username: row?.username || 'Bearcafe Community',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ⭐ 2. ถ้าไม่ใช่ Healing ถึงจะบังคับเช็ค userId (สำหรับพวก add, sub, get แต้ม)
    if (!discordId) {
       return new Response(JSON.stringify({ ok: false, error: 'missing_userId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // --- ส่วนของระบบแต้ม (Logic เดิมของคุณ) ---
    const { data: userRow } = await supabaseAdmin
      .from('user_points')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    let currentPoints = userRow?.points || 0;
    let calculatedCap = DEFAULT_CAP; 

    if (roleIdsStr) {
      const cleanRoleIds = roleIdsStr.replace(/[\[\]\" ]/g, ''); 
      for (const [rId, cap] of Object.entries(ROLE_CAPS)) {
        if (cleanRoleIds.includes(rId) && cap > calculatedCap) {
          calculatedCap = cap;
        }
      }
    }

    let finalCap = calculatedCap;
    if (!roleIdsStr && userRow?.max_cap && userRow.max_cap > DEFAULT_CAP) {
      finalCap = userRow.max_cap;
    }
    finalCap = Math.max(Number(finalCap) || DEFAULT_CAP, DEFAULT_CAP);

    if (action === 'get') {
      await supabaseAdmin.from('user_points').upsert({ 
        discord_id: discordId, 
        points: currentPoints, 
        max_cap: finalCap, 
        updated_at: new Date().toISOString() 
      });
      return new Response(JSON.stringify({ ok: true, userId: discordId, points: currentPoints, maxCap: finalCap }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'add') {
      let newPoints = currentPoints + amount;
      let isCapped = newPoints > finalCap;
      if (isCapped) newPoints = finalCap;
      
      await supabaseAdmin.from('user_points').upsert({ discord_id: discordId, points: newPoints, max_cap: finalCap, updated_at: new Date().toISOString() });
      return new Response(JSON.stringify({ ok: true, userId: discordId, points: newPoints, added: newPoints - currentPoints, maxCap: finalCap, isCapped }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'sub') {
      let newPoints = Math.max(0, currentPoints - amount);
      await supabaseAdmin.from('user_points').upsert({ discord_id: discordId, points: newPoints, max_cap: finalCap, updated_at: new Date().toISOString() });
      return new Response(JSON.stringify({ ok: true, userId: discordId, points: newPoints, removed: currentPoints - newPoints, maxCap: finalCap }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 🌟 ถ้าหลุดมาถึงตรงนี้ แสดงว่า action ไม่ตรงกับอะไรเลย
    return new Response(JSON.stringify({ ok: false, error: 'unknown_action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
