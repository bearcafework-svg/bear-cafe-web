import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Settings, RotateCcw, ChevronLeft } from 'lucide-react';
import { CozySidebar, COZY_SIDEBAR_WIDTH } from '@/components/bear-cafe/CozySidebar';
import { CozyRightPanel } from '@/components/bear-cafe/CozyRightPanel';
import { Footer } from '@/components/bear-cafe/Footer';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prize {
  id: number;
  name: string;
  emoji: string;
  weight: number;
  color: string;
  isSSR?: boolean;
}

// ─── Default prizes ───────────────────────────────────────────────────────────
const DEFAULT_PRIZES: Prize[] = [
  { id: 1, name: 'ลาเต้หมีอุ่นๆ',           emoji: '☕', weight: 40, color: 'text-amber-700 dark:text-amber-400' },
  { id: 2, name: 'คุกกี้ช็อกโกแลตชิพ',      emoji: '🍪', weight: 30, color: 'text-yellow-700 dark:text-yellow-400' },
  { id: 3, name: 'เค้กสตรอว์เบอร์รี',        emoji: '🍰', weight: 15, color: 'text-red-500 dark:text-red-400' },
  { id: 4, name: 'ชาเขียวมัทฉะเข้มข้น',     emoji: '🍵', weight: 10, color: 'text-green-700 dark:text-green-400' },
  { id: 5, name: 'ตั๋วสุ่มระดับตำนาน (SSR)', emoji: '🎫', weight: 5,  color: 'text-purple-600 dark:text-purple-400', isSSR: true },
];

// ─── Web Audio helpers ────────────────────────────────────────────────────────
function createAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); }
  catch { return null; }
}

function playTick(ctx: AudioContext, freq = 261.63, type: OscillatorType = 'square') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

function playWin(ctx: AudioContext, isSSR: boolean) {
  const notes = isSSR
    ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
    : [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSSR ? 'sawtooth' : 'triangle';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * (isSSR ? 0.12 : 0.1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isSSR ? 1.2 : 0.6));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + (isSSR ? 1.5 : 0.8));
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SpinPrizePage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES);
  const [showSettings, setShowSettings] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [displayItem, setDisplayItem] = useState<Prize>(DEFAULT_PRIZES[0]);
  const [spinPhase, setSpinPhase] = useState<
    'idle' | 'spinning_normal' | 'spinning_ssr' | 'win_normal' | 'win_ssr'
  >('idle');

  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noteMidiRef = useRef(60);

  const totalWeight = prizes.reduce((acc, p) => acc + p.weight, 0);

  useEffect(() => {
    return () => { if (spinIntervalRef.current) clearInterval(spinIntervalRef.current); };
  }, []);

  const handleSpin = useCallback(async () => {
    if (isSpinning || totalWeight === 0) return;

    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    const ctx = audioCtxRef.current;
    if (ctx?.state === 'suspended') await ctx.resume();

    setIsSpinning(true);
    setResult(null);

    // Pick winner upfront
    let rand = Math.random() * totalWeight;
    let winner = prizes[0];
    for (const p of prizes) {
      if (rand < p.weight) { winner = p; break; }
      rand -= p.weight;
    }
    const isSSR = !!winner.isSSR;
    setSpinPhase(isSSR ? 'spinning_ssr' : 'spinning_normal');

    const spinDuration = isSSR ? 3500 : 2000;
    const intervalSpeed = 100;
    let elapsed = 0;
    noteMidiRef.current = 60;

    spinIntervalRef.current = setInterval(() => {
      setDisplayItem(prizes[Math.floor(Math.random() * prizes.length)]);
      if (ctx) {
        if (isSSR) {
          const freq = 440 * Math.pow(2, (noteMidiRef.current - 69) / 12);
          playTick(ctx, freq, 'square');
          noteMidiRef.current += 0.5;
        } else {
          playTick(ctx, 261.63, 'square');
        }
      }
      elapsed += intervalSpeed;
      if (elapsed >= spinDuration) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        setResult(winner);
        setDisplayItem(winner);
        setIsSpinning(false);
        setSpinPhase(isSSR ? 'win_ssr' : 'win_normal');
        if (ctx) playWin(ctx, isSSR);
      }
    }, intervalSpeed);
  }, [isSpinning, totalWeight, prizes]);

  const handleReset = () => {
    if (isSpinning) return;
    setResult(null);
    setSpinPhase('idle');
    setDisplayItem(prizes[0]);
  };

  const updateWeight = (id: number, val: number) => {
    setPrizes(prev => prev.map(p => p.id === id ? { ...p, weight: Math.max(0, val) } : p));
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))] overflow-hidden">

      {/* ── Mobile sidebar toggle (left) ── */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-[hsl(var(--card))] shadow-md border border-[hsl(var(--latte)/0.5)] flex items-center justify-center"
        aria-label="เปิดเมนู"
      >
        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* ── Desktop left sidebar ── */}
      <div className="hidden lg:block shrink-0">
        <CozySidebar />
      </div>

      {/* ── Mobile left sidebar overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 h-full max-w-[85vw]" style={{ width: COZY_SIDEBAR_WIDTH }}>
            <CozySidebar />
          </div>
        </div>
      )}

      {/* ── Center content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto h-[100dvh]">
        <div className="relative max-w-2xl mx-auto px-5 pt-16 lg:pt-8 pb-12 space-y-6">

          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[hsl(var(--latte)/0.5)] transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                🎲 Bear Cafe Gacha
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                ยินดีต้อนรับสู่มุมเสี่ยงโชค! วันนี้พี่หมีจะเลือกอะไรให้คุณทานดีนะ?
              </p>
            </div>
          </motion.div>

          {/* ── Slot machine card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="bg-[hsl(var(--card))] rounded-3xl shadow-md border border-[hsl(var(--latte)/0.5)] border-b-4 border-b-[hsl(var(--bear-brown)/0.35)] p-7 text-center"
          >
            {/* Display box */}
            <div
              className={[
                'relative overflow-hidden rounded-2xl mb-7 h-64',
                'flex flex-col justify-center items-center border-4 transition-all duration-300',
                spinPhase === 'spinning_ssr'
                  ? 'border-red-400 shadow-[0_0_28px_rgba(239,68,68,0.35)]'
                  : spinPhase === 'win_ssr'
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 shadow-[0_0_36px_rgba(250,204,21,0.45)]'
                  : spinPhase === 'win_normal'
                  ? 'border-[hsl(var(--honey)/0.55)] bg-[hsl(var(--honey)/0.04)]'
                  : 'border-[hsl(var(--latte))] bg-[hsl(var(--cream))] dark:bg-[hsl(var(--mocha)/0.25)]',
                spinPhase === 'spinning_ssr' ? 'animate-[ssr-shake_0.3s_infinite]' : '',
              ].join(' ')}
            >
              {/* Emoji */}
              <motion.div
                key={displayItem.id + spinPhase}
                initial={{ scale: 0.85, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.07 }}
                className="text-8xl mb-3 drop-shadow-lg z-10"
              >
                {displayItem.emoji}
              </motion.div>

              {/* Name */}
              <div
                className={[
                  'w-full px-4 break-words text-center z-10',
                  result
                    ? `text-2xl font-black ${result.color} drop-shadow-sm`
                    : 'text-lg font-bold text-muted-foreground italic',
                ].join(' ')}
              >
                {result ? result.name : isSpinning ? displayItem.name : 'เตรียมพร้อมสุ่ม...'}
              </div>

              {/* Fortune message */}
              <AnimatePresence>
                {(spinPhase === 'win_normal' || spinPhase === 'win_ssr') && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={[
                      'mt-3 font-bold text-center z-10 px-4',
                      spinPhase === 'win_ssr'
                        ? 'text-red-600 dark:text-red-400 text-base animate-bounce'
                        : 'text-[hsl(var(--bear-brown))] text-sm',
                    ].join(' ')}
                  >
                    {spinPhase === 'win_ssr'
                      ? '🎉 แจ็กพอตแตก!! ยินดีด้วยคุณคือผู้โชคดี! 🎉'
                      : '✨ "ทานให้อร่อยนะคะ!"'}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Normal-win overlay */}
              <div
                className={[
                  'absolute inset-0 pointer-events-none transition-opacity duration-500',
                  spinPhase === 'win_normal' ? 'opacity-100 bg-[hsl(var(--honey)/0.1)]' : 'opacity-0',
                ].join(' ')}
              />
            </div>

            {/* Spin button */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={!isSpinning && totalWeight > 0 ? { scale: 1.03 } : {}}
                whileTap={!isSpinning && totalWeight > 0 ? { scale: 0.97 } : {}}
                onClick={handleSpin}
                disabled={isSpinning || totalWeight === 0}
                className={[
                  'w-full py-5 rounded-2xl text-xl font-black tracking-wide transition-all duration-200',
                  'flex items-center justify-center gap-3',
                  isSpinning || totalWeight === 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-sm'
                    : 'bg-gradient-to-br from-[hsl(var(--bear-brown))] to-[hsl(var(--primary))] text-white shadow-lg hover:shadow-xl border-b-4 border-[hsl(var(--mocha)/0.4)] active:border-b-0 active:translate-y-0.5',
                ].join(' ')}
              >
                {totalWeight === 0 ? (
                  <span>ไม่มีเรทสุ่ม ❌</span>
                ) : isSpinning ? (
                  <span className="animate-pulse">กำลังสุ่ม... ⏳</span>
                ) : (
                  <span>✨ กดเพื่อสุ่มเมนู!</span>
                )}
              </motion.button>

              {result && !isSpinning && (
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  สุ่มใหม่
                </button>
              )}

              <p className="text-xs text-muted-foreground">
                ใช้แต้มคาเฟ่เพียง 50 แต้มต่อการสุ่ม 1 ครั้ง
              </p>
            </div>
          </motion.div>

          {/* ── Prize list card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.4 }}
            className="bg-[hsl(var(--card))] rounded-3xl shadow-md border border-[hsl(var(--latte)/0.5)] border-b-4 border-b-[hsl(var(--latte))] p-7"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-foreground">
                <span>📋</span> รายการเมนูวันนี้
              </h3>
              <button
                onClick={() => setShowSettings(s => !s)}
                className="flex items-center gap-1.5 text-sm bg-[hsl(var(--latte)/0.3)] hover:bg-[hsl(var(--latte)/0.6)] text-[hsl(var(--bear-brown))] px-3 py-1.5 rounded-lg font-semibold transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                {showSettings ? 'ปิดตั้งค่า' : 'ตั้งค่าเรท'}
              </button>
            </div>

            <div className="space-y-3">
              {prizes.map(p => {
                const pct = totalWeight > 0
                  ? ((p.weight / totalWeight) * 100).toFixed(1)
                  : '0.0';
                return (
                  <div
                    key={p.id}
                    className={[
                      'flex flex-col gap-2 p-4 bg-[hsl(var(--background))] rounded-2xl border-2 transition-transform hover:scale-[1.01]',
                      p.isSSR
                        ? 'border-purple-300 dark:border-purple-700 shadow-sm shadow-purple-100 dark:shadow-purple-900/20'
                        : 'border-[hsl(var(--latte)/0.4)]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                        <span className="text-3xl flex-shrink-0">{p.emoji}</span>
                        <span className={`font-bold text-base ${p.color} truncate`}>{p.name}</span>
                      </div>
                      <span
                        className={[
                          'text-xs font-black bg-[hsl(var(--card))] px-3 py-1 rounded-full shadow-inner flex-shrink-0',
                          p.isSSR ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {pct}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-[hsl(var(--latte)/0.35)] rounded-full overflow-hidden">
                      <div
                        className={[
                          'h-full rounded-full transition-all duration-500',
                          p.isSSR
                            ? 'bg-gradient-to-r from-purple-400 to-pink-400'
                            : 'bg-gradient-to-r from-[hsl(var(--honey))] to-[hsl(var(--primary))]',
                        ].join(' ')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Settings controls */}
                    <AnimatePresence>
                      {showSettings && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 border-t border-[hsl(var(--latte)/0.3)] flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-14">Weight:</span>
                            <input
                              type="range" min={0} max={100} value={p.weight}
                              onChange={e => updateWeight(p.id, parseInt(e.target.value) || 0)}
                              className="flex-1 accent-[hsl(var(--primary))]"
                            />
                            <input
                              type="number" min={0} value={p.weight}
                              onChange={e => updateWeight(p.id, parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 text-sm border border-[hsl(var(--latte))] rounded-lg text-center focus:outline-none focus:border-[hsl(var(--primary))] font-bold bg-[hsl(var(--card))]"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Fairness note */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-[hsl(var(--honey)/0.08)] border-l-4 border-[hsl(var(--honey))] rounded-2xl p-5"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              "เราใช้ระบบการสุ่มแบบยุติธรรม (Fairness Seed) เพื่อให้แน่ใจว่าทุกคนมีโอกาสได้รับของแรร์เท่ากันค่ะ!" — ซีบิว
            </p>
          </motion.div>

        </div>

        <Footer />
      </main>

      {/* ── Desktop right panel ── */}
      <div className="hidden xl:block shrink-0 border-l border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] bg-[hsl(var(--cream))] dark:bg-[hsl(var(--mocha))]">
        <CozyRightPanel />
      </div>

      {/* ── Mobile right panel toggle ── */}
      <button
        onClick={() => setRightOpen(!rightOpen)}
        className="xl:hidden fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-[hsl(var(--card))] shadow-md border border-[hsl(var(--latte)/0.5)] flex items-center justify-center text-base"
        aria-label="เปิดแผงขวา"
      >
        🍓
      </button>

      {rightOpen && (
        <div className="xl:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRightOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 z-50 w-[280px] bg-[hsl(var(--cream))] dark:bg-[hsl(var(--mocha))] border-l border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] overflow-y-auto">
            <CozyRightPanel />
          </div>
        </div>
      )}

      {/* SSR shake keyframe */}
      <style>{`
        @keyframes ssr-shake {
          0%   { transform: translate(1px,1px) rotate(0deg); }
          10%  { transform: translate(-1px,-2px) rotate(-1deg); }
          20%  { transform: translate(-3px,0px) rotate(1deg); }
          30%  { transform: translate(3px,2px) rotate(0deg); }
          40%  { transform: translate(1px,-1px) rotate(1deg); }
          50%  { transform: translate(-1px,2px) rotate(-1deg); }
          60%  { transform: translate(-3px,1px) rotate(0deg); }
          70%  { transform: translate(3px,1px) rotate(-1deg); }
          80%  { transform: translate(-1px,-1px) rotate(1deg); }
          90%  { transform: translate(1px,2px) rotate(0deg); }
          100% { transform: translate(1px,-2px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}
