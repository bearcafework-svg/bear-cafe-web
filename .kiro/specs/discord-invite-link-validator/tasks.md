# Implementation Plan: Discord Invite Link Validator

## Overview

แผนการ implement ฟีเจอร์ Discord Invite Link Validator โดยแบ่งเป็น 5 ส่วนหลัก:
1. DB migration เพิ่มคอลัมน์ `invite_status` และ `invite_last_checked_at`
2. Edge Function `validate-invite-link` (Deno/TypeScript) พร้อม helper functions และ property-based tests
3. Frontend: อัปเดต `DiscordServersPage.tsx` ให้กรอง expired servers และ fetch owner-specific expired section
4. React components ใหม่: `ExpiredServerCard` และ `EditLinkDialog`
5. Unit tests และ integration tests สำหรับ frontend

## Tasks

- [x] 1. สร้าง DB migration เพิ่มคอลัมน์ invite_status
  - [x] 1.1 สร้างไฟล์ migration `supabase/migrations/20260601000000_add_invite_status_columns.sql`
    - เพิ่มคอลัมน์ `invite_status text NOT NULL DEFAULT 'unknown'` พร้อม CHECK constraint `('valid', 'expired', 'unknown')`
    - เพิ่มคอลัมน์ `invite_last_checked_at timestamptz DEFAULT NULL`
    - Backfill `invite_status = 'unknown'` สำหรับ rows ที่มีอยู่แล้ว
    - สร้าง index `idx_discord_servers_invite_status` บน `(invite_status, bumped_at DESC) WHERE status = 'approved'`
    - สร้าง index `idx_discord_servers_needs_validation` บน `(invite_last_checked_at NULLS FIRST) WHERE status = 'approved' AND invite_status != 'expired'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. สร้าง Edge Function `validate-invite-link` — helper functions และ core logic
  - [x] 2.1 สร้างไฟล์ `supabase/functions/validate-invite-link/index.ts` พร้อม helper functions
    - Implement `extractInviteCode(input: string): string | null` รองรับ `discord.gg/{code}`, `discord.com/invite/{code}`, `discordapp.com/invite/{code}`, และ bare code
    - Implement `isValidInviteCodeFormat(code: string): boolean` ตรวจสอบ pattern `^[a-zA-Z0-9-]{2,32}$`
    - Implement `isServiceRole(authHeader: string, serviceKey: string): boolean`
    - Implement `resolveInvite(code: string): Promise<{ ok: boolean; status: number; guildId?: string }>` พร้อม 5s timeout
    - Export helper functions เพื่อให้ test ได้
    - _Requirements: 3.1, 6.1, 7.1, 7.5_

  - [ ]* 2.2 เขียน property test สำหรับ invite code extraction (Property 1)
    - **Property 1: Invite Code Extraction is Format-Invariant**
    - **Validates: Requirements 7.1**
    - ใช้ `fc.stringMatching(/^[a-zA-Z0-9-]{2,32}$/)` generate valid codes
    - ยืนยันว่า `extractInviteCode` ให้ผลเหมือนกันสำหรับทุก URL format และ bare code

  - [ ]* 2.3 เขียน property test สำหรับ canonical URL round-trip (Property 2)
    - **Property 2: Invite Code Round-Trip via Canonical URL**
    - **Validates: Requirements 7.1, 7.2**
    - ใช้ generator เดียวกับ Property 1
    - ยืนยันว่า extract → construct canonical URL → extract อีกครั้ง ได้ code เดิม

  - [ ]* 2.4 เขียน property test สำหรับ invalid format rejection (Property 3)
    - **Property 3: Invalid Code Format is Always Rejected Without Calling Discord API**
    - **Validates: Requirements 6.9, 7.5**
    - ใช้ `fc.string()` filtered ให้ไม่ match `^[a-zA-Z0-9-]{2,32}$`
    - ยืนยันว่า `extractInviteCode` คืน `null` และ `isValidInviteCodeFormat` คืน `false`

  - [x] 2.5 Implement action `validate` ใน Edge Function
    - รับ `{ action: "validate", server_id: string }` จาก request body
    - ตรวจสอบ auth token (401 ถ้าไม่มี), ตรวจสอบ owner หรือ service-role (403 ถ้าไม่ใช่)
    - Lookup `invite_url` จาก DB (404 ถ้าไม่พบ, 422 ถ้า invite_url เป็น null/empty)
    - เรียก `resolveInvite()` และ map ผลลัพธ์: 200→valid, 404/400→expired, 429→HTTP 429, 5xx/timeout→HTTP 503
    - อัปเดต `invite_status` และ `invite_last_checked_at` ใน DB เฉพาะกรณี 200 หรือ 404/400
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.6 Implement action `update-link` ใน Edge Function
    - รับ `{ action: "update-link", server_id: string, new_invite_url: string }` จาก request body
    - ตรวจสอบ auth (401), ตรวจสอบ owner (403), ตรวจสอบ URL format (400 ถ้า invalid)
    - เรียก `resolveInvite()` กับ new invite code
    - เปรียบเทียบ Guild ID ที่ได้กับ `discord_servers.discord_id`: ตรงกัน→อัปเดต DB, ไม่ตรง→HTTP 422
    - อัปเดต `invite_url`, `invite_status = 'valid'`, `invite_last_checked_at` เมื่อ Guild ID ตรง
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 2.7 เขียน property test สำหรับ Guild ID matching (Property 6)
    - **Property 6: Guild ID Matching Correctly Determines Update Outcome**
    - **Validates: Requirements 6.2, 6.3, 7.3, 7.4**
    - ใช้ `fc.record({ storedGuildId: fc.string(), resolvedGuildId: fc.string(), code: fc.stringMatching(/^[a-zA-Z0-9-]{2,32}$/) })` พร้อม mock Discord API
    - ยืนยัน: `storedGuildId === resolvedGuildId` → success + `invite_status = 'valid'`; ไม่ตรง → HTTP 422 + DB ไม่เปลี่ยน

  - [x] 2.8 Implement action `batch` ใน Edge Function
    - รับ `{ action: "batch", server_ids?: string[] }` — service-role only (403 ถ้าไม่ใช่)
    - Auto-select สูงสุด 50 servers ที่ `invite_status = 'unknown'` หรือ `invite_last_checked_at` เก่ากว่า 24 ชั่วโมง ถ้าไม่ระบุ `server_ids`
    - Process แต่ละ server ตามลำดับ: skip ถ้าไม่พบหรือ invite_url เป็น null, อัปเดต DB ก่อนไปต่อ
    - หยุดทันทีเมื่อได้รับ HTTP 429 และคืน partial result พร้อม `unprocessed` list
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 2.9 เขียน property test สำหรับ batch staleness filter (Property 7)
    - **Property 7: Batch Validation Processes Only Stale or Unchecked Servers**
    - **Validates: Requirements 8.2**
    - ใช้ `fc.array(fc.record({ invite_status: fc.constantFrom('valid', 'expired', 'unknown'), invite_last_checked_at: fc.option(fc.date()) }))` generate server collections
    - ยืนยันว่า batch เลือก process เฉพาะ servers ที่ `invite_status = 'unknown'` หรือ `invite_last_checked_at` เก่ากว่า 24 ชั่วโมง

- [x] 3. Checkpoint — ตรวจสอบ Edge Function
  - Ensure all Edge Function tests pass, ask the user if questions arise.

- [ ] 4. อัปเดต `DiscordServersPage.tsx` — interface, queries, และ state
  - [ ] 4.1 อัปเดต `DiscordServer` interface และ `fetchData()` ใน `src/pages/DiscordServersPage.tsx`
    - เพิ่ม `invite_status: "valid" | "expired" | "unknown"` และ `invite_last_checked_at: string | null` ใน interface
    - อัปเดต public query ใน `fetchData()` ให้เพิ่ม `.neq("invite_status", "expired")` เพื่อกรอง expired ออก
    - เพิ่ม owner expired query แยกต่างหาก: fetch servers ที่ `status = 'approved'`, `invite_status = 'expired'`, `owner_id = user.discord_id` เฉพาะเมื่อ `isAuthenticated`
    - เพิ่ม state: `ownerExpiredServers`, `editLinkServer`, `isEditLinkOpen`, `newInviteUrl`, `isUpdatingLink`
    - อัปเดต `FeaturedCarousel` ให้ filter ออก servers ที่ `invite_status = 'expired'` ก่อน render
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2_

  - [ ]* 4.2 เขียน unit tests สำหรับ fetchData query filtering
    - ทดสอบว่า public listing ไม่มี server ที่ `invite_status = 'expired'`
    - ทดสอบว่า owner expired query คืนเฉพาะ servers ของ owner ที่ expired
    - ทดสอบว่า `FeaturedCarousel` ไม่รับ expired servers
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2_

- [ ] 5. สร้าง component `ExpiredServerCard`
  - [~] 5.1 สร้างไฟล์ `src/components/discord/ExpiredServerCard.tsx`
    - รับ props `{ server: DiscordServer; onEditLink: (server: DiscordServer) => void }`
    - แสดง warning badge "ลิงก์หมดอายุ" พร้อม `AlertTriangle` icon (สีส้ม/แดง)
    - แสดงข้อมูลเซิร์ฟเวอร์ (icon, ชื่อ, description) แบบ dimmed/muted
    - แสดงปุ่ม "แก้ไขลิงก์" เป็น primary action
    - ใช้ design system เดียวกับ `ServerCard` (Card, CardContent, Badge จาก shadcn/ui)
    - _Requirements: 4.3, 5.1, 5.2_

  - [ ]* 5.2 เขียน unit tests สำหรับ `ExpiredServerCard`
    - ทดสอบว่า render warning badge "ลิงก์หมดอายุ" และ `AlertTriangle` icon
    - ทดสอบว่าปุ่ม "แก้ไขลิงก์" แสดงและ call `onEditLink` เมื่อ click
    - ทดสอบว่าข้อมูลเซิร์ฟเวอร์ (ชื่อ, description) แสดงถูกต้อง
    - _Requirements: 4.3, 5.1, 5.2_

- [ ] 6. สร้าง component `EditLinkDialog`
  - [~] 6.1 สร้างไฟล์ `src/components/discord/EditLinkDialog.tsx`
    - รับ props `{ server: DiscordServer | null; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (serverId: string) => void }`
    - เมื่อ dialog เปิด: query Supabase DB เพื่อ re-check `invite_status` ก่อน
    - ถ้า re-check คืน status ไม่ใช่ `expired`: ปิด dialog + แสดง toast "ลิงก์ใช้งานได้แล้ว"
    - ถ้า re-check network error: ปิด dialog + แสดง toast error "ไม่สามารถตรวจสอบสถานะได้"
    - ถ้า status ยังเป็น `expired`: แสดง input field สำหรับกรอก invite link ใหม่
    - Submit → เรียก `validate-invite-link` action `update-link` พร้อม `server_id` และ `new_invite_url`
    - Map error responses: 422→"ลิงก์นี้ไม่ใช่ของเซิร์ฟเวอร์เดิม", 400→"ลิงก์ไม่ถูกต้องหรือหมดอายุ", 429→"Discord ถูก rate limit", 503→"Discord ไม่ตอบสนอง"
    - Success → call `onSuccess(serverId)` เพื่อให้ parent ย้าย server จาก expired section ไป public listing
    - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.2 เขียน unit tests สำหรับ `EditLinkDialog`
    - ทดสอบ flow: re-check → expired → submit → success → `onSuccess` ถูก call
    - ทดสอบ flow: re-check → not expired → dialog ไม่เปิด + toast แสดง
    - ทดสอบ flow: re-check → network error → dialog ไม่เปิด + error toast
    - ทดสอบ error mapping: 422, 400, 429, 503 แสดง toast message ที่ถูกต้อง
    - _Requirements: 5.3, 5.4, 5.5, 6.3, 6.4, 6.5, 6.6_

- [ ] 7. Wire components เข้า `DiscordServersPage.tsx`
  - [~] 7.1 เพิ่ม owner-specific expired section และ wire `EditLinkDialog` ใน `DiscordServersPage.tsx`
    - Import `ExpiredServerCard` และ `EditLinkDialog`
    - เพิ่ม section "เซิร์ฟเวอร์ของคุณที่ลิงก์หมดอายุ" ใต้ main listing grid แสดงเฉพาะเมื่อ `ownerExpiredServers.length > 0`
    - Render `ExpiredServerCard` สำหรับแต่ละ server ใน `ownerExpiredServers` พร้อม `onEditLink` handler
    - Render `EditLinkDialog` พร้อม `onSuccess` handler ที่ย้าย server จาก `ownerExpiredServers` ไป `servers` state
    - ตรวจสอบว่าปุ่ม "แก้ไขลิงก์" ไม่แสดงสำหรับ non-owner (ควบคุมโดย owner-only section)
    - _Requirements: 2.3, 4.3, 4.4, 5.1, 5.2, 5.6_

  - [ ]* 7.2 เขียน integration tests สำหรับ owner expired section
    - ทดสอบว่า section แสดงเฉพาะเมื่อ user เป็น owner และมี expired servers
    - ทดสอบว่า non-owner ไม่เห็น expired server cards ของ owner คนอื่น
    - ทดสอบว่าหลัง `onSuccess` server ย้ายจาก expired section ไป public listing
    - _Requirements: 2.3, 4.3, 4.4, 5.6_

- [~] 8. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests ใช้ `fast-check` ผ่าน `npm:fast-check@3` (Deno npm specifier) สำหรับ Edge Function tests
- Frontend tests ใช้ Vitest + React Testing Library ตาม project setup ที่มีอยู่
- แต่ละ property test ต้องรัน **อย่างน้อย 100 iterations** (`{ numRuns: 100 }`)
- Edge Function ใช้ `service_role` client สำหรับ DB writes เพื่อ bypass RLS
- Property 4 และ Property 5 ใช้ integration tests แทน PBT เพราะต้องทดสอบ DB query + RLS policy
- Checkpoints ช่วยให้ตรวจสอบความถูกต้องแบบ incremental ก่อนไปขั้นตอนถัดไป

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "2.8"] },
    { "id": 4, "tasks": ["2.7", "2.9", "4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1"] },
    { "id": 7, "tasks": ["6.2", "7.1"] },
    { "id": 8, "tasks": ["7.2"] }
  ]
}
```
