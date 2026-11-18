import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  Coins,
  Gift,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Shield,
  Layers,
  Calendar,
  User,
  Copy,
  Check,
  Flame,
  Award,
  Crown,
  SlidersHorizontal
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

export interface CoinReward {
  id: number;
  name: string;
  history_name: string;
  tier: 'god' | 'epic' | 'rare' | 'common';
  reward_type: 'auto' | 'manual';
  role_id: string | null;
  points_reward: number;
  duplicate_compensation_points?: number;
  is_unlimited: boolean;
  stock: number;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CoinRoll {
  id: number;
  discord_id: string;
  reward_id: number | null;
  tier: 'god' | 'epic' | 'rare' | 'common';
  reward_name: string;
  history_name: string;
  reward_type: 'auto' | 'manual';
  is_claimed: boolean;
  claimed_at: string | null;
  claimed_by_admin_id: string | null;
  expires_at: string | null;
  created_at: string;
}

interface AdminProfile {
  id: string;
  discord_id?: string;
  username?: string;
  discord_username?: string;
  nickname?: string;
  avatar_url?: string;
}

// การตั้งค่าและมีเดียของทั้ง 4 ระดับรางวัลตรงตามเอกสาร แผนระบบหมีโยนเหรียญ.md
const TIERS_DATA: {
  key: 'god' | 'epic' | 'rare' | 'common';
  name: string;
  rate: string;
  description: string;
  gif: string;
  colorClass: string;
  borderClass: string;
  badgeClass: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'god',
    name: 'God',
    rate: '0.07%',
    description: 'ระดับสูงสุด ออกยากที่สุด (0.07%)',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480702337786037/3.gif',
    colorClass: 'text-amber-400',
    borderClass: 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent',
    badgeClass: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold',
    icon: <Crown className="h-5 w-5 text-amber-400" />
  },
  {
    key: 'epic',
    name: 'Epic',
    rate: '1.00%',
    description: 'ระดับพิเศษ หายากมาก (1.00%)',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480702719463496/2.gif',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500/40 bg-gradient-to-b from-purple-500/10 to-transparent',
    badgeClass: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold',
    icon: <Sparkles className="h-5 w-5 text-purple-400" />
  },
  {
    key: 'rare',
    name: 'Rare',
    rate: '45.00%',
    description: 'ระดับหายากปานกลาง (45.00%)',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480703298408600/1.gif',
    colorClass: 'text-sky-400',
    borderClass: 'border-sky-500/40 bg-gradient-to-b from-sky-500/10 to-transparent',
    badgeClass: 'bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold',
    icon: <Award className="h-5 w-5 text-sky-400" />
  },
  {
    key: 'common',
    name: 'Common',
    rate: '85.00%',
    description: 'ระดับพื้นฐาน รางวัลทั่วไป (85.00%)',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480703755714672/e6d42f9e6f60a678.gif',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-transparent',
    badgeClass: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold',
    icon: <Gift className="h-5 w-5 text-emerald-400" />
  }
];

export function CoinGachaManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Tabs: rewards (แบ่ง 4 ระดับ) vs claims (รายการรอมอบของ)
  const [activeTab, setActiveTab] = useState<'rewards' | 'claims'>('rewards');

  // Rewards State
  const [rewards, setRewards] = useState<CoinReward[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);

  // Dialog State (Add/Edit)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<CoinReward | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    history_name: '',
    tier: 'common' as 'god' | 'epic' | 'rare' | 'common',
    reward_type: 'manual' as 'auto' | 'manual',
    role_id: '',
    points_reward: 0,
    duplicate_compensation_points: 300,
    is_unlimited: true,
    stock: -1,
    is_active: true,
    sort_order: 0
  });

  // Delete State
  const [deletingReward, setDeletingReward] = useState<CoinReward | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Claims State
  const [rolls, setRolls] = useState<CoinRoll[]>([]);
  const [isLoadingRolls, setIsLoadingRolls] = useState(true);
  const [claimSearch, setClaimSearch] = useState('');
  const [claimFilter, setClaimFilter] = useState<'pending' | 'claimed' | 'all'>('pending');
  const [markingRollId, setMarkingRollId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});

  // Tier Rates State
  const [tierRates, setTierRates] = useState<Record<'god' | 'epic' | 'rare' | 'common', number>>({
    god: 0.07,
    epic: 1.0,
    rare: 45.0,
    common: 53.93
  });
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [rateForm, setRateForm] = useState({
    god: 0.07,
    epic: 1.0,
    rare: 45.0
  });
  const [isSavingRates, setIsSavingRates] = useState(false);

  // ── Fetch Tier Rates ───────────────────────────────────────────────────────
  const fetchTierRates = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      const { data, error } = await supabase
        .from('gacha_coin_tier_rates')
        .select('tier, rate_percent');

      if (error) throw error;
      if (data && data.length > 0) {
        const map: Record<'god' | 'epic' | 'rare' | 'common', number> = {
          god: 0.07,
          epic: 1.0,
          rare: 45.0,
          common: 53.93
        };
        data.forEach((r: { tier: string; rate_percent: number }) => {
          if (r.tier && typeof r.rate_percent === 'number') {
            map[r.tier as 'god' | 'epic' | 'rare' | 'common'] = Number(r.rate_percent);
          }
        });
        setTierRates(map);
      }
    } catch (err) {
      console.error('Error fetching tier rates:', err);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  // ── Fetch Rewards ──────────────────────────────────────────────────────────
  const fetchRewards = useCallback(async () => {
    setIsLoadingRewards(true);
    try {
      const { data, error } = await supabase
        .from('gacha_coin_rewards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setRewards((data as unknown as CoinReward[]) || []);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Error fetching coin rewards:', e);
      toast({
        variant: 'destructive',
        title: 'โหลดข้อมูลของรางวัลไม่สำเร็จ',
        description: e.message
      });
    } finally {
      setIsLoadingRewards(false);
    }
  }, [toast]);

  // ── Fetch Rolls / Claims & Admin Profiles ───────────────────────────────────
  const fetchRolls = useCallback(async () => {
    setIsLoadingRolls(true);
    try {
      let query = supabase
        .from('gacha_coin_rolls')
        .select('*')
        .order('created_at', { ascending: false });

      if (claimFilter === 'pending') {
        query = query.eq('is_claimed', false).eq('reward_type', 'manual');
      } else if (claimFilter === 'claimed') {
        query = query.eq('is_claimed', true);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      const fetchedRolls = (data as unknown as CoinRoll[]) || [];
      setRolls(fetchedRolls);

      // ดึงโปรไฟล์แอดมินที่เคยกดยืนยันแจกของ
      const adminIds = Array.from(
        new Set(fetchedRolls.map((r) => r.claimed_by_admin_id).filter(Boolean))
      ) as string[];

      if (adminIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, discord_id, username, discord_username, nickname, avatar_url')
          .or(`id.in.(${adminIds.join(',')}),discord_id.in.(${adminIds.join(',')})`);

        if (profilesData) {
          const map: Record<string, AdminProfile> = {};
          profilesData.forEach((p) => {
            if (p.id) map[p.id] = p;
            if (p.discord_id) map[p.discord_id] = p;
          });
          setAdminProfiles(map);
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Error fetching coin rolls:', e);
      toast({
        variant: 'destructive',
        title: 'โหลดประวัติการสุ่มไม่สำเร็จ',
        description: e.message
      });
    } finally {
      setIsLoadingRolls(false);
    }
  }, [claimFilter, toast]);

  useEffect(() => {
    fetchRewards();
    fetchTierRates();
  }, [fetchRewards, fetchTierRates]);

  useEffect(() => {
    if (activeTab === 'claims') {
      fetchRolls();
    }
  }, [activeTab, fetchRolls]);

  // ── Open Rate Dialog & Save Tier Rates ─────────────────────────────────────
  const handleOpenRateDialog = () => {
    setRateForm({
      god: tierRates.god,
      epic: tierRates.epic,
      rare: tierRates.rare
    });
    setIsRateDialogOpen(true);
  };

  const handleSaveTierRates = async () => {
    const god = parseFloat(String(rateForm.god)) || 0;
    const epic = parseFloat(String(rateForm.epic)) || 0;
    const rare = parseFloat(String(rateForm.rare)) || 0;

    if (god < 0 || epic < 0 || rare < 0) {
      toast({ variant: 'destructive', title: 'อัตราสุ่มต้องไม่ติดลบ' });
      return;
    }

    const sum = god + epic + rare;
    if (sum > 100) {
      toast({
        variant: 'destructive',
        title: 'ผลรวมอัตราสุ่มเกิน 100%',
        description: `ผลรวมปัจจุบัน: ${sum.toFixed(4)}% (God + Epic + Rare ต้องไม่เกิน 100%)`
      });
      return;
    }

    const common = parseFloat((100 - sum).toFixed(4));
    setIsSavingRates(true);

    try {
      const upserts = [
        { tier: 'god', rate_percent: god, updated_at: new Date().toISOString() },
        { tier: 'epic', rate_percent: epic, updated_at: new Date().toISOString() },
        { tier: 'rare', rate_percent: rare, updated_at: new Date().toISOString() },
        { tier: 'common', rate_percent: common, updated_at: new Date().toISOString() }
      ];

      const { error } = await supabase
        .from('gacha_coin_tier_rates')
        .upsert(upserts, { onConflict: 'tier' });

      if (error) throw error;

      toast({
        title: 'บันทึกอัตราการสุ่มสำเร็จ ✨',
        description: `God: ${god}% | Epic: ${epic}% | Rare: ${rare}% | Common: ${common}%`
      });

      setTierRates({ god, epic, rare, common });
      setIsRateDialogOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'บันทึกอัตราการสุ่มไม่สำเร็จ', description: e.message });
    } finally {
      setIsSavingRates(false);
    }
  };

  // ── Save Reward (Create / Update) ──────────────────────────────────────────
  const handleOpenDialog = (tierDefault: 'god' | 'epic' | 'rare' | 'common' = 'common', reward?: CoinReward) => {
    if (reward) {
      setEditingReward(reward);
      setRewardForm({
        name: reward.name,
        history_name: reward.history_name,
        tier: reward.tier,
        reward_type: reward.reward_type,
        role_id: reward.role_id || '',
        points_reward: reward.points_reward || 0,
        duplicate_compensation_points: reward.duplicate_compensation_points ?? 300,
        is_unlimited: reward.is_unlimited,
        stock: reward.stock,
        is_active: reward.is_active,
        sort_order: reward.sort_order || 0
      });
    } else {
      setEditingReward(null);
      setRewardForm({
        name: '',
        history_name: '',
        tier: tierDefault,
        reward_type: 'manual',
        role_id: '',
        points_reward: 0,
        duplicate_compensation_points: 300,
        is_unlimited: true,
        stock: -1,
        is_active: true,
        sort_order: rewards.filter((r) => r.tier === tierDefault).length
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveReward = async () => {
    if (!rewardForm.name.trim()) {
      toast({ variant: 'destructive', title: 'กรุณาระบุชื่อของรางวัล' });
      return;
    }
    if (!rewardForm.history_name.trim()) {
      toast({ variant: 'destructive', title: 'กรุณาระบุชื่อของรางวัลในประวัติ' });
      return;
    }

    try {
      const payload = {
        name: rewardForm.name.trim(),
        history_name: rewardForm.history_name.trim(),
        tier: rewardForm.tier,
        reward_type: rewardForm.reward_type,
        role_id: rewardForm.reward_type === 'auto' && rewardForm.role_id.trim() ? rewardForm.role_id.trim() : null,
        points_reward: rewardForm.reward_type === 'auto' ? Number(rewardForm.points_reward) || 0 : 0,
        duplicate_compensation_points: rewardForm.reward_type === 'auto' && rewardForm.role_id.trim() ? Number(rewardForm.duplicate_compensation_points) || 300 : 300,
        is_unlimited: rewardForm.is_unlimited,
        stock: rewardForm.is_unlimited ? -1 : Math.max(0, Number(rewardForm.stock) || 0),
        is_active: rewardForm.is_active,
        sort_order: Number(rewardForm.sort_order) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingReward) {
        const { error } = await supabase
          .from('gacha_coin_rewards')
          .update(payload)
          .eq('id', editingReward.id);

        if (error) throw error;
        toast({ title: 'บันทึกของรางวัลเรียบร้อยแล้ว' });
      } else {
        const { error } = await supabase
          .from('gacha_coin_rewards')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'เพิ่มของรางวัลใหม่สำเร็จ' });
      }

      setIsDialogOpen(false);
      fetchRewards();
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาดในการบันทึก', description: e.message });
    }
  };

  // ── Toggle Reward Active ───────────────────────────────────────────────────
  const handleToggleActive = async (reward: CoinReward, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('gacha_coin_rewards')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', reward.id);

      if (error) throw error;
      setRewards((prev) =>
        prev.map((r) => (r.id === reward.id ? { ...r, is_active: !currentStatus } : r))
      );
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'อัปเดตสถานะไม่สำเร็จ', description: e.message });
    }
  };

  // ── Delete Reward ──────────────────────────────────────────────────────────
  const handleDeleteReward = async () => {
    if (!deletingReward) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('gacha_coin_rewards')
        .delete()
        .eq('id', deletingReward.id);

      if (error) throw error;
      toast({ title: 'ลบของรางวัลเรียบร้อยแล้ว' });
      setDeletingReward(null);
      fetchRewards();
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'ลบของรางวัลไม่สำเร็จ', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Mark Claim as Completed (บันทึกเวลาและโปรไฟล์ผู้ดำเนินการ) ──────────────
  const handleMarkClaimed = async (roll: CoinRoll) => {
    setMarkingRollId(roll.id);
    try {
      const adminId = user?.id || 'admin';
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('gacha_coin_rolls')
        .update({
          is_claimed: true,
          claimed_at: now,
          claimed_by_admin_id: adminId
        })
        .eq('id', roll.id);

      if (error) throw error;

      toast({
        title: '✅ ยืนยันการมอบของขวัญสำเร็จ!',
        description: `ทำรายการมอบ "${roll.reward_name}" ให้ <@${roll.discord_id}> เรียบร้อยแล้วค่ะ`
      });

      // ดึงโปรไฟล์แอดมินคนปัจจุบันมาเก็บใน map ทันที
      if (user && !adminProfiles[adminId]) {
        setAdminProfiles((prev) => ({
          ...prev,
          [adminId]: {
            id: user.id,
            username: user.user_metadata?.full_name || user.email || 'Admin',
            avatar_url: user.user_metadata?.avatar_url
          }
        }));
      }

      // อัปเดต State ตาราง
      setRolls((prev) =>
        prev.map((r) =>
          r.id === roll.id
            ? { ...r, is_claimed: true, claimed_at: now, claimed_by_admin_id: adminId }
            : r
        )
      );
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาดในการยืนยัน', description: e.message });
    } finally {
      setMarkingRollId(null);
    }
  };

  // ── Copy Discord ID ────────────────────────────────────────────────────────
  const copyDiscordId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Filtered Rolls ─────────────────────────────────────────────────────────
  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      const matchesSearch =
        !claimSearch ||
        r.discord_id.includes(claimSearch) ||
        r.reward_name.toLowerCase().includes(claimSearch.toLowerCase());
      return matchesSearch;
    });
  }, [rolls, claimSearch]);

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRewards = rewards.length;
    const activeRewards = rewards.filter((r) => r.is_active).length;
    const pendingRolls = rolls.filter((r) => !r.is_claimed && r.reward_type === 'manual').length;
    const claimedRolls = rolls.filter((r) => r.is_claimed).length;

    return { totalRewards, activeRewards, pendingRolls, claimedRolls };
  }, [rewards, rolls]);

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">ระบบของขวัญหมีโยนเหรียญ (Coin Gacha)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการของรางวัลแยก 4 ระดับ (God, Epic, Rare, Common) อัตราออก สต็อกเรียลไทม์ และระบบตรวจสอบยืนยันการมอบของขวัญ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenRateDialog}
            className="gap-2 border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            ปรับอัตราการสุ่ม (Drop Rates)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'rewards') {
                fetchRewards();
                fetchTierRates();
              } else {
                fetchRolls();
              }
            }}
            disabled={isLoadingRewards || isLoadingRolls || isLoadingRates}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', (isLoadingRewards || isLoadingRolls || isLoadingRates) && 'animate-spin')} />
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* ── Overview Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ของรางวัลทั้งหมด (4 ระดับ)</p>
              <p className="text-2xl font-bold mt-1">{stats.totalRewards} ชิ้น</p>
            </div>
            <Gift className="h-8 w-8 text-muted-foreground/30" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">พร้อมสุ่มในตู้ (Active)</p>
              <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.activeRewards} ชิ้น</p>
            </div>
            <Sparkles className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card className={cn('transition-all', stats.pendingRolls > 0 ? 'border-amber-500/60 bg-amber-500/10' : 'bg-card/50')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">รอมอบของขวัญ (Pending)</p>
              <p className="text-2xl font-bold mt-1 text-amber-500">{stats.pendingRolls} รายการ</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500/40" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ส่งมอบสำเร็จแล้ว</p>
              <p className="text-2xl font-bold mt-1 text-sky-500">{stats.claimedRolls} รายการ</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-sky-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabs: ของรางวัล (4 ระดับ) VS รายการรอมอบของขวัญ ──────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rewards' | 'claims')}>
        <TabsList className="grid w-full md:w-[480px] grid-cols-2">
          <TabsTrigger value="rewards" className="gap-2">
            <Gift className="h-4 w-4" />
            ของรางวัลทั้ง 4 ระดับ (Tiers)
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <Clock className="h-4 w-4" />
            หน้าตรวจเช็กการรับของขวัญ
            {stats.pendingRolls > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-500 text-black text-xs px-1.5 py-0 font-bold">
                {stats.pendingRolls}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: ของรางวัลทั้ง 4 ระดับ (God, Epic, Rare, Common) ───────── */}
        <TabsContent value="rewards" className="mt-6 space-y-6">
          {isLoadingRewards ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-500" />
                กำลังโหลดรายการของรางวัลทั้ง 4 ระดับ...
              </CardContent>
            </Card>
          ) : (
            TIERS_DATA.map((tierInfo) => {
              const tierRewards = rewards.filter((r) => r.tier === tierInfo.key);
              const activeCount = tierRewards.filter((r) => r.is_active).length;

              return (
                <Card key={tierInfo.key} className={cn('border-2 overflow-hidden shadow-sm', tierInfo.borderClass)}>
                  {/* Tier Header with GIF and Add Button */}
                  <CardHeader className="p-5 bg-card/60 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Tier GIF Thumbnail */}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shadow-inner bg-black/40 flex-shrink-0">
                        <img
                          src={tierInfo.gif}
                          alt={tierInfo.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-sm px-2.5 py-0.5 uppercase tracking-wider', tierInfo.badgeClass)}>
                            {tierInfo.name}
                          </Badge>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border">
                            อัตราออก: {tierRates[tierInfo.key] !== undefined ? `${tierRates[tierInfo.key]}%` : tierInfo.rate}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {tierInfo.description} • มี {tierRewards.length} รายการ (เปิดใช้งาน {activeCount} รายการ)
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleOpenDialog(tierInfo.key)}
                      className="gap-1.5 shadow-sm self-start md:self-auto"
                    >
                      <Plus className="h-4 w-4" />
                      เพิ่มรางวัลระดับ {tierInfo.name}
                    </Button>
                  </CardHeader>

                  {/* Tier Rewards Table */}
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[45%]">ชื่อรางวัล / ชื่อในประวัติ</TableHead>
                          <TableHead className="w-[20%]">ประเภทการรับ</TableHead>
                          <TableHead className="w-[15%] text-center">สต็อกคงเหลือ (เรียลไทม์)</TableHead>
                          <TableHead className="w-[10%] text-center">เปิดใช้งาน</TableHead>
                          <TableHead className="w-[10%] text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tierRewards.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-xs">
                              ยังไม่มีของรางวัลในระดับ {tierInfo.name} กดปุ่ม &quot;เพิ่มรางวัลระดับ {tierInfo.name}&quot; เพื่อเริ่มต้นค่ะ
                            </TableCell>
                          </TableRow>
                        ) : (
                          tierRewards.map((reward) => (
                            <TableRow key={reward.id} className={cn(!reward.is_active && 'opacity-60 bg-muted/10')}>
                              {/* 1. ชื่อรางวัล & ชื่อในประวัติ */}
                              <TableCell>
                                <div className="font-semibold text-foreground text-sm">{reward.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                  <span>ชื่อในประวัติ:</span>
                                  <span className="text-foreground/90 font-mono bg-muted px-1.5 py-0.2 rounded border">
                                    `{reward.history_name}`
                                  </span>
                                </div>
                              </TableCell>

                              {/* 2. ประเภทการรับ */}
                              <TableCell>
                                {reward.reward_type === 'auto' ? (
                                  <div className="space-y-0.5">
                                    <Badge variant="outline" className="text-xs border-sky-500/40 text-sky-400 bg-sky-500/10 gap-1">
                                      ⚡ รับอัตโนมัติ
                                    </Badge>
                                    {reward.role_id && (
                                      <div className="text-[11px] text-muted-foreground font-mono">
                                        Role ID: {reward.role_id}
                                        <span className="block text-amber-500 font-sans">
                                          (ซ้ำแจก +{formatNumber(reward.duplicate_compensation_points ?? 300)} แต้ม)
                                        </span>
                                      </div>
                                    )}
                                    {reward.points_reward > 0 && (
                                      <div className="text-[11px] text-amber-500 font-mono font-bold">
                                        +{formatNumber(reward.points_reward)} แต้ม
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1">
                                      🤝 รับกับทีมงาน
                                    </Badge>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      หมดเขตใน 1 เดือน
                                    </div>
                                  </div>
                                )}
                              </TableCell>

                              {/* 3. สต็อกคงเหลือแบบเรียลไทม์ */}
                              <TableCell className="text-center">
                                {reward.is_unlimited ? (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    ♾️ ไม่จำกัด
                                  </Badge>
                                ) : (
                                  <div className="inline-block">
                                    <span
                                      className={cn(
                                        'font-mono font-bold text-xs px-2.5 py-1 rounded-md border',
                                        reward.stock > 5
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                          : reward.stock > 0
                                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                          : 'bg-red-500/10 text-red-400 border-red-500/30 line-through'
                                      )}
                                    >
                                      {reward.stock} ชิ้น
                                    </span>
                                    {reward.stock === 0 && (
                                      <p className="text-[10px] text-red-400 mt-1">หมดสต็อก (Reroll อัตโนมัติ)</p>
                                    )}
                                  </div>
                                )}
                              </TableCell>

                              {/* 4. สวิตช์เปิด/ปิด */}
                              <TableCell className="text-center">
                                <Switch
                                  checked={reward.is_active}
                                  onCheckedChange={() => handleToggleActive(reward, reward.is_active)}
                                />
                              </TableCell>

                              {/* 5. ปุ่มแก้ไข / ลบ */}
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleOpenDialog(reward.tier, reward)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeletingReward(reward)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── TAB 2: หน้าตรวจสอบการรับของขวัญ (Pending Claims & History) ─────── */}
        <TabsContent value="claims" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหา Discord ID หรือชื่อของรางวัล..."
                    value={claimSearch}
                    onChange={(e) => setClaimSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={claimFilter} onValueChange={(v) => setClaimFilter(v as 'pending' | 'claimed' | 'all')}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="สถานะการรับ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ รอมอบของ (Pending)</SelectItem>
                      <SelectItem value="claimed">✅ มอบแล้ว (Claimed)</SelectItem>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="rounded-md border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">ผู้รับรางวัล (DiscordID)</TableHead>
                      <TableHead className="w-[200px]">ของรางวัลที่ได้รับ</TableHead>
                      <TableHead className="w-[140px]">วันเวลาที่สุ่มได้</TableHead>
                      <TableHead className="w-[150px]">เวลาคงเหลือ / หมดเขต</TableHead>
                      <TableHead className="w-[140px] text-center">สถานะการรับ</TableHead>
                      <TableHead className="w-[180px]">วันเวลารับ & ผู้ดำเนินการ</TableHead>
                      <TableHead className="w-[110px] text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRolls ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                          กำลังโหลดรายการของขวัญ...
                        </TableCell>
                      </TableRow>
                    ) : filteredRolls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                          {claimFilter === 'pending'
                            ? 'ไม่มีรายการของขวัญที่รอการรับในขณะนี้ค่ะ 🎉'
                            : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRolls.map((roll) => {
                        const tierInfo = TIERS_DATA.find((t) => t.key === roll.tier) || TIERS_DATA[3];
                        const isExpired = roll.expires_at && new Date(roll.expires_at).getTime() < Date.now();
                        const adminProf = roll.claimed_by_admin_id ? adminProfiles[roll.claimed_by_admin_id] : null;

                        return (
                          <TableRow key={roll.id} className={cn(roll.is_claimed && 'bg-muted/10')}>
                            {/* 1. Discord ID */}
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                                <span>{roll.discord_id}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyDiscordId(roll.discord_id)}
                                >
                                  {copiedId === roll.discord_id ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                &lt;@{roll.discord_id}&gt;
                              </div>
                            </TableCell>

                            {/* 2. ของรางวัล & ระดับ */}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge className={cn('text-[10px] px-1.5 py-0 uppercase', tierInfo.badgeClass)}>
                                  {tierInfo.name}
                                </Badge>
                                <span className="font-semibold text-foreground text-sm">{roll.reward_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {roll.reward_type === 'auto' ? '⚡ มอบอัตโนมัติ' : '🤝 ติดต่อรับกับทีมงาน'}
                              </div>
                            </TableCell>

                            {/* 3. วันเวลาที่สุ่มได้ (<t:created_at:s>) */}
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {new Date(roll.created_at).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </TableCell>

                            {/* 4. เวลาคงเหลือ / หมดเขต (<t:expires_at:R>) */}
                            <TableCell className="text-xs">
                              {roll.expires_at ? (
                                <div className={cn(isExpired ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                  {new Date(roll.expires_at).toLocaleString('th-TH', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                  {isExpired && !roll.is_claimed ? (
                                    <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                                      หมดเขต
                                    </Badge>
                                  ) : !roll.is_claimed ? (
                                    <Badge variant="outline" className="ml-1 text-[10px] border-amber-500 text-amber-400 px-1 py-0">
                                      1 เดือน
                                    </Badge>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* 5. สถานะการรับ */}
                            <TableCell className="text-center">
                              {roll.is_claimed ? (
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs gap-1 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  รับแล้ว
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs gap-1 font-semibold">
                                  <Clock className="h-3 w-3" />
                                  รอดำเนินการ
                                </Badge>
                              )}
                            </TableCell>

                            {/* 6. วันเวลารับ & โปรไฟล์ผู้ดำเนินการ */}
                            <TableCell>
                              {roll.is_claimed ? (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {roll.claimed_at ? new Date(roll.claimed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={adminProf?.avatar_url || ''} />
                                      <AvatarFallback className="text-[10px]">AD</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[110px]">
                                      {adminProf?.nickname || adminProf?.discord_username || adminProf?.username || roll.claimed_by_admin_id || 'Admin'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* 7. ปุ่มติ๊กยืนยันว่าแจกแล้ว */}
                            <TableCell className="text-right">
                              {!roll.is_claimed && roll.reward_type === 'manual' ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                                  disabled={markingRollId === roll.id}
                                  onClick={() => handleMarkClaimed(roll)}
                                >
                                  {markingRollId === roll.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  ติ๊กว่ารับแล้ว
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">✅ เรียบร้อย</span>
                              )}
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
      </Tabs>

      {/* ── Dialog: Add / Edit Reward ──────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingReward ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}</DialogTitle>
            <DialogDescription>
              กำหนดรายละเอียดของรางวัล ระดับ Tier การแจก และระบบสต็อกตามเอกสาร
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reward-name">1. ชื่อของรางวัล (แสดงในการ์ดตอนสุ่มได้) *</Label>
              <Input
                id="reward-name"
                placeholder="เช่น Nitro 1 เดือน, ยศหมีโยนเหรียญ, 500 แต้ม"
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reward-history-name">4. ชื่อแสดงในประวัติ (สั้น กระชับ เชื่อมกับปุ่มประวัติ) *</Label>
              <Input
                id="reward-history-name"
                placeholder="เช่น Nitro 1 ด., ยศหมี 7 วัน"
                value={rewardForm.history_name}
                onChange={(e) => setRewardForm({ ...rewardForm, history_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ระดับ (Tier จากทั้ง 4 ระดับ)</Label>
                <Select
                  value={rewardForm.tier}
                  onValueChange={(v) =>
                    setRewardForm({ ...rewardForm, tier: v as 'god' | 'epic' | 'rare' | 'common' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="god">🌟 God (0.07%)</SelectItem>
                    <SelectItem value="epic">🔮 Epic (1.00%)</SelectItem>
                    <SelectItem value="rare">💎 Rare (45.00%)</SelectItem>
                    <SelectItem value="common">🍃 Common (85.00%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>2. ประเภทการรับรางวัล</Label>
                <Select
                  value={rewardForm.reward_type}
                  onValueChange={(v) =>
                    setRewardForm({ ...rewardForm, reward_type: v as 'auto' | 'manual' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">🤝 รับกับทีมงาน (ใน 1 เดือน)</SelectItem>
                    <SelectItem value="auto">⚡ รับอัตโนมัติ (ยศ/แต้ม)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ถ้าเป็น Auto: เลือก Role ID หรือ Points */}
            {rewardForm.reward_type === 'auto' && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-3 border">
                <p className="text-xs font-semibold text-muted-foreground">ตั้งค่าการแจกอัตโนมัติ</p>
                <div className="space-y-1.5">
                  <Label htmlFor="role-id">Discord Role ID (มอบยศอัตโนมัติ)</Label>
                  <Input
                    id="role-id"
                    placeholder="เช่น 1144676811838599188"
                    value={rewardForm.role_id}
                    onChange={(e) => setRewardForm({ ...rewardForm, role_id: e.target.value })}
                  />
                  {rewardForm.role_id.trim() && (
                    <div className="pt-1.5">
                      <Label htmlFor="comp-points" className="text-xs">แต้มชดเชยกรณียศซ้ำ (Points Fallback)</Label>
                      <Input
                        id="comp-points"
                        type="number"
                        min={0}
                        placeholder="300"
                        value={rewardForm.duplicate_compensation_points}
                        onChange={(e) => setRewardForm({ ...rewardForm, duplicate_compensation_points: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        *หากผู้เล่นมียศนี้อยู่แล้ว ระบบจะแปลงเป็นแต้มจำนวนนี้ให้แทนทันที
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="points-reward">จำนวนแต้ม (Points)</Label>
                  <Input
                    id="points-reward"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={rewardForm.points_reward}
                    onChange={(e) => setRewardForm({ ...rewardForm, points_reward: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            )}

            {/* 3. การจัดการสต็อก */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-3 border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">3. ไม่จำกัดสต็อก (Unlimited Stock)</Label>
                  <p className="text-xs text-muted-foreground">กดปิดเพื่อกำหนดจำนวนสต็อกจำกัด</p>
                </div>
                <Switch
                  checked={rewardForm.is_unlimited}
                  onCheckedChange={(checked) =>
                    setRewardForm({ ...rewardForm, is_unlimited: checked, stock: checked ? -1 : 10 })
                  }
                />
              </div>

              {!rewardForm.is_unlimited && (
                <div className="space-y-1.5 pt-2 border-t">
                  <Label htmlFor="stock-count">จำนวนสต็อกคงเหลือ (อัปเดตแบบเรียลไทม์)</Label>
                  <Input
                    id="stock-count"
                    type="number"
                    min={0}
                    value={rewardForm.stock}
                    onChange={(e) => setRewardForm({ ...rewardForm, stock: parseInt(e.target.value, 10) || 0 })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    *หากสต็อกหมด ระบบจะทำการสุ่มชิ้นอื่นในระดับเดียวกัน หรือลดหลั่นลงไประดับถัดไปให้อัตโนมัติ
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sort-order">ลำดับการแสดงผล</Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={rewardForm.sort_order}
                  onChange={(e) => setRewardForm({ ...rewardForm, sort_order: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div className="flex items-center justify-between pt-6">
                <Label className="cursor-pointer">เปิดใช้งาน</Label>
                <Switch
                  checked={rewardForm.is_active}
                  onCheckedChange={(checked) => setRewardForm({ ...rewardForm, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveReward}>
              {editingReward ? 'บันทึกการแก้ไข' : 'เพิ่มของรางวัล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: ปรับอัตราการสุ่ม (Drop Rates) ─────────────────────────── */}
      <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <SlidersHorizontal className="h-5 w-5" />
              ปรับอัตราการสุ่มของขวัญ (Tier Drop Rates)
            </DialogTitle>
            <DialogDescription>
              กำหนดโอกาสออกของรางวัลแต่ละระดับในตู้โยนเหรียญ โดยระบบจะคำนวณระดับ Common ให้อัตโนมัติจากส่วนที่เหลือ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* God Tier */}
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rate-god" className="font-bold text-amber-500 flex items-center gap-1.5">
                  <Crown className="h-4 w-4" /> ระดับ God (สีทอง)
                </Label>
                <span className="text-xs font-mono text-muted-foreground">เปอร์เซ็นต์ %</span>
              </div>
              <Input
                id="rate-god"
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={rateForm.god}
                onChange={(e) => setRateForm({ ...rateForm, god: parseFloat(e.target.value) || 0 })}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">ค่าเริ่มต้นตามเอกสาร: 0.07%</p>
            </div>

            {/* Epic Tier */}
            <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rate-epic" className="font-bold text-purple-500 flex items-center gap-1.5">
                  <Award className="h-4 w-4" /> ระดับ Epic (สีม่วง)
                </Label>
                <span className="text-xs font-mono text-muted-foreground">เปอร์เซ็นต์ %</span>
              </div>
              <Input
                id="rate-epic"
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={rateForm.epic}
                onChange={(e) => setRateForm({ ...rateForm, epic: parseFloat(e.target.value) || 0 })}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">ค่าเริ่มต้นตามเอกสาร: 1.00%</p>
            </div>

            {/* Rare Tier */}
            <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rate-rare" className="font-bold text-sky-500 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> ระดับ Rare (สีฟ้า)
                </Label>
                <span className="text-xs font-mono text-muted-foreground">เปอร์เซ็นต์ %</span>
              </div>
              <Input
                id="rate-rare"
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={rateForm.rare}
                onChange={(e) => setRateForm({ ...rateForm, rare: parseFloat(e.target.value) || 0 })}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">ค่าเริ่มต้นตามเอกสาร: 45.00%</p>
            </div>

            {/* Common Tier (Auto Calculated Remainder) */}
            {(() => {
              const sum = (Number(rateForm.god) || 0) + (Number(rateForm.epic) || 0) + (Number(rateForm.rare) || 0);
              const common = Math.max(0, parseFloat((100 - sum).toFixed(4)));
              const isOver = sum > 100;

              return (
                <div className={cn(
                  'p-3 rounded-lg border space-y-1.5 transition-colors',
                  isOver ? 'border-destructive/60 bg-destructive/10' : 'border-emerald-500/30 bg-emerald-500/5'
                )}>
                  <div className="flex items-center justify-between">
                    <Label className={cn('font-bold flex items-center gap-1.5', isOver ? 'text-destructive' : 'text-emerald-500')}>
                      <Flame className="h-4 w-4" /> ระดับ Common (สีเขียว) — ปลอบใจอัตโนมัติ
                    </Label>
                    <span className="text-xs font-mono font-bold">
                      {isOver ? '⚠️ ผลรวมเกิน 100%' : `${common.toFixed(4)}%`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isOver
                      ? `ผลรวมปัจจุบัน ${sum.toFixed(4)}% เกิน 100%! กรุณาลดอัตราสุ่มของระดับอื่นลง`
                      : `คำนวณจากส่วนที่เหลือ (100% - ${(sum).toFixed(4)}%) = ${common.toFixed(4)}%`
                    }
                  </p>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRateDialogOpen(false)} disabled={isSavingRates}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveTierRates}
              disabled={isSavingRates || ((Number(rateForm.god) || 0) + (Number(rateForm.epic) || 0) + (Number(rateForm.rare) || 0) > 100)}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {isSavingRates ? 'กำลังบันทึก...' : 'บันทึกอัตราการสุ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirm Delete ─────────────────────────────────────────── */}
      <Dialog open={!!deletingReward} onOpenChange={(open) => !open && setDeletingReward(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ยืนยันการลบของรางวัล
            </DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ &quot;{deletingReward?.name}&quot; ออกจากระดับ {deletingReward?.tier?.toUpperCase()}? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingReward(null)} disabled={isDeleting}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteReward} disabled={isDeleting}>
              {isDeleting ? 'กำลังลบ...' : 'ลบของรางวัล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CoinGachaManagement;
