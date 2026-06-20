/**
 * Global Music Context
 * Holds a single HTMLAudioElement that persists across route changes.
 * The CozyRightPanel reads/writes this context instead of owning its own audio.
 * A floating MiniPlayer renders on every page (via App.tsx) when music is playing.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Track {
  title: string;
  src: string;
  image_url?: string | null;
  artist?: string | null;
}

export interface MusicCategory {
  label: string;
  tracks: Track[];
}

export type LoopMode = 'none' | 'all' | 'one';

// ─── Fallback library ─────────────────────────────────────────────────────────
const MUSIC_FALLBACK: MusicCategory[] = [
  {
    label: 'Lo-fi Chill',
    tracks: [
      { title: 'Cozy Rain', src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
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
        tracks: allTracks
          .filter(t => t.category_id === c.id)
          .map(t => ({ title: t.title, src: t.src, image_url: t.image_url ?? null, artist: t.artist ?? null })),
      }))
      .filter(c => c.tracks.length > 0);
    return lib.length > 0 ? lib : MUSIC_FALLBACK;
  } catch {
    return MUSIC_FALLBACK;
  }
}

// ─── Context shape ────────────────────────────────────────────────────────────
interface MusicContextValue {
  library: MusicCategory[];
  playing: boolean;
  catIdx: number;
  trackIdx: number;
  loopMode: LoopMode;
  volume: number;
  currentTrack: Track;
  currentCat: MusicCategory;
  toggle: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  selectTrack: (ci: number, ti: number) => void;
  cycleLoop: () => void;
  setVolume: (v: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null!);
  const [library, setLibrary] = useState<MusicCategory[]>(MUSIC_FALLBACK);
  const [playing, setPlaying] = useState(false);
  const [catIdx, setCatIdx] = useState(0);
  const [trackIdx, setTrackIdx] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>('all');
  const [volume, setVolumeState] = useState(0.8);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      (audioRef as any).current = new Audio();
    }
    audioRef.current.volume = volume;
  }, []);

  // Load library
  useEffect(() => {
    loadMusicLibrary().then(lib => {
      setLibrary(lib);
      if (audioRef.current && lib[0]?.tracks[0]) {
        audioRef.current.src = lib[0].tracks[0].src;
      }
    });
  }, []);

  const currentCat = library[Math.min(catIdx, library.length - 1)] ?? MUSIC_FALLBACK[0];
  const currentTrack =
    (currentCat?.tracks?.length ?? 0) > 0
      ? currentCat.tracks[Math.min(trackIdx, currentCat.tracks.length - 1)]
      : ({ title: '', src: '', image_url: null, artist: null } as Track);

  // Sync src when track changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack?.src) return;
    el.src = currentTrack.src;
    el.loop = loopMode === 'one';
    if (playing) { const p = el.play(); if (p) p.catch(() => {}); }
  }, [catIdx, trackIdx, library]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'one';
  }, [loopMode]);

  // Auto-advance
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (loopMode === 'one') return;
      if (loopMode === 'all' || trackIdx < currentCat.tracks.length - 1) {
        setTrackIdx(prev => (prev + 1) % currentCat.tracks.length);
      } else {
        setPlaying(false);
      }
    };
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [loopMode, trackIdx, catIdx, currentCat]);

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
      if (p) p.catch(() => {});
      setPlaying(true);
    }
  }, [playing, currentTrack]);

  const skipNext = useCallback(() => {
    setTrackIdx(prev => (prev + 1) % currentCat.tracks.length);
    if (!playing) setPlaying(true);
  }, [trackIdx, currentCat, playing]);

  const skipPrev = useCallback(() => {
    setTrackIdx(prev => (prev - 1 + currentCat.tracks.length) % currentCat.tracks.length);
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
      if (p) p.catch(() => {});
    }
  }, [library]);

  const cycleLoop = useCallback(() => {
    setLoopMode(m => (m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'));
  }, []);

  const setVolume = useCallback((v: number) => {
    const c = Math.max(0, Math.min(1, v));
    setVolumeState(c);
    if (audioRef.current) audioRef.current.volume = c;
  }, []);

  return (
    <MusicContext.Provider
      value={{
        library, playing, catIdx, trackIdx, loopMode, volume,
        currentTrack, currentCat,
        toggle, skipNext, skipPrev, selectTrack, cycleLoop, setVolume,
        audioRef,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within MusicProvider');
  return ctx;
}
