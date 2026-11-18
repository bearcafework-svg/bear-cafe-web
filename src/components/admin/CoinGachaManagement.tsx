import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Coins,
  Gift,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Shield,
  Layers,
  Flame,
  Award,
  Crown,
  SlidersHorizontal,
  CheckCircle2,
  PackageCheck
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
    name: 'God 🌟',
    rate: '0.07%',
    description: 'ระดับสูงสุด ของรางวัลพรีเมียม / เงินรางวัล / คูปอง',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480702337786037/3.gif',
    colorClass: 'text-amber-500',
    borderClass: 'border-amber-500/50 hover:border-amber-500',
    badgeClass: 'bg-amber-500 text-black font-bold shadow-amber-500/30',
    icon: <Crown className="h-4 w-4" />
  },
  {
    key: 'epic',
    name: 'Epic 🔮',
    rate: '1.00%',
    description: 'ระดับยอดนิยม ของรางวัลสุดพิเศษ / ยศพรีเมียม',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480702719463496/2.gif',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500/50 hover:border-purple-500',
    badgeClass: 'bg-purple-600 text-white font-bold shadow-purple-500/30',
    icon: <Award className="h-4 w-4" />
  },
  {
    key: 'rare',
    name: 'Rare 💎',
    rate: '45.00%',
    description: 'ระดับหายากปานกลาง แต้มโบนัส / ยศตกแต่ง',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480703298408600/1.gif',
    colorClass: 'text-sky-400',
    borderClass: 'border-sky-500/50 hover:border-sky-500',
    badgeClass: 'bg-sky-500 text-white font-bold shadow-sky-500/30',
    icon: <Sparkles className="h-4 w-4" />
  },
  {
    key: 'common',
    name: 'Common 🍃',
    rate: '53.93%',
    description: 'ระดับทั่วไป รางวัลปลอบใจ / แต้มเริ่มต้น (คำนวณจากส่วนที่เหลืออัตโนมัติ)',
    gif: 'https://cdn.discordapp.com/attachments/1565856976552988804/1572480703755714672/e6d42f9e6f60a678.gif',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/50 hover:border-emerald-500',
    badgeClass: 'bg-emerald-600 text-white font-bold shadow-emerald-500/30',
    icon: <Flame className="h-4 w-4" />
  }
];

export function CoinGachaManagement() {
  const { toast } = useToast();

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

  useEffect(() => {
    fetchRewards();
    fetchTierRates();
  }, [fetchRewards, fetchTierRates]);

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

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRewards = rewards.length;
    const activeRewards = rewards.filter((r) => r.is_active).length;
    const unlimitedCount = rewards.filter((r) => r.is_unlimited).length;
    const limitedCount = rewards.filter((r) => !r.is_unlimited).length;

    return { totalRewards, activeRewards, unlimitedCount, limitedCount };
  }, [rewards]);

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">ของรางวัลโยนเหรียญ (Coin Gacha Rewards)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการรายการของรางวัลแยก 4 ระดับ (God, Epic, Rare, Common) อัตราออกของตู้สุ่ม และระบบควบคุมสต็อกคงเหลือ
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
              fetchRewards();
              fetchTierRates();
            }}
            disabled={isLoadingRewards || isLoadingRates}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', (isLoadingRewards || isLoadingRates) && 'animate-spin')} />
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
              <p className="text-xs text-muted-foreground font-medium">เปิดใช้งานในตู้ (Active)</p>
              <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.activeRewards} ชิ้น</p>
            </div>
            <Sparkles className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ของรางวัลไม่จำกัดสต็อก</p>
              <p className="text-2xl font-bold mt-1 text-sky-500">{stats.unlimitedCount} ชิ้น</p>
            </div>
            <PackageCheck className="h-8 w-8 text-sky-500/30" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ของรางวัลจำกัดสต็อก</p>
              <p className="text-2xl font-bold mt-1 text-amber-500">{stats.limitedCount} ชิ้น</p>
            </div>
            <Layers className="h-8 w-8 text-amber-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* ── Tier Sections (God, Epic, Rare, Common) ─────────────────────────── */}
      <div className="space-y-6">
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
                    เพิ่มของรางวัล ({tierInfo.key.toUpperCase()})
                  </Button>
                </CardHeader>

                {/* Tier Rewards Table */}
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">ลำดับ</TableHead>
                        <TableHead>ชื่อของรางวัล (แสดงตอนสุ่มได้)</TableHead>
                        <TableHead>ชื่อในประวัติ (สั้น)</TableHead>
                        <TableHead className="w-[140px]">รูปแบบรางวัล</TableHead>
                        <TableHead className="w-[140px]">สต็อกคงเหลือ</TableHead>
                        <TableHead className="w-[100px] text-center">สถานะ</TableHead>
                        <TableHead className="w-[110px] text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tierRewards.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-sm">
                            ยังไม่มีรายการของรางวัลในระดับนี้ 🍃
                          </TableCell>
                        </TableRow>
                      ) : (
                        tierRewards.map((reward) => (
                          <TableRow key={reward.id} className={cn(!reward.is_active && 'opacity-60 bg-muted/20')}>
                            {/* 0. ลำดับ */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              #{reward.sort_order}
                            </TableCell>

                            {/* 1. ชื่อของรางวัล */}
                            <TableCell>
                              <div className="font-medium text-sm text-foreground">
                                {reward.name}
                              </div>
                              {reward.reward_type === 'auto' && reward.role_id && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  ยศ: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{reward.role_id}</code>
                                  {reward.duplicate_compensation_points !== undefined && (
                                    <span className="text-amber-500 ml-1.5 font-semibold">
                                      (ยศซ้ำแปลงเป็น +{reward.duplicate_compensation_points} แต้ม)
                                    </span>
                                  )}
                                </div>
                              )}
                              {reward.reward_type === 'auto' && reward.points_reward > 0 && (
                                <div className="text-[11px] text-emerald-500 font-semibold mt-0.5">
                                  + {formatNumber(reward.points_reward)} แต้ม
                                </div>
                              )}
                            </TableCell>

                            {/* 2. ชื่อสั้นในประวัติ */}
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {reward.history_name}
                            </TableCell>

                            {/* 3. รูปแบบรางวัล */}
                            <TableCell>
                              {reward.reward_type === 'auto' ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1 text-xs">
                                  ⚡ อัตโนมัติ (บอทแจก)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/30 gap-1 text-xs">
                                  🎁 ติดต่อรับกับทีมงาน
                                </Badge>
                              )}
                            </TableCell>

                            {/* 4. สต็อก */}
                            <TableCell>
                              {reward.is_unlimited ? (
                                <Badge variant="secondary" className="text-xs font-mono">
                                  ไม่จำกัด (∞)
                                </Badge>
                              ) : (
                                <span className={cn('text-xs font-mono font-bold', reward.stock <= 0 ? 'text-destructive' : 'text-foreground')}>
                                  {reward.stock <= 0 ? '⚠️ หมด (0)' : `${reward.stock} ชิ้น`}
                                </span>
                              )}
                            </TableCell>

                            {/* 5. สวิตช์เปิด/ปิด */}
                            <TableCell className="text-center">
                              <Switch
                                checked={reward.is_active}
                                onCheckedChange={() => handleToggleActive(reward, reward.is_active)}
                              />
                            </TableCell>

                            {/* 6. ปุ่มแก้ไข / ลบ */}
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
      </div>

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

      {/* ── Dialog: Add / Edit Reward ───────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              {editingReward ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}
            </DialogTitle>
            <DialogDescription>
              กำหนดข้อมูลของรางวัลในตู้โยนเหรียญสำหรับระดับ {rewardForm.tier.toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reward-tier">ระดับของรางวัล (Tier)</Label>
                <Select
                  value={rewardForm.tier}
                  onValueChange={(v) => setRewardForm({ ...rewardForm, tier: v as 'god' | 'epic' | 'rare' | 'common' })}
                >
                  <SelectTrigger id="reward-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="god">🌟 God (ทอง)</SelectItem>
                    <SelectItem value="epic">🔮 Epic (ม่วง)</SelectItem>
                    <SelectItem value="rare">💎 Rare (ฟ้า)</SelectItem>
                    <SelectItem value="common">🍃 Common (เขียว)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reward-type">รูปแบบการแจกรางวัล</Label>
                <Select
                  value={rewardForm.reward_type}
                  onValueChange={(v) => setRewardForm({ ...rewardForm, reward_type: v as 'auto' | 'manual' })}
                >
                  <SelectTrigger id="reward-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">⚡ อัตโนมัติ (บอทมอบทันที)</SelectItem>
                    <SelectItem value="manual">🎁 ติดต่อรับกับทีมงาน (Manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 1. ชื่อของรางวัล (แสดงตอนสุ่มได้) */}
            <div className="space-y-1.5">
              <Label htmlFor="reward-name">1. ชื่อของรางวัล (แสดงในการ์ดตอนสุ่มได้)</Label>
              <Input
                id="reward-name"
                placeholder="เช่น คูปองเกม RoV 110 คูปอง หรือ เงินรางวัล 20 บาท"
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              />
            </div>

            {/* 2. ชื่อของรางวัลในประวัติ */}
            <div className="space-y-1.5">
              <Label htmlFor="reward-history-name">2. ชื่อของรางวัลในประวัติ (สั้น กระชับ)</Label>
              <Input
                id="reward-history-name"
                placeholder="เช่น RoV 110 หรือ เงินรางวัล 20 บาท"
                value={rewardForm.history_name}
                onChange={(e) => setRewardForm({ ...rewardForm, history_name: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                *จะแสดงในการ์ด &quot;ประวัติการสุ่ม&quot; เมื่อสมาชิกกดปุ่มประวัติในดิสคอร์ด
              </p>
            </div>

            {/* ตัวเลือกเฉพาะระบบอัตโนมัติ (Auto) */}
            {rewardForm.reward_type === 'auto' && (
              <div className="p-3 bg-muted/40 rounded-lg space-y-3 border">
                <p className="text-xs font-semibold text-foreground">การตั้งค่าบอทแจกอัตโนมัติ:</p>
                <div className="space-y-1.5">
                  <Label htmlFor="role-id">Discord Role ID (กรณียกยศให้)</Label>
                  <Input
                    id="role-id"
                    placeholder="เช่น 1144676811838599188"
                    value={rewardForm.role_id}
                    onChange={(e) => setRewardForm({ ...rewardForm, role_id: e.target.value })}
                  />
                  {rewardForm.role_id.trim() && (
                    <div className="mt-2 pt-2 border-t">
                      <Label htmlFor="comp-points" className="text-amber-500 font-medium">
                        แต้มชดเชยกรณียศซ้ำ (Duplicate Compensation)
                      </Label>
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
