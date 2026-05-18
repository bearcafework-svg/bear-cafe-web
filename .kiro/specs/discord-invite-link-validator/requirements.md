# Requirements Document

## Introduction

ฟีเจอร์นี้เพิ่มระบบตรวจสอบความถูกต้องของ `invite_url` ในตาราง `discord_servers` เพื่อให้มั่นใจว่าลิงก์เชิญที่แสดงต่อสาธารณะยังใช้งานได้อยู่เสมอ เมื่อลิงก์หมดอายุ ระบบจะซ่อนการ์ดเซิร์ฟเวอร์นั้นจากหน้า `/discord-server` และแจ้งเตือนเจ้าของเซิร์ฟเวอร์ให้อัปเดตลิงก์ใหม่ เมื่อเจ้าของกรอกลิงก์ใหม่ ระบบจะตรวจสอบว่าลิงก์ใหม่ชี้ไปยัง Discord Guild ID เดิมก่อนอัปเดตฐานข้อมูล เพื่อป้องกันการเปลี่ยนเซิร์ฟเวอร์โดยไม่ได้รับอนุญาต

## Glossary

- **Invite_Validator**: ระบบ (Edge Function) ที่ทำหน้าที่ตรวจสอบสถานะของ invite link โดยเรียก Discord API
- **Invite_Link**: URL ในรูปแบบ `https://discord.gg/{code}` ที่เก็บอยู่ใน `discord_servers.invite_url`
- **Guild_ID**: Discord Guild ID ที่เก็บอยู่ใน `discord_servers.discord_id` ใช้เป็น identifier หลักของเซิร์ฟเวอร์
- **Invite_Status**: สถานะของ invite link มีค่าได้ 3 ค่า: `'valid'` (ใช้งานได้), `'expired'` (หมดอายุหรือไม่ถูกต้อง), `'unknown'` (ยังไม่เคยตรวจสอบ)
- **Server_Owner**: ผู้ใช้ที่มี `discord_id` ตรงกับ `discord_servers.owner_id` ของเซิร์ฟเวอร์นั้น
- **DiscordServersPage**: หน้า `/discord-server` ที่แสดงรายการ Discord server cards ต่อสาธารณะ
- **Discord_API**: Discord REST API endpoint `GET /invites/{code}` ที่ใช้ resolve invite code
- **Supabase_DB**: ฐานข้อมูล PostgreSQL ที่จัดการโดย Supabase ซึ่งเก็บตาราง `discord_servers`

## Requirements

### Requirement 1: เพิ่มคอลัมน์ invite_status ในตาราง discord_servers

**User Story:** As a system administrator, I want to track the validity status of each server's invite link, so that the system can distinguish between valid, expired, and unchecked links.

#### Acceptance Criteria

1. THE Supabase_DB SHALL contain a column `invite_status` of type `text` in the `discord_servers` table with a check constraint allowing only the values `'valid'`, `'expired'`, and `'unknown'`.
2. THE Supabase_DB SHALL set the default value of `invite_status` to `'unknown'` for all new and existing rows.
3. THE Supabase_DB SHALL contain a column `invite_last_checked_at` of type `timestamptz` in the `discord_servers` table to record when the last validation occurred.
4. THE Supabase_DB SHALL set `invite_last_checked_at` to `NULL` by default, indicating the link has never been checked.
5. WHEN a migration is applied to an existing database, THE Supabase_DB SHALL backfill `invite_status` to `'unknown'` for all existing rows that do not already have a value set.

---

### Requirement 2: ตรวจสอบสถานะ invite link เมื่อโหลดหน้า /discord-server

**User Story:** As a public visitor, I want to see only servers with working invite links, so that I don't encounter broken links when trying to join a server.

#### Acceptance Criteria

1. WHEN the DiscordServersPage fetches the list of approved servers, THE DiscordServersPage SHALL exclude servers where `invite_status` is `'expired'` from the results at the database query level, for all users regardless of authentication state who are not the Server_Owner of that server.
2. WHEN the DiscordServersPage fetches the list of approved servers, THE DiscordServersPage SHALL include servers where `invite_status` is `'valid'` or `'unknown'` in the server listing grid.
3. WHILE a Server_Owner is authenticated and viewing the DiscordServersPage, WHEN the page fetches server data, THE DiscordServersPage SHALL display the owner's expired servers in a visually separate owner-specific section that is positioned below the main public listing grid, and SHALL NOT include them in the main public listing grid.

---

### Requirement 3: ตรวจสอบ invite link แบบ on-demand โดย Invite_Validator

**User Story:** As a system, I want to validate invite links on demand, so that the invite_status column stays accurate without requiring a full page reload.

#### Acceptance Criteria

1. WHEN a validation request is received with a `server_id` parameter, THE Invite_Validator SHALL look up the corresponding `invite_url` from Supabase_DB and then call the Discord_API `GET /invites/{code}` using the extracted invite code.
2. WHEN the Discord_API returns HTTP 200 for the invite code, THE Invite_Validator SHALL update `invite_status` to `'valid'` and set `invite_last_checked_at` to the current timestamp.
3. WHEN the Discord_API returns HTTP 404 or HTTP 400 for the invite code, THE Invite_Validator SHALL update `invite_status` to `'expired'` and set `invite_last_checked_at` to the current timestamp.
4. WHEN the Discord_API returns HTTP 429 (rate limited), THE Invite_Validator SHALL leave `invite_status` unchanged, leave `invite_last_checked_at` unchanged, and return an error response with HTTP status 429 and a message indicating the request was rate limited.
5. WHEN the Discord_API returns HTTP 5xx or does not respond within 5 seconds (timeout), THE Invite_Validator SHALL leave `invite_status` unchanged, leave `invite_last_checked_at` unchanged, and return an error response with HTTP status 503 and a message indicating the Discord service is temporarily unavailable.
6. IF the caller's authentication token is missing or invalid, THEN THE Invite_Validator SHALL return HTTP 401 without performing any validation or database update.
7. IF the `server_id` does not correspond to any row in Supabase_DB, or if the corresponding `invite_url` is null or empty, THEN THE Invite_Validator SHALL return HTTP 404 or HTTP 422 respectively, without calling the Discord_API.
8. THE Invite_Validator SHALL verify that the caller is either the Server_Owner of the specified server or a service-role caller before performing validation, returning HTTP 403 if neither condition is met.

---

### Requirement 4: ซ่อนการ์ดเซิร์ฟเวอร์ที่ลิงก์หมดอายุจาก public

**User Story:** As a public visitor, I want the server listing to show only servers with valid invite links, so that I have a reliable experience when browsing and joining servers.

#### Acceptance Criteria

1. WHEN `invite_status` is `'expired'`, THE DiscordServersPage SHALL not render the server card in the public listing grid.
2. WHEN `invite_status` is `'expired'`, THE DiscordServersPage SHALL not include the server in the Featured Carousel.
3. WHILE a Server_Owner is authenticated and viewing the DiscordServersPage, THE DiscordServersPage SHALL render the owner's expired server card with a visible warning indicator in the owner-specific section, only when the caller's `discord_id` matches `discord_servers.owner_id` for that server.
4. THE DiscordServersPage SHALL display an expired server card only to its Server_Owner, not to other authenticated users or unauthenticated visitors.

---

### Requirement 5: แสดง UI แจ้งเตือนและปุ่ม "แก้ไขลิงก์" ให้เจ้าของเซิร์ฟเวอร์

**User Story:** As a server owner, I want to see a clear warning when my invite link has expired and have a way to update it, so that I can restore my server's visibility on the listing page.

#### Acceptance Criteria

1. WHILE a Server_Owner is authenticated and `invite_status` of the owner's server is `'expired'`, THE DiscordServersPage SHALL display a warning indicator containing a warning icon and a text label (e.g. "ลิงก์หมดอายุ") positioned within the server card boundary.
2. WHILE a Server_Owner is authenticated and `invite_status` of the owner's server is `'expired'`, THE DiscordServersPage SHALL display an "แก้ไขลิงก์" (Edit Link) button on the server card.
3. WHEN the Server_Owner clicks the "แก้ไขลิงก์" button, THE DiscordServersPage SHALL query Supabase_DB to re-check the current `invite_status` of the server and SHALL open the edit dialog only if the re-check returns `invite_status` equal to `'expired'`.
4. IF the re-check in criterion 3 returns an `invite_status` value other than `'expired'`, THEN THE DiscordServersPage SHALL not open the edit dialog and SHALL display a message indicating the link is no longer expired.
5. IF the re-check in criterion 3 fails due to a network or database error, THEN THE DiscordServersPage SHALL not open the edit dialog and SHALL display an error message indicating the status could not be verified.
6. THE DiscordServersPage SHALL not display the "แก้ไขลิงก์" button to users who are not the Server_Owner of that server.

---

### Requirement 6: ตรวจสอบ Guild ID ก่อนอัปเดต invite link ใหม่

**User Story:** As a system, I want to verify that a new invite link points to the same Discord server before updating it, so that server owners cannot replace their listing with a different server.

#### Acceptance Criteria

1. WHEN a Server_Owner submits a new Invite_Link via the edit dialog, THE Invite_Validator SHALL resolve the new invite code by calling the Discord_API `GET /invites/{code}` to obtain the Guild_ID from the response.
2. IF the resolved Guild_ID from the new Invite_Link matches `discord_servers.discord_id` for the server being updated, THEN THE Invite_Validator SHALL update `invite_url` to the new link, set `invite_status` to `'valid'`, and set `invite_last_checked_at` to the current timestamp.
3. IF the resolved Guild_ID from the new Invite_Link does not match `discord_servers.discord_id` for the server being updated, THEN THE Invite_Validator SHALL return an error response with HTTP status 422 and a message indicating the link does not belong to the original server.
4. IF the new Invite_Link cannot be resolved because the Discord_API returns HTTP 404 or HTTP 400, THEN THE Invite_Validator SHALL return an error response with HTTP status 400 and a message indicating the link is invalid or expired.
5. IF the Discord_API returns HTTP 429 while resolving the new Invite_Link, THEN THE Invite_Validator SHALL return an error response with HTTP status 429 and a message indicating the request was rate limited.
6. IF the Discord_API returns HTTP 5xx or does not respond within 5 seconds while resolving the new Invite_Link, THEN THE Invite_Validator SHALL return an error response with HTTP status 503 and a message indicating the Discord service is temporarily unavailable.
7. IF the caller's authentication token is missing or invalid, THEN THE Invite_Validator SHALL return HTTP 401 without performing any validation or database update.
8. IF the caller is authenticated but is not the Server_Owner of the specified server, THEN THE Invite_Validator SHALL return HTTP 403 without performing any validation or database update.
9. IF the submitted Invite_Link does not match any supported URL format (i.e., the invite code cannot be extracted), THEN THE Invite_Validator SHALL return HTTP 400 with a message indicating the URL format is invalid, without calling the Discord_API.

---

### Requirement 7: ตรวจสอบ Guild ID — round-trip และ property-based correctness

**User Story:** As a developer, I want the Guild ID matching logic to be thoroughly tested with property-based tests, so that edge cases in invite URL parsing and Guild ID comparison are reliably caught.

#### Acceptance Criteria

1. WHEN an Invite_Link is submitted for parsing, THE Invite_Validator SHALL extract the invite code from any of the following URL formats: `https://discord.gg/{code}`, `https://discord.com/invite/{code}`, `https://discordapp.com/invite/{code}`, or a bare `{code}` string where `{code}` consists of 2 to 32 alphanumeric or hyphen characters, and SHALL produce the same invite code regardless of which format is used.
2. WHEN a valid invite code is extracted from any supported URL format and the canonical URL `https://discord.gg/{code}` is constructed from it, THE Invite_Validator SHALL resolve the canonical URL via the Discord_API and obtain the same Guild_ID as resolving the original URL (round-trip property).
3. IF two Invite_Links both resolve to the same Guild_ID via the Discord_API, THEN THE Invite_Validator SHALL return a match result of `true` regardless of the order in which the links are compared (symmetry property).
4. IF two Invite_Links resolve to different Guild_IDs via the Discord_API, THEN THE Invite_Validator SHALL return a match result of `false`.
5. IF an Invite_Link's invite code does not match the 2–32 alphanumeric/hyphen character pattern defined in criterion 1, THEN THE Invite_Validator SHALL return a validation error response indicating the input format is invalid, without calling the Discord_API.
6. IF the Discord_API is unavailable or returns an error while resolving an Invite_Link during a match comparison, THEN THE Invite_Validator SHALL return an error response and SHALL NOT return a match result of `true` or `false`.

---

### Requirement 8: Background check สำหรับ invite links ที่ยังไม่ได้ตรวจสอบ

**User Story:** As a system administrator, I want invite links to be periodically validated in the background, so that expired links are detected even when no user interaction triggers a check.

#### Acceptance Criteria

1. THE Invite_Validator SHALL support a batch validation mode that accepts a list of up to 50 `server_id` values and validates each corresponding `invite_url` sequentially.
2. WHEN batch validation is triggered, THE Invite_Validator SHALL process only servers where `invite_status` is `'unknown'` or where `invite_last_checked_at` is older than 24 hours measured from the time the batch job starts.
3. WHEN batch validation is triggered, THE Invite_Validator SHALL require a service-role authorization header and return HTTP 403 for any other caller.
4. WHEN a server in the batch is successfully validated, THE Invite_Validator SHALL update `invite_status` and `invite_last_checked_at` for that server before proceeding to the next server in the batch.
5. IF a `server_id` in the batch does not correspond to any row in Supabase_DB, THEN THE Invite_Validator SHALL skip that entry and continue processing the remaining servers.
6. IF the Discord_API returns a non-429 error for a server during batch validation, THEN THE Invite_Validator SHALL record the error for that server, leave `invite_status` and `invite_last_checked_at` unchanged for that server, and continue processing the remaining servers.
7. IF the Discord_API rate limit is reached during batch validation (HTTP 429), THEN THE Invite_Validator SHALL stop processing the remaining servers in the batch and return a partial result indicating the count of servers successfully processed and the list of unprocessed `server_id` values.
