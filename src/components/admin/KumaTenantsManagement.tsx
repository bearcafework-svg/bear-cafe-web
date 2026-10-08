import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Crown,
  Search,
  RefreshCw,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  Trash2,
  Sparkles,
  Copy,
  Clock,
  Layers,
  Check,
  Server,
  Zap,
  Users,
  Hash,
  UserCheck,
} from 'lucide-react';

interface TenantConfig {
  guild_id: string;
  guild_name: string | null;
  status: string | null;
  plan: string | null;
  expires_at: string | null;
  icon_url?: string | null;
  member_count?: number | null;
  owner_id?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TenantChannel {
  id: number;
  guild_id: string;
  game_id: number;
  channel_id: string;
  channel_name?: string | null;
  created_at?: string | null;
}

interface TenantMinigameSetting {
  guild_id: string;
  game_id: number;
  enabled: boolean;
  points_per_win: number;
  canvas_theme?: string;
}

const GAME_NAMES: Record<number, { name: string; icon: string; short: string }> = {
  1: { name: 'เติมคำภาษาไทย', icon: '🇹🇭', short: 'เติมคำไทย' },
  2: { name: 'เติมคำภาษาอังกฤษ', icon: '🔤', short: 'เติมคำ ENG' },
  3: { name: 'คิดเลขเร็ว', icon: '🔢', short: 'คิดเลข' },
  4: { name: 'ทายคำใบ้ลับ', icon: '🕵️', short: 'ทายคำใบ้' },
  5: { name: 'ฟังเสียงภาษาอังกฤษ', icon: '🎧', short: 'ฟังเสียง ENG' },
  6: { name: 'แข่งพิมพ์ไวภาษาไทย', icon: '⚡', short: 'พิมพ์ไวไทย' },
  7: { name: 'แข่งพิมพ์ไวภาษาอังกฤษ', icon: '⌨️', short: 'พิมพ์ไว ENG' },
  8: { name: 'แปลศัพท์อังกฤษเป็นไทย', icon: '📖', short: 'แปล EN->TH' },
  9: { name: 'แปลศัพท์ไทยเป็นอังกฤษ', icon: '🌐', short: 'แปล TH->EN' },
  10: { name: 'เกมพยางค์ต่อพยางค์', icon: '🔗', short: 'ต่อพยางค์' },
  11: { name: 'ฟังเสียงภาษาไทย', icon: '🔊', short: 'ฟังเสียงไทย' },
  12: { name: 'ทายจริงหรือเท็จ (OX)', icon: '❓', short: 'จริง/เท็จ' },
  13: { name: 'เรียงประโยคภาษาอังกฤษ', icon: '🧩', short: 'เรียงประโยค' },
};

export function KumaTenantsManagement() {
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [channels, setChannels] = useState<TenantChannel[]>([]);
  const [settings, setSettings] = useState<TenantMinigameSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'premium' | 'standard'>('all');

  // Premium Modal
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantConfig | null>(null);
  const [premiumDays, setPremiumDays] = useState<number>(30);
  const [customDays, setCustomDays] = useState<string>('30');
  const [isSavingPremium, setIsSavingPremium] = useState(false);

  // Downgrade Confirm Dialog
  const [isDowngradeDialogOpen, setIsDowngradeDialogOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<TenantConfig | null>(null);
  const [isDowngrading, setIsDowngrading] = useState(false);

  // Add Tenant Dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGuildId, setNewGuildId] = useState('');
  const [newGuildName, setNewGuildName] = useState('');
  const [newPlan, setNewPlan] = useState<'standard' | 'premium'>('standard');
  const [newDays, setNewDays] = useState<number>(30);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // View Channels Dialog
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [activeChannelsTenant, setActiveChannelsTenant] = useState<TenantConfig | null>(null);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch tenant_configs
      const { data: configsData, error: configsErr } = await (supabase
        .from('tenant_configs' as any)
        .select('*')
        .order('updated_at', { ascending: false })) as any;

      if (configsErr) throw configsErr;

      // 2. Fetch tenant_minigame_channels
      const { data: channelsData, error: channelsErr } = await (supabase
        .from('tenant_minigame_channels' as any)
        .select('*')) as any;

      if (channelsErr) {
        console.warn('[KumaTenants] Failed to fetch channels count:', channelsErr.message);
      }

      // 3. Fetch tenant_minigame_settings
      const { data: settingsData, error: settingsErr } = await (supabase
        .from('tenant_minigame_settings' as any)
        .select('*')) as any;

      if (settingsErr) {
        console.warn('[KumaTenants] Failed to fetch settings:', settingsErr.message);
      }

      setTenants(configsData || []);
      setChannels(channelsData || []);
      setSettings(settingsData || []);
    } catch (err: any) {
      console.error('[KumaTenants] Fetch error:', err.message);
      toast({
        title: 'โหลดข้อมูลไม่สำเร็จ',
        description: err.message || 'โปรดตรวจสอบการเชื่อมต่อฐานข้อมูล',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast({
      title: 'รีเฟรชข้อมูลสำเร็จ',
      description: 'อัปเดตข้อมูลเซิร์ฟเวอร์ Kuma ล่าสุดเรียบร้อยแล้ว',
    });
  };

  // ── Utilities ──────────────────────────────────────────────────────────────
  const isTenantPremiumActive = (tenant: TenantConfig) => {
    if (tenant.plan !== 'premium') return false;
    if (!tenant.expires_at) return true;
    return new Date(tenant.expires_at).getTime() > Date.now();
  };

  const getRemainingDays = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getChannelCount = (guildId: string) => {
    return channels.filter((c) => c.guild_id === guildId).length;
  };

  const getGuildChannels = (guildId: string) => {
    return channels.filter((c) => c.guild_id === guildId);
  };

  const getGuildSetting = (guildId: string, gameId: number) => {
    return settings.find((s) => s.guild_id === guildId && s.game_id === gameId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast({
      title: 'คัดลอก Guild ID สำเร็จ',
      description: text,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Filtered Tenants (Active Only) ─────────────────────────────────────────
  const activeTenants = useMemo(() => {
    return tenants.filter((t) => t.status !== 'left');
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return activeTenants.filter((tenant) => {
      // 1. Plan Filter
      if (planFilter === 'premium') {
        if (!isTenantPremiumActive(tenant)) return false;
      } else if (planFilter === 'standard') {
        if (isTenantPremiumActive(tenant)) return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = tenant.guild_name?.toLowerCase().includes(query);
        const idMatch = tenant.guild_id.toLowerCase().includes(query);
        const ownerMatch = tenant.owner_name?.toLowerCase().includes(query);
        return nameMatch || idMatch || ownerMatch;
      }

      return true;
    });
  }, [activeTenants, planFilter, searchQuery]);

  // ── Stats Summary ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = activeTenants.length;
    const premiumActive = activeTenants.filter((t) => isTenantPremiumActive(t)).length;
    const standard = total - premiumActive;
    const totalChannels = channels.length;
    const totalMembers = activeTenants.reduce((sum, t) => sum + (t.member_count || 0), 0);
    return { total, premiumActive, standard, totalChannels, totalMembers };
  }, [activeTenants, channels]);

  // ── Open Modals ────────────────────────────────────────────────────────────
  const openPremiumModal = (tenant: TenantConfig) => {
    setSelectedTenant(tenant);
    setPremiumDays(30);
    setCustomDays('30');
    setIsPremiumModalOpen(true);
  };

  const openDowngradeDialog = (tenant: TenantConfig) => {
    setDowngradeTarget(tenant);
    setIsDowngradeDialogOpen(true);
  };

  // ── Handlers: Upgrade / Extend Premium ─────────────────────────────────────
  const handleSavePremium = async () => {
    if (!selectedTenant) return;
    setIsSavingPremium(true);

    try {
      const days = parseInt(customDays, 10) || premiumDays || 30;
      let baseTime = Date.now();

      if (selectedTenant.expires_at) {
        const existingExpires = new Date(selectedTenant.expires_at).getTime();
        if (existingExpires > baseTime) {
          baseTime = existingExpires;
        }
      }

      const newExpiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await (supabase
        .from('tenant_configs' as any)
        .update({
          plan: 'premium',
          status: 'active',
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('guild_id', selectedTenant.guild_id)) as any;

      if (error) throw error;

      toast({
        title: 'บันทึกสิทธิ์ Premium สำเร็จ',
        description: `ต่ออายุ ${days} วัน ให้กับ ${selectedTenant.guild_name || selectedTenant.guild_id} เรียบร้อยแล้ว`,
      });

      setIsPremiumModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('[KumaTenants] Save premium error:', err.message);
      toast({
        title: 'บันทึกสิทธิ์ไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPremium(false);
    }
  };

  // ── Handlers: Downgrade to Standard ────────────────────────────────────────
  const handleConfirmDowngrade = async () => {
    if (!downgradeTarget) return;
    setIsDowngrading(true);

    try {
      const { error } = await (supabase
        .from('tenant_configs' as any)
        .update({
          plan: 'standard',
          status: 'active',
          expires_at: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('guild_id', downgradeTarget.guild_id)) as any;

      if (error) throw error;

      toast({
        title: 'ปรับลดเป็น Standard สำเร็จ',
        description: `ยกเลิกสิทธิ์ Premium ของ ${downgradeTarget.guild_name || downgradeTarget.guild_id} เรียบร้อยแล้ว`,
      });

      setIsDowngradeDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('[KumaTenants] Downgrade error:', err.message);
      toast({
        title: 'ปรับลดแผนไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  // ── Handlers: Manual Add Tenant ────────────────────────────────────────────
  const handleCreateTenant = async () => {
    if (!newGuildId.trim()) {
      toast({
        title: 'กรุณากรอก Guild ID',
        description: 'Guild ID ของ Discord จำเป็นต้องระบุ',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTenant(true);
    try {
      const expiresAt =
        newPlan === 'premium'
          ? new Date(Date.now() + newDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const { error } = await (supabase
        .from('tenant_configs' as any)
        .upsert({
          guild_id: newGuildId.trim(),
          guild_name: newGuildName.trim() || `Server ${newGuildId.trim()}`,
          plan: newPlan,
          status: 'active',
          expires_at: expiresAt,
          member_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'guild_id' })) as any;

      if (error) throw error;

      toast({
        title: 'เพิ่มเซิร์ฟเวอร์สำเร็จ',
        description: `ลงทะเบียน ${newGuildName || newGuildId} เรียบร้อยแล้ว`,
      });

      setIsAddModalOpen(false);
      setNewGuildId('');
      setNewGuildName('');
      setNewPlan('standard');
      setNewDays(30);
      await fetchData();
    } catch (err: any) {
      console.error('[KumaTenants] Create tenant error:', err.message);
      toast({
        title: 'เพิ่มเซิร์ฟเวอร์ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTenant(false);
    }
  };

  // คำนวณวันหมดอายุใหม่สำหรับแสดงใน Modal
  const calculatedExpiryDate = useMemo(() => {
    if (!selectedTenant) return null;
    const days = parseInt(customDays, 10) || premiumDays || 30;
    let baseTime = Date.now();
    if (selectedTenant.expires_at) {
      const existingExpires = new Date(selectedTenant.expires_at).getTime();
      if (existingExpires > baseTime) {
        baseTime = existingExpires;
      }
    }
    return new Date(baseTime + days * 24 * 60 * 60 * 1000);
  }, [selectedTenant, customDays, premiumDays]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30 text-amber-500">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                จัดการ Kuma Tenants
                <Badge variant="outline" className="text-xs font-normal border-amber-500/40 text-amber-500 bg-amber-500/10">
                  Public Engine
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                ติดตามเซิร์ฟเวอร์ที่ติดตั้งบอทคุมะ สมาชิก และสถานะห้องมินิเกมทั่วโลก
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มเซิร์ฟเวอร์
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">เซิร์ฟเวอร์ทั้งหมด</CardTitle>
            <Server className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">เซิร์ฟเวอร์ที่ใช้งานบอทคุมะ</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">สมาชิกในระบบรวม</CardTitle>
            <Users className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {stats.totalMembers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">จำนวนคนรวมทั่วทุกเซิร์ฟเวอร์</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 flex items-center gap-1.5">
              <Crown className="w-4 h-4" /> แผน Premium
            </CardTitle>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.premiumActive}</div>
            <p className="text-xs text-muted-foreground mt-1">ปลดล็อก 13 มินิเกม ไม่จำกัดโควตา</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ห้องมินิเกมที่เปิดใช้งาน</CardTitle>
            <Gamepad2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChannels}</div>
            <p className="text-xs text-muted-foreground mt-1">ห้องแชทมินิเกมรวมทั่วโลก</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Search ── */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยชื่อเซิร์ฟเวอร์, Guild ID, หรือชื่อเจ้าของ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={planFilter} onValueChange={(val: any) => setPlanFilter(val)}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="เลือกแผนสมาชิก" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด ({stats.total})</SelectItem>
                <SelectItem value="premium">👑 Premium ({stats.premiumActive})</SelectItem>
                <SelectItem value="standard">Standard ({stats.standard})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[300px]">เซิร์ฟเวอร์</TableHead>
                <TableHead className="w-[110px]">สมาชิก</TableHead>
                <TableHead className="w-[130px]">แผนสมาชิก</TableHead>
                <TableHead className="w-[160px]">วันหมดอายุ</TableHead>
                <TableHead className="w-[220px]">ห้องมินิเกมที่เปิด</TableHead>
                <TableHead className="w-[140px]">อัปเดตล่าสุด</TableHead>
                <TableHead className="w-[160px] text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูลเซิร์ฟเวอร์...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                    ไม่พบข้อมูลเซิร์ฟเวอร์ที่ตรงกับเงื่อนไขการค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => {
                  const isPremium = isTenantPremiumActive(tenant);
                  const remaining = getRemainingDays(tenant.expires_at);
                  const guildChs = getGuildChannels(tenant.guild_id);
                  const channelCount = guildChs.length;

                  return (
                    <TableRow key={tenant.guild_id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & ID & Avatar */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-border/60 shrink-0">
                            <AvatarImage src={tenant.icon_url || undefined} alt={tenant.guild_name || 'Server'} />
                            <AvatarFallback className="bg-muted text-xs font-bold text-muted-foreground">
                              {tenant.guild_name?.slice(0, 2).toUpperCase() || 'SV'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate max-w-[200px]" title={tenant.guild_name || ''}>
                              {tenant.guild_name || 'ไม่ทราบชื่อเซิร์ฟเวอร์'}
                            </div>
                            {tenant.owner_name && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                                <UserCheck className="w-3 h-3 text-muted-foreground/70" />
                                <span>{tenant.owner_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-[11px] bg-muted px-1.5 py-0.2 rounded font-mono text-muted-foreground">
                                {tenant.guild_id}
                              </code>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 text-muted-foreground hover:text-foreground"
                                      onClick={() => copyToClipboard(tenant.guild_id)}
                                    >
                                      {copiedId === tenant.guild_id ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>คัดลอก Guild ID</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Member Count */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{(tenant.member_count || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground text-[11px]">คน</span>
                        </div>
                      </TableCell>

                      {/* Plan Badge */}
                      <TableCell>
                        {isPremium ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold">
                            <Crown className="w-3 h-3" />
                            Premium
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            Standard
                          </Badge>
                        )}
                      </TableCell>

                      {/* Expiry */}
                      <TableCell>
                        {isPremium ? (
                          <div>
                            <div className="text-xs font-medium text-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {new Date(tenant.expires_at!).toLocaleDateString('th-TH', {
                                dateStyle: 'medium',
                              })}
                            </div>
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                              {remaining === 0 ? 'หมดอายุวันนี้' : `เหลืออีก ${remaining} วัน`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Active Channels Badges */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {guildChs.slice(0, 3).map((ch) => {
                              const g = GAME_NAMES[ch.game_id];
                              return (
                                <Badge
                                  key={ch.id}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4.5 gap-0.5 font-normal"
                                >
                                  <span>{g?.icon || '🎮'}</span>
                                  <span>{g?.short || `#${ch.game_id}`}</span>
                                </Badge>
                              );
                            })}
                            {guildChs.length > 3 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4.5 text-muted-foreground">
                                +{guildChs.length - 3}
                              </Badge>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] font-semibold gap-1 text-primary hover:bg-primary/10 px-1.5"
                            onClick={() => {
                              setActiveChannelsTenant(tenant);
                              setIsChannelsModalOpen(true);
                            }}
                          >
                            <Gamepad2 className="w-3 h-3" />
                            <span>ดูทั้งหมด ({channelCount} ห้อง)</span>
                          </Button>
                        </div>
                      </TableCell>

                      {/* Updated At */}
                      <TableCell className="text-xs text-muted-foreground">
                        {tenant.updated_at
                          ? new Date(tenant.updated_at).toLocaleString('th-TH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            onClick={() => openPremiumModal(tenant)}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {isPremium ? 'ต่ออายุ' : 'อัปเกรด'}
                          </Button>

                          {isPremium && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDowngradeDialog(tenant)}
                            >
                              ยกเลิก
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Modal: Upgrade / Extend Premium ── */}
      <Dialog open={isPremiumModalOpen} onOpenChange={setIsPremiumModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              จัดการสิทธิ์ Premium ให้กับเซิร์ฟเวอร์
            </DialogTitle>
            <DialogDescription>
              {selectedTenant?.guild_name || selectedTenant?.guild_id}
            </DialogDescription>
          </DialogHeader>

          {selectedTenant && (
            <div className="space-y-4 py-2">
              <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
                <div className="text-muted-foreground font-mono">
                  <strong>Guild ID:</strong> {selectedTenant.guild_id}
                </div>
                <div>
                  <strong>สถานะปัจจุบัน:</strong>{' '}
                  {isTenantPremiumActive(selectedTenant) ? (
                    <span className="text-amber-500 font-semibold">Premium (ใช้งานอยู่)</span>
                  ) : (
                    <span className="text-muted-foreground">Standard (ฟรี)</span>
                  )}
                </div>
                {selectedTenant.expires_at && (
                  <div>
                    <strong>วันหมดอายุเดิม:</strong>{' '}
                    {new Date(selectedTenant.expires_at).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">
                  เลือกระยะเวลาต่ออายุ
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '30 วัน', days: 30 },
                    { label: '60 วัน', days: 60 },
                    { label: '90 วัน', days: 90 },
                    { label: '365 วัน', days: 365 },
                  ].map((preset) => (
                    <Button
                      key={preset.days}
                      type="button"
                      variant={premiumDays === preset.days && customDays === preset.days.toString() ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => {
                        setPremiumDays(preset.days);
                        setCustomDays(preset.days.toString());
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  หรือระบุจำนวนวันเอง (Custom Days)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  value={customDays}
                  onChange={(e) => {
                    setCustomDays(e.target.value);
                    setPremiumDays(parseInt(e.target.value, 10) || 0);
                  }}
                  placeholder="ระบุจำนวนวัน เช่น 30"
                />
              </div>

              {calculatedExpiryDate && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    วันหมดอายุใหม่หลังจากบันทึก:
                  </div>
                  <div className="text-foreground text-sm font-medium">
                    {calculatedExpiryDate.toLocaleString('th-TH', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPremiumModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSavePremium}
              disabled={isSavingPremium}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <Crown className="w-4 h-4" />
              {isSavingPremium ? 'กำลังบันทึก...' : 'ยืนยันการให้สิทธิ์'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Downgrade to Standard ── */}
      <Dialog open={isDowngradeDialogOpen} onOpenChange={setIsDowngradeDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ยืนยันการปรับลดเป็น Standard
            </DialogTitle>
            <DialogDescription>
              การกระทำนี้จะเปลี่ยนแผนของเซิร์ฟเวอร์กลับเป็น Standard (ฟรี) และเซิร์ฟเวอร์จะถูกจำกัดให้เล่นได้เฉพาะ 3 มินิเกมเริ่มต้น
            </DialogDescription>
          </DialogHeader>

          {downgradeTarget && (
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <div><strong>เซิร์ฟเวอร์:</strong> {downgradeTarget.guild_name || 'ไม่ทราบชื่อ'}</div>
              <div className="text-xs text-muted-foreground font-mono"><strong>Guild ID:</strong> {downgradeTarget.guild_id}</div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDowngradeDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDowngrade}
              disabled={isDowngrading}
            >
              {isDowngrading ? 'กำลังดำเนินการ...' : 'ยืนยันการปรับลด'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Add New Tenant ── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              ลงทะเบียนเซิร์ฟเวอร์ Kuma ใหม่
            </DialogTitle>
            <DialogDescription>
              เพิ่มข้อมูลการตั้งค่าเซิร์ฟเวอร์ล่วงหน้าลงในฐานข้อมูล
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Guild ID (ไอดีเซิร์ฟเวอร์ Discord) *
              </label>
              <Input
                placeholder="เช่น 1038378858958815272"
                value={newGuildId}
                onChange={(e) => setNewGuildId(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                ชื่อเซิร์ฟเวอร์ (ระบุเพื่อจำง่าย)
              </label>
              <Input
                placeholder="เช่น คอมมูนิตี้คนรักหมี"
                value={newGuildName}
                onChange={(e) => setNewGuildName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                แผนเริ่มต้น
              </label>
              <Select value={newPlan} onValueChange={(val: any) => setNewPlan(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (ฟรี 3 มินิเกม)</SelectItem>
                  <SelectItem value="premium">👑 Premium (ครบ 13 เกม)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPlan === 'premium' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  ระยะเวลา Premium เริ่มต้น (วัน)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={newDays}
                  onChange={(e) => setNewDays(parseInt(e.target.value, 10) || 30)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreateTenant} disabled={isCreatingTenant}>
              {isCreatingTenant ? 'กำลังบันทึก...' : 'บันทึกเซิร์ฟเวอร์'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: View Bound Channels (Read-Only) ── */}
      <Dialog open={isChannelsModalOpen} onOpenChange={setIsChannelsModalOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base">
                ห้องมินิเกมที่เปิดใช้งาน
              </DialogTitle>
            </div>
            <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>เซิร์ฟเวอร์:</span>
              <strong className="text-foreground">{activeChannelsTenant?.guild_name || activeChannelsTenant?.guild_id}</strong>
              <code className="text-[10px] bg-muted px-1.5 py-0.2 rounded font-mono">
                {activeChannelsTenant?.guild_id}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {activeChannelsTenant && (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {channels.filter((c) => c.guild_id === activeChannelsTenant.guild_id).length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Gamepad2 className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    ยังไม่มีการผูกห้องมินิเกมในเซิร์ฟเวอร์นี้
                    <div className="text-xs text-muted-foreground/80 mt-1">
                      สามารถใช้คำสั่ง <code>/setup-games</code> หรือ <code>/set-game</code> ใน Discord เพื่อเปิดใช้งานได้
                    </div>
                  </div>
                ) : (
                  channels
                    .filter((c) => c.guild_id === activeChannelsTenant.guild_id)
                    .map((c) => {
                      const gameInfo = GAME_NAMES[c.game_id];
                      const setting = getGuildSetting(c.guild_id, c.game_id);
                      const isEnabled = setting ? setting.enabled : true;

                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 bg-card rounded-lg text-sm border border-border/60 hover:border-primary/30 transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl shrink-0">{gameInfo?.icon || '🎮'}</span>
                            <div>
                              <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                <span>{gameInfo?.name || `มินิเกม #${c.game_id}`}</span>
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono text-muted-foreground">
                                  #{c.game_id}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 font-mono">
                                <Hash className="w-3 h-3 text-primary/70" />
                                <span>{c.channel_name ? `#${c.channel_name}` : c.channel_id}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isEnabled ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-normal">
                                เปิดใช้งาน
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[11px] font-normal">
                                ปิดชั่วคราว
                              </Badge>
                            )}

                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              +{setting?.points_per_win ?? 10} แต้ม
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsChannelsModalOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KumaTenantsManagement;
