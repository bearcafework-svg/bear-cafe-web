import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionAdsManagement } from '@/components/admin/SessionAdsManagement';
import { AdPlacementsManagement } from '@/components/admin/AdPlacementsManagement';
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
  RotateCcw,
  Images,
  Megaphone,
  Search,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { cn } from '@/lib/utils';

// Type for campaign_messages table (will be auto-generated after migration)
type CampaignMessage = {
  id: string;
  internal_name: string;
  content_text: string;
  image_url: string | null;
  image_url_2: string | null;
  has_button: boolean;
  button_label: string | null;
  button_url: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  button_2_label: string | null;
  button_2_url: string | null;
  button_2_emoji_id: string | null;
  button_2_emoji_name: string | null;
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
  image_url_2: string;
  has_button: boolean;
  button_label: string;
  button_url: string;
  button_emoji_id: string;
  button_emoji_name: string;
  button_2_label: string;
  button_2_url: string;
  button_2_emoji_id: string;
  button_2_emoji_name: string;
  target_channels: string[];
  is_active: boolean;
}

const INITIAL_FORM: FormData = {
  internal_name: '',
  content_text: '',
  image_url: '',
  image_url_2: '',
  has_button: false,
  button_label: '',
  button_url: '',
  button_emoji_id: '',
  button_emoji_name: '',
  button_2_label: '',
  button_2_url: '',
  button_2_emoji_id: '',
  button_2_emoji_name: '',
  target_channels: [],
  is_active: true,
};

export function CampaignsManagement() {
  const [campaigns, setCampaigns] = useState<CampaignMessage[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(null);
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
  const [channelSearch, setChannelSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploading2, setUploading2] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isResettingQueue, setIsResettingQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // ─── Bucket picker state ──────────────────────────────────────────────────
  const [bucketPickerOpen, setBucketPickerOpen] = useState(false);
  const [bucketPickerTarget, setBucketPickerTarget] = useState<'image_url' | 'image_url_2'>('image_url');
  const [bucketFiles, setBucketFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [loadingBucket, setLoadingBucket] = useState(false);

  const openBucketPicker = async (target: 'image_url' | 'image_url_2') => {
    setBucketPickerTarget(target);
    setBucketPickerOpen(true);
    if (bucketFiles.length > 0) return; // already loaded
    setLoadingBucket(true);
    try {
      const { data, error } = await supabase.storage.from('campaign-images').list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      const files = (data || [])
        .filter((f) => f.name && !f.name.endsWith('/'))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from('campaign-images').getPublicUrl(f.name).data.publicUrl,
        }));
      setBucketFiles(files);
    } catch (err: any) {
      toast({ title: 'โหลดรูปไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingBucket(false);
    }
  };

  const selectBucketImage = (url: string) => {
    setFormData((p) => ({ ...p, [bucketPickerTarget]: url }));
    setBucketPickerOpen(false);
  };

  // ─── Fetch campaigns ─────────────────────────────────────────────────────
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const [campaignsRes, scheduleRes] = await Promise.all([
        (supabase as any).from('campaign_messages').select('*').order('sort_order', { ascending: true }),
        (supabase as any).from('campaign_schedule_config').select('*').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      setCampaigns(campaignsRes.data || []);
      if (scheduleRes.data) setScheduleConfig(scheduleRes.data as ScheduleConfig);
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
        (supabase as any)
          .from('campaign_messages')
          .update({ sort_order: c.sort_order })
          .eq('id', c.id)
      );
      await Promise.all(updates);
      // Recalculate queue after reorder
      await handleResetQueue(true);
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

  // ─── Image upload (shared logic) ─────────────────────────────────────────
  const uploadImage = async (
    file: File,
    onSuccess: (url: string) => void,
    setUploadingState: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>,
  ) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'ไฟล์ไม่ถูกต้อง', description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'ไฟล์ใหญ่เกินไป', description: 'ขนาดไฟล์ต้องไม่เกิน 5MB', variant: 'destructive' });
      return;
    }
    try {
      setUploadingState(true);
      const isPng = file.type === 'image/png';
      const compressed = await compressImage(file, {
        maxWidth: 1920, maxHeight: 1920,
        maxSizeBytes: 1 * 1024 * 1024,
        outputType: isPng ? 'image/png' : 'image/jpeg',
      });
      const ext = isPng ? 'png' : 'jpg';
      const fileName = `${Date.now()}-campaign.${ext}`;
      const { data, error } = await supabase.storage.from('campaign-images').upload(fileName, compressed, { cacheControl: '86400' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('campaign-images').getPublicUrl(data.path);
      onSuccess(publicUrl);
      toast({ title: 'สำเร็จ', description: 'อัปโหลดรูปภาพเรียบร้อยแล้ว' });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัปโหลดรูปภาพได้', variant: 'destructive' });
    } finally {
      setUploadingState(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file, (url) => setFormData((p) => ({ ...p, image_url: url })), setUploading, fileInputRef);
  };

  const handleImageUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage(file, (url) => setFormData((p) => ({ ...p, image_url_2: url })), setUploading2, fileInputRef2);
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
        image_url: formData.image_url || null,
        image_url_2: formData.image_url_2 || null,
        button_label: formData.has_button ? formData.button_label : null,
        button_url: formData.has_button ? formData.button_url : null,
        button_emoji_id: formData.has_button && formData.button_emoji_id ? formData.button_emoji_id : null,
        button_emoji_name: formData.has_button && formData.button_emoji_name ? formData.button_emoji_name : null,
        button_2_label: formData.button_2_label || null,
        button_2_url: formData.button_2_url || null,
        button_2_emoji_id: formData.button_2_emoji_id || null,
        button_2_emoji_name: formData.button_2_emoji_name || null,
      };

      if (editingCampaign) {
        const { error } = await (supabase as any)
          .from('campaign_messages')
          .update(payload)
          .eq('id', editingCampaign.id);
        if (error) throw error;
        toast({ title: 'สำเร็จ', description: 'แก้ไขแคมเปญเรียบร้อยแล้ว' });
      } else {
        const { error } = await (supabase as any)
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
      const { error } = await (supabase as any)
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
    setChannelSearch('');
    setFormData({
      internal_name: campaign.internal_name,
      content_text: campaign.content_text,
      image_url: campaign.image_url || '',
      image_url_2: campaign.image_url_2 || '',
      has_button: campaign.has_button,
      button_label: campaign.button_label || '',
      button_url: campaign.button_url || '',
      button_emoji_id: campaign.button_emoji_id || '',
      button_emoji_name: campaign.button_emoji_name || '',
      button_2_label: campaign.button_2_label || '',
      button_2_url: campaign.button_2_url || '',
      button_2_emoji_id: campaign.button_2_emoji_id || '',
      button_2_emoji_name: campaign.button_2_emoji_name || '',
      target_channels: campaign.target_channels || [],
      is_active: campaign.is_active,
    });
    setDialogOpen(true);
  };

  // ─── Open create dialog ──────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingCampaign(null);
    setChannelSearch('');
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

  const filteredChannels = useMemo(() => {
    const q = channelSearch.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [channels, channelSearch]);

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

  // ─── Reset queue ─────────────────────────────────────────────────────────
  const handleResetQueue = async (silent = false) => {
    try {
      setIsResettingQueue(true);
      const { data, error } = await supabase.functions.invoke('reset-campaign-queue');
      if (error) throw error;
      if (!silent) {
        toast({
          title: 'รีเซ็ตคิวสำเร็จ',
          description: `จัดคิว ${data?.updated ?? 0} แคมเปญใหม่ (interval ${data?.interval_minutes} นาที)`,
        });
      }
      fetchCampaigns();
    } catch (error: any) {
      console.error('Reset queue error:', error);
      if (!silent) {
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถรีเซ็ตคิวได้', variant: 'destructive' });
      }
    } finally {
      setIsResettingQueue(false);
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
      // Auto-reset queue so all next_send_at values reflect the new interval
      await handleResetQueue(true);
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
    if (!nextSendAt) return <Badge variant="outline" className="text-matcha border-matcha/40 bg-matcha/10 dark:bg-matcha/20 text-xs">พร้อมส่ง</Badge>;
    const ms = new Date(nextSendAt).getTime() - Date.now();
    if (ms <= 0) return <Badge variant="outline" className="text-matcha border-matcha/40 bg-matcha/10 dark:bg-matcha/20 text-xs">พร้อมส่ง</Badge>;
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

    // Tick every second to drive countdown display without page refresh
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      clearInterval(ticker);
    };
  }, []);

  return (
    <Tabs defaultValue="campaigns" className="space-y-6">
      <TabsList className="w-fit">
        <TabsTrigger value="campaigns" className="gap-2">
          <Send className="w-4 h-4" />แคมเปญโฆษณา
        </TabsTrigger>
        <TabsTrigger value="session-ads" className="gap-2">
          <Megaphone className="w-4 h-4" />โฆษณาผ่านระบบ
        </TabsTrigger>
        <TabsTrigger value="placements" className="gap-2">
          <Images className="w-4 h-4" />Ad Placements
        </TabsTrigger>
      </TabsList>

      {/* ── Tab: แคมเปญโฆษณา ── */}
      <TabsContent value="campaigns" className="mt-0">
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <Card className="rounded-2xl border-border/40 bg-card">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Send className="w-5 h-5 text-primary" />
              จัดการแคมเปญโฆษณา
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetQueue()}
                disabled={isResettingQueue || campaigns.length === 0}
                className="gap-2 rounded-xl text-xs h-9 border-border/40"
                title="รีเซ็ตคิวใหม่ตามลำดับแคมเปญและรอบเวลาปัจจุบัน"
              >
                {isResettingQueue ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-primary" />
                )}
                รีเซ็ตคิว
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleDialogOpen(true)}
                className="gap-2 rounded-xl text-xs h-9 border-border/40"
              >
                <Clock className="w-4 h-4 text-accent" />
                ตั้งเวลาส่ง
                {scheduleConfig && (
                  <Badge
                    variant={scheduleConfig.is_enabled ? 'default' : 'secondary'}
                    className={cn(
                      "ml-1 text-[10px] px-1.5 py-0 h-4 rounded-full font-medium",
                      scheduleConfig.is_enabled
                        ? "bg-success/15 border-success/35 text-success hover:bg-success/20 border"
                        : "bg-muted-foreground/15 border-muted-foreground/35 text-muted-foreground border"
                    )}
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
              <Button onClick={handleCreate} size="sm" className="gap-2 rounded-xl text-xs h-9 bg-primary hover:bg-primary/90 text-white">
                <Plus className="w-4 h-4 text-white" />
                สร้างแคมเปญ
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ─── Campaigns table ─── */}
      <Card className="rounded-2xl border-border/40 bg-card">
        <CardContent className="p-4 sm:p-6">
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
              <Droppable droppableId="campaigns">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3"
                  >
                    {campaigns.map((campaign, index) => (
                      <Draggable key={campaign.id} draggableId={campaign.id} index={index}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-card transition-all hover:shadow-sm",
                              snapshot.isDragging
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md scale-[1.01]"
                                : "border-border/40 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                              {/* Drag handle */}
                              <button
                                type="button"
                                {...drag.dragHandleProps}
                                className="flex items-center justify-center p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 animate-none"
                              >
                                <GripVertical className="w-4 h-4" />
                              </button>

                              {/* Image thumbnail if exists */}
                              {campaign.image_url && (
                                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/40 shrink-0 bg-muted hidden xs:block">
                                  <img src={campaign.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-sm truncate text-foreground">{campaign.internal_name}</h4>
                                  {campaign.is_active ? (
                                    <Badge className="bg-success/15 border-success/35 text-success hover:bg-success/20 text-[10px] px-1.5 py-0 h-4 rounded-full font-medium">เปิดใช้งาน</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full font-medium">ปิดใช้งาน</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                                  {campaign.content_text}
                                </p>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap pt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Send className="w-3 h-3 text-primary/70" />
                                    ช่องเป้าหมาย: <span className="font-semibold text-foreground">{campaign.target_channels?.length || 0} ช่อง</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-accent/70" />
                                    คิวถัดไป: {formatCountdown(campaign.next_send_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenTestSend(campaign)}
                                title="ทดลองส่ง"
                                className="h-8 w-8 p-0 text-accent hover:text-accent/80 hover:bg-accent/10 rounded-xl"
                              >
                                <FlaskConical className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(campaign)}
                                title="แก้ไข"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-xl"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(campaign.id)}
                                disabled={isDeleting}
                                title="ลบ"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* ─── Bucket Picker Dialog ─── */}
      <Dialog open={bucketPickerOpen} onOpenChange={setBucketPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="w-5 h-5" />
              เลือกรูปจาก Bucket — {bucketPickerTarget === 'image_url' ? 'รูปภาพที่ 1' : 'รูปภาพที่ 2'}
            </DialogTitle>
            <DialogDescription>
              คลิกรูปเพื่อเลือก หรืออัปโหลดใหม่จากปุ่มอัปโหลดด้านล่าง
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {loadingBucket ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : bucketFiles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                ยังไม่มีรูปภาพใน Bucket — อัปโหลดรูปใหม่ก่อน
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {bucketFiles.map((f) => {
                  const isSelected =
                    formData[bucketPickerTarget] === f.url;
                  return (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => selectBucketImage(f.url)}
                      className={`relative group rounded-xl overflow-hidden border-2 transition-all aspect-video bg-muted ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-primary/50'
                      }`}
                    >
                      <img
                        src={f.url}
                        alt={f.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-primary drop-shadow" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {f.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                setBucketFiles([]);
                await openBucketPicker(bucketPickerTarget);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              รีเฟรช
            </Button>
            <Button variant="outline" onClick={() => setBucketPickerOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Test Send Dialog ─── */}
      <Dialog open={testSendDialogOpen} onOpenChange={setTestSendDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-honey" />
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
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
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
              className="gap-2"
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

              {/* Image 1 */}
              <div>
                <Label>รูปภาพที่ 1</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    อัปโหลด
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openBucketPicker('image_url')} className="gap-2">
                    <Images className="w-4 h-4" />
                    เลือกจาก Bucket
                  </Button>
                  {formData.image_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, image_url: '' })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.image_url && (
                  <img src={formData.image_url} alt="Preview 1" className="mt-2 w-full h-28 object-cover rounded-lg" />
                )}
              </div>

              {/* Image 2 */}
              <div>
                <Label>รูปภาพที่ 2 (ไม่บังคับ)</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="file" ref={fileInputRef2} onChange={handleImageUpload2} accept="image/*" className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef2.current?.click()} disabled={uploading2} className="gap-2">
                    {uploading2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    อัปโหลด
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openBucketPicker('image_url_2')} className="gap-2">
                    <Images className="w-4 h-4" />
                    เลือกจาก Bucket
                  </Button>
                  {formData.image_url_2 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, image_url_2: '' })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {formData.image_url_2 && (
                  <img src={formData.image_url_2} alt="Preview 2" className="mt-2 w-full h-28 object-cover rounded-lg" />
                )}
              </div>

              {/* Button 1 toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="has_button">เพิ่มปุ่มที่ 1</Label>
                <Switch
                  id="has_button"
                  checked={formData.has_button}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_button: checked })}
                />
              </div>

              {/* Button 1 fields */}
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

              {/* Button 2 */}
              <div>
                <Label className="mb-2 block">ปุ่มที่ 2 (ไม่บังคับ)</Label>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  <div>
                    <Label htmlFor="button_2_label">ข้อความปุ่ม</Label>
                    <Input
                      id="button_2_label"
                      value={formData.button_2_label}
                      onChange={(e) => setFormData({ ...formData, button_2_label: e.target.value })}
                      placeholder="เช่น: สมัครสมาชิก"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="button_2_url">URL ปุ่ม</Label>
                    <Input
                      id="button_2_url"
                      value={formData.button_2_url}
                      onChange={(e) => setFormData({ ...formData, button_2_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="button_2_emoji_id">Emoji ID</Label>
                      <Input
                        id="button_2_emoji_id"
                        value={formData.button_2_emoji_id}
                        onChange={(e) => setFormData({ ...formData, button_2_emoji_id: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button_2_emoji_name">Emoji Name</Label>
                      <Input
                        id="button_2_emoji_name"
                        value={formData.button_2_emoji_name}
                        onChange={(e) => setFormData({ ...formData, button_2_emoji_name: e.target.value })}
                        placeholder="emoji_name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Target channels */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ช่องเป้าหมาย *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={syncChannels}
                    disabled={loadingChannels}
                    className="gap-1.5 text-xs h-7 hover:bg-muted/85 rounded-lg"
                  >
                    {loadingChannels ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    ซิงค์ช่อง
                  </Button>
                </div>
                
                {/* Channel Search Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="ค้นหาชื่อช่อง..."
                    className="pl-8 h-8 text-xs rounded-xl bg-card border-border/40 focus:ring-primary/20"
                  />
                  {channelSearch && (
                    <button
                      onClick={() => setChannelSearch('')}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="border rounded-2xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-muted/10 border-border/40">
                  {filteredChannels.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 italic">
                      {channels.length === 0 ? 'คลิก "ซิงค์ช่อง" เพื่อดึงข้อมูลช่อง Discord' : 'ไม่พบช่องที่ตรงกับคำค้นหา'}
                    </p>
                  ) : (
                    filteredChannels.map((channel) => (
                      <div key={channel.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                        <Checkbox
                          id={`channel-${channel.id}`}
                          checked={formData.target_channels.includes(channel.id)}
                          onCheckedChange={() => toggleChannel(channel.id)}
                        />
                        <Label
                          htmlFor={`channel-${channel.id}`}
                          className="text-xs cursor-pointer flex-1 select-none font-medium text-foreground/80 hover:text-foreground"
                        >
                          # {channel.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground pl-1">
                  เลือกแล้ว <span className="font-bold text-foreground">{formData.target_channels.length}</span> ช่อง
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
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ตัวอย่างแบบเรียลไทม์ (จำลองหน้าจอ Discord)</Label>
              <div className="bg-[#313338] text-[#dbdee1] p-4 rounded-2xl font-sans text-sm select-none border border-[#1e1f22] shadow-lg max-h-[500px] overflow-y-auto">
                <div className="flex gap-3 items-start">
                  {/* Mock Discord Bot Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center shrink-0 text-white font-bold select-none text-xs">
                    BC
                  </div>
                  
                  {/* Discord Message Content */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Header info */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-white hover:underline cursor-pointer text-[15px]">Bear Cafe Bot</span>
                      <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none shrink-0 uppercase">BOT</span>
                      <span className="text-[11px] text-[#949ba4] font-medium">วันนี้ เวลา 12:00 น.</span>
                    </div>
                    
                    {/* Text Content */}
                    {formData.content_text ? (
                      <div className="text-[14px] leading-[1.375rem] text-[#dbdee1] whitespace-pre-wrap break-words font-normal">
                        {formData.content_text}
                      </div>
                    ) : (
                      <div className="text-[14px] text-muted-foreground/40 italic">
                        พิมพ์ข้อความเพื่อแสดงตัวอย่างแคมเปญ
                      </div>
                    )}
                    
                    {/* Embed Layout (if there is an image) */}
                    {(formData.image_url || formData.image_url_2) && (
                      <div className="flex flex-col gap-2 mt-2 max-w-[520px]">
                        {formData.image_url && (
                          <div className="rounded-lg overflow-hidden border border-[#232428] bg-[#2b2d31]">
                            <img src={formData.image_url} alt="" className="max-h-[280px] object-cover w-full" />
                          </div>
                        )}
                        {formData.image_url_2 && (
                          <div className="rounded-lg overflow-hidden border border-[#232428] bg-[#2b2d31]">
                            <img src={formData.image_url_2} alt="" className="max-h-[280px] object-cover w-full" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Buttons preview */}
                    {((formData.has_button && formData.button_label) || formData.button_2_label) && (
                      <div className="flex gap-2 flex-wrap pt-2">
                        {formData.has_button && formData.button_label && (
                          <button
                            type="button"
                            disabled
                            className="bg-[#4e5058] hover:bg-[#6d6f78] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-not-allowed select-none border-0"
                          >
                            {formData.button_emoji_name && <span className="text-sm">{formData.button_emoji_name}</span>}
                            <span>{formData.button_label}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                          </button>
                        )}
                        {formData.button_2_label && formData.button_2_url && (
                          <button
                            type="button"
                            disabled
                            className="bg-[#4e5058] hover:bg-[#6d6f78] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-not-allowed select-none border-0"
                          >
                            {formData.button_2_emoji_name && <span className="text-sm">{formData.button_2_emoji_name}</span>}
                            <span>{formData.button_2_label}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
      </TabsContent>

      {/* ── Tab: โฆษณาผ่านระบบ ── */}
      <TabsContent value="session-ads" className="mt-0">
        <SessionAdsManagement />
      </TabsContent>

      {/* ── Tab: Ad Placements ── */}
      <TabsContent value="placements" className="mt-0">
        <AdPlacementsManagement />
      </TabsContent>
    </Tabs>
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
      <DialogContent className="max-w-md rounded-2xl">
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
