import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

interface DiscordServer {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  invite_url: string;
  member_count: number | null;
  category: string | null;
}

export function CommunityCarousel() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await (supabase as any)
        .from('discord_servers')
        .select('id, name, description, icon_url, invite_url, member_count, category')
        .eq('status', 'approved')
        .order('bumped_at', { ascending: false })
        .limit(12);
      if (!error && data) setServers(data);
      setLoading(false);
    };
    fetch();
  }, []);

  if (!loading && servers.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header text */}
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground leading-snug">
          🐻 เบื่อ ๆ ไม่มีที่ไป? ลองแวะมาหาคอมมูที่เข้ากับคุณดูสิ!
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          รวมเซิร์ฟเวอร์หลากหลายสไตล์มากถึง{' '}
          <span className="font-semibold text-foreground">{servers.length}</span>{' '}
          เซิร์ฟเวอร์ เลือกเข้าตามฟีลที่ชอบได้เลย 💛
        </p>
      </div>

      {/* Scrollable row */}
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-44 h-24 rounded-2xl bg-muted/40 animate-pulse shrink-0" />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
          style={{ scrollbarWidth: 'thin' }}
        >
          {servers.map((server, i) => (
            <motion.a
              key={server.id}
              href={server.invite_url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -3 }}
              className="shrink-0 w-44 flex flex-col gap-2 p-3.5 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] hover:border-[hsl(var(--primary)/0.4)] hover:shadow-md transition-all duration-200 group"
            >
              {/* Icon + name row */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-[hsl(var(--latte)/0.5)] dark:bg-[hsl(var(--coffee)/0.3)] flex items-center justify-center">
                  {server.icon_url ? (
                    <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base">🐻</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground truncate leading-tight group-hover:text-[hsl(var(--primary))] transition-colors">
                  {server.name}
                </p>
              </div>

              {/* Description */}
              {server.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {server.description}
                </p>
              )}

              {/* Member count */}
              {server.member_count !== null && (
                <div className="flex items-center gap-1 mt-auto">
                  <Users className="w-3 h-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground">
                    {server.member_count.toLocaleString()} สมาชิก
                  </span>
                </div>
              )}
            </motion.a>
          ))}

          {/* See all card */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate('/discord-servers')}
            className="shrink-0 w-36 flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border border-dashed border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors"
          >
            <span className="text-2xl">✨</span>
            <p className="text-xs font-semibold text-center leading-tight">ดูทั้งหมด</p>
          </motion.button>
        </div>
      )}
    </section>
  );
}
