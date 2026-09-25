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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  Gamepad2, Plus, Trash2, Save, RefreshCw, Trophy, Sparkles, Medal, Award, Crown,
  Calendar, Infinity as InfinityIcon, Settings2, Edit3, Search, Info, ListFilter,
  CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Eye, Volume2, Headphones,
  Keyboard, Laptop, Globe, Check, AlertCircle, Radio, Clock, ShieldCheck, User,
  AlertTriangle, Tag, ChevronsUpDown, X, XCircle, Edit2
} from 'lucide-react';
import {
  Game13SentenceBuilder,
  Game13FlowGuide,
  GAME_13_PRESETS,
  validateGame13Sentence,
} from './minigames/Game13SentenceBuilder';
import { Game1LivePreview } from './minigames/Game1LivePreview';
import { validateAndEvaluateGame1Word } from '@/lib/minigames/game1Masking';

export interface MinigameConfig {
  id: number;
  name: string;
  icon: string;
  tag: string;
  categoryGroup: 'vocab_typing' | 'audio_tts' | 'translation_chain' | 'sentence_builder' | 'logic_math';
  desc: string;
  discordNote: string;
}

export const CATEGORY_SUPPORTED_GAME_IDS = [1, 2, 6, 7];
export function isCategoryGame(gameId: number): boolean {
  return CATEGORY_SUPPORTED_GAME_IDS.includes(gameId);
}

export const MINIGAME_CONFIGS: Record<number, MinigameConfig> = {
  1: {
    id: 1,
    name: 'เติมคำศัพท์ (ไทย)',
    icon: '🇹🇭',
    tag: 'คำศัพท์ไทย',
    categoryGroup: 'vocab_typing',
    desc: 'เติมคำ/ส่วนของคำในช่องว่าง พร้อมระบบเลือกตำแหน่ง Mask คุณภาพสูงอัตโนมัติ (Best Candidate Selection)',
    discordNote: 'บอทจะเลือกซ่อนส่วนของคำที่ดีที่สุด เช่น กรอก "ความรัก" บอทจะแสดง "_ รัก" (LOW Ambiguity)',
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
  13: {
    id: 13,
    name: 'เรียงประโยคภาษาอังกฤษ',
    icon: '🔤',
    tag: 'เรียงประโยค EN',
    categoryGroup: 'sentence_builder',
    desc: 'โจทย์ความหมายไทย ➔ เติมคำศัพท์ภาษาอังกฤษลงในประโยคที่มีช่องว่าง {1}, {2}...',
    discordNote: 'บอทจะส่งการ์ดโจทย์พร้อมปุ่มคำศัพท์ให้ผู้เล่นกดเรียงลำดับให้ถูกต้องใน Discord',
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
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
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
    label: 'เกม 3: สุ่มโจทย์คณิตฯ (Auto)',
    value: '3',
    description: 'ระบบสุ่มตัวเลขและสมการบวกลบคูณตามระดับความยากอัตโนมัติจากโค้ดบอท',
    icon: '🔢',
    badge: 'คณิต (บอทสร้าง)',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  },
  {
    id: 'game-4',
    label: 'เกม 4: ทายคำจากคำใบ้ 3 ข้อ',
    value: '4',
    description: 'ทายคำศัพท์จากคำใบ้ 3 ข้อ • ระบุระดับความยาก (ง่าย/ปานกลาง/ยาก)',
    icon: '💡',
    badge: 'คำใบ้ 3 ข้อ',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'game-5',
    label: 'เกม 5: ฟังเสียงแล้วพิมพ์ตอบ (อังกฤษ)',
    value: '5',
    description: 'ฟังเสียง Google TTS อังกฤษ • บอทส่งไฟล์เสียง MP3 ในดิสคอร์ด',
    icon: '🎧',
    badge: 'เสียง TTS อังกฤษ',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  },
  {
    id: 'game-6',
    label: 'เกม 6: พิมพ์คำต่อไปนี้ (ไทย)',
    value: '6',
    description: 'แข่งพิมพ์ประโยค/ข้อความภาษาไทย • แข่งความเร็ว (แชร์ร่วมกับเกม 1)',
    icon: '⌨️',
    badge: 'พิมพ์เร็วไทย',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
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
  {
    id: 'game-13',
    label: 'เกม 13: เรียงประโยคภาษาอังกฤษ',
    value: '13',
    description: 'โจทย์ความหมายไทย • เรียงคำศัพท์ภาษาอังกฤษใส่ในประโยค {1}, {2}...',
    icon: '🔤',
    badge: 'เรียงประโยค EN',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
  },
];

export const ADD_QUESTION_GAME_OPTIONS: RichSelectItem[] = [
  {
    id: 'pool-1',
    label: '🇹🇭 คำศัพท์ & ประโยคไทย (เกม 1 + 6)',
    value: '1',
    description: 'แชร์คลังอัตโนมัติ: เกม 1 (เติมคำไทย) และ เกม 6 (พิมพ์เร็วไทย)',
    icon: '🇹🇭',
    badge: 'เติมคำ + พิมพ์เร็ว',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  {
    id: 'pool-2',
    label: '🇬🇧 คำศัพท์ & ประโยคอังกฤษ (เกม 2 + 7)',
    value: '2',
    description: 'แชร์คลังอัตโนมัติ: เกม 2 (เติมคำอังกฤษ) และ เกม 7 (พิมพ์เร็วอังกฤษ)',
    icon: '🇬🇧',
    badge: 'เติมคำ + พิมพ์เร็ว',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  },
  {
    id: 'pool-4',
    label: '💡 ทายคำจากคำใบ้ 3 ข้อ (เกม 4)',
    value: '4',
    description: 'ทายคำศัพท์จากคำใบ้ 3 ข้อความ • ระบุระดับความยากได้',
    icon: '💡',
    badge: 'คำใบ้ 3 ข้อ',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'pool-5',
    label: '🎧 ฟังเสียงแล้วพิมพ์ตอบ อังกฤษ (เกม 5)',
    value: '5',
    description: 'คำศัพท์ภาษาอังกฤษ • บอทส่งไฟล์เสียง TTS อังกฤษในดิสคอร์ด',
    icon: '🎧',
    badge: 'เสียง TTS อังกฤษ',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  },
  {
    id: 'pool-11',
    label: '🔊 ฟังเสียงแล้วพิมพ์ตอบ ไทย (เกม 11)',
    value: '11',
    description: 'คำศัพท์ภาษาไทย • บอทสังเคราะห์เสียง TTS ไทยให้ฟังในดิสคอร์ด',
    icon: '🔊',
    badge: 'เสียง TTS ไทย',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
  {
    id: 'pool-8',
    label: '🌐 คู่คำแปลภาษา (เกม 8 + 9)',
    value: '8',
    description: 'แชร์คลังอัตโนมัติ: เกม 8 (EN ➔ TH) และ เกม 9 (TH ➔ EN)',
    icon: '🌐',
    badge: 'คู่คำแปล EN ⇄ TH',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  },
  {
    id: 'pool-10',
    label: '🔗 เกมต่อคำศัพท์ (เกม 10)',
    value: '10',
    description: 'ต่อคำศัพท์เชื่อมโยง: คำขึ้นต้น (คำหน้า) ➔ คำต่อท้าย (คำหลัง)',
    icon: '🔗',
    badge: 'ต่อคำเชื่อมโยง',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  },
  {
    id: 'pool-12',
    label: '❓ คำถามจริงหรือเท็จ (เกม 12)',
    value: '12',
    description: 'ข้อความหรือข้อเท็จจริง • เลือกตอบ จริง [✅] หรือ เท็จ [❌]',
    icon: '❓',
    badge: 'จริง / เท็จ',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  },
  {
    id: 'pool-13',
    label: '🔤 เรียงประโยคภาษาอังกฤษ (เกม 13)',
    value: '13',
    description: 'โจทย์ความหมายไทย ➔ แม่แบบอังกฤษ {1}, {2} และคำตอบที่ถูกต้อง',
    icon: '🔤',
    badge: 'เรียงประโยค EN',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
  },
];

const GAME_GROUPS = [
  { id: 'all', label: 'ทั้งหมด (13 เกม)', icon: '🎮' },
  { id: 'vocab_typing', label: 'คำศัพท์ & พิมพ์เร็ว (1, 2, 6, 7)', icon: '⌨️' },
  { id: 'audio_tts', label: 'ฟังเสียง TTS (5, 11)', icon: '🎧' },
  { id: 'translation_chain', label: 'คำแปล & ต่อคำ (8, 9, 10)', icon: '🌐' },
  { id: 'sentence_builder', label: 'เรียงประโยค (13)', icon: '🔤' },
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
  status?: 'approved' | 'pending_create' | 'pending_update' | 'pending_delete' | 'deleted';
  created_by?: string | null;
  created_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  pending_request_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

export const DEFAULT_CATEGORIES = [
  'คำทั่วไป',
  'สัตว์และธรรมชาติ',
  'สิ่งของเครื่องใช้',
  'อาหารและเครื่องดื่ม',
  'บุคคลและอาชีพ',
  'สถานที่และการเดินทาง',
  'เทคโนโลยี',
  'เทศกาลและบันเทิง',
  'กีฬา',
  'คุณธรรมและจริยธรรม',
  'สังคมและกฎหมาย',
  'บทสนทนาทั่วไป',
  'สำนวนและสุภาษิต',
];

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  categoryCounts?: Record<string, number>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CategoryCombobox({
  value,
  onChange,
  categories,
  categoryCounts = {},
  placeholder = 'เลือกหรือพิมพ์หมวดหมู่...',
  className,
  disabled = false,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // รวมหมวดหมู่ทั้งหมด และตัดตัวซ้ำ
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
    });
    DEFAULT_CATEGORIES.forEach((c) => set.add(c));
    return Array.from(set);
  }, [categories]);

  const query = searchQuery.trim();
  const normalizedQuery = query.toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return allCategories;
    return allCategories.filter((cat) =>
      cat.toLowerCase().includes(normalizedQuery)
    );
  }, [allCategories, normalizedQuery]);

  const exactMatch = useMemo(() => {
    return allCategories.some(
      (cat) => cat.toLowerCase() === normalizedQuery
    );
  }, [allCategories, normalizedQuery]);

  const handleSelect = (selectedCat: string) => {
    onChange(selectedCat);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] hover:bg-[#FAF6F0] dark:hover:bg-[#25201C] transition-colors h-10 px-3',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 opacity-80" />
            <span className="truncate text-[#2D2520] dark:text-[#F8EBD8] font-medium">
              {value || placeholder}
            </span>
            {value && categoryCounts[value] !== undefined && categoryCounts[value] > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium shrink-0 ml-1">
                {categoryCounts[value]} ข้อ
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0 z-50 bg-[#FDFBF7] dark:bg-[#1D1815] border-[#EAD8C8] dark:border-[#2D2520] shadow-lg rounded-2xl overflow-hidden"
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b border-[#EAD8C8] dark:border-[#2D2520] px-3 bg-white/60 dark:bg-[#181513]/60">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50 text-amber-700 dark:text-amber-400" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground text-[#2D2520] dark:text-[#F8EBD8]"
              placeholder="ค้นหา หรือพิมพ์หมวดหมู่ใหม่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query) {
                  e.preventDefault();
                  handleSelect(query);
                }
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-muted-foreground hover:text-foreground text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <CommandList className="max-h-60 p-1.5 overflow-y-auto">
            {/* ตัวเลือกเพิ่มหมวดหมู่ใหม่ เมื่อผู้ใช้พิมพ์คำที่ยังไม่มีในระบบ */}
            {query && !exactMatch && (
              <div className="p-1 mb-1">
                <button
                  type="button"
                  onClick={() => handleSelect(query)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium transition-colors border border-amber-500/25 text-left"
                >
                  <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">
                    เพิ่มหมวดหมู่ใหม่: <strong className="font-bold underline decoration-amber-500/50">&ldquo;{query}&rdquo;</strong>
                  </span>
                </button>
              </div>
            )}

            {filteredCategories.length === 0 && !query && (
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                ไม่มีข้อมูลหมวดหมู่
              </CommandEmpty>
            )}

            {filteredCategories.length === 0 && query && exactMatch && (
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                ไม่พบหมวดหมู่อื่น
              </CommandEmpty>
            )}

            <CommandGroup heading={query ? "หมวดหมู่ที่ตรงกับการค้นหา" : "หมวดหมู่ทั้งหมดในระบบ"}>
              {filteredCategories.map((cat) => {
                const isSelected = value === cat;
                const count = categoryCounts[cat];
                return (
                  <CommandItem
                    key={cat}
                    value={cat}
                    onSelect={() => handleSelect(cat)}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 text-xs rounded-xl cursor-pointer transition-colors my-0.5',
                      isSelected
                        ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-semibold'
                        : 'hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-300 text-[#4A3B32] dark:text-[#EAD8C8]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Check
                        className={cn(
                          'w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 transition-opacity',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{cat}</span>
                    </div>
                    {count !== undefined && count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EAD8C8]/60 dark:bg-[#2D2520] text-[#6B5A4B] dark:text-[#EAD8C8] font-normal shrink-0 ml-2">
                        {count} ข้อ
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface UserAvatarBadgeProps {
  userId?: string | null;
  fallbackName?: string | null;
  userProfilesMap: Record<string, { username: string; discord_username: string | null; avatar_url: string | null }>;
  className?: string;
  showName?: boolean;
}

function UserAvatarBadge({
  userId,
  fallbackName,
  userProfilesMap,
  className,
  showName = true,
}: UserAvatarBadgeProps) {
  const profile = userId ? userProfilesMap[userId] : null;
  const isSystem = !userId || userId === 'system' || userId === 'bot' || fallbackName === 'ระบบ';
  const displayName = profile?.username || fallbackName || (isSystem ? 'ระบบ' : 'Staff');
  const discordTag = profile?.discord_username;
  const avatarUrl = profile?.avatar_url;
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex items-center gap-1.5 min-w-0 cursor-default select-none group", className)}>
            <Avatar className="w-5 h-5 rounded-full ring-1 ring-[#EAD8C8] dark:ring-[#3D322A] shrink-0 bg-[#F5EBE1] dark:bg-[#2A221C] transition-transform group-hover:scale-105">
              {isSystem ? (
                <AvatarFallback className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  🐻
                </AvatarFallback>
              ) : (
                <>
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
                  <AvatarFallback className="text-[9px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-200">
                    {initial}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            {showName && (
              <span className="truncate text-foreground font-medium text-xs leading-none">
                {displayName}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs p-2 rounded-xl shadow-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7 rounded-full shrink-0 ring-1 ring-amber-500/30">
              {isSystem ? (
                <AvatarFallback className="text-xs bg-amber-500/20 text-amber-700">🐻</AvatarFallback>
              ) : avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback className="text-xs font-bold">{initial}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-xs leading-tight text-foreground truncate">{displayName}</p>
              {discordTag && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">@{discordTag}</p>}
              {userId && !isSystem && (
                <p className="text-[9px] text-muted-foreground/70 font-mono leading-tight mt-0.5 truncate">
                  ID: {userId}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QuickCategoryEditorProps {
  currentCategory: string;
  categories: string[];
  categoryCounts?: Record<string, number>;
  onSave: (newCat: string) => Promise<void> | void;
  disabled?: boolean;
}

function QuickCategoryEditor({
  currentCategory,
  categories,
  categoryCounts = {},
  onSave,
  disabled = false,
}: QuickCategoryEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (newCat: string) => {
    if (newCat === currentCategory) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newCat);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled || saving}>
        <button
          type="button"
          className="group inline-flex items-center gap-1 text-left focus:outline-none"
          title="คลิกเพื่อแก้ไขหมวดหมู่ (เฉพาะ Owner)"
        >
          <Badge
            variant="secondary"
            className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium group-hover:bg-purple-500/20 group-hover:border-purple-500/40 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>{currentCategory || 'คำทั่วไป'}</span>
            <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 z-50 bg-[#FDFBF7] dark:bg-[#1D1815] border-[#EAD8C8] dark:border-[#2D2520] shadow-xl rounded-2xl"
        align="start"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
            <span className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-600" /> แก้ไขหมวดหมู่
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">สิทธิ์ Owner</span>
          </div>
          <CategoryCombobox
            value={currentCategory}
            onChange={handleSelect}
            categories={categories}
            categoryCounts={categoryCounts}
            disabled={saving}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MinigamesManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

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

  // Duplicate detection state
  const [duplicateMatch, setDuplicateMatch] = useState<Question | null>(null);
  const [pendingDuplicateMatch, setPendingDuplicateMatch] = useState<{
    id: string;
    game_id: number;
    word_or_question: string;
    requested_by?: string;
    requested_by_name?: string;
    created_at?: string;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false);

  // Pending Change Requests state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(false);
  const [pendingFilterGame, setPendingFilterGame] = useState<string>('all');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [processingPendingId, setProcessingPendingId] = useState<string | null>(null);
  const [rejectDialogTarget, setRejectDialogTarget] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

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

  // Akari Cross-Project Sync State
  const [syncAkariOpen, setSyncAkariOpen] = useState(false);
  const defaultAkariUrl = ((import.meta as any).env?.VITE_AKARI_SUPABASE_URL as string) || 'https://fqzhcpzxdlnvhvlqspgc.supabase.co';
  const defaultAkariKey = ((import.meta as any).env?.VITE_AKARI_SUPABASE_ANON_KEY as string) || '';
  const [akariUrl, setAkariUrl] = useState(() => localStorage.getItem('akari_sync_supabase_url') || defaultAkariUrl);
  const [akariKey, setAkariKey] = useState(() => localStorage.getItem('akari_sync_supabase_key') || defaultAkariKey);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [syncCleanFirst, setSyncCleanFirst] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  const handleSyncToAkari = async () => {
    if (!akariUrl.trim() || !akariKey.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูลการเชื่อมต่อ',
        description: 'กรุณากรอก Akari Supabase URL และ Key ค่ะ',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSyncing(true);
      setSyncProgress('กำลังเตรียมเชื่อมต่อ Akari Supabase...');

      localStorage.setItem('akari_sync_supabase_url', akariUrl.trim());
      localStorage.setItem('akari_sync_supabase_key', akariKey.trim());

      const akariClient = createClient(akariUrl.trim(), akariKey.trim(), {
        auth: { persistSession: false },
      });

      setSyncProgress('กำลังดึงข้อมูลคลังโจทย์จาก Bear Cafe...');
      const { data: sourceQuestions, error: fetchErr } = await (supabase as any)
        .from('minigame_questions')
        .select('*')
        .eq('is_active', true);

      if (fetchErr) throw fetchErr;

      if (!sourceQuestions || sourceQuestions.length === 0) {
        toast({
          title: 'ไม่พบคลังคำถาม',
          description: 'ไม่พบรายการคำถามที่เปิดใช้งานในคลัง Bear Cafe ค่ะ',
          variant: 'destructive',
        });
        setIsSyncing(false);
        return;
      }

      if (syncCleanFirst) {
        setSyncProgress('กำลังล้างโจทย์เก่าใน Akari Bot...');
        const { error: delErr } = await (akariClient as any)
          .from('akari_minigame_questions')
          .delete()
          .neq('id', 0);
        if (delErr) {
          console.warn('Akari clear warning:', delErr.message);
        }
      }

      setSyncProgress(`กำลังซิงค์โจทย์ ${sourceQuestions.length} ข้อ ไปยัง Akari Bot...`);
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < sourceQuestions.length; i += batchSize) {
        const chunk = sourceQuestions.slice(i, i + batchSize).map((q: any) => ({
          game_id: q.game_id,
          word_or_question: q.word_or_question,
          answer: q.answer,
          options: q.options || null,
          hints: q.hints || null,
          category: q.category || 'คำทั่วไป',
          difficulty: q.difficulty || 'medium',
          is_active: q.is_active ?? true,
        }));

        const { error: insErr } = await (akariClient as any)
          .from('akari_minigame_questions')
          .insert(chunk);

        if (insErr) throw insErr;
        totalInserted += chunk.length;
        setSyncProgress(`ซิงค์แล้ว ${totalInserted}/${sourceQuestions.length} ข้อ...`);
      }

      toast({
        title: '✅ ซิงค์ข้อมูลสำเร็จ!',
        description: `ถ่ายทอดโจทย์ทั้งหมด ${totalInserted} ข้อ สู่ Akari Bot สำเร็จแล้วค่ะ`,
      });
      setSyncAkariOpen(false);
    } catch (err: any) {
      console.error('Error syncing questions to Akari:', err);
      toast({
        title: '❌ เกิดข้อผิดพลาดในการซิงค์',
        description: err.message || 'ไม่สามารถเขียนข้อมูลลง Akari Supabase ได้ กรุณาตรวจสอบสิทธิ์และ URL',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  useEffect(() => {
    setQPage(1);
  }, [searchKeyword, searchMatchMode, selectedCategoryFilter, selectedGameFilter]);

  useEffect(() => {
    setLbPage(1);
  }, [lbTimeFilter, lbGameFilter]);

  // Real-time Duplicate Detection across target pool + pending requests (debounced 300ms)
  useEffect(() => {
    const gId = Number(formGameId);
    const queryText = formQuestion.trim();

    if (!queryText || queryText.length < 2 || gId === 3) {
      setDuplicateMatch(null);
      setPendingDuplicateMatch(null);
      setCheckingDuplicate(false);
      return;
    }

    const targetGIds = getBotTargetGameIds(gId);
    const normalizedQuery = queryText.toLowerCase();

    // 1. Fast Check in loaded memory questions
    const memoryMatch = questions.find(q => {
      if (!targetGIds.includes(q.game_id)) return false;
      const qText = (q.word_or_question || '').trim().toLowerCase();
      const aText = (q.answer || '').trim().toLowerCase();
      if (qText === normalizedQuery) return true;
      if (targetGIds.some(id => [8, 9, 10].includes(id)) && aText === normalizedQuery) return true;
      return false;
    });

    if (memoryMatch) {
      setDuplicateMatch(memoryMatch);
      setPendingDuplicateMatch(null);
      setCheckingDuplicate(false);
      return;
    }

    // 2. Fast Check in loaded memory pending requests
    const memoryPendingMatch = pendingRequests.find(r => {
      if (!targetGIds.includes(r.game_id)) return false;
      const pText = (r.new_data?.word_or_question || '').trim().toLowerCase();
      const pAns = (r.new_data?.answer || '').trim().toLowerCase();
      if (pText === normalizedQuery) return true;
      if (targetGIds.some(id => [8, 9, 10].includes(id)) && pAns === normalizedQuery) return true;
      return false;
    });

    if (memoryPendingMatch) {
      setDuplicateMatch(null);
      setPendingDuplicateMatch({
        id: memoryPendingMatch.id,
        game_id: memoryPendingMatch.game_id,
        word_or_question: memoryPendingMatch.new_data?.word_or_question || '',
        requested_by: memoryPendingMatch.requested_by,
        requested_by_name: memoryPendingMatch.requested_by_name || 'Staff',
        created_at: memoryPendingMatch.created_at,
      });
      setCheckingDuplicate(false);
      return;
    }

    // 3. Debounced DB Check
    setCheckingDuplicate(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('minigame_questions')
          .select('id, game_id, word_or_question, answer, category, difficulty, created_by, created_by_name')
          .in('game_id', targetGIds)
          .ilike('word_or_question', queryText)
          .limit(1);

        if (!error && data && data.length > 0) {
          setDuplicateMatch(data[0]);
          setPendingDuplicateMatch(null);
          setCheckingDuplicate(false);
          return;
        }

        if (targetGIds.some(id => [8, 9, 10].includes(id))) {
          const { data: aData, error: aErr } = await (supabase as any)
            .from('minigame_questions')
            .select('id, game_id, word_or_question, answer, category, difficulty, created_by, created_by_name')
            .in('game_id', targetGIds)
            .ilike('answer', queryText)
            .limit(1);

          if (!aErr && aData && aData.length > 0) {
            setDuplicateMatch(aData[0]);
            setPendingDuplicateMatch(null);
            setCheckingDuplicate(false);
            return;
          }
        }

        // DB Check in pending change requests
        const { data: pData, error: pErr } = await (supabase as any)
          .from('minigame_change_requests')
          .select('id, game_id, new_data, requested_by, requested_by_name, created_at')
          .eq('status', 'pending')
          .in('game_id', targetGIds);

        if (!pErr && pData && pData.length > 0) {
          const dbPendingMatch = pData.find((r: any) => {
            const pText = (r.new_data?.word_or_question || '').trim().toLowerCase();
            const pAns = (r.new_data?.answer || '').trim().toLowerCase();
            if (pText === normalizedQuery) return true;
            if (targetGIds.some((id: number) => [8, 9, 10].includes(id)) && pAns === normalizedQuery) return true;
            return false;
          });

          if (dbPendingMatch) {
            setDuplicateMatch(null);
            setPendingDuplicateMatch({
              id: dbPendingMatch.id,
              game_id: dbPendingMatch.game_id,
              word_or_question: dbPendingMatch.new_data?.word_or_question || '',
              requested_by: dbPendingMatch.requested_by,
              requested_by_name: dbPendingMatch.requested_by_name || 'Staff',
              created_at: dbPendingMatch.created_at,
            });
            setCheckingDuplicate(false);
            return;
          }
        }

        setDuplicateMatch(null);
        setPendingDuplicateMatch(null);
      } catch (e) {
        console.error('Error checking duplicate question:', e);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formQuestion, formGameId, questions, pendingRequests]);

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
      const gameIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

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
        13: direct[13] || 0,
      };
      setBotPoolCounts(botPool);
    } catch (err) {
      console.error('Error fetching question counts:', err);
    }
  }, []);

  // Fetch Questions (supports bot shared pools, audit fields and loads up to 2000 questions)
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      let query = (supabase as any)
        .from('minigame_questions')
        .select('id, game_id, word_or_question, answer, category, hints, options, difficulty, is_active, status, created_by, created_by_name, updated_by, updated_by_name, deleted_by, deleted_by_name, pending_request_id, created_at, updated_at')
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

      let { data, error } = await query;

      // Fallback to base columns if columns not added yet
      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        let baseQuery = (supabase as any)
          .from('minigame_questions')
          .select('id, game_id, word_or_question, answer, category, hints, options, difficulty, is_active')
          .order('id', { ascending: false })
          .limit(2000);

        if (selectedGameFilter !== 'all') {
          const targetIds = getBotTargetGameIds(Number(selectedGameFilter));
          if (targetIds.length === 1) {
            baseQuery = baseQuery.eq('game_id', targetIds[0]);
          } else {
            baseQuery = baseQuery.in('game_id', targetIds);
          }
        }

        const fallbackRes = await baseQuery;
        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
        error = null;
      }

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
      fetchMissingProfiles(discordIds);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการดึงข้อมูลจัดอันดับ', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingLb(false);
    }
  }, [lbGameFilter, lbTimeFilter, toast]);

  // Batch fetch profiles from Supabase
  const fetchMissingProfiles = useCallback(async (discordIds: (string | null | undefined)[]) => {
    const validIds = Array.from(
      new Set(discordIds.filter((id): id is string => Boolean(id && id !== 'admin' && id !== 'system' && id !== 'bot')))
    );
    const missingIds = validIds.filter((id) => !userProfilesMap[id]);
    if (missingIds.length === 0) return;

    try {
      const newMap: Record<string, { username: string; discord_username: string | null; avatar_url: string | null }> = {};
      const chunkSize = 100;
      for (let i = 0; i < missingIds.length; i += chunkSize) {
        const chunk = missingIds.slice(i, i + chunkSize);
        const { data: pData } = await (supabase as any)
          .from('profiles')
          .select('discord_id, username, discord_username, avatar_url')
          .in('discord_id', chunk);
        if (pData) {
          for (const p of pData) {
            newMap[p.discord_id] = {
              username: p.username,
              discord_username: p.discord_username ?? null,
              avatar_url: p.avatar_url ?? null,
            };
          }
        }
      }
      if (Object.keys(newMap).length > 0) {
        setUserProfilesMap((prev) => ({ ...prev, ...newMap }));
      }
    } catch (e) {
      console.error('Error fetching missing user profiles:', e);
    }
  }, [userProfilesMap]);

  // Automatically fetch profiles for questions and pending requests
  useEffect(() => {
    const ids: (string | null | undefined)[] = [];
    questions.forEach((q) => {
      if (q.created_by) ids.push(q.created_by);
      if (q.updated_by) ids.push(q.updated_by);
    });
    pendingRequests.forEach((r) => {
      if (r.requested_by) ids.push(r.requested_by);
    });
    if (pendingDuplicateMatch?.requested_by) {
      ids.push(pendingDuplicateMatch.requested_by);
    }
    if (duplicateMatch?.created_by) {
      ids.push(duplicateMatch.created_by);
    }
    if (ids.length > 0) {
      fetchMissingProfiles(ids);
    }
  }, [questions, pendingRequests, pendingDuplicateMatch?.requested_by, duplicateMatch?.created_by, fetchMissingProfiles]);

  // Fetch Pending Requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoadingPending(true);
      let query = (supabase as any)
        .from('minigame_change_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // If not owner, only show requests submitted by current staff
      if (!user?.is_owner) {
        const operatorId = user?.discord_id || user?.id;
        if (operatorId) {
          query = query.eq('requested_by', operatorId);
        }
      }

      const { data, error } = await query;
      if (error) {
        if (error.code !== '42P01' && error.code !== 'PGRST205') {
          console.error('Error fetching minigame pending requests:', error);
        }
        return;
      }

      setPendingRequests(data || []);
    } catch (err: any) {
      console.error('Error in fetchPendingRequests:', err);
    } finally {
      setLoadingPending(false);
    }
  }, [user?.is_owner, user?.discord_id, user?.id]);

  useEffect(() => {
    fetchSettings();
    fetchGameCounts();
    fetchPendingRequests();
  }, [fetchSettings, fetchGameCounts, fetchPendingRequests]);

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

    const isSingleText = [1, 2, 5, 6, 7, 11].includes(gId);
    const finalQuestion = formQuestion.trim();
    let finalAnswer = formAnswer.trim();

    // Auto-fill answer for single text games (Game 1, 2, 5, 6, 7, 11) if left blank
    if (isSingleText && !finalAnswer) {
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

    // Duplicate prevention check
    if (duplicateMatch) {
      toast({
        title: 'พบข้อมูลซ้ำในระบบ ⚠️',
        description: `ข้อความนี้ซ้ำกับ ID #${duplicateMatch.id} (เกม ${duplicateMatch.game_id}: "${duplicateMatch.word_or_question}") ไม่สามารถเพิ่มซ้ำได้ค่ะ`,
        variant: 'destructive',
      });
      return;
    }

    if (pendingDuplicateMatch) {
      toast({
        title: 'พบคำนี้อยู่ในคิวรอดำเนินการ ⏳',
        description: `ข้อความนี้มีผู้ส่งคำขอเข้ามาแล้ว (เกม ${pendingDuplicateMatch.game_id}: "${pendingDuplicateMatch.word_or_question}" โดย ${pendingDuplicateMatch.requested_by_name || 'Staff'}) รอให้ Owner ตรวจสอบและอนุมัติก่อนนะคะ`,
        variant: 'destructive',
      });
      return;
    }

    if (gId === 1) {
      const vResult = validateAndEvaluateGame1Word(finalQuestion);
      if (!vResult.isValid) {
        toast({
          title: 'คำศัพท์ไม่ผ่านเกณฑ์ Game 1 ⚠️',
          description: vResult.reason || 'คำนี้ไม่สามารถสร้างโจทย์เติมคำที่มีคุณภาพและปลอดภัยได้',
          variant: 'destructive',
        });
        return;
      }
    }

    const isDiffGame = (gId === 4);
    const finalDiff = isDiffGame ? formDifficulty : null;

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [formHint1.trim(), formHint2.trim(), formHint3.trim()].filter(Boolean);
    } else if (gId === 13) {
      const vError = validateGame13Sentence(formHint1, finalAnswer);
      if (vError) {
        toast({
          title: 'รูปแบบประโยคเกม 13 ไม่ถูกต้อง ⚠️',
          description: vError,
          variant: 'destructive',
        });
        return;
      }
      hintsArray = [formHint1.trim()].filter(Boolean);
    }

    let optionsArray: string[] = [];
    if (gId === 12) {
      optionsArray = ['จริง', 'เท็จ'];
    }

    const finalCategory = isCategoryGame(gId) ? (formCategory.trim() || 'คำทั่วไป') : null;

    const operatorId = user?.discord_id || user?.id || 'admin';
    const operatorName = user?.username || user?.discord_username || 'Staff';

    try {
      if (!user?.is_owner) {
        // Staff mode: Submit change request to Reports
        const reqPayload = {
          action_type: 'create',
          game_id: gId,
          new_data: {
            word_or_question: finalQuestion,
            answer: finalAnswer,
            category: finalCategory,
            hints: hintsArray,
            options: optionsArray,
            difficulty: finalDiff,
            is_active: true,
          },
          requested_by: operatorId,
          requested_by_name: operatorName,
          status: 'pending',
        };

        const { error } = await (supabase as any).from('minigame_change_requests').insert(reqPayload);
        if (error) throw error;

        toast({
          title: 'ส่งคำขอเพิ่มคำศัพท์สำเร็จ 📨',
          description: `คำขอเพิ่มคำศัพท์เกม #${gId} ถูกส่งไปยังแท็บรอดำเนินการ เพื่อรอให้ Owner อนุมัติแล้วค่ะ`,
        });
        fetchPendingRequests();
      } else {
        // Owner mode: Insert directly into minigame_questions
        const insertData: any = {
          game_id: gId,
          word_or_question: finalQuestion,
          answer: finalAnswer,
          category: finalCategory,
          hints: hintsArray,
          options: optionsArray,
          difficulty: finalDiff,
          is_active: true,
          status: 'approved',
          created_by: operatorId,
          created_by_name: operatorName,
          updated_by: operatorId,
          updated_by_name: operatorName,
        };

        let res = await (supabase as any).from('minigame_questions').insert(insertData);
        if (res.error && (res.error.code === '42703' || res.error.message?.includes('created_by'))) {
          delete insertData.status;
          delete insertData.created_by;
          delete insertData.created_by_name;
          delete insertData.updated_by;
          delete insertData.updated_by_name;
          res = await (supabase as any).from('minigame_questions').insert(insertData);
        }
        if (res.error) throw res.error;

        toast({
          title: 'เพิ่มคำศัพท์สำเร็จ 🎉',
          description: `บันทึกข้อมูลเข้าคลังเกม #${gId} เรียบร้อยแล้ว (สิทธิ์ Owner)`,
        });
        fetchQuestions();
        fetchGameCounts();
      }

      setFormQuestion('');
      if (gId !== 12) setFormAnswer('');
      setFormHint1(''); setFormHint2(''); setFormHint3('');
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

    const isSingleText = [1, 2, 5, 6, 7, 11].includes(gId);
    if (isSingleText) {
      finalAnswer = finalQuestion;
    }

    if (gId === 12 && !finalAnswer) {
      finalAnswer = 'จริง';
    }

    if (!finalQuestion || !finalAnswer) {
      toast({ title: 'กรุณากรอกข้อมูลโจทย์และเฉลย', variant: 'destructive' });
      return;
    }

    if (gId === 1) {
      const vResult = validateAndEvaluateGame1Word(finalQuestion);
      if (!vResult.isValid) {
        toast({
          title: 'คำศัพท์ไม่ผ่านเกณฑ์ Game 1 ⚠️',
          description: vResult.reason || 'คำนี้ไม่สามารถสร้างโจทย์เติมคำที่มีคุณภาพและปลอดภัยได้',
          variant: 'destructive',
        });
        return;
      }
    }

    let hintsArray: string[] = [];
    if (gId === 4) {
      hintsArray = [editHint1.trim(), editHint2.trim(), editHint3.trim()].filter(Boolean);
    } else if (gId === 13) {
      const vError = validateGame13Sentence(editHint1, finalAnswer);
      if (vError) {
        toast({
          title: 'รูปแบบประโยคเกม 13 ไม่ถูกต้อง ⚠️',
          description: vError,
          variant: 'destructive',
        });
        return;
      }
      hintsArray = [editHint1.trim()].filter(Boolean);
    }

    const finalDiff = (gId === 4) ? editDifficulty : null;

    let optionsArray: string[] = [];
    if (gId === 12) {
      optionsArray = ['จริง', 'เท็จ'];
    } else if (editingQuestion.options?.length) {
      optionsArray = editingQuestion.options;
    }

    const finalCategory = isCategoryGame(gId) ? (editCategory.trim() || 'คำทั่วไป') : null;

    const operatorId = user?.discord_id || user?.id || 'admin';
    const operatorName = user?.username || user?.discord_username || 'Staff';

    try {
      if (!user?.is_owner) {
        // Staff mode: Submit update request to Reports
        const reqPayload = {
          question_id: editingQuestion.id,
          action_type: 'update',
          game_id: gId,
          old_data: {
            word_or_question: editingQuestion.word_or_question,
            answer: editingQuestion.answer,
            category: editingQuestion.category || null,
            hints: editingQuestion.hints || [],
            options: editingQuestion.options || [],
            difficulty: editingQuestion.difficulty,
            is_active: editingQuestion.is_active,
          },
          new_data: {
            word_or_question: finalQuestion,
            answer: finalAnswer,
            category: finalCategory,
            hints: hintsArray,
            options: optionsArray,
            difficulty: finalDiff,
            is_active: editingQuestion.is_active,
          },
          requested_by: operatorId,
          requested_by_name: operatorName,
          status: 'pending',
        };

        const { data: reqData, error: reqErr } = await (supabase as any)
          .from('minigame_change_requests')
          .insert(reqPayload)
          .select('id')
          .single();

        if (reqErr) throw reqErr;

        // Mark question as pending_update in DB
        try {
          await (supabase as any)
            .from('minigame_questions')
            .update({
              status: 'pending_update',
              pending_request_id: reqData?.id,
            })
            .eq('id', editingQuestion.id);
        } catch (_) {}

        toast({
          title: 'ส่งคำขอแก้ไขคำศัพท์สำเร็จ 📨',
          description: `คำขอแก้ไขข้อ #${editingQuestion.id} ถูกส่งไปยังหน้า Reports เพื่อรอ Owner ตรวจสอบและอนุมัติค่ะ`,
        });
      } else {
        // Owner mode: Direct update on minigame_questions
        const updateData: any = {
          word_or_question: finalQuestion,
          answer: finalAnswer,
          category: finalCategory,
          hints: hintsArray,
          options: optionsArray,
          difficulty: finalDiff,
          status: 'approved',
          updated_by: operatorId,
          updated_by_name: operatorName,
          updated_at: new Date().toISOString(),
        };

        let res = await (supabase as any)
          .from('minigame_questions')
          .update(updateData)
          .eq('id', editingQuestion.id);

        if (res.error && (res.error.code === '42703' || res.error.message?.includes('updated_by'))) {
          delete updateData.status;
          delete updateData.updated_by;
          delete updateData.updated_by_name;
          res = await (supabase as any)
            .from('minigame_questions')
            .update(updateData)
            .eq('id', editingQuestion.id);
        }

        if (res.error) throw res.error;

        toast({
          title: 'แก้ไขสำเร็จ 🎉',
          description: `แก้ไขข้อมูลข้อ #${editingQuestion.id} เรียบร้อยแล้วค่ะ (สิทธิ์ Owner)`,
        });
      }

      setEditDialogOpen(false);
      fetchQuestions();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการแก้ไขโจทย์', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteQuestion = async (q: Question) => {
    const operatorId = user?.discord_id || user?.id || 'admin';
    const operatorName = user?.username || user?.discord_username || 'Staff';

    if (!user?.is_owner) {
      // Staff mode: Confirm sending delete request to Reports
      if (!confirm(`คุณต้องการส่งคำขอลบข้อ #${q.id} ("${q.word_or_question}") ไปยังหน้า Reports เพื่อรอให้ Owner อนุมัติหรือไม่?`)) return;

      try {
        const reqPayload = {
          question_id: q.id,
          action_type: 'delete',
          game_id: q.game_id,
          old_data: {
            word_or_question: q.word_or_question,
            answer: q.answer,
            category: q.category || 'คำทั่วไป',
            hints: q.hints || [],
            options: q.options || [],
            difficulty: q.difficulty,
            is_active: q.is_active,
          },
          new_data: {},
          requested_by: operatorId,
          requested_by_name: operatorName,
          status: 'pending',
        };

        const { data: reqData, error: reqErr } = await (supabase as any)
          .from('minigame_change_requests')
          .insert(reqPayload)
          .select('id')
          .single();

        if (reqErr) throw reqErr;

        try {
          await (supabase as any)
            .from('minigame_questions')
            .update({
              status: 'pending_delete',
              pending_request_id: reqData?.id,
            })
            .eq('id', q.id);
        } catch (_) {}

        toast({
          title: 'ส่งคำขอลบคำศัพท์สำเร็จ 📨',
          description: `คำขอลบข้อ #${q.id} ถูกส่งไปยังหน้า Reports เพื่อรอ Owner ตรวจสอบและอนุมัติค่ะ`,
        });
        fetchQuestions();
      } catch (err: any) {
        toast({ title: 'เกิดข้อผิดพลาดในการส่งคำขอลบ', description: err.message, variant: 'destructive' });
      }
    } else {
      // Owner mode: Direct delete
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคำศัพท์ข้อ #${q.id} ("${q.word_or_question}") ออกจากคลัง?`)) return;
      try {
        const { error } = await (supabase as any).from('minigame_questions').delete().eq('id', q.id);
        if (error) throw error;
        toast({ title: 'ลบคำศัพท์เรียบร้อยแล้ว (สิทธิ์ Owner)' });
        fetchQuestions();
        fetchGameCounts();
      } catch (err: any) {
        toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
      }
    }
  };

  // ─── Owner Management for Pending Requests ──────────────────────────────────────
  const handleApprovePendingRequest = async (req: any) => {
    if (!user?.is_owner) {
      toast({ title: 'ไม่มีสิทธิ์', description: 'เฉพาะ Owner เท่านั้นที่สามารถอนุมัติได้', variant: 'destructive' });
      return;
    }

    setProcessingPendingId(req.id);
    const approverId = user?.discord_id || user?.id || 'admin';
    const approverName = user?.username || user?.discord_username || 'Owner';

    try {
      if (req.action_type === 'create') {
        const { data: inserted, error: insErr } = await (supabase as any)
          .from('minigame_questions')
          .insert({
            game_id: req.game_id,
            word_or_question: req.new_data?.word_or_question || '',
            answer: req.new_data?.answer || '',
            category: req.new_data?.category || 'คำทั่วไป',
            hints: req.new_data?.hints || [],
            options: req.new_data?.options || [],
            difficulty: req.new_data?.difficulty || null,
            is_active: req.new_data?.is_active ?? true,
            status: 'approved',
            created_by: req.requested_by,
            created_by_name: req.requested_by_name,
            updated_by: approverId,
            updated_by_name: approverName,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;

        await (supabase as any)
          .from('minigame_change_requests')
          .update({
            status: 'approved',
            question_id: inserted?.id,
            approved_by: approverId,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.id);
      } else if (req.action_type === 'update' && req.question_id) {
        const { error: updErr } = await (supabase as any)
          .from('minigame_questions')
          .update({
            word_or_question: req.new_data?.word_or_question,
            answer: req.new_data?.answer,
            category: req.new_data?.category || 'คำทั่วไป',
            hints: req.new_data?.hints || [],
            options: req.new_data?.options || [],
            difficulty: req.new_data?.difficulty || null,
            status: 'approved',
            pending_request_id: null,
            updated_by: req.requested_by,
            updated_by_name: req.requested_by_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.question_id);

        if (updErr) throw updErr;

        await (supabase as any)
          .from('minigame_change_requests')
          .update({
            status: 'approved',
            approved_by: approverId,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.id);
      } else if (req.action_type === 'delete' && req.question_id) {
        const { error: delErr } = await (supabase as any)
          .from('minigame_questions')
          .delete()
          .eq('id', req.question_id);

        if (delErr) throw delErr;

        await (supabase as any)
          .from('minigame_change_requests')
          .update({
            status: 'approved',
            approved_by: approverId,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.id);
      }

      toast({
        title: 'อนุมัติคำขอสำเร็จ 🎉',
        description: `อนุมัติคำขอ "${req.new_data?.word_or_question || 'มินิเกม'}" เข้าสู่คลังเรียบร้อยแล้ว`,
      });

      await fetchPendingRequests();
      await fetchQuestions();
      await fetchGameCounts();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการอนุมัติ', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingPendingId(null);
    }
  };

  const handleRejectPendingRequest = async (reqId: string, reason?: string) => {
    if (!user?.is_owner) {
      toast({ title: 'ไม่มีสิทธิ์', description: 'เฉพาะ Owner เท่านั้นที่สามารถปฏิเสธได้', variant: 'destructive' });
      return;
    }

    setProcessingPendingId(reqId);
    const rejectorId = user?.discord_id || user?.id || 'admin';

    try {
      const { error } = await (supabase as any)
        .from('minigame_change_requests')
        .update({
          status: 'rejected',
          rejected_by: rejectorId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || 'ไม่ผ่านเกณฑ์การพิจารณา',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      if (error) throw error;

      toast({
        title: 'ปฏิเสธคำขอเรียบร้อย',
        description: 'คำขอนี้ถูกปรับสถานะเป็น rejected แล้วค่ะ',
      });

      setRejectDialogTarget(null);
      setRejectionReason('');
      await fetchPendingRequests();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingPendingId(null);
    }
  };

  const handleUpdatePendingCategory = async (requestId: string, newCategory: string) => {
    if (!user?.is_owner) {
      toast({ title: 'ไม่มีสิทธิ์', description: 'เฉพาะ Owner เท่านั้นที่สามารถแก้ไขหมวดหมู่ได้', variant: 'destructive' });
      return;
    }

    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const updatedNewData = {
      ...req.new_data,
      category: newCategory.trim() || 'คำทั่วไป',
    };

    try {
      const { error } = await (supabase as any)
        .from('minigame_change_requests')
        .update({
          new_data: updatedNewData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'แก้ไขหมวดหมู่สำเร็จ ✨',
        description: `เปลี่ยนหมวดหมู่คำขอเป็น "${newCategory}" เรียบร้อยแล้วค่ะ`,
      });

      setPendingRequests(prev => prev.map(r => r.id === requestId ? { ...r, new_data: updatedNewData } : r));
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่', description: err.message, variant: 'destructive' });
    }
  };

  const handleQuickUpdateCategory = async (questionId: number, newCategory: string) => {
    if (!user?.is_owner) {
      toast({ title: 'ไม่มีสิทธิ์', description: 'เฉพาะ Owner เท่านั้นที่สามารถแก้ไขหมวดหมู่ได้', variant: 'destructive' });
      return;
    }

    try {
      const operatorId = user?.discord_id || user?.id || 'admin';
      const operatorName = user?.username || user?.discord_username || 'Owner';

      const updateData: any = {
        category: newCategory.trim() || 'คำทั่วไป',
        updated_by: operatorId,
        updated_by_name: operatorName,
        updated_at: new Date().toISOString(),
      };

      let res = await (supabase as any)
        .from('minigame_questions')
        .update(updateData)
        .eq('id', questionId);

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('updated_by'))) {
        delete updateData.updated_by;
        delete updateData.updated_by_name;
        res = await (supabase as any)
          .from('minigame_questions')
          .update(updateData)
          .eq('id', questionId);
      }

      if (res.error) throw res.error;

      toast({
        title: 'แก้ไขหมวดหมู่สำเร็จ ✨',
        description: `เปลี่ยนหมวดหมู่ข้อ #${questionId} เป็น "${newCategory}" เรียบร้อยแล้วค่ะ`,
      });

      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, category: newCategory.trim() || 'คำทั่วไป' } : q));
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่', description: err.message, variant: 'destructive' });
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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      const cat = q.category || 'คำทั่วไป';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
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
            ศูนย์กลางควบคุมคลังคำศัพท์ทั้ง 13 มินิเกมของ Bear Cafe Discord Bot, กำหนด Channel ID & แต้มรางวัล, และติดตาม Hall of Fame
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary border-primary/20">
            🎮 ครบ 13 มินิเกม
          </Badge>
          <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 border-[#EAD8C8] dark:border-[#2D2520]" onClick={() => { fetchQuestions(); fetchGameCounts(); fetchSettings(); fetchPendingRequests(); }}>
            <RefreshCw className={cn("w-3.5 h-3.5", loadingQuestions && "animate-spin")} /> ดึงข้อมูลสด
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="questions" className="w-full space-y-6">
        <TabsList className="bg-[#FAF6F0] dark:bg-[#25201C] p-1.5 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] grid grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="questions" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Edit3 className="w-4 h-4 text-blue-500" /> 1. คลังคำศัพท์ & จัดการโจทย์
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Clock className="w-4 h-4 text-amber-500" /> 2. รายการรอดำเนินการ
            {pendingRequests.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 rounded-full font-bold ml-1">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Settings2 className="w-4 h-4 text-purple-500" /> 3. ตั้งค่าห้อง & แต้มรางวัล
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Trophy className="w-4 h-4 text-amber-500" /> 4. จัดอันดับผู้ชนะ
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUESTION BANK MANAGER */}
        <TabsContent value="questions" className="space-y-6">

          {/* Staff vs Owner Permission Mode Banner */}
          {user?.is_owner ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong className="font-bold text-sm block text-amber-800 dark:text-amber-300">โหมดเจ้าของร้าน (Owner Mode)</strong>
                  <span>ท่านมีสิทธิ์อนุมัติและปรับปรุงคลังคำศัพท์โดยตรง ทุกการดำเนินการจะถูกบันทึกประวัติผู้แก้ไขอัตโนมัติ</span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSyncAkariOpen(true)}
                  className="h-8 text-xs font-bold rounded-xl border-amber-500/40 bg-white/80 dark:bg-[#1E1B18]/80 hover:bg-amber-600 hover:text-white transition-all shadow-xs gap-1.5 cursor-pointer text-amber-900 dark:text-amber-100"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  ซิงค์โจทย์สู่ Akari Bot
                </Button>
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0">
                  สิทธิ์ Owner
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <strong className="font-bold text-sm block text-blue-800 dark:text-blue-300">โหมดทีมงาน (Staff Mode)</strong>
                  <span>การเพิ่ม แก้ไข หรือลบคำศัพท์จะถูกส่งเป็นคำขอไปยังหน้า <strong>Admin &gt; Reports</strong> เพื่อรอให้ Owner อนุมัติก่อนขึ้นระบบจริง</span>
                </div>
              </div>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0">
                สิทธิ์ Staff
              </Badge>
            </div>
          )}

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
                    
                    {/* Game Selector Dropdown + Dynamic Category / Difficulty */}
                    <div className={cn("grid gap-4", isCategoryGame(selectedGId) || selectedGId === 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                      <div>
                        <RichSelect
                          label="เลือกมินิเกมที่จะเพิ่ม"
                          value={formGameId}
                          onValueChange={(val) => setFormGameId(val)}
                          data={ADD_QUESTION_GAME_OPTIONS}
                          placeholder="เลือกมินิเกม..."
                        />
                      </div>

                      {/* Category Selector (ONLY for games that use category: 1, 2, 6, 7) */}
                      {isCategoryGame(selectedGId) && (
                        <div>
                          <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] mb-1.5 block">
                            หมวดหมู่ (Category)
                          </label>
                          <CategoryCombobox
                            value={formCategory}
                            onChange={(val) => setFormCategory(val)}
                            categories={categoriesList}
                            categoryCounts={categoryCounts}
                            placeholder="เลือกหรือพิมพ์หมวดหมู่..."
                            className="h-10"
                          />
                        </div>
                      )}

                      {/* Difficulty Selector (ONLY for Game 4) */}
                      {selectedGId === 4 && (
                        <div>
                          <RichSelect
                            label="ระดับความยาก (สำหรับเกมที่ 4)"
                            value={formDifficulty}
                            onValueChange={(val) => setFormDifficulty(val)}
                            data={DIFFICULTY_RICH_OPTIONS}
                            placeholder="เลือกระดับความยาก..."
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
                        {(() => {
                          const isSingleTextGame = [1, 2, 5, 6, 7, 11].includes(selectedGId);
                          return (
                            <div className="space-y-4">
                              <div className={cn("grid gap-4", (isSingleTextGame || selectedGId === 13) ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                                {/* Question Input */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                                      {selectedGId === 1 && '🇹🇭 คำศัพท์ภาษาไทย (เติมคำ & พิมพ์เร็ว)'}
                                      {selectedGId === 2 && '🇬🇧 คำศัพท์ภาษาอังกฤษ (เติมคำ & พิมพ์เร็ว)'}
                                      {selectedGId === 4 && '💡 ชื่อคำศัพท์ / สิ่งของ (เฉลยข้อนี้)'}
                                      {selectedGId === 5 && '🎧 คำศัพท์ภาษาอังกฤษ (บอทจะอ่านออกเสียง TTS)'}
                                      {selectedGId === 6 && '🇹🇭 ข้อความ / ประโยคภาษาไทยสำหรับฝึกพิมพ์'}
                                      {selectedGId === 7 && '🇬🇧 ข้อความ / ประโยคภาษาอังกฤษสำหรับฝึกพิมพ์'}
                                      {selectedGId === 8 && '🌐 คำศัพท์ภาษาอังกฤษ (โจทย์ EN ➔ TH)'}
                                      {selectedGId === 9 && '🌐 คำศัพท์ภาษาอังกฤษ (โจทย์คู่แปล TH ➔ EN)'}
                                      {selectedGId === 10 && '🔗 คำขึ้นต้น (คำหน้า เช่น "น้ำ", "ไฟ")'}
                                      {selectedGId === 11 && '🔊 คำศัพท์ภาษาไทย (บอทจะอ่านออกเสียง TTS)'}
                                      {selectedGId === 12 && '❓ ข้อความ / คำถามจริงหรือเท็จ'}
                                      {selectedGId === 13 && '🔤 ความหมายสำนวน / คำแปลภาษาไทย (โจทย์)'}
                                    </label>
                                    {isSingleTextGame && (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                        ✨ ช่องเดียวจบ บันทึกคำตอบตรงกันอัตโนมัติ
                                      </span>
                                    )}
                                  </div>
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
                                      selectedGId === 13 ? 'เช่น ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น' :
                                      'กรอกโจทย์/คำศัพท์...'
                                    }
                                    value={formQuestion}
                                    onChange={(e) => setFormQuestion(e.target.value)}
                                    required
                                  />
                                  {selectedGId === 1 && (
                                    <Game1LivePreview word={formQuestion} />
                                  )}
                                  {selectedGId === 1 && (
                                    <span className="text-[11px] text-muted-foreground block">
                                      💡 บอทจะนำคำนี้ไปใช้ทั้งในเกม 1 (สุ่มซ่อนขีดเส้นใต้) และเกม 6 (ประโยคพิมพ์เร็ว)
                                    </span>
                                  )}
                                  {selectedGId === 2 && (
                                    <span className="text-[11px] text-muted-foreground block">
                                      💡 บอทจะนำคำนี้ไปใช้ทั้งในเกม 2 (สุ่มซ่อนตัวอักษร) และเกม 7 (ประโยคพิมพ์เร็วอังกฤษ)
                                    </span>
                                  )}
                                </div>

                                {/* Answer Input or True/False Selector (HIDDEN for single-text games and Game 13) */}
                                {!isSingleTextGame && selectedGId !== 13 && (
                                  <div className="space-y-1.5">
                                    <label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">
                                      {selectedGId === 4 && 'คำตอบที่ต้องพิมพ์ตอบ'}
                                      {selectedGId === 8 && 'คำแปลภาษาไทย (เฉลย)'}
                                      {selectedGId === 9 && 'คำแปลภาษาไทย (เฉลย)'}
                                      {selectedGId === 10 && 'คำต่อท้าย (คำหลัง เช่น "แข็ง", "ไฟ")'}
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
                                          selectedGId === 8 || selectedGId === 9
                                            ? 'เช่น แอปเปิ้ล, กล้วย, บ้าน'
                                            : selectedGId === 10
                                            ? 'เช่น แข็ง (รวมเป็น น้ำแข็ง), ไฟ (รถไฟ)'
                                            : 'พิมพ์เฉลยคำตอบ...'
                                        }
                                        value={formAnswer}
                                        onChange={(e) => setFormAnswer(e.target.value)}
                                        required
                                      />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Dedicated Smart Sentence Builder for Game 13 */}
                              {selectedGId === 13 && (
                                <div className="space-y-3 pt-1">
                                  <Game13FlowGuide />
                                  <Game13SentenceBuilder
                                    template={formHint1}
                                    answers={formAnswer}
                                    onChange={(newT, newAns) => {
                                      setFormHint1(newT);
                                      setFormAnswer(newAns);
                                    }}
                                    onPresetSelect={(preset) => {
                                      setFormQuestion(preset.question);
                                      setFormHint1(preset.template);
                                      setFormAnswer(preset.answers);
                                      if (preset.category) setFormCategory(preset.category);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Real-time Duplicate Detection Status Banner */}
                        {duplicateMatch ? (
                          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <strong className="font-bold text-amber-700 dark:text-amber-300">
                                  ตรวจพบข้อมูลซ้ำในคลัง!
                                </strong>
                                <Badge variant="outline" className="text-[10px] bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300">
                                  ID #{duplicateMatch.id}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] leading-relaxed flex-wrap">
                                <span>
                                  ข้อความนี้มีอยู่แล้วใน <strong>เกม {duplicateMatch.game_id} ({MINIGAME_CONFIGS[duplicateMatch.game_id]?.name || 'มินิเกม'})</strong>
                                </span>
                                {duplicateMatch.category && <span> • หมวด: {duplicateMatch.category}</span>}
                                {duplicateMatch.created_by_name && (
                                  <span className="flex items-center gap-1">
                                    <span>• เพิ่มโดย:</span>
                                    <UserAvatarBadge
                                      userId={duplicateMatch.created_by}
                                      fallbackName={duplicateMatch.created_by_name}
                                      userProfilesMap={userProfilesMap}
                                    />
                                  </span>
                                )}
                              </div>
                              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#1E1B18]/70 border border-amber-500/20 font-mono text-[11px] text-foreground flex flex-wrap gap-x-4 gap-y-1">
                                <span>โจทย์: <strong>"{duplicateMatch.word_or_question}"</strong></span>
                                {duplicateMatch.answer && <span>เฉลย: <strong>"{duplicateMatch.answer}"</strong></span>}
                              </div>
                            </div>
                          </div>
                        ) : pendingDuplicateMatch ? (
                          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <strong className="font-bold text-amber-800 dark:text-amber-300">
                                  พบคำนี้อยู่ในคิวรอดำเนินการ (Pending)!
                                </strong>
                                <Badge variant="outline" className="text-[10px] bg-amber-500/25 border-amber-500/50 text-amber-800 dark:text-amber-200 font-bold">
                                  รอ Owner ตรวจสอบ
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] leading-relaxed flex-wrap">
                                <span>
                                  มีผู้ส่งคำขอนี้เข้ามาแล้วใน <strong>เกม {pendingDuplicateMatch.game_id} ({MINIGAME_CONFIGS[pendingDuplicateMatch.game_id]?.name || 'มินิเกม'})</strong>
                                </span>
                                {pendingDuplicateMatch.requested_by_name && (
                                  <span className="flex items-center gap-1">
                                    <span>• ส่งโดย:</span>
                                    <UserAvatarBadge
                                      userId={pendingDuplicateMatch.requested_by}
                                      fallbackName={pendingDuplicateMatch.requested_by_name}
                                      userProfilesMap={userProfilesMap}
                                    />
                                  </span>
                                )}
                              </div>
                              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#1E1B18]/70 border border-amber-500/20 font-mono text-[11px] text-foreground flex flex-wrap gap-x-4 gap-y-1">
                                <span>โจทย์: <strong>"{pendingDuplicateMatch.word_or_question}"</strong></span>
                              </div>
                            </div>
                          </div>
                        ) : formQuestion.trim().length >= 2 && !checkingDuplicate ? (
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>ไม่พบข้อมูลซ้ำทั้งในคลังและคิวรอดำเนินการ สามารถเพิ่มคำนี้ได้ทันที</span>
                          </div>
                        ) : checkingDuplicate ? (
                          <div className="px-3 py-1.5 rounded-xl bg-muted/60 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>กำลังตรวจสอบข้อมูลซ้ำในคลังและคำที่รอดำเนินการ...</span>
                          </div>
                        ) : null}

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

                        <Button
                          type="submit"
                          disabled={
                            !!duplicateMatch ||
                            !!pendingDuplicateMatch ||
                            checkingDuplicate ||
                            (selectedGId === 1 && !validateAndEvaluateGame1Word(formQuestion).isValid) ||
                            (selectedGId === 13 && !!validateGame13Sentence(formHint1, formAnswer))
                          }
                          className={cn(
                            "w-full rounded-2xl h-11 gap-2 text-white font-bold text-sm shadow-xs cursor-pointer mt-2 transition-all",
                            duplicateMatch || pendingDuplicateMatch || (selectedGId === 1 && !validateAndEvaluateGame1Word(formQuestion).isValid) || (selectedGId === 13 && !!validateGame13Sentence(formHint1, formAnswer))
                              ? "bg-muted-foreground/50 cursor-not-allowed opacity-60"
                              : "bg-[#8C6239] hover:bg-[#74502D]"
                          )}
                        >
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

                        {/* Game 13 Sentence Builder Discord Preview */}
                        {selectedGId === 13 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                                เรียงประโยคภาษาอังกฤษ
                              </Badge>
                              <span className="text-[11px] text-zinc-400">กดปุ่มคำศัพท์ตามลำดับให้ครบ</span>
                            </div>

                            {/* Prompt Card */}
                            <div className="bg-[#1e1f22] p-2.5 rounded-lg text-xs space-y-1">
                              <p className="text-[11px] text-zinc-400">📝 ความหมาย / คำแปลไทย:</p>
                              <p className="font-semibold text-white">
                                "{formQuestion || 'ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น'}"
                              </p>
                            </div>

                            {/* Sentence with Blanks */}
                            <div className="bg-[#2b2d31] p-3 rounded-xl border border-zinc-700/80 space-y-1.5">
                              <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">ATTACHMENT: sentence_card.png</p>
                              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700/80 font-mono text-xs leading-relaxed text-zinc-200">
                                {(() => {
                                  const t = formHint1 || 'Where there is a {1}, there is a {2}.';
                                  const parts = t.split(/(\{\d+\})/g);
                                  return parts.map((part, idx) => {
                                    const m = part.match(/^\{(\d+)\}$/);
                                    if (m) {
                                      return (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-[11px]"
                                        >
                                          [ ___ ] <span className="text-[9px] opacity-75 ml-1">({m[1]})</span>
                                        </span>
                                      );
                                    }
                                    return <span key={idx}>{part}</span>;
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Simulated Choice Buttons */}
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] text-zinc-400">🎮 ปุ่มคำศัพท์ที่บอทจะสุ่มส่งใน Discord:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(() => {
                                  const realWords = (formAnswer || 'will, way')
                                    .split(/[,|]/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  const dummyPool = ['hope', 'path', 'mind', 'power', 'try', 'step'];
                                  const fakeWords = dummyPool
                                    .filter((w) => !realWords.includes(w))
                                    .slice(0, Math.max(2, 5 - realWords.length));
                                  const allDisplay = [...realWords, ...fakeWords];
                                  return (
                                    <>
                                      {allDisplay.map((w, idx) => {
                                        const isCorrect = realWords.includes(w);
                                        return (
                                          <div
                                            key={idx}
                                            className={cn(
                                              "px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border",
                                              isCorrect
                                                ? "bg-[#5865F2] text-white border-indigo-400/40"
                                                : "bg-[#4e5058] text-zinc-200 border-zinc-600"
                                            )}
                                          >
                                            {w}
                                            {isCorrect && <span className="text-[9px] opacity-75">(เฉลย)</span>}
                                          </div>
                                        );
                                      })}
                                      <div className="px-2 py-1 rounded-md text-xs font-semibold bg-rose-900/60 text-rose-200 border border-rose-700/50 flex items-center gap-1">
                                        🔄 เริ่มใหม่
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                              <p className="text-[10px] text-zinc-400">
                                💡 ผู้เล่นต้องกดปุ่มตามลำดับ 1, 2... ใครกดครบคนแรกรับคะแนนทันที
                              </p>
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

                  {/* Category Filter (Show when viewing all games or games that use category) */}
                  {(selectedGameFilter === 'all' || isCategoryGame(Number(selectedGameFilter))) && (
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
                  )}

                  {/* Game Filter Dropdown */}
                  <Select value={selectedGameFilter} onValueChange={(val) => setSelectedGameFilter(val)}>
                    <SelectTrigger className="w-full sm:w-56 h-9 text-xs font-medium rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]">
                      <SelectValue placeholder="เลือกมินิเกม" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="all">🎮 ทุกมินิเกม (13 เกม)</SelectItem>
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
                      <TableHead className="w-28 text-xs font-bold">มินิเกม</TableHead>
                      <TableHead className="w-24 text-xs font-bold">หมวดหมู่</TableHead>
                      <TableHead className="text-xs font-bold">โจทย์ / คำศัพท์</TableHead>
                      <TableHead className="text-xs font-bold">คำตอบ / เฉลย</TableHead>
                      <TableHead className="text-xs font-bold">รายละเอียด</TableHead>
                      <TableHead className="w-20 text-xs font-bold">ความยาก</TableHead>
                      <TableHead className="w-28 text-xs font-bold">สถานะ</TableHead>
                      <TableHead className="w-32 text-xs font-bold">ผู้จัดการ</TableHead>
                      <TableHead className="text-right w-20 text-xs font-bold">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-12 text-xs">
                          {searchKeyword ? `ไม่พบคำศัพท์ที่ ${searchMatchMode === 'starts_with' ? 'ขึ้นต้นด้วย' : searchMatchMode === 'exact' ? 'ตรงกับ' : 'มีคำว่า'} "${searchKeyword}"` : 'ไม่พบรายการคำศัพท์ในคลังของเกมนี้'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.slice((qPage - 1) * qItemsPerPage, qPage * qItemsPerPage).map((q) => {
                        const gConfig = MINIGAME_CONFIGS[q.game_id];
                        const isPendingRow = q.status === 'pending_update' || q.status === 'pending_delete';

                        return (
                          <TableRow key={q.id} className={cn("h-9 text-xs transition-colors", isPendingRow ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40")}>
                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">#{q.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold flex items-center gap-1 w-fit bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                <span>{gConfig?.icon || '🎮'}</span>
                                <span>เกม {q.game_id}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isCategoryGame(q.game_id) ? (
                                user?.is_owner ? (
                                  <QuickCategoryEditor
                                    currentCategory={q.category || 'คำทั่วไป'}
                                    categories={categoriesList}
                                    categoryCounts={categoryCounts}
                                    onSave={(newCat) => handleQuickUpdateCategory(q.id, newCat)}
                                  />
                                ) : q.category ? (
                                  <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium">
                                    {q.category}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-semibold text-xs max-w-[180px] truncate" title={q.word_or_question}>
                              {q.word_or_question}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 max-w-[180px] truncate" title={q.answer}>
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
                              ) : (q.game_id === 13) ? (
                                <span className="text-teal-600 dark:text-teal-400 font-medium truncate max-w-[200px]" title={q.hints?.[0] || ''}>
                                  🔤 {q.hints?.[0] || 'เรียงประโยค'}
                                </span>
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

                            {/* Status Badge Cell */}
                            <TableCell>
                              {q.status === 'pending_update' ? (
                                <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-bold whitespace-nowrap">
                                  <Clock className="w-3 h-3 text-amber-500 inline mr-0.5" /> รออนุมัติแก้
                                </Badge>
                              ) : q.status === 'pending_delete' ? (
                                <Badge className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 font-bold whitespace-nowrap">
                                  <Trash2 className="w-3 h-3 text-rose-500 inline mr-0.5" /> รออนุมัติลบ
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-medium whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 inline mr-0.5" /> ใช้งานอยู่
                                </Badge>
                              )}
                            </TableCell>

                            {/* Audit Info Cell */}
                            <TableCell>
                              <div className="text-[11px] leading-tight space-y-1">
                                <div className="flex items-center gap-1 text-foreground font-medium truncate max-w-[130px]" title={`เพิ่มโดย: ${q.created_by_name || 'ระบบ'}`}>
                                  <UserAvatarBadge
                                    userId={q.created_by}
                                    fallbackName={q.created_by_name}
                                    userProfilesMap={userProfilesMap}
                                  />
                                </div>
                                {q.updated_by_name && q.updated_by_name !== q.created_by_name && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[130px]" title={`แก้ไขล่าสุดโดย: ${q.updated_by_name}`}>
                                    <span className="text-[9px] text-muted-foreground/80">แก้:</span>
                                    <UserAvatarBadge
                                      userId={q.updated_by}
                                      fallbackName={q.updated_by_name}
                                      userProfilesMap={userProfilesMap}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Actions Cell */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!user?.is_owner && isPendingRow ? (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 px-1.5 py-0.5 bg-amber-500/10 whitespace-nowrap" title="คำขอของข้อนี้กำลังรอ Owner อนุมัติในหน้า Reports">
                                    รออนุมัติ
                                  </Badge>
                                ) : (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-lg cursor-pointer"
                                      onClick={() => openEditModal(q)}
                                      title={user?.is_owner ? "แก้ไขข้อมูล (สิทธิ์ Owner)" : "ส่งคำขอแก้ไขข้อมูล"}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                      onClick={() => handleDeleteQuestion(q)}
                                      title={user?.is_owner ? "ลบคำศัพท์ (สิทธิ์ Owner)" : "ส่งคำขอลบคำศัพท์"}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
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

        {/* TAB 2: PENDING REQUESTS MANAGER */}
        <TabsContent value="pending" className="space-y-4">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-[#8C6239] dark:text-[#EAD8C8]">
                    คำศัพท์รอดำเนินการ
                  </span>
                  {pendingRequests.length > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0 h-4 min-w-4 rounded-full">
                      {pendingRequests.length}
                    </Badge>
                  )}
                </div>

                {/* Inline Compact Toolbar */}
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end">
                  <div className="relative w-full sm:w-44">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาคำขอ..."
                      value={pendingSearchQuery}
                      onChange={(e) => setPendingSearchQuery(e.target.value)}
                      className="pl-7 pr-6 h-8 text-xs rounded-xl bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]"
                    />
                    {pendingSearchQuery && (
                      <button
                        onClick={() => setPendingSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="w-36 sm:w-44 shrink-0">
                    <Select value={pendingFilterGame} onValueChange={setPendingFilterGame}>
                      <SelectTrigger className="h-8 text-xs rounded-xl bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]">
                        <SelectValue placeholder="มินิเกม" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-xl text-xs">
                        <SelectItem value="all">🎮 ทุกเกม (1-13)</SelectItem>
                        {Object.values(MINIGAME_CONFIGS).map((conf) => (
                          <SelectItem key={conf.id} value={String(conf.id)}>
                            {conf.icon} เกม {conf.id}: {conf.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-xl border-[#EAD8C8] dark:border-[#2D2520] shrink-0"
                    onClick={fetchPendingRequests}
                    disabled={loadingPending}
                    title="รีเฟรชคำขอ"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingPending && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3">
              {(() => {
                const filteredPending = pendingRequests.filter((req) => {
                  if (pendingFilterGame !== 'all' && String(req.game_id) !== pendingFilterGame) return false;
                  if (pendingSearchQuery.trim()) {
                    const kw = pendingSearchQuery.trim().toLowerCase();
                    const qWord = (req.new_data?.word_or_question || req.old_data?.word_or_question || '').toLowerCase();
                    const qAns = (req.new_data?.answer || req.old_data?.answer || '').toLowerCase();
                    const qReqBy = (req.requested_by_name || '').toLowerCase();
                    const qCat = (req.new_data?.category || '').toLowerCase();
                    return qWord.includes(kw) || qAns.includes(kw) || qReqBy.includes(kw) || qCat.includes(kw);
                  }
                  return true;
                });

                if (loadingPending) {
                  return (
                    <div className="py-8 flex flex-col items-center justify-center gap-1.5 text-muted-foreground text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                      <span>กำลังโหลดรายการคำขอที่รอดำเนินการ...</span>
                    </div>
                  );
                }

                if (filteredPending.length === 0) {
                  return (
                    <div className="py-6 px-4 text-center rounded-xl border border-dashed border-[#EAD8C8] dark:border-[#2D2520] bg-[#FAF6F0]/30 dark:bg-[#25201C]/30 space-y-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        {pendingSearchQuery || pendingFilterGame !== 'all'
                          ? 'ไม่พบคำขอที่ตรงกับเงื่อนไข'
                          : 'ไม่มีคำขอรอดำเนินการในขณะนี้ 🎉'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {user?.is_owner
                          ? 'คำขอเพิ่มคำศัพท์ทั้งหมดได้รับการตรวจสอบเรียบร้อยแล้วค่ะ'
                          : 'คำขอของคุณได้รับการอนุมัติทั้งหมดแล้ว หรือยังไม่มีคำขอใหม่'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="rounded-xl border border-[#EAD8C8] dark:border-[#2D2520] overflow-hidden bg-white dark:bg-[#1E1B18] max-h-[380px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-[#FAF6F0] dark:bg-[#25201C] sticky top-0 z-10 shadow-xs">
                        <TableRow className="h-8">
                          <TableHead className="w-24 text-[11px] font-bold">มินิเกม</TableHead>
                          <TableHead className="w-20 text-[11px] font-bold">ประเภท</TableHead>
                          <TableHead className="text-[11px] font-bold">โจทย์ / คำศัพท์</TableHead>
                          <TableHead className="text-[11px] font-bold">คำตอบ / เฉลย</TableHead>
                          <TableHead className="w-28 text-[11px] font-bold">หมวดหมู่</TableHead>
                          <TableHead className="text-[11px] font-bold">รายละเอียด</TableHead>
                          <TableHead className="w-24 text-[11px] font-bold">ผู้ส่งคำขอ</TableHead>
                          <TableHead className="w-24 text-[11px] font-bold">วันที่ส่ง</TableHead>
                          <TableHead className="text-right w-32 text-[11px] font-bold">การจัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPending.map((req) => {
                          const conf = MINIGAME_CONFIGS[req.game_id];
                          const isProcessing = processingPendingId === req.id;
                          const createdDate = new Date(req.created_at).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <TableRow key={req.id} className="h-9 text-xs hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40 transition-colors">
                              <TableCell className="py-1.5">
                                <Badge variant="outline" className="text-[10px] font-semibold flex items-center gap-1 w-fit bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  <span>{conf?.icon || '🎮'}</span>
                                  <span>เกม {req.game_id}</span>
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Badge
                                  className={cn(
                                    "text-[10px] font-bold",
                                    req.action_type === 'create' && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                                    req.action_type === 'update' && "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
                                    req.action_type === 'delete' && "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
                                  )}
                                  variant="outline"
                                >
                                  {req.action_type === 'create' ? '➕ เพิ่ม' : req.action_type === 'update' ? '✏️ แก้' : '🗑️ ลบ'}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1.5 font-semibold text-xs max-w-[160px] truncate" title={req.new_data?.word_or_question || req.old_data?.word_or_question}>
                                {req.new_data?.word_or_question || req.old_data?.word_or_question || '-'}
                              </TableCell>
                              <TableCell className="py-1.5 font-semibold text-xs text-emerald-600 dark:text-emerald-400 max-w-[160px] truncate" title={req.new_data?.answer || req.old_data?.answer}>
                                {req.new_data?.answer || req.old_data?.answer || '-'}
                              </TableCell>
                              <TableCell className="py-1.5">
                                {isCategoryGame(req.game_id) ? (
                                  user?.is_owner ? (
                                    <QuickCategoryEditor
                                      currentCategory={req.new_data?.category || 'คำทั่วไป'}
                                      categories={categoriesList}
                                      categoryCounts={categoryCounts}
                                      onSave={(newCat) => handleUpdatePendingCategory(req.id, newCat)}
                                      disabled={isProcessing}
                                    />
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium">
                                      {req.new_data?.category || 'คำทั่วไป'}
                                    </Badge>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5 text-xs text-muted-foreground max-w-[130px] truncate">
                                {req.new_data?.hints?.length ? (
                                  <span>💡 ใบ้ {req.new_data.hints.length} ข้อ</span>
                                ) : req.new_data?.difficulty ? (
                                  <span>{req.new_data.difficulty === 'easy' ? 'ง่าย' : req.new_data.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}</span>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell className="py-1.5 text-xs font-medium">
                                <UserAvatarBadge
                                  userId={req.requested_by}
                                  fallbackName={req.requested_by_name}
                                  userProfilesMap={userProfilesMap}
                                />
                              </TableCell>
                              <TableCell className="py-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                                {createdDate}
                              </TableCell>
                              <TableCell className="py-1.5 text-right">
                                {user?.is_owner ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      disabled={isProcessing}
                                      onClick={() => handleApprovePendingRequest(req)}
                                      className="h-6 px-2 text-[10px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      อนุมัติ
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isProcessing}
                                      onClick={() => setRejectDialogTarget(req)}
                                      className="h-6 px-1.5 text-[10px] font-bold rounded-md border-rose-500/40 text-rose-600 hover:bg-rose-500/10 gap-0.5 cursor-pointer"
                                    >
                                      <XCircle className="w-2.5 h-2.5" />
                                      ปฏิเสธ
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium gap-1">
                                    <Clock className="w-2.5 h-2.5" /> รอ Owner
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: GAME SETTINGS & CHANNELS */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                ตั้งค่าห้อง Channel ID & แต้มรางวัล (ครบ 13 มินิเกม)
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
                  <SelectItem value="all">🎮 ทุกมินิเกมรวมกัน (13 เกม)</SelectItem>
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
                  {editingQuestion.game_id === 13 && 'ความหมายสำนวน / คำแปลภาษาไทย (โจทย์)'}
                </label>
                <Input
                  className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                />
                {editingQuestion.game_id === 1 && (
                  <Game1LivePreview word={editQuestion} />
                )}
              </div>

              {/* Answer Input or True/False Selector */}
              {[1, 2, 5, 6, 7, 11].includes(editingQuestion.game_id) ? (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>✨ คำตอบจะตรงกับโจทย์อัตโนมัติ</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono">
                    Auto-synced
                  </Badge>
                </div>
              ) : editingQuestion.game_id === 13 ? null : (
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
              )}

              {/* Category (ONLY for games that use category: 1, 2, 6, 7) */}
              {isCategoryGame(editingQuestion.game_id) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">หมวดหมู่ (Category)</label>
                  <CategoryCombobox
                    value={editCategory}
                    onChange={(val) => setEditCategory(val)}
                    categories={categoriesList}
                    categoryCounts={categoryCounts}
                    placeholder="เลือกหรือพิมพ์หมวดหมู่..."
                    className="h-10"
                  />
                </div>
              )}

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

              {/* Dedicated Smart Sentence Builder for Game 13 in Edit Dialog */}
              {editingQuestion.game_id === 13 && (
                <div className="space-y-2 pt-1">
                  <Game13SentenceBuilder
                    template={editHint1}
                    answers={editAnswer}
                    onChange={(newT, newAns) => {
                      setEditHint1(newT);
                      setEditAnswer(newAns);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl text-xs font-bold border-[#EAD8C8] dark:border-[#2D2520]" onClick={() => setEditDialogOpen(false)}>ยกเลิก</Button>
            <Button
              disabled={
                (editingQuestion?.game_id === 1 && !validateAndEvaluateGame1Word(editQuestion).isValid) ||
                (editingQuestion?.game_id === 13 && !!validateGame13Sentence(editHint1, editAnswer))
              }
              className={cn(
                "rounded-xl text-xs font-bold text-white cursor-pointer",
                (editingQuestion?.game_id === 1 && !validateAndEvaluateGame1Word(editQuestion).isValid) ||
                (editingQuestion?.game_id === 13 && !!validateGame13Sentence(editHint1, editAnswer))
                  ? "bg-muted-foreground/50 cursor-not-allowed opacity-60"
                  : "bg-[#8C6239] hover:bg-[#74502D]"
              )}
              onClick={handleUpdateQuestion}
            >
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: SYNC QUESTIONS TO AKARI BOT */}
      <Dialog open={syncAkariOpen} onOpenChange={setSyncAkariOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-[#1A1614] border-[#EAD8C8] dark:border-[#2D2520] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              ซิงค์คลังโจทย์สู่ Akari Bot (Cross-Account Sync)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8C7A6B] dark:text-[#A89A8C]">
              คัดลอกโจทย์ที่อนุมัติแล้วทั้งหมดจาก Bear Cafe (<code>minigame_questions</code>) ไปยังฐานข้อมูลของ Akari Bot (<code>akari_minigame_questions</code>) เพื่อให้ทั้งสองบอทใช้คำถามตรงกัน 100%
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Connection Status Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                    {akariKey ? 'พร้อมซิงค์ข้อมูล (ระบบเชื่อมต่อ Akari สำเร็จ)' : 'ยังไม่มี Key เชื่อมต่อ (โปรดกรอกหรือใส่ใน .env)'}
                  </span>
                  <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400 block truncate max-w-[280px]">
                    เป้าหมาย: {akariUrl}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              >
                {showAdvancedConfig ? 'ซ่อนการตั้งค่า' : 'แก้ไข URL/Key'}
              </Button>
            </div>

            {/* Inputs (only show if key is missing or user explicitly clicked edit) */}
            {(!akariKey || showAdvancedConfig) && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-[#FAF6F0] dark:bg-[#25201C] border border-[#EAD8C8] dark:border-[#2D2520]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">Akari Supabase Project URL</label>
                  <Input
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                    value={akariUrl}
                    onChange={(e) => setAkariUrl(e.target.value)}
                    disabled={isSyncing}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">Akari Supabase Anon Key</label>
                  <Input
                    type="password"
                    placeholder="ใส่ Anon Key ของ Akari"
                    className="h-10 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                    value={akariKey}
                    onChange={(e) => setAkariKey(e.target.value)}
                    disabled={isSyncing}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    * คุณสามารถระบุค่า <code>VITE_AKARI_SUPABASE_ANON_KEY</code> ในไฟล์ <code>.env</code> ของเว็บ เพื่อไม่ต้องกรอกตรงนี้อีกค่ะ
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF6F0] dark:bg-[#25201C] border border-[#EAD8C8] dark:border-[#2D2520]">
              <div>
                <span className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8] block">ล้างโจทย์เก่าใน Akari ก่อนซิงค์ (Full Mirror)</span>
                <span className="text-[11px] text-[#8C7A6B] dark:text-[#A89A8C]">ลบข้อมูลเก่าออกก่อน เพื่อให้โจทย์สองบอทตรงกัน 100%</span>
              </div>
              <Switch checked={syncCleanFirst} onCheckedChange={setSyncCleanFirst} disabled={isSyncing} />
            </div>

            {isSyncing && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                <span>{syncProgress}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-bold border-[#EAD8C8] dark:border-[#2D2520]"
              onClick={() => setSyncAkariOpen(false)}
              disabled={isSyncing}
            >
              ยกเลิก
            </Button>
            <Button
              className="rounded-xl text-xs font-bold bg-[#8C6239] hover:bg-[#74502D] text-white cursor-pointer gap-1.5"
              onClick={handleSyncToAkari}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> กำลังซิงค์...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> เริ่มต้นซิงค์ทันที
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Request Confirmation Dialog */}
      <Dialog open={!!rejectDialogTarget} onOpenChange={(open) => !open && setRejectDialogTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl border-[#EAD8C8] dark:border-[#2D2520] bg-[#FDFBF7] dark:bg-[hsl(var(--card))]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> ยืนยันการปฏิเสธคำขอ
            </DialogTitle>
            <DialogDescription className="text-xs">
              คำขอนี้จะถูกเปลี่ยนสถานะเป็น &ldquo;rejected&rdquo; และจะไม่ถูกนำเข้าสู่คลังคำศัพท์ของบอท
            </DialogDescription>
          </DialogHeader>

          {rejectDialogTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-2xl bg-muted/60 space-y-1">
                <div className="font-semibold text-foreground">
                  เกม {rejectDialogTarget.game_id} ({MINIGAME_CONFIGS[rejectDialogTarget.game_id]?.name || 'มินิเกม'})
                </div>
                <div className="text-muted-foreground truncate">
                  โจทย์: &ldquo;{rejectDialogTarget.new_data?.word_or_question || rejectDialogTarget.old_data?.word_or_question}&rdquo;
                </div>
                {rejectDialogTarget.requested_by_name && (
                  <div className="text-[11px] text-muted-foreground">
                    ส่งโดย: {rejectDialogTarget.requested_by_name}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-xs text-[#8C6239] dark:text-[#EAD8C8]">
                  เหตุผลในการปฏิเสธ (ระบุเพื่อให้ผู้ส่งทราบ):
                </label>
                <Input
                  className="rounded-xl text-xs bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520]"
                  placeholder="เช่น คำตอบไม่ถูกต้อง, ซ้ำซ้อน, คำศัพท์ไม่เหมาะสม..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-bold border-[#EAD8C8] dark:border-[#2D2520]"
              onClick={() => {
                setRejectDialogTarget(null);
                setRejectionReason('');
              }}
            >
              ยกเลิก
            </Button>
            <Button
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              disabled={processingPendingId === rejectDialogTarget?.id}
              onClick={() => {
                if (rejectDialogTarget) {
                  handleRejectPendingRequest(rejectDialogTarget.id, rejectionReason);
                }
              }}
            >
              {processingPendingId === rejectDialogTarget?.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> กำลังปฏิเสธ...
                </>
              ) : (
                'ยืนยันปฏิเสธคำขอ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MinigamesManagement;
