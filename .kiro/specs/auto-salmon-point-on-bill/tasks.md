# Implementation Plan: auto-salmon-point-on-bill

## Overview

แผนการ implement feature นี้แบ่งออกเป็น 3 ส่วนหลัก:
1. **Database layer** — migration file เดียวที่ครอบคลุมทุกอย่าง: เพิ่มคอลัมน์ `salmon_point`, สร้างตาราง `salmon_point_logs`, trigger function `fn_sync_salmon_point()`, trigger `trg_sync_salmon_point`, และ RLS policies
2. **UI layer** — แก้ไข `TradingHistoryManagement.tsx` เพื่อเพิ่ม salmon point preview ใต้ช่อง amount และลบปุ่ม "จัดการโดเนท" (ถ้ามี)
3. **Test layer** — property-based tests ด้วย fast-check และ unit tests ด้วย Vitest สำหรับ pure UI logic

Migration timestamp ที่ใช้: `20260602000000` (ต่อจาก `20260601000000`)

---

## Tasks

- [ ] 1. สร้าง SQL migration file สำหรับ salmon_point feature ทั้งหมด
  - สร้างไฟล์ `supabase/migrations/20260602000000_add_salmon_point_feature.sql`
  - เพิ่มคอลัมน์ `salmon_point INTEGER NOT NULL DEFAULT 0 CHECK (salmon_point >= 0)` ใน `user_points` ด้วย `ALTER TABLE`
  - สร้างตาราง `salmon_point_logs` พร้อมคอลัมน์ครบตามที่ design กำหนด: `id` (uuid PK), `discord_id` (text NOT NULL), `bill_id` (uuid NOT NULL), `change_type` (text NOT NULL), `old_salmon_point` (integer), `new_salmon_point` (integer), `delta` (integer), `amount_before` (numeric), `amount_after` (numeric), `created_at` (timestamptz DEFAULT now())
  - สร้าง indexes: `idx_salmon_point_logs_discord_id`, `idx_salmon_point_logs_bill_id`, `idx_salmon_point_logs_created_at`
  - _Requirements: 1.1, 1.2, 2.1_

- [ ] 2. Implement trigger function `fn_sync_salmon_point()` ใน migration
  - [ ] 2.1 เขียน trigger function `fn_sync_salmon_point()` ใน migration file เดียวกัน
    - ใช้ `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
    - Handle `TG_OP = 'INSERT'`: คำนวณ `delta = FLOOR(NEW.amount / 100)`, ตั้ง `change_type = 'insert'`
    - Handle `TG_OP = 'UPDATE'`: early return ถ้า `FLOOR(NEW.amount/100) = FLOOR(OLD.amount/100)`, คำนวณ `delta = FLOOR(NEW.amount/100) - FLOOR(OLD.amount/100)`, ตั้ง `change_type = 'update'`
    - Handle `TG_OP = 'DELETE'`: คำนวณ `delta = -(FLOOR(OLD.amount/100))`, ตั้ง `change_type = 'delete'`
    - Early return ถ้า `delta = 0` (ครอบคลุม NULL amount ด้วย)
    - อ่าน `v_old_sp` จาก `user_points` ด้วย `COALESCE(..., 0)`
    - คำนวณ `v_new_sp = GREATEST(0, v_old_sp + v_delta)`
    - Upsert `user_points` ด้วย `ON CONFLICT (discord_id) DO UPDATE SET salmon_point = v_new_sp`
    - Insert audit log ใน `salmon_point_logs`
    - Return `COALESCE(NEW, OLD)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.2_

  - [ ]* 2.2 เขียน property test สำหรับ Property 1: Insert delta matches formula
    - **Property 1: Insert delta matches formula**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - สร้างไฟล์ `src/lib/__tests__/salmonPoint.property.test.ts`
    - ใช้ fast-check generate `amount` แบบ arbitrary float ในช่วง [0, 100000] และ `discord_id` แบบ arbitrary string
    - ทดสอบ pure helper function `computeSalmonDelta(amount)` ว่าคืนค่า `Math.floor(amount / 100)` เสมอ
    - ทดสอบ `computeNewSalmonPoint(oldSp, delta)` ว่าเพิ่มขึ้นถูกต้อง

  - [ ]* 2.3 เขียน property test สำหรับ Property 2: New user upsert on first bill
    - **Property 2: New user upsert on first bill**
    - **Validates: Requirements 3.3**
    - ทดสอบว่าเมื่อ `oldSp = 0` และ `amount >= 100`, ผลลัพธ์ `newSp = Math.floor(amount / 100)`

  - [ ]* 2.4 เขียน property test สำหรับ Property 3: Update adjusts by delta of FLOOR values
    - **Property 3: Update adjusts by delta of FLOOR values**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate คู่ `(oldAmount, newAmount)` ที่ `Math.floor(oldAmount/100) !== Math.floor(newAmount/100)`
    - ทดสอบว่า `computeNewSalmonPoint(oldSp, Math.floor(newAmount/100) - Math.floor(oldAmount/100))` ตรงกับ `Math.max(0, oldSp + delta)`

  - [ ]* 2.5 เขียน property test สำหรับ Property 4: Delete is the inverse of insert (round-trip)
    - **Property 4: Delete is the inverse of insert (round-trip)**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Generate `amount` และ `initialSp`
    - ทดสอบว่า insert แล้ว delete กลับมาที่ `initialSp` (หรือ 0 ถ้า initialSp < 0 ซึ่งไม่ควรเกิด)

  - [ ]* 2.6 เขียน property test สำหรับ Property 5: Non-negative invariant across all operation sequences
    - **Property 5: Non-negative invariant across all operation sequences**
    - **Validates: Requirements 6.2, 6.3**
    - Generate sequence ของ operations (insert/update/delete) 1–20 รายการ
    - ทดสอบว่า `salmon_point >= 0` หลังทุก operation โดยใช้ pure simulation function

- [ ] 3. สร้าง trigger และ RLS policies ใน migration
  - สร้าง trigger `trg_sync_salmon_point` บน `trading_history` ด้วย `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW EXECUTE FUNCTION fn_sync_salmon_point()`
  - เปิด RLS บน `salmon_point_logs` ด้วย `ALTER TABLE salmon_point_logs ENABLE ROW LEVEL SECURITY`
  - สร้าง policy `"Admins can read salmon_point_logs"` สำหรับ SELECT โดย authenticated users ที่มี `jwt_has_page_access('users')`
  - สร้าง policy `"Service role full access"` สำหรับ ALL operations โดย `service_role`
  - ไม่สร้าง INSERT policy สำหรับ authenticated role (trigger เขียนผ่าน SECURITY DEFINER เท่านั้น)
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 4. Checkpoint — ตรวจสอบ migration file ก่อน apply
  - ตรวจสอบว่า migration file มีครบทุก statement: ALTER TABLE, CREATE TABLE, CREATE INDEX (3 indexes), CREATE OR REPLACE FUNCTION, CREATE TRIGGER, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY (2 policies)
  - ตรวจสอบ syntax ด้วยการ review SQL อย่างละเอียด
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. สร้าง pure TypeScript helper สำหรับ salmon point logic
  - [ ] 5.1 สร้างไฟล์ `src/lib/salmonPoint.ts` ที่ export pure functions
    - `computeSalmonDelta(amount: number | null): number` — คืน `Math.floor((amount ?? 0) / 100)` หรือ 0 ถ้า amount เป็น null/undefined
    - `computeNewSalmonPoint(currentSp: number, delta: number): number` — คืน `Math.max(0, currentSp + delta)`
    - `computeSalmonPreview(amountStr: string): number | null` — parse string, คืน `null` ถ้า empty/NaN/negative, คืน `Math.floor(parsed / 100)` ถ้า valid
    - _Requirements: 3.1, 4.2, 4.3, 5.2, 5.3, 6.2, 8.1, 8.2, 8.3_

  - [ ]* 5.2 เขียน unit tests สำหรับ `salmonPoint.ts`
    - ทดสอบ `computeSalmonDelta`: amount = 0, 99, 100, 150, 200, null
    - ทดสอบ `computeNewSalmonPoint`: delta บวก, ลบ, ผลลัพธ์ติดลบ (ต้อง clamp เป็น 0)
    - ทดสอบ `computeSalmonPreview`: empty string, "abc", "-50", "0", "99", "100", "250.5"
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 5.3 เขียน property test สำหรับ Property 7: Salmon point preview matches formula
    - **Property 7: Salmon point preview matches formula**
    - **Validates: Requirements 8.1, 8.2**
    - Generate random floats ใน [0, 1000000]
    - ทดสอบว่า `computeSalmonPreview(String(amount))` ตรงกับ `Math.floor(amount / 100)` เสมอ

- [ ] 6. แก้ไข `TradingHistoryManagement.tsx` — เพิ่ม salmon point preview
  - [ ] 6.1 Import `computeSalmonPreview` จาก `@/lib/salmonPoint` และเพิ่ม `useMemo` สำหรับ `salmonPointPreview`
    - เพิ่ม `salmonPointPreview` computed value โดยใช้ `useMemo` ที่ depend on `newBill.amount`
    - ใช้ `computeSalmonPreview(newBill.amount)` จาก helper ที่สร้างใน task 5.1
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 6.2 เพิ่ม salmon point preview UI ใต้ amount input ใน create-bill dialog
    - เพิ่ม JSX element ใต้ `<Input type="number" id="amount" .../>` ใน create-bill dialog
    - แสดง `🐟 Salmon Point ที่จะได้รับ: {salmonPointPreview} แต้ม` เมื่อ `salmonPointPreview !== null`
    - ใช้ class `text-xs text-muted-foreground mt-1` สำหรับ paragraph และ `font-semibold text-foreground` สำหรับตัวเลข
    - ไม่แสดงอะไรเมื่อ `salmonPointPreview === null`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 6.3 ลบปุ่ม "จัดการโดเนท" หรือ manual salmon_point management control ออกจาก UI (ถ้ามี)
    - ค้นหาและลบ button หรือ control ใดๆ ที่เกี่ยวกับการจัดการ salmon_point แบบ manual
    - ตรวจสอบว่าไม่มี UI element ที่ให้ admin trigger salmon_point calculation เองอีกต่อไป
    - _Requirements: 7.1, 7.2_

- [ ] 7. ตั้งค่า Vitest และ fast-check สำหรับ project
  - [ ] 7.1 ติดตั้ง vitest และ fast-check เป็น devDependencies
    - เพิ่ม `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, และ `fast-check` ใน `package.json` devDependencies
    - สร้างหรือแก้ไข `vite.config.ts` เพื่อเพิ่ม `test` configuration: `{ globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`
    - สร้างไฟล์ `src/test/setup.ts` สำหรับ import `@testing-library/jest-dom`
    - เพิ่ม script `"test": "vitest --run"` และ `"test:watch": "vitest"` ใน `package.json`
    - _Requirements: (infrastructure สำหรับ testing tasks ทั้งหมด)_

  - [ ]* 7.2 เขียน property test สำหรับ Property 6: Audit log written for every non-zero delta
    - **Property 6: Audit log written for every non-zero delta**
    - **Validates: Requirements 2.2, 3.4, 4.4, 5.4**
    - ทดสอบ pure simulation: สร้าง mock state ที่ track `salmon_point_logs` entries
    - Generate operations ที่มี non-zero delta และตรวจสอบว่า log entry ถูกสร้างพร้อม fields ที่ถูกต้อง
    - Generate operations ที่มี zero delta และตรวจสอบว่าไม่มี log entry ถูกสร้าง

- [ ] 8. Final checkpoint — รัน tests และตรวจสอบความครบถ้วน
  - รัน `npm run test` เพื่อตรวจสอบว่า unit tests และ property tests ผ่านทั้งหมด
  - ตรวจสอบว่า `salmonPointPreview` แสดงผลถูกต้องใน create-bill dialog
  - ตรวจสอบว่าไม่มีปุ่ม "จัดการโดเนท" ใน UI
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks ที่มี `*` เป็น optional และสามารถข้ามได้สำหรับ MVP ที่เร็วขึ้น
- Migration file เดียว (`20260602000000_add_salmon_point_feature.sql`) ครอบคลุมทุก DB changes เพื่อให้ apply ได้ครั้งเดียว
- `fn_sync_salmon_point()` ใช้ `SECURITY DEFINER` ทำให้ trigger เขียนไปยัง `user_points` และ `salmon_point_logs` ได้โดยไม่ต้องให้ authenticated user มีสิทธิ์ INSERT โดยตรง
- Property tests ใน tasks 2.2–2.6 และ 5.3, 7.2 ทดสอบ pure TypeScript logic ไม่ต้องการ DB connection จริง
- `computeSalmonPreview` ใน `src/lib/salmonPoint.ts` เป็น pure function ที่ UI ใช้ — ไม่มี API call
- ตรวจสอบว่า `jwt_has_page_access` function มีอยู่แล้วใน project ก่อนสร้าง RLS policy (ดูจาก migration เก่า)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "7.1"] },
    { "id": 1, "tasks": ["2.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "5.2", "5.3"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["6.1", "7.2"] },
    { "id": 5, "tasks": ["6.2", "6.3"] }
  ]
}
```
