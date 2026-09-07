---
name: skill-plan
description: วางแผน ออกแบบสถาปัตยกรรม และวิเคราะห์ทางเลือกสำหรับระบบ Web Dashboard (React, Tailwind, Vite, Supabase, Edge Functions) พร้อมตรวจสอบผลกระทบข้ามระบบกับ Discord Bot
---

# 🗺️ Web Implementation Planning (@skill-plan)

ใช้ Skill นี้เมื่อต้องการเริ่มฟีเจอร์ใหม่ ปรับปรุงโครงสร้างหน้าเว็บ หรือเชื่อมต่อระบบฐานข้อมูล/API เพื่อวิเคราะห์ความต้องการ สำรวจโค้ด และวางแผนสถาปัตยกรรมอย่างแม่นยำก่อนลงมือเขียนโค้ดจริง

---

## 🎯 กฎเหล็กประจำ Skill (Core Rules)
1. **ห้ามแตะต้องโค้ดจริงขณะวางแผน** — อยู่ในโหมดสำรวจ วิเคราะห์ และจัดทำแผนเท่านั้น
2. **ค้นหาหลักฐานจากโค้ดจริงก่อนเสมอ** — ไม่สมมุติตาราง ฐานข้อมูล คอลัมน์ หรือฟังก์ชันขึ้นมาเองโดยไม่มีหลักฐาน
3. **ต่อยอดจากสิ่งที่มีอยู่ (Reuse & Extend)** — ใช้งาน Hook, Component, Context, Supabase Client และ Tailwind Token เดิมที่มีใน `src/` แทนการเขียนซ้ำซ้อน
4. **ตรวจสอบผลกระทบข้ามระบบ (Cross-System Blast Radius)** — ถ้าฟีเจอร์แตะต้อง Schema, Supabase Migrations, Edge Functions หรือ Discord IDs ต้องตรวจสอบความเข้ากันได้กับโปรเจกต์บอท (`d:\bearcafe-bot`) เสมอ
5. **ทำ Trade-Off Matrix ชัดเจน** — เมื่อมีทางเลือกทางเทคนิค (เช่น Client Query vs RPC/Edge Function, React State vs URL Query Param) ต้องเปรียบเทียบข้อดี-ข้อเสียให้ชัดเจน

---

## 🧭 ลำดับขั้นตอนการวางแผน (Planning Workflow)

### ขั้นตอนที่ 1: ตั้งสมมุติฐานและประเมินความเสี่ยง (Hypothesis & Risk Analysis)
* **Auth & Permission:** หน้านี้ต้องล็อกอิน Discord ผ่าน `useAuth()` หรือไม่? ต้องเช็กสิทธิ์ Admin หรือ Role เฉพาะหรือไม่?
* **Supabase Egress & Quota:** การดึงข้อมูลมีการ Pagination / Limit หรือไม่? มีความเสี่ยงที่จะ Query ซ้ำซ้อนจนโควตาหมดหรือไม่?
* **Data Flow & State:** ข้อมูลชุดนี้ควรเก็บใน Local State, React Context หรือดึงสดผ่าน Supabase Realtime?
* **Edge Cases:** ถ้า User อินเทอร์เน็ตหลุด, โหลดช้า, ไม่มีข้อมูล (Empty State) หรือ Supabase คืน Error UI จะแสดงผลอย่างไร?

### ขั้นตอนที่ 2: สำรวจโครงสร้างโค้ดที่เกี่ยวข้อง (Codebase Inspection)
สำรวจไฟล์สำคัญใน `d:\bear-cafe-web`:
* `src/components/`: ดู Component ที่มีอยู่เดิมเพื่อการนำกลับมาใช้ใหม่
* `src/lib/auth-context.tsx` & `src/lib/supabase.ts`: ดูวิธีการจัดการ Authentication และ Supabase client
* `supabase/migrations/`: สำรวจตาราง, RLS Policies, Indexes
* `supabase/functions/`: สำรวจ Edge Functions เดิม (เช่น การส่ง Webhook ไป Discord)
* *(ถ้ามีผลกระทบ)* `d:\bearcafe-bot`: ตรวจสอบชื่อคอลัมน์, Event และ Handler ที่แชร์ข้อมูลกัน

### ขั้นตอนที่ 3: จัดทำแผนผังไฟล์ที่จะแก้ไข (Change Surface)
แบ่งหมวดหมู่ไฟล์ให้ชัดเจน:
* `[NEW]` ไฟล์ Component, Hook หรือ Edge Function ใหม่
* `[MODIFY]` ไฟล์เดิมที่จะปรับปรุง (ระบุฟังก์ชันหรือจุดที่ต้องแก้)
* `[DELETE]` ไฟล์ที่ไม่จำเป็นต้องใช้แล้ว

### ขั้นตอนที่ 4: วางแผนการทดสอบและตรวจสอบ (Verification Plan)
* แผนการตรวจสอบทางเทคนิค เช่น `npm run build` หรือ `npm run typecheck`
* แผนการทดสอบหน้าบ้าน (UI / Interaction / Form validation)
* แผนการทดสอบความเข้ากันได้กับบอท (Data consistency)
