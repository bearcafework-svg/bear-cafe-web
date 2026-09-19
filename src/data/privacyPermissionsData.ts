export type PrivacyStatus = 
  | 'Confirmed' 
  | 'Not Found' 
  | 'Unknown' 
  | 'Needs Review' 
  | 'Demo / Development';

export interface SystemOverviewItem {
  id: string;
  name: string;
  project: string;
  role: string;
  database: string;
  tempStorage?: string;
  externalServices: { name: string; status: PrivacyStatus; note: string }[];
  status: PrivacyStatus;
}

export interface DataTypeItem {
  id: string;
  category: string;
  name: string;
  system: 'bearcafe-bot' | 'bear-cafe-web' | 'ทั้งสองระบบ';
  storage: string;
  purpose: string;
  retention: string;
  deletable: 'ลบได้' | 'ลบไม่ได้' | 'ลบอัตโนมัติ' | 'ไม่สามารถยืนยันได้';
  status: PrivacyStatus;
  evidence: string;
}

export interface ThirdPartyServiceItem {
  name: string;
  project: 'bearcafe-bot' | 'bear-cafe-web' | 'ทั้งสองระบบ';
  dataSent: string;
  purpose: string;
  isDataStored: 'Confirmed' | 'Not Found' | 'Unknown';
  retentionNote: string;
  status: PrivacyStatus;
}

export interface RetentionItem {
  tableOrData: string;
  system: 'bearcafe-bot' | 'bear-cafe-web' | 'ทั้งสองระบบ';
  retention: string;
  deleteMethod: string;
  hasAutoDelete: boolean;
  evidence: string;
  status: PrivacyStatus;
}

export interface AccessControlItem {
  actor: string;
  accessibleData: string;
  accessLevel: string;
  implementationNote: string;
  status: PrivacyStatus;
}

export interface UserDataRightItem {
  id: string;
  right: string;
  description: string;
  supportLevel: 'Supported' | 'Partially Supported' | 'Not Implemented' | 'Unknown';
  note: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  checked: boolean;
}

export const PRIVACY_METADATA = {
  title: 'การจัดการข้อมูลและความเป็นส่วนตัว',
  subtitle: 'หน้านี้ใช้สำหรับตรวจสอบว่าระบบ Bear Café มีการเก็บ ใช้ และเข้าถึงข้อมูลประเภทใดบ้าง เพื่อให้ข้อมูลที่ใช้จัดทำ Privacy Policy มีความถูกต้องและตรวจสอบย้อนกลับได้',
  statusLabel: 'Privacy Data Overview',
  lastAuditDate: '17 กันยายน 2026', // วันที่ทำการตรวจสอบโค้ดจริงล่าสุด
};

export const SYSTEM_OVERVIEWS: SystemOverviewItem[] = [
  {
    id: 'bot',
    name: 'Bear Café Bot',
    project: 'bearcafe-bot',
    role: 'ระบบ Bot จัดการชุมชน, Voice Room อัตโนมัติ, มินิเกม, เควสต์ และระบบรักษาความปลอดภัยภายใน Discord',
    database: 'Supabase PostgreSQL (เชื่อมต่อผ่าน Service Role Key)',
    tempStorage: 'Upstash Redis (ใช้สำหรับ Rate Limiting, Anti-Spam, Anti-Nuke มี TTL อัตโนมัติ)',
    externalServices: [
      { name: 'Discord API', status: 'Confirmed', note: 'รับส่ง Event, จัดการห้องเสียง และข้อความคำสั่งผ่าน Gateway' },
      { name: 'Google Translate TTS', status: 'Confirmed', note: 'แปลงเฉลยคำศัพท์เป็นเสียงใน Minigame 5 และ 11 (พักเสียงใน RAM ไม่เซฟลง Disk)' },
      { name: 'Upstash Redis', status: 'Confirmed', note: 'แคชชั่วคราวสำหรับความปลอดภัย (Auto-expire 10 วินาที)' },
    ],
    status: 'Confirmed',
  },
  {
    id: 'web',
    name: 'Bear Café Website',
    project: 'bear-cafe-web',
    role: 'เว็บไซต์แดชบอร์ดสมาชิก แลกของรางวัล ตรวจสอบสถิติ แต้มสะสม และคลังไอเทม',
    database: 'Supabase PostgreSQL (เชื่อมต่อผ่าน Anon Key + Supabase Auth RLS)',
    externalServices: [
      { name: 'Discord OAuth2', status: 'Confirmed', note: 'ขอ Scope: identify และ guilds เพื่อระบุตัวตนและตรวจสอบเซิร์ฟเวอร์' },
      { name: 'Cloudflare Turnstile', status: 'Confirmed', note: 'ระบบยืนยันตัวตนป้องกัน Bot ที่หน้า /login และ /healing-message (ไม่เก็บ IP/Token ลง Database)' },
      { name: 'Vercel', status: 'Confirmed', note: 'บริการโฮสติ้ง Frontend (ไม่พบการติดตั้ง Vercel Analytics ในโค้ด runtime)' },
    ],
    status: 'Confirmed',
  },
];

export const DATA_TYPES: DataTypeItem[] = [
  // Discord Account Data
  {
    id: 'acc-1',
    category: 'Discord Account Data',
    name: 'Discord User ID',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (ตาราง users, profiles, points ฯลฯ) / browser localStorage',
    purpose: 'ใช้เป็น Unique Identifier อ้างอิงบัญชีผู้ใช้ คะแนน ไอเทม และประวัติการทำรายการ',
    retention: 'เก็บตามอายุการใช้งานบัญชี',
    deletable: 'ลบได้เมื่อมีการร้องขอ',
    status: 'Confirmed',
    evidence: 'src/lib/auth-context.tsx, handlers/profile.js',
  },
  {
    id: 'acc-2',
    category: 'Discord Account Data',
    name: 'Username & Display Name',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (ตาราง profiles) / แคชใน Client session',
    purpose: 'แสดงผลชื่อในหน้าโปรไฟล์ แดชบอร์ด และข้อความแจ้งเตือน',
    retention: 'อัปเดตอัตโนมัติตามข้อมูล Discord ล่าสุด',
    deletable: 'ลบได้เมื่อมีการร้องขอ',
    status: 'Confirmed',
    evidence: 'discord-auth Edge Function, handlers/profile.js',
  },
  {
    id: 'acc-3',
    category: 'Discord Account Data',
    name: 'Avatar URL',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (ตาราง profiles) / Discord CDN cache',
    purpose: 'แสดงรูปโปรไฟล์ของผู้ใช้ในหน้าเว็บและระบบ Bot',
    retention: 'อัปเดตตาม Discord CDN',
    deletable: 'ลบได้เมื่อมีการร้องขอ',
    status: 'Confirmed',
    evidence: 'src/components/bear-cafe/CozyHeader.tsx',
  },

  // Discord Server Data
  {
    id: 'srv-1',
    category: 'Discord Server Data',
    name: 'Guild ID & Guild Name',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (เฉพาะ Bear Café server ID) / ประมวลผลใน Memory',
    purpose: 'ตรวจสอบการเป็นสมาชิกของ Bear Café เพื่อปลดล็อกสิทธิ์ใช้งานเว็บไซต์',
    retention: 'ไม่พบบันทึกรายชื่อ Guild อื่นลง Database ถาวร',
    deletable: 'ไม่สามารถยืนยันได้',
    status: 'Confirmed',
    evidence: 'discord-auth Edge Function กรอง Guild ใน Memory และไม่ Insert guild อื่น',
  },
  {
    id: 'srv-2',
    category: 'Discord Server Data',
    name: 'Role & Permission Information',
    system: 'ทั้งสองระบบ',
    storage: 'อ่านผ่าน Discord API (Bot Token) ณ ตอน Login / ตรวจสอบสิทธิ์',
    purpose: 'ตรวจสอบบทบาท Staff, Owner หรือ Role-ban ก่อนอนุญาตให้เข้าแดชบอร์ด',
    retention: 'ประมวลผลชั่วคราวขณะเข้าสู่ระบบ ไม่บันทึก Role list ทั้งหมดลง DB',
    deletable: 'ไม่สามารถยืนยันได้',
    status: 'Confirmed',
    evidence: 'supabase/functions/discord-auth/index.ts',
  },

  // Voice Activity
  {
    id: 'vc-1',
    category: 'Voice Activity',
    name: 'Voice Join / Leave / Move & Duration',
    system: 'bearcafe-bot',
    storage: 'Supabase (ตาราง voice_logs, voice_sessions)',
    purpose: 'คำนวณคะแนนกิจกรรมการพูดคุยและสถิติเวลาในห้องเสียง (Voice Activity Points)',
    retention: 'เก็บบันทึกประวัติกิจกรรม',
    deletable: 'ไม่พบการลบอัตโนมัติ',
    status: 'Confirmed',
    evidence: 'handlers/voiceStateHandler.js, voiceManager.js',
  },
  {
    id: 'vc-2',
    category: 'Voice Activity',
    name: 'Voice Audio Recording (บันทึกเสียง)',
    system: 'bearcafe-bot',
    storage: 'ไม่บันทึก',
    purpose: 'ระบบไม่มีการดักฟังหรือบันทึกเสียงสนทนาของผู้ใช้งานในห้องเสียงใด ๆ ทั้งสิ้น',
    retention: 'ไม่มีการจัดเก็บ',
    deletable: 'ลบอัตโนมัติ',
    status: 'Not Found',
    evidence: 'ตรวจสอบโครงสร้าง voiceHandler พบว่าไม่มี receiver หรือ audio stream writing',
  },

  // Community / Activity Data
  {
    id: 'act-1',
    category: 'Community & Activity',
    name: 'Points & Transaction Ledger',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (ตาราง points, trading_history, point_transactions)',
    purpose: 'บันทึกคะแนนสะสม การโอนคะแนน และประวัติการทำธุรกรรมในคาเฟ่',
    retention: 'เก็บบันทึกแบบ Append-only เพื่อตรวจสอบความถูกต้องย้อนหลัง',
    deletable: 'ไม่พบการลบอัตโนมัติ',
    status: 'Confirmed',
    evidence: 'src/pages/PointsPage.tsx, handlers/transfer.js',
  },
  {
    id: 'act-3',
    category: 'Community & Activity',
    name: 'Minigame & Gacha Wins',
    system: 'ทั้งสองระบบ',
    storage: 'Supabase (ตาราง minigame_wins, user_bee_gacha, inventory)',
    purpose: 'บันทึกประวัติการสุ่มกาชา รายการของรางวัลที่ได้รับ และไอเทมในคลัง',
    retention: 'เก็บบันทึกประวัติผู้เล่น',
    deletable: 'ไม่พบการลบอัตโนมัติ',
    status: 'Confirmed',
    evidence: 'src/pages/GachaPage.tsx, minigames.js',
  },
  {
    id: 'act-4',
    category: 'Community & Activity',
    name: 'Flower Delivery Sessions',
    system: 'bearcafe-bot',
    storage: 'Supabase (ตาราง flower_sessions)',
    purpose: 'จัดส่งดอกไม้และข้อความอวยพรระหว่างสมาชิกในเซิร์ฟเวอร์',
    retention: 'ลบออกทันทีเมื่อผู้รับกดตอบรับ/ปฏิเสธ หรือหมดเวลา Session',
    deletable: 'ลบอัตโนมัติ',
    status: 'Confirmed',
    evidence: 'handlers/flowerHandler.js',
  },
  {
    id: 'act-5',
    category: 'Community & Activity',
    name: 'Smart Room & Rent House Presets',
    system: 'bearcafe-bot',
    storage: 'Supabase (ตาราง smart_room_presets, rent_house_settings)',
    purpose: 'บันทึกการตั้งค่าห้องเสียงส่วนตัว (ชื่อห้อง, ลิมิตคน, สถานะล็อก/ซ่อน, รายชื่อ Trusted/Blocked)',
    retention: 'เก็บตลอดอายุการใช้งานห้องหรือจนกว่าผู้ใช้จะรีเซ็ตการตั้งค่า',
    deletable: 'ลบได้เมื่อผู้ใช้รีเซ็ตห้อง',
    status: 'Confirmed',
    evidence: 'handlers/roomPanel.js, handlers/rentHousePanel.js',
  },

  // Website Session Data
  {
    id: 'web-1',
    category: 'Website Session Data',
    name: 'Supabase Auth Tokens',
    system: 'bear-cafe-web',
    storage: 'Client localStorage (คีย์ sb-<project-ref>-auth-token)',
    purpose: 'รักษา Session การเข้าสู่ระบบของสมาชิกบนแดชบอร์ด',
    retention: 'คงอยู่จนกว่าจะหมดอายุหรือผู้ใช้กดออกจากระบบ (Logout)',
    deletable: 'ลบได้ทันทีเมื่อกด Logout',
    status: 'Confirmed',
    evidence: 'src/lib/supabase.ts, src/lib/auth-context.tsx',
  },
  {
    id: 'web-2',
    category: 'Website Session Data',
    name: 'Third-Party Web Tracking (Google/Vercel/Meta)',
    system: 'bear-cafe-web',
    storage: 'ไม่พบใน Client storage',
    purpose: 'ไม่มีการส่งข้อมูลพฤติกรรมไปยังบริการวิเคราะห์ข้อมูลภายนอก',
    retention: 'ไม่มีการจัดเก็บ',
    deletable: 'ลบอัตโนมัติ',
    status: 'Not Found',
    evidence: 'สแกน package.json และ index.html ไม่พบสคริปต์ Tracking ใด ๆ',
  },
];

export const THIRD_PARTY_SERVICES: ThirdPartyServiceItem[] = [
  {
    name: 'Discord API & Gateway',
    project: 'ทั้งสองระบบ',
    dataSent: 'Discord User ID, Scopes (identify, guilds), Bot Token, Channel/Voice Events',
    purpose: 'ยืนยันตัวตนผู้ใช้ (OAuth2), จัดการห้องเสียง และส่งข้อความแจ้งเตือน',
    isDataStored: 'Confirmed',
    retentionNote: 'อยู่ภายใต้ Privacy Policy และ Retention Policy ของ Discord Inc.',
    status: 'Confirmed',
  },
  {
    name: 'Supabase (PostgreSQL & Auth)',
    project: 'ทั้งสองระบบ',
    dataSent: 'ข้อมูลผู้ใช้ คะแนน ประวัติกิจกรรม ธุรกรรม และการตั้งค่าระบบ',
    purpose: 'ฐานข้อมูลหลัก (Database) สำหรับจัดเก็บข้อมูลระบบทั้งหมด',
    isDataStored: 'Confirmed',
    retentionNote: 'จัดเก็บตามเงื่อนไข Retention ของแต่ละตารางที่ระบบกำหนด',
    status: 'Confirmed',
  },
  {
    name: 'Upstash Redis',
    project: 'bearcafe-bot',
    dataSent: 'Event counts, Rate-limit keys, Temporary security timestamps',
    purpose: 'ระบบแคชป้องกันการโจมตี (Anti-Spam, Anti-Nuke) และ Rate Limiting',
    isDataStored: 'Confirmed',
    retentionNote: 'ลบอัตโนมัติผ่าน Time-to-Live (TTL 10-60 วินาที)',
    status: 'Confirmed',
  },
  {
    name: 'Cloudflare Turnstile',
    project: 'bear-cafe-web',
    dataSent: 'Turnstile Challenge Token (ส่งไป Verify ที่ Endpoint ของ Cloudflare)',
    purpose: 'ป้องกันการใช้บอทโจมตีหน้าเข้าสู่ระบบและหน้าส่งข้อความฮีลใจ',
    isDataStored: 'Unknown',
    retentionNote: 'ไม่สามารถยืนยันระยะเวลาการเก็บรักษาจาก source code ของ Bear Café (ทางเว็บไม่ได้เก็บ Token/IP ลง DB)',
    status: 'Confirmed',
  },
  {
    name: 'Google Translate TTS API',
    project: 'bearcafe-bot',
    dataSent: 'ข้อความเฉลยคำศัพท์จากระบบมินิเกม (EN/TH)',
    purpose: 'แปลงข้อความคำศัพท์เป็นเสียง Audio สำหรับมินิเกมทายคำ',
    isDataStored: 'Unknown',
    retentionNote: 'ไม่สามารถยืนยันระยะเวลาการเก็บรักษาจาก source code ของ Bear Café (ทางบอทพักไฟล์เสียงใน RAM ชั่วคราว)',
    status: 'Confirmed',
  },
  {
    name: 'Vercel Hosting',
    project: 'bear-cafe-web',
    dataSent: 'HTTP Request Headers, IP Address ในระดับ Edge/CDN Web Server',
    purpose: 'ให้บริการโฮสต์เว็บไซต์และระบบส่งต่อข้อมูลเนื้อหา (CDN)',
    isDataStored: 'Unknown',
    retentionNote: 'อยู่ภายใต้มาตรฐาน Log Retention และ Security Policy ของ Vercel',
    status: 'Confirmed',
  },
];

export const RETENTION_TABLE: RetentionItem[] = [
  {
    tableOrData: 'flower_sessions',
    system: 'bearcafe-bot',
    retention: 'ชั่วคราว (ไม่กี่นาที)',
    deleteMethod: 'ลบอัตโนมัติเมื่อกดตอบรับ/ปฏิเสธ หรือหมดอายุ Session',
    hasAutoDelete: true,
    evidence: 'handlers/flowerHandler.js',
    status: 'Confirmed',
  },
  {
    tableOrData: 'guild_structure_backups',
    system: 'bearcafe-bot',
    retention: 'เก็บสูงสุด 5 ชุดล่าสุดต่อเซิร์ฟเวอร์',
    deleteMethod: 'ลบสำเนาเก่าอัตโนมัติเมื่อมีแบ็กอัปใหม่เกิน 5 ชุด',
    hasAutoDelete: true,
    evidence: 'src/features/security/backupManager.js',
    status: 'Confirmed',
  },
  {
    tableOrData: 'Upstash Redis Security Keys',
    system: 'bearcafe-bot',
    retention: '10 - 60 วินาที',
    deleteMethod: 'ลบอัตโนมัติด้วย Redis Key TTL',
    hasAutoDelete: true,
    evidence: 'src/features/security/antiSpam.js, antiNuke.js',
    status: 'Confirmed',
  },
  {
    tableOrData: 'voice_logs / voice_sessions',
    system: 'bearcafe-bot',
    retention: 'ไม่พบการลบอัตโนมัติ',
    deleteMethod: 'จัดเก็บแบบถาวรเพื่อใช้อ้างอิงการคิดแต้มย้อนหลัง',
    hasAutoDelete: false,
    evidence: 'handlers/voiceStateHandler.js',
    status: 'Needs Review',
  },
  {
    tableOrData: 'trading_history / orders',
    system: 'ทั้งสองระบบ',
    retention: 'ไม่พบการลบอัตโนมัติ',
    deleteMethod: 'บันทึก Ledger ทางธุรกรรม ไม่พบลอจิก Auto-Purge ในโค้ด',
    hasAutoDelete: false,
    evidence: 'handlers/transfer.js, src/pages/PointsPage.tsx',
    status: 'Needs Review',
  },
  {
    tableOrData: 'minigame_wins / user_bee_gacha',
    system: 'ทั้งสองระบบ',
    retention: 'ไม่พบการลบอัตโนมัติ',
    deleteMethod: 'บันทึกประวัติการชนะและการเปิดกาชาสะสม',
    hasAutoDelete: false,
    evidence: 'handlers/gacha.js, minigames.js',
    status: 'Needs Review',
  },
  {
    tableOrData: 'smart_room_presets / rent_house_settings',
    system: 'bearcafe-bot',
    retention: 'จนกว่าผู้ใช้จะกดรีเซ็ตหรือลบห้อง',
    deleteMethod: 'ลบผ่านคำสั่งรีเซ็ตของผู้ใช้ (User Action)',
    hasAutoDelete: false,
    evidence: 'handlers/roomPanel.js, rentHousePanel.js',
    status: 'Confirmed',
  },
  {
    tableOrData: 'tag_warn_logs (Security / Moderation)',
    system: 'bearcafe-bot',
    retention: 'ไม่พบการลบอัตโนมัติ',
    deleteMethod: 'บันทึกประวัติการตักเตือนผู้ใช้ ไม่พบลอจิก Auto-Purge ในโค้ด',
    hasAutoDelete: false,
    evidence: 'handlers/tagWarn.js',
    status: 'Needs Review',
  },
];

export const ACCESS_CONTROL_ITEMS: AccessControlItem[] = [
  {
    actor: 'Bear Café Website (Client Dashboard)',
    accessibleData: 'ข้อมูลโปรไฟล์ของตนเอง, แต้มสะสม, ประวัติการแลกของรางวัล, รายการเซิร์ฟเวอร์ที่เข้าได้',
    accessLevel: 'Read / Write ตาม Supabase Auth RLS Policies (เข้าถึงได้เฉพาะข้อมูลตนเอง)',
    implementationNote: 'เข้าถึงผ่าน Supabase Anon Key โดยส่ง Bearer Token ของตนเองเสมอ',
    status: 'Confirmed',
  },
  {
    actor: 'Bear Café Bot (Service Worker / Gateway)',
    accessibleData: 'ข้อมูลสมาชิกในเซิร์ฟเวอร์, สถานะห้องเสียง, ตารางเควสต์, สถิติคะแนน, ประวัติแบ็กอัป',
    accessLevel: 'Full Read / Write ตาม Service Role',
    implementationNote: 'ใช้ Supabase Service Role Key บนเครื่องรันบอท ไม่เปิดเผยให้บุคคลภายนอก',
    status: 'Confirmed',
  },
  {
    actor: 'Authorized Staff / Admins',
    accessibleData: 'ข้อมูลจัดการระบบ, รายการแลกของรางวัล, การตั้งค่ากิจกรรม และระบบสิทธิ์พิเศษ',
    accessLevel: 'เข้าถึงเฉพาะหน้าแดชบอร์ดที่ได้รับมอบหมายใน allowed_pages',
    implementationNote: 'ตรวจสอบสิทธิ์ผ่าน Supabase profiles.allowed_pages และ is_owner flag',
    status: 'Confirmed',
  },
  {
    actor: 'General Members (ผู้ใช้ทั่วไป)',
    accessibleData: 'ข้อมูลสาธารณะในเซิร์ฟเวอร์, ลีดเดอร์บอร์ด และข้อมูลส่วนตัวของตนเอง',
    accessLevel: 'Restricted (RLS บล็อกการดูข้อมูลส่วนบุคคลหรือแต้มของผู้อื่น)',
    implementationNote: 'ไม่สามารถดูสลิปโอนเงิน หรือข้อมูลส่วนตัวของผู้อื่นผ่านหน้าเว็บได้',
    status: 'Confirmed',
  },
];

export const USER_DATA_RIGHTS: UserDataRightItem[] = [
  {
    id: 'right-1',
    right: 'สิทธิในการเข้าถึงข้อมูล (Right to Access)',
    description: 'ผู้ใช้สามารถตรวจสอบข้อมูลส่วนตัว แต้มสะสม คลังไอเทม และประวัติการทำรายการของตนเองได้ตลอดเวลาผ่านแดชบอร์ดเว็บไซต์',
    supportLevel: 'Supported',
    note: 'เข้าถึงผ่านหน้า / และ /points ได้ทันทีเมื่อเข้าสู่ระบบด้วย Discord',
  },
  {
    id: 'right-2',
    right: 'สิทธิในการแก้ไขข้อมูล (Right to Rectification)',
    description: 'ชื่อและรูปโปรไฟล์จะอัปเดตอัตโนมัติตาม Discord ส่วนการตั้งค่าห้องเสียงสามารถแก้ไขได้ผ่านแผงควบคุมใน Discord',
    supportLevel: 'Supported',
    note: 'อัปเดตผ่าน Discord API sync และคำสั่งบอท',
  },
  {
    id: 'right-3',
    right: 'สิทธิในการขอลบข้อมูล (Right to Erasure / Deletion)',
    description: 'ผู้ใช้สามารถแจ้งความประสงค์ขอลบบัญชีและข้อมูลส่วนตัวออกจากฐานข้อมูล Bear Café ได้โดยติดต่อทีมงานหรือส่งคำขอ',
    supportLevel: 'Partially Supported',
    note: 'ปัจจุบันยังไม่มีปุ่มกดลบอัตโนมัติในหน้าเว็บ ต้องดำเนินการผ่านคำขอแอดมินเพื่อล้างข้อมูลในตารางที่เกี่ยวข้อง',
  },
  {
    id: 'right-4',
    right: 'สิทธิในการเพิกถอนการเชื่อมต่อ (Revoke Discord OAuth)',
    description: 'ผู้ใช้สามารถถอนสิทธิ์การเข้าถึงของ Bear Café Web App ได้ตลอดเวลาผ่านหน้า Authorized Apps ใน Discord Settings',
    supportLevel: 'Supported',
    note: 'ดำเนินการผ่านเมนู User Settings -> Authorized Apps ในแอป Discord',
  },
  {
    id: 'right-5',
    right: 'การลบข้อมูลตามกำหนดเวลา (Automatic Deletion)',
    description: 'ระบบมีการลบข้อมูลชั่วคราว ข้อมูลเควสต์เก่า และสำรองข้อมูลโครงสร้างเซิร์ฟเวอร์ตามระยะเวลาที่ระบบกำหนดไว้อัตโนมัติ',
    supportLevel: 'Supported',
    note: 'เควสต์เก่าลบทุก 7-30 วัน, Flower Session ลบทันที, Backup เก็บเฉพาะ 5 ชุดล่าสุด',
  },
];

export const PRIVACY_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'chk-1', category: 'OAuth & Access', label: 'ตรวจสอบ Discord OAuth scopes (ขอเฉพาะ identify และ guilds)', checked: true },
  { id: 'chk-2', category: 'OAuth & Access', label: 'ตรวจสอบการอ่านข้อมูล Guild (ใช้เฉพาะ Bear Café ID ไม่บันทึก Guild อื่น)', checked: true },
  { id: 'chk-3', category: 'Storage & Security', label: 'ตรวจสอบ Browser Storage (เก็บ Auth Token ใน localStorage ไม่พบ Cookie ผิดปกติ)', checked: true },
  { id: 'chk-4', category: 'Storage & Security', label: 'ตรวจสอบ Analytics / Tracking (ไม่พบการติดตั้งสคริปต์สอดแนมบุคคลที่สาม)', checked: true },
  { id: 'chk-5', category: 'Storage & Security', label: 'ตรวจสอบ Cloudflare Turnstile (ตรวจสอบเฉพาะ Token ไม่บันทึก IP ลงฐานข้อมูล)', checked: true },
  { id: 'chk-6', category: 'Database & RLS', label: 'ตรวจสอบ Supabase tables และ Row Level Security (RLS ป้องกันผู้ใช้อื่นเข้าถึงข้อมูล)', checked: true },
  { id: 'chk-7', category: 'Database & RLS', label: 'ตรวจสอบสิทธิ์ Service Role (แยกขาดจาก Anon Key ของฝั่ง Client ชัดเจน)', checked: true },
  { id: 'chk-8', category: 'Bot Systems', label: 'ตรวจสอบข้อมูล Voice Logs (บันทึกเฉพาะเวลา ไม่มีการบันทึกเสียงสนทนา)', checked: true },
  { id: 'chk-9', category: 'Bot Systems', label: 'ตรวจสอบระบบ Google Translate TTS (ส่งเฉพาะเฉลยคำศัพท์มินิเกม เก็บเสียงใน RAM)', checked: true },
  { id: 'chk-10', category: 'Retention & Cleanup', label: 'ตรวจสอบ Retention เควสต์ประจำวัน (มี Cron ลบอัตโนมัติ 7-30 วัน)', checked: true },
  { id: 'chk-11', category: 'Retention & Cleanup', label: 'ตรวจสอบ Retention สำรองโครงสร้างห้อง (ระบบลบอัตโนมัติรักษาไว้เพียง 5 ชุดล่าสุด)', checked: true },
  { id: 'chk-12', category: 'Retention & Cleanup', label: 'ตรวจสอบ Temporary Cache (Upstash Redis มีระบบ Expire TTL ชัดเจน)', checked: true },
  { id: 'chk-13', category: 'Moderation & Logs', label: 'ตรวจสอบ Security Logs (ไม่พบการบันทึกข้อความแชทส่วนตัวของผู้ใช้)', checked: true },
  { id: 'chk-14', category: 'Policy Review', label: 'เจ้าของระบบตรวจสอบและกำหนดนโยบายวงรอบการล้างข้อมูลประวัติแต้มและธุรกรรมเก่า', checked: false },
];
