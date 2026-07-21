import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Users, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { CakeColorIcon } from '@/icon/outline';

interface ServerCategory {
  id: string;
  name: string;
  icon: string;
}

interface DiscordServer {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  invite_url: string;
  member_count: number | null;
  category_id: string | null;
  is_verified: boolean;
  is_partner: boolean;
}

const TAG_PALETTES = [
  'bg-[hsl(var(--honey)/0.2)] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))]',
  'bg-[hsl(var(--mint)/0.35)] text-[hsl(var(--matcha))]',
  'bg-[hsl(var(--blush)/0.5)] text-[hsl(var(--primary))]',
  'bg-[hsl(var(--lavender)/0.35)] text-[hsl(var(--berry))] dark:text-[hsl(var(--berry))]',
  'bg-[hsl(var(--peach)/0.5)] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--bear-light))]',
];

// Auto-scroll speed: pixels per frame at 60fps
const AUTO_SCROLL_PPS = 40; // 40px/s — gentle drift

export function CommunityCarousel() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [categories, setCategories] = useState<ServerCategory[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const [catRes, serverRes, countRes] = await Promise.all([
        supabase
          .from('discord_server_categories')
          .select('id, name, icon')
          .order('sort_order', { ascending: true }),
        supabase
          .from('discord_servers')
          .select('id, name, description, icon_url, invite_url, member_count, category_id, is_verified, is_partner')
          .eq('status', 'approved')
          .order('bumped_at', { ascending: false })
          .limit(24),
        supabase
          .from('discord_servers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (serverRes.data) setServers(serverRes.data);
      setTotalCount(countRes.count ?? serverRes.data?.length ?? 0);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Auto-scroll loop ──────────────────────────────────────────────────────
  const startAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const tick = (ts: number) => {
      if (pausedRef.current) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (lastTimeRef.current === null) {
        lastTimeRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = (ts - lastTimeRef.current) / 1000;
      lastTimeRef.current = ts;

      const el2 = scrollRef.current;
      if (!el2) return;

      // Seamless loop: when we reach the end, jump back to start
      if (el2.scrollLeft + el2.clientWidth >= el2.scrollWidth - 2) {
        el2.scrollLeft = 0;
      } else {
        el2.scrollLeft += AUTO_SCROLL_PPS * dt;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!loading && servers.length > 0) {
      startAutoScroll();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loading, servers.length, startAutoScroll]);

  // ── Manual scroll arrows ──────────────────────────────────────────────────
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [servers]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    pausedRef.current = true;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    setTimeout(() => { pausedRef.current = false; }, 1500);
  };

  const getCategoryName = (catId: string | null): string | null => {
    if (!catId) return null;
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : null;
  };

  return (
    <section className="space-y-3">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground leading-snug">
            <CakeColorIcon size={20} /> เบื่อ ๆ ไม่มีที่ไป? ลองแวะมาหาคอมมูที่เข้ากับคุณดูสิ!
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            รวมเซิร์ฟเวอร์หลากหลายสไตล์มากถึง{' '}
            <span className="font-semibold text-foreground">
              {loading ? '…' : totalCount}
            </span>{' '}
            เซิร์ฟเวอร์ เลือกเข้าตามฟีลที่ชอบได้เลย 💛
          </p>
        </div>

        {/* Promote button */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/discord-servers')}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200"
          style={{
            background: 'hsl(var(--honey)/0.12)',
            borderColor: 'hsl(var(--honey)/0.4)',
            color: 'hsl(var(--bear-brown))',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          โปรโมทเซิร์ฟเวอร์ของคุณ
        </motion.button>
      </div>

      {/* ── Carousel wrapper ── */}
      <div
        className="relative group/carousel"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 2000); }}
      >
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover/carousel:opacity-100"
            aria-label="เลื่อนซ้าย"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.5)] shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover/carousel:opacity-100"
            aria-label="เลื่อนขวา"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable track */}
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-52 h-[148px] rounded-2xl bg-[hsl(var(--latte)/0.4)] dark:bg-[hsl(var(--coffee)/0.25)] animate-pulse shrink-0"
              />
            ))}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {servers.map((server, i) => {
              const tagLabel = getCategoryName(server.category_id);
              const tagColor = TAG_PALETTES[i % TAG_PALETTES.length];

              return (
                <motion.a
                  key={server.id}
                  href={server.invite_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.25) }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="
                    shrink-0 w-52 flex flex-col gap-2.5 p-4 rounded-2xl
                    bg-[hsl(var(--card))]
                    border border-[hsl(var(--latte)/0.55)] dark:border-[hsl(var(--coffee)/0.4)]
                    hover:border-[hsl(var(--primary)/0.4)]
                    hover:shadow-lg hover:shadow-[hsl(var(--honey)/0.12)]
                    transition-all duration-200 group
                  "
                >
                  {/* Top row: icon + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[hsl(var(--latte)/0.5)] dark:bg-[hsl(var(--coffee)/0.3)] flex items-center justify-center shadow-sm">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-xl">🐻</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-foreground truncate leading-tight group-hover:text-[hsl(var(--primary))] transition-colors">
                          {server.name}
                        </p>
                        {server.is_verified && (
                          <span className="text-[10px] text-[hsl(var(--matcha))] shrink-0" title="Verified">✓</span>
                        )}
                      </div>
                      {server.member_count !== null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Users className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                          <span className="text-[11px] text-muted-foreground">
                            {server.member_count.toLocaleString()} สมาชิก
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {server.description ? (
                    <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                      {server.description}
                    </p>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {/* Category tag */}
                  {tagLabel && (
                    <div className="mt-auto">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tagColor}`}>
                        {tagLabel}
                      </span>
                    </div>
                  )}
                </motion.a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
