import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichSelect, type RichSelectItem } from '@/components/ui/rich-select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProgressIndicator } from '@/components/ui/progress-indicator';
import { TaskSteps, type TaskStepItem } from '@/components/ui/task-steps';
import { OrderTrackingParallaxCard } from '@/components/ui/order-tracking-parallax-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  Send, Users, Mail, AlertCircle, Play, Square, RefreshCw, XCircle, 
  CheckCircle, Shield, FileText, ChevronDown, ChevronUp,
  Search, Eye, Trash2, ChevronLeft, ChevronRight, Activity, Database, Sparkles,
  Code, Copy, Clock, Timer, Radio, Zap, Terminal, Check, Pause, CheckCircle2,
  Info, Filter, ArrowRight, ExternalLink
} from 'lucide-react';

interface CampaignQueue {
  id: string;
  title: string;
  message_payload: any;
  target_type: string;
  target_value: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'paused';
  token_type: 'token1' | 'token2';
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

interface CampaignLog {
  id: string;
  user_id: string;
  username: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  sent_at: string | null;
}

interface SystemLog {
  id: number;
  queue_id: string | null;
  level: string;
  message_th: string;
  created_at: string;
}

interface MemberSub {
  userId: string;
  username: string | null;
  discordUsername: string | null;
  options: string[];
  updatedAt: string;
}

interface DiscordPreviewProps {
  inputMode: 'text' | 'json';
  textContent: string;
  jsonContent: string;
}

const TARGET_TYPE_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'target-option',
    label: 'แยกตามหมวดหมู่ข่าวสาร',
    value: 'option',
    description: 'ส่ง DM ถึงเฉพาะสมาชิกที่เลือกกดรับข่าวสารในหมวดหมู่นี้',
    icon: '🏷️',
    badge: 'ตามหมวดหมู่',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'target-all',
    label: 'สมาชิกทุกคนในเซิร์ฟเวอร์',
    value: 'all',
    description: 'บรอดแคสต์ส่ง DM กระจายไปยังสมาชิกทุกคนในเซิร์ฟเวอร์ Discord',
    icon: '👥',
    badge: 'ทุกคน',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  },
  {
    id: 'target-test',
    label: 'ทดสอบเฉพาะบุคคล (ป้อน ID)',
    value: 'test',
    description: 'ทดสอบส่งเฉพาะ Discord User ID ที่ระบุ สำหรับตรวจสอบความเรียบร้อย',
    icon: '🧪',
    badge: 'ทดสอบระบบ',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  },
];

const TARGET_OPTION_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'opt-events',
    label: 'กิจกรรม (Events)',
    value: '49B40A9yBS',
    description: 'สมาชิกที่กดรับแจ้งเตือนเกี่ยวกับกิจกรรม คอนเทสต์ และอีเวนต์ของคาเฟ่',
    icon: '🎉',
    badge: 'กิจกรรม',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
  {
    id: 'opt-announce',
    label: 'ประกาศสำคัญ (Announcements)',
    value: 'JNySCX80ja',
    description: 'ประกาศสำคัญจากทีมงาน การปรับปรุงระบบ และกฎระเบียบเซิร์ฟเวอร์',
    icon: '📢',
    badge: 'ประกาศ',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'opt-general',
    label: 'ข่าวสารทั่วไป (General News)',
    value: 'DsMHlVrjze',
    description: 'ข่าวสาร พูดคุย อัปเดตทั่วไป และสาระน่ารู้ประจำวัน',
    icon: '📑',
    badge: 'ทั่วไป',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  },
  {
    id: 'opt-promo',
    label: 'โปรโมชันและโฆษณา (Promotions)',
    value: '6io1xnaMWJ',
    description: 'สิทธิพิเศษ ดีลส่วนลด บริการ และโปรโมชันร้านค้า',
    icon: '🎁',
    badge: 'โปรโมชัน',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
];

const TOKEN_TYPE_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'token-1',
    label: 'Token 1 (บอทหลัก)',
    value: 'token1',
    description: 'Discord Bot ตัวหลักของ Bear Cafe สำหรับส่งข้อความทั่วไป',
    icon: '🤖',
    badge: 'บอทหลัก',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  {
    id: 'token-2',
    label: 'Token 2 (บอทสำรอง)',
    value: 'token2',
    description: 'Discord Bot ตัวสำรอง ช่วยกระจายโควตาและลดอัตรา Rate Limit',
    icon: '🧸',
    badge: 'บอทสำรอง',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
  },
];

const SAFETY_MODE_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'mode-safe',
    label: 'Safe Mode (ปลอดภัยสูงสุด)',
    value: 'safe',
    description: 'สุ่มหน่วง 15-35 วิ/ข้อความ • ปลอดภัยสูงสุด ป้องกันข้อความถูกระงับ โควตา 50 ข้อความ/ชม.',
    icon: '🛡️',
    badge: 'ปลอดภัยสูงสุด',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  {
    id: 'mode-balanced',
    label: 'Balanced Mode (สมดุลความเร็ว)',
    value: 'balanced',
    description: 'สุ่มหน่วง 5-15 วิ/ข้อความ • ทำงานรวดเร็วปานกลาง โควตา 100 ข้อความ/ชม.',
    icon: '⚡',
    badge: 'สมดุลความเร็ว',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
];

const FILTER_OPTION_RICH_OPTIONS: RichSelectItem[] = [
  {
    id: 'filter-all',
    label: 'ทั้งหมด',
    value: 'all',
    description: 'แสดงสมาชิกทุกคนที่รับการบรอดแคสต์',
    icon: '📋',
    badge: 'ทั้งหมด',
  },
  ...TARGET_OPTION_RICH_OPTIONS,
];

function getFormattedJson(payload: any): string {
  if (!payload) return '{}';
  try {
    let parsed = payload;
    if (typeof payload === 'string') {
      parsed = JSON.parse(payload);
    }
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  }
}

interface DiscordPreviewProps {
  inputMode: 'text' | 'json';
  textContent: string;
  jsonContent: string;
  targetType?: string;
  safetyMode?: string;
  estimatedTargets?: number;
}

function DiscordPreview({ inputMode, textContent, jsonContent, targetType, safetyMode, estimatedTargets = 0 }: DiscordPreviewProps) {
  let content = '';
  let mediaUrl: string | null = null;
  let textBlocks: string[] = [];
  let selectMenuOptions: any[] = [];
  let selectPlaceholder = '🐻︲เลือกการแจ้งเตือนที่ต้องการ';
  let parseError: string | null = null;

  const payloadSize = useMemo(() => {
    const raw = inputMode === 'text' ? textContent : jsonContent;
    return new Blob([raw || '']).size;
  }, [inputMode, textContent, jsonContent]);

  if (inputMode === 'text') {
    content = textContent;
  } else {
    try {
      if (jsonContent && (typeof jsonContent === 'string' ? jsonContent.trim() : jsonContent)) {
        const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
        if (parsed.content) content = parsed.content;

        const data = parsed.data || parsed;
        if (data.components) {
          data.components.forEach((row: any) => {
            if (row.type === 1) {
              row.components?.forEach((comp: any) => {
                if (comp.type === 3) {
                  selectMenuOptions = comp.options || [];
                  if (comp.placeholder) selectPlaceholder = comp.placeholder;
                }
              });
            } else if (row.type === 17) {
              row.components?.forEach((child: any) => {
                if (child.type === 12 && child.items) {
                  const mediaItem = child.items[0]?.media;
                  if (mediaItem?.url) {
                    mediaUrl = mediaItem.url;
                  }
                } else if (child.type === 10 && child.content) {
                  textBlocks.push(child.content);
                } else if (child.type === 1) {
                  child.components?.forEach((comp: any) => {
                    if (comp.type === 3) {
                      selectMenuOptions = comp.options || [];
                      if (comp.placeholder) selectPlaceholder = comp.placeholder;
                    }
                  });
                }
              });
            }
          });
        }
      }
    } catch (e: any) {
      parseError = e.message;
    }
  }

  const formatMarkdown = (text: string) => {
    if (!text) return '';
    let html = text;
    html = html.replace(/<a?:[a-zA-Z0-9_]+:(\d+)>/g, (match) => {
      const nameMatch = match.match(/:([a-zA-Z0-9_]+):/);
      return `:${nameMatch ? nameMatch[1] : 'emoji'}:`;
    });
    html = html.replace(/^##\s+(.*)$/gm, '<h3 class="text-sm font-bold text-white mt-1 mb-1">$1</h3>');
    html = html.replace(/^#\s+(.*)$/gm, '<h2 class="text-base font-bold text-white mt-1 mb-1">$1</h2>');
    html = html.replace(/^-#\s+(.*)$/gm, '<span class="text-[11px] text-zinc-400 block mt-0.5">$1</span>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#1e1f22] px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    html = html.replace(/\\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-sm text-[#dbdee1] leading-relaxed break-words whitespace-pre-wrap" />;
  };

  return (
    <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
              ตัวอย่างบน Discord (Live Preview)
            </CardTitle>
            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-mono">
              Live Mockup
            </Badge>
          </div>
          <CardDescription className="text-xs">แสดงผลแบบเรียลไทม์เหมือนที่ผู้ใช้งานจะได้เห็นบนแอปพลิเคชัน Discord</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {parseError ? (
            <div className="min-h-[220px] border border-dashed border-red-300 dark:border-red-900/50 bg-red-50/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-7 h-7 text-red-500 mb-2" />
              <p className="text-sm font-semibold text-red-500">รูปแบบ JSON ไม่ถูกต้อง</p>
              <p className="text-xs text-red-400 mt-1 font-mono max-w-xs truncate">{parseError}</p>
            </div>
          ) : (
            <div className="bg-[#313338] rounded-2xl p-4 text-[#dbdee1] flex items-start gap-3 shadow-inner border border-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-[#5865f2] shrink-0 flex items-center justify-center font-bold text-white text-base shadow">
                🐻
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">Bear Cafe Bot</span>
                  <Badge className="bg-[#5865f2] hover:bg-[#5865f2] text-[10px] h-4 px-1 rounded font-normal text-white">BOT</Badge>
                  <span className="text-[11px] text-zinc-400">วันนี้ เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                </div>

                {content && formatMarkdown(content)}

                {mediaUrl && (
                  <div className="rounded-xl overflow-hidden max-w-sm border border-zinc-700 mt-2">
                    <img src={mediaUrl} alt="Discord Attachment" className="w-full object-cover max-h-60" />
                  </div>
                )}

                {textBlocks.length > 0 && textBlocks.map((txt, idx) => (
                  <div key={idx} className="mt-2 text-sm">{formatMarkdown(txt)}</div>
                ))}

                {selectMenuOptions.length > 0 && (
                  <div className="mt-3 bg-[#2b2d31] border border-zinc-700 rounded-xl p-2.5 space-y-1 max-w-md">
                    <div className="text-xs text-zinc-400 flex items-center justify-between font-medium">
                      <span>{selectPlaceholder}</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </div>

      {/* Pre-Flight Telemetry Inspector */}
      <div className="p-4 pt-0">
        <div className="p-3.5 rounded-2xl bg-[#FAF6F0] dark:bg-[#1A1614] border border-[#EAD8C8] dark:border-[#2D2420] space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" /> มาตรวัดก่อนออกอากาศ (Pre-Flight Telemetry)
            </span>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              สถานะ: {content ? 'พร้อมเข้าคิว' : 'รอกรอกเนื้อหา'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-xl bg-white dark:bg-[#14110F] border border-[#EAD8C8]/60 dark:border-[#2A221E] space-y-0.5">
              <span className="text-muted-foreground block text-[10px]">ขนาดข้อมูล</span>
              <span className="font-mono font-bold text-foreground">{payloadSize.toLocaleString()} ไบต์</span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-[#14110F] border border-[#EAD8C8]/60 dark:border-[#2A221E] space-y-0.5">
              <span className="text-muted-foreground block text-[10px]">เป้าหมายโดยประมาณ</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {targetType === 'all' ? 'สมาชิกทั้งหมด' : targetType === 'test' ? '1 คน (ทดสอบ)' : `~${estimatedTargets || 0} คน`}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white dark:bg-[#14110F] border border-[#EAD8C8]/60 dark:border-[#2A221E] space-y-0.5">
              <span className="text-muted-foreground block text-[10px]">ความเร็ว & นโยบาย</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {safetyMode === 'safe' ? 'Safe (15-35s)' : 'Balanced (5-15s)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DMBroadcastManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('composer');

  // Stats
  const [subStats, setSubStats] = useState({
    totalSubs: 0,
    options: {
      '49B40A9yBS': 0,
      'JNySCX80ja': 0,
      'DsMHlVrjze': 0,
      '6io1xnaMWJ': 0
    }
  });

  const [dmStatusStats, setDmStatusStats] = useState({
    open: 0,
    closed: 0,
    unknown: 0
  });

  // Campaigns list
  const [campaigns, setCampaigns] = useState<CampaignQueue[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const campaignsPageSize = 5;

  // JSON Payload Viewer Modal
  const [jsonViewCampaign, setJsonViewCampaign] = useState<CampaignQueue | null>(null);

  // Live ETA Completion Calculator
  const calculateETA = (c: CampaignQueue) => {
    const total = c.total_targets || 0;
    const processed = (c.sent_count || 0) + (c.failed_count || 0);
    const remaining = Math.max(0, total - processed);

    if (remaining === 0 || c.status === 'completed') {
      return { text: 'เสร็จสิ้นเรียบร้อยแล้ว', isFinished: true, remaining, subText: 'ส่งครบตามเป้าหมาย' };
    }

    if (c.status === 'cancelled') {
      return { text: 'ถูกยกเลิกแล้ว', isFinished: true, remaining, subText: 'ยกเลิกก่อนเสร็จสิ้น' };
    }

    const options = c.message_payload?.options || {};
    const minDelay = Number(options.min_delay_sec) || 15;
    const maxDelay = Number(options.max_delay_sec) || 35;
    const avgDelay = (minDelay + maxDelay) / 2; // Average delay in seconds
    const hourlyLimit = Number(options.hourly_limit) || 50;

    let totalSeconds = remaining * avgDelay;

    // Account for hourly rate limit pauses if remaining targets exceed quota
    if (hourlyLimit > 0 && remaining > hourlyLimit) {
      const extraBatches = Math.floor(remaining / hourlyLimit);
      totalSeconds += extraBatches * 3600; // Add 1 hour per rate limit quota cycle
    }

    const targetDate = new Date(Date.now() + totalSeconds * 1000);
    const now = new Date();
    const isSameDay = targetDate.toDateString() === now.toDateString();

    const formattedTime = isSameDay
      ? `ประมาณเวลา ${targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
      : `ประมาณวันที่ ${targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} เวลา ${targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

    const totalMinutes = Math.ceil(totalSeconds / 60);
    const minutesInHour = 60;
    const minutesInDay = 60 * 24; // 1440 mins
    const minutesInMonth = 60 * 24 * 30; // 43200 mins

    let durationStr = '';

    if (totalMinutes < 60) {
      durationStr = `ประมาณ ${totalMinutes} นาที`;
    } else if (totalMinutes < minutesInDay) {
      const hours = Math.floor(totalMinutes / minutesInHour);
      const remMins = totalMinutes % minutesInHour;
      durationStr = remMins > 0 ? `ประมาณ ${hours} ชม. ${remMins} นาที` : `ประมาณ ${hours} ชม.`;
    } else if (totalMinutes < minutesInMonth) {
      const days = Math.floor(totalMinutes / minutesInDay);
      const remHours = Math.floor((totalMinutes % minutesInDay) / minutesInHour);
      const remMins = totalMinutes % minutesInHour;
      let parts = [`${days} วัน`];
      if (remHours > 0) parts.push(`${remHours} ชม.`);
      if (remMins > 0 && days < 3) parts.push(`${remMins} นาที`);
      durationStr = `ประมาณ ${parts.join(' ')}`;
    } else {
      const months = Math.floor(totalMinutes / minutesInMonth);
      const remDays = Math.floor((totalMinutes % minutesInMonth) / minutesInDay);
      const remHours = Math.floor((totalMinutes % minutesInDay) / minutesInHour);
      let parts = [`${months} เดือน`];
      if (remDays > 0) parts.push(`${remDays} วัน`);
      if (remHours > 0 && months < 3) parts.push(`${remHours} ชม.`);
      durationStr = `ประมาณ ${parts.join(' ')}`;
    }

    return {
      text: `⏱️ ประเมินเวลาเสร็จสิ้น: ~ ${durationStr} (${formattedTime})`,
      subText: `เหลืออีก ${remaining} คน • เฉลี่ยหน่วง ${Math.round(avgDelay)} วิ/คน`,
      isFinished: false,
      remaining,
      avgDelay
    };
  };

  const getCampaignPipelineSteps = (c: CampaignQueue): { steps: TaskStepItem[]; current: number } => {
    const steps: TaskStepItem[] = [
      { id: 'validate', label: '1. ตรวจสอบข้อมูล', meta: 'ผ่าน' },
      { id: 'queue', label: '2. กรองผู้รับ', meta: `${c.total_targets} คน` },
      { 
        id: 'dispatch', 
        label: '3. กำลังส่ง DM', 
        meta: c.status === 'processing' 
          ? `${c.sent_count}/${c.total_targets}` 
          : c.status === 'completed' 
          ? 'ครบแล้ว' 
          : 'รอส่ง' 
      },
      { id: 'finalized', label: '4. สรุปผล & Log', meta: c.status === 'completed' ? '100%' : 'ปลายทาง' },
    ];

    let current = 0;
    if (c.status === 'pending') {
      current = 1;
    } else if (c.status === 'processing' || c.status === 'paused') {
      current = 2;
    } else if (c.status === 'completed') {
      current = 4;
    } else if (c.status === 'cancelled') {
      current = 1;
    }

    return { steps, current };
  };
  
  // Paginated Campaign Logs
  const [campaignLogs, setCampaignLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalCount, setLogsTotalCount] = useState(0);
  const logsPageSize = 20;

  // Paginated Member Subscriptions
  const [memberSubs, setMemberSubs] = useState<MemberSub[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<string>('all');
  const [memberPage, setMemberPage] = useState(1);
  const memberPageSize = 15;

  // System Logs & DB Cleaner
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState(false);

  // Composer Form
  const [composerTitle, setComposerTitle] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'option' | 'test'>('option');
  const [targetOption, setTargetOption] = useState('49B40A9yBS');
  const [testUserId, setTestUserId] = useState('');
  const [tokenType, setTokenType] = useState<'token1' | 'token2'>('token1');
  const [inputMode, setInputMode] = useState<'text' | 'json'>('text');
  const [textContent, setTextContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Safety & Deduplication Controls
  const [excludePreviousSuccess, setExcludePreviousSuccess] = useState(true);
  const [safetyMode, setSafetyMode] = useState<'safe' | 'balanced'>('safe');
  const [jsonContent, setJsonContent] = useState(`{
  "data": {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "components": [
          {
            "type": 12,
            "items": [
              {
                "media": {
                  "url": "https://cdn.discordapp.com/attachments/1524704267015819274/1526522750460498021/d8c5887ba3276d401ff1af64efa6add6.jpg?ex=6a575499&is=6a560319&hm=44ac8a4b15d5f3beed9c9a4c0413df475b60afdea1dc2e96035ee6499612bd04&"
                }
              }
            ]
          },
          {
            "type": 10,
            "content": "## <:bee20000:1256669436350562355>︲__\` 𝖭𝗈𝗍𝗂𝖿𝗂𝖼𝖺𝗍𝗂𝗈𝗇𝗌 ₊ เลือกการแจ้งเตือนที่ต้องการ 𓂃 \`__\\n-# เลือกรับการแจ้งเตือนเฉพาะหัวข้อที่คุณสนใจ เพื่อไม่ให้พลาดข่าวสารสำคัญ <:cuteplant:1152834055528783872>\\n"
          }
        ]
      }
    ]
  }
}`);

  // Cyber Console Terminal States
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [logAutoScroll, setLogAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Estimated Target Count for Inspector
  const estimatedTargetsCount = useMemo(() => {
    if (targetType === 'all') return subStats.totalSubs;
    if (targetType === 'option') return subStats.options[targetOption as keyof typeof subStats.options] || 0;
    if (targetType === 'test') return testUserId.split(',').map(s => s.trim()).filter(Boolean).length || 1;
    return 0;
  }, [targetType, targetOption, subStats, testUserId]);

  // Auto-scroll terminal when new systemLogs arrive
  useEffect(() => {
    if (logAutoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [systemLogs, logAutoScroll]);

  // Fetch Subscribers List
  const fetchMemberSubscriptions = useCallback(async () => {
    try {
      setLoadingMembers(true);
      let rawSubs: any[] | null = null;
      
      const { data, error: subErr } = await supabase
        .from('dms_options' as any)
        .select('user_id, option_value, created_at');

      if (subErr) {
        console.warn('Fallback selecting dms_options without created_at:', subErr.message);
        const { data: fallbackData } = await supabase
          .from('dms_options' as any)
          .select('user_id, option_value');
        rawSubs = fallbackData || [];
      } else {
        rawSubs = data || [];
      }

      const grouped: { [userId: string]: { options: string[]; updatedAt: string } } = {};
      (rawSubs || []).forEach((row: any) => {
        if (!grouped[row.user_id]) {
          grouped[row.user_id] = { options: [], updatedAt: row.created_at || new Date().toISOString() };
        }
        grouped[row.user_id].options.push(row.option_value);
      });

      const uids = Object.keys(grouped);
      const profilesMap: { [userId: string]: { username: string | null; discord_username: string | null } } = {};

      if (uids.length > 0) {
        for (let i = 0; i < uids.length; i += 100) {
          const chunk = uids.slice(i, i + 100);
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('discord_id, username, discord_username')
              .in('discord_id', chunk);

            if (profiles) {
              profiles.forEach(p => {
                profilesMap[p.discord_id] = { username: p.username, discord_username: p.discord_username };
              });
            }
          } catch (pErr) {
            console.error('Error fetching profile chunk:', pErr);
          }
        }
      }

      const list = uids.map(uid => ({
        userId: uid,
        username: profilesMap[uid]?.username ?? null,
        discordUsername: profilesMap[uid]?.discord_username ?? null,
        options: grouped[uid].options,
        updatedAt: grouped[uid].updatedAt
      }));

      setMemberSubs(list);
    } catch (e) {
      console.error('Error fetching member subs:', e);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Fetch Thai System Logs
  const fetchSystemLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dm_broadcast_system_logs' as any)
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

      if (!error && data) {
        setSystemLogs(data as SystemLog[]);
      }
    } catch (e) {
      console.error('Error fetching system logs:', e);
    }
  }, []);

  // Fetch Dashboard Stats & Campaigns (Silent Update)
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Fetch Subscription Stats
      const { data: rawSubs } = await supabase
        .from('dms_options' as any)
        .select('user_id, option_value');

      if (rawSubs) {
        const counts = { '49B40A9yBS': 0, 'JNySCX80ja': 0, 'DsMHlVrjze': 0, '6io1xnaMWJ': 0 };
        const uniqueUsers = new Set<string>();
        rawSubs.forEach((item: any) => {
          if (item.user_id) uniqueUsers.add(item.user_id);
          if (item.option_value in counts) counts[item.option_value as keyof typeof counts]++;
        });
        setSubStats({ totalSubs: uniqueUsers.size, options: counts });
      }

      // 2. Fetch Reachability Stats (Use count: 'exact' to bypass Supabase 1000 row REST payload limit)
      const [openRes, closedRes] = await Promise.all([
        supabase
          .from('member_dm_status' as any)
          .select('*', { count: 'exact', head: true })
          .eq('dm_status', 'open'),
        supabase
          .from('member_dm_status' as any)
          .select('*', { count: 'exact', head: true })
          .eq('dm_status', 'closed'),
      ]);

      setDmStatusStats({
        open: openRes.count || 0,
        closed: closedRes.count || 0,
        unknown: 0,
      });

      // 3. Fetch Campaigns Queue
      const { data: rawQueues } = await supabase
        .from('dm_broadcast_queues' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (rawQueues) {
        setCampaigns(rawQueues as CampaignQueue[]);
      }

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchDashboardData(false);
    fetchMemberSubscriptions();
    fetchSystemLogs();
  }, [fetchDashboardData, fetchMemberSubscriptions, fetchSystemLogs]);

  // Silent Auto-Refresh Polling (No UI flicker)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
      fetchSystemLogs();
      if (expandedCampaignId) {
        fetchCampaignLogs(expandedCampaignId, logsPage);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, expandedCampaignId, logsPage, fetchDashboardData, fetchSystemLogs]);

  // Fetch Paginated Logs for Campaign
  const fetchCampaignLogs = async (queueId: string, page = 1) => {
    setLoadingLogs(true);
    try {
      const from = (page - 1) * logsPageSize;
      const to = from + logsPageSize - 1;

      let query = supabase
        .from('dm_broadcast_logs' as any)
        .select('*', { count: 'exact' })
        .eq('queue_id', queueId);

      if (logSearchQuery.trim()) {
        query = query.or(`user_id.ilike."%${logSearchQuery}%",username.ilike."%${logSearchQuery}%"`);
      }

      const { data, count, error } = await query
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      setCampaignLogs((data || []) as CampaignLog[]);
      setLogsTotalCount(count || 0);
      setLogsPage(page);
    } catch (e) {
      console.error('Error fetching campaign logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggleExpand = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setCampaignLogs([]);
    } else {
      setExpandedCampaignId(campaignId);
      setLogsPage(1);
      fetchCampaignLogs(campaignId, 1);
    }
  };

  // Retry Failed Items Only
  const handleRetryFailedCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      const { error: logErr } = await supabase
        .from('dm_broadcast_logs' as any)
        .update({ status: 'pending', error_message: null, sent_at: null })
        .eq('queue_id', campaignId)
        .eq('status', 'failed');

      if (logErr) throw logErr;

      const { error: queueErr } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (queueErr) throw queueErr;

      toast({ title: 'เริ่มส่งซ่อมรายการล้มเหลวเรียบร้อยแล้วค่ะ', description: 'ระบบเปลี่ยนรายการที่ล้มเหลวกลับเข้าสู่คิวส่งต่อทันที' });
      fetchDashboardData(true);
      if (expandedCampaignId === campaignId) fetchCampaignLogs(campaignId, 1);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Cancel Campaign
  const handleCancelCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;
      toast({ title: 'ยกเลิกบรอดแคสต์แล้ว' });
      fetchDashboardData(true);
    } catch (e) {
      toast({ title: 'ผิดพลาด', description: 'ไม่สามารถยกเลิกได้', variant: 'destructive' });
    }
  };

  // Pause Campaign
  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;
      toast({ title: 'พักการส่งชั่วคราวแล้ว', description: 'บอทจะหยุดส่งชั่วคราว สามารถกดดำเนินการต่อได้ทุกเมื่อ' });
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  // Resume Campaign
  const handleResumeCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;
      toast({ title: 'ดำเนินการส่งต่อแล้ว', description: 'ระบบนำคิวกลับมาส่งต่อทันที' });
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  // Clean Old Completed Logs (Tool for 88.4K records cleanup)
  const handleCleanOldLogs = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการล้าง Log บรอดแคสต์เก่าที่ส่งเสร็จสิ้นแล้วเกิน 14 วัน? การดำเนินการนี้จะช่วยคืนพื้นที่ DB')) return;

    setCleaningLogs(true);
    try {
      const { data, error } = await supabase.rpc('clean_old_dm_broadcast_logs', { days_older: 14 });
      if (error) throw error;
      toast({ title: 'ล้าง Log เก่าสำเร็จแล้วค่ะ', description: `ทำการลบ Log ซากบรอดแคสต์เก่าเรียบร้อยแล้วจำนวน ${data || 0} รายการ` });
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'ล้าง Log ไม่สำเร็จ', description: e.message || 'ไม่สามารถเรียกใช้ฟังก์ชั่นล้าง Log ได้', variant: 'destructive' });
    } finally {
      setCleaningLogs(false);
    }
  };

  // Clear System Logs UI
  const handleClearSystemLogs = async () => {
    try {
      const { error } = await supabase.from('dm_broadcast_system_logs' as any).delete().neq('id', 0);
      if (!error) {
        setSystemLogs([]);
        toast({ title: 'ล้างประวัติการทำงานสำเร็จค่ะ' });
      }
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาดในการล้าง log', variant: 'destructive' });
    }
  };

  // Submit New Campaign
  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerTitle.trim()) {
      toast({ title: 'กรุณากรอกชื่อบรอดแคสต์', variant: 'destructive' });
      return;
    }

    let payload: any = {};
    if (inputMode === 'text') {
      if (!textContent.trim()) {
        toast({ title: 'กรุณากรอกข้อความ', variant: 'destructive' });
        return;
      }
      payload = { content: textContent };
    } else {
      try {
        payload = JSON.parse(jsonContent);
      } catch (err) {
        toast({ title: 'รูปแบบ JSON ไม่ถูกต้อง', variant: 'destructive' });
        return;
      }
    }

    if (targetType === 'test' && !testUserId.trim()) {
      toast({ title: 'กรุณากรอก Discord User ID สำหรับทดสอบ', variant: 'destructive' });
      return;
    }

    const optionsObj = {
      exclude_previous_success: excludePreviousSuccess,
      min_delay_sec: safetyMode === 'safe' ? 15 : 5,
      max_delay_sec: safetyMode === 'safe' ? 35 : 15,
      hourly_limit: safetyMode === 'safe' ? 50 : 100,
      consecutive_failure_limit: 5
    };

    payload = { ...payload, options: optionsObj };
    setSubmitting(true);

    let targetVal = null;
    if (targetType === 'option') {
      targetVal = targetOption;
    } else if (targetType === 'test') {
      targetVal = testUserId.split(',').map(s => s.trim()).filter(Boolean).join(',');
    }

    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .insert({
          title: composerTitle,
          message_payload: payload,
          target_type: targetType,
          target_value: targetVal,
          token_type: tokenType,
          status: 'pending'
        });

      if (error) throw error;
      toast({ title: 'สร้างงานบรอดแคสต์สำเร็จ', description: 'ระบบนำเข้าคิวเพื่อเตรียมส่งเรียบร้อยแล้วค่ะ' });
      setComposerTitle('');
      setTextContent('');
      setActiveTab('campaigns');
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (c: CampaignQueue) => {
    switch (c.status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold">รอเข้าคิว</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/40 animate-pulse font-bold">⏸️ พักส่งชั่วคราว</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse font-bold">📡 กำลังกระจายข่าวสาร...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">✓ สำเร็จเสร็จสิ้น</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold">ถูกยกเลิก</Badge>;
      default:
        return <Badge variant="secondary">{c.status}</Badge>;
    }
  };

  // Paginated Subscribers Filtering
  const filteredMemberSubs = memberSubs.filter(sub => {
    if (memberSearchQuery) {
      const matchUserId = sub.userId.toLowerCase().includes(memberSearchQuery.toLowerCase());
      const matchUsername = (sub.username ?? '').toLowerCase().includes(memberSearchQuery.toLowerCase());
      const matchDiscord = (sub.discordUsername ?? '').toLowerCase().includes(memberSearchQuery.toLowerCase());
      if (!matchUserId && !matchUsername && !matchDiscord) return false;
    }
    if (filterOption !== 'all') {
      if (!sub.options.includes(filterOption)) return false;
    }
    return true;
  });

  const totalMemberPages = Math.ceil(filteredMemberSubs.length / memberPageSize) || 1;
  const paginatedMembers = filteredMemberSubs.slice((memberPage - 1) * memberPageSize, memberPage * memberPageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border border-[#EAD8C8] dark:border-[#2D2520] p-5 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2.5">
            <Send className="w-6 h-6 text-primary" /> ระบบกระจายข่าวสารบอท DM (DM Broadcast)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            ส่งข้อความข่าวสารหาผู้ใช้งาน Discord แบบรายบุคคลผ่านระบบคิวพร้อมกลไกป้องกัน Spam & Quarantine
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            className={cn("rounded-xl text-xs gap-1.5 font-bold", autoRefresh && "bg-emerald-600 hover:bg-emerald-700 text-white")}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={cn("w-3.5 h-3.5", autoRefresh && "animate-spin")} />
            {autoRefresh ? 'Auto-Refresh (เปิด)' : 'Auto-Refresh (ปิด)'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs gap-1.5 border-[#EAD8C8] dark:border-[#2D2520]"
            onClick={() => fetchDashboardData(false)}
          >
            <RefreshCw className="w-3.5 h-3.5" /> ดึงข้อมูลสด
          </Button>
        </div>
      </div>

      {/* 1. Statistics Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Audience */}
        <Card className="border-[#EAD8C8] dark:border-[#2D2420] shadow-xs bg-[#FDFBF7] dark:bg-[#181412] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <Users className="w-4 h-4 text-amber-500" /> ผู้รับข่าวสารทั้งหมด
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold">
                พร้อมรับข่าว
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-[#4E3F30] dark:text-[#F3EDE6]">
              {subStats.totalSubs.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">คน</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">ผู้ใช้ที่เลือกหัวข้อรับการแจ้งเตือนจากบอท</p>
          </CardContent>
        </Card>

        {/* Card 2: Category Distribution */}
        <Card className="border-[#EAD8C8] dark:border-[#2D2420] shadow-xs bg-[#FDFBF7] dark:bg-[#181412] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <Radio className="w-4 h-4 text-primary" /> หมวดหมู่ที่ติดตาม
              </span>
              <span className="text-[10px] text-muted-foreground">4 หมวดหมู่</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#FAF6F0] dark:bg-[#201A17] p-2 rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2420]/70">
              <span className="text-[10px] text-muted-foreground block">🎉 กิจกรรม</span>
              <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9] text-sm">{subStats.options['49B40A9yBS']}</span>
            </div>
            <div className="bg-[#FAF6F0] dark:bg-[#201A17] p-2 rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2420]/70">
              <span className="text-[10px] text-muted-foreground block">📢 ประกาศสำคัญ</span>
              <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9] text-sm">{subStats.options['JNySCX80ja']}</span>
            </div>
            <div className="bg-[#FAF6F0] dark:bg-[#201A17] p-2 rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2420]/70">
              <span className="text-[10px] text-muted-foreground block">📑 ข่าวสารทั่วไป</span>
              <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9] text-sm">{subStats.options['DsMHlVrjze']}</span>
            </div>
            <div className="bg-[#FAF6F0] dark:bg-[#201A17] p-2 rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2420]/70">
              <span className="text-[10px] text-muted-foreground block">🎁 โปรโมชัน</span>
              <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9] text-sm">{subStats.options['6io1xnaMWJ']}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: DM Delivery Health */}
        <Card className="border-[#EAD8C8] dark:border-[#2D2420] shadow-xs bg-[#FDFBF7] dark:bg-[#181412] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <Mail className="w-4 h-4 text-emerald-500" /> อัตราความพร้อมส่ง DM
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
                {dmStatusStats.open + dmStatusStats.closed > 0 
                  ? `${Math.round((dmStatusStats.open / (dmStatusStats.open + dmStatusStats.closed)) * 100)}% เข้าถึงได้`
                  : 'พร้อมส่ง'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> เปิดรับ: {dmStatusStats.open}
                </span>
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> ปิดรับ: {dmStatusStats.closed}
                </span>
              </div>
            </div>
            <div className="p-1.5 bg-[#FAF6F0] dark:bg-[#201A17] rounded-xl border border-[#EAD8C8]/60 dark:border-[#2D2420]/70 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-amber-500 shrink-0" />
              <span>บันทึกประวัติ DM 50007 อัตโนมัติ เพื่อกันบอทติด Quarantine</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Engine Status */}
        <Card className="border-[#EAD8C8] dark:border-[#2D2420] shadow-xs bg-[#FDFBF7] dark:bg-[#181412] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <Zap className="w-4 h-4 text-amber-500" /> สถานะเครื่องยนต์บอท
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const runningCount = campaigns.filter(c => c.status === 'processing').length;
              const pendingCount = campaigns.filter(c => c.status === 'pending').length;
              return (
                <div>
                  <div className="text-base font-bold text-[#4E3F30] dark:text-[#F3EDE6] flex items-center gap-2">
                    {runningCount > 0 ? (
                      <span className="text-blue-500 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 animate-spin" /> กำลังส่ง ({runningCount} งาน)
                      </span>
                    ) : pendingCount > 0 ? (
                      <span className="text-amber-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 animate-pulse" /> รอคิว ({pendingCount} งาน)
                      </span>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> พร้อมทำงาน (Idle)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    รองรับ Token 1 และ 2 พร้อมระบบเฉลี่ยคิวอัตโนมัติ
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        <TabsList className="bg-[#FAF6F0] dark:bg-[#25201C] p-1.5 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] grid grid-cols-2 md:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="composer" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Send className="w-4 h-4 text-primary" /> 1. สร้างงานบรอดแคสต์
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Activity className="w-4 h-4 text-indigo-500" /> 2. ประวัติและสถานะคิว ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Users className="w-4 h-4 text-emerald-500" /> 3. ผู้รับข่าวสาร ({filteredMemberSubs.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Database className="w-4 h-4 text-amber-500" /> 4. บันทึกบอท & DB
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Composer & Live Preview */}
        <TabsContent value="composer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Col: Composer Form */}
            <div className="lg:col-span-7 flex flex-col">
              <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[#181412] dark:border-[#2D2420] shadow-sm rounded-3xl flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-4 border-b border-[#EAD8C8]/60 dark:border-[#2D2420] bg-[#FAF6F0]/50 dark:bg-[#15110E]/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" /> สร้างงานบรอดแคสต์ใหม่ (Broadcast Studio)
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        กำหนดชื่อรายการ กลุ่มเป้าหมาย เนื้อหา และตั้งค่านโยบายความปลอดภัยของระบบคิว
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold px-2.5 py-1">
                      สตูดิโอ 3 ขั้นตอน
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-6">
                  <form onSubmit={handleSubmitCampaign} className="space-y-6">

                    {/* Step 1: Target & Basic Settings */}
                    <div className="space-y-3 p-4 rounded-2xl bg-[#FAF6F0]/60 dark:bg-[#201A17]/60 border border-[#EAD8C8]/70 dark:border-[#2D2420]">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[11px] font-bold">1</span>
                        กลุ่มเป้าหมายและบอทผู้ส่ง (Audience & Sender)
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="title" className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">
                          ชื่อรายการบรอดแคสต์ <span className="text-rose-500">*</span>
                        </Label>
                        <Input 
                          id="title"
                          placeholder="เช่น แจ้งเตือนกิจกรรมกิลด์ 15 ก.ย. หรือ ข่าวสารอัปเดตร้าน"
                          value={composerTitle}
                          onChange={(e) => setComposerTitle(e.target.value)}
                          required
                          className="border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E] text-sm rounded-xl h-10"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <RichSelect
                            label="กลุ่มเป้าหมายผู้รับสาร"
                            value={targetType}
                            onValueChange={(val: any) => setTargetType(val)}
                            data={TARGET_TYPE_RICH_OPTIONS}
                            placeholder="เลือกกลุ่มเป้าหมาย..."
                          />
                        </div>

                        {targetType === 'option' && (
                          <div className="space-y-1">
                            <RichSelect
                              label="หมวดหมู่ข่าวสาร"
                              value={targetOption}
                              onValueChange={setTargetOption}
                              data={TARGET_OPTION_RICH_OPTIONS}
                              placeholder="เลือกหมวดหมู่..."
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <RichSelect
                            label="บอทที่ใช้ส่งข้อความ"
                            value={tokenType}
                            onValueChange={(val: any) => setTokenType(val)}
                            data={TOKEN_TYPE_RICH_OPTIONS}
                            placeholder="เลือกบอทส่งข้อความ..."
                          />
                        </div>
                      </div>

                      {targetType === 'test' && (
                        <div className="space-y-1 pt-1">
                          <Label htmlFor="testUserId" className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">
                            Discord User ID สำหรับทดสอบ (คั่นด้วยจุลภาคได้)
                          </Label>
                          <Input 
                            id="testUserId"
                            placeholder="ป้อน Discord User ID เช่น 944920660759707658"
                            value={testUserId}
                            onChange={(e) => setTestUserId(e.target.value)}
                            required
                            className="border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E] text-xs font-mono rounded-xl h-9"
                          />
                        </div>
                      )}
                    </div>

                    {/* Step 2: Content Studio */}
                    <div className="space-y-3 p-4 rounded-2xl bg-[#FAF6F0]/60 dark:bg-[#201A17]/60 border border-[#EAD8C8]/70 dark:border-[#2D2420]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[11px] font-bold">2</span>
                          เนื้อหาข้อความ (Message Payload)
                        </div>

                        <div className="flex gap-1 bg-[#F0E6D8] dark:bg-[#14100E] p-0.5 rounded-xl border border-[#EAD8C8] dark:border-[#2D2420]">
                          <button 
                            type="button"
                            className={cn("px-2.5 py-1 text-xs rounded-lg font-semibold transition-all flex items-center gap-1", inputMode === 'text' ? "bg-white dark:bg-[#221B17] text-stone-900 dark:text-stone-100 shadow-xs" : "text-muted-foreground hover:text-stone-800 dark:hover:text-stone-200")}
                            onClick={() => setInputMode('text')}
                          >
                            <FileText className="w-3 h-3 text-amber-500" /> ข้อความธรรมดา
                          </button>
                          <button 
                            type="button"
                            className={cn("px-2.5 py-1 text-xs rounded-lg font-semibold transition-all flex items-center gap-1", inputMode === 'json' ? "bg-white dark:bg-[#221B17] text-stone-900 dark:text-stone-100 shadow-xs" : "text-muted-foreground hover:text-stone-800 dark:hover:text-stone-200")}
                            onClick={() => setInputMode('json')}
                          >
                            <Shield className="w-3 h-3 text-blue-500" /> Discohook JSON
                          </button>
                        </div>
                      </div>

                      {inputMode === 'text' ? (
                        <div className="space-y-1.5">
                          <Textarea 
                            id="textContent"
                            placeholder="พิมพ์ข้อความข่าวสาร รองรับ Markdown เช่น **ตัวหนา**, *ตัวเอียง*, <#channel_id>..."
                            className="h-36 border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E] text-sm rounded-xl resize-y"
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                          />
                          <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                            <span>รองรับ Discord Markdown</span>
                            <span>{textContent.length} ตัวอักษร</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Textarea 
                            id="jsonContent"
                            placeholder="วาง JSON รูปแบบ Component v2 หรือ Embed ที่นี่..."
                            className="h-36 font-mono text-xs border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E] text-emerald-600 dark:text-emerald-400 rounded-xl resize-y"
                            value={jsonContent}
                            onChange={(e) => setJsonContent(e.target.value)}
                          />
                          <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                            <span>Discohook / Discord Component v2 JSON format</span>
                            <span>{jsonContent.length} ไบต์</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 3: Safety & Policy */}
                    <div className="space-y-3 p-4 rounded-2xl bg-[#FAF6F0]/60 dark:bg-[#201A17]/60 border border-[#EAD8C8]/70 dark:border-[#2D2420]">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[11px] font-bold">3</span>
                        การควบคุมความเร็วและความปลอดภัย (Anti-Spam & Quarantine Protection)
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#14100E] border border-[#EAD8C8]/60 dark:border-[#2D2420]">
                          <Label htmlFor="dedup" className="text-xs font-semibold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2 cursor-pointer">
                            <Shield className="w-4 h-4 text-emerald-500" /> ข้ามคนที่เคยส่งสำเร็จแล้ว (ป้องกันส่งซ้ำ 100%)
                          </Label>
                          <input 
                            id="dedup"
                            type="checkbox"
                            checked={excludePreviousSuccess}
                            onChange={(e) => setExcludePreviousSuccess(e.target.checked)}
                            className="w-4 h-4 accent-[#8C6239] rounded cursor-pointer"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <RichSelect
                            label="ระดับความเร็วและระยะหน่วงเวลาระหว่างส่ง"
                            value={safetyMode}
                            onValueChange={(val: any) => setSafetyMode(val)}
                            data={SAFETY_MODE_RICH_OPTIONS}
                            placeholder="เลือกระดับความปลอดภัย..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Action */}
                    <Button 
                      type="submit" 
                      className="w-full rounded-2xl h-12 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.99] transition-all cursor-pointer border-0" 
                      disabled={submitting}
                    >
                      {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-stone-950" />}
                      {submitting ? 'กำลังนำเข้าคิวออกอากาศ...' : 'นำส่งเข้าคิวออกอากาศ (Queue Broadcast)'}
                    </Button>

                    {/* Pipeline Stage Preview */}
                    <div className="pt-2">
                      <TaskSteps
                        steps={[
                          { id: 'step-1', label: '1. ตรวจสอบข้อมูล', meta: composerTitle ? 'พร้อม' : 'รอกรอก' },
                          { id: 'step-2', label: '2. จัดคิว & คัดกรอง', meta: targetType === 'all' ? 'ทุกคน' : `${estimatedTargetsCount} คน` },
                          { id: 'step-3', label: '3. ป้องกัน Spam', meta: safetyMode === 'safe' ? 'Safe Mode' : 'Balanced' },
                          { id: 'step-4', label: '4. ออกอากาศ DM', meta: tokenType === 'token2' ? 'บอท 2' : 'บอท 1' },
                        ]}
                        current={submitting ? 1 : 0}
                        label="ขั้นตอนการประมวลผล (Broadcast Pipeline Preview)"
                      />
                    </div>

                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Live Preview */}
            <div className="lg:col-span-5 flex flex-col">
              <DiscordPreview 
                inputMode={inputMode} 
                textContent={textContent} 
                jsonContent={jsonContent}
                targetType={targetType}
                safetyMode={safetyMode}
                estimatedTargets={estimatedTargetsCount}
              />
            </div>

          </div>
        </TabsContent>

        {/* TAB 2: Campaigns History & Paginated Logs */}
        <TabsContent value="campaigns" className="space-y-6">

          {/* 1. Featured Active / Latest Campaign Parallax Tracker */}
          {(() => {
            const activeCampaign = campaigns.find(c => c.status === 'processing' || c.status === 'pending' || c.status === 'paused') || (campaigns.length > 0 ? campaigns[0] : null);
            if (!activeCampaign) return null;

            const activeEta = calculateETA(activeCampaign);
            const pipeline = getCampaignPipelineSteps(activeCampaign);

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {activeCampaign.status === 'processing' 
                      ? 'ระบบติดตามงานบรอดแคสต์สด (Live Active Tracking)' 
                      : 'ระบบติดตามงานบรอดแคสต์ล่าสุด (Recent Broadcast Tracking)'}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold">
                    Interactive 3D Parallax
                  </Badge>
                </div>

                <OrderTrackingParallaxCard
                  campaignId={activeCampaign.id}
                  title={activeCampaign.title}
                  subTitle={`เป้าหมาย: ${
                    activeCampaign.target_type === 'all' 
                      ? 'สมาชิกทุกคน' 
                      : activeCampaign.target_type === 'test' 
                      ? 'ทดสอบเฉพาะบุคคล' 
                      : 'แยกตามหมวดหมู่'
                  } • สร้างเมื่อ ${new Date(activeCampaign.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`}
                  status={
                    activeCampaign.status === 'processing' ? 'กำลังกระจายส่งข้อความ DM...' :
                    activeCampaign.status === 'pending' ? 'รอคิวออกอากาศ' :
                    activeCampaign.status === 'completed' ? 'จัดส่งเสร็จสิ้นสมบูรณ์' :
                    activeCampaign.status === 'paused' ? 'พักส่งชั่วคราว' : 'ยกเลิกการส่งแล้ว'
                  }
                  statusType={activeCampaign.status}
                  eta={
                    (activeCampaign.status === 'processing' || activeCampaign.status === 'pending' || activeCampaign.status === 'paused')
                      ? activeEta.text.replace('⏱️ ประเมินเวลาเสร็จสิ้น: ~ ', '')
                      : undefined
                  }
                  totalTargets={activeCampaign.total_targets}
                  sentCount={activeCampaign.sent_count}
                  failedCount={activeCampaign.failed_count}
                  tokenType={activeCampaign.token_type}
                  safetyMode={activeCampaign.message_payload?.options?.min_delay_sec >= 15 ? 'safe' : 'balanced'}
                  onViewLogs={() => handleToggleExpand(activeCampaign.id)}
                  onPause={activeCampaign.status === 'processing' ? () => handlePauseCampaign(activeCampaign.id) : undefined}
                  onResume={activeCampaign.status === 'paused' ? () => handleResumeCampaign(activeCampaign.id) : undefined}
                  onCancel={(activeCampaign.status === 'processing' || activeCampaign.status === 'pending' || activeCampaign.status === 'paused') ? () => handleCancelCampaign(activeCampaign.id) : undefined}
                  onRetry={activeCampaign.failed_count > 0 && activeCampaign.status !== 'processing' ? () => handleRetryFailedCampaign(activeCampaign.id) : undefined}
                  onViewJson={() => setJsonViewCampaign(activeCampaign)}
                >
                  <TaskSteps
                    steps={pipeline.steps}
                    current={pipeline.current}
                    label="ขั้นตอนกระบวนการจัดส่ง (Broadcast Pipeline)"
                  />
                </OrderTrackingParallaxCard>
              </div>
            );
          })()}

          {/* 2. All Campaigns List */}
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">รายการงานบรอดแคสต์ทั้งหมด ({campaigns.length})</CardTitle>
              <CardDescription className="text-xs">แสดงงานบรอดแคสต์และความคืบหน้าพร้อมการเรียกดู Log รายคนและโครงสร้าง JSON แบบแบ่งหน้า</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">ยังไม่มีงานบรอดแคสต์ใดๆ ถูกสร้างขึ้น</div>
              ) : (() => {
                const totalCampaignPages = Math.max(1, Math.ceil(campaigns.length / campaignsPageSize));
                const paginatedCampaigns = campaigns.slice((campaignsPage - 1) * campaignsPageSize, campaignsPage * campaignsPageSize);

                return (
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                      {paginatedCampaigns.map((c) => {
                        const percent = c.total_targets > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_targets) * 100) : 0;
                        const isExpanded = expandedCampaignId === c.id;
                        const totalLogPages = Math.ceil(logsTotalCount / logsPageSize) || 1;
                        const eta = calculateETA(c);

                        return (
                          <Card key={c.id} className="border border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] rounded-2xl overflow-hidden shadow-xs">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <h3 className="font-bold text-sm text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
                                    {c.title}
                                  </h3>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400">{c.token_type === 'token2' ? 'บอทสำรอง' : 'บอทหลัก'}</Badge>
                                    <span>สร้างเมื่อ: {new Date(c.created_at).toLocaleString('th-TH')}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getStatusBadge(c)}
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-bold gap-1 border-[#EAD8C8] dark:border-[#2D2520] hover:bg-white text-[#8C6239] cursor-pointer"
                                    onClick={() => setJsonViewCampaign(c)}
                                  >
                                    <Code className="w-3.5 h-3.5 text-blue-500" /> ดู JSON
                                  </Button>

                                  {c.status === 'processing' && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs font-bold gap-1 border-amber-500/40 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer" onClick={() => handlePauseCampaign(c.id)}>
                                      <Pause className="w-3 h-3" /> พักส่ง
                                    </Button>
                                  )}

                                  {c.status === 'paused' && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs font-bold gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer" onClick={() => handleResumeCampaign(c.id)}>
                                      <Play className="w-3 h-3 fill-emerald-600" /> ส่งต่อ
                                    </Button>
                                  )}

                                  {c.failed_count > 0 && c.status !== 'processing' && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 font-bold cursor-pointer" onClick={() => handleRetryFailedCampaign(c.id)}>
                                      <RefreshCw className="w-3 h-3" /> ส่งซ่อม ({c.failed_count})
                                    </Button>
                                  )}

                                  {(c.status === 'processing' || c.status === 'pending' || c.status === 'paused') && (
                                    <Button size="sm" variant="destructive" className="h-7 text-xs font-bold gap-1 cursor-pointer" onClick={() => handleCancelCampaign(c.id)}>
                                      <Square className="w-3 h-3 text-white" /> หยุดส่ง
                                    </Button>
                                  )}

                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#EAD8C8] dark:border-[#2D2520] cursor-pointer" onClick={() => handleToggleExpand(c.id)}>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    {isExpanded ? 'ซ่อน Log' : 'ดู Log รายคน'}
                                  </Button>
                                </div>
                              </div>

                              {/* Live ETA Calculation Banner (When running or pending) */}
                              {(c.status === 'processing' || c.status === 'pending' || c.status === 'paused') && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                                    <Clock className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                                    <span>{eta.text}</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                                    {eta.subText}
                                  </span>
                                </div>
                              )}

                              {/* Progress Indicator Component */}
                              <div className="space-y-2 bg-[#FAF6F0]/60 dark:bg-[#25201C]/60 p-3.5 rounded-xl border border-[#F0E8DC] dark:border-[#2D2520]">
                                <div className="flex justify-between items-center text-xs text-[#8C6239] dark:text-[#EAD8C8]">
                                  <span>ความคืบหน้า: <strong>{c.sent_count + c.failed_count} / {c.total_targets} คน</strong></span>
                                  <div className="flex gap-3 font-semibold text-xs">
                                    <span className="text-emerald-600 dark:text-emerald-400">สำเร็จ: {c.sent_count}</span>
                                    {c.failed_count > 0 && (
                                      <span className="text-rose-600 dark:text-rose-400">ล้มเหลว: {c.failed_count}</span>
                                    )}
                                  </div>
                                </div>
                                <ProgressIndicator
                                  value={percent}
                                  showLabel={true}
                                  size="sm"
                                  variant={c.status === 'completed' ? 'emerald' : c.status === 'processing' ? 'amber' : 'default'}
                                />
                              </div>

                              {/* Paginated Logs Area (Expanded) */}
                              {isExpanded && (
                                <div className="pt-3 border-t border-border/40 space-y-3">
                                  {/* Embedded TaskSteps for this campaign */}
                                  <TaskSteps
                                    steps={getCampaignPipelineSteps(c).steps}
                                    current={getCampaignPipelineSteps(c).current}
                                    label={`ขั้นตอนกระบวนการของรายการนี้ (${c.status})`}
                                  />
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <h4 className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                                      <AlertCircle className="w-4 h-4 text-muted-foreground" /> ผลการจัดส่งรายคน (หน้า {logsPage} / {totalLogPages})
                                    </h4>
                                    
                                    <div className="relative w-full sm:w-60">
                                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                                      <Input
                                        value={logSearchQuery}
                                        onChange={(e) => setLogSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchCampaignLogs(c.id, 1)}
                                        placeholder="ค้นหา User ID หรือชื่อ..."
                                        className="pl-8 h-7 text-xs rounded-xl"
                                      />
                                    </div>
                                  </div>

                                  {loadingLogs ? (
                                    <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">กำลังโหลดบันทึก...</div>
                                  ) : campaignLogs.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl">ไม่พบรายการ Log</div>
                                  ) : (
                                    <div className="border border-[#EAD8C8] dark:border-[#2D2520] rounded-xl overflow-hidden bg-white dark:bg-[#1E1B18]">
                                      <Table>
                                        <TableHeader className="bg-[#FAF6F0]/40 dark:bg-[#25201C]/40">
                                          <TableRow className="h-8">
                                            <TableHead className="text-xs font-bold">User ID</TableHead>
                                            <TableHead className="text-xs font-bold">ชื่อสมาชิก</TableHead>
                                            <TableHead className="text-xs font-bold">สถานะการส่ง</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {campaignLogs.map((log) => (
                                            <TableRow key={log.id} className="h-8 text-xs">
                                              <TableCell className="font-mono text-xs truncate max-w-[120px]">{log.user_id}</TableCell>
                                              <TableCell className="truncate max-w-[120px]">{log.username || '-'}</TableCell>
                                              <TableCell>
                                                {log.status === 'success' ? (
                                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">สำเร็จ</Badge>
                                                ) : log.status === 'failed' ? (
                                                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]" title={log.error_message || ''}>
                                                    ล้มเหลว ({log.error_message || 'Closed DM'})
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">รอส่ง</Badge>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}

                                  {/* Pagination Controls for Logs */}
                                  <div className="flex justify-between items-center pt-2">
                                    <span className="text-xs text-muted-foreground">รวมทั้งหมด {logsTotalCount} รายการ</span>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" disabled={logsPage <= 1} onClick={() => fetchCampaignLogs(c.id, logsPage - 1)}>
                                        <ChevronLeft className="w-3.5 h-3.5" /> ก่อนหน้า
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" disabled={logsPage >= totalLogPages} onClick={() => fetchCampaignLogs(c.id, logsPage + 1)}>
                                        ถัดไป <ChevronRight className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Pagination Controls for Campaigns */}
                    {totalCampaignPages > 1 && (
                      <div className="flex justify-between items-center pt-3 border-t border-[#EAD8C8] dark:border-[#2D2520]">
                        <span className="text-xs text-muted-foreground font-semibold">
                          หน้า {campaignsPage} จาก {totalCampaignPages} (รวม {campaigns.length} รายการ)
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl cursor-pointer" disabled={campaignsPage <= 1} onClick={() => setCampaignsPage(p => p - 1)}>
                            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl cursor-pointer" disabled={campaignsPage >= totalCampaignPages} onClick={() => setCampaignsPage(p => p + 1)}>
                            ถัดไป <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Subscribers List (Paginated) */}
        <TabsContent value="subscribers" className="space-y-6">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[#181412] dark:border-[#2D2420] shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-[#EAD8C8]/60 dark:border-[#2D2420] space-y-3 bg-[#FAF6F0]/40 dark:bg-[#15110E]/40">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" /> ทำเนียบสมาชิกผู้รับข่าวสาร ({filteredMemberSubs.length} คน)
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    รายชื่อผู้ใช้ที่ลงทะเบียนรับข่าวสาร DM แยกตามหมวดหมู่ความสนใจ
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E]"
                    placeholder="ค้นหาชื่อ หรือ Discord ID..."
                    value={memberSearchQuery}
                    onChange={(e) => { setMemberSearchQuery(e.target.value); setMemberPage(1); }}
                  />
                </div>
              </div>

              {/* Quick Filter Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { id: 'all', label: 'ทั้งหมด', count: memberSubs.length },
                  { id: '49B40A9yBS', label: '🎉 กิจกรรม', count: subStats.options['49B40A9yBS'] },
                  { id: 'JNySCX80ja', label: '📢 ประกาศสำคัญ', count: subStats.options['JNySCX80ja'] },
                  { id: 'DsMHlVrjze', label: '📑 ข่าวสารทั่วไป', count: subStats.options['DsMHlVrjze'] },
                  { id: '6io1xnaMWJ', label: '🎁 โปรโมชัน', count: subStats.options['6io1xnaMWJ'] },
                ].map((chip) => {
                  const isActive = filterOption === chip.id;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => { setFilterOption(chip.id); setMemberPage(1); }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border",
                        isActive
                          ? "bg-amber-500 text-stone-950 border-amber-500 shadow-xs font-bold"
                          : "bg-white/80 dark:bg-[#201A17] text-stone-700 dark:text-stone-300 border-[#EAD8C8] dark:border-[#2D2420] hover:border-amber-500/40 hover:bg-amber-500/5"
                      )}
                    >
                      <span>{chip.label}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px]",
                        isActive ? "bg-stone-950/20 text-stone-950 font-bold" : "bg-stone-200 dark:bg-[#2A221E] text-stone-600 dark:text-stone-400"
                      )}>
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {loadingMembers ? (
                <div className="text-center py-12 text-muted-foreground animate-pulse text-xs">กำลังโหลดรายชื่อสมาชิก...</div>
              ) : paginatedMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-[#EAD8C8] dark:border-[#2D2420] rounded-2xl">
                  ไม่พบสมาชิกตามเงื่อนไขที่ค้นหา
                </div>
              ) : (
                <div className="border border-[#EAD8C8] dark:border-[#2D2420] rounded-2xl overflow-hidden bg-white dark:bg-[#14100E]">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]/60 dark:bg-[#1E1815]">
                      <TableRow className="border-b border-[#EAD8C8] dark:border-[#2D2420]">
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">สมาชิก (Member)</TableHead>
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">หมวดหมู่ที่ติดตาม</TableHead>
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">ลงทะเบียนเมื่อ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMembers.map((sub) => (
                        <TableRow key={sub.userId} className="text-xs border-b border-[#EAD8C8]/60 dark:border-[#2D2420]/60 hover:bg-amber-500/5 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {(sub.username || sub.discordUsername || 'U').slice(0, 2)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-[#4E3F30] dark:text-[#F3EDE6] text-xs">
                                  {sub.username ? `@${sub.username}` : (sub.discordUsername ? `@${sub.discordUsername}` : 'สมาชิก Discord')}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-muted-foreground font-mono">{sub.userId}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(sub.userId);
                                      setCopiedUserId(sub.userId);
                                      setTimeout(() => setCopiedUserId(null), 2000);
                                      toast({ title: 'คัดลอก Discord ID แล้ว' });
                                    }}
                                    className="text-stone-400 hover:text-amber-500 transition-colors p-0.5 cursor-pointer"
                                    title="คัดลอก Discord ID"
                                  >
                                    {copiedUserId === sub.userId ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {sub.options.map((opt) => (
                                <Badge key={opt} variant="outline" className="text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-[#FAF6F0] dark:bg-[#201A17] border-[#EAD8C8] dark:border-[#2D2420]">
                                  {opt === '49B40A9yBS' && '🎉 กิจกรรม'}
                                  {opt === 'JNySCX80ja' && '📢 ประกาศสำคัญ'}
                                  {opt === 'DsMHlVrjze' && '📑 ข่าวสารทั่วไป'}
                                  {opt === '6io1xnaMWJ' && '🎁 โปรโมชัน'}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                            {new Date(sub.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  หน้า {memberPage} จาก {totalMemberPages} (รวม {filteredMemberSubs.length} รายการ)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl cursor-pointer" disabled={memberPage <= 1} onClick={() => setMemberPage(m => m - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" /> ก่อนหน้า
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl cursor-pointer" disabled={memberPage >= totalMemberPages} onClick={() => setMemberPage(m => m + 1)}>
                    ถัดไป <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Cyber Console Terminal & DB Cleaner */}
        <TabsContent value="logs" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            
            {/* DB Log Cleanup Tool */}
            <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[#181412] dark:border-[#2D2420] shadow-xs rounded-3xl">
              <CardHeader className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-500" /> เครื่องมือจัดการพื้นที่ฐานข้อมูล (Database Log Cleaner)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    ล้างประวัติการส่งบรอดแคสต์เก่าที่สำเร็จแล้วเกิน 14 วัน เพื่อรักษาความเร็วของฐานข้อมูล Supabase
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs gap-1.5 font-bold cursor-pointer shrink-0"
                  onClick={handleCleanOldLogs}
                  disabled={cleaningLogs}
                >
                  {cleaningLogs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  🗑️ ล้าง Log ซากบรอดแคสต์เก่า (&gt; 14 วัน)
                </Button>
              </CardHeader>
            </Card>

            {/* Cyber Console Terminal */}
            <div className="rounded-3xl border border-[#2D2420] bg-[#12100E] text-stone-300 shadow-2xl overflow-hidden font-mono text-xs">
              
              {/* Window Header with macOS Dots & Status */}
              <div className="px-5 py-3.5 bg-[#181412] border-b border-[#2D2420] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block shadow-xs" />
                  </div>
                  <div className="h-4 w-px bg-[#2D2420]" />
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-stone-200 tracking-wider">
                      BEAR-CAFE TELEMETRY CONSOLE :: LIVE STREAM
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ONLINE
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#2D2420] bg-[#1E1815] text-stone-300 hover:bg-[#2A221E] cursor-pointer"
                    onClick={() => {
                      const allText = systemLogs.map(l => `[${new Date(l.created_at).toLocaleTimeString('th-TH')}] [${l.level?.toUpperCase() || 'INFO'}] ${l.message_th}`).join('\n');
                      navigator.clipboard.writeText(allText);
                      toast({ title: 'คัดลอกบันทึกทั้งหมดแล้ว' });
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> คัดลอกทั้งหมด
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-[#2D2420] bg-[#1E1815] text-stone-300 hover:bg-[#2A221E] cursor-pointer" onClick={fetchSystemLogs}>
                    <RefreshCw className="w-3 h-3 mr-1" /> รีเฟรช
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer" onClick={handleClearSystemLogs}>
                    ล้างหน้าจอ
                  </Button>
                </div>
              </div>

              {/* Subheader: Filter Chips & Auto-Scroll Toggle */}
              <div className="px-5 py-2.5 bg-[#14100E] border-b border-[#2D2420]/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-stone-500 text-[10px] uppercase font-bold mr-1">ระดับ:</span>
                  {[
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'info', label: 'ℹ️ ข้อมูล' },
                    { id: 'success', label: '✅ สำเร็จ' },
                    { id: 'warn', label: '⚠️ เตือน' },
                    { id: 'error', label: '❌ ผิดพลาด' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      onClick={() => setLogLevelFilter(lvl.id as any)}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer border",
                        logLevelFilter === lvl.id
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-transparent text-stone-400 border-transparent hover:text-stone-200"
                      )}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-stone-400 text-[11px] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={logAutoScroll}
                      onChange={(e) => setLogAutoScroll(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-500 rounded"
                    />
                    <span>เลื่อนตามอัตโนมัติ (Auto-scroll)</span>
                  </label>
                </div>
              </div>

              {/* Terminal Logs Stream Screen */}
              <div className="p-5 max-h-96 overflow-y-auto space-y-1.5 [scrollbar-width:thin] bg-[#12100E]">
                {(() => {
                  const filteredLogs = systemLogs.filter(log => {
                    if (logLevelFilter === 'all') return true;
                    return log.level === logLevelFilter;
                  });

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-12 text-stone-500 text-xs italic">
                        {systemLogs.length === 0 
                          ? 'ยังไม่มีบันทึกสถานะจากบอท (บอทจะส่งรายงานสถานะภาษาไทยมาที่นี่เมื่อเริ่มทำงาน)'
                          : 'ไม่พบบันทึกในระดับที่เลือก'}
                      </div>
                    );
                  }

                  return (
                    <>
                      {filteredLogs.map((log) => {
                        const levelConfig =
                          log.level === 'error' ? { badge: 'ERR', color: 'text-rose-400 bg-rose-950/40 border-rose-900/50' } :
                          log.level === 'warn' ? { badge: 'WRN', color: 'text-amber-300 bg-amber-950/40 border-amber-900/50' } :
                          log.level === 'success' ? { badge: 'OK ', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50' } :
                          { badge: 'INF', color: 'text-sky-300 bg-sky-950/30 border-sky-900/40' };

                        return (
                          <div 
                            key={log.id} 
                            className="flex items-start gap-2.5 leading-relaxed py-1 px-2 rounded-lg hover:bg-white/[0.03] transition-colors border border-transparent hover:border-white/[0.05]"
                          >
                            <span className="text-stone-500 text-[10px] shrink-0 select-none">
                              {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className={cn("px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0", levelConfig.color)}>
                              {levelConfig.badge}
                            </span>
                            <span className="text-stone-200 flex-1 break-words font-sans text-xs">
                              {log.message_th}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={terminalEndRef} />
                    </>
                  );
                })()}
              </div>

              {/* Terminal Footer Info */}
              <div className="px-5 py-2 bg-[#181412] border-t border-[#2D2420] text-[10px] text-stone-500 flex justify-between items-center">
                <span>เก็บบันทึก {systemLogs.length} รายการล่าสุด</span>
                <span className="text-amber-500/80">Bear Cafe Bot Telemetry v2.4</span>
              </div>
            </div>

          </div>
        </TabsContent>

      </Tabs>

      {/* JSON Payload Viewer Modal */}
      {jsonViewCampaign && (() => {
        const formattedPayload = getFormattedJson(jsonViewCampaign.message_payload);
        return (
          <Dialog open onOpenChange={open => !open && setJsonViewCampaign(null)}>
            <DialogContent className="max-w-2xl bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6 shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
                  <Code className="w-5 h-5 text-blue-500" />
                  JSON Payload: {jsonViewCampaign.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  โครงสร้างข้อมูล JSON ที่ใช้ส่งไปยัง Discord DM API สำหรับงานบรอดแคสต์นี้
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <pre className="bg-[#1E1B18] text-emerald-400 p-4 rounded-2xl overflow-x-auto font-mono text-xs max-h-96 border border-[#2D2520] select-all shadow-inner leading-relaxed whitespace-pre-wrap break-words">
                  {formattedPayload}
                </pre>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(formattedPayload);
                    toast({ title: 'คัดลอก JSON สำเร็จแล้วค่ะ', description: 'คัดลอกโครงสร้าง JSON Payload เข้าสู่คลิปบอร์ดแล้ว' });
                  }}
                  className="rounded-xl border-[#EFE7DC] dark:border-[#2D2520] text-xs font-bold h-9 gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[#8C6239]" /> คัดลอก JSON
                </Button>
                <Button
                  onClick={() => setJsonViewCampaign(null)}
                  className="rounded-xl bg-[#8C6239] hover:bg-[#74502D] text-white text-xs font-bold h-9 cursor-pointer"
                >
                  ปิดหน้าต่าง
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
