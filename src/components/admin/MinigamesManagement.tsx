import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichSelect, type RichSelectItem } from '@/components/ui/rich-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Gamepad2, Plus, Trash2, Save, RefreshCw, Trophy, Sparkles, Medal, Award, Crown,
  Calendar, Infinity as InfinityIcon, Settings2, Edit3, Search, Info, ListFilter,
  CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Eye, Volume2, Headphones,
  Keyboard, Laptop, Globe, Check, AlertCircle, Radio
} from 'lucide-react';

export interface MinigameConfig {
  id: number;
  name: string;
  icon: string;
  tag: string;
  categoryGroup: 'vocab_typing' | 'audio_tts' | 'translation_chain' | 'logic_math';
  desc: string;
  discordNote: string;
}

export const MINIGAME_CONFIGS: Record<number, MinigameConfig> = {
  1: {
    id: 1,
    name: 'เติมคำศัพท์ (ไทย)',
    icon: '🇹🇭',
    tag: 'คำศัพท์ไทย',
    categoryGroup: 'vocab_typing',
    desc: 'เติมพยัญชนะ/สระในช่องว่าง (แชร์คลังคำศัพท์ไทยกับเกม 6)',
    discordNote: 'บอทจะสุ่มซ่อน 2-3 ตัวอักษร เช่น กรอก "สวัสดี" บอทจะแสดง "ส _ _ ส ดี"',
  },
  2: {
    id: 2,
    name: 'เติมคำศัพท์ (อังกฤษ)',
    icon: '🇬🇧',
    tag: 'คำศัพท์อังกฤษ',
    categoryGroup: 'vocab_typing',
    desc: 'เติมตัวอักษรภาษาอังกฤษในช่องว่าง (แชร์คลังคำศัพท์อังกฤษกับเกม 7)',
    discordNote: 'บอทจะสุ่มซ่อน 2-3 ตัวอักษร เช่น กรอก "banana" บอทจะแสดง "b _ _ a n a"',
  },
  3: {
    id: 3,
    name: 'สุ่มโจทย์คณิตฯ',
    icon: '🔢',
    tag: 'คณิตศาสตร์ (บอทสร้าง)',
    categoryGroup: 'logic_math',
    desc: 'ระบบสุ่มตัวเลขและสมการบวก ลบ คูณ ตามระดับความยากอัตโนมัติจากโค้ดบอท',
    discordNote: 'โจทย์คณิตฯ สร้างอัตโนมัติจากโค้ดบอท ไม่จำเป็นต้องเพิ่มคำถามในคลัง',
  },
  4: {
    id: 4,
    name: 'ทายคำจากคำใบ้',
    icon: '💡',
    tag: 'คำใบ้ 3 ข้อ',
    categoryGroup: 'logic_math',
    desc: 'ทายคำจากคำใบ้ 3 ข้อ พร้อมระบุระดับความยาก (ง่าย/ปานกลาง/ยาก)',
    discordNote: 'บอทจะทยอยเปิดคำใบ้ 3 ข้อความ พร้อมระดับความยากและแต้มรางวัล',
  },
  5: {
    id: 5,
    name: 'ฟังเสียงแล้วพิมพ์ตอบ (อังกฤษ)',
    icon: '🎧',
    tag: 'ฟังเสียง TTS อังกฤษ',
    categoryGroup: 'audio_tts',
    desc: 'ฟังไฟล์เสียงภาษาอังกฤษ (Google TTS) แล้วพิมพ์คำศัพท์ภาษาอังกฤษให้ถูกต้อง',
    discordNote: 'บอทจะส่งไฟล์เสียง MP3 ภาษาอังกฤษให้ผู้เล่นฟังในดิสคอร์ด แล้วพิมพ์ตอบ',
  },
  6: {
    id: 6,
    name: 'พิมพ์คำต่อไปนี้ (ไทย)',
    icon: '⌨️',
    tag: 'พิมพ์เร็วไทย',
    categoryGroup: 'vocab_typing',
    desc: 'แข่งพิมพ์ข้อความหรือประโยคภาษาไทยให้ถูกต้องรวดเร็ว (แชร์คลังคำศัพท์ไทยกับเกม 1)',
    discordNote: 'บอทจะแสดงข้อความโจทย์ ให้ผู้เล่นพิมพ์ซ้ำให้เหมือนกัน 100% เร็วที่สุด',
  },
  7: {
    id: 7,
    name: 'พิมพ์คำต่อไปนี้ (อังกฤษ)',
    icon: '💻',
    tag: 'พิมพ์เร็วอังกฤษ',
    categoryGroup: 'vocab_typing',
    desc: 'แข่งพิมพ์ข้อความหรือประโยคภาษาอังกฤษให้ถูกต้องรวดเร็ว (แชร์คลังคำศัพท์อังกฤษกับเกม 2)',
    discordNote: 'บอทจะแสดงประโยคภาษาอังกฤษ ให้ผู้เล่นพิมพ์ซ้ำให้เหมือนกัน 100% เร็วที่สุด',
  },
  8: {
    id: 8,
    name: 'ทายคำแปลภาษาอังกฤษ',
    icon: '🌐',
    tag: 'คู่คำแปล (EN ➔ TH)',
    categoryGroup: 'translation_chain',
    desc: 'โจทย์ภาษาอังกฤษ ➔ ตัวเลือกคำแปลไทย (แชร์คลังคู่คำแปลกับเกม 9)',
    discordNote: 'บอทแสดงคำศัพท์อังกฤษ แล้วสุ่มตัวเลือกคำแปลภาษาไทย 3 ชอยส์ให้กดเลือก',
  },
  9: {
    id: 9,
    name: 'ทายคำแปลภาษาไทย',
    icon: '🇹🇭',
    tag: 'คู่คำแปล (TH ➔ EN)',
    categoryGroup: 'translation_chain',
    desc: 'โจทย์ภาษาไทย ➔ ตัวเลือกคำแปลอังกฤษ (ใช้คลังเดียวกับเกม 8 สลับชอยส์อัตโนมัติ)',
    discordNote: 'ใช้คลังเดียวกับเกม 8! บอทจะนำคำแปลไทยมาเป็นโจทย์ และสลับคำศัพท์อังกฤษเป็นชอยส์',
  },
  10: {
    id: 10,
    name: 'เกมต่อคำ',
    icon: '🔗',
    tag: 'ต่อคำ (หน้า ➔ หลัง)',
    categoryGroup: 'translation_chain',
    desc: 'โจทย์คำขึ้นต้น (คำหน้า) ➔ เฉลยคำต่อท้าย (คำหลัง) เช่น น้ำ ➔ แข็ง, ดาว ➔ ตก',
    discordNote: 'บอทแสดงคำขึ้นต้น แล้วสุ่มตัวเลือกคำต่อท้ายให้ผู้เล่นเลือกข้อที่ถูกต้อง',
  },
  11: {
    id: 11,
    name: 'ฟังเสียงแล้วพิมพ์ตอบ (ไทย)',
    icon: '🔊',
    tag: 'ฟังเสียง TTS ไทย',
    categoryGroup: 'audio_tts',
    desc: 'ฟังไฟล์เสียงภาษาไทย (Google TTS) แล้วพิมพ์คำศัพท์ภาษาไทยให้ถูกต้อง',
    discordNote: 'บอทจะส่งไฟล์เสียง MP3 ภาษาไทยให้ผู้เล่นฟังในดิสคอร์ด แล้วพิมพ์ตอบ',
  },
  12: {
    id: 12,
    name: 'จริงหรือเท็จ',
    icon: '❓',
    tag: 'จริง/เท็จ (True/False)',
    categoryGroup: 'logic_math',
    desc: 'ทายว่าข้อความหรือข้อเท็จจริงนั้น จริง หรือ เท็จ',
    discordNote: 'บอทแสดงข้อความคำถาม และแสดงปุ่มกด 2 ตัวเลือก: [จริง] และ [เท็จ]',
  },
};

const MINIGAME_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'game-1',
    label: 'เกม 1: เติมคำศัพท์ (ไทย)',
    value: '1',
    description: 'คำศัพท์ภาษาไทย • บอทจะสุ่มขีดช่องว่างให้อัตโนมัติ (แชร์ร่วมกับเกม 6)',
    icon: '🇹🇭',
    badge: 'คำศัพท์ไทย',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'game-2',
    label: 'เกม 2: เติมคำศัพท์ (อังกฤษ)',
    value: '2',
    description: 'คำศัพท์ภาษาอังกฤษ • บอทจะสุ่มขีดช่องว่างให้อัตโนมัติ (แชร์ร่วมกับเกม 7)',
    icon: '🇬🇧',
    badge: 'คำศัพท์อังกฤษ',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  },
  {
    id: 'game-3',
    label: 'เกม 3: สุ่มโจทย์คณิตฯ (อัตโนมัติ)',
    value: '3',
    description: 'โจทย์คำนวณตัวเลขและสมการ • บอทสร้างอัตโนมัติจากโค้ด (ไม่ต้องเพิ่มโจทย์)',
    icon: '🔢',
    badge: 'บอทสร้างอัตโนมัติ',
    badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  },
  {
    id: 'game-4',
    label: 'เกม 4: ทายคำจากคำใบ้',
    value: '4',
    description: 'โจทย์ 3 ข้อความคำใบ้ • เลือกระดับความยาก (ง่าย/ปานกลาง/ยาก)',
    icon: '💡',
    badge: '3 คำใบ้',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'game-5',
    label: 'เกม 5: ฟังเสียงแล้วพิมพ์ตอบ (อังกฤษ)',
    value: '5',
    description: 'คำศัพท์ภาษาอังกฤษ • บอทสังเคราะห์เสียง Google TTS อังกฤษให้ฟังใน Discord',
    icon: '🎧',
    badge: 'เสียง TTS อังกฤษ',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  },
  {
    id: 'game-6',
    label: 'เกม 6: พิมพ์คำต่อไปนี้ (ไทย)',
    value: '6',
    description: 'ประโยค/ข้อความภาษาไทยสำหรับแข่งพิมพ์เร็ว (แชร์คลังคำศัพท์ไทยกับเกม 1)',
    icon: '⌨️',
    badge: 'พิมพ์เร็วไทย',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  {
    id: 'game-7',
    label: 'เกม 7: พิมพ์คำต่อไปนี้ (อังกฤษ)',
    value: '7',
    description: 'ประโยค/ข้อความภาษาอังกฤษสำหรับแข่งพิมพ์เร็ว (แชร์คลังคำศัพท์อังกฤษกับเกม 2)',
    icon: '💻',
    badge: 'พิมพ์เร็วอังกฤษ',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
  },
  {
    id: 'game-8',
    label: 'เกม 8: ทายคำแปลภาษาอังกฤษ (EN ➔ TH)',
    value: '8',
    description: 'โจทย์ภาษาอังกฤษ ➔ ตัวเลือกคำแปลภาษาไทย (แชร์คลังคู่คำแปลกับเกม 9)',
    icon: '🌐',
    badge: 'คู่แปล (EN ➔ TH)',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  },
  {
    id: 'game-9',
    label: 'เกม 9: ทายคำแปลภาษาไทย (TH ➔ EN)',
    value: '9',
    description: 'โจทย์ภาษาไทย ➔ ตัวเลือกคำแปลภาษาอังกฤษ (ใช้คลังเดียวกับเกม 8 สลับชอยส์อัตโนมัติ)',
    icon: '🇹🇭',
    badge: 'คู่แปล (TH ➔ EN)',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
  },
  {
    id: 'game-10',
    label: 'เกม 10: เกมต่อคำ (คำหน้า ➔ คำหลัง)',
    value: '10',
    description: 'ต่อคำศัพท์เชื่อมโยง • คำขึ้นต้น (คำหน้า) ➔ คำต่อท้าย (คำหลัง) เช่น น้ำ ➔ แข็ง',
    icon: '🔗',
    badge: 'ต่อคำเชื่อมโยง',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  },
  {
    id: 'game-11',
    label: 'เกม 11: ฟังเสียงแล้วพิมพ์ตอบ (ไทย)',
    value: '11',
    description: 'คำศัพท์ภาษาไทย • บอทสังเคราะห์เสียง Google TTS ไทยให้ฟังใน Discord',
    icon: '🔊',
    badge: 'เสียง TTS ไทย',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
  {
    id: 'game-12',
    label: 'เกม 12: จริงหรือเท็จ (True/False)',
    value: '12',
    description: 'ข้อความหรือข้อเท็จจริง • เลือกตอบ จริง [✅] หรือ เท็จ [❌]',
    icon: '❓',
    badge: 'จริง / เท็จ',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  },
];

const GAME_GROUPS = [
  { id: 'all', label: 'ทั้งหมด (12 เกม)', icon: '🎮' },
  { id: 'vocab_typing', label: 'คำศัพท์ & พิมพ์เร็ว (1, 2, 6, 7)', icon: '⌨️' },
  { id: 'audio_tts', label: 'ฟังเสียง TTS (5, 11)', icon: '🎧' },
  { id: 'translation_chain', label: 'คำแปล & ต่อคำ (8, 9, 10)', icon: '🌐' },
  { id: 'logic_math', label: 'คำใบ้, จริงเท็จ & คณิต (3, 4, 12)', icon: '💡' },
];

const DIFFICULTY_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'diff-easy',
    label: 'ง่าย (Easy)',
    value: 'easy',
    description: 'โจทย์ระดับเริ่มต้น เหมาะกับทุกคน ได้รับ 2-3 แต้ม',
    icon: '🟢',
    badge: '2-3 แต้ม',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  {
    id: 'diff-medium',
    label: 'ปานกลาง (Medium)',
    value: 'medium',
    description: 'โจทย์ระดับมาตรฐาน มีความท้าทาย ได้รับ 4-6 แต้ม',
    icon: '🟡',
    badge: '4-6 แต้ม',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'diff-hard',
    label: 'ยาก (Hard)',
    value: 'hard',
    description: 'โจทย์ระดับยากขั้นสูงสำหรับผู้เล่นระดับเซียน ได้รับ 7-10 แต้ม',
    icon: '🔴',
    badge: '7-10 แต้ม',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
];

interface MinigameSetting {
  game_id: number;
  game_name: string;
  channel_id: string;
  is_enabled: boolean;
  min_points: number;
  max_points: number;
}

interface Question {
  id: number;
  game_id: number;
  word_or_question: string;
  answer: string;
  hints: string[];
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard' | null;
  category?: string | null;
  is_active: boolean;
}

interface LeaderboardItem {
  discord_id: string;
  total_wins: number;
  total_points: number;
  last_win: string;
}

// Helper: Map game ID to the target pool game_ids used by Discord Bot (bearcafe-bot/src/features/minigames/questionBank.js)
export function getBotTargetGameIds(gameId: number): number[] {
  if (gameId === 1 || gameId === 6) return [1, 6];
  if (gameId === 2 || gameId === 7) return [2, 7];
  if (gameId === 8 || gameId === 9) return [8, 9];
  return [gameId];
}

export function MinigamesManagement() {
  const { toast } = useToast();

  // Settings & Questions state
  const [settings, setSettings] = useState<MinigameSetting[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('all');
  const [allGameCounts, setAllGameCounts] = useState<Record<number, number>>({});
  const [directGameCounts, setDirectGameCounts] = useState<Record<number, number>>({});
  const [botPoolCounts, setBotPoolCounts] = useState<Record<number, number | string>>({});
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchMatchMode, setSearchMatchMode] = useState<'starts_with' | 'contains' | 'exact'>('starts_with');

  // Form Add Question state
  const [formGameId, setFormGameId] = useState<string>('1');
  const [formQuestion, setFormQuestion] = useState<string>('');
  const [formAnswer, setFormAnswer] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('คำทั่วไป');
  const [formDifficulty, setFormDifficulty] = useState<string>('medium');
  const [formHint1, setFormHint1] = useState<string>('');
  const [formHint2, setFormHint2] = useState<string>('');
  const [formHint3, setFormHint3] = useState<string>('');

  // Category filter state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Edit Modal state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('คำทั่วไป');
  const [editDifficulty, setEditDifficulty] = useState<string>('medium');
  const [editHint1, setEditHint1] = useState<string>('');
  const [editHint2, setEditHint2] = useState<string>('');
  const [editHint3, setEditHint3] = useState<string>('');

  // Leaderboard state
  const [lbTimeFilter, setLbTimeFilter] = useState<'30d' | 'all'>('30d');
  const [lbGameFilter, setLbGameFilter] = useState<string>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, { username: string; discord_username: string | null; avatar_url: string | null }>>({});
  const [lbPage, setLbPage] = useState(1);
  const [lbItemsPerPage, setLbItemsPerPage] = useState(10);

  // Question Pagination state
  const [qPage, setQPage] = useState(1);
  const [qItemsPerPage, setQItemsPerPage] = useState(15);

  useEffect(() => {
    setQPage(1);
  }, [searchKeyword, searchMatchMode, selectedCategoryFilter, selectedGameFilter]);

  useEffect(() => {
    setLbPage(1);
  }, [lbTimeFilter, lbGameFilter]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('minigame_settings')
        .select('*')
        .order('game_id', { ascending: true });

      if (error) throw error;
      setSettings((data as any) || []);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลดตั้งค่ามินิเกม', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  // Fetch Questions Count per Game (Exact DB counts via HEAD count=exact + Bot Pool mappings)
  const fetchGameCounts = useCallback(async () => {
    try {
      const direct: Record<number, number> = {};
      const gameIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      await Promise.all(
        gameIds.map(async (gid) => {
          const { count, error } = await (supabase as any)
            .from('minigame_questions')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', gid);
          direct[gid] = (!error && typeof count === 'number') ? count : 0;
        })
      );
      direct[3] = 0; // Game 3 is dynamic math generated by bot

      setDirectGameCounts(direct);
      setAllGameCounts(direct);

      // Bot Pool Counts according to bearcafe-bot/src/features/minigames/questionBank.js
      const botPool: Record<number, number | string> = {
        1: (direct[1] || 0) + (direct[6] || 0),
        2: (direct[2] || 0) + (direct[7] || 0),
        3: 'Auto ⚡',
        4: direct[4] || 0,
        5: direct[5] || 0,
        6: (direct[6] || 0) + (direct[1] || 0),
        7: (direct[7] || 0) + (direct[2] || 0),
        8: (direct[8] || 0) + (direct[9] || 0),
        9: (direct[9] || 0) + (direct[8] || 0),
        10: direct[10] || 0,
        11: direct[11] || 0,
        12: direct[12] || 0,
      };
      setBotPoolCounts(botPool);
    } catch (err) {
      console.error('Error fetching question counts:', err);
    }
  }, []);

  // Fetch Questions (supports bot shared pools and loads up to 2000 questions)
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      let query = (supabase as any)
        .from('minigame_questions')
        .select('id, game_id, word_or_question, answer, category, hints, options, difficulty, is_active')
        .order('id', { ascending: false })
        .limit(2000);

      if (selectedGameFilter !== 'all') {
        const targetIds = getBotTargetGameIds(Number(selectedGameFilter));
        if (targetIds.length === 1) {
          query = query.eq('game_id', targetIds[0]);
        } else {
          query = query.in('game_id', targetIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuestions((data as any) || []);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลดคลังโจทย์', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingQuestions(false);
    }
  }, [selectedGameFilter, toast]);

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLb(true);
    try {
      const daysParam = lbTimeFilter === '30d' ? 30 : null;
      const gameParam = lbGameFilter !== 'all' ? Number(lbGameFilter) : null;

      // 1. Try RPC get_minigame_leaderboard
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_minigame_leaderboard', {
        days_limit: daysParam,
        filter_game_id: gameParam
      });

      if (!rpcErr && rpcData) {
        const sorted: LeaderboardItem[] = rpcData.map((row: any) => ({
          discord_id: row.discord_id,
          total_wins: Number(row.wins || 0),
          total_points: Number(row.points || 0),
          last_win: row.last_win || new Date().toISOString()
        }));
        setLeaderboard(sorted);
        return;
      }

      // 2. Try View minigame_leaderboard_summary
      const { data: summaryData, error: summaryErr } = await (supabase as any)
        .from('minigame_leaderboard_summary')
        .select('discord_id, wins, points, last_win')
        .limit(100);

      if (!summaryErr && summaryData && summaryData.length > 0) {
        const sorted: LeaderboardItem[] = summaryData.map((row: any) => ({
          discord_id: row.discord_id,
          total_wins: Number(row.wins || 0),
          total_points: Number(row.points || 0),
          last_win: row.last_win || new Date().toISOString()
        }));
        setLeaderboard(sorted);
        return;
      }

      // 3. Fallback query with strict limit (500 rows max)
      let query = (supabase as any)
        .from('minigame_wins')
        .select('discord_id, game_id, points_earned, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (lbTimeFilter === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      if (lbGameFilter !== 'all') {
        query = query.eq('game_id', Number(lbGameFilter));
      }

      const { data, error } = await query;
      if (error) throw error;

      const statsMap = new Map<string, LeaderboardItem>();
      for (const row of (data || []) as any[]) {
        const uid = row.discord_id;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            discord_id: uid,
            total_wins: 0,
            total_points: 0,
            last_win: row.created_at
          });
        }

        const stat = statsMap.get(uid)!;
        stat.total_wins += 1;
        stat.total_points += Number(row.points_earned || 0);

        if (new Date(row.created_at) > new Date(stat.last_win)) {
          stat.last_win = row.created_at;
        }
      }

      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
        return b.total_points - a.total_points;
      });

      setLeaderboard(sorted);

      // Fetch profiles for leaderboard discord_ids
      const discordIds = sorted.map((item) => item.discord_id).filter(Boolean);
      if (discordIds.length > 0) {
        const uniqueIds = Array.from(new Set(discordIds));
        const profilesMap: Record<string, { username: string; discord_username: string | null; avatar_url: string | null }> = {};
        const chunkSize = 100;
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
          const chunk = uniqueIds.slice(i, i + chunkSize);
          const { data: pData } = await (supabase as any)
            .from('profiles')
            .select('discord_id, username, discord_username, avatar_url')
            .in('discord_id', chunk);
          if (pData) {
            for (const p of pData) {
              profilesMap[p.discord_id] = {
                username: p.username,
                discord_username: p.discord_username ?? null,
                avatar_url: p.avatar_url ?? null,
              };
            }
          }
        }
        setUserProfilesMap(profilesMap);
      }
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการดึงข้อมูลจัดอันดับ', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingLb(false);
    }
  }, [lbGameFilter, lbTimeFilter, toast]);

  useEffect(() => {
    fetchSettings();
    fetchGameCounts();
  }, [fetchSettings, fetchGameCounts]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSettingUpdate = async (game: MinigameSetting) => {
    try {
      const minP = Math.max(1, Number(game.min_points) || 1);
      const maxP = Math.max(minP, Number(game.max_points) || minP);

      const { error } = await (supabase as any)
        .from('minigame_settings')
        .upsert({
          game_id: game.game_id,
          game_name: game.game_name,
          channel_id: game.channel_id,
          is_enabled: game.is_enabled,
          min_points: minP,
          max_points: maxP,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast({ title: 'บันทึกสำเร็จ', description: `บันทึกการตั้งค่า ${game.game_name} (เกม #${game.game_id}) เรียบร้อยแล้ว` });
      fetchSettings();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const gId = Number(formGameId);
    if (gId === 3) return; // Game 3 is auto-generated math

    const finalQuestion = formQuestion.trim();
    let finalAnswer = formAnswer.trim();

    // Auto-fill answer for typing games (Game 6 & 7) or audio games (Game 5 & 11) if left blank
    if ((gId === 5 || gId === 6 || gId === 7 || gId === 11) && !finalAnswer) {
      finalAnswer = finalQuestion;
    }

    // Game 12: True/False defaults to 'จริง' if blank
    if (gId === 12 && !finalAnswer) {
      finalAnswer = 'จริง';
    }

    if (!finalQuestion || !finalAnswer) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }

    const isDiffGame = (gId === 4);
    const finalDiff = isDiffGame ? formDifficulty : null;

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [formHint1.trim(), formHint2.trim(), formHint3.trim()].filter(Boolean);
    }

    let optionsArray: string[] = [];
    if (gId === 12) {
      optionsArray = ['จริง', 'เท็จ'];
    }

    try {
      const { error } = await (supabase as any)
        .from('minigame_questions')
        .insert({
          game_id: gId,
          word_or_question: finalQuestion,
          answer: finalAnswer,
          category: formCategory.trim() || 'คำทั่วไป',
          hints: hintsArray,
          options: optionsArray,
          difficulty: finalDiff,
          is_active: true
        });

      if (error) throw error;
      toast({ title: 'เพิ่มคำศัพท์สำเร็จ', description: `เพิ่มข้อมูลเข้าคลังเกม #${gId} เรียบร้อยแล้วค่ะ` });
      setFormQuestion('');
      if (gId !== 12) setFormAnswer('');
      setFormHint1(''); setFormHint2(''); setFormHint3('');
      fetchQuestions();
      fetchGameCounts();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึกโจทย์', description: err.message, variant: 'destructive' });
    }
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEditQuestion(q.word_or_question || '');
    setEditAnswer(q.answer || '');
    setEditCategory(q.category || 'คำทั่วไป');
    setEditDifficulty(q.difficulty || 'medium');
    setEditHint1(q.hints?.[0] || '');
    setEditHint2(q.hints?.[1] || '');
    setEditHint3(q.hints?.[2] || '');
    setEditDialogOpen(true);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;
    const gId = editingQuestion.game_id;

    const finalQuestion = editQuestion.trim();
    let finalAnswer = editAnswer.trim();

    if ((gId === 5 || gId === 6 || gId === 7 || gId === 11) && !finalAnswer) {
      finalAnswer = finalQuestion;
    }

    if (gId === 12 && !finalAnswer) {
      finalAnswer = 'จริง';
    }

    if (!finalQuestion || !finalAnswer) {
      toast({ title: 'กรุณากรอกข้อมูลโจทย์และเฉลย', variant: 'destructive' });
      return;
    }

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [editHint1.trim(), editHint2.trim(), editHint3.trim()].filter(Boolean);
    }

    const finalDiff = (gId === 4) ? editDifficulty : null;

    let optionsArray: string[] = [];
    if (gId === 12) {
      optionsArray = ['จริง', 'เท็จ'];
    }

    try {
      const { error } = await (supabase as any)
        .from('minigame_questions')
        .update({
          word_or_question: finalQuestion,
          answer: finalAnswer,
          category: editCategory.trim() || 'คำทั่วไป',
          hints: hintsArray,
          options: optionsArray,
          difficulty: finalDiff,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingQuestion.id);

      if (error) throw error;
      toast({ title: 'แก้ไขสำเร็จ', description: `แก้ไขข้อมูลข้อ #${editingQuestion.id} เรียบร้อยแล้วค่ะ` });
      setEditDialogOpen(false);
      fetchQuestions();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการแก้ไขโจทย์', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบคำศัพท์ข้อนี้ออกจากคลัง?')) return;
    try {
      const { error } = await (supabase as any).from('minigame_questions').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบคำศัพท์เรียบร้อยแล้ว' });
      fetchQuestions();
      fetchGameCounts();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    }
  };

  // Filtered games based on selected Group Tab
  const visibleGameConfigs = useMemo(() => {
    return Object.values(MINIGAME_CONFIGS).filter((g) => {
      if (selectedGroupTab === 'all') return true;
      return g.categoryGroup === selectedGroupTab;
    });
  }, [selectedGroupTab]);

  // Filter questions by search keyword, match mode, and category
  const filteredQuestions = useMemo(() => {
    return questions
      .filter((q) => {
        if (selectedCategoryFilter !== 'all' && (q.category || 'คำทั่วไป') !== selectedCategoryFilter) {
          return false;
        }
        if (!searchKeyword.trim()) return true;
        const kw = searchKeyword.toLowerCase().trim();
        const word = (q.word_or_question || '').toLowerCase();
        const ans = (q.answer || '').toLowerCase();
        const cat = (q.category || '').toLowerCase();
        const idStr = String(q.id);

        if (idStr === kw) return true;

        if (searchMatchMode === 'starts_with') {
          return word.startsWith(kw) || ans.startsWith(kw) || cat.startsWith(kw);
        } else if (searchMatchMode === 'exact') {
          return word === kw || ans === kw || cat === kw;
        } else {
          return word.includes(kw) || ans.includes(kw) || cat.includes(kw);
        }
      })
      .sort((a, b) => {
        if (!searchKeyword.trim()) return 0;
        const kw = searchKeyword.toLowerCase().trim();
        const aWord = (a.word_or_question || '').toLowerCase();
        const bWord = (b.word_or_question || '').toLowerCase();
        const aStarts = aWord.startsWith(kw) || (a.answer || '').toLowerCase().startsWith(kw);
        const bStarts = bWord.startsWith(kw) || (b.answer || '').toLowerCase().startsWith(kw);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
  }, [questions, searchKeyword, searchMatchMode, selectedCategoryFilter]);

  const categoriesList = useMemo(() => {
    return Array.from(
      new Set(questions.map((q) => q.category || 'คำทั่วไป').filter(Boolean))
    );
  }, [questions]);

  const selectedGId = Number(formGameId);
  const selectedConfig = MINIGAME_CONFIGS[selectedGId] || MINIGAME_CONFIGS[1];

  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;

  // Paginated Leaderboard
  const totalLbPages = Math.max(1, Math.ceil(leaderboard.length / lbItemsPerPage));
  const paginatedLeaderboard = leaderboard.slice((lbPage - 1) * lbItemsPerPage, lbPage * lbItemsPerPage);

  const isFiltered = searchKeyword.trim() !== '' || selectedCategoryFilter !== 'all' || selectedGameFilter !== 'all';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border border-[#EAD8C8] dark:border-[#2D2520] p-5 rounded-3xl shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2.5">
            <Gamepad2 className="w-6 h-6 text-primary" />
            ระบบจัดการมินิเกมและคลังโจทย์ (Mini-Games Hub)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            ศูนย์กลางควบคุมคลังคำศัพท์ทั้ง 12 มินิเกมของ Bear Cafe Discord Bot, กำหนด Channel ID & แต้มรางวัล, และติดตาม Hall of Fame
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary border-primary/20">
            🎮 ครบ 12 มินิเกม
          </Badge>
          <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 border-[#EAD8C8] dark:border-[#2D2520]" onClick={() => { fetchQuestions(); fetchGameCounts(); fetchSettings(); }}>
            <RefreshCw className={cn("w-3.5 h-3.5", loadingQuestions && "animate-spin")} /> ดึงข้อมูลสด
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="questions" className="w-full space-y-6">
        <TabsList className="bg-[#FAF6F0] dark:bg-[#25201C] p-1.5 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] grid grid-cols-1 sm:grid-cols-3 h-auto gap-1">
          <TabsTrigger value="questions" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Edit3 className="w-4 h-4 text-blue-500" /> 1. คลังคำศัพท์ & จัดการโจทย์
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Settings2 className="w-4 h-4 text-purple-500" /> 2. ตั้งค่าห้อง & แต้มรางวัล (12 เกม)
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Trophy className="w-4 h-4 text-amber-500" /> 3. ตารางจัดอันดับผู้ชนะ
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUESTION BANK MANAGER */}
        <TabsContent value="questions" className="space-y-6">

          {/* Section 1: Quick Interactive Game Selector Grid */}
          <Card className="border-[#EAD8C8] dark:border-[#2D2520] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] shadow-xs rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-primary" />
                    เลือกมินิเกมด่วน (Quick Game Selector)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    คลิกเลือกการ์ดเกมเพื่อกรองดูรายการคำศัพท์ และตั้งค่าโจทย์ของเกมนั้นทันที
                  </CardDescription>
                </div>
                {selectedGameFilter !== 'all' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-semibold rounded-xl border-[#EAD8C8] dark:border-[#2D2520] hover:bg-white"
                    onClick={() => setSelectedGameFilter('all')}
                  >
                    ✕ รีเซ็ตเป็นดูทุกเกม ({questions.length})
                  </Button>
                )}
              </div>

              {/* Group Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                {GAME_GROUPS.map((grp) => (
                  <Button
                    key={grp.id}
                    size="sm"
                    variant={selectedGroupTab === grp.id ? 'default' : 'outline'}
                    className={cn(
                      "h-7 text-[11px] font-semibold rounded-xl gap-1 border-[#EAD8C8] dark:border-[#2D2520]",
                      selectedGroupTab === grp.id
                        ? "bg-[#8C6239] hover:bg-[#74502D] text-white"
                        : "bg-white/80 dark:bg-[#1E1B18]/80 hover:bg-white"
                    )}
                    onClick={() => setSelectedGroupTab(grp.id)}
                  >
                    <span>{grp.icon}</span>
                    <span>{grp.label}</span>
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {visibleGameConfigs.map((g) => {
                  const isSelected = selectedGameFilter === String(g.id);
                  const botCount = botPoolCounts[g.id];
                  const directCount = directGameCounts[g.id] ?? 0;
                  const isShared = (g.id === 1 || g.id === 2 || g.id === 6 || g.id === 7 || g.id === 8 || g.id === 9);

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGameFilter(String(g.id));
                        setFormGameId(String(g.id));
                      }}
                      className={cn(
                        "relative text-left p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-2 group cursor-pointer",
                        isSelected
                          ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                          : "bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520] hover:border-amber-400 hover:shadow-xs"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">{g.icon}</span>
                        <div className="flex items-center gap-1">
                          {isShared && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              title="เกมนี้แชร์คลังโจทย์ร่วมกับอีกเกมในบอท Discord"
                            >
                              แชร์พูล
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-mono font-bold rounded-md",
                              isSelected
                                ? "bg-amber-500 text-white border-transparent"
                                : "bg-muted/70 text-muted-foreground"
                            )}
                          >
                            #{g.id}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className={cn("text-xs font-bold leading-snug line-clamp-1", isSelected ? "text-[#8C6239] dark:text-[#EAD8C8]" : "text-foreground")}>
                          {g.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{g.tag}</p>
                      </div>

                      <div className="pt-1.5 border-t border-[#EAD8C8]/60 dark:border-[#2D2520] space-y-0.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">พูลบอท:</span>
                          {g.id === 3 ? (
                            <span className="font-bold text-blue-500 font-mono">Auto ⚡</span>
                          ) : (
                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {typeof botCount === 'number' ? botCount.toLocaleString() : (botCount ?? 0)} ข้อ
                            </span>
                          )}
                        </div>
                        {isShared && (
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground/80">
                            <span>เฉพาะ ID #{g.id}:</span>
                            <span className="font-mono">{directCount.toLocaleString()} ข้อ</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Add Question Form + Live Discord Preview Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Col (7 cols): Input Form */}
            <div className="lg:col-span-7 flex flex-col">
              <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl flex-1 flex flex-col">
                <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" />
                        เพิ่มคำศัพท์ / โจทย์ใหม่ (เกม #{selectedGId})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selectedConfig.desc}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]">
                      {selectedConfig.icon} เกม {selectedConfig.id}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <form onSubmit={handleAddQuestion} className="space-y-4">
                    
                    {/* Game Selector Dropdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <RichSelect
                          label="เลือกมินิเกมที่จะเพิ่ม"
                          value={formGameId}
                          onValueChange={(val) => setFormGameId(val)}
                          data={MINIGAME_RICH_OPTIONS}
                          placeholder="เลือกมินิเกม..."
                        />
                      </div>

                      {/* Difficulty Selector (ONLY for Game 4) */}
                      {selectedGId === 4 ? (
                        <div>
                          <RichSelect
                            label="ระดับความยาก (สำหรับเกมที่ 4)"
                            value={formDifficulty}
                            onValueChange={(val) => setFormDifficulty(val)}
                            data={DIFFICULTY_RICH_OPTIONS}
                            placeholder="เลือกระดับความยาก..."
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] mb-1.5 block">
                            หมวดหมู่ (Category)
                          </label>
                          <Input
                            className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                            placeholder="เช่น ผลไม้, สัตว์, คำทั่วไป, อาหาร"
                            value={formCategory}
                            onChange={(e) => setFormCategory(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Game 3 Special Notice */}
                    {selectedGId === 3 ? (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
                        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <strong className="font-bold text-sm block">🔢 สุ่มโจทย์คณิตศาสตร์ (เกมที่ 3)</strong>
                          <p>
                            เกมนี้ขับเคลื่อนด้วยระบบสุ่มสมการตัวเลขแบบอัตโนมัติจากโค้ดบอท ไม่จำเป็นต้องเพิ่มโจทย์ลงในฐานข้อมูลค่ะ บอทจะสุ่มโจทย์ บวกลบคูณ และคำนวณเฉลยให้ทันทีที่มีผู้เล่นเริ่มเกม
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Dynamic Input Rows */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Question Input */}
                          <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                              {selectedGId === 1 && 'คำศัพท์ภาษาไทย (คำตอบที่ต้องการให้เติม)'}
                              {selectedGId === 2 && 'คำศัพท์ภาษาอังกฤษ (คำตอบที่ต้องการให้เติม)'}
                              {selectedGId === 4 && 'ชื่อคำศัพท์ / สิ่งของ (เฉลยข้อนี้)'}
                              {selectedGId === 5 && 'คำศัพท์ภาษาอังกฤษ (บอทจะพูดคำนี้)'}
                              {selectedGId === 6 && 'ข้อความ / ประโยคภาษาไทยสำหรับฝึกพิมพ์'}
                              {selectedGId === 7 && 'ข้อความ / ประโยคภาษาอังกฤษสำหรับฝึกพิมพ์'}
                              {selectedGId === 8 && 'คำศัพท์ภาษาอังกฤษ (โจทย์ EN ➔ TH)'}
                              {selectedGId === 9 && 'คำศัพท์ภาษาอังกฤษ (โจทย์คู่แปล TH ➔ EN)'}
                              {selectedGId === 10 && 'คำขึ้นต้น (คำหน้า เช่น "น้ำ", "ไฟ")'}
                              {selectedGId === 11 && 'คำศัพท์ภาษาไทย (บอทจะพูดคำนี้)'}
                              {selectedGId === 12 && 'ข้อความ / คำถามจริงหรือเท็จ'}
                            </label>
                            <Input
                              className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                              placeholder={
                                selectedGId === 1 ? 'เช่น สวัสดี, ไอศกรีม, ประเทศไทย' :
                                selectedGId === 2 ? 'เช่น banana, strawberry, computer' :
                                selectedGId === 4 ? 'เช่น ช้าง, ดวงอาทิตย์, แมว' :
                                selectedGId === 5 ? 'เช่น butterfly, welcome, adventure' :
                                selectedGId === 6 ? 'เช่น หมีคาเฟ่ยินดีต้อนรับเสมอ' :
                                selectedGId === 7 ? 'เช่น Welcome to Bear Cafe' :
                                selectedGId === 8 || selectedGId === 9 ? 'เช่น Apple, Banana, House' :
                                selectedGId === 10 ? 'เช่น น้ำ, รถ, ดาว, พัด' :
                                selectedGId === 11 ? 'เช่น ก้านกล้วย, ธรรมชาติ, มิตรภาพ' :
                                selectedGId === 12 ? 'เช่น แมวเป็นสัตว์เลี้ยงลูกด้วยนม' :
                                'กรอกโจทย์/คำศัพท์...'
                              }
                              value={formQuestion}
                              onChange={(e) => setFormQuestion(e.target.value)}
                              required
                            />
                            {selectedGId === 1 && (
                              <span className="text-[11px] text-muted-foreground">💡 บอทจะนำคำนี้ไปสุ่มซ่อนขีดเส้นใต้ให้อัตโนมัติ (ไม่ต้องใส่ _)</span>
                            )}
                            {selectedGId === 2 && (
                              <span className="text-[11px] text-muted-foreground">💡 บอทจะนำคำนี้ไปสุ่มซ่อนตัวอักษรให้อัตโนมัติ (ไม่ต้องใส่ _)</span>
                            )}
                          </div>

                          {/* Answer Input or True/False Selector */}
                          <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                              {selectedGId === 1 && 'เฉลยคำตอบ (บันทึกอัตโนมัติ)'}
                              {selectedGId === 2 && 'เฉลยคำตอบ (บันทึกอัตโนมัติ)'}
                              {selectedGId === 4 && 'คำตอบที่ต้องพิมพ์ตอบ'}
                              {selectedGId === 5 && 'คำตอบภาษาอังกฤษ'}
                              {selectedGId === 6 && 'คำตอบ (บันทึกประโยคเดียวกันอัตโนมัติ)'}
                              {selectedGId === 7 && 'คำตอบ (บันทึกประโยคเดียวกันอัตโนมัติ)'}
                              {selectedGId === 8 && 'คำแปลภาษาไทย (เฉลย)'}
                              {selectedGId === 9 && 'คำแปลภาษาไทย (เฉลย)'}
                              {selectedGId === 10 && 'คำต่อท้าย (คำหลัง เช่น "แข็ง", "ไฟ")'}
                              {selectedGId === 11 && 'คำตอบภาษาไทย'}
                              {selectedGId === 12 && 'เฉลยที่ถูกต้อง (จริง หรือ เท็จ)'}
                            </label>

                            {selectedGId === 12 ? (
                              <div className="flex gap-2 h-10">
                                <Button
                                  type="button"
                                  variant={formAnswer === 'จริง' || !formAnswer ? 'default' : 'outline'}
                                  className={cn(
                                    "flex-1 rounded-xl text-xs font-bold gap-1.5",
                                    (formAnswer === 'จริง' || !formAnswer) && "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  )}
                                  onClick={() => setFormAnswer('จริง')}
                                >
                                  <Check className="w-3.5 h-3.5" /> ✅ จริง (True)
                                </Button>
                                <Button
                                  type="button"
                                  variant={formAnswer === 'เท็จ' ? 'destructive' : 'outline'}
                                  className="flex-1 rounded-xl text-xs font-bold gap-1.5"
                                  onClick={() => setFormAnswer('เท็จ')}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> ❌ เท็จ (False)
                                </Button>
                              </div>
                            ) : (
                              <Input
                                className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                                placeholder={
                                  selectedGId === 1 || selectedGId === 2 || selectedGId === 5 || selectedGId === 6 || selectedGId === 7 || selectedGId === 11
                                    ? '(เว้นว่างไว้จะใช้ค่าเดียวกับโจทย์อัตโนมัติ)'
                                    : selectedGId === 8 || selectedGId === 9
                                    ? 'เช่น แอปเปิ้ล, กล้วย, บ้าน'
                                    : selectedGId === 10
                                    ? 'เช่น แข็ง (รวมเป็น น้ำแข็ง), ไฟ (รถไฟ)'
                                    : 'พิมพ์เฉลยคำตอบ...'
                                }
                                value={formAnswer}
                                onChange={(e) => setFormAnswer(e.target.value)}
                              />
                            )}
                          </div>
                        </div>

                        {/* Category Input for Game 4 */}
                        {selectedGId === 4 && (
                          <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                              หมวดหมู่ (Category)
                            </label>
                            <Input
                              className="h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                              placeholder="เช่น สัตว์, ธรรมชาติ, ผลไม้, เครื่องใช้"
                              value={formCategory}
                              onChange={(e) => setFormCategory(e.target.value)}
                            />
                          </div>
                        )}

                        {/* Hints 1, 2, 3 (ONLY for Game 4) */}
                        {selectedGId === 4 && (
                          <div className="p-4 rounded-2xl bg-[#FAF6F0]/80 dark:bg-[#25201C]/80 border border-[#EAD8C8] dark:border-[#2D2520] space-y-2.5">
                            <label className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-amber-500" />
                              คำใบ้ 3 ข้อความ (บอทจะทยอยเปิดคำใบ้ตามเวลา)
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 1 (เช่น เป็นสัตว์สี่ขา)" value={formHint1} onChange={(e) => setFormHint1(e.target.value)} required />
                              <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 2 (เช่น มีงวงและงา)" value={formHint2} onChange={(e) => setFormHint2(e.target.value)} required />
                              <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 3 (เช่น ตัวใหญ่ชอบกินอ้อย)" value={formHint3} onChange={(e) => setFormHint3(e.target.value)} required />
                            </div>
                          </div>
                        )}

                        <Button type="submit" className="w-full rounded-2xl h-11 gap-2 bg-[#8C6239] hover:bg-[#74502D] text-white font-bold text-sm shadow-xs cursor-pointer mt-2">
                          <Plus className="w-4 h-4 text-white" /> บันทึกเข้าคลังคำศัพท์เกม {selectedGId}
                        </Button>
                      </>
                    )}
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Col (5 cols): Live Discord Preview Box */}
            <div className="lg:col-span-5 flex flex-col">
              <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden h-full flex flex-col">
                <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
                    ตัวอย่างบน Discord (Discord Live Preview)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    แสดงตัวอย่างสิ่งที่ผู้เล่นจะได้เห็นบนแอปพลิเคชัน Discord เมื่อข้อนี้ถูกสุ่มขึ้นมาเล่น
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-start p-4">
                  <div className="bg-[#313338] rounded-2xl p-4 text-[#dbdee1] flex items-start gap-3 shadow-inner border border-zinc-700/50">
                    <div className="w-10 h-10 rounded-full bg-[#5865f2] shrink-0 flex items-center justify-center font-bold text-white text-base shadow">
                      🐻
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">Bear Cafe Bot</span>
                        <Badge className="bg-[#5865f2] text-[10px] px-1 py-0 h-4 text-white">BOT</Badge>
                        <span className="text-[11px] text-zinc-400">วันนี้ เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                      </div>

                      {/* Mock Discord Embed Content */}
                      <div className="border-l-4 border-amber-500 bg-[#2b2d31] p-3 rounded-r-xl space-y-2 text-xs">
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{selectedConfig.icon}</span>
                          <span>[เกมที่ {selectedConfig.id}] {selectedConfig.name}</span>
                        </div>

                        {/* Game 1 / 2 Preview */}
                        {(selectedGId === 1 || selectedGId === 2) && (
                          <div className="space-y-1.5">
                            <p className="text-zinc-300">เติมตัวอักษรที่ขาดหายไปในช่องว่างให้ถูกต้อง:</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg font-mono text-sm font-bold text-amber-400 tracking-wider">
                              {formQuestion ? formQuestion.split('').map((c, i) => (i % 2 === 1 ? '_' : c)).join(' ') : 'ส _ _ ส ดี'}
                            </div>
                            <p className="text-[11px] text-zinc-400">💬 พิมพ์คำตอบที่สมบูรณ์ในแชทเพื่อชนะ!</p>
                          </div>
                        )}

                        {/* Game 3 Preview */}
                        {selectedGId === 3 && (
                          <div className="space-y-1.5">
                            <p className="text-zinc-300">แก้สมการคณิตศาสตร์ต่อไปนี้ให้ถูกต้อง:</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg font-mono text-base font-bold text-emerald-400">
                              45 + 28 = ?
                            </div>
                            <p className="text-[11px] text-zinc-400">ระดับความยาก: ปานกลาง • ได้รับ 5 แต้ม</p>
                          </div>
                        )}

                        {/* Game 4 Preview */}
                        {selectedGId === 4 && (
                          <div className="space-y-1.5">
                            <p className="text-zinc-300">ทายคำจากคำใบ้ต่อไปนี้ (ระดับ: {formDifficulty}):</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg space-y-1 text-xs">
                              <p>1. {formHint1 || 'เป็นสัตว์สี่ขาขนาดใหญ่'}</p>
                              <p>2. {formHint2 || 'มีงวง มีงา'}</p>
                              <p>3. {formHint3 || 'ชอบกินอ้อยและกล้วย'}</p>
                            </div>
                            <p className="text-[11px] text-zinc-400">เฉลย: {formQuestion || 'ช้าง'}</p>
                          </div>
                        )}

                        {/* Game 5 / 11 Audio Preview */}
                        {(selectedGId === 5 || selectedGId === 11) && (
                          <div className="space-y-2">
                            <p className="text-zinc-300">ฟังไฟล์เสียงที่แนบมา แล้วพิมพ์คำตอบให้ถูกต้อง:</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg flex items-center gap-3 border border-zinc-700">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                <Volume2 className="w-4 h-4 animate-pulse" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-xs font-semibold text-white truncate">
                                  {selectedGId === 5 ? 'audio-en.mp3' : 'audio-th.mp3'}
                                </p>
                                <p className="text-[10px] text-zinc-400">Google TTS Voice Buffer (0:02)</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-emerald-400 font-mono">คำตอบที่ต้องพิมพ์: {formQuestion || (selectedGId === 5 ? 'apple' : 'สวัสดี')}</p>
                          </div>
                        )}

                        {/* Game 6 / 7 Typing Preview */}
                        {(selectedGId === 6 || selectedGId === 7) && (
                          <div className="space-y-1.5">
                            <p className="text-zinc-300">แข่งพิมพ์ข้อความต่อไปนี้ให้ถูกต้องเร็วที่สุด:</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg font-medium text-xs text-white break-words">
                              "{formQuestion || (selectedGId === 6 ? 'หมีคาเฟ่ยินดีต้อนรับเสมอ' : 'Welcome to Bear Cafe')}"
                            </div>
                            <p className="text-[11px] text-zinc-400">⚡ ใครพิมพ์ประโยคนี้ส่งในห้องได้ไวที่สุดรับแต้มทันที!</p>
                          </div>
                        )}

                        {/* Game 8 / 9 Translation Preview */}
                        {(selectedGId === 8 || selectedGId === 9) && (
                          <div className="space-y-2">
                            <p className="text-zinc-300">
                              {selectedGId === 8
                                ? `คำว่า "${formQuestion || 'Banana'}" มีความหมายตรงกับข้อใด?`
                                : `คำว่า "${formAnswer || 'กล้วย'}" ในภาษาอังกฤษคือข้อใด?`}
                            </p>
                            <div className="grid grid-cols-1 gap-1.5">
                              <div className="bg-[#1e1f22] p-2 rounded-lg text-xs flex justify-between items-center border border-emerald-500/50">
                                <span>1. {selectedGId === 8 ? (formAnswer || 'กล้วย') : (formQuestion || 'Banana')}</span>
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">เฉลย</Badge>
                              </div>
                              <div className="bg-[#1e1f22] p-2 rounded-lg text-xs text-zinc-400">
                                2. {selectedGId === 8 ? 'แอปเปิ้ล' : 'Apple'} (บอทสุ่มชอยส์หลอกให้อัตโนมัติ)
                              </div>
                              <div className="bg-[#1e1f22] p-2 rounded-lg text-xs text-zinc-400">
                                3. {selectedGId === 8 ? 'ส้ม' : 'Orange'} (บอทสุ่มชอยส์หลอกให้อัตโนมัติ)
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Game 10 Word Chain Preview */}
                        {selectedGId === 10 && (
                          <div className="space-y-2">
                            <p className="text-zinc-300">เลือกคำต่อท้ายที่นำมาต่อกับคำนี้แล้วมีความหมายถูกต้อง:</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg text-sm font-bold text-purple-400">
                              "{formQuestion || 'น้ำ'}" + [ ? ]
                            </div>
                            <div className="bg-[#1e1f22] p-2 rounded-lg text-xs flex justify-between items-center border border-purple-500/50">
                              <span>คำตอบที่ถูก: {formAnswer || 'แข็ง'} (รวมเป็น "{formQuestion || 'น้ำ'}{formAnswer || 'แข็ง'}")</span>
                              <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">เฉลย</Badge>
                            </div>
                          </div>
                        )}

                        {/* Game 12 True/False Preview */}
                        {selectedGId === 12 && (
                          <div className="space-y-2">
                            <p className="text-zinc-300">ข้อความต่อไปนี้ "จริง" หรือ "เท็จ":</p>
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg text-xs font-semibold text-white">
                              "{formQuestion || 'แมวเป็นสัตว์เลี้ยงลูกด้วยนม'}"
                            </div>
                            <div className="flex gap-2 pt-1">
                              <div className={cn("flex-1 p-2 rounded-lg text-xs font-bold text-center border", formAnswer === 'จริง' || !formAnswer ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-[#1e1f22] border-zinc-700 text-zinc-400")}>
                                [ ✅ จริง ]
                              </div>
                              <div className={cn("flex-1 p-2 rounded-lg text-xs font-bold text-center border", formAnswer === 'เท็จ' ? "bg-rose-500/20 border-rose-500 text-rose-400" : "bg-[#1e1f22] border-zinc-700 text-zinc-400")}>
                                [ ❌ เท็จ ]
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-1 text-[11px] text-amber-500/90 font-medium">
                          {selectedConfig.discordNote}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>

          {/* Section 3: Full Questions Table with Instant Search */}
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-primary" />
                    คลังคำศัพท์ทั้งหมด ({isFiltered ? `${filteredQuestions.length} จาก ${questions.length}` : `${questions.length}`} รายการ)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {selectedGameFilter !== 'all'
                      ? `กำลังแสดงเฉพาะมินิเกมที่ ${selectedGameFilter}: ${MINIGAME_CONFIGS[Number(selectedGameFilter)]?.name || ''}`
                      : 'แสดงคำศัพท์ทั้งหมดในระบบ สามารถค้นหา กรองหมวดหมู่ และแก้ไขได้ทันที'}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Bar + Mode Toggle */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                      <Input
                        placeholder="พิมพ์ค้นหาคำศัพท์..."
                        className="pl-8 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                      />
                    </div>

                    <Select value={searchMatchMode} onValueChange={(val: any) => setSearchMatchMode(val)}>
                      <SelectTrigger className="w-32 h-9 text-xs font-medium rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starts_with">ขึ้นต้นด้วย</SelectItem>
                        <SelectItem value="contains">มีคำนี้</SelectItem>
                        <SelectItem value="exact">ตรงตัว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter */}
                  <Select value={selectedCategoryFilter} onValueChange={(val) => setSelectedCategoryFilter(val)}>
                    <SelectTrigger className="w-full sm:w-36 h-9 text-xs font-medium rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
                      <SelectValue placeholder="หมวดหมู่ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                      {categoriesList.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Game Filter Dropdown */}
                  <Select value={selectedGameFilter} onValueChange={(val) => setSelectedGameFilter(val)}>
                    <SelectTrigger className="w-full sm:w-56 h-9 text-xs font-medium rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
                      <SelectValue placeholder="เลือกมินิเกม" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="all">🎮 ทุกมินิเกม (12 เกม)</SelectItem>
                      {Object.values(MINIGAME_CONFIGS).map((g) => {
                        const bCount = botPoolCounts[g.id];
                        return (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.icon} เกม {g.id}: {g.name} ({g.id === 3 ? 'Auto ⚡' : `${typeof bCount === 'number' ? bCount.toLocaleString() : (bCount ?? 0)} ข้อ`})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-xl border-[#EAD8C8] dark:border-[#2D2520]" onClick={fetchQuestions} title="รีเฟรช">
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingQuestions && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* Shared Pool / Mechanics Info Banner */}
              {selectedGameFilter !== 'all' && (
                <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    {(selectedGameFilter === '1' || selectedGameFilter === '6') && (
                      <p>
                        <strong className="font-bold">พูลคำศัพท์ภาษาไทย (แชร์ร่วมกันระหว่าง เกม 1 เติมคำไทย และ เกม 6 พิมพ์เร็วไทย):</strong> ในบอท Discord คำศัพท์จะถูกดึงจากทั้งสองเกมรวมกันทั้งหมด <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{(botPoolCounts[1] || 1189).toLocaleString()} ข้อ</span> (บันทึกในเกม 1: {directGameCounts[1] ?? 299} ข้อ, เกม 6: {directGameCounts[6] ?? 890} ข้อ)
                      </p>
                    )}
                    {(selectedGameFilter === '2' || selectedGameFilter === '7') && (
                      <p>
                        <strong className="font-bold">พูลคำศัพท์ภาษาอังกฤษ (แชร์ร่วมกันระหว่าง เกม 2 เติมคำอังกฤษ และ เกม 7 พิมพ์เร็วอังกฤษ):</strong> ในบอท Discord คำศัพท์จะถูกดึงร่วมกันทั้งหมด <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{(botPoolCounts[2] || 100).toLocaleString()} ข้อ</span> (บันทึกในเกม 2: {directGameCounts[2] ?? 100} ข้อ, เกม 7: {directGameCounts[7] ?? 0} ข้อ)
                      </p>
                    )}
                    {(selectedGameFilter === '8' || selectedGameFilter === '9') && (
                      <p>
                        <strong className="font-bold">พูลคู่คำแปล EN/TH (แชร์ร่วมกันระหว่าง เกม 8 ทายคำแปลอังกฤษ และ เกม 9 ทายคำแปลไทย):</strong> ในบอท Discord ใช้คลังคู่คำแปลเดียวกันทั้งหมด <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{(botPoolCounts[8] || 100).toLocaleString()} คู่</span> โดยเกม 8 จะถามโจทย์ภาษาอังกฤษ ส่วนเกม 9 บอทจะสลับโจทย์เป็นภาษาไทยให้อัตโนมัติ
                      </p>
                    )}
                    {selectedGameFilter === '3' && (
                      <p>
                        <strong className="font-bold">สุ่มโจทย์คณิตฯ (เกม 3):</strong> ขับเคลื่อนด้วยระบบ Dynamic Math Generator จากโค้ดบอท บอทจะคำนวณและสุ่มตัวเลขตามระดับความยาก จึงไม่มีข้อมูลที่ต้องบันทึกในฐานข้อมูล
                      </p>
                    )}
                    {!['1', '2', '3', '6', '7', '8', '9'].includes(selectedGameFilter) && (
                      <p>
                        <strong className="font-bold">เกม {selectedGameFilter} ({MINIGAME_CONFIGS[Number(selectedGameFilter)]?.name}):</strong> มีคำศัพท์ในคลังโจทย์ทั้งหมด <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{(directGameCounts[Number(selectedGameFilter)] || 0).toLocaleString()} ข้อ</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4">
              <div className="rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] overflow-hidden bg-white dark:bg-[#1E1B18]">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]/60 dark:bg-[#25201C]/60">
                    <TableRow className="h-9">
                      <TableHead className="w-14 text-xs font-bold">ID</TableHead>
                      <TableHead className="w-32 text-xs font-bold">มินิเกม</TableHead>
                      <TableHead className="w-28 text-xs font-bold">หมวดหมู่</TableHead>
                      <TableHead className="text-xs font-bold">โจทย์ / คำศัพท์</TableHead>
                      <TableHead className="text-xs font-bold">คำตอบ / เฉลย</TableHead>
                      <TableHead className="text-xs font-bold">รายละเอียดบน Discord</TableHead>
                      <TableHead className="w-24 text-xs font-bold">ความยาก</TableHead>
                      <TableHead className="text-right w-20 text-xs font-bold">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-xs">
                          {searchKeyword ? `ไม่พบคำศัพท์ที่ ${searchMatchMode === 'starts_with' ? 'ขึ้นต้นด้วย' : searchMatchMode === 'exact' ? 'ตรงกับ' : 'มีคำว่า'} "${searchKeyword}"` : 'ไม่พบรายการคำศัพท์ในคลังของเกมนี้'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.slice((qPage - 1) * qItemsPerPage, qPage * qItemsPerPage).map((q) => {
                        const gConfig = MINIGAME_CONFIGS[q.game_id];
                        return (
                          <TableRow key={q.id} className="h-9 text-xs hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">#{q.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold flex items-center gap-1 w-fit bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                <span>{gConfig?.icon || '🎮'}</span>
                                <span>เกม {q.game_id}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium">
                                {q.category || 'คำทั่วไป'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-xs max-w-[200px] truncate" title={q.word_or_question}>
                              {q.word_or_question}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 max-w-[200px] truncate" title={q.answer}>
                              {q.game_id === 12 ? (
                                <Badge className={cn("text-[10px] font-bold", q.answer === 'จริง' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                  {q.answer === 'จริง' ? '✅ จริง' : '❌ เท็จ'}
                                </Badge>
                              ) : (
                                q.answer
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {q.game_id === 4 && q.hints?.length ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">💡 คำใบ้ {q.hints.length} ข้อ</span>
                              ) : (q.game_id === 5 || q.game_id === 11) ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                                  <Headphones className="w-3 h-3" /> Google TTS
                                </span>
                              ) : (q.game_id === 8 || q.game_id === 9) ? (
                                <span className="text-sky-600 dark:text-sky-400 font-medium">🌐 ชอยส์ 3 ตัวเลือก</span>
                              ) : (q.game_id === 10) ? (
                                <span className="text-purple-600 dark:text-purple-400 font-medium">🔗 {q.word_or_question} ➔ {q.answer}</span>
                              ) : (q.game_id === 12) ? (
                                <span className="text-orange-600 dark:text-orange-400 font-medium">❓ ชอยส์ จริง/เท็จ</span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {q.difficulty ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px]",
                                    q.difficulty === 'easy' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                                    q.difficulty === 'medium' && 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                                    q.difficulty === 'hard' && 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                  )}
                                >
                                  {q.difficulty === 'easy' ? 'ง่าย' : q.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                                  onClick={() => openEditModal(q)}
                                  title="แก้ไข"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  title="ลบคำศัพท์"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredQuestions.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    แสดง <strong className="text-foreground">{((qPage - 1) * qItemsPerPage) + 1}</strong> - <strong className="text-foreground">{Math.min(qPage * qItemsPerPage, filteredQuestions.length)}</strong> จากทั้งหมด <strong className="text-foreground">{filteredQuestions.length}</strong> รายการ
                  </span>

                  {Math.ceil(filteredQuestions.length / qItemsPerPage) > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setQPage(1)} disabled={qPage <= 1} className="h-8 px-2 text-xs rounded-xl">«</Button>
                      <Button variant="outline" size="sm" onClick={() => setQPage(p => Math.max(1, p - 1))} disabled={qPage <= 1} className="h-8 px-2.5 text-xs rounded-xl">ก่อนหน้า</Button>
                      <span className="px-2 text-xs font-semibold">หน้า {qPage} / {Math.ceil(filteredQuestions.length / qItemsPerPage)}</span>
                      <Button variant="outline" size="sm" onClick={() => setQPage(p => Math.min(Math.ceil(filteredQuestions.length / qItemsPerPage), p + 1))} disabled={qPage >= Math.ceil(filteredQuestions.length / qItemsPerPage)} className="h-8 px-2.5 text-xs rounded-xl">ถัดไป</Button>
                      <Button variant="outline" size="sm" onClick={() => setQPage(Math.ceil(filteredQuestions.length / qItemsPerPage))} disabled={qPage >= Math.ceil(filteredQuestions.length / qItemsPerPage)} className="h-8 px-2 text-xs rounded-xl">»</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: GAME SETTINGS & CHANNELS */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                ตั้งค่าห้อง Channel ID & แต้มรางวัล (ครบ 12 มินิเกม)
              </CardTitle>
              <CardDescription className="text-xs">
                กำหนดห้อง Discord Channel ID, ช่วงแต้มรางวัล Min/Max Points ที่ผู้เล่นจะได้รับเมื่อตอบถูก, และเปิด/ปิดการทำงานของแต่ละเกมได้ทันที
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] overflow-hidden bg-white dark:bg-[#1E1B18]">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]/60 dark:bg-[#25201C]/60">
                    <TableRow className="h-9">
                      <TableHead className="w-14 text-xs font-bold">ID</TableHead>
                      <TableHead className="w-48 text-xs font-bold">ชื่อมินิเกม</TableHead>
                      <TableHead className="text-xs font-bold">Discord Channel ID</TableHead>
                      <TableHead className="w-44 text-xs font-bold">แต้มรางวัล (Min - Max)</TableHead>
                      <TableHead className="w-32 text-xs font-bold">สถานะบอท</TableHead>
                      <TableHead className="text-right w-24 text-xs font-bold">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(MINIGAME_CONFIGS).map((conf) => {
                      const gameSetting = settings.find((s) => s.game_id === conf.id) || {
                        game_id: conf.id,
                        game_name: conf.name,
                        channel_id: '',
                        is_enabled: true,
                        min_points: 3,
                        max_points: 6,
                      };
                      return (
                        <TableRow key={conf.id} className="h-10 text-xs hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40 transition-colors">
                          <TableCell className="font-bold">
                            <Badge variant="outline" className="text-xs font-mono font-bold">#{conf.id}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{conf.icon}</span>
                              <div>
                                <span className="block font-bold">{conf.name}</span>
                                <span className="text-[10px] text-muted-foreground block">{conf.tag}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="w-56 text-xs h-8 font-mono rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-[#FAF6F0]/50 dark:bg-[#25201C]/50"
                              placeholder="กรอก Discord Channel ID..."
                              value={gameSetting.channel_id}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings((prev) => {
                                  const exists = prev.some((item) => item.game_id === conf.id);
                                  if (exists) {
                                    return prev.map((item) => (item.game_id === conf.id ? { ...item, channel_id: val } : item));
                                  } else {
                                    return [...prev, { ...gameSetting, channel_id: val }];
                                  }
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                className="w-16 text-xs h-8 text-center rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                                value={gameSetting.min_points}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSettings((prev) => {
                                    const exists = prev.some((item) => item.game_id === conf.id);
                                    if (exists) {
                                      return prev.map((item) => (item.game_id === conf.id ? { ...item, min_points: val } : item));
                                    } else {
                                      return [...prev, { ...gameSetting, min_points: val }];
                                    }
                                  });
                                }}
                              />
                              <span className="text-muted-foreground font-bold">-</span>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                className="w-16 text-xs h-8 text-center rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                                value={gameSetting.max_points}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSettings((prev) => {
                                    const exists = prev.some((item) => item.game_id === conf.id);
                                    if (exists) {
                                      return prev.map((item) => (item.game_id === conf.id ? { ...item, max_points: val } : item));
                                    } else {
                                      return [...prev, { ...gameSetting, max_points: val }];
                                    }
                                  });
                                }}
                              />
                              <span className="text-[11px] text-muted-foreground">แต้ม</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={gameSetting.is_enabled}
                                onCheckedChange={(val) => {
                                  setSettings((prev) => {
                                    const exists = prev.some((item) => item.game_id === conf.id);
                                    if (exists) {
                                      return prev.map((item) => (item.game_id === conf.id ? { ...item, is_enabled: val } : item));
                                    } else {
                                      return [...prev, { ...gameSetting, is_enabled: val }];
                                    }
                                  });
                                }}
                              />
                              <span className={cn("text-[11px] font-semibold", gameSetting.is_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                {gameSetting.is_enabled ? 'เปิดเล่น' : 'ปิดพัก'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 rounded-xl border-[#EAD8C8] dark:border-[#2D2520] hover:bg-white cursor-pointer" onClick={() => handleSettingUpdate(gameSetting)}>
                              <Save className="w-3.5 h-3.5 text-primary" /> บันทึก
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: LEADERBOARD */}
        <TabsContent value="leaderboard" className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FDFBF7] dark:bg-[hsl(var(--card))] p-3.5 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520]">
            <div className="flex items-center gap-2 bg-[#FAF6F0] dark:bg-[#25201C] p-1 rounded-xl border border-[#EAD8C8] dark:border-[#2D2520]">
              <Button
                size="sm"
                variant={lbTimeFilter === '30d' ? 'default' : 'ghost'}
                className={cn("rounded-lg text-xs font-semibold", lbTimeFilter === '30d' && "bg-[#8C6239] text-white")}
                onClick={() => setLbTimeFilter('30d')}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" /> 30 วันล่าสุด (30d)
              </Button>
              <Button
                size="sm"
                variant={lbTimeFilter === 'all' ? 'default' : 'ghost'}
                className={cn("rounded-lg text-xs font-semibold", lbTimeFilter === 'all' && "bg-[#8C6239] text-white")}
                onClick={() => setLbTimeFilter('all')}
              >
                <InfinityIcon className="w-3.5 h-3.5 mr-1.5" /> จัดอันดับทั้งหมด (All-Time)
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={lbGameFilter} onValueChange={(val) => setLbGameFilter(val)}>
                <SelectTrigger className="w-full sm:w-64 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
                  <SelectValue placeholder="เลือกมินิเกม" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">🎮 ทุกมินิเกมรวมกัน (12 เกม)</SelectItem>
                  {Object.values(MINIGAME_CONFIGS).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.icon} เกม {g.id}: {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-xl border-[#EAD8C8] dark:border-[#2D2520]" onClick={fetchLeaderboard} title="รีเฟรช">
                <RefreshCw className={cn("w-4 h-4", loadingLb && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Podium Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-2">
            {/* Rank 2 (Silver) */}
            <Card className="order-2 md:order-1 border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E1B18] hover:scale-[1.02] transition-transform rounded-3xl shadow-xs">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                  <Medal className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="w-fit mx-auto border-slate-400 text-slate-500 font-bold">
                  อันดับ 2 (Silver)
                </Badge>
                {top2 ? (
                  userProfilesMap[top2.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top2.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top2.discord_id].avatar_url!} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-slate-400 shadow-xs" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-300 dark:bg-slate-700 text-foreground flex items-center justify-center font-bold text-base">
                          {userProfilesMap[top2.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-bold text-sm text-foreground truncate px-1">{userProfilesMap[top2.discord_id].username}</p>
                        {userProfilesMap[top2.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top2.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top2.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-base font-bold font-mono mt-2">{top2.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-base font-bold font-mono mt-2">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-sm font-semibold text-muted-foreground">
                {top2 ? `ชนะ ${top2.total_wins} ครั้ง (${top2.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>

            {/* Rank 1 (Gold) */}
            <Card className="order-1 md:order-2 border-amber-400 dark:border-amber-500 bg-amber-500/5 shadow-xl shadow-amber-500/10 hover:scale-[1.04] transition-transform rounded-3xl">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-2 shadow-lg shadow-amber-500/30">
                  <Crown className="w-8 h-8" />
                </div>
                <Badge className="w-fit mx-auto bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-extrabold px-3 py-1">
                  🏆 อันดับ 1 (Gold Champion)
                </Badge>
                {top1 ? (
                  userProfilesMap[top1.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top1.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top1.discord_id].avatar_url!} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-400">
                          {userProfilesMap[top1.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-extrabold text-base text-amber-600 dark:text-amber-400 truncate px-1">{userProfilesMap[top1.discord_id].username}</p>
                        {userProfilesMap[top1.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top1.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top1.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-lg font-extrabold font-mono mt-2 text-amber-500">{top1.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-lg font-extrabold font-mono mt-2 text-amber-500">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-base font-bold text-amber-600 dark:text-amber-400">
                {top1 ? `ชนะ ${top1.total_wins} ครั้ง (${top1.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>

            {/* Rank 3 (Bronze) */}
            <Card className="order-3 border-amber-800/40 bg-white dark:bg-[#1E1B18] hover:scale-[1.02] transition-transform rounded-3xl shadow-xs">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-900/20 flex items-center justify-center text-amber-700 mb-2">
                  <Award className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="w-fit mx-auto border-amber-700 text-amber-700 font-bold">
                  อันดับ 3 (Bronze)
                </Badge>
                {top3 ? (
                  userProfilesMap[top3.discord_id] ? (
                    <div className="flex flex-col items-center gap-1.5 mt-2">
                      {userProfilesMap[top3.discord_id].avatar_url ? (
                        <img src={userProfilesMap[top3.discord_id].avatar_url!} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-700 shadow-xs" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-amber-900/20 text-amber-700 flex items-center justify-center font-bold text-base">
                          {userProfilesMap[top3.discord_id].username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center min-w-0 max-w-full">
                        <p className="font-bold text-sm text-foreground truncate px-1">{userProfilesMap[top3.discord_id].username}</p>
                        {userProfilesMap[top3.discord_id].discord_username && <p className="text-xs text-muted-foreground truncate">@{userProfilesMap[top3.discord_id].discord_username}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {top3.discord_id}</p>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-base font-bold font-mono mt-2">{top3.discord_id}</CardTitle>
                  )
                ) : (
                  <CardTitle className="text-base font-bold font-mono mt-2">-</CardTitle>
                )}
              </CardHeader>
              <CardContent className="text-center text-sm font-semibold text-muted-foreground">
                {top3 ? `ชนะ ${top3.total_wins} ครั้ง (${top3.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
              </CardContent>
            </Card>
          </div>

          {/* Ranking Table with Pagination */}
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    ตารางสรุปอันดับผู้ชนะ ({leaderboard.length} อันดับ)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    จัดอันดับตามจำนวนครั้งที่ชนะ และแต้มสะสม
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>ต่อหน้า:</span>
                  <Select value={String(lbItemsPerPage)} onValueChange={(val) => { setLbItemsPerPage(Number(val)); setLbPage(1); }}>
                    <SelectTrigger className="h-7 text-xs w-16 rounded-lg border-[#EAD8C8] dark:border-[#2D2520]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] overflow-hidden bg-white dark:bg-[#1E1B18]">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]/60 dark:bg-[#25201C]/60">
                    <TableRow className="h-9">
                      <TableHead className="w-16 text-xs font-bold">อันดับ</TableHead>
                      <TableHead className="text-xs font-bold">สมาชิก / Discord Profile</TableHead>
                      <TableHead className="text-xs font-bold">จำนวนครั้งที่ชนะ</TableHead>
                      <TableHead className="text-xs font-bold">แต้มสะสมรวม</TableHead>
                      <TableHead className="text-right text-xs font-bold">ชนะล่าสุด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-xs">
                          ไม่พบข้อมูลผู้ชนะในขณะนี้
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLeaderboard.map((item, index) => {
                        const rankIndex = (lbPage - 1) * lbItemsPerPage + index;
                        const userProf = userProfilesMap[item.discord_id];
                        return (
                          <TableRow key={item.discord_id} className="h-10 text-xs hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40 transition-colors">
                            <TableCell className="font-extrabold text-xs">
                              {rankIndex === 0 ? '🥇 #1' : rankIndex === 1 ? '🥈 #2' : rankIndex === 2 ? '🥉 #3' : `#${rankIndex + 1}`}
                            </TableCell>
                            <TableCell>
                              {userProf ? (
                                <div className="flex items-center gap-3">
                                  {userProf.avatar_url ? (
                                    <img src={userProf.avatar_url} alt={userProf.username} className="w-8 h-8 rounded-full object-cover shrink-0 border border-border shadow-2xs" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground border border-border">
                                      {userProf.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-xs text-foreground truncate">{userProf.username}</span>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      {userProf.discord_username && <span>@{userProf.discord_username}</span>}
                                      <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.2 rounded text-muted-foreground font-semibold">ID: {item.discord_id}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-xs font-semibold">{item.discord_id}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-sky-600 dark:text-sky-400">{item.total_wins} ครั้ง</TableCell>
                            <TableCell className="font-bold text-amber-600 dark:text-amber-400">{item.total_points} แต้ม</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {new Date(item.last_win).toLocaleString('th-TH')}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Leaderboard Pagination Controls */}
              {leaderboard.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    แสดงอันดับ <strong className="text-foreground">{((lbPage - 1) * lbItemsPerPage) + 1}</strong> - <strong className="text-foreground">{Math.min(lbPage * lbItemsPerPage, leaderboard.length)}</strong> จากทั้งหมด <strong className="text-foreground">{leaderboard.length}</strong> อันดับ
                  </span>

                  {totalLbPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setLbPage(1)} disabled={lbPage <= 1} className="h-8 px-2 text-xs rounded-xl">«</Button>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(p => Math.max(1, p - 1))} disabled={lbPage <= 1} className="h-8 px-2.5 text-xs rounded-xl">ก่อนหน้า</Button>
                      <span className="px-2 text-xs font-semibold">หน้า {lbPage} / {totalLbPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(p => Math.min(totalLbPages, p + 1))} disabled={lbPage >= totalLbPages} className="h-8 px-2.5 text-xs rounded-xl">ถัดไป</Button>
                      <Button variant="outline" size="sm" onClick={() => setLbPage(totalLbPages)} disabled={lbPage >= totalLbPages} className="h-8 px-2 text-xs rounded-xl">»</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT QUESTION DIALOG MODAL */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl border-[#EAD8C8] dark:border-[#2D2520] bg-[#FDFBF7] dark:bg-[hsl(var(--card))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              <Edit3 className="w-5 h-5 text-blue-500" />
              แก้ไขคำศัพท์ #{editingQuestion?.id} (เกมที่ {editingQuestion?.game_id}: {MINIGAME_CONFIGS[editingQuestion?.game_id || 1]?.name})
            </DialogTitle>
            <DialogDescription className="text-xs">
              แก้ไขคำศัพท์ คำแปล หรือข้อมูลโจทย์ของข้อนี้
            </DialogDescription>
          </DialogHeader>

          {editingQuestion && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                  {editingQuestion.game_id === 1 && 'คำศัพท์ภาษาไทย'}
                  {editingQuestion.game_id === 2 && 'คำศัพท์ภาษาอังกฤษ'}
                  {editingQuestion.game_id === 4 && 'ชื่อคำศัพท์ / สิ่งของ (เฉลย)'}
                  {editingQuestion.game_id === 5 && 'คำศัพท์ภาษาอังกฤษ (TTS Audio)'}
                  {editingQuestion.game_id === 6 && 'ประโยคภาษาไทยฝึกพิมพ์'}
                  {editingQuestion.game_id === 7 && 'ประโยคภาษาอังกฤษฝึกพิมพ์'}
                  {editingQuestion.game_id === 8 && 'คำศัพท์ภาษาอังกฤษ (โจทย์ EN ➔ TH)'}
                  {editingQuestion.game_id === 9 && 'คำศัพท์ภาษาอังกฤษ (โจทย์ TH ➔ EN)'}
                  {editingQuestion.game_id === 10 && 'คำขึ้นต้น (คำหน้า เช่น "น้ำ")'}
                  {editingQuestion.game_id === 11 && 'คำศัพท์ภาษาไทย (TTS Audio)'}
                  {editingQuestion.game_id === 12 && 'ข้อความ / คำถามจริงหรือเท็จ'}
                </label>
                <Input
                  className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                  {editingQuestion.game_id === 8 || editingQuestion.game_id === 9
                    ? 'คำแปลภาษาไทย (เฉลย)'
                    : editingQuestion.game_id === 10
                    ? 'คำต่อท้าย (คำหลัง เช่น "แข็ง")'
                    : editingQuestion.game_id === 12
                    ? 'เฉลยที่ถูกต้อง (จริง หรือ เท็จ)'
                    : 'คำตอบที่ถูกต้อง (เฉลย)'}
                </label>
                {editingQuestion.game_id === 12 ? (
                  <div className="flex gap-2 h-10">
                    <Button
                      type="button"
                      variant={editAnswer === 'จริง' ? 'default' : 'outline'}
                      className={cn("flex-1 rounded-xl text-xs font-bold gap-1.5", editAnswer === 'จริง' && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                      onClick={() => setEditAnswer('จริง')}
                    >
                      <Check className="w-3.5 h-3.5" /> ✅ จริง (True)
                    </Button>
                    <Button
                      type="button"
                      variant={editAnswer === 'เท็จ' ? 'destructive' : 'outline'}
                      className="flex-1 rounded-xl text-xs font-bold gap-1.5"
                      onClick={() => setEditAnswer('เท็จ')}
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> ❌ เท็จ (False)
                    </Button>
                  </div>
                ) : (
                  <Input
                    className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">หมวดหมู่ (Category)</label>
                <Input
                  className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="เช่น ผลไม้, สัตว์, คำทั่วไป"
                />
              </div>

              {/* Difficulty (ONLY for Game 4) */}
              {editingQuestion.game_id === 4 && (
                <div className="space-y-1.5">
                  <RichSelect
                    label="ระดับความยาก"
                    value={editDifficulty}
                    onValueChange={(val) => setEditDifficulty(val)}
                    data={DIFFICULTY_RICH_OPTIONS}
                    placeholder="เลือกระดับความยาก..."
                  />
                </div>
              )}

              {/* Hints (ONLY for Game 4) */}
              {editingQuestion.game_id === 4 && (
                <div className="p-3.5 rounded-2xl bg-[#FAF6F0]/80 dark:bg-[#25201C]/80 border border-[#EAD8C8] dark:border-[#2D2520] space-y-2">
                  <label className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] block">คำใบ้ 3 ข้อความ</label>
                  <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 1" value={editHint1} onChange={(e) => setEditHint1(e.target.value)} />
                  <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 2" value={editHint2} onChange={(e) => setEditHint2(e.target.value)} />
                  <Input className="h-8 text-xs rounded-lg" placeholder="คำใบ้ที่ 3" value={editHint3} onChange={(e) => setEditHint3(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl text-xs font-bold border-[#EAD8C8] dark:border-[#2D2520]" onClick={() => setEditDialogOpen(false)}>ยกเลิก</Button>
            <Button className="rounded-xl text-xs font-bold bg-[#8C6239] hover:bg-[#74502D] text-white cursor-pointer" onClick={handleUpdateQuestion}>บันทึกการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MinigamesManagement;
