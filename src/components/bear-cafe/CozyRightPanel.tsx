import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  src: string;
  image_url: string | null;
  category_label?: string;
}

// ── Profile Card ─────────────────────────────────────────────────────────────
function ProfileCard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] p-4 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-[hsl(var(--peach)/0.4)] flex items-center justify-center mx-auto text-2xl">
          🐻
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">ยังไม่ได้เข้าสู่ระบบ</p>
          <p className="text-xs text-muted-foreground mt-0.5">เข้าสู่ระบบเพื่อใช้งานเต็มรูปแบบ</p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-2 rounded-xl bg-[hsl(var(--honey))] text-[hsl(var(--accent-foreground))] text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
        >
          เข้าสู่ระบบ ☕
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--peach)/0.4)] via-[hsl(var(--cream))] to-[hsl(var(--blush)/0.3)] dark:from-[hsl(var(--coffee)/0.5)] dark:via-[hsl(var(--mocha))] dark:to-[hsl(var(--coffee)/0.3)] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/60 dark:border-white/10 shadow-md shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--peach))] to-[hsl(var(--blush))] flex items-center justify-center text-xl">
              🐻
            </div>
          )}
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-foreground truncate">
            {user.discord_username ?? user.username}
          </p>
          {user.discord_username && (
            <p className="text-[11px] text-muted-foreground truncate">{user.username}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">ชื่อ / ติดต่อสอบถาม DM</p>
        </div>
      </div>
    </div>
  );
}

// ── Vinyl disc animation ──────────────────────────────────────────────────────
function VinylDisc({ imageUrl, isPlaying }: { imageUrl: string | null; isPlaying: boolean }) {
  return (
    <div className="relative w-24 h-24 mx-auto">
      {/* Outer ring */}
      <motion.div
        animate={{ rotate: isPlaying ? 360 : 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
        className="w-full h-full rounded-full bg-[#2a1f1a] dark:bg-[#1a1210] shadow-lg flex items-center justify-center"
        style={{ willChange: 'transform' }}
      >
        {/* Grooves */}
        <div className="absolute inset-2 rounded-full border border-white/5" />
        <div className="absolute inset-4 rounded-full border border-white/5" />
        <div className="absolute inset-6 rounded-full border border-white/5" />

        {/* Center label */}
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shadow-inner">
          {imageUrl ? (
            <img src={imageUrl} alt="album art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--honey)/0.6)] to-[hsl(var(--peach)/0.6)] flex items-center justify-center text-lg">
              🎵
            </div>
          )}
        </div>
      </motion.div>

      {/* Needle */}
      <div
        className="absolute -right-1 top-2 w-0.5 h-8 bg-[hsl(var(--honey)/0.7)] rounded-full origin-top"
        style={{ transform: isPlaying ? 'rotate(25deg)' : 'rotate(40deg)', transition: 'transform 0.5s ease' }}
      />
    </div>
  );
}

// ── Music Player ─────────────────────────────────────────────────────────────
function MusicPlayer() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchTracks = async () => {
      const { data } = await (supabase as any)
        .from('chat_music_tracks')
        .select('id, title, artist, src, image_url, chat_music_categories(label)')
        .order('sort_order', { ascending: true })
        .limit(20);

      if (data) {
        const mapped: MusicTrack[] = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist ?? null,
          src: t.src,
          image_url: t.image_url ?? null,
          category_label: t.chat_music_categories?.label ?? null,
        }));
        setTracks(mapped);
      }
    };
    fetchTracks();
  }, []);

  const currentTrack = tracks[currentIdx] ?? null;

  // Sync audio element
  useEffect(() => {
    if (!currentTrack) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }
    audioRef.current.src = currentTrack.src;
    audioRef.current.muted = muted;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentIdx, tracks]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
  }, [muted]);

  const startProgress = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      setProgress((audio.currentTime / audio.duration) * 100);
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      stopProgress();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        startProgress();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const skipTo = (idx: number) => {
    const next = (idx + tracks.length) % tracks.length;
    setCurrentIdx(next);
    setProgress(0);
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      // src change handled by useEffect above
      setTimeout(() => {
        audioRef.current?.play().catch(() => setIsPlaying(false));
        startProgress();
      }, 50);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopProgress();
      audioRef.current?.pause();
    };
  }, []);

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] p-5 text-center">
        <p className="text-xs text-muted-foreground">ยังไม่มีเพลงในระบบ</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] p-4 space-y-4">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">เพลงตอนนี้</p>
        <span className="text-xs text-[hsl(var(--honey)/0.7)]">⚡</span>
      </div>

      {/* Vinyl */}
      <VinylDisc imageUrl={currentTrack?.image_url ?? null} isPlaying={isPlaying} />

      {/* Track info */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-bold text-foreground truncate">{currentTrack?.title ?? '—'}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {currentTrack?.artist ?? currentTrack?.category_label ?? 'Bear Cafe'}
        </p>
        {isPlaying && (
          <p className="text-[10px] text-[hsl(var(--matcha))] font-medium animate-pulse">
            — กำลังเล่นอยู่ —
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-[hsl(var(--latte)/0.6)] dark:bg-[hsl(var(--coffee)/0.4)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(var(--honey))] to-[hsl(var(--primary))] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMuted((m) => !m)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => skipTo(currentIdx - 1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="เพลงก่อนหน้า"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-[hsl(var(--honey))] text-[hsl(var(--accent-foreground))] flex items-center justify-center shadow-md shadow-[hsl(var(--honey)/0.3)]"
            aria-label={isPlaying ? 'หยุด' : 'เล่น'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </motion.button>

          <button
            onClick={() => skipTo(currentIdx + 1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="เพลงถัดไป"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Floating music note doodle */}
        <AnimatePresence>
          {isPlaying && (
            <motion.span
              key="note"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], y: -12 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-sm text-[hsl(var(--honey)/0.6)] select-none pointer-events-none"
            >
              ♪
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Playlist list ─────────────────────────────────────────────────────────────
function PlaylistList() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  useEffect(() => {
    const fetchTracks = async () => {
      const { data } = await (supabase as any)
        .from('chat_music_tracks')
        .select('id, title, artist, src, image_url, chat_music_categories(label)')
        .order('sort_order', { ascending: true })
        .limit(6);

      if (data) {
        setTracks(
          data.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist ?? null,
            src: t.src,
            image_url: t.image_url ?? null,
            category_label: t.chat_music_categories?.label ?? null,
          }))
        );
      }
    };
    fetchTracks();
  }, []);

  if (tracks.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[hsl(var(--latte)/0.4)] dark:border-[hsl(var(--coffee)/0.3)] flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ตอนนี้กำลังสนทนา</p>
        <span className="text-xs">🎵</span>
      </div>
      <ul className="divide-y divide-[hsl(var(--latte)/0.3)] dark:divide-[hsl(var(--coffee)/0.25)]">
        {tracks.map((track, i) => (
          <li key={track.id} className={cn('flex items-center gap-3 px-4 py-2.5', i === 0 && 'bg-[hsl(var(--honey)/0.06)]')}>
            {/* Tiny album art */}
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-[hsl(var(--latte)/0.4)] dark:bg-[hsl(var(--coffee)/0.3)] flex items-center justify-center">
              {track.image_url ? (
                <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs">🎵</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-semibold truncate', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {track.title}
              </p>
              <p className="text-[10px] text-muted-foreground/70 truncate">
                {track.artist ?? track.category_label ?? 'Bear Cafe'}
              </p>
            </div>

            {/* Playing indicator */}
            {i === 0 && (
              <div className="flex items-end gap-0.5 h-3 shrink-0">
                {[1, 2, 3].map((b) => (
                  <motion.div
                    key={b}
                    className="w-0.5 rounded-full bg-[hsl(var(--honey))]"
                    animate={{ height: ['4px', '10px', '4px'] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.15 }}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CozyRightPanel() {
  return (
    <aside className="w-[240px] shrink-0 flex flex-col gap-4 h-[100dvh] overflow-y-auto py-5 px-3">
      <ProfileCard />
      <MusicPlayer />
      <PlaylistList />
    </aside>
  );
}
