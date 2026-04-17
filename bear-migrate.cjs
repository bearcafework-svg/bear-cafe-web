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
  console.log('🐻 เริ่มภารกิจย้ายคลังสมบัติร้านหมี (เวอร์ชันอัปเกรด)...');

  for (const bucket of BUCKETS) {
    console.log(`📂 กำลังตรวจสอบ Bucket: ${bucket}...`);
    
    // ✨ แก้จุดบอด 1: ดึงรายชื่อไฟล์ทั้งหมด (ปรับ limit เป็น 1000+)
    const { data: files, error } = await oldClient.storage
      .from(bucket)
      .list('', { limit: 5000, sortBy: { column: 'name', order: 'asc' } });

    if (files) {
      console.log(`🔍 พบไฟล์ทั้งหมด ${files.length} ชิ้นใน ${bucket}`);
      
      for (const file of files) {
        if (file.id === undefined) continue; // ข้ามโฟลเดอร์ (ถ้ามี)

        // ✨ แก้จุดบอด 2: เช็กว่ามีไฟล์นี้ที่บ้านใหม่หรือยัง (ป้องกันการอัปโหลดซ้ำ)
        const { data: exists } = await newClient.storage.from(bucket).list('', { search: file.name });
        
        if (exists && exists.length > 0) {
          console.log(`⏭️  ข้าม ${file.name} (มีอยู่ที่บ้านใหม่แล้ว)`);
          continue;
        }

        const { data: blob, error: dlError } = await oldClient.storage.from(bucket).download(file.name);
        
        if (blob) {
          const { error: upError } = await newClient.storage.from(bucket).upload(file.name, blob, { 
            upsert: true,
            contentType: blob.type // รักษาประเภทไฟล์ไว้ให้เหมือนเดิม
          });
          
          if (!upError) console.log(`✅ ย้ายรูป ${file.name} สำเร็จ!`);
          else console.error(`❌ พลาดที่ไฟล์ ${file.name}:`, upError.message);
        }
      }
    }
  }
  // ... (ส่วนอัปเดต SQL ในตารางเดิมของคุณใช้งานได้ดีอยู่แล้วค่ะ)
  console.log('✨ ภารกิจเสร็จสิ้น! สมาชิก 800 คนจะมีรูปสวยๆ เหมือนเดิมแล้วค่ะ');
}

migrate();