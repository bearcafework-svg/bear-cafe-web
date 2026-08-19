import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Check, X, ExternalLink, Users, Trash2, Pencil, Plus,
  MousePointerClick, FolderOpen, Star, ShieldCheck, Handshake,
  GripVertical, LayoutList, Clock, CheckCircle2, XCircle, RefreshCw,
  Flame, Trophy, Zap, AlertTriangle, Info, Sparkles, SlidersHorizontal, Search,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { refreshServerFromDiscord } from '@/lib/discord-server-refresh';
import { batchScanDiscordServers, validateAndUpdateServerInvite } from '@/lib/discord-invite-checker';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DiscordServer {
  id: string;
  name: string;
  description: string | null;
  member_count: number | null;
  icon_url: string | null;
  banner_url: string | null;
  invite_url: string;
  status: string | null;
  owner_id: string;
  category_id: string | null;
  qc_comment: string | null;
  click_count: number | null;
  bumped_at: string | null;
  bump_count?: number | null;
  is_featured: boolean | null;
  is_verified: boolean;
  is_partner: boolean;
  highlight_color: string | null;
  carousel_order: number | null;
  invite_status?: "valid" | "expired" | "unknown";
}

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface EditForm {
  description: string;
  category_id: string;
  qc_comment: string;
  is_featured: boolean;
  is_verified: boolean;
  is_partner: boolean;
  highlight_color: string;
  carousel_order: string;
}

// ─── Color presets ────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: 'ไม่มี', value: '' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Silver', value: '#C0C0C0' },
  { label: 'Rose', value: '#FF6B9D' },
  { label: 'Sky', value: '#38BDF8' },
  { label: 'Emerald', value: '#34D399' },
  { label: 'Violet', value: '#A78BFA' },
  { label: 'Rainbow', value: 'rainbow' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function DiscordServersManagement() {
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Edit
  const [editServer, setEditServer] = useState<DiscordServer | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    description: '', category_id: '', qc_comment: '',
    is_featured: false, is_verified: false, is_partner: false,
    highlight_color: '', carousel_order: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DiscordServer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category management
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎮');
  const [catLoading, setCatLoading] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  // Carousel manager
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);
  const [carouselSaving, setCarouselSaving] = useState(false);
  const [carouselOrder, setCarouselOrder] = useState<DiscordServer[]>([]);
  const [carouselTab, setCarouselTab] = useState<'auto' | 'manual'>('auto');
  const [carouselSettings, setCarouselSettings] = useState<{
    mode: 'manual' | 'auto_top7';
    window_days: number;
    limit: number;
    prioritize_partners: boolean;
  }>({
    mode: 'auto_top7',
    window_days: 7,
    limit: 7,
    prioritize_partners: false,
  });

  // Profile map
  const [profileMap, setProfileMap] = useState<Map<string, { username: string; avatar_url: string | null }>>(new Map());

  // Per-card refresh state
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Scan invites state
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<{
    total: number;
    current: number;
    currentName: string;
    validCount: number;
    expiredCount: number;
    errorCount: number;
    expiredList: Array<{ id: string; name: string; invite_url: string; reason?: string }>;
  } | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Confirm status dialog
  const [confirmTarget, setConfirmTarget] = useState<{ server: DiscordServer; status: 'approved' | 'rejected' } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);


  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const [serverRes, catRes] = await Promise.all([
        (supabase.from('discord_servers' as any).select('*').order('created_at', { ascending: false })) as any,
        (supabase.from('discord_server_categories' as any).select('*').order('sort_order', { ascending: true })) as any,
      ]);

      const serverData = (serverRes.data || []) as DiscordServer[];
      setServers(serverData);
      setCategories((catRes.data || []) as Category[]);

      const ownerIds = [...new Set(serverData.map((s) => s.owner_id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('discord_id, username, avatar_url')
          .in('discord_id', ownerIds);
        if (profiles) {
          const map = new Map<string, { username: string; avatar_url: string | null }>();
          profiles.forEach((p) => map.set(p.discord_id, { username: p.username, avatar_url: p.avatar_url }));
          setProfileMap(map);
        }
      }
    } catch (error: any) {
      toast({ title: 'Error fetching servers', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Batch scan all invites ────────────────────────────────────────────────
  const handleStartScan = async () => {
    setIsScanning(true);
    const targets = servers.map((s) => ({ id: s.id, invite_url: s.invite_url, name: s.name }));
    setScanSummary({
      total: targets.length,
      current: 0,
      currentName: 'กำลังเริ่มต้นตรวจสอบ...',
      validCount: 0,
      expiredCount: 0,
      errorCount: 0,
      expiredList: [],
    });

    const res = await batchScanDiscordServers(
      targets,
      (current, total, s, result) => {
        setScanSummary((prev) => {
          if (!prev) return prev;
          const isExp = result.status === 'expired';
          const isVal = result.status === 'valid';
          return {
            ...prev,
            current,
            currentName: s.name,
            validCount: isVal ? prev.validCount + 1 : prev.validCount,
            expiredCount: isExp ? prev.expiredCount + 1 : prev.expiredCount,
            errorCount: !isVal && !isExp ? prev.errorCount + 1 : prev.errorCount,
            expiredList: isExp
              ? [...prev.expiredList, { id: s.id, name: s.name, invite_url: s.name, reason: result.error }]
              : prev.expiredList,
          };
        });

        // Optimistically update local servers array
        setServers((prev) =>
          prev.map((item) =>
            item.id === s.id
              ? {
                  ...item,
                  invite_status:
                    result.status === 'valid'
                      ? 'valid'
                      : result.status === 'expired'
                      ? 'expired'
                      : item.invite_status,
                }
              : item
          )
        );
      },
      500
    );

    setIsScanning(false);
    toast({
      title: '🔍 ตรวจสอบลิงก์เสร็จสิ้น',
      description: `พบลิงก์ปกติ ${res.validCount} | ลิงก์พัง ${res.expiredCount} | ข้อผิดพลาด ${res.errorCount}`,
      className: res.expiredCount > 0 ? 'bg-amber-500 text-white' : 'bg-green-500 text-white',
    });
  };

  // ── Status update ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    // Optimistic update — update UI immediately, don't wait for refetch
    setServers((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
    try {
      const { error } = await (supabase.from('discord_servers' as any).update({ status }).eq('id', id)) as any;
      if (error) throw error;
      toast({
        title: status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย',
        className: status === 'approved' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground',
      });
    } catch (error: any) {
      // Revert on failure
      setServers((prev) => prev.map((s) => s.id === id ? { ...s, status: 'pending' } : s));
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  // ── Confirm status change ──────────────────────────────────────────────────
  const handleConfirmStatus = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const { server, status } = confirmTarget;
    // Optimistic update
    setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, status } : s));
    try {
      const { error } = await (supabase.from('discord_servers' as any).update({ status }).eq('id', server.id)) as any;
      if (error) throw error;
      toast({
        title: status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย',
        className: status === 'approved' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground',
      });
      setConfirmTarget(null);
      // Switch to the tab matching the new status
      setActiveTab(status);
    } catch (error: any) {
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, status: 'pending' } : s));
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Refresh server data from Discord ──────────────────────────────────────
  const handleRefreshServer = async (server: DiscordServer) => {
    setRefreshingId(server.id);
    const result = await refreshServerFromDiscord(server.id, server.invite_url);
    setRefreshingId(null);
    if (result.success && result.updated) {
      // Optimistic update
      setServers((prev) => prev.map((s) =>
        s.id === server.id ? { ...s, ...result.updated, invite_status: 'valid' } : s
      ));
      toast({
        title: 'อัปเดตข้อมูลสำเร็จ',
        description: `${result.updated.name} — ${(result.updated.member_count ?? 0).toLocaleString()} สมาชิก (ลิงก์ปกติ)`,
        className: 'bg-success text-success-foreground',
      });
    } else {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: result.error, variant: 'destructive' });
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (server: DiscordServer) => {
    setEditServer(server);
    setEditForm({
      description: server.description || '',
      category_id: server.category_id || '',
      qc_comment: server.qc_comment || '',
      is_featured: server.is_featured ?? false,
      is_verified: server.is_verified ?? false,
      is_partner: server.is_partner ?? false,
      highlight_color: server.highlight_color || '',
      carousel_order: server.carousel_order != null ? String(server.carousel_order) : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editServer) return;
    setEditLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .update({
          description: editForm.description || null,
          category_id: editForm.category_id || null,
          qc_comment: editForm.qc_comment || null,
          is_featured: editForm.is_featured,
          is_verified: editForm.is_verified,
          is_partner: editForm.is_partner,
          highlight_color: editForm.highlight_color || null,
          carousel_order: editForm.carousel_order !== '' ? Number(editForm.carousel_order) : null,
        } as any)
        .eq('id', editServer.id)) as any;
      if (error) throw error;
      toast({ title: 'บันทึกเรียบร้อย', className: 'bg-success text-success-foreground' });
      setEditServer(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase.from('discord_servers' as any).delete().eq('id', deleteTarget.id)) as any;
      if (error) throw error;
      toast({ title: 'ลบเซิร์ฟเวอร์เรียบร้อย', className: 'bg-success text-success-foreground' });
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setCatLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_server_categories' as any)
        .insert({ name: newCatName, icon: newCatIcon, sort_order: categories.length } as any)) as any;
      if (error) throw error;
      toast({ title: 'เพิ่มหมวดหมู่สำเร็จ', className: 'bg-success text-success-foreground' });
      setNewCatName('');
      setNewCatIcon('🎮');
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCatLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCat) return;
    setCatLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_server_categories' as any)
        .update({ name: editCat.name, icon: editCat.icon } as any)
        .eq('id', editCat.id)) as any;
      if (error) throw error;
      toast({ title: 'แก้ไขหมวดหมู่สำเร็จ', className: 'bg-success text-success-foreground' });
      setEditCat(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCatLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      const { error } = await (supabase.from('discord_server_categories' as any).delete().eq('id', catId)) as any;
      if (error) throw error;
      toast({ title: 'ลบหมวดหมู่สำเร็จ', className: 'bg-success text-success-foreground' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // ── Carousel manager ───────────────────────────────────────────────────────
  const openCarousel = async () => {
    try {
      const { data } = await (supabase
        .from('site_settings' as any)
        .select('value')
        .eq('key', 'discord_carousel_settings')
        .maybeSingle()) as any;

      if (data?.value) {
        const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        const currentMode = val.mode === 'manual' ? 'manual' : 'auto_top7';
        setCarouselSettings({
          mode: currentMode,
          window_days: val.window_days || 7,
          limit: val.limit || 7,
          prioritize_partners: !!val.prioritize_partners,
        });
        setCarouselTab(currentMode === 'manual' ? 'manual' : 'auto');
      }
    } catch (err) {
      console.error('Failed to load carousel settings', err);
    }

    const featured = servers
      .filter((s) => s.is_featured)
      .sort((a, b) => (a.carousel_order ?? 999) - (b.carousel_order ?? 999));
    setCarouselOrder(featured);
    setIsCarouselOpen(true);
  };

  const moveCarouselItem = (index: number, dir: -1 | 1) => {
    const next = [...carouselOrder];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setCarouselOrder(next);
  };

  const removeFromCarousel = (id: string) => {
    setCarouselOrder((prev) => prev.filter((s) => s.id !== id));
  };

  const addToCarousel = (server: DiscordServer) => {
    if (carouselOrder.find((s) => s.id === server.id)) return;
    setCarouselOrder((prev) => [...prev, server]);
  };

  const saveCarouselOrder = async () => {
    setCarouselSaving(true);
    try {
      const activeMode = carouselTab === 'manual' ? 'manual' : 'auto_top7';

      // Save settings to site_settings
      const { error: settingsError } = await (supabase
        .from('site_settings' as any)
        .upsert({
          key: 'discord_carousel_settings',
          value: {
            ...carouselSettings,
            mode: activeMode,
          },
          updated_at: new Date().toISOString(),
        } as any)) as any;

      if (settingsError) throw settingsError;

      // In manual mode, update discord_servers is_featured + carousel_order
      if (activeMode === 'manual') {
        const inCarousel = new Set(carouselOrder.map((s) => s.id));
        const updates = servers.map((s) => {
          const idx = carouselOrder.findIndex((c) => c.id === s.id);
          return supabase
            .from('discord_servers' as any)
            .update({
              is_featured: inCarousel.has(s.id),
              carousel_order: idx >= 0 ? idx : null,
            } as any)
            .eq('id', s.id) as any;
        });
        await Promise.all(updates);
      }

      toast({
        title: 'บันทึกการตั้งค่า Carousel สำเร็จ',
        description: activeMode === 'auto_top7'
          ? `เปิดใช้งานโหมด อัตโนมัติ Top ${carouselSettings.limit || 7} (ดันเซิร์ฟใน ${carouselSettings.window_days || 7} วันล่าสุด)`
          : 'เปิดใช้งานโหมด กำหนดเอง (Manual)',
        className: 'bg-success text-success-foreground',
      });
      setIsCarouselOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCarouselSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCategoryName = (catId: string | null) => {
    if (!catId) return '-';
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : '-';
  };

  const getOwnerName = (ownerId: string) => profileMap.get(ownerId)?.username || ownerId;

  const highlightStyle = (color: string | null): React.CSSProperties => {
    if (!color) return {};
    if (color === 'rainbow') return { borderImage: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f) 1' };
    return { borderColor: color };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const pendingServers = servers.filter((s) => s.status === 'pending');
  const approvedServers = servers.filter((s) => s.status === 'approved');
  const rejectedServers = servers.filter((s) => s.status === 'rejected');
  const tabServers = activeTab === 'pending' ? pendingServers : activeTab === 'approved' ? approvedServers : rejectedServers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">จัดการเซิร์ฟเวอร์</h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setIsScanOpen(true)} className="gap-1 text-primary border-primary/40 hover:bg-primary/10">
            <Search className="h-4 w-4" /> ตรวจเช็กลิงก์ทั้งหมด
          </Button>
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="gap-1">
            <Loader2 className={cn('h-4 w-4', loading && 'animate-spin')} /> รีเฟรช
          </Button>
          <Button size="sm" variant="outline" onClick={openCarousel} className="gap-1">
            <LayoutList className="h-4 w-4" /> จัดการ Carousel
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsCatDialogOpen(true)} className="gap-1">
            <FolderOpen className="h-4 w-4" /> หมวดหมู่
          </Button>
        </div>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([
          { key: 'pending', label: 'รอตรวจสอบ', count: pendingServers.length, icon: Clock, color: 'text-amber-500' },
          { key: 'approved', label: 'อนุมัติแล้ว', count: approvedServers.length, icon: CheckCircle2, color: 'text-green-500' },
          { key: 'rejected', label: 'ปฏิเสธ', count: rejectedServers.length, icon: XCircle, color: 'text-red-500' },
        ] as const).map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', activeTab === key ? color : '')} />
            {label}
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-semibold',
              activeTab === key
                ? key === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  : key === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                : 'bg-muted text-muted-foreground'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : tabServers.length === 0 ? (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            {activeTab === 'pending' ? 'ไม่มีเซิร์ฟเวอร์รอตรวจสอบ' : activeTab === 'approved' ? 'ยังไม่มีเซิร์ฟเวอร์ที่อนุมัติ' : 'ไม่มีเซิร์ฟเวอร์ที่ถูกปฏิเสธ'}
          </div>
        ) : (
          tabServers.map((server) => (
            <Card
              key={server.id}
              className={cn(
                'overflow-hidden border-2 border-latte/20 dark:border-coffee/20',
                server.invite_status === 'expired' && 'border-red-500/40 dark:border-red-800/50'
              )}
              style={highlightStyle(server.highlight_color)}
            >
              {server.banner_url ? (
                <div className="h-28 w-full bg-cover bg-center" style={{ backgroundImage: `url(${server.banner_url})` }} />
              ) : (
                <div className="h-28 w-full bg-gradient-to-br from-peach/30 to-blush/30" />
              )}

              <CardContent className="p-4 -mt-10">
                <div className="flex justify-between items-end mb-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-white dark:border-coffee shadow-lg bg-white">
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-peach flex items-center justify-center text-xl font-bold text-white">
                        {server.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {server.invite_status === 'expired' && (
                      <Badge variant="destructive" className="text-[10px] gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />ลิงก์พัง
                      </Badge>
                    )}
                    {server.invite_status === 'valid' && (
                      <Badge className="bg-emerald-600/90 text-white text-[10px] gap-0.5">
                        <Check className="h-2.5 w-2.5" />ลิงก์ปกติ
                      </Badge>
                    )}
                    {server.is_featured && <Badge className="bg-yellow-400 text-yellow-900 text-[10px]"><Star className="h-2.5 w-2.5 mr-0.5" />Featured</Badge>}
                    {server.is_verified && <Badge className="bg-blue-500 text-white text-[10px]"><ShieldCheck className="h-2.5 w-2.5 mr-0.5" />Verified</Badge>}
                    {server.is_partner && <Badge className="bg-purple-500 text-white text-[10px]"><Handshake className="h-2.5 w-2.5 mr-0.5" />Partner</Badge>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-base truncate">{server.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {server.description || 'ไม่มีคำอธิบาย'}
                  </p>
                  {server.category_id && (
                    <Badge variant="outline" className="text-[10px]">{getCategoryName(server.category_id)}</Badge>
                  )}
                  <div className="text-xs text-muted-foreground">
                    เจ้าของ: <span className="font-medium text-foreground">{getOwnerName(server.owner_id)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground py-1.5 border-y border-latte/10 dark:border-coffee/10">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(server.member_count || 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{(server.click_count || 0).toLocaleString()}</span>
                    {server.highlight_color && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border" style={{ background: server.highlight_color === 'rainbow' ? 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f)' : server.highlight_color }} />
                        {server.highlight_color === 'rainbow' ? 'Rainbow' : server.highlight_color}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1 flex-wrap">
                    {/* Pending: show approve/reject with confirm dialog */}
                    {server.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-success hover:bg-success/90 text-success-foreground text-xs h-7"
                          onClick={() => setConfirmTarget({ server, status: 'approved' })}
                        >
                          <Check className="w-3 h-3 mr-1" />อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs h-7"
                          onClick={() => setConfirmTarget({ server, status: 'rejected' })}
                        >
                          <X className="w-3 h-3 mr-1" />ปฏิเสธ
                        </Button>
                      </>
                    )}
                    {/* Approved: allow reverting to pending */}
                    {server.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7 text-warning border-warning/30 hover:bg-warning/10"
                        onClick={() => setConfirmTarget({ server, status: 'rejected' })}
                      >
                        <XCircle className="w-3 h-3 mr-1" />ถอนการอนุมัติ
                      </Button>
                    )}
                    {/* Rejected: allow re-approving */}
                    {server.status === 'rejected' && (
                      <Button
                        size="sm"
                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground text-xs h-7"
                        onClick={() => setConfirmTarget({ server, status: 'approved' })}
                      >
                        <Check className="w-3 h-3 mr-1" />อนุมัติใหม่
                      </Button>
                    )}
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 p-0"
                      title="รีโหลดข้อมูลจาก Discord"
                      onClick={() => handleRefreshServer(server)}
                      disabled={refreshingId === server.id}
                    >
                      <RefreshCw className={cn('w-3 h-3', refreshingId === server.id && 'animate-spin')} />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleEdit(server)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(server)}><Trash2 className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" asChild>
                      <a href={server.invite_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editServer} onOpenChange={(o) => !o && setEditServer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขเซิร์ฟเวอร์: {editServer?.name}</DialogTitle>
            <DialogDescription>แก้ไขข้อมูล สถานะพิเศษ และสีไฮไลต์</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Description */}
            <div className="space-y-1.5">
              <Label>คำอธิบาย</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="คำอธิบายเซิร์ฟเวอร์"
                className="min-h-[70px]"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>หมวดหมู่</Label>
              <Select value={editForm.category_id} onValueChange={(v) => setEditForm((p) => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Highlight color */}
            <div className="space-y-1.5">
              <Label>Highlight Color (ขอบการ์ด)</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, highlight_color: p.value }))}
                    className={[
                      'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                      editForm.highlight_color === p.value
                        ? 'ring-2 ring-primary border-primary'
                        : 'border-border hover:border-primary/50',
                    ].join(' ')}
                    style={p.value && p.value !== 'rainbow' ? { borderColor: p.value, color: p.value } : {}}
                  >
                    {p.value === 'rainbow' ? '🌈 ' : p.value ? <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: p.value }} /> : null}
                    {p.label}
                  </button>
                ))}
              </div>
              <Input
                value={editForm.highlight_color}
                onChange={(e) => setEditForm((p) => ({ ...p, highlight_color: e.target.value }))}
                placeholder="#HEX หรือ rainbow"
                className="font-mono text-sm"
              />
            </div>

            {/* Toggles */}
            <div className="rounded-xl border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">สถานะพิเศษ</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">Featured (Carousel)</p>
                    <p className="text-xs text-muted-foreground">แสดงใน Carousel หน้าหลัก</p>
                  </div>
                </div>
                <Switch
                  checked={editForm.is_featured}
                  onCheckedChange={(v) => setEditForm((p) => ({ ...p, is_featured: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Verified</p>
                    <p className="text-xs text-muted-foreground">Badge ติ๊กถูกสีฟ้า</p>
                  </div>
                </div>
                <Switch
                  checked={editForm.is_verified}
                  onCheckedChange={(v) => setEditForm((p) => ({ ...p, is_verified: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Partner</p>
                    <p className="text-xs text-muted-foreground">สถานะพาร์ทเนอร์</p>
                  </div>
                </div>
                <Switch
                  checked={editForm.is_partner}
                  onCheckedChange={(v) => setEditForm((p) => ({ ...p, is_partner: v }))}
                />
              </div>
            </div>

            {/* Carousel order */}
            {editForm.is_featured && (
              <div className="space-y-1.5">
                <Label>ลำดับใน Carousel</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.carousel_order}
                  onChange={(e) => setEditForm((p) => ({ ...p, carousel_order: e.target.value }))}
                  placeholder="0, 1, 2, ..."
                  className="w-32"
                />
              </div>
            )}

            {/* QC comment */}
            <div className="space-y-1.5">
              <Label>หมายเหตุ QC (ภายใน)</Label>
              <Input
                value={editForm.qc_comment}
                onChange={(e) => setEditForm((p) => ({ ...p, qc_comment: e.target.value }))}
                placeholder="หมายเหตุสำหรับทีมงาน..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditServer(null)}>ยกเลิก</Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Status Dialog ── */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(
              'flex items-center gap-2',
              confirmTarget?.status === 'approved' ? 'text-success' : 'text-destructive'
            )}>
              {confirmTarget?.status === 'approved'
                ? <><CheckCircle2 className="h-5 w-5" /> ยืนยันการอนุมัติ</>
                : <><XCircle className="h-5 w-5" /> ยืนยันการปฏิเสธ</>
              }
            </DialogTitle>
            <DialogDescription className="pt-1">
              {confirmTarget?.status === 'approved'
                ? <>อนุมัติเซิร์ฟเวอร์ <strong className="text-foreground">{confirmTarget?.server.name}</strong> ให้แสดงในหน้าสาธารณะ?</>
                : <>ปฏิเสธเซิร์ฟเวอร์ <strong className="text-foreground">{confirmTarget?.server.name}</strong>? เซิร์ฟเวอร์จะไม่แสดงในหน้าสาธารณะ</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={confirmLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmStatus}
              disabled={confirmLoading}
              className={confirmTarget?.status === 'approved' ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}
              variant={confirmTarget?.status === 'rejected' ? 'destructive' : 'default'}
            >
              {confirmLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmTarget?.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบเซิร์ฟเวอร์ <strong>{deleteTarget?.name}</strong> ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Carousel Manager Dialog ── */}
      <Dialog open={isCarouselOpen} onOpenChange={(o) => !o && setIsCarouselOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <LayoutList className="h-5 w-5 text-primary" /> จัดการระบบ Discord Carousel
            </DialogTitle>
            <DialogDescription>
              เลือกรูปแบบการแสดงผล Carousel ระหว่างระบบอัตโนมัติ Top 7 ดันบ่อย หรือกำหนดเอง
            </DialogDescription>
          </DialogHeader>

          <Tabs value={carouselTab} onValueChange={(v: any) => setCarouselTab(v)} className="w-full pt-2">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="auto" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>อัตโนมัติ Top {carouselSettings.limit || 7} (ดันใน 7 วัน)</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <LayoutList className="w-4 h-4" />
                <span>กำหนดเอง (Manual)</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Auto Mode (Top 7 Active Bumps) ── */}
            <TabsContent value="auto" className="space-y-4 m-0">
              <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400 text-sm">
                  <Flame className="w-4 h-4" /> เงื่อนไขระบบอัตโนมัติ (Top {carouselSettings.limit || 7})
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  • เฉพาะเซิร์ฟเวอร์ที่มีการกดดันในรอบ <strong>{carouselSettings.window_days || 7} วันล่าสุด</strong> เท่านั้นที่จะมีสิทธิ์แสดงผล<br />
                  • หากเซิร์ฟเวอร์ใดไม่ได้กดดันเกิน {carouselSettings.window_days || 7} วัน จะ <strong>หลุดออกจาก Carousel ทันทีโดยอัตโนมัติ</strong><br />
                  • ระบบจัดอันดับตาม <strong>จำนวนครั้งที่กดดันสะสม (🔥 Total Bumps)</strong> และเวลาที่เพิ่งดันล่าสุด คัดเฉพาะ <strong>Top {carouselSettings.limit || 7}</strong> ขึ้นแสดง
                </p>
              </div>

              {/* Settings Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">จำนวนเซิร์ฟเวอร์สูงสุด (Top N)</Label>
                  <Select
                    value={String(carouselSettings.limit || 7)}
                    onValueChange={(val) => setCarouselSettings((prev) => ({ ...prev, limit: Number(val) }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Top 5 รายการ</SelectItem>
                      <SelectItem value="7">Top 7 รายการ (แนะนำ)</SelectItem>
                      <SelectItem value="10">Top 10 รายการ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ช่วงเวลา Active ตรวจสอบ</Label>
                  <Select
                    value={String(carouselSettings.window_days || 7)}
                    onValueChange={(val) => setCarouselSettings((prev) => ({ ...prev, window_days: Number(val) }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 วันล่าสุด</SelectItem>
                      <SelectItem value="7">7 วันล่าสุด (แนะนำตามรอบ Cooldown)</SelectItem>
                      <SelectItem value="14">14 วันล่าสุด</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live Preview List */}
              {(() => {
                const windowDays = carouselSettings.window_days || 7;
                const cutoffTime = Date.now() - windowDays * 24 * 60 * 60 * 1000;
                const limitCount = carouselSettings.limit || 7;
                const approved = servers.filter((s) => s.status === 'approved');

                const activeBumpServers = approved
                  .filter((s) => s.bumped_at && new Date(s.bumped_at).getTime() >= cutoffTime)
                  .sort((a, b) => {
                    if (carouselSettings.prioritize_partners && a.is_partner !== b.is_partner) {
                      return a.is_partner ? -1 : 1;
                    }
                    const bumpA = a.bump_count ?? 0;
                    const bumpB = b.bump_count ?? 0;
                    if (bumpB !== bumpA) return bumpB - bumpA;
                    return new Date(b.bumped_at ?? 0).getTime() - new Date(a.bumped_at ?? 0).getTime();
                  });

                const topList = activeBumpServers.slice(0, limitCount);
                const waitList = activeBumpServers.slice(limitCount);
                const inactiveList = approved.filter(
                  (s) => !s.bumped_at || new Date(s.bumped_at).getTime() < cutoffTime
                );

                const getRemainingTime = (dateStr: string | null) => {
                  if (!dateStr) return 'หมดอายุแล้ว';
                  const expireMs = new Date(dateStr).getTime() + windowDays * 24 * 60 * 60 * 1000;
                  const rem = expireMs - Date.now();
                  if (rem <= 0) return 'หมดอายุแล้ว';
                  const hours = Math.floor(rem / (1000 * 60 * 60));
                  const d = Math.floor(hours / 24);
                  const h = hours % 24;
                  return d > 0 ? `${d} วัน ${h} ชม.` : `${h} ชม.`;
                };

                const getTimeSince = (dateStr: string | null) => {
                  if (!dateStr) return 'ไม่เคยดัน';
                  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
                  if (hours < 1) return 'เมื่อสักครู่';
                  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
                  return `${Math.floor(hours / 24)} วันที่แล้ว`;
                };

                return (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                          <span>อันดับที่จะได้ขึ้น Carousel ({topList.length}/{limitCount} เซิร์ฟเวอร์)</span>
                        </p>
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                          Active ใน {windowDays} วัน
                        </Badge>
                      </div>

                      {topList.length === 0 ? (
                        <div className="p-6 text-center border rounded-xl border-dashed bg-muted/10 space-y-1">
                          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                          <p className="text-sm font-medium text-foreground">ยังไม่มีเซิร์ฟเวอร์ที่ดันในรอบ {windowDays} วัน</p>
                          <p className="text-xs text-muted-foreground">เมื่อเจ้าของเซิร์ฟเวอร์กดปุ่มดัน จะขึ้นแสดงที่นี่ทันที</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {topList.map((s, idx) => (
                            <div
                              key={s.id}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl border bg-card/60 hover:bg-muted/30 transition-colors"
                            >
                              <span className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                idx === 0 ? 'bg-yellow-500 text-black shadow-sm' :
                                idx === 1 ? 'bg-slate-300 text-black' :
                                idx === 2 ? 'bg-amber-600 text-white' :
                                'bg-muted text-muted-foreground font-mono'
                              )}>
                                {idx + 1}
                              </span>

                              {s.icon_url ? (
                                <img src={s.icon_url} alt={s.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                  {s.name[0]}
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold text-foreground truncate">{s.name}</span>
                                  {s.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                  {s.is_partner && <Handshake className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                                    <Flame className="w-3 h-3" /> ดัน {s.bump_count || 1} ครั้ง
                                  </span>
                                  <span>•</span>
                                  <span>ดัน {getTimeSince(s.bumped_at)}</span>
                                  <span>•</span>
                                  <span className="text-green-600 dark:text-green-400">เหลือ {getRemainingTime(s.bumped_at)}</span>
                                </div>
                              </div>

                              <Badge className="bg-green-500 text-white text-[10px] shrink-0">
                                แสดงบน Carousel
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Waiting List (Rank 8+) */}
                    {waitList.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> รายการรออันดับถัดไป ({waitList.length} เซิร์ฟเวอร์)
                        </p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {waitList.map((s, idx) => (
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 text-xs">
                              <span className="font-mono text-muted-foreground w-6 text-center shrink-0">#{limitCount + idx + 1}</span>
                              <span className="flex-1 font-medium truncate">{s.name}</span>
                              <span className="text-muted-foreground shrink-0">ดัน {s.bump_count || 1} ครั้ง</span>
                              <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">รออันดับ</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inactive Servers */}
                    {inactiveList.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1 text-red-500/80">
                          <XCircle className="w-3.5 h-3.5" /> เซิร์ฟเวอร์ที่หลุดจาก Carousel (ไม่ได้ดันเกิน {windowDays} วัน) ({inactiveList.length} เซิร์ฟเวอร์)
                        </p>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {inactiveList.slice(0, 10).map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted/20">
                              <span className="truncate flex-1">{s.name}</span>
                              <span className="text-[10px] shrink-0 text-red-500/70">
                                {s.bumped_at ? `ดันล่าสุด ${getTimeSince(s.bumped_at)}` : 'ยังไม่เคยดัน'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Tab 2: Manual Mode ── */}
            <TabsContent value="manual" className="space-y-4 m-0">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-foreground flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-muted-foreground leading-relaxed">
                  ในโหมดกำหนดเอง แอดมินสามารถเลือกและสลับลำดับเซิร์ฟเวอร์ใน Carousel ได้ด้วยตนเองอย่างอิสระ
                </p>
              </div>

              {/* Current carousel list */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  ลำดับปัจจุบัน ({carouselOrder.length} เซิร์ฟเวอร์)
                </p>
                {carouselOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-xl border-dashed">
                    ยังไม่มีเซิร์ฟเวอร์ใน Carousel (เลือกเพิ่มจากรายการด้านล่าง)
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {carouselOrder.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 border rounded-xl bg-card">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{i + 1}</span>
                        {s.icon_url ? (
                          <img src={s.icon_url} alt={s.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.name[0]}</div>
                        )}
                        <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveCarouselItem(i, -1)} disabled={i === 0}>▲</Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveCarouselItem(i, 1)} disabled={i === carouselOrder.length - 1}>▼</Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeFromCarousel(s.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add from approved servers */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  เพิ่มเซิร์ฟเวอร์ที่อนุมัติแล้ว
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {servers
                    .filter((s) => s.status === 'approved' && !carouselOrder.find((c) => c.id === s.id))
                    .map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 border rounded-xl hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => addToCarousel(s)}>
                        {s.icon_url ? (
                          <img src={s.icon_url} alt={s.name} className="w-6 h-6 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.name[0]}</div>
                        )}
                        <span className="flex-1 text-sm truncate">{s.name}</span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2 border-t mt-4 gap-2">
            <Button variant="outline" onClick={() => setIsCarouselOpen(false)}>ยกเลิก</Button>
            <Button onClick={saveCarouselOrder} disabled={carouselSaving} className="gap-1.5">
              {carouselSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>บันทึกการตั้งค่า</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Management Dialog ── */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>จัดการหมวดหมู่เซิร์ฟเวอร์</DialogTitle>
            <DialogDescription>เพิ่ม แก้ไข หรือลบหมวดหมู่</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-shrink-0">
                <Label className="text-xs">ไอคอน</Label>
                <Input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-16 text-center" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">ชื่อหมวดหมู่</Label>
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="เช่น Community, Gaming" />
              </div>
              <Button size="sm" onClick={handleAddCategory} disabled={catLoading || !newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  {editCat?.id === cat.id ? (
                    <>
                      <Input value={editCat.icon} onChange={(e) => setEditCat({ ...editCat, icon: e.target.value })} className="w-12 text-center text-sm" />
                      <Input value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} className="flex-1 text-sm" />
                      <Button size="sm" variant="ghost" onClick={handleUpdateCategory} disabled={catLoading}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditCat(null)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{cat.icon}</span>
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setEditCat(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteCategory(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีหมวดหมู่</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Batch Scan Invites Dialog ── */}
      <Dialog open={isScanOpen} onOpenChange={(open) => { if (!isScanning) setIsScanOpen(open); }}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              ตรวจสอบลิงก์เชิญทั้งหมด (Batch Scan)
            </DialogTitle>
            <DialogDescription>
              ระบบจะยิงตรวจสอบลิงก์เชิญ Discord ของทุกเซิร์ฟเวอร์ และอัปเดตสถานะ (ลิงก์ปกติ / ลิงก์พัง) ให้อัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* Action explanation */}
            {!scanSummary && (
              <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 border border-primary/20 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> ตรวจสอบทั้งหมด {servers.length} เซิร์ฟเวอร์
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ระบบจะเว้นระยะเวลา 500ms ต่อลิงก์เพื่อป้องกัน Discord API Rate limit (429) โดยจะอัปเดตข้อมูลสมาชิกและรูปภาพล่าสุดให้อัตโนมัติด้วย
                </p>
              </div>
            )}

            {/* Scanning progress */}
            {scanSummary && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate max-w-[280px]">
                    {isScanning ? `กำลังตรวจสอบ: ${scanSummary.currentName}` : '✅ ตรวจสอบเสร็จสิ้นแล้ว'}
                  </span>
                  <span className="font-semibold">{scanSummary.current} / {scanSummary.total}</span>
                </div>
                <Progress value={scanSummary.total > 0 ? (scanSummary.current / scanSummary.total) * 100 : 0} className="h-2 rounded-full" />

                {/* Counter boxes */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ลิงก์ปกติ</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{scanSummary.validCount}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
                    <p className="text-xs text-destructive font-medium">ลิงก์พัง</p>
                    <p className="text-lg font-bold text-destructive">{scanSummary.expiredCount}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted border">
                    <p className="text-xs text-muted-foreground font-medium">ข้อผิดพลาด</p>
                    <p className="text-lg font-bold text-foreground">{scanSummary.errorCount}</p>
                  </div>
                </div>

                {/* List of broken servers if any */}
                {scanSummary.expiredList.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> พบบริการที่ลิงก์พัง/หมดอายุ:
                    </Label>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {scanSummary.expiredList.map((exp) => (
                        <div key={exp.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                          <span className="font-medium truncate max-w-[200px]">{exp.name}</span>
                          <Badge variant="destructive" className="text-[10px] shrink-0">ลิงก์หมดอายุ</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isScanning}
              onClick={() => { setIsScanOpen(false); setScanSummary(null); }}
              className="rounded-xl"
            >
              {isScanning ? 'กำลังสแกน...' : 'ปิด'}
            </Button>
            <Button
              onClick={handleStartScan}
              disabled={isScanning || servers.length === 0}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>เริ่มตรวจสอบ ({servers.length} รายการ)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
