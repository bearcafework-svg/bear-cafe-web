# Bugfix Requirements Document

## Introduction

เมื่อผู้ใช้ฝ่ายใดฝ่ายหนึ่งยกเลิกแชท (กด "ออกจากห้อง") ระบบจะอัปเดตสถานะ `chat_sessions` เป็น `ended` เฉพาะในฝั่งของตัวเอง แต่ **ไม่ได้ลบ entry ของอีกฝ่ายออกจาก `chat_queue`** และไม่ได้ทำให้อีกฝ่ายรับรู้ว่า session สิ้นสุดแล้วอย่างทันที ส่งผลให้สถานะ session ไม่ sync กันระหว่างสองฝ่าย และผู้ใช้ที่ยังค้างอยู่ใน session เก่าอาจถูกจับคู่ซ้ำหรือติดค้างในคิวเมื่อพยายามหาคู่สนทนาใหม่

จากการวิเคราะห์โค้ดใน `SecretChatRoom.tsx` พบว่า `confirmLeave()` อัปเดต `chat_sessions.status = 'ended'` แต่ไม่ได้ลบ `chat_queue` entry ของทั้งสองฝ่าย และ `match_secret_chat()` ใน `20260520200500_fix_secret_chat_advisory_lock.sql` มีการตรวจสอบ active session ก่อนจับคู่ แต่ถ้า queue entry ยังค้างอยู่ก็อาจเกิด race condition ได้

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ผู้ใช้ฝ่าย A กดยกเลิก/ออกจากแชทขณะที่ session มีสถานะ `active` THEN ระบบอัปเดต `chat_sessions.status = 'ended'` แต่ไม่ลบ `chat_queue` entry ของฝ่าย B ออก ทำให้ฝ่าย B ยังคงปรากฏอยู่ในคิว

1.2 WHEN ฝ่าย B ยังค้างอยู่ใน `chat_queue` หลังจาก session ถูก end โดยฝ่าย A THEN ระบบ matchmaking อาจจับคู่ฝ่าย B กับผู้ใช้คนใหม่ได้ทันที แม้ฝ่าย B ยังอยู่ในหน้า chat room ของ session เก่า

1.3 WHEN ฝ่าย B ได้รับ realtime event ว่า session `ended` และพยายามกลับไปหาคู่สนทนาใหม่ THEN ระบบอาจพบว่า `chat_queue` entry ของฝ่าย B ยังมีอยู่ (stale entry) ทำให้เกิดการ insert ซ้ำหรือ conflict

1.4 WHEN ผู้ใช้ที่ถูกยกเลิกแชทพยายามเข้าคิวใหม่ THEN ระบบอาจตรวจพบ active session เก่าที่ยังไม่ถูก cleanup อย่างสมบูรณ์ ทำให้ถูกบล็อกจากการเข้าคิว

### Expected Behavior (Correct)

2.1 WHEN ผู้ใช้ฝ่าย A กดยกเลิก/ออกจากแชทขณะที่ session มีสถานะ `active` THEN ระบบ SHALL อัปเดต `chat_sessions.status = 'ended'` พร้อมกับลบ `chat_queue` entry ของทั้งฝ่าย A และฝ่าย B ออกจากคิวในการดำเนินการเดียวกัน (atomic)

2.2 WHEN session ถูก end โดยฝ่ายใดฝ่ายหนึ่ง THEN ระบบ SHALL ส่ง realtime event ผ่าน Supabase Realtime ให้ฝ่ายตรงข้ามรับรู้ว่า session สิ้นสุดแล้วภายใน ≤3 วินาที

2.3 WHEN ฝ่าย B ได้รับ realtime event ว่า session `ended` THEN ระบบ SHALL แสดง UI แจ้งว่าคู่สนทนาออกจากห้องแล้ว และ `chat_queue` entry ของฝ่าย B ต้องถูกลบออกก่อนที่ฝ่าย B จะสามารถเข้าคิวใหม่ได้

2.4 WHEN ผู้ใช้ที่ถูกยกเลิกแชทพยายามเข้าคิวใหม่ THEN ระบบ SHALL ไม่พบ stale `chat_queue` entry หรือ active session เก่าที่ขัดขวางการเข้าคิว

### Unchanged Behavior (Regression Prevention)

3.1 WHEN session หมดเวลาตามปกติ (timer ครบ) THEN ระบบ SHALL CONTINUE TO อัปเดต `chat_sessions.status = 'ended'` และแสดง rating dialog ให้ทั้งสองฝ่ายตามเดิม

3.2 WHEN ผู้ใช้ยังอยู่ในคิวรอหาคู่สนทนา (ยังไม่ถูกจับคู่) และกดยกเลิก THEN ระบบ SHALL CONTINUE TO ลบ `chat_queue` entry ของผู้ใช้นั้นออกและนำทางกลับหน้าหลักตามเดิม

3.3 WHEN ผู้ใช้สองคนถูกจับคู่สำเร็จและเริ่ม session ใหม่ THEN ระบบ SHALL CONTINUE TO ลบ `chat_queue` entry ของทั้งสองออกจากคิวตามเดิม (พฤติกรรมนี้ทำงานถูกต้องอยู่แล้วใน `match_secret_chat()`)

3.4 WHEN Bartender ถูกจับคู่กับผู้ใช้และ session สิ้นสุด THEN ระบบ SHALL CONTINUE TO เรียก `release_bartender_session` RPC เพื่อคืนสถานะ Bartender ตามเดิม

3.5 WHEN ผู้ใช้ส่งข้อความในห้องแชทที่มีสถานะ `active` THEN ระบบ SHALL CONTINUE TO บันทึกและแสดงข้อความตามปกติโดยไม่ได้รับผลกระทบจากการแก้ไขนี้
