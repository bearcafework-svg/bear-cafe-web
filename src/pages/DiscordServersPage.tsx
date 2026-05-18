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
  Filter, LogIn, ShieldCheck, Handshake, Settings, Hash, BotIcon, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

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
  click_count: number | null;
  impression_count: number | null;
  is_featured: boolean | null;
  is_verified: boolean;
  is_partner: boolean;
  highlight_color: string | null;
  carousel_order: number | null;
  notify_channel_id: string | null;
  invite_status: "valid" | "expired" | "unknown";
  invite_last_checked_at: string | null;
  // joined client-side
  avg_rating?: number;
  rating_count?: number;
  my_rating?: number;
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
function FeaturedCarousel({ servers, onClickJoin }: {
  servers: DiscordServer[]; onClickJoin: (s: DiscordServer) => void;
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
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Star className="w-4 h-4 sm:w-5 sm:h-5 text-primary fill-primary" />
        <div>
          <h3 className="text-sm sm:text-lg font-bold text-foreground">เซิร์ฟเวอร์แนะนำ</h3>
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
                  <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg px-3 sm:px-5 shrink-0 text-xs sm:text-sm" onClick={() => onClickJoin(server)}>
                    <span className="hidden sm:inline">เข้าดิสคอร์ด</span>
                    <span className="sm:hidden">เข้าร่วม</span>
                  </Button>
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
          // Fire-and-forget — don't block render
          supabase.rpc('increment_impression', { _server_id: serverId }).then(({ error }) => {
            if (error) console.warn('impression rpc error:', error.message);
          });
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
  openBotDialog: (server: DiscordServer) => void;
  handleRated: (serverId: string, rating: number) => void;
  onRefresh: (server: DiscordServer) => void;
  refreshingId: string | null;
}

function ServerCard({
  server, user, userId, getCategoryName, getTimeSince,
  handleClickJoin, handleBump, bumpingId, openBotDialog, handleRated,
  onRefresh, refreshingId,
}: ServerCardProps) {
  const cardRef = useImpressionObserver(server.id);
  const bannerRef = useRef<HTMLImageElement>(null);
  const canAnimate = server.is_verified === true;

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
          isRainbow(server.highlight_color) ? 'rainbow-card' : 'border-border/40',
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
                className="w-full h-full object-cover"
                style={canAnimate ? {
                  transition: 'transform 700ms ease-out',
                  willChange: 'transform',
                } : undefined}
                loading="lazy"
                decoding="async"
              />
            : <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />}
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-card/80 via-transparent to-transparent" />
          {/* Category + Partner badge */}
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1.5 flex-wrap justify-end">
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
              ? <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
            <span className="flex items-center gap-1" title="จำนวนครั้งที่การ์ดถูกมองเห็น">
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
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/30 flex items-center gap-2">
            <BumpButton server={server} user={user} onBump={handleBump} bumpingId={bumpingId} />
            {/* Bot settings — only for owner */}
            {user && server.owner_id === user.discord_id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 w-8 p-0 shrink-0"
                onClick={() => openBotDialog(server)}
                title="ตั้งค่าบอทแจ้งเตือน"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            )}
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
            <Button
              size="sm"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/15 px-3 sm:px-5 ml-auto text-xs sm:text-sm"
              onClick={() => handleClickJoin(server)}
            >
              เข้าดิสคอร์ด
            </Button>
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
  const [sortMode, setSortMode] = useState<'recent' | 'popular' | 'rating'>('recent');
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // ── Invite status state ───────────────────────────────────────────────────
  const [ownerExpiredServers, setOwnerExpiredServers] = useState<DiscordServer[]>([]);
  const [editLinkServer, setEditLinkServer] = useState<DiscordServer | null>(null);
  const [isEditLinkOpen, setIsEditLinkOpen] = useState(false);
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);

  const userId = user?.discord_id || null;

  // ── Bot settings dialog state ─────────────────────────────────────────────
  type TextChannel = { id: string; name: string };
  type BotStatus = 'idle' | 'checking' | 'no-bot' | 'has-bot';

  const [botDialogServer, setBotDialogServer] = useState<DiscordServer | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [textChannels, setTextChannels] = useState<TextChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  const BOT_INVITE_URL =
    `https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_BOT_CLIENT_ID ?? ''}&permissions=2048&scope=bot%20applications.commands`;

  const openBotDialog = async (server: DiscordServer) => {
    setBotDialogServer(server);
    setSelectedChannel(server.notify_channel_id ?? '');
    setTextChannels([]);
    setBotStatus('checking');

    // discord_id is the actual Discord Guild ID — must be a non-empty string
    const guildId = server.discord_id?.trim();
    if (!guildId) {
      setBotStatus('no-bot');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('discord-server-settings', {
        body: { server_discord_id: guildId, action: 'get_channels' },
      });

      if (error || !data?.success) {
        setBotStatus('no-bot');
        return;
      }

      setTextChannels((data.channels ?? []) as TextChannel[]);
      setBotStatus('has-bot');
    } catch {
      setBotStatus('no-bot');
    }
  };

  const handleSaveChannel = async () => {
    if (!botDialogServer || !selectedChannel) return;
    setSavingChannel(true);
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .update({ notify_channel_id: selectedChannel } as any)
        .eq('id', botDialogServer.id)) as any;
      if (error) throw error;
      setServers((prev) =>
        prev.map((s) => s.id === botDialogServer.id ? { ...s, notify_channel_id: selectedChannel } : s)
      );
      toast({ title: 'บันทึกห้องแจ้งเตือนเรียบร้อย', className: 'bg-green-500 text-white' });
      setBotDialogServer(null);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setSavingChannel(false);
    }
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, serverRes, ratingRes] = await Promise.all([
        (supabase.from('discord_server_categories' as any).select('*').order('sort_order', { ascending: true })) as any,
        (supabase.from('discord_servers' as any).select('*').eq('status', 'approved').neq('invite_status', 'expired').order('bumped_at', { ascending: false })) as any,
        (supabase.from('server_ratings' as any).select('server_id, rating, user_id')) as any,
      ]);

      setCategories((catRes.data || []) as Category[]);

      const rawServers = (serverRes.data || []) as DiscordServer[];
      const ratings = (ratingRes.data || []) as { server_id: string; rating: number; user_id: string }[];

      // Aggregate ratings per server
      const ratingMap = new Map<string, { sum: number; count: number; mine: number }>();
      ratings.forEach(({ server_id, rating, user_id: ruid }) => {
        const cur = ratingMap.get(server_id) || { sum: 0, count: 0, mine: 0 };
        cur.sum += rating;
        cur.count += 1;
        if (ruid === userId) cur.mine = rating;
        ratingMap.set(server_id, cur);
      });

      const enriched = rawServers.map((s) => {
        const r = ratingMap.get(s.id);
        return {
          ...s,
          avg_rating: r ? r.sum / r.count : 0,
          rating_count: r?.count ?? 0,
          my_rating: r?.mine ?? 0,
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
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
          },
          body: JSON.stringify({ invite_url: inviteUrl, category_id: categoryId }),
        }
      );

      const result = await response.json();

      // Handle specific error cases
      if (response.status === 403) {
        toast({
          title: '⚠️ ไม่สามารถเพิ่มเซิร์ฟเวอร์ได้',
          description: result.error || 'คุณไม่ใช่เจ้าของเซิร์ฟเวอร์นี้',
          variant: 'destructive',
        });
        return;
      }
      if (response.status === 409) {
        toast({
          title: 'เซิร์ฟเวอร์นี้มีอยู่แล้ว',
          description: result.error || 'เซิร์ฟเวอร์นี้ถูกเพิ่มในระบบแล้ว',
          variant: 'destructive',
        });
        return;
      }
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);

      toast({ title: 'ส่งคำขอเรียบร้อยแล้ว!', description: `เซิร์ฟเวอร์ "${result.server?.name}" จะแสดงผลหลังจากได้รับการตรวจสอบ`, className: 'bg-green-500 text-white' });
      setIsAddOpen(false);
      resetForm();
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
          }
        }
      } catch {
        // ถ้าดึงไม่ได้ก็ bump ต่อได้ ไม่ต้อง block
      }

      // ── อัปเดต bumped_at + ข้อมูลใหม่ ──────────────────────────────────────
      const updatePayload = {
        bumped_at: new Date().toISOString(),
        ...freshData,
      };

      const { error } = await (supabase
        .from('discord_servers' as any)
        .update(updatePayload as any)
        .eq('id', serverId)) as any;
      if (error) throw error;

      toast({ title: 'ดันเซิร์ฟเวอร์สำเร็จ!', description: freshData.member_count ? `อัปเดตข้อมูลล่าสุด: ${freshData.member_count.toLocaleString()} สมาชิก` : undefined, className: 'bg-green-500 text-white' });
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
        s.id === server.id ? { ...s, ...result.updated } : s
      ));
      toast({
        title: '✅ อัปเดตข้อมูลสำเร็จ',
        description: `${result.updated.member_count != null ? `${result.updated.member_count.toLocaleString()} สมาชิก` : ''}`,
        className: 'bg-green-500 text-white',
      });
    } else {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: result.error, variant: 'destructive' });
    }
  };

  // ── Click tracking ───────────────────────────────────────────────────────────
  const handleClickJoin = async (server: DiscordServer) => {
    // Open the invite immediately — don't block on tracking
    window.open(server.invite_url, '_blank', 'noopener,noreferrer');

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

        // 4. Bot notification — only if server has a notify channel configured
        if (server.notify_channel_id && server.discord_id?.trim()) {
          await supabase.functions.invoke('discord-server-settings', {
            body: {
              action: 'send_notification',
              server_discord_id: server.discord_id,
              channel_id: server.notify_channel_id,
              message: '🐻 มีเพื่อนใหม่จาก Bear Cafe กำลังเข้าร่วมเซิร์ฟเวอร์ของคุณ!',
            },
          });
        }
      } catch (err) {
        console.error('Click tracking failed:', err);
      }
    })();
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
  const featuredServers = [...servers]
    .filter((s) => s.is_featured && s.invite_status !== 'expired')
    .sort((a, b) => (a.carousel_order ?? 999) - (b.carousel_order ?? 999));

  const filteredServers = servers
    .filter((server) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || server.name.toLowerCase().includes(q) || (server.description ?? '').toLowerCase().includes(q);
      const matchCat = selectedCategory === 'all' || server.category_id === selectedCategory;
      const matchMine = !showMyOnly || (user && server.owner_id === user.discord_id);
      return matchSearch && matchCat && matchMine;
    })
    .sort((a, b) => {
      // Partners always float to top
      if (a.is_partner !== b.is_partner) return a.is_partner ? -1 : 1;
      if (sortMode === 'popular') return (b.impression_count || 0) - (a.impression_count || 0);
      if (sortMode === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
      return new Date(b.bumped_at ?? 0).getTime() - new Date(a.bumped_at ?? 0).getTime();
    });

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

        {/* Featured Carousel */}
        <FeaturedCarousel servers={featuredServers} onClickJoin={handleClickJoin} />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div className="flex gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาเซิร์ฟเวอร์..." className="pl-10 rounded-xl bg-white/50 dark:bg-card/50 border-latte/30 dark:border-coffee/30 h-9 sm:h-10 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-1.5 items-center">
              <Button variant={sortMode === 'recent' ? 'default' : 'outline'} onClick={() => setSortMode('recent')} className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3" size="sm">
                <Clock className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">ล่าสุด</span>
              </Button>
              <Button variant={sortMode === 'popular' ? 'default' : 'outline'} onClick={() => setSortMode('popular')} className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3" size="sm">
                <MousePointerClick className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">ยอดนิยม</span>
              </Button>
              <Button variant={sortMode === 'rating' ? 'default' : 'outline'} onClick={() => setSortMode('rating')} className="rounded-full h-9 sm:h-10 px-2.5 sm:px-3" size="sm">
                <Star className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">คะแนน</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
              <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} onClick={() => setSelectedCategory('all')} className="rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3" size="sm">ทั้งหมด</Button>
              {categories.map((cat) => (
                <Button key={cat.id} variant={selectedCategory === cat.id ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat.id)} className="rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3" size="sm">
                  {cat.icon} {cat.name}
                </Button>
              ))}
            </div>
            {user && (
              <div className="flex items-center gap-1.5 shrink-0 bg-white/50 dark:bg-card/50 rounded-full px-2.5 py-1.5 border border-border/40">
                <Switch checked={showMyOnly} onCheckedChange={setShowMyOnly} className="scale-75" />
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
          <div className="text-center py-12 sm:py-20 bg-white/30 dark:bg-card/20 rounded-3xl border-2 border-dashed border-latte/30 dark:border-coffee/30">
            <Search className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">ไม่พบเซิร์ฟเวอร์ที่ต้องการ</h3>
            <p className="text-muted-foreground text-sm mb-4">ลองเปลี่ยนคำค้นหา หรือหมวดหมู่ดูนะคะ</p>
            <Button size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowMyOnly(false); }}>ล้างตัวกรองทั้งหมด</Button>
          </div>
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
                  openBotDialog={openBotDialog}
                  handleRated={handleRated}
                  onRefresh={handleRefreshServer}
                  refreshingId={refreshingId}
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
        onSuccess={(serverId) => {
          // Move server from expired section to public listing
          const updated = ownerExpiredServers.find((s) => s.id === serverId);
          if (updated) {
            setOwnerExpiredServers((prev) => prev.filter((s) => s.id !== serverId));
            setServers((prev) => [
              { ...updated, invite_status: 'valid' as const },
              ...prev,
            ]);
          }
          setEditLinkServer(null);
        }}
      />

      {/* ── Bot Settings Dialog ── */}
      <Dialog open={!!botDialogServer} onOpenChange={(o) => !o && setBotDialogServer(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              ตั้งค่าบอทแจ้งเตือน
            </DialogTitle>
            <DialogDescription>
              {botDialogServer?.name} — เลือกห้องที่บอทจะส่งการแจ้งเตือน
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* Checking */}
            {botStatus === 'checking' && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">กำลังตรวจสอบสถานะบอท...</span>
              </div>
            )}

            {/* No bot */}
            {botStatus === 'no-bot' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800/30 p-4">
                  <BotIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">บอทยังไม่ได้อยู่ในเซิร์ฟเวอร์</p>
                    <p className="text-amber-700 dark:text-amber-300/80 text-xs leading-relaxed">
                      เชิญบอทเข้าเซิร์ฟเวอร์ก่อน แล้วกลับมาตั้งค่าห้องแจ้งเตือนได้เลย
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full rounded-xl gap-2"
                  onClick={() => window.open(BOT_INVITE_URL, '_blank', 'noopener,noreferrer')}
                >
                  <BotIcon className="h-4 w-4" />
                  เชิญบอทเข้าเซิร์ฟเวอร์
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl gap-2 text-sm"
                  onClick={() => botDialogServer && openBotDialog(botDialogServer)}
                >
                  <Loader2 className="h-3.5 w-3.5" />
                  ตรวจสอบอีกครั้ง
                </Button>
              </div>
            )}

            {/* Has bot — show channel selector */}
            {botStatus === 'has-bot' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-950/20 dark:border-emerald-800/30 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                  <BotIcon className="h-4 w-4 shrink-0" />
                  บอทอยู่ในเซิร์ฟเวอร์แล้ว ✓
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    เลือกห้อง Text Channel
                  </label>
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="เลือกห้องที่ต้องการ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {textChannels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          <span className="flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                            {ch.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {botDialogServer?.notify_channel_id && (
                    <p className="text-xs text-muted-foreground">
                      ห้องปัจจุบัน: #{textChannels.find((c) => c.id === botDialogServer.notify_channel_id)?.name ?? botDialogServer.notify_channel_id}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBotDialogServer(null)}>
              ยกเลิก
            </Button>
            {botStatus === 'has-bot' && (
              <Button
                className="rounded-xl"
                disabled={!selectedChannel || savingChannel}
                onClick={handleSaveChannel}
              >
                {savingChannel && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                บันทึก
              </Button>
            )}
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
