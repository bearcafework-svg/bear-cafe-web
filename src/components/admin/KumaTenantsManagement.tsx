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
  ExternalLink,
  Link2,
  BarChart3,
  Flame,
  Trophy,
  Activity,
  TrendingUp,
  MoreHorizontal,
  Medal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  invite_url?: string | null;
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
  const [allScores, setAllScores] = useState<{ guild_id: string; user_id: string; points: number; wins: number }[]>([]);
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
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [newPlan, setNewPlan] = useState<'standard' | 'premium'>('standard');
  const [newDays, setNewDays] = useState<number>(30);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // Edit Invite Dialog
  const [isEditInviteOpen, setIsEditInviteOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantConfig | null>(null);
  const [editInviteUrl, setEditInviteUrl] = useState('');
  const [isSavingInvite, setIsSavingInvite] = useState(false);

  // Analytics Modal (On-Demand)
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analyticsTenant, setAnalyticsTenant] = useState<TenantConfig | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [tenantScores, setTenantScores] = useState<{ user_id: string; points: number; wins: number }[]>([]);
  const [liveSessionsCount, setLiveSessionsCount] = useState<number>(0);

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
        .order('created_at', { ascending: false, nullsFirst: false })) as any;

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

      // 4. Fetch tenant_minigame_scores (เพื่อสรุปสถิติผู้เล่นในตาราง)
      const { data: scoresData, error: scoresErr } = await (supabase
        .from('tenant_minigame_scores' as any)
        .select('guild_id, user_id, points, wins')) as any;

      if (scoresErr) {
        console.warn('[KumaTenants] Failed to fetch scores:', scoresErr.message);
      }

      setTenants(configsData || []);
      setChannels(channelsData || []);
      setSettings(settingsData || []);
      setAllScores(scoresData || []);
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

  // ── Stats Summary & Lightweight Analytics ─────────────────────────────────
  const stats = useMemo(() => {
    const total = activeTenants.length;
    const premiumActive = activeTenants.filter((t) => isTenantPremiumActive(t)).length;
    const standard = total - premiumActive;
    const totalChannels = channels.length;
    const totalMembers = activeTenants.reduce((sum, t) => sum + (t.member_count || 0), 0);
    return { total, premiumActive, standard, totalChannels, totalMembers };
  }, [activeTenants, channels]);

  // 1. Premium ใกล้หมดอายุ (เหลือ <= 7 วัน)
  const expiringSoonTenants = useMemo(() => {
    return activeTenants.filter((t) => {
      if (t.plan !== 'premium' || !t.expires_at) return false;
      const diffDays = getRemainingDays(t.expires_at);
      return diffDays !== null && diffDays <= 7 && diffDays >= 0;
    });
  }, [activeTenants]);

  // 2. 3 อันดับมินิเกมยอดนิยม (นับจากห้องที่เปิดใช้งาน ไม่ต้อง Query เพิ่ม)
  const topPopularGames = useMemo(() => {
    const counts: Record<number, number> = {};
    channels.forEach((ch) => {
      counts[ch.game_id] = (counts[ch.game_id] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([gameId, count]) => ({
        gameId: Number(gameId),
        count,
        info: GAME_NAMES[Number(gameId)] || { name: `เกม #${gameId}`, icon: '🎮', short: `#${gameId}` },
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [channels]);

  // 3. รวมสถิติการเล่นมินิเกมทั้งระบบสำหรับแท็บ Analytics
  const globalAnalytics = useMemo(() => {
    const guildStatsMap = new Map<string, {
      guild_id: string;
      playerCount: number;
      totalWins: number;
      totalPoints: number;
    }>();

    allScores.forEach((s) => {
      const existing = guildStatsMap.get(s.guild_id) || {
        guild_id: s.guild_id,
        playerCount: 0,
        totalWins: 0,
        totalPoints: 0,
      };
      existing.playerCount += 1;
      existing.totalWins += (s.wins || 0);
      existing.totalPoints += (s.points || 0);
      guildStatsMap.set(s.guild_id, existing);
    });

    const serverRankings = Array.from(guildStatsMap.values())
      .map((stat) => {
        const tenant = tenants.find((t) => t.guild_id === stat.guild_id);
        return {
          ...stat,
          guild_name: tenant?.guild_name || `Server ${stat.guild_id}`,
          icon_url: tenant?.icon_url || null,
          invite_url: tenant?.invite_url || null,
          channelCount: channels.filter((c) => c.guild_id === stat.guild_id).length,
        };
      })
      .sort((a, b) => b.totalWins - a.totalWins);

    const topGlobalPlayers = [...allScores]
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((p) => {
        const tenant = tenants.find((t) => t.guild_id === p.guild_id);
        return {
          ...p,
          guild_name: tenant?.guild_name || p.guild_id,
        };
      });

    const totalWins = allScores.reduce((sum, s) => sum + (s.wins || 0), 0);
    const totalPoints = allScores.reduce((sum, s) => sum + (s.points || 0), 0);
    const totalPlayers = allScores.length;
    const activeGuildsCount = guildStatsMap.size;

    return {
      serverRankings,
      topGlobalPlayers,
      totalWins,
      totalPoints,
      totalPlayers,
      activeGuildsCount,
    };
  }, [allScores, tenants, channels]);

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

  // ── Open Analytics Modal (On-Demand: โหลดเฉพาะเซิร์ฟเวอร์ที่เลือก ไม่กินเน็ต) ──
  const openAnalyticsModal = async (tenant: TenantConfig) => {
    setAnalyticsTenant(tenant);
    setIsAnalyticsModalOpen(true);
    setAnalyticsLoading(true);
    setTenantScores([]);
    setLiveSessionsCount(0);

    try {
      // 1. ดึง Top 5 ผู้เล่นของเซิร์ฟเวอร์นี้
      const { data: scoresData, error: scoresErr } = await (supabase
        .from('tenant_minigame_scores' as any)
        .select('user_id, points, wins')
        .eq('guild_id', tenant.guild_id)
        .order('points', { ascending: false })
        .limit(5)) as any;

      if (scoresErr) {
        console.warn('[KumaTenants] Scores fetch error:', scoresErr.message);
      }

      // 2. ตรวจสอบจำนวนห้องที่กำลังเล่นสด
      const { count: liveCount, error: liveErr } = await (supabase
        .from('tenant_minigame_active_sessions' as any)
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', tenant.guild_id)) as any;

      if (liveErr) {
        console.warn('[KumaTenants] Live session fetch error:', liveErr.message);
      }

      setTenantScores(scoresData || []);
      setLiveSessionsCount(liveCount || 0);
    } catch (err: any) {
      console.error('[KumaTenants] Analytics fetch error:', err.message);
    } finally {
      setAnalyticsLoading(false);
    }
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

      let cleanInvite = newInviteUrl.trim();
      if (cleanInvite && !cleanInvite.startsWith('http://') && !cleanInvite.startsWith('https://')) {
        cleanInvite = `https://${cleanInvite}`;
      }

      const { error } = await (supabase
        .from('tenant_configs' as any)
        .upsert({
          guild_id: newGuildId.trim(),
          guild_name: newGuildName.trim() || `Server ${newGuildId.trim()}`,
          plan: newPlan,
          status: 'active',
          expires_at: expiresAt,
          invite_url: cleanInvite || null,
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
      setNewInviteUrl('');
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

  // ── Handlers: Save Invite URL ──────────────────────────────────────────────
  const handleSaveInvite = async () => {
    if (!editingTenant) return;
    setIsSavingInvite(true);
    try {
      let cleanUrl = editInviteUrl.trim();
      if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }

      const { error } = await (supabase
        .from('tenant_configs' as any)
        .update({
          invite_url: cleanUrl || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('guild_id', editingTenant.guild_id)) as any;

      if (error) throw error;

      toast({
        title: 'บันทึกลิงก์เชิญสำเร็จ',
        description: cleanUrl
          ? `อัปเดตช่องทางเข้าร่วมเซิร์ฟเวอร์ ${editingTenant.guild_name || editingTenant.guild_id} แล้ว`
          : 'ลบลิงก์เชิญเซิร์ฟเวอร์เรียบร้อยแล้ว',
      });

      setIsEditInviteOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('[KumaTenants] Save invite error:', err.message);
      toast({
        title: 'บันทึกลิงก์ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingInvite(false);
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
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/25 text-amber-500 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              จัดการ Kuma Tenants
              <Badge variant="outline" className="text-[11px] font-normal border-amber-500/30 text-amber-500 bg-amber-500/10 px-1.5 py-0">
                Multi-Tenant
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ติดตามเซิร์ฟเวอร์ที่ติดตั้งบอทคุมะ สิทธิ์ Premium และห้องมินิเกม
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มเซิร์ฟเวอร์
          </Button>
        </div>
      </div>

      {/* ── Slim Alert Banner (แสดงเฉพาะเมื่อมี Premium ใกล้หมดอายุ) ── */}
      {expiringSoonTenants.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3.5 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>มี {expiringSoonTenants.length} เซิร์ฟเวอร์ที่ Premium จะหมดอายุใน 7 วัน:</span>
            <span className="text-foreground/80 font-normal">
              {expiringSoonTenants.map((t) => t.guild_name || t.guild_id).slice(0, 3).join(', ')}
              {expiringSoonTenants.length > 3 && ` และอีก ${expiringSoonTenants.length - 3} เซิร์ฟเวอร์`}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 px-2"
            onClick={() => setPlanFilter('premium')}
          >
            กรองดู
          </Button>
        </div>
      )}

      {/* ── 4 Clean Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/40 border-border/50 shadow-none">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">เซิร์ฟเวอร์ทั้งหมด</div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">{stats.total}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 shadow-none">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">สมาชิกในระบบ</div>
              <div className="text-2xl font-bold tracking-tight text-emerald-500 mt-0.5">
                {stats.totalMembers.toLocaleString()}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 shadow-none">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-500 font-medium flex items-center gap-1">
                <Crown className="w-3 h-3" /> แผน Premium
              </div>
              <div className="text-2xl font-bold tracking-tight text-amber-500 mt-0.5">
                {stats.premiumActive}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">/ {stats.total}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 shadow-none">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">ห้องมินิเกมเปิดใช้</div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                {stats.totalChannels}
                {topPopularGames[0] && (
                  <span className="text-[11px] font-normal text-muted-foreground ml-1.5" title={`ฮิตอันดับ 1: ${topPopularGames[0].info.name}`}>
                    ({topPopularGames[0].info.icon} {topPopularGames[0].info.short})
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Gamepad2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Content Tabs ── */}
      <Tabs defaultValue="servers" className="space-y-4">
        <TabsList className="bg-muted/40 p-1 border border-border/50">
          <TabsTrigger value="servers" className="gap-2 text-xs">
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span>จัดการเซิร์ฟเวอร์ ({stats.total})</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 text-xs">
            <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>สถิติมินิเกมรวม ({globalAnalytics.totalPlayers} ผู้เล่น)</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: จัดการเซิร์ฟเวอร์ ── */}
        <TabsContent value="servers" className="space-y-3 m-0">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาด้วยชื่อเซิร์ฟเวอร์, Guild ID, หรือชื่อเจ้าของ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card/40 border-border/60"
              />
            </div>

            <Select value={planFilter} onValueChange={(val: any) => setPlanFilter(val)}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs bg-card/40 border-border/60">
                <SelectValue placeholder="เลือกแผน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">แผนทั้งหมด ({stats.total})</SelectItem>
                <SelectItem value="premium">👑 Premium ({stats.premiumActive})</SelectItem>
                <SelectItem value="standard">Standard ({stats.standard})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clean Table */}
          <Card className="border-border/60 shadow-none overflow-hidden bg-card/30">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px] text-xs">เซิร์ฟเวอร์</TableHead>
                    <TableHead className="w-[110px] text-xs">สมาชิก</TableHead>
                    <TableHead className="w-[170px] text-xs">แผน & วันหมดอายุ</TableHead>
                    <TableHead className="w-[140px] text-xs">ห้องมินิเกม</TableHead>
                    <TableHead className="w-[110px] text-xs">วันที่แอดบอท</TableHead>
                    <TableHead className="w-[110px] text-xs text-right">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                        กำลังโหลดข้อมูล...
                      </TableCell>
                    </TableRow>
                  ) : filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                        <AlertTriangle className="w-6 h-6 text-muted-foreground/50 mx-auto mb-1.5" />
                        ไม่พบข้อมูลเซิร์ฟเวอร์ที่ตรงกับเงื่อนไข
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => {
                      const isPremium = isTenantPremiumActive(tenant);
                      const remaining = getRemainingDays(tenant.expires_at);
                      const guildChs = getGuildChannels(tenant.guild_id);
                      const channelCount = guildChs.length;
                      const guildScores = allScores.filter((s) => s.guild_id === tenant.guild_id);
                      const guildPlayerCount = guildScores.length;

                      return (
                        <TableRow key={tenant.guild_id} className="hover:bg-muted/20 transition-colors">
                          {/* Name & ID & Avatar */}
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-8 h-8 border border-border/50 shrink-0">
                                <AvatarImage src={tenant.icon_url || undefined} alt={tenant.guild_name || 'Server'} />
                                <AvatarFallback className="bg-muted text-[10px] font-bold text-muted-foreground">
                                  {tenant.guild_name?.slice(0, 2).toUpperCase() || 'SV'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {tenant.invite_url ? (
                                    <a
                                      href={tenant.invite_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-foreground hover:text-primary transition-colors truncate max-w-[190px] flex items-center gap-1 group text-xs"
                                      title={`คลิกเพื่อจอยเซิร์ฟเวอร์: ${tenant.invite_url}`}
                                    >
                                      <span className="truncate">{tenant.guild_name || 'ไม่ทราบชื่อ'}</span>
                                      <ExternalLink className="w-3 h-3 text-primary/70 group-hover:text-primary shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="font-medium text-foreground truncate max-w-[200px] text-xs" title={tenant.guild_name || ''}>
                                      {tenant.guild_name || 'ไม่ทราบชื่อ'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 mt-0.5">
                                  <span className="font-mono">{tenant.guild_id}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground p-0"
                                    onClick={() => copyToClipboard(tenant.guild_id)}
                                    title="คัดลอก Guild ID"
                                  >
                                    {copiedId === tenant.guild_id ? (
                                      <Check className="w-2.5 h-2.5 text-green-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Member Count */}
                          <TableCell className="py-2.5">
                            <span className="text-xs font-medium text-foreground">
                              {(tenant.member_count || 0).toLocaleString()}
                            </span>
                            <span className="text-muted-foreground text-[10px] ml-1">คน</span>
                          </TableCell>

                          {/* Unified Plan & Expiry */}
                          <TableCell className="py-2.5">
                            {isPremium ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px] px-1.5 py-0 font-medium">
                                  <Crown className="w-2.5 h-2.5" />
                                  Premium
                                </Badge>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {remaining === 0 ? (
                                    <span className="text-amber-600 font-semibold">หมดอายุวันนี้</span>
                                  ) : remaining !== null && remaining <= 7 ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">เหลืออีก {remaining} วัน</span>
                                  ) : (
                                    <span>เหลืออีก {remaining} วัน</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 font-normal">
                                Standard
                              </Badge>
                            )}
                          </TableCell>

                          {/* Active Channels Button */}
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[11px] px-2 gap-1 text-primary hover:bg-primary/10 rounded-md font-normal border border-primary/20"
                                onClick={() => {
                                  setActiveChannelsTenant(tenant);
                                  setIsChannelsModalOpen(true);
                                }}
                              >
                                <Gamepad2 className="w-3 h-3" />
                                <span>{channelCount} ห้อง</span>
                              </Button>

                              {guildPlayerCount > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-0.5 font-medium"
                                  title={`มีผู้เล่นสะสม ${guildPlayerCount} คนในเซิร์ฟเวอร์นี้`}
                                >
                                  <Flame className="w-2.5 h-2.5 text-emerald-500" />
                                  <span>{guildPlayerCount} คน</span>
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Joined Date */}
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {tenant.created_at ? (
                              <span title={new Date(tenant.created_at).toLocaleString('th-TH')}>
                                {new Date(tenant.created_at).toLocaleDateString('th-TH', {
                                  dateStyle: 'short',
                                })}
                              </span>
                            ) : tenant.updated_at ? (
                              <span title="บันทึกครั้งแรก">
                                {new Date(tenant.updated_at).toLocaleDateString('th-TH', {
                                  dateStyle: 'short',
                                })}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>

                          {/* Compact Actions */}
                          <TableCell className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* ปุ่มสถิติ On-Demand */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                      onClick={() => openAnalyticsModal(tenant)}
                                    >
                                      <BarChart3 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>ดูสถิติและการเล่น</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* ปุ่มจัดการสิทธิ์ Premium */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1 font-medium"
                                onClick={() => openPremiumModal(tenant)}
                              >
                                <Crown className="w-3 h-3" />
                                <span>{isPremium ? 'ต่ออายุ' : 'อัปเกรด'}</span>
                              </Button>

                              {/* เมนูเพิ่มเติม (...) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 text-xs">
                                  {tenant.invite_url && (
                                    <DropdownMenuItem asChild>
                                      <a href={tenant.invite_url} target="_blank" rel="noopener noreferrer" className="gap-2 cursor-pointer">
                                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                        <span>เข้าร่วมเซิร์ฟเวอร์</span>
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingTenant(tenant);
                                      setEditInviteUrl(tenant.invite_url || '');
                                      setIsEditInviteOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                    <span>{tenant.invite_url ? 'แก้ไขลิงก์เชิญ' : '+ เพิ่มลิงก์เชิญ'}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(tenant.guild_id)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>คัดลอก Guild ID</span>
                                  </DropdownMenuItem>
                                  {isPremium && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => openDowngradeDialog(tenant)}
                                        className="gap-2 text-destructive cursor-pointer"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>ปรับลดเป็น Standard</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
        </TabsContent>

        {/* ── Tab 2: สถิติมินิเกมรวมทั้งระบบ (Minigames Overview) ── */}
        <TabsContent value="analytics" className="space-y-4 m-0">
          {/* สรุปสถิติ 4 ตัวหลัก */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-card/40 border-border/50 shadow-none">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">ผู้เล่นสะสมรวม</div>
                  <div className="text-2xl font-bold tracking-tight text-emerald-500 mt-0.5">
                    {globalAnalytics.totalPlayers} คน
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/50 shadow-none">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">ยอดรอบชนะรวม</div>
                  <div className="text-2xl font-bold tracking-tight text-amber-500 mt-0.5">
                    {globalAnalytics.totalWins.toLocaleString()} รอบ
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/50 shadow-none">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">แต้มสะสมในระบบ</div>
                  <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                    {globalAnalytics.totalPoints.toLocaleString()}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/50 shadow-none">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">เซิร์ฟเวอร์ที่มีการเล่น</div>
                  <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                    {globalAnalytics.activeGuildsCount}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">/ {stats.total} กิลด์</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ตารางจัดอันดับ 2 ตารางคู่กัน (Server Rankings & Top Global Players) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* อันดับเซิร์ฟเวอร์ที่เล่นมากที่สุด */}
            <Card className="border-border/60 shadow-none bg-card/30">
              <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  อันดับเซิร์ฟเวอร์ที่เล่นเยอะที่สุด
                </CardTitle>
                <span className="text-[11px] text-muted-foreground font-normal">เรียงตามรอบชนะ</span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[45px] text-xs">อันดับ</TableHead>
                      <TableHead className="text-xs">เซิร์ฟเวอร์</TableHead>
                      <TableHead className="text-xs text-center w-[80px]">ผู้เล่น</TableHead>
                      <TableHead className="text-xs text-right w-[95px]">รอบชนะ</TableHead>
                      <TableHead className="text-xs text-right w-[95px]">แต้มรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalAnalytics.serverRankings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          ยังไม่มีข้อมูลการเล่นในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      globalAnalytics.serverRankings.map((stat, idx) => (
                        <TableRow key={stat.guild_id} className="hover:bg-muted/20 text-xs">
                          <TableCell className="py-2 font-bold">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border border-border/50 shrink-0">
                                <AvatarImage src={stat.icon_url || undefined} />
                                <AvatarFallback className="text-[9px] font-bold">SV</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate max-w-[150px]">
                                  {stat.guild_name}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {stat.channelCount} ห้อง
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-center font-medium text-emerald-500">
                            {stat.playerCount} คน
                          </TableCell>
                          <TableCell className="py-2 text-right font-semibold font-mono text-amber-600 dark:text-amber-400">
                            {stat.totalWins.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono text-muted-foreground">
                            {stat.totalPoints.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top 10 ผู้เล่นคะแนนสูงสุดทั่วโลก */}
            <Card className="border-border/60 shadow-none bg-card/30">
              <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Top 10 ผู้เล่นคะแนนสูงสุดทั่วระบบ
                </CardTitle>
                <span className="text-[11px] text-muted-foreground font-normal">คะแนนสะสม</span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[45px] text-xs">อันดับ</TableHead>
                      <TableHead className="text-xs">Discord UID</TableHead>
                      <TableHead className="text-xs">เซิร์ฟเวอร์</TableHead>
                      <TableHead className="text-xs text-right w-[80px]">ชนะ</TableHead>
                      <TableHead className="text-xs text-right w-[95px]">แต้มสะสม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalAnalytics.topGlobalPlayers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          ยังไม่มีข้อมูลผู้เล่นในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      globalAnalytics.topGlobalPlayers.map((player, idx) => (
                        <TableRow key={`${player.guild_id}-${player.user_id}`} className="hover:bg-muted/20 text-xs">
                          <TableCell className="py-2 font-bold">
                            {idx === 0 ? '👑' : idx === 1 ? '⭐' : idx === 2 ? '✨' : `#${idx + 1}`}
                          </TableCell>
                          <TableCell className="py-2 font-mono text-[11px] text-foreground">
                            {player.user_id}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground truncate max-w-[130px]">
                            {player.guild_name}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono text-muted-foreground">
                            {player.wins}
                          </TableCell>
                          <TableCell className="py-2 text-right font-semibold font-mono text-amber-600 dark:text-amber-400">
                            {player.points.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
              การกระทำนี้จะเปลี่ยนแผนของเซิร์ฟเวอร์กลับเป็น Standard (ฟรี) และเซิร์ฟเวอร์จะถูกจำกัดให้เล่นได้เฉพาะ 5 มินิเกมเริ่มต้น
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
                ลิงก์เชิญเข้าร่วมเซิร์ฟเวอร์ (Invite URL - ใส่หรือไม่ใส่ก็ได้)
              </label>
              <Input
                placeholder="เช่น https://discord.gg/your-server"
                value={newInviteUrl}
                onChange={(e) => setNewInviteUrl(e.target.value)}
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
                  <SelectItem value="standard">Standard (ฟรี 5 มินิเกม)</SelectItem>
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

      {/* ── Modal: Edit Server Invite URL ── */}
      <Dialog open={isEditInviteOpen} onOpenChange={setIsEditInviteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              จัดการลิงก์เข้าร่วมเซิร์ฟเวอร์
            </DialogTitle>
            <DialogDescription>
              {editingTenant?.guild_name || editingTenant?.guild_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/60 p-3 rounded-lg text-xs space-y-1">
              <div>
                <strong>เซิร์ฟเวอร์:</strong> {editingTenant?.guild_name || 'ไม่ทราบชื่อ'}
              </div>
              <div className="text-muted-foreground font-mono">
                <strong>Guild ID:</strong> {editingTenant?.guild_id}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Discord Invite Link
              </label>
              <Input
                placeholder="https://discord.gg/..."
                value={editInviteUrl}
                onChange={(e) => setEditInviteUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                ใส่ลิงก์เชิญเซิร์ฟเวอร์ของ Discord เพื่อให้แอดมินสามารถกดเข้าเยี่ยมชมเซิร์ฟเวอร์ได้ทันที (เว้นว่างไว้เพื่อลบลิงก์ออก)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {editInviteUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 mr-auto"
                onClick={() => setEditInviteUrl('')}
              >
                ล้างลิงก์
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditInviteOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveInvite} disabled={isSavingInvite}>
              {isSavingInvite ? 'กำลังบันทึก...' : 'บันทึกลิงก์'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Server Analytics (On-Demand & Lightweight) ── */}
      <Dialog open={isAnalyticsModalOpen} onOpenChange={setIsAnalyticsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  สถิติการเล่นมินิเกม
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {analyticsTenant?.guild_name || analyticsTenant?.guild_id}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {analyticsTenant && (
            <div className="space-y-4 py-2">
              {/* สถานะ Real-time Session */}
              <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                liveSessionsCount > 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted/50 border-border/60 text-muted-foreground'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    liveSessionsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                  }`} />
                  <span className="font-medium">
                    {liveSessionsCount > 0
                      ? `กำลังมีผู้เล่นแข่งมินิเกมอยู่สดๆ ${liveSessionsCount} ห้อง`
                      : 'ขณะนี้ไม่มีเซสชันที่กำลังแข่งขันสด'}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {liveSessionsCount > 0 ? 'LIVE' : 'IDLE'}
                </Badge>
              </div>

              {/* ข้อมูลภาพรวมมินิเกมของกิลด์ */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/40 p-2 rounded-lg border border-border/40 text-center">
                  <div className="text-[11px] text-muted-foreground">ห้องมินิเกม</div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {getGuildChannels(analyticsTenant.guild_id).length} ห้อง
                  </div>
                </div>
                <div className="bg-muted/40 p-2 rounded-lg border border-border/40 text-center">
                  <div className="text-[11px] text-muted-foreground">ผู้เล่นทั้งหมด</div>
                  <div className="text-base font-bold text-emerald-500 mt-0.5">
                    {allScores.filter((s) => s.guild_id === analyticsTenant.guild_id).length} คน
                  </div>
                </div>
                <div className="bg-muted/40 p-2 rounded-lg border border-border/40 text-center">
                  <div className="text-[11px] text-muted-foreground">รอบชนะรวม</div>
                  <div className="text-base font-bold text-amber-500 mt-0.5">
                    {allScores
                      .filter((s) => s.guild_id === analyticsTenant.guild_id)
                      .reduce((sum, s) => sum + (s.wins || 0), 0)
                      .toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 5 อันดับผู้เล่นคะแนนสูงสุด */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    Top 5 ผู้เล่นคะแนนสูงสุดในเซิร์ฟเวอร์
                  </span>
                  <span className="text-[10px] text-muted-foreground">สะสมแต้ม</span>
                </div>

                {analyticsLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังโหลดสถิติผู้เล่น...
                  </div>
                ) : tenantScores.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
                    ยังไม่มีข้อมูลคะแนนผู้เล่นในเซิร์ฟเวอร์นี้
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {tenantScores.map((score, index) => (
                      <div
                        key={score.user_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            index === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : index === 1
                              ? 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                              : index === 2
                              ? 'bg-amber-700/20 text-amber-700 dark:text-amber-500'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <code className="text-[11px] font-mono text-muted-foreground">
                            UID: {score.user_id}
                          </code>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            ชนะ {score.wins} รอบ
                          </span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {score.points.toLocaleString()} แต้ม
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsAnalyticsModalOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KumaTenantsManagement;
