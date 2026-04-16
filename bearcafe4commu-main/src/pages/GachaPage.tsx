import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Coins, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import ClawMachine from '@/components/gacha/ClawMachine';
import GachaResultDialog from '@/components/gacha/GachaResultDialog';

type GachaReward = {
  id: string;
  name: string;
  type: 'point' | 'role' | 'money' | 'item' | 'other';
  value: string | null;
  drop_rate: number;
};

export default function GachaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [wonReward, setWonReward] = useState<GachaReward | null>(null);
  const resultRef = useRef<any>(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    fetchCoins();
  }, [user, navigate]);

  const fetchCoins = async () => {
    try {
      const { data } = await supabase
        .from('user_gacha_stats')
        .select('gacha_coins')
        .eq('discord_id', user!.discord_id)
        .maybeSingle();
      if (data) setCoins(data.gacha_coins || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async () => {
    if (coins < 1 || busy) return;
    setBusy(true);
    setPlaying(true);

    // Fire API + animation in parallel
    try {
      const { data, error } = await supabase.functions.invoke('gacha-spin');
      if (error) throw new Error(error.message || 'Spin failed');
      if (!data?.success) throw new Error(data?.error || 'Spin failed');
      resultRef.current = data;
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
      setPlaying(false);
      setBusy(false);
    }
  };

  // Called when claw animation finishes
  const handleDone = () => {
    setPlaying(false);
    const result = resultRef.current;
    if (!result) { setBusy(false); return; }
    resultRef.current = null;

    const r = result.reward;
    if (r && r.type !== 'none') {
      setWonReward({ id: r.id, name: r.name, type: r.type, value: r.value, drop_rate: 0 });
      confetti({ particleCount: 100, spread: 55, origin: { y: 0.6 }, colors: ['#D4956B', '#E8C07A', '#F2B5B5', '#A8D5BA'] });
    } else {
      setWonReward(null);
    }
    setCoins(prev => Math.max(0, prev - 1));
    setShowResult(true);
    setBusy(false);
    fetchCoins();
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--peach)/0.3)] via-background to-[hsl(var(--blush)/0.2)] pointer-events-none" />

      <div className="container max-w-md mx-auto px-4 py-6 relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <motion.div
            className="bg-card/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border flex items-center gap-2 shadow-sm"
            animate={{ scale: busy ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            <Coins className="w-5 h-5 text-[hsl(var(--honey))]" />
            <span className="font-bold text-lg text-foreground">{coins}</span>
          </motion.div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <ClawMachine isPlaying={playing} onDone={handleDone} />

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            disabled={busy || coins < 1}
            onClick={handleSpin}
            className={`
              relative px-10 py-4 rounded-2xl font-bold text-lg tracking-wide shadow-lg transition-all
              ${coins < 1
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_4px_30px_hsl(var(--primary)/0.5)]'
              }
            `}
          >
            <span className="flex items-center gap-2">
              {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังคว้า...</> : <>🐻 คว้ารางวัล (1 เหรียญ)</>}
            </span>
          </motion.button>

          {coins < 1 && !loading && (
            <p className="text-destructive text-sm bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
              เหรียญไม่เพียงพอ หาเพื่อนเพิ่มเพื่อรับเหรียญ!
            </p>
          )}
        </div>
      </div>

      <GachaResultDialog open={showResult} onOpenChange={setShowResult} reward={wonReward} />
    </div>
  );
}
