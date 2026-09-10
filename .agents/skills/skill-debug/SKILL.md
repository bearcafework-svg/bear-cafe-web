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
   - **Radix UI Select / Popover Mobile & iPad Touch Scroll Freeze:**
      - **อาการ:** บน PC ใช้ Mouse Wheel เลื่อนดูตัวเลือกใน Dropdown/Select ได้ตามปกติ แต่บนโทรศัพท์มือถือและ iPad ปัดเลื่อนไม่ไป (Freeze ค้างแข็ง 100%)
      - **ต้นตอ 1 (Viewport Height Locking):** `SelectPrimitive.Viewport` ใส่คลาส `h-[var(--radix-select-trigger-height)]` ทำให้ความสูงกล่อง Viewport ถูกจำกัดไว้เพียง 36px/40px เมื่อผู้ใช้ทัชลากเนื้อหาแถวล่าง `react-remove-scroll` จะมองว่าแตะนอกพื้นที่เลื่อนและเรียก `event.preventDefault()`
      - **ต้นตอ 2 (Nested Overlays & Portal Trap):** เมื่อ `RichSelect`, `Popover` หรือ `Select` เปิดขึ้นมา (โดยเฉพาะเมื่อเปิดใน `Dialog`):
        1. เนื้อหาจะถูก Portal ออกไปที่ `document.body` ซึ่งอยู่นอก DOM Hierarchy ของ Dialog
        2. Dialog จะสั่ง `document.body.style.pointerEvents = "none"` และสั่ง `react-remove-scroll` ดักฟัง `touchmove` บนระดับ `document` (Bubbling phase) พร้อมสั่ง `event.preventDefault()` สำหรับทุก Touch ที่ไม่ได้อยู่บน `DialogContent`
        3. การผูก Listener ภายใน React Component ผ่าน `useEffect([open])` มักจะ Miss (ไม่ทำงาน) เนื่องจาก Radix Portal และ Presence เมานต์แบบ Asynchronous ทำให้ `ref.current` ยังคงเป็น `null` ในจังหวะที่ Effect ทำงาน
      - **การแก้ไขที่เป็นมาตรฐานสากล (Global Body Interceptor Architecture):** 
        1. **Global Body Bubbling Interceptor:** ใน `src/lib/touch-scroll-lock-fix.ts` ลงทะเบียน `document.body.addEventListener('touchmove', ..., { passive: false })` โดยตรงในระดับ Global ซึ่งจะทำงานก่อน `document` ในลำดับ Bubbling phase เสมอ และเรียก `e.stopPropagation()` ทันทีที่ Target อยู่ภายใน `[data-radix-popper-content-wrapper]`, `[data-radix-select-viewport]`, `[role="listbox"]`, `[role="menu"]`, `[role="dialog"]`
        2. **Override Pointer Events:** ใส่ `pointer-events: auto !important` ใน `index.css` ให้กับ `[data-radix-popper-content-wrapper]` และลูกๆ ทุกตัว เพื่อไม่ให้ติดผลข้างเคียงจาก `pointer-events: none` ของ Dialog
        3. **Viewport Height & Momentum:** ปลด `h-[var(--radix-select-trigger-height)]` ออกจาก `SelectContent` และแทนที่ด้วย `min-h-0 w-full max-h-[var(--radix-select-content-available-height,22rem)] overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]`
   - Infinite re-render loop (จาก `useEffect` ที่ dependency array ไม่ถูกต้อง)
   - State mismatch / Stale closure
   - Hydration หรือ Component mounting issue
2. **Supabase & API Issues:**
   - Error `401 Unauthorized` / `403 Forbidden` (เกิดจากสิทธิ์ RLS หรือ Token หมดอายุ)
   - **RLS Policy Write Block (`new row violates row-level security policy for table 'X'`):**
     - **อาการ:** ผู้ใช้กดเพิ่ม/แก้ไข/ลบข้อมูลแล้ว Supabase ฟ้อง error ว่าละเมิด RLS
     - **ต้นตอ:** ตารางใน Supabase เปิด RLS ไว้ แต่มีเพียง Policy `FOR SELECT` หรือไม่มี Policy สำหรับ `FOR ALL` / `FOR INSERT` / `FOR UPDATE` / `FOR DELETE` ทำให้ PostgREST ปฏิเสธการเขียนข้อมูล
     - **วิธีแก้:** เพิ่ม Migration ใส่ Policy `FOR ALL TO authenticated` ให้กับผู้ใช้ที่มีสิทธิ์ โดยครอบคลุมทั้ง Owner, Admin, และผู้ได้รับสิทธิ์หน้า (`public.is_owner() OR public.has_page_access('...') OR EXISTS (SELECT 1 FROM profiles WHERE role IN ('owner', 'admin'))`)
   - Error `PGRSTxxx` (PostgREST syntax หรือเรียกชื่อคอลัมน์ผิด)
   - Edge Function `500 Internal Server Error` หรือปัญหา CORS Headers
3. **Cross-System Mismatch:**
   - โครงสร้างข้อมูลที่ส่งไปไม่ตรงกับที่ Discord Bot หรือ Webhook ปลายทางต้องการ

### ขั้นตอนที่ 3: ตรวจสอบและดำเนินการแก้ไข (Execute Minimal Patch)
- **สแกนโค้ดอย่างรอบคอบ:** ระวัง Search regex บน Windows ที่อาจมองข้าม JSX หลายบรรทัด หรือ line endings แบบ CRLF (`\r\n`)
- **แก้ไขเฉพาะจุด:** แก้ไขเฉพาะบรรทัดที่เป็นต้นตอ พร้อมใส่ Fallback หรือ Error Handling ที่เหมาะสม
- **ตรวจสอบผลกระทบวงกว้าง (Multi-page Sanity Check):** หากผู้ใช้ถามว่า "มีหน้าอื่นด้วยมั้ย" หรือมีการ refactor ชุดใหญ่ ให้รัน Automated Mount Test หรือสแกนตรวจทุกหน้าที่เกี่ยวข้อง (ต้อง Wrap Context ที่จำเป็น เช่น `AuthProvider`, `BrowserRouter`) เพื่อยืนยันว่าทุกหน้าเปิดได้จริง 100%
- **ทดสอบ Build:** รัน `npx tsc --noEmit` และ `npm run build` ตรวจสอบความถูกต้องก่อนส่งมอบงาน
