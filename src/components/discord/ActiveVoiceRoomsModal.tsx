import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Headphones,
  Users,
  Search,
  ExternalLink,
  Radio,
  Tv,
  Gamepad2,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface ActiveVoiceMember {
  id: string;
  name: string;
  avatar: string;
  streaming?: boolean;
  activity?: string | null;
}

export interface ActiveVoiceRoom {
  id: string;
  name: string;
  category: string;
  count: number;
  members: ActiveVoiceMember[];
}

interface ActiveVoiceRoomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName?: string;
  inviteUrl?: string;
  initialRooms?: ActiveVoiceRoom[];
  initialVoiceCount?: number | null;
}

export function ActiveVoiceRoomsModal({
  open,
  onOpenChange,
  serverName = '♡ ⸝⸝ 𝓑𝓮𝓪𝓻 𝓬𝓪𝓯𝓮 🐻𐙚',
  inviteUrl = 'https://discord.gg/bearcafe',
  initialRooms = [],
  initialVoiceCount = 0,
}: ActiveVoiceRoomsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [rooms, setRooms] = useState<ActiveVoiceRoom[]>(initialRooms);
  const [voiceCount, setVoiceCount] = useState<number>(initialVoiceCount || 0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync state if props change
  useMemo(() => {
    if (initialRooms.length > 0) {
      setRooms(initialRooms);
    }
    if (initialVoiceCount) {
      setVoiceCount(initialVoiceCount);
    }
  }, [initialRooms, initialVoiceCount]);

  // Handle manual refresh from Supabase
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await supabase
        .from('discord_servers' as any)
        .select('live_voice_count, server_profile')
        .eq('discord_id', '1144251788493602848')
        .maybeSingle();

      if (data) {
        setVoiceCount((data as any).live_voice_count || 0);
        const profile = (data as any).server_profile || {};
        if (Array.isArray(profile.active_voice_rooms)) {
          setRooms(profile.active_voice_rooms);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh active voice rooms:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesCategory =
        selectedCategory === 'all' || room.category === selectedCategory;

      const q = search.trim().toLowerCase();
      if (!q) return matchesCategory;

      const matchesName = room.name.toLowerCase().includes(q);
      const matchesCat = room.category.toLowerCase().includes(q);
      const matchesMember = room.members.some(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.activity && m.activity.toLowerCase().includes(q))
      );

      return matchesCategory && (matchesName || matchesCat || matchesMember);
    });
  }, [rooms, selectedCategory, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-2xl w-[95vw] p-0 overflow-hidden
          bg-[#FFFDF9] dark:bg-[#15110E]
          border border-[#EBDCD0] dark:border-[#2C221D]
          shadow-2xl rounded-3xl
        "
      >
        {/* Top Header Banner */}
        <div className="relative p-5 sm:p-6 pb-4 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-[#EBDCD0]/60 dark:border-[#2C221D]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  ถ่ายทอดสดเสียงแบบ Real-time
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25 text-[10px] font-medium rounded-full"
                >
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  สิทธิ์เฉพาะ Bear Cafe
                </Badge>
              </div>

              <DialogTitle className="text-xl sm:text-2xl font-black text-[#5C3D2E] dark:text-[#EAD8C8] flex items-center gap-2 tracking-tight">
                <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                ห้องที่กำลังมีคนคุยสดใน Bear Cafe
              </DialogTitle>

              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                ขณะนี้มี{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base">
                  {voiceCount}
                </strong>{' '}
                คน กำลังคุยไมค์อยู่ใน{' '}
                <strong className="text-foreground font-semibold">
                  {rooms.length}
                </strong>{' '}
                ห้องเสียง เลือกแวะเข้าห้องที่ถูกใจได้เลย! ☕
              </DialogDescription>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shrink-0 h-9 w-9 rounded-xl border-[#EBDCD0] dark:border-[#2C221D] hover:bg-amber-500/10"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw
                className={cn('w-4 h-4 text-muted-foreground', isRefreshing && 'animate-spin text-amber-600')}
              />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อห้อง, ชื่อสมาชิก หรือเกมที่กำลังเล่น..."
              className="pl-9 h-9 sm:h-10 text-xs sm:text-sm rounded-xl bg-background/80 border-[#EBDCD0] dark:border-[#2C221D] focus-visible:ring-amber-500/30"
            />
          </div>

          {/* Category Filter Pills */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3 py-1 rounded-full shrink-0 font-medium transition-colors cursor-pointer',
                  selectedCategory === 'all'
                    ? 'bg-[#8C6239] text-white shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                ทั้งหมด ({rooms.length})
              </button>
              {categories.map((cat) => {
                const count = rooms.filter((r) => r.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-3 py-1 rounded-full shrink-0 font-medium transition-colors cursor-pointer',
                      selectedCategory === cat
                        ? 'bg-[#8C6239] text-white shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rooms List Area */}
        <ScrollArea className="max-h-[60vh] sm:max-h-[55vh] px-4 sm:px-6 py-4">
          {filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Radio className="w-10 h-10 mx-auto text-muted-foreground/40 animate-pulse" />
              <p className="text-sm font-semibold">ไม่พบห้องเสียงที่ตรงกับเงื่อนไขค้นหา</p>
              <p className="text-xs">ลองค้นหาด้วยคำอื่น หรือเลือกดูหมวดหมู่อื่นดูนะคะ</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {filteredRooms.map((room) => {
                const discordDirectLink = `https://discord.com/channels/1144251788493602848/${room.id}`;

                return (
                  <div
                    key={room.id}
                    className="
                      p-3.5 sm:p-4 rounded-2xl
                      bg-card/70 dark:bg-[#1A1411]/80
                      border border-[#EBDCD0]/70 dark:border-[#2E231D]
                      hover:border-amber-500/40 hover:shadow-md
                      transition-all duration-200
                      flex flex-col sm:flex-row sm:items-center justify-between gap-3
                    "
                  >
                    {/* Left details */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          {room.name}
                        </span>

                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-2 rounded-md bg-muted text-muted-foreground"
                        >
                          {room.category}
                        </Badge>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <Users className="w-3 h-3" />
                          {room.count} คน
                        </span>
                      </div>

                      {/* Members Avatar Row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {room.members.map((member) => (
                          <div
                            key={member.id}
                            className="group relative flex items-center"
                            title={`${member.name}${member.activity ? ` (${member.activity})` : ''}`}
                          >
                            <div className="relative">
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border-2 border-background ring-1 ring-border/40 shadow-xs"
                                loading="lazy"
                              />
                              {member.streaming && (
                                <span
                                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[7px] text-white shadow-xs"
                                  title="กำลังแชร์หน้าจอ (Live Stream)"
                                >
                                  <Tv className="w-2 h-2" />
                                </span>
                              )}
                            </div>

                            {/* Badge if playing game */}
                            {member.activity && (
                              <span className="hidden group-hover:flex absolute left-full ml-1.5 z-20 whitespace-nowrap bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg items-center gap-1">
                                <Gamepad2 className="w-2.5 h-2.5 text-amber-400" />
                                {member.activity}
                              </span>
                            )}
                          </div>
                        ))}

                        {room.count > room.members.length && (
                          <span className="text-[10px] text-muted-foreground font-semibold px-1">
                            +{room.count - room.members.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right button */}
                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        asChild
                        className="
                          h-8 sm:h-9 text-xs rounded-xl font-bold
                          bg-[#8C6239] hover:bg-[#724e2c] text-white
                          shadow-sm shadow-amber-900/10 active:scale-95 transition-all
                        "
                      >
                        <a
                          href={discordDirectLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5"
                        >
                          เข้าร่วมห้องนี้
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-muted/30 border-t border-[#EBDCD0]/60 dark:border-[#2C221D]/60 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
            💡 กดปุ่ม <strong>เข้าร่วมห้องนี้</strong> เพื่อเปิดห้องเสียงบนแอป Discord ได้ทันที
          </p>

          <Button
            size="sm"
            variant="outline"
            asChild
            className="text-xs rounded-xl border-[#8C6239]/40 text-[#8C6239] dark:text-[#EAD8C8] hover:bg-[#8C6239]/10"
          >
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
              เข้าสู่เซิร์ฟเวอร์หลัก Bear Cafe 🐻
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
