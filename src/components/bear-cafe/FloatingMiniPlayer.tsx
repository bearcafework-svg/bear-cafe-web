/**
 * FloatingMiniPlayer
 * Appears as a fixed bottom-right pill on every page EXCEPT the homepage ("/").
 * Shows only when music is playing. Clicking expands to a small popup panel.
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useMusic } from '@/lib/music-context';
import { SkipBack, SkipForward, X, Music2 } from 'lucide-react';
import honeyJarIcon from '@/assets/HoneyJarIcon.png';

export function FloatingMiniPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const music = useMusic();
  const [expanded, setExpanded] = useState(false);

  // Hide on homepage — the right panel already shows the full player there
  if (location.pathname === '/') return null;
  // Hide on secret chat room — it has its own built-in music player
  if (location.pathname === '/secret-chat/room') return null;
  // Hide if nothing is playing and never played
  if (!music.playing && !music.currentTrack?.title) return null;

  const textPri  = dark ? '#f3e9dc' : '#2a1a0e';
  const textSec  = dark ? '#cbb3a0' : '#8B5E3C';
  const textMuted= dark ? 'rgba(203,179,160,0.5)' : 'rgba(139,94,60,0.55)';
  const bg       = dark ? 'rgba(22,14,9,0.96)'    : 'rgba(248,235,216,0.97)';
  const border   = dark ? 'rgba(200,149,108,0.22)' : 'rgba(200,149,108,0.3)';
  const vinylBg  = dark
    ? 'conic-gradient(from 0deg, #1e1008, #3a2410, #1e1008)'
    : 'conic-gradient(from 0deg, #3a2410, #5c3820, #3a2410)';

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
            className="rounded-2xl overflow-hidden w-64"
            style={{
              background: bg,
              border: `1px solid ${border}`,
              boxShadow: dark
                ? '0 8px 32px rgba(200,149,108,0.18), 0 2px 12px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(139,94,60,0.15), 0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <img src={honeyJarIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                <span className="text-[11px] font-bold" style={{ color: textSec }}>เพลงตอนนี้</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { navigate('/'); setExpanded(false); }}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                  style={{ color: textMuted, background: dark ? 'rgba(200,149,108,0.08)' : 'rgba(200,149,108,0.1)' }}
                  title="ไปหน้าหลัก"
                >
                  เปิดเพลย์เยอร์
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
            <div className="flex items-center gap-3 px-4 pb-3">
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

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 px-4 pb-4">
              <button onClick={music.skipPrev}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ color: textSec }}>
                <SkipBack className="w-3.5 h-3.5" />
              </button>

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

              <button onClick={music.skipNext}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ color: textSec }}>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress bar (visual only — no seek) */}
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
      </AnimatePresence>

      {/* Pill trigger */}
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
