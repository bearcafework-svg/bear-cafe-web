import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, CloudRain } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

// Try to import optional assets — Vite will throw if missing, catch with ?url trick
let charSrc = bearMascot;
let bgPortraitSrc = '';
let bgLandscapeSrc = '';

try { charSrc = new URL('../assets/char.png', import.meta.url).href; } catch {}
try { bgPortraitSrc = new URL('../assets/bg-portrait.jpg', import.meta.url).href; } catch {}
try { bgLandscapeSrc = new URL('../assets/bg-landscape.jpg', import.meta.url).href; } catch {}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TarotCard {
  name: string;
  meaning: string;
  prediction: string;
  img: string;
}

interface TarotData {
  unk: string;
  cards: Record<string, TarotCard>;
}

const GIST_URL =
  'https://gist.githubusercontent.com/rxbbitz/cfca499dec156918995b03dddb9fb158/raw/tarot.json';

const USES_KEY = 'meedooduang_uses';
const DEFAULT_USES = 3;
const TYPEWRITER_SPEED = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitSegments(text: string, maxLen = 80): string[] {
  const words = text.split(' ');
  const segs: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > maxLen && cur) { segs.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) segs.push(cur);
  return segs.length ? segs : [text];
}

// ─── Rain ─────────────────────────────────────────────────────────────────────
function useRain() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const [on, setOn] = useState(false);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.value = 0.07;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
    srcRef.current = src;
  }, []);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    ctxRef.current?.close();
    ctxRef.current = null; srcRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (on) { stop(); setOn(false); } else { start(); setOn(true); }
  }, [on, start, stop]);

  useEffect(() => () => stop(), [stop]);
  return { on, toggle };
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
      i++;
      setShown(text.slice(0, i));
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
  id: i,
  left: (i * 37 + 13) % 100,
  top: (i * 53 + 7) % 100,
  dur: 2 + (i % 4),
  delay: (i * 0.3) % 3,
  size: i % 5 === 0 ? 1.5 : 1,
}));

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MeeDooDuang() {
  const navigate = useNavigate();
  const { on: rainOn, toggle: toggleRain } = useRain();

  const [tarotData, setTarotData] = useState<TarotData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [card, setCard] = useState<TarotCard | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [segIdx, setSegIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );

  const [uses, setUses] = useState<number>(() => {
    const v = localStorage.getItem(USES_KEY);
    return v !== null ? parseInt(v, 10) : DEFAULT_USES;
  });

  // Detect orientation
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fetch tarot
  useEffect(() => {
    fetch(GIST_URL)
      .then(r => r.json())
      .then((d: TarotData) => setTarotData(d))
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, []);

  const startReading = useCallback(async () => {
    if (!tarotData || uses <= 0) return;
    setLoading(true); setStarted(true); setSegments([]); setSegIdx(0);
    const keys = Object.keys(tarotData.cards);
    const drawn = tarotData.cards[keys[Math.floor(Math.random() * keys.length)]];
    setCard(drawn);
    const newUses = uses - 1;
    setUses(newUses);
    localStorage.setItem(USES_KEY, String(newUses));
    try {
      const { data, error } = await supabase.functions.invoke('fortune-test', {
        body: { question: null, cardName: drawn.name, meaning: drawn.meaning, prediction: drawn.prediction },
      });
      if (error) throw error;
      setSegments(splitSegments(data.fortune ?? drawn.prediction));
    } catch {
      setSegments(splitSegments(drawn.prediction));
    } finally {
      setLoading(false);
    }
  }, [tarotData, uses]);

  const reset = useCallback(() => {
    setStarted(false); setCard(null); setSegments([]); setSegIdx(0);
  }, []);

  const currentText = segments[segIdx] ?? '';
  const isLast = segIdx >= segments.length - 1;
  const { shown, done, skip } = useTypewriter(currentText, segments.length > 0 && !loading);

  const handleClick = () => {
    if (!started || loading) return;
    if (!done) { skip(); return; }
    if (!isLast) setSegIdx(i => i + 1);
  };

  // Background
  const bgSrc = isPortrait ? bgPortraitSrc : bgLandscapeSrc;

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      {/* BGM placeholder */}
      <audio id="bgm" loop />

      {/* Background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e]"
        style={bgSrc ? { backgroundImage: `url(${bgSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      />
      {/* Darken overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map(s => (
          <motion.div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* ── HUD top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate('/')}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl w-8 h-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2">
          {/* Uses */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1">
            <span className="text-xs">🔮</span>
            <span className="text-white text-xs font-bold">{uses}</span>
            <span className="text-white/40 text-xs">ครั้ง</span>
            <button className="text-violet-300 text-xs font-medium hover:text-violet-200 ml-1 leading-none">
              +
            </button>
          </div>
          {/* Rain toggle */}
          <button
            onClick={toggleRain}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${rainOn ? 'bg-blue-500/40 text-blue-300' : 'bg-white/10 text-white/40 hover:text-white/70'}`}
          >
            <CloudRain className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Character sprite — full screen, bottom-anchored ── */}
      <div
        className="absolute inset-0 z-10 flex items-end justify-center pointer-events-none"
        style={{ paddingBottom: isPortrait ? '38%' : '28%' }}
      >
        <motion.img
          src={charSrc}
          alt="character"
          className="object-contain drop-shadow-2xl"
          style={{
            height: isPortrait ? '55vh' : '72vh',
            maxHeight: isPortrait ? 420 : 520,
            filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.25))',
          }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Dialog box — bottom overlay ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20"
        onClick={handleClick}
        style={{ cursor: started && !loading ? 'pointer' : 'default' }}
      >
        {/* Name plate */}
        {card && (
          <div className="px-4 sm:px-6 mb-0">
            <div className="inline-block bg-gradient-to-r from-violet-700 to-purple-800 border border-violet-400/40 rounded-t-xl px-4 py-1.5">
              <span className="text-white text-sm font-bold tracking-wide">{card.name}</span>
            </div>
          </div>
        )}

        {/* Dialog panel */}
        <div
          className="mx-0 border-t border-purple-400/20 px-4 sm:px-8 py-4 sm:py-5"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,4,30,0.88), rgba(15,6,40,0.95))',
            backdropFilter: 'blur(12px)',
            minHeight: isPortrait ? 140 : 120,
          }}
        >
          {/* Text area */}
          <div className="min-h-[60px] flex items-start">
            {!started ? (
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-white/80 text-sm sm:text-base leading-relaxed flex-1">
                  สวัสดีค่ะ~ น้องหมีพร้อมดูดวงให้แล้วนะคะ ✨<br />
                  <span className="text-white/50 text-xs">กดปุ่มด้านล่างเพื่อเริ่มต้นค่ะ</span>
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startReading(); }}
                  disabled={loadingData || uses <= 0}
                  className="shrink-0 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 text-white rounded-xl px-5 py-2 text-sm font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  {loadingData
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />โหลด...</>
                    : uses <= 0 ? '🔮 หมดครั้ง'
                    : '🔮 เริ่มดูดวง'}
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">กำลังดูดวงให้...</span>
              </div>
            ) : (
              <p className="text-white text-sm sm:text-base leading-relaxed w-full">
                {shown}
                {!done && <span className="animate-pulse text-violet-300 ml-0.5">▌</span>}
              </p>
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2">
            {/* Left: card meaning hint */}
            {card && started && !loading && (
              <span className="text-white/25 text-xs truncate max-w-[60%]">{card.meaning.slice(0, 40)}…</span>
            )}
            <div className="ml-auto flex items-center gap-3">
              {started && !loading && isLast && done && (
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="text-violet-300 hover:text-violet-200 text-xs font-medium transition-colors"
                >
                  🔮 ดูดวงใหม่
                </button>
              )}
              {started && !loading && done && !isLast && (
                <motion.span
                  className="text-white/50 text-xs"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  ▼
                </motion.span>
              )}
              {started && !loading && !done && (
                <span className="text-white/25 text-xs">แตะเพื่อข้าม</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
