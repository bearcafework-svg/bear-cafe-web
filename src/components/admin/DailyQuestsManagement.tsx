import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn, formatNumber } from '@/lib/utils';
import {
  Target,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  Mic,
  Camera,
  Users,
  Calendar,
  Award,
  Zap,
  Shuffle,
  Eye,
  Flame,
  HelpCircle,
  Send,
  Copy,
  Code,
  Check,
  Terminal,
  Hash,
  Music,
  ListChecks,
  RotateCcw,
  Info,
  Bell,
  X,
  Folder,
  Gamepad2,
  Compass,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Settings2,
} from 'lucide-react';

export interface QuestTemplate {
  id: string;
  code: string;
  category: 'chat' | 'voice' | 'community' | 'irl';
  title: string;
  description: string;
  trigger_type: string;
  target_count: number;
  reward_points: number;
  reward_role_id?: string | null;
  trigger_config: Record<string, any>;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExhaustionCycleResult {
  usedInCycle: QuestTemplate[];
  remainingInCycle: QuestTemplate[];
  cycleCount: number;
  totalPoolCount: number;
  lastPickedId: string | null;
}

/**
 * คำนวณรอบสุ่มเควสแบบ Option A (Exhaustion Cycle)
 * หมุนเวียนเควสในคลังไม่ให้ซ้ำจนกว่าจะออกครบทุกเควสใน Pool
 */
export function computeExhaustionCycle(
  pool: QuestTemplate[],
  historySets: { quest_date: string; quest_ids: string[] }[],
  targetDate: string
): ExhaustionCycleResult {
  if (!pool || pool.length === 0) {
    return {
      usedInCycle: [],
      remainingInCycle: [],
      cycleCount: 1,
      totalPoolCount: 0,
      lastPickedId: null,
    };
  }

  const poolIds = new Set(pool.map((t) => t.id));
  let currentCycle = new Set<string>();
  let cycleCount = 1;
  let lastPickedId: string | null = null;

  // กรองเฉพาะประวัติก่อน targetDate และเรียงตามลำดับเวลาจากอดีต -> ปัจจุบัน
  const sortedPast = [...historySets]
    .filter((s) => s.quest_date < targetDate)
    .sort((a, b) => a.quest_date.localeCompare(b.quest_date));

  for (const set of sortedPast) {
    const pickedId = set.quest_ids?.find((id) => poolIds.has(id));
    if (pickedId) {
      lastPickedId = pickedId;
      if (currentCycle.has(pickedId) || currentCycle.size >= pool.length) {
        cycleCount++;
        currentCycle = new Set([pickedId]);
      } else {
        currentCycle.add(pickedId);
      }
    }
  }

  let remaining = pool.filter((t) => !currentCycle.has(t.id));
  let used = pool.filter((t) => currentCycle.has(t.id));

  // เมื่อวนครบทุกเควสแล้วในรอบนี้
  if (remaining.length === 0) {
    // รีเซ็ตรอบใหม่: นำเควสทั้งหมดกลับมา ยกเว้นเควสของเมื่อวาน (ถ้า pool > 1)
    remaining = pool.filter((t) => pool.length <= 1 || t.id !== lastPickedId);
    used = pool.filter((t) => !remaining.some((r) => r.id === t.id));
  }

  return {
    usedInCycle: used,
    remainingInCycle: remaining,
    cycleCount,
    totalPoolCount: pool.length,
    lastPickedId,
  };
}

export interface DailyQuestSet {
  id: string;
  quest_date: string;
  quest_ids: string[];
  bonus_points: number;
  announcement_message_id: string | null;
  published_at?: string | null;
  created_at?: string;
}

export interface QuestProgressItem {
  id: string;
  user_id: string;
  quest_date: string;
  quest_id: string;
  current_progress: number;
  target_count: number;
  is_completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
}

const CATEGORY_MAP: Record<string, { label: string; icon: React.ElementType; color: string; badgeColor: string }> = {
  chat: {
    label: 'แชท Chat',
    icon: MessageSquare,
    color: 'text-blue-500',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  voice: {
    label: 'ห้องเสียง Voice',
    icon: Mic,
    color: 'text-emerald-500',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  community: {
    label: 'ชุมชน Community',
    icon: Users,
    color: 'text-purple-500',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  irl: {
    label: 'ชีวิตจริง IRL',
    icon: Camera,
    color: 'text-amber-500',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
};

const TRIGGER_TYPES = [
  { value: 'keyword', label: 'ทักทาย / คีย์เวิร์ด (keyword)', category: 'chat' },
  { value: 'chat_any', label: 'ส่งข้อความทั่วไป (chat_any)', category: 'chat' },
  { value: 'chat_reply', label: 'ตอบกลับข้อความเพื่อน (chat_reply)', category: 'chat' },
  { value: 'chat_mention', label: 'แท็กพูดคุยกับเพื่อน (chat_mention)', category: 'chat' },
  { value: 'chat_media', label: 'ส่งรูปภาพ มีม หรือไฟล์มีเดีย (chat_media)', category: 'chat' },
  { value: 'chat_emoji', label: 'ส่งอิโมจิในห้องแชท (chat_emoji)', category: 'chat' },
  { value: 'chat_count', label: 'สะสมจำนวนข้อความ (chat_count)', category: 'chat' },
  { value: 'voice_duration', label: 'สะสมเวลาในห้องเสียง (voice_duration)', category: 'voice' },
  { value: 'voice_join', label: 'เข้าใช้งานห้องเสียง (voice_join)', category: 'voice' },
  { value: 'horoscope_usage', label: '🔮 ดูดวง / เสี่ยงทาย (horoscope_usage)', category: 'community' },
  { value: 'minigame_win', label: '🎮 ชนะมินิเกม (minigame_win)', category: 'community' },
  { value: 'minigame_play', label: '🕹️ เล่นมินิเกม (minigame_play)', category: 'community' },
  { value: 'reaction_add', label: 'กดรีแอ็กชันข้อความ (reaction_add)', category: 'community' },
  { value: 'irl_manual', label: 'ถ่ายรูปกิจกรรม IRL ส่งห้องที่กำหนด (irl_manual)', category: 'irl' },
];

export const TRIGGERS_BY_CATEGORY: Record<string, { value: string; label: string; desc: string }[]> = {
  chat: [
    { value: 'chat_any', label: '💬 ส่งข้อความทั่วไป', desc: 'พิมพ์ข้อความใดก็ได้ในห้องแชท' },
    { value: 'chat_count', label: '🗨️ สะสมจำนวนข้อความ', desc: 'ส่งข้อความให้ครบจำนวนครั้ง' },
    { value: 'keyword', label: '🌞 ทักทาย / คีย์เวิร์ด', desc: 'พิมพ์คำเฉพาะ เช่น morning, gm' },
    { value: 'chat_reply', label: '↩️ ตอบกลับข้อความเพื่อน', desc: 'กด Reply ข้อความเพื่อน' },
    { value: 'chat_mention', label: '👋 แท็กพูดคุยกับเพื่อน', desc: 'แท็ก @ เพื่อนในห้องแชท' },
    { value: 'chat_media', label: '🎵 แชร์เพลง หรือ มีม/สติกเกอร์', desc: 'ส่งลิงก์เพลง หรือสติกเกอร์/GIF' },
    { value: 'chat_emoji', label: '🧸 ส่งอิโมจิในห้องแชท', desc: 'ส่งอิโมจิในข้อความ' },
  ],
  voice: [
    { value: 'voice_duration', label: '⏱️ สะสมเวลาในห้องเสียง', desc: 'อยู่ในห้องเสียงตามจำนวนนาที' },
    { value: 'voice_join', label: '🎙️ เข้าใช้งานห้องเสียง', desc: 'กดเข้าห้องเสียง' },
  ],
  community: [
    { value: 'horoscope_usage', label: '🔮 ดูดวง / เสี่ยงทาย', desc: 'ดูคำทำนาย, ไพ่ทาโรต์, เขย่าเซียมซี' },
    { value: 'minigame_win', label: '🎮 ชนะมินิเกม', desc: 'ตอบถูกหรือชนะมินิเกมห้อง 1-13' },
    { value: 'minigame_play', label: '🕹️ มีส่วนร่วมเล่นมินิเกม', desc: 'ร่วมกดตอบมินิเกม' },
    { value: 'command_usage', label: '🤖 เรียกใช้คำสั่งบอท', desc: 'ใช้คำสั่งบอท เช่น /สุ่มคำถาม' },
    { value: 'reaction_add', label: '❤️ กดรีแอ็กชันข้อความ', desc: 'กด Reaction ใต้ข้อความ' },
  ],
  irl: [
    { value: 'irl_manual', label: '📷 ถ่ายรูปกิจกรรม IRL ส่งห้องที่กำหนด', desc: 'ถ่ายรูปอาหาร/ขนม ส่งห้องภารกิจ' },
  ],
};

const KNOWN_CHANNELS: Record<string, string> = {
  '1524124012492619847': 'สุ่มคำถาม',
  '1529885509260673034': 'ภารกิจประจำวัน',
  '1524123147987714158': 'แจ้งเตือนเควส',
  '1524123296466079884': 'แชร์เพลง',
  '1524122867178930237': 'ห้องต้อนรับ',
  '1524124172580814979': 'ส่งรูปถ่าย-irl',
  '1524122936183754893': '🔮 ดูดวง-เสี่ยงทาย',
  '1534437994327572510': '🎮 เกม 1: เติมคำศัพท์ (ไทย)',
  '1534453700188176506': '🎮 เกม 2: เติมคำศัพท์ (อังกฤษ)',
  '1534454001532272730': '🎮 เกม 3: สุ่มโจทย์คณิตฯ',
  '1534458749782200390': '🎮 เกม 4: ทายคำจากคำใบ้',
  '1544201307894587472': '🎮 เกม 5: ฟังเสียงแล้วพิมพ์ตอบ (อังกฤษ)',
  '1534469630234726431': '🎮 เกม 6: พิมพ์คำต่อไปนี้ (ไทย)',
  '1534471900112486410': '🎮 เกม 7: พิมพ์คำต่อไปนี้ (อังกฤษ)',
  '1534472719603994784': '🎮 เกม 8: ไวยากรณ์ภาษาไทย',
  '1534473855660593172': '🎮 เกม 9: ไวยากรณ์ภาษาอังกฤษ',
  '1534474757305925743': '🎮 เกม 10: ทายธงชาติ',
  '1534475484803764355': '🎮 เกม 11: ทายเสียงสัตว์',
  '1534477382499696773': '🎮 เกม 12: ทายหมวดหมู่อาหาร',
  '1534478149889556531': '🎮 เกม 13: เรียงคำสร้างประโยค',
};

export const TAROT_COMMANDS = [
  { value: 'any', label: '🔮 ทุกคำสั่งดูดวง (คำสั่งใดก็ได้)' },
  { value: 'tarot1', label: '🎴 ดูคำทำนาย (Tarot 1 - สุ่มไพ่ทาโรต์ 78 ใบ)' },
  { value: 'tarot2', label: '✨ คำทำนายของฉันคือ (Tarot 2 - เสี่ยงดวงเควส 40 ภาพ)' },
  { value: 'tarot3', label: '🎋 เขย่าเซียมซี (Tarot 3 - เสี่ยงเซียมซี 15 ใบ)' },
  { value: 'tarot4', label: '🌀 เกิดใหม่เป็นอะไร (Tarot 4 - สุ่มชาติภพ 20 ชนิด)' },
  { value: 'tarot5', label: '🐻 เลือกหมี (Tarot 5 - ทายใจหมี 3 ตัว)' },
  { value: 'tarot6', label: 'ᚱ รูนประจำตัว (Tarot 6 - สัญลักษณ์รูนโบราณ 24 รูปแบบ)' },
];

export const MINIGAME_OPTIONS = [
  { value: 'any', label: '🎮 ทุกมินิเกม (ชนะเกมใดก็ได้)' },
  { value: '1', label: 'เกม 1: เติมคำศัพท์ (ไทย) — พิมพ์ตอบ' },
  { value: '2', label: 'เกม 2: เติมคำศัพท์ (อังกฤษ) — พิมพ์ตอบ' },
  { value: '3', label: 'เกม 3: สุ่มโจทย์คณิตฯ — พิมพ์ตอบ' },
  { value: '4', label: 'เกม 4: ทายคำจากคำใบ้ — พิมพ์ตอบ' },
  { value: '5', label: 'เกม 5: ฟังเสียงแล้วพิมพ์ตอบ (อังกฤษ) — ฟังเสียง' },
  { value: '6', label: 'เกม 6: พิมพ์คำต่อไปนี้ (ไทย) — แข่งความเร็ว' },
  { value: '7', label: 'เกม 7: พิมพ์คำต่อไปนี้ (อังกฤษ) — แข่งความเร็ว' },
  { value: '8', label: 'เกม 8: ไวยากรณ์ภาษาไทย — ปุ่มกด 4 ตัวเลือก' },
  { value: '9', label: 'เกม 9: ไวยากรณ์ภาษาอังกฤษ — ปุ่มกด 4 ตัวเลือก' },
  { value: '10', label: 'เกม 10: ทายธงชาติ — ปุ่มกด 4 ตัวเลือก' },
  { value: '11', label: 'เกม 11: ทายเสียงสัตว์ — ฟังเสียง' },
  { value: '12', label: 'เกม 12: ทายหมวดหมู่อาหาร — ปุ่มกด 4 ตัวเลือก' },
  { value: '13', label: 'เกม 13: เรียงคำสร้างประโยค — ปุ่มกดเรียงคำ' },
];

export const KNOWN_VOICE_CATEGORIES: Record<string, string> = {
  '1543974947561537646': '🍃 Point x2 (หมวดคูณแต้ม)',
  '1524122788015636682': '🐻 ห้องเสียงทั่วไป (Active Rooms)',
  '1549723895936979004': '⭐ หมวดห้อง VIP',
};

const COMMON_SLASH_COMMANDS = [
  { name: 'สุ่มคำถาม', desc: '💭 สุ่มการ์ดคำถามเพื่อกระชับความสัมพันธ์' },
  { name: 'มอบดอกไม้', desc: '🌸 มอบดอกไม้ให้เพื่อนในเซิร์ฟเวอร์' },
  { name: 'แต้มของฉัน', desc: '🪙 ตรวจสอบกระเป๋าแต้มและสิทธิพิเศษ' },
  { name: 'ประวัติลงห้อง', desc: '🎧 ตรวจประวัติการเข้าใช้งานห้องเสียง' },
  { name: 'gacha-bee', desc: '🐝 เปิดตู้สุ่มกาชาแต่งตัวผึ้งอ้วน' },
];

function renderDescriptionWithMentions(text: string) {
  if (!text) return null;
  const parts = text.split(/(<#\d+>)/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^<#(\d+)>$/);
        if (match) {
          const channelId = match[1];
          const channelName = KNOWN_CHANNELS[channelId] || `channel-${channelId.slice(-4)}`;
          return (
            <span
              key={index}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-xs mx-0.5 border border-amber-500/30 align-baseline"
              title={`ID: ${channelId}`}
            >
              #{channelName}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function getBangkokDateString(offsetDays = 0): string {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export function DailyQuestsManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'templates' | 'sets' | 'analytics'>('templates');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Daily Set state
  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDateString());
  const [currentSet, setCurrentSet] = useState<DailyQuestSet | null>(null);
  const [pastSets, setPastSets] = useState<{ quest_date: string; quest_ids: string[] }[]>([]);

  // Option A Manual Set Selection Dialog State (Full 3-Category Picker)
  const [manualSetDialogOpen, setManualSetDialogOpen] = useState(false);
  const [manualChatId, setManualChatId] = useState<string>('');
  const [manualVoiceCommId, setManualVoiceCommId] = useState<string>('');
  const [manualIrlId, setManualIrlId] = useState<string>('');

  // Single Quest Replacement Dialog State (Per-card picker)
  const [singleSwapDialogOpen, setSingleSwapDialogOpen] = useState(false);
  const [singleSwapGroup, setSingleSwapGroup] = useState<'chat' | 'voice_comm' | 'irl'>('chat');
  const [singleSwapSelectedId, setSingleSwapSelectedId] = useState<string>('');

  // Stats state
  const [analyticsStats, setAnalyticsStats] = useState({
    totalProgressChecks: 0,
    totalCompletions: 0,
    totalBonuses: 0,
    pointsDistributed: 0,
  });
  const [recentCompletions, setRecentCompletions] = useState<QuestProgressItem[]>([]);

  // Dialog State (Create / Edit Template)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuestTemplate | null>(null);
  const [formCategory, setFormCategory] = useState<'chat' | 'voice' | 'community' | 'irl'>('chat');
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggerType, setFormTriggerType] = useState('chat_any');
  const [formTargetCount, setFormTargetCount] = useState(5);
  const [formRewardPoints, setFormRewardPoints] = useState(5);
  const [formRewardType, setFormRewardType] = useState<'points' | 'role' | 'both'>('points');
  const [formRewardRoleId, setFormRewardRoleId] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Dynamic Trigger Config State
  const [cfgCommand, setCfgCommand] = useState('สุ่มคำถาม');
  const [cfgMediaType, setCfgMediaType] = useState<'music_link' | 'sticker_or_gif'>('music_link');
  const [cfgKeywords, setCfgKeywords] = useState('');
  const [cfgMinMembers, setCfgMinMembers] = useState(1);
  const [cfgChannelId, setCfgChannelId] = useState('');
  const [cfgCategoryId, setCfgCategoryId] = useState('');
  const [cfgMessageUrl, setCfgMessageUrl] = useState('');
  const [cfgTarotType, setCfgTarotType] = useState('any');
  const [cfgGameId, setCfgGameId] = useState('any');
  const [dialogTab, setDialogTab] = useState<'info' | 'rewards'>('info');
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Announcement Schedule Settings State (stored in site_settings key='daily_quest_settings')
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [announcementTimes, setAnnouncementTimes] = useState<string[]>(['08:00']);
  const [announceChannelId, setAnnounceChannelId] = useState('1529885509260673034');
  const [announcePingRoleId, setAnnouncePingRoleId] = useState('1144700895020462200');
  const [scheduleModalTimes, setScheduleModalTimes] = useState<string[]>(['08:00']);
  const [scheduleModalChanId, setScheduleModalChanId] = useState('1529885509260673034');
  const [scheduleModalRoleId, setScheduleModalRoleId] = useState('1144700895020462200');
  const [newTimeInput, setNewTimeInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Delete Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<QuestTemplate | null>(null);

  // Send Component Announcement Dialog State
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Discord roles cache for mapping role ID to name
  const [discordRoles, setDiscordRoles] = useState<{ id: string; name: string }[]>([]);
  const [discordRolesMap, setDiscordRolesMap] = useState<Map<string, { id: string; name: string }>>(new Map());

  const fetchDiscordRoles = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data?.roles && Array.isArray(data.roles)) {
        setDiscordRoles(data.roles);
        const m = new Map<string, { id: string; name: string }>();
        data.roles.forEach((r: any) => m.set(r.id, { id: r.id, name: r.name }));
        setDiscordRolesMap(m);
      }
    } catch (err) {
      console.warn('Could not load discord roles:', err);
    }
  }, []);

  const getRoleDisplayName = useCallback(
    (roleId?: string | null, customRoleName?: string | null) => {
      if (customRoleName) return customRoleName;
      if (!roleId) return 'บทบาทพิเศษ';
      return discordRolesMap.get(roleId)?.name || 'บทบาทพิเศษ';
    },
    [discordRolesMap]
  );

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_quest_templates' as any)
        .select('*')
        .order('category', { ascending: true })
        .order('code', { ascending: true });

      if (error) throw error;
      setTemplates((data as QuestTemplate[]) || []);
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการโหลดคลังเควส',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch set for date
  const fetchSetForDate = useCallback(async (dateStr: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .select('*')
        .eq('quest_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      setCurrentSet(data as DailyQuestSet | null);
    } catch (err: any) {
      toast({
        title: 'โหลดข้อมูลชุดเควสไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Fetch past sets for Option A exhaustion cycle calculation
  const fetchPastSets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .select('quest_date, quest_ids')
        .order('quest_date', { ascending: true })
        .limit(100);

      if (error) throw error;
      setPastSets((data as any[]) || []);
    } catch (err: any) {
      console.error('Failed to load past daily quest sets:', err);
    }
  }, []);

  // Fetch stats & recent completions
  const fetchAnalytics = useCallback(async () => {
    try {
      const { count: checksCount } = await supabase
        .from('daily_quest_analytics' as any)
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['click_progress', 'progress_check']);

      const { count: completionsCount } = await supabase
        .from('daily_quest_progress' as any)
        .select('*', { count: 'exact', head: true })
        .eq('is_completed', true);

      const { count: bonusesCount } = await supabase
        .from('daily_quest_bonuses' as any)
        .select('*', { count: 'exact', head: true });

      const { data: recent } = await supabase
        .from('daily_quest_progress' as any)
        .select('*')
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(20);

      setAnalyticsStats({
        totalProgressChecks: checksCount || 0,
        totalCompletions: completionsCount || 0,
        totalBonuses: bonusesCount || 0,
        pointsDistributed: (completionsCount || 0) * 10 + (bonusesCount || 0) * 50,
      });

      setRecentCompletions((recent as QuestProgressItem[]) || []);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  // Fetch schedule settings from site_settings (key = 'daily_quest_settings')
  const fetchScheduleSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings' as any)
        .select('value')
        .eq('key', 'daily_quest_settings')
        .maybeSingle();

      if (error) throw error;
      if (data && (data as any).value) {
        const val = (data as any).value;
        if (Array.isArray(val.announcement_times) && val.announcement_times.length > 0) {
          setAnnouncementTimes(val.announcement_times);
        }
        if (val.announce_channel_id) setAnnounceChannelId(val.announce_channel_id);
        if (val.announce_ping_role_id) setAnnouncePingRoleId(val.announce_ping_role_id);
      }
    } catch (err: any) {
      console.error('Failed to load daily quest settings:', err);
    }
  }, []);

  const handleOpenScheduleDialog = () => {
    setScheduleModalTimes([...announcementTimes]);
    setScheduleModalChanId(announceChannelId);
    setScheduleModalRoleId(announcePingRoleId);
    setNewTimeInput('');
    setScheduleDialogOpen(true);
  };

  const handleAddScheduleTime = (timeToAdd: string) => {
    const trimmed = timeToAdd.trim();
    if (!trimmed) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      toast({
        title: 'รูปแบบเวลาไม่ถูกต้อง',
        description: 'กรุณาระบุเวลาในรูปแบบ 24 ชม. เช่น 08:00 หรือ 18:30',
        variant: 'destructive',
      });
      return;
    }
    if (scheduleModalTimes.includes(trimmed)) {
      toast({
        title: 'เวลานี้มีอยู่แล้ว',
        description: `เวลา ${trimmed} น. มีอยู่ในรายการแล้ว`,
        variant: 'destructive',
      });
      return;
    }
    const updated = [...scheduleModalTimes, trimmed].sort();
    setScheduleModalTimes(updated);
    setNewTimeInput('');
  };

  const handleRemoveScheduleTime = (timeToRemove: string) => {
    if (scheduleModalTimes.length <= 1) {
      toast({
        title: 'ไม่สามารถลบได้',
        description: 'ต้องมีเวลาประกาศอย่างน้อย 1 เวลาใน 1 วัน',
        variant: 'destructive',
      });
      return;
    }
    setScheduleModalTimes(scheduleModalTimes.filter((t) => t !== timeToRemove));
  };

  const handleSaveScheduleSettings = async () => {
    if (scheduleModalTimes.length === 0) {
      toast({ title: 'ต้องมีเวลาประกาศอย่างน้อย 1 เวลา', variant: 'destructive' });
      return;
    }
    try {
      setSavingSchedule(true);
      const sortedTimes = [...scheduleModalTimes].sort();
      const payload = {
        announcement_times: sortedTimes,
        announce_channel_id: scheduleModalChanId.trim() || '1529885509260673034',
        announce_ping_role_id: scheduleModalRoleId.trim() || '1144700895020462200',
      };

      const { error } = await supabase
        .from('site_settings' as any)
        .upsert(
          {
            key: 'daily_quest_settings',
            value: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) throw error;
      setAnnouncementTimes(sortedTimes);
      setAnnounceChannelId(payload.announce_channel_id);
      setAnnouncePingRoleId(payload.announce_ping_role_id);
      toast({
        title: 'บันทึกเวลาประกาศสำเร็จ',
        description: `ระบบจะประกาศรอบเควสเวลา ${sortedTimes.join(', ')} น.`,
      });
      setScheduleDialogOpen(false);
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการบันทึกเวลา',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPastSets();
    fetchScheduleSettings();
    fetchDiscordRoles();
  }, [fetchTemplates, fetchPastSets, fetchScheduleSettings, fetchDiscordRoles]);

  useEffect(() => {
    if (activeTab === 'sets') {
      fetchSetForDate(selectedDate);
      fetchPastSets();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, selectedDate, fetchSetForDate, fetchAnalytics, fetchPastSets]);

  // Option A Pools and Exhaustion Cycle Calculations
  const activeChatPool = useMemo(
    () => templates.filter((t) => t.category === 'chat' && t.active),
    [templates]
  );
  const activeVoiceCommPool = useMemo(
    () => templates.filter((t) => (t.category === 'voice' || t.category === 'community') && t.active),
    [templates]
  );
  const activeIrlPool = useMemo(
    () => templates.filter((t) => t.category === 'irl' && t.active),
    [templates]
  );

  const chatCycle = useMemo(
    () => computeExhaustionCycle(activeChatPool, pastSets, selectedDate),
    [activeChatPool, pastSets, selectedDate]
  );
  const voiceCommCycle = useMemo(
    () => computeExhaustionCycle(activeVoiceCommPool, pastSets, selectedDate),
    [activeVoiceCommPool, pastSets, selectedDate]
  );
  const irlCycle = useMemo(
    () => computeExhaustionCycle(activeIrlPool, pastSets, selectedDate),
    [activeIrlPool, pastSets, selectedDate]
  );

  // Single swap candidates based on selected category group
  const singleSwapCandidates = useMemo(() => {
    if (singleSwapGroup === 'chat') return activeChatPool;
    if (singleSwapGroup === 'voice_comm') return activeVoiceCommPool;
    return activeIrlPool;
  }, [singleSwapGroup, activeChatPool, activeVoiceCommPool, activeIrlPool]);

  const singleSwapCycle = useMemo(() => {
    if (singleSwapGroup === 'chat') return chatCycle;
    if (singleSwapGroup === 'voice_comm') return voiceCommCycle;
    return irlCycle;
  }, [singleSwapGroup, chatCycle, voiceCommCycle, irlCycle]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && t.active) ||
        (statusFilter === 'inactive' && !t.active);
      return matchSearch && matchCategory && matchStatus;
    });
  }, [templates, searchQuery, categoryFilter, statusFilter]);

  // Category Counts for Quick Filter Pills
  const categoryCounts = useMemo(() => {
    return {
      all: templates.length,
      chat: templates.filter((t) => t.category === 'chat').length,
      voice: templates.filter((t) => t.category === 'voice').length,
      community: templates.filter((t) => t.category === 'community').length,
      irl: templates.filter((t) => t.category === 'irl').length,
    };
  }, [templates]);

  // Selected Template for Master-Detail Panel
  const activeSelectedTemplate = useMemo(() => {
    if (!filteredTemplates.length) return null;
    return filteredTemplates.find((t) => t.id === selectedTemplateId) || filteredTemplates[0];
  }, [filteredTemplates, selectedTemplateId]);

  // Duplicate / Clone Template
  const handleDuplicateTemplate = (t: QuestTemplate) => {
    setEditingTemplate(null);
    setFormCategory(t.category);
    setFormCode(`${t.code}_copy`);
    setFormTitle(`${t.title} (คัดลอก)`);
    setFormDescription(t.description);
    setFormTriggerType(t.trigger_type);
    setFormTargetCount(t.target_count);

    const rPts = Number(t.reward_points) || 0;
    const rRole = t.reward_role_id || t.trigger_config?.reward_role_id || '';
    setFormRewardPoints(rPts);
    setFormRewardRoleId(rRole);
    if (rPts > 0 && rRole) {
      setFormRewardType('both');
    } else if (rRole) {
      setFormRewardType('role');
    } else {
      setFormRewardType('points');
    }

    setFormActive(true);

    const cfg = t.trigger_config || {};
    setCfgCommand(cfg.command || 'สุ่มคำถาม');
    setCfgMediaType(cfg.media_type || 'music_link');
    setCfgKeywords(Array.isArray(cfg.keywords) ? cfg.keywords.join(', ') : (cfg.keywords || ''));
    setCfgMinMembers(Number(cfg.min_members) || 1);
    setCfgChannelId(cfg.channel_id || '');
    setCfgCategoryId(cfg.category_id || '');
    setCfgMessageUrl(cfg.message_url || '');
    setCfgTarotType(cfg.tarot_type || 'any');
    setCfgGameId(cfg.game_id ? String(cfg.game_id) : 'any');
    setDialogTab('info');
    setShowAdvancedConfig(false);
    setDialogOpen(true);
  };

  // Toggle active status
  const handleToggleActive = async (template: QuestTemplate) => {
    try {
      const newStatus = !template.active;
      const { error } = await supabase
        .from('daily_quest_templates' as any)
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', template.id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, active: newStatus } : t))
      );

      toast({
        title: 'บันทึกสถานะสำเร็จ',
        description: `เควส ${template.title} ถูก${newStatus ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}แล้ว`,
      });
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormCategory('chat');
    setFormCode(`custom_${Date.now().toString().slice(-4)}`);
    setFormTitle('');
    setFormDescription('');
    setFormTriggerType('chat_any');
    setFormTargetCount(5);
    setFormRewardType('points');
    setFormRewardPoints(5);
    setFormRewardRoleId('');
    setFormActive(true);
    setCfgCommand('สุ่มคำถาม');
    setCfgMediaType('music_link');
    setCfgKeywords('morning, gm, มอนิ่ง, อรุณสวัสดิ์');
    setCfgMinMembers(1);
    setCfgChannelId('');
    setCfgCategoryId('');
    setCfgMessageUrl('');
    setCfgTarotType('any');
    setCfgGameId('any');
    setDialogTab('info');
    setShowAdvancedConfig(false);
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (t: QuestTemplate) => {
    setEditingTemplate(t);
    setFormCategory(t.category);
    setFormCode(t.code);
    setFormTitle(t.title);
    setFormDescription(t.description);
    setFormTriggerType(t.trigger_type);
    setFormTargetCount(t.target_count);

    const rPts = Number(t.reward_points) || 0;
    const rRole = t.reward_role_id || t.trigger_config?.reward_role_id || '';
    setFormRewardPoints(rPts);
    setFormRewardRoleId(rRole);
    if (rPts > 0 && rRole) {
      setFormRewardType('both');
    } else if (rRole) {
      setFormRewardType('role');
    } else {
      setFormRewardType('points');
    }

    setFormActive(t.active);

    const cfg = t.trigger_config || {};
    setCfgCommand(cfg.command || 'สุ่มคำถาม');
    setCfgMediaType(cfg.media_type || 'music_link');
    setCfgKeywords(Array.isArray(cfg.keywords) ? cfg.keywords.join(', ') : (cfg.keywords || ''));
    setCfgMinMembers(Number(cfg.min_members) || 1);
    setCfgChannelId(cfg.channel_id || '');
    setCfgCategoryId(cfg.category_id || '');
    setCfgMessageUrl(cfg.message_url || '');
    setCfgTarotType(cfg.tarot_type || 'any');
    setCfgGameId(cfg.game_id ? String(cfg.game_id) : 'any');
    setDialogTab('info');
    setShowAdvancedConfig(false);
    setDialogOpen(true);
  };

  // Save (Create or Update) Template
  const handleSaveTemplate = async () => {
    if (!formTitle.trim()) {
      toast({ title: 'กรุณากรอกชื่อเควส', variant: 'destructive' });
      return;
    }
    if (!formDescription.trim()) {
      toast({ title: 'กรุณากรอกคำอธิบายเควส', variant: 'destructive' });
      return;
    }

    try {
      setActionLoading(true);

      const triggerConfig: Record<string, any> = {};

      if (formTriggerType === 'command_usage') {
        if (cfgCommand.trim()) triggerConfig.command = cfgCommand.trim();
      } else if (formTriggerType === 'chat_media') {
        triggerConfig.media_type = cfgMediaType;
      } else if (formTriggerType === 'keyword') {
        const kw = cfgKeywords
          .split(/[,，\n]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        triggerConfig.keywords = kw;
      } else if (formTriggerType === 'voice_duration') {
        if (Number(cfgMinMembers) > 1) {
          triggerConfig.min_members = Number(cfgMinMembers);
        }
        triggerConfig.minutes = Number(formTargetCount) || 15;
      } else if (formTriggerType === 'reaction_add') {
        if (cfgMessageUrl.trim()) triggerConfig.message_url = cfgMessageUrl.trim();
      } else if (formTriggerType === 'horoscope_usage') {
        if (cfgTarotType && cfgTarotType !== 'any') {
          triggerConfig.tarot_type = cfgTarotType;
        }
      } else if (formTriggerType === 'minigame_win' || formTriggerType === 'minigame_play') {
        if (cfgGameId && cfgGameId !== 'any') {
          triggerConfig.game_id = cfgGameId;
        }
      }

      if (cfgChannelId.trim()) {
        triggerConfig.channel_id = cfgChannelId.trim();
      }

      if (cfgCategoryId.trim()) {
        triggerConfig.category_id = cfgCategoryId.trim();
      }

      const finalPoints = formRewardType === 'role' ? 0 : (Number(formRewardPoints) || 0);
      const finalRoleId = formRewardType === 'points' ? null : (formRewardRoleId.trim() || null);

      if (finalRoleId) {
        triggerConfig.reward_role_id = finalRoleId;
        const roleName = discordRolesMap.get(finalRoleId)?.name || editingTemplate?.trigger_config?.reward_role_name;
        if (roleName) {
          triggerConfig.reward_role_name = roleName;
        }
      }

      const payload = {
        code: formCode.trim(),
        category: formCategory,
        title: formTitle.trim(),
        description: formDescription.trim(),
        trigger_type: formTriggerType,
        target_count: Number(formTargetCount) || 1,
        reward_points: finalPoints,
        reward_role_id: finalRoleId,
        trigger_config: triggerConfig,
        active: formActive,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('daily_quest_templates' as any)
          .update(payload)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast({ title: 'อัปเดตเควสสำเร็จ' });
      } else {
        const { error } = await supabase
          .from('daily_quest_templates' as any)
          .insert(payload);
        if (error) throw error;
        toast({ title: 'สร้างเควสใหม่สำเร็จ' });
      }

      setDialogOpen(false);
      await fetchTemplates();
    } catch (err: any) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('daily_quest_templates' as any)
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      toast({ title: 'ลบเควสเรียบร้อยแล้ว' });
      setDeleteConfirmOpen(false);
      setDeletingTemplate(null);
    } catch (err: any) {
      toast({
        title: 'ลบเควสไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Reroll Daily Quest Set (Option A: Exhaustion Cycle - 1 chat, 1 voice/community, 1 irl)
  const handleRerollDailySet = async () => {
    try {
      setActionLoading(true);

      if (!activeChatPool.length || !activeVoiceCommPool.length || !activeIrlPool.length) {
        toast({
          title: 'ไม่สามารถสุ่มชุดเควสได้',
          description: 'ต้องมีเควสที่เปิดใช้งานอยู่อย่างน้อย 1 เควสในแต่ละหมวดหมู่ (Chat, Voice/Community, IRL)',
          variant: 'destructive',
        });
        return;
      }

      // สุ่มจาก remainingInCycle ของแต่ละ Pool ตามลำดับ
      const chatCandidates = chatCycle.remainingInCycle.length > 0 ? chatCycle.remainingInCycle : activeChatPool;
      const voiceCommCandidates = voiceCommCycle.remainingInCycle.length > 0 ? voiceCommCycle.remainingInCycle : activeVoiceCommPool;
      const irlCandidates = irlCycle.remainingInCycle.length > 0 ? irlCycle.remainingInCycle : activeIrlPool;

      const randomChat = chatCandidates[Math.floor(Math.random() * chatCandidates.length)];
      const randomVoiceComm = voiceCommCandidates[Math.floor(Math.random() * voiceCommCandidates.length)];
      const randomIrl = irlCandidates[Math.floor(Math.random() * irlCandidates.length)];

      const questIds = [randomChat.id, randomVoiceComm.id, randomIrl.id];

      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .upsert(
          {
            quest_date: selectedDate,
            quest_ids: questIds,
            bonus_points: 50,
          },
          { onConflict: 'quest_date' }
        )
        .select()
        .single();

      if (error) throw error;

      setCurrentSet(data as DailyQuestSet);
      await fetchPastSets();
      toast({
        title: 'สุ่มชุดเควสใหม่สำเร็จ (Option A Exhaustion)',
        description: `ชุดเควสประจำวันที่ ${selectedDate} ได้รับการบันทึกโดยไม่ซ้ำในรอบปัจจุบัน`,
      });
    } catch (err: any) {
      toast({
        title: 'สุ่มชุดเควสไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Manual Set Selection Dialog (Populates current selections)
  const handleOpenManualSetDialog = () => {
    if (currentSet?.quest_ids) {
      const chatT = templates.find((t) => t.category === 'chat' && currentSet.quest_ids.includes(t.id));
      const voiceCommT = templates.find((t) => (t.category === 'voice' || t.category === 'community') && currentSet.quest_ids.includes(t.id));
      const irlT = templates.find((t) => t.category === 'irl' && currentSet.quest_ids.includes(t.id));

      setManualChatId(chatT?.id || chatCycle.remainingInCycle[0]?.id || activeChatPool[0]?.id || '');
      setManualVoiceCommId(voiceCommT?.id || voiceCommCycle.remainingInCycle[0]?.id || activeVoiceCommPool[0]?.id || '');
      setManualIrlId(irlT?.id || irlCycle.remainingInCycle[0]?.id || activeIrlPool[0]?.id || '');
    } else {
      setManualChatId(chatCycle.remainingInCycle[0]?.id || activeChatPool[0]?.id || '');
      setManualVoiceCommId(voiceCommCycle.remainingInCycle[0]?.id || activeVoiceCommPool[0]?.id || '');
      setManualIrlId(irlCycle.remainingInCycle[0]?.id || activeIrlPool[0]?.id || '');
    }
    setManualSetDialogOpen(true);
  };

  // Save Manual Set
  const handleSaveManualSet = async (chatId: string, voiceCommId: string, irlId: string) => {
    if (!chatId || !voiceCommId || !irlId) {
      toast({
        title: 'กรุณาเลือกเควสให้ครบทั้ง 3 หมวด',
        description: 'ต้องเลือก 1 แชท, 1 ห้องเสียง/ชุมชน, และ 1 กิจกรรมชีวิตจริง IRL',
        variant: 'destructive',
      });
      return;
    }
    try {
      setActionLoading(true);
      const questIds = [chatId, voiceCommId, irlId];

      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .upsert(
          {
            quest_date: selectedDate,
            quest_ids: questIds,
            bonus_points: 50,
          },
          { onConflict: 'quest_date' }
        )
        .select()
        .single();

      if (error) throw error;

      setCurrentSet(data as DailyQuestSet);
      await fetchPastSets();
      setManualSetDialogOpen(false);
      toast({
        title: 'บันทึกชุดเควสด้วยตนเองสำเร็จ!',
        description: `กำหนด 3 เควสประจำวันที่ ${selectedDate} เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Single Quest Replacement Dialog
  const handleOpenSingleSwapDialog = (categoryGroup: 'chat' | 'voice_comm' | 'irl') => {
    setSingleSwapGroup(categoryGroup);
    const pool = categoryGroup === 'chat' ? activeChatPool : categoryGroup === 'voice_comm' ? activeVoiceCommPool : activeIrlPool;
    const cycle = categoryGroup === 'chat' ? chatCycle : categoryGroup === 'voice_comm' ? voiceCommCycle : irlCycle;

    // Pick first candidate that is not currently selected
    const firstRemaining = cycle.remainingInCycle.find((t) => !currentSet?.quest_ids.includes(t.id));
    const firstOther = pool.find((t) => !currentSet?.quest_ids.includes(t.id));
    setSingleSwapSelectedId(firstRemaining?.id || firstOther?.id || pool[0]?.id || '');
    setSingleSwapDialogOpen(true);
  };

  // Save Single Quest Replacement
  const handleSaveSingleQuestSwap = async (categoryGroup: 'chat' | 'voice_comm' | 'irl', targetQuestId: string) => {
    if (!currentSet || !targetQuestId) return;
    try {
      setActionLoading(true);

      const oldIndex = currentSet.quest_ids.findIndex((id) => {
        const t = templates.find((tmp) => tmp.id === id);
        if (!t) return false;
        if (categoryGroup === 'chat') return t.category === 'chat';
        if (categoryGroup === 'voice_comm') return t.category === 'voice' || t.category === 'community';
        return t.category === 'irl';
      });

      const newQuestIds = [...currentSet.quest_ids];
      if (oldIndex >= 0) {
        newQuestIds[oldIndex] = targetQuestId;
      } else {
        newQuestIds.push(targetQuestId);
      }

      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .update({ quest_ids: newQuestIds })
        .eq('id', currentSet.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentSet(data as DailyQuestSet);
      await fetchPastSets();
      setSingleSwapDialogOpen(false);

      const targetTemplate = templates.find((t) => t.id === targetQuestId);
      toast({
        title: 'เปลี่ยนเควสสำเร็จ',
        description: `เปลี่ยนเป็น: ${targetTemplate?.title || targetQuestId}`,
      });
    } catch (err: any) {
      toast({
        title: 'เปลี่ยนเควสไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Swap Single Quest Randomly (Option A remaining pool)
  const handleSwapQuestInSet = async (categoryGroup: 'chat' | 'voice_comm' | 'irl') => {
    if (!currentSet) return;
    try {
      setActionLoading(true);
      const cycle = categoryGroup === 'chat' ? chatCycle : categoryGroup === 'voice_comm' ? voiceCommCycle : irlCycle;
      const pool = categoryGroup === 'chat' ? activeChatPool : categoryGroup === 'voice_comm' ? activeVoiceCommPool : activeIrlPool;

      let candidates = cycle.remainingInCycle.filter((t) => !currentSet.quest_ids.includes(t.id));
      if (candidates.length === 0) {
        candidates = pool.filter((t) => !currentSet.quest_ids.includes(t.id));
      }

      if (!candidates.length) {
        toast({
          title: 'ไม่มีเควสอื่นให้สลับ',
          description: 'ไม่มีเควสอื่นในหมวดหมู่นี้ที่เปิดใช้งานและยังไม่ได้ถูกเลือก',
          variant: 'destructive',
        });
        return;
      }

      const newQuest = candidates[Math.floor(Math.random() * candidates.length)];
      await handleSaveSingleQuestSwap(categoryGroup, newQuest.id);
    } catch (err: any) {
      toast({
        title: 'เปลี่ยนเควสไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Get current set quest templates
  const currentSetTemplates = useMemo(() => {
    if (!currentSet?.quest_ids) return [];
    return currentSet.quest_ids
      .map((id) => templates.find((t) => t.id === id))
      .filter(Boolean) as QuestTemplate[];
  }, [currentSet, templates]);

  // Generate announcement Component V2 JSON for preview and copying
  const announcementJson = useMemo(() => {
    if (!currentSetTemplates || currentSetTemplates.length === 0) return null;
    const d = new Date(selectedDate);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const day = d.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', day: 'numeric' });
    const monthIdx = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', month: 'numeric' }), 10) - 1;
    const year = parseInt(d.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }), 10) + 543;
    const thaiDate = `${day} ${thaiMonths[monthIdx]} ${year}`;

    const questComponents: any[] = [];
    currentSetTemplates.forEach((q) => {
      const parts: string[] = [];
      const pts = Number(q.reward_points) || 0;
      const roleId = q.reward_role_id || q.trigger_config?.reward_role_id;
      if (pts > 0) parts.push(`<:strawberryv2:1520439075100688614> **+${pts}**`);
      if (roleId) {
        const roleName = getRoleDisplayName(roleId, q.trigger_config?.reward_role_name);
        parts.push(`🎖️ **ยศ** \`@${roleName}\``);
      }
      const rewardStr = parts.length > 0 ? parts.join(' • ') : 'ไม่มีรางวัล';

      questComponents.push({
        type: 10,
        content: `## ${q.title}\n- __\`วิธีทำเควส\`__ : ${q.description}\n- __\`รางวัล\`__ : ${rewardStr}`,
      });
      questComponents.push({
        type: 14,
        spacing: 2,
      });
    });

    return {
      content: `<a:3602exclamationmarkbubble:1372837492205555812> เควสประจำวัน ${thaiDate} มาแล้ว! <@&1144700895020462200>`,
      flags: 32768,
      components: [
        {
          type: 17,
          components: [
            {
              type: 12,
              items: [
                {
                  media: {
                    url: 'https://cdn.discordapp.com/attachments/1524704267015819274/1550771948592701500/ChatGPT_Image_19_.._2569_13_54_04.png?ex=6ab380ec&is=6ab22f6c&hm=aa882b8c0feaf2104b4d078998ab385af499e9a24803e3a0d7b70f4541c55f1a&',
                  },
                },
              ],
            },
            {
              type: 9,
              components: [
                {
                  type: 10,
                  content: `## <:bee20000:1256669436350562355>︲__\` เควสประจำวันที่ ${thaiDate} 𓂃 \`__\n> (<a:7596clock:1160230591892029510>)⠀รีเซ็ตเควสในอีก: <t:NEXT_MIDNIGHT:R>`,
                },
              ],
              accessory: {
                style: 3,
                type: 2,
                flow: { actions: [] },
                custom_id: 'daily_quest_progress',
                label: 'ดูความคืบหน้าเควส',
              },
            },
            { type: 14, spacing: 1, divider: false },
            ...questComponents,
            {
              type: 9,
              components: [
                {
                  type: 10,
                  content: '# > รับข้อความพิเศษเมื่อทำเควสครบทั้งหมด <:strawberryv2:1520439075100688614> +50',
                },
              ],
              accessory: {
                type: 11,
                media: {
                  url: 'https://cdn.discordapp.com/attachments/1524704267015819274/1551949346981806090/06b20e483bfac611d837c1db30d5fbad.png?ex=6ab3d4f6&is=6ab28376&hm=c9873c872cb823c9a7c41ff041eb4ff0ba44b8287f3a588acbeecda8c973551b&',
                },
              },
            },
          ],
        },
      ],
    };
  }, [selectedDate, currentSetTemplates]);

  // Copy JSON handler
  const handleCopyJson = () => {
    if (!announcementJson) return;
    navigator.clipboard.writeText(JSON.stringify(announcementJson, null, 2));
    setCopiedJson(true);
    toast({ title: 'คัดลอก Component JSON สำเร็จ!' });
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Send announcement to Discord via Edge Function
  const handleSendAnnouncement = async () => {
    try {
      setSendingAnnouncement(true);
      const { data, error } = await supabase.functions.invoke('send-daily-quest-announcement', {
        body: { quest_date: selectedDate },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'ส่งการ์ดเควสไม่สำเร็จ');

      toast({
        title: 'ส่งประกาศเข้า Discord สำเร็จ!',
        description: `ส่ง Component ไปยังห้อง ${data.channelId || '1529885509260673034'} เรียบร้อยแล้ว (Message ID: ${data.messageId})`,
      });

      setSendDialogOpen(false);
      await fetchSetForDate(selectedDate);
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการส่งประกาศ',
        description: err.message || 'ไม่สามารถส่งข้อความได้',
        variant: 'destructive',
      });
    } finally {
      setSendingAnnouncement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 p-6 rounded-2xl border border-amber-500/20">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                ระบบเควสประจำวัน (Daily Quests)
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-semibold">
                  Beta Testing
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                จัดการคลังเควส ภารกิจประจำวัน และสถิติความสำเร็จของผู้ใช้
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-card px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              {templates.length}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">คลังเควสทั้งหมด</p>
              <p className="text-sm font-semibold">{templates.filter((t) => t.active).length} เปิดใช้งาน</p>
            </div>
          </div>

          <div className="bg-card px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
              🍓
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">โบนัสรายวัน</p>
              <p className="text-sm font-semibold">+50 แต้ม (ครบ 3 เควส)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Production Public Mode Alert Callout */}
      <div className="flex items-center justify-between p-3.5 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            <strong>โหมด Public:</strong> ปัจจุบันระบบบอทเปิดให้สมาชิกทุกคนในเซิร์ฟเวอร์สามารถทำภารกิจและสะสมแต้มได้แบบเรียลไทม์แล้วค่ะ 🐻✨
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="templates" className="rounded-lg gap-2 text-xs md:text-sm">
            <Target className="w-4 h-4" /> คลังเควส
          </TabsTrigger>
          <TabsTrigger value="sets" className="rounded-lg gap-2 text-xs md:text-sm">
            <Calendar className="w-4 h-4" /> เควสประจำวัน
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg gap-2 text-xs md:text-sm">
            <Award className="w-4 h-4" /> สถิติ & บันทึก
          </TabsTrigger>
        </TabsList>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: TEMPLATE CRUD
        ───────────────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          {/* Top Control Bar: Fast Category Chips + Quick Search + Action Buttons */}
          <div className="bg-card p-3.5 rounded-2xl border shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* One-Click Category Filter Pills (No Dropdown needed!) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'ทั้งหมด', icon: Target, count: categoryCounts.all, color: 'text-foreground' },
                  { id: 'chat', label: 'แชท', icon: MessageSquare, count: categoryCounts.chat, color: 'text-blue-500' },
                  { id: 'voice', label: 'ห้องเสียง', icon: Mic, count: categoryCounts.voice, color: 'text-emerald-500' },
                  { id: 'community', label: 'ชุมชน', icon: Users, count: categoryCounts.community, color: 'text-purple-500' },
                  { id: 'irl', label: 'ชีวิตจริง', icon: Camera, count: categoryCounts.irl, color: 'text-amber-500' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = categoryFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategoryFilter(item.id)}
                      className={cn(
                        "h-8 px-2.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5",
                        isActive
                          ? "bg-amber-500/15 border-amber-500/50 text-foreground font-bold shadow-sm ring-1 ring-amber-500/40"
                          : "bg-background/80 hover:bg-muted/70 text-muted-foreground border-border/70"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", item.color)} />
                      <span>{item.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                        isActive ? "bg-amber-500 text-stone-950" : "bg-muted text-muted-foreground"
                      )}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons: Refresh + Create */}
              <div className="flex items-center gap-2 shrink-0">
                <Button onClick={fetchTemplates} variant="outline" size="sm" className="h-8 px-2.5 text-xs rounded-xl" disabled={loading}>
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
                  รีเฟรช
                </Button>
                <Button onClick={handleOpenCreate} size="sm" className="h-8 px-3 text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  เพิ่มเควสใหม่
                </Button>
              </div>
            </div>

            {/* Sub-bar: Search Input with Quick Clear + Quick Status Chips */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border/50">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, คำอธิบาย หรือ Code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs rounded-xl"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills (No dropdown!) */}
              <div className="flex items-center gap-1 w-full sm:w-auto justify-end text-xs">
                <span className="text-[11px] text-muted-foreground mr-1">สถานะ:</span>
                {[
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'active', label: 'เปิดใช้' },
                  { id: 'inactive', label: 'ปิดอยู่' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                      statusFilter === st.id
                        ? "bg-foreground/10 text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Master-Detail Split Grid (Zero Page Scroll) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* ──── LEFT PANEL (5 cols): Compact Quest List ──── */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  รายการเควส ({filteredTemplates.length})
                </span>
                <span className="text-[11px]">คลิกเพื่อดูและจัดการ</span>
              </div>

              {/* Scrollable Quest Cards Container */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {filteredTemplates.length === 0 ? (
                  <div className="p-8 text-center bg-card rounded-2xl border text-muted-foreground text-xs space-y-2">
                    <Target className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p>ไม่พบเควสที่ตรงกับเงื่อนไขการค้นหา</p>
                  </div>
                ) : (
                  filteredTemplates.map((t) => {
                    const isSelected = activeSelectedTemplate?.id === t.id;
                    const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.chat;
                    const CatIcon = cat.icon;
                    const rPts = Number(t.reward_points) || 0;
                    const rRole = t.reward_role_id || t.trigger_config?.reward_role_id;

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={cn(
                          "p-3 rounded-2xl border text-left cursor-pointer transition-all space-y-2 relative group",
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/60 shadow-sm ring-1 ring-amber-500/40"
                            : "bg-card border-border/70 hover:border-amber-500/40 hover:bg-muted/30"
                        )}
                      >
                        {/* Header Row: Category Badge + Code + Quick Active Switch */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold py-0 px-1.5 gap-1 shrink-0", cat.badgeColor)}>
                              <CatIcon className="w-2.5 h-2.5" />
                              {cat.label}
                            </Badge>
                            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
                              {t.code}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className={cn("w-2 h-2 rounded-full", t.active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                            <Switch
                              checked={t.active}
                              onCheckedChange={() => handleToggleActive(t)}
                              className="scale-75"
                              title={t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            />
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {t.title}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {t.description}
                          </p>
                        </div>

                        {/* Footer Badges: Target, Rewards, Trigger Info */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                          <span className="text-muted-foreground font-medium">
                            เป้าหมาย: <strong className="text-foreground">{t.target_count}</strong> {t.trigger_type === 'voice_duration' ? 'นาที' : 'ครั้ง'}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {rPts > 0 && (
                              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] py-0 px-1.5 font-bold">
                                🍓 +{rPts}
                              </Badge>
                            )}
                            {rRole && (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] py-0 px-1.5 font-mono">
                                🎖️ ยศ
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ──── RIGHT PANEL (7 cols): Master Detail & Live Action Hub ──── */}
            <div className="lg:col-span-7 sticky top-4">
              {activeSelectedTemplate ? (
                <Card className="rounded-2xl border-2 border-border/80 shadow-md overflow-hidden bg-card">
                  {/* Color Accent Bar */}
                  <div className={cn(
                    'h-1.5 w-full',
                    (CATEGORY_MAP[activeSelectedTemplate.category] || CATEGORY_MAP.chat).color.replace('text-', 'bg-')
                  )} />

                  <CardHeader className="pb-3 space-y-3">
                    {/* Top Row: Category + Code + Actions */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-xs font-semibold py-0.5 px-2 gap-1.5",
                          (CATEGORY_MAP[activeSelectedTemplate.category] || CATEGORY_MAP.chat).badgeColor
                        )}>
                          {React.createElement((CATEGORY_MAP[activeSelectedTemplate.category] || CATEGORY_MAP.chat).icon, { className: 'w-3.5 h-3.5' })}
                          {(CATEGORY_MAP[activeSelectedTemplate.category] || CATEGORY_MAP.chat).label}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {activeSelectedTemplate.code}
                        </span>
                      </div>

                      {/* Action Buttons: Duplicate, Edit, Delete */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateTemplate(activeSelectedTemplate)}
                          className="h-8 px-2.5 text-xs rounded-xl hover:bg-muted font-medium gap-1.5"
                          title="ทำซ้ำเควสนี้เพื่อสร้างเควสใหม่คล้ายกัน"
                        >
                          <Copy className="w-3.5 h-3.5 text-blue-500" /> ทำซ้ำ
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleOpenEdit(activeSelectedTemplate)}
                          className="h-8 px-3 text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm gap-1.5"
                          title="แก้ไขรายละเอียดเควสนี้"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> แก้ไขเควส
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingTemplate(activeSelectedTemplate);
                            setDeleteConfirmOpen(true);
                          }}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl"
                          title="ลบเควสนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Quest Title & Full Description */}
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {activeSelectedTemplate.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {renderDescriptionWithMentions(activeSelectedTemplate.description)}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1 pb-5">
                    {/* Live Discord Component V2 Preview Snippet */}
                    <div className="p-3.5 bg-muted/40 dark:bg-[#161311] rounded-xl border border-border/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          พรีวิวการแสดงผลใน Discord (Component V2)
                        </span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          Live Preview
                        </Badge>
                      </div>

                      <div className="p-3 bg-background/80 rounded-xl border border-border/60 space-y-1.5 font-sans">
                        <div className="text-sm font-bold text-foreground">
                          ## {activeSelectedTemplate.title}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>- <strong className="font-mono text-foreground font-semibold">`วิธีทำเควส`</strong> : {activeSelectedTemplate.description}</div>
                          <div>
                            - <strong className="font-mono text-foreground font-semibold">`รางวัล`</strong> :{' '}
                            {(() => {
                              const pts = Number(activeSelectedTemplate.reward_points) || 0;
                              const roleId = activeSelectedTemplate.reward_role_id || activeSelectedTemplate.trigger_config?.reward_role_id;
                              const p: React.ReactNode[] = [];
                              if (pts > 0) p.push(<span key="pts" className="text-rose-500 font-bold">🍓 +{pts} แต้ม</span>);
                              if (roleId) {
                                const roleName = getRoleDisplayName(roleId, activeSelectedTemplate.trigger_config?.reward_role_name);
                                p.push(<span key="role" className="text-purple-500 font-mono font-bold">🎖️ ยศ `@{roleName}`</span>);
                              }
                              return p.length > 0 ? p.reduce((prev, curr) => [prev, ' • ', curr]) : 'ไม่มีรางวัล';
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trigger & Condition Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-muted/30 rounded-xl border space-y-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-blue-500" /> ทริกเกอร์ระบบ
                        </span>
                        <div className="font-mono font-bold text-foreground">
                          {activeSelectedTemplate.trigger_type}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          เป้าหมาย: {activeSelectedTemplate.target_count} {activeSelectedTemplate.trigger_type === 'voice_duration' ? 'นาที' : 'ครั้ง'}
                        </span>
                      </div>

                      <div className="p-3 bg-muted/30 rounded-xl border space-y-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-500" /> รางวัลทั้งหมด
                        </span>
                        <div className="font-bold text-foreground">
                          {Number(activeSelectedTemplate.reward_points) > 0 ? `🍓 +${activeSelectedTemplate.reward_points} แต้ม` : '0 แต้ม'}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {activeSelectedTemplate.reward_role_id || activeSelectedTemplate.trigger_config?.reward_role_id
                            ? `🎖️ มอบยศ (@${getRoleDisplayName(activeSelectedTemplate.reward_role_id || activeSelectedTemplate.trigger_config?.reward_role_id, activeSelectedTemplate.trigger_config?.reward_role_name)})`
                            : 'ไม่มีรางวัลยศ'}
                        </span>
                      </div>
                    </div>

                    {/* Special Scope/Locks (Voice Category / Channel / Keyword) */}
                    <div className="p-3 bg-muted/30 rounded-xl border space-y-2 text-xs">
                      <span className="text-[11px] font-semibold text-muted-foreground">ขอบเขต & เงื่อนไขพิเศษ:</span>
                      
                      <div className="space-y-1.5">
                        {activeSelectedTemplate.trigger_config?.category_id && (
                          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Folder className="w-3 h-3" /> จำกัดหมวดหมู่เสียง:
                            </span>
                            <span className="font-bold font-mono text-[11px]">
                              {KNOWN_VOICE_CATEGORIES[activeSelectedTemplate.trigger_config.category_id] || activeSelectedTemplate.trigger_config.category_id}
                            </span>
                          </div>
                        )}

                        {activeSelectedTemplate.trigger_config?.channel_id && (
                          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Hash className="w-3 h-3" /> จำกัดห้อง Discord:
                            </span>
                            <span className="font-bold font-mono text-[11px]">
                              {KNOWN_CHANNELS[activeSelectedTemplate.trigger_config.channel_id] || activeSelectedTemplate.trigger_config.channel_id}
                            </span>
                          </div>
                        )}

                        {activeSelectedTemplate.trigger_config?.command && (
                          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                            <span className="text-[11px]">คำสั่งที่ต้องพิมพ์:</span>
                            <span className="font-bold font-mono text-[11px]">/{activeSelectedTemplate.trigger_config.command}</span>
                          </div>
                        )}

                        {activeSelectedTemplate.trigger_config?.keywords && (
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                            <span className="text-[11px]">คำคีย์เวิร์ด:</span>
                            <span className="font-mono text-[11px]">
                              {Array.isArray(activeSelectedTemplate.trigger_config.keywords)
                                ? activeSelectedTemplate.trigger_config.keywords.join(', ')
                                : activeSelectedTemplate.trigger_config.keywords}
                            </span>
                          </div>
                        )}

                        {activeSelectedTemplate.trigger_config?.tarot_type && (
                          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                            <span className="text-[11px] flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> คำสั่งดูดวง:
                            </span>
                            <span className="font-bold font-mono text-[11px]">
                              {activeSelectedTemplate.trigger_config.tarot_type === 'any'
                                ? 'ทุกคำสั่งดูดวง'
                                : (TAROT_COMMANDS.find(t => t.value === activeSelectedTemplate.trigger_config.tarot_type)?.label.split('(')[0] || activeSelectedTemplate.trigger_config.tarot_type)}
                            </span>
                          </div>
                        )}

                        {activeSelectedTemplate.trigger_config?.game_id && (
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                            <span className="text-[11px] flex items-center gap-1">
                              <Gamepad2 className="w-3 h-3" /> มินิเกม:
                            </span>
                            <span className="font-bold font-mono text-[11px]">
                              {activeSelectedTemplate.trigger_config.game_id === 'any'
                                ? 'ทุกมินิเกม'
                                : (MINIGAME_OPTIONS.find(m => m.value === String(activeSelectedTemplate.trigger_config.game_id))?.label.split('—')[0] || `เกม ${activeSelectedTemplate.trigger_config.game_id}`)}
                            </span>
                          </div>
                        )}

                        {!activeSelectedTemplate.trigger_config?.category_id &&
                         !activeSelectedTemplate.trigger_config?.channel_id &&
                         !activeSelectedTemplate.trigger_config?.command &&
                         !activeSelectedTemplate.trigger_config?.keywords &&
                         !activeSelectedTemplate.trigger_config?.tarot_type &&
                         !activeSelectedTemplate.trigger_config?.game_id && (
                          <span className="text-muted-foreground text-[11px]">
                            ✓ ทำที่ห้องใดก็ได้ ไม่มีเงื่อนไขจำกัดเฉพาะห้อง
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="p-12 text-center bg-card rounded-2xl border text-muted-foreground text-xs">
                  เลือกเควสจากรายการด้านซ้ายเพื่อดูรายละเอียด
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: DAILY SETS & SCHEDULE
        ───────────────────────────────────────────────────────────── */}
        <TabsContent value="sets" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    ชุดเควสประจำวัน (Daily Quest Sets)
                  </CardTitle>
                  <CardDescription>
                    กำหนดหรือสุ่มเควสประจำวันสำหรับสมาชิก พร้อมตรวจสอบสถานะการประกาศในห้อง Discord
                  </CardDescription>
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={selectedDate === getBangkokDateString() ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(getBangkokDateString())}
                  >
                    วันนี้
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedDate === getBangkokDateString(1) ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(getBangkokDateString(1))}
                  >
                    พรุ่งนี้
                  </Button>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-38 h-9 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchSetForDate(selectedDate)}
                    disabled={actionLoading}
                  >
                    <RefreshCw className={cn('w-4 h-4', actionLoading && 'animate-spin')} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Daily Schedule Info Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/40 rounded-xl border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Clock className="w-4 h-4 text-amber-500" />
                      เวลารีเซ็ต & ประกาศเควส
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenScheduleDialog}
                      className="h-6 px-2 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1 font-medium"
                      title="เพิ่มหรือปรับเวลาที่บอทจะโพสต์ประกาศเควสประจำวัน"
                    >
                      <Edit2 className="w-3 h-3" /> ตั้งค่าเวลา
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-xs text-muted-foreground font-medium">รีเซ็ต 00:00 น. | ประกาศ:</span>
                    {announcementTimes.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="font-mono text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 py-0 px-1.5 flex items-center gap-1"
                      >
                        <Bell className="w-2.5 h-2.5 text-amber-500" />
                        {t} น.
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">เวลาประเทศไทย (GMT+7) ส่งตามรอบทุกวัน</p>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                      ห้องประกาศภารกิจ
                    </div>
                    {currentSet && currentSetTemplates.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1 font-medium"
                        onClick={() => setSendDialogOpen(true)}
                      >
                        <Send className="w-3 h-3" /> ส่งทันที
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium font-mono">1529885509260673034</p>
                  <p className="text-xs text-muted-foreground">
                    {currentSet?.announcement_message_id ? (
                      <span className="text-emerald-500 font-medium">✓ บอทประกาศแล้ว (Msg: {currentSet.announcement_message_id.slice(-6)})</span>
                    ) : (
                      <span className="text-amber-500 font-medium">รอการประกาศตามรอบ</span>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Flame className="w-4 h-4 text-rose-500" />
                    โบนัสประจำวัน
                  </div>
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-400 font-bold">+50 แต้มสตรอว์เบอร์รี 🍓</p>
                  <p className="text-xs text-muted-foreground">เมื่อทำครบทั้ง 3 ภารกิจในวันเดียวกัน</p>
                </div>
              </div>

              {/* Option A: Exhaustion Cycle Tracker Banner */}
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        รอบการสุ่มเควสประจำวัน (Exhaustion Cycle Tracker)
                        <Badge variant="outline" className="text-[10px] font-normal border-amber-500/30 text-amber-600 dark:text-amber-400">
                          Option A Active
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        ระบบหมุนเวียนเควสอัตโนมัติ ไม่ซ้ำเควสเดิมจนกว่าจะออกครบทุกเควสในหมวดหมู่
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ประวัติอ้างอิง: <span className="font-semibold text-foreground">{pastSets.length} วันที่ผ่านมา</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {/* Chat Pool Cycle */}
                  <div className="p-3 bg-background/80 rounded-xl border border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> แชท (Chat)
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        รอบที่ {chatCycle.cycleCount}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">ออกแล้วรอบนี้:</span>
                      <span className="font-bold text-foreground">
                        {chatCycle.usedInCycle.length} / {chatCycle.totalPoolCount}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${chatCycle.totalPoolCount ? Math.round((chatCycle.usedInCycle.length / chatCycle.totalPoolCount) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>เหลือยังไม่ออก: <strong className="text-blue-600 dark:text-blue-400">{chatCycle.remainingInCycle.length}</strong> เควส</span>
                      <span>{chatCycle.totalPoolCount ? Math.round((chatCycle.usedInCycle.length / chatCycle.totalPoolCount) * 100) : 0}%</span>
                    </div>
                  </div>

                  {/* Voice / Comm Pool Cycle */}
                  <div className="p-3 bg-background/80 rounded-xl border border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5" /> เสียง & ชุมชน
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        รอบที่ {voiceCommCycle.cycleCount}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">ออกแล้วรอบนี้:</span>
                      <span className="font-bold text-foreground">
                        {voiceCommCycle.usedInCycle.length} / {voiceCommCycle.totalPoolCount}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${voiceCommCycle.totalPoolCount ? Math.round((voiceCommCycle.usedInCycle.length / voiceCommCycle.totalPoolCount) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>เหลือยังไม่ออก: <strong className="text-emerald-600 dark:text-emerald-400">{voiceCommCycle.remainingInCycle.length}</strong> เควส</span>
                      <span>{voiceCommCycle.totalPoolCount ? Math.round((voiceCommCycle.usedInCycle.length / voiceCommCycle.totalPoolCount) * 100) : 0}%</span>
                    </div>
                  </div>

                  {/* IRL Pool Cycle */}
                  <div className="p-3 bg-background/80 rounded-xl border border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> ชีวิตจริง (IRL)
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        รอบที่ {irlCycle.cycleCount}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">ออกแล้วรอบนี้:</span>
                      <span className="font-bold text-foreground">
                        {irlCycle.usedInCycle.length} / {irlCycle.totalPoolCount}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${irlCycle.totalPoolCount ? Math.round((irlCycle.usedInCycle.length / irlCycle.totalPoolCount) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>เหลือยังไม่ออก: <strong className="text-amber-600 dark:text-amber-400">{irlCycle.remainingInCycle.length}</strong> เควส</span>
                      <span>{irlCycle.totalPoolCount ? Math.round((irlCycle.usedInCycle.length / irlCycle.totalPoolCount) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Set Display or Empty State */}
              {!currentSet || currentSetTemplates.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-2xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">ยังไม่มีการกำหนดชุดเควสสำหรับวันที่ {selectedDate}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      คุณสามารถสุ่มชุดเควสตามรอบ Exhaustion หรือเลือกเควสที่ต้องการด้วยตนเองได้ทันที
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      onClick={handleRerollDailySet}
                      disabled={actionLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-white shadow"
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      สุ่มสร้างชุดเควสทันที
                    </Button>
                    <Button
                      onClick={handleOpenManualSetDialog}
                      disabled={actionLoading}
                      variant="outline"
                      className="border-amber-500/40 hover:bg-amber-500/10 text-foreground"
                    >
                      <ListChecks className="w-4 h-4 mr-2 text-amber-600 dark:text-amber-400" />
                      เลือกเควสเอง
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      เควสประจำวันที่ {selectedDate} (3 รายการ)
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        onClick={handleRerollDailySet}
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        className="border-dashed hover:bg-amber-500/10"
                        title="สุ่มใหม่ทั้ง 3 ข้อ โดยดึงจากเควสที่ยังไม่ออกในรอบปัจจุบัน"
                      >
                        <Shuffle className="w-4 h-4 mr-2 text-amber-600" />
                        สุ่มใหม่ทั้ง 3 เควส
                      </Button>

                      <Button
                        onClick={handleOpenManualSetDialog}
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        className="border-amber-500/40 hover:bg-amber-500/10 text-foreground"
                        title="เลือกเควสทั้ง 3 หมวดหมู่ด้วยตนเอง"
                      >
                        <ListChecks className="w-4 h-4 mr-2 text-amber-600 dark:text-amber-400" />
                        เลือกเควสเอง
                      </Button>

                      <Button
                        onClick={() => setSendDialogOpen(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm gap-1.5"
                      >
                        <Send className="w-4 h-4" />
                        {currentSet?.announcement_message_id ? 'ส่งประกาศอีกครั้ง' : 'ส่ง Component หน้าเควส'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentSetTemplates.map((quest, idx) => {
                      const cat = CATEGORY_MAP[quest.category] || CATEGORY_MAP.chat;
                      const CatIcon = cat.icon;
                      const swapGroup = quest.category === 'chat' ? 'chat' : (quest.category === 'irl' ? 'irl' : 'voice_comm');

                      return (
                        <Card key={quest.id} className="relative overflow-hidden border-2 border-border/80 hover:border-amber-500/40 transition-all shadow-sm">
                          <div className={cn('h-1.5 w-full', cat.color.replace('text-', 'bg-'))} />
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={cn('text-xs font-semibold py-0.5', cat.badgeColor)}>
                                <CatIcon className="w-3 h-3 mr-1" />
                                ภารกิจที่ {idx + 1} ({cat.label})
                              </Badge>
                              <div className="flex items-center gap-1">
                                {Number(quest.reward_points) > 0 && (
                                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none font-bold text-xs">
                                    🍓 +{quest.reward_points}
                                  </Badge>
                                )}
                                {(quest.reward_role_id || quest.trigger_config?.reward_role_id) && (
                                  <Badge
                                    className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-none font-bold text-xs"
                                    title={`Role: @${getRoleDisplayName(quest.reward_role_id || quest.trigger_config?.reward_role_id, quest.trigger_config?.reward_role_name)}`}
                                  >
                                    🎖️ ยศ @{getRoleDisplayName(quest.reward_role_id || quest.trigger_config?.reward_role_id, quest.trigger_config?.reward_role_name)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardTitle className="text-base mt-2 font-bold line-clamp-1">{quest.title}</CardTitle>
                            <CardDescription className="text-xs line-clamp-2 h-9">
                              {renderDescriptionWithMentions(quest.description)}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-2 pb-4 space-y-3">
                            <div className="p-2.5 bg-muted/50 rounded-lg text-xs space-y-1">
                              <div className="flex justify-between text-muted-foreground">
                                <span>เป้าหมาย:</span>
                                <span className="font-semibold text-foreground">
                                  {quest.target_count} ครั้ง/นาที
                                </span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>ทริกเกอร์:</span>
                                <span className="font-mono text-[11px] text-foreground truncate max-w-[140px]">
                                  {quest.trigger_type}
                                </span>
                              </div>
                              {quest.trigger_config?.category_id && (
                                <div className="flex justify-between text-muted-foreground pt-0.5">
                                  <span>หมวดเสียง:</span>
                                  <span className="font-medium text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-[140px] flex items-center gap-1">
                                    <Folder className="w-2.5 h-2.5 shrink-0" />
                                    {KNOWN_VOICE_CATEGORIES[quest.trigger_config.category_id] || quest.trigger_config.category_id.slice(-6)}
                                  </span>
                                </div>
                              )}
                              {quest.trigger_config?.channel_id && (
                                <div className="flex justify-between text-muted-foreground pt-0.5">
                                  <span>ห้อง:</span>
                                  <span className="font-medium text-[11px] text-sky-600 dark:text-sky-400 truncate max-w-[140px] flex items-center gap-1">
                                    <Hash className="w-2.5 h-2.5 shrink-0" />
                                    {KNOWN_CHANNELS[quest.trigger_config.channel_id] || quest.trigger_config.channel_id.slice(-6)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => handleSwapQuestInSet(swapGroup)}
                                variant="outline"
                                size="sm"
                                className="text-xs hover:bg-muted"
                                disabled={actionLoading}
                                title="สุ่มเควสอื่นในหมวดหมู่นี้ตามรอบ Exhaustion"
                              >
                                <Shuffle className="w-3 h-3 mr-1.5 text-muted-foreground" />
                                สลับสุ่ม
                              </Button>

                              <Button
                                onClick={() => handleOpenSingleSwapDialog(swapGroup)}
                                variant="outline"
                                size="sm"
                                className="text-xs hover:bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                                disabled={actionLoading}
                                title="เปิดรายการเพื่อเลือกเควสที่ต้องการโดยตรง"
                              >
                                <ListChecks className="w-3 h-3 mr-1.5 text-amber-600 dark:text-amber-400" />
                                เลือกเควส...
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: ANALYTICS & RECENT COMPLETIONS
        ───────────────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">กดตรวจความคืบหน้า</p>
                <p className="text-2xl font-bold">{formatNumber(analyticsStats.totalProgressChecks)}</p>
                <p className="text-[11px] text-muted-foreground">จากปุ่ม "ดูความคืบหน้า"</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">เควสที่ทำสำเร็จทั้งหมด</p>
                <p className="text-2xl font-bold">{formatNumber(analyticsStats.totalCompletions)}</p>
                <p className="text-[11px] text-emerald-600 font-medium">สำเร็จตามเงื่อนไข</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">รับโบนัสครบ 3 เควส</p>
                <p className="text-2xl font-bold">{formatNumber(analyticsStats.totalBonuses)}</p>
                <p className="text-[11px] text-amber-600 font-medium">+50 แต้มโบนัส</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">แจกแต้มสะสมโดยรวม</p>
                <p className="text-2xl font-bold text-rose-600">🍓 {formatNumber(analyticsStats.pointsDistributed)}</p>
                <p className="text-[11px] text-muted-foreground">แต้มสตรอว์เบอร์รีทั้งหมด</p>
              </div>
            </Card>
          </div>

          {/* Recent Completions Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ประวัติการทำภารกิจสำเร็จล่าสุด
                  </CardTitle>
                  <CardDescription>
                    รายการสมาชิกที่ทำเควสสำเร็จและได้รับแต้มสตรอว์เบอร์รี
                  </CardDescription>
                </div>
                <Button onClick={fetchAnalytics} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-1.5" /> รีเฟรช
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>ผู้ใช้ (Discord ID)</TableHead>
                    <TableHead>วันที่ภารกิจ</TableHead>
                    <TableHead>เควสที่ทำสำเร็จ</TableHead>
                    <TableHead className="text-center">ความคืบหน้า</TableHead>
                    <TableHead className="text-center">แต้มที่ได้รับ</TableHead>
                    <TableHead className="text-right">เวลาที่สำเร็จ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCompletions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        ยังไม่มีประวัติการทำเควสสำเร็จในระบบ
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentCompletions.map((item) => {
                      const quest = templates.find((t) => t.id === item.quest_id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {item.user_id}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.quest_date}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-sm text-foreground">
                              {quest?.title || item.quest_id}
                            </span>
                            {quest && (
                              <Badge variant="outline" className="ml-2 text-[10px] py-0">
                                {quest.category.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            <span className="text-emerald-600 font-bold">{item.current_progress}</span> / {item.target_count}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-xs">
                              🍓 +{quest?.reward_points || 5}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {item.completed_at ? new Date(item.completed_at).toLocaleString('th-TH') : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─────────────────────────────────────────────────────────────
          CREATE / EDIT TEMPLATE DIALOG
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl">
          {/* Header */}
          <div className="p-5 pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {editingTemplate ? 'แก้ไขเควสแม่แบบ' : 'เพิ่มเควสแม่แบบใหม่'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {editingTemplate ? `กำลังแก้ไข: ${editingTemplate.title}` : 'สร้างภารกิจใหม่เพื่อนำไปใช้สุ่มหรือเลือกในเควสประจำวัน'}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* 2 Tabs Segmented Switch */}
            <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 bg-muted/60 rounded-xl">
              <button
                type="button"
                onClick={() => setDialogTab('info')}
                className={cn(
                  "py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                  dialogTab === 'info'
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>📝 ข้อมูลเควส & เงื่อนไข</span>
              </button>
              <button
                type="button"
                onClick={() => setDialogTab('rewards')}
                className={cn(
                  "py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                  dialogTab === 'rewards'
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>🎁 รางวัล & ขอบเขต</span>
                {(formRewardPoints > 0 || formRewardRoleId) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            </div>
          </div>

          {/* Tab 1: Info & Triggers */}
          {dialogTab === 'info' && (
            <div className="p-5 space-y-4">
              {/* Category Segmented Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">หมวดหมู่ภารกิจ</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'chat', label: 'แชท', icon: MessageSquare, color: 'text-blue-500' },
                    { id: 'voice', label: 'ห้องเสียง', icon: Mic, color: 'text-emerald-500' },
                    { id: 'community', label: 'ชุมชน/บอท', icon: Users, color: 'text-purple-500' },
                    { id: 'irl', label: 'ชีวิตจริง', icon: Camera, color: 'text-amber-500' },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = formCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const newCat = cat.id as any;
                          setFormCategory(newCat);
                          const avail = TRIGGERS_BY_CATEGORY[newCat];
                          if (avail && avail.length > 0) {
                            setFormTriggerType(avail[0].value);
                            if (newCat === 'voice') setFormTargetCount(15);
                            else if (newCat === 'community' || newCat === 'irl') setFormTargetCount(1);
                            else setFormTargetCount(5);
                          }
                        }}
                        className={cn(
                          "py-2 px-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 text-xs",
                          isSelected
                            ? "bg-amber-500/15 border-amber-500/60 font-bold text-foreground shadow-sm ring-1 ring-amber-500/40"
                            : "bg-background hover:bg-muted text-muted-foreground border-border/70"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", cat.color)} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">ชื่อภารกิจ</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="เช่น 🌸 ︰ มอบดอกไม้ให้เพื่อน หรือ 🌙 ︰ สิงห้องเสียง"
                    className="text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">คำอธิบายวิธีทำ</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="เช่น ใช้คำสั่ง /มอบดอกไม้ ให้เพื่อนในห้องแชท หรือ ลงห้องไหนก็ได้ 1 ชม."
                    className="text-xs text-muted-foreground"
                  />
                </div>
              </div>

              {/* Trigger Type Filtered by Category */}
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/80 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      รูปแบบกิจกรรมที่ต้องทำ
                    </label>
                    <span className="text-[10px] text-muted-foreground">ระบบบอทตรวจจับอัตโนมัติ</span>
                  </div>

                  <Select
                    value={formTriggerType}
                    onValueChange={(val: any) => setFormTriggerType(val)}
                  >
                    <SelectTrigger className="text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(TRIGGERS_BY_CATEGORY[formCategory] || []).map((tr) => (
                        <SelectItem key={tr.value} value={tr.value} className="text-xs py-1.5">
                          <div>
                            <div className="font-semibold text-foreground">{tr.label}</div>
                            <div className="text-[10px] text-muted-foreground">{tr.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Specific option single control */}
                {formTriggerType === 'horoscope_usage' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                      <Sparkles className="w-3.5 h-3.5" /> คำสั่งดูดวงที่ตรวจจับ
                    </label>
                    <Select
                      value={cfgTarotType}
                      onValueChange={(val) => {
                        setCfgTarotType(val);
                        if (!cfgChannelId) setCfgChannelId('1524122936183754893');
                      }}
                    >
                      <SelectTrigger className="text-xs bg-background">
                        <SelectValue placeholder="เลือกคำสั่งดูดวง" />
                      </SelectTrigger>
                      <SelectContent>
                        {TAROT_COMMANDS.map((tc) => (
                          <SelectItem key={tc.value} value={tc.value} className="text-xs">
                            {tc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(formTriggerType === 'minigame_win' || formTriggerType === 'minigame_play') && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {formTriggerType === 'minigame_win' ? 'มินิเกมที่ต้องชนะ' : 'มินิเกมที่ต้องเล่น'}
                    </label>
                    <Select
                      value={cfgGameId}
                      onValueChange={(val) => {
                        setCfgGameId(val);
                        const gameChannelMap: Record<string, string> = {
                          '1': '1534437994327572510',
                          '2': '1534453700188176506',
                          '3': '1534454001532272730',
                          '4': '1534458749782200390',
                          '5': '1544201307894587472',
                          '6': '1534469630234726431',
                          '7': '1534471900112486410',
                          '8': '1534472719603994784',
                          '9': '1534473855660593172',
                          '10': '1534474757305925743',
                          '11': '1534475484803764355',
                          '12': '1534477382499696773',
                          '13': '1534478149889556531',
                        };
                        if (val in gameChannelMap) setCfgChannelId(gameChannelMap[val]);
                        else if (val === 'any') setCfgChannelId('');
                      }}
                    >
                      <SelectTrigger className="text-xs bg-background">
                        <SelectValue placeholder="เลือกมินิเกม" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px]">
                        {MINIGAME_OPTIONS.map((mo) => (
                          <SelectItem key={mo.value} value={mo.value} className="text-xs">
                            {mo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formTriggerType === 'command_usage' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <Terminal className="w-3.5 h-3.5" /> คำสั่ง Slash Command
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={COMMON_SLASH_COMMANDS.some(c => c.name === cfgCommand) ? cfgCommand : 'custom'}
                        onValueChange={(val) => {
                          if (val !== 'custom') setCfgCommand(val);
                        }}
                      >
                        <SelectTrigger className="text-xs bg-background">
                          <SelectValue placeholder="เลือกคำสั่งยอดนิยม" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_SLASH_COMMANDS.map((cmd) => (
                            <SelectItem key={cmd.name} value={cmd.name} className="text-xs">
                              /{cmd.name} ({cmd.desc})
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" className="text-xs">
                            ✏️ พิมพ์คำสั่งเอง...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={cfgCommand}
                        onChange={(e) => setCfgCommand(e.target.value)}
                        placeholder="ชื่อคำสั่ง เช่น มอบดอกไม้"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {formTriggerType === 'keyword' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> คำคีย์เวิร์ดที่ต้องพิมพ์
                    </label>
                    <Input
                      value={cfgKeywords}
                      onChange={(e) => setCfgKeywords(e.target.value)}
                      placeholder="เช่น morning, gm, มอนิ่ง (คั่นด้วยจุลภาค)"
                      className="text-xs"
                    />
                  </div>
                )}

                {formTriggerType === 'chat_media' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCfgMediaType('music_link')}
                      className={cn(
                        "p-2.5 rounded-xl border text-left text-xs transition-all",
                        cfgMediaType === 'music_link'
                          ? "bg-rose-500/15 border-rose-500/50 font-bold text-rose-600 dark:text-rose-400"
                          : "bg-background hover:bg-muted text-muted-foreground"
                      )}
                    >
                      🎵 ลิงก์เพลง (YouTube, Spotify)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCfgMediaType('sticker_or_gif')}
                      className={cn(
                        "p-2.5 rounded-xl border text-left text-xs transition-all",
                        cfgMediaType === 'sticker_or_gif'
                          ? "bg-amber-500/15 border-amber-500/50 font-bold text-amber-600 dark:text-amber-400"
                          : "bg-background hover:bg-muted text-muted-foreground"
                      )}
                    >
                      😂 สติกเกอร์ หรือ GIF
                    </button>
                  </div>
                )}

                {formTriggerType === 'voice_duration' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCfgMinMembers(1)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left text-xs transition-all",
                        cfgMinMembers === 1
                          ? "bg-emerald-500/15 border-emerald-500/50 font-bold text-emerald-700 dark:text-emerald-300"
                          : "bg-background hover:bg-muted text-muted-foreground"
                      )}
                    >
                      👤 นั่งคนเดียวได้
                    </button>
                    <button
                      type="button"
                      onClick={() => setCfgMinMembers(2)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left text-xs transition-all",
                        cfgMinMembers === 2
                          ? "bg-emerald-500/15 border-emerald-500/50 font-bold text-emerald-700 dark:text-emerald-300"
                          : "bg-background hover:bg-muted text-muted-foreground"
                      )}
                    >
                      👥 มีเพื่อน 2 คนขึ้นไป
                    </button>
                  </div>
                )}

                {formTriggerType === 'reaction_add' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground">ลิงก์ข้อความที่ต้องกด (เว้นว่าง = ข้อความไหนก็ได้)</label>
                    <Input
                      value={cfgMessageUrl}
                      onChange={(e) => setCfgMessageUrl(e.target.value)}
                      placeholder="https://discord.com/channels/..."
                      className="text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Target Count */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {formTriggerType === 'voice_duration' ? 'ระยะเวลาเป้าหมาย (นาที)' : 'จำนวนเป้าหมาย (ครั้ง)'}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formTargetCount}
                  onChange={(e) => setFormTargetCount(Number(e.target.value))}
                  className="text-xs font-semibold"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Rewards & Scope */}
          {dialogTab === 'rewards' && (
            <div className="p-5 space-y-4">
              {/* Reward Type Selection */}
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    การกำหนดรางวัลภารกิจ
                  </label>
                  <span className="text-[10px] text-muted-foreground">เลือกแต้ม, ยศ หรือทั้งสอง</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRewardType('points')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all text-xs font-medium",
                      formRewardType === 'points'
                        ? "bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-400 font-bold shadow-sm"
                        : "bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    🍓 แต้มอย่างเดียว
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRewardType('role')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all text-xs font-medium",
                      formRewardType === 'role'
                        ? "bg-purple-500/15 border-purple-500/50 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                        : "bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    🎖️ ยศอย่างเดียว
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRewardType('both')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all text-xs font-medium",
                      formRewardType === 'both'
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold shadow-sm"
                        : "bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    ✨ ทั้งแต้มและยศ
                  </button>
                </div>

                {(formRewardType === 'points' || formRewardType === 'both') && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground">แต้มสตรอว์เบอร์รี (🍓)</label>
                    <Input
                      type="number"
                      min="1"
                      value={formRewardPoints}
                      onChange={(e) => setFormRewardPoints(Number(e.target.value))}
                      placeholder="เช่น 5, 10, 30"
                      className="text-xs font-mono"
                    />
                  </div>
                )}

                {(formRewardType === 'role' || formRewardType === 'both') && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-500" /> รหัสยศ Discord (Role ID)
                      </span>
                      {formRewardRoleId && (
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          @{getRoleDisplayName(formRewardRoleId, editingTemplate?.trigger_config?.reward_role_name)}
                        </span>
                      )}
                    </label>
                    <Input
                      value={formRewardRoleId}
                      onChange={(e) => setFormRewardRoleId(e.target.value)}
                      placeholder="เช่น 1144700895020462200"
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      💡 เมื่อทำเควสนี้สำเร็จ บอทจะมอบยศนี้ให้สมาชิกใน Discord ทันที (จะแสดงเป็น `@rolename` ในประกาศเควส)
                    </p>
                  </div>
                )}
              </div>

              {/* Channel Scope Selection (Clean Dropdown, zero button clutter) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-sky-500" />
                    จำกัดห้อง Discord
                  </label>
                  <span className="text-[10px] text-muted-foreground">เว้นว่าง = ทำห้องไหนก็ได้</span>
                </div>

                <Select
                  value={cfgChannelId || 'any'}
                  onValueChange={(val) => setCfgChannelId(val === 'any' ? '' : val)}
                >
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="เลือกห้องที่ต้องการจำกัด..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    <SelectItem value="any">🌐 ทำห้องไหนก็ได้ (ไม่จำกัดห้อง)</SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold text-sky-600">ห้องทั่วไป & กิจกรรม</SelectLabel>
                      <SelectItem value="1524123296466079884">#แชร์เพลง</SelectItem>
                      <SelectItem value="1524122867178930237">#ห้องต้อนรับ</SelectItem>
                      <SelectItem value="1524124172580814979">#ส่งรูปถ่าย-irl</SelectItem>
                      <SelectItem value="1524122936183754893">#🔮 ดูดวง-เสี่ยงทาย</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-bold text-amber-600">ห้องมินิเกม (1-13)</SelectLabel>
                      {Object.entries(KNOWN_CHANNELS)
                        .filter(([id, name]) => name.includes('เกม'))
                        .map(([chId, chName]) => (
                          <SelectItem key={chId} value={chId} className="text-xs">
                            #{chName}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Category Scope (Shown only for Voice Quests) */}
              {formCategory === 'voice' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-emerald-500" />
                    จำกัดหมวดหมู่ห้องเสียง
                  </label>
                  <Select
                    value={cfgCategoryId || 'any'}
                    onValueChange={(val) => setCfgCategoryId(val === 'any' ? '' : val)}
                  >
                    <SelectTrigger className="text-xs bg-background">
                      <SelectValue placeholder="เลือกหมวดหมู่ห้องเสียง..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">🔊 ห้องเสียงทุกหมวด (ไม่จำกัด)</SelectItem>
                      {Object.entries(KNOWN_VOICE_CATEGORIES).map(([catId, catName]) => (
                        <SelectItem key={catId} value={catId} className="text-xs">
                          {catName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border/80">
                <div>
                  <div className="text-xs font-semibold text-foreground">เปิดใช้งานเควสนี้</div>
                  <div className="text-[11px] text-muted-foreground">พร้อมนำไปสุ่มในรอบเควสประจำวัน</div>
                </div>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>

              {/* Collapsible Advanced Settings (Code / Custom Channel ID) */}
              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                  className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-medium py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    ตั้งค่าขั้นสูง (รหัสเควส & Channel ID กำหนดเอง)
                  </span>
                  {showAdvancedConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAdvancedConfig && (
                  <div className="mt-3 p-3 bg-muted/40 rounded-xl border border-border/80 space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-medium">รหัสเควส (Code):</label>
                      <Input
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                        placeholder="เช่น morning_bear หรือ custom_8527"
                        disabled={!!editingTemplate}
                        className="text-xs font-mono h-8"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {editingTemplate ? 'รหัสเควสไม่สามารถเปลี่ยนได้เมื่อสร้างแล้ว' : 'ระบบสร้างให้อัตโนมัติ สามารถแก้เป็นรหัสที่ต้องการได้'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-muted-foreground font-medium">ระบุ Channel ID กำหนดเอง:</label>
                      <Input
                        value={cfgChannelId}
                        onChange={(e) => setCfgChannelId(e.target.value)}
                        placeholder="ระบุ Discord Channel ID เช่น 1524124172580814979"
                        className="text-xs font-mono h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (dialogTab === 'rewards') setDialogTab('info');
                else setDialogOpen(false);
              }}
              className="text-xs h-9 rounded-xl"
            >
              {dialogTab === 'rewards' ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> ย้อนกลับ
                </>
              ) : (
                'ยกเลิก'
              )}
            </Button>

            <div className="flex items-center gap-2">
              {dialogTab === 'info' ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setDialogTab('rewards')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 rounded-xl gap-1"
                >
                  ถัดไป (ตั้งค่ารางวัล) <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={actionLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 rounded-xl font-semibold shadow-sm"
                >
                  {actionLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลเควส'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          DELETE CONFIRM DIALOG
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              ยืนยันการลบเควส
            </DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบเควส <code className="font-mono font-semibold">{deletingTemplate?.code}</code>? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={actionLoading}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={actionLoading}>
              {actionLoading ? 'กำลังลบ...' : 'ยืนยันลบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          SEND ANNOUNCEMENT COMPONENT DIALOG
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Send className="w-5 h-5" />
              ส่ง Component หน้าเควสประจำวันลง Discord
            </DialogTitle>
            <DialogDescription>
              ระบบจะส่งการ์ดประกาศภารกิจประจำวัน (Discord Component V2) ไปยังห้องแชทที่กำหนด พร้อมปุ่ม "ดูความคืบหน้า"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Channel Info */}
            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> ห้องเป้าหมาย
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  ID: 1529885509260673034
                </Badge>
              </div>
              <p className="text-sm font-semibold text-foreground">
                #ภารกิจประจำวัน
              </p>
              <p className="text-xs text-muted-foreground">
                ชุดเควสประจำวันที่: <strong>{selectedDate}</strong>
              </p>
            </div>

            {/* Quests Summary to send */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                รายการเควสที่จะส่ง ({currentSetTemplates.length} รายการ):
              </p>
              <div className="space-y-1.5">
                {currentSetTemplates.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-2.5 bg-muted/40 rounded-lg border text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        ข้อ {idx + 1}
                      </Badge>
                      <span className="font-medium text-foreground truncate">
                        {q.title}
                      </span>
                    </div>
                    <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[11px] shrink-0">
                      🍓 +{q.reward_points}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw JSON Actions & Viewer */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-8 gap-1"
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  <Code className="w-3.5 h-3.5" />
                  {showRawJson ? 'ซ่อน Raw JSON' : 'ดู Raw Component JSON'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1.5"
                  onClick={handleCopyJson}
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600">คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      คัดลอก JSON
                    </>
                  )}
                </Button>
              </div>

              {showRawJson && announcementJson && (
                <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(announcementJson, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              disabled={sendingAnnouncement}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSendAnnouncement}
              disabled={sendingAnnouncement || currentSetTemplates.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium"
            >
              {sendingAnnouncement ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังส่งประกาศ...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  ยืนยันส่งลง Discord ทันที
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MANUAL SET SELECTOR DIALOG (Option A: 3-Category Picker)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={manualSetDialogOpen} onOpenChange={setManualSetDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="w-5 h-5 text-amber-500" />
              เลือกชุดเควสประจำวันด้วยตนเอง (Manual Quest Selector)
            </DialogTitle>
            <DialogDescription>
              กำหนด 3 เควสประจำวันสำหรับวันที่ {selectedDate} โดยเลือก 1 เควสจากแต่ละหมวดหมู่ (ระบบจะไฮไลต์เควสที่ยังไม่ออกในรอบปัจจุบัน)
            </DialogDescription>
          </DialogHeader>

          {/* 3 Columns for 3 categories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            {/* Column 1: Chat */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  1. หมวดแชท ({activeChatPool.length})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  เหลือ {chatCycle.remainingInCycle.length} เควส
                </Badge>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {activeChatPool.map((t) => {
                  const isSelected = manualChatId === t.id;
                  const isUsedInCycle = chatCycle.usedInCycle.some((u) => u.id === t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setManualChatId(t.id)}
                      className={cn(
                        'p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5 relative',
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-sm ring-2 ring-blue-500/40'
                          : 'border-border/70 hover:border-blue-500/40 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold line-clamp-1 text-foreground">{t.title}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="font-mono text-muted-foreground">{t.trigger_type} ({t.target_count})</span>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[9px] py-0 px-1 bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            🍓 +{t.reward_points}
                          </Badge>
                          {isUsedInCycle ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground bg-muted">
                              ออกแล้วรอบนี้
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] py-0 px-1 bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              ✨ ยังไม่ออก
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Voice & Community */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  2. ห้องเสียง/ชุมชน ({activeVoiceCommPool.length})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  เหลือ {voiceCommCycle.remainingInCycle.length} เควส
                </Badge>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {activeVoiceCommPool.map((t) => {
                  const isSelected = manualVoiceCommId === t.id;
                  const isUsedInCycle = voiceCommCycle.usedInCycle.some((u) => u.id === t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setManualVoiceCommId(t.id)}
                      className={cn(
                        'p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5 relative',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/40'
                          : 'border-border/70 hover:border-emerald-500/40 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold line-clamp-1 text-foreground">{t.title}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="font-mono text-muted-foreground">{t.trigger_type} ({t.target_count})</span>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[9px] py-0 px-1 bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            🍓 +{t.reward_points}
                          </Badge>
                          {isUsedInCycle ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground bg-muted">
                              ออกแล้วรอบนี้
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] py-0 px-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              ✨ ยังไม่ออก
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: IRL */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  3. ชีวิตจริง IRL ({activeIrlPool.length})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  เหลือ {irlCycle.remainingInCycle.length} เควส
                </Badge>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {activeIrlPool.map((t) => {
                  const isSelected = manualIrlId === t.id;
                  const isUsedInCycle = irlCycle.usedInCycle.some((u) => u.id === t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setManualIrlId(t.id)}
                      className={cn(
                        'p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5 relative',
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-2 ring-amber-500/40'
                          : 'border-border/70 hover:border-amber-500/40 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold line-clamp-1 text-foreground">{t.title}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="font-mono text-muted-foreground">{t.trigger_type} ({t.target_count})</span>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[9px] py-0 px-1 bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            🍓 +{t.reward_points}
                          </Badge>
                          {isUsedInCycle ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground bg-muted">
                              ออกแล้วรอบนี้
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              ✨ ยังไม่ออก
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto flex-wrap">
              <span>สถานะเลือก:</span>
              <Badge variant={manualChatId ? 'default' : 'outline'} className="text-[10px]">
                {manualChatId ? '✓ แชท' : 'รอเลือกแชท'}
              </Badge>
              <Badge variant={manualVoiceCommId ? 'default' : 'outline'} className="text-[10px]">
                {manualVoiceCommId ? '✓ เสียง/ชุมชน' : 'รอเลือกเสียง'}
              </Badge>
              <Badge variant={manualIrlId ? 'default' : 'outline'} className="text-[10px]">
                {manualIrlId ? '✓ IRL' : 'รอเลือก IRL'}
              </Badge>
            </div>
            <Button
              variant="outline"
              onClick={() => setManualSetDialogOpen(false)}
              disabled={actionLoading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleSaveManualSet(manualChatId, manualVoiceCommId, manualIrlId)}
              disabled={actionLoading || !manualChatId || !manualVoiceCommId || !manualIrlId}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow"
            >
              <Check className="w-4 h-4" />
              บันทึกชุดเควสนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          SINGLE QUEST REPLACEMENT DIALOG (Per-Category Picker)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={singleSwapDialogOpen} onOpenChange={setSingleSwapDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ListChecks className="w-5 h-5 text-amber-500" />
              เลือกเควสใหม่สำหรับหมวด {singleSwapGroup === 'chat' ? 'แชท (Chat)' : singleSwapGroup === 'irl' ? 'ชีวิตจริง (IRL)' : 'ห้องเสียง & ชุมชน'}
            </DialogTitle>
            <DialogDescription>
              เลือกเควสที่ต้องการนำมาใส่แทนที่เควสเดิมในชุดเควสประจำวันนี้ (วันที่ {selectedDate})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[460px] overflow-y-auto pr-1">
            {singleSwapCandidates.map((t) => {
              const isSelected = singleSwapSelectedId === t.id;
              const isCurrentInSet = currentSet?.quest_ids?.includes(t.id);
              const isUsedInCycle = singleSwapCycle.usedInCycle.some((u) => u.id === t.id);

              return (
                <div
                  key={t.id}
                  onClick={() => setSingleSwapSelectedId(t.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left cursor-pointer transition-all space-y-1.5',
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-2 ring-amber-500/40'
                      : isCurrentInSet
                      ? 'border-border/40 bg-muted/20 opacity-70'
                      : 'border-border/70 hover:border-amber-500/40 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {t.title}
                      {isCurrentInSet && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-border text-muted-foreground">
                          กำลังใช้อยู่
                        </Badge>
                      )}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.description}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="font-mono text-muted-foreground">{t.trigger_type} ({t.target_count})</span>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9px] py-0 px-1">
                        🍓 +{t.reward_points}
                      </Badge>
                      {isUsedInCycle ? (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground bg-muted">
                          ออกแล้วรอบนี้
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          ✨ ยังไม่ออก
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button
              variant="outline"
              onClick={() => setSingleSwapDialogOpen(false)}
              disabled={actionLoading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleSaveSingleQuestSwap(singleSwapGroup, singleSwapSelectedId)}
              disabled={actionLoading || !singleSwapSelectedId}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow"
            >
              <Check className="w-4 h-4" />
              ยืนยันเปลี่ยนเควส
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          ANNOUNCEMENT SCHEDULE SETTINGS DIALOG (Multi-time announcements)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-amber-500" />
              ตั้งค่าเวลาประกาศเควสประจำวัน
            </DialogTitle>
            <DialogDescription>
              กำหนดเวลาที่บอทจะโพสต์การ์ดเควสประจำวันลง Discord สามารถเพิ่มได้หลายเวลาใน 1 วัน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Active Times List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  รอบเวลาประกาศ ({scheduleModalTimes.length} เวลา)
                </label>
                <span className="text-[11px] text-muted-foreground">เวลาประเทศไทย (GMT+7)</span>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border/80 flex flex-wrap gap-2 min-h-[52px] items-center">
                {scheduleModalTimes.map((timeStr) => (
                  <Badge
                    key={timeStr}
                    variant="secondary"
                    className="font-mono text-xs px-2.5 py-1 bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 flex items-center gap-2 shadow-sm"
                  >
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>{timeStr} น.</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScheduleTime(timeStr)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                      title={`ลบเวลา ${timeStr}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick Add Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">กดเพิ่มเวลาด่วน:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { time: '08:00', label: '08:00 (เช้า)' },
                  { time: '12:00', label: '12:00 (เที่ยง)' },
                  { time: '18:00', label: '18:00 (เย็น)' },
                  { time: '20:00', label: '20:00 (ค่ำ)' },
                  { time: '22:00', label: '22:00 (ดึก)' },
                ].map((item) => {
                  const isAlreadyAdded = scheduleModalTimes.includes(item.time);
                  return (
                    <button
                      key={item.time}
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => handleAddScheduleTime(item.time)}
                      className={cn(
                        "px-2 py-1 text-[11px] rounded-lg border transition-all flex items-center gap-1 font-mono",
                        isAlreadyAdded
                          ? "bg-muted text-muted-foreground/50 border-border/40 cursor-not-allowed"
                          : "bg-background hover:bg-amber-500/10 text-foreground hover:border-amber-500/40"
                      )}
                    >
                      <Plus className="w-3 h-3 text-amber-500" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Time Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">หรือระบุเวลาด้วยตนเอง (HH:mm)</label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newTimeInput}
                  onChange={(e) => setNewTimeInput(e.target.value)}
                  placeholder="08:00"
                  className="font-mono text-sm h-9"
                />
                <Button
                  type="button"
                  onClick={() => handleAddScheduleTime(newTimeInput)}
                  disabled={!newTimeInput}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1 h-9 px-3"
                >
                  <Plus className="w-4 h-4" /> เพิ่มเวลา
                </Button>
              </div>
            </div>

            {/* Target Channel & Role ID */}
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-blue-500" />
                  Discord Channel ID สำหรับส่งประกาศ
                </label>
                <Input
                  value={scheduleModalChanId}
                  onChange={(e) => setScheduleModalChanId(e.target.value)}
                  placeholder="1529885509260673034"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  Discord Role ID สำหรับแท็กแจ้งเตือน (Ping Role)
                </label>
                <Input
                  value={scheduleModalRoleId}
                  onChange={(e) => setScheduleModalRoleId(e.target.value)}
                  placeholder="1144700895020462200"
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button
              variant="outline"
              onClick={() => setScheduleDialogOpen(false)}
              disabled={savingSchedule}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveScheduleSettings}
              disabled={savingSchedule || scheduleModalTimes.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow"
            >
              {savingSchedule ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  บันทึกการตั้งค่า
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
