// ===================================================
// discord-traits.ts — ชุดนิยาม Vibe & Trait Tags ประจำ Bear Cafe
// ===================================================

export interface DiscordTrait {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  category: 'activity' | 'atmosphere' | 'interest';
}

export interface ServerVibeProfile {
  primary_goal?: string;
  atmosphere?: string;
  activities?: string[];
  interests?: string[];
}

export const VIBE_GOALS = [
  { id: 'goal_friends_game', label: 'หาเพื่อนเล่นเกม', icon: '🎮', description: 'เน้นนัดตี้ เล่นเกมด้วยกัน' },
  { id: 'goal_friends_talk', label: 'หาเพื่อนคุย แลกเปลี่ยน', icon: '💬', description: 'พูดคุยเรื่องทั่วไป รู้จักคนใหม่ๆ' },
  { id: 'goal_cozy', label: 'หาพื้นที่สบายใจ ฮีลใจ', icon: '☕', description: 'บรรยากาศอบอุ่น เป็นมิตร ไม่กดดัน' },
  { id: 'goal_explore', label: 'คอมมูนิตี้แลกเปลี่ยนความสนใจ', icon: '✨', description: 'ติดตามข่าวสาร แชร์ผลงาน และกิจกรรม' },
];

export const VIBE_ATMOSPHERES = [
  { id: 'vibe_vibrant', label: 'คึกคัก คนคุยตลอด', icon: '🔥', description: 'มีคนเคลื่อนไหวทั้งวันทั้งคืน' },
  { id: 'vibe_chill', label: 'ชิลๆ สบายๆ ไม่รีบร้อน', icon: '🍃', description: 'คุยเมื่อไหร่ก็คุย ไม่มีดราม่า' },
  { id: 'vibe_safe_haven', label: 'กลุ่มเล็ก อบอุ่น ปลอดภัย', icon: '🏡', description: 'สนิทสนม จำกันได้ทุกคน' },
  { id: 'vibe_night_owl', label: 'นกฮูกรอบดึก คุยยันเช้า', icon: '🌙', description: 'คึกคักเป็นพิเศษช่วง 22:00 - 05:00' },
];

export const CURATED_TRAITS: DiscordTrait[] = [
  // --- Atmosphere & Vibe ---
  {
    id: 'chill-chat',
    label: 'พูดคุยชิลล์ๆ',
    icon: '☕',
    description: 'บรรยากาศสบายๆ แลกเปลี่ยนเรื่องประจำวัน',
    color: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    category: 'atmosphere',
  },
  {
    id: 'active-chat',
    label: 'คึกคักคุยตลอด',
    icon: '🔥',
    description: 'มีข้อความและคนแชทเคลื่อนไหวอย่างต่อเนื่อง',
    color: 'bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/25',
    category: 'atmosphere',
  },
  {
    id: 'safe-haven',
    label: 'อบอุ่นกลุ่มเล็ก',
    icon: '🏡',
    description: 'คอมมูนิตี้เล็กๆ ใส่ใจ เป็นมิตรและปลอดภัย',
    color: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
    category: 'atmosphere',
  },
  {
    id: 'night-owls',
    label: 'สังคมรอบดึก',
    icon: '🌙',
    description: 'คนตื่นดึก คุยแก้เหงาช่วงกลางคืนถึงเช้า',
    color: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/25',
    category: 'atmosphere',
  },
  {
    id: 'working-adults',
    label: 'วัยทำงานสงบๆ',
    icon: '💼',
    description: 'สังคมวัยผู้ใหญ่ พูดคุยสุภาพ มีวุฒิภาวะ',
    color: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/25',
    category: 'atmosphere',
  },

  // --- Activities & Social ---
  {
    id: 'voice-active',
    label: 'เปิดไมค์บ่อย',
    icon: '🎙️',
    description: 'มีคนในห้องเสียงเป็นประจำ พูดคุยสดใส',
    color: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
    category: 'activity',
  },
  {
    id: 'text-focused',
    label: 'เน้นพิมพ์แชท',
    icon: '💬',
    description: 'ชอบพิมพ์คุยเป็นหลัก ชิลล์ๆ ไม่ต้องเปิดไมค์',
    color: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25',
    category: 'activity',
  },
  {
    id: 'gaming',
    label: 'สายเกมมิ่ง/หาตี้',
    icon: '🎮',
    description: 'หาตี้เล่นเกม วาโลแลนต์ โรบล็อก หรือเกมฮิต',
    color: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    category: 'activity',
  },
  {
    id: 'movie-stream',
    label: 'ดูหนัง/สตรีมจอ',
    icon: '🎬',
    description: 'เปิดจอแชร์สตรีม ดูซีรีส์ ดูอนิเมะด้วยกัน',
    color: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/25',
    category: 'activity',
  },
  {
    id: 'music',
    label: 'ดนตรี/ร้องเพลง',
    icon: '🎵',
    description: 'ฟังเพลง ร้องคาราโอเกะ แบ่งปันเพลย์ลิสต์',
    color: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    category: 'activity',
  },
  {
    id: 'giveaways',
    label: 'กิจกรรม/แจกของ',
    icon: '🎁',
    description: 'มีอีเวนต์ มินิเกม หรือแจกของรางวัลบ่อยๆ',
    color: 'bg-pink-500/10 text-pink-800 dark:text-pink-300 border-pink-500/25',
    category: 'activity',
  },
  {
    id: 'study',
    label: 'เรียน/แลกเปลี่ยน',
    icon: '📚',
    description: 'เปิดห้องอ่านหนังสือ โค้ดดิ้ง หรือติวข้อสอบ',
    color: 'bg-stone-500/15 text-stone-800 dark:text-stone-300 border-stone-500/25',
    category: 'activity',
  },

  // --- Special Interests ---
  {
    id: 'anime',
    label: 'อนิเมะ/มังงะ',
    icon: '🌸',
    description: 'แฟนคลับการ์ตูน อนิเมะ มังงะ วีทูบเบอร์',
    color: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/25',
    category: 'interest',
  },
  {
    id: 'creators',
    label: 'สายวาด/ครีเอเตอร์',
    icon: '🎨',
    description: 'แชร์ผลงานศิลปะ วาดรูป ตัดต่อ และความคิดสร้างสรรค์',
    color: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/25',
    category: 'interest',
  },
  {
    id: 'tech-dev',
    label: 'ไอที/เขียนโค้ด',
    icon: '💻',
    description: 'พูดคุยเรื่องเทคโนโลยี บอทดิสคอร์ด และการพัฒนา',
    color: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/25',
    category: 'interest',
  },
  {
    id: 'shop-service',
    label: 'ร้านค้า/รับจ้าง',
    icon: '🛒',
    description: 'ซื้อขายสินค้า คอมมิชชัน หรือให้บริการต่างๆ',
    color: 'bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-600/30',
    category: 'interest',
  },
];

export const TRAIT_MAP = new Map<string, DiscordTrait>(
  CURATED_TRAITS.map((trait) => [trait.id, trait])
);

export function getTraitById(id: string): DiscordTrait | undefined {
  return TRAIT_MAP.get(id);
}
