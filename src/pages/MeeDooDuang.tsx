import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, CloudRain, Music2, VolumeX } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

let charSrc = bearMascot;
let bgPortraitSrc = '';
let bgLandscapeSrc = '';
try { charSrc = new URL('../assets/char.png', import.meta.url).href; } catch {}
try { bgPortraitSrc = new URL('../assets/bg-portrait.jpg', import.meta.url).href; } catch {}
try { bgLandscapeSrc = new URL('../assets/bg-landscape.jpg', import.meta.url).href; } catch {}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TarotCard { name: string; meaning: string; prediction: string; img: string; }
interface TarotData { unk: string; cards: Record<string, TarotCard>; }

const GIST_URL = 'https://gist.githubusercontent.com/rxbbitz/cfca499dec156918995b03dddb9fb158/raw/tarot.json';
const TYPEWRITER_SPEED = 28;
// Dialog box heights — portrait needs more room for 3 lines of text
const DIALOG_H_PORTRAIT = 240;
const DIALOG_H_LANDSCAPE = 210;
// Card sizes — bigger for the "grand reveal" feel
const CARD_W = 90;
const CARD_H = 136;

// Intro greeting shown via typewriter on step 1
const INTRO_TEXT = 'สวัสดีน้าา วันนี้มีเรื่องอะไรอยากให้พี่หมีช่วยชี้นำทางไหมคะ?';

type Step = 'question' | 'select' | 'result';

// ─── Thai-aware segment splitter ──────────────────────────────────────────────
function splitSegments(text: string, maxLen = 160): string[] {
  const sentenceRe = /([^.!?ๆ…]+[.!?ๆ…]+)/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  let lastIdx = 0;
  while ((match = sentenceRe.exec(text)) !== null) {
    sentences.push(match[0].trim());
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) sentences.push(text.slice(lastIdx).trim());
  const parts = sentences.filter(Boolean).length ? sentences.filter(Boolean) : [text];
  const segs: string[] = [];
  let cur = '';
  for (const s of parts) {
    if ((cur + s).length <= maxLen) { cur = cur ? cur + ' ' + s : s; }
    else {
      if (cur) segs.push(cur.trim());
      if (s.length <= maxLen) { cur = s; }
      else { for (let i = 0; i < s.length; i += maxLen) segs.push(s.slice(i, i + maxLen).trim()); cur = ''; }
    }
  }
  if (cur.trim()) segs.push(cur.trim());
  return segs.length ? segs : [text];
}

// ─── Click sound ──────────────────────────────────────────────────────────────
function playClick(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 1200;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
  } catch { /* silent */ }
}

// ─── Rain + shared AudioContext ───────────────────────────────────────────────
function useRain() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const [on, setOn] = useState(false);

  const getOrCreateCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }, []);

  const start = useCallback(() => {
    const ctx = getOrCreateCtx();
    if (srcRef.current) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.value = 0.07;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    srcRef.current = src;
  }, [getOrCreateCtx]);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null; ctxRef.current?.close(); ctxRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (on) { stop(); setOn(false); } else { start(); setOn(true); }
  }, [on, start, stop]);

  useEffect(() => () => stop(), [stop]);
  return { on, toggle, getCtx: getOrCreateCtx };
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
function useTypewriter(text: string, active: boolean) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const t = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !text) return;
    setShown(''); setDone(false);
    let i = 0;
    const tick = () => {
      i++; setShown(text.slice(0, i));
      if (i < text.length) t.current = window.setTimeout(tick, TYPEWRITER_SPEED);
      else setDone(true);
    };
    t.current = window.setTimeout(tick, TYPEWRITER_SPEED);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [text, active]);

  const skip = useCallback(() => {
    if (t.current) clearTimeout(t.current);
    setShown(text); setDone(true);
  }, [text]);

  return { shown, done, skip };
}

// ─── Stable stars ─────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 35 }, (_, i) => ({
  id: i, left: (i * 37 + 13) % 100, top: (i * 53 + 7) % 100,
  dur: 2 + (i % 4), delay: (i * 0.3) % 3, size: i % 5 === 0 ? 1.5 : 1,
}));

// ─── Shared card style constants ─────────────────────────────────────────────
const CARD_BACK_INNER = (
  <>
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.35), transparent 65%)',
    }} />
    {/* Ornamental lines */}
    <div style={{
      position: 'absolute', inset: 8,
      border: '1px solid rgba(251,191,36,0.2)',
      borderRadius: 6,
    }} />
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.75)',
      letterSpacing: '0.2em', textTransform: 'uppercase', zIndex: 1,
    }}>
      TAROT
    </div>
  </>
);

// ─── Card Back ────────────────────────────────────────────────────────────────
function CardBack({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -6, scale: 1.04 }}
      animate={{ scale: selected ? 1.1 : 1, y: selected ? -8 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        width: CARD_W, height: CARD_H, borderRadius: 14, cursor: 'pointer',
        background: 'linear-gradient(160deg, #1e0a3c 0%, #2d1b4e 60%, #1a0a2e 100%)',
        border: `1.5px solid ${selected ? 'rgba(251,191,36,0.9)' : 'rgba(139,92,246,0.45)'}`,
        boxShadow: selected
          ? '0 0 24px rgba(251,191,36,0.45), 0 8px 24px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}
    >
      {CARD_BACK_INNER}
    </motion.div>
  );
}

// ─── Card Face (with flip animation) ─────────────────────────────────────────
function CardFace({ card, delay }: { card: TarotCard; delay: number }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{ width: CARD_W, height: CARD_H, perspective: 800, flexShrink: 0 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Back face */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          borderRadius: 14,
          background: 'linear-gradient(160deg, #1e0a3c 0%, #2d1b4e 60%, #1a0a2e 100%)',
          border: '1.5px solid rgba(139,92,246,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {CARD_BACK_INNER}
        </div>
        {/* Front face */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', borderRadius: 14, overflow: 'hidden',
          border: '1.5px solid rgba(251,191,36,0.7)',
          boxShadow: flipped ? '0 0 28px rgba(251,191,36,0.3), 0 8px 24px rgba(0,0,0,0.5)' : 'none',
        }}>
          <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Card name overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
            padding: '16px 6px 6px',
            textAlign: 'center',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(251,191,36,0.9)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {card.name}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MeeDooDuang() {
  const navigate = useNavigate();
  const { on: rainOn, toggle: toggleRain, getCtx } = useRain();

  // BGM state (separate from rain)
  const [bgmOn, setBgmOn] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const toggleBgm = useCallback(() => {
    if (!bgmRef.current) return;
    if (bgmOn) { bgmRef.current.pause(); setBgmOn(false); }
    else { bgmRef.current.play().catch(() => {}); setBgmOn(true); }
  }, [bgmOn]);

  const [tarotData, setTarotData] = useState<TarotData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);

  // Step state — no userQuestion needed anymore
  const [step, setStep] = useState<Step>('question');

  // Card selection (step 2)
  const [poolCards, setPoolCards] = useState<TarotCard[]>([]);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);

  // Result (step 3)
  const [chosenCards, setChosenCards] = useState<TarotCard[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [segIdx, setSegIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const [maxSegLen, setMaxSegLen] = useState(160);

  // ── Intro typewriter (step 1) ──
  const { shown: introShown, done: introDone } = useTypewriter(INTRO_TEXT, step === 'question');

  const calcMaxLen = useCallback(() => {
    const w = dialogRef.current?.offsetWidth ?? window.innerWidth;
    const charsPerLine = Math.floor((w - 80) / 8.5);
    const lines = isPortrait ? 3 : 2;
    setMaxSegLen(Math.min(220, Math.max(120, charsPerLine * lines)));
  }, [isPortrait]);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const h = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => { calcMaxLen(); }, [calcMaxLen, isPortrait]);

  useEffect(() => {
    fetch(GIST_URL).then(r => r.json()).then((d: TarotData) => setTarotData(d))
      .catch(console.error).finally(() => setLoadingData(false));
  }, []);

  // Draw 5 random cards for selection pool
  const drawPool = useCallback(() => {
    if (!tarotData) return;
    const keys = Object.keys(tarotData.cards);
    const shuffled = [...keys].sort(() => Math.random() - 0.5).slice(0, 5);
    setPoolCards(shuffled.map(k => tarotData.cards[k]));
    setSelectedIdxs([]);
  }, [tarotData]);

  // Step 1 → 2
  const goToSelect = useCallback(() => {
    drawPool();
    setStep('select');
  }, [drawPool]);

  // Toggle card selection
  const toggleCard = useCallback((idx: number) => {
    setSelectedIdxs(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 3) return prev;
      return [...prev, idx];
    });
  }, []);

  // Step 2 → 3: confirm selection
  const confirmSelection = useCallback(async () => {
    if (selectedIdxs.length !== 3) return;
    const chosen = selectedIdxs.map(i => poolCards[i]);
    setChosenCards(chosen);
    setStep('result');
    setSegments([]); setSegIdx(0);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('fortune-test', {
        body: {
          question: null,
          cardName: chosen.map(c => c.name).join(', '),
          meaning: chosen.map(c => c.meaning).join(' | '),
          prediction: chosen.map(c => c.prediction).join(' | '),
        },
      });
      if (error) throw error;
      setSegments(splitSegments(data.fortune ?? chosen.map(c => c.prediction).join(' '), maxSegLen));
    } catch {
      setSegments(splitSegments(chosen.map(c => c.prediction).join(' '), maxSegLen));
    } finally {
      setLoading(false);
    }
  }, [selectedIdxs, poolCards, maxSegLen]);

  // Reset all the way to step 1
  const resetAll = useCallback(() => {
    setStep('question');
    setPoolCards([]); setSelectedIdxs([]);
    setChosenCards([]); setSegments([]); setSegIdx(0);
  }, []);

  // Typewriter for result
  const currentText = segments[segIdx] ?? '';
  const isLast = segIdx >= segments.length - 1;
  const { shown, done, skip } = useTypewriter(currentText, step === 'result' && segments.length > 0 && !loading);

  // Click anywhere to advance (result step only)
  const handleScreenClick = useCallback(() => {
    if (step !== 'result' || loading) return;
    if (!done) { skip(); try { playClick(getCtx()); } catch {} return; }
    if (!isLast) { setSegIdx(i => i + 1); try { playClick(getCtx()); } catch {} }
  }, [step, loading, done, skip, isLast, getCtx]);

  const dialogH = isPortrait ? DIALOG_H_PORTRAIT : DIALOG_H_LANDSCAPE;
  const bgSrc = isPortrait ? bgPortraitSrc : bgLandscapeSrc;

  // Shared name-plate style
  const namePlateStyle: React.CSSProperties = {
    display: 'inline-block',
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid rgba(251,191,36,0.45)',
    borderRadius: '6px 6px 0 0',
    padding: '4px 16px',
    marginBottom: -1,
    fontSize: 13,
    fontWeight: 700,
    color: '#fbbf24',
    letterSpacing: '0.06em',
    textShadow: '0 1px 6px rgba(251,191,36,0.4)',
  };

  // Shared dialog inner box style
  const dialogBoxStyle: React.CSSProperties = {
    background: 'rgba(5,2,18,0.78)',
    border: '1px solid rgba(251,191,36,0.35)',
    borderRadius: 10,
    padding: isPortrait ? '14px 18px 12px' : '12px 20px 10px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ cursor: step === 'result' && !loading ? 'pointer' : 'default' }}
      onClick={handleScreenClick}
    >
      {/* BGM audio element — src can be swapped for a real file later */}
      <audio ref={bgmRef} id="bgm" loop src="" />

      {/* ── Background ── */}
      <div
        className="absolute inset-0"
        style={bgSrc
          ? { backgroundImage: `url(${bgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(160deg, #0d0520 0%, #1a0a2e 40%, #2d1b4e 70%, #1a0a2e 100%)' }
        }
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* ── Stars ── */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map(s => (
          <motion.div key={s.id} className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
            animate={{ opacity: [0.1, 0.65, 0.1] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }} />
        ))}
      </div>

      {/* ── HUD ── */}
      <div
        className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3"
        onClick={e => e.stopPropagation()}
      >
        {/* Back button */}
        <Button
          variant="ghost" size="icon"
          onClick={() => step === 'select' ? setStep('question') : navigate('/')}
          className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl w-8 h-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Right cluster */}
        <div className="flex items-center gap-2">

          {/* Rain toggle */}
          <button
            onClick={toggleRain}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              rainOn
                ? 'bg-sky-500/30 text-sky-300 border border-sky-400/40'
                : 'bg-white/8 text-white/35 hover:text-white/60 border border-white/10'
            }`}
            title={rainOn ? 'ปิดเสียงฝน' : 'เปิดเสียงฝน'}
          >
            <CloudRain className="w-3.5 h-3.5" />
          </button>

          {/* BGM toggle */}
          <button
            onClick={toggleBgm}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              bgmOn
                ? 'bg-violet-500/30 text-violet-300 border border-violet-400/40'
                : 'bg-white/8 text-white/35 hover:text-white/60 border border-white/10'
            }`}
            title={bgmOn ? 'ปิดเพลง' : 'เปิดเพลง'}
          >
            {bgmOn ? <Music2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Character sprite ── */}
      <div
        className="absolute left-0 right-0 z-10 flex pointer-events-none"
        style={{
          bottom: 0,
          alignItems: 'flex-end',
          // Shift slightly left for VN feel
          justifyContent: isPortrait ? 'center' : 'flex-start',
          paddingLeft: isPortrait ? 0 : '8vw',
        }}
      >
        <motion.img
          src={charSrc}
          alt="character"
          className="object-contain"
          style={{
            height: isPortrait ? '58vh' : '70vh',
            filter: 'drop-shadow(0 0 32px rgba(168,85,247,0.22))',
            transformOrigin: 'bottom center',
          }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Card area (above dialog) ── */}
      <AnimatePresence>
        {(step === 'select' || step === 'result') && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4 }}
            className="absolute left-0 right-0 z-30 flex justify-center items-end gap-3 px-4"
            style={{ bottom: dialogH + 20 }}
            onClick={e => e.stopPropagation()}
          >
            {step === 'select' && poolCards.map((_, idx) => (
              <CardBack key={idx} selected={selectedIdxs.includes(idx)} onClick={() => toggleCard(idx)} />
            ))}
            {step === 'result' && chosenCards.map((c, idx) => (
              <CardFace key={idx} card={c} delay={idx * 320 + 200} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialog box ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20"
        style={{ padding: isPortrait ? '0 12px 16px' : '0 20px 20px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Name plate */}
        <div>
          <span style={namePlateStyle}>น้องหมีพยากรณ์</span>
        </div>

        {/* Dialog inner box */}
        <div ref={dialogRef} style={{ ...dialogBoxStyle, minHeight: dialogH - 32 }}>

          {/* ── STEP 1: Intro greeting via typewriter ── */}
          {step === 'question' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{
                color: 'rgba(255,255,255,0.92)',
                fontSize: isPortrait ? 15 : 14,
                lineHeight: 1.85,
                margin: 0,
                minHeight: '3.7em',
              }}>
                {introShown}
                {!introDone && (
                  <motion.span
                    style={{ color: '#a78bfa', marginLeft: 1 }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  >
                    |
                  </motion.span>
                )}
              </p>

              {/* Show button only after intro text finishes */}
              <AnimatePresence>
                {introDone && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', justifyContent: 'flex-end' }}
                  >
                    <button
                      onClick={goToSelect}
                      disabled={loadingData}
                      style={{
                        background: loadingData ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                        color: '#fff',
                        border: '1px solid rgba(167,139,250,0.4)',
                        borderRadius: 8,
                        padding: '9px 24px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loadingData ? 'not-allowed' : 'pointer',
                        opacity: loadingData ? 0.45 : 1,
                        letterSpacing: '0.04em',
                        boxShadow: loadingData ? 'none' : '0 4px 16px rgba(124,58,237,0.35)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {loadingData ? 'กำลังโหลด...' : 'เริ่มดูดวง'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── STEP 2: Card selection ── */}
          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{
                color: 'rgba(255,255,255,0.92)',
                fontSize: isPortrait ? 15 : 14,
                lineHeight: 1.85,
                margin: 0,
              }}>
                เลือกไพ่ที่ดึงดูดใจคุณ 3 ใบนะคะ
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => { setSelectedIdxs([]); drawPool(); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.35)', fontSize: 13,
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  สับไพ่ใหม่
                </button>
                <span style={{
                  color: selectedIdxs.length === 3 ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                  fontSize: 13, fontWeight: 600,
                  transition: 'color 0.2s',
                }}>
                  {selectedIdxs.length} / 3
                </span>
                <button
                  onClick={() => { if (selectedIdxs.length === 3) confirmSelection(); }}
                  disabled={selectedIdxs.length !== 3}
                  style={{
                    background: selectedIdxs.length === 3
                      ? 'linear-gradient(135deg,#7c3aed,#5b21b6)'
                      : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(167,139,250,0.35)',
                    borderRadius: 8,
                    padding: '9px 24px',
                    fontSize: 14, fontWeight: 600,
                    cursor: selectedIdxs.length === 3 ? 'pointer' : 'not-allowed',
                    opacity: selectedIdxs.length === 3 ? 1 : 0.4,
                    boxShadow: selectedIdxs.length === 3
                      ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Fortune result ── */}
          {step === 'result' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Card names as sub-header */}
              {chosenCards.length > 0 && (
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(251,191,36,0.7)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  {chosenCards.map(c => c.name).join('  ·  ')}
                </div>
              )}

              {/* Fortune text */}
              <div style={{ minHeight: '3.5em' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.4)' }}>
                    <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                    <span style={{ fontSize: 14 }}>กำลังดูดวงให้...</span>
                  </div>
                ) : (
                  <p style={{
                    color: 'rgba(255,255,255,0.93)',
                    fontSize: isPortrait ? 15 : 14,
                    lineHeight: 1.85,
                    margin: 0,
                  }}>
                    {shown}
                    {!done && (
                      <motion.span
                        style={{ color: '#a78bfa', marginLeft: 1 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                      >
                        |
                      </motion.span>
                    )}
                  </p>
                )}
              </div>

              {/* Advance / finish controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 28 }}>
                {!loading && done && !isLast && (
                  <motion.div
                    style={{ color: 'rgba(255,255,255,0.45)', fontSize: 18, lineHeight: 1 }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, 4, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    ▼
                  </motion.div>
                )}
                {!loading && isLast && done && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={(e) => { e.stopPropagation(); resetAll(); }}
                    style={{
                      background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                      border: '1px solid rgba(167,139,250,0.4)',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '8px 22px',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ดูดวงใหม่
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}