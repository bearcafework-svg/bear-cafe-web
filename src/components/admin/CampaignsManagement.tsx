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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  GripVertical,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Eye,
  Loader2,
  Clock,
  CheckCircle2,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Type for campaign_messages table (JSON Payload structure)
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

const DEFAULT_JSON_EXAMPLE = `{
  "flags": 32768,
  "components": [
    {
      "type": 17,
      "components": [
        {
          "type": 10,
          "content": "## 📢 **ประกาศจาก Bear Cafe**\\nต้อนรับสมาชิกใหม่รับสิทธิพิเศษมากมาย! <a:99322sparkles:1372427884479778908>"
        },
        {
          "type": 14,
          "divider": true,
          "spacing": 2
        },
        {
          "type": 1,
          "components": [
            {
              "type": 2,
              "style": 5,
              "label": "ดูรายละเอียดเพิ่มเติม",
              "url": "https://bearcafe.app"
            }
          ]
        }
      ]
    }
  ]
}`;

const INITIAL_FORM: FormData = {
  internal_name: '',
  payloadStr: DEFAULT_JSON_EXAMPLE,
  target_channels: [],
  is_active: true,
};

export function CampaignsManagement() {
  const [campaigns, setCampaigns] = useState<BroadcastAdMessage[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BroadcastAdMessage | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<BroadcastAdMessage | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [channelSearch, setChannelSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isResettingQueue, setIsResettingQueue] = useState(false);

  const { toast } = useToast();

  // ── Countdown Tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Sync Channels from Discord ──────────────────────────────────────────────
  const syncChannels = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingChannels(true);
      const { data, error } = await supabase.functions.invoke('sync-discord-channels');
      if (error) throw error;
      if (data?.channels) {
        setChannels(data.channels);
        if (!silent) {
          toast({
            title: 'ซิงค์สำเร็จ',
            description: `ดึงข้อมูลช่องแชทจาก Discord จำนวน ${data.channels.length} ช่องแล้ว`,
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
  }, [toast]);

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
        setScheduleConfig({
          id: row.id,
          cron_expression: row.cron_expression || '0 * * * *',
          label: row.label || 'ทุก 1 ชั่วโมง',
          is_enabled: row.is_enabled ?? true,
          interval_hours: row.interval_hours ?? 1,
          interval_minutes: row.interval_minutes ?? 0,
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

  // ── Filtered channels for multi-select dropdown ─────────────────────────────
  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(channelSearch.toLowerCase()));
  }, [channels, channelSearch]);

  // ── Open Modals ─────────────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingCampaign(null);
    setFormData(INITIAL_FORM);
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
    setDialogOpen(true);
  };

  const openPreviewDialog = (item: BroadcastAdMessage) => {
    setPreviewCampaign(item);
    setPreviewDialogOpen(true);
  };

  // ── Toggle Active Switch Quick Action ───────────────────────────────────────
  const handleToggleActive = async (item: BroadcastAdMessage) => {
    try {
      const nextState = !item.is_active;
      const { error } = await supabase
        .from('campaign_messages')
        .update({ is_active: nextState })
        .eq('id', item.id);

      if (error) throw error;

      setCampaigns((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, is_active: nextState } : c))
      );

      toast({
        title: 'อัปเดตสถานะสำเร็จ',
        description: `${item.internal_name}: ${nextState ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`,
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
      const totalInterval = (scheduleConfig?.interval_hours || 1) * 60 + (scheduleConfig?.interval_minutes || 0);
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
  const validateForm = (): { payloadObj: any } | null => {
    if (!formData.internal_name.trim()) {
      toast({ title: 'กรุณากรอกชื่อโฆษณา (อ้างอิงภายใน)', variant: 'destructive' });
      return null;
    }
    if (formData.target_channels.length === 0) {
      toast({ title: 'กรุณาเลือกช่องแชทเป้าหมายอย่างน้อย 1 ช่อง', variant: 'destructive' });
      return null;
    }
    try {
      const parsed = JSON.parse(formData.payloadStr);
      if (!parsed.components || !Array.isArray(parsed.components)) {
        toast({
          title: 'JSON รูปแบบไม่ถูกต้อง',
          description: "จำเป็นต้องมีฟิลด์ 'components' ที่ระดับสูงสุดและต้องเป็น Array",
          variant: 'destructive',
        });
        return null;
      }
      return { payloadObj: parsed };
    } catch (err: any) {
      toast({
        title: 'ไวยากรณ์ JSON ไม่ถูกต้อง',
        description: `Error: ${err.message}`,
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleSaveCampaign = async () => {
    const valid = validateForm();
    if (!valid) return;

    try {
      const payloadObj = valid.payloadObj;

      if (editingCampaign) {
        // Edit existing
        const { error } = await supabase
          .from('campaign_messages')
          .update({
            internal_name: formData.internal_name.trim(),
            payload: payloadObj,
            target_channels: formData.target_channels,
            is_active: formData.is_active,
          })
          .eq('id', editingCampaign.id);

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'แก้ไขโฆษณาบรอดแคสต์เรียบร้อยแล้ว' });
      } else {
        // Create new
        const maxSort = campaigns.reduce((max, c) => Math.max(max, c.sort_order || 0), 0);
        const { error } = await supabase.from('campaign_messages').insert({
          internal_name: formData.internal_name.trim(),
          payload: payloadObj,
          target_channels: formData.target_channels,
          sort_order: maxSort + 1,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'สร้างโฆษณาบรอดแคสต์เรียบร้อยแล้ว' });
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
      toast({ title: 'ลบสำเร็จ', description: 'ลบโฆษณาบรอดแคสต์เรียบร้อยแล้ว' });
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
      const hours = scheduleConfig?.interval_hours ?? 1;
      const minutes = scheduleConfig?.interval_minutes ?? 0;
      const enabled = scheduleConfig?.is_enabled ?? true;

      const { error } = await (supabase as any)
        .from('campaign_schedule_config')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          interval_hours: hours,
          interval_minutes: minutes,
          is_enabled: enabled,
          label: `ทุก ${hours > 0 ? `${hours} ชั่วโมง ` : ''}${minutes > 0 ? `${minutes} นาที` : ''}`,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({ title: 'สำเร็จ', description: 'บันทึกการตั้งค่าเวลาบรอดแคสต์เรียบร้อยแล้ว' });
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

  // ── Helper: Format Time Left ────────────────────────────────────────────────
  const formatTimeLeft = (nextSendAtStr: string | null) => {
    if (!nextSendAtStr) return 'ไม่อยู่ในคิว';
    const target = new Date(nextSendAtStr).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) return 'กำลังเตรียมส่ง...';

    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `อีก ${hrs} ชม. ${remMins} นาที`;
    }
    return `อีก ${mins} นาที ${secs} วินาที`;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="campaigns" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              จัดการโฆษณา
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              บริหารจัดการโฆษณาบรอดแคสต์ตามช่วงเวลา และโฆษณาในห้องสนทนาผ่านบอท
            </p>
          </div>
          <TabsList className="bg-muted p-1 rounded-2xl">
            <TabsTrigger value="campaigns" className="rounded-xl text-xs font-bold gap-1.5 px-3 py-1.5">
              <Megaphone className="w-4 h-4 text-primary" />
              โฆษณาบรอดแคสต์
            </TabsTrigger>
            <TabsTrigger value="session-ads" className="rounded-xl text-xs font-bold gap-1.5 px-3 py-1.5">
              <Images className="w-4 h-4 text-emerald-500" />
              โฆษณาผ่านระบบ
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── TAB 1: โฆษณาบรอดแคสต์ ─── */}
        <TabsContent value="campaigns" className="space-y-6 mt-4">
          <Card className="rounded-2xl shadow-sm border border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    รายการโฆษณาบรอดแคสต์
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    กำหนดข้อความรูปแบบ JSON Component v2 และจัดลำดับคิวส่งข้อความไปยังช่อง Discord
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleDialogOpen(true)}
                    className="h-9 text-xs rounded-xl gap-1.5"
                  >
                    <Clock className="w-4 h-4 text-indigo-500" />
                    ตั้งเวลา ({scheduleConfig?.interval_hours || 1} ชม. {scheduleConfig?.interval_minutes || 0} นาที)
                  </Button>

                  {hasOrderChanged ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={saveOrderAndResetQueue}
                      disabled={savingOrder}
                      className="h-9 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold animate-pulse shadow-md"
                    >
                      {savingOrder ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      บันทึกลำดับและรีเซ็ตคิว
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetQueueSchedule}
                      disabled={isResettingQueue}
                      className="h-9 text-xs rounded-xl gap-1.5"
                    >
                      {isResettingQueue ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      รีเซ็ตคิวส่ง
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={openCreateDialog}
                    className="h-9 text-xs rounded-xl gap-1.5 font-bold shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    สร้างโฆษณาบรอดแคสต์ใหม่
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
                  <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 stroke-1" />
                  <p className="font-semibold">ยังไม่มีโฆษณาบรอดแคสต์ในระบบ</p>
                  <p className="text-xs">กดปุ่ม "สร้างโฆษณาบรอดแคสต์ใหม่" เพื่อเริ่มสร้างข้อความโฆษณา</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="broadcast-ads-list">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {campaigns.map((item, index) => {
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
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 bg-card ${
                                    snapshot.isDragging
                                      ? 'shadow-xl ring-2 ring-primary/40 border-primary bg-primary/5'
                                      : 'border-border/60 hover:border-primary/40 hover:shadow-xs'
                                  }`}
                                >
                                  {/* Left: Drag Handle, Arrow Buttons, Badge & Details */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                      {...providedItem.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing p-1 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                                      title="ลากเพื่อเปลี่ยนลำดับ"
                                    >
                                      <GripVertical className="w-5 h-5" />
                                    </div>

                                    {/* Arrow Buttons */}
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => moveItem(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="เลื่อนขึ้น"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveItem(index, 'down')}
                                        disabled={index === campaigns.length - 1}
                                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        title="เลื่อนลง"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <Badge
                                      variant="outline"
                                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-xl shrink-0 bg-muted/60"
                                    >
                                      ลำดับที่ {index + 1}
                                    </Badge>

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold truncate">
                                          {item.internal_name}
                                        </h3>
                                        <Switch
                                          checked={item.is_active}
                                          onCheckedChange={() => handleToggleActive(item)}
                                          className="scale-90"
                                        />
                                        <Badge
                                          variant={item.is_active ? 'default' : 'secondary'}
                                          className={`text-[10px] px-2 py-0.5 rounded-xl font-bold ${
                                            item.is_active
                                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                              : 'bg-muted text-muted-foreground'
                                          }`}
                                        >
                                          {item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </Badge>
                                      </div>

                                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                          📍 {channelCount} ช่องทาง ({channelNames.join(', ')}
                                          {channelCount > 3 ? '...' : ''})
                                        </span>
                                        {item.is_active && (
                                          <span className="flex items-center gap-1 text-primary font-medium">
                                            <Clock className="w-3.5 h-3.5" />
                                            {formatTimeLeft(item.next_send_at)}
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
                                      onClick={() => openPreviewDialog(item)}
                                      className="h-8 text-xs rounded-xl gap-1"
                                      title="ดูโค้ด JSON"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-primary" />
                                      ดู JSON
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(item)}
                                      className="h-8 text-xs rounded-xl gap-1"
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
                                      className="h-8 text-xs rounded-xl gap-1"
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

      {/* ─── Dialog: Create / Edit Broadcast Ad ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col rounded-2xl">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Megaphone className="w-5 h-5 text-primary" />
              {editingCampaign ? 'แก้ไขโฆษณาบรอดแคสต์' : 'สร้างโฆษณาบรอดแคสต์ใหม่'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              กรอกชื่ออ้างอิง เลือกช่อง Discord และระบุโครงสร้าง JSON Component v2 สำหรับบรอดแคสต์
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-3 pr-1">
            {/* 1. Internal Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ชื่อโฆษณาบรอดแคสต์ (อ้างอิงภายใน)</Label>
              <Input
                placeholder="เช่น โปรโมชั่นต้อนรับหน้าร้อน"
                value={formData.internal_name}
                onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            {/* 2. Target Channels */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">เลือกช่องแชทเป้าหมาย (Discord Channels)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => syncChannels(false)}
                  disabled={loadingChannels}
                  className="h-7 text-[11px] rounded-lg gap-1 text-primary"
                >
                  {loadingChannels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  ซิงค์ช่องจาก Discord
                </Button>
              </div>

              <div className="border rounded-2xl p-3 space-y-2.5 bg-muted/30">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อช่อง..."
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl bg-background"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {filteredChannels.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">ไม่พบช่องแชท</p>
                  ) : (
                    filteredChannels.map((ch) => {
                      const isChecked = formData.target_channels.includes(ch.id);
                      return (
                        <label
                          key={ch.id}
                          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-background cursor-pointer text-xs transition-colors"
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
                            className="w-4 h-4 rounded-md"
                          />
                          <span className="font-mono text-muted-foreground">#</span>
                          <span className="font-medium">{ch.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                            {ch.id}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 3. JSON Payload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-primary" />
                JSON Payload (Discord Components v2)
              </Label>

              <Textarea
                rows={10}
                value={formData.payloadStr}
                onChange={(e) => setFormData({ ...formData, payloadStr: e.target.value })}
                className="font-mono text-xs rounded-xl leading-relaxed"
                placeholder={DEFAULT_JSON_EXAMPLE}
              />
            </div>

            {/* 4. Active Status Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl border bg-muted/20">
              <div>
                <Label className="text-xs font-bold">เปิดใช้งานข้อความบรอดแคสต์นี้</Label>
                <p className="text-[11px] text-muted-foreground">หากปิดอยู่ ระบบจะข้ามข้อความนี้เมื่อถึงคิวส่ง</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleSaveCampaign} className="rounded-xl font-bold gap-1.5">
              <Save className="w-4 h-4" />
              บันทึกข้อความ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Preview JSON Code ─── */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Eye className="w-5 h-5 text-primary" />
              ตัวอย่าง JSON — {previewCampaign?.internal_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-3">
            <pre className="bg-slate-950 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed">
              {previewCampaign ? JSON.stringify(previewCampaign.payload, null, 2) : ''}
            </pre>
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setPreviewDialogOpen(false)} className="rounded-xl">
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Schedule Config ─── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Clock className="w-5 h-5 text-indigo-500" />
              ตั้งค่าระยะเวลาการส่งบรอดแคสต์
            </DialogTitle>
            <DialogDescription className="text-xs">
              กำหนดว่าระบบจะส่งข้อความโฆษณาบรอดแคสต์ถัดไปวนลูปทุกๆ กี่ชั่วโมง/กี่นาที
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ชั่วโมง</Label>
                <Input
                  type="number"
                  min={0}
                  max={168}
                  value={scheduleConfig?.interval_hours ?? 1}
                  onChange={(e) =>
                    setScheduleConfig({
                      ...scheduleConfig!,
                      interval_hours: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">นาที</Label>
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
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl border bg-muted/20">
              <div>
                <Label className="text-xs font-bold">เปิดใช้งานระบบวนลูปส่งอัตโนมัติ</Label>
              </div>
              <Switch
                checked={scheduleConfig?.is_enabled ?? true}
                onCheckedChange={(checked) =>
                  setScheduleConfig({ ...scheduleConfig!, is_enabled: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setScheduleDialogOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSaveScheduleConfig}
              disabled={isUpdatingSchedule}
              className="rounded-xl font-bold gap-1.5"
            >
              {isUpdatingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกการตั้งค่า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
