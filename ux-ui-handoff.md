# Bear Cafe — Complete UX/UI Handoff Document

**Version:** Current System Audit  
**Date:** June 2026  
**Audience:** Product Designer, UX Designer, UI Designer  
**Purpose:** Understand the entire product before redesign and UX optimization  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Design Identity & System](#2-design-identity--system)
3. [Color Tokens](#3-color-tokens)
4. [Typography & Spacing](#4-typography--spacing)
5. [Component Library](#5-component-library)
6. [Page Inventory](#6-page-inventory)
7. [User Flows](#7-user-flows)
8. [State Matrix](#8-state-matrix)
9. [Responsive Behavior](#9-responsive-behavior)
10. [Animation & Motion](#10-animation--motion)
11. [Known UX Issues & Notes](#11-known-ux-issues--notes)
12. [Source File Map](#12-source-file-map)

---

## 1. Product Overview

**Bear Cafe** เป็น cozy social platform เชื่อมต่อกับ Discord  
เป้าหมายหลัก: ช่วยให้สมาชิกในชุมชน Discord หาเพื่อนคุยได้ง่ายขึ้น  

**Core value prop:**  
> "เหงาอยู่รึเปล่า? แวะมาใช้เวลาที่ Bear Cafe สิ!"

### Tech Stack (สำหรับ Designer ทราบ)
- **Frontend:** React + TypeScript + TailwindCSS
- **Animation:** Framer Motion
- **Auth:** Discord OAuth
- **Backend:** Supabase (Realtime enabled)
- **Deploy:** Vercel

### User Types
| Type | สิทธิ์ |
|------|--------|
| Guest (ไม่ได้ login) | ดูหน้าหลัก, หน้า Welcome, ดู Discord Servers |
| Member (login แล้ว) | ใช้งานได้ทุกฟีเจอร์ |
| Staff | เข้าถึงหน้า Admin บางส่วน |
| Admin / Owner | เข้าถึงหน้า Admin ทั้งหมด, bypass maintenance |
| Banned | เห็นเฉพาะหน้า Banned |
| Green Tea Role (warned) | เห็น warning popup ทุกครั้งที่ login |

---

## 2. Design Identity & System

### Brand Personality
Bear Cafe **ไม่ใช่** SaaS dashboard  
Bear Cafe **คือ** cozy social lounge ที่รู้สึกอบอุ่นเหมือนนั่งอยู่ในคาเฟ่

**Keywords ที่ต้องสื่อ:** cozy · illustrated · pastel · warm · soft · rounded · cafe atmosphere · playful · readable

**หลีกเลี่ยง:** cyberpunk · neon · enterprise UI · sharp edges · harsh contrast · visual noise

### Visual References
- cozy cafe atmosphere
- honey & desserts
- soft night ambiance
- hand-drawn illustrations
- pastel aesthetics
- relaxing game-like UI (ไม่ใช่ gamified ที่ aggressive)

---

## 3. Color Tokens

### CSS Custom Properties (HSL)

| Token | ค่าตัวอย่าง | ใช้สำหรับ |
|-------|------------|-----------|
| `--background` | warm off-white / warm dark | app background |
| `--card` | slightly elevated surface | cards, modals |
| `--foreground` | soft warm dark / cream | body text |
| `--muted-foreground` | desaturated warm | secondary text |
| `--primary` | warm pink-rose | CTA buttons, links |
| `--honey` | `#E9A84E` | accent สำคัญที่สุด, buttons, highlights, progress |
| `--bear-brown` | `#8B5E3C` | borders, icons, decorative |
| `--latte` | warm light tan | borders (light mode) |
| `--coffee` | warm medium brown | borders (dark mode) |
| `--mocha` | `#1D1815` | dark card surface |
| `--cream` | `#F8EBD8` | light surface, right panel bg |
| `--espresso` | deep warm dark | dark background gradient |
| `--peach` | soft orange-pink | gradient accents |
| `--blush` | soft pink | card accents, masking tape |
| `--mint` | `#8FA77A` (light) | coming-soon tags |
| `--matcha` | muted green | success, verified badges |
| `--honey` | amber-orange | primary accent |
| `--lavender` | muted purple | tag palettes |
| `--berry` | muted berry | tag text |
| `--destructive` | red | error, banned, cooldown |
| `--success` | green | voice connected, success |
| `--sidebar-background` | sidebar bg | sidebar only |
| `--sidebar-foreground` | sidebar text | sidebar only |
| `--sidebar-border` | sidebar border | sidebar only |
| `--sidebar-accent` | hover state | nav item hover |
| `--sidebar-accent-foreground` | hover text | nav item hover text |

### Color Rules
- ใช้ warm colors เสมอ → เลี่ยง cold blue/grey
- ห้ามใช้ pure black (#000) หรือ pure white (#fff)
- ห้ามใช้ neon หรือ highly saturated colors
- ใช้ `--honey` เป็น primary accent หลัก
- ใช้ `--matcha` / `--mint` สำหรับ success states เท่านั้น (ไม่ overuse green)

---

## 4. Typography & Spacing

### Font Scale
| ระดับ | Class | ใช้สำหรับ |
|-------|-------|-----------|
| Hero heading | `text-2xl sm:text-3xl font-bold` | Page titles |
| Section heading | `text-lg sm:text-xl font-semibold` | Section labels |
| Card title | `text-base font-bold` | Card headers |
| Body | `text-sm` | General content |
| Caption | `text-xs` | Secondary info, meta |
| Tiny | `text-[10px]–text-[11px]` | Badges, tags, timestamps |

**Font style:** friendly · casual · human · concise  
**ภาษาไทย:** ใช้ภาษาสบายๆ ไม่เป็นทางการ ไม่ robotic

### Spacing Rules
- Preferred: `p-4`, `p-6`, `gap-4`, `gap-6`, `space-y-4`, `space-y-6`
- Layout ต้องรู้สึก **breathable** — ไม่อัดแน่น

### Border Radius
- การ์ด: `rounded-2xl` หรือ `rounded-3xl`
- ปุ่มเล็ก: `rounded-xl`
- Pills/badges: `rounded-full`
- ห้ามใช้ sharp corners

### Shadows
- ใช้ soft shadow เท่านั้น
- `shadow-md`, `shadow-lg`, `shadow-xl` พร้อม opacity modifier
- เลี่ยง harsh black shadow

---

## 5. Component Library

### Layout Components

#### `CozySidebar` (220px, fixed left)
```
[BearLogo]
─────────────────
[สลับโหมด]
[ประวัติการใช้งาน]
[ข้อตกลงและกติกา]
[จัดการระบบ] ← staff/admin only
─────────────────
[ออกจากระบบ / เข้าสู่ระบบ]
═════════════════
[MascotMessage bubble]
─────────────────
[Discord] [TikTok] [YouTube]
```
- Mobile: hidden, แทนด้วย hamburger toggle (z-50)
- Desktop: แสดงตลอด (`lg:block`)

#### `CozyRightPanel` (264px, fixed right)
```
[ProfileCard]
[PointsWidget]
  ├── แต้มสะสม + progress bar
  └── Redeem code input
```
- Desktop (xl): แสดงตลอด
- Mobile: overlay toggle ด้วยปุ่ม 🍓

#### `Footer`
- copyright text เท่านั้น
- gradient fade จาก content

---

### Content Components

#### `CozyFeatureCards` (3-column grid)

| Card | ชื่อ | Icon file | Tag | State |
|------|------|-----------|-----|-------|
| 1 | สุ่มแชทคุย | SecretCafe-1.png | "Let's talk!" honey | Disabled (coming soon) |
| 2 | หาโต๊ะคุย | SecretCafe-2.png | "Cafe time!" mint | Disabled (coming soon) |
| 3 | หาเพื่อนลงห้อง | SecretCafe-3.png | "Join now!" blush | Active |

**Decorative element:** MaskingTape strip at top of each card (honey/mint/blush)  
**Card 3 states:**
- Default: hover lift + scale
- Voice count visible: แสดง "🎙️ X คนออนไลน์อยู่"
- Cooldown active: แสดง countdown timer (destructive color)
- Non-member: แสดงปุ่ม "เข้าร่วม Discord ฟรี"
- Not authenticated: click → `/login`

#### `CommunityCarousel`
- Auto-scroll: 40px/s, loop seamlessly
- Pause on hover / touch
- Arrow buttons: appear on hover (opacity transition)
- Each server card (w-52): icon + name + member count + description (line-clamp-2) + category tag
- Empty state: hidden (component returns null)
- Loading state: 5 skeleton placeholders (animate-pulse)
- Promote button → `/discord-servers`

#### `MascotMessage` (inside CozySidebar)
- Animated bear: floating (y: 0→-3→0, 2s loop), random blink (3–5s), random wave (8–12s)
- Wave effect: ✨💖 sparkle elements
- Message cycles: fade out → swap → fade in every 12s
- Data source: `healing_messages` table (approved only), limit 20
- Default fallback message: "วันนี้คุณเก่งมากเลยนะ พักผ่อนเยอะๆ นะคะ! ✨"
- ซ่อนถ้า viewport height < 680px

---

### Overlay Components

#### `GreenTeaWarningPopup`
- Trigger: on page load ถ้า user มียศ "ถ้วยชาเขียว"
- แสดง: icon, title, warn details (timestamp, message, evidence image), acknowledge button
- z-index: 100 (over everything)
- ปิดได้ด้วยปุ่ม "รับทราบ"
- ตรวจสอบ 1 ครั้งต่อ session

#### `CooldownBox`
- แสดงเฉพาะเมื่อ `isOnCooldown = true`
- Position: `fixed right-4 top-20 lg:right-8 z-40`
- Mobile: collapsible (ย่อ/ขยายได้)
- Desktop: always expanded
- Animation: pulsing lock icon
- Content: countdown timer (MM:SS), remaining minutes
- Colors: destructive/red theme

#### `LoadingBear`
- Mobile skeleton: stacked cards pattern
- Desktop skeleton: 3-column grid pattern
- ใช้ `<Skeleton>` component

#### `RewardPopup`
- แสดงเมื่อ redeem code สำเร็จหรือ fail
- Types: `points` / `role` / `both`
- ใช้ใน CozyRightPanel และ PointsPage

---

### Form Components (ใน CreateSessionPage)

#### `StepIndicator`
- 3 steps: เลือกหมวดหมู่ → รายละเอียด → ยืนยัน
- แสดง active step, completed steps

#### `CategoryCard`
- Grid 2×2 (mobile) หรือ 3 columns (desktop)
- Selected state: border highlight

#### `ExpandableRoleCard`
- Grid 2×3 (mobile/desktop)
- แสดง emoji + ชื่อ + description (expandable)
- Selected state: border + checkmark

#### `DiscordMessagePreview`
- Preview ว่าข้อความใน Discord จะออกมาเป็นแบบไหน

---

## 6. Page Inventory

### `/welcome` — Landing Page
**Route:** `/welcome`  
**Auth required:** ❌  
**Layout:** fullscreen, no sidebar  

**Sections:**
1. Sticky header: Logo + ชื่อ + ThemeToggle + ปุ่มเข้าสู่ระบบ
2. Hero: BearLogo (animate scale-in) + H1 + description + CTA button "เริ่มต้นใช้งาน"
3. Features grid (3 cards): หาเพื่อนคุย · หลากหลายหมวดหมู่ · บรรยากาศอบอุ่น
4. Footer: logo + tagline

**Animation:** staggered fade-in + hover lift on feature cards

---

### `/login` — Login Page
**Route:** `/login`  
**Auth required:** ❌ (redirect ถ้า authenticated แล้ว)  
**Layout:** centered card, max-w-lg  

**States:**
- Default: แสดง card พร้อม features grid + Discord login button
- Loading (after click): fullscreen loading state "กำลังเชื่อมต่อกับ Discord..."

**Card sections:**
1. BearLogo (hover scale effect + glow)
2. "ยินดีต้อนรับ" heading
3. Features grid (2×2): หาเพื่อนคุย · ผู้รับฟัง · ลงห้องเสียง · ปลอดภัย
4. Discord OAuth button (Discord brand blue #5865F2)
5. Turnstile captcha (invisible)
6. Terms link

---

### `/` — Home Page (Index)
**Route:** `/`  
**Auth required:** ❌  
**Layout:** 3-column (sidebar + main + right panel)  

**Main content sections (เรียงตามลำดับ):**

**1. Welcome Heading**
- Greeting ตามเวลา (เช้า/บ่าย/เย็น/ดึก) + emoji
- H1: ยินดีต้อนรับ [ชื่อ] 🐻 หรือ ยินดีต้อนรับสู่ Bear Cafe 🐻
- Sub-heading: คำอธิบาย features
- Decorative: ✦ ✧ ✦

**2. CozyFeatureCards**
- 3 feature cards (grid-cols-3)

**3. CommunityCarousel**
- Header + "โปรโมทเซิร์ฟเวอร์" button
- Auto-scroll server cards

**Footer ที่ด้านล่าง**

**Popups (global, non-layout):**
- GreenTeaWarningPopup
- CooldownBox

---

### `/create-session` — Create Session
**Route:** `/create-session`  
**Auth required:** ✅  
**Layout:** full-page, max-w-3xl, gradient background  

**3-step flow:**

**Step 1: เลือกหมวดหมู่**
- Grid 2×N (mobile) / 3×N (desktop) ของ CategoryCards
- ดึงจาก `categories` table (active only, ordered)
- Proceed ได้เมื่อเลือก category แล้ว

**Step 2: รายละเอียด**
- Selected category display
- Role selection grid (ExpandableRoleCards)
  - Required/optional ขึ้นอยู่กับ category config
- Session mode toggle (เฉพาะ category ที่ allow_voice_channel):
  - 💬 แชทส่วนตัว (DM)
  - 🔊 ลงห้องคุย (Voice Room)
- Voice channel status card (realtime จาก Discord bot)
- Note textarea (10–200 chars, banned words check, no links)
- Proceed ได้เมื่อ role selected (ถ้า required) + note valid + voice ready (ถ้าเลือก voice mode)

**Step 3: ยืนยัน**
- DiscordMessagePreview: preview ว่าโพสต์จะออกมายังไง
- RulesSection: กติกาของ category
- Checkbox "ยอมรับกติกา"
- Submit button → เรียก `session-create` edge function

**Error states:**
- Role banned → redirect `/banned-role`
- Active session exists → toast error
- Cooldown active → toast error

---

### `/history` — Session History
**Route:** `/history`  
**Auth required:** ✅  
**Layout:** max-w-2xl, gradient background  

**Header:** back button + title "📜 ประวัติหาเพื่อน" + "ย้อนหลัง 7 วัน"

**Info banner:** "เก็บประวัติย้อนหลัง 7 วัน" alert

**Empty state:** floating Coffee icon + "ยังไม่มีประวัติเลย" + ปุ่ม "เริ่มหาเพื่อน"

**Session card แสดง:**
- Category icon + ชื่อ (header)
- วันเวลา (format: d MMM yy + HH:mm น.)
- รูปแบบ (DM / ลงห้องคุย)
- ห้องเสียง (ถ้า voice_room)
- ยศที่เลือก (badge)
- หมายเหตุ (ถ้ามี)

**Animation:** staggered fade-in per card, hover lift

---

### `/points` — Points Page
**Route:** `/points`  
**Auth required:** ✅  
**Layout:** sidebar + main (ใช้ HomeSidebar ต่างจากหน้าหลัก)  

**Sections:**

1. Header: back button + "แต้มของฉัน ʕ •ᴥ• ʔ" + sub-heading
2. StrawberryJar card:
   - Animated 🍓 jar ที่แสดงระดับ points
   - Points display: `X / MaxCap 🍓`
   - Loading/error states
3. Redeem code card:
   - Input field + ยืนยันโค้ด button
   - Success/error feedback inline
   - RewardPopup on result

**Data:** polls `user_points` table ทุก 10 วิ  
**Currency name:** "สตอเบอรี่" (🍓)

---

### `/discord-servers` — Discord Server Directory
**Route:** `/discord-servers`  
**Auth required:** ❌ (บางฟีเจอร์ต้องการ login)  
**Layout:** full-page, grid view  

**Sections:**

1. Header: back button + title + ปุ่ม "เพิ่มเซิร์ฟเวอร์"
2. Featured Carousel: 3D carousel ของ featured servers (auto-rotate 5s)
3. Search + Filter bar:
   - Search input
   - Category select
   - Sort: recent / popular / rating
   - Toggle: "เฉพาะของฉัน"
4. Expired invite alert (owner only): แจ้งเตือนถ้า invite link หมดอายุ
5. Server grid (responsive): ServerCards

**ServerCard แสดง:**
- Banner image (animate on hover ถ้า verified)
- Server icon + ชื่อ + verified badge
- Category tag + partner badge
- Description
- Star rating (1-5 ดาว)
- Stats: member count, impressions
- Bump button (owner only, 7-day cooldown)
- Refresh button (owner only)
- "เข้าดิสคอร์ด" button

**Features:**
- Impression tracking (IntersectionObserver)
- Star rating (optimistic update)
- Rainbow border animation สำหรับ featured servers
- Server bump (ขยับขึ้นบน, cooldown 7 วัน)
- Add server dialog (owner verification required)

---

### `/healing-message` — Healing Message Board
**Route:** `/healing-message`  
**Auth required:** ✅  
**Layout:** centered, max-w-2xl  

**Sections:**

1. Hero: Heart icon + "กระดานให้กำลังใจ" + description
2. Compose box:
   - Textarea (10–100 chars)
   - Character counter + progress bar (amber → green → red)
   - ส่งข้อความ button
3. Message list:
   - Approved messages: full opacity, hover pink tint
   - Own pending/rejected: dashed border, lower opacity, status pill
   - Empty state: Heart icon + CTA

**Moderation:** ข้อความที่ส่งจะ status = 'pending' รออนุมัติจาก admin ก่อน  
**ข้อความที่อนุมัติแล้วจะปรากฏใน MascotMessage (sidebar) ด้วย**

---

### `/admin/:section` — Admin Panel
**Route:** `/admin/:section`  
**Auth required:** ✅ + staff/admin role  
**Layout:** full-page, tabs navigation  

**Sections available:**
- Users management
- Bans management
- Discord Roles management
- Categories management
- Banned Roles management
- Banners management
- Campaigns management
- Contracts management
- Roles to Delete management

---

### `/banned-role` — Banned Role Page
**Route:** `/banned-role`  
**Auth required:** ❌  
**Layout:** fullscreen message  
Content: แจ้งว่า Discord role ถูกแบน ให้ติดต่อ staff

---

### `/spin-prize` — Spin Prize
**Route:** `/spin-prize`  
**Auth required:** ❌  
**Layout:** fullscreen  
Content: ระบบหมุนวงล้อรางวัล

---

### `/games/bear-boba` หรือ `/bear-boba-merge` — Bear Boba Merge Game
**Routes:** `/games/bear-boba`, `/bear-boba-merge`  
**Auth required:** ❌  
**Layout:** fullscreen game view  
Content: merge puzzle game

---

### `404` — Not Found
**Route:** `*`  
Content: หน้า error แบบ custom

---

### `/maintenance` — Maintenance Page
**Route:** (render ทับ routes อื่นเมื่อ maintenance mode เปิด)  
**Auth required:** ❌  
Content: แจ้ง maintenance พร้อมข้อความจาก admin

---

## 7. User Flows

### Flow 1: Guest → หาเพื่อน (First-time)
```
[เข้า /] 
→ เห็น 3 feature cards → คลิก "หาเพื่อนลงห้อง"
→ redirect → [/login]
→ คลิก "เข้าสู่ระบบด้วย Discord"
→ Discord OAuth
→ redirect → [/auth/callback]
→ redirect → [/] (authenticated)
→ คลิก "หาเพื่อนลงห้อง"
→ [/create-session]
→ Step 1: เลือก category → Next
→ Step 2: เลือก role (ถ้าต้องการ) + เขียน note + เลือก mode → Next
→ Step 3: อ่านกติกา + ยอมรับ → ส่ง
→ Post ถูกส่งไปยัง Discord → redirect [/]
```

### Flow 2: Member → Redeem Code
```
[เข้า /] หรือ [เข้า /points]
→ กรอกโค้ดใน PointsWidget (sidebar ขวา) หรือ PointsPage
→ กด "ยืนยัน"
→ API call → RewardPopup แสดงผล (points / role / both)
→ แต้มอัพเดทใน progress bar
```

### Flow 3: Member → ส่งข้อความให้กำลังใจ
```
[เข้า /healing-message]
→ เขียนข้อความ (10-100 chars)
→ กด "ส่งข้อความ"
→ status = 'pending' → รออนุมัติ
→ เมื่อ admin อนุมัติ → ปรากฏใน message list + MascotMessage (sidebar)
```

### Flow 4: Server Owner → เพิ่มเซิร์ฟเวอร์
```
[เข้า /discord-servers]
→ คลิก "เพิ่มเซิร์ฟเวอร์"
→ ต้อง login ก่อน (ถ้ายังไม่ได้ login)
→ Dialog: กรอก invite URL + เลือก category
→ API verify: ตรวจสอบว่า user เป็น owner
→ ส่งคำขอ → status = 'pending' (รอ admin approve)
```

### Flow 5: Login → Green Tea Warning
```
[ล็อกอินสำเร็จ]
→ ระบบตรวจสอบ Discord role
→ ถ้ามียศ "ถ้วยชาเขียว" → GreenTeaWarningPopup
→ กด "รับทราบ" → popup ปิด → ใช้งานได้ตามปกติ
```

---

## 8. State Matrix

### หน้าหลัก (CozyFeatureCards - Card 3)

| Condition | UI State |
|-----------|----------|
| Not authenticated | Card active, click → /login |
| Authenticated, member, no cooldown | Card active, voice count visible |
| Authenticated, member, cooldown active | Card disabled, countdown badge (destructive) |
| Authenticated, not a Discord member | Card disabled, "เข้าร่วม Discord ฟรี" button |
| Membership loading | `isMember = null` (shows nothing extra) |

### CozyRightPanel

| Auth State | UI |
|------------|-----|
| Not logged in | ProfileCard: ปุ่ม "เข้าสู่ระบบ ☕" |
| Logged in | ProfileCard: avatar + ชื่อ |
| Logged in | PointsWidget: แสดงแต้ม + redeem |
| Not logged in | PointsWidget: ซ่อนทั้งหมด (returns null) |

### Create Session - Step 2 Voice Mode

| Condition | UI |
|-----------|-----|
| DM mode selected | ไม่แสดง voice status card |
| Voice mode selected, not in voice | Warning alert + disabled proceed |
| Voice mode selected, in voice | Success card "กำลังอยู่ในห้องเสียง" + voice name |
| Loading voice state | Spinner |

### CooldownBox

| State | Position |
|-------|----------|
| No cooldown | ซ่อน |
| Cooldown active, mobile, expanded | แสดงเต็ม (lock icon + timer + minutes) |
| Cooldown active, mobile, collapsed | แสดงแค่ lock icon + timer |
| Cooldown active, desktop | แสดงเต็มตลอด |

---

## 9. Responsive Behavior

### Breakpoints (Tailwind)
| Breakpoint | px | พฤติกรรม |
|------------|-----|---------|
| (default) | < 640 | Mobile: sidebar/right panel hidden |
| `sm` | ≥ 640 | Larger padding, text sizes |
| `lg` | ≥ 1024 | Left sidebar แสดง, mobile toggle ซ่อน |
| `xl` | ≥ 1280 | Right panel แสดง, mobile toggle ซ่อน |

### Layout Behavior per Screen

| Zone | Mobile | Tablet (lg) | Desktop (xl+) |
|------|--------|-------------|---------------|
| Left Sidebar | Overlay (hamburger) | Visible | Visible |
| Main Content | Full width + top padding | Full width | Flexible |
| Right Panel | Overlay (🍓 toggle) | Overlay | Visible |
| Feature Cards | 1–2 cols (cramped) | 2–3 cols | 3 cols |
| Carousel | horizontal scroll | horizontal scroll | horizontal scroll |
| CooldownBox | collapsible | collapsible | always expanded |

### Mobile-specific
- `pt-16` padding top สำหรับ fixed toggle buttons
- `h-[100dvh]` ใช้ dynamic viewport height
- MascotMessage: ซ่อนถ้า `max-height: 680px`
- `homepage-zoom` class อาจมีผลกับ zoom level

---

## 10. Animation & Motion

### Library: Framer Motion

| Element | Animation |
|---------|-----------|
| Welcome heading | `opacity: 0→1, y: 14→0, duration: 0.45s` |
| Feature cards | `opacity: 0→1, y: 16→0, delay: 0.1s` |
| Community carousel | `opacity: 0→1, y: 16→0, delay: 0.2s` |
| Feature card (active) | hover: `y: -4, scale: 1.02` / tap: `scale: 0.98` |
| Server cards (carousel) | hover: `y: -4, scale: 1.02` |
| CooldownBox | mount: `opacity: 0→1, x: 20→0` |
| CooldownBox lock icon | pulse: `scale: 1→1.3→1, opacity: 0.5→0→0.5` loop |
| MascotMessage | message: fade in/out 0.3s |
| AnimatedBear | float: `y: 0→-3→0, 2s loop` |
| AnimatedBear wave | `rotate: 0→-5→5→-5→0, 0.8s` |
| PointsWidget progress bar | `width: 0→X%, 0.6s easeOut` |
| Session history cards | staggered: `delay: index × 0.04s` |
| GreenTeaWarningPopup icon | spring: `scale: 0→1, stiffness: 260, damping: 20` |

### Motion Principles
- ทุก animation ต้องรู้สึก **gentle** ไม่ aggressive
- ใช้ `easeInOut` เป็น default
- Stagger cards เสมอเมื่อแสดงเป็น list
- Hover effect ทำให้ card "ลอย" เล็กน้อย (y: -4)
- ไม่ใช้ fast bounce หรือ flashy effects

---

## 11. Known UX Issues & Notes

### จุดที่ควรพิจารณาใน Redesign

1. **Feature Cards ที่ disabled (2 ใน 3)**  
   Cards "สุ่มแชทคุย" และ "หาโต๊ะคุย" อยู่ในสถานะ coming-soon  
   → ผู้ใช้ใหม่อาจเข้าใจผิดว่าแอปมีแค่ 1 ฟีเจอร์  
   → พิจารณา: แสดงเป็น teaser? หรือซ่อน?

2. **Right Panel ซ่อนอยู่บน Tablet**  
   Points widget ไม่แสดงโดย default บน mobile/tablet  
   → ผู้ใช้ mobile อาจไม่รู้ว่ามี points system

3. **No visual feedback ว่า Create Session สำเร็จ**  
   หลัง submit → redirect กลับ `/` ไม่มี success state ชัดเจน  
   (มีแค่ toast notification)

4. **MascotMessage ซ่อนเมื่อ viewport เล็ก**  
   ถ้า user ย่อ browser window ต่ำกว่า 680px จะไม่เห็น mascot  

5. **Homepage zoom**  
   มี class `homepage-zoom` ที่อาจส่งผลต่อ rendering ในบาง device

6. **3-column feature cards บน mobile เล็กมาก**  
   `grid-cols-3` fixed บน viewport เล็ก → card อาจแคบเกินไป

7. **CooldownBox position conflict กับ right panel toggle (🍓)**  
   ทั้งคู่ fixed top-4 right-4 — อาจ overlap กันในบาง state

8. **Redeem code ซ้ำซ้อนใน 2 ที่**  
   CozyRightPanel และ PointsPage มี redeem form ทั้งคู่  
   → ผู้ใช้อาจงงว่าต้องไปที่ไหน

---

## 12. Source File Map

### Pages
| หน้า | ไฟล์ |
|------|-------|
| Landing | `src/pages/LandingPage.tsx` |
| Login | `src/pages/LoginPage.tsx` |
| Home | `src/pages/Index.tsx` |
| Create Session | `src/pages/CreateSessionPage.tsx` |
| Session History | `src/pages/SessionHistoryPage.tsx` |
| Points | `src/pages/PointsPage.tsx` |
| Discord Servers | `src/pages/DiscordServersPage.tsx` |
| Healing Message | `src/pages/HealingMessagePage.tsx` |
| Spin Prize | `src/pages/SpinPrizePage.tsx` |
| Bear Boba Game | `src/pages/BearBobaMergePage.tsx` |
| Admin | `src/pages/AdminPage.tsx` |
| Banned Role | `src/pages/RoleBannedPage.tsx` |
| Banned | `src/pages/BannedPage.tsx` |
| Maintenance | `src/pages/MaintenancePage.tsx` |
| Not Found | `src/pages/NotFound.tsx` |
| Auth Callback | `src/pages/AuthCallbackPage.tsx` |

### Core Layout Components (หน้าหลัก)
| Component | ไฟล์ |
|-----------|-------|
| Left Sidebar | `src/components/bear-cafe/CozySidebar.tsx` |
| Feature Cards | `src/components/bear-cafe/CozyFeatureCards.tsx` |
| Community Carousel | `src/components/bear-cafe/CommunityCarousel.tsx` |
| Right Panel | `src/components/bear-cafe/CozyRightPanel.tsx` |
| Mascot Message | `src/components/bear-cafe/MascotMessage.tsx` |
| Footer | `src/components/bear-cafe/Footer.tsx` |
| Bear Logo | `src/components/bear-cafe/BearLogo.tsx` |
| Loading Bear | `src/components/bear-cafe/LoadingBear.tsx` |
| Green Tea Popup | `src/components/bear-cafe/GreenTeaWarningPopup.tsx` |
| Cooldown Box | `src/components/bear-cafe/CooldownBox.tsx` |
| Reward Popup | `src/components/bear-cafe/RewardPopup.tsx` |
| Strawberry Jar | `src/components/bear-cafe/StrawberryJar.tsx` |
| Floating Mini Player | `src/components/bear-cafe/FloatingMiniPlayer.tsx` |

### Session Components
| Component | ไฟล์ |
|-----------|-------|
| Page Header | `src/components/bear-cafe/PageHeader.tsx` |
| Step Indicator | `src/components/bear-cafe/StepIndicator.tsx` |
| Category Card | `src/components/bear-cafe/CategoryCard.tsx` |
| Expandable Role Card | `src/components/bear-cafe/ExpandableRoleCard.tsx` |
| Rules Section | `src/components/bear-cafe/RulesSection.tsx` |
| Discord Message Preview | `src/components/bear-cafe/DiscordMessagePreview.tsx` |
| Icon Display | `src/components/bear-cafe/IconDisplay.tsx` |
| Active Session Card | `src/components/bear-cafe/ActiveSessionCard.tsx` |

### Discord Server Components
| Component | ไฟล์ |
|-----------|-------|
| Expired Server Card | `src/components/discord/ExpiredServerCard.tsx` |
| Edit Link Dialog | `src/components/discord/EditLinkDialog.tsx` |

### Admin Components
| Component | ไฟล์ |
|-----------|-------|
| Admin sections | `src/components/admin/*.tsx` |

### Design Assets
| Asset | Path |
|-------|-------|
| Bear Mascot | `src/assets/bear-mascot.png` |
| Bear Cafe Logo | `src/assets/bear-cafe-logo.png` |
| Strawberry Icon | `src/assets/strawberry-icon.png` |
| Point Icon | `src/assets/point-icon.png` |
| History Icon | `src/assets/history-icon.png` |
| Rule Icon | `src/assets/rule-icon.png` |
| Setting Icon | `src/assets/setting-icon.png` |
| Light/Dark mode icons | `src/assets/lightmode-icon.png`, `darkmode-icon.png` |
| Feature card images | `public/icons/SecretCafe-1.png`, `SecretCafe-2.png`, `SecretCafe-3.png` |
| Strawberry Jar Video (light) | `src/assets/strawberry-jar-light.mp4` |
| Strawberry Jar Video (dark) | `src/assets/strawberry-jar.mp4` |
| Design System Doc | `design-system.md` |

### Routing
| ไฟล์ | หน้าที่ |
|-------|---------|
| `src/App.tsx` | Route definitions, AuthProvider, ThemeProvider |
| `src/lib/auth-context.tsx` | Auth state management |

---

*เอกสารนี้สร้างจากการอ่าน source code โดยตรง — ข้อมูลทุกอย่างสะท้อนสิ่งที่ implement จริง*
