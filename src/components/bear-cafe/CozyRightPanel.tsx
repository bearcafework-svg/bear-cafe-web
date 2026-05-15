import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, SkipBack, SkipForward, Repeat, Repeat1, Library, ChevronLeft, Search, X, Gift, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import honeyJarIcon from '@/assets/HoneyJarIcon.png';
import strawberryIcon from '@/assets/strawberry-icon.png';
import { useMusic } from '@/lib/music-context';
import type { Track, MusicCategory } from '@/lib/music-context';

// ─── Rain ambient hook ────────────────────────────────────────────────────────
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

// ─── Bar Waveform (same as SecretChatRoom) ────────────────────────────────────
const BAR_COUNT = 16;
const BAR_SEEDS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  duration: 0.8 + ((i * 137 + 31) % 9) * 0.1,
  delay:    ((i * 53  + 17) % 11) * 0.06,
  maxH:     14 + ((i * 79  + 11) % 18),
  minH:     3  + ((i * 43  +  7) % 5),
}));

const BarWaveform = memo(({ playing }: { playing: boolean }) => (
  <div className="flex items-end justify-center gap-[3px]" style={{ height: 36 }}>
    {BAR_SEEDS.map((s, i) => (
      <motion.div
        key={i}
        className="rounded-full"
        initial={{ height: s.maxH, scaleY: 0.15, originY: 1 }}
        animate={playing
          ? { scaleY: [s.minH / s.maxH, 1, (s.minH / s.maxH) * 1.3, 0.7, s.minH / s.maxH] }
          : { scaleY: 0.15 }}
        transition={playing
          ? { duration: s.duration, repeat: Infinity, ease: 'easeInOut', delay: s.delay, repeatType: 'mirror' }
          : { duration: 0.5, ease: 'easeOut' }}
        style={{
          height: s.maxH, width: 3, originY: 1, willChange: 'transform',
          background: playing ? 'linear-gradient(to top, #c8956c, #e8b48a)' : 'rgba(200,149,108,0.2)',
        }}
      />
    ))}
  </div>
));

// ─── Vinyl Disc (same visual as SecretChatRoom) ───────────────────────────────
const VinylDisc = memo(({ imageUrl, playing }: { imageUrl?: string | null; playing: boolean }) => (
  <div className="relative flex items-center justify-center">
    <motion.div
      animate={{ rotate: playing ? 360 : 0 }}
      transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      className="w-24 h-24 rounded-full flex items-center justify-center"
      style={{
        willChange: 'transform',
        background: 'conic-gradient(from 0deg, #1e1008, #3a2410, #1e1008, #2a1a0e, #4a2e1a, #1e1008)',
        boxShadow: playing
          ? '0 0 0 3px rgba(200,149,108,0.15), 0 0 24px rgba(200,149,108,0.4), 0 6px 20px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {[28, 34, 40].map(r => (
        <div key={r} className="absolute rounded-full border border-white/[0.05]" style={{ width: r * 2, height: r * 2 }} />
      ))}
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 45%)' }} />
      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#c8956c]/35 shadow-inner z-10">
        {imageUrl
          ? <img src={imageUrl} alt="cover" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#3a2410] to-[#1a0e06] flex items-center justify-center">
              <Music2 className="w-5 h-5 text-[#c8956c]/55" />
            </div>}
      </div>
      <div className="absolute w-3 h-3 rounded-full bg-[#1a0e06] border-2 border-[#c8956c]/35 z-20" />
    </motion.div>
  </div>
));

// ─── Profile Card ─────────────────────────────────────────────────────────────
function ProfileCard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const cardBg = dark
    ? 'linear-gradient(135deg, rgba(58,36,16,0.6), rgba(26,18,13,0.8))'
    : 'linear-gradient(135deg, rgba(255,235,210,0.8), rgba(248,243,237,0.9))';

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-2xl p-4 text-center space-y-3 border"
        style={{ background: cardBg, borderColor: 'rgba(200,149,108,0.2)' }}>
        <div className="w-12 h-12 rounded-full bg-[rgba(200,149,108,0.15)] flex items-center justify-center mx-auto text-2xl">🐻</div>
        <div>
          <p className="text-sm font-bold" style={{ color: dark ? '#f3e9dc' : '#2a1a0e' }}>ยังไม่ได้เข้าสู่ระบบ</p>
          <p className="text-xs mt-0.5" style={{ color: dark ? '#cbb3a0' : '#7c5c3e' }}>เข้าสู่ระบบเพื่อใช้งานเต็มรูปแบบ</p>
        </div>
        <button onClick={() => navigate('/login')}
          className="w-full py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #e0b080, #c8956c)', color: '#fff' }}>
          เข้าสู่ระบบ ☕
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border" style={{ background: cardBg, borderColor: 'rgba(200,149,108,0.2)' }}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 shadow-md shrink-0"
          style={{ borderColor: 'rgba(200,149,108,0.4)' }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-[#e8c49a] to-[#c8956c] flex items-center justify-center text-lg">🐻</div>}
        </div>
        <div className="min-w-0 flex-1">
          {/* Primary: discord display name (may include role prefix like 【👑】) */}
          <p className="font-bold text-sm leading-tight truncate" style={{ color: dark ? '#f3e9dc' : '#2a1a0e' }}>
            {user.discord_username ?? user.username}
          </p>
          {/* Secondary: raw username only when it differs from discord_username */}
          {user.discord_username && user.discord_username !== user.username && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: dark ? '#cbb3a0' : '#7c5c3e' }}>
              {user.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Points Widget ────────────────────────────────────────────────────────────
function PointsWidget() {
  const { user, isAuthenticated } = useAuth();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [points, setPoints] = useState(0);
  const [maxCap, setMaxCap] = useState(500);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [redeemMsg, setRedeemMsg] = useState('');

  // colour tokens
  const cardBg    = dark ? 'rgba(22,14,9,0.95)'     : 'rgba(250,246,242,0.95)';
  const border    = dark ? 'rgba(200,149,108,0.18)' : 'rgba(200,149,108,0.15)';
  const textPri   = dark ? '#f3e9dc' : '#2a1a0e';
  const textSec   = dark ? '#cbb3a0' : '#7c5c3e';
  const textMuted = dark ? 'rgba(203,179,160,0.5)' : 'rgba(156,124,94,0.6)';
  const accent    = dark ? '#e0b48a' : '#c8956c';

  const fetchPoints = useCallback(async () => {
    if (!user?.discord_id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('user_points')
        .select('points, max_cap')
        .eq('discord_id', user.discord_id)
        .maybeSingle();
      if (data) {
        setPoints(data.points ?? 0);
        setMaxCap(data.max_cap ?? 500);
      }
    } catch {}
    setLoading(false);
  }, [user?.discord_id]);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  // Poll every 30s (lighter than PointsPage's 10s — this is a sidebar widget)
  useEffect(() => {
    if (!user?.discord_id) return;
    const id = setInterval(() => fetchPoints(), 30_000);
    return () => clearInterval(id);
  }, [fetchPoints, user?.discord_id]);

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code || !user?.discord_id) return;
    setRedeemStatus('loading');
    setRedeemMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { userId: user.discord_id, code },
      });
      if (error) throw error;
      if (!data.ok) {
        const msgs: Record<string, string> = {
          code_used: 'โค้ดนี้ถูกใช้ไปแล้ว', invalid_code: 'ไม่พบโค้ดนี้',
          expired: 'โค้ดหมดอายุแล้ว', already_redeemed: 'คุณเคยใช้โค้ดนี้แล้ว',
          limit_reached: 'โค้ดถูกใช้ครบโควต้าแล้ว', disabled: 'โค้ดถูกปิดใช้งาน',
        };
        setRedeemStatus('error');
        setRedeemMsg(msgs[data.error] ?? 'โค้ดไม่ถูกต้อง');
        return;
      }
      const raw = data.pointsNow ?? (typeof data.points === 'number' ? data.points : Number(data.points));
      if (Number.isFinite(raw)) setPoints(Math.min(raw, maxCap));
      setRedeemStatus('success');
      setRedeemMsg(data.granted?.pointsAdded ? `+${data.granted.pointsAdded} 🍓` : 'รับรางวัลสำเร็จ');
      setRedeemCode('');
      setTimeout(() => { setRedeemStatus('idle'); setRedeemMsg(''); }, 4000);
      fetchPoints();
    } catch {
      setRedeemStatus('error');
      setRedeemMsg('ระบบขัดข้อง ลองใหม่อีกครั้ง');
    }
  };

  if (!isAuthenticated || !user) return null;

  const pct = maxCap > 0 ? Math.min((points / maxCap) * 100, 100) : 0;

  return (
    <div className="rounded-2xl overflow-hidden border flex flex-col" style={{ background: cardBg, borderColor: border }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <img src={strawberryIcon} alt="" className="w-4 h-4 object-contain" />
          <span className="text-xs font-bold" style={{ color: textSec }}>แต้มสะสม</span>
        </div>
        {loading && <Sparkles className="w-3 h-3 animate-pulse" style={{ color: accent }} />}
      </div>

      {/* Points display */}
      <div className="px-4 pb-3 space-y-2.5">
        {/* Big number */}
        <div className="flex items-end gap-1.5">
          <span className="text-3xl font-bold leading-none" style={{ color: textPri }}>
            {loading ? '—' : points.toLocaleString()}
          </span>
          <span className="text-xs pb-0.5" style={{ color: textMuted }}>/ {maxCap.toLocaleString()}</span>
          <span className="text-base pb-0.5 ml-0.5">🍓</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: 'linear-gradient(to right, #c8956c, #e8b48a)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {/* Pct label removed */}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: border }} />

      {/* Redeem code */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Gift className="w-3 h-3" style={{ color: accent }} />
          <span className="text-[11px] font-semibold" style={{ color: textSec }}>กรอกโค้ดรับรางวัล</span>
        </div>

        <div className="flex gap-2">
          <input
            value={redeemCode}
            onChange={e => setRedeemCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder="โค้ดของคุณ..."
            className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-xs outline-none border"
            style={{
              background: dark ? 'rgba(200,149,108,0.06)' : 'rgba(200,149,108,0.07)',
              borderColor: border,
              color: textPri,
            }}
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleRedeem}
            disabled={redeemStatus === 'loading' || !redeemCode.trim()}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #e0b080, #c8956c)' }}
          >
            {redeemStatus === 'loading' ? '...' : 'ยืนยัน'}
          </motion.button>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {redeemMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              {redeemStatus === 'success'
                ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                : <XCircle className="w-3 h-3 text-destructive shrink-0" />}
              <span className="text-[11px]" style={{ color: redeemStatus === 'success' ? '#10b981' : '#ef4444' }}>
                {redeemMsg}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Music Player Widget ──────────────────────────────────────────────────────
function MusicPlayerWidget() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  // Use global music context — audio persists across page navigation
  const player = useMusic();
  const rain = useRainAmbient();
  const [view, setView] = useState<'player' | 'library'>('player');
  const [searchQuery, setSearchQuery] = useState('');

  // colour tokens matching SecretChatRoom
  const panelBg      = dark ? 'rgba(22,14,9,0.95)'     : 'rgba(250,246,242,0.95)';
  const textPrimary  = dark ? '#f3e9dc' : '#2a1a0e';
  const textSecondary= dark ? '#cbb3a0' : '#7c5c3e';
  const textAccent   = dark ? '#e0b48a' : '#c8956c';
  const textMuted    = dark ? 'rgba(203,179,160,0.5)' : 'rgba(156,124,94,0.6)';
  const borderAccent = dark ? 'rgba(200,149,108,0.18)' : 'rgba(200,149,108,0.15)';
  const trackActiveBg= dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.1)';
  const thumbBg      = dark ? 'rgba(255,255,255,0.06)' : 'rgba(232,217,200,0.5)';

  // Flat track list for library search
  const allTracks = useMemo(() => {
    const result: Array<{ track: Track; ci: number; ti: number; catLabel: string }> = [];
    player.library.forEach((cat, ci) => {
      cat.tracks.forEach((t, ti) => result.push({ track: t, ci, ti, catLabel: cat.label }));
    });
    return result;
  }, [player.library]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return allTracks;
    const q = searchQuery.toLowerCase();
    return allTracks.filter(({ track }) =>
      track.title.toLowerCase().includes(q) || (track.artist ?? '').toLowerCase().includes(q)
    );
  }, [allTracks, searchQuery]);

  if (player.library.length === 0 || (player.library.length === 1 && player.library[0].tracks.length === 0)) {
    return (
      <div className="rounded-2xl p-5 text-center border" style={{ background: panelBg, borderColor: borderAccent }}>
        <p className="text-xs" style={{ color: textMuted }}>ยังไม่มีเพลงในระบบ</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border flex flex-col" style={{ background: panelBg, borderColor: borderAccent }}>
      <AnimatePresence mode="wait" initial={false}>

        {/* ── PLAYER VIEW ── */}
        {view === 'player' && (
          <motion.div key="player"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <img src={honeyJarIcon} alt="" className="w-4 h-4 object-contain" />
                <span className="text-xs font-bold" style={{ color: textSecondary }}>เพลงตอนนี้</span>
              </div>
              <button onClick={() => setView('library')}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ color: textMuted }} title="คลังเพลง">
                <Library className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Vinyl */}
            <div className="flex justify-center py-3">
              <VinylDisc imageUrl={player.currentTrack?.image_url} playing={player.playing} />
            </div>

            {/* Track info */}
            <div className="px-4 text-center space-y-0.5 pb-1">
              <motion.p key={player.currentTrack?.title}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="font-bold text-sm leading-tight truncate" style={{ color: textPrimary }}>
                {player.currentTrack?.title ?? '—'}
              </motion.p>
              {player.currentTrack?.artist && (
                <p className="text-[11px] truncate font-medium" style={{ color: textAccent }}>
                  {player.currentTrack.artist}
                </p>
              )}
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <div className="h-px flex-1 max-w-[32px]"
                  style={{ background: `linear-gradient(to right, transparent, ${textAccent}44)` }} />
                <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: textMuted }}>
                  {player.currentCat?.label ?? ''}
                </p>
                <div className="h-px flex-1 max-w-[32px]"
                  style={{ background: `linear-gradient(to left, transparent, ${textAccent}44)` }} />
              </div>
            </div>

            {/* Waveform */}
            <div className="px-4 py-1">
              <BarWaveform playing={player.playing} />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 px-4 pb-2">
              {/* Loop */}
              <button onClick={player.cycleLoop}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{
                  color: player.loopMode !== 'none' ? textAccent : textMuted,
                  background: player.loopMode !== 'none' ? `${textAccent}22` : 'transparent',
                }}>
                {player.loopMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
              </button>

              {/* Prev */}
              <button onClick={player.skipPrev}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
                style={{ color: textSecondary }}>
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play/Pause */}
              <motion.button whileTap={{ scale: 0.92 }} onClick={player.toggle}
                className="w-14 h-14 rounded-full text-white flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #e0b080, #c8956c, #b07d58)',
                  boxShadow: player.playing
                    ? '0 4px 18px rgba(200,149,108,0.5), 0 2px 6px rgba(0,0,0,0.15)'
                    : '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                {player.playing
                  ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="2" />
                      <rect x="14" y="4" width="4" height="16" rx="2" />
                    </svg>
                  : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>}
              </motion.button>

              {/* Next */}
              <button onClick={player.skipNext}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
                style={{ color: textSecondary }}>
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Rain toggle */}
              <button onClick={rain.toggle}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors text-base"
                style={{
                  background: rain.on ? 'rgba(96,165,250,0.18)' : 'transparent',
                  color: rain.on ? '#60a5fa' : textMuted,
                  outline: rain.on ? '1.5px solid rgba(96,165,250,0.4)' : 'none',
                }}
                title={rain.on ? 'ปิดเสียงฝน' : 'เปิดเสียงฝน'}>
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
                  className="px-4 pb-2 overflow-hidden"
                >
                  <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <span className="text-sm shrink-0">🌧</span>
                    <div className="relative flex-1 flex items-center" style={{ height: 26 }}>
                      <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(96,165,250,0.15)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${rain.volume * 100}%`, background: 'linear-gradient(to right, #60a5fa, #93c5fd)' }} />
                        </div>
                      </div>
                      <input type="range" min={0} max={100} step={1} value={Math.round(rain.volume * 100)}
                        onChange={e => rain.setVolume(Number(e.target.value) / 100)}
                        className="w-full absolute inset-0"
                        style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }} />
                      <span className="absolute text-sm pointer-events-none select-none"
                        style={{ left: `calc(${rain.volume * 100}% - 9px)`, top: '50%', transform: 'translateY(-50%)', zIndex: 20, lineHeight: 1 }}>
                        🌧
                      </span>
                    </div>
                    <span className="shrink-0 text-[9px] font-mono tabular-nums w-5 text-right"
                      style={{ color: 'rgba(96,165,250,0.7)' }}>
                      {Math.round(rain.volume * 100)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Volume slider — honey jar thumb */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl"
                style={{ background: dark ? 'rgba(200,149,108,0.06)' : 'rgba(200,149,108,0.07)', border: `1px solid ${borderAccent}` }}>
                <button onClick={() => player.setVolume(player.volume > 0 ? 0 : 0.8)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: textMuted }}>
                  {player.volume === 0
                    ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>}
                </button>

                <div className="relative flex-1 flex items-center" style={{ height: 28 }}>
                  {/* Track fill */}
                  <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
                    <div className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ background: dark ? 'rgba(200,149,108,0.12)' : 'rgba(200,149,108,0.15)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${player.volume * 100}%`, background: 'linear-gradient(to right, #c8956c, #e8b48a)' }} />
                    </div>
                  </div>
                  {/* Range input */}
                  <input type="range" min={0} max={100} step={1} value={Math.round(player.volume * 100)}
                    onChange={e => player.setVolume(Number(e.target.value) / 100)}
                    className="w-full absolute inset-0"
                    style={{ opacity: 0.001, cursor: 'pointer', height: '100%', margin: 0, padding: 0, touchAction: 'none' }} />
                  {/* Honey jar thumb */}
                  <img src={honeyJarIcon} alt="" draggable={false}
                    style={{
                      position: 'absolute',
                      left: `calc(${player.volume * 100}% - 10px)`,
                      top: '50%', transform: 'translateY(-50%)',
                      width: 20, height: 20,
                      pointerEvents: 'none', userSelect: 'none', zIndex: 20,
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))',
                    }} />
                </div>

                <span className="shrink-0 text-[9px] font-mono tabular-nums w-5 text-right" style={{ color: textMuted }}>
                  {player.volume === 0 ? '—' : Math.round(player.volume * 100)}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LIBRARY VIEW ── */}
        {view === 'library' && (
          <motion.div key="library"
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
              <button onClick={() => { setView('player'); setSearchQuery(''); }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ color: textMuted }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold flex-1" style={{ color: textSecondary }}>คลังเพลง</span>
              <span className="text-[10px]" style={{ color: textMuted }}>{allTracks.length} เพลง</span>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: dark ? 'rgba(200,149,108,0.08)' : 'rgba(200,149,108,0.1)', border: `1px solid ${borderAccent}` }}>
                <Search className="w-3 h-3 shrink-0" style={{ color: textMuted }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาเพลง..."
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

            {/* Track list */}
            <div className="overflow-y-auto max-h-72 pb-3" style={{ borderTop: `1px solid ${borderAccent}` }}>
              {filteredTracks.length === 0 ? (
                <p className="text-center text-xs py-6" style={{ color: textMuted }}>ไม่พบเพลง</p>
              ) : (
                filteredTracks.map(({ track, ci, ti, catLabel }) => {
                  const isActive = ci === player.catIdx && ti === player.trackIdx;
                  return (
                    <button key={`${ci}-${ti}`}
                      onClick={() => { player.selectTrack(ci, ti); setView('player'); }}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:opacity-70"
                      style={{ background: isActive ? trackActiveBg : 'transparent' }}>
                      {/* Thumb */}
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                        style={{ background: isActive ? 'transparent' : thumbBg, outline: isActive ? `2px solid ${textAccent}55` : 'none' }}>
                        {track.image_url
                          ? <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                          : isActive && player.playing
                            ? <div className="flex gap-[2px] items-end h-4 w-full justify-center">
                                {[0, 0.1, 0.2].map((d, i) => (
                                  <motion.div key={i} className="w-0.5 rounded-full"
                                    style={{ background: textAccent, height: 8, originY: 0.5 }}
                                    animate={{ scaleY: [0.4, 1, 0.4] }}
                                    transition={{ duration: 0.55, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
                                ))}
                              </div>
                            : <Music2 className="w-3.5 h-3.5" style={{ color: textMuted }} />}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate"
                          style={{ color: isActive ? textAccent : textPrimary }}>
                          {track.title}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: textMuted }}>
                          {track.artist ?? catLabel}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CozyRightPanel() {
  return (
    <aside className="w-[264px] shrink-0 flex flex-col gap-4 h-[100dvh] overflow-y-auto py-5 px-3">
      <ProfileCard />
      <PointsWidget />
      <MusicPlayerWidget />
    </aside>
  );
}
