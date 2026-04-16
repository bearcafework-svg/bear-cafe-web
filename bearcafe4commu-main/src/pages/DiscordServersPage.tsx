import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/bear-cafe/Footer';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
  ArrowLeft, Plus, Users, Info, Loader2, 
  MessageSquare, Search, ArrowUp, Clock, Globe, MousePointerClick, 
  AlertTriangle, LinkIcon, Timer, Trash2, ChevronLeft, ChevronRight, Star,
  Filter, LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface DiscordServer {
  id: string;
  name: string;
  description: string;
  member_count: number;
  icon_url: string;
  banner_url: string;
  invite_url: string;
  status: string;
  owner_id: string;
  category_id: string;
  bumped_at: string;
  click_count: number;
  is_featured: boolean;
}

function useBumpCountdown(bumpedAt: string) {
  const [timeLeft, setTimeLeft] = useState('');
  const [canBump, setCanBump] = useState(false);

  useEffect(() => {
    const cooldownEnd = new Date(bumpedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
    
    const update = () => {
      const now = Date.now();
      if (now >= cooldownEnd) {
        setCanBump(true);
        setTimeLeft('');
        return false;
      }
      setCanBump(false);
      const diff = cooldownEnd - now;
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (d > 0) setTimeLeft(`${d}ว ${h}ชม`);
      else if (h > 0) setTimeLeft(`${h}ชม ${m}น`);
      else setTimeLeft(`${m}น`);
      return true;
    };

    if (!update()) return;
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval);
    }, 60000);
    return () => clearInterval(interval);
  }, [bumpedAt]);

  return { timeLeft, canBump };
}

function BumpButton({ server, user, onBump, bumpingId }: { 
  server: DiscordServer; user: any; onBump: (id: string) => void; bumpingId: string | null 
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
      {bumpingId === server.id ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : canBump ? (
        <><ArrowUp className="w-3 h-3 mr-1" />ดันเซิร์ฟ</>
      ) : (
        <><Timer className="w-3 h-3 mr-1" />{timeLeft}</>
      )}
    </Button>
  );
}

/* ── Peek-effect Featured Carousel ──────────────────────── */
function FeaturedCarousel({ servers, onClickJoin }: { servers: DiscordServer[]; onClickJoin: (s: DiscordServer) => void }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const touchStartX = useRef(0);
  const len = servers.length;

  const prev = useCallback(() => setActive(i => (i - 1 + len) % len), [len]);
  const next = useCallback(() => setActive(i => (i + 1) % len), [len]);

  useEffect(() => {
    if (len <= 1 || paused || isInteracting) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [len, paused, isInteracting, next]);

  if (len === 0) return null;

  const getStyle = (index: number) => {
    const diff = ((index - active) % len + len) % len;
    const normalised = diff > len / 2 ? diff - len : diff;

    if (normalised === 0) return { transform: 'translateX(0) scale(1)', opacity: 1, zIndex: 20, filter: 'brightness(1)' };
    if (Math.abs(normalised) === 1) {
      const dir = normalised > 0 ? 1 : -1;
      return { transform: `translateX(${dir * 64}%) scale(0.86)`, opacity: 0.58, zIndex: 12, filter: 'brightness(0.72)' };
    }
    if (Math.abs(normalised) === 2) {
      const dir = normalised > 0 ? 1 : -1;
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
          <p className="text-[10px] sm:text-xs text-muted-foreground">Featured center mode carousel • coverflow effect</p>
        </div>
      </div>

      <div
        className="relative w-full overflow-visible group px-0 sm:px-2"
        style={{ height: 'clamp(160px, 24vw, 280px)' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setIsInteracting(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsInteracting(false);
          }
        }}
        onTouchStart={(e) => {
          setIsInteracting(true);
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 50) dx > 0 ? prev() : next();
          setIsInteracting(false);
        }}
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
                {server.banner_url ? (
                  <img src={server.banner_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex items-end gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg shrink-0 bg-white/10 backdrop-blur-sm">
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-lg sm:text-xl font-bold">{server.name[0]}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold text-sm sm:text-lg truncate drop-shadow-lg">{server.name}</h4>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-white/70">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(server.member_count || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{(server.click_count || 0).toLocaleString()}</span>
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
            <button onClick={prev} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label="Previous">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={next} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label="Next">
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
  const [sortMode, setSortMode] = useState<'recent' | 'popular'>('recent');
  const [showMyOnly, setShowMyOnly] = useState(false);

  const featuredServers = servers.filter(s => s.is_featured);

  const [inviteUrl, setInviteUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, serverRes] = await Promise.all([
        (supabase.from('discord_server_categories' as any).select('*').order('sort_order', { ascending: true })) as any,
        (supabase.from('discord_servers' as any).select('*').eq('status', 'approved').order('bumped_at', { ascending: false })) as any,
      ]);
      setCategories((catRes.data || []) as Category[]);
      setServers((serverRes.data || []) as DiscordServer[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const requireLogin = (action: () => void) => {
    if (!isAuthenticated) {
      toast({ title: 'กรุณาเข้าสู่ระบบก่อน', description: 'คุณต้องล็อกอินเพื่อใช้งานฟีเจอร์นี้', variant: 'destructive' });
      navigate('/login');
      return;
    }
    action();
  };

  const handleOpenAdd = () => {
    requireLogin(() => {
      setIsAddOpen(true);
      resetForm();
    });
  };

  const handleAddByInvite = async () => {
    if (!user) return;
    if (!inviteUrl || !categoryId) {
      toast({ title: 'กรุณากรอกลิงก์เชิญและเลือกหมวดหมู่', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await supabase.functions.invoke('resolve-discord-invite', {
        body: { invite_url: inviteUrl, category_id: categoryId },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (!result.success) {
        if (result.error?.includes('not the owner') || result.error?.includes('ไม่ใช่เจ้าของ')) {
          throw new Error(result.error);
        }
        throw new Error(result.error || 'Unknown error');
      }

      toast({ 
        title: 'ส่งคำขอเรียบร้อยแล้ว!', 
        description: `เซิร์ฟเวอร์ "${result.server.name}" จะแสดงผลหลังจากได้รับการตรวจสอบ`,
        className: 'bg-green-500 text-white'
      });
      setIsAddOpen(false);
      resetForm();
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('owner') || msg.includes('เจ้าของ')) {
        toast({ 
          title: '⚠️ ไม่สามารถเพิ่มเซิร์ฟเวอร์ได้', 
          description: 'คุณไม่ใช่เจ้าของเซิร์ฟเวอร์นี้ สามารถแปะได้เฉพาะเซิร์ฟเวอร์ที่คุณเป็นเจ้าของเท่านั้น', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: msg, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setInviteUrl('');
    setCategoryId('');
  };

  const handleBump = async (serverId: string) => {
    if (!user) return;
    setBumpingId(serverId);
    try {
      const server = servers.find(s => s.id === serverId);
      if (!server || server.owner_id !== user.discord_id) {
        toast({ title: 'คุณไม่ใช่เจ้าของเซิร์ฟเวอร์นี้', variant: 'destructive' });
        return;
      }
      const { error } = await (supabase
        .from('discord_servers' as any)
        .update({ bumped_at: new Date().toISOString() } as any)
        .eq('id', serverId)) as any;
      if (error) throw error;
      toast({ title: 'ดันเซิร์ฟเวอร์สำเร็จ!', description: 'เซิร์ฟเวอร์ของคุณขึ้นไปอยู่บนสุดแล้ว', className: 'bg-green-500 text-white' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setBumpingId(null);
    }
  };

  const handleClickJoin = async (server: DiscordServer) => {
    // Unique click tracking: only count once per user per server
    if (user) {
      try {
        const userId = user.discord_id || user.id;
        await (supabase.from('server_clicks' as any).upsert(
          { server_id: server.id, user_id: userId } as any,
          { onConflict: 'server_id,user_id', ignoreDuplicates: true }
        )) as any;

        // Get real unique count
        const { count } = await (supabase
          .from('server_clicks' as any)
          .select('*', { count: 'exact', head: true })
          .eq('server_id', server.id)) as any;

        if (count != null) {
          await (supabase.from('discord_servers' as any).update({ click_count: count } as any).eq('id', server.id)) as any;
          setServers(prev => prev.map(s => s.id === server.id ? { ...s, click_count: count } : s));
        }
      } catch (err) {
        console.error('Click tracking failed:', err);
      }
    }
    window.open(server.invite_url, '_blank', 'noopener,noreferrer');
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'เมื่อสักครู่';
    if (hours < 24) return `${hours} ชม. ที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : null;
  };

  const filteredServers = servers
    .filter(server => {
      const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           server.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || server.category_id === selectedCategory;
      const matchesMine = !showMyOnly || (user && server.owner_id === user.discord_id);
      return matchesSearch && matchesCategory && matchesMine;
    })
    .sort((a, b) => {
      if (sortMode === 'popular') return (b.click_count || 0) - (a.click_count || 0);
      return new Date(b.bumped_at).getTime() - new Date(a.bumped_at).getTime();
    });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream via-peach/10 to-blush/20 dark:from-background dark:via-background dark:to-muted/20">
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
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground"
          >
            หาเพื่อนใหม่ <span className="text-primary">เข้าดิสคอร์ด</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto"
          >
            ศูนย์รวมเซิร์ฟเวอร์ดิสคอร์ดคุณภาพจากชุมชน Bear Cafe แปะฟรี! ไม่มีค่าใช้จ่าย
          </motion.p>
        </div>

        {/* Featured Servers - Peek Effect Carousel */}
        <FeaturedCarousel servers={featuredServers} onClickJoin={handleClickJoin} />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-8">
          {/* Search + Sort Row */}
          <div className="flex gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="ค้นหาเซิร์ฟเวอร์..." 
                className="pl-10 rounded-xl bg-white/50 dark:bg-card/50 border-latte/30 dark:border-coffee/30 h-9 sm:h-10 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 items-center">
              <Button variant={sortMode === 'recent' ? 'default' : 'outline'} onClick={() => setSortMode('recent')} className="rounded-full whitespace-nowrap h-9 sm:h-10 px-2.5 sm:px-3" size="sm">
                <Clock className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">ล่าสุด</span>
              </Button>
              <Button variant={sortMode === 'popular' ? 'default' : 'outline'} onClick={() => setSortMode('popular')} className="rounded-full whitespace-nowrap h-9 sm:h-10 px-2.5 sm:px-3" size="sm">
                <MousePointerClick className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">ยอดนิยม</span>
              </Button>
            </div>
          </div>

          {/* Category filter + My servers toggle */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
              <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} onClick={() => setSelectedCategory('all')} className="rounded-full whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9 px-3" size="sm">
                ทั้งหมด
              </Button>
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
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground opacity-30" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">ไม่พบเซิร์ฟเวอร์ที่ต้องการ</h3>
            <p className="text-muted-foreground text-sm mb-4 sm:mb-6">ลองเปลี่ยนคำค้นหา หรือหมวดหมู่ดูนะคะ</p>
            <Button size="sm" onClick={() => {setSearchQuery(''); setSelectedCategory('all'); setShowMyOnly(false);}}>ล้างตัวกรองทั้งหมด</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredServers.map((server, index) => (
              <motion.div key={server.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.35 }}>
                <Card className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border/40 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 bg-white/70 dark:bg-card/70 backdrop-blur-xl h-full flex flex-col">
                  {/* Banner - reduce GIF stutter with will-change and loading lazy */}
                  <div className="relative h-20 sm:h-28 overflow-hidden shrink-0">
                    {server.banner_url ? (
                      <img
                        src={server.banner_url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-card/80 via-transparent to-transparent" />
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1.5">
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
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-base sm:text-xl font-bold text-primary">
                          {server.name[0]}
                        </div>
                      )}
                    </div>
                    
                    {/* Info - description without line-clamp, uses natural height */}
                    <div className="space-y-1 sm:space-y-2 flex-1">
                      <h3 className="font-bold text-sm sm:text-lg truncate text-foreground group-hover:text-primary transition-colors">{server.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                        {server.description || 'ไม่มีคำอธิบาย'}
                      </p>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary/70" />
                        <span className="font-medium">{(server.member_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary/70" />
                        <span className="font-medium">{(server.click_count || 0).toLocaleString()}</span>
                      </div>
                      {server.bumped_at && (
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3 opacity-50" />
                          <span className="opacity-60">{getTimeSince(server.bumped_at)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/30 flex items-center gap-2">
                      <BumpButton server={server} user={user} onBump={handleBump} bumpingId={bumpingId} />
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
              </motion.div>
            ))}
          </div>
        )}

        {/* Login prompt for non-authenticated users */}
        {!isAuthenticated && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 sm:mt-12 text-center">
            <div className="inline-flex flex-col items-center gap-3 bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/40">
              <LogIn className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อแปะเซิร์ฟเวอร์ของคุณ</p>
              <Button onClick={() => navigate('/login')} className="rounded-full" size="sm">
                เข้าสู่ระบบ Discord
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Add Server Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl mx-2">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">แปะเซิร์ฟเวอร์ของคุณ</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              วางลิงก์เชิญ Discord แล้วระบบจะดึงข้อมูลให้อัตโนมัติ ทีมงานจะตรวจสอบภายใน 24-48 ชม.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-semibold text-sm">ลิงก์เชิญ (Invite Link) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="discord.gg/..." className="pl-10 rounded-xl text-sm" value={inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} />
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 italic">
                <Info className="w-3 h-3" /> แนะนำให้ใช้ลิงก์ที่ไม่มีวันหมดอายุ (Never Expire)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm">หมวดหมู่ <span className="text-destructive">*</span></Label>
              <Select onValueChange={setCategoryId} value={categoryId}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-3 sm:p-4 text-xs space-y-2 border border-primary/10">
              <p className="font-semibold text-foreground">✨ ระบบจะดึงข้อมูลให้อัตโนมัติ:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>ชื่อเซิร์ฟเวอร์ รูปไอคอน แบนเนอร์</li>
                <li>จำนวนสมาชิก คำอธิบาย</li>
              </ul>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-950/20 rounded-xl p-3 sm:p-4 border border-amber-200/50 dark:border-amber-800/30 space-y-2.5">
              <p className="font-semibold text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> เงื่อนไขการแปะเซิร์ฟเวอร์
              </p>
              <div className="space-y-2 text-[10px] sm:text-xs text-amber-700 dark:text-amber-300/80">
                <div className="flex items-start gap-2">
                  <LinkIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span><strong>ลิงก์เชิญหมดอายุ / พัง</strong> — เซิร์ฟเวอร์จะถูกซ่อนทันที</span>
                </div>
                <div className="flex items-start gap-2">
                  <Timer className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span><strong>ไม่ดันเซิร์ฟภายใน 30 วัน</strong> — เซิร์ฟเวอร์จะถูกซ่อนอัตโนมัติ</span>
                </div>
                <div className="flex items-start gap-2">
                  <Trash2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span><strong>เนื้อหาไม่เหมาะสม</strong> — ถูกลบถาวรโดยไม่แจ้งล่วงหน้า</span>
                </div>
              </div>
            </div>

            {/* Owner-only notice */}
            <div className="bg-blue-50/80 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200/50 dark:border-blue-800/30">
              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300/80 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span>สามารถแปะได้เฉพาะเซิร์ฟเวอร์ที่คุณเป็น <strong>เจ้าของ (Owner)</strong> เท่านั้น</span>
              </p>
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
