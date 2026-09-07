import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionAdsManagement } from '@/components/admin/SessionAdsManagement';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GripVertical,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Eye,
  Loader2,
  Clock,
  RotateCcw,
  Images,
  Megaphone,
  Search,
  Save,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Copy,
  FileCode,
  Send,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Hash,
  Layers,
  Wand2,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DiscordUniversalPreview,
  normalizeDiscordPayload,
  DISCORD_AI_PROMPT_TEMPLATE,
  CAMPAIGN_JSON_PRESETS,
} from '@/components/admin/DiscordUniversalPreview';

// ============================================================================
// Types
// ============================================================================

type BroadcastAdMessage = {
  id: string;
  internal_name: string;
  payload: any;
  target_channels: string[];
  sort_order: number;
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
};

type ScheduleConfig = {
  id: string;
  cron_expression: string;
  label: string;
  is_enabled: boolean;
  interval_hours: number;
  interval_minutes: number;
  updated_at: string;
};

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
}

interface FormData {
  internal_name: string;
  payloadStr: string;
  target_channels: string[];
  is_active: boolean;
}

const DEFAULT_JSON = CAMPAIGN_JSON_PRESETS[0].json;

const INITIAL_FORM: FormData = {
  internal_name: '',
  payloadStr: DEFAULT_JSON,
  target_channels: [],
  is_active: true,
};

// ============================================================================
// Main Component: CampaignsManagement
// ============================================================================

export function CampaignsManagement() {
  const [campaigns, setCampaigns] = useState<BroadcastAdMessage[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BroadcastAdMessage | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<BroadcastAdMessage | null>(null);
  const [previewTab, setPreviewTab] = useState<'visual' | 'json'>('visual');
  const [composerTab, setComposerTab] = useState<'editor' | 'preview'>('editor');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [channelSearch, setChannelSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isResettingQueue, setIsResettingQueue] = useState(false);

  // Test Send state
  const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
  const [testSendCampaign, setTestSendCampaign] = useState<BroadcastAdMessage | null>(null);
  const [testSendPayload, setTestSendPayload] = useState<any>(null);
  const [testSendChannelId, setTestSendChannelId] = useState<string>('');
  const [customTestChannelId, setCustomTestChannelId] = useState<string>('');
  const [isTestSending, setIsTestSending] = useState(false);

  const { toast } = useToast();

  // ── Countdown Tick ──────────────────────────────────────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Sync Channels from Discord ──────────────────────────────────────────────
  const syncChannels = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoadingChannels(true);
        const { data, error } = await supabase.functions.invoke('sync-discord-channels');
        if (error) throw error;
        if (data?.channels) {
          setChannels(data.channels);
          if (!silent) {
            toast({
              title: 'ซิงค์สำเร็จ',
              description: `ดึงข้อมูลช่องแชทจาก Discord จำนวน ${data.channels.length} ช่องแล้วค่ะ`,
            });
          }
        }
      } catch (err: any) {
        console.error('Error syncing channels:', err);
        if (!silent) {
          toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
        }
      } finally {
        if (!silent) setLoadingChannels(false);
      }
    },
    [toast]
  );

  // ── Fetch Campaigns & Schedule Config ───────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      const [cRes, sRes] = await Promise.all([
        supabase
          .from('campaign_messages')
          .select('*')
          .order('sort_order', { ascending: true }),
        (supabase as any)
          .from('campaign_schedule_config')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle(),
      ]);

      if (cRes.error) throw cRes.error;
      setCampaigns((cRes.data as BroadcastAdMessage[]) || []);
      setHasOrderChanged(false);

      if (sRes.data) {
        const row = sRes.data;
        const totalMins = row.interval_minutes ?? ((row.interval_hours ?? 1) * 60);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;

        setScheduleConfig({
          id: row.id,
          cron_expression: row.cron_expression || '0 * * * *',
          label: row.label || `ทุก ${hrs > 0 ? `${hrs} ชั่วโมง ` : ''}${mins > 0 ? `${mins} นาที` : ''}`,
          is_enabled: row.is_enabled ?? true,
          interval_hours: hrs,
          interval_minutes: mins,
          updated_at: row.updated_at || '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
    syncChannels(true);
  }, [fetchAllData, syncChannels]);

  // ── Filtered campaigns ──────────────────────────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // Status filter
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.internal_name.toLowerCase().includes(q);
      const matchChannel = (c.target_channels || []).some((cid) => {
        const ch = channels.find((x) => x.id === cid);
        return ch ? ch.name.toLowerCase().includes(q) : cid.includes(q);
      });
      return matchName || matchChannel;
    });
  }, [campaigns, searchQuery, statusFilter, channels]);

  // ── Filtered channels for multi-select dropdown ─────────────────────────────
  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(channelSearch.toLowerCase()));
  }, [channels, channelSearch]);

  // ── Open Modals ─────────────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingCampaign(null);
    setFormData(INITIAL_FORM);
    setComposerTab('editor');
    setDialogOpen(true);
  };

  const openEditDialog = (item: BroadcastAdMessage) => {
    setEditingCampaign(item);
    setFormData({
      internal_name: item.internal_name,
      payloadStr: JSON.stringify(item.payload, null, 2),
      target_channels: item.target_channels || [],
      is_active: item.is_active,
    });
    setComposerTab('editor');
    setDialogOpen(true);
  };

  const openPreviewDialog = (item: BroadcastAdMessage) => {
    setPreviewCampaign(item);
    setPreviewTab('visual');
    setPreviewDialogOpen(true);
  };

  const openTestSendDialog = (
    item?: BroadcastAdMessage,
    customPayload?: any,
    defaultChannels?: string[]
  ) => {
    if (item) {
      setTestSendCampaign(item);
      setTestSendPayload(item.payload);
      const defaultChan = item.target_channels?.[0] || channels[0]?.id || '';
      setTestSendChannelId(defaultChan);
    } else if (customPayload) {
      setTestSendCampaign(null);
      setTestSendPayload(customPayload);
      const defaultChan = defaultChannels?.[0] || channels[0]?.id || '';
      setTestSendChannelId(defaultChan);
    }
    setCustomTestChannelId('');
    setTestSendDialogOpen(true);
  };

  // ── Live JSON Validation for Form ───────────────────────────────────────────
  const formValidationResult = useMemo(() => {
    return normalizeDiscordPayload(formData.payloadStr);
  }, [formData.payloadStr]);

  // ── Auto-Format & Sanitize JSON Button Handler ──────────────────────────────
  const handleAutoFormatJSON = () => {
    const res = normalizeDiscordPayload(formData.payloadStr);
    if (!res.isValid || !res.normalized) {
      toast({
        title: 'จัดรูปแบบไม่สำเร็จ',
        description: res.error || 'โปรดตรวจสอบไวยากรณ์ JSON',
        variant: 'destructive',
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      payloadStr: JSON.stringify(res.normalized, null, 2),
    }));

    toast({
      title: '✨ จัดรูปแบบและซ่อมแซมสำเร็จ',
      description: 'ปรับโครงสร้างให้ได้มาตรฐาน Discord Component v2 เรียบร้อยแล้วค่ะ',
      className: 'bg-emerald-600 text-white',
    });
  };

  // ── Copy AI Prompt Helper ───────────────────────────────────────────────────
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(DISCORD_AI_PROMPT_TEMPLATE);
    toast({
      title: 'คัดลอกคำสั่งเรียบร้อย',
      description: 'สามารถนำ Prompt ไปวางใน ChatGPT/Gemini เพื่อจัดรูปแบบ JSON ได้ทันทีค่ะ',
    });
  };

  // ── Execute Test Send ───────────────────────────────────────────────────────
  const handleExecuteTestSend = async () => {
    const finalChannelId = (testSendChannelId === 'custom' ? customTestChannelId : testSendChannelId).trim();
    if (!finalChannelId) {
      toast({ title: 'กรุณาเลือกหรือกรอก ID ช่อง Discord ที่ต้องการส่งทดสอบ', variant: 'destructive' });
      return;
    }
    if (!testSendPayload) {
      toast({ title: 'ไม่พบ JSON Payload สำหรับส่งทดสอบ', variant: 'destructive' });
      return;
    }

    // Auto normalize payload before sending
    const norm = normalizeDiscordPayload(testSendPayload);
    const cleanPayload = norm.isValid && norm.normalized ? norm.normalized : testSendPayload;

    setIsTestSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'กรุณาเข้าสู่ระบบก่อน', variant: 'destructive' });
        setIsTestSending(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast-test`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({
            channel_id: finalChannelId,
            payload: cleanPayload,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.details || json.error || `HTTP ${res.status}`);
      }

      toast({
        title: '✅ ส่งข้อความทดสอบสำเร็จ!',
        description: `ส่งข้อความไปยังช่อง Discord (${finalChannelId}) เรียบร้อยแล้วค่ะ`,
        className: 'bg-emerald-600 text-white',
      });
      setTestSendDialogOpen(false);
    } catch (err: any) {
      toast({
        title: '❌ ส่งข้อความทดสอบไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการส่งไปยัง Discord',
        variant: 'destructive',
      });
    } finally {
      setIsTestSending(false);
    }
  };

  // ── Toggle Active Switch Quick Action ───────────────────────────────────────
  const handleToggleActive = async (item: BroadcastAdMessage) => {
    try {
      const nextState = !item.is_active;
      const totalInterval = (scheduleConfig?.interval_hours ?? 0) * 60 + (scheduleConfig?.interval_minutes ?? 0);
      const intervalMs = (totalInterval > 0 ? totalInterval : 60) * 60 * 1000;

      const updateData: { is_active: boolean; next_send_at?: string } = { is_active: nextState };
      if (nextState) {
        const isPastOrNull = !item.next_send_at || new Date(item.next_send_at).getTime() <= Date.now();
        if (isPastOrNull) {
          updateData.next_send_at = new Date(Date.now() + intervalMs).toISOString();
        }
      }

      const { error } = await supabase
        .from('campaign_messages')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      setCampaigns((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, ...updateData } : c))
      );

      toast({
        title: 'อัปเดตสถานะสำเร็จ',
        description: `${item.internal_name}: ${nextState ? 'เปิดใช้งานในคิวแล้ว' : 'ปิดการใช้งานแล้ว'}`,
      });
    } catch (err: any) {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    }
  };

  // ── Save Order (Drag Drop & Arrows) ─────────────────────────────────────────
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= campaigns.length) return;

    const newItems = Array.from(campaigns);
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    const reindexed = newItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setCampaigns(reindexed);
    setHasOrderChanged(true);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const items = Array.from(campaigns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reindexed = items.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setCampaigns(reindexed);
    setHasOrderChanged(true);
  };

  const saveOrderAndResetQueue = async () => {
    try {
      setSavingOrder(true);

      for (let i = 0; i < campaigns.length; i++) {
        const item = campaigns[i];
        const { error } = await supabase
          .from('campaign_messages')
          .update({ sort_order: i + 1 })
          .eq('id', item.id);
        if (error) throw error;
      }

      // Reset queue schedule
      const totalInterval = (scheduleConfig?.interval_hours ?? 0) * 60 + (scheduleConfig?.interval_minutes ?? 0);
      const intervalMs = (totalInterval > 0 ? totalInterval : 60) * 60 * 1000;
      const now = new Date();

      const activeList = campaigns.filter((c) => c.is_active);
      for (let i = 0; i < activeList.length; i++) {
        const nextTime = new Date(now.getTime() + (i + 1) * intervalMs);
        await supabase
          .from('campaign_messages')
          .update({ next_send_at: nextTime.toISOString() })
          .eq('id', activeList[i].id);
      }

      toast({
        title: 'บันทึกลำดับเรียบร้อยแล้ว',
        description: 'จัดลำดับโฆษณาบรอดแคสต์และคิวเวลาใหม่สำเร็จค่ะ',
        className: 'bg-emerald-600 text-white',
      });
      setHasOrderChanged(false);
      fetchAllData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึกลำดับ', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingOrder(false);
    }
  };

  // ── Form Validation & Submission ────────────────────────────────────────────
  const validateAndNormalizeForm = (): { payloadObj: any } | null => {
    if (!formData.internal_name.trim()) {
      toast({ title: 'กรุณากรอกชื่อโฆษณา (อ้างอิงภายใน)', variant: 'destructive' });
      return null;
    }
    if (formData.target_channels.length === 0) {
      toast({ title: 'กรุณาเลือกช่องแชทเป้าหมายอย่างน้อย 1 ช่อง', variant: 'destructive' });
      return null;
    }

    const norm = normalizeDiscordPayload(formData.payloadStr);
    if (!norm.isValid || !norm.normalized) {
      toast({
        title: 'JSON รูปแบบไม่ถูกต้อง',
        description: norm.error || 'โปรดตรวจสอบไวยากรณ์ JSON',
        variant: 'destructive',
      });
      return null;
    }

    return { payloadObj: norm.normalized };
  };

  const handleSaveCampaign = async () => {
    const valid = validateAndNormalizeForm();
    if (!valid) return;

    try {
      const payloadObj = valid.payloadObj;

      if (editingCampaign) {
        // Edit existing
        const updateData: any = {
          internal_name: formData.internal_name.trim(),
          payload: payloadObj,
          target_channels: formData.target_channels,
          is_active: formData.is_active,
        };

        if (formData.is_active) {
          const isPastOrNull = !editingCampaign.next_send_at || new Date(editingCampaign.next_send_at).getTime() <= Date.now();
          if (isPastOrNull) {
            const totalInterval = (scheduleConfig?.interval_hours ?? 0) * 60 + (scheduleConfig?.interval_minutes ?? 0);
            const intervalMs = (totalInterval > 0 ? totalInterval : 60) * 60 * 1000;
            updateData.next_send_at = new Date(Date.now() + intervalMs).toISOString();
          }
        }

        const { error } = await supabase
          .from('campaign_messages')
          .update(updateData)
          .eq('id', editingCampaign.id);

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'แก้ไขโฆษณาบรอดแคสต์เรียบร้อยแล้วค่ะ' });
      } else {
        // Create new
        const maxSort = campaigns.length === 0 ? -1 : Math.max(...campaigns.map((c) => Number(c.sort_order) || 0));
        const totalInterval = (scheduleConfig?.interval_hours ?? 0) * 60 + (scheduleConfig?.interval_minutes ?? 0);
        const intervalMs = (totalInterval > 0 ? totalInterval : 60) * 60 * 1000;

        let newNextSendAt: string | null = null;
        if (formData.is_active) {
          const activeWithTime = campaigns.filter((c) => c.is_active && c.next_send_at);
          let targetTime = Date.now() + intervalMs;
          if (activeWithTime.length > 0) {
            const maxTimestamp = Math.max(...activeWithTime.map((c) => new Date(c.next_send_at!).getTime()));
            targetTime = Math.max(Date.now() + intervalMs, maxTimestamp + intervalMs);
          }
          newNextSendAt = new Date(targetTime).toISOString();
        }

        const { error } = await supabase.from('campaign_messages').insert({
          internal_name: formData.internal_name.trim(),
          payload: payloadObj,
          target_channels: formData.target_channels,
          sort_order: maxSort + 1,
          is_active: formData.is_active,
          next_send_at: newNextSendAt,
        });

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'สร้างโฆษณาบรอดแคสต์เรียบร้อยแล้วค่ะ' });
      }

      setDialogOpen(false);
      fetchAllData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโฆษณาบรอดแคสต์นี้?')) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('campaign_messages').delete().eq('id', id);
      if (error) throw error;

      // Re-index remaining campaigns
      const remaining = campaigns.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        const reindexPromises = remaining.map((item, idx) =>
          supabase.from('campaign_messages').update({ sort_order: idx + 1 }).eq('id', item.id)
        );
        await Promise.all(reindexPromises);
      }

      toast({ title: 'ลบสำเร็จ', description: 'ลบโฆษณาบรอดแคสต์เรียบร้อยแล้วค่ะ' });
      fetchAllData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Save Schedule Config ────────────────────────────────────────────────────
  const handleSaveScheduleConfig = async () => {
    try {
      setIsUpdatingSchedule(true);
      const hours = scheduleConfig?.interval_hours ?? 0;
      const minutes = scheduleConfig?.interval_minutes ?? 0;
      const enabled = scheduleConfig?.is_enabled ?? true;
      const totalMinutes = Math.max(1, hours * 60 + minutes);

      const { error } = await (supabase as any)
        .from('campaign_schedule_config')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          interval_hours: Math.floor(totalMinutes / 60),
          interval_minutes: totalMinutes,
          is_enabled: enabled,
          label: `ทุก ${hours > 0 ? `${hours} ชั่วโมง ` : ''}${minutes > 0 ? `${minutes} นาที` : ''}`,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Automatically recalculate active campaign queue times based on new interval
      const intervalMs = totalMinutes * 60 * 1000;
      const now = new Date();
      const activeList = campaigns.filter((c) => c.is_active);
      for (let i = 0; i < activeList.length; i++) {
        const nextTime = new Date(now.getTime() + (i + 1) * intervalMs);
        await supabase
          .from('campaign_messages')
          .update({ next_send_at: nextTime.toISOString() })
          .eq('id', activeList[i].id);
      }

      toast({ title: 'สำเร็จ', description: 'บันทึกการตั้งค่าเวลาและอัปเดตคิวบรอดแคสต์เรียบร้อยแล้วค่ะ' });
      setScheduleDialogOpen(false);
      fetchAllData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // ── Manual Queue Reset ─────────────────────────────────────────────────────
  const handleResetQueueSchedule = async () => {
    try {
      setIsResettingQueue(true);
      await saveOrderAndResetQueue();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err?.message, variant: 'destructive' });
    } finally {
      setIsResettingQueue(false);
    }
  };

  // ── Helper: Format Time Left & Queue Status ────────────────────────────────
  const getQueueTimeStatus = (nextSendAtStr: string | null) => {
    if (!nextSendAtStr) {
      return { text: 'ไม่อยู่ในคิว', variant: 'inactive' as const, isOverdue: false };
    }
    const target = new Date(nextSendAtStr).getTime();
    const now = Date.now();
    const diff = target - now;

    // Ahead of time
    if (diff > 0) {
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return { text: `อีก ${hrs} ชม. ${remMins} นาที`, variant: 'upcoming' as const, isOverdue: false };
      }
      return { text: `อีก ${mins} นาที ${secs} วินาที`, variant: 'upcoming' as const, isOverdue: false };
    }

    // Within 2 minutes of scheduled time: actively preparing/sending
    const absDiff = Math.abs(diff);
    if (absDiff <= 120000) {
      return { text: '⏳ กำลังเตรียมส่ง...', variant: 'processing' as const, isOverdue: false };
    }

    // More than 2 minutes past scheduled time: overdue / waiting for bot cron cycle
    const overdueMins = Math.floor(absDiff / 60000);
    if (overdueMins >= 60) {
      const hrs = Math.floor(overdueMins / 60);
      const remMins = overdueMins % 60;
      return {
        text: `⚠️ เลยกำหนดแล้ว ${hrs} ชม. ${remMins} นาที (รอยูนิตบอทส่ง)`,
        variant: 'overdue' as const,
        isOverdue: true,
      };
    }
    return {
      text: `⚠️ เลยกำหนดแล้ว ${overdueMins} นาที (รอยูนิตบอทส่ง)`,
      variant: 'overdue' as const,
      isOverdue: true,
    };
  };

  // ── Quick Stats Computations ────────────────────────────────────────────────
  const activeCount = useMemo(() => campaigns.filter((c) => c.is_active).length, [campaigns]);
  const uniqueChannelsCount = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => (c.target_channels || []).forEach((ch) => set.add(ch)));
    return set.size;
  }, [campaigns]);
  const overdueCount = useMemo(() => {
    return campaigns.filter(
      (c) => c.is_active && getQueueTimeStatus(c.next_send_at).isOverdue
    ).length;
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="campaigns" className="w-full">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A221E]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-stone-100">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Megaphone className="w-5 h-5" />
              </span>
              จัดการโฆษณา (Campaigns Studio)
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-1">
              บริหารจัดการโฆษณาบรอดแคสต์ตามช่วงเวลา รองรับ JSON ทุกรูปแบบ และโฆษณาในห้องสนทนา
            </p>
          </div>

          <TabsList className="bg-[#181412] border border-[#2A221E] p-1 rounded-2xl">
            <TabsTrigger
              value="campaigns"
              className="rounded-xl text-xs font-bold gap-2 px-3.5 py-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950 transition-all"
            >
              <Megaphone className="w-4 h-4" />
              โฆษณาบรอดแคสต์
            </TabsTrigger>
            <TabsTrigger
              value="session-ads"
              className="rounded-xl text-xs font-bold gap-2 px-3.5 py-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950 transition-all"
            >
              <Images className="w-4 h-4" />
              โฆษณาผ่านระบบ
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── TAB 1: โฆษณาบรอดแคสต์ ─── */}
        <TabsContent value="campaigns" className="space-y-6 mt-4">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#181412] border border-[#2A221E] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 font-medium">โฆษณาทั้งหมด</p>
                <p className="text-lg font-bold text-stone-100">{campaigns.length} รายการ</p>
              </div>
            </div>

            <div className="bg-[#181412] border border-[#2A221E] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 font-medium">เปิดใช้งานในคิว</p>
                <p className="text-lg font-bold text-emerald-400">{activeCount} รายการ</p>
              </div>
            </div>

            <div className="bg-[#181412] border border-[#2A221E] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 font-medium">รอบเวลาส่ง</p>
                <p className="text-sm font-bold text-stone-100 truncate">
                  {scheduleConfig?.interval_hours ?? 0} ชม. {scheduleConfig?.interval_minutes ?? 0} นาที
                </p>
              </div>
            </div>

            <div className="bg-[#181412] border border-[#2A221E] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 font-medium">ช่องเป้าหมายรวม</p>
                <p className="text-lg font-bold text-stone-100">{uniqueChannelsCount} ช่อง</p>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <Card className="bg-[#181412] border-[#2A221E] rounded-2xl shadow-sm overflow-hidden">
            {/* Toolbar Header */}
            <CardHeader className="pb-3 border-b border-[#2A221E]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-stone-100">
                    <FileCode className="w-5 h-5 text-amber-400" />
                    รายการโฆษณาบรอดแคสต์
                  </CardTitle>
                  <p className="text-xs text-stone-400">
                    ลากเพื่อจัดลำดับคิว ระบบจะส่งตามลำดับที่เปิดใช้งานวนซ้ำอัตโนมัติ
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleDialogOpen(true)}
                    className="h-9 text-xs rounded-xl gap-1.5 border-[#3A2C23] bg-[#221B17] hover:bg-[#2A221E] text-stone-200"
                  >
                    <Clock className="w-4 h-4 text-amber-400" />
                    ตั้งเวลาส่ง ({scheduleConfig?.interval_hours ?? 0} ชม. {scheduleConfig?.interval_minutes ?? 0} น.)
                  </Button>

                  {hasOrderChanged ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={saveOrderAndResetQueue}
                      disabled={savingOrder}
                      className="h-9 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold animate-pulse shadow-md"
                    >
                      {savingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      บันทึกลำดับและรีเซ็ตคิว
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetQueueSchedule}
                      disabled={isResettingQueue}
                      className="h-9 text-xs rounded-xl gap-1.5 border-[#3A2C23] bg-[#221B17] hover:bg-[#2A221E] text-stone-300"
                    >
                      {isResettingQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      รีเซ็ตคิวส่ง
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={openCreateDialog}
                    className="h-9 text-xs rounded-xl gap-1.5 font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    สร้างโฆษณาใหม่
                  </Button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                  <Input
                    placeholder="ค้นหาชื่อโฆษณา หรือช่องทาง..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl bg-[#221B17] border-[#3A2C23] text-stone-200"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[11px] text-stone-400 font-medium">กรองสถานะ:</span>
                  <div className="flex rounded-xl bg-[#221B17] p-0.5 border border-[#3A2C23]">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={cn(
                        'px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all',
                        statusFilter === 'all'
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      )}
                    >
                      ทั้งหมด ({campaigns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('active')}
                      className={cn(
                        'px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all',
                        statusFilter === 'active'
                          ? 'bg-emerald-500 text-white font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      )}
                    >
                      เปิด ({activeCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('inactive')}
                      className={cn(
                        'px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all',
                        statusFilter === 'inactive'
                          ? 'bg-stone-600 text-white font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      )}
                    >
                      พัก ({campaigns.length - activeCount})
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Campaign Cards List */}
            <CardContent className="pt-4">
              {!loading && overdueCount > 0 && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    </span>
                    <span>
                      พบโฆษณาที่เลยกำหนดเวลาส่ง <strong>{overdueCount} รายการ</strong> (อาจเนื่องจากยูนิตบอทเพิ่งรีสตาร์ท หรือรอบคิวเดิมเลยกำหนด)
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleResetQueueSchedule}
                    disabled={isResettingQueue}
                    className="h-8 text-xs rounded-xl border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-bold shrink-0 gap-1.5 transition-all"
                  >
                    {isResettingQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    รีเซ็ตเวลาคิวส่งใหม่เดี๋ยวนี้
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-16 text-stone-400 text-sm space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                    <Megaphone className="w-7 h-7 stroke-1" />
                  </div>
                  <p className="font-semibold text-stone-200">ยังไม่มีโฆษณาบรอดแคสต์ในระบบ</p>
                  <p className="text-xs text-stone-400 max-w-sm mx-auto">
                    กดปุ่ม "สร้างโฆษณาใหม่" เพื่อสร้างข้อความโปรโมชั่น รองรับทั้ง Component v2, Embeds และ Discohook
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={openCreateDialog}
                    className="rounded-xl gap-1.5 bg-amber-500 text-stone-950 font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    เริ่มสร้างโฆษณาชิ้นแรก
                  </Button>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-sm">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>ไม่พบโฆษณาที่ตรงกับการค้นหา "{searchQuery}"</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="broadcast-ads-list">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {filteredCampaigns.map((item, index) => {
                          const channelCount = item.target_channels?.length || 0;
                          const channelNames = (item.target_channels || [])
                            .map((cid) => channels.find((c) => c.id === cid)?.name || cid)
                            .slice(0, 3);

                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(providedItem, snapshot) => (
                                <div
                                  ref={providedItem.innerRef}
                                  {...providedItem.draggableProps}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-3.5 bg-[#1F1916] ${
                                    snapshot.isDragging
                                      ? 'shadow-2xl ring-2 ring-amber-500/50 border-amber-500 bg-[#251C17]'
                                      : 'border-[#2E241E] hover:border-amber-500/40 hover:bg-[#251D18]'
                                  }`}
                                >
                                  {/* Left: Drag Handle, Arrow Buttons, Sequence Badge & Info */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                      {...providedItem.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing p-1.5 rounded-xl hover:bg-[#2E241E] text-stone-400 hover:text-amber-400 transition-colors"
                                      title="ลากเพื่อจัดลำดับคิว"
                                    >
                                      <GripVertical className="w-5 h-5" />
                                    </div>

                                    {/* Arrow Buttons */}
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => moveItem(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 rounded-lg hover:bg-[#2E241E] text-stone-400 hover:text-stone-200 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                        title="เลื่อนขึ้น"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveItem(index, 'down')}
                                        disabled={index === campaigns.length - 1}
                                        className="p-1 rounded-lg hover:bg-[#2E241E] text-stone-400 hover:text-stone-200 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                        title="เลื่อนลง"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Order Sequence Pill */}
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl shrink-0 bg-[#161210] border-[#3A2C23] text-amber-400"
                                    >
                                      #{item.sort_order || index + 1}
                                    </Badge>

                                    {/* Campaign Info */}
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                      <div className="flex items-center gap-2.5 flex-wrap">
                                        <h3
                                          className="text-sm font-bold text-stone-100 truncate cursor-pointer hover:text-amber-400 transition-colors"
                                          onClick={() => openEditDialog(item)}
                                          title="คลิกเพื่อแก้ไข"
                                        >
                                          {item.internal_name}
                                        </h3>

                                        <Switch
                                          checked={item.is_active}
                                          onCheckedChange={() => handleToggleActive(item)}
                                          className="scale-90"
                                        />

                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-2 py-0.5 rounded-xl font-bold ${
                                            item.is_active
                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                              : 'bg-stone-800 text-stone-400 border-stone-700'
                                          }`}
                                        >
                                          {item.is_active ? '🟢 กำลังเปิดส่ง' : '⚪ พักการส่ง'}
                                        </Badge>
                                      </div>

                                      <div className="flex items-center gap-3 text-xs text-stone-400 flex-wrap">
                                        <span className="flex items-center gap-1.5 bg-[#161210] px-2 py-0.5 rounded-lg border border-[#2A221E]">
                                          <Hash className="w-3 h-3 text-amber-400" />
                                          {channelCount} ช่องทาง ({channelNames.join(', ')}
                                          {channelCount > 3 ? ` +${channelCount - 3}` : ''})
                                        </span>

                                        {item.is_active ? (() => {
                                          const qStatus = getQueueTimeStatus(item.next_send_at);
                                          if (qStatus.variant === 'processing') {
                                            return (
                                              <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/15 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {qStatus.text}
                                              </span>
                                            );
                                          }
                                          if (qStatus.variant === 'overdue') {
                                            return (
                                              <span
                                                className="flex items-center gap-1.5 text-rose-300 font-medium bg-rose-500/15 px-2.5 py-0.5 rounded-lg border border-rose-500/30"
                                                title="เลยกำหนดส่งแล้ว สามารถกด 'รีเซ็ตคิวส่ง' ด้านบนเพื่อเริ่มนับเวลาใหม่ได้ค่ะ"
                                              >
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                {qStatus.text}
                                              </span>
                                            );
                                          }
                                          return (
                                            <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-[#161210] px-2 py-0.5 rounded-lg border border-[#2A221E]">
                                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                                              {qStatus.text}
                                            </span>
                                          );
                                        })() : (
                                          <span className="flex items-center gap-1.5 text-stone-500 text-[11px] bg-[#161210] px-2 py-0.5 rounded-lg border border-[#2A221E]">
                                            <Clock className="w-3.5 h-3.5 text-stone-600" />
                                            ไม่อยู่ในคิวส่ง
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Actions */}
                                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openTestSendDialog(item)}
                                      className="h-8 text-xs rounded-xl gap-1.5 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 font-medium"
                                      title="ส่งข้อความทดสอบไปยัง Discord เดี๋ยวนี้"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      ส่งทดสอบ
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPreviewDialog(item)}
                                      className="h-8 text-xs rounded-xl gap-1.5 border-[#3A2C23] bg-[#221B17] hover:bg-[#2A221E] text-amber-300"
                                      title="ดูหน้าตาข้อความจำลอง และโค้ด JSON"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                                      ดูตัวอย่าง
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(item)}
                                      className="h-8 text-xs rounded-xl gap-1 border-[#3A2C23] bg-[#221B17] hover:bg-[#2A221E] text-stone-200"
                                      title="แก้ไขโฆษณา"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      แก้ไข
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteCampaign(item.id)}
                                      disabled={isDeleting}
                                      className="h-8 text-xs rounded-xl gap-1 bg-red-950/60 hover:bg-red-900 border border-red-800/40 text-red-300"
                                      title="ลบโฆษณา"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: โฆษณาผ่านระบบ ─── */}
        <TabsContent value="session-ads" className="mt-4">
          <SessionAdsManagement />
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Create / Edit Broadcast Ad (Composer Studio) ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#14100E] border-[#2D231C] p-6 text-stone-100 shadow-2xl">
          {/* Dialog Header */}
          <DialogHeader className="pb-3 border-b border-[#2A221E]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-stone-100">
                  <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Megaphone className="w-4 h-4" />
                  </span>
                  {editingCampaign ? 'แก้ไขโฆษณาบรอดแคสต์' : 'สร้างโฆษณาบรอดแคสต์ใหม่'}
                </DialogTitle>
                <DialogDescription className="text-xs text-stone-400 mt-0.5">
                  ระบุชื่ออ้างอิง เลือกช่องทาง Discord และใส่ JSON (รองรับ Discohook, Components v2, Embeds)
                </DialogDescription>
              </div>

              {/* View Switcher on smaller screens */}
              <div className="flex lg:hidden rounded-xl bg-[#221B17] p-1 border border-[#3A2C23]">
                <button
                  type="button"
                  onClick={() => setComposerTab('editor')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-all',
                    composerTab === 'editor'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  ✏️ แก้ไขเนื้อหา
                </button>
                <button
                  type="button"
                  onClick={() => setComposerTab('preview')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-all',
                    composerTab === 'preview'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  📱 ตัวอย่างสด
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Body (Dual Pane on Desktop, Tabbed on Mobile) */}
          <div className="flex-1 overflow-y-auto min-h-0 py-3 pr-1 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Pane: Form Controls (7 cols on lg) */}
              <div
                className={cn(
                  'lg:col-span-7 space-y-4',
                  composerTab === 'preview' && 'hidden lg:block'
                )}
              >
                {/* 1. Internal Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-stone-200">
                    ชื่อโฆษณาบรอดแคสต์ (อ้างอิงภายใน) *
                  </Label>
                  <Input
                    placeholder="เช่น โปรโมชั่นต้อนรับสมาชิกใหม่ ประจำเดือน..."
                    value={formData.internal_name}
                    onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                    className="rounded-xl h-9 text-xs bg-[#1F1916] border-[#3A2C23] text-stone-100 placeholder:text-stone-500"
                  />
                </div>

                {/* 2. Target Channels Multi-Select */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-stone-200">
                      เลือกช่องแชทเป้าหมาย ({formData.target_channels.length} ช่องที่เลือก) *
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => syncChannels(false)}
                      disabled={loadingChannels}
                      className="h-6 text-[11px] rounded-lg gap-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 p-1"
                    >
                      {loadingChannels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      ซิงค์ช่องจาก Discord
                    </Button>
                  </div>

                  <div className="border border-[#2E241E] rounded-2xl p-3 space-y-2.5 bg-[#1A1412]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-stone-400" />
                      <Input
                        placeholder="ค้นหาชื่อช่อง..."
                        value={channelSearch}
                        onChange={(e) => setChannelSearch(e.target.value)}
                        className="pl-8 h-7 text-xs rounded-xl bg-[#251D18] border-[#3A2C23] text-stone-200"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {filteredChannels.length === 0 ? (
                        <p className="text-xs text-stone-400 text-center py-4">ไม่พบช่องแชท</p>
                      ) : (
                        filteredChannels.map((ch) => {
                          const isChecked = formData.target_channels.includes(ch.id);
                          return (
                            <label
                              key={ch.id}
                              className={cn(
                                'flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer text-xs transition-colors',
                                isChecked
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'hover:bg-[#251D18] text-stone-300'
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      target_channels: [...formData.target_channels, ch.id],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      target_channels: formData.target_channels.filter((id) => id !== ch.id),
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded-md border-stone-600 data-[state=checked]:bg-amber-500 data-[state=checked]:text-stone-950"
                              />
                              <span className="font-mono text-stone-500 text-xs">#</span>
                              <span className="font-medium truncate">{ch.name}</span>
                              <span className="text-[10px] text-stone-500 font-mono ml-auto">
                                {ch.id}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. JSON Payload Editor */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-amber-400" />
                      JSON Message Payload *
                    </Label>

                    {/* Presets dropdown */}
                    <div className="flex items-center gap-1.5">
                      <Select
                        onValueChange={(presetId) => {
                          const preset = CAMPAIGN_JSON_PRESETS.find((p) => p.id === presetId);
                          if (preset) {
                            setFormData((prev) => ({ ...prev, payloadStr: preset.json }));
                            toast({
                              title: 'โหลดตัวอย่างสำเร็จ',
                              description: `นำเทมเพลต "${preset.name}" มาใส่ในตัวแก้ไขแล้วค่ะ`,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] rounded-xl bg-[#1F1916] border-[#3A2C23] text-stone-300 w-44">
                          <SelectValue placeholder="เลือกตัวอย่างเทมเพลต..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-[#1F1916] border-[#3A2C23] text-stone-200">
                          {CAMPAIGN_JSON_PRESETS.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Editor Toolbars */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoFormatJSON}
                        className="h-7 text-[11px] rounded-xl gap-1.5 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        จัดรูปแบบ & ซ่อมแซม JSON
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPrompt}
                        className="h-7 text-[11px] rounded-xl gap-1.5 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Prompt แปลง JSON
                      </Button>
                    </div>

                    {/* Live Validation Indicator */}
                    <div>
                      {formValidationResult.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 className="w-3 h-3" />
                          JSON ถูกต้อง{' '}
                          {formValidationResult.stats.hasComponents &&
                            `(${formValidationResult.stats.componentCount} Component)`}
                          {formValidationResult.stats.hasEmbeds &&
                            `(${formValidationResult.stats.embedCount} Embed)`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-lg">
                          <AlertCircle className="w-3 h-3" />
                          JSON ยังไม่สมบูรณ์
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warning Messages if any */}
                  {formValidationResult.warnings && formValidationResult.warnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 space-y-1">
                      {formValidationResult.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Code Textarea */}
                  <Textarea
                    rows={11}
                    value={formData.payloadStr}
                    onChange={(e) => setFormData({ ...formData, payloadStr: e.target.value })}
                    className="font-mono text-xs rounded-2xl leading-relaxed bg-[#120F0D] border-[#3A2C23] text-stone-200 placeholder:text-stone-600 focus-visible:ring-amber-500/20"
                    placeholder='{\n  "flags": 32768,\n  "components": [...]\n}'
                  />
                </div>

                {/* 4. Active Status Switch */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#2E241E] bg-[#1A1412]">
                  <div>
                    <Label className="text-xs font-bold text-stone-200">เปิดใช้งานข้อความนี้ในคิวบรอดแคสต์</Label>
                    <p className="text-[11px] text-stone-400">หากปิดไว้ ระบบจะข้ามข้อความนี้เมื่อถึงรอบเวลาส่ง</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>

              {/* Right Pane: Live Discord Mockup (5 cols on lg) */}
              <div
                className={cn(
                  'lg:col-span-5 space-y-2',
                  composerTab === 'editor' && 'hidden lg:block'
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    ตัวอย่างหน้าตาจริงบน Discord (Live Preview)
                  </Label>
                  <span className="text-[10px] text-stone-400">อัปเดตแบบเรียลไทม์</span>
                </div>

                <div className="border border-[#2E241E] rounded-2xl p-1 bg-[#120F0D]">
                  <DiscordUniversalPreview
                    payload={formData.payloadStr}
                    channelName={
                      formData.target_channels[0]
                        ? channels.find((c) => c.id === formData.target_channels[0])?.name || 'ช่องแชทเป้าหมาย'
                        : 'ประกาศ-bear-cafe'
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="pt-3 border-t border-[#2A221E] flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border-[#3A2C23] bg-[#1F1916] text-stone-300 w-full sm:w-auto"
            >
              ยกเลิก
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const valid = validateAndNormalizeForm();
                  if (valid) {
                    openTestSendDialog(undefined, valid.payloadObj, formData.target_channels);
                  }
                }}
                className="rounded-xl text-xs gap-1.5 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                ส่งทดสอบ
              </Button>

              <Button
                size="sm"
                onClick={handleSaveCampaign}
                className="rounded-xl font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                {editingCampaign ? 'บันทึกการแก้ไข' : 'สร้างโฆษณาบรอดแคสต์'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Interactive Preview Modal (Visual Mockup & JSON) ─── */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-[#14100E] border-[#2D231C] text-stone-100 shadow-2xl p-6">
          <DialogHeader className="pb-3 border-b border-[#2A221E]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-stone-100">
                  <Eye className="w-5 h-5 text-amber-400" />
                  ตัวอย่างโฆษณา — {previewCampaign?.internal_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-stone-400 mt-0.5">
                  สลับดูได้ทั้งตัวอย่างหน้าตาจริงบน Discord และโครงสร้างโค้ด JSON ดิบ
                </DialogDescription>
              </div>

              {/* Tabs Switcher */}
              <div className="flex rounded-xl bg-[#221B17] p-1 border border-[#3A2C23]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('visual')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5',
                    previewTab === 'visual'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  ตัวอย่าง Discord
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('json')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5',
                    previewTab === 'json'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  )}
                >
                  <FileCode className="w-3 h-3" />
                  โค้ด JSON
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Content */}
          <div className="flex-1 overflow-y-auto py-3 min-h-0">
            {previewTab === 'visual' ? (
              <div className="space-y-3">
                <DiscordUniversalPreview
                  payload={previewCampaign?.payload}
                  channelName={
                    previewCampaign?.target_channels?.[0]
                      ? channels.find((c) => c.id === previewCampaign.target_channels[0])?.name || 'แชนเนลเป้าหมาย'
                      : 'ประกาศ-bear-cafe'
                  }
                />
              </div>
            ) : (
              <div className="relative">
                <pre className="bg-[#120F0D] text-amber-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-[#2E241E] max-h-[50vh]">
                  {previewCampaign ? JSON.stringify(previewCampaign.payload, null, 2) : ''}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="pt-3 border-t border-[#2A221E] flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (previewCampaign) {
                    navigator.clipboard.writeText(JSON.stringify(previewCampaign.payload, null, 2));
                    toast({ title: 'คัดลอก JSON เรียบร้อยแล้วค่ะ' });
                  }
                }}
                className="rounded-xl text-xs gap-1.5 border-[#3A2C23] bg-[#221B17] text-stone-200 hover:bg-[#2A221E]"
              >
                <Copy className="w-3.5 h-3.5" />
                คัดลอก JSON
              </Button>

              {previewCampaign && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    openTestSendDialog(previewCampaign);
                  }}
                  className="rounded-xl text-xs gap-1.5 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  ส่งทดสอบไปยัง Discord
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewDialogOpen(false)}
              className="rounded-xl border-[#3A2C23] bg-[#1F1916] text-stone-300"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Schedule Config (Interval & Loop) ─── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-[#14100E] border-[#2D231C] text-stone-100 shadow-2xl p-6">
          <DialogHeader className="pb-3 border-b border-[#2A221E]">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-stone-100">
              <Clock className="w-5 h-5 text-amber-400" />
              ตั้งค่าระยะเวลาการส่งบรอดแคสต์
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              กำหนดระยะเวลาที่ระบบจะส่งข้อความโฆษณาถัดไปวนลูปอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Quick Preset Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-stone-200">เลือกช่วงเวลาด่วน (Quick Presets)</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '15 นาที', hrs: 0, mins: 15 },
                  { label: '30 นาที', hrs: 0, mins: 30 },
                  { label: '1 ชม.', hrs: 1, mins: 0 },
                  { label: '2 ชม.', hrs: 2, mins: 0 },
                  { label: '4 ชม.', hrs: 4, mins: 0 },
                  { label: '6 ชม.', hrs: 6, mins: 0 },
                  { label: '12 ชม.', hrs: 12, mins: 0 },
                  { label: '24 ชม.', hrs: 24, mins: 0 },
                ].map((preset) => {
                  const isMatch =
                    scheduleConfig?.interval_hours === preset.hrs &&
                    scheduleConfig?.interval_minutes === preset.mins;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setScheduleConfig((prev) =>
                          prev
                            ? { ...prev, interval_hours: preset.hrs, interval_minutes: preset.mins }
                            : null
                        )
                      }
                      className={cn(
                        'py-1.5 text-xs rounded-xl font-semibold border transition-all text-center',
                        isMatch
                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-xs'
                          : 'bg-[#1F1916] border-[#3A2C23] text-stone-300 hover:border-amber-500/40 hover:bg-[#251D18]'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hours & Minutes Input */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-stone-200">ชั่วโมง</Label>
                <Input
                  type="number"
                  min={0}
                  max={168}
                  value={scheduleConfig?.interval_hours ?? 0}
                  onChange={(e) =>
                    setScheduleConfig({
                      ...scheduleConfig!,
                      interval_hours: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="rounded-xl h-9 text-xs bg-[#1F1916] border-[#3A2C23] text-stone-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-stone-200">นาที</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={scheduleConfig?.interval_minutes ?? 0}
                  onChange={(e) =>
                    setScheduleConfig({
                      ...scheduleConfig!,
                      interval_minutes: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="rounded-xl h-9 text-xs bg-[#1F1916] border-[#3A2C23] text-stone-100"
                />
              </div>
            </div>

            {/* Queue Behavior Summary Card */}
            <div className="p-3 rounded-2xl bg-[#1A1412] border border-[#2E241E] text-xs text-stone-300 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                สรุปการทำงานของคิว:
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                ระบบจะส่งข้อความบรอดแคสต์ 1 ข้อความ ทุกๆ{' '}
                <strong className="text-stone-200">
                  {scheduleConfig?.interval_hours ?? 0} ชั่วโมง {scheduleConfig?.interval_minutes ?? 0} นาที
                </strong>{' '}
                หมุนเวียนโฆษณาที่เปิดใช้งานจำนวน {activeCount} รายการตามลำดับ
              </p>
            </div>

            {/* Auto Loop Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#2E241E] bg-[#1A1412]">
              <div>
                <Label className="text-xs font-bold text-stone-200">เปิดใช้งานระบบส่งอัตโนมัติ</Label>
                <p className="text-[11px] text-stone-400">เปิดเพื่อให้บอททำงานวนลูปตามเวลาที่ตั้งไว้</p>
              </div>
              <Switch
                checked={scheduleConfig?.is_enabled ?? true}
                onCheckedChange={(checked) =>
                  setScheduleConfig({ ...scheduleConfig!, is_enabled: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-[#2A221E] flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScheduleDialogOpen(false)}
              className="rounded-xl border-[#3A2C23] bg-[#1F1916] text-stone-300"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSaveScheduleConfig}
              disabled={isUpdatingSchedule}
              className="rounded-xl font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950"
            >
              {isUpdatingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกการตั้งค่า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Test Send to Discord ─── */}
      <Dialog open={testSendDialogOpen} onOpenChange={setTestSendDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-[#14100E] border-[#2D231C] text-stone-100 shadow-2xl p-6">
          <DialogHeader className="pb-3 border-b border-[#2A221E]">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-400">
              <Send className="w-5 h-5" />
              ส่งข้อความทดสอบไป Discord
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              {testSendCampaign
                ? `ทดสอบส่งโฆษณา: "${testSendCampaign.internal_name}"`
                : 'ทดสอบส่งข้อความบรอดแคสต์ที่กำลังแก้ไข'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-stone-200">เลือกช่องแชท Discord ปลายทาง</Label>
              <Select value={testSendChannelId} onValueChange={(val) => setTestSendChannelId(val)}>
                <SelectTrigger className="rounded-xl h-9 text-xs bg-[#1F1916] border-[#3A2C23] text-stone-200">
                  <SelectValue placeholder="เลือกช่องแชท..." />
                </SelectTrigger>
                <SelectContent className="max-h-56 rounded-2xl bg-[#1F1916] border-[#3A2C23] text-stone-200">
                  {testSendCampaign?.target_channels && testSendCampaign.target_channels.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        ช่องเป้าหมายของโฆษณานี้
                      </div>
                      {testSendCampaign.target_channels.map((cid) => {
                        const ch = channels.find((c) => c.id === cid);
                        return (
                          <SelectItem key={cid} value={cid} className="text-xs">
                            #{ch?.name || cid} ({cid})
                          </SelectItem>
                        );
                      })}
                    </>
                  )}

                  <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    ช่อง Discord ทั้งหมด
                  </div>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id} className="text-xs">
                      #{ch.name} ({ch.id})
                    </SelectItem>
                  ))}

                  <SelectItem value="custom" className="text-xs font-bold text-amber-400">
                    + ระบุ ID ช่องแชทอื่นๆ (Custom Channel ID)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testSendChannelId === 'custom' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-stone-200">Discord Channel ID (ตัวเลข)</Label>
                <Input
                  placeholder="เช่น 1168874550889566228"
                  value={customTestChannelId}
                  onChange={(e) => setCustomTestChannelId(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono bg-[#1F1916] border-[#3A2C23] text-stone-200"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-[#2A221E] flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestSendDialogOpen(false)}
              className="rounded-xl border-[#3A2C23] bg-[#1F1916] text-stone-300"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteTestSend}
              disabled={isTestSending}
              className="rounded-xl font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
            >
              {isTestSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ส่งข้อความทดสอบเดี๋ยวนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
