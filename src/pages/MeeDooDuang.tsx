import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, CloudRain } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

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
const TYPEWRITER_SPEED = 30; // ms per char

// ─── Helpers ──────────────────────────────────────────────────────────────────
function splitSegments(text: string, maxLen = 80): string[] {
  const words = text.split(' ');
  const segments: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen && current.length > 0) {
      segments.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments.length ? segments : [text];
}

// ─── Rain via Web Audio API ───────────────────────────────────────────────────
function useRain() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const [rainOn, setRainOn] = useState(false);

  const startRain = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.3;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    nodesRef.current = [source, filter, gain];
  }, []);

  const stopRain = useCallback(() => {
    nodesRef.current.forEach((n) => { try { (n as AudioBufferSourceNode).stop?.(); } catch {} });
    ctxRef.current?.close();
    ctxRef.current = null;
    nodesRef.current = [];
  }, []);

  const toggle = useCallback(() => {
    if (rainOn) { stopRain(); setRainOn(false); }
    else { startRain(); setRainOn(true); }
  }, [rainOn, startRain, stopRain]);

  useEffect(() => () => stopRain(), [stopRain]);
  return { rainOn, toggle };
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, active: boolean) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setDisplayed('');
    setDone(false);
    let i = 0;
    const tick = () => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerRef.current = window.setTimeout(tick, TYPEWRITER_SPEED);
      } else {
        setDone(true);
      }
    };
    timerRef.current = window.setTimeout(tick, TYPEWRITER_SPEED);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, active]);

  const skip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayed(text);
    setDone(true);
  }, [text]);

  return { displayed, done, skip };
}

// ─── Stars (stable positions) ─────────────────────────────────────────────────
const STARS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: (i * 37 + 13) % 100,
  top: (i * 53 + 7) % 100,
  dur: 2 + (i % 4),
  delay: (i * 0.3) % 3,
}));

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeeDooDuang() {
  const navigate = useNavigate();
  const { rainOn, toggle: toggleRain } = useRain();

  // Tarot data
  const [tarotData, setTarotData] = useState<TarotData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // VN state
  const [card, setCard] = useState<TarotCard | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [segIdx, setSegIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  // Uses
  const [uses, setUses] = useState<number>(() => {
    const v = localStorage.getItem(USES_KEY);
    return v !== null ? parseInt(v, 10) : DEFAULT_USES;
  });

  // Background images (fallback gracefully)
  const [portraitBg, setPortraitBg] = useState<string | null>(null);
  const [landscapeBg, setLandscapeBg] = useState<string | null>(null);
  const [charImg, setCharImg] = useState<string>(bearMascot);

  useEffect(() => {
    // Try to load optional assets
    const tryLoad = (src: string, setter: (s: string) => void) => {
      const img = new Image();
      img.onload = () => setter(src);
      img.src = src;
    };
    tryLoad('/src/assets/bg-portrait.jpg', setPortraitBg);
    tryLoad('/src/assets/bg-landscape.jpg', setLandscapeBg);
    tryLoad('/src/assets/char.png', setCharImg);
  }, []);

  // Fetch tarot JSON
  useEffect(() => {
    fetch(GIST_URL)
      .then((r) => r.json())
      .then((d: TarotData) => setTarotData(d))
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, []);

  // Draw + call AI
  const startReading = useCallback(async () => {
    if (!tarotData || uses <= 0) return;
    setLoading(true);
    setStarted(true);
    setSegments([]);
    setSegIdx(0);

    const keys = Object.keys(tarotData.cards);
    const drawn = tarotData.cards[keys[Math.floor(Math.random() * keys.length)]];
    setCard(drawn);

    const newUses = uses - 1;
    setUses(newUses);
    localStorage.setItem(USES_KEY, String(newUses));

    try {
      const { data, error } = await supabase.functions.invoke('fortune-test', {
        body: {
          question: null,
          cardName: drawn.name,
          meaning: drawn.meaning,
          prediction: drawn.prediction,
        },
      });
      if (error) throw error;
      const text: string = data.fortune ?? drawn.prediction;
      setSegments(splitSegments(text));
    } catch {
      setSegments(splitSegments(drawn.prediction));
    } finally {
      setLoading(false);
    }
  }, [tarotData, uses]);

  const reset = useCallback(() => {
    setStarted(false);
    setCard(null);
    setSegments([]);
    setSegIdx(0);
  }, []);

  const currentText = segments[segIdx] ?? '';
  const isLast = segIdx >= segments.length - 1;

  // ── Typewriter for current segment ──────────────────────────────────────────
  const { displayed, done, skip } = useTypewriter(currentText, segments.length > 0 && !loading);

  const handleDialogClick = () => {
    if (!done) { skip(); return; }
    if (!isLast) setSegIdx((i) => i + 1);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e]"
      style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
    >
      {/* BGM placeholder */}
      <audio id="bgm" loop />

      {/* Background images */}
      <style>{`
        @media (orientation: portrait) {
          .vn-bg { background-image: ${portraitBg ? `url(${portraitBg})` : 'none'}; }
        }
        @media (orientation: landscape) {
          .vn-bg { background-image: ${landscapeBg ? `url(${landscapeBg})` : 'none'}; }
        }
      `}</style>
      <div className="vn-bg absolute inset-0 bg-cover bg-center opacity-30" />

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map((s) => (
          <motion.div
            key={s.id}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{ left: `${s.left}%`, top: `${s.top}%` }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* ── HUD ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-4">
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl w-9 h-9"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Title */}
        <span className="text-white/80 text-sm font-semibold tracking-wide">🔮 มีดูดวง</span>

        {/* Right: uses + rain */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1">
            <span className="text-sm">🔮</span>
            <span className="text-white text-xs font-bold">{uses}</span>
            <span className="text-white/50 text-xs">ครั้ง</span>
            <button
              onClick={() => {}}
              className="text-violet-300 text-xs font-medium hover:text-violet-200 ml-1"
            >
              + ซื้อเพิ่ม
            </button>
          </div>
          <button
            onClick={toggleRain}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${rainOn ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/50'}`}
          >
            <CloudRain className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── PORTRAIT layout ── */}
      <div className="absolute inset-0 flex flex-col landscape:hidden">
        {/* Character — top half */}
        <div className="flex-1 flex items-end justify-center pb-4 pt-16">
          <motion.img
            src={charImg}
            alt="character"
            className="h-[45vh] max-h-80 object-contain drop-shadow-2xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Dialog — bottom */}
        <div className="shrink-0 p-3 pb-6">
          <DialogBox
            loading={loading}
            loadingData={loadingData}
            started={started}
            uses={uses}
            displayed={displayed}
            done={done}
            isLast={isLast}
            card={card}
            onStart={startReading}
            onClick={handleDialogClick}
            onReset={reset}
          />
        </div>
      </div>

      {/* ── LANDSCAPE layout ── */}
      <div className="absolute inset-0 hidden landscape:flex pt-14">
        {/* Character — left */}
        <div className="w-[45%] flex items-end justify-center pb-4">
          <motion.img
            src={charImg}
            alt="character"
            className="h-[75vh] max-h-[500px] object-contain drop-shadow-2xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Dialog — right bottom */}
        <div className="flex-1 flex flex-col justify-end p-4 pb-6">
          <DialogBox
            loading={loading}
            loadingData={loadingData}
            started={started}
            uses={uses}
            displayed={displayed}
            done={done}
            isLast={isLast}
            card={card}
            onStart={startReading}
            onClick={handleDialogClick}
            onReset={reset}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Dialog Box Component ─────────────────────────────────────────────────────
interface DialogBoxProps {
  loading: boolean;
  loadingData: boolean;
  started: boolean;
  uses: number;
  displayed: string;
  done: boolean;
  isLast: boolean;
  card: TarotCard | null;
  onStart: () => void;
  onClick: () => void;
  onReset: () => void;
}

function DialogBox({
  loading, loadingData, started, uses,
  displayed, done, isLast, card,
  onStart, onClick, onReset,
}: DialogBoxProps) {
  return (
    <div
      className="relative w-full rounded-2xl border border-purple-400/30 bg-black/60 backdrop-blur-md p-4 sm:p-5 cursor-pointer select-none"
      onClick={started && !loading ? onClick : undefined}
      style={{ boxShadow: '0 0 30px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' }}
    >
      {/* Name plate */}
      {card && (
        <div className="absolute -top-3 left-4 bg-gradient-to-r from-violet-600 to-purple-700 rounded-full px-3 py-0.5 text-xs text-white font-semibold shadow-lg">
          {card.name}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[80px] flex items-center">
        {!started ? (
          /* Start screen */
          <div className="w-full text-center space-y-3">
            <p className="text-white/70 text-sm">สวัสดีค่ะ~ น้องหมีพร้อมดูดวงให้แล้วนะคะ ✨</p>
            <button
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              disabled={loadingData || uses <= 0}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl px-6 py-2 text-sm font-semibold transition-all gap-2 inline-flex items-center"
            >
              {loadingData ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังโหลด...</>
              ) : uses <= 0 ? (
                '🔮 หมดครั้งแล้วค่ะ'
              ) : (
                '🔮 เริ่มดูดวง'
              )}
            </button>
          </div>
        ) : loading ? (
          /* Loading */
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">น้องหมีกำลังดูดวงให้...</span>
          </div>
        ) : (
          /* Typewriter text */
          <p className="text-white/90 text-sm sm:text-base leading-relaxed w-full">
            {displayed}
            {!done && <span className="animate-pulse text-violet-300">▌</span>}
          </p>
        )}
      </div>

      {/* Footer */}
      {started && !loading && (
        <div className="flex justify-end mt-2">
          {isLast && done ? (
            <button
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-violet-300 hover:text-violet-200 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              🔮 ดูดวงใหม่
            </button>
          ) : done ? (
            <span className="text-white/40 text-xs animate-pulse">แตะเพื่อดูต่อ ▸</span>
          ) : (
            <span className="text-white/30 text-xs">แตะเพื่อข้าม</span>
          )}
        </div>
      )}
    </div>
  );
}
