/**
 * FloatingMiniPlayer
 * Appears as a fixed bottom-right pill on every page EXCEPT the homepage ("/").
 * Shows only when music is playing AND user is authenticated.
 * Clicking expands to a popup panel with volume, rain, library controls.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useMusic } from '@/lib/music-context';
import { useAuth } from '@/lib/auth-context';
import { SkipBack, SkipForward, X, Music2, Library, ChevronLeft, Search, Repeat, Repeat1 } from 'lucide-react';
import honeyJarIcon from '@/assets/HoneyJarIcon.png';
import type { Track } from '@/lib/music-context';

// ─── Rain ambient (same logic as CozyRightPanel) ──────────────────────────────
function useRainAmbient() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [volume, setVolumeState] = useState(0.4);

  useEffect(() => {
    const el = new Audio('/RainSounds.mp3');
    el.loop = true;
    el.volume = 0.4;
    el.preload = 'auto';
    audioRef.current = el;
    return () => { el.pause(); el.src = ''; };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (on) { el.pause(); setOn(false); }
    else { const p = el.play(); if (p) p.catch(() => {}); setOn(true); }
  }, [on]);

  const setVolume = useCallback((v: number) => {
    const c = Math.max(0, Math.min(1, v));
    setVolumeState(c);
    if (audioRef.current) audioRef.current.volume = c;
  }, []);

  return { on, toggle, volume, setVolume };
}

export function FloatingMiniPlayer() {
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const music = useMusic();
  const { isAuthenticated } = useAuth();
  const rain = useRainAmbient();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'player' | 'library'>('player');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Hide conditions ──────────────────────────────────────────────────────────
  // Hide if not logged in
  if (!isAuthenticated) return null;
  // Hide on homepage — the right panel already shows the full player there
  if (location.pathname === '/') return null;
  // Hide on secret chat room — it has its own built-in music player
  if (location.pathname === '/secret-chat/room') return null;
  // Hide if nothing is playing and never played
  if (!music.playing && !music.currentTrack?.title) return null;

  // ── Colour tokens ────────────────────────────────────────────────────────────
  const textPri   = dark ? '#f3e9dc' : '#2a1a0e';
  const textSec   = dark ? '#cbb3a0' : '#8B5E3C';
  const textMuted = dark ? 'rgba(203,179,160,0.5)' : 'rgba(139,94,60,0.55)';
  const textAccent= dark ? '#e0b48a' : '#c8956c';
  const bg        = dark ? 'rgba(22,14,9,0.96)'    : 'rgba(248,235,216,0.97)';
  const border    = dark ? 'rgba(200,149,108,0.22)' : 'rgba(200,149,108,0.3)';
  const vinylBg   = dark
    ? 'conic-gradient(from 0deg, #1e1008, #3a2410, #1e1008)'
    : 'conic-gradient(from 0deg, #3a2410, #5c3820, #3a2410)';
  const trackActiveBg = dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.1)';

  // ── Library data ─────────────────────────────────────────────────────────────
  const allTracks = useMemo(() => {
    const result: Array<{ track: Track; ci: number; ti: number; catLabel: string }> = [];
    music.library.forEach((cat, ci) => {
      cat.tracks.forEach((t, ti) => result.push({ track: t, ci, ti, catLabel: cat.label }));
    });
    return result;
  }, [music.library]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return allTracks;
    const q = searchQuery.toLowerCase();
    return allTracks.filter(({ track }) =>
      track.title.toLowerCase().includes(q) || (track.artist ?? '').toLowerCase().includes(q)
    );
  }, [allTracks, searchQuery]);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="popup"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="rounded-2xl overflow-hidden w-72"
            style={{
              background: bg,
              border: `1px solid ${border}`,
              boxShadow: dark
                ? '0 8px 32px rgba(200,149,108,0.18), 0 2px 12px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(139,94,60,0.15), 0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>

              {/* ══ PLAYER VIEW ══ */}
              {view === 'player' && (
                <motion.div key="player"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <img src={honeyJarIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                      <span className="text-[11px] font-bold" style={{ color: textSec }}>เพลงตอนนี้</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Library button */}
                      <button
                        onClick={() => setView('library')}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        style={{ color: textMuted }}
                        title="คลังเพลง"
                      >
                        <Library className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setExpanded(false)}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ color: textMuted }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Album art + info */}
                  <div className="flex items-center gap-3 px-4 pb-2">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: vinylBg }}>
                      {music.currentTrack?.image_url
                        ? <img src={music.currentTrack.image_url} alt="" className="w-full h-full object-cover" />
                        : <Music2 className="w-4 h-4 text-[#c8956c]/60" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: textPri }}>
                        {music.currentTrack?.title ?? '—'}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: textMuted }}>
                        {music.currentTrack?.artist ?? music.currentCat?.label ?? 'Bear Cafe'}
                      </p>
                    </div>
                  </div>

                  {/* Controls row */}
                  <div className="flex items-center justify-center gap-2 px-4 pb-2">
                    {/* Loop */}
                    <button onClick={music.cycleLoop}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                      style={{
                        color: music.loopMode !== 'none' ? textAccent : textMuted,
                        background: music.loopMode !== 'none' ? `${textAccent}22` : 'transparent',
                      }}>
                      {music.loopMode === 'one'
                        ? <Repeat1 className="w-3 h-3" />
                        : <Repeat className="w-3 h-3" />}
                    </button>

                    {/* Prev */}
                    <button onClick={music.skipPrev}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                      style={{ color: textSec }}>
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>

                    {/* Play/Pause */}
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={music.toggle}
                      className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-md"
                      style={{ background: 'linear-gradient(145deg, #E9A84E, #c8956c, #b07d58)' }}
                    >
                      {music.playing
                        ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="2" />
                            <rect x="14" y="4" width="4" height="16" rx="2" />
                          </svg>
                        : <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>}
                    </motion.button>

                    {/* Next */}
                    <button onClick={music.skipNext}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                      style={{ color: textSec }}>
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>

                    {/* Rain toggle */}
                    <button onClick={rain.toggle}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-colors text-sm"
                      style={{
                        background: rain.on
                          ? dark ? 'rgba(180,160,140,0.18)' : 'rgba(160,130,100,0.14)'
                          : 'transparent',
                        color: rain.on ? textAccent : textMuted,
                        outline: rain.on ? `1.5px solid ${border}` : 'none',
                      }}
                      title={rain.on ? 'ปิดเสียงฝน' : 'เสียงฝน'}>
                      🌧
                    </button>
                  </div>

                  {/* Rain volume — visible only when rain is on */}
                  <AnimatePresence>
                    {rain.on && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl mb-1"
                          style={{ background: dark ? 'rgba(200,149,108,0.06)' : 'rgba(200,149,108,0.07)', border: `1px solid ${border}` }}>
                          <span className="text-xs shrink-0">🌧</span>
                          <div className="relative flex-1 flex items-center" style={{ height: 22 }}>
                            <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                              <div className="w-full h-1.5 rounded-full overflow-hidden"
                                style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
                                <div className="h-full rounded-full"
                                  style={{ width: `${rain.volume * 100}%`, background: 'linear-gradient(to right, #b07d58, #c8956c)' }} />
                              </div>
                            </div>
                            <input type="range" min={0} max={100} step={1} value={Math.round(rain.volume * 100)}
                              onChange={e => rain.setVolume(Number(e.target.value) / 100)}
                              className="w-full absolute inset-0"
                              style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }} />
                            <span className="absolute text-xs pointer-events-none select-none"
                              style={{ left: `calc(${rain.volume * 100}% - 8px)`, top: '50%', transform: 'translateY(-50%)', zIndex: 20, lineHeight: 1 }}>
                              🌧
                            </span>
                          </div>
                          <span className="shrink-0 text-[9px] font-mono tabular-nums w-5 text-right"
                            style={{ color: textMuted }}>
                            {Math.round(rain.volume * 100)}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Music volume slider */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl"
                      style={{ background: dark ? 'rgba(200,149,108,0.06)' : 'rgba(200,149,108,0.07)', border: `1px solid ${border}` }}>
                      {/* Mute toggle */}
                      <button onClick={() => music.setVolume(music.volume > 0 ? 0 : 0.8)}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors"
                        style={{ color: textMuted }}>
                        {music.volume === 0
                          ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>}
                      </button>

                      {/* Slider */}
                      <div className="relative flex-1 flex items-center" style={{ height: 22 }}>
                        <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                          <div className="w-full h-1.5 rounded-full overflow-hidden"
                            style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${music.volume * 100}%`, background: 'linear-gradient(to right, #c8956c, #e8b48a)' }} />
                          </div>
                        </div>
                        <input type="range" min={0} max={100} step={1} value={Math.round(music.volume * 100)}
                          onChange={e => music.setVolume(Number(e.target.value) / 100)}
                          className="w-full absolute inset-0"
                          style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }} />
                        <img src={honeyJarIcon} alt=""
                          className="absolute pointer-events-none select-none"
                          style={{ width: 16, height: 16, objectFit: 'contain', left: `calc(${music.volume * 100}% - 8px)`, top: '50%', transform: 'translateY(-50%)', zIndex: 20 }} />
                      </div>

                      <span className="shrink-0 text-[9px] font-mono tabular-nums w-5 text-right"
                        style={{ color: textMuted }}>
                        {Math.round(music.volume * 100)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar (visual only) */}
                  <div className="mx-4 mb-3 h-1 rounded-full overflow-hidden"
                    style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
                    {music.playing && (
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(to right, #c8956c, #E9A84E)' }}
                        animate={{ width: ['0%', '100%'] }}
                        transition={{ duration: 180, ease: 'linear', repeat: Infinity }}
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {/* ══ LIBRARY VIEW ══ */}
              {view === 'library' && (
                <motion.div key="library"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="flex flex-col"
                  style={{ maxHeight: 360 }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
                    <button onClick={() => setView('player')}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      style={{ color: textMuted }}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold flex-1" style={{ color: textSec }}>คลังเพลง</span>
                    <button onClick={() => setExpanded(false)}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ color: textMuted }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-4 pb-2 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                      style={{ background: dark ? 'rgba(200,149,108,0.06)' : 'rgba(200,149,108,0.07)', border: `1px solid ${border}` }}>
                      <Search className="w-3 h-3 shrink-0" style={{ color: textMuted }} />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาเพลง..."
                        className="flex-1 bg-transparent text-[11px] outline-none"
                        style={{ color: textPri }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ color: textMuted }}>
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Track list */}
                  <div className="overflow-y-auto px-2 pb-3" style={{ maxHeight: 260 }}>
                    {filteredTracks.length === 0 ? (
                      <p className="text-center text-[11px] py-4" style={{ color: textMuted }}>ไม่พบเพลง</p>
                    ) : (
                      filteredTracks.map(({ track, ci, ti, catLabel }) => {
                        const isActive = music.currentTrack?.src === track.src;
                        return (
                          <button
                            key={`${ci}-${ti}`}
                            onClick={() => { music.selectTrack(ci, ti); setView('player'); }}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors"
                            style={{ background: isActive ? trackActiveBg : 'transparent' }}
                          >
                            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                              style={{ background: vinylBg }}>
                              {track.image_url
                                ? <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                                : <Music2 className="w-3 h-3 text-[#c8956c]/60" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold truncate leading-tight"
                                style={{ color: isActive ? textAccent : textPri }}>
                                {track.title}
                              </p>
                              <p className="text-[9px] truncate" style={{ color: textMuted }}>
                                {track.artist ?? catLabel}
                              </p>
                            </div>
                            {isActive && music.playing && (
                              <div className="flex items-end gap-[2px] shrink-0">
                                {[0, 0.1, 0.2].map((d, i) => (
                                  <motion.div key={i} className="w-0.5 rounded-full"
                                    style={{ background: textAccent, height: 8, originY: 1 }}
                                    animate={{ scaleY: [0.3, 1, 0.3] }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pill trigger ── */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-xl"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: music.playing
            ? '0 4px 20px rgba(200,149,108,0.35), 0 2px 8px rgba(0,0,0,0.15)'
            : '0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        {/* Mini vinyl */}
        <motion.div
          animate={{ rotate: music.playing ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'conic-gradient(from 0deg, #1e1008, #3a2410, #1e1008, #2a1a0e, #4a2e1a, #1e1008)',
            boxShadow: music.playing ? '0 0 10px rgba(200,149,108,0.5)' : '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          {music.currentTrack?.image_url
            ? <img src={music.currentTrack.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            : <div className="w-3 h-3 rounded-full bg-[#1a0e06] border border-[#c8956c]/30" />}
        </motion.div>

        {/* Track name */}
        <div className="max-w-[120px] min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: textPri }}>
            {music.currentTrack?.title ?? 'Bear Cafe Music'}
          </p>
          {music.playing && (
            <div className="flex items-end gap-[2px] mt-0.5 h-2.5">
              {[0, 0.1, 0.2, 0.3].map((d, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full"
                  style={{ background: '#c8956c', height: 8, originY: 1 }}
                  animate={{ scaleY: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: d, ease: 'easeInOut' }}
                />
              ))}
            </div>
          )}
        </div>
      </motion.button>
    </div>
  );
}
