# Requirements Document

## Introduction

ระบบ **Bartender** คือฟีเจอร์เสริมสำหรับ `/secret-chat` (คาเฟ่ลับ) ที่ช่วยให้ผู้ใช้ที่รอคู่สนทนานานเกินไปได้รับการจับคู่กับทีมงานที่ได้รับมอบหมายพิเศษ (Bartender) แทนที่จะรอต่อไปโดยไม่มีกำหนด

Bartender คือสมาชิกทีมงานที่ Admin กำหนดไว้ในหลังบ้าน โดยมีหน้าที่คอยรับฟังและพูดคุยกับผู้ใช้ที่รอคิวนานเกิน 7 วินาทีแล้วยังไม่พบคู่สนทนา ระบบจะจับคู่ผู้ใช้นั้นกับ Bartender ที่ว่างอยู่ทันที

---

## Glossary

- **Bartender**: สมาชิกทีมงานที่ถูก Admin กำหนดให้มีบทบาทพิเศษในระบบคาเฟ่ลับ ทำหน้าที่รับจับคู่กับผู้ใช้ที่รอนาน มี record ใน `chat_bartenders` ที่มี `is_active = true`
- **Regular_User**: ผู้ใช้ทั่วไปที่เข้าใช้งานระบบคาเฟ่ลับ ไม่มี record ใน `chat_bartenders` หรือมี record ที่มี `is_active = false`
- **Queue**: ตาราง `chat_queue` ที่เก็บรายชื่อผู้ใช้ที่กำลังรอหาคู่สนทนา
- **Available_Bartender**: Bartender ที่มี record อยู่ใน `chat_queue` ณ ขณะนั้น และไม่มี session ที่มีสถานะ `active` ที่ตนเองเป็นคู่สนทนา
- **Busy_Bartender**: Bartender ที่มี session ที่มีสถานะ `active` ที่ตนเองเป็นคู่สนทนา (`user_a_id` หรือ `user_b_id`)
- **Idle_Bartender**: Bartender ที่ไม่ได้อยู่ใน Queue และไม่มี session ที่ active — ยังไม่พร้อมรับจับคู่
- **Wait_Timeout**: ระยะเวลา 7 วินาทีที่ผู้ใช้รอใน Queue ก่อนที่ระบบจะพยายามจับคู่กับ Bartender
- **Matchmaking_Engine**: ส่วนของระบบที่ทำหน้าที่จับคู่ผู้ใช้ใน Queue ปัจจุบันอยู่ใน `SecretChatRoom.tsx`
- **Polling_Cycle**: รอบการตรวจสอบคู่สนทนาของ Matchmaking_Engine ที่ทำงานทุก 1,200–5,000 ms
- **Admin**: ผู้ใช้ที่มี role เป็น `owner` หรือ `admin` ในตาราง `profiles`
- **Owner**: ผู้ใช้ที่มี role เป็น `owner` ในตาราง `profiles` เท่านั้น
- **BartenderManagement**: หน้าจัดการ Bartender ในระบบ Admin Panel
- **chat_bartenders**: ตารางใหม่ที่เก็บข้อมูลว่าผู้ใช้คนใดเป็น Bartender
- **System**: ระบบคาเฟ่ลับโดยรวม รวมถึง frontend และ database

---

## Requirements

### Requirement 1: การกำหนดสถานะ Bartender

**User Story:** ในฐานะ Admin ฉันต้องการกำหนดให้สมาชิกทีมงานเป็น Bartender ได้ เพื่อให้ระบบรู้ว่าใครมีหน้าที่รับจับคู่กับผู้ใช้ที่รอนาน

#### Acceptance Criteria

1. THE System SHALL เก็บข้อมูล Bartender ในตาราง `chat_bartenders` โดยมีคอลัมน์ `user_id` (อ้างอิง `profiles.id`), `is_active` (boolean, default `true`), และ `created_at` (timestamptz, default `now()`)
2. WHEN Admin เพิ่มผู้ใช้เป็น Bartender, THE System SHALL บันทึก record ลงใน `chat_bartenders` โดยตั้งค่า `is_active = true` และ upsert หากมี record เดิมอยู่แล้ว
3. WHEN Admin ปิดการใช้งาน Bartender, THE System SHALL ตั้งค่า `is_active = false` ใน `chat_bartenders` สำหรับผู้ใช้นั้น โดยไม่ลบ record ออก เพื่อรักษาประวัติ
4. THE System SHALL บังคับ unique constraint บน `user_id` ใน `chat_bartenders` เพื่อให้ผู้ใช้คนเดียวกันมีได้เพียงหนึ่ง record เท่านั้น
5. IF ผู้ใช้ที่ถูกกำหนดเป็น Bartender ถูกลบออกจากตาราง `profiles`, THEN THE System SHALL ลบ record ใน `chat_bartenders` ของผู้ใช้นั้นโดยอัตโนมัติ (ON DELETE CASCADE)
6. THE System SHALL ถือว่าผู้ใช้เป็น Bartender ก็ต่อเมื่อมี record ใน `chat_bartenders` ที่มี `is_active = true` เท่านั้น — ผู้ใช้ที่มี record แต่ `is_active = false` ถือเป็น Regular_User

---

### Requirement 2: กฎการจับคู่ระหว่าง Bartender กับผู้ใช้

**User Story:** ในฐานะ Regular_User ฉันต้องการให้ระบบจับคู่ฉันกับ Bartender เมื่อรอนานเกิน 7 วินาที เพื่อให้ฉันได้คุยกับใครสักคนแทนที่จะรอต่อไปเรื่อย ๆ

#### Acceptance Criteria

1. WHEN Regular_User รอใน Queue ครบ 7 วินาทีแล้วยังไม่พบคู่สนทนา, THE Matchmaking_Engine SHALL ค้นหา Available_Bartender ใน Queue ใน Polling_Cycle ถัดไป
2. IF Available_Bartender ถูกพบ, THEN THE Matchmaking_Engine SHALL เลือก Available_Bartender ที่เข้า Queue ก่อนสุด (FIFO ตาม `joined_at`) และจับคู่กับ Regular_User ที่รอนานที่สุดก่อน โดยไม่คำนึงถึง topic หรือ role compatibility
3. IF ผู้ใช้ที่กำลังอยู่ใน Queue เป็น Bartender, THEN THE Matchmaking_Engine SHALL ไม่จับคู่ Bartender นั้นกับ Bartender คนอื่น ไม่ว่าจะรอนานเท่าใด
4. THE Matchmaking_Engine SHALL จับคู่ Regular_User กับ Regular_User ได้ตามปกติตามกฎ topic และ role compatibility เดิม โดยไม่ขึ้นกับ Wait_Timeout
5. IF Regular_User รอใน Queue ครบ 7 วินาทีแล้วไม่มี Available_Bartender, THEN THE Matchmaking_Engine SHALL พยายามจับคู่กับ Bartender ทุก Polling_Cycle จนกว่าจะพบ Available_Bartender หรือผู้ใช้ออกจาก Queue เอง
6. WHEN Bartender เข้า Queue, THE Matchmaking_Engine SHALL ตรวจสอบใน Polling_Cycle ถัดไปว่ามี Regular_User ที่รอเกิน 7 วินาทีอยู่หรือไม่ และหากพบให้จับคู่กับ Regular_User ที่รอนานที่สุดก่อน (FIFO ตาม `joined_at`)
7. THE Matchmaking_Engine SHALL จับคู่ Available_Bartender แต่ละคนกับ Regular_User ได้สูงสุดหนึ่งคนต่อหนึ่ง Polling_Cycle เพื่อป้องกัน race condition ที่ Bartender คนเดียวถูกจับคู่พร้อมกันหลายครั้ง

---

### Requirement 3: สถานะ "ว่าง" ของ Bartender

**User Story:** ในฐานะ System ฉันต้องการรู้ว่า Bartender คนไหน "ว่าง" เพื่อจับคู่ได้ถูกต้อง

#### Acceptance Criteria

1. THE System SHALL ถือว่า Bartender เป็น Available_Bartender ก็ต่อเมื่อ Bartender นั้นมี record อยู่ใน `chat_queue` ณ ขณะนั้น **และ** ไม่มี session ที่มีสถานะ `active` ที่ตนเองเป็น `user_a_id` หรือ `user_b_id`
2. THE System SHALL ถือว่า Bartender เป็น Busy_Bartender เมื่อ Bartender นั้นมี session ที่มีสถานะ `active` ที่ตนเองเป็น `user_a_id` หรือ `user_b_id` ไม่ว่าจะอยู่ใน Queue หรือไม่
3. THE System SHALL ถือว่า Bartender เป็น Idle_Bartender เมื่อ Bartender นั้นไม่มี record ใน `chat_queue` และไม่มี session ที่ active — Idle_Bartender ไม่สามารถถูกจับคู่ได้
4. WHEN Bartender ออกจาก Queue (ลบ record ออกจาก `chat_queue`), THE Matchmaking_Engine SHALL ไม่พิจารณา Bartender นั้นเป็น Available_Bartender ใน Polling_Cycle ถัดไป (ภายใน ≤5 วินาที)
5. THE System SHALL ไม่บังคับให้ Bartender ต้องอยู่ใน Queue ตลอดเวลา — Bartender เลือกเองว่าจะเข้า Queue เมื่อใด

---

### Requirement 4: ความเป็นนิรนามในการสนทนา

**User Story:** ในฐานะ Regular_User ฉันต้องการให้ตัวตนจริงของฉันยังคงเป็นความลับแม้จะคุยกับ Bartender เพื่อให้ฉันรู้สึกปลอดภัยในการเปิดใจ

#### Acceptance Criteria

1. WHEN Regular_User ถูกจับคู่กับ Bartender, THE System SHALL แสดงเฉพาะ alias และ avatar สมมติของ Regular_User ให้ Bartender เห็น ไม่ใช่ชื่อจริง Discord username หรือ Discord ID
2. WHEN Bartender ถูกจับคู่กับ Regular_User, THE System SHALL แสดงเฉพาะ alias และ avatar สมมติของ Bartender ให้ Regular_User เห็น ไม่ใช่ชื่อจริง Discord username หรือ Discord ID
3. THE System SHALL ไม่แสดงข้อความ ป้ายกำกับ หรือสัญลักษณ์ใด ๆ ใน UI ของ Regular_User ที่บ่งบอกว่าคู่สนทนาเป็น Bartender ตลอดระยะเวลาของ session
4. THE System SHALL ไม่แสดงข้อความ system message ใด ๆ ใน chat ที่เปิดเผยว่าคู่สนทนาเป็น Bartender เช่น ข้อความที่มีคำว่า "Bartender" หรือ "ทีมงาน"
5. THE System SHALL บันทึก `user_a_role` และ `user_b_role` ใน `chat_sessions` ตามค่า role ที่ผู้ใช้เลือก (talk/listen/both/chill) ไม่ใช่สถานะ Bartender
6. WHERE Admin ต้องการตรวจสอบว่าคู่สนทนาใดเป็น Bartender, THE System SHALL อนุญาตให้ Admin ดูข้อมูลได้ผ่าน Admin Panel โดย join `chat_sessions` กับ `chat_bartenders` เท่านั้น ไม่ใช่ผ่าน UI ของ Regular_User

---

### Requirement 5: หน้าจัดการ Bartender ใน Admin Panel

**User Story:** ในฐานะ Admin ฉันต้องการหน้าจัดการ Bartender ใน Admin Panel เพื่อเพิ่ม ลบ และดูรายชื่อ Bartender ได้สะดวก

#### Acceptance Criteria

1. THE BartenderManagement SHALL แสดงรายชื่อผู้ใช้ทั้งหมดที่มีสถานะ `is_active = true` ใน `chat_bartenders` พร้อม username, Discord ID, และ avatar
2. WHEN Admin พิมพ์คำค้นหาใน search box, THE BartenderManagement SHALL กรองรายชื่อ Bartender ที่แสดงอยู่แบบ real-time โดยจับคู่กับ username หรือ Discord ID ที่มีคำค้นหานั้นอยู่ (case-insensitive)
3. WHEN Admin กดปุ่มเพิ่ม Bartender และเลือกผู้ใช้, THE BartenderManagement SHALL ส่ง upsert request ไปยังฐานข้อมูลก่อน และเมื่อได้รับ response สำเร็จจึงเพิ่มรายชื่อนั้นในการแสดงผล — IF request ล้มเหลว, THEN THE BartenderManagement SHALL คงรายชื่อเดิมไว้และแสดง toast error แจ้ง Admin
4. WHEN Admin กดปุ่มลบ Bartender, THE BartenderManagement SHALL ส่ง update request เพื่อตั้งค่า `is_active = false` ก่อน และเมื่อได้รับ response สำเร็จจึงลบรายชื่อนั้นออกจากการแสดงผล — IF request ล้มเหลว, THEN THE BartenderManagement SHALL คงรายชื่อเดิมไว้และแสดง toast error แจ้ง Admin
5. THE BartenderManagement SHALL แสดงสถานะของ Bartender แต่ละคนว่า "ว่าง" (มี record ใน `chat_queue`) หรือ "ไม่ว่าง" (ไม่มี record ใน `chat_queue`) โดยอัปเดตผ่าน Supabase Realtime subscription บนตาราง `chat_queue`
6. IF ผู้ใช้ที่ไม่มี role เป็น `owner` หรือ `admin` พยายามเข้าถึงหน้า BartenderManagement, THEN THE System SHALL ปฏิเสธการเข้าถึงและแสดงข้อความแจ้งว่าไม่มีสิทธิ์
7. THE BartenderManagement SHALL อยู่ใน Admin Panel ภายใต้กลุ่ม "คาเฟ่ลับ" หรือกลุ่มที่เกี่ยวข้องกับ secret chat ในเมนูด้านซ้าย

---

### Requirement 6: Queue Counter และ UI สำหรับผู้ใช้

**User Story:** ในฐานะ Regular_User ฉันต้องการเห็น queue counter ที่ถูกต้อง เพื่อให้รู้ว่ามีคนรออยู่กี่คน

#### Acceptance Criteria

1. THE System SHALL นับ Bartender ที่อยู่ใน Queue รวมอยู่ใน queue counter ที่แสดงใน `SecretChatMenu` ภายใต้ stale window เดียวกัน (10 นาที) กับ Regular_User โดย counter label ต้องไม่แยกแยะระหว่าง Bartender และ Regular_User
2. WHILE Regular_User กำลังรอใน Queue, THE System SHALL ไม่แสดงข้อความ ป้ายกำกับ หรือสัญลักษณ์ใด ๆ บนหน้าจอรอ (waiting screen) และใน queue counter ที่บ่งบอกว่าคู่สนทนาที่จะได้รับเป็น Bartender หรือ Regular_User
3. WHEN Regular_User ถูกจับคู่กับ Bartender, THE System SHALL แสดง join overlay ก่อนเริ่ม session เสมอ โดย Regular_User ต้องกดปุ่มยืนยันบน overlay ก่อน session timer จึงจะเริ่มนับ และการส่งข้อความจะถูกบล็อกจนกว่าจะกดยืนยัน

---

### Requirement 7: ความปลอดภัยของข้อมูล (Row Level Security)

**User Story:** ในฐานะ System ฉันต้องการให้ข้อมูล Bartender ถูกป้องกันด้วย RLS เพื่อไม่ให้ผู้ใช้ทั่วไปเข้าถึงข้อมูลที่ไม่ควรเห็น

#### Acceptance Criteria

1. THE System SHALL เปิดใช้งาน Row Level Security บนตาราง `chat_bartenders`
2. IF ผู้ใช้ที่มี role เป็น `owner` หรือ `admin` ส่ง SELECT query ไปยัง `chat_bartenders`, THEN THE System SHALL คืนข้อมูลทุก column ของทุก record
3. IF ผู้ใช้ที่มี role เป็น `owner` ส่ง INSERT หรือ UPDATE query ไปยัง `chat_bartenders`, THEN THE System SHALL อนุญาตให้ดำเนินการได้
4. IF ผู้ใช้ที่ไม่มี role เป็น `owner` ส่ง INSERT หรือ UPDATE query ไปยัง `chat_bartenders`, THEN THE System SHALL ปฏิเสธ request และคืน error
5. IF Regular_User ส่ง SELECT query ไปยัง `chat_bartenders`, THEN THE System SHALL ปฏิเสธ request และไม่คืนข้อมูลใด ๆ
6. THE Matchmaking_Engine SHALL อ่านข้อมูล `chat_bartenders` ได้ในฐานะ authenticated user เพื่อตรวจสอบว่าผู้ใช้ใน Queue เป็น Bartender หรือไม่ โดย RLS policy ต้องอนุญาตให้ authenticated user อ่านได้เฉพาะ record ที่มี `is_active = true`
