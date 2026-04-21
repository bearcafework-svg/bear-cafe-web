import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';

// lottery_tickets table exists in DB but not yet in generated types
const db = supabase as any;
import { HomeSidebar } from '@/components/bear-cafe/HomeSidebar';
import { Footer } from '@/components/bear-cafe/Footer';
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

  const fetchMyTicketsForRound = useCallback(async (roundId: string) => {
    if (!user?.id) { setMyRoundTickets([]); return; }
    const { data, error } = await db.from('lottery_tickets').select('number, created_at').eq('round_id', roundId).eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    setMyRoundTickets((data ?? []).map((t: any) => t.number));
  }, [user?.id]);

  const fetchSoldOut = useCallback(async (roundId: string) => {
    const { data, error } = await db.from('lottery_tickets').select('number, created_at').eq('round_id', roundId).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    setSoldOut((data ?? []) as any);
  }, []);

  const fetchWalletTickets = useCallback(async () => {
    if (!user?.id) { setWalletTickets([]); return; }
    const { data, error } = await db.from('lottery_tickets').select('id, number, created_at, lottery_rounds(round_number, winning_number, status)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    setWalletTickets((data ?? []).map((row: any) => ({ id: row.id, number: row.number, created_at: row.created_at, round: row.lottery_rounds ?? null })));
  }, [user?.id]);

  const fetchPastRounds = useCallback(async () => {
    const { data, error } = await supabase.from('lottery_rounds').select('id, round_number, status, draw_date, winning_number, prize_details, created_at').eq('status', 'announced').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    setPastRounds((data ?? []) as any);
  }, []);

  useEffect(() => {
    fetchActiveRound().catch(() => setActiveRound(null));
    fetchPastRounds().catch(() => setPastRounds([]));
    fetchWalletTickets().catch(() => setWalletTickets([]));
  }, [fetchActiveRound, fetchPastRounds, fetchWalletTickets]);

  useEffect(() => {
    if (!activeRound?.id) { setSoldOut([]); setMyRoundTickets([]); return; }
    fetchSoldOut(activeRound.id).catch(() => setSoldOut([]));
    fetchMyTicketsForRound(activeRound.id).catch(() => setMyRoundTickets([]));
  }, [activeRound?.id, fetchSoldOut, fetchMyTicketsForRound]);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      if (!drawDate) { setCountdownMs(0); return; }
      setCountdownMs(Math.max(0, drawDate.getTime() - Date.now()));
    };
    tick();
    timer = window.setInterval(tick, 1000);
    return () => { if (timer) window.clearInterval(timer); };
  }, [drawDate]);

  useEffect(() => {
    const channel = supabase.channel('lottery-rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_rounds' }, () => {
        fetchActiveRound().catch(() => setActiveRound(null));
        fetchPastRounds().catch(() => setPastRounds([]));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchActiveRound, fetchPastRounds]);

  useEffect(() => {
    if (!activeRound?.id) return;
    const channel = supabase.channel(`lottery-tickets-${activeRound.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lottery_tickets', filter: `round_id=eq.${activeRound.id}` }, () => {
        fetchSoldOut(activeRound.id).catch(() => undefined);
        fetchMyTicketsForRound(activeRound.id).catch(() => undefined);
        fetchWalletTickets().catch(() => undefined);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRound?.id, fetchSoldOut, fetchMyTicketsForRound, fetchWalletTickets]);

  const refundPoints = useCallback(async () => {
    if (!API_URL || !user?.discord_id) return;
    await fetch(`${API_URL}?action=add&userId=${encodeURIComponent(user.discord_id)}&amount=100`);
  }, [user?.discord_id]);

  const handleBuy = useCallback(async () => {
    if (!user?.discord_id || !user?.id) { toast({ title: 'ต้องเข้าสู่ระบบ', variant: 'destructive' }); return; }
    if (!activeRound?.id || !canBuy) { toast({ title: 'งวดปิดแล้ว', variant: 'destructive' }); return; }
    const ticketNumber = inputNumber.trim();
    if (!/^\d{6}$/.test(ticketNumber)) { toast({ title: 'เลขไม่ถูกต้อง', description: 'กรุณากรอกเลข 6 หลัก', variant: 'destructive' }); return; }
    if (!API_URL) { toast({ title: 'ระบบแต้มไม่พร้อม', variant: 'destructive' }); return; }
    try {
      setProcessing(true);
      const { data: existing } = await db.from('lottery_tickets').select('user_id, profiles(username)').eq('round_id', activeRound.id).eq('number', ticketNumber).maybeSingle();
      if (existing?.user_id) {
        toast({ title: 'Sold Out!', description: `เลข ${ticketNumber} ถูกเหมาไปแล้ว!`, variant: 'destructive' });
        return;
      }
      const resp = await fetch(`${API_URL}?action=get&userId=${encodeURIComponent(user.discord_id)}&t=${Date.now()}`);
      const parsed = JSON.parse(await resp.text()) as { ok?: boolean; points?: number | string };
      if (!parsed?.ok) throw new Error('points_unavailable');
      const pts = typeof parsed.points === 'number' ? parsed.points : Number(parsed.points);
      if (!Number.isFinite(pts) || pts < 100) { toast({ title: 'แต้มไม่พอ', description: 'ต้องใช้ 100 🍓 ต่อ 1 ตั๋ว', variant: 'destructive' }); return; }
      const subResp = await fetch(`${API_URL}?action=sub&userId=${encodeURIComponent(user.discord_id)}&amount=100`);
      const subParsed = JSON.parse(await subResp.text()) as { ok?: boolean };
      if (!subParsed?.ok) throw new Error('deduct_failed');
      const { error: insertError } = await db.from('lottery_tickets').insert({ round_id: activeRound.id, user_id: user.id, number: ticketNumber });
      if (insertError) {
        await refundPoints();
        toast({ title: 'ซื้อไม่สำเร็จ', description: `เลข ${ticketNumber} ถูกเหมาไปแล้ว!`, variant: 'destructive' });
        return;
      }
      setInputNumber('');
      toast({ title: '🎟️ ซื้อสำเร็จ!', description: `หมายเลข ${ticketNumber} (ตัด 100 🍓)` });
    } catch {
      toast({ title: 'ซื้อไม่สำเร็จ', description: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [user?.discord_id, user?.id, activeRound?.id, canBuy, inputNumber, toast, refundPoints]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-950 via-purple-900 to-pink-900">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex relative z-10">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md shadow-lg flex items-center justify-center border border-white/20" aria-label="เปิดเมนู">
          {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
        </button>

        <div className="hidden lg:block sticky top-0 h-screen">
          <HomeSidebar onlineCount={null} memberCount={null} />
        </div>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="relative z-50 w-[280px] max-w-[85vw] h-full">
              <HomeSidebar onlineCount={null} memberCount={null} />
            </div>
          </div>
        )}

        <main className="flex-1 p-4 pt-16 lg:pt-8 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* Header */}
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl text-white/70 hover:text-white hover:bg-white/10">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">🎟️ ลอตเตอรี่คาเฟ่หมี</h1>
                <p className="text-white/50 text-sm mt-0.5">ลุ้นรางวัลสุดพิเศษทุกงวด</p>
              </div>
              <Badge className="shrink-0 bg-white/10 text-white border-white/20 gap-1.5 px-3 py-1.5">
                <Ticket className="w-3.5 h-3.5" />งวด {activeRound?.round_number ?? '-'}
              </Badge>
            </motion.div>

            {/* Countdown */}
            {activeRound && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600/80 via-purple-600/80 to-pink-600/80 backdrop-blur-md border border-white/10 p-5">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                      <Timer className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white/70 text-sm">สถานะงวด</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className="text-white font-semibold">{isOpen ? 'เปิดรับซื้อ' : 'ปิดงวด'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-xs mb-1">ปิดรับในอีก</p>
                    <p className="font-mono text-3xl font-black text-white tracking-wider">{drawDate ? formatCountdown(countdownMs) : '—'}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="buy" className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-1">
                <TabsTrigger value="buy" className="rounded-lg gap-1.5 text-white/60 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <Crown className="h-4 w-4" /><span className="hidden sm:inline">ซื้อลอตเตอรี่</span><span className="sm:hidden">ซื้อ</span>
                </TabsTrigger>
                <TabsTrigger value="wallet" className="rounded-lg gap-1.5 text-white/60 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <Archive className="h-4 w-4" /><span className="hidden sm:inline">กระเป๋าตั๋ว</span><span className="sm:hidden">ตั๋ว</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg gap-1.5 text-white/60 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <History className="h-4 w-4" /><span className="hidden sm:inline">ผลย้อนหลัง</span><span className="sm:hidden">ผล</span>
                </TabsTrigger>
              </TabsList>

              {/* Buy Tab */}
              <TabsContent value="buy" className="space-y-5 mt-5">
                <PrizePoolDisplay vipPrizes={vipPrizes} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-violet-300" />
                      <span className="text-white font-semibold">เลือกเลขลอตเตอรี่</span>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">100 🍓 / ใบ</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Input
                        value={inputNumber}
                        onChange={(e) => setInputNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/20 text-center font-mono text-2xl tracking-[0.4em] h-14 focus-visible:ring-violet-400/50"
                        inputMode="numeric"
                        maxLength={6}
                      />
                      {inputNumber && (
                        <button onClick={() => setInputNumber('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setInputNumber(randomTicket())} className="flex-1 sm:flex-none rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2 h-14">
                        <Dice5 className="w-4 h-4" />สุ่มเลข
                      </Button>
                      <Button onClick={handleBuy} disabled={processing || !canBuy || inputNumber.length !== 6} className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white border-0 gap-2 h-14 font-semibold shadow-lg shadow-violet-500/25">
                        {processing ? <span className="animate-spin">⏳</span> : <Sparkles className="w-4 h-4" />}
                        {processing ? 'กำลังซื้อ...' : 'ซื้อ 100 🍓'}
                      </Button>
                    </div>
                  </div>
                  {inputNumber.length === 6 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl bg-gradient-to-r from-violet-500/20 to-pink-500/20 border border-violet-400/30 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white/50 text-xs">ตัวอย่างตั๋ว</p>
                        <p className="font-mono text-2xl font-black text-white tracking-[0.3em] mt-0.5">{inputNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-xs">ราคา</p>
                        <p className="text-amber-300 font-bold text-lg">100 🍓</p>
                      </div>
                    </motion.div>
                  )}
                  {myRoundTickets.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-white/40 text-xs">ตั๋วของฉันในงวดนี้ ({myRoundTickets.length} ใบ)</p>
                      <div className="flex flex-wrap gap-2">
                        {myRoundTickets.map((n) => (
                          <span key={n} className="font-mono text-sm bg-violet-500/20 text-violet-200 border border-violet-400/30 rounded-lg px-2.5 py-1">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-white/25 text-xs">ระบบจะตรวจสอบก่อนว่าเลขนี้ถูกซื้อไปแล้วหรือยัง ก่อนหักแต้ม</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-sm">🔴</span>
                      <span className="text-white font-semibold">เลขที่ถูกซื้อไปแล้ว</span>
                    </div>
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30">{soldOut.length} รายการ</Badge>
                  </div>
                  {!activeRound?.id ? (
                    <p className="text-white/40 text-sm">ยังไม่มีงวดที่เปิดอยู่</p>
                  ) : soldOut.length === 0 ? (
                    <p className="text-white/40 text-sm">ยังไม่มีเลขที่ถูกซื้อ — เป็นคนแรกได้เลย!</p>
                  ) : (
                    <ScrollArea className="h-[180px]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pr-2">
                        {soldOut.map((item, idx) => (
                          <div key={`${item.number}-${idx}`} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                            <span className="font-mono font-bold text-red-200">{item.number}</span>
                            <span className="text-red-400/60 text-[10px]">
                              {item.created_at ? new Date(item.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </motion.div>
              </TabsContent>

              {/* Wallet Tab */}
              <TabsContent value="wallet" className="mt-5">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-violet-300" />
                      <span className="text-white font-semibold">กระเป๋าตั๋วของฉัน</span>
                    </div>
                    <Badge className="bg-white/10 text-white/70 border-white/20">{walletTickets.length} ใบ</Badge>
                  </div>
                  {!user?.id ? (
                    <div className="text-center py-12"><p className="text-white/40">กรุณาเข้าสู่ระบบเพื่อดูตั๋วของคุณ</p></div>
                  ) : walletTickets.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <p className="text-4xl">🎟️</p>
                      <p className="text-white/40">ยังไม่มีตั๋วที่ซื้อไว้</p>
                      <p className="text-white/25 text-sm">ไปซื้อตั๋วในแท็บ "ซื้อลอตเตอรี่" ได้เลย</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {walletTickets.map((t) => {
                        const announced = t.round?.status === 'announced' && Boolean(t.round?.winning_number);
                        const isWin = announced && t.round?.winning_number === t.number;
                        return (
                          <motion.div key={t.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className={`relative overflow-hidden rounded-2xl border p-4 ${isWin ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/20 border-amber-400/40' : announced ? 'bg-white/5 border-white/10 opacity-60' : 'bg-gradient-to-br from-violet-500/20 to-pink-500/15 border-violet-400/30'}`}
                          >
                            {isWin && <div className="absolute top-2 right-2 text-lg">🎉</div>}
                            <div className="flex items-center justify-between mb-3">
                              <Badge className="bg-white/10 text-white/70 border-white/20 text-xs">งวด {t.round?.round_number ?? '—'}</Badge>
                              <span className={`text-xs font-medium ${isWin ? 'text-amber-300' : announced ? 'text-white/40' : 'text-violet-300'}`}>
                                {isWin ? '🏆 ถูกรางวัล!' : announced ? 'จบงวด' : '⏳ รอผล'}
                              </span>
                            </div>
                            <p className="font-mono text-3xl font-black text-white tracking-[0.25em] text-center py-2">{t.number}</p>
                            <p className="text-white/30 text-xs text-center mt-2">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-5">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-violet-300" />
                    <span className="text-white font-semibold">ประกาศผลย้อนหลัง</span>
                  </div>
                  {pastRounds.length === 0 ? (
                    <div className="text-center py-12"><p className="text-white/40">ยังไม่มีงวดที่ประกาศผล</p></div>
                  ) : (
                    <div className="space-y-3">
                      {pastRounds.map((r, idx) => (
                        <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                          className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 hover:bg-white/[0.08] transition-colors"
                        >
                          <div>
                            <p className="text-white font-semibold">งวด {r.round_number}</p>
                            <p className="text-white/40 text-xs mt-0.5">
                              {r.draw_date ? new Date(r.draw_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white/50 text-xs mb-1">เลขรางวัล</p>
                            <p className="font-mono text-2xl font-black text-amber-300 tracking-[0.2em]">{r.winning_number ?? '—'}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
