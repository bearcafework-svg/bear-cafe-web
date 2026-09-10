import React from 'react';
import {
  LayoutDashboard,
  Users,
  Ban,
  AlertTriangle,
  ClipboardList,
  Home,
  Heart,
  ShoppingCart,
  ArrowLeftRight,
  UserCheck,
  Layers,
  Flag,
  ImageIcon,
  CalendarCheck,
  Ticket,
  ShieldBan,
  Settings,
  Send,
  Pin,
  Gamepad2,
  Shield,
  Trash2,
  Sparkles,
  Megaphone,
  Globe,
  Receipt,
  Gift,
} from 'lucide-react';
import { NavItem } from '@/components/ui/dropdown-navigation';

/**
 * 🐻☕ Bear Cafe Admin Navigation Architecture
 * Organized with Thai Natural Language, logical group hierarchy,
 * and permission filtering.
 */
export function getAdminNavTree(
  canAccessPage: (pageId: string) => boolean
): NavItem[] {
  const allNav: NavItem[] = [
    {
      id: 'products',
      label: 'สินค้าและบริการ',
      subMenus: [
        {
          title: 'คลังสินค้าและการค้า',
          items: [
            {
              id: 'product-catalog',
              label: 'คลังสินค้า',
              description: 'จัดการแพ็กเกจ ยศตกแต่ง และสินค้าในร้าน',
              icon: ShoppingCart,
            },
            {
              id: 'contracts',
              label: 'สัญญาเช่า',
              description: 'ตรวจและจัดการสัญญาเช่าห้องหรือพื้นที่',
              icon: Home,
            },
            {
              id: 'trading-history',
              label: 'ประวัติซื้อขาย',
              description: 'เช็กบิล ยอดชำระ และสลิปโอนเงิน',
              icon: Receipt,
            },
          ],
        },
        {
          title: 'ของขวัญและโปรโมชัน',
          items: [
            {
              id: 'checkin-rewards',
              label: 'เช็กอินรายวัน',
              description: 'ตั้งค่ารางวัลประจำวันและของขวัญใหญ่',
              icon: CalendarCheck,
            },
            {
              id: 'redeem-codes',
              label: 'โค้ดแลกรางวัล',
              description: 'สร้างโค้ดแจกแต้มหรือยศดิสคอร์ด',
              icon: Ticket,
            },
            {
              id: 'campaigns',
              label: 'จัดการโฆษณา',
              description: 'ดูแลแคมเปญสปอนเซอร์และโปรโมชัน',
              icon: Megaphone,
            },
          ],
        },
      ],
    },
    {
      id: 'community',
      label: 'ดูแลชุมชน',
      subMenus: [
        {
          title: 'ความปลอดภัยและกฎ',
          items: [
            {
              id: 'users',
              label: 'จัดการผู้ใช้',
              description: 'ค้นหา ตรวจสอบ และจัดการสมาชิก',
              icon: Users,
            },
            {
              id: 'tag-warn',
              label: 'ประวัติแท็กเตือน',
              description: 'บันทึกและตรวจการตักเตือนสมาชิก',
              icon: ClipboardList,
            },
            {
              id: 'banned-roles',
              label: 'ยศที่ถูกแบน',
              description: 'กำหนดยศที่ห้ามใช้งานในเซิร์ฟ',
              icon: Ban,
            },
            {
              id: 'banned-name',
              label: 'ชื่อต้องห้าม',
              description: 'คัดกรองชื่อและคำที่ไม่เหมาะสม',
              icon: AlertTriangle,
            },
            {
              id: 'reports',
              label: 'รายงานปัญหา',
              description: 'ตรวจคำร้องและเรื่องแจ้งจากสมาชิก',
              icon: Flag,
            },
          ],
        },
        {
          title: 'กิจกรรมและยศ',
          items: [
            {
              id: 'healing-messages',
              label: 'กระดานฮีลใจ',
              description: 'ตรวจและอนุมัติข้อความส่งต่อพลังบวก',
              icon: Heart,
            },
            {
              id: 'role-transfer',
              label: 'ย้ายบทบาท',
              description: 'โอนย้ายยศข้ามบัญชีดิสคอร์ด',
              icon: ArrowLeftRight,
            },
            {
              id: 'bulk-role-manage',
              label: 'จัดการยศกลุ่ม',
              description: 'เพิ่มหรือถอนยศให้สมาชิกพร้อมกัน',
              icon: UserCheck,
            },
          ],
        },
      ],
    },
    {
      id: 'content',
      label: 'สื่อและคอนเทนต์',
      subMenus: [
        {
          title: 'ประชาสัมพันธ์',
          items: [
            {
              id: 'discord-servers',
              label: 'จัดการเซิร์ฟเวอร์',
              description: 'ตรวจสอบและโปรโมทเซิร์ฟเวอร์พาร์ทเนอร์',
              icon: Globe,
            },
            {
              id: 'banners',
              label: 'แบนเนอร์',
              description: 'จัดการภาพโปรโมทหน้าแรกของเว็บ',
              icon: ImageIcon,
            },
            {
              id: 'sticky-messages',
              label: 'ข้อความติดหนึบ',
              description: 'ปักหมุดข้อความในห้องดิสคอร์ด',
              icon: Pin,
            },
            {
              id: 'dm-broadcast',
              label: 'ข่าวสารบอท DM',
              description: 'บรอดแคสต์ประกาศตรงถึงสมาชิก',
              icon: Send,
            },
          ],
        },
        {
          title: 'มินิเกม',
          items: [
            {
              id: 'minigames',
              label: 'จัดการมินิเกม',
              description: 'คลังคำศัพท์และตั้งค่ามินิเกมทั้ง 12 เกม',
              icon: Gamepad2,
            },
          ],
        },
      ],
    },
    {
      id: 'system',
      label: 'ระบบและการตั้งค่า',
      subMenus: [
        {
          title: 'การจัดการระบบ',
          items: [
            {
              id: 'overview',
              label: 'ภาพรวมระบบ',
              description: 'แดชบอร์ดสถิติและการทำงานรวม',
              icon: LayoutDashboard,
            },
            {
              id: 'permissions',
              label: 'จัดการสิทธิ์',
              description: 'ตั้งค่าสิทธิ์เข้าถึงเมนูของทีมงาน',
              icon: Shield,
            },
            {
              id: 'manage-staff',
              label: 'จัดการทีมงาน',
              description: 'ตั้งระดับตำแหน่งและรายชื่อสตาฟฟ์',
              icon: Users,
            },
          ],
        },
        {
          title: 'นโยบายยศพิเศษ',
          items: [
            {
              id: 'non-transferable-roles',
              label: 'ยศห้ามย้าย',
              description: 'กำหนดยศพิเศษที่ไม่ให้โอนย้าย',
              icon: ShieldBan,
            },
            {
              id: 'roles-to-delete',
              label: 'ยศที่ต้องลบ',
              description: 'ยศที่ถูกริบคืนอัตโนมัติเมื่อย้าย',
              icon: Trash2,
            },
            {
              id: 'role-migration',
              label: 'โอนย้ายยศ',
              description: 'ระบบย้ายยศเวอร์ชันก่อนหน้า',
              icon: Layers,
            },
          ],
        },
      ],
    },
  ];

  // Filter based on user page permissions
  return allNav
    .map((nav) => {
      if (!nav.subMenus) return nav;
      const filteredSub = nav.subMenus
        .map((sub) => ({
          ...sub,
          items: sub.items.filter((item) => (item.id ? canAccessPage(item.id) : true)),
        }))
        .filter((sub) => sub.items.length > 0);

      return {
        ...nav,
        subMenus: filteredSub,
      };
    })
    .filter((nav) => (nav.subMenus ? nav.subMenus.length > 0 : true));
}
