import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useTheme } from 'next-themes';
import { supabase, supabaseConfig } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { CloudRain, Music2, VolumeX, LogOut, Send, Loader2, Clock, AlertTriangle, SkipForward, SkipBack, Repeat, Repeat1, X, Sun, Moon, Library, Search, ChevronLeft } from 'lucide-react';
import honeyJarIcon from '@/assets/HoneyJarIcon.png';
import pixelCoffeeIcon from '@/assets/pixel-coffee.gif';
import bearMascotIcon from '@/assets/bear-mascot.png';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_system?: boolean;
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
  user_a_role: string;
  user_b_role: string;
  status: string;
  duration_seconds: number;
  started_at: string | null;
  created_at: string;
}

interface ChatProfile {
  id: string;
  name: string;
  image_url: string;
}

const SESSION_DURATION = 7 * 60;

// --- Similar Mood config loader -----------------------------------------------
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

// Bidirectional check: A?B or B?A
function isSimilarMood(a: string, b: string, map: Record<string, string[]>): boolean {
  return (map[a]?.includes(b) ?? false) || (map[b]?.includes(a) ?? false);
}

// Role compatibility matrix
// talk ? listen, both ? any, chill ? chill|both
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [volume, setVolumeState] = useState(0.5);

  useEffect(() => {
    const el = new Audio('/RainSounds.mp3');
    el.loop = true;
    el.volume = 0.5;
    el.preload = 'auto';
    audioRef.current = el;
    return () => { el.pause(); el.src = ''; };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (on) {
      el.pause();
      setOn(false);
    } else {
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
      setOn(true);
    }
  }, [on]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  return { on, toggle, volume, setVolume };
}

// --- Music Player -------------------------------------------------------------
interface Track { title: string; src: string; image_url?: string | null; artist?: string | null; }
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
      (supabase as any).from('chat_music_tracks').select('id, category_id, title, src, image_url, artist, sort_order').order('sort_order'),
    ]);
    const cats: any[] = catRes.data ?? [];
    const allTracks: any[] = trackRes.data ?? [];
    const lib: MusicCategory[] = cats
      .map(c => ({
        label: c.label,
        tracks: allTracks.filter(t => t.category_id === c.id).map(t => ({ title: t.title, src: t.src, image_url: t.image_url ?? null, artist: t.artist ?? null })),
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
  const [progress, setProgress] = useState(0);   // 0�100
  const [duration, setDuration] = useState(0);   // seconds
  const [volume, setVolumeState] = useState(0.8); // 0�1

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
  const currentTrack = (currentCat?.tracks?.length ?? 0) > 0
    ? (currentCat.tracks[Math.min(trackIdx, currentCat.tracks.length - 1)] ?? currentCat.tracks[0])
    : ({ title: '', src: '', image_url: null, artist: null } as Track);

  // Load track when catIdx, trackIdx, or library changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack?.src) return;
    el.preload = 'auto';
    el.src = currentTrack.src;
    el.loop = loopMode === 'one';
    if (playing) {
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
    }
  }, [catIdx, trackIdx, library]);

  // Sync loop attribute
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one';
  }, [loopMode]);

  // Progress tracking � kept for auto-advance logic only (not displayed)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener('loadedmetadata', onMeta);
    return () => el.removeEventListener('loadedmetadata', onMeta);
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
      if (!el.src || el.src === window.location.href) {
        if (currentTrack?.src) el.src = currentTrack.src;
      }
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
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

  const skipPrev = useCallback(() => {
    const prev = (trackIdx - 1 + currentCat.tracks.length) % currentCat.tracks.length;
    setTrackIdx(prev);
    if (!playing) setPlaying(true);
  }, [trackIdx, currentCat, playing]);

  const selectTrack = useCallback((ci: number, ti: number) => {
    setCatIdx(ci);
    setTrackIdx(ti);
    setPlaying(true);
    const el = audioRef.current;
    if (el) {
      el.src = library[ci].tracks[ti].src;
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
    }
  }, [library]);

  const cycleLoop = useCallback(() => {
    setLoopMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none');
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  // Sync volume on mount / audio element change
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, []);

  return { playing, toggle, syncPlayingState, skipNext, skipPrev, selectTrack, cycleLoop, loopMode, currentTrack, currentCat, catIdx, trackIdx, library, volume, setVolume };
}

// --- Bar Waveform Visualizer --------------------------------------------------
const BAR_COUNT = 18; // reduced from 28 � fewer bars = less GPU work on mobile
const BAR_SEEDS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  duration: 0.8 + ((i * 137 + 31) % 9) * 0.1,
  delay:    ((i * 53  + 17) % 11) * 0.06,
  maxH:     16 + ((i * 79  + 11) % 20),
  minH:     3  + ((i * 43  +  7) % 5),
}));

const BarWaveform = memo(({ playing }: { playing: boolean }) => (
  <div className="flex items-end justify-center gap-[3px] px-2" style={{ height: 44 }}>
    {BAR_SEEDS.map((s, i) => (
      <motion.div
        key={i}
        className="rounded-full"
        initial={{ height: s.maxH, scaleY: 0.15, originY: 1 }}
        animate={playing
          ? { scaleY: [s.minH / s.maxH, 1, (s.minH / s.maxH) * 1.3, 0.7, s.minH / s.maxH] }
          : { scaleY: 0.15 }
        }
        transition={playing
          ? { duration: s.duration, repeat: Infinity, ease: 'easeInOut', delay: s.delay, repeatType: 'mirror' }
          : { duration: 0.5, ease: 'easeOut' }
        }
        style={{
          height: s.maxH,
          width: 3,
          originY: 1,
          willChange: 'transform',
          background: playing ? 'linear-gradient(to top, hsl(var(--primary)), hsl(var(--honey)))' : 'hsl(var(--border))',
        }}
      />
    ))}
  </div>
));

// --- Volume Slider ------------------------------------------------------------
function VolumeSlider({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const pct = Math.round(volume * 100);
  const isMuted = volume === 0;
  const prevVolRef = useRef(volume > 0 ? volume : 0.8);

  function toggleMute() {
    if (volume > 0) { prevVolRef.current = volume; onChange(0); }
    else onChange(prevVolRef.current);
  }

  return (
    <div
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl dark:bg-black/20"
      style={{ background: 'hsl(var(--latte) / 0.5)', border: '1px solid hsl(var(--border))' }}
    >
      <button
        onClick={toggleMute}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-[hsl(var(--primary))] transition-colors"
        title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
      >
        {isMuted ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3.5-3.5M12 18l3.5-3.5M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      <div className="relative flex-1 flex items-center" style={{ height: 32 }}>
        <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
            {/* Use CSS width directly — no spring animation on layout property */}
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{ width: `${pct}%`, background: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--honey)))' }}
            />
          </div>
        </div>
        <input
          type="range" min={0} max={100} step={1} value={pct}
          onChange={e => onChange(Number(e.target.value) / 100)}
          className="vol-slider w-full relative z-10"
          style={{ '--fill': `${pct}%`, opacity: 0, cursor: 'pointer', height: 32 } as React.CSSProperties}
        />
        <img
          src={honeyJarIcon} alt="" draggable={false}
          style={{
            position: 'absolute', left: `calc(${pct}% - 12px)`, top: '50%',
            transform: 'translateY(-50%)', width: 24, height: 24,
            pointerEvents: 'none', userSelect: 'none', zIndex: 20,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          }}
        />
      </div>

      <span className="shrink-0 text-[10px] font-mono text-muted-foreground/60 tabular-nums w-6 text-right">
        {isMuted ? '�' : `${pct}`}
      </span>
    </div>
  );
}


// --- Vinyl Disc (small, header) -----------------------------------------------
const VinylDisc = memo(({ imageUrl, playing }: { imageUrl?: string | null; playing: boolean }) => (
  <div className="relative flex items-center justify-center">
    <motion.div
      animate={{ rotate: playing ? 360 : 0 }}
      transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
      style={{
        willChange: 'transform',
        background: 'conic-gradient(from 0deg, #1e1008, #3a2410, #1e1008, #2a1a0e, #4a2e1a, #1e1008)',
        boxShadow: playing
          ? '0 0 0 3px rgba(200,149,108,0.15), 0 0 28px rgba(200,149,108,0.45), 0 6px 24px rgba(0,0,0,0.55)'
          : '0 4px 20px rgba(0,0,0,0.45)',
      }}
    >
      {[36, 42, 48].map(r => (
        <div key={r} className="absolute rounded-full border border-white/[0.05]" style={{ width: r * 2, height: r * 2 }} />
      ))}
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 45%)' }} />
      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-[hsl(var(--primary)/0.35)] shadow-inner z-10">
        {imageUrl ? (
          <img src={imageUrl} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#3a2410] to-[#1a0e06] flex items-center justify-center">
            <Music2 className="w-6 h-6 text-[hsl(var(--primary)/0.5)]" />
          </div>
        )}
      </div>
      <div className="absolute w-3.5 h-3.5 rounded-full bg-[hsl(var(--mocha))] border-2 border-[hsl(var(--primary)/0.35)] z-20" />
    </motion.div>
  </div>
));

// --- Desktop Trigger Button ---------------------------------------------------
const MusicTriggerButton = memo(({ playing, onClick }: { playing: boolean; onClick: () => void }) => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
  <motion.button
    onClick={onClick}
    initial={{ x: -8, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: -8, opacity: 0 }}
    whileHover={{ x: 3 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }}
    className="fixed left-0 flex flex-col items-center justify-center gap-2 py-5 px-2.5 rounded-r-3xl select-none"
    style={{
      top: 'calc(80px + env(safe-area-inset-top, 0px))',
      zIndex: 50,
      willChange: 'transform',
      background: dark ? 'hsl(var(--mocha) / 0.92)' : 'hsl(var(--cream) / 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: dark ? '4px 0 20px rgba(0,0,0,0.4)' : '4px 0 20px rgba(0,0,0,0.12)',
      border: '1px solid rgba(200,149,108,0.25)',
      borderLeft: 'none',
    }}
    title="เปิด Music Player"
  >
    <motion.div
      animate={playing ? { rotate: 360 } : { rotate: 0 }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      className="w-8 h-8 rounded-full flex items-center justify-center relative"
      style={{
        willChange: 'transform',
        background: 'conic-gradient(from 0deg, #1a0e06, #3a2410, #1a0e06, #2a1a0e, #3a2410, #1a0e06)',
        boxShadow: playing ? '0 0 12px rgba(200,149,108,0.5)' : '0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <div className="w-3.5 h-3.5 rounded-full border border-[hsl(var(--primary)/0.4)] z-10 bg-gradient-to-br from-[hsl(var(--mocha))] to-[hsl(var(--coffee))]" />
      <div className="absolute w-2 h-2 rounded-full bg-[hsl(var(--mocha))] border border-[hsl(var(--primary)/0.3)] z-20" />
    </motion.div>
    {playing && (
      <div className="flex flex-col gap-[3px] items-center">
        {[0, 0.15, 0.3].map((d, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full"
            style={{ background: dark ? 'hsl(var(--honey))' : 'hsl(var(--primary))', height: 8, originY: 0.5, willChange: 'transform' }}
            initial={{ height: 8, scaleY: 0.375, originY: 0.5 }}
            animate={{ scaleY: [0.375, 1, 0.375] }}
            transition={{ duration: 0.55, repeat: Infinity, delay: d, ease: 'easeInOut' }}
          />
        ))}
      </div>
    )}
    <span
      className="text-[9px] font-bold"
      style={{ color: dark ? 'hsl(var(--bear-brown))' : 'hsl(var(--bear-brown))', writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.15em' }}
    >
      MUSIC
    </span>
  </motion.button>
  );
});

// --- Music Drawer (Left Slide-in) --------------------------------------------
const MusicPanel = memo(function MusicPanel({
  player, onClose, perfMode, onTogglePerfMode, rainOn, onToggleRain, rainVolume, onRainVolume,
}: {
  player: ReturnType<typeof useMusicPlayer>;
  onClose: () => void;
  perfMode: boolean;
  onTogglePerfMode: () => void;
  rainOn: boolean;
  onToggleRain: () => void;
  rainVolume: number;
  onRainVolume: (v: number) => void;
}) {
  const [view, setView] = useState<'player' | 'library'>('player');
  const [searchQuery, setSearchQuery] = useState('');
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  // -- theme-aware color tokens (Bear Cafe design system) ------------------
  const panelBg      = dark ? 'hsl(var(--mocha) / 0.96)'    : 'hsl(var(--cream) / 0.94)';
  const miniBarBg    = dark ? 'hsl(var(--mocha) / 0.97)'    : 'hsl(var(--cream) / 0.95)';
  const miniBarBorder= dark ? 'hsl(var(--coffee) / 0.5)'    : 'hsl(var(--latte) / 0.6)';
  const searchBg     = dark ? 'hsl(var(--coffee) / 0.5)'    : 'hsl(var(--latte) / 0.5)';
  const trackActiveBg= dark ? 'hsl(var(--coffee))'          : 'hsl(var(--latte))';
  const trackHoverBg = dark ? 'hsl(var(--coffee) / 0.6)'    : 'hsl(var(--latte) / 0.6)';
  const thumbBg      = dark ? 'hsl(var(--coffee))'          : 'hsl(var(--latte))';
  const volBg        = dark ? 'hsl(var(--coffee) / 0.5)'    : 'hsl(var(--latte) / 0.4)';
  const textPrimary  = dark ? 'hsl(var(--foreground))'      : 'hsl(var(--foreground))';
  const textSecondary= dark ? 'hsl(var(--bear-brown))'      : 'hsl(var(--bear-brown))';
  const textAccent   = dark ? 'hsl(var(--honey))'           : 'hsl(var(--primary))';
  const textMuted    = dark ? 'hsl(var(--muted-foreground))': 'hsl(var(--muted-foreground))';
  const borderAccent = dark ? 'hsl(var(--coffee) / 0.5)'    : 'hsl(var(--latte) / 0.6)';

  // useMotionValue for drag � position updates bypass React reconciler entirely
  const x = useMotionValue(0);
  // Reduce blur to 4px while dragging � derived from x, no setState needed
  const blurAmount = useTransform(x, [0, 60], [16, 4]);
  const backdropBlur = useTransform(blurAmount, v => `blur(${Math.round(v)}px)`);

  const allTracks = useMemo(() => {
    const result: Array<{ track: Track; catIdx: number; trackIdx: number; catLabel: string }> = [];
    player.library.forEach((cat, ci) => {
      cat.tracks.forEach((t, ti) => result.push({ track: t, catIdx: ci, trackIdx: ti, catLabel: cat.label }));
    });
    return result;
  }, [player.library]);

  const filteredAll = useMemo(() => {
    if (!searchQuery.trim()) return allTracks;
    const q = searchQuery.toLowerCase();
    return allTracks.filter(({ track }) =>
      track.title.toLowerCase().includes(q) || (track.artist ?? '').toLowerCase().includes(q)
    );
  }, [allTracks, searchQuery]);

  return (
    <>
      {/* Grain overlay � desktop only, hidden on mobile to save GPU */}
      <div
        className="fixed inset-0 pointer-events-none hidden md:block"
        style={{
          zIndex: 997,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.5,
        }}
      />

      {/* Drawer � useMotionValue drag bypasses React reconciler, transform-only, contained */}
      <motion.div
        key="music-panel"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.08 }}
        dragMomentum={false}
        style={{
          x,
          zIndex: 999,
          willChange: 'transform',
          touchAction: 'pan-y',
          contain: 'layout paint size',
          backdropFilter: perfMode ? 'none' : backdropBlur,
          WebkitBackdropFilter: perfMode ? 'none' : backdropBlur,
          background: perfMode
            ? (dark ? 'hsl(var(--mocha))' : 'hsl(var(--cream))')
            : panelBg,
          boxShadow: dark ? '8px 0 32px rgba(0,0,0,0.5)' : '8px 0 32px rgba(0,0,0,0.2)',
          borderRight: `1px solid ${borderAccent}`,
        }}
        onDragStart={() => { /* blur handled by useTransform(x) */ }}
        onDrag={(_, info) => {
          // Snap to integer pixels � eliminates subpixel rendering jitter
          const snapped = Math.round(info.offset.x);
          if (snapped !== Math.round(x.get())) x.set(snapped);
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80 || info.velocity.x > 500) {
            // Animate out before calling onClose so exit animation plays
            animate(x, window.innerWidth, {
              type: 'spring', stiffness: 320, damping: 32, mass: 0.7,
              onComplete: onClose,
            });
          } else {
            // Snap back to 0
            animate(x, 0, { type: 'spring', stiffness: 320, damping: 32, mass: 0.7 });
          }
        }}
        className="fixed top-0 left-0 h-full w-[85vw] md:w-[25vw] md:min-w-[320px] md:max-w-[390px] flex flex-col select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient top glow */}
        <div className="absolute inset-x-0 top-0 h-32 pointer-events-none z-0 opacity-30"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #fff3e0, transparent 70%)' }} />
        <AnimatePresence mode="wait" initial={false}>
          {view === 'player' ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }}
              className="flex flex-col h-full relative z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <img src={honeyJarIcon} alt="" className="w-5 h-5 object-contain" />
                  <span className="text-sm font-bold" style={{ color: textSecondary }}>เพลงคาเฟ่</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* โหมดประหยัด toggle */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={onTogglePerfMode}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      color: perfMode ? textAccent : textMuted,
                      background: perfMode ? `${textAccent}20` : 'transparent',
                    }}
                    title={perfMode ? 'โหมดประหยัด: เปิดอยู่ (ปิด blur)' : 'โหมดประหยัด: ปิดอยู่ (เปิด blur — อาจช้าบนมือถือ)'}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setView('library')}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ color: textMuted }}
                    title="คลังเพลง"
                  >
                    <Library className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ color: textMuted }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Vinyl hero */}
              <div className="flex justify-center items-center px-6 pt-2 pb-5 shrink-0">
                <VinylDiscLarge imageUrl={player.currentTrack?.image_url} playing={player.playing} />
              </div>

              {/* Song info */}
              <div className="px-6 text-center shrink-0 space-y-1">
                <motion.p
                  key={player.currentTrack?.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold text-lg leading-tight truncate"
                  style={{ color: textPrimary }}
                >
                  {player.currentTrack?.title ?? '—'}
                </motion.p>
                {player.currentTrack?.artist && (
                  <p className="text-sm truncate font-medium" style={{ color: textAccent }}>
                    {player.currentTrack.artist}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <div className="h-px flex-1 max-w-[40px]" style={{ background: `linear-gradient(to right, transparent, ${textAccent}44)` }} />
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: textMuted }}>{player.currentCat?.label ?? ''}</p>
                  <div className="h-px flex-1 max-w-[40px]" style={{ background: `linear-gradient(to left, transparent, ${textAccent}44)` }} />
                </div>
              </div>

              {/* Waveform */}
              <div className="px-5 mt-2 shrink-0">
                <BarWaveform playing={player.playing} />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 mt-4 px-4 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={player.cycleLoop}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
                  style={{
                    color: player.loopMode !== 'none' ? textAccent : textMuted,
                    background: player.loopMode !== 'none' ? (dark ? 'rgba(200,149,108,0.18)' : 'rgba(200,149,108,0.15)') : 'transparent',
                  }}
                  title={player.loopMode === 'none' ? 'เล่นตามลำดับ' : player.loopMode === 'all' ? 'วนซ้ำทั้งหมด' : 'วนซ้ำเพลงนี้'}
                >
                  {player.loopMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={player.skipPrev}
                  className="w-11 h-11 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: textSecondary }}
                >
                  <SkipBack className="w-5 h-5" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={player.toggle}
                  className="w-[68px] h-[68px] rounded-full text-white flex items-center justify-center"
                  style={{
                    willChange: 'transform',
                    background: 'linear-gradient(145deg, #e0b080, #c8956c, #b07d58)',
                    boxShadow: player.playing
                      ? '0 4px 20px rgba(200,149,108,0.5), 0 2px 6px rgba(0,0,0,0.15)'
                      : '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  {player.playing ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="2" />
                      <rect x="14" y="4" width="4" height="16" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={player.skipNext}
                  className="w-11 h-11 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: textSecondary }}
                >
                  <SkipForward className="w-5 h-5" />
                </motion.button>

                {/* Rain toggle — ใช้แทน spacer */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onToggleRain}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-colors text-lg"
                  style={{
                    background: rainOn ? 'rgba(96,165,250,0.18)' : 'transparent',
                    color: rainOn ? '#60a5fa' : textMuted,
                    outline: rainOn ? '1.5px solid rgba(96,165,250,0.4)' : 'none',
                  }}
                  title={rainOn ? 'ปิดเสียงฝน' : 'เปิดเสียงฝน'}
                >
                  🌧️
                </motion.button>
              </div>

              {/* Rain volume slider — แสดงเมื่อเปิดเสียงฝน */}
              <AnimatePresence>
                {rainOn && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 mt-2 shrink-0 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl"
                      style={{ background: dark ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)' }}
                    >
                      <span className="text-base shrink-0">🌧️</span>
                      <div className="relative flex-1 flex items-center" style={{ height: 32 }}>
                        <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(96,165,250,0.15)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${rainVolume * 100}%`, background: 'linear-gradient(to right, #60a5fa, #93c5fd)' }} />
                          </div>
                        </div>
                        <input
                          type="range" min={0} max={100} step={0.5}
                          value={rainVolume * 100}
                          onChange={e => onRainVolume(Number(e.target.value) / 100)}
                          className="w-full absolute inset-0"
                          style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }}
                        />
                        {/* Emoji thumb */}
                        <span
                          className="absolute text-base pointer-events-none select-none"
                          style={{ left: `calc(${rainVolume * 100}% - 10px)`, top: '50%', transform: 'translateY(-50%)', zIndex: 20, lineHeight: 1 }}
                        >
                          🌧️
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono tabular-nums w-6 text-right" style={{ color: dark ? 'rgba(147,197,253,0.7)' : 'rgba(96,165,250,0.8)' }}>
                        {Math.round(rainVolume * 100)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Volume */}
              <div className="px-4 mt-3 shrink-0">
                <div
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl"
                  style={{ background: volBg, border: `1px solid ${borderAccent}` }}
                >
                  <button
                    onClick={() => {
                      if (player.volume > 0) player.setVolume(0); else player.setVolume(0.8);
                    }}
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{ color: textMuted }}
                  >
                    {player.volume === 0 ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3.5-3.5M12 18l3.5-3.5M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                  <div className="relative flex-1 flex items-center" style={{ height: 32 }}>
                    {/* Track fill � no transition, follows value instantly */}
                    <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${player.volume * 100}%`, background: 'linear-gradient(to right, #c8956c, #e8b48a)' }} />
                      </div>
                    </div>
                    {/* Range input � opacity:0.001 so iPad/iOS touch events work correctly */}
                    <input
                      type="range" min={0} max={100} step={0.5}
                      value={player.volume * 100}
                      onChange={e => player.setVolume(Number(e.target.value) / 100)}
                      className="w-full absolute inset-0"
                      style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }}
                    />
                    {/* HoneyJar thumb � position matches value exactly, no rounding */}
                    <img src={honeyJarIcon} alt="" draggable={false}
                      style={{
                        position: 'absolute',
                        left: `calc(${player.volume * 100}% - 12px)`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 24, height: 24,
                        pointerEvents: 'none', userSelect: 'none', zIndex: 20,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }} />
                  </div>
                  <span className="shrink-0 text-[10px] font-mono tabular-nums w-6 text-right" style={{ color: textMuted }}>
                    {player.volume === 0 ? '—' : Math.round(player.volume * 100)}
                  </span>
                </div>
              </div>

              {/* Current category track list */}
              <div className="flex-1 overflow-y-auto min-h-0 mt-4 border-t" style={{ borderColor: borderAccent }}>
                <div className="px-5 pt-3 pb-2 flex items-center gap-2">
                  <div className="w-1 h-3 rounded-full" style={{ background: 'linear-gradient(to bottom, #c8956c, #e8b48a)' }} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                    {player.currentCat?.label}
                  </p>
                </div>
                {player.currentCat?.tracks.map((track, ti) => {
                  const isActive = ti === player.trackIdx;
                  return (
                    <button
                      key={ti}
                      onClick={() => player.selectTrack(player.catIdx, ti)}
                      className="w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors active:opacity-70"
                      style={{ background: isActive ? trackActiveBg : 'transparent' }}
                    >
                      <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center transition-all"
                        style={{ background: isActive ? 'transparent' : thumbBg, outline: isActive ? `2px solid ${textAccent}55` : 'none' }}>
                        {track.image_url ? (
                          <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                        ) : isActive && player.playing ? (
                          <div className="flex gap-[2px] items-end h-4 w-full justify-center">
                            {[0, 0.1, 0.2].map((d, i) => (
                              <motion.div key={i} className="w-[3px] rounded-full"
                                style={{ background: textAccent, height: 10, originY: 1, willChange: 'transform' }}
                                animate={{ scaleY: [0.3, 1, 0.3] }}
                                initial={{ height: 10, scaleY: 0.3, originY: 1 }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                            ))}
                          </div>
                        ) : (
                          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: isActive ? textAccent : textMuted }}>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate" style={{ color: isActive ? textPrimary : textSecondary, fontWeight: isActive ? 600 : 400 }}>
                          {track.title}
                        </p>
                        {track.artist && (
                          <p className="text-[10px] truncate" style={{ color: `${textAccent}99` }}>{track.artist}</p>
                        )}
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: textAccent }} />}
                    </button>
                  );
                })}
              </div>

              <div className="shrink-0 py-3 flex justify-center">
                <div className="w-10 h-1 rounded-full" style={{ background: `${textAccent}30` }} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }}
              className="flex flex-col h-full relative z-10"
            >
              {/* Library header */}
              <div className="flex items-center gap-2 px-5 pt-5 pb-3 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { setView('player'); setSearchQuery(''); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ color: textMuted }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
                <div className="flex items-center gap-2 flex-1">
                  <img src={honeyJarIcon} alt="" className="w-4 h-4 object-contain" />
                  <span className="text-sm font-bold" style={{ color: textSecondary }}>คลังเพลง</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ color: textMuted }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Search bar */}
              <div className="px-5 pb-3 shrink-0">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full"
                  style={{ background: searchBg, border: `1px solid ${borderAccent}` }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: textMuted }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ชื่อเพลง, ศิลปิน..."
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: textPrimary }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ color: textMuted }}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-24 space-y-6">
                {searchQuery ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: textMuted }}>
                      ผลการค้นหา ({filteredAll.length})
                    </p>
                    {filteredAll.length === 0 ? (
                      <p className="text-xs text-center py-8" style={{ color: textMuted }}>ไม่พบเพลง</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredAll.map(({ track, catIdx, trackIdx: ti, catLabel }) => {
                          const isActive = catIdx === player.catIdx && ti === player.trackIdx;
                          return (
                            <button
                              key={`${catIdx}-${ti}`}
                              onClick={() => { player.selectTrack(catIdx, ti); setView('player'); setSearchQuery(''); }}
                              className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-2xl transition-colors active:opacity-70"
                              style={{ background: isActive ? trackActiveBg : 'transparent' }}
                            >
                              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                                style={{ background: isActive ? 'transparent' : thumbBg, outline: isActive ? `2px solid ${textAccent}55` : 'none' }}>
                                {track.image_url
                                  ? <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                                  : <Music2 className="w-4 h-4" style={{ color: `${textAccent}99` }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: isActive ? textAccent : textPrimary }}>{track.title}</p>
                                <p className="text-[10px] truncate" style={{ color: textMuted }}>{track.artist ?? catLabel}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* หมวดหมู่ — Pinterest card grid */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 rounded-full" style={{ background: 'linear-gradient(to bottom, #c8956c, #e8b48a)' }} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                          หมวดหมู่
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {player.library.map((cat, ci) => {
                          const firstTrack = cat.tracks[0];
                          const isCurrentCat = ci === player.catIdx;
                          return (
                            <motion.button
                              key={ci}
                              whileHover={{ scale: 1.04, y: -3 }}
                              whileTap={{ scale: 0.96 }}
                              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                              onClick={() => { player.selectTrack(ci, 0); setView('player'); }}
                              className="relative rounded-3xl overflow-hidden flex flex-col items-start justify-end"
                              style={{
                                aspectRatio: '3/4',
                                boxShadow: isCurrentCat
                                  ? '0 0 0 2.5px #c8956c, 0 10px 28px rgba(0,0,0,0.25), 0 0 20px rgba(200,149,108,0.2)'
                                  : '0 6px 20px rgba(0,0,0,0.18)',
                              }}
                            >
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #2a1a0e, #120a04)' }}>
                                {firstTrack?.image_url && (
                                  <img src={firstTrack.image_url} alt="" className="w-full h-full object-cover" style={{ opacity: 0.8 }} />
                                )}
                              </div>
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,2,0.88) 0%, rgba(10,5,2,0.4) 40%, rgba(10,5,2,0.1) 65%, transparent 100%)' }} />
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(200,149,108,0.08) 0%, transparent 50%)' }} />
                              <div className="absolute inset-x-0 top-0 h-2/5" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)' }} />
                              <div className="absolute top-3 right-3 z-10">
                                <div className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center"
                                  style={{ background: 'conic-gradient(from 0deg, #120a04, #2a1a0e, #120a04, #1e1208, #2a1a0e, #120a04)', boxShadow: isCurrentCat ? '0 0 10px rgba(200,149,108,0.5)' : '0 2px 8px rgba(0,0,0,0.4)' }}>
                                  <div className="w-3 h-3 rounded-full overflow-hidden border border-[hsl(var(--primary)/0.3)]">
                                    {firstTrack?.image_url ? <img src={firstTrack.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[hsl(var(--mocha))]" />}
                                  </div>
                                </div>
                              </div>
                              {isCurrentCat && (
                                <div className="absolute top-3 left-3 z-10">
                                  <motion.div className="flex gap-[2px] items-end" style={{ height: 12 }}>
                                    {[0, 0.12, 0.24].map((d, i) => (
                                      <motion.div key={i} className="w-[2.5px] rounded-full bg-[hsl(var(--primary))]"
                                        animate={{ height: ['3px', '10px', '3px'] }}
                                        transition={{ duration: 0.5, repeat: Infinity, delay: d }} />
                                    ))}
                                  </motion.div>
                                </div>
                              )}
                              <div className="relative z-10 p-3 w-full">
                                <p className="text-white text-xs font-bold truncate leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{cat.label}</p>
                                <p className="text-white/50 text-[10px] mt-0.5">{cat.tracks.length} ????</p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* All songs */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 rounded-full" style={{ background: 'linear-gradient(to bottom, #c8956c, #e8b48a)' }} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                          คลังเพลง ({allTracks.length})
                        </p>
                      </div>
                      <div className="space-y-1">
                        {allTracks.map(({ track, catIdx, trackIdx: ti, catLabel }) => {
                          const isActive = catIdx === player.catIdx && ti === player.trackIdx;
                          return (
                            <button
                              key={`${catIdx}-${ti}`}
                              onClick={() => { player.selectTrack(catIdx, ti); setView('player'); }}
                              className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-2xl transition-colors active:opacity-70"
                              style={{ background: isActive ? trackActiveBg : 'transparent' }}
                            >
                              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                                style={{ background: isActive ? 'transparent' : thumbBg, outline: isActive ? `2px solid ${textAccent}55` : 'none' }}>
                                {track.image_url ? <img src={track.image_url} alt="" className="w-full h-full object-cover" /> : (
                                  isActive && player.playing ? (
                                    <div className="flex gap-[2px] items-end h-4 w-full justify-center">
                                      {[0, 0.1, 0.2].map((d, i) => (
                                        <motion.div key={i} className="w-[3px] rounded-full"
                                          style={{ background: textAccent, height: 12, originY: 1, willChange: 'transform' }}
                                          animate={{ scaleY: [0.25, 1, 0.25] }}
                                          initial={{ height: 12, scaleY: 0.25, originY: 1 }}
                                          transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                                      ))}
                                    </div>
                                  ) : <Music2 className="w-4 h-4" style={{ color: `${textAccent}99` }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: isActive ? textAccent : textPrimary }}>{track.title}</p>
                                <p className="text-[10px] truncate" style={{ color: textMuted }}>{track.artist ?? catLabel}</p>
                              </div>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: textAccent }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mini player pill � always visible in library */}
              <div
                className="absolute bottom-0 left-0 right-0 px-4 py-3 z-20"
                style={{
                  background: miniBarBg,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderTop: `1px solid ${miniBarBorder}`,
                }}
              >
                <button
                  onClick={() => setView('player')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:opacity-70 transition-colors"
                  style={{ background: trackActiveBg, border: `1px solid ${borderAccent}` }}
                >
                  <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: thumbBg }}>
                    {player.currentTrack?.image_url
                      ? <img src={player.currentTrack.image_url} alt="" className="w-full h-full object-cover" />
                      : <Music2 className="w-4 h-4" style={{ color: `${textAccent}88` }} />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{player.currentTrack?.title ?? '�'}</p>
                    <p className="text-[10px] truncate" style={{ color: textMuted }}>{player.currentTrack?.artist ?? player.currentCat?.label ?? ''}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={e => { e.stopPropagation(); player.toggle(); }}
                    className="w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0"
                    style={{ willChange: 'transform', background: 'linear-gradient(145deg, #e0b080, #c8956c)', boxShadow: '0 2px 8px rgba(200,149,108,0.4)' }}
                  >
                    {player.playing ? (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1.5" />
                        <rect x="14" y="4" width="4" height="16" rx="1.5" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </motion.button>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
});

// --- Large Vinyl Disc (hero, drawer player view) -----------------------------
const VinylDiscLarge = memo(({ imageUrl, playing }: { imageUrl?: string | null; playing: boolean }) => (
  <div className="relative flex items-center justify-center">
    <motion.div
      animate={{ rotate: playing ? 360 : 0 }}
      transition={{ duration: 7, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      className="w-52 h-52 sm:w-60 sm:h-60 rounded-full flex items-center justify-center relative"
      style={{
        willChange: 'transform',
        background: 'conic-gradient(from 0deg, #120a04, #2a1a0e, #120a04, #1e1208, #3a2410, #1e1208, #120a04)',
        boxShadow: playing
          ? '0 0 0 4px rgba(200,149,108,0.1), 0 0 40px rgba(200,149,108,0.3), 0 16px 48px rgba(0,0,0,0.55)'
          : '0 10px 40px rgba(0,0,0,0.5)',
      }}
    >
      {[48, 58, 68, 78, 88, 98].map(r => (
        <div key={r} className="absolute rounded-full border border-white/[0.035]" style={{ width: r * 2, height: r * 2 }} />
      ))}
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 30%, transparent 55%)' }} />
      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-[hsl(var(--primary)/0.25)] z-10"
        style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#3a2410] to-[#120a04] flex items-center justify-center">
            <Music2 className="w-10 h-10 text-[hsl(var(--primary)/0.4)]" />
          </div>
        )}
      </div>
      <div className="absolute w-5 h-5 rounded-full z-20"
        style={{ background: 'radial-gradient(circle at 35% 35%, #3a2410, #120a04)', border: '2px solid rgba(200,149,108,0.35)' }} />
    </motion.div>
  </div>
));

async function loadBannedWords(): Promise<string[]> {
  const { data } = await supabase.from('banned_words').select('word');
  return (data ?? []).map((r: any) => r.word.toLowerCase());
}

function findBannedWord(text: string, banned: string[]): string | null {
  const lower = text.toLowerCase();
  return banned.find(w => lower.includes(w)) ?? null;
}

// --- Synchronized Countdown ---------------------------------------------------
// Computes remaining time from server-authoritative started_at timestamp so
// both clients stay in sync even after page reload or tab switch.
function playUrgentSound() {
  try {
    const ctx = new AudioContext();
    // Three short descending beeps
    [880, 660, 440].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.22);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.22 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function useCountdown(
  totalSeconds: number,
  active: boolean,
  startedAt: string | null,   // server timestamp � used for sync
  onExpire: () => void,
) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef   = useRef(false);
  const urgentRef    = useRef(false); // prevent repeated sound

  useEffect(() => {
    if (!active) return;
    expiredRef.current  = false;
    urgentRef.current   = false;

    const tick = () => {
      let secs: number;
      if (startedAt) {
        // Server-authoritative: compute from DB timestamp
        const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
        secs = Math.max(0, Math.round(totalSeconds - elapsed));
      } else {
        // Fallback: decrement locally (first join, started_at not yet written)
        setRemaining(prev => {
          secs = prev - 1;
          return Math.max(0, secs);
        });
        return;
      }

      setRemaining(secs);

      // Play urgent sound once when crossing 60-second mark
      if (secs <= 60 && secs > 0 && !urgentRef.current) {
        urgentRef.current = true;
        playUrgentSound();
      }

      if (secs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    tick(); // immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active, totalSeconds, startedAt]);

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
        className="bg-[hsl(var(--card))] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] text-center space-y-4"
      >
        <p className="font-semibold text-foreground text-lg">
          แชทเป็นยังไงบ้าง?
        </p>
        <p className="text-sm text-muted-foreground">
          ให้คะแนนการสนทนาครั้งนี้หน่อยน้า
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
              {s <= (hovered || selected) ? '⭐' : '☆'}
            </button>
          ))}
        </div>
        <button
          onClick={() => selected > 0 && onRate(selected)}
          disabled={selected === 0}
          className="w-full py-2.5 rounded-xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.85)] disabled:opacity-40 text-white font-semibold transition-colors"
        >
          ส่งคะแนน
        </button>
        <button
          onClick={() => onRate(0)}
          className="text-xs text-muted-foreground hover:text-[hsl(var(--bear-brown))] transition-colors"
        >
          ข้ามไปก่อน
        </button>
      </motion.div>
    </div>
  );
}

// --- Tooltip (desktop hover) -------------------------------------------------
// align: 'center' | 'right' — ใช้ 'right' เมื่อ tooltip อยู่ชิดขอบขวาของหน้าจอ
function Tooltip({ text, children, align = 'center' }: { text: string; children: React.ReactNode; align?: 'center' | 'right' }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 500); };
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(false); };

  const posClass = align === 'right'
    ? 'right-0'
    : 'left-1/2 -translate-x-1/2';

  const arrowClass = align === 'right'
    ? 'right-3'
    : 'left-1/2 -translate-x-1/2';

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full ${posClass} mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none`}
            style={{ zIndex: 9999, background: 'hsl(var(--mocha))', color: 'hsl(var(--foreground))', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
          >
            {text}
            <div className={`absolute bottom-full ${arrowClass} w-0 h-0`}
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid rgba(42,26,14,0.92)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Tutorial -----------------------------------------------------------------
// Steps 0-2: shown while waiting for match
// Steps 3-4: shown after match
interface TutorialStep {
  refKey: string;
  title: string;
  desc: string;
  tooltipSide: 'below' | 'above';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { refKey: 'rain',  title: 'เสียงฝน',       desc: 'เปิด/ปิดเสียงฝนเพื่อบรรยากาศ',                                             tooltipSide: 'below' },
  { refKey: 'theme', title: 'ธีมสี',          desc: 'สลับโหมดสว่าง/มืดได้ตามชอบ',                                               tooltipSide: 'below' },
  { refKey: 'leave', title: 'ออกจากห้อง',    desc: 'กดเพื่อจบการสนทนาและออกไป',                                                 tooltipSide: 'below' },
  { refKey: 'timer', title: 'เวลาที่เหลือ',  desc: 'นับถอยหลัง 7 นาที กด 1 ดาวขึ้นไปเพื่อให้คะแนน',                          tooltipSide: 'below' },
  { refKey: 'input', title: 'พิมพ์ข้อความ',  desc: 'พิมพ์แล้วกด Enter ส่งได้เลย หรือกด Shift+Enter ขึ้นบรรทัดใหม่',          tooltipSide: 'above' },
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

  // Poll for the target element until it exists AND has a non-zero painted size.
  // This handles Framer Motion entrance animations that start at opacity:0 / scale:0,
  // which cause getBoundingClientRect() to return {width:0, height:0} on the first frame.
  useEffect(() => {
    // Safety: if the step definition is missing, bail out immediately.
    if (!s?.refKey) { setRingRect(null); return; }

    setRingRect(null); // reset while we wait for the new target

    let intervalId: ReturnType<typeof setInterval>;

    const measure = () => {
      const el = refs[s.refKey]?.current;

      // Safety fallback: ref is completely missing � skip gracefully.
      if (!el) {
        console.warn(
          `[Tutorial Debug] Step ${step} target "${s.refKey}" is null or size is 0. Waiting for Framer Motion to finish...`
        );
        return; // keep polling
      }

      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        // Element is fully painted � lock in the rect and stop polling.
        setRingRect(rect);
        clearInterval(intervalId);
      } else {
        console.warn(
          `[Tutorial Debug] Step ${step} target "${s.refKey}" is null or size is 0. Waiting for Framer Motion to finish...`
        );
      }
    };

    // Start polling at 60 fps cadence (16 ms).
    intervalId = setInterval(measure, 16);

    // Also update on resize / scroll so the ring tracks the element.
    const onResize = () => {
      const el = refs[s.refKey]?.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) setRingRect(rect);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [step, s?.refKey]);

  // Safety: unknown step � render nothing rather than crashing.
  if (!s) return null;
  const isLast = step === total - 1;

  const PAD = 6; // padding around the highlight ring

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55 pointer-events-auto" onClick={onSkip} />

      {/* Highlight ring � positioned from measured rect */}
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
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3)',
          }}
        />
      )}

      {/* Tooltip � positioned relative to ring */}
      {ringRect && (
        <motion.div
          key={`tip-${step}`}
          initial={{ opacity: 0, y: s.tooltipSide === 'below' ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="absolute w-72 bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] p-4 pointer-events-auto"
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
            <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {step + 1}
            </div>
            <p className="font-bold text-foreground text-sm">{s.title}</p>
          </div>
          <p className="text-xs text-[hsl(var(--bear-brown))] dark:text-muted-foreground leading-relaxed mb-4">{s.desc}</p>

          <div className="flex items-center justify-between">
            <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-[hsl(var(--bear-brown))] transition-colors">
              ข้ามทั้งหมด
            </button>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-[hsl(var(--primary))]' : 'w-1.5 bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))]'}`} />
                ))}
              </div>
              <button
                onClick={onNext}
                className="px-4 py-1.5 rounded-xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.85)] text-white text-xs font-semibold transition-colors"
              >
                {isLast ? 'เริ่มเลย!' : 'ถัดไป'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// --- Match notification sound (Web Audio API � no file needed) ---------------
function playMatchSound() {
  try {
    const ctx = new AudioContext();
    // Two-tone "ding ding" chime
    const notes = [880, 1108]; // A5, C#6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.18 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
    // Auto-close context after sound finishes
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export default function SecretChatRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { on: rainOn, toggle: toggleRain, volume: rainVolume, setVolume: setRainVolume } = useRainAmbient();

  const bgmRef = useRef<HTMLAudioElement>(null);
  const player = useMusicPlayer(bgmRef);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  // โหมดประหยัดพลังงาน — ปิด backdrop-blur ใน panel เพื่อเพิ่มประสิทธิภาพบนอุปกรณ์ที่ช้า
  const [musicPerfMode, setMusicPerfMode] = useState<boolean>(() => {
    try { return localStorage.getItem('music_perf_mode') === '1'; } catch { return false; }
  });
  // Perf prompt — แสดงครั้งแรกที่เข้า room เพื่อถามว่าต้องการเปิดโหมดประหยัดพลังงานไหม
  const [showPerfPrompt, setShowPerfPrompt] = useState<boolean>(() => {
    try { return localStorage.getItem('music_perf_mode') === null; } catch { return false; }
  });
  const dismissPerfPrompt = (enable: boolean) => {
    const next = enable;
    setMusicPerfMode(next);
    try { localStorage.setItem('music_perf_mode', next ? '1' : '0'); } catch {}
    setShowPerfPrompt(false);
  };

  // Mobile swipe-from-left-edge to open music panel
  const swipeTouchStartX = useRef<number | null>(null);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      swipeTouchStartX.current = x < 24 ? x : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (swipeTouchStartX.current === null) return;
      const dx = e.touches[0].clientX - swipeTouchStartX.current;
      if (dx > 60) {
        setShowMusicPanel(true);
        swipeTouchStartX.current = null; // prevent re-firing
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Lock body scroll when panel is open (prevents scroll bleed on iOS)
  useEffect(() => {
    if (showMusicPanel) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showMusicPanel]);

  const { topicId, topicName, alias, avatar, role } = (location.state as any) ?? {};

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'waiting' | 'matched' | 'ended'>('waiting');
  const [queueCount, setQueueCount] = useState(0);
  const [matchedWithBartender, setMatchedWithBartender] = useState(false);
  const [bartenderTransitioning, setBartenderTransitioning] = useState(false);

  // -- Queue count realtime — นับเฉพาะตอน waiting ----------------------
  useEffect(() => {
    if (matchStatus !== 'waiting') return;
    const STALE_MS = 45 * 1000;
    const fetchCount = async () => {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { count } = await (supabase as any)
        .from('chat_queue')
        .select('*', { count: 'exact', head: true })
        .gte('joined_at', cutoff);
      setQueueCount(count ?? 0);
    };
    fetchCount();
    const countInterval = setInterval(() => {
      (supabase as any).rpc('cleanup_stale_queue').then(fetchCount);
    }, 15000);
    const ch = supabase
      .channel('room-queue-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_queue' }, fetchCount)
      .subscribe();
    return () => {
      clearInterval(countInterval);
      supabase.removeChannel(ch);
    };
  }, [matchStatus]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [bannedWarning, setBannedWarning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  // Similar mood config + phase tracking
  const [moodConfig, setMoodConfig] = useState<SimilarMoodConfig>({ enabled: false, similar_phase_delay_seconds: 15, map: {} });
  const matchStartRef = useRef<number>(Date.now());

  // Tutorial state � show once per session, stored in localStorage
  const TUTORIAL_KEY = 'cafe_room_tutorial_done';
  const [tutorialStep, setTutorialStep] = useState<number>(() =>
    localStorage.getItem(TUTORIAL_KEY) ? -1 : 0
  );
  const skipTutorial = () => { setTutorialStep(-1); localStorage.setItem(TUTORIAL_KEY, '1'); };
  const nextTutorial = () => {
    const next = tutorialStep + 1;
    if (next >= TUTORIAL_STEPS.length) { skipTutorial(); } else { setTutorialStep(next); }
  };

  // Refs for tutorial highlight � typed correctly so React attaches them
  const rainRef  = useRef<HTMLButtonElement>(null);
  const musicRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  // "Join Table" overlay � shown when a match is found, dismissed by user click.
  // The click IS a user gesture, so audio play is allowed by the browser.
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  // isRoomReady: true only after the user has dismissed the join overlay,
  // guaranteeing all room UI elements (timer, input) are fully mounted.
  const [isRoomReady, setIsRoomReady] = useState(false);

  // Stable object � only recreated if refs themselves change (they don't)
  const tutorialRefs = useMemo<TutorialRefs>(() => ({
    rain:  rainRef  as React.RefObject<HTMLElement>,
    music: musicRef as React.RefObject<HTMLElement>,
    leave: leaveRef as React.RefObject<HTMLElement>,
    timer: timerRef as React.RefObject<HTMLElement>,
    theme: themeRef as React.RefObject<HTMLElement>,
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

  // Called when the user clicks "เข้าร่วมโต๊ะ" — direct user gesture → audio allowed.
  // CRITICAL: el.play() MUST be the very first synchronous call so the browser's
  // transient activation token is still valid. Any await or setState before it
  // will cause a NotAllowedError.
  const handleJoinTable = useCallback(() => {
    // -- 1. Trigger audio FIRST � synchronous, before any state updates ------
    const el = bgmRef.current;
    if (el) {
      if (!el.src || el.src === window.location.href) {
        const src = player.currentTrack?.src;
        if (src) el.src = src;
      }
      try {
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => player.syncPlayingState(true))
            .catch((err: unknown) => {
              const error = err as DOMException;
              console.error('[Audio Debug] Playback failed:', error);
              window.alert(`Audio Error: ${error.name} - ${error.message}`);
            });
        }
      } catch (err: unknown) {
        const error = err as DOMException;
        console.error('[Audio Debug] Playback failed (sync):', error);
        window.alert(`Audio Error: ${error.name} - ${error.message}`);
      }
    }
    // -- 2. Update state AFTER play() has been called -------------------------
    setShowJoinOverlay(false);
    setIsRoomReady(true);

    // -- 3. Write started_at to DB so both clients can sync the countdown -----
    if (session?.id && !session.started_at) {
      (supabase as any)
        .from('chat_sessions')
        .update({ started_at: new Date().toISOString() })
        .eq('id', session.id)
        .then(({ error }: any) => {
          if (error) console.warn('[handleJoinTable] started_at update skipped:', error.message);
        });
    }

    // -- 4. Insert bot safety welcome message — user_a only (ส่งครั้งเดียว 2 ฝ่าย) --
    // sender_id = null ? system message (no FK violation)
    if (session?.id && session.user_a_id === user?.id) {
      const welcomeText = [
        '⚠️ **คำเตือนก่อนเริ่มแชท**',
        '',
        'หากคุณพบว่าเพื่อนสนทนาของคุณมีการใช้ถ้อยคำไม่สุภาพ คุกคาม หรือทำให้คุณรู้สึกไม่ปลอดภัย สามารถแจ้งปัญหาได้ที่ **#🚨︰พื้นที่แจ้งปัญหา** ผ่านทางเซิร์ฟเวอร์ Discord ของเรา',
        '',
        'กรุณา **แคปหน้าจอแชททุกครั้งโดยห้ามครอปภาพ** เพื่อให้ทีมงานสามารถตรวจสอบบริบทของบทสนทนาได้อย่างครบถ้วน เนื่องจากระบบ **ไม่มีการบันทึกประวัติแชทของผู้ใช้งาน**',
        '',
        '⏰ เมื่อเกิดปัญหา กรุณาแจ้งภายใน **24 ชั่วโมง** เพื่อให้สามารถดำเนินการได้อย่างรวดเร็ว',
      ].join('\n');

      (supabase as any).from('chat_messages').insert({
        session_id: session.id,
        sender_id:  null,
        content:    welcomeText,
        is_system:  true,
      }).then(({ error }: any) => {
        if (error) console.warn('[handleJoinTable] bot message failed:', error.message);
      });
    }
  }, [player.currentTrack?.src, player.syncPlayingState, session]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bartenderTransitioningRef = useRef(false);

  useEffect(() => {
    if (!topicId || !alias) {
      if (user?.id) {
        (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
      }
      navigate('/secret-chat');
    }
  }, [topicId, alias, user?.id, navigate]);

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

  // Auto-navigate when session ends and user returns from background (mobile/tablet)
  // Handles the case where the timer expired while the app was backgrounded
  useEffect(() => {
    if (matchStatus !== 'ended') return;
    // If rating dialog is not showing (already dismissed or skipped), go home
    if (!showRating) {
      navigate('/');
    }
  }, [matchStatus, showRating, navigate]);

  // When user returns from background, check if session has already ended
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!session?.id || matchStatus === 'ended') return;
      const { data } = await (supabase as any)
        .from('chat_sessions')
        .select('status, ended_at')
        .eq('id', session.id)
        .single();
      if (data?.status === 'ended') {
        // Clean up our queue row in case it was left behind while backgrounded
        if (user?.id) {
          await (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
        }
        setMatchStatus('ended');
        setShowRating(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session?.id, matchStatus, user?.id]);

  const handleExpire = useCallback(async () => {
    if (!session) return;
    if (session.status === 'active') {
      await (supabase as any)
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('status', 'active');
      if (matchedWithBartender) {
        await (supabase as any).rpc('release_bartender_session', { p_session_id: session.id });
      }
      // Clean up queue for both participants on expiry too
      await (supabase as any)
        .from('chat_queue')
        .delete()
        .in('user_id', [session.user_a_id, session.user_b_id]);
    }
    setMatchStatus('ended');
    setShowRating(true);
  }, [session, matchedWithBartender]);

  // Countdown only starts after the user has joined (isRoomReady), so the timer
  // doesn't tick away while the join overlay is displayed.
  const { remaining, display: countdownDisplay } = useCountdown(
    SESSION_DURATION,
    isRoomReady && matchStatus === 'matched',
    session?.started_at ?? null,
    handleExpire,
  );
  const isUrgent = remaining <= 60 && remaining > 0;

  useEffect(() => {
    if (!user || !topicId || matchStatus !== 'waiting') return;

    // Record when we started waiting (for similar-phase delay)
    matchStartRef.current = Date.now();

    // -- Cleanup helper --------------------------------------------------------
    const cleanupQueue = () => {
      (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
    };

    // Stale cleanup � call the DB function instead of a client-side cutoff
    (supabase as any).rpc('cleanup_stale_queue').then(() => {});

    const refreshQueuePresence = () => {
      (supabase as any)
        .from('chat_queue')
        .update({ joined_at: new Date().toISOString() })
        .eq('user_id', user.id);
    };

    const onBeforeUnload = () => cleanupQueue();
    const onPageHide = () => cleanupQueue();
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);

    // Track whether this client has already triggered a match to prevent
    // double-firing when both Realtime and polling detect the same event.
    let matchedRef = false;

    const handleMatch = (sess: ChatSession) => {
      if (matchedRef) return;
      matchedRef = true;
      playMatchSound();
      setQueueCount(0);
      setSession(sess);
      setMatchStatus('matched');
    };

    const detectBartenderMatch = async (sess: ChatSession) => {
      const partnerId = sess.user_a_id === user.id ? sess.user_b_id : sess.user_a_id;
      const { data } = await (supabase as any)
        .from('chat_bartender_presence')
        .select('user_id')
        .eq('user_id', partnerId)
        .eq('is_enabled', true)
        .maybeSingle();
      setMatchedWithBartender(Boolean(data));
    };

    const findExistingSession = async () => {
      if (matchedRef) return;
      const { data } = await (supabase as any)
        .from('chat_sessions')
        .select('*')
        .eq('status', 'active')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        await detectBartenderMatch(data as ChatSession);
        handleMatch(data as ChatSession);
      }
    };

    const tryMatch = async (allowBartender: boolean) => {
      if (matchedRef) return;

      const elapsedSeconds = (Date.now() - matchStartRef.current) / 1000;
      const inSimilarPhase = moodConfig.enabled && elapsedSeconds >= moodConfig.similar_phase_delay_seconds;

      const { data: sessions, error } = await (supabase as any).rpc('match_secret_chat', {
        p_user_id: user.id,
        p_topic_id: topicId,
        p_user_alias: alias,
        p_user_avatar: avatar,
        p_user_role: role ?? 'both',
        p_duration_secs: SESSION_DURATION,
        p_allow_cross_topic: inSimilarPhase,
        p_allow_bartender: allowBartender,
      });
      if (error) {
        console.error('[SecretChat] match_secret_chat RPC failed', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          supabaseUrl: supabaseConfig.url,
          anonKeyConfigured: supabaseConfig.hasAnonKey,
          keySource: supabaseConfig.keySource,
          keyRole: supabaseConfig.keyRole,
          note: error.message?.includes('No API key')
            ? 'RPC must be called via supabase.rpc() with VITE_SUPABASE_ANON_KEY configured in the deployed environment. Do not open /rest/v1/rpc/* directly in the browser.'
            : undefined,
        });
        return;
      }
      if (!sessions || sessions.length === 0) return;

      const matchedSession = sessions[0] as ChatSession;
      if (allowBartender) {
        await detectBartenderMatch(matchedSession);
      } else {
        setMatchedWithBartender(false);
      }
      handleMatch(matchedSession);
    };

    // -- Polling with per-client jitter to avoid thundering herd --------------
    // Base interval 3s + random 0�2s offset so 100 clients don't all fire
    // at the same millisecond. Effective rate: ~1 query per 3�5s per client.
    const POLL_BASE_MS  = 3000;
    const POLL_JITTER_MS = 2000;
    const jitter = Math.random() * POLL_JITTER_MS;

    // Initial delayed start (spread out first wave)
    const initialDelay = setTimeout(() => {
      findExistingSession();
      tryMatch(false);
      const interval = setInterval(() => tryMatch(false), POLL_BASE_MS + Math.random() * POLL_JITTER_MS);
      const bartenderInterval = setInterval(() => {
        const elapsedMs = Date.now() - matchStartRef.current;
        if (elapsedMs >= 7000) tryMatch(true);
      }, 1200);
      const sessionCheckInterval = setInterval(findExistingSession, 1500);
      const heartbeatInterval = setInterval(refreshQueuePresence, 15000);
      // Store interval id so cleanup can clear it
      (intervalRef as any).current = interval;
      (intervalRef as any).bartender = bartenderInterval;
      (intervalRef as any).sessionCheck = sessionCheckInterval;
      (intervalRef as any).heartbeat = heartbeatInterval;
    }, jitter);

    // -- Realtime: primary notification path (faster than polling) ------------
    const queueChannel = supabase
      .channel(`queue-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_b_id=eq.${user.id}`,
      }, async (payload) => {
        // user_b receives the session via Realtime � no need to delete queue
        // (the atomic function already deleted it server-side)
        await detectBartenderMatch(payload.new as ChatSession);
        handleMatch(payload.new as ChatSession);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_a_id=eq.${user.id}`,
      }, async (payload) => {
        await detectBartenderMatch(payload.new as ChatSession);
        handleMatch(payload.new as ChatSession);
      })
      .subscribe();

    return () => {
      clearTimeout(initialDelay);
      if ((intervalRef as any).current) clearInterval((intervalRef as any).current);
      if ((intervalRef as any).bartender) clearInterval((intervalRef as any).bartender);
      if ((intervalRef as any).sessionCheck) clearInterval((intervalRef as any).sessionCheck);
      if ((intervalRef as any).heartbeat) clearInterval((intervalRef as any).heartbeat);
      supabase.removeChannel(queueChannel);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      cleanupQueue();
    };
  }, [user, topicId, alias, avatar, matchStatus, moodConfig]);

  useEffect(() => {
    if (!session || !user || !matchedWithBartender || matchStatus !== 'matched') return;
    const switchToRealUser = async () => {
      if (bartenderTransitioningRef.current) return;
      bartenderTransitioningRef.current = true;
      setBartenderTransitioning(true);
      const myRole = session.user_a_id === user.id ? session.user_a_role : session.user_b_role;
      const { data: queue } = await (supabase as any)
        .from('chat_queue')
        .select('*')
        .neq('user_id', user.id)
        .gte('joined_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('joined_at', { ascending: true })
        .limit(10);
      if (!queue || queue.length === 0) {
        bartenderTransitioningRef.current = false;
        setBartenderTransitioning(false);
        return;
      }

      const { data: bartenderRows } = await (supabase as any)
        .from('chat_bartender_presence')
        .select('user_id')
        .eq('is_enabled', true);
      const bartenderIds = new Set((bartenderRows ?? []).map((row: any) => row.user_id));
      const candidate = queue.find((q: any) => q.user_id !== session.user_a_id && q.user_id !== session.user_b_id && !bartenderIds.has(q.user_id));
      if (!candidate) {
        bartenderTransitioningRef.current = false;
        setBartenderTransitioning(false);
        return;
      }

      const { data: sessions } = await (supabase as any).rpc('switch_bartender_to_user', {
        p_current_session_id: session.id,
        p_user_id: user.id,
        p_candidate_id: candidate.user_id,
        p_topic_id: topicId,
        p_user_alias: alias,
        p_candidate_alias: candidate.alias,
        p_user_avatar: avatar,
        p_candidate_avatar: candidate.avatar,
        p_user_role: myRole ?? role ?? 'both',
        p_candidate_role: candidate.role ?? 'both',
        p_duration_secs: SESSION_DURATION,
      });
      if (sessions?.length) {
        setMatchedWithBartender(false);
        setSession(sessions[0] as ChatSession);
      }
      bartenderTransitioningRef.current = false;
      setBartenderTransitioning(false);
    };
    const id = setInterval(switchToRealUser, 2500);
    return () => {
      bartenderTransitioningRef.current = false;
      clearInterval(id);
    };
  }, [session?.id, user?.id, matchedWithBartender, matchStatus, topicId, alias, avatar, role]);

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
          // Clean up our own queue row in case it was left behind
          // (e.g. the other side cancelled first and we received the Realtime event)
          if (user?.id) {
            (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
          }
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

    const content = input.trim();

    // -- Local moderation (zero latency, no network) ---------------------------
    // Normalize: collapse bypass attempts like ?-?-? / ?.?.? / ?@?#? ? ???
    // Thai vowel marks (U+0E30�U+0E4E) are combining chars � keep them.
    const normalize = (s: string) =>
      s
        .toLowerCase()
        // Remove zero-width / invisible chars
        .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
        // Keep: Thai consonants (0E01-0E2E), Thai vowels/tone marks (0E30-0E4E),
        //       Thai digits (0E50-0E59), ASCII letters, ASCII digits.
        // Strip everything else (spaces, dashes, dots, @, #, _, etc.)
        .replace(/[^\u0e01-\u0e4e\u0e50-\u0e59a-z0-9]/g, '');

    const normalized = normalize(content);

    // Blacklist � exact substrings checked against normalized text.
    // Add more entries here as needed; normalization handles bypass attempts.
    const BLACKLIST: string[] = [
      // Thai
      'ควย', 'หี', 'เย็ด', 'สัตว์', 'เหี้ย', 'สัด', 'อีดอก', 'ไอ้ดอก',
      'มึง', 'กู', 'ควาย', 'ฆ่า', 'ตาย', 'ระเบิด',
      // English
      'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'kill',
      'murder', 'rape', 'porn', 'sex',
    ];

    const hitWord = BLACKLIST.find(w => normalized.includes(normalize(w)));

    if (hitWord) {
      // -- Flagged: log violation + insert system warning ----------------------
      const warningText = '🐻 รปภ. หมี: ติ๊ดๆ! ข้อความถูกบล็อกเนื่องจากตรวจพบคำสุ่มเสี่ยง รบกวนใช้คำสุภาพน้า';

      await Promise.all([
        // Log for admin observation tab (Realtime ? admin sees it instantly)
        (supabase as any).from('chat_violations').insert({
          session_id:    session.id,
          user_id:       user.id,
          word:          hitWord,
          message:       content,
          ai_categories: null,
        }),
        // System warning visible to both users in the chat
        (supabase as any).from('chat_messages').insert({
          session_id: session.id,
          sender_id:  null,        // null = system/bot
          content:    warningText,
          is_system:  true,
        }),
      ]);

      // Also show local toast so the sender gets immediate feedback
      setBannedWarning('__local__');
      setTimeout(() => setBannedWarning(null), 4000);
      return;
    }

    // -- Also check DB banned-word list (admin-managed) ------------------------
    const foundWord = findBannedWord(content, bannedWords);
    if (foundWord) {
      await (supabase as any).from('chat_violations').insert({
        session_id: session.id,
        user_id:    user.id,
        word:       foundWord,
        message:    content,
      });
      setBannedWarning(foundWord);
      setTimeout(() => setBannedWarning(null), 4000);
      return;
    }

    // -- Clean � insert message ------------------------------------------------
    setSending(true);
    setInput('');
    await (supabase as any).from('chat_messages').insert({
      session_id: session.id,
      sender_id:  user.id,
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
      // Has matched � ask for confirmation first
      setShowLeaveConfirm(true);
    } else {
      // Still waiting � just remove from queue, no confirm needed
      await (supabase as any).from('chat_queue').delete().eq('user_id', user?.id);
      navigate('/');
    }
  }, [session, user?.id, navigate]);

  const confirmLeave = useCallback(async () => {
    setShowLeaveConfirm(false);
    if (session) {
      // End the session
      await (supabase as any)
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id);
      if (matchedWithBartender) {
        await (supabase as any).rpc('release_bartender_session', { p_session_id: session.id });
      }
      // Always clean up queue for BOTH participants so neither gets stuck
      // The other side's queue row may still exist if they were re-queued or
      // if a stale row was left from a previous session.
      await (supabase as any)
        .from('chat_queue')
        .delete()
        .in('user_id', [session.user_a_id, session.user_b_id]);
      setMatchStatus('ended');
      setShowRating(true);
    }
  }, [session, matchedWithBartender]);

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
  const partnerRole = session
    ? (session.user_a_id === user?.id ? session.user_b_role : session.user_a_role)
    : null;

  // Thai role labels � friendly display names
  const ROLE_TH: Record<string, string> = {
    talk: '🗣️ อยากเล่า', listen: '👂 อยากฟัง', both: '💬 ทั้งคู่', chill: '☕ ชิลๆ',
  };

  const getAvatarImg = (key: string) => profiles.find(p => p.id === key)?.image_url ?? null;
  const partnerImg = getAvatarImg(partnerAvatarKey);

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(var(--background))] secret-room-zoom" style={{ isolation: 'isolate' }}>
      <audio ref={bgmRef} />

      {/* Music panel + backdrop � at root level, above everything */}
      <AnimatePresence>
        {showMusicPanel && (
          <>
            {/* Backdrop � z-[998], below panel */}
            <motion.div
              key="music-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: 998 }}
              onClick={() => setShowMusicPanel(false)}
            />
            {/* Panel � z-[999] */}
            <MusicPanel player={player} onClose={() => setShowMusicPanel(false)} perfMode={musicPerfMode} onTogglePerfMode={() => setMusicPerfMode(v => { const next = !v; try { localStorage.setItem('music_perf_mode', next ? '1' : '0'); } catch {} return next; })} rainOn={rainOn} onToggleRain={toggleRain} rainVolume={rainVolume} onRainVolume={setRainVolume} />
          </>
        )}
      </AnimatePresence>

      {/* Desktop floating trigger � visible on md+ when panel is closed */}
      <AnimatePresence>
        {!showMusicPanel && (
          <MusicTriggerButton playing={player.playing} onClick={() => setShowMusicPanel(true)} />
        )}
      </AnimatePresence>

      {/* Mobile swipe-from-left-edge visual hint */}
      {!showMusicPanel && (
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 md:hidden"
          style={{ width: 5, height: 56, background: 'rgba(200,149,108,0.4)', borderRadius: '0 6px 6px 0', zIndex: 53 }}
          aria-hidden="true"
        />
      )}

      {/* Perf prompt — แสดงครั้งแรกที่เข้า room */}
      <AnimatePresence>
        {showPerfPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border bg-[hsl(var(--card))]"
              style={{
                borderColor: 'hsl(var(--border))',
              }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'hsl(var(--latte))' }}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              {/* Text */}
              <p className="text-center font-bold text-foreground text-base mb-1">เปิดโหมดประหยัดพลังงาน?</p>
              <p className="text-center text-sm text-[hsl(var(--bear-brown))] leading-relaxed mb-5">
                อุปกรณ์บางรุ่นอาจกระตุกเมื่อเปิดเพลงพร้อมกับ animation<br />
                <span className="text-[11px] text-muted-foreground">ปิด blur effect และลด animation เพื่อความลื่นไหล</span>
              </p>
              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => dismissPerfPrompt(true)}
                  className="w-full py-3 rounded-2xl font-semibold text-sm text-white transition-all active:scale-[0.98] bg-[hsl(var(--primary))]"
                  style={{ boxShadow: '0 4px 16px hsl(var(--primary) / 0.4)' }}
                >
                  ⚡ เปิดโหมดประหยัดพลังงาน
                </button>
                <button
                  onClick={() => dismissPerfPrompt(false)}
                  className="w-full py-3 rounded-2xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(239,68,68,0.9)', boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}
                >
                  ไม่ต้องการ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Table overlay � shown on match, dismissed by user click to unlock AudioContext */}
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
              className="bg-[hsl(var(--card))] rounded-3xl p-8 max-w-xs w-full mx-4 shadow-2xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] text-center space-y-5"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] flex items-center justify-center mx-auto shadow-lg overflow-hidden"
              >
                <img src={pixelCoffeeIcon} alt="coffee" className="w-full h-full object-cover" />
              </motion.div>
              <div className="space-y-1.5">
                <p className="font-bold text-foreground text-xl">เจอคู่แล้ว! ☕</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  พบเพื่อนสนทนาแล้ว กดเพื่อเข้าร่วมโต๊ะ
                </p>
                {/* Partner role badge */}
                {partnerRole && (
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground">บทบาทฝ่ายตรงข้าม:</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))]">
                      {ROLE_TH[partnerRole] ?? partnerRole}
                    </span>
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleJoinTable}
                className="w-full h-12 rounded-2xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.85)] text-white font-bold text-base transition-colors shadow-lg"
              >
                เข้าร่วมโต๊ะ ☕
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
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {bannedWarning === '__ai__'
              ? 'ข้อความนี้อาจขัดต่อกฎของคาเฟ่ ลองปรับคำพูดดูน้า 🐻'
              : bannedWarning === '__thai__'
              ? 'ข้อความถูกบล็อก — พบคำต้องห้าม'
              : bannedWarning === '__local__'
              ? 'ข้อความถูกบล็อก — พบคำสุ่มเสี่ยง รบกวนใช้คำสุภาพน้า 🐻'
              : bannedWarning === '__error__'
              ? 'ไม่สามารถส่งข้อความได้ในขณะนี้ ลองใหม่อีกครั้งน้า'
              : 'ข้อความถูกบล็อก — พบคำต้องห้าม'
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Urgent time warning banner � appears at 60s remaining */}
      <AnimatePresence>
        {isUrgent && isRoomReady && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-lg"
          >
            <Clock className="w-4 h-4 shrink-0 animate-pulse" />
            เหลือเวลาอีก {countdownDisplay} รีบคุยด้วยน้า! ⏰
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="shrink-0 bg-[hsl(var(--cream)/0.95)] dark:bg-[hsl(var(--mocha)/0.95)] backdrop-blur-md border-b border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] z-20">
        <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {matchStatus === 'matched' && session ? (
              <>
                <div className="w-9 h-9 rounded-full bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-[hsl(var(--latte)/0.6)] dark:ring-[hsl(var(--coffee)/0.5)]">
                  {partnerImg
                    ? <img src={partnerImg} alt={partnerAlias} className="w-full h-full object-cover" />
                    : <span className="text-lg">🐻</span>}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm leading-tight">{partnerAlias}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {topicName}
                      {partnerRole && partnerRole !== 'both' && (
                        <span className="ml-1 opacity-70">· {ROLE_TH[partnerRole] ?? partnerRole}</span>
                      )}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={pixelCoffeeIcon} alt="coffee" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">สุ่มคุยแชทแบบไร้ตัวตน</p>
                  <p className="text-xs text-muted-foreground">{topicName}</p>
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
                  : 'bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] border-[hsl(var(--latte))] dark:border-[hsl(var(--coffee))]'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {countdownDisplay}
              </div>
            )}

            {/* Theme toggle */}
            <Tooltip text={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}>
              <button
                ref={themeRef}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all border bg-transparent text-muted-foreground border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]"
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
                }
              </button>
            </Tooltip>

            {/* Leave � solid red */}
            <Tooltip text="สิ้นสุดการแชท" align="right">
              <button onClick={leaveTable}
                ref={leaveRef}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-red-500 hover:bg-red-600 border border-red-500 hover:border-red-600 transition-all shadow-sm">
                <LogOut className="w-4 h-4" />
              </button>
            </Tooltip>
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
              className="w-32 h-32 rounded-3xl bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] flex items-center justify-center shadow-xl overflow-hidden"
            >
              <img src={pixelCoffeeIcon} alt="coffee" className="w-full h-full object-cover" />
            </motion.div>
            <div className="space-y-2">
              <p className="font-bold text-foreground text-xl">กำลังหาหมีมาพิมพ์แชทกับคุณ...</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                รอสักครู่ กำลังสุ่มแชทในหัวข้อ{' '}
                <span className="font-semibold text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))]">{topicName}</span>
              </p>
              {/* Queue counter */}
              <div className="flex justify-center pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] border border-[hsl(var(--border))]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'hsl(var(--primary))' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'hsl(var(--primary))' }} />
                  </span>
                  {queueCount > 0 ? `☕ ตอนนี้มีคนแวะมาที่ร้าน ${queueCount} คน` : '☕ ตอนนี้ร้านเงียบ ๆ อยู่ เดี๋ยวหาเพื่อนให้เลย'}
                </span>
              </div>
              {moodConfig.enabled && (
                <p className="text-xs text-muted-foreground">
                  หากรอนาน {moodConfig.similar_phase_delay_seconds} วินาที จะขยายการจับคู่ไปยังหมวดหมู่ใกล้เคียง
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.div key={i} className="w-3 h-3 rounded-full bg-[hsl(var(--primary))]"
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </div>
        )}

        {matchStatus === 'matched' && messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-6">
            <div className="bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] rounded-2xl px-5 py-3 text-center max-w-xs">
              <p className="text-sm font-semibold text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))]">เจอหมีแล้ว!</p>
              <p className="text-xs text-muted-foreground mt-1">มีเวลา {Math.floor(SESSION_DURATION / 60)} นาที เริ่มสนทนาได้เลย</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => {
            // -- System message (Bear Guard / ข้อความระบบ) ---------------------
            if (msg.is_system) {
              // Render **bold** markdown inline
              const renderBold = (text: string) =>
                text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
                    : <span key={i}>{part}</span>
                );

              const isWarning = msg.content.includes('รปภ.') || msg.content.includes('ติ๊ดๆ');

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex gap-3 flex-row"
                >
                  {/* Bear mascot avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 self-start mt-1 shadow-sm border-2 border-[hsl(var(--primary)/0.3)]">
                    <img src={bearMascotIcon} alt="น้องฮันนี่" className="w-full h-full object-cover" />
                  </div>

                  <div className="max-w-[80%] space-y-1">
                    <span className="text-[10px] text-muted-foreground px-1 font-medium">
                      น้องฮันนี่ · ฝ่ายความปลอดภัย
                    </span>
                    <div className={`px-4 py-3 rounded-2xl rounded-bl-sm text-xs leading-relaxed shadow-sm ${
                      isWarning
                        ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300'
                        : 'bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] text-foreground'
                    }`}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={line === '' ? 'h-2' : ''}>
                          {renderBold(line)}
                        </p>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            }

            // -- Normal message ------------------------------------------------
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-3 ${isMyMessage(msg) ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!isMyMessage(msg) && (
                  <div className="w-9 h-9 rounded-full bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] overflow-hidden flex items-center justify-center shrink-0 self-end shadow-sm">
                    {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
                  </div>
                )}
                <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 flex flex-col ${isMyMessage(msg) ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-muted-foreground px-1 font-medium">
                    {isMyMessage(msg) ? myAlias : partnerAlias}
                  </span>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isMyMessage(msg)
                      ? 'bg-[hsl(var(--primary))] text-white rounded-br-sm'
                      : 'bg-[hsl(var(--card))] text-foreground border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {partnerTyping && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 items-end">
            <div className="w-9 h-9 rounded-full bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
              {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
            </div>
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] rounded-2xl rounded-bl-sm px-5 py-3.5 flex gap-1.5 items-center shadow-sm">
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-[hsl(var(--bear-brown)/0.5)] dark:bg-[hsl(var(--honey)/0.4)]"
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
        <div className="shrink-0 bg-[hsl(var(--cream)/0.95)] dark:bg-[hsl(var(--mocha)/0.95)] backdrop-blur-md border-t border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] px-3 sm:px-5 py-3">
          <form
            className="flex gap-2 items-end max-w-4xl mx-auto"
            onSubmit={e => { e.preventDefault(); sendMessage(); }}
          >
            <div
              ref={inputRef}
              className="flex-1 bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] rounded-xl px-3.5 py-2.5 focus-within:border-[hsl(var(--primary))] focus-within:shadow-sm transition-all"
            >
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="พิมพ์ข้อความ..."
                rows={1}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none outline-none leading-relaxed"
                style={{ maxHeight: 100 }}
              />
            </div>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.92 }}
              onPointerDown={e => {
                // ป้องกัน blur ใน textarea ก่อน sendMessage จะ fire
                e.preventDefault();
                sendMessage();
              }}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.85)] disabled:opacity-40 flex items-center justify-center text-white transition-all shrink-0 shadow-md"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </motion.button>
          </form>
        </div>
      )}

      {showRating && <RatingDialog onRate={submitRating} />}

      {/* Leave confirmation dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-[hsl(var(--card))] rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto">
                <LogOut className="w-7 h-7 text-red-500" />
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-foreground text-lg">สิ้นสุดการแชท</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  การสนทนาจะสิ้นสุดทันที และไม่สามารถกลับมาได้
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 h-11 rounded-xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] font-semibold text-sm hover:bg-[hsl(var(--latte))] dark:hover:bg-[hsl(var(--coffee))] transition-colors"
                >
                  คุยต่อ
                </button>
                <button
                  onClick={confirmLeave}
                  className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors shadow-sm"
                >
                  ออกเลย
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
