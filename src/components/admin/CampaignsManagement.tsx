import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Upload,
  RefreshCw,
  Eye,
  Send,
  Loader2,
  ExternalLink,
  AlertCircle,
  FlaskConical,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart2,
} from 'lucide-react';
import { compressImage } from '@/lib/image-compress';

// Type for campaign_messages table (will be auto-generated after migration)
type CampaignMessage = {
  id: string;
  internal_name: string;
  content_text: string;
  image_url: string | null;
  has_button: boolean;
  button_label: string | null;
  button_url: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  target_channels: string[];
  sort_order: number;
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_by: string | null;
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

type ActivityStats = {
  channel_id: string;
  count_24h: number;
  count_7d: number;
  count_30d: number;
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
  content_text: string;
  image_url: string;
  has_button: boolean;
  button_label: string;
  button_url: string;
  button_emoji_id: string;
  button_emoji_name: string;
  target_channels: string[];
  is_active: boolean;
}

const INITIAL_FORM: FormData = {
  internal_name: '',
  content_text: '',
  image_url: '',
  has_button: false,
  button_label: '',
  button_url: '',
  button_emoji_id: '',
  button_emoji_name: '',
  target_channels: [],
  is_active: true,
};

export function CampaignsManagement() {
  const [campaigns, setCampaigns] = useState<CampaignMessage[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [tick, setTick] = useState(0); // increments every second to drive countdown
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignMessage | null>(null);
  const [testSendCampaign, setTestSendCampaign] = useState<CampaignMessage | null>(null);
  const [testSendChannel, setTestSendChannel] = useState<string>('');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // ─── Fetch campaigns ─────────────────────────────────────────────────────
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const [campaignsRes, scheduleRes, activityRes] = await Promise.all([
        supabase.from('campaign_messages').select('*').order('sort_order', { ascending: true }),
        supabase.from('campaign_schedule_config').select('*').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
        supabase.from('channel_activity_stats').select('*').eq('channel_id', '1144585665883938927').maybeSingle(),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      setCampaigns(campaignsRes.data || []);
      if (scheduleRes.data) setScheduleConfig(scheduleRes.data as ScheduleConfig);
      if (activityRes.data) setActivityStats(activityRes.data as ActivityStats);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลแคมเปญได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Drag-and-drop reorder ───────────────────────────────────────────────
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;

    // Reorder local state immediately for snappy UI
    const reordered = Array.from(campaigns);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    // Assign new sort_order values (0, 1, 2, …)
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCampaigns(updated);

    // Persist to DB — batch update
    try {
      const updates = updated.map((c) =>
        supabase
          .from('campaign_messages')
          .update({ sort_order: c.sort_order })
          .eq('id', c.id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.error('Failed to save order:', err);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกลำดับได้', variant: 'destructive' });
      fetchCampaigns(); // revert
    }
  }, [campaigns]);

  // ─── Sync Discord channels ───────────────────────────────────────────────
  const syncChannels = async () => {
    try {
      setLoadingChannels(true);
      const { data, error } = await supabase.functions.invoke('sync-discord-channels');

      if (error) throw error;
      if (data?.channels) {
        setChannels(data.channels);
        toast({
          title: 'สำเร็จ',
          description: `ดึงข้อมูล ${data.channels.length} ช่องแล้ว`,
        });
      }
    } catch (error: any) {
      console.error('Error syncing channels:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถดึงข้อมูลช่อง Discord ได้',
        variant: 'destructive',
      });
    } finally {
      setLoadingChannels(false);
    }
  };

  // ─── Image upload ────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'ไฟล์ไม่ถูกต้อง',
        description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'ไฟล์ใหญ่เกินไป',
        description: 'ขนาดไฟล์ต้องไม่เกิน 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // Compress image
      const compressed = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
      });

      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, compressed);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(data.path);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast({
        title: 'สำเร็จ',
        description: 'อัปโหลดรูปภาพเรียบร้อยแล้ว',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอัปโหลดรูปภาพได้',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Form validation ─────────────────────────────────────────────────────
  const validateForm = (): string | null => {
    if (!formData.internal_name.trim()) return 'กรุณาระบุชื่อภายใน';
    if (formData.internal_name.length > 100) return 'ชื่อภายในต้องไม่เกิน 100 ตัวอักษร';
    if (!formData.content_text.trim()) return 'กรุณาระบุข้อความ';
    if (formData.content_text.length > 2000) return 'ข้อความต้องไม่เกิน 2000 ตัวอักษร';
    if (formData.image_url && !formData.image_url.match(/^https?:\/\//)) return 'URL รูปภาพไม่ถูกต้อง';
    
    if (formData.has_button) {
      if (!formData.button_label.trim()) return 'กรุณาระบุข้อความปุ่ม';
      if (formData.button_label.length > 80) return 'ข้อความปุ่มต้องไม่เกิน 80 ตัวอักษร';
      if (!formData.button_url.trim()) return 'กรุณาระบุ URL ปุ่ม';
      if (!formData.button_url.match(/^https?:\/\//)) return 'URL ปุ่มไม่ถูกต้อง';
    }

    if (formData.target_channels.length === 0) return 'กรุณาเลือกช่องเป้าหมายอย่างน้อย 1 ช่อง';

    return null;
  };

  // ─── Save campaign ───────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        button_label: formData.has_button ? formData.button_label : null,
        button_url: formData.has_button ? formData.button_url : null,
        button_emoji_id: formData.has_button && formData.button_emoji_id ? formData.button_emoji_id : null,
        button_emoji_name: formData.has_button && formData.button_emoji_name ? formData.button_emoji_name : null,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('campaign_messages')
          .update(payload)
          .eq('id', editingCampaign.id);
        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'แก้ไขแคมเปญเรียบร้อยแล้ว' });
      } else {
        const { error } = await supabase
          .from('campaign_messages')
          .insert([{ ...payload, sort_order: campaigns.length, next_send_at: computeNewNextSendAt() }]);

        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'สร้างแคมเปญเรียบร้อยแล้ว' });
      }

      setDialogOpen(false);
      setEditingCampaign(null);
      setFormData(INITIAL_FORM);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกแคมเปญได้',
        variant: 'destructive',
      });
    }
  };

  // ─── Delete campaign ─────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญนี้?')) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('campaign_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'สำเร็จ', description: 'ลบแคมเปญเรียบร้อยแล้ว' });
      fetchCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบแคมเปญได้',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Open edit dialog ────────────────────────────────────────────────────
  const handleEdit = (campaign: CampaignMessage) => {
    setEditingCampaign(campaign);
    setFormData({
      internal_name: campaign.internal_name,
      content_text: campaign.content_text,
      image_url: campaign.image_url || '',
      has_button: campaign.has_button,
      button_label: campaign.button_label || '',
      button_url: campaign.button_url || '',
      button_emoji_id: campaign.button_emoji_id || '',
      button_emoji_name: campaign.button_emoji_name || '',
      target_channels: campaign.target_channels || [],
      is_active: campaign.is_active,
    });
    setDialogOpen(true);
  };

  // ─── Open create dialog ──────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingCampaign(null);
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  // ─── Toggle channel selection ────────────────────────────────────────────
  const toggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      target_channels: prev.target_channels.includes(channelId)
        ? prev.target_channels.filter((id) => id !== channelId)
        : [...prev.target_channels, channelId],
    }));
  };

  // ─── Test send ───────────────────────────────────────────────────────────
  const handleOpenTestSend = (campaign: CampaignMessage) => {
    setTestSendCampaign(campaign);
    setTestSendChannel('');
    setTestSendDialogOpen(true);
  };

  const handleTestSend = async () => {
    if (!testSendCampaign || !testSendChannel) {
      toast({ title: 'กรุณาเลือกช่อง', variant: 'destructive' });
      return;
    }
    try {
      setIsSendingTest(true);
      const { data, error } = await supabase.functions.invoke('test-send-campaign', {
        body: { campaign_id: testSendCampaign.id, channel_id: testSendChannel },
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: 'ส่งสำเร็จ',
          description: `ส่งไปยังช่องเรียบร้อยแล้ว (ID: ${data.message_id})`,
        });
        setTestSendDialogOpen(false);
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Test send error:', error);
      toast({
        title: 'ส่งไม่สำเร็จ',
        description: error.message || 'ไม่สามารถส่งข้อความได้',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // ─── Update schedule ─────────────────────────────────────────────────────
  const handleUpdateSchedule = async (newConfig: Partial<ScheduleConfig>) => {
    try {
      setIsUpdatingSchedule(true);
      const { data, error } = await supabase.functions.invoke('update-cron-schedule', {
        body: {
          interval_minutes: newConfig.interval_minutes ?? scheduleConfig?.interval_minutes ?? 1440,
          is_enabled: newConfig.is_enabled ?? scheduleConfig?.is_enabled,
        },
      });
      if (error) throw error;
      toast({ title: 'บันทึกตารางเวลาแล้ว', description: data?.label || 'อัปเดตเรียบร้อย' });
      setScheduleDialogOpen(false);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Schedule update error:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัปเดตตารางเวลาได้', variant: 'destructive' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // ─── Format countdown from a future ISO timestamp ───────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const formatCountdown = (nextSendAt: string | null): React.ReactNode => {
    void tick; // depend on tick so this re-evaluates every second
    if (!nextSendAt) return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 text-xs">พร้อมส่ง</Badge>;
    const ms = new Date(nextSendAt).getTime() - Date.now();
    if (ms <= 0) return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 text-xs">พร้อมส่ง</Badge>;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    const label = h > 0 ? `${h}ชม. ${m}น. ${s}ว.` : m > 0 ? `${m}น. ${s}ว.` : `${s}ว.`;
    return <span className="text-xs tabular-nums text-muted-foreground">อีก {label}</span>;
  };

  // ─── Compute next_send_at for a new campaign (appended to queue end) ─────
  const computeNewNextSendAt = (): string | null => {
    const intervalMs = (scheduleConfig?.interval_minutes ?? 1440) * 60 * 1000;
    // Find the latest next_send_at among active campaigns
    const latestMs = campaigns
      .filter((c) => c.is_active && c.next_send_at)
      .reduce((max, c) => Math.max(max, new Date(c.next_send_at!).getTime()), 0);
    if (latestMs === 0) return null; // no campaigns in queue yet → send immediately
    return new Date(latestMs + intervalMs).toISOString();
  };
  useEffect(() => {
    fetchCampaigns();

    // Subscribe to live updates from channel_activity_stats
    const sub = supabase
      .channel('channel_activity_stats_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_activity_stats' },
        (payload) => {
          if (payload.new) setActivityStats(payload.new as ActivityStats);
        },
      )
      .subscribe();

    // Tick every second to drive countdown display without page refresh
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(ticker);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              จัดการแคมเปญโฆษณา
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleDialogOpen(true)}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                ตั้งเวลาส่ง
                {scheduleConfig && (
                  <Badge
                    variant={scheduleConfig.is_enabled ? 'default' : 'secondary'}
                    className="ml-1 text-xs"
                  >
                    {scheduleConfig.is_enabled
                      ? (() => {
                          const m = scheduleConfig.interval_minutes ?? scheduleConfig.interval_hours * 60;
                          return m < 60 ? `ทุก ${m} นาที` : `ทุก ${Math.round(m / 60)} ชม.`;
                        })()
                      : 'ปิดอยู่'}
                  </Badge>
                )}
              </Button>
              <Button onClick={handleCreate} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                สร้างแคมเปญ
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ─── Channel Activity Stats ─── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              กิจกรรมช่อง Discord
            </CardTitle>
            {activityStats && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                อัปเดตล่าสุด{' '}
                {new Date(activityStats.updated_at).toLocaleTimeString('th-TH', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!activityStats ? (
            <div className="flex items-center gap-3 px-6 py-5 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>รอข้อมูลจาก cron (อัปเดตทุกนาที)...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 divide-x divide-border/50">
              {/* 24h */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">24 ชั่วโมง</span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {activityStats.count_24h.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ข้อความ</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (activityStats.count_24h / Math.max(activityStats.count_7d, 1)) * 100 * 7)}%` }}
                  />
                </div>
              </div>
              {/* 7d */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">7 วัน</span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {activityStats.count_7d.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ข้อความ</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${Math.min(100, (activityStats.count_7d / Math.max(activityStats.count_30d, 1)) * 100 * 4.3)}%` }}
                  />
                </div>
              </div>
              {/* 30d */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">30 วัน</span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {activityStats.count_30d.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ข้อความ</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-orange-500 w-full" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Campaigns table ─── */}
      <Card>
        <CardContent className="p-6">
          {campaigns.length > 1 && !loading && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5" />
              ลากแถวเพื่อเรียงลำดับการส่ง
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>ยังไม่มีแคมเปญ</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>ชื่อภายใน</TableHead>
                    <TableHead>ข้อความ</TableHead>
                    <TableHead>ช่องเป้าหมาย</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>คิวถัดไป</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <Droppable droppableId="campaigns">
                  {(provided) => (
                    <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                      {campaigns.map((campaign, index) => (
                        <Draggable key={campaign.id} draggableId={campaign.id} index={index}>
                          {(drag, snapshot) => (
                            <TableRow
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={snapshot.isDragging ? 'opacity-80 bg-muted shadow-lg' : ''}
                            >
                              {/* Drag handle */}
                              <TableCell className="w-8 pr-0">
                                <span
                                  {...drag.dragHandleProps}
                                  className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">{campaign.internal_name}</TableCell>
                              <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                                {campaign.content_text}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{campaign.target_channels?.length || 0} ช่อง</Badge>
                              </TableCell>
                              <TableCell>
                                {campaign.is_active ? (
                                  <Badge className="bg-green-500">เปิดใช้งาน</Badge>
                                ) : (
                                  <Badge variant="secondary">ปิดใช้งาน</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatCountdown(campaign.next_send_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenTestSend(campaign)}
                                    title="ทดลองส่ง"
                                    className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                                  >
                                    <FlaskConical className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(campaign)}
                                    title="แก้ไข"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(campaign.id)}
                                    disabled={isDeleting}
                                    title="ลบ"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  )}
                </Droppable>
              </Table>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* ─── Test Send Dialog ─── */}
      <Dialog open={testSendDialogOpen} onOpenChange={setTestSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-blue-500" />
              ทดลองส่ง
            </DialogTitle>
            <DialogDescription>
              ส่งแคมเปญ{' '}
              <span className="font-medium text-foreground">
                "{testSendCampaign?.internal_name}"
              </span>{' '}
              ไปยังช่องที่เลือกทันที (ไม่เช็คกิจกรรมล่าสุด)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>เลือกช่องที่จะส่ง *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={syncChannels}
                  disabled={loadingChannels}
                  className="gap-1 text-xs h-7"
                >
                  {loadingChannels ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  ซิงค์ช่อง
                </Button>
              </div>

              {channels.length === 0 ? (
                <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                  คลิก "ซิงค์ช่อง" เพื่อดึงรายการช่อง Discord
                </div>
              ) : (
                <div className="border rounded-lg max-h-52 overflow-y-auto">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setTestSendChannel(ch.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50 ${
                        testSendChannel === ch.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : ''
                      }`}
                    >
                      {testSendChannel === ch.id ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0 text-muted-foreground text-center">#</span>
                      )}
                      {ch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {testSendChannel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>
                  จะส่งไปยัง{' '}
                  <span className="font-medium text-foreground">
                    #{channels.find((c) => c.id === testSendChannel)?.name ?? testSendChannel}
                  </span>
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestSendDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleTestSend}
              disabled={!testSendChannel || isSendingTest}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSendingTest ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              ส่งทดลอง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Schedule Config Dialog ─── */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        config={scheduleConfig}
        isSaving={isUpdatingSchedule}
        onSave={handleUpdateSchedule}
      />

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'แก้ไขแคมเปญ' : 'สร้างแคมเปญใหม่'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลแคมเปญและดูตัวอย่างแบบเรียลไทม์
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Left Column: Form ─── */}
            <div className="space-y-4">
              {/* Internal name */}
              <div>
                <Label htmlFor="internal_name">ชื่อภายใน *</Label>
                <Input
                  id="internal_name"
                  value={formData.internal_name}
                  onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                  placeholder="เช่น: Summer Sale 2024"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.internal_name.length}/100
                </p>
              </div>

              {/* Content text */}
              <div>
                <Label htmlFor="content_text">ข้อความ *</Label>
                <Textarea
                  id="content_text"
                  value={formData.content_text}
                  onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                  placeholder="ข้อความที่จะแสดงในแคมเปญ"
                  rows={4}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.content_text.length}/2000
                </p>
              </div>

              {/* Image upload */}
              <div>
                <Label>รูปภาพ</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    อัปโหลดรูปภาพ
                  </Button>
                  {formData.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="mt-2 w-full h-32 object-cover rounded-lg"
                  />
                )}
              </div>

              {/* Button toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="has_button">เพิ่มปุ่ม</Label>
                <Switch
                  id="has_button"
                  checked={formData.has_button}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_button: checked })}
                />
              </div>

              {/* Button fields */}
              {formData.has_button && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="button_label">ข้อความปุ่ม *</Label>
                    <Input
                      id="button_label"
                      value={formData.button_label}
                      onChange={(e) => setFormData({ ...formData, button_label: e.target.value })}
                      placeholder="เช่น: ดูรายละเอียด"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="button_url">URL ปุ่ม *</Label>
                    <Input
                      id="button_url"
                      value={formData.button_url}
                      onChange={(e) => setFormData({ ...formData, button_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="button_emoji_id">Emoji ID</Label>
                      <Input
                        id="button_emoji_id"
                        value={formData.button_emoji_id}
                        onChange={(e) => setFormData({ ...formData, button_emoji_id: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button_emoji_name">Emoji Name</Label>
                      <Input
                        id="button_emoji_name"
                        value={formData.button_emoji_name}
                        onChange={(e) => setFormData({ ...formData, button_emoji_name: e.target.value })}
                        placeholder="emoji_name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target channels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>ช่องเป้าหมาย *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={syncChannels}
                    disabled={loadingChannels}
                    className="gap-2"
                  >
                    {loadingChannels ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    ซิงค์ช่อง
                  </Button>
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      คลิก "ซิงค์ช่อง" เพื่อดึงข้อมูลช่อง Discord
                    </p>
                  ) : (
                    channels.map((channel) => (
                      <div key={channel.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`channel-${channel.id}`}
                          checked={formData.target_channels.includes(channel.id)}
                          onCheckedChange={() => toggleChannel(channel.id)}
                        />
                        <Label
                          htmlFor={`channel-${channel.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          # {channel.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  เลือกแล้ว {formData.target_channels.length} ช่อง
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">เปิดใช้งาน</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            {/* ─── Right Column: Live Preview ─── */}
            <div>
              <Label className="mb-2 block">ตัวอย่างแบบเรียลไทม์</Label>
              <Card className="bg-[#313338] text-white p-4">
                <div className="space-y-3">
                  {/* Image preview */}
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Campaign preview"
                      className="w-full rounded-lg"
                    />
                  )}

                  {/* Text content */}
                  {formData.content_text && (
                    <div className="text-sm whitespace-pre-wrap">
                      {formData.content_text}
                    </div>
                  )}

                  {/* Divider */}
                  {formData.content_text && (
                    <div className="border-t border-gray-600" />
                  )}

                  {/* Button preview */}
                  {formData.has_button && formData.button_label && (
                    <Button
                      variant="outline"
                      className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 gap-2"
                      disabled
                    >
                      {formData.button_emoji_name && (
                        <span>{formData.button_emoji_name}</span>
                      )}
                      {formData.button_label}
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}

                  {/* Empty state */}
                  {!formData.content_text && !formData.image_url && (
                    <div className="text-center py-8 text-gray-400">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">กรอกข้อมูลเพื่อดูตัวอย่าง</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Validation warnings */}
              {formData.content_text && formData.content_text.length > 1800 && (
                <div className="mt-2 flex items-start gap-2 text-xs text-yellow-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>ข้อความใกล้ถึงขีดจำกัด 2000 ตัวอักษร</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              {editingCampaign ? 'บันทึกการแก้ไข' : 'สร้างแคมเปญ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Schedule Dialog (sub-component) ─────────────────────────────────────────

// Presets in minutes
const MINUTE_PRESETS = [
  { label: '5 นาที',   minutes: 5 },
  { label: '10 นาที',  minutes: 10 },
  { label: '15 นาที',  minutes: 15 },
  { label: '30 นาที',  minutes: 30 },
  { label: '45 นาที',  minutes: 45 },
];

const HOUR_PRESETS = [
  { label: '1 ชั่วโมง',              minutes: 60 },
  { label: '2 ชั่วโมง',              minutes: 120 },
  { label: '4 ชั่วโมง',              minutes: 240 },
  { label: '6 ชั่วโมง',              minutes: 360 },
  { label: '8 ชั่วโมง',              minutes: 480 },
  { label: '12 ชั่วโมง',             minutes: 720 },
  { label: '24 ชั่วโมง (1 วัน)',     minutes: 1440 },
  { label: '48 ชั่วโมง (2 วัน)',     minutes: 2880 },
  { label: '72 ชั่วโมง (3 วัน)',     minutes: 4320 },
  { label: '168 ชั่วโมง (1 สัปดาห์)', minutes: 10080 },
];

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: ScheduleConfig | null;
  isSaving: boolean;
  onSave: (config: Partial<ScheduleConfig>) => void;
}

function ScheduleDialog({ open, onOpenChange, config, isSaving, onSave }: ScheduleDialogProps) {
  const [tab, setTab] = useState<'minute' | 'hour'>('hour');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(1440);
  const [customValue, setCustomValue] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // Sync from config when dialog opens
  useEffect(() => {
    if (!open || !config) return;
    setIsEnabled(config.is_enabled);
    const m = config.interval_minutes ?? (config.interval_hours ?? 24) * 60;
    const allPresets = [...MINUTE_PRESETS, ...HOUR_PRESETS];
    const match = allPresets.find((p) => p.minutes === m);
    if (match) {
      setSelectedMinutes(m);
      setUseCustom(false);
      setCustomValue('');
      setTab(m < 60 ? 'minute' : 'hour');
    } else {
      setUseCustom(true);
      setCustomValue(String(m));
      setSelectedMinutes(m);
      setTab(m < 60 ? 'minute' : 'hour');
    }
  }, [open, config]);

  const effectiveMinutes = useCustom ? (parseInt(customValue) || 0) : selectedMinutes;
  const isValid = effectiveMinutes >= 5 && effectiveMinutes <= 10080;

  const handlePresetClick = (minutes: number) => {
    setSelectedMinutes(minutes);
    setUseCustom(false);
    setCustomValue('');
  };

  const describeInterval = (m: number): string => {
    if (m < 60) return `ส่งซ้ำได้ทุก ${m} นาที`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (rem === 0) {
      if (h === 1) return 'ส่งซ้ำได้ทุก 1 ชั่วโมง';
      if (h === 24) return 'ส่งซ้ำได้วันละ 1 ครั้ง';
      if (h === 168) return 'ส่งซ้ำได้สัปดาห์ละ 1 ครั้ง';
      return `ส่งซ้ำได้ทุก ${h} ชั่วโมง`;
    }
    return `ส่งซ้ำได้ทุก ${h} ชั่วโมง ${rem} นาที`;
  };

  const handleSave = () => {
    if (!isValid) return;
    onSave({ interval_minutes: effectiveMinutes, is_enabled: isEnabled });
  };

  const currentPresets = tab === 'minute' ? MINUTE_PRESETS : HOUR_PRESETS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ตั้งความถี่การส่ง
          </DialogTitle>
          <DialogDescription>
            กำหนดว่าระบบจะส่งแคมเปญซ้ำได้บ่อยแค่ไหน
            เพื่อป้องกันข้อความสแปมในช่อง Discord
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── Enable toggle ── */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">เปิดใช้งานการส่งอัตโนมัติ</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ปิดเพื่อหยุดชั่วคราวโดยไม่ต้องลบการตั้งค่า
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {/* ── Unit tab ── */}
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => { setTab('minute'); setUseCustom(false); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                tab === 'minute'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              นาที
            </button>
            <button
              type="button"
              onClick={() => { setTab('hour'); setUseCustom(false); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                tab === 'hour'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              ชั่วโมง / วัน
            </button>
          </div>

          {/* ── Presets ── */}
          <div className="grid grid-cols-2 gap-1.5">
            {currentPresets.map((preset) => (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => handlePresetClick(preset.minutes)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                  !useCustom && selectedMinutes === preset.minutes
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors col-span-2 ${
                useCustom
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              กำหนดเอง...
            </button>
          </div>

          {/* ── Custom input ── */}
          {useCustom && (
            <div className="pl-3 border-l-2 border-primary/20 space-y-1">
              <Label htmlFor="custom_minutes">
                จำนวน{tab === 'minute' ? 'นาที' : 'ชั่วโมง'} (
                {tab === 'minute' ? '5–59' : '1–168'})
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="custom_minutes"
                  type="number"
                  min={tab === 'minute' ? 5 : 1}
                  max={tab === 'minute' ? 59 : 168}
                  value={customValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomValue(v);
                    // auto-convert hours → minutes
                    if (tab === 'hour') {
                      const h = parseInt(v);
                      if (!isNaN(h)) setSelectedMinutes(h * 60);
                    } else {
                      const m = parseInt(v);
                      if (!isNaN(m)) setSelectedMinutes(m);
                    }
                  }}
                  placeholder={tab === 'minute' ? 'เช่น 20' : 'เช่น 3'}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  {tab === 'minute' ? 'นาที' : 'ชั่วโมง'}
                </span>
              </div>
              {customValue && !isValid && (
                <p className="text-xs text-destructive">
                  ต้องอยู่ระหว่าง 5 นาที – 168 ชั่วโมง
                </p>
              )}
            </div>
          )}

          {/* ── Summary ── */}
          {isValid && (
            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                สรุปการตั้งค่า
              </div>
              <p className="text-muted-foreground">{describeInterval(effectiveMinutes)}</p>
              <p className="text-muted-foreground">
                ระบบตรวจสอบทุกนาที แต่ส่งจริงเมื่อผ่านครบ{' '}
                <span className="font-medium text-foreground">
                  {effectiveMinutes < 60
                    ? `${effectiveMinutes} นาที`
                    : `${Math.floor(effectiveMinutes / 60)} ชั่วโมง${effectiveMinutes % 60 > 0 ? ` ${effectiveMinutes % 60} นาที` : ''}`}
                </span>{' '}
                นับจากครั้งล่าสุด
              </p>
              <p className="text-muted-foreground">
                ช่องที่ไม่มีกิจกรรมใน 7 วัน จะถูกข้ามโดยอัตโนมัติ
              </p>
              <p>
                สถานะ:{' '}
                <span className={isEnabled ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={isSaving || !isValid} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
