import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// เพดานแต้มอิงตาม Role
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

    if (!discordId) throw new Error("missing_userId");

    // ใช้ Service Role Key เพื่อให้บอทจัดการฐานข้อมูลได้ (ข้าม RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 1. ดึงแต้มปัจจุบันและค่าเก่าจาก DB
    const { data: userRow } = await supabaseAdmin
      .from('user_points')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    let currentPoints = userRow?.points || 0;

    // 2. คำนวณเพดานแต้มใหม่ (บังคับเริ่มที่ 600 เสมอ ล้างค่า 500 ทิ้ง)
    let calculatedCap = DEFAULT_CAP; 

    // เช็คว่ามี Role ส่งมาไหม
    if (roleIdsStr) {
      // ล้างอักขระขยะ [ ] " หรือช่องว่างที่ BDFD อาจจะส่งมา
      const cleanRoleIds = roleIdsStr.replace(/[\[\]\" ]/g, ''); 
      
      for (const [rId, cap] of Object.entries(ROLE_CAPS)) {
        if (cleanRoleIds.includes(rId) && cap > calculatedCap) {
          calculatedCap = cap; // อัปเดตถ้าเจอ Role ที่เพดานสูงกว่า
        }
      }
    }

    // 3. สรุปค่า Cap ที่จะใช้จริงๆ
    let finalCap = calculatedCap;
    // ถ้าไม่มี Role ส่งมาเลย แต่ใน DB เคยเซฟไว้ว่าคนนี้ได้มากกว่า 600 (เช่นได้ 1000 ไปแล้ว) ให้คงค่าสูงนั้นไว้
    if (!roleIdsStr && userRow?.max_cap && userRow.max_cap > DEFAULT_CAP) {
      finalCap = userRow.max_cap;
    }
    finalCap = Math.max(Number(finalCap) || DEFAULT_CAP, DEFAULT_CAP);

    // ACTION: GET (ดูแต้ม)
    if (action === 'get') {
      // 💡 จุดสำคัญ: สั่ง Upsert ทับลง DB ทันที เพื่อล้างบางพวกที่ค้าง 500 ให้เป็น 600 อย่างถาวร
      await supabaseAdmin.from('user_points').upsert({ 
        discord_id: discordId, 
        points: currentPoints, 
        max_cap: finalCap, 
        updated_at: new Date().toISOString() 
      });

      return new Response(JSON.stringify({ 
        ok: true, 
        userId: discordId, 
        points: currentPoints, 
        maxCap: finalCap,
        roles: roleIdsStr 
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ACTION: ADD (เพิ่มแต้ม)
    if (action === 'add') {
      let newPoints = currentPoints + amount;
      let isCapped = false;
      if (newPoints > finalCap) {
        newPoints = finalCap;
        isCapped = true;
      }
      
      await supabaseAdmin.from('user_points').upsert({ 
        discord_id: discordId, 
        points: newPoints, 
        max_cap: finalCap, 
        updated_at: new Date().toISOString() 
      });
      
      return new Response(JSON.stringify({ 
        ok: true, 
        userId: discordId, 
        points: newPoints, 
        added: newPoints - currentPoints, 
        maxCap: finalCap, 
        isCapped 
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ACTION: SUB (ลดแต้ม)
    if (action === 'sub') {
      let newPoints = currentPoints - amount;
      if (newPoints < 0) newPoints = 0; // ป้องกันแต้มติดลบ
      
      await supabaseAdmin.from('user_points').upsert({ 
        discord_id: discordId, 
        points: newPoints, 
        max_cap: finalCap, 
        updated_at: new Date().toISOString() 
      });
      
      return new Response(JSON.stringify({ 
        ok: true, 
        userId: discordId, 
        points: newPoints, 
        removed: currentPoints - newPoints, 
        maxCap: finalCap 
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ดักจับ Action ที่ไม่รู้จัก
    return new Response(JSON.stringify({ ok: false, error: 'unknown_action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
