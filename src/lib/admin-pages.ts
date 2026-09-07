/**
 * Single source of truth for all admin pages.
 * Adding a new page here automatically makes it available
 * in both the Admin navigation and the Permissions management page options.
 */

export type AdminNavGroupKey = 'products' | 'community' | 'content' | 'system';

export interface AdminPageDef {
  id: string;
  label: string;
  /** Group key used in Admin navigation */
  group: AdminNavGroupKey;
  /** Thai label for the group (used in permissions UI & navigation) */
  groupLabel: string;
  /** If true, only Owner can see by default (without explicit permission) */
  ownerOnly?: boolean;
}

export const ADMIN_PAGES: AdminPageDef[] = [
  // ─── สินค้าและบริการ ───
  { id: 'product-catalog', label: 'คลังสินค้า', group: 'products', groupLabel: 'สินค้าและบริการ' },
  { id: 'contracts', label: 'สัญญาเช่า', group: 'products', groupLabel: 'สินค้าและบริการ' },
  { id: 'trading-history', label: 'ประวัติการซื้อขาย', group: 'products', groupLabel: 'สินค้าและบริการ' },
  { id: 'checkin-rewards', label: 'เช็กอินรายวัน', group: 'products', groupLabel: 'สินค้าและบริการ', ownerOnly: true },
  { id: 'redeem-codes', label: 'โค้ดแลกรางวัล', group: 'products', groupLabel: 'สินค้าและบริการ', ownerOnly: true },
  { id: 'campaigns', label: 'จัดการโฆษณา', group: 'products', groupLabel: 'สินค้าและบริการ', ownerOnly: true },

  // ─── ดูแลชุมชน ───
  { id: 'users', label: 'จัดการผู้ใช้', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'tag-warn', label: 'ประวัติแท็กเตือน', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'banned-roles', label: 'ยศที่ถูกแบน', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'banned-name', label: 'ชื่อต้องห้าม', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'reports', label: 'รายงานปัญหา', group: 'community', groupLabel: 'ดูแลชุมชน', ownerOnly: true },
  { id: 'healing-messages', label: 'กระดานฮีลใจ', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'role-transfer', label: 'ย้ายบทบาท', group: 'community', groupLabel: 'ดูแลชุมชน' },
  { id: 'bulk-role-manage', label: 'จัดการยศกลุ่ม', group: 'community', groupLabel: 'ดูแลชุมชน' },

  // ─── สื่อและคอนเทนต์ ───
  { id: 'discord-servers', label: 'จัดการเซิร์ฟเวอร์', group: 'content', groupLabel: 'สื่อและคอนเทนต์', ownerOnly: true },
  { id: 'banners', label: 'แบนเนอร์', group: 'content', groupLabel: 'สื่อและคอนเทนต์', ownerOnly: true },
  { id: 'sticky-messages', label: 'ข้อความติดหนึบ', group: 'content', groupLabel: 'สื่อและคอนเทนต์', ownerOnly: true },
  { id: 'dm-broadcast', label: 'ส่งข่าวสารบอท DM', group: 'content', groupLabel: 'สื่อและคอนเทนต์', ownerOnly: true },
  { id: 'minigames', label: 'จัดการมินิเกม', group: 'content', groupLabel: 'สื่อและคอนเทนต์', ownerOnly: true },

  // ─── ระบบและการตั้งค่า ───
  { id: 'overview', label: 'ภาพรวมระบบ', group: 'system', groupLabel: 'ระบบและการตั้งค่า' },
  { id: 'permissions', label: 'จัดการสิทธิ์', group: 'system', groupLabel: 'ระบบและการตั้งค่า', ownerOnly: true },
  { id: 'manage-staff', label: 'จัดการทีมงาน', group: 'system', groupLabel: 'ระบบและการตั้งค่า', ownerOnly: true },
  { id: 'non-transferable-roles', label: 'บทบาทห้ามย้าย', group: 'system', groupLabel: 'ระบบและการตั้งค่า', ownerOnly: true },
  { id: 'roles-to-delete', label: 'ยศที่ต้องลบเมื่อย้าย', group: 'system', groupLabel: 'ระบบและการตั้งค่า', ownerOnly: true },
];

/** Pages that can be assigned via custom permissions (excludes 'permissions' itself) */
export const ASSIGNABLE_PAGES = ADMIN_PAGES.filter(p => p.id !== 'permissions');

/** Get unique group labels for permissions UI */
export const getPermissionGroups = () => [
  'สินค้าและบริการ',
  'ดูแลชุมชน',
  'สื่อและคอนเทนต์',
  'ระบบและการตั้งค่า',
];
