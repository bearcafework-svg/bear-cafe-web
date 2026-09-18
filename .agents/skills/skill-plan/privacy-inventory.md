# Bear Café — Technical Privacy & Data Inventory Record

> **Document Status**: Confirmed Audit Snapshot  
> **Last Audited**: 17 กันยายน 2026  
> **Target Projects**: `bearcafe-bot` (Discord Bot) & `bear-cafe-web` (Web Dashboard)  
> **Source Module**: [`src/data/privacyPermissionsData.ts`](file:///d:/bear-cafe-web/src/data/privacyPermissionsData.ts)  
> **Public Route**: `/privacy/permissions`

---

## 1. วัตถุประสงค์
เอกสารนี้บันทึกข้อเท็จจริงเชิงเทคนิคเกี่ยวกับการเข้าถึง จัดเก็บ ส่งต่อ และระยะเวลาการเก็บรักษาข้อมูล (Data Retention & Access Control) ของระบบ Bear Café เพื่อให้ AI Agents และทีมพัฒนามี Single Source of Truth อ้างอิงเมื่อมีการแก้ไขโค้ด อัปเกรดฟีเจอร์ หรือปรับปรุงข้อกำหนดความเป็นส่วนตัว

---

## 2. ข้อมูลสถาปัตยกรรมระบบ (Architecture Overview)

### A. Bear Café Bot (`bearcafe-bot`)
- **บทบาท**: บอท Discord ประจำเซิร์ฟเวอร์ จัดการห้องเสียงอัตโนมัติ (Smart Room/Rent House), มินิเกม, เควสต์, และระบบความปลอดภัย
- **Database**: Supabase PostgreSQL ผ่าน `supabaseServiceRole`
- **Temporary Cache**: Upstash Redis (สำหรับ Rate Limiting, Anti-Spam, Anti-Nuke มี TTL 10-60 วินาที)
- **External Services**:
  - `Discord Gateway & REST API`: สตรีมเหตุการณ์และรับส่งข้อความ/ปุ่ม Interaction
  - `Google Translate TTS` (`google-tts-api`): แปลงคำเฉลยสำหรับ Minigame 5 & 11 (พักไฟล์เสียงใน RAM ชั่วคราว ไม่เซฟลง Disk หรือ Supabase)

### B. Bear Café Web Dashboard (`bear-cafe-web`)
- **บทบาท**: แดชบอร์ดตรวจสอบคะแนน แลกของรางวัล เช็คชื่อ และคลังไอเทม
- **Authentication**: Discord OAuth2 ผ่าน Supabase Edge Function `discord-auth`
  - **Scopes ที่ขอจริง**: `identify`, `guilds`
  - **Session Storage**: `localStorage` คีย์ `sb-<ref>-auth-token` (ไม่ใช้ Cookie)
  - **Guild Verification**: ตรวจสอบสมาชิกเซิร์ฟเวอร์ Bear Café ผ่าน Bot Token ภายใน Edge Function ไม่มีการบันทึกรายชื่อ Guild อื่นลง Database
- **Bot Defense**: Cloudflare Turnstile (`/login`, `/healing-message`)
  - ตรวจสอบ Token ชั่วคราวผ่าน Cloudflare API
  - ไม่บันทึก IP หรือ Token ลง Database
- **Analytics**: ไม่พบการติดตั้งสคริปต์บุคคลที่สาม (ไม่มี Google Analytics, PostHog, Vercel Analytics ใน runtime)

---

## 3. Data Retention Summary Table

| ตาราง / ข้อมูล | ระบบที่ใช้ | การลบอัตโนมัติ (Auto-Delete) | ระยะเวลาจัดเก็บ |
|---|---|---|---|
| `user_daily_quests` | Bot | ✅ มี Cron Job (ทุก 24 ชม.) | ลบข้อมูลที่เก่ากว่า 7 วัน |
| `user_quest_daily_summary` | Bot | ✅ มี Cron Job (ทุก 24 ชม.) | ลบข้อมูลที่เก่ากว่า 30 วัน |
| `flower_sessions` | Bot | ✅ ลบทันทีเมื่อจบ Session | ชั่วคราว (ไม่กี่นาที) |
| `guild_structure_backups` | Bot | ✅ Auto-prune | เก็บสูงสุด 5 ชุดล่าสุดต่อกิลด์ |
| `Upstash Redis Keys` | Bot | ✅ Redis Key TTL | 10 - 60 วินาที |
| `voice_logs` / `voice_sessions` | Bot | ❌ ไม่พบการลบอัตโนมัติ | Append-only เพื่อคำนวณแต้ม |
| `trading_history` / `orders` | Both | ❌ ไม่พบการลบอัตโนมัติ | บันทึกประวัติธุรกรรม |
| `minigame_wins` / `user_bee_gacha` | Both | ❌ ไม่พบการลบอัตโนมัติ | บันทึกประวัติชัยชนะและคอลเลกชัน |
| `smart_room_presets` | Bot | ⚠️ ลบเมื่อผู้ใช้สั่งรีเซ็ต | ตามการตั้งค่าของผู้ใช้ |
| `tag_warn_logs` | Bot | ❌ ไม่พบการลบอัตโนมัติ | บันทึกประวัติตักเตือนทางวินัย |

---

## 4. กฎเหล็กสำหรับ AI Agent เมื่อแก้ไขหรือพัฒนาฟีเจอร์ใหม่
1. **ห้ามเพิ่มการสอดแนม/Tracking บุคคลที่สาม** โดยไม่ผ่านการตรวจสอบและได้รับความยินยอม
2. **ห้ามบันทึกเสียง (Audio Recording)** ในห้องเสียง Discord เด็ดขาด
3. **ห้ามเก็บข้อความแชทส่วนตัว (Message Content)** ลงฐานข้อมูลโดยไม่จำเป็น
4. **หากสร้างตารางใหม่ที่มีข้อมูลผู้ใช้ (User Identifiable Data)**:
   - ต้องกำหนด Retention และวิธีการลบข้อมูล
   - ต้องอัปเดตไฟล์ [`src/data/privacyPermissionsData.ts`](file:///d:/bear-cafe-web/src/data/privacyPermissionsData.ts) เสมอ
