import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Users, Mic, ArrowRight, RefreshCw, ExternalLink,
  CheckCircle2, Gamepad2, Coffee, BookOpen, Moon,
  Flame, Home, Gift, Palette, Users2, ShoppingBag, Sparkles,
  MessageCircle, PartyPopper, Building2, Smile, Sun, Sunset, Clock,
  Bot, Music, ShieldCheck, Target, ChevronLeft, Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VibeServer {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  description: string | null;
  invite_url: string;
  invite_status?: 'valid' | 'expired' | 'unverified';
  member_count: number;
  server_type?: 'community' | 'shop';
  traits?: string[];
  server_profile?: {
    primary_goal?: string;
    atmosphere?: string;
    activities?: string[];
    interests?: string[];
  } | null;
  live_voice_count?: number;
  weekly_join_count?: number;
  bumped_at?: string | null;
  category_id?: string | null;
  is_verified?: boolean;
  is_partner?: boolean;
  highlight_color?: string | null;
}

interface FindYourVibeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: VibeServer[];
  onJoinServer: (server: any) => void;
}

// ── Quiz Steps Configuration (7 มิติ) ──────────────────────────────────────────
export interface QuizOption {
  id: string;
  icon: React.ReactNode | string;
  title?: string;
  label?: string;
  desc?: string;
}

export interface QuizStep {
  step: number;
  title: string;
  subtitle: string;
  type: 'single' | 'multi';
  options: QuizOption[];
}

const QUIZ_STEPS: QuizStep[] = [
  {
    step: 1,
    title: 'คุณกำลังมองหาอะไรใน Discord? 🔎',
    subtitle: 'เลือกสิ่งที่อยากได้จากเซิร์ฟเวอร์ที่กำลังจะเข้า',
    type: 'single',
    options: [
      {
        id: 'gaming',
        icon: <Gamepad2 className="w-5 h-5 text-amber-500" />,
        title: 'หาเพื่อนเล่นเกม',
        desc: 'มีคนเล่นด้วย นัดตี้ หรือคุยระหว่างเล่น',
      },
      {
        id: 'chat',
        icon: <MessageCircle className="w-5 h-5 text-sky-500" />,
        title: 'หาเพื่อนคุย',
        desc: 'พูดคุย ทำความรู้จักคนใหม่ ๆ และหาเพื่อน',
      },
      {
        id: 'creative',
        icon: <Palette className="w-5 h-5 text-rose-500" />,
        title: 'แชร์สิ่งที่ชอบ',
        desc: 'งานวาด เพลง งานอดิเรก หรือผลงานต่าง ๆ',
      },
      {
        id: 'study_work',
        icon: <BookOpen className="w-5 h-5 text-emerald-500" />,
        title: 'เรียน / ทำงาน',
        desc: 'หาเพื่อนโฟกัสงาน อ่านหนังสือ หรือแลกเปลี่ยนความรู้',
      },
      {
        id: 'events',
        icon: <PartyPopper className="w-5 h-5 text-purple-500" />,
        title: 'หากิจกรรมสนุก ๆ',
        desc: 'Event เกม กิจกรรมชุมชน หรือกิจกรรมแจกของ',
      },
      {
        id: 'shop_service',
        icon: <ShoppingBag className="w-5 h-5 text-amber-600" />,
        title: 'หาร้านค้า / บริการ',
        desc: 'ร้านค้า นักวาด Developer หรือบริการต่าง ๆ',
      },
    ],
  },
  {
    step: 2,
    title: 'คุณชอบเซิร์ฟเวอร์ที่มีคนเยอะแค่ไหน? 👥',
    subtitle: 'เลือกขนาดชุมชนที่คุณอยู่แล้วสบายใจที่สุด',
    type: 'single',
    options: [
      {
        id: 'small',
        icon: <Home className="w-5 h-5 text-amber-500" />,
        title: 'เล็ก ๆ แต่สนิทกัน',
        desc: 'คนไม่เยอะ คุยง่าย และมีโอกาสรู้จักกันอย่างทั่วถึง',
      },
      {
        id: 'medium',
        icon: <Users className="w-5 h-5 text-blue-500" />,
        title: 'กำลังดี',
        desc: 'มีคนให้ทำความรู้จักเรื่อย ๆ แต่ไม่รู้สึกวุ่นวาย',
      },
      {
        id: 'large',
        icon: <Building2 className="w-5 h-5 text-purple-500" />,
        title: 'ใหญ่และมีคนตลอด',
        desc: 'สมาชิกเยอะ มีคนใหม่ ๆ และกิจกรรมอยู่เรื่อย ๆ',
      },
      {
        id: 'any',
        icon: <Sparkles className="w-5 h-5 text-primary" />,
        title: 'ไม่สำคัญ',
        desc: 'ขอแค่มีสิ่งที่เราสนใจก็พอ',
      },
    ],
  },
  {
    step: 3,
    title: 'คุณชอบบรรยากาศแบบไหน? ☕',
    subtitle: 'เลือกแบบที่น่าจะทำให้คุณอยู่ในเซิร์ฟเวอร์ได้นาน',
    type: 'single',
    options: [
      {
        id: 'vibrant',
        icon: <Flame className="w-5 h-5 text-orange-500" />,
        title: 'คึกคักสุด ๆ',
        desc: 'มีคนคุย มีคนเข้า Voice และมีกิจกรรมตลอด',
      },
      {
        id: 'moderate',
        icon: <Smile className="w-5 h-5 text-emerald-500" />,
        title: 'มีอะไรให้ทำเรื่อย ๆ',
        desc: 'ไม่ต้องคึกตลอดเวลา แต่ไม่อยากให้เงียบเกินไป',
      },
      {
        id: 'cozy',
        icon: <Coffee className="w-5 h-5 text-amber-600" />,
        title: 'ชิล ๆ สบาย ๆ',
        desc: 'เงียบได้ ไม่ต้องมีกิจกรรมตลอดเวลา นั่งฟังเพลงชิลล์ๆ',
      },
      {
        id: 'any',
        icon: <Sparkles className="w-5 h-5 text-primary" />,
        title: 'ขอแค่เจอคนที่เข้ากันได้',
        desc: 'จำนวนคนหรือความคึกคักไม่ใช่เรื่องสำคัญ',
      },
    ],
  },
  {
    step: 4,
    title: 'ปกติคุณเล่น Discord ช่วงไหน? 🕐',
    subtitle: 'เพื่อแนะนำกลุ่มคนที่ออนไลน์ตรงกับเวลาของคุณ',
    type: 'single',
    options: [
      {
        id: 'day',
        icon: <Sun className="w-5 h-5 text-amber-500" />,
        title: 'กลางวัน',
        desc: '08:00 – 17:00 น.',
      },
      {
        id: 'evening',
        icon: <Sunset className="w-5 h-5 text-orange-500" />,
        title: 'ช่วงเย็น',
        desc: '17:00 – 22:00 น.',
      },
      {
        id: 'night',
        icon: <Moon className="w-5 h-5 text-indigo-400" />,
        title: 'กลางคืน',
        desc: '22:00 – 02:00 น.',
      },
      {
        id: 'late_night',
        icon: <Compass className="w-5 h-5 text-purple-400" />,
        title: 'ดึกมาก',
        desc: '02:00 น. เป็นต้นไป',
      },
      {
        id: 'any',
        icon: <Clock className="w-5 h-5 text-primary" />,
        title: 'เข้าได้ทุกเวลา',
        desc: 'เวลาออนไลน์ไม่แน่นอน สะดวกแวะมาเรื่อย ๆ',
      },
    ],
  },
  {
    step: 5,
    title: 'ถ้าเข้าเซิร์ฟเวอร์แล้ว คุณอยากทำอะไร? 🎪',
    subtitle: 'เลือกกิจกรรมที่คุณสนใจ (เลือกได้หลายข้อ)',
    type: 'multi',
    options: [
      { id: 'act_game', icon: <Gamepad2 className="w-4 h-4 text-amber-500" />, label: 'เล่นเกมกับคนอื่น' },
      { id: 'act_voice', icon: <Mic className="w-4 h-4 text-emerald-500" />, label: 'คุยไมค์ / เข้าห้องเสียง' },
      { id: 'act_chat', icon: <MessageCircle className="w-4 h-4 text-sky-500" />, label: 'พิมพ์แชทคุยกัน' },
      { id: 'act_music', icon: <Music className="w-4 h-4 text-pink-500" />, label: 'ฟังเพลง' },
      { id: 'act_art', icon: <Palette className="w-4 h-4 text-rose-500" />, label: 'แชร์ผลงาน / งานอดิเรก' },
      { id: 'act_event', icon: <PartyPopper className="w-4 h-4 text-purple-500" />, label: 'ร่วมกิจกรรม / Event' },
      { id: 'act_bot', icon: <Bot className="w-4 h-4 text-cyan-500" />, label: 'เล่นบอท / Mini Game' },
      { id: 'act_study', icon: <BookOpen className="w-4 h-4 text-indigo-500" />, label: 'เรียนรู้ / แลกเปลี่ยนความรู้' },
      { id: 'act_shop', icon: <ShoppingBag className="w-4 h-4 text-amber-600" />, label: 'ซื้อขาย / ใช้บริการ' },
    ],
  },
  {
    step: 6,
    title: 'มีเรื่องอะไรที่คุณสนใจเป็นพิเศษ? ✨',
    subtitle: 'หัวข้อที่คุณชอบคุยหรือสนใจ (เลือกได้หลายข้อ)',
    type: 'multi',
    options: [
      { id: 'int_game', icon: '🎮', label: 'เกม' },
      { id: 'int_anime', icon: '🎌', label: 'อนิเมะ / มังงะ' },
      { id: 'int_movie', icon: '🎬', label: 'หนัง / ซีรีส์' },
      { id: 'int_music', icon: '🎵', label: 'เพลง' },
      { id: 'int_art', icon: '🎨', label: 'ศิลปะ / วาดรูป' },
      { id: 'int_tech', icon: '💻', label: 'เทคโนโลยี / Dev' },
      { id: 'int_creator', icon: '📷', label: 'ถ่ายรูป / Creator' },
      { id: 'int_study', icon: '📚', label: 'การเรียน / ความรู้' },
      { id: 'int_general', icon: '💬', label: 'พูดคุยเรื่องทั่วไป' },
      { id: 'int_lifestyle', icon: '🧸', label: 'งานอดิเรก / ไลฟ์สไตล์' },
      { id: 'int_none', icon: '✨', label: 'ยังไม่มีเป็นพิเศษ' },
    ],
  },
  {
    step: 7,
    title: 'สิ่งไหนสำคัญที่สุดสำหรับคุณเวลาเลือกเซิร์ฟเวอร์? 🎯',
    subtitle: 'ปัจจัยอันดับ 1 ที่ทำให้คุณอยากอยู่ต่อยาว ๆ (เลือก 1 ข้อ)',
    type: 'single',
    options: [
      {
        id: 'pri_people',
        icon: <Users2 className="w-5 h-5 text-blue-500" />,
        title: 'มีคนที่คุยด้วยได้',
        desc: 'เน้นมิตรภาพและการต้อนรับที่ดี เข้าถึงง่าย',
      },
      {
        id: 'pri_active',
        icon: <Flame className="w-5 h-5 text-orange-500" />,
        title: 'มีคนออนไลน์และกิจกรรมอยู่เสมอ',
        desc: 'ห้องเสียงไม่ร้าง มีความเคลื่อนไหวตลอดเวลา',
      },
      {
        id: 'pri_interests',
        icon: <Target className="w-5 h-5 text-rose-500" />,
        title: 'ตรงกับสิ่งที่ฉันสนใจ',
        desc: 'สมาชิกชอบเรื่องเดียวกัน เล่นเกมหรือพูดคุยเรื่องเดียวกัน',
      },
      {
        id: 'pri_cozy',
        icon: <Coffee className="w-5 h-5 text-amber-500" />,
        title: 'บรรยากาศเป็นกันเอง',
        desc: 'ไม่ท็อกซิก สบายใจ ไม่กดดัน เป็นพื้นที่พักผ่อน',
      },
      {
        id: 'pri_moderation',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
        title: 'มีกฎชัดเจนและดูแลสมาชิกดี',
        desc: 'ปลอดภัย มีทีมงานคอยช่วยเหลือและดูแลความเรียบร้อย',
      },
      {
        id: 'pri_novelty',
        icon: <Sparkles className="w-5 h-5 text-purple-500" />,
        title: 'มีอะไรใหม่ ๆ ให้ค้นหาอยู่เสมอ',
        desc: 'กิจกรรม บอทสนุกๆ และคอนเทนต์น่าติดตาม',
      },
    ],
  },
];

// ── Server Metadata Profiler ──────────────────────────────────────────────────
interface DerivedServerProfile {
  sizeCategory: 'small' | 'medium' | 'large';
  activityLevel: 'vibrant' | 'moderate' | 'cozy';
  supportedActivities: Set<string>;
  interestKeywords: Set<string>;
  activeHours: Set<string>;
}

function deriveServerProfile(server: VibeServer): DerivedServerProfile {
  const count = server.member_count || 0;
  const traits = server.traits || [];
  const textContent = `${server.name} ${server.description || ''}`.toLowerCase();
  const profile = server.server_profile || {};

  // 1. Size
  let sizeCategory: 'small' | 'medium' | 'large' = 'medium';
  if (count < 150) sizeCategory = 'small';
  else if (count > 1500) sizeCategory = 'large';

  // 2. Activity Level
  let activityLevel: 'vibrant' | 'moderate' | 'cozy' = 'moderate';
  if (profile.atmosphere === 'vibe_vibrant' || traits.includes('active-chat')) {
    activityLevel = 'vibrant';
  } else if (profile.atmosphere === 'vibe_chill' || traits.includes('chill-chat') || traits.includes('safe-haven')) {
    activityLevel = 'cozy';
  } else if ((server.live_voice_count || 0) > 0 || (server.weekly_join_count || 0) > 10 || traits.includes('voice-active')) {
    activityLevel = 'vibrant';
  } else if (traits.includes('study') || count < 100) {
    activityLevel = 'cozy';
  }

  // 3. Supported Activities
  const supportedActivities = new Set<string>();
  if (profile.primary_goal === 'goal_friends_game' || traits.includes('gaming') || textContent.includes('game') || textContent.includes('เกม') || textContent.includes('roblox') || textContent.includes('valorant')) {
    supportedActivities.add('act_game');
  }
  if (traits.includes('voice-active') || (server.live_voice_count || 0) > 0 || textContent.includes('ไมค์') || textContent.includes('voice')) {
    supportedActivities.add('act_voice');
  }
  if (profile.primary_goal === 'goal_friends_talk' || traits.includes('chill-chat') || traits.includes('text-focused') || traits.includes('active-chat') || textContent.includes('คุย') || textContent.includes('แชท') || server.server_type === 'community') {
    supportedActivities.add('act_chat');
  }
  if (traits.includes('music') || textContent.includes('เพลง') || textContent.includes('music') || textContent.includes('ดนตรี')) {
    supportedActivities.add('act_music');
  }
  if (traits.includes('movie-stream') || textContent.includes('หนัง') || textContent.includes('สตรีม') || textContent.includes('stream')) {
    supportedActivities.add('act_event');
  }
  if (traits.includes('creators') || textContent.includes('วาด') || textContent.includes('art') || textContent.includes('รูป')) {
    supportedActivities.add('act_art');
  }
  if (traits.includes('giveaways') || textContent.includes('แจก') || textContent.includes('event') || textContent.includes('กิจกรรม')) {
    supportedActivities.add('act_event');
  }
  if (traits.includes('tech-dev') || textContent.includes('บอท') || textContent.includes('bot') || textContent.includes('มินิเกม')) {
    supportedActivities.add('act_bot');
  }
  if (traits.includes('study') || traits.includes('working-adults') || textContent.includes('เรียน') || textContent.includes('งาน') || textContent.includes('study')) {
    supportedActivities.add('act_study');
  }
  if (server.server_type === 'shop' || traits.includes('shop-service') || textContent.includes('ร้าน') || textContent.includes('ขาย') || textContent.includes('shop')) {
    supportedActivities.add('act_shop');
  }

  // 4. Interest Keywords
  const interestKeywords = new Set<string>();
  if (supportedActivities.has('act_game')) interestKeywords.add('int_game');
  if (traits.includes('anime') || textContent.includes('อนิเมะ') || textContent.includes('anime') || textContent.includes('มังงะ') || textContent.includes('vtuber')) interestKeywords.add('int_anime');
  if (traits.includes('movie-stream') || textContent.includes('หนัง') || textContent.includes('ซีรีส์') || textContent.includes('movie') || textContent.includes('series')) interestKeywords.add('int_movie');
  if (supportedActivities.has('act_music')) interestKeywords.add('int_music');
  if (supportedActivities.has('act_art')) interestKeywords.add('int_art');
  if (traits.includes('tech-dev') || textContent.includes('dev') || textContent.includes('code') || textContent.includes('tech') || textContent.includes('โปรแกรม')) interestKeywords.add('int_tech');
  if (traits.includes('creators') || textContent.includes('creator')) interestKeywords.add('int_creator');
  if (supportedActivities.has('act_study')) interestKeywords.add('int_study');
  if (supportedActivities.has('act_chat')) interestKeywords.add('int_general');
  if (traits.includes('chill-chat') || traits.includes('night-owls') || traits.includes('safe-haven')) interestKeywords.add('int_lifestyle');

  // 5. Active Hours
  const activeHours = new Set<string>();
  if (profile.atmosphere === 'vibe_night_owl' || traits.includes('night-owls') || textContent.includes('ดึก') || textContent.includes('กลางคืน')) {
    activeHours.add('night');
    activeHours.add('late_night');
  }
  activeHours.add('day');
  activeHours.add('evening');

  return { sizeCategory, activityLevel, supportedActivities, interestKeywords, activeHours };
}

// ── Animation Variants ────────────────────────────────────────────────────────
const stepVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

// ── Main Component ────────────────────────────────────────────────────────────
export function FindYourVibeDialog({
  open,
  onOpenChange,
  servers,
  onJoinServer,
}: FindYourVibeDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({
    step1: null,
    step2: null,
    step3: null,
    step4: null,
    step5: [],
    step6: [],
    step7: null,
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsNavigating(false);
    setBrokenIcons({});
    setAnswers({
      step1: null,
      step2: null,
      step3: null,
      step4: null,
      step5: [],
      step6: [],
      step7: null,
    });
    setCurrentStep(1);
  };

  // Single Select handler with 280ms auto-advance feedback
  const handleSingleSelect = (step: number, optionId: string) => {
    if (isNavigating) return;
    setAnswers((prev) => ({ ...prev, [`step${step}`]: optionId }));
    setIsNavigating(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsNavigating(false);
      if (step < 7) {
        setCurrentStep(step + 1);
      } else {
        setCurrentStep(8); // View Results
      }
    }, 280);
  };

  const handleBack = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsNavigating(false);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Multi Select Toggle handler
  const handleMultiToggle = (step: number, optionId: string) => {
    const key = `step${step}`;
    const currentList: string[] = answers[key] || [];

    // Special case for 'int_none'
    if (optionId === 'int_none') {
      setAnswers((prev) => ({
        ...prev,
        [key]: currentList.includes('int_none') ? [] : ['int_none'],
      }));
      return;
    }

    const filtered = currentList.filter((id) => id !== 'int_none');
    if (filtered.includes(optionId)) {
      setAnswers((prev) => ({
        ...prev,
        [key]: filtered.filter((id) => id !== optionId),
      }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        [key]: [...filtered, optionId],
      }));
    }
  };

  // ── Matching Engine ──────────────────────────────────────────────────────────
  const matches = useMemo(() => {
    if (currentStep !== 8) return [];

    const scored = servers
      .filter((s) => s.invite_status !== 'expired')
      .map((server) => {
        const profile = deriveServerProfile(server);
        let score = 42; // Base Score
        const matchReasons: string[] = [];

        // 1. Goal Match (Step 1)
        const serverProfile = server.server_profile || {};
        if (answers.step1 === 'gaming' && (serverProfile.primary_goal === 'goal_friends_game' || profile.supportedActivities.has('act_game'))) {
          score += serverProfile.primary_goal === 'goal_friends_game' ? 18 : 15;
          matchReasons.push(serverProfile.primary_goal === 'goal_friends_game' ? '🎯 เจ้าของระบุ: เน้นตี้เกมโดยตรง' : '🎮 สายเกมมิ่งตรงใจ');
        } else if (answers.step1 === 'chat' && (serverProfile.primary_goal === 'goal_friends_talk' || profile.supportedActivities.has('act_chat'))) {
          score += serverProfile.primary_goal === 'goal_friends_talk' ? 18 : 15;
          matchReasons.push(serverProfile.primary_goal === 'goal_friends_talk' ? '🎯 เจ้าของระบุ: เน้นหาเพื่อนคุย' : '💬 สังคมเพื่อนคุยเป็นมิตร');
        } else if (answers.step1 === 'creative' && (serverProfile.primary_goal === 'goal_cozy' || profile.supportedActivities.has('act_art'))) {
          score += 15;
          matchReasons.push('🎨 พื้นที่แชร์ผลงานสร้างสรรค์');
        } else if (answers.step1 === 'study_work' && profile.supportedActivities.has('act_study')) {
          score += 15;
          matchReasons.push('📚 สังคมคนเรียนและทำงาน');
        } else if (answers.step1 === 'events' && (serverProfile.primary_goal === 'goal_explore' || profile.supportedActivities.has('act_event'))) {
          score += 15;
          matchReasons.push('🎁 มีกิจกรรมและแจกของบ่อย');
        } else if (answers.step1 === 'shop_service') {
          if (server.server_type === 'shop' || profile.supportedActivities.has('act_shop')) {
            score += 24;
            matchReasons.push('🛍️ ร้านค้าและบริการที่คุณมองหา');
          } else {
            score -= 20;
          }
        }

        // 2. Community Size Match (Step 2)
        if (answers.step2 === 'small') {
          if (profile.sizeCategory === 'small') {
            score += 12;
            matchReasons.push('🏡 ขนาดเล็กอบอุ่นตามที่ชอบ');
          } else if (profile.sizeCategory === 'medium') {
            score += 6;
          }
        } else if (answers.step2 === 'medium') {
          if (profile.sizeCategory === 'medium') {
            score += 12;
            matchReasons.push('🌿 ขนาดกำลังดี ไม่วุ่นวาย');
          } else {
            score += 6;
          }
        } else if (answers.step2 === 'large') {
          if (profile.sizeCategory === 'large') {
            score += 12;
            matchReasons.push('🏙️ ชุมชนใหญ่ คึกคักตลอด');
          } else if (profile.sizeCategory === 'medium') {
            score += 6;
          }
        } else {
          score += 10;
        }

        // 3. Atmosphere Match (Step 3)
        if (answers.step3 === 'vibrant') {
          if (serverProfile.atmosphere === 'vibe_vibrant' || profile.activityLevel === 'vibrant') {
            score += serverProfile.atmosphere === 'vibe_vibrant' ? 16 : 12;
            matchReasons.push(serverProfile.atmosphere === 'vibe_vibrant' ? '🔥 บรรยากาศคึกคักตรงตามที่เจ้าของระบุ' : '🔥 บรรยากาศคึกคัก มีคนคุยไมค์');
          } else {
            score += 6;
          }
        } else if (answers.step3 === 'cozy') {
          if (serverProfile.atmosphere === 'vibe_chill' || profile.activityLevel === 'cozy' || server.traits?.includes('chill-chat')) {
            score += serverProfile.atmosphere === 'vibe_chill' ? 16 : 12;
            matchReasons.push('☕ บรรยากาศชิลล์ สบายใจ');
          } else {
            score += 6;
          }
        } else {
          score += 10;
        }

        // 4. Online Time Match (Step 4)
        if (answers.step4 === 'night' || answers.step4 === 'late_night') {
          if (server.traits?.includes('night-owls') || profile.activeHours.has('night')) {
            score += 8;
            matchReasons.push('🌙 มีเพื่อนคุยช่วงดึกตรงกับเวลาเล่น');
          } else {
            score += 4;
          }
        } else {
          score += 8;
        }

        // 5. Activities Overlap (Step 5 - Multi)
        const userActivities: string[] = answers.step5 || [];
        if (userActivities.length > 0) {
          let matchedCount = 0;
          userActivities.forEach((act) => {
            if (profile.supportedActivities.has(act)) matchedCount++;
          });
          const ratio = matchedCount / userActivities.length;
          score += Math.min(Math.round(ratio * 16), 16);
          if (matchedCount > 0 && matchReasons.length < 3) {
            matchReasons.push(`✨ ตรงกับกิจกรรมที่คุณอยากทำ`);
          }
        }

        // 6. Interests Overlap (Step 6 - Multi)
        const userInterests: string[] = answers.step6 || [];
        if (userInterests.length > 0 && !userInterests.includes('int_none')) {
          let matchedInts = 0;
          userInterests.forEach((intId) => {
            if (profile.interestKeywords.has(intId)) matchedInts++;
          });
          const ratio = matchedInts / userInterests.length;
          score += Math.min(Math.round(ratio * 16), 16);
          if (matchedInts > 0 && matchReasons.length < 3) {
            matchReasons.push(`🎯 มีความสนใจในเรื่องเดียวกัน`);
          }
        }

        // 7. Core Priority Boost (Step 7 - Priority Multiplier)
        if (answers.step7 === 'pri_active') {
          if ((server.live_voice_count || 0) > 0 || profile.activityLevel === 'vibrant') {
            score += 12;
            matchReasons.unshift('⚡ คึกคักตรงใจอันดับ 1');
          }
        } else if (answers.step7 === 'pri_cozy') {
          if (profile.sizeCategory === 'small' || server.traits?.includes('chill-chat')) {
            score += 12;
            matchReasons.unshift('🏡 อบอุ่นเป็นกันเองตามที่ให้ความสำคัญ');
          }
        } else if (answers.step7 === 'pri_moderation') {
          if (server.is_verified || server.is_partner) {
            score += 12;
            matchReasons.unshift('🛡️ ผ่านการตรวจสอบและดูแลดี');
          }
        } else if (answers.step7 === 'pri_interests') {
          score += 8;
        }

        // Freshness bump boost
        if (server.bumped_at) {
          const hoursOld = (Date.now() - new Date(server.bumped_at).getTime()) / 3600000;
          if (hoursOld <= 24) score += 4;
        }

        // Bound normalized score between 70% and 99%
        const normalizedScore = Math.min(Math.max(score, 70), 99);

        return {
          server,
          score: normalizedScore,
          matchReasons: Array.from(new Set(matchReasons)).slice(0, 3),
        };
      });

    // Sort by highest score, then member count
    scored.sort((a, b) => b.score - a.score || (b.server.member_count || 0) - (a.server.member_count || 0));

    return scored.slice(0, 3);
  }, [currentStep, answers, servers]);

  const activeStepConfig = currentStep <= 7 ? QUIZ_STEPS[currentStep - 1] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) {
          setTimeout(handleReset, 300);
        }
      }}
    >
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-border/60 dark:border-[#2A221E] shadow-2xl bg-card dark:bg-[#151210] max-h-[92vh] flex flex-col">
        {/* Header with Step indicator */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/40 dark:border-[#2A221E] bg-muted/20 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>หาเซิร์ฟเวอร์ที่ใช่</span>
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">(Find Your Vibe)</span>
              </DialogTitle>
            </div>
            {currentStep <= 7 && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                ข้อ {currentStep} / 7
              </span>
            )}
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {currentStep <= 7
              ? 'ตอบคำถามสั้น ๆ เพื่อให้เราค้นหาเซิร์ฟเวอร์ที่เข้ากับไลฟ์สไตล์คุณที่สุด'
              : 'ผลลัพธ์การจับคู่จากความชอบและสไตล์ของคุณ'}
          </DialogDescription>

          {/* Progress Dots */}
          {currentStep <= 7 && (
            <div className="flex items-center gap-1.5 mt-3.5">
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    currentStep === s
                      ? 'w-7 bg-primary'
                      : currentStep > s
                      ? 'w-2.5 bg-primary/60'
                      : 'w-2 bg-muted/60'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
          <AnimatePresence mode="wait">
            {currentStep <= 7 && activeStepConfig ? (
              <motion.div
                key={currentStep}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-4"
              >
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <span>{activeStepConfig.title}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {activeStepConfig.subtitle}
                  </p>
                </div>

                {/* Single Select Options Layout */}
                {activeStepConfig.type === 'single' && (
                  <div className="grid grid-cols-1 gap-2.5 pt-1">
                    {activeStepConfig.options.map((opt) => {
                      const isSelected = answers[`step${currentStep}`] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isNavigating}
                          onClick={() => handleSingleSelect(currentStep, opt.id)}
                          className={cn(
                            'flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 group relative',
                            isSelected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs'
                              : 'border-border/60 dark:border-[#2A221E] bg-card/60 dark:bg-[#181412] hover:border-primary/40 hover:bg-primary/5',
                            isNavigating && !isSelected && 'opacity-50 pointer-events-none'
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl bg-background/80 dark:bg-card flex items-center justify-center shrink-0 border border-border/40 shadow-2xs group-hover:scale-105 transition-transform">
                            {opt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-sm font-semibold transition-colors',
                              isSelected ? 'text-primary font-bold' : 'text-foreground group-hover:text-primary'
                            )}>
                              {opt.title}
                            </p>
                            {opt.desc && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {opt.desc}
                              </p>
                            )}
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-primary animate-in zoom-in-75 duration-150 shrink-0" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Multi Select Options Layout (Grid Chips / Cards) */}
                {activeStepConfig.type === 'multi' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeStepConfig.options.map((opt) => {
                        const currentList: string[] = answers[`step${currentStep}`] || [];
                        const isSelected = currentList.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleMultiToggle(currentStep, opt.id)}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-200',
                              isSelected
                                ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/40 shadow-xs'
                                : 'border-border/60 dark:border-[#2A221E] bg-card/60 dark:bg-[#181412] hover:border-primary/30 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="w-8 h-8 rounded-xl bg-background/80 dark:bg-card flex items-center justify-center shrink-0 border border-border/40 text-base">
                              {opt.icon}
                            </div>
                            <span className="text-xs sm:text-sm font-medium flex-1 truncate">
                              {opt.label}
                            </span>
                            <div
                              className={cn(
                                'w-4 h-4 rounded-md border flex items-center justify-center transition-colors',
                                isSelected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-border/80'
                              )}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Button for Multi-select */}
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9 shadow-md shadow-primary/20 text-xs sm:text-sm gap-1.5"
                      >
                        <span>ถัดไป</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Back Button */}
                {currentStep > 1 && (
                  <div className="pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      className="text-xs text-muted-foreground hover:text-foreground rounded-full gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>ย้อนกลับ</span>
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Step 8: Results Showcase */
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="text-center space-y-1 pt-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    วิเคราะห์และจับคู่สำเร็จแล้ว
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    เซิร์ฟเวอร์ที่ตรงกับไลฟ์สไตล์ของคุณ 🎯
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ประมวลผลจากเป้าหมาย ขนาด บรรยากาศ และกิจกรรมที่คุณให้ความสำคัญ
                  </p>
                </div>

                {matches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground space-y-2">
                    <p className="text-sm">ยังไม่พบเซิร์ฟเวอร์ที่ตรงกับเงื่อนไขพอดี</p>
                    <Button variant="outline" size="sm" onClick={handleReset} className="rounded-full text-xs">
                      ลองค้นหาใหม่อีกครั้ง
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matches.map(({ server, score, matchReasons }, idx) => {
                      const medal =
                        idx === 0
                          ? '🥇 Best Match'
                          : idx === 1
                          ? '🥈 Great Match'
                          : '🥉 Good Match';
                      const badgeColor =
                        idx === 0
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : idx === 1
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                          : 'bg-muted/40 text-muted-foreground border-border/40';

                      return (
                        <div
                          key={server.id}
                          className="p-4 rounded-2xl border border-border/60 dark:border-[#2A221E] bg-card/80 dark:bg-[#181412] space-y-3 hover:border-primary/40 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {server.icon_url && !brokenIcons[server.id] ? (
                                <img
                                  src={server.icon_url}
                                  alt={server.name}
                                  className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-border/40 shadow-xs"
                                  onError={() => setBrokenIcons((prev) => ({ ...prev, [server.id]: true }))}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center font-bold text-primary shrink-0 text-base shadow-2xs">
                                  {server.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm sm:text-base text-foreground truncate">
                                    {server.name}
                                  </span>
                                  {server.server_type === 'shop' && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                      🛒 ร้านค้า
                                    </span>
                                  )}
                                  {server.is_partner && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-600/90 text-white">
                                      Partner
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1 font-semibold text-foreground/80">
                                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    {(server.member_count || 0).toLocaleString()} สมาชิก
                                  </span>
                                  {(server.live_voice_count || 0) > 0 && (
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                      <Mic className="w-3.5 h-3.5" />
                                      {server.live_voice_count} ในห้องเสียง
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                              <span
                                className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                  badgeColor
                                )}
                              >
                                {medal}
                              </span>
                              <span className="text-xs font-mono font-black text-primary mt-1">
                                {score}% Match
                              </span>
                            </div>
                          </div>

                          {/* Match explanation tags */}
                          {matchReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {matchReasons.map((reason, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Join button */}
                          <div className="pt-1 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => onJoinServer(server)}
                              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 h-8 px-4 shadow-sm shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <span>เข้าดิสคอร์ด</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ทำแบบทดสอบใหม่</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full text-xs"
                  >
                    ปิดหน้าต่าง
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}