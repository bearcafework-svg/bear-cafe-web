import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Copy,
  Check,
  Gift,
  Crown,
  Award,
  Sparkles,
  Flame,
  User,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

const TIER_BADGES: Record<'god' | 'epic' | 'rare' | 'common', { label: string; badgeClass: string; icon: React.ReactNode }> = {
  god: {
    label: 'God 🌟',
    badgeClass: 'bg-amber-500/20 text-amber-500 border-amber-500/40',
    icon: <Crown className="h-3 w-3 inline mr-1 text-amber-500" />
  },
  epic: {
    label: 'Epic 🔮',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    icon: <Award className="h-3 w-3 inline mr-1 text-purple-400" />
  },
  rare: {
    label: 'Rare 💎',
    badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
    icon: <Sparkles className="h-3 w-3 inline mr-1 text-sky-400" />
  },
  common: {
    label: 'Common 🍃',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    icon: <Flame className="h-3 w-3 inline mr-1 text-emerald-400" />
  }
};

export function GiftClaimsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rolls, setRolls] = useState<CoinRoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'pending' | 'claimed' | 'all'>('pending');
  const [confirmingRoll, setConfirmingRoll] = useState<CoinRoll | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});

  // ── Fetch Rolls & Admin Profiles ───────────────────────────────────────────
  const fetchRolls = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('gacha_coin_rolls')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('is_claimed', false).eq('reward_type', 'manual');
      } else if (filter === 'claimed') {
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
      setIsLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchRolls();
  }, [fetchRolls]);

  // ── Mark as Claimed ────────────────────────────────────────────────────────
  const handleConfirmClaim = async () => {
    if (!confirmingRoll) return;
    setIsClaiming(true);

    try {
      const now = new Date().toISOString();
      const adminId = user?.id || user?.discord_id || 'admin';

      const { error } = await supabase
        .from('gacha_coin_rolls')
        .update({
          is_claimed: true,
          claimed_at: now,
          claimed_by_admin_id: adminId
        })
        .eq('id', confirmingRoll.id);

      if (error) throw error;

      toast({
        title: 'ยืนยันการส่งมอบสำเร็จ ✨',
        description: `บันทึกการส่งมอบ "${confirmingRoll.reward_name}" เรียบร้อยแล้ว`
      });

      // แคชโปรไฟล์แอดมินปัจจุบันไว้ทันที
      if (user) {
        setAdminProfiles((prev) => ({
          ...prev,
          [adminId]: {
            id: adminId,
            discord_id: user.discord_id,
            username: user.username || user.email || 'Admin',
            nickname: user.nickname || user.username || 'Admin',
            avatar_url: user.avatar_url || user.user_metadata?.avatar_url
          }
        }));
      }

      setRolls((prev) =>
        prev.map((r) =>
          r.id === confirmingRoll.id
            ? { ...r, is_claimed: true, claimed_at: now, claimed_by_admin_id: adminId }
            : r
        )
      );
      setConfirmingRoll(null);
    } catch (err: unknown) {
      const e = err as Error;
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาดในการยืนยัน', description: e.message });
    } finally {
      setIsClaiming(false);
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
        !search ||
        r.discord_id.includes(search) ||
        r.reward_name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [rolls, search]);

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = rolls.filter((r) => !r.is_claimed && r.reward_type === 'manual').length;
    const claimed = rolls.filter((r) => r.is_claimed).length;
    const total = rolls.length;
    return { pending, claimed, total };
  }, [rolls]);

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">ตรวจเช็กการรับของขวัญ (Gift Claims)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ตรวจสอบประวัติการสุ่ม ค้นหา Discord ID สมาชิก และยืนยันการส่งมอบของขวัญแก่สมาชิกที่ติดต่อรับรางวัล
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRolls}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn('transition-all', stats.pending > 0 ? 'border-amber-500/60 bg-amber-500/10' : 'bg-card/50')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">รอมอบของขวัญ (Pending Claims)</p>
              <p className="text-2xl font-bold mt-1 text-amber-500">{stats.pending} รายการ</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500/40" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ส่งมอบสำเร็จแล้ว (Claimed)</p>
              <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.claimed} รายการ</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">ประวัติการสุ่มที่โหลดมาทั้งหมด</p>
              <p className="text-2xl font-bold mt-1 text-sky-500">{stats.total} รายการ</p>
            </div>
            <Gift className="h-8 w-8 text-sky-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* ── Claims Table Card ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา Discord ID หรือชื่อของรางวัล..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as 'pending' | 'claimed' | 'all')}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="สถานะการรับ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ รอมอบของ (Pending)</SelectItem>
                  <SelectItem value="claimed">✅ มอบแล้ว (Claimed)</SelectItem>
                  <SelectItem value="all">ทั้งหมด (All Rolls)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-md border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">ผู้รับรางวัล (DiscordID)</TableHead>
                  <TableHead className="w-[220px]">ของรางวัลที่ได้รับ</TableHead>
                  <TableHead className="w-[140px]">วันเวลาที่สุ่มได้</TableHead>
                  <TableHead className="w-[150px]">เวลาคงเหลือ / หมดเขต</TableHead>
                  <TableHead className="w-[140px] text-center">สถานะการรับ</TableHead>
                  <TableHead className="w-[200px]">วันเวลารับ & ผู้ดำเนินการ</TableHead>
                  <TableHead className="w-[120px] text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      กำลังโหลดข้อมูลประวัติการสุ่ม...
                    </TableCell>
                  </TableRow>
                ) : filteredRolls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา 🍃
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRolls.map((roll) => {
                    const tierBadge = TIER_BADGES[roll.tier] || TIER_BADGES.common;
                    const createdDate = new Date(roll.created_at);
                    const expiresDate = roll.expires_at ? new Date(roll.expires_at) : null;
                    const isExpired = expiresDate && expiresDate.getTime() < Date.now();
                    const adminProfile = roll.claimed_by_admin_id ? adminProfiles[roll.claimed_by_admin_id] : null;

                    return (
                      <TableRow key={roll.id} className={cn(!roll.is_claimed && roll.reward_type === 'manual' && 'bg-amber-500/5')}>
                        {/* 1. Discord ID with Copy */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="font-semibold text-foreground">{roll.discord_id}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => copyDiscordId(roll.discord_id)}
                              title="คัดลอก Discord ID"
                            >
                              {copiedId === roll.discord_id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>

                        {/* 2. ของรางวัล + Tier */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                              <Badge className={cn('text-[10px] px-1.5 py-0 border font-bold', tierBadge.badgeClass)}>
                                {tierBadge.icon}
                                {roll.tier.toUpperCase()}
                              </Badge>
                              <span>{roll.reward_name}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {roll.reward_type === 'auto' ? (
                                <span className="text-emerald-500">⚡ ระบบอัตโนมัติ (บอทมอบแล้ว)</span>
                              ) : (
                                <span className="text-amber-500">🎁 ติดต่อรับกับทีมงาน</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. วันเวลาที่สุ่มได้ */}
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{createdDate.toLocaleDateString('th-TH')}</div>
                          <div className="text-[11px]">{createdDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>
                        </TableCell>

                        {/* 4. เวลาคงเหลือ / หมดเขต */}
                        <TableCell className="text-xs">
                          {roll.reward_type === 'auto' ? (
                            <span className="text-muted-foreground">-</span>
                          ) : expiresDate ? (
                            <div className={cn(isExpired && !roll.is_claimed ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                              <div>{expiresDate.toLocaleDateString('th-TH')}</div>
                              {isExpired && !roll.is_claimed ? (
                                <span className="text-[10px] font-bold">⚠️ หมดเขตแล้ว</span>
                              ) : (
                                <span className="text-[10px]">มีเวลา 1 เดือน</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* 5. สถานะการรับ */}
                        <TableCell className="text-center">
                          {roll.is_claimed ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> รับแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 text-xs animate-pulse">
                              <Clock className="h-3.5 w-3.5" /> รอรับ
                            </Badge>
                          )}
                        </TableCell>

                        {/* 6. วันเวลารับ & ผู้ดำเนินการ */}
                        <TableCell>
                          {roll.is_claimed && roll.claimed_at ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 border">
                                <AvatarImage src={adminProfile?.avatar_url || ''} />
                                <AvatarFallback className="text-[10px]">
                                  <User className="h-3.5 w-3.5" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-xs">
                                <p className="font-medium truncate max-w-[120px]">
                                  {adminProfile?.nickname || adminProfile?.discord_username || adminProfile?.username || roll.claimed_by_admin_id || 'Admin'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(roll.claimed_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}{' '}
                                  {new Date(roll.claimed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* 7. ปุ่มยืนยันการรับ */}
                        <TableCell className="text-right">
                          {!roll.is_claimed && roll.reward_type === 'manual' ? (
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              onClick={() => setConfirmingRoll(roll)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              ยืนยันแจกแล้ว
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
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

      {/* ── Dialog: Confirm Claim ─────────────────────────────────────────── */}
      <Dialog open={!!confirmingRoll} onOpenChange={(open) => !open && setConfirmingRoll(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              ยืนยันการส่งมอบของขวัญ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการยืนยันว่าได้ส่งมอบของขวัญชิ้นนี้ให้แก่สมาชิกเรียบร้อยแล้วใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>

          {confirmingRoll && (
            <div className="p-3 bg-muted/40 rounded-lg space-y-2 text-sm border my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">สมาชิก:</span>
                <span className="font-mono font-bold">{confirmingRoll.discord_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ของรางวัล:</span>
                <span className="font-semibold text-foreground">{confirmingRoll.reward_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ระดับ:</span>
                <Badge variant="outline" className="uppercase font-bold text-xs">
                  {confirmingRoll.tier}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingRoll(null)} disabled={isClaiming}>
              ยกเลิก
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmClaim}
              disabled={isClaiming}
            >
              {isClaiming ? 'กำลังบันทึก...' : 'ยืนยันการส่งมอบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GiftClaimsManagement;
