const { createClient } = require('@supabase/supabase-js');

// --- 🐻 ตั้งค่ากุญแจ (ใส่เองได้เลย!) ---
const OLD_SUPABASE_URL = 'https://itulsrbsluwdqwakldjs.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0dWxzcmJzbHV3ZHF3YWtsZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDQzODcsImV4cCI6MjA4MjkyMDM4N30.tXoHuOfILzkX4TD2HWJ3dUg0ZHghTvr_HBA4tNsLNMg';

const NEW_SUPABASE_URL = 'https://orbxyyjpvpbqwfssnyeq.supabase.co'; // หรือ URL ใหม่ของคุณ
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYnh5eWpwdnBicXdmc3NueWVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1Mjc1OCwiZXhwIjoyMDkxOTI4NzU4fQ.cwY28Hvx6qgA3t9Hp4x4b1l_a9i41QfZ5lVue3mYPmI';

const oldClient = createClient(OLD_SUPABASE_URL, OLD_SERVICE_KEY);
const newClient = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY);

const BUCKETS = ['icons', 'banners', 'warn-images', 'slip-images'];
const TABLES_TO_UPDATE = [
    { name: 'profiles', columns: ['avatar_url'] },
    { name: 'banners', columns: ['image_url'] },
    { name: 'warn_logs', columns: ['image_url'] },
    { name: 'slip_images', columns: ['slip_url', 'slip_url_2'] },
    { name: 'tag_warn_logs', columns: ['image_url'] },
    { name: 'trading_history', columns: ['slip_url', 'slip_url_2'] },
    { name: 'tag_warn_cancel_requests', columns: ['image_url'] }

];

async function migrate() {
  console.log('🐻 เริ่มภารกิจย้ายคลังสมบัติร้านหมี...');

  // 1. ย้ายรูปภาพใน Storage
  for (const bucket of BUCKETS) {
    console.log(`📂 กำลังย้ายไฟล์ใน Bucket: ${bucket}...`);
    const { data: files } = await oldClient.storage.from(bucket).list();
    
    if (files) {
      for (const file of files) {
        // ดาวน์โหลดจากที่เก่า
        const { data: blob } = await oldClient.storage.from(bucket).download(file.name);
        if (blob) {
          // อัปโหลดไปที่ใหม่
          await newClient.storage.from(bucket).upload(file.name, blob, { upsert: true });
          console.log(`✅ ย้ายรูป ${file.name} เรียบร้อย`);
        }
      }
    }
  }

  // 2. แก้ลิงก์ในตารางต่างๆ
  console.log('📝 กำลังเริ่มแก้ลิงก์ในตาราง...');
  for (const table of TABLES_TO_UPDATE) {
    for (const column of table.columns) {
      // ค้นหาแถวที่มีลิงก์บ้านเก่า
      const { data: rows } = await newClient
        .from(table.name)
        .select(`id, ${column}`)
        .filter(column, 'ilike', `%${OLD_SUPABASE_URL}%`);

      if (rows) {
        for (const row of rows) {
          const oldUrl = row[column];
          const newUrl = oldUrl.replace(OLD_SUPABASE_URL, NEW_SUPABASE_URL);
          
          await newClient.from(table.name).update({ [column]: newUrl }).eq('id', row.id);
          console.log(`🔄 อัปเดตลิงก์ในตาราง ${table.name} ID: ${row.id}`);
        }
      }
    }
  }
  console.log('✨ ภารกิจเสร็จสิ้น! ร้านหมีกลับมาสวยเหมือนเดิมแล้วค่ะ');
}

migrate();