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
  Check
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

const TIER_CONFIG = {
  god: {
    label: 'God',
    rate: '0.07%',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-300 text-black font-bold'
  },
  epic: {
    label: 'Epic',
    rate: '1.00%',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    badge: 'bg-gradient-to-r from-purple-500 to-indigo-400 text-white font-bold'
  },
  rare: {
    label: 'Rare',
    rate: '45.00%',
    color: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    badge: 'bg-gradient-to-r from-sky-500 to-blue-400 text-white font-bold'
  },
  common: {
    label: 'Common',
    rate: '85.00%',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    badge: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-bold'
  }
};

export function CoinGachaManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Tabs
  const [activeTab, setActiveTab] = useState<'rewards' | 'claims'>('rewards');

  // Rewards State
  const [rewards, setRewards] = useState<CoinReward[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [rewardSearch, setRewardSearch] = useState('');
  const [rewardTierFilter, setRewardTierFilter] = useState<string>('all');

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
  const [claimFilter, setClaimFilter] = useState<'all' | 'pending' | 'claimed'>('pending');
  const [markingRollId, setMarkingRollId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // ── Fetch Rolls / Claims ───────────────────────────────────────────────────
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
      setRolls((data as unknown as CoinRoll[]) || []);
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
  }, [fetchRewards]);

  useEffect(() => {
    if (activeTab === 'claims') {
      fetchRolls();
    }
  }, [activeTab, fetchRolls]);

  // ── Save Reward (Create / Update) ──────────────────────────────────────────
  const handleOpenDialog = (reward?: CoinReward) => {
    if (reward) {
      setEditingReward(reward);
      setRewardForm({
        name: reward.name,
        history_name: reward.history_name,
        tier: reward.tier,
        reward_type: reward.reward_type,
        role_id: reward.role_id || '',
        points_reward: reward.points_reward || 0,
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
        tier: 'common',
        reward_type: 'manual',
        role_id: '',
        points_reward: 0,
        is_unlimited: true,
        stock: -1,
        is_active: true,
        sort_order: rewards.length
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

  // ── Mark Claim as Completed ────────────────────────────────────────────────
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
        title: 'ยืนยันการมอบของขวัญสำเร็จ',
        description: `ทำรายการมอบ "${roll.reward_name}" ให้ <@${roll.discord_id}> เรียบร้อยแล้ว`
      });

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

  // ── Filtered Rewards ───────────────────────────────────────────────────────
  const filteredRewards = useMemo(() => {
    return rewards.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(rewardSearch.toLowerCase()) ||
        r.history_name.toLowerCase().includes(rewardSearch.toLowerCase()) ||
        (r.role_id && r.role_id.includes(rewardSearch));
      const matchesTier = rewardTierFilter === 'all' || r.tier === rewardTierFilter;
      return matchesSearch && matchesTier;
    });
  }, [rewards, rewardSearch, rewardTierFilter]);

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

  // ── Stats Summary ──────────────────────────────────────────────────────────
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
            <Coins className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">ระบบของขวัญหมีโยนเหรียญ (Coin Gacha)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการรายการของรางวัลในตู้สุ่มเหรียญกาชา ตรวจสอบและกดยืนยันการมอบของรางวัลที่รอการรับ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'rewards' && (
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มของรางวัล
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={activeTab === 'rewards' ? fetchRewards : fetchRolls}
            disabled={isLoadingRewards || isLoadingRolls}
          >
            <RefreshCw className={cn('h-4 w-4', (isLoadingRewards || isLoadingRolls) && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ของรางวัลทั้งหมด</p>
              <p className="text-2xl font-bold mt-1">{stats.totalRewards}</p>
            </div>
            <Gift className="h-8 w-8 text-muted-foreground/30" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ของรางวัลที่เปิดใช้งาน</p>
              <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.activeRewards}</p>
            </div>
            <Sparkles className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card className={cn(stats.pendingRolls > 0 && 'border-amber-500/50 bg-amber-500/5')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">รอมอบของขวัญ (Pending)</p>
              <p className="text-2xl font-bold mt-1 text-amber-500">{stats.pendingRolls}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500/30" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">มอบสำเร็จแล้ว</p>
              <p className="text-2xl font-bold mt-1 text-sky-500">{stats.claimedRolls}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-sky-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs Navigation ────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rewards' | 'claims')}>
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="rewards" className="gap-2">
            <Gift className="h-4 w-4" />
            จัดการของรางวัล
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-2">
            <Clock className="h-4 w-4" />
            รายการรอมอบของ
            {stats.pendingRolls > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-500 text-black text-xs px-1.5 py-0 font-bold">
                {stats.pendingRolls}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Rewards Management ───────────────────────────────────── */}
        <TabsContent value="rewards" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อรางวัล หรือ Role ID..."
                    value={rewardSearch}
                    onChange={(e) => setRewardSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={rewardTierFilter} onValueChange={setRewardTierFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="ระดับ (Tier)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกระดับ</SelectItem>
                      <SelectItem value="god">God (0.07%)</SelectItem>
                      <SelectItem value="epic">Epic (1%)</SelectItem>
                      <SelectItem value="rare">Rare (45%)</SelectItem>
                      <SelectItem value="common">Common (85%)</SelectItem>
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
                      <TableHead className="w-[100px]">ระดับ</TableHead>
                      <TableHead>ชื่อของรางวัล / ชื่อประวัติ</TableHead>
                      <TableHead className="w-[160px]">ประเภทการแจก</TableHead>
                      <TableHead className="w-[140px] text-center">สต็อกคงเหลือ</TableHead>
                      <TableHead className="w-[100px] text-center">สถานะ</TableHead>
                      <TableHead className="w-[110px] text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRewards ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                          กำลังโหลดข้อมูลของรางวัล...
                        </TableCell>
                      </TableRow>
                    ) : filteredRewards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          {rewards.length === 0
                            ? 'ยังไม่มีรายการของรางวัล กดปุ่ม "เพิ่มของรางวัล" เพื่อเริ่มต้นค่ะ'
                            : 'ไม่พบของรางวัลที่ตรงกับเงื่อนไขการค้นหา'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRewards.map((reward) => {
                        const tierInfo = TIER_CONFIG[reward.tier] || TIER_CONFIG.common;
                        return (
                          <TableRow key={reward.id} className={cn(!reward.is_active && 'opacity-60 bg-muted/20')}>
                            <TableCell>
                              <Badge className={cn('text-xs uppercase', tierInfo.badge)}>
                                {tierInfo.label}
                              </Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{tierInfo.rate}</div>
                            </TableCell>

                            <TableCell>
                              <div className="font-semibold text-foreground">{reward.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <span>ในประวัติ: <span className="text-foreground/80 font-mono">`{reward.history_name}`</span></span>
                              </div>
                            </TableCell>

                            <TableCell>
                              {reward.reward_type === 'auto' ? (
                                <div className="space-y-0.5">
                                  <Badge variant="outline" className="text-xs border-sky-500/40 text-sky-400 bg-sky-500/5">
                                    ⚡ แจกอัตโนมัติ
                                  </Badge>
                                  {reward.role_id && (
                                    <div className="text-[11px] text-muted-foreground font-mono">
                                      Role: {reward.role_id}
                                    </div>
                                  )}
                                  {reward.points_reward > 0 && (
                                    <div className="text-[11px] text-amber-500 font-mono">
                                      +{formatNumber(reward.points_reward)} แต้ม
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/5">
                                  🤝 รับกับทีมงาน
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {reward.is_unlimited ? (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  ♾️ ไม่จำกัด
                                </Badge>
                              ) : (
                                <span
                                  className={cn(
                                    'font-mono font-bold text-sm px-2 py-0.5 rounded',
                                    reward.stock > 5
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : reward.stock > 0
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : 'bg-red-500/10 text-red-400 line-through'
                                  )}
                                >
                                  {reward.stock} ชิ้น
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <Switch
                                checked={reward.is_active}
                                onCheckedChange={() => handleToggleActive(reward, reward.is_active)}
                              />
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenDialog(reward)}
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
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Pending Claims & History ─────────────────────────────── */}
        <TabsContent value="claims" className="mt-4 space-y-4">
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
                  <Select value={claimFilter} onValueChange={(v) => setClaimFilter(v as 'all' | 'pending' | 'claimed')}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="สถานะการรับ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ รอมอบของ (Pending)</SelectItem>
                      <SelectItem value="claimed">✅ มอบสำเร็จแล้ว</SelectItem>
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
                      <TableHead className="w-[180px]">ผู้รับรางวัล (Discord ID)</TableHead>
                      <TableHead>ของรางวัลที่ได้รับ</TableHead>
                      <TableHead className="w-[160px]">วันเวลาที่สุ่มได้</TableHead>
                      <TableHead className="w-[160px]">หมดเขตรับ</TableHead>
                      <TableHead className="w-[150px] text-center">สถานะการมอบ</TableHead>
                      <TableHead className="w-[120px] text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRolls ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                          กำลังโหลดรายการของขวัญ...
                        </TableCell>
                      </TableRow>
                    ) : filteredRolls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                          {claimFilter === 'pending'
                            ? 'ไม่มีรายการของรางวัลที่ค้างมอบในขณะนี้ค่ะ 🎉'
                            : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRolls.map((roll) => {
                        const tierInfo = TIER_CONFIG[roll.tier] || TIER_CONFIG.common;
                        const isExpired = roll.expires_at && new Date(roll.expires_at).getTime() < Date.now();

                        return (
                          <TableRow key={roll.id} className={cn(roll.is_claimed && 'bg-muted/10')}>
                            {/* Discord ID */}
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-mono text-xs">
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

                            {/* Reward */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={cn('text-[10px] uppercase font-bold', tierInfo.badge)}>
                                  {tierInfo.label}
                                </Badge>
                                <span className="font-semibold text-foreground">{roll.reward_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {roll.reward_type === 'auto' ? '⚡ มอบอัตโนมัติ' : '🤝 ต้องติดต่อรับกับทีมงาน'}
                              </div>
                            </TableCell>

                            {/* Created At */}
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(roll.created_at).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </TableCell>

                            {/* Expiry */}
                            <TableCell className="text-xs">
                              {roll.expires_at ? (
                                <div className={cn(isExpired ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                  {new Date(roll.expires_at).toLocaleString('th-TH', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                  {isExpired && !roll.is_claimed && (
                                    <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                                      หมดเวลา
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* Claim Status */}
                            <TableCell className="text-center">
                              {roll.is_claimed ? (
                                <div className="space-y-0.5">
                                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    มอบแล้ว
                                  </Badge>
                                  {roll.claimed_at && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {new Date(roll.claimed_at).toLocaleDateString('th-TH')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs gap-1">
                                  <Clock className="h-3 w-3" />
                                  รอดำเนินการ
                                </Badge>
                              )}
                            </TableCell>

                            {/* Action Button */}
                            <TableCell className="text-right">
                              {!roll.is_claimed && roll.reward_type === 'manual' ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={markingRollId === roll.id}
                                  onClick={() => handleMarkClaimed(roll)}
                                >
                                  {markingRollId === roll.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  ยืนยันแจกแล้ว
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">เรียบร้อย</span>
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
              กำหนดรายละเอียดของรางวัล ระดับ Tier การแจก และระบบสต็อก
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reward-name">ชื่อของรางวัล (แสดงในการ์ดตอนสุ่มได้) *</Label>
              <Input
                id="reward-name"
                placeholder="เช่น Nitro 1 เดือน, ยศหมีโยนเหรียญ, 500 แต้ม"
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reward-history-name">ชื่อแสดงในประวัติ (สั้น กระชับ) *</Label>
              <Input
                id="reward-history-name"
                placeholder="เช่น Nitro 1 ด., ยศหมี 7 วัน"
                value={rewardForm.history_name}
                onChange={(e) => setRewardForm({ ...rewardForm, history_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ระดับ (Tier)</Label>
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
                    <SelectItem value="god">God 🌟 (0.07%)</SelectItem>
                    <SelectItem value="epic">Epic 🔮 (1.00%)</SelectItem>
                    <SelectItem value="rare">Rare 💎 (45.00%)</SelectItem>
                    <SelectItem value="common">Common 🍃 (85.00%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>ประเภทการรับรางวัล</Label>
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
                    <SelectItem value="manual">🤝 รับกับทีมงาน</SelectItem>
                    <SelectItem value="auto">⚡ แจกอัตโนมัติ</SelectItem>
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
                  <p className="text-[11px] text-muted-foreground">
                    *หากผู้เล่นมียศนี้อยู่แล้ว ระบบจะแปลงเป็นแต้มโบนัสสำรองให้อัตโนมัติ
                  </p>
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

            {/* การจัดการสต็อก */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-3 border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">ไม่จำกัดสต็อก (Unlimited Stock)</Label>
                  <p className="text-xs text-muted-foreground">หากเปิด รางวัลนี้จะสามารถสุ่มได้ตลอดเวลา</p>
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
                  <Label htmlFor="stock-count">จำนวนสต็อกคงเหลือ</Label>
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
              คุณแน่ใจหรือไม่ว่าต้องการลบ &quot;{deletingReward?.name}&quot; ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้
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
