import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { refreshServerFromDiscord } from '@/lib/discord-server-refresh';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/bear-cafe/Footer';
import { ExpiredServerCard } from '@/components/discord/ExpiredServerCard';
import { EditLinkDialog } from '@/components/discord/EditLinkDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Plus, Users, Info, Loader2,
  MessageSquare, Search, ArrowUp, Clock, Globe, Eye, MousePointerClick,
  AlertTriangle, LinkIcon, Timer, Trash2, ChevronLeft, ChevronRight, Star,
  Filter, LogIn, ShieldCheck, Handshake, RefreshCw, Flame, Trophy, Heart, Bookmark, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHighlightStyle(color: string | null): React.CSSProperties {
  if (!color) return {};
  if (color === 'rainbow') return {};          // handled via className
  return { borderColor: color, borderWidth: 2 };
}

function isRainbow(color: string | null) { return color === 'rainbow'; }

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
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none disabled:opacity-50 transition-transform hover:scale-110"
            aria-label={`ให้ ${star} ดาว`}
          >
            <Star
              className={`w-3.5 h-3.5 transition-colors ${
                star <= display
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-muted-foreground/40'
              }`}
            />
          </button>
        ))}
      </div>
      {ratingCount > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {avgRating.toFixed(1)} ({ratingCount})
        </span>
      )}
    </div>
  );
}

// ─── Featured Carousel ────────────────────────────────────────────────────────
function FeaturedCarousel({
  servers,
  onClickJoin,
  carouselConfig,
}: {
  servers: DiscordServer[];
  onClickJoin: (s: DiscordServer) => void;
  carouselConfig?: { mode: 'manual' | 'auto_top7'; window_days: number; limit: number };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const touchStartX = useRef(0);
  const len = servers.length;

  const prev = useCallback(() => setActive((i) => (i - 1 + len) % len), [len]);
  const next = useCallback(() => setActive((i) => (i + 1) % len), [len]);

  useEffect(() => {
    if (len <= 1 || paused || isInteracting) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [len, paused, isInteracting, next]);

  if (len === 0) return null;

  const isAutoMode = carouselConfig?.mode !== 'manual';

  const getStyle = (index: number) => {
    const diff = ((index - active) % len + len) % len;
    const n = diff > len / 2 ? diff - len : diff;
    if (n === 0) return { transform: 'translateX(0) scale(1)', opacity: 1, zIndex: 20, filter: 'brightness(1)' };
    if (Math.abs(n) === 1) {
      const dir = n > 0 ? 1 : -1;
      return { transform: `translateX(${dir * 64}%) scale(0.86)`, opacity: 0.58, zIndex: 12, filter: 'brightness(0.72)' };
    }
    if (Math.abs(n) === 2) {
      const dir = n > 0 ? 1 : -1;
      return { transform: `translateX(${dir * 106}%) scale(0.76)`, opacity: 0.28, zIndex: 8, filter: 'brightness(0.52)' };
    }
    return { transform: 'translateX(0) scale(0)', opacity: 0, zIndex: 0 };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 sm:mb-10">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          {isAutoMode ? (
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
          ) : (
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-primary fill-primary" />
          )}
          <div>
            <h3 className="text-sm sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span>{isAutoMode ? `Top ${len} เซิร์ฟเวอร์ดันบ่อยสุด` : 'เซิร์ฟเวอร์แนะนำ'}</span>
              {isAutoMode && (
                <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 rounded-full font-medium">
                  Active 7 วัน
                </Badge>
              )}
            </h3>
          </div>
        </div>
      </div>

      <div
        className="relative w-full overflow-visible group px-0 sm:px-2"
        style={{ height: 'clamp(160px, 24vw, 280px)' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setIsInteracting(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsInteracting(false); }}
        onTouchStart={(e) => { setIsInteracting(true); touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 50) dx > 0 ? prev() : next(); setIsInteracting(false); }}
      >
        {servers.map((server, index) => {
          const style = getStyle(index);
          return (
            <div
              key={server.id}
              className="absolute inset-0 mx-auto w-[66%] sm:w-[62%] md:w-[60%] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl overflow-hidden cursor-pointer will-change-transform"
              style={{ ...style, pointerEvents: index === active ? 'auto' : 'none' }}
            >
              <div className="relative w-full h-full">
                {server.banner_url
                  ? <img src={server.banner_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  : <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/30" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                {/* Top Badge */}
                {isAutoMode && (
                  <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 z-10 flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] sm:text-xs font-bold border border-white/20 shadow-md">
                    <span className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                      index === 0 ? 'bg-yellow-500 text-black font-extrabold' :
                      index === 1 ? 'bg-slate-300 text-black' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-white/20 text-white'
                    )}>
                      #{index + 1}
                    </span>
                    <span className="flex items-center gap-0.5 text-orange-300 font-semibold">
                      <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                      {server.bump_count || 1} ดัน
                    </span>
                  </div>
                )}

                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex items-end gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg shrink-0 bg-white/10 backdrop-blur-sm">
                    {server.icon_url
                      ? <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      : <div className="w-full h-full flex items-center justify-center text-white text-lg sm:text-xl font-bold">{server.name[0]}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-white font-bold text-sm sm:text-lg truncate drop-shadow-lg">{server.name}</h4>
                      {server.is_verified && <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />}
                      {server.is_partner && <Handshake className="w-4 h-4 text-purple-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-white/70">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(server.member_count || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(server.impression_count || 0).toLocaleString()}</span>
                      {(server.rating_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{(server.avg_rating ?? 0).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  {server.invite_status === 'expired' ? (
                    <Button
                      size="sm"
                      disabled
                      className="rounded-full bg-red-600/70 text-white border border-red-500/60 shadow-lg px-3 sm:px-4 shrink-0 text-xs sm:text-sm cursor-not-allowed font-medium select-none"
                      title="ลิงก์เชิญหมดอายุ ไม่สามารถเข้าร่วมได้"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1 text-red-200" />
                      <span>ลิงก์พัง</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg px-3 sm:px-5 shrink-0 text-xs sm:text-sm"
                      onClick={() => onClickJoin(server)}
                    >
                      <span className="hidden sm:inline">เข้าดิสคอร์ด</span>
                      <span className="sm:hidden">เข้าร่วม</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {len > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Previous">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={next} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Next">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </>
        )}
      </div>
      {len > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {servers.map((_, i) => (
            <button key={i} onClick={() => setActive(i)} className={`rounded-full transition-all ${i === active ? 'w-5 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-primary/30 hover:bg-primary/50'}`} aria-label={`Go to ${i + 1}`} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Rainbow border animation ─────────────────────────────────────────────────
const rainbowStyle = `
@keyframes rainbow-border {
  0%   { border-color: #ff0000; }
  17%  { border-color: #ff8800; }
  33%  { border-color: #ffff00; }
  50%  { border-color: #00cc00; }
  67%  { border-color: #0088ff; }
  83%  { border-color: #8800ff; }
  100% { border-color: #ff0000; }
}
.rainbow-card {
  border-width: 2px !important;
  animation: rainbow-border 3s linear infinite;
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
  onDelete?: (server: DiscordServer) => void;
  onToggleSave?: (serverId: string) => void;
}

function ServerCard({
  server, user, userId, getCategoryName, getTimeSince,
  handleClickJoin, handleBump, bumpingId, handleRated,
  onRefresh, refreshingId, onEditLink, onDelete, onToggleSave,
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
      <Card
        className={[
          'group relative overflow-hidden rounded-2xl sm:rounded-3xl border shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 bg-white/70 dark:bg-card/70 backdrop-blur-xl h-full flex flex-col',
          isExpired ? 'opacity-90 border-red-500/30' : isRainbow(server.highlight_color) ? 'rainbow-card' : 'border-border/40',
        ].join(' ')}
        style={getHighlightStyle(server.highlight_color)}
      >
        {/* Banner */}
        <div className="relative h-20 sm:h-28 overflow-hidden shrink-0">
          {server.banner_url
            ? <img
                ref={bannerRef}
                src={server.banner_url}
                alt=""
                className={cn('w-full h-full object-cover', isExpired && 'grayscale-[40%]')}
                style={canAnimate ? {
                  transition: 'transform 700ms ease-out',
                  willChange: 'transform',
                } : undefined}
                loading="lazy"
                decoding="async"
              />
            : <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />}
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-card/80 via-transparent to-transparent" />

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
                'absolute top-2 sm:top-2.5 left-2 sm:left-2.5 z-10 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-sm flex items-center gap-1 group/save',
                server.is_saved
                  ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 ring-2 ring-white/40'
                  : 'bg-black/40 hover:bg-black/60 text-white/90 hover:text-white'
              )}
              title={server.is_saved ? 'บันทึกไว้แล้ว (คลิกเพื่อยกเลิก)' : 'บันทึกไว้ดูทีหลัง'}
              aria-label={server.is_saved ? 'บันทึกไว้แล้ว' : 'บันทึกเซิร์ฟเวอร์'}
            >
              <Heart
                className={cn(
                  'w-3.5 h-3.5 transition-transform group-active/save:scale-125',
                  server.is_saved && 'fill-white'
                )}
              />
              {(server.save_count || 0) > 0 && (
                <span className="text-[10px] font-bold pr-0.5 leading-none">
                  {server.save_count}
                </span>
              )}
            </button>
          )}

          {/* Badges: Expired, Trending, Rising, New, Partner, Category */}
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1.5 flex-wrap justify-end">
            {isExpired ? (
              <Badge className="text-[9px] sm:text-[10px] bg-red-600/90 text-white border-none backdrop-blur-md shadow-sm px-1.5 sm:px-2 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />ลิงก์หมดอายุ
              </Badge>
            ) : server.is_rising ? (
              <Badge className="text-[9px] sm:text-[10px] bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-none backdrop-blur-md shadow-sm px-1.5 sm:px-2 flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5 fill-white" />โตเร็ว
              </Badge>
            ) : (server.discovery_score || 0) >= 8 ? (
              <Badge className="text-[9px] sm:text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none backdrop-blur-md shadow-sm px-1.5 sm:px-2 flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5 fill-white" />กำลังมาแรง
              </Badge>
            ) : server.is_new ? (
              <Badge className="text-[9px] sm:text-[10px] bg-emerald-500/90 text-white border-none backdrop-blur-md shadow-sm px-1.5 sm:px-2 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />ใหม่
              </Badge>
            ) : null}

            {server.is_partner && (
              <Badge className="text-[9px] sm:text-[10px] bg-purple-500/90 text-white border-none backdrop-blur-md shadow-sm px-1.5 sm:px-2 flex items-center gap-0.5">
                <Handshake className="w-2.5 h-2.5" />Partner
              </Badge>
            )}
            {getCategoryName(server.category_id) && (
              <Badge className="text-[9px] sm:text-[10px] bg-white/80 dark:bg-card/80 text-foreground border-none backdrop-blur-md shadow-sm font-medium px-1.5 sm:px-2">
                {getCategoryName(server.category_id)}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-3 sm:p-5 -mt-8 sm:-mt-12 relative flex-1 flex flex-col">
          {/* Icon */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 sm:border-[3px] border-white dark:border-card shadow-lg bg-white dark:bg-card mb-2 sm:mb-3 ring-2 ring-primary/10">
            {server.icon_url
              ? <img src={server.icon_url} alt={server.name} className={cn('w-full h-full object-cover', isExpired && 'grayscale-[30%]')} loading="lazy" decoding="async" />
              : <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-base sm:text-xl font-bold text-primary">{server.name[0]}</div>}
          </div>

          {/* Name + badges */}
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-bold text-sm sm:text-lg truncate text-foreground group-hover:text-primary transition-colors">{server.name}</h3>
            {server.is_verified && (
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" aria-label="Verified" />
            )}
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words flex-1">
            {server.description || 'ไม่มีคำอธิบาย'}
          </p>

          {/* Recommendation Reason (Plan 2) */}
          {server.recommendation_reason && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary dark:text-primary-foreground font-medium bg-primary/10 dark:bg-primary/20 rounded-lg px-2.5 py-1 w-fit border border-primary/20">
              <span>{server.recommendation_reason}</span>
            </div>
          )}

          {/* Star rating */}
          <div className="mt-2 sm:mt-3">
            <StarRating
              serverId={server.id}
              myRating={server.my_rating ?? 0}
              avgRating={server.avg_rating ?? 0}
              ratingCount={server.rating_count ?? 0}
              userId={userId}
              onRated={handleRated}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary/70" />
              <span className="font-medium">{(server.member_count || 0).toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1" title="จำนวนครั้งที่การ์ดถูกแสดง (Impression)">
              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary/70" />
              <span className="font-medium">{(server.impression_count || 0).toLocaleString()}</span>
            </span>
            {server.bumped_at && (
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3 opacity-50" />
                <span className="opacity-60">{getTimeSince(server.bumped_at)}</span>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/30 flex items-center gap-1.5 sm:gap-2">
            <BumpButton server={server} user={user} onBump={handleBump} bumpingId={bumpingId} />

            {/* Refresh — only for owner */}
            {user && server.owner_id === user.discord_id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 w-8 p-0 shrink-0"
                onClick={() => onRefresh(server)}
                disabled={refreshingId === server.id}
                title="รีโหลดข้อมูลจาก Discord"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === server.id ? 'animate-spin' : ''}`} />
              </Button>
            )}

            {/* Delete button — strictly for owner only */}
            {user && server.owner_id === user.discord_id && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full h-8 w-8 p-0 shrink-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(server)}
                title="ลบเซิร์ฟเวอร์ออกจากระบบ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* Main Action Button (Right aligned) */}
            {isExpired ? (
              user && server.owner_id === user.discord_id && onEditLink ? (
                /* For Owner: Direct "แก้ลิงก์" button */
                <Button
                  size="sm"
                  className="rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 px-3.5 sm:px-4 ml-auto text-xs sm:text-sm font-medium shrink-0 gap-1"
                  onClick={() => onEditLink(server)}
                  title="แก้ไขลิงก์เชิญใหม่"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>แก้ลิงก์</span>
                </Button>
              ) : (
                /* For Visitors: Disabled "ลิงก์พัง" button */
                <Button
                  size="sm"
                  disabled
                  className="rounded-full bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-300 border border-destructive/30 px-3 sm:px-4 ml-auto text-xs sm:text-sm cursor-not-allowed opacity-90 font-medium select-none shrink-0"
                  title="ลิงก์เชิญหมดอายุ ไม่สามารถเข้าร่วมได้"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-destructive shrink-0" />
                  <span>ลิงก์พัง</span>
                </Button>
              )
            ) : (
              /* Normal Join button */
              <Button
                size="sm"
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/15 px-3 sm:px-5 ml-auto text-xs sm:text-sm shrink-0"
                onClick={() => handleClickJoin(server)}
              >
                เข้าดิสคอร์ด
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recommendation' | 'trending' | 'rising' | 'new' | 'recent' | 'rating' | 'popular'>('recommendation');
  const [userState, setUserState] = useState<UserStateType>('NEW');
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savingServerId, setSavingServerId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [carouselConfig, setCarouselConfig] = useState<{
    mode: 'manual' | 'auto_top7';
    window_days: number;
    limit: number;
    prioritize_partners?: boolean;
  }>({ mode: 'auto_top7', window_days: 7, limit: 7 });

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
          limit: val.limit || 7,
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

  const resetForm = () => { setInviteUrl(''); setCategoryId(''); };

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
  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return '';
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'เมื่อสักครู่';
    if (hours < 24) return `${hours} ชม. ที่แล้ว`;
    return `${Math.floor(hours / 24)} วันที่แล้ว`;
  };

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
    // Auto Top 7 mode: Active within window_days (default 7 days) and ranked by bump_count DESC, bumped_at DESC
    const windowDays = carouselConfig.window_days || 7;
    const cutoffTime = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const limitCount = carouselConfig.limit || 7;

    featuredServers = [...servers]
      .filter((s) => {
        if (s.invite_status === 'expired') return false;
        if (!s.bumped_at) return false;
        return new Date(s.bumped_at).getTime() >= cutoffTime;
      })
      .sort((a, b) => {
        if (carouselConfig.prioritize_partners && a.is_partner !== b.is_partner) {
          return a.is_partner ? -1 : 1;
        }
        const bumpA = a.bump_count ?? 0;
        const bumpB = b.bump_count ?? 0;
        if (bumpB !== bumpA) return bumpB - bumpA;
        return new Date(b.bumped_at ?? 0).getTime() - new Date(a.bumped_at ?? 0).getTime();
      })
      .slice(0, limitCount);
  }

  const filteredServers = servers
    .filter((server) => {
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
      if (sortMode === 'rating') {
        const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.rating_count || 0) - (a.rating_count || 0);
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
      <style>{rainbowStyle}</style>

      {/* Header */}
      <div className="bg-white/40 dark:bg-card/40 backdrop-blur-md border-b border-latte/20 dark:border-coffee/20 sticky top-0 z-30">
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full w-9 h-9 sm:w-10 sm:h-10">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <h1 className="text-base sm:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span className="hidden sm:inline">โปรโมทเซิร์ฟเวอร์ฟรี</span>
              <span className="sm:hidden">โปรโมทเซิร์ฟเวอร์</span>
            </h1>
          </div>
          <Button onClick={handleOpenAdd} size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-xs sm:text-sm px-3 sm:px-4">
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">แปะเซิร์ฟเวอร์ฟรี</span>
            <span className="sm:hidden">แปะเซิร์ฟ</span>
          </Button>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        {/* Hero */}
        <div className="text-center mb-6 sm:mb-12 space-y-2 sm:space-y-4">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground">
            หาเพื่อนใหม่ <span className="text-primary">เข้าดิสคอร์ด</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
            ศูนย์รวมเซิร์ฟเวอร์ดิสคอร์ดคุณภาพจากชุมชน Bear Cafe แปะฟรี! ไม่มีค่าใช้จ่าย
          </motion.p>
        </div>

        {/* UI Design Switcher (Kawaii Shop vs Classic Grid) */}
        {/* Featured Carousel */}
        <FeaturedCarousel
          servers={featuredServers}
          onClickJoin={handleClickJoin}
          carouselConfig={carouselConfig}
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-8">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="ค้นหาเซิร์ฟเวอร์..." className="pl-10 rounded-xl bg-white/50 dark:bg-card/50 border-latte/30 dark:border-coffee/30 h-9 sm:h-10 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex gap-1 sm:gap-1.5 items-center overflow-x-auto pb-0.5 no-scrollbar">
                  <Button
                    variant={sortMode === 'recommendation' ? 'default' : 'outline'}
                    onClick={() => setSortMode('recommendation')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs sm:text-sm gap-1.5 shrink-0 shadow-sm"
                    size="sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-semibold">
                      {userState === 'ESTABLISHED' || userState === 'EARLY'
                        ? 'แนะนำสำหรับคุณ'
                        : 'น่าสนใจตอนนี้'}
                    </span>
                  </Button>
                  <Button
                    variant={sortMode === 'trending' ? 'default' : 'outline'}
                    onClick={() => setSortMode('trending')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm gap-1 shrink-0"
                    size="sm"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>กำลังมาแรง</span>
                  </Button>
                  <Button
                    variant={sortMode === 'rising' ? 'default' : 'outline'}
                    onClick={() => setSortMode('rising')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm gap-1 shrink-0"
                    size="sm"
                  >
                    <Flame className="w-3.5 h-3.5 text-purple-500" />
                    <span>โตเร็ว</span>
                  </Button>
                  <Button
                    variant={sortMode === 'new' ? 'default' : 'outline'}
                    onClick={() => setSortMode('new')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm gap-1 shrink-0"
                    size="sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>ใหม่</span>
                  </Button>
                  <Button
                    variant={sortMode === 'recent' ? 'default' : 'outline'}
                    onClick={() => setSortMode('recent')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm gap-1 shrink-0"
                    size="sm"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>ล่าสุด</span>
                  </Button>
                  <Button
                    variant={sortMode === 'rating' ? 'default' : 'outline'}
                    onClick={() => setSortMode('rating')}
                    className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm gap-1 shrink-0"
                    size="sm"
                  >
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span>คะแนน</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
                  <Button
                    variant={selectedCategory === 'all' && !showSavedOnly ? 'default' : 'outline'}
                    onClick={() => { setSelectedCategory('all'); setShowSavedOnly(false); }}
                    className="rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3"
                    size="sm"
                  >
                    ทั้งหมด
                  </Button>
                  <Button
                    variant={showSavedOnly ? 'default' : 'outline'}
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
                      if (!showSavedOnly) setSelectedCategory('all');
                    }}
                    className={cn(
                      'rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3 gap-1.5 font-medium',
                      showSavedOnly && 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500'
                    )}
                    size="sm"
                  >
                    <Heart className={cn('w-3.5 h-3.5', showSavedOnly ? 'fill-white text-white' : 'text-rose-500')} />
                    <span>ที่บันทึกไว้</span>
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id && !showSavedOnly ? 'default' : 'outline'}
                      onClick={() => { setSelectedCategory(cat.id); setShowSavedOnly(false); }}
                      className="rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3"
                      size="sm"
                    >
                      {cat.icon} {cat.name}
                    </Button>
                  ))}
                </div>
                {user && (
                  <div className="flex items-center gap-1.5 shrink-0 bg-white/50 dark:bg-card/50 rounded-full px-2.5 py-1.5 border border-border/40">
                    <Switch checked={showMyOnly} onCheckedChange={(val) => { setShowMyOnly(val); if (val) setShowSavedOnly(false); }} className="scale-75" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium whitespace-nowrap">ของฉัน</span>
                  </div>
                )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 items-stretch">
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
                      onDelete={(s) => setDeleteTarget(s)}
                      onToggleSave={handleToggleSave}
                    />
                  </motion.div>
                ))}
              </div>
            )}

        {/* Owner expired servers section — visible only to the server owner (Req 2.3, 4.3, 4.4, 5.1, 5.2, 5.6) */}
        {isAuthenticated && ownerExpiredServers.length > 0 && (
          <div className="mt-8 sm:mt-12">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" aria-hidden="true" />
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                เซิร์ฟเวอร์ของคุณที่ลิงก์หมดอายุ
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
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
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
    </div>
  );
}
