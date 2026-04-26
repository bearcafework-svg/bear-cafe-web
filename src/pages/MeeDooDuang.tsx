import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, CloudRain } from 'lucide-react';
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
const USES_KEY = 'meedooduang_uses';
const DEFAULT_USES = 3;
const TYPEWRITER_SPEED = 30;
const DIALOG_H_PORTRAIT = 220;
const DIALOG_H_LANDSCAPE = 200;

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

// ─── Card Back ────────────────────────────────────────────────────────────────
function CardBack({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <motion.div
      onClick={onClick}
      animate={{ scale: selected ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        width: 80, height: 120, borderRadius: 12, cursor: 'pointer',
        background: 'linear-gradient(135deg, #1e0a3c, #2d1b4e)',
        border: `2px solid ${selected ? 'rgba(251,191,36,0.8)' : 'rgba(139,92,246,0.4)'}`,
        boxShadow: selected ? '0 0 16px rgba(251,191,36,0.4)' : '0 0 8px rgba(139,92,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at center, rgba(139,92,246,0.3), transparent 70%)',
      }} />
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,0.9)',
        letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>
        TAROT
      </div>
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
    <div style={{ width: 80, height: 120, perspective: 600, flexShrink: 0 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          borderRadius: 12, background: 'linear-gradient(135deg,#1e0a3c,#2d1b4e)',
          border: '2px solid rgba(139,92,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,0.9)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            TAROT
          </div>
        </div>
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', borderRadius: 12, overflow: 'hidden',
          border: '2px solid rgba(251,191,36,0.6)',
        }}>
          <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MeeDooDuang() {
  const navigate = useNavigate();
  const { on: rainOn, toggle: toggleRain, getCtx } = useRain();

  const [tarotData, setTarotData] = useState<TarotData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);

  // Step state
  const [step, setStep] = useState<Step>('question');
  const [userQuestion, setUserQuestion] = useState('');

  // Card selection (step 2)
  const [poolCards, setPoolCards] = useState<TarotCard[]>([]);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);

  // Result (step 3)
  const [chosenCards, setChosenCards] = useState<TarotCard[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [segIdx, setSegIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxSegLen, setMaxSegLen] = useState(160);

  const [uses, setUses] = useState<number>(() => {
    const v = localStorage.getItem(USES_KEY);
    return v !== null ? parseInt(v, 10) : DEFAULT_USES;
  });

  const calcMaxLen = useCallback(() => {
    const w = dialogRef.current?.offsetWidth ?? window.innerWidth;
    const charsPerLine = Math.floor((w - 64) / 8.5);
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
    if (selectedIdxs.length !== 3 || uses <= 0) return;
    const chosen = selectedIdxs.map(i => poolCards[i]);
    setChosenCards(chosen);
    const newUses = uses - 1;
    setUses(newUses);
    localStorage.setItem(USES_KEY, String(newUses));
    setStep('result');
    setSegments([]); setSegIdx(0);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('fortune-test', {
        body: {
          question: userQuestion.trim() || null,
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
  }, [selectedIdxs, poolCards, uses, userQuestion, maxSegLen]);

  // Reset all the way to step 1
  const resetAll = useCallback(() => {
    setStep('question');
    setUserQuestion('');
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

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ cursor: step === 'result' && !loading ? 'pointer' : 'default' }}
      onClick={handleScreenClick}
    >
      <audio id="bgm" loop />

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e]"
        style={bgSrc ? { backgroundImage: `url(${bgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
      <div className="absolute inset-0 bg-black/35" />

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map(s => (
          <motion.div key={s.id} className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }} />
        ))}
      </div>

      {/* ── HUD ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3"
        onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon"
          onClick={() => step === 'select' ? setStep('question') : navigate('/')}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl w-8 h-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-white/10 rounded-full px-3 py-1.5"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.9), rgba(139,92,246,0.8))',
              boxShadow: '0 0 8px rgba(251,191,36,0.4)',
            }} />
            <span className="text-white text-xs font-bold">{uses}</span>
            <span className="text-white/40 text-xs">ครั้ง</span>
            <button className="text-violet-300 text-xs font-medium hover:text-violet-200 ml-1 leading-none">+</button>
          </div>
          <button onClick={toggleRain}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${rainOn ? 'bg-blue-500/40 text-blue-300' : 'bg-white/10 text-white/40 hover:text-white/70'}`}>
            <CloudRain className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Character sprite ── */}
      <div className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none"
        style={{ bottom: 0, alignItems: 'flex-end' }}>
        <motion.img src={charSrc} alt="character" className="object-contain"
          style={{ height: isPortrait ? '62vh' : '72vh', filter: 'drop-shadow(0 0 28px rgba(168,85,247,0.25))', transformOrigin: 'bottom center' }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

      {/* ── Step 2: Card selection area (above dialog) ── */}
      <AnimatePresence>
        {(step === 'select' || step === 'result') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-0 right-0 z-30 flex justify-center items-end gap-3 px-4"
            style={{ bottom: dialogH + 16 }}
            onClick={e => e.stopPropagation()}
          >
            {step === 'select' && poolCards.map((_, idx) => (
              <CardBack key={idx} selected={selectedIdxs.includes(idx)} onClick={() => toggleCard(idx)} />
            ))}
            {step === 'result' && chosenCards.map((c, idx) => (
              <CardFace key={idx} card={c} delay={idx * 300 + 200} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialog box ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20" onClick={e => e.stopPropagation()}>
        <div ref={dialogRef} style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.0) 100%)',
          height: dialogH, padding: '20px 32px 20px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6,
        }}>

          {/* ── STEP 1: Question input ── */}
          {step === 'question' && (
            <>
              <div style={{ marginBottom: 8 }}>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: '#fbbf24', 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '0.02em',
                  textShadow: '0 2px 8px rgba(251,191,36,0.3)',
                }}>
                  น้องหมีพยากรณ์
                </span>
              </div>
              <p style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: 15, 
                lineHeight: 1.7, 
                margin: '0 0 12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>
                มีเรื่องอะไรอยู่ในใจคะ?
              </p>
              <input
                ref={inputRef}
                value={userQuestion}
                onChange={e => setUserQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && userQuestion.trim()) goToSelect(); }}
                placeholder="พิมพ์คำถามของคุณที่นี่..."
                style={{
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: 8,
                  color: '#fff', 
                  fontSize: 14, 
                  width: '100%', 
                  outline: 'none',
                  padding: '10px 12px', 
                  caretColor: '#a78bfa',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(167,139,250,0.6)';
                  e.target.style.background = 'rgba(255,255,255,0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(167,139,250,0.3)';
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <button
                  onClick={() => goToSelect()}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'rgba(255,255,255,0.4)', 
                    fontSize: 13, 
                    cursor: 'pointer', 
                    padding: 0,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  ข้ามได้
                </button>
                <button
                  onClick={() => { if (userQuestion.trim() || true) goToSelect(); }}
                  disabled={loadingData}
                  style={{
                    background: userQuestion.trim() ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.1)',
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 8,
                    padding: '8px 20px', 
                    fontSize: 14, 
                    fontWeight: 600,
                    cursor: loadingData ? 'not-allowed' : 'pointer',
                    opacity: loadingData ? 0.4 : 1,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    boxShadow: userQuestion.trim() ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
                  }}
                >
                  {loadingData ? 'กำลังโหลด...' : 'ถัดไป'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Card selection ── */}
          {step === 'select' && (
            <>
              <div style={{ marginBottom: 8 }}>
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 600, 
                  color: '#fbbf24', 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '0.02em',
                  textShadow: '0 2px 8px rgba(251,191,36,0.3)',
                }}>
                  น้องหมีพยากรณ์
                </span>
              </div>
              <p style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: 15, 
                lineHeight: 1.7, 
                margin: '0 0 12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>
                เลือกไพ่ที่ดึงดูดใจคุณ 3 ใบนะคะ
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => { setSelectedIdxs([]); drawPool(); }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'rgba(255,255,255,0.4)', 
                    fontSize: 13, 
                    cursor: 'pointer', 
                    padding: 0,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  เริ่มใหม่
                </button>
                <span style={{ 
                  color: selectedIdxs.length === 3 ? '#fbbf24' : 'rgba(255,255,255,0.6)', 
                  fontSize: 13, 
                  fontWeight: 600,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}>
                  เลือกแล้ว {selectedIdxs.length}/3
                </span>
                <button
                  onClick={() => { if (selectedIdxs.length === 3) confirmSelection(); }}
                  disabled={selectedIdxs.length !== 3 || uses <= 0}
                  style={{
                    background: selectedIdxs.length === 3 ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.1)',
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 8,
                    padding: '8px 20px', 
                    fontSize: 14, 
                    fontWeight: 600,
                    cursor: selectedIdxs.length === 3 ? 'pointer' : 'not-allowed',
                    opacity: selectedIdxs.length === 3 && uses > 0 ? 1 : 0.4,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    boxShadow: selectedIdxs.length === 3 ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
                  }}
                >
                  {uses <= 0 ? 'หมดครั้ง' : 'ยืนยัน'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Fortune result ── */}
          {step === 'result' && (
            <>
              {chosenCards.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#fbbf24', 
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    letterSpacing: '0.05em',
                    textShadow: '0 2px 8px rgba(251,191,36,0.3)',
                  }}>
                    {chosenCards.map(c => c.name).join(' · ')}
                  </span>
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                {loading ? (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}>
                    <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                    <span style={{ fontSize: 15 }}>กำลังดูดวงให้...</span>
                  </div>
                ) : (
                  <p style={{ 
                    color: 'rgba(255,255,255,0.95)', 
                    fontSize: 15, 
                    lineHeight: 1.8, 
                    margin: 0,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}>
                    {shown}
                    {!done && <span className="animate-pulse" style={{ color: '#a78bfa', marginLeft: 2 }}>▌</span>}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 24, marginTop: 4 }}>
                {!loading && done && !isLast && (
                  <motion.span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, 4, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity }}>▼</motion.span>
                )}
                {!loading && isLast && done && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetAll(); }}
                    style={{ 
                      background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', 
                      border: 'none', 
                      color: '#fff', 
                      borderRadius: 8, 
                      padding: '8px 20px', 
                      fontSize: 13, 
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                    }}
                  >
                    ดูดวงใหม่
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
