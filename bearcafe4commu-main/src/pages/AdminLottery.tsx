import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// lottery_tickets table exists in DB but not yet in generated types
const db = supabase as any;
import { useAuth } from '@/lib/auth-context';
import { PrizePoolDisplay, SecondaryPrize, VipPrize } from '@/components/lottery/PrizePoolDisplay';
import { Timer, Ticket, CheckCircle2, AlertTriangle, CalendarClock, RefreshCw, Crown, Save } from 'lucide-react';

type LotteryRound = {
  id: string;
  round_number: number;
  status: string | null;
  draw_date: string;
  winning_number: string | null;
  prize_details: any;
  ticket_price: number | null;
};

type TicketRow = {
  id: string;
  number: string;
  created_at: string;
  user_id: string;
  profiles?: { username: string } | null;
};

function normalizeVipPrize(raw: any, fallbackTitle: string): VipPrize {
  const title = typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTitle;
  const description = typeof raw?.description === 'string' ? raw.description : null;
  const imageUrl = typeof raw?.imageUrl === 'string' ? raw.imageUrl : typeof raw?.image_url === 'string' ? raw.image_url : null;
  return { title, description, imageUrl };
}

function normalizeSecondaryPrize(raw: any, fallbackTitle: string, fallbackCount: number): SecondaryPrize {
  const title = typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTitle;
  const description = typeof raw?.description === 'string' ? raw.description : null;
  const imageUrl = typeof raw?.imageUrl === 'string' ? raw.imageUrl : typeof raw?.image_url === 'string' ? raw.image_url : null;
  const count = Number.isFinite(Number(raw?.count)) ? Number(raw.count) : fallbackCount;
  return { title, description, imageUrl, count };
}

const DEFAULT_VIP: [VipPrize, VipPrize, VipPrize] = [
  { title: 'รางวัลที่ 1', description: '', imageUrl: '' },
  { title: 'รางวัลที่ 2', description: '', imageUrl: '' },
  { title: 'รางวัลที่ 3', description: '', imageUrl: '' },
];

const DEFAULT_SECONDARY: SecondaryPrize[] = [
  { title: 'ใกล้เคียงรางวัลที่ 1', description: 'เลขใกล้เคียงแบบใจเต้น', imageUrl: '', count: 2 },
  { title: 'เลขท้าย 2 ตัว', description: 'ลุ้นไว ลุ้นสนุก', imageUrl: '', count: 3 },
  { title: 'เลขท้าย 3 ตัว', description: 'โอกาสเพิ่มขึ้นอีกนิด', imageUrl: '', count: 2 },
];

function loadPrizesFromRound(data: any) {
  const vipFromDb = data?.prize_details?.vip;
  const vip: [VipPrize, VipPrize, VipPrize] =
    Array.isArray(vipFromDb) && vipFromDb.length >= 3
      ? [
          normalizeVipPrize(vipFromDb[0], 'รางวัลที่ 1'),
          normalizeVipPrize(vipFromDb[1], 'รางวัลที่ 2'),
          normalizeVipPrize(vipFromDb[2], 'รางวัลที่ 3'),
        ]
      : [...DEFAULT_VIP];

  const secFromDb = data?.prize_details?.secondary;
  const secondary: SecondaryPrize[] =
    Array.isArray(secFromDb) && secFromDb.length >= 3
      ? [
          normalizeSecondaryPrize(secFromDb[0], 'ใกล้เคียงรางวัลที่ 1', 2),
          normalizeSecondaryPrize(secFromDb[1], 'เลขท้าย 2 ตัว', 3),
          normalizeSecondaryPrize(secFromDb[2], 'เลขท้าย 3 ตัว', 2),
        ]
      : [...DEFAULT_SECONDARY];

  return { vip, secondary };
}

export default function AdminLottery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closeMinutes, setCloseMinutes] = useState(60);
  const [winningNumber, setWinningNumber] = useState('');
  const [vip, setVip] = useState<[VipPrize, VipPrize, VipPrize]>([...DEFAULT_VIP]);
  const [secondary, setSecondary] = useState<SecondaryPrize[]>([...DEFAULT_SECONDARY]);

  const drawDate = useMemo(() => (round?.draw_date ? new Date(round.draw_date) : null), [round?.draw_date]);
  const canManage = Boolean(user?.is_admin || user?.is_owner);
  const isOpen = round?.status === 'open';

  const fetchLatestRound = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lottery_rounds')
        .select('id, round_number, status, draw_date, winning_number, prize_details, ticket_price')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setRound(data ?? null);
      setWinningNumber(data?.winning_number ?? '');
      const { vip: v, secondary: s } = loadPrizesFromRound(data);
      setVip(v);
      setSecondary(s);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTickets = useCallback(async (roundId: string) => {
    const { data, error } = await db
      .from('lottery_tickets')
      .select('id, number, created_at, user_id, profiles(username)')
      .eq('round_id', roundId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    setTickets((data ?? []) as any);
  }, []);

  useEffect(() => {
    fetchLatestRound().catch(() => setRound(null));
  }, [fetchLatestRound]);

  useEffect(() => {
    if (!round?.id) { setTickets([]); return; }
    fetchTickets(round.id).catch(() => setTickets([]));
  }, [round?.id, fetchTickets]);

  useEffect(() => {
    const channel = supabase
      .channel('lottery-admin-rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_rounds' }, () => {
        fetchLatestRound().catch(() => undefined);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLatestRound]);

  useEffect(() => {
    if (!round?.id) return;
    const channel = supabase
      .channel(`lottery-admin-tickets-${round.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lottery_tickets', filter: `round_id=eq.${round.id}` }, () => {
        fetchTickets(round.id).catch(() => undefined);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [round?.id, fetchTickets]);

  const openNewRound = async () => {
    if (!canManage) { toast({ title: 'ไม่มีสิทธิ์', variant: 'destructive' }); return; }
    const mins = Number(closeMinutes);
    const drawAt = new Date(Date.now() + Math.max(1, mins) * 60_000).toISOString();
    setSaving(true);
    try {
      // Close any open rounds first
      await supabase.from('lottery_rounds').update({ status: 'closed' }).eq('status', 'open');
      const { data, error } = await supabase
        .from('lottery_rounds')
        .insert({ draw_date: drawAt, status: 'open', prize_details: { vip, secondary } })
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'เปิดงวดใหม่แล้ว', description: `งวดที่ ${data.round_number}` });
      await fetchLatestRound();
    } catch {
      toast({ title: 'เปิดงวดไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const closeRound = async () => {
    if (!canManage || !round?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('lottery_rounds').update({ status: 'closed' }).eq('id', round.id);
      if (error) throw error;
      toast({ title: 'ปิดรับซื้อแล้ว' });
      await fetchLatestRound();
    } catch {
      toast({ title: 'ปิดงวดไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const announceResult = async () => {
    if (!canManage || !round?.id) return;
    const wn = winningNumber.trim();
    if (!/^\d{6}$/.test(wn)) {
      toast({ title: 'เลขรางวัลไม่ถูกต้อง', description: 'กรุณากรอกเลข 6 หลัก', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lottery_rounds')
        .update({ status: 'announced', winning_number: wn })
        .eq('id', round.id);
      if (error) throw error;
      toast({ title: 'ประกาศผลสำเร็จ', description: `เลข ${wn}` });
      await fetchLatestRound();
    } catch {
      toast({ title: 'ประกาศผลล้มเหลว', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const savePrizeDetails = async () => {
    if (!canManage) { toast({ title: 'ไม่มีสิทธิ์', variant: 'destructive' }); return; }
    if (!round?.id) {
      toast({ title: 'ยังไม่มีงวด', variant: 'destructive', description: 'กรุณาเปิดงวดก่อนบันทึกรางวัล' });
      return;
    }
    setSaving(true);
    try {
      const nextPrize = { ...(round.prize_details ?? {}), vip, secondary };
      const { data, error } = await supabase
        .from('lottery_rounds')
        .update({ prize_details: nextPrize })
        .eq('id', round.id)
        .select('id, prize_details')
        .single();
      if (error) throw error;
      if (!data) throw new Error('No data returned');
      toast({ title: 'บันทึกรางวัลแล้ว' });
      await fetchLatestRound();
    } catch {
      toast({ title: 'บันทึกรางวัลไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Round Management */}
      <Card className="border-latte/40 dark:border-coffee/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            จัดการลอตเตอรี่
            {round && <Badge className="ml-2">งวดที่ {round.round_number}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">เวลาปิดรับ (นาที)</label>
              <Input type="number" value={closeMinutes} onChange={(e) => setCloseMinutes(Number(e.target.value))} min={1} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">สถานะ</label>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 className="w-4 h-4" /> เปิดรับซื้อ</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-4 h-4" /> ปิดรับซื้อ</Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <CalendarClock className="w-4 h-4" />
                  {drawDate ? drawDate.toLocaleString() : '—'}
                </Badge>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={openNewRound} disabled={saving} className="rounded-xl">
                <Timer className="w-4 h-4 mr-2" />
                เปิดงวดใหม่
              </Button>
              <Button variant="outline" onClick={fetchLatestRound} disabled={loading} className="rounded-xl">
                <RefreshCw className="w-4 h-4 mr-2" />
                โหลดสถานะ
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">เลขที่ออกรางวัล</label>
              <Input value={winningNumber} onChange={(e) => setWinningNumber(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="เลข 6 หลัก" />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={closeRound} disabled={saving || !isOpen} className="rounded-xl">
                ปิดงวด
              </Button>
              <Button onClick={announceResult} disabled={saving} className="rounded-xl">
                ประกาศผล
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prize Editor – can save without opening new round */}
      <Card className="border-latte/40 dark:border-coffee/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            อัปเดตรางวัล
            <Button onClick={savePrizeDetails} disabled={saving || !canManage || !round?.id} className="ml-auto rounded-xl" size="sm">
              <Save className="w-4 h-4 mr-2" />
              บันทึก
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrizePoolDisplay vipPrizes={vip} secondaryPrizes={secondary} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {vip.map((p, idx) => (
              <div key={idx} className="bear-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="rounded-full">รางวัลที่ {idx + 1}</Badge>
                  <Badge variant="secondary" className="rounded-full">{idx === 0 ? 'ใหญ่สุด' : 'รองลงมา'}</Badge>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">URL รูปภาพ</label>
                  <Input
                    value={p.imageUrl ?? ''}
                    onChange={(e) => {
                      const next = [...vip] as [VipPrize, VipPrize, VipPrize];
                      next[idx] = { ...next[idx], imageUrl: e.target.value };
                      setVip(next);
                    }}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">ชื่อรางวัล</label>
                  <Input
                    value={p.title}
                    onChange={(e) => {
                      const next = [...vip] as [VipPrize, VipPrize, VipPrize];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setVip(next);
                    }}
                    placeholder={`รางวัลที่ ${idx + 1}`}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">รายละเอียด</label>
                  <Input
                    value={p.description ?? ''}
                    onChange={(e) => {
                      const next = [...vip] as [VipPrize, VipPrize, VipPrize];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setVip(next);
                    }}
                    placeholder="พิมพ์รายละเอียดของรางวัล"
                    className="rounded-xl"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display font-semibold">รางวัลรอง (แก้ไขได้)</p>
              <span className="text-xs text-muted-foreground">ชื่อ/รายละเอียด/รูปภาพ</span>
            </div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {secondary.slice(0, 3).map((p, idx) => (
                <div key={idx} className="bear-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="rounded-full">{p.count} รางวัล</Badge>
                    <Badge variant="secondary" className="rounded-full">โซนรอง</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">URL รูปภาพ</label>
                    <Input
                      value={p.imageUrl ?? ''}
                      onChange={(e) => {
                        const next = [...secondary];
                        next[idx] = { ...next[idx], imageUrl: e.target.value };
                        setSecondary(next);
                      }}
                      placeholder="https://..."
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">ชื่อรางวัล</label>
                    <Input
                      value={p.title}
                      onChange={(e) => {
                        const next = [...secondary];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setSecondary(next);
                      }}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">รายละเอียด</label>
                    <Input
                      value={p.description ?? ''}
                      onChange={(e) => {
                        const next = [...secondary];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setSecondary(next);
                      }}
                      placeholder="พิมพ์รายละเอียดของรางวัล"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card className="border-latte/40 dark:border-coffee/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            ตั๋วที่ซื้อในงวดนี้
            <Badge variant="secondary" className="ml-auto rounded-full">
              {tickets.length} ใบล่าสุด
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!round?.id ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีงวด</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีการซื้อ</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tickets.map((t) => (
                <div key={t.id} className="bear-card p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-bold">{t.number}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.profiles?.username ?? t.user_id}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full shrink-0">
                    {new Date(t.created_at).toLocaleTimeString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
