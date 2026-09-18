import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { refreshServerFromDiscord } from '@/lib/discord-server-refresh';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/bear-cafe/Footer';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { ExpiredServerCard } from '@/components/discord/ExpiredServerCard';
import { EditLinkDialog } from '@/components/discord/EditLinkDialog';
import { EditVibeDialog } from '@/components/discord/EditVibeDialog';
import { FindYourVibeDialog } from '@/components/discord/FindYourVibeDialog';
import discordLogo from '@/assets/discord-logo-wordmark.png';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Plus, Users, Info, Loader2,
  Search, ArrowUp, Clock, Globe, Eye, MousePointerClick,
  AlertTriangle, LinkIcon, Timer, Trash2, ChevronLeft, ChevronRight, Star,
  Filter, LogIn, ShieldCheck, Handshake, RefreshCw, Flame, Trophy, Heart, Bookmark, Sparkles, Tag, ChevronDown, X,
  MoreHorizontal, Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  trackDiscoveryEvent,
  trackSearchIntent,
  calculateRisingGrowth,
  DISCOVERY_CONSTANTS,
} from '@/lib/discovery-tracker';
import {
  calculateListingFreshness,
  normalizeDiscoveryQuality,
  calculateDecayedPenalty,
  RECOMMENDATION_CONSTANTS,
  UserStateType,
} from '@/lib/recommendation-engine';
import {
  CURATED_TRAITS,
  getTraitById,
  VIBE_GOALS,
  VIBE_ATMOSPHERES,
  type DiscordTrait,
  type ServerVibeProfile,
} from '@/lib/discord-traits';
import {
  calculateWeeklyActiveScore,
  getTimeSince,
  isRainbow,
  getHighlightCardStyle,
  getNameHighlightClass,
  getNameHighlightStyle,
} from '@/lib/discord-server-helpers';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; icon: string; }

interface DiscordServer {
  id: string;
  discord_id: string;
  name: string;
  description: string | null;
  member_count: number | null;
  icon_url: string | null;
  banner_url: string | null;
  invite_url: string;
  status: string | null;
  owner_id: string;
  category_id: string | null;
  bumped_at: string | null;
  bump_count?: number | null;
  click_count: number | null;
  impression_count: number | null;
  is_featured: boolean | null;
  is_verified: boolean;
  is_partner: boolean;
  highlight_color: string | null;
  carousel_order: number | null;
  invite_status: "valid" | "expired" | "unknown";
  invite_last_checked_at: string | null;
  created_at?: string;
  // Live Activity from Akari Bot (Phase 1)
  live_voice_count?: number | null;
  weekly_joins_count?: number | null;
  has_akari_bot?: boolean | null;
  activity_synced_at?: string | null;
  // Phase 2: Traits & Server Type
  server_type?: 'community' | 'shop' | null;
  traits?: string[] | null;
  server_profile?: ServerVibeProfile | null;
  // joined client-side / discovery engine
  avg_rating?: number;
  rating_count?: number;
  my_rating?: number;
  save_count?: number;
  is_saved?: boolean;
  discovery_score?: number;
  recent_clicks?: number;
  recent_saves?: number;
  previous_clicks?: number;
  previous_saves?: number;
  growth_rate?: number | null;
  is_new_breakout?: boolean;
  is_rising?: boolean;
  is_new?: boolean;
  // Plan 2: Personalized Recommendation
  recommendation_score?: number;
  recommendation_reason?: string;
  is_exploration?: boolean;
  user_state?: UserStateType | string;
  // Carousel Trending & Active (Real Weekly Data)
  trending_active_score?: number;
  trending_badge?: {
    text: string;
    color: string;
  };
}

// ─── Smart Image Fallback Components ──────────────────────────────────────────
function SafeServerBanner({
  url,
  alt = '',
  className,
  imgRef,
  style,
  isExpired,
}: {
  url?: string | null;
  alt?: string;
  className?: string;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  style?: React.CSSProperties;
  isExpired?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return (
      <div className={cn('w-full h-full bg-gradient-to-br from-amber-600/25 via-amber-900/20 to-stone-900/40 relative overflow-hidden', className)}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/15 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={url}
      alt={alt}
      className={cn(className, isExpired && 'grayscale-[40%]')}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function SafeServerIcon({
  url,
  name,
  className,
  fallbackClassName,
  textClassName = 'text-white text-base sm:text-lg font-black',
  isExpired,
}: {
  url?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  textClassName?: string;
  isExpired?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';

  if (!url || failed) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-700 select-none shadow-inner', fallbackClassName)}>
        <span className={textClassName}>{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={cn(className, isExpired && 'grayscale-[30%]')}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Bump countdown ───────────────────────────────────────────────────────────
function useBumpCountdown(bumpedAt: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  const [canBump, setCanBump] = useState(false);

  useEffect(() => {
    if (!bumpedAt) { setCanBump(true); return; }
    const cooldownEnd = new Date(bumpedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
    const update = () => {
      const now = Date.now();
      if (now >= cooldownEnd) { setCanBump(true); setTimeLeft(''); return false; }
      setCanBump(false);
      const diff = cooldownEnd - now;
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(d > 0 ? `${d}ว ${h}ชม` : h > 0 ? `${h}ชม ${m}น` : `${m}น`);
      return true;
    };
    if (!update()) return;
    const id = setInterval(() => { if (!update()) clearInterval(id); }, 60000);
    return () => clearInterval(id);
  }, [bumpedAt]);

  return { timeLeft, canBump };
}

function BumpButton({ server, user, onBump, bumpingId }: {
  server: DiscordServer; user: any; onBump: (id: string) => void; bumpingId: string | null;
}) {
  const { timeLeft, canBump } = useBumpCountdown(server.bumped_at);
  if (!user || server.owner_id !== user.discord_id) return null;
  return (
    <Button
      size="sm" variant="outline"
      className={`rounded-full px-3 text-xs border-border/50 ${!canBump ? 'opacity-70' : ''}`}
      onClick={() => canBump && onBump(server.id)}
      disabled={bumpingId === server.id || !canBump}
    >
      {bumpingId === server.id ? <Loader2 className="w-3 h-3 animate-spin" />
        : canBump ? <><ArrowUp className="w-3 h-3 mr-1" />ดันเซิร์ฟ</>
        : <><Timer className="w-3 h-3 mr-1" />{timeLeft}</>}
    </Button>
  );
}

// ─── Star Rating widget ───────────────────────────────────────────────────────
function StarRating({
  serverId, myRating, avgRating, ratingCount, userId, onRated,
}: {
  serverId: string; myRating: number; avgRating: number; ratingCount: number;
  userId: string | null; onRated: (serverId: string, rating: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleRate = async (star: number) => {
    if (!userId) {
      toast({ title: 'กรุณาเข้าสู่ระบบก่อนให้คะแนน', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await (supabase.from('server_ratings' as any).upsert(
        { server_id: serverId, user_id: userId, rating: star } as any,
        { onConflict: 'server_id,user_id' }
      )) as any;
      onRated(serverId, star);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const display = hover || myRating;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-0.5 sm:space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving}
            onClick={() => handleRate(star)}
            onMouseEnter={() => {
              if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                setHover(star);
              }
            }}
            onMouseLeave={() => {
              if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                setHover(0);
              }
            }}
            className="p-1 sm:p-0.5 focus:outline-none disabled:opacity-50 transition-transform active:scale-125 sm:hover:scale-110 touch-manipulation"
            aria-label={`ให้ ${star} ดาว`}
          >
            <Star
              className={cn(
                'w-4 h-4 sm:w-3.5 sm:h-3.5 transition-colors',
                star <= display
                  ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_1px_2px_rgba(250,204,21,0.3)]'
                  : 'fill-none text-muted-foreground/40 hover:text-yellow-400/60'
              )}
            />
          </button>
        ))}
      </div>
      {ratingCount > 0 && (
        <span className="text-[11px] sm:text-[10px] text-muted-foreground font-medium">
          {avgRating.toFixed(1)} <span className="opacity-70">({ratingCount})</span>
        </span>
      )}
    </div>
  );
}

// ─── Server Spotlight (Cozy Discovery Hero) ─────────────────────────────────
function ServerSpotlight({
  servers,
  onClickJoin,
  carouselConfig,
  categories,
}: {
  servers: DiscordServer[];
  onClickJoin: (s: DiscordServer) => void;
  carouselConfig?: { mode: 'manual' | 'auto_top7'; window_days: number; limit: number };
  categories?: { id: string; name: string; icon: string }[];
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const len = servers.length;

  const prev = useCallback(() => {
    setActive((i) => (i - 1 + len) % len);
    setTimerKey((k) => k + 1);
  }, [len]);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % len);
    setTimerKey((k) => k + 1);
  }, [len]);

  const goTo = useCallback((index: number) => {
    setActive(index);
    setTimerKey((k) => k + 1);
  }, []);

  // 8s Autoplay with smart pause and reset
  useEffect(() => {
    if (len <= 1 || paused || isInteracting) return;
    const id = setInterval(next, 8000);
    return () => clearInterval(id);
  }, [len, paused, isInteracting, next, timerKey]);

  // Pause when browser tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPaused(true);
      } else {
        setPaused(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (len === 0) return null;

  // Active server
  const server = servers[active] || servers[0];
  const isExpired = server.invite_status === 'expired';

  // Category name resolution
  const categoryName = categories && server.category_id
    ? (() => {
        const cat = categories.find((c) => c.id === server.category_id);
        return cat ? `${cat.icon} ${cat.name}` : null;
      })()
    : null;

  // Activity Signal: 1. Real Voice > 2. New Community > 3. Real Member Growth > 4. Web Interest > 5. Category/Trait Fallback
  const getActivitySignal = (): { text: string; icon?: string; className: string } => {
    if ((server.live_voice_count || 0) > 0) {
      return {
        text: `${server.live_voice_count} คนกำลังคุยไมค์`,
        icon: '🟢',
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/30',
      };
    }

    if (server.is_new) {
      return {
        text: 'ชุมชนเปิดใหม่',
        icon: '✨',
        className: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sky-950/30',
      };
    }

    if ((server.weekly_joins_count || 0) >= 10) {
      return {
        text: 'สมาชิกใหม่เข้าต่อเนื่อง',
        icon: '📈',
        className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/30',
      };
    }

    if ((server.recent_clicks || 0) >= 15) {
      return {
        text: 'ผู้คนบนเว็บกำลังสนใจ',
        icon: '🔥',
        className: 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-orange-950/30',
      };
    }

    if (categoryName) {
      return {
        text: categoryName,
        className: 'bg-stone-900/80 text-stone-200 border-stone-700/60',
      };
    }

    if (server.traits && server.traits.length > 0) {
      const firstTrait = getTraitById(server.traits[0]);
      if (firstTrait) {
        return {
          text: `${firstTrait.icon} ${firstTrait.label}`,
          className: 'bg-stone-900/80 text-stone-200 border-stone-700/60',
        };
      }
    }

    return {
      text: 'ชุมชนแนะนำ',
      icon: '☕',
      className: 'bg-stone-900/80 text-stone-200 border-stone-700/60',
    };
  };

  const signal = getActivitySignal();

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6 sm:mb-8"
      role="region"
      aria-roledescription="carousel"
      aria-label="เซิร์ฟเวอร์น่าสนใจ"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400" />
          <h2 className="text-sm sm:text-lg font-bold text-foreground tracking-tight">
            เซิร์ฟเวอร์น่าสนใจ
          </h2>
        </div>

        {len > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prev}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border/60 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              aria-label="เซิร์ฟเวอร์ก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] sm:text-xs font-mono font-medium text-muted-foreground px-1 select-none">
              {active + 1}/{len}
            </span>
            <button
              type="button"
              onClick={next}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border/60 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              aria-label="เซิร์ฟเวอร์ถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Hero Spotlight Card */}
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prev();
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            next();
          }
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setPaused(false);
          }
        }}
        onTouchStart={(e) => {
          setIsInteracting(true);
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = e.changedTouches[0].clientY - touchStartY.current;
          if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            dx > 0 ? prev() : next();
          }
          setIsInteracting(false);
        }}
        className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-border/60 dark:border-[#2A221E] shadow-md bg-[#14100E] min-h-[170px] sm:min-h-[210px] md:min-h-[230px] flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={server.id}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {/* Backdrop Banner */}
            <SafeServerBanner
              url={server.banner_url}
              alt={server.name}
              className="w-full h-full object-cover"
              isExpired={isExpired}
            />

            {/* Cozy Warm Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#12100E] via-[#12100E]/85 to-[#12100E]/40 sm:bg-gradient-to-r sm:from-[#12100E] sm:via-[#12100E]/85 sm:to-[#12100E]/40 backdrop-blur-[1px]" />
          </motion.div>
        </AnimatePresence>

        {/* Content Container (Card Body is NOT a click CTA) */}
        <div className="relative z-10 p-4 sm:p-6 flex flex-col justify-between h-full flex-1 pointer-events-auto">
          {/* Upper Section */}
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Server Icon */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl overflow-hidden border-2 border-white/20 shadow-md bg-stone-900 ring-1 ring-primary/20">
              <SafeServerIcon
                url={server.icon_url}
                name={server.name}
                className="w-full h-full object-cover"
                isExpired={isExpired}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Activity Signal + Trust Badges */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold backdrop-blur-md border shadow-xs',
                    signal.className
                  )}
                >
                  {signal.icon && <span>{signal.icon}</span>}
                  <span>{signal.text}</span>
                </span>

                {server.is_partner && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-purple-950/50 text-purple-200 border border-purple-400/40 backdrop-blur-md">
                    <Handshake className="w-3 h-3 text-purple-300" />
                    Partner
                  </span>
                )}

                {server.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-sky-950/50 text-sky-200 border border-sky-400/40 backdrop-blur-md">
                    <ShieldCheck className="w-3 h-3 text-sky-300" />
                    ยืนยันแล้ว
                  </span>
                )}
              </div>

              {/* Server Name */}
              <h3 className="text-white font-bold text-base sm:text-lg md:text-xl truncate tracking-tight drop-shadow-sm">
                {server.name}
              </h3>

              {/* Description */}
              <p className="text-xs sm:text-sm text-stone-300/90 line-clamp-1 sm:line-clamp-2 leading-relaxed mt-1 max-w-2xl">
                {server.description || 'ยินดีต้อนรับสู่คอมมูนิตี้ของเรา'}
              </p>

              {/* Traits Tags (sm+ screens) */}
              {server.traits && server.traits.length > 0 && (
                <div className="hidden sm:flex flex-wrap gap-1.5 mt-2">
                  {server.traits.slice(0, 2).map((tId) => {
                    const trait = getTraitById(tId);
                    if (!trait) return null;
                    return (
                      <span
                        key={tId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-stone-300 border border-white/15 backdrop-blur-xs"
                      >
                        <span>{trait.icon}</span>
                        <span>{trait.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lower Action & Stats Bar */}
          <div className="flex items-center justify-between gap-3 pt-3 mt-auto border-t border-white/10">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/90">
              <span className="flex items-center gap-1 font-medium" title="จำนวนสมาชิก">
                <Users className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                <span>{(server.member_count || 0).toLocaleString()} สมาชิก</span>
              </span>
              {categoryName && (
                <span className="hidden sm:inline text-xs text-stone-400 font-medium">
                  • {categoryName}
                </span>
              )}
            </div>

            {/* Primary Action Button (Single point for Direct Join) */}
            {isExpired ? (
              <Button
                size="sm"
                disabled
                className="rounded-full bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-300 border border-destructive/30 px-3 sm:px-4 shrink-0 text-xs sm:text-sm cursor-not-allowed font-medium select-none h-8 sm:h-9"
                title="ลิงก์เชิญหมดอายุ ไม่สามารถเข้าร่วมได้"
              >
                <AlertTriangle className="w-3 h-3 mr-1 text-red-200" />
                <span>ลิงก์หมดอายุ</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all border-0 px-4 sm:px-6 h-8 sm:h-9 text-xs sm:text-sm cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickJoin(server);
                }}
              >
                <span className="hidden sm:inline">เข้าดิสคอร์ด</span>
                <span className="sm:hidden">เข้าร่วม</span>
              </Button>
            )}
          </div>
        </div>

        {/* Timed Progress Bar (Only when multiple servers & not paused) */}
        {len > 1 && !paused && !isInteracting && !shouldReduceMotion && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-20">
            <div
              key={timerKey}
              className="h-full bg-primary"
              style={{
                animation: 'spotlight-progress 8000ms linear forwards',
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Dots Indicator */}
      {len > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-3">
          {servers.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                'rounded-full transition-all duration-300 cursor-pointer',
                i === active
                  ? 'w-6 h-1.5 bg-primary shadow-xs'
                  : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              )}
              aria-label={`ไปยังเซิร์ฟเวอร์ที่ ${i + 1}`}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

// ─── Spotlight Progress Animation ───────────────────────────────────────────
const spotlightProgressStyle = `
@keyframes spotlight-progress {
  0%   { width: 0%; }
  100% { width: 100%; }
}
`;

// ─── Impression Observer Hook ─────────────────────────────────────────────────
const sessionViewedServers = new Set<string>();

function useImpressionObserver(serverId: string) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !tracked.current) {
          tracked.current = true;
          observer.disconnect();

          // Session-level deduplication to avoid duplicate impressions during re-sorting/filtering
          if (!sessionViewedServers.has(serverId)) {
            sessionViewedServers.add(serverId);
            // Fire-and-forget — don't block render
            supabase.rpc('increment_impression', { _server_id: serverId }).then(({ error }) => {
              if (error) console.warn('impression rpc error:', error.message);
            });
            // Discovery Funnel Event (impression = Card shown in >= 50% viewport)
            trackDiscoveryEvent({ event_type: 'impression', server_id: serverId });
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [serverId]);

  return ref;
}

// ─── Server Card Component ────────────────────────────────────────────────────
interface ServerCardProps {
  server: DiscordServer;
  user: any;
  userId: string | null;
  getCategoryName: (catId: string | null) => string | null;
  getTimeSince: (dateStr: string | null) => string;
  handleClickJoin: (server: DiscordServer) => void;
  handleBump: (serverId: string) => void;
  bumpingId: string | null;
  handleRated: (serverId: string, rating: number) => void;
  onRefresh: (server: DiscordServer) => void;
  refreshingId: string | null;
  onEditLink?: (server: DiscordServer) => void;
  onEditVibe?: (server: DiscordServer) => void;
  onDelete?: (server: DiscordServer) => void;
  onToggleSave?: (serverId: string) => void;
}

function ServerCard({
  server, user, userId, getCategoryName, getTimeSince,
  handleClickJoin, handleBump, bumpingId, handleRated,
  onRefresh, refreshingId, onEditLink, onEditVibe, onDelete, onToggleSave,
}: ServerCardProps) {
  const cardRef = useImpressionObserver(server.id);
  const bannerRef = useRef<HTMLImageElement>(null);
  const canAnimate = server.is_verified === true;
  const isExpired = server.invite_status === 'expired';

  const handleCardMouseEnter = () => {
    if (!canAnimate || !bannerRef.current) return;
    bannerRef.current.style.transform = 'scale(1.1) translateX(8px)';
  };

  const handleCardMouseLeave = () => {
    if (!canAnimate || !bannerRef.current) return;
    bannerRef.current.style.transform = '';
  };

  return (
    <div
      ref={cardRef}
      className="h-full"
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      <div
        className={cn(
          'group relative overflow-hidden rounded-3xl border transition-all duration-300 h-full flex flex-col',
          'bg-card/80 dark:bg-[#181412] border-border/60 dark:border-[#2A221E] shadow-sm',
          'hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-0.5',
          isRainbow(server.highlight_color) && 'rainbow-border-glow',
          isExpired && 'opacity-90 border-red-500/30'
        )}
        style={getHighlightCardStyle(server.highlight_color)}
      >
        {/* Banner */}
        <div className="relative h-20 sm:h-28 overflow-hidden shrink-0 bg-muted/20">
          <SafeServerBanner
            imgRef={bannerRef}
            url={server.banner_url}
            alt={server.name}
            className="w-full h-full object-cover"
            isExpired={isExpired}
            style={canAnimate ? {
              transition: 'transform 700ms ease-out',
              willChange: 'transform',
            } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Top-Left Save Button (Micro-interaction) */}
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(server.id);
              }}
              className={cn(
                'absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-sm flex items-center gap-1 group/save',
                server.is_saved
                  ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 ring-2 ring-white/40'
                  : 'bg-black/40 hover:bg-black/60 text-white/90 hover:text-white'
              )}
              title={server.is_saved ? 'ลบออกจากที่บันทึกไว้' : 'บันทึกเซิร์ฟเวอร์นี้'}
              aria-label={server.is_saved ? 'Unsave server' : 'Save server'}
            >
              <Heart
                className={cn(
                  'w-3.5 h-3.5 transition-all duration-200',
                  server.is_saved
                    ? 'fill-current scale-110'
                    : 'group-hover/save:scale-110'
                )}
              />
              {(server.save_count ?? 0) > 0 && (
                <span className="text-[10px] font-bold font-mono px-0.5">
                  {server.save_count}
                </span>
              )}
            </button>
          )}

          {/* Top-Right Badges */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1.5 z-10 flex-wrap justify-end">
            {isExpired ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/90 text-white backdrop-blur-md shadow-xs flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> ลิงก์หมดอายุ
              </span>
            ) : (
              <>
                {server.is_featured && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 shadow-xs flex items-center gap-1">
                    <Star className="w-3 h-3 fill-stone-950" /> แนะนำ
                  </span>
                )}
                {server.is_partner && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-600/90 text-white backdrop-blur-md shadow-xs flex items-center gap-1">
                    <Handshake className="w-3 h-3" /> Partner
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <CardContent className="p-3 sm:p-5 -mt-6 sm:-mt-8 relative flex-1 flex flex-col">
          {/* Icon */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl overflow-hidden border-2 border-background shadow-md bg-card mb-2 sm:mb-2.5 ring-1 ring-border/40">
            <SafeServerIcon
              url={server.icon_url}
              name={server.name}
              className="w-full h-full object-cover"
              isExpired={isExpired}
            />
          </div>

          {/* Name + Category Tag */}
          <div className="flex items-center gap-1 sm:gap-1.5 mb-1 flex-wrap min-w-0">
            <h3
              className={cn(
                "font-bold text-sm sm:text-base truncate text-foreground group-hover:text-amber-500 transition-colors",
                getNameHighlightClass(server.highlight_color)
              )}
              style={getNameHighlightStyle(server.highlight_color)}
            >
              {server.name}
            </h3>
            {server.is_verified && (
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" aria-label="Verified" />
            )}
            {getCategoryName(server.category_id) && (
              <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground border border-border/40">
                {getCategoryName(server.category_id)}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-2 sm:mb-3 flex-1">
            {server.description || 'ไม่มีคำอธิบาย'}
          </p>

          {/* Phase 2: Traits Badges */}
          {server.traits && server.traits.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5 sm:mb-3">
              {server.traits.slice(0, 2).map((traitId) => {
                const trait = getTraitById(traitId);
                if (!trait) return null;
                return (
                  <span
                    key={traitId}
                    className={cn(
                      "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                      trait.color
                    )}
                    title={trait.description}
                  >
                    <span>{trait.icon}</span>
                    <span>{trait.label}</span>
                  </span>
                );
              })}
              {server.traits.length > 2 && (
                <span className="text-[10px] text-muted-foreground self-center px-1 font-mono">
                  +{server.traits.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Footer Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2 sm:pt-2.5 mt-auto gap-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              <span className="flex items-center gap-1 font-semibold text-foreground/80">
                <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{server.member_count ? server.member_count.toLocaleString() : 0}</span>
              </span>
              {(server.live_voice_count || 0) > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">{server.live_voice_count} ในห้องเสียง</span>
                </span>
              )}
              {getTimeSince(server.bumped_at) && (
                <span className="text-muted-foreground/60 hidden sm:inline text-[11px]">
                  ดันเมื่อ {getTimeSince(server.bumped_at)}
                </span>
              )}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="mt-2.5 sm:mt-3 flex items-center gap-1.5 sm:gap-2">
            <BumpButton server={server} user={user} onBump={handleBump} bumpingId={bumpingId} />

            {/* Owner Management Menu */}
            {user && server.owner_id === user.discord_id && (
              <DropdownMenu
                options={[
                  ...(onEditVibe ? [{
                    label: "ตั้งค่า Vibe & จุดเด่น",
                    onClick: () => onEditVibe(server),
                    Icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
                  }] : []),
                  {
                    label: "รีโหลดข้อมูลจาก Discord",
                    onClick: () => onRefresh(server),
                    Icon: <RefreshCw className={cn("w-3.5 h-3.5", refreshingId === server.id && "animate-spin")} />,
                    disabled: refreshingId === server.id,
                  },
                  ...(onEditLink ? [{
                    label: "แก้ไขลิงก์เชิญ",
                    onClick: () => onEditLink(server),
                    Icon: <LinkIcon className="w-3.5 h-3.5 text-amber-500" />,
                  }] : []),
                  ...(onDelete ? [{
                    label: "ลบเซิร์ฟเวอร์",
                    onClick: () => onDelete(server),
                    Icon: <Trash2 className="w-3.5 h-3.5" />,
                    variant: "destructive" as const,
                  }] : []),
                ]}
                align="start"
                triggerClassName="rounded-full h-8 w-8 p-0 shrink-0 border border-border/60 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenu>
            )}

            {/* Main Action Button */}
            {isExpired ? (
              user && server.owner_id === user.discord_id && onEditLink ? (
                <Button
                  size="sm"
                  className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 px-3 sm:px-4 w-full sm:w-auto ml-auto text-xs font-medium shrink-0 gap-1"
                  onClick={() => onEditLink(server)}
                  title="แก้ไขลิงก์เชิญใหม่"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>แก้ลิงก์</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled
                  className="rounded-full bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-300 border border-destructive/30 px-3 sm:px-3.5 w-full sm:w-auto ml-auto text-xs cursor-not-allowed opacity-90 font-medium select-none shrink-0"
                  title="ลิงก์เชิญหมดอายุ ไม่สามารถเข้าร่วมได้"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-destructive shrink-0" />
                  <span>ลิงก์พัง</span>
                </Button>
              )
            ) : (
              <Button
                size="sm"
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm shadow-primary/20 px-3 sm:px-5 w-full sm:w-auto ml-auto text-xs sm:text-sm h-8 shrink-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => handleClickJoin(server)}
              >
                เข้าดิสคอร์ด
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DiscordServersPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isVibeOpen, setIsVibeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recommendation' | 'trending' | 'rising' | 'new' | 'recent' | 'popular' | 'live_voice'>('recommendation');
  const [userState, setUserState] = useState<UserStateType>('NEW');
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savingServerId, setSavingServerId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // Phase 2: Add server form states
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [addPrimaryGoal, setAddPrimaryGoal] = useState<string>('');
  const [addAtmosphere, setAddAtmosphere] = useState<string>('');
  const [editVibeServer, setEditVibeServer] = useState<DiscordServer | null>(null);
  const [isEditVibeOpen, setIsEditVibeOpen] = useState(false);
  const [carouselConfig, setCarouselConfig] = useState<{
    mode: 'manual' | 'auto_top7';
    window_days: number;
    limit: number;
    prioritize_partners?: boolean;
  }>({ mode: 'auto_top7', window_days: 7, limit: 5 });

  // ── Invite status state ───────────────────────────────────────────────────
  const [ownerExpiredServers, setOwnerExpiredServers] = useState<DiscordServer[]>([]);
  const [editLinkServer, setEditLinkServer] = useState<DiscordServer | null>(null);
  const [isEditLinkOpen, setIsEditLinkOpen] = useState(false);
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);

  // ── Delete Server state (Owner only) ──────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<DiscordServer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const userId = user?.discord_id || null;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, serverRes, ratingRes, saveRes, settingRes] = await Promise.all([
        (supabase.from('discord_server_categories' as any).select('*').order('sort_order', { ascending: true })) as any,
        (supabase.from('discord_servers' as any).select('*').eq('status', 'approved').order('bumped_at', { ascending: false })) as any,
        (supabase.from('server_ratings' as any).select('server_id, rating, user_id')) as any,
        (supabase.from('server_saves' as any).select('server_id, user_id')) as any,
        (supabase.from('site_settings' as any).select('value').eq('key', 'discord_carousel_settings').maybeSingle()) as any,
      ]);

      if (settingRes?.data?.value) {
        const val = typeof settingRes.data.value === 'string' ? JSON.parse(settingRes.data.value) : settingRes.data.value;
        setCarouselConfig({
          mode: val.mode || 'auto_top7',
          window_days: val.window_days || 7,
          limit: val.limit || 5,
          prioritize_partners: !!val.prioritize_partners,
        });
      }

      setCategories((catRes.data || []) as Category[]);

      const rawServers = (serverRes.data || []) as DiscordServer[];
      const ratings = (ratingRes.data || []) as { server_id: string; rating: number; user_id: string }[];
      const saves = (saveRes.data || []) as { server_id: string; user_id: string }[];

      // Aggregate ratings per server
      const ratingMap = new Map<string, { sum: number; count: number; mine: number }>();
      ratings.forEach(({ server_id, rating, user_id: ruid }) => {
        const cur = ratingMap.get(server_id) || { sum: 0, count: 0, mine: 0 };
        cur.sum += rating;
        cur.count += 1;
        if (ruid === userId) cur.mine = rating;
        ratingMap.set(server_id, cur);
      });

      // Aggregate saves per server & identify user saves
      const saveCountMap = new Map<string, number>();
      const userSavedSet = new Set<string>();
      saves.forEach(({ server_id, user_id: suid }) => {
        saveCountMap.set(server_id, (saveCountMap.get(server_id) || 0) + 1);
        if (userId && suid === userId) {
          userSavedSet.add(server_id);
        }
      });

      // Fetch discovery trending scores & real growth rate from RPC (Rule 6, 7)
      const trendingScoreMap = new Map<
        string,
        {
          discovery_score: number;
          recent_clicks: number;
          recent_saves: number;
          previous_clicks: number;
          previous_saves: number;
          growth_rate: number | null;
          is_new_breakout: boolean;
          is_rising: boolean;
        }
      >();

      try {
        const { data: scoreData } = await (supabase.rpc('get_discovery_trending_scores' as any)) as any;
        if (scoreData && Array.isArray(scoreData)) {
          scoreData.forEach((row: any) => {
            trendingScoreMap.set(row.server_id, {
              discovery_score: Number(row.discovery_score) || 0,
              recent_clicks: Number(row.recent_clicks) || 0,
              recent_saves: Number(row.recent_saves) || 0,
              previous_clicks: Number(row.previous_clicks) || 0,
              previous_saves: Number(row.previous_saves) || 0,
              growth_rate: row.growth_rate != null ? Number(row.growth_rate) : null,
              is_new_breakout: !!row.is_new_breakout,
              is_rising: !!row.is_rising,
            });
          });
        }
      } catch (err) {
        console.warn('Discovery trending score RPC unavailable, using local calculation:', err);
      }

      // Fetch personalized recommendations from RPC (Plan 2)
      const recMap = new Map<
        string,
        {
          recommendation_score: number;
          recommendation_reason: string;
          is_exploration: boolean;
          user_state: UserStateType;
        }
      >();
      let determinedUserState: UserStateType = 'NEW';

      try {
        const { data: recData } = await (supabase.rpc('get_personalized_recommendations' as any, { p_limit: 50 })) as any;
        if (recData && Array.isArray(recData)) {
          recData.forEach((row: any) => {
            recMap.set(row.server_id, {
              recommendation_score: Number(row.recommendation_score) || 0,
              recommendation_reason: row.recommendation_reason || '',
              is_exploration: !!row.is_exploration,
              user_state: (row.user_state as UserStateType) || 'NEW',
            });
            if (row.user_state) determinedUserState = row.user_state as UserStateType;
          });
        }
      } catch (err) {
        console.warn('Personalized recommendation RPC unavailable, using local fallback:', err);
      }
      setUserState(determinedUserState);

      const now = Date.now();
      const enriched = rawServers.map((s) => {
        const r = ratingMap.get(s.id);
        const t = trendingScoreMap.get(s.id);
        const rec = recMap.get(s.id);
        const saveCount = saveCountMap.get(s.id) || 0;
        const isNew = s.created_at
          ? now - new Date(s.created_at).getTime() <= DISCOVERY_CONSTANTS.NEW_SERVER_DAYS * 24 * 60 * 60 * 1000
          : false;
        const hoursSinceBump = s.bumped_at ? (now - new Date(s.bumped_at).getTime()) / (1000 * 60 * 60) : 100;
        const fallbackDiscoveryScore = Math.round(
          ((s.click_count || 0) * 3.0 + saveCount * 5.0 + (s.bump_count || 0) * 4.0) /
            Math.pow(hoursSinceBump + 2, 0.5)
        );

        // Client-side fallback using identical growth calculation function (Rule 7 & Rule 9)
        const fallbackGrowth = calculateRisingGrowth(s.click_count || 0, saveCount, 0, 0);

        // Fallback recommendation score
        const fallbackListingFreshness = calculateListingFreshness(s.created_at);
        const fallbackDiscQuality = normalizeDiscoveryQuality(t ? t.discovery_score : fallbackDiscoveryScore);
        const fallbackRecScore = Math.round(((fallbackDiscQuality * 0.70) + (fallbackListingFreshness * 0.30)) * 10000) / 10000;

        return {
          ...s,
          avg_rating: r ? r.sum / r.count : 0,
          rating_count: r?.count ?? 0,
          my_rating: r?.mine ?? 0,
          save_count: saveCount,
          is_saved: userSavedSet.has(s.id),
          discovery_score: t ? t.discovery_score : fallbackDiscoveryScore,
          recent_clicks: t ? t.recent_clicks : (s.click_count || 0),
          recent_saves: t ? t.recent_saves : saveCount,
          previous_clicks: t ? t.previous_clicks : 0,
          previous_saves: t ? t.previous_saves : 0,
          growth_rate: t ? t.growth_rate : fallbackGrowth.growth_rate,
          is_new_breakout: t ? t.is_new_breakout : fallbackGrowth.is_new_breakout,
          is_rising: t ? t.is_rising : fallbackGrowth.is_rising,
          is_new: isNew,
          recommendation_score: rec ? rec.recommendation_score : fallbackRecScore,
          recommendation_reason: rec?.recommendation_reason || (isNew ? '🆕 เซิร์ฟเวอร์ใหม่น่าสนใจ' : '🔥 กำลังได้รับความสนใจในขณะนี้'),
          is_exploration: rec ? rec.is_exploration : false,
          user_state: rec ? rec.user_state : determinedUserState,
        };
      });

      setServers(enriched);

      // Owner expired query — only when authenticated (Req 2.3, 4.3)
      if (isAuthenticated && user?.discord_id) {
        const { data: expiredData } = await (supabase
          .from('discord_servers' as any)
          .select('*')
          .eq('status', 'approved')
          .eq('invite_status', 'expired')
          .eq('owner_id', user.discord_id)) as any;
        setOwnerExpiredServers((expiredData || []) as DiscordServer[]);
      } else {
        setOwnerExpiredServers([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Rating callback (optimistic) ─────────────────────────────────────────────
  const handleRated = (serverId: string, newRating: number) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== serverId) return s;
        const wasRated = (s.my_rating ?? 0) > 0;
        const oldSum = (s.avg_rating ?? 0) * (s.rating_count ?? 0);
        const newCount = wasRated ? (s.rating_count ?? 0) : (s.rating_count ?? 0) + 1;
        const newSum = wasRated ? oldSum - (s.my_rating ?? 0) + newRating : oldSum + newRating;
        return { ...s, my_rating: newRating, avg_rating: newSum / newCount, rating_count: newCount };
      })
    );
  };

  // ── Toggle Save callback (Micro-interaction) ──────────────────────────────
  const handleToggleSave = async (serverId: string) => {
    if (!isAuthenticated || !userId) {
      toast({
        title: 'กรุณาเข้าสู่ระบบก่อน',
        description: 'เข้าสู่ระบบด้วย Discord เพื่อบันทึกเซิร์ฟเวอร์ที่คุณสนใจ',
        variant: 'destructive',
      });
      return;
    }

    const currentServer = servers.find((s) => s.id === serverId);
    if (!currentServer) return;

    const willSave = !currentServer.is_saved;

    // Optimistic UI update
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId
          ? {
              ...s,
              is_saved: willSave,
              save_count: Math.max(0, (s.save_count || 0) + (willSave ? 1 : -1)),
            }
          : s
      )
    );

    setSavingServerId(serverId);

    try {
      const { data, error } = await (supabase.rpc('toggle_server_save' as any, {
        _server_id: serverId,
        _user_id: userId,
      })) as any;

      if (error) throw error;

      if (data?.saved) {
        toast({
          title: '✓ บันทึกไว้แล้ว',
          description: `บันทึก "${currentServer.name}" ไว้ในรายการของคุณแล้ว`,
          className: 'bg-rose-500 text-white border-none',
        });
      } else {
        toast({
          title: 'ยกเลิกการบันทึกแล้ว',
          description: `นำ "${currentServer.name}" ออกจากรายการที่บันทึกไว้แล้ว`,
        });
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? {
                ...s,
                is_saved: currentServer.is_saved,
                save_count: currentServer.save_count,
              }
            : s
        )
      );
      toast({
        title: 'ไม่สามารถบันทึกได้',
        description: err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setSavingServerId(null);
    }
  };

  // ── Auth guard ───────────────────────────────────────────────────────────────
  const requireLogin = (action: () => void) => {
    if (!isAuthenticated) {
      toast({ title: 'กรุณาเข้าสู่ระบบก่อน', description: 'คุณต้องล็อกอินเพื่อใช้งานฟีเจอร์นี้', variant: 'destructive' });
      navigate('/login');
      return;
    }
    action();
  };

  const handleOpenAdd = () => requireLogin(() => { setIsAddOpen(true); resetForm(); });

  // ── Add server ───────────────────────────────────────────────────────────────
  const handleAddByInvite = async () => {
    if (!user) return;
    if (!inviteUrl || !categoryId) {
      toast({ title: 'กรุณากรอกลิงก์เชิญและเลือกหมวดหมู่', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'กรุณาเข้าสู่ระบบก่อน', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const isShopCategory = categoryId === '4cf49c38-0cd3-480e-aa16-f4a0d0e6d6bc';
      const determinedServerType = isShopCategory ? 'shop' : 'community';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-discord-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invite_url: inviteUrl,
            category_id: categoryId,
            server_type: determinedServerType,
            traits: selectedTraits,
            server_profile: {
              primary_goal: addPrimaryGoal || undefined,
              atmosphere: addAtmosphere || undefined,
            },
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์เชิญ');
      }

      toast({
        title: 'ส่งเซิร์ฟเวอร์เรียบร้อย!',
        description: 'เซิร์ฟเวอร์ของคุณถูกส่งให้ทีมงานตรวจสอบแล้ว (สถานะ: รออนุมัติ)',
        className: 'bg-green-500 text-white',
      });
      setIsAddOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message || 'ไม่สามารถเพิ่มเซิร์ฟเวอร์ได้', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setInviteUrl('');
    setCategoryId('');
    setSelectedTraits([]);
    setAddPrimaryGoal('');
    setAddAtmosphere('');
  };

  // ── Bump ─────────────────────────────────────────────────────────────────────
  const handleBump = async (serverId: string) => {
    if (!user) return;
    setBumpingId(serverId);
    try {
      const server = servers.find((s) => s.id === serverId);
      if (!server || server.owner_id !== user.discord_id) {
        toast({ title: 'คุณไม่ใช่เจ้าของเซิร์ฟเวอร์นี้', variant: 'destructive' });
        return;
      }

      // ── ดึงข้อมูลใหม่จาก Discord API ──────────────────────────────────────
      let freshData: Partial<DiscordServer> = {};
      try {
        // Extract invite code from invite_url
        const inviteMatch = server.invite_url.match(/discord\.gg\/([a-zA-Z0-9-]+)/);
        if (inviteMatch) {
          const inviteCode = inviteMatch[1];
          const discordRes = await fetch(
            `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true`
          );
          if (discordRes.ok) {
            const data = await discordRes.json();
            freshData = {
              invite_status: 'valid',
              member_count: data.approximate_member_count ?? server.member_count,
              icon_url: data.guild?.icon
                ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.${data.guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=256`
                : server.icon_url,
              banner_url: data.guild?.banner
                ? `https://cdn.discordapp.com/banners/${data.guild.id}/${data.guild.banner}.${data.guild.banner.startsWith('a_') ? 'gif' : 'png'}?size=512`
                : data.guild?.splash
                ? `https://cdn.discordapp.com/splashes/${data.guild.id}/${data.guild.splash}.png?size=512`
                : server.banner_url,
            };
          } else if (discordRes.status === 404 || discordRes.status === 403) {
            freshData = { invite_status: 'expired' };
          }
        }
      } catch {
        // ถ้าดึงไม่ได้ก็ bump ต่อได้ ไม่ต้อง block
      }

      // ── อัปเดต bumped_at + bump_count + ข้อมูลใหม่ ──────────────────────────────────────
      const currentBumpCount = (server.bump_count ?? 0) + 1;
      const updatePayload = {
        bumped_at: new Date().toISOString(),
        bump_count: currentBumpCount,
        ...freshData,
      };

      const { data: updatedRows, error } = await (supabase
        .from('discord_servers' as any)
        .update(updatePayload as any)
        .eq('id', serverId)
        .select()) as any;
      if (error) throw error;

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('ไม่สามารถดันเซิร์ฟเวอร์ได้ เนื่องจากคุณไม่มีสิทธิ์แก้ไขเซิร์ฟเวอร์นี้ (กรุณาตรวจสอบสิทธิ์เจ้าของเซิร์ฟเวอร์)');
      }

      // Track individual bump in discord_server_bumps log table
      try {
        await (supabase.from('discord_server_bumps' as any).insert({
          server_id: serverId,
          user_id: user.discord_id,
          created_at: new Date().toISOString(),
        } as any)) as any;
      } catch (logErr) {
        console.warn('Could not record bump log', logErr);
      }

      // Track bump in discovery events
      trackDiscoveryEvent({
        event_type: 'bump',
        server_id: serverId,
        user_id: user.discord_id,
        metadata: { bump_count: currentBumpCount },
      });

      toast({
        title: '🔥 ดันเซิร์ฟเวอร์สำเร็จ!',
        description: `บันทึกการดันครั้งที่ ${currentBumpCount} แล้ว${freshData.member_count ? ` • อัปเดต: ${freshData.member_count.toLocaleString()} สมาชิก` : ''}`,
        className: 'bg-green-500 text-white',
      });
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setBumpingId(null);
    }
  };

  // ── Refresh server from Discord ──────────────────────────────────────────────
  const handleRefreshServer = async (server: DiscordServer) => {
    setRefreshingId(server.id);
    const result = await refreshServerFromDiscord(server.id, server.invite_url);
    setRefreshingId(null);
    if (result.success && result.updated) {
      setServers((prev) => prev.map((s) =>
        s.id === server.id ? { ...s, ...result.updated, invite_status: 'valid' } : s
      ));
      toast({
        title: '✅ อัปเดตข้อมูลสำเร็จ',
        description: `${result.updated.member_count != null ? `${result.updated.member_count.toLocaleString()} สมาชิก` : ''}`,
        className: 'bg-green-500 text-white',
      });
    } else if (result.isExpired) {
      setServers((prev) => prev.map((s) =>
        s.id === server.id ? { ...s, invite_status: 'expired' } : s
      ));
      toast({
        title: '⚠️ ลิงก์เชิญหมดอายุ',
        description: 'ลิงก์เชิญเซิร์ฟเวอร์นี้ใช้งานไม่ได้แล้วใน Discord',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: result.error, variant: 'destructive' });
    }
  };

  // ── Click tracking ───────────────────────────────────────────────────────────
  const handleClickJoin = async (server: DiscordServer) => {
    if (server.invite_status === 'expired') {
      toast({
        title: '⚠️ ลิงก์เชิญหมดอายุแล้ว',
        description: 'เซิร์ฟเวอร์นี้ลิงก์เชิญหมดอายุ ไม่สามารถเข้าร่วมได้ เจ้าของเซิร์ฟเวอร์ต้องอัปเดตลิงก์ใหม่',
        variant: 'destructive',
      });
      return;
    }

    // Open the invite immediately — don't block on tracking
    window.open(server.invite_url, '_blank', 'noopener,noreferrer');

    // Discovery Funnel Event (click with source attribution)
    trackDiscoveryEvent({
      event_type: 'click',
      server_id: server.id,
      user_id: user?.discord_id || null,
      source: sortMode,
      metadata: { server_name: server.name, invite_url: server.invite_url },
    });

    if (!user) return;

    // Run all tracking + notification in background (fire-and-forget)
    (async () => {
      try {
        const uid = user.discord_id || user.id;
        const today = new Date().toISOString().slice(0, 10);

        // 1. Unique-click dedup per user/server
        await (supabase.from('server_clicks' as any).upsert(
          { server_id: server.id, user_id: uid } as any,
          { onConflict: 'server_id,user_id', ignoreDuplicates: true }
        )) as any;

        // 2. Daily stats: increment today's row
        const { data: existing } = await (supabase
          .from('server_click_stats' as any)
          .select('id, click_count')
          .eq('server_id', server.id)
          .eq('stat_date', today)
          .maybeSingle()) as any;

        if (existing) {
          await (supabase
            .from('server_click_stats' as any)
            .update({ click_count: existing.click_count + 1 } as any)
            .eq('id', existing.id)) as any;
        } else {
          await (supabase
            .from('server_click_stats' as any)
            .insert({ server_id: server.id, stat_date: today, click_count: 1 } as any)) as any;
        }

        // 3. Sync total unique click_count on discord_servers
        const { count } = await (supabase
          .from('server_clicks' as any)
          .select('*', { count: 'exact', head: true })
          .eq('server_id', server.id)) as any;
        if (count != null) {
          await (supabase.from('discord_servers' as any).update({ click_count: count } as any).eq('id', server.id)) as any;
          setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, click_count: count } : s));
        }
      } catch (err) {
        console.error('Click tracking failed:', err);
      }
    })();
  };

  // ── Delete Server Handler (Owner only) ───────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .delete()
        .eq('id', deleteTarget.id)) as any;

      if (error) throw error;

      toast({
        title: 'ลบเซิร์ฟเวอร์สำเร็จ',
        description: `เซิร์ฟเวอร์ "${deleteTarget.name}" ถูกลบออกจากระบบแล้ว`,
      });

      // Remove from local states
      setServers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setOwnerExpiredServers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการลบ',
        description: err.message || 'ไม่สามารถลบเซิร์ฟเวอร์ได้ (กรุณาตรวจสอบสิทธิ์เจ้าของ)',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getCategoryName = (catId: string | null) => {
    if (!catId) return null;
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : null;
  };

  // ── Filter + Sort ─────────────────────────────────────────────────────────────
  let featuredServers: DiscordServer[] = [];
  if (carouselConfig.mode === 'manual') {
    featuredServers = [...servers]
      .filter((s) => s.is_featured && s.invite_status !== 'expired')
      .sort((a, b) => (a.carousel_order ?? 999) - (b.carousel_order ?? 999));
  } else {
    // Auto Top 7 mode: Active within window_days (default 7 days) and ranked by weekly active score
    const windowDays = carouselConfig.window_days || 7;
    const cutoffTime = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const limitCount = carouselConfig.limit || 5;

    const scoredServers = servers
      .filter((s) => {
        if (s.invite_status === 'expired') return false;
        if (!s.bumped_at) return false;
        return new Date(s.bumped_at).getTime() >= cutoffTime;
      })
      .map((s) => {
        const computed = calculateWeeklyActiveScore(s);
        return {
          ...s,
          trending_active_score: computed.score,
          trending_badge: computed.badge,
        };
      });

    featuredServers = scoredServers
      .sort((a, b) => {
        if (carouselConfig.prioritize_partners && a.is_partner !== b.is_partner) {
          return a.is_partner ? -1 : 1;
        }
        const scoreA = a.trending_active_score ?? 0;
        const scoreB = b.trending_active_score ?? 0;
        if (Math.abs(scoreB - scoreA) > 0.01) return scoreB - scoreA;
        return new Date(b.bumped_at ?? 0).getTime() - new Date(a.bumped_at ?? 0).getTime();
      })
      .slice(0, limitCount);
  }

  const activeCategory = selectedCategory !== 'all' ? categories.find((c) => c.id === selectedCategory) : null;

  const filteredServers = servers
    .filter((server) => {
      // ซ่อนเซิร์ฟเวอร์ที่ลิงก์หมดอายุ ไม่ต้องแสดงจนกว่าเจ้าของจะแก้ไขลิงก์
      if (server.invite_status === 'expired') return false;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        server.name.toLowerCase().includes(q) ||
        (server.description ?? '').toLowerCase().includes(q) ||
        (server.discord_id ?? '').toLowerCase().includes(q) ||
        (server.owner_id ?? '').toLowerCase().includes(q);

      const matchCat = selectedCategory === 'all' || server.category_id === selectedCategory;
      const matchMine = !showMyOnly || (user && server.owner_id === user.discord_id);
      const matchSaved = !showSavedOnly || server.is_saved === true;
      return matchSearch && matchCat && matchMine && matchSaved;
    })
    .sort((a, b) => {
      // Partners always float to top
      if (a.is_partner !== b.is_partner) return a.is_partner ? -1 : 1;

      if (sortMode === 'recommendation') {
        const recDiff = (b.recommendation_score || 0) - (a.recommendation_score || 0);
        if (recDiff !== 0) return recDiff;
        return (b.discovery_score || 0) - (a.discovery_score || 0);
      }
      if (sortMode === 'live_voice') {
        const voiceDiff = (b.live_voice_count || 0) - (a.live_voice_count || 0);
        if (voiceDiff !== 0) return voiceDiff;
        return (b.member_count || 0) - (a.member_count || 0);
      }
      if (sortMode === 'trending') {
        const scoreDiff = (b.discovery_score || 0) - (a.discovery_score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.bumped_at ?? b.created_at ?? 0).getTime() - new Date(a.bumped_at ?? a.created_at ?? 0).getTime();
      }
      if (sortMode === 'rising') {
        if (a.is_rising !== b.is_rising) return a.is_rising ? -1 : 1;
        const rateB = b.growth_rate ?? (b.is_new_breakout ? 1.0 : 0);
        const rateA = a.growth_rate ?? (a.is_new_breakout ? 1.0 : 0);
        if (rateB !== rateA) return rateB - rateA;
        return (b.discovery_score || 0) - (a.discovery_score || 0);
      }
      if (sortMode === 'new') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortMode === 'popular') {
        return (b.impression_count || 0) - (a.impression_count || 0);
      }
      return new Date(b.bumped_at ?? 0).getTime() - new Date(a.bumped_at ?? 0).getTime();
    });

  // ── Track Search Intent (Debounced via discovery tracker) ───────────────────
  useEffect(() => {
    if (searchQuery.trim()) {
      trackSearchIntent(searchQuery, selectedCategory, filteredServers.length, userId);
    }
  }, [searchQuery, selectedCategory, userId, filteredServers.length]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream via-peach/10 to-blush/20 dark:from-background dark:via-background dark:to-muted/20">
      <style>{spotlightProgressStyle}</style>

      {/* Header */}
      <div className="bg-white/40 dark:bg-card/40 backdrop-blur-md border-b border-latte/20 dark:border-coffee/20 sticky top-0 z-30">
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full w-9 h-9 sm:w-10 sm:h-10">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <h1 className="text-base sm:text-xl font-bold">
              <span className="hidden sm:inline">โปรโมทเซิร์ฟเวอร์ฟรี</span>
              <span className="sm:hidden">โปรโมทเซิร์ฟเวอร์</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AnimatedThemeToggler
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-latte/40 dark:border-border/60 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs shrink-0"
              title="สลับธีม (โหมดมืด / สว่าง)"
            />
            <Button onClick={handleOpenAdd} size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-xs sm:text-sm px-3 sm:px-4">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">แปะเซิร์ฟเวอร์ฟรี</span>
              <span className="sm:hidden">แปะเซิร์ฟ</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        {/* Hero */}
        <div className="text-center mb-6 sm:mb-10 space-y-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center items-center pt-2"
          >
            <img
              src={discordLogo}
              alt="Discord"
              className="h-9 sm:h-12 md:h-14 w-auto object-contain drop-shadow-md select-none hover:scale-105 transition-transform duration-300"
              loading="eager"
              decoding="async"
            />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            หาเพื่อนใหม่ <span className="text-primary">เข้าดิสคอร์ด</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-xs sm:text-base max-w-xl mx-auto">
            ศูนย์รวมเซิร์ฟเวอร์ดิสคอร์ดคุณภาพจากชุมชน Bear Cafe แปะฟรี ปลอดภัย ไม่มีค่าใช้จ่าย
          </motion.p>
          {/* Quiz Button (ซ่อนไว้ชั่วคราวตามคำขอ)
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-center pt-1"
          >
            <button
              type="button"
              onClick={() => setIsVibeOpen(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs group max-w-full flex-wrap justify-center text-center"
            >
              <span>🎯 หาเซิร์ฟเวอร์ที่ใช่</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold ml-0.5">Quiz 7 ข้อ</span>
            </button>
          </motion.div>
          */}
        </div>

        {/* Server Spotlight */}
        <ServerSpotlight
          servers={featuredServers}
          onClickJoin={handleClickJoin}
          carouselConfig={carouselConfig}
          categories={categories}
        />

        {/* Owner Expired Alert Banner */}
        {isAuthenticated && ownerExpiredServers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-3xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  คุณมี {ownerExpiredServers.length} เซิร์ฟเวอร์ที่ลิงก์เชิญหมดอายุและถูกซ่อนอยู่
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                  ระบบจะไม่แสดงเซิร์ฟเวอร์เหล่านี้ต่อสาธารณะ จนกว่าคุณจะกดแก้ไขลิงก์เชิญใหม่
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById('owner-expired-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else if (ownerExpiredServers[0]) {
                  setEditLinkServer(ownerExpiredServers[0]);
                  setIsEditLinkOpen(true);
                }
              }}
              className="rounded-full border-amber-500/40 hover:bg-amber-500/15 text-amber-800 dark:text-amber-200 shrink-0 h-8 text-xs font-semibold self-end sm:self-center"
            >
              แก้ไขลิงก์ ({ownerExpiredServers.length})
            </Button>
          </motion.div>
        )}

        {/* Filters & Discovery Hub */}
        <div className="flex flex-col gap-3 mb-6 sm:mb-8">
          {/* Row 1: Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อเซิร์ฟเวอร์ คำค้น หรือเจ้าของ..."
              className="pl-10 pr-4 rounded-2xl bg-card/80 dark:bg-[#181412] border-border/60 dark:border-[#2A221E] h-10 text-xs sm:text-sm focus-visible:ring-amber-500/30 w-full shadow-2xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Row 2: Sort Pills & Category Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Sort pills */}
            <div className="flex gap-1.5 items-center overflow-x-auto pb-1 no-scrollbar touch-pan-x">
              <Button
                variant={sortMode === 'recommendation' ? 'default' : 'outline'}
                onClick={() => setSortMode('recommendation')}
                className={cn(
                  'rounded-full h-8 sm:h-9 px-3 text-xs gap-1.5 shrink-0 transition-all font-semibold',
                  sortMode === 'recommendation' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border/60 hover:bg-muted/30'
                )}
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {userState === 'ESTABLISHED' || userState === 'EARLY' ? 'แนะนำสำหรับคุณ' : 'น่าสนใจตอนนี้'}
                </span>
              </Button>
              <Button
                variant={sortMode === 'live_voice' ? 'default' : 'outline'}
                onClick={() => setSortMode('live_voice')}
                className={cn(
                  'rounded-full h-8 sm:h-9 px-3 text-xs gap-1.5 shrink-0 transition-all font-medium',
                  sortMode === 'live_voice'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
                )}
                size="sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>กำลังคุยสด</span>
              </Button>
              <Button
                variant={sortMode === 'trending' ? 'default' : 'outline'}
                onClick={() => setSortMode('trending')}
                className={cn(
                  'rounded-full h-8 sm:h-9 px-3 text-xs gap-1 shrink-0 transition-all',
                  sortMode === 'trending' ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold' : 'border-border/60 hover:bg-muted/30'
                )}
                size="sm"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>กำลังมาแรง</span>
              </Button>
              <Button
                variant={sortMode === 'new' ? 'default' : 'outline'}
                onClick={() => setSortMode('new')}
                className={cn(
                  'rounded-full h-8 sm:h-9 px-3 text-xs gap-1 shrink-0 transition-all',
                  sortMode === 'new' ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold' : 'border-border/60 hover:bg-muted/30'
                )}
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ใหม่</span>
              </Button>
              <Button
                variant={sortMode === 'recent' ? 'default' : 'outline'}
                onClick={() => setSortMode('recent')}
                className={cn(
                  'rounded-full h-8 sm:h-9 px-3 text-xs gap-1 shrink-0 transition-all',
                  sortMode === 'recent' ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold' : 'border-border/60 hover:bg-muted/30'
                )}
                size="sm"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>ล่าสุด</span>
              </Button>
            </div>

            {/* Right: My Only switch */}
            {user && (
              <label
                htmlFor="show-my-switch"
                className="flex items-center gap-2 shrink-0 bg-card/60 hover:bg-card/90 transition-colors rounded-full px-3 py-1 border border-border/50 cursor-pointer shadow-2xs select-none h-8 self-end sm:self-auto"
                title="แสดงเฉพาะเซิร์ฟเวอร์ที่คุณเป็นเจ้าของ"
              >
                <Switch
                  id="show-my-switch"
                  checked={showMyOnly}
                  onCheckedChange={(val) => { setShowMyOnly(val); if (val) setShowSavedOnly(false); }}
                />
                <span className="text-xs text-foreground font-medium whitespace-nowrap">ของฉัน</span>
              </label>
            )}
          </div>

          {/* Row 3: Horizontal Cafe Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
            {/* Chip: All */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setShowSavedOnly(false);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                selectedCategory === 'all' && !showSavedOnly
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card/70 dark:bg-[#181412] border border-border/60 dark:border-[#2A221E] text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <span>🌐</span>
              <span>ทั้งหมด</span>
            </button>

            {/* Chip: Saved */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  toast({
                    title: 'กรุณาเข้าสู่ระบบก่อน',
                    description: 'เข้าสู่ระบบด้วย Discord เพื่อดูเซิร์ฟเวอร์ที่คุณบันทึกไว้',
                    variant: 'destructive',
                  });
                  return;
                }
                setShowSavedOnly(!showSavedOnly);
                if (!showSavedOnly) {
                  setSelectedCategory('all');
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                showSavedOnly
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-card/70 dark:bg-[#181412] border border-border/60 dark:border-[#2A221E] text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', showSavedOnly ? 'fill-white text-white' : 'text-rose-500')} />
              <span>ที่บันทึกไว้</span>
            </button>

            {/* Chips: Categories from DB */}
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id && !showSavedOnly;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(isSelected ? 'all' : cat.id);
                    setShowSavedOnly(false);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-card/70 dark:bg-[#181412] border border-border/60 dark:border-[#2A221E] text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

            {/* Server Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse text-sm">กำลังโหลดเซิร์ฟเวอร์น่าสนใจ...</p>
              </div>
            ) : filteredServers.length === 0 ? (
              showSavedOnly ? (
                <div className="text-center py-12 sm:py-20 bg-white/30 dark:bg-card/20 rounded-3xl border-2 border-dashed border-latte/30 dark:border-coffee/30 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500">
                    <Heart className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-foreground">❤️ เซิร์ฟเวอร์ที่บันทึกไว้</h3>
                    <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mx-auto">
                      ยังไม่มีเซิร์ฟเวอร์ที่บันทึกไว้ ลองค้นหาเซิร์ฟเวอร์ที่น่าสนใจดูสิคะ
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowSavedOnly(false)}
                    className="rounded-full px-4 text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    ค้นหาเซิร์ฟเวอร์
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 sm:py-20 bg-white/30 dark:bg-card/20 rounded-3xl border-2 border-dashed border-latte/30 dark:border-coffee/30">
                  <Search className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
                  <h3 className="text-lg sm:text-xl font-bold mb-2">ไม่พบเซิร์ฟเวอร์ที่ต้องการ</h3>
                  <p className="text-muted-foreground text-sm mb-4">ลองเปลี่ยนคำค้นหา หรือหมวดหมู่ดูนะคะ</p>
                  <Button size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowMyOnly(false); setShowSavedOnly(false); }}>ล้างตัวกรองทั้งหมด</Button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6 items-stretch">
                {filteredServers.map((server, index) => (
                  <motion.div key={server.id} className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.35 }}>
                    <ServerCard
                      server={server}
                      user={user}
                      userId={userId}
                      getCategoryName={getCategoryName}
                      getTimeSince={getTimeSince}
                      handleClickJoin={handleClickJoin}
                      handleBump={handleBump}
                      bumpingId={bumpingId}
                      handleRated={handleRated}
                      onRefresh={handleRefreshServer}
                      refreshingId={refreshingId}
                      onEditLink={(s) => {
                        setEditLinkServer(s);
                        setIsEditLinkOpen(true);
                      }}
                      onEditVibe={(s) => {
                        setEditVibeServer(s);
                        setIsEditVibeOpen(true);
                      }}
                      onDelete={(s) => setDeleteTarget(s)}
                      onToggleSave={handleToggleSave}
                    />
                  </motion.div>
                ))}
              </div>
            )}

        {/* Owner expired servers section — visible only to the server owner (Req 2.3, 4.3, 4.4, 5.1, 5.2, 5.6) */}
        {isAuthenticated && ownerExpiredServers.length > 0 && (
          <div id="owner-expired-section" className="mt-8 sm:mt-12 scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" aria-hidden="true" />
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                เซิร์ฟเวอร์ของคุณที่ลิงก์หมดอายุ <span className="text-xs sm:text-sm font-normal text-muted-foreground">(ถูกซ่อนอยู่จนกว่าจะแก้ไขลิงก์)</span>
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
              {ownerExpiredServers.map((server) => (
                <ExpiredServerCard
                  key={server.id}
                  server={server}
                  onEditLink={(s) => {
                    setEditLinkServer(s);
                    setIsEditLinkOpen(true);
                  }}
                  onDelete={(s) => setDeleteTarget(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Login prompt */}
        {!isAuthenticated && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 sm:mt-12 text-center">
            <div className="inline-flex flex-col items-center gap-3 bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/30">
              <LogIn className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อแปะเซิร์ฟเวอร์และให้คะแนน</p>
              <Button onClick={() => navigate('/login')} className="rounded-full" size="sm">เข้าสู่ระบบ Discord</Button>
            </div>
          </motion.div>
        )}
      </div>

      <Footer />

      {/* EditLinkDialog — for owner to update expired invite links (Req 5.3–5.6, 6.1–6.9) */}
      <EditLinkDialog
        server={editLinkServer}
        open={isEditLinkOpen}
        onOpenChange={(open) => {
          setIsEditLinkOpen(open);
          if (!open) setEditLinkServer(null);
        }}
        onSuccess={(serverId, updatedData) => {
          // Update the server in public listing and clear from expired section
          setServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? {
                    ...s,
                    invite_status: 'valid' as const,
                    ...(updatedData || {}),
                  }
                : s
            )
          );
          setOwnerExpiredServers((prev) => prev.filter((s) => s.id !== serverId));
          setEditLinkServer(null);
        }}
      />

      {/* EditVibeDialog — for owner to configure Server Vibe Profile & Traits */}
      <EditVibeDialog
        server={editVibeServer}
        open={isEditVibeOpen}
        onOpenChange={(open) => {
          setIsEditVibeOpen(open);
          if (!open) setEditVibeServer(null);
        }}
        onSuccess={(serverId, updatedData) => {
          setServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? {
                    ...s,
                    traits: updatedData.traits,
                    server_profile: updatedData.server_profile,
                  }
                : s
            )
          );
          setEditVibeServer(null);
        }}
      />

      {/* Delete Confirmation Dialog (Owner only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!isDeleting && !open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md rounded-3xl mx-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบเซิร์ฟเวอร์
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <p className="text-sm">
                คุณแน่ใจหรือไม่ว่าต้องการลบเซิร์ฟเวอร์ <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span> ออกจากระบบ?
              </p>
              <p className="text-xs text-muted-foreground">
                การกระทำนี้จะลบข้อมูลเซิร์ฟเวอร์ คะแนนรีวิว และสถิติทั้งหมดอย่างถาวร และไม่สามารถกู้คืนได้
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              className="rounded-full gap-1.5"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบเซิร์ฟเวอร์'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Server Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl mx-2">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">แปะเซิร์ฟเวอร์ของคุณ</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">วางลิงก์เชิญ Discord แล้วระบบจะดึงข้อมูลให้อัตโนมัติ ทีมงานจะตรวจสอบภายใน 24-48 ชม.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-semibold text-sm">ลิงก์เชิญ (Invite Link) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="discord.gg/..." className="pl-10 rounded-xl text-sm" value={inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} />
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 italic"><Info className="w-3 h-3" /> แนะนำให้ใช้ลิงก์ที่ไม่มีวันหมดอายุ</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">หมวดหมู่ <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {categories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/25 shadow-xs'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibe Profile: Primary Goal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">
                  1. เป้าหมาย / จุดเด่นหลักของเซิร์ฟเวอร์
                </Label>
                <span className="text-[10px] text-muted-foreground">เลือก 1 ข้อ (ไม่บังคับ)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {VIBE_GOALS.map((goal) => {
                  const isSelected = addPrimaryGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setAddPrimaryGoal(isSelected ? '' : goal.id)}
                      className={cn(
                        'p-2 rounded-xl border text-left transition-all flex items-center gap-2 relative',
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <span className="text-base shrink-0">{goal.icon}</span>
                      <span className="text-xs font-semibold text-foreground truncate flex-1">{goal.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-primary shrink-0 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibe Profile: Atmosphere */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">
                  2. บรรยากาศ & มู้ดในเซิร์ฟเวอร์
                </Label>
                <span className="text-[10px] text-muted-foreground">เลือก 1 ข้อ (ไม่บังคับ)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {VIBE_ATMOSPHERES.map((vibe) => {
                  const isSelected = addAtmosphere === vibe.id;
                  return (
                    <button
                      key={vibe.id}
                      type="button"
                      onClick={() => setAddAtmosphere(isSelected ? '' : vibe.id)}
                      className={cn(
                        'p-2 rounded-xl border text-left transition-all flex items-center gap-2 relative',
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <span className="text-base shrink-0">{vibe.icon}</span>
                      <span className="text-xs font-semibold text-foreground truncate flex-1">{vibe.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-amber-500 shrink-0 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibe & Trait Tags Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">
                  3. แท็ก Vibe & กิจกรรม
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedTraits.length}/7 แท็ก
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                เลือกแท็กที่ตรงกับกิจกรรมและสไตล์ของสมาชิก เพื่อให้ระบบ Find Your Vibe แนะนำได้แม่นยำ
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CURATED_TRAITS.map((trait) => {
                  const isSelected = selectedTraits.includes(trait.id);
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTraits(selectedTraits.filter((t) => t !== trait.id));
                        } else {
                          if (selectedTraits.length >= 7) {
                            toast({
                              title: 'เลือกได้สูงสุด 7 แท็ก',
                              description: 'กรุณาเอาแท็กที่ไม่ต้องการออกก่อนเลือกแท็กใหม่',
                              variant: 'destructive',
                            });
                            return;
                          }
                          setSelectedTraits([...selectedTraits, trait.id]);
                        }
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                        isSelected
                          ? 'border-primary/50 bg-primary/20 text-primary shadow-sm font-semibold'
                          : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <span>{trait.icon}</span>
                      <span>{trait.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-3 sm:p-4 text-xs space-y-2 border border-primary/10">
              <p className="font-semibold text-foreground">✨ ระบบจะดึงข้อมูลให้อัตโนมัติ:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5"><li>ชื่อเซิร์ฟเวอร์ รูปไอคอน แบนเนอร์</li><li>จำนวนสมาชิก คำอธิบาย</li></ul>
            </div>
            <div className="bg-amber-50/80 dark:bg-amber-950/20 rounded-xl p-3 sm:p-4 border border-amber-200/50 dark:border-amber-800/30 space-y-2.5">
              <p className="font-semibold text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />เงื่อนไขการแปะเซิร์ฟเวอร์</p>
              <div className="space-y-2 text-[10px] sm:text-xs text-amber-700 dark:text-amber-300/80">
                <div className="flex items-start gap-2"><LinkIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" /><span><strong>ลิงก์เชิญหมดอายุ / พัง</strong> — เซิร์ฟเวอร์จะถูกซ่อนทันที</span></div>
                <div className="flex items-start gap-2"><Timer className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" /><span><strong>ไม่ดันเซิร์ฟภายใน 30 วัน</strong> — เซิร์ฟเวอร์จะถูกซ่อนอัตโนมัติ</span></div>
                <div className="flex items-start gap-2"><Trash2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" /><span><strong>เนื้อหาไม่เหมาะสม</strong> — ถูกลบถาวรโดยไม่แจ้งล่วงหน้า</span></div>
              </div>
            </div>
            <div className="bg-blue-50/80 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200/50 dark:border-blue-800/30">
              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300/80 flex items-start gap-2"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" /><span>สามารถแปะได้เฉพาะเซิร์ฟเวอร์ที่คุณเป็น <strong>เจ้าของ (Owner)</strong> เท่านั้น</span></p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }} className="rounded-full" size="sm">ยกเลิก</Button>
            <Button onClick={handleAddByInvite} disabled={isSubmitting || !categoryId || !inviteUrl} className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSubmitting ? 'กำลังดึงข้อมูล...' : 'ส่งให้ตรวจสอบ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find Your Vibe Matchmaker Dialog (Phase 3) */}
      <FindYourVibeDialog
        open={isVibeOpen}
        onOpenChange={setIsVibeOpen}
        servers={servers}
        onJoinServer={handleClickJoin}
      />
    </div>
  );
}
