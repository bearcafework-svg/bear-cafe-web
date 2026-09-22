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
  SelectItem,
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
  trigger_config: Record<string, any>;
  active: boolean;
  created_at?: string;
  updated_at?: string;
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
  { value: 'reaction_add', label: 'กดรีแอ็กชันข้อความ (reaction_add)', category: 'community' },
  { value: 'command_usage', label: 'เรียกใช้คำสั่งบอท (command_usage)', category: 'community' },
  { value: 'irl_manual', label: 'ถ่ายรูปกิจกรรม IRL ส่งห้องที่กำหนด (irl_manual)', category: 'irl' },
];

const KNOWN_CHANNELS: Record<string, string> = {
  '1524124012492619847': 'สุ่มคำถาม',
  '1529885509260673034': 'ภารกิจประจำวัน',
  '1524123147987714158': 'แจ้งเตือนเควส',
};

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

  // Daily Set state
  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDateString());
  const [currentSet, setCurrentSet] = useState<DailyQuestSet | null>(null);

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
  const [formActive, setFormActive] = useState(true);

  // Delete Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<QuestTemplate | null>(null);

  // Send Component Announcement Dialog State
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (activeTab === 'sets') {
      fetchSetForDate(selectedDate);
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, selectedDate, fetchSetForDate, fetchAnalytics]);

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
    setFormRewardPoints(5);
    setFormActive(true);
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
    setFormRewardPoints(t.reward_points);
    setFormActive(t.active);
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
      const payload = {
        code: formCode.trim(),
        category: formCategory,
        title: formTitle.trim(),
        description: formDescription.trim(),
        trigger_type: formTriggerType,
        target_count: Number(formTargetCount) || 1,
        reward_points: Number(formRewardPoints) || 5,
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

  // Reroll Daily Quest Set (All 3: 1 chat, 1 voice/community, 1 irl)
  const handleRerollDailySet = async () => {
    try {
      setActionLoading(true);
      const activeChat = templates.filter((t) => t.category === 'chat' && t.active);
      const activeVoiceComm = templates.filter((t) => (t.category === 'voice' || t.category === 'community') && t.active);
      const activeIrl = templates.filter((t) => t.category === 'irl' && t.active);

      if (!activeChat.length || !activeVoiceComm.length || !activeIrl.length) {
        toast({
          title: 'ไม่สามารถสุ่มชุดเควสได้',
          description: 'ต้องมีเควสที่เปิดใช้งานอยู่อย่างน้อย 1 เควสในแต่ละหมวดหมู่ (Chat, Voice/Community, IRL)',
          variant: 'destructive',
        });
        return;
      }

      const randomChat = activeChat[Math.floor(Math.random() * activeChat.length)];
      const randomVoiceComm = activeVoiceComm[Math.floor(Math.random() * activeVoiceComm.length)];
      const randomIrl = activeIrl[Math.floor(Math.random() * activeIrl.length)];

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
      toast({
        title: 'สุ่มชุดเควสใหม่สำเร็จ!',
        description: `ชุดเควสประจำวันที่ ${selectedDate} ได้รับการบันทึกเรียบร้อยแล้ว`,
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

  // Swap Single Quest in Current Set
  const handleSwapQuestInSet = async (categoryGroup: 'chat' | 'voice_comm' | 'irl') => {
    if (!currentSet) return;
    try {
      setActionLoading(true);
      let candidates: QuestTemplate[] = [];

      if (categoryGroup === 'chat') {
        candidates = templates.filter((t) => t.category === 'chat' && t.active && !currentSet.quest_ids.includes(t.id));
      } else if (categoryGroup === 'voice_comm') {
        candidates = templates.filter((t) => (t.category === 'voice' || t.category === 'community') && t.active && !currentSet.quest_ids.includes(t.id));
      } else {
        candidates = templates.filter((t) => t.category === 'irl' && t.active && !currentSet.quest_ids.includes(t.id));
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

      // Find index to replace
      const oldIndex = currentSet.quest_ids.findIndex((id) => {
        const t = templates.find((tmp) => tmp.id === id);
        if (!t) return false;
        if (categoryGroup === 'chat') return t.category === 'chat';
        if (categoryGroup === 'voice_comm') return t.category === 'voice' || t.category === 'community';
        return t.category === 'irl';
      });

      const newQuestIds = [...currentSet.quest_ids];
      if (oldIndex >= 0) {
        newQuestIds[oldIndex] = newQuest.id;
      } else {
        newQuestIds.push(newQuest.id);
      }

      const { data, error } = await supabase
        .from('daily_quest_sets' as any)
        .update({ quest_ids: newQuestIds })
        .eq('id', currentSet.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentSet(data as DailyQuestSet);
      toast({
        title: 'เปลี่ยนเควสสำเร็จ',
        description: `เปลี่ยนเป็น: ${newQuest.title}`,
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
      questComponents.push({
        type: 10,
        content: `## ${q.title}\n- __\`วิธีทำเควส\`__ : ${q.description}\n- __\`รางวัล\`__ : <:strawberryv2:1520439075100688614> **+${q.reward_points}**`,
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
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    คลังแม่แบบเควส ({filteredTemplates.length} รายการ)
                  </CardTitle>
                  <CardDescription>
                    เพิ่ม แก้ไข และกำหนดเงื่อนไขภารกิจที่จะถูกนำไปสุ่มประกาศในแต่ละวัน
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={fetchTemplates} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
                    รีเฟรช
                  </Button>
                  <Button onClick={handleOpenCreate} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="w-4 h-4 mr-1.5" />
                    เพิ่มเควสใหม่
                  </Button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, คำอธิบาย หรือ Code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="หมวดหมู่ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">หมวดหมู่ทั้งหมด</SelectItem>
                    <SelectItem value="chat">💬 แชท (Chat)</SelectItem>
                    <SelectItem value="voice">🎙️ ห้องเสียง (Voice)</SelectItem>
                    <SelectItem value="community">👥 กิจกรรมชุมชน (Community)</SelectItem>
                    <SelectItem value="irl">📸 ชีวิตจริง (IRL)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="สถานะทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                    <SelectItem value="active">เปิดใช้งานเท่านั้น</SelectItem>
                    <SelectItem value="inactive">ปิดใช้งานเท่านั้น</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[150px]">หมวดหมู่</TableHead>
                      <TableHead>ชื่อเควส & คำอธิบาย</TableHead>
                      <TableHead className="w-[180px]">เงื่อนไข / ทริกเกอร์</TableHead>
                      <TableHead className="w-[90px] text-center">เป้าหมาย</TableHead>
                      <TableHead className="w-[100px] text-center">รางวัล</TableHead>
                      <TableHead className="w-[100px] text-center">เปิด/ปิด</TableHead>
                      <TableHead className="w-[110px] text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่พบเควสที่ตรงกับเงื่อนไขการค้นหา'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTemplates.map((t) => {
                        const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.chat;
                        const CatIcon = cat.icon;
                        return (
                          <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs font-medium py-0.5 gap-1.5', cat.badgeColor)}>
                                <CatIcon className="w-3 h-3" />
                                {cat.label}
                              </Badge>
                              <div className="text-[11px] text-muted-foreground font-mono mt-1 truncate max-w-[130px]">
                                {t.code}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="font-semibold text-sm text-foreground">{t.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {renderDescriptionWithMentions(t.description)}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="secondary" className="text-[11px] font-mono font-normal">
                                {t.trigger_type}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-center">
                              <span className="font-bold text-foreground">{formatNumber(t.target_count)}</span>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold gap-1">
                                🍓 +{t.reward_points}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-center">
                              <Switch
                                checked={t.active}
                                onCheckedChange={() => handleToggleActive(t)}
                              />
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-muted"
                                  onClick={() => handleOpenEdit(t)}
                                  title="แก้ไขเควส"
                                >
                                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setDeletingTemplate(t);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  title="ลบเควส"
                                >
                                  <Trash2 className="w-4 h-4" />
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
            </CardContent>
          </Card>
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
                <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Clock className="w-4 h-4 text-amber-500" />
                    เวลารีเซ็ต & ประกาศ
                  </div>
                  <p className="text-sm font-medium">รีเซ็ต 00:00 น. | ประกาศ 08:00 น.</p>
                  <p className="text-xs text-muted-foreground">เวลาประเทศไทย (GMT+7) ทุกวัน</p>
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

              {/* Set Display or Empty State */}
              {!currentSet || currentSetTemplates.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-2xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">ยังไม่มีการกำหนดชุดเควสสำหรับวันที่ {selectedDate}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      คุณสามารถกดปุ่มสุ่มด้านล่างเพื่อให้ระบบเลือก 3 เควสที่เปิดใช้งานสำหรับวันนี้
                    </p>
                  </div>
                  <Button
                    onClick={handleRerollDailySet}
                    disabled={actionLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    สุ่มสร้างชุดเควสทันที
                  </Button>
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
                      >
                        <Shuffle className="w-4 h-4 mr-2 text-amber-600" />
                        สุ่มใหม่ทั้ง 3 เควส
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
                              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none font-bold text-xs">
                                🍓 +{quest.reward_points}
                              </Badge>
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
                            </div>

                            <Button
                              onClick={() => handleSwapQuestInSet(swapGroup)}
                              variant="outline"
                              size="sm"
                              className="w-full text-xs hover:bg-muted"
                              disabled={actionLoading}
                            >
                              <Shuffle className="w-3 h-3 mr-1.5 text-muted-foreground" />
                              สลับเควสหมวดนี้
                            </Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-500" />
              {editingTemplate ? 'แก้ไขเควสแม่แบบ' : 'เพิ่มเควสแม่แบบใหม่'}
            </DialogTitle>
            <DialogDescription>
              กำหนดรายละเอียดและเงื่อนไขของเควสที่ต้องการให้สมาชิกทำใน Discord
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">หมวดหมู่เควส</label>
              <Select
                value={formCategory}
                onValueChange={(val: any) => {
                  setFormCategory(val);
                  if (!editingTemplate) {
                    if (val === 'voice') {
                      setFormTriggerType('voice_duration');
                      setFormTargetCount(15);
                    } else if (val === 'community') {
                      setFormTriggerType('reaction_add');
                      setFormTargetCount(3);
                    } else if (val === 'irl') {
                      setFormTriggerType('irl_manual');
                      setFormTargetCount(1);
                    } else {
                      setFormTriggerType('chat_any');
                      setFormTargetCount(5);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">💬 แชท (Chat)</SelectItem>
                  <SelectItem value="voice">🎙️ ห้องเสียง (Voice)</SelectItem>
                  <SelectItem value="community">👥 ชุมชน (Community)</SelectItem>
                  <SelectItem value="irl">📸 ชีวิตจริง (IRL)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">รหัสเควส (Code)</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="เช่น morning_bear หรือ chat_any_10"
                disabled={!!editingTemplate}
                className="font-mono text-xs"
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">ชื่อภารกิจ</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="เช่น 🌞 ︰ Morning Bear"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">คำอธิบายภารกิจ</label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="เช่น พิมพ์คำว่า อรุณสวัสดิ์ หรือ มอนิ่ง ในช่องแชท"
              />
            </div>

            {/* Trigger Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">เงื่อนไขการทำงาน (Trigger Type)</label>
              <Select value={formTriggerType} onValueChange={setFormTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.filter((t) => t.category === formCategory).map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>
                      {tt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Count & Reward Points */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">จำนวนเป้าหมาย</label>
                <Input
                  type="number"
                  min="1"
                  value={formTargetCount}
                  onChange={(e) => setFormTargetCount(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">รางวัลสตรอว์เบอร์รี (🍓)</label>
                <Input
                  type="number"
                  min="1"
                  value={formRewardPoints}
                  onChange={(e) => setFormRewardPoints(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
              <span className="text-xs font-medium text-foreground">เปิดใช้งาน</span>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={actionLoading}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveTemplate} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {actionLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </DialogFooter>
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
    </div>
  );
}
