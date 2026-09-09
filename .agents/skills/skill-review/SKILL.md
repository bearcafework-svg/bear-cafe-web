---
name: skill-review
description: ตรวจสอบคุณภาพ ความปลอดภัย ประสิทธิภาพของโค้ดหน้าเว็บและ Supabase พร้อมประเมินขอบเขตและสั่งตัดจบ (Good Enough) เพื่อป้องกันการแก้เกินความจำเป็น
---

# 🛡️ Web Quality & Scope Auditor (@skill-review)

ใช้ Skill นี้เมื่อเขียนโค้ดเสร็จแล้ว ต้องการให้ออดิตตรวจทานความเรียบร้อย ความปลอดภัย และประสิทธิภาพก่อนนำขึ้น Production หรือ Push ขึ้น Git

---

## 🎯 4 เสาหลักการรีวิว (Review Pillars)

### 1. React & TypeScript Quality
* **Hook Dependencies:** ตรวจสอบว่าใน `useEffect`, `useCallback`, `useMemo` มีการใส่ dependency ครบถ้วน ไม่ทำให้เกิด infinite loop หรือ memory leak
* **Subscription Cleanup:** ถ้ามีการเปิด Supabase Realtime Channel หรือ `addEventListener` ต้องมีฟังก์ชัน cleanup ใน return ของ `useEffect` เสมอ
* **Type Safety:** หลีกเลี่ยงการใช้ `any` และตรวจสอบว่าไม่มีการฝืนบังคับ Type (Type assertion) ที่เสี่ยงต่อการเกิด Runtime crash
* **Import Hygiene:** ตรวจสอบว่าไม่มี Identifier ซ้ำใน import statement (เช่น นำเข้าไอคอนหรือฟังก์ชันซ้ำซ้อน) และไม่มีการลบคอมโพเนนต์/ไอคอนออกจาก import จนทำให้เกิด `ReferenceError` ใน Modal/Dialog ย่อย
* **Batch Integrity:** หากมีการปรับปรุงโค้ดเป็นชุดหลายไฟล์ ต้องยืนยันว่า `npx tsc --noEmit` ผ่านทั้งหมดโดยไม่มี Type หรือ Syntax Error หลงเหลือ

### 2. Supabase Security & Egress Efficiency
* **RLS Policies:** ตรวจสอบว่าตารางที่สร้างขึ้นใหม่มีการเปิด `ENABLE ROW LEVEL SECURITY` และกำหนดเงื่อนไข `SELECT`, `INSERT`, `UPDATE`, `DELETE` ปลอดภัยหรือไม่
* **Egress Prevention:** คำสั่งดึงข้อมูลต้องระบุเฉพาะฟิลด์ที่จำเป็น ไม่ดึงข้อมูลทั้งตาราง และต้องมี pagination / limit
* **Secrets Safety:** ตรวจสอบว่าไม่มี `SUPABASE_SERVICE_ROLE_KEY` หรือ Discord Bot Token หลุดออกมาอยู่ในฝั่ง Client Code (Vite Browser bundle)

### 3. UI/UX & Responsive Consistency
* เช็กความสอดคล้องกับ Bear Cafe Design System (Warm Dark `#12100E`, ขอบโค้งมน, บรรยากาศอบอุ่น)
* ตรวจสอบการจัดวางบนหน้าจอ Mobile และ Desktop ไม่ให้มีส่วนประกอบใดล้นหน้าจอ (Overflow)
* **Touch Device Scrolling:** ตรวจสอบคอมโพเนนต์ Dropdown, Select, Popover และ Modal ว่าสามารถใช้นิ้วปัดเลื่อนบนมือถือและ iPad ได้จริง ไม่ถูก `h-[var(--radix-select-trigger-height)]` หรือ `body[data-scroll-locked]` ล็อกค้าง
* **Thai Natural Language & UX Copy:** ตรวจสอบข้อความภาษาไทย (ปุ่ม, Label, Modal, Notification, Empty State, Error Message) ว่าเป็นภาษาธรรมชาติ กระชับ เข้าใจง่าย ไม่อ่านเหมือนภาษาทางการ/ราชการ และไม่มีคำที่มี "กลิ่น AI" (เช่น ดำเนินการ, ดังกล่าว, ในส่วนของ, ผู้ใช้งาน, ทั้งนี้, เพื่อทำการ)

### 4. Cross-System Compatibility (Discord Bot)
* ตรวจสอบว่า Schema หรือ Endpoint ที่แก้ไขไม่ส่งผลเสียต่อการทำงานของ Discord Bot (`d:\bearcafe-bot`)

---

## 🛑 กฎ "Good Enough" (สั่งตัดจบเพื่อหยุด Over-Engineering)
- หากโค้ดทำงานถูกต้องตามความต้องการ ปลอดภัย และมีประสิทธิภาพเพียงพอแล้ว ให้สั่ง **"✅ Good Enough — โค้ดผ่านเกณฑ์มาตรฐาน พร้อมส่งมอบ"**
- หลีกเลี่ยงการแนะนำให้รื้อโครงสร้างหรือเขียนใหม่เพียงเพื่อความสวยงามทางอุดมคติ ถ้าไม่ส่งผลต่อบั๊กหรือประสิทธิภาพจริง
