import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';

// lottery_tickets table exists in DB but not yet in generated types
const db = supabase as any;
import { HomeSidebar } from '@/components/bear-cafe/HomeSidebar';
import { Footer } from '@/components/bear-cafe/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { PrizePoolDisplay, VipPrize } from '@/components/lottery/PrizePoolDisplay';
import { Timer, Ticket, Sparkles, Dice5, ChevronLeft, Menu, X, Crown, Archive, History } from 'lucide-react';

type LotteryRound = {
  id: string;
  round_number: number;
  status: string | null;
  draw_date: string;
  winning_number: string | null;
  prize_details: any;
  created_at: string | null;
};

type SoldOutItem = {
  number: string;
  created_at: string | null;
};

type WalletTicket = {
  id: string;
  number: string;
  created_at: string | null;
  round: { round_number: number; winning_number: string | null; status: string | null } | null;
};

const API_URL = import.meta.env.VITE_POINTS_API_URL;

function formatCountdown(msLeft: number) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function randomTicket(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
}

function normalizeVipPrize(raw: any, fallbackTitle: string): VipPrize {
  const title = typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTitle;
  const description = typeof raw?.description === 'string' ? raw.description : null;
  const imageUrl = typeof raw?.imageUrl === 'string' ? raw.imageUrl : typeof raw?.image_url === 'string' ? raw.image_url : null;
  return { title, description, imageUrl };
}

export default function LotteryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [inputNumber, setInputNumber] = useState('');
  const [countdownMs, setCountdownMs] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [myRoundTickets, setMyRoundTickets] = useState<string[]>([]);
  const [soldOut, setSoldOut] = useState<SoldOutItem[]>([]);
  const [walletTickets, setWalletTickets] = useState<WalletTicket[]>([]);
  const [pastRounds, setPastRounds] = useState<LotteryRound[]>([]);

  const drawDate = useMemo(() => (activeRound?.draw_date ? new Date(activeRound.draw_date) : null), [activeRound?.draw_date]);
  const nowMs = Date.now();
  const isOpen = activeRound?.status === 'open';
  const isAnnounced = activeRound?.status === 'announced' || Boolean(activeRound?.winning_number);
  const canBuy = Boolean(isOpen && (!drawDate || drawDate.getTime() > nowMs) && !isAnnounced);

  const vipPrizes = useMemo<[VipPrize, VipPrize, VipPrize] | undefined>(() => {
    const vip = activeRound?.prize_details?.vip;
    if (!Array.isArray(vip) || vip.length < 3) return undefined;
    return [
      normalizeVipPrize(vip[0], 'รางวัลที่ 1'),
      normalizeVipPrize(vip[1], 'รางวัลที่ 2'),
      normalizeVipPrize(vip[2], 'รางวัลที่ 3'),
    ];
  }, [activeRound?.prize_details]);

  const fetchActiveRound = useCallback(async () => {
    const { data, error } = await supabase
      .from('lottery_rounds')
      .select('id, round_number, status, draw_date, winning_number, prize_details, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    setActiveRound((data as any) ?? null);
  }, []);

  const fetchMyTicketsForRound = useCallback(
    async (roundId: string) => {
      if (!user?.id) {
        setMyRoundTickets([]);
        return;
      }
      const { data, error } = await db
        .from('lottery_tickets')
        .select('number, created_at')
        .eq('round_id', roundId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyRoundTickets((data ?? []).map((t: any) => t.number));
    },
    [user?.id]
  );

  const fetchSoldOut = useCallback(async (roundId: string) => {
    const { data, error } = await db
      .from('lottery_tickets')
      .select('number, created_at')
      .eq('round_id', roundId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    setSoldOut((data ?? []) as any);
  }, []);

  const fetchWalletTickets = useCallback(async () => {
    if (!user?.id) {
      setWalletTickets([]);
      return;
    }
    const { data, error } = await db
      .from('lottery_tickets')
      .select('id, number, created_at, lottery_rounds(round_number, winning_number, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    const mapped: WalletTicket[] = (data ?? []).map((row: any) => ({
      id: row.id,
      number: row.number,
      created_at: row.created_at,
      round: row.lottery_rounds ?? null,
    }));
    setWalletTickets(mapped);
  }, [user?.id]);

  const fetchPastRounds = useCallback(async () => {
    const { data, error } = await supabase
      .from('lottery_rounds')
      .select('id, round_number, status, draw_date, winning_number, prize_details, created_at')
      .eq('status', 'announced')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    setPastRounds((data ?? []) as any);
  }, []);

  useEffect(() => {
    fetchActiveRound().catch(() => setActiveRound(null));
    fetchPastRounds().catch(() => setPastRounds([]));
    fetchWalletTickets().catch(() => setWalletTickets([]));
  }, [fetchActiveRound, fetchPastRounds, fetchWalletTickets]);

  useEffect(() => {
    if (!activeRound?.id) {
      setSoldOut([]);
      setMyRoundTickets([]);
      return;
    }
    fetchSoldOut(activeRound.id).catch(() => setSoldOut([]));
    fetchMyTicketsForRound(activeRound.id).catch(() => setMyRoundTickets([]));
  }, [activeRound?.id, fetchSoldOut, fetchMyTicketsForRound]);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      if (!drawDate) {
        setCountdownMs(0);
        return;
      }
      const left = drawDate.getTime() - Date.now();
      setCountdownMs(Math.max(0, left));
    };
    tick();
    timer = window.setInterval(tick, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [drawDate]);

  useEffect(() => {
    const channel = supabase
      .channel('lottery-rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_rounds' }, () => {
        fetchActiveRound().catch(() => setActiveRound(null));
        fetchPastRounds().catch(() => setPastRounds([]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveRound, fetchPastRounds]);

  useEffect(() => {
    if (!activeRound?.id) return;
    const channel = supabase
      .channel(`lottery-tickets-${activeRound.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lottery_tickets', filter: `round_id=eq.${activeRound.id}` },
        () => {
          fetchSoldOut(activeRound.id).catch(() => undefined);
          fetchMyTicketsForRound(activeRound.id).catch(() => undefined);
          fetchWalletTickets().catch(() => undefined);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRound?.id, fetchSoldOut, fetchMyTicketsForRound, fetchWalletTickets]);

  const validateNumber = (n: string) => /^\d{6}$/.test(n);

  const handleRandom = () => {
    setInputNumber(randomTicket());
  };

  const refundPoints = useCallback(
    async () => {
      if (!API_URL || !user?.discord_id) return;
      const addUrl = `${API_URL}?action=add&userId=${encodeURIComponent(user.discord_id)}&amount=100`;
      await fetch(addUrl);
    },
    [user?.discord_id]
  );

  const handleBuy = useCallback(async () => {
    if (!user?.discord_id || !user?.id) {
      toast({ title: 'ต้องเข้าสู่ระบบ', description: 'กรุณาเข้าสู่ระบบก่อนซื้อ', variant: 'destructive' });
      return;
    }
    if (!activeRound?.id || !canBuy) {
      toast({ title: 'งวดปิดแล้ว', description: 'ไม่สามารถซื้อในตอนนี้', variant: 'destructive' });
      return;
    }
    const ticketNumber = inputNumber.trim();
    if (!validateNumber(ticketNumber)) {
      toast({ title: 'เลขไม่ถูกต้อง', description: 'กรุณากรอกเลข 6 หลัก', variant: 'destructive' });
      return;
    }
    if (!API_URL) {
      toast({ title: 'ระบบแต้มไม่พร้อม', description: 'ยังไม่ได้ตั้งค่า API', variant: 'destructive' });
      return;
    }

    try {
      setProcessing(true);

      const { data: existing } = await db
        .from('lottery_tickets')
        .select('user_id, profiles(username)')
        .eq('round_id', activeRound.id)
        .eq('number', ticketNumber)
        .maybeSingle();

      if (existing?.user_id) {
        const username = (existing as any)?.profiles?.username ?? 'ใครสักคน';
        toast({ title: 'Sold Out!', description: `อุ๊ย! เลข ${ticketNumber} ถูกคุณ ${username} เหมาไปแล้ว!`, variant: 'destructive' });
        return;
      }

      const checkUrl = `${API_URL}?action=get&userId=${encodeURIComponent(user.discord_id)}&t=${Date.now()}`;
      const resp = await fetch(checkUrl);
      const parsed = JSON.parse(await resp.text()) as { ok?: boolean; points?: number | string };
      if (!parsed?.ok) throw new Error('points_unavailable');
      const pts = typeof parsed.points === 'number' ? parsed.points : Number(parsed.points);
      if (!Number.isFinite(pts) || pts < 100) {
        toast({ title: 'แต้มไม่พอ', description: 'ต้องใช้ 100 🍓 ต่อ 1 ตั๋ว', variant: 'destructive' });
        return;
      }

      const subUrl = `${API_URL}?action=sub&userId=${encodeURIComponent(user.discord_id)}&amount=100`;
      const subResp = await fetch(subUrl);
      const subParsed = JSON.parse(await subResp.text()) as { ok?: boolean };
      if (!subParsed?.ok) throw new Error('deduct_failed');

      const { error: insertError } = await db.from('lottery_tickets').insert({
        round_id: activeRound.id,
        user_id: user.id,
        number: ticketNumber,
      });

      if (insertError) {
        await refundPoints();
        const { data: owned } = await db
          .from('lottery_tickets')
          .select('user_id, profiles(username)')
          .eq('round_id', activeRound.id)
          .eq('number', ticketNumber)
          .maybeSingle();
        const username = (owned as any)?.profiles?.username ?? 'ใครสักคน';
        toast({ title: 'ซื้อไม่สำเร็จ', description: `อุ๊ย! เลข ${ticketNumber} ถูกคุณ ${username} เหมาไปแล้ว!`, variant: 'destructive' });
        return;
      }

      setInputNumber('');
      toast({ title: 'ซื้อสำเร็จ', description: `หมายเลข ${ticketNumber} (ตัด 100 🍓)` });
    } catch {
      toast({ title: 'ซื้อไม่สำเร็จ', description: 'เกิดข้อผิดพลาดในการทำรายการ', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [user?.discord_id, user?.id, activeRound?.id, canBuy, inputNumber, toast, refundPoints]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="flex-1 flex relative z-10">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-full bg-white dark:bg-mocha shadow-lg flex items-center justify-center border border-latte/30 dark:border-coffee/30"
          aria-label="เปิดเมนู"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="hidden lg:block sticky top-0 h-screen">
          <HomeSidebar onlineCount={null} memberCount={null} />
        </div>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50 w-[280px] max-w-[85vw] h-full overflow-y-auto">
              <HomeSidebar onlineCount={null} memberCount={null} />
            </div>
          </div>
        )}

        <main className="flex-1 p-4 pt-16 lg:pt-10 lg:p-10">
          <div className="max-w-5xl mx-auto space-y-6">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl sm:text-3xl font-display font-bold bg-gradient-to-r from-violet-600 via-pink-500 to-rose-400 bg-clip-text text-transparent">
                ลอตเตอรี่คาเฟ่หมี
              </h1>
              <Badge className="ml-auto gap-1">
                <Ticket className="w-4 h-4" />
                งวด {activeRound?.round_number ?? '-'}
              </Badge>
            </motion.div>

            <Tabs defaultValue="buy" className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                <TabsTrigger value="buy" className="rounded-lg gap-2">
                  <Crown className="h-4 w-4" />
                  ซื้อลอตเตอรี่
                </TabsTrigger>
                <TabsTrigger value="wallet" className="rounded-lg gap-2">
                  <Archive className="h-4 w-4" />
                  กระเป๋าตั๋วของฉัน
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg gap-2">
                  <History className="h-4 w-4" />
                  ประกาศผลย้อนหลัง
                </TabsTrigger>
              </TabsList>

              <TabsContent value="buy" className="space-y-6">
                <PrizePoolDisplay vipPrizes={vipPrizes} />

                <Card className="bg-gradient-to-br from-white/90 via-rose-50/50 to-pink-50/50 dark:from-card/80 dark:to-card/60 border-rose-200/50 dark:border-coffee/40 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-primary" />
                      สถานะงวดปัจจุบัน
                      <Badge variant="secondary" className="ml-auto rounded-full">
                        {isOpen ? 'เปิดรับซื้อ' : 'ปิดงวด'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-pink-500 text-white flex items-center justify-center shadow-lg">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">งวด</p>
                          <p className="text-lg font-semibold">{activeRound?.round_number ?? 'ยังไม่มีงวดที่เปิดอยู่'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">เวลาปิดรับ</p>
                        <p className="text-xl font-mono font-bold">{drawDate ? formatCountdown(countdownMs) : '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-latte/40 dark:border-coffee/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-primary" />
                      เลือกเลขลอตเตอรี่
                      <Badge variant="outline" className="ml-auto rounded-full">
                        100 🍓 / ใบ
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        value={inputNumber}
                        onChange={(e) => setInputNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="กรอกเลข 6 หลัก เช่น 012345"
                        className="rounded-xl sm:max-w-[260px]"
                        inputMode="numeric"
                      />
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleRandom} className="rounded-xl flex-1 sm:flex-none">
                          <Dice5 className="w-4 h-4 mr-2" />
                          สุ่มเลข
                        </Button>
                        <Button onClick={handleBuy} disabled={processing || !canBuy} className="rounded-xl flex-1 sm:flex-none">
                          ซื้อ 100 🍓
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ก่อนหักแต้ม ระบบจะเช็กก่อนว่าเลขนี้มีคนเหมาหรือยัง (กันซื้อซ้ำ)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-latte/40 dark:border-coffee/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-primary" />
                      ฟีด Sold Out
                      <Badge variant="secondary" className="ml-auto rounded-full">
                        {soldOut.length} รายการล่าสุด
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!activeRound?.id ? (
                      <p className="text-sm text-muted-foreground">ยังไม่มีงวดที่เปิดอยู่</p>
                    ) : soldOut.length === 0 ? (
                      <p className="text-sm text-muted-foreground">ยังไม่มีเลขที่ถูกซื้อไปแล้ว</p>
                    ) : (
                      <ScrollArea className="h-[220px] pr-3">
                        <div className="space-y-2">
                          {soldOut.map((item, idx) => (
                            <div key={`${item.number}-${idx}`} className="bear-card-interactive p-3 rounded-xl flex items-center justify-between">
                              <span className="font-mono text-lg font-bold">{item.number}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.created_at ? new Date(item.created_at).toLocaleTimeString() : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wallet" className="space-y-6">
                <Card className="border-latte/40 dark:border-coffee/40 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-primary" />
                      กระเป๋าตั๋วของฉัน
                      <Badge variant="secondary" className="ml-auto rounded-full">
                        สไตล์ของสะสม
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!user?.id ? (
                      <p className="text-sm text-muted-foreground">กรุณาเข้าสู่ระบบเพื่อดูตั๋วของคุณ</p>
                    ) : walletTickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">ยังไม่มีตั๋วที่ซื้อไว้</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {walletTickets.map((t) => {
                          const announced = t.round?.status === 'announced' && Boolean(t.round?.winning_number);
                          const isWin = announced && t.round?.winning_number === t.number;
                          return (
                            <div key={t.id} className="bear-card-interactive overflow-hidden">
                              <div className="p-4 bg-gradient-to-br from-cream/70 via-peach/30 to-blush/40 dark:from-card dark:via-card/70 dark:to-card/60">
                                <div className="flex items-center justify-between gap-2">
                                  <Badge className="rounded-full">{t.round?.round_number ?? '—'}</Badge>
                                  <Badge variant={isWin ? 'default' : 'secondary'} className="rounded-full">
                                    {isWin ? 'WIN 🎉' : announced ? 'จบงวด' : 'รอผล'}
                                  </Badge>
                                </div>
                                <div className="mt-4 rounded-2xl border border-border/60 bg-white/70 dark:bg-background/40 p-4">
                                  <p className="text-xs text-muted-foreground">Ticket</p>
                                  <p className="font-mono text-3xl font-extrabold tracking-wider">{t.number}</p>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</span>
                                  <span>เตรียมพร้อมสำหรับระบบเทรด</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                <Card className="border-latte/40 dark:border-coffee/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" />
                      ประกาศผลย้อนหลัง
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {pastRounds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">ยังไม่มีงวดที่ประกาศผล</p>
                    ) : (
                      <div className="space-y-3">
                        {pastRounds.map((r) => (
                          <div key={r.id} className="bear-card p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <p className="font-display font-semibold">งวด {r.round_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {r.draw_date ? new Date(r.draw_date).toLocaleString() : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full">
                                  เลขรางวัล
                                </Badge>
                                <span className="font-mono text-xl font-extrabold">{r.winning_number ?? '—'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
