# Requirements Document

## Introduction

Feature นี้ต้องการให้ระบบคำนวณและบันทึก `salmon_point` โดยอัตโนมัติทุกครั้งที่มีการสร้าง แก้ไข หรือลบบิลในหน้า `/admin/trading-history` โดยไม่ต้องรันคำสั่ง "จัดการโดเนท" แยกต่างหาก

ปัจจุบัน `salmon_point` ถูกคำนวณด้วยสูตร `FLOOR(amount / 100)` และเก็บไว้ในตาราง `user_points` (คอลัมน์ `salmon_point`) โดยใช้ `member_id` ของบิลเป็น `discord_id` เพื่อ map กับ user

Feature นี้ครอบคลุม 3 กรณีหลัก: บันทึกบิลใหม่ (เพิ่ม salmon_point), แก้ไข amount ของบิล (ปรับ salmon_point ตามส่วนต่าง), และลบบิล (หัก salmon_point คืน) พร้อมทั้งมี audit log เพื่อ track การเปลี่ยนแปลงทั้งหมด

## Glossary

- **Trading_History_System**: ระบบจัดการประวัติการซื้อขายในหน้า `/admin/trading-history`
- **Salmon_Point_Engine**: ส่วนที่รับผิดชอบการคำนวณและอัปเดต salmon_point ใน `user_points`
- **Audit_Logger**: ส่วนที่บันทึก log การเปลี่ยนแปลง salmon_point ทุกครั้ง
- **DB_Trigger**: PostgreSQL trigger ที่ทำงานอัตโนมัติเมื่อมีการ INSERT/UPDATE/DELETE ใน `trading_history`
- **trading_history**: ตารางบันทึกบิลการซื้อขาย มีคอลัมน์ `id`, `member_id`, `amount`, `type_bill`, `item`, `slip_url`, `slip_url_2`, `transaction`, `log_timestamp`, `created_at`
- **user_points**: ตารางเก็บแต้มผู้ใช้ มีคอลัมน์ `discord_id` (PK), `points`, `max_cap`, `salmon_point`
- **salmon_point**: แต้มพิเศษที่คำนวณจาก `FLOOR(amount / 100)` ต่อบิล
- **salmon_point_logs**: ตาราง audit log สำหรับ track การเปลี่ยนแปลง salmon_point

---

## Requirements

### Requirement 1: เพิ่มคอลัมน์ salmon_point ใน user_points

**User Story:** As a system administrator, I want the `user_points` table to have a `salmon_point` column, so that the system can store and track salmon points per user.

#### Acceptance Criteria

1. THE `user_points` table SHALL have a `salmon_point` column of type `integer` with a default value of `0`
2. THE `user_points` table SHALL enforce a constraint that `salmon_point` is greater than or equal to `0`

---

### Requirement 2: สร้างตาราง audit log สำหรับ salmon_point

**User Story:** As a system administrator, I want all salmon_point changes to be logged, so that I can audit and trace every modification.

#### Acceptance Criteria

1. THE system SHALL have a `salmon_point_logs` table with columns: `id` (uuid PK), `discord_id` (text), `bill_id` (uuid), `change_type` (text: `'insert'`, `'update'`, `'delete'`), `old_salmon_point` (integer), `new_salmon_point` (integer), `delta` (integer), `amount_before` (numeric), `amount_after` (numeric), `created_at` (timestamptz)
2. WHEN a salmon_point change results in a non-zero delta, THE `Audit_Logger` SHALL insert a record into `salmon_point_logs` with all relevant fields populated
3. WHEN a salmon_point operation results in a zero delta, THE `Audit_Logger` SHALL NOT insert a record into `salmon_point_logs`
4. THE `salmon_point_logs` table SHALL be readable by authenticated users with admin access

---

### Requirement 3: คำนวณ salmon_point อัตโนมัติเมื่อบันทึกบิลใหม่

**User Story:** As an admin staff, I want salmon_point to be automatically calculated and added when a new bill is saved, so that I don't need to run a separate "จัดการโดเนท" command.

#### Acceptance Criteria

1. WHEN a new record is inserted into `trading_history`, THE `DB_Trigger` SHALL calculate `salmon_point_delta = FLOOR(NEW.amount / 100)`
2. WHEN `salmon_point_delta` is greater than `0`, THE `Salmon_Point_Engine` SHALL upsert `user_points` for the corresponding `discord_id` (matching `NEW.member_id`), adding `salmon_point_delta` to the existing `salmon_point`, and the requirement is considered satisfied only when both the calculation and the database upsert succeed
3. IF the `discord_id` does not exist in `user_points`, THEN THE `Salmon_Point_Engine` SHALL create a new row with `salmon_point` set to `salmon_point_delta` and other numeric fields defaulting to `0`
4. WHEN the upsert completes, THE `Audit_Logger` SHALL insert a record into `salmon_point_logs` with `change_type = 'insert'`, `old_salmon_point` as the value before upsert, `new_salmon_point` as the value after, and `delta = salmon_point_delta`

---

### Requirement 4: ปรับ salmon_point อัตโนมัติเมื่อแก้ไข amount ของบิล

**User Story:** As an admin staff, I want salmon_point to be automatically adjusted when a bill's amount is edited, so that the user's salmon_point always reflects the correct total.

#### Acceptance Criteria

1. WHEN a record in `trading_history` is updated and `NEW.amount` differs from `OLD.amount`, THE `DB_Trigger` SHALL calculate `old_sp = FLOOR(OLD.amount / 100)` and `new_sp = FLOOR(NEW.amount / 100)`
2. WHEN `old_sp` differs from `new_sp` and the salmon_point calculation has been explicitly triggered by a `trading_history` UPDATE event, THE `Salmon_Point_Engine` SHALL apply `delta = new_sp - old_sp` to the `salmon_point` of the corresponding `user_points` row
3. IF applying the delta would result in `salmon_point` becoming negative, THEN THE `Salmon_Point_Engine` SHALL set `salmon_point` to `0` instead of a negative value
4. WHEN the update completes, THE `Audit_Logger` SHALL insert a record into `salmon_point_logs` with `change_type = 'update'`, `amount_before = OLD.amount`, `amount_after = NEW.amount`, and the correct `old_salmon_point`, `new_salmon_point`, and `delta` values
5. WHEN a record in `trading_history` is updated but `NEW.amount` equals `OLD.amount`, THE `DB_Trigger` SHALL NOT modify `user_points` or insert into `salmon_point_logs`

---

### Requirement 5: หัก salmon_point อัตโนมัติเมื่อลบบิล

**User Story:** As an admin staff, I want salmon_point to be automatically deducted when a bill is deleted, so that users don't retain points from deleted transactions.

#### Acceptance Criteria

1. WHEN a record is deleted from `trading_history`, THE `DB_Trigger` SHALL calculate `salmon_point_to_deduct = FLOOR(OLD.amount / 100)`
2. WHEN `salmon_point_to_deduct` is greater than `0`, THE `Salmon_Point_Engine` SHALL subtract `salmon_point_to_deduct` from the `salmon_point` of the corresponding `user_points` row
3. IF subtracting would result in `salmon_point` becoming negative, THEN THE `Salmon_Point_Engine` SHALL set `salmon_point` to `0`
4. WHEN the deduction completes successfully and `salmon_point_to_deduct` is greater than `0`, THE `Audit_Logger` SHALL insert a record into `salmon_point_logs` with `change_type = 'delete'`, `old_salmon_point` as the value before deduction, `new_salmon_point` as the value after, and `delta` as the negative deduction amount
5. WHEN `salmon_point_to_deduct` equals `0` (zero-amount bill), THE `Audit_Logger` SHALL NOT insert a record into `salmon_point_logs`

---

### Requirement 6: ป้องกัน salmon_point ติดลบ

**User Story:** As a system administrator, I want salmon_point to never go below zero, so that users are not penalized beyond their earned points.

#### Acceptance Criteria

1. THE `user_points` table SHALL enforce a check constraint `salmon_point >= 0`
2. WHEN any operation would set `salmon_point` to a value less than `0`, THE `Salmon_Point_Engine` SHALL use `GREATEST(0, calculated_value)` to clamp the result to `0`
3. FOR ALL valid sequences of bill insert, update, and delete operations on a single `member_id`, the resulting `salmon_point` in `user_points` SHALL always be greater than or equal to `0`
4. WHEN a salmon_point update is attempted at the application layer, THE `Salmon_Point_Engine` SHALL validate that the resulting value is `>= 0` before executing the database operation, in addition to relying on the database check constraint

---

### Requirement 7: ลบปุ่ม "จัดการโดเนท" ออกจาก UI

**User Story:** As an admin staff, I want the separate "จัดการโดเนท" button removed from the trading history page, so that the workflow is simplified and salmon_point is managed automatically.

#### Acceptance Criteria

1. THE `Trading_History_System` SHALL NOT display a separate "จัดการโดเนท" button or manual salmon_point management control in the `/admin/trading-history` UI
2. WHEN a bill is saved, edited, or deleted through the UI, THE `Trading_History_System` SHALL rely entirely on the `DB_Trigger` to handle salmon_point updates without requiring additional user action

---

### Requirement 8: แสดง salmon_point ที่คำนวณได้ในฟอร์มสร้างบิล

**User Story:** As an admin staff, I want to see the calculated salmon_point preview when entering a bill amount, so that I can confirm the correct points will be awarded.

#### Acceptance Criteria

1. WHEN an admin enters an `amount` value in the create-bill form, THE `Trading_History_System` SHALL display a preview of `FLOOR(amount / 100)` as the salmon_point that will be awarded
2. WHEN `amount` is less than `100`, THE `Trading_History_System` SHALL display `0` as the salmon_point preview
3. WHEN `amount` is empty or non-numeric, THE `Trading_History_System` SHALL NOT display the salmon_point preview

---

### Requirement 9: RLS Policy สำหรับ salmon_point_logs

**User Story:** As a system administrator, I want proper Row Level Security on the salmon_point_logs table, so that only authorized users can read audit data and only the database trigger can write to it.

#### Acceptance Criteria

1. THE `salmon_point_logs` table SHALL have Row Level Security enabled
2. WHEN an authenticated user with admin or owner access queries `salmon_point_logs`, THE system SHALL allow the SELECT operation
3. WHEN the `service_role` queries `salmon_point_logs`, THE system SHALL allow both SELECT and INSERT operations
4. THE `salmon_point_logs` table SHALL deny INSERT operations from any authenticated user role, even if that user also holds `service_role` access, to ensure only database triggers write audit records
