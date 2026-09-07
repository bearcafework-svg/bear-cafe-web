---
name: skill-debug
description: วินิจฉัยและแก้ไขปัญหาบั๊กหน้าเว็บ (React Lifecycle, Infinite Re-renders, Supabase RLS 401/403, Edge Functions, Network Error) อย่างตรงจุด ปลอดภัย และแม่นยำ
---

# 🔍 Web Debugging & Bugfixing (@skill-debug)

ใช้ Skill นี้เมื่อหน้าเว็บพบปัญหา บั๊ก พฤติกรรมการทำงานไม่ตรงตามที่คาดหวัง หรือมี Error ใน Browser Console, Supabase หรือ Edge Functions

---

## 🎯 กฎเหล็กประจำ Skill (Core Rules)
1. **หาสาเหตุรากเหง้า (Root Cause) ให้เจอก่อนแก้โค้ด** — ห้ามแก้แบบเดาสุ่ม (Trial and Error)
2. **แก้ไขเฉพาะจุดอย่างรัดกุม (Minimal Safe Patch)** — แก้ไขเฉพาะบรรทัดที่เป็นต้นตอ ไม่รื้อโค้ดทั้งหน้าหรือทำการ Refactor ครั้งใหญ่โดยไม่จำเป็น
3. **ตรวจสอบทั้งฝั่ง Client และ Database:**
   - ถ้าข้อมูลไม่ขึ้น ให้เช็กทั้ง State ฝั่ง React และสิทธิ์ RLS หรือ Response จาก Supabase
4. **ตรวจ Regression เสมอ** — เมื่อแก้จุดใดจุดหนึ่ง ต้องมั่นใจว่าจะไม่ไปส่งผลกระทบต่อฟีเจอร์ข้างเคียงหรือทำให้ TypeScript Build พัง

---

## 🧭 ลำดับขั้นตอนการวินิจฉัย (Diagnostic Process)

### ขั้นตอนที่ 1: วิเคราะห์อาการ (Identify Expected vs Actual)
* **พฤติกรรมที่คาดหวัง (Expected):** สิ่งที่ควรเกิดขึ้นเมื่อผู้ใช้กระทำสิ่งใดสิ่งหนึ่ง
* **พฤติกรรมที่เกิดขึ้นจริง (Actual):** ข้อความ Error, อาการค้าง, โหลดไม่เสร็จ, หรือค่าที่แสดงผลผิดพลาด

### ขั้นตอนที่ 2: จำแนกประเภทของปัญหา (Classification)
1. **React / Frontend Issues:**
   - **Syntax & Reference Errors:** เช่น `Identifier 'X' has already been declared` (Import ซ้ำ) หรือ `ReferenceError: X is not defined` (ลบ Import ทิ้งโดยที่คอมโพเนนต์อื่น/Dialog ในไฟล์ยังเรียกใช้อยู่)
   - **Missing React Hooks in Import:** `ReferenceError: useMemo is not defined` หรือ `useCallback is not defined` — เกิดจากการเรียกใช้ Hook โดยลืมใส่ชื่อ Hook ใน `{ useState, useEffect, ... } from 'react'` ที่ต้นไฟล์ (TypeScript อาจปล่อยผ่านจาก ambient types ทำให้ compile ไม่ฟ้อง แต่ runtime จะแครชทันทีที่ mount คอมโพเนนต์)
   - Infinite re-render loop (จาก `useEffect` ที่ dependency array ไม่ถูกต้อง)
   - State mismatch / Stale closure
   - Hydration หรือ Component mounting issue
2. **Supabase & API Issues:**
   - Error `401 Unauthorized` / `403 Forbidden` (เกิดจากสิทธิ์ RLS หรือ Token หมดอายุ)
   - Error `PGRSTxxx` (PostgREST syntax หรือเรียกชื่อคอลัมน์ผิด)
   - Edge Function `500 Internal Server Error` หรือปัญหา CORS Headers
3. **Cross-System Mismatch:**
   - โครงสร้างข้อมูลที่ส่งไปไม่ตรงกับที่ Discord Bot หรือ Webhook ปลายทางต้องการ

### ขั้นตอนที่ 3: ตรวจสอบและดำเนินการแก้ไข (Execute Minimal Patch)
- **สแกนโค้ดอย่างรอบคอบ:** ระวัง Search regex บน Windows ที่อาจมองข้าม JSX หลายบรรทัด หรือ line endings แบบ CRLF (`\r\n`)
- **แก้ไขเฉพาะจุด:** แก้ไขเฉพาะบรรทัดที่เป็นต้นตอ พร้อมใส่ Fallback หรือ Error Handling ที่เหมาะสม
- **ตรวจสอบผลกระทบวงกว้าง (Multi-page Sanity Check):** หากผู้ใช้ถามว่า "มีหน้าอื่นด้วยมั้ย" หรือมีการ refactor ชุดใหญ่ ให้รัน Automated Mount Test หรือสแกนตรวจทุกหน้าที่เกี่ยวข้อง (ต้อง Wrap Context ที่จำเป็น เช่น `AuthProvider`, `BrowserRouter`) เพื่อยืนยันว่าทุกหน้าเปิดได้จริง 100%
- **ทดสอบ Build:** รัน `npx tsc --noEmit` และ `npm run build` ตรวจสอบความถูกต้องก่อนส่งมอบงาน
