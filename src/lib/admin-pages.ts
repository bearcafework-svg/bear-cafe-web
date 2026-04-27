/**
 * Single source of truth for all admin pages.
 * Adding a new page here automatically makes it available
 * in both the Admin sidebar and the Permissions management page options.
 */

export interface AdminPageDef {
  id: string;
  label: string;
  /** Group key used in Admin sidebar nav */
  group: 'moderation' | 'content' | 'system';
  /** Thai label for the group (used in permissions UI) */
  groupLabel: string;
  /** If true, only Owner can see by default (without explicit permission) */
  ownerOnly?: boolean;
}

export const ADMIN_PAGES: AdminPageDef[] = [
  { id: 'users', label: 'จัดการผู้ใช้', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'banned-roles', label: 'ยศที่ถูกแบน', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'banned-words', label: 'คำต้องห้าม', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'tag-warn', label: 'ประวัติแท็กเตือน', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'contracts', label: 'สัญญาเช่า', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'healing-messages', label: 'กระดานให้กำลังใจ', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'trading-history', label: 'ประวัติการซื้อขาย', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'role-transfer', label: 'ย้ายบทบาท', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'bulk-role-manage', label: 'จัดการยศกลุ่ม', group: 'moderation', groupLabel: 'การดูแล' },
  { id: 'reports', label: 'รายงาน', group: 'moderation', groupLabel: 'การดูแล', ownerOnly: true },
  { id: 'categories', label: 'หมวดหมู่', group: 'content', groupLabel: 'เนื้อหา', ownerOnly: true },
  { id: 'banners', label: 'แบนเนอร์', group: 'content', groupLabel: 'เนื้อหา', ownerOnly: true },
  { id: 'roles', label: 'ยศ Discord', group: 'content', groupLabel: 'เนื้อหา', ownerOnly: true },
  { id: 'redeem-codes', label: 'โค้ดแลก', group: 'system', groupLabel: 'ระบบ', ownerOnly: true },
  { id: 'non-transferable-roles', label: 'บทบาทห้ามย้าย', group: 'system', groupLabel: 'ระบบ', ownerOnly: true },
  { id: 'maintenance', label: 'โหมดปรับปรุง', group: 'system', groupLabel: 'ระบบ', ownerOnly: true },
  
  { id: 'discord-servers', label: 'จัดการเซิร์ฟเวอร์', group: 'content', groupLabel: 'เนื้อหา', ownerOnly: true },
  { id: 'staff', label: 'จัดการทีมงาน', group: 'system', groupLabel: 'ระบบ', ownerOnly: true },
  { id: 'permissions', label: 'จัดการสิทธิ์', group: 'system', groupLabel: 'ระบบ', ownerOnly: true },
  { id: 'secret-table', label: 'Secret Table', group: 'content', groupLabel: 'เนื้อหา', ownerOnly: true },
];

/** Pages that can be assigned via custom permissions (excludes 'permissions' itself) */
export const ASSIGNABLE_PAGES = ADMIN_PAGES.filter(p => p.id !== 'permissions');

/** Get unique group labels for permissions UI */
export const getPermissionGroups = () => [...new Set(ASSIGNABLE_PAGES.map(p => p.groupLabel))];
