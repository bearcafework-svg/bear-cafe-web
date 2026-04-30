import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { CloudRain, Music2, VolumeX, LogOut, Send, Loader2, Clock, AlertTriangle, SkipForward, Repeat, Repeat1, ListMusic, X } from 'lucide-react';
import honeyJarIcon from '@/assets/HoneyJarIcon.png';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_alias: string;
  user_b_alias: string;
  user_a_avatar: string;
  user_b_avatar: string;
  status: string;
  duration_seconds: number;
}

interface ChatProfile {
  id: string;
  name: string;
  image_url: string;
}

const SESSION_DURATION = 7 * 60;

// ─── Similar Mood config loader ───────────────────────────────────────────────
interface SimilarMoodConfig {
  enabled: boolean;
  similar_phase_delay_seconds: number;
  map: Record<string, string[]>;
}

async function loadSimilarMoodConfig(): Promise<SimilarMoodConfig> {
  try {
    const { data } = await (supabase as any)
      .from('chat_config')
      .select('value')
      .eq('key', 'similar_mood')
      .maybeSingle();
    if (data?.value) return { enabled: true, similar_phase_delay_seconds: 15, map: {}, ...data.value };
  } catch {}
  return { enabled: false, similar_phase_delay_seconds: 15, map: {} };
}

// Bidirectional check: A→B or B→A
function isSimilarMood(a: string, b: string, map: Record<string, string[]>): boolean {
  return (map[a]?.includes(b) ?? false) || (map[b]?.includes(a) ?? false);
}

// Role compatibility matrix
// talk ↔ listen, both ↔ any, chill ↔ chill|both
function isCompatibleRole(a: string, b: string): boolean {
  if (a === 'both' || b === 'both') return true;
  if (a === 'talk'   && b === 'listen') return true;
  if (a === 'listen' && b === 'talk')   return true;
  if (a === 'chill'  && b === 'chill')  return true;
  return false;
}

// Score a candidate: higher = better match
function matchScore(myTopicId: string, myRole: string, candidate: any, moodConfig: SimilarMoodConfig): number {
  let score = 0;
  if (candidate.topic_id === myTopicId) score += 10;
  else if (moodConfig.enabled && isSimilarMood(myTopicId, candidate.topic_id, moodConfig.map)) score += 5;
  else return -1; // not eligible
  if (isCompatibleRole(myRole ?? 'both', candidate.role ?? 'both')) score += 3;
  return score;
}

function useRainAmbient() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const [on, setOn] = useState(false);

  const start = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (srcRef.current) return;
    const ctx = ctxRef.current;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start();
    srcRef.current = src;
  }, []);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (on) { stop(); setOn(false); } else { start(); setOn(true); }
  }, [on, start, stop]);

  useEffect(() => () => stop(), [stop]);
  return { on, toggle };
}

// ─── Music Player ─────────────────────────────────────────────────────────────
interface Track { title: string; src: string; image_url?: string | null; }
interface MusicCategory { label: string; tracks: Track[]; }

const MUSIC_FALLBACK: MusicCategory[] = [
  {
    label: 'Lo-fi Chill',
    tracks: [
      { title: 'Cozy Rain', src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
      { title: 'Late Night Study', src: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749d4e4.mp3' },
    ],
  },
];

async function loadMusicLibrary(): Promise<MusicCategory[]> {
  try {
    const [catRes, trackRes] = await Promise.all([
      (supabase as any).from('chat_music_categories').select('id, label, sort_order').order('sort_order'),
      (supabase as any).from('chat_music_tracks').select('id, category_id, title, src, image_url, sort_order').order('sort_order'),
    ]);
    const cats: any[] = catRes.data ?? [];
    const allTracks: any[] = trackRes.data ?? [];
    const lib: MusicCategory[] = cats
      .map(c => ({
        label: c.label,
        tracks: allTracks.filter(t => t.category_id === c.id).map(t => ({ title: t.title, src: t.src, image_url: t.image_url ?? null })),
      }))
      .filter(c => c.tracks.length > 0);
    return lib.length > 0 ? lib : MUSIC_FALLBACK;
  } catch {
    return MUSIC_FALLBACK;
  }
}

type LoopMode = 'none' | 'one' | 'all';

function useMusicPlayer(audioRef: React.RefObject<HTMLAudioElement>) {
  const [library, setLibrary] = useState<MusicCategory[]>(MUSIC_FALLBACK);
  const [playing, setPlaying] = useState(false);
  const [catIdx, setCatIdx] = useState(0);
  const [trackIdx, setTrackIdx] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>('all');
  const [progress, setProgress] = useState(0);   // 0–100
  const [duration, setDuration] = useState(0);   // seconds

  // Load library from DB on mount
  useEffect(() => {
    loadMusicLibrary().then(lib => {
      setLibrary(lib);
      setCatIdx(0);
      setTrackIdx(0);
      // Set src immediately so first play works
      const el = audioRef.current;
      if (el && lib[0]?.tracks[0]) {
        el.src = lib[0].tracks[0].src;
      }
    });
  }, []);

  const currentCat = library[Math.min(catIdx, library.length - 1)] ?? MUSIC_FALLBACK[0];
  const currentTrack = currentCat.tracks[Math.min(trackIdx, currentCat.tracks.length - 1)] ?? currentCat.tracks[0];

  // Load track when catIdx, trackIdx, or library changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack?.src) return;
    el.src = currentTrack.src;
    el.loop = loopMode === 'one';
    if (playing) el.play().catch(() => {});
  }, [catIdx, trackIdx, library]);

  // Sync loop attribute
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one';
  }, [loopMode]);

  // Progress tracking
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (el.duration) setProgress((el.currentTime / el.duration) * 100);
    };
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  // Auto-advance on track end
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (loopMode === 'one') return; // handled by loop attr
      if (loopMode === 'all' || trackIdx < currentCat.tracks.length - 1) {
        const next = (trackIdx + 1) % currentCat.tracks.length;
        setTrackIdx(next);
      } else {
        setPlaying(false);
      }
    };
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [loopMode, trackIdx, catIdx]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      // Ensure src is set (in case library loaded after mount)
      if (!el.src || el.src === window.location.href) {
        el.src = currentTrack.src;
      }
      el.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing, currentTrack]);

  // Start playback from outside the hook (e.g. inside a click handler for autoplay unlock).
  // Caller is responsible for calling el.play() directly; this just syncs the state.
  const syncPlayingState = useCallback((isPlaying: boolean) => {
    setPlaying(isPlaying);
  }, []);

  const skipNext = useCallback(() => {
    const next = (trackIdx + 1) % currentCat.tracks.length;
    setTrackIdx(next);
    if (!playing) setPlaying(true);
  }, [trackIdx, currentCat, playing]);

  const selectTrack = useCallback((ci: number, ti: number) => {
    setCatIdx(ci);
    setTrackIdx(ti);
    setPlaying(true);
    const el = audioRef.current;
    if (el) { el.src = library[ci].tracks[ti].src; el.play().catch(() => {}); }
  }, [library]);

  const cycleLoop = useCallback(() => {
    setLoopMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none');
  }, []);

  const seek = useCallback((pct: number) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = (pct / 100) * el.duration;
    setProgress(pct);
  }, []);

  return { playing, toggle, syncPlayingState, skipNext, selectTrack, cycleLoop, loopMode, currentTrack, currentCat, catIdx, trackIdx, library, progress, duration, seek };
}

// ─── Wave Progress Bar ────────────────────────────────────────────────────────
function WaveProgress({ progress, onSeek }: { progress: number; onSeek: (pct: number) => void }) {
  const POINTS = 40;
  const W = 280;
  const H = 28;
  const filled = (progress / 100) * W;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  // Generate stable wave path
  const wavePath = Array.from({ length: POINTS + 1 }, (_, i) => {
    const x = (i / POINTS) * W;
    const amp = 4 + Math.sin(i * 0.9) * 3;
    const y = H / 2 + Math.sin(i * 0.7) * amp;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  function getPct(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  // Mouse events
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    onSeek(getPct(e.clientX));
    const onMove = (ev: MouseEvent) => { if (dragging.current) onSeek(getPct(ev.clientX)); };
    const onUp   = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Touch events
  function onTouchStart(e: React.TouchEvent) {
    dragging.current = true;
    onSeek(getPct(e.touches[0].clientX));
    const onMove = (ev: TouchEvent) => { if (dragging.current) onSeek(getPct(ev.touches[0].clientX)); };
    const onEnd  = () => { dragging.current = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  const thumbX = (progress / 100) * W;

  return (
    <div className="relative w-full px-1 py-1 cursor-pointer select-none" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Background wave */}
        <path d={wavePath} fill="none" stroke="rgba(200,149,108,0.2)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Filled wave (clip to progress) */}
        <clipPath id="wave-clip">
          <rect x="0" y="0" width={filled} height={H} />
        </clipPath>
        <path d={wavePath} fill="none" stroke="#c8956c" strokeWidth="2.5" strokeLinecap="round" clipPath="url(#wave-clip)" />
        {/* HoneyJar thumb */}
        <image
          href={honeyJarIcon}
          x={thumbX - 10}
          y={H / 2 - 10}
          width="20"
          height="20"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))', cursor: 'grab' }}
        />
      </svg>
    </div>
  );
}

// ─── Vinyl Disc ───────────────────────────────────────────────────────────────
function VinylDisc({ imageUrl, playing }: { imageUrl?: string | null; playing: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <motion.div
        animate={{ rotate: playing ? 360 : 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: 'conic-gradient(from 0deg, #2a1a0e, #4a2e1a, #2a1a0e, #3a2410, #2a1a0e)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.4)',
        }}
      >
        {/* Grooves */}
        {[38, 44, 50].map(r => (
          <div key={r} className="absolute rounded-full border border-white/5" style={{ width: r * 2, height: r * 2 }} />
        ))}
        {/* Center image */}
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#c8956c]/40 shadow-inner z-10">
          {imageUrl ? (
            <img src={imageUrl} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#3a2410] to-[#1a0e06] flex items-center justify-center">
              <Music2 className="w-6 h-6 text-[#c8956c]/60" />
            </div>
          )}
        </div>
        {/* Center hole */}
        <div className="absolute w-3 h-3 rounded-full bg-[#1a0e06] border border-[#c8956c]/30 z-20" />
      </motion.div>
    </div>
  );
}

// ─── Music Player Panel ───────────────────────────────────────────────────────
function MusicPanel({
  player, onClose,
}: {
  player: ReturnType<typeof useMusicPlayer>;
  onClose: () => void;
}) {
  const [activeCat, setActiveCat] = useState(player.catIdx);

  function formatTime(sec: number) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const currentSec = player.duration ? (player.progress / 100) * player.duration : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1a0e06] rounded-2xl shadow-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] overflow-hidden z-50"
      onClick={e => e.stopPropagation()}
    >
      {/* Now playing — vinyl + info */}
      <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-[#f5ede4] to-[#faf6f1] dark:from-[#2a1a0e] dark:to-[#1a0e06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <ListMusic className="w-3.5 h-3.5 text-[#c8956c]" />
            <span className="text-xs font-semibold text-[#7c5c3e] dark:text-[#c8956c]">เพลงที่กำลังเล่น</span>
          </div>
          <button onClick={onClose} className="text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vinyl disc */}
        <div className="flex justify-center mb-3">
          <VinylDisc imageUrl={player.currentTrack.image_url} playing={player.playing} />
        </div>

        {/* Track info */}
        <div className="text-center mb-3">
          <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm truncate">{player.currentTrack.title}</p>
          <p className="text-[11px] text-[#9c7c5e] mt-0.5">{player.currentCat.label}</p>
        </div>

        {/* Wave progress */}
        <WaveProgress progress={player.progress} onSeek={player.seek} />
        <div className="flex justify-between text-[10px] text-[#9c7c5e] px-1 -mt-0.5">
          <span>{formatTime(currentSec)}</span>
          <span>{formatTime(player.duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={player.cycleLoop}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              player.loopMode !== 'none' ? 'text-[#c8956c]' : 'text-[#9c7c5e] hover:text-[#7c5c3e]'
            }`}
            title={player.loopMode === 'none' ? 'ไม่วนซ้ำ' : player.loopMode === 'all' ? 'วนซ้ำทั้งหมด' : 'วนซ้ำเพลงนี้'}
          >
            {player.loopMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>

          <button
            onClick={player.toggle}
            className="w-12 h-12 rounded-full bg-[#c8956c] hover:bg-[#b07d58] text-white flex items-center justify-center transition-colors shadow-lg"
          >
            {player.playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={player.skipNext}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors"
            title="เพลงถัดไป"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-[#e8d9c8] dark:border-[#3a2a1e] overflow-x-auto bg-white dark:bg-[#1a0e06]">
        {player.library.map((cat, ci) => (
          <button
            key={ci}
            onClick={() => setActiveCat(ci)}
            className={`shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
              activeCat === ci
                ? 'text-[#c8956c] border-b-2 border-[#c8956c]'
                : 'text-[#9c7c5e] hover:text-[#7c5c3e]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Track list */}
      <div className="max-h-40 overflow-y-auto bg-white dark:bg-[#1a0e06]">
        {player.library[activeCat]?.tracks.map((track, ti) => {
          const isActive = activeCat === player.catIdx && ti === player.trackIdx;
          return (
            <button
              key={ti}
              onClick={() => player.selectTrack(activeCat, ti)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                isActive ? 'bg-[#f5ede4] dark:bg-[#2a1a0e]' : 'hover:bg-[#faf6f1] dark:hover:bg-[#221810]'
              }`}
            >
              {/* Thumbnail or indicator */}
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-[#f0e6d8] dark:bg-[#3a2a1e]">
                {track.image_url ? (
                  <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                ) : isActive && player.playing ? (
                  <motion.div className="flex gap-0.5 items-end h-4">
                    {[0, 0.1, 0.2].map((d, i) => (
                      <motion.div key={i} className="w-0.5 bg-[#c8956c] rounded-full"
                        animate={{ height: ['4px', '12px', '4px'] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                    ))}
                  </motion.div>
                ) : (
                  <svg className={`w-3 h-3 ml-0.5 ${isActive ? 'text-[#c8956c]' : 'text-[#9c7c5e]'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
              <span className={`text-xs truncate ${isActive ? 'font-semibold text-[#4a3728] dark:text-[#e8d9c8]' : 'text-[#7c5c3e] dark:text-[#9c7c5e]'}`}>
                {track.title}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

async function loadBannedWords(): Promise<string[]> {
  const { data } = await supabase.from('banned_words').select('word');
  return (data ?? []).map((r: any) => r.word.toLowerCase());
}

function findBannedWord(text: string, banned: string[]): string | null {
  const lower = text.toLowerCase();
  return banned.find(w => lower.includes(w)) ?? null;
}

function useCountdown(totalSeconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    expiredRef.current = false;
    setRemaining(totalSeconds);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, totalSeconds]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, display: `${mm}:${ss}` };
}

function RatingDialog({ onRate }: { onRate: (stars: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#221810] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-[#e8d9c8] dark:border-[#3a2a1e] text-center space-y-4"
      >
        <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-lg">
          ให้คะแนนการสนทนา
        </p>
        <p className="text-sm text-[#9c7c5e]">
          ประสบการณ์ครั้งนี้เป็นอย่างไรบ้าง?
        </p>
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setSelected(s)}
              className="text-3xl transition-transform hover:scale-110 select-none"
            >
              {s <= (hovered || selected) ? '★' : '☆'}
            </button>
          ))}
        </div>
        <button
          onClick={() => selected > 0 && onRate(selected)}
          disabled={selected === 0}
          className="w-full py-2.5 rounded-xl bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 text-white font-semibold transition-colors"
        >
          ส่งคะแนน
        </button>
        <button
          onClick={() => onRate(0)}
          className="text-xs text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors"
        >
          ข้ามไปก่อน
        </button>
      </motion.div>
    </div>
  );
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────
// Steps 0-2: shown while waiting for match
// Steps 3-4: shown after match
interface TutorialStep {
  refKey: string;
  title: string;
  desc: string;
  tooltipSide: 'below' | 'above';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { refKey: 'rain',  title: 'เสียงฝน',     desc: 'เปิด/ปิดเสียงฝนตกเบาๆ เพื่อบรรยากาศผ่อนคลาย',                                    tooltipSide: 'below' },
  { refKey: 'music', title: 'เพลง BGM',    desc: 'เปิด Music Player เลือกเพลงพื้นหลัง มีแผ่นเสียงหมุนและ progress bar',               tooltipSide: 'below' },
  { refKey: 'leave', title: 'ออกจากโต๊ะ',  desc: 'จบการสนทนาและกลับหน้าหลัก ระบบจะขอให้ให้คะแนนก่อน',                               tooltipSide: 'below' },
  { refKey: 'timer', title: 'นับถอยหลัง',  desc: 'เวลาที่เหลือในการสนทนา (7 นาที) เมื่อเหลือ 1 นาทีจะกะพริบแดง',                    tooltipSide: 'below' },
  { refKey: 'input', title: 'ช่องพิมพ์',   desc: 'พิมพ์ข้อความแล้วกด Enter หรือปุ่มส่ง ระบบจะกรองคำต้องห้ามอัตโนมัติ',              tooltipSide: 'above' },
];

// Ref map passed down from main component
type TutorialRefs = Record<string, React.RefObject<HTMLElement>>;

function TutorialOverlay({
  step, total, onNext, onSkip, refs,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  refs: TutorialRefs;
}) {
  const s = TUTORIAL_STEPS[step];
  const [ringRect, setRingRect] = useState<DOMRect | null>(null);

  // Measure target element on each step change
  useEffect(() => {
    const el = refs[s?.refKey]?.current;
    if (!el) { setRingRect(null); return; }
    const update = () => setRingRect(el.getBoundingClientRect());
    // rAF ensures DOM has painted before first measure
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step, s?.refKey]);

  if (!s) return null;
  const isLast = step === total - 1;

  const PAD = 6; // padding around the highlight ring

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55 pointer-events-auto" onClick={onSkip} />

      {/* Highlight ring — positioned from measured rect */}
      {ringRect && (
        <motion.div
          key={s.refKey}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute pointer-events-none"
          style={{
            zIndex: 61,
            left:   ringRect.left   - PAD,
            top:    ringRect.top    - PAD,
            width:  ringRect.width  + PAD * 2,
            height: ringRect.height + PAD * 2,
            borderRadius: ringRect.height > 40 ? 16 : 9999,
            border: '2px solid #c8956c',
            boxShadow: '0 0 0 4px rgba(200,149,108,0.3)',
          }}
        />
      )}

      {/* Tooltip — positioned relative to ring */}
      {ringRect && (
        <motion.div
          key={`tip-${step}`}
          initial={{ opacity: 0, y: s.tooltipSide === 'below' ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="absolute w-72 bg-white dark:bg-[#221810] rounded-2xl shadow-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] p-4 pointer-events-auto"
          style={{
            zIndex: 62,
            // Place below or above the ring, clamp to viewport
            top: s.tooltipSide === 'below'
              ? Math.min(ringRect.bottom + PAD + 8, window.innerHeight - 200)
              : undefined,
            bottom: s.tooltipSide === 'above'
              ? Math.min(window.innerHeight - ringRect.top + PAD + 8, window.innerHeight - 200)
              : undefined,
            // Align right edge with ring, but keep inside viewport
            right: Math.max(8, window.innerWidth - ringRect.right - PAD),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#c8956c] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {step + 1}
            </div>
            <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm">{s.title}</p>
          </div>
          <p className="text-xs text-[#7c5c3e] dark:text-[#9c7c5e] leading-relaxed mb-4">{s.desc}</p>

          <div className="flex items-center justify-between">
            <button onClick={onSkip} className="text-xs text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors">
              ข้ามทั้งหมด
            </button>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-[#c8956c]' : 'w-1.5 bg-[#e8d9c8]'}`} />
                ))}
              </div>
              <button
                onClick={onNext}
                className="px-4 py-1.5 rounded-xl bg-[#c8956c] hover:bg-[#b07d58] text-white text-xs font-semibold transition-colors"
              >
                {isLast ? 'เสร็จแล้ว' : 'ถัดไป'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function SecretChatRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { on: rainOn, toggle: toggleRain } = useRainAmbient();

  const bgmRef = useRef<HTMLAudioElement>(null);
  const player = useMusicPlayer(bgmRef);
  const [showMusicPanel, setShowMusicPanel] = useState(false);

  const { topicId, topicName, alias, avatar, role } = (location.state as any) ?? {};

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'waiting' | 'matched' | 'ended'>('waiting');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [bannedWarning, setBannedWarning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  // Similar mood config + phase tracking
  const [moodConfig, setMoodConfig] = useState<SimilarMoodConfig>({ enabled: false, similar_phase_delay_seconds: 15, map: {} });
  const matchStartRef = useRef<number>(Date.now());

  // Tutorial state — show once per session, stored in localStorage
  const TUTORIAL_KEY = 'cafe_room_tutorial_done';
  const [tutorialStep, setTutorialStep] = useState<number>(() =>
    localStorage.getItem(TUTORIAL_KEY) ? -1 : 0
  );
  const skipTutorial = () => { setTutorialStep(-1); localStorage.setItem(TUTORIAL_KEY, '1'); };
  const nextTutorial = () => {
    const next = tutorialStep + 1;
    if (next >= TUTORIAL_STEPS.length) { skipTutorial(); } else { setTutorialStep(next); }
  };

  // Refs for tutorial highlight — typed correctly so React attaches them
  const rainRef  = useRef<HTMLButtonElement>(null);
  const musicRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  // "Join Table" overlay — shown when a match is found, dismissed by user click.
  // The click IS a user gesture, so audio play is allowed by the browser.
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  // isRoomReady: true only after the user has dismissed the join overlay,
  // guaranteeing all room UI elements (timer, input) are fully mounted.
  const [isRoomReady, setIsRoomReady] = useState(false);

  // Stable object — only recreated if refs themselves change (they don't)
  const tutorialRefs = useMemo<TutorialRefs>(() => ({
    rain:  rainRef  as React.RefObject<HTMLElement>,
    music: musicRef as React.RefObject<HTMLElement>,
    leave: leaveRef as React.RefObject<HTMLElement>,
    timer: timerRef as React.RefObject<HTMLElement>,
    input: inputRef as React.RefObject<HTMLElement>,
  }), []);

  // Advance tutorial to post-match steps ONLY after isRoomReady is true.
  // This guarantees the timer and input elements are fully mounted and painted
  // before TutorialOverlay tries to measure their DOMRects.
  useEffect(() => {
    if (isRoomReady && tutorialStep >= 0 && tutorialStep < 3) {
      // Give one extra frame for the room UI to finish painting
      const raf = requestAnimationFrame(() => setTutorialStep(3));
      return () => cancelAnimationFrame(raf);
    }
  }, [isRoomReady, tutorialStep]);

  // Show the join overlay as soon as a match is found
  useEffect(() => {
    if (matchStatus === 'matched' && !isRoomReady) {
      setShowJoinOverlay(true);
    }
  }, [matchStatus, isRoomReady]);

  // Called when the user clicks "เข้าร่วมโต๊ะ" — direct user gesture → audio allowed
  const handleJoinTable = useCallback(() => {
    setShowJoinOverlay(false);
    setIsRoomReady(true);
    // Start music immediately inside the click handler (user gesture context)
    const el = bgmRef.current;
    if (el && player.currentTrack?.src) {
      if (!el.src || el.src === window.location.href) {
        el.src = player.currentTrack.src;
      }
      el.play()
        .then(() => player.syncPlayingState(true))
        .catch(() => {});
    }
  }, [player.currentTrack?.src, player.syncPlayingState]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!topicId || !alias) navigate('/secret-chat');
  }, [topicId, alias, navigate]);

  useEffect(() => {
    loadBannedWords().then(setBannedWords);
    loadSimilarMoodConfig().then(setMoodConfig);
    (supabase as any)
      .from('chat_profiles')
      .select('id, name, image_url')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }: any) => setProfiles(data ?? []));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleExpire = useCallback(async () => {
    if (!session) return;
    await (supabase as any)
      .from('chat_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id);
    setMatchStatus('ended');
    setShowRating(true);
  }, [session]);

  // Countdown only starts after the user has joined (isRoomReady), so the timer
  // doesn't tick away while the join overlay is displayed.
  const { remaining, display: countdownDisplay } = useCountdown(
    SESSION_DURATION,
    isRoomReady && matchStatus === 'matched',
    handleExpire,
  );
  const isUrgent = remaining <= 60 && remaining > 0;

  useEffect(() => {
    if (!user || !topicId || matchStatus !== 'waiting') return;

    // Record when we started waiting (for similar-phase delay)
    matchStartRef.current = Date.now();

    const tryMatch = async () => {
      const elapsedSeconds = (Date.now() - matchStartRef.current) / 1000;
      const inSimilarPhase = moodConfig.enabled && elapsedSeconds >= moodConfig.similar_phase_delay_seconds;

      let query = (supabase as any)
        .from('chat_queue')
        .select('*')
        .neq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(20);

      if (!inSimilarPhase) {
        query = query.eq('topic_id', topicId);
      }

      const { data: queue } = await query;
      if (!queue || queue.length === 0) return;

      // Find best candidate using score
      let best: any = null;
      let bestScore = -1;
      for (const candidate of queue) {
        const score = matchScore(topicId, role ?? 'both', candidate, moodConfig);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }

      if (!best || bestScore < 0) return;
      const partner = best;

      const { data: sess, error } = await (supabase as any)
        .from('chat_sessions')
        .insert({
          topic_id: topicId,
          user_a_id: user.id,
          user_b_id: partner.user_id,
          user_a_alias: alias,
          user_b_alias: partner.alias,
          user_a_avatar: avatar,
          user_b_avatar: partner.avatar,
          user_a_role: role ?? 'both',
          user_b_role: partner.role ?? 'both',
          duration_seconds: SESSION_DURATION,
        })
        .select()
        .single();

      if (error || !sess) return;

      await Promise.all([
        (supabase as any).from('chat_queue').delete().eq('user_id', user.id),
        (supabase as any).from('chat_queue').delete().eq('user_id', partner.user_id),
      ]);
      setSession(sess);
      setMatchStatus('matched');
    };

    const interval = setInterval(tryMatch, 2000);

    const queueChannel = supabase
      .channel(`queue-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_b_id=eq.${user.id}`,
      }, async (payload) => {
        await (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
        setSession(payload.new as ChatSession);
        setMatchStatus('matched');
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(queueChannel);
      (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
    };
  }, [user, topicId, alias, avatar, matchStatus, moodConfig]);

  useEffect(() => {
    if (!session || !user) return;

    (supabase as any)
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
      .then(({ data }: any) => setMessages(data ?? []));

    const ch = supabase
      .channel(`chat-room-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_sessions',
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        const updated = payload.new as ChatSession;
        setSession(updated);
        if (updated.status === 'ended') {
          setMatchStatus('ended');
          setShowRating(true);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id !== user.id) {
          setPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 2500);
        }
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [session?.id, user?.id]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !session || !user || sending) return;

    const foundWord = findBannedWord(input, bannedWords);
    if (foundWord) {
      await (supabase as any).from('chat_violations').insert({
        session_id: session.id,
        user_id: user.id,
        word: foundWord,
        message: input.trim(),
      });
      setBannedWarning(foundWord);
      setTimeout(() => setBannedWarning(null), 4000);
      setInput('');
      return;
    }

    setSending(true);
    const content = input.trim();
    setInput('');
    await (supabase as any).from('chat_messages').insert({
      session_id: session.id,
      sender_id: user.id,
      content,
    });
    setSending(false);
  }, [input, session, user, sending, bannedWords]);

  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (channelRef.current && session) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user?.id },
      });
    }
  }, [session, user?.id]);

  const leaveTable = useCallback(async () => {
    if (session) {
      // Has matched — end session and show rating
      await (supabase as any)
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id);
      setMatchStatus('ended');
      setShowRating(true);
    } else {
      // Still waiting — just remove from queue, no rating
      await (supabase as any).from('chat_queue').delete().eq('user_id', user?.id);
      navigate('/');
    }
  }, [session, user?.id, navigate]);

  const submitRating = useCallback(async (stars: number) => {
    setShowRating(false);
    if (stars > 0 && session && user) {
      const partnerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id;
      await (supabase as any).from('chat_ratings').insert({
        session_id: session.id,
        rater_id: user.id,
        rated_id: partnerId,
        stars,
      });
    }
    navigate('/');
  }, [session, user, navigate]);

  const myAlias = session
    ? (session.user_a_id === user?.id ? session.user_a_alias : session.user_b_alias)
    : alias;
  const partnerAlias = session
    ? (session.user_a_id === user?.id ? session.user_b_alias : session.user_a_alias)
    : '...';
  const partnerAvatarKey = session
    ? (session.user_a_id === user?.id ? session.user_b_avatar : session.user_a_avatar)
    : '';

  const getAvatarImg = (key: string) => profiles.find(p => p.id === key)?.image_url ?? null;
  const partnerImg = getAvatarImg(partnerAvatarKey);

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#faf6f1] dark:bg-[#1a1410] overflow-hidden">
      <audio ref={bgmRef} />

      {/* Join Table overlay — shown on match, dismissed by user click to unlock AudioContext */}
      <AnimatePresence>
        {showJoinOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-white dark:bg-[#221810] rounded-3xl p-8 max-w-xs w-full mx-4 shadow-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] text-center space-y-5"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-4xl mx-auto shadow-lg"
              >
                ☕
              </motion.div>
              <div className="space-y-1.5">
                <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-xl">จับคู่สำเร็จแล้ว!</p>
                <p className="text-sm text-[#9c7c5e] leading-relaxed">
                  พบคู่สนทนาแล้ว กดเพื่อเข้าร่วมโต๊ะ
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleJoinTable}
                className="w-full h-12 rounded-2xl bg-[#c8956c] hover:bg-[#b07d58] text-white font-bold text-base transition-colors shadow-lg"
              >
                เข้าร่วมโต๊ะ
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial overlay */}
      <AnimatePresence>
        {tutorialStep >= 0 && (
          <TutorialOverlay
            step={tutorialStep}
            total={TUTORIAL_STEPS.length}
            onNext={nextTutorial}
            onSkip={skipTutorial}
            refs={tutorialRefs}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bannedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            ข้อความถูกบล็อก — พบคำต้องห้าม
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-b border-[#e8d9c8] dark:border-[#3a2a1e] z-20">
        <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {matchStatus === 'matched' && session ? (
              <>
                <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-[#e8d9c8] dark:ring-[#3a2a1e]">
                  {partnerImg
                    ? <img src={partnerImg} alt={partnerAlias} className="w-full h-full object-cover" />
                    : <span className="text-lg">🐻</span>}
                </div>
                <div>
                  <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm leading-tight">{partnerAlias}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <p className="text-[11px] text-[#9c7c5e]">{topicName}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-base shrink-0">
                  ☕
                </div>
                <div>
                  <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm">คาเฟ่ลับ</p>
                  <p className="text-[11px] text-[#9c7c5e]">{topicName}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {matchStatus === 'matched' && (
              <div
                ref={timerRef}
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1.5 rounded-full border transition-colors ${
                isUrgent
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
                  : 'bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] border-[#e8d9c8] dark:border-[#4a3728]'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {countdownDisplay}
              </div>
            )}

            <button onClick={toggleRain}
              ref={rainRef}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${rainOn ? 'bg-sky-100 text-sky-500 border-sky-200' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'}`}>
              <CloudRain className="w-4 h-4" />
            </button>

            {/* Music player button + panel */}
            <div className="relative">
              <button
                onClick={() => setShowMusicPanel(v => !v)}
                ref={musicRef}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${
                  player.playing ? 'bg-violet-100 text-violet-600 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'
                }`}
                title="เพลง"
              >
                {player.playing ? <Music2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showMusicPanel && (
                  <MusicPanel player={player} onClose={() => setShowMusicPanel(false)} />
                )}
              </AnimatePresence>
            </div>

            <button onClick={leaveTable}
              ref={leaveRef}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9c7c5e] hover:text-red-500 border border-[#e8d9c8] hover:border-red-300 transition-all" title="ออกจากโต๊ะ">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-5 space-y-4">
        {matchStatus === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center px-6">
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-28 h-28 rounded-3xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-6xl shadow-xl"
            >
              ☕
            </motion.div>
            <div className="space-y-2">
              <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-xl">กำลังหาคู่สนทนา...</p>
              <p className="text-sm text-[#9c7c5e] leading-relaxed">
                รอสักครู่ กำลังจับคู่ในหัวข้อ{' '}
                <span className="font-semibold text-[#7c5c3e] dark:text-[#c8956c]">{topicName}</span>
              </p>
              {moodConfig.enabled && (
                <p className="text-xs text-[#c8b09a]">
                  หากรอนาน {moodConfig.similar_phase_delay_seconds} วินาที จะขยายการจับคู่ไปยัง mood ใกล้เคียง
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.div key={i} className="w-3 h-3 rounded-full bg-[#c8956c]"
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </div>
        )}

        {matchStatus === 'matched' && messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-6">
            <div className="bg-[#f0e6d8] dark:bg-[#3a2a1e] rounded-2xl px-5 py-3 text-center max-w-xs">
              <p className="text-sm font-semibold text-[#7c5c3e] dark:text-[#c8956c]">จับคู่สำเร็จแล้ว</p>
              <p className="text-xs text-[#9c7c5e] mt-1">มีเวลา {Math.floor(SESSION_DURATION / 60)} นาที เริ่มสนทนาได้เลย</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-3 ${isMyMessage(msg) ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isMyMessage(msg) && (
                <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 self-end shadow-sm">
                  {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
                </div>
              )}
              <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 flex flex-col ${isMyMessage(msg) ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[#9c7c5e] px-1 font-medium">
                  {isMyMessage(msg) ? myAlias : partnerAlias}
                </span>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMyMessage(msg)
                    ? 'bg-[#c8956c] text-white rounded-br-sm'
                    : 'bg-white dark:bg-[#2a1e14] text-[#4a3728] dark:text-[#e8d9c8] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {partnerTyping && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 items-end">
            <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
              {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
            </div>
            <div className="bg-white dark:bg-[#2a1e14] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-2xl rounded-bl-sm px-5 py-3.5 flex gap-1.5 items-center shadow-sm">
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-[#c8b09a]"
                  animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay }} />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {matchStatus === 'matched' && (
        <div className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-t border-[#e8d9c8] dark:border-[#3a2a1e] px-3 sm:px-5 py-3">
          <div className="flex gap-2 items-end max-w-4xl mx-auto">
            <div
              ref={inputRef}
              className="flex-1 bg-white dark:bg-[#221810] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-xl px-3.5 py-2.5 focus-within:border-[#c8956c] focus-within:shadow-sm transition-all"
            >
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="พิมพ์ข้อความ..."
                rows={1}
                className="w-full bg-transparent text-sm text-[#4a3728] dark:text-[#e8d9c8] placeholder:text-[#c8b09a] resize-none outline-none leading-relaxed"
                style={{ maxHeight: 100 }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 flex items-center justify-center text-white transition-all shrink-0 shadow-md"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>
      )}

      {showRating && <RatingDialog onRate={submitRating} />}
    </div>
  );
}
