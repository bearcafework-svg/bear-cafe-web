import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  ArrowUpDown,
} from 'lucide-react';

interface TenantConfig {
  guild_id: string;
  guild_name: string | null;
  status: string | null;
  plan: string | null;
  expires_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TenantChannel {
  id: number;
  guild_id: string;
  game_id: number;
  channel_id: string;
  created_at?: string | null;
}

export function KumaTenantsManagement() {
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [channels, setChannels] = useState<TenantChannel[]>([]);
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

      setTenants(configsData || []);
      setChannels(channelsData || []);
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
      description: 'อัปเดตรายชื่อเซิร์ฟเวอร์ Kuma ล่าสุดเรียบร้อยแล้วค่ะ',
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getChannelCount = (guildId: string): number => {
    return channels.filter((c) => c.guild_id === guildId).length;
  };

  const isTenantPremiumActive = (tenant: TenantConfig): boolean => {
    if (tenant.plan !== 'premium') return false;
    if (!tenant.expires_at) return true; // Lifetime/No expiry
    return new Date(tenant.expires_at).getTime() > Date.now();
  };

  const getRemainingDays = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1800);
    toast({
      title: 'คัดลอกแล้ว',
      description: `คัดลอก Guild ID: ${text}`,
    });
  };

  // ── Stats Summary ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tenants.length;
    const premiumActive = tenants.filter(isTenantPremiumActive).length;
    const standard = total - premiumActive;
    const totalChannels = channels.length;
    return { total, premiumActive, standard, totalChannels };
  }, [tenants, channels]);

  // ── Filtered List ──────────────────────────────────────────────────────────
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.guild_id.toLowerCase().includes(q) ||
        (t.guild_name && t.guild_name.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (planFilter === 'premium') return isTenantPremiumActive(t);
      if (planFilter === 'standard') return !isTenantPremiumActive(t);
      return true;
    });
  }, [tenants, searchQuery, planFilter]);

  // ── Handle Set Premium ─────────────────────────────────────────────────────
  const openPremiumModal = (tenant: TenantConfig) => {
    setSelectedTenant(tenant);
    setPremiumDays(30);
    setCustomDays('30');
    setIsPremiumModalOpen(true);
  };

  const handleSavePremium = async () => {
    if (!selectedTenant) return;
    setIsSavingPremium(true);

    try {
      const days = parseInt(customDays, 10);
      if (isNaN(days) || days <= 0) {
        throw new Error('กรุณาระบุจำนวนวันที่ถูกต้อง (มากกว่า 0 วัน)');
      }

      // Base time calculation
      let baseTime = Date.now();
      if (selectedTenant.expires_at) {
        const existingExpires = new Date(selectedTenant.expires_at).getTime();
        if (existingExpires > baseTime) {
          baseTime = existingExpires;
        }
      }

      const newExpiresAt = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await (supabase.from('tenant_configs' as any).upsert({
        guild_id: selectedTenant.guild_id,
        guild_name: selectedTenant.guild_name || 'Unknown Guild',
        plan: 'premium',
        status: 'active',
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id' })) as any;

      if (error) throw error;

      toast({
        title: '👑 อัปเกรด Premium สำเร็จ!',
        description: `เพิ่มสถานะ Premium ให้เซิร์ฟเวอร์ ${selectedTenant.guild_name || selectedTenant.guild_id} อีก +${days} วัน เรียบร้อยแล้ว`,
      });

      setIsPremiumModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'อัปเกรด Premium ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingPremium(false);
    }
  };

  // ── Handle Remove Premium ──────────────────────────────────────────────────
  const openDowngradeDialog = (tenant: TenantConfig) => {
    setDowngradeTarget(tenant);
    setIsDowngradeDialogOpen(true);
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradeTarget) return;
    setIsDowngrading(true);

    try {
      const { error } = await (supabase.from('tenant_configs' as any).update({
        plan: 'standard',
        expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq('guild_id', downgradeTarget.guild_id)) as any;

      if (error) throw error;

      toast({
        title: 'ปรับสถานะเป็น Standard แล้ว',
        description: `เซิร์ฟเวอร์ ${downgradeTarget.guild_name || downgradeTarget.guild_id} ถูกปรับกลับเป็นแผนฟรีแล้วค่ะ`,
      });

      setIsDowngradeDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsDowngrading(false);
    }
  };

  // ── Handle Add New Tenant ──────────────────────────────────────────────────
  const handleCreateTenant = async () => {
    if (!newGuildId.trim()) {
      toast({
        title: 'กรุณากรอก Guild ID',
        description: 'Guild ID ต้องเป็นตัวเลขไอดีของ Discord เซิร์ฟเวอร์',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTenant(true);
    try {
      let expiresAt: string | null = null;
      if (newPlan === 'premium') {
        expiresAt = new Date(Date.now() + newDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await (supabase.from('tenant_configs' as any).upsert({
        guild_id: newGuildId.trim(),
        guild_name: newGuildName.trim() || `Guild ${newGuildId.trim().slice(-4)}`,
        plan: newPlan,
        status: 'active',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id' })) as any;

      if (error) throw error;

      toast({
        title: 'เพิ่มเซิร์ฟเวอร์สำเร็จ!',
        description: `บันทึกข้อมูลเซิร์ฟเวอร์ ${newGuildId.trim()} เรียบร้อยแล้ว`,
      });

      setIsAddModalOpen(false);
      setNewGuildId('');
      setNewGuildName('');
      setNewPlan('standard');
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'เพิ่มเซิร์ฟเวอร์ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTenant(false);
    }
  };

  // ── Calculated Preview Date in Modal ───────────────────────────────────────
  const calculatedExpiryDate = useMemo(() => {
    if (!selectedTenant) return null;
    const days = parseInt(customDays, 10);
    if (isNaN(days) || days <= 0) return null;

    let baseTime = Date.now();
    if (selectedTenant.expires_at) {
      const existing = new Date(selectedTenant.expires_at).getTime();
      if (existing > baseTime) baseTime = existing;
    }
    return new Date(baseTime + days * 24 * 60 * 60 * 1000);
  }, [selectedTenant, customDays]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">จัดการบอท Kuma (Multi-Tenant)</h1>
              <p className="text-sm text-muted-foreground">
                จัดการสถานะสมาชิก, สิทธิ์ Premium และห้องมินิเกมของเซิร์ฟเวอร์ภายนอกที่เชิญบอท Kuma
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
            <Server className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">เซิร์ฟเวอร์ที่ลงทะเบียนในระบบ</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">แผน Standard (ฟรี)</CardTitle>
            <Layers className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.standard}</div>
            <p className="text-xs text-muted-foreground mt-1">จำกัดสูงสุด 3 มินิเกมทั่วไป</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ห้องมินิเกมที่เปิดใช้งาน</CardTitle>
            <Gamepad2 className="w-4 h-4 text-muted-foreground" />
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
              placeholder="ค้นหาด้วยชื่อเซิร์ฟเวอร์ หรือ Guild ID..."
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
                <SelectItem value="all">ทั้งหมด ({tenants.length})</SelectItem>
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
                <TableHead className="w-[280px]">เซิร์ฟเวอร์</TableHead>
                <TableHead className="w-[140px]">แผนสมาชิก</TableHead>
                <TableHead className="w-[180px]">วันหมดอายุ</TableHead>
                <TableHead className="w-[120px] text-center">ห้องมินิเกม</TableHead>
                <TableHead className="w-[140px]">อัปเดตล่าสุด</TableHead>
                <TableHead className="w-[180px] text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูลเซิร์ฟเวอร์...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                    ไม่พบข้อมูลเซิร์ฟเวอร์ที่ตรงกับเงื่อนไขการค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => {
                  const isPremium = isTenantPremiumActive(tenant);
                  const remaining = getRemainingDays(tenant.expires_at);
                  const channelCount = getChannelCount(tenant.guild_id);

                  return (
                    <TableRow key={tenant.guild_id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & ID */}
                      <TableCell>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{tenant.guild_name || 'ไม่ทราบชื่อเซิร์ฟเวอร์'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                            {tenant.guild_id}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
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

                      {/* Active Channels */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1.5 hover:bg-muted"
                          onClick={() => {
                            setActiveChannelsTenant(tenant);
                            setIsChannelsModalOpen(true);
                          }}
                        >
                          <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                          <span>{channelCount} ห้อง</span>
                        </Button>
                      </TableCell>

                      {/* Updated At */}
                      <TableCell className="text-xs text-muted-foreground">
                        {tenant.updated_at
                          ? new Date(tenant.updated_at).toLocaleDateString('th-TH', {
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
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => openDowngradeDialog(tenant)}
                            >
                              ลดเป็น Standard
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Crown className="w-5 h-5" />
              อัปเกรดสถานะ Premium ให้เซิร์ฟเวอร์
            </DialogTitle>
            <DialogDescription>
              เซิร์ฟเวอร์จะได้รับสิทธิ์เปิดมินิเกมครบทั้ง 13 เกม และไม่จำกัดโควตาจำนวนห้อง
            </DialogDescription>
          </DialogHeader>

          {selectedTenant && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 p-3 rounded-lg border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เซิร์ฟเวอร์:</span>
                  <span className="font-semibold text-foreground">{selectedTenant.guild_name || 'ไม่ทราบชื่อ'}</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-muted-foreground">Guild ID:</span>
                  <span className="text-muted-foreground">{selectedTenant.guild_id}</span>
                </div>
                {selectedTenant.expires_at && isTenantPremiumActive(selectedTenant) && (
                  <div className="flex justify-between text-xs pt-1 border-t mt-1">
                    <span className="text-muted-foreground">วันหมดอายุเดิม:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {new Date(selectedTenant.expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  เลือกระยะเวลาที่ต้องการเพิ่ม:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 90, 180, 365].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={parseInt(customDays, 10) === d ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => setCustomDays(d.toString())}
                    >
                      +{d} วัน
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  หรือระบุจำนวนวันเอง:
                </label>
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="เช่น 30"
                />
              </div>

              {/* Live Preview Result */}
              {calculatedExpiryDate && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    วันหมดอายุใหม่หลังจากบันทึก:
                  </div>
                  <div className="text-foreground text-sm font-medium">
                    {calculatedExpiryDate.toLocaleDateString('th-TH', {
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
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
            >
              <Crown className="w-4 h-4" />
              {isSavingPremium ? 'กำลังบันทึก...' : 'บันทึกสถานะ Premium'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirm Downgrade ── */}
      <Dialog open={isDowngradeDialogOpen} onOpenChange={setIsDowngradeDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการปรับลดเป็น Standard
            </DialogTitle>
            <DialogDescription>
              เซิร์ฟเวอร์นี้จะถูกตัดสิทธิ์ Premium กลับไปใช้แผน Standard ฟรี (จำกัดสูงสุด 3 มินิเกม)
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

      {/* ── Modal: View Bound Channels ── */}
      <Dialog open={isChannelsModalOpen} onOpenChange={setIsChannelsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              ห้องมินิเกมที่เปิดใช้งาน
            </DialogTitle>
            <DialogDescription>
              {activeChannelsTenant?.guild_name || activeChannelsTenant?.guild_id}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {activeChannelsTenant && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {channels.filter((c) => c.guild_id === activeChannelsTenant.guild_id).length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    ยังไม่มีการผูกห้องมินิเกมในเซิร์ฟเวอร์นี้
                  </div>
                ) : (
                  channels
                    .filter((c) => c.guild_id === activeChannelsTenant.guild_id)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg text-sm border"
                      >
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-primary" />
                          <span className="font-medium">เกม ID #{c.game_id}</span>
                        </div>
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          Channel: {c.channel_id}
                        </code>
                      </div>
                    ))
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
