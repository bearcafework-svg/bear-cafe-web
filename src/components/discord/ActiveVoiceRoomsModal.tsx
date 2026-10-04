import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Headphones,
  Users,
  ExternalLink,
  Radio,
  Tv,
  Volume2,
} from 'lucide-react';
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
  serverBanner?: string | null;
  serverIcon?: string | null;
  guildId?: string;
  inviteUrl?: string;
  initialRooms?: ActiveVoiceRoom[];
  initialVoiceCount?: number | null;
}

export function ActiveVoiceRoomsModal({
  open,
  onOpenChange,
  serverName = '♡ ⸝⸝ 𝓑𝓮𝓪𝓻 𝓬𝓪𝓯𝓮 🐻𐙚',
  serverBanner = null,
  serverIcon = null,
  guildId = '1144251788493602848',
  inviteUrl = 'https://discord.gg/bearcafe',
  initialRooms = [],
  initialVoiceCount = 0,
}: ActiveVoiceRoomsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [rooms, setRooms] = useState<ActiveVoiceRoom[]>(initialRooms);
  const [voiceCount, setVoiceCount] = useState<number>(initialVoiceCount || 0);

  // Sync state if props change
  useEffect(() => {
    if (initialRooms) {
      setRooms(initialRooms);
    }
  }, [initialRooms]);

  useEffect(() => {
    if (typeof initialVoiceCount === 'number') {
      setVoiceCount(initialVoiceCount);
    }
  }, [initialVoiceCount]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rooms]);

  // Filtered rooms (filtered only by category since search box is removed)
  const filteredRooms = useMemo(() => {
    if (selectedCategory === 'all') return rooms;
    return rooms.filter((room) => room.category === selectedCategory);
  }, [rooms, selectedCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-3xl w-[95vw] p-0 overflow-hidden
          bg-[#FFFDF9] dark:bg-[#15110E]
          border border-[#EBDCD0] dark:border-[#2C221D]
          shadow-2xl rounded-3xl
        "
      >
        {/* Top Header / Banner Section */}
        {serverBanner ? (
          <div className="relative h-32 sm:h-44 w-full overflow-hidden bg-stone-900 shrink-0">
            <img
              src={serverBanner}
              alt={serverName}
              className="w-full h-full object-cover object-center filter brightness-90 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#FFFDF9] dark:from-[#15110E] via-[#15110E]/60 to-black/30" />

            {/* Bottom Info on Banner */}
            <div className="absolute bottom-3 left-4 right-4 sm:left-6 sm:right-6 flex items-end gap-3 z-10">
              {serverIcon && (
                <img
                  src={serverIcon}
                  alt={serverName}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white/80 dark:border-[#2C221D] shadow-lg shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold text-white drop-shadow-md flex items-center gap-2 truncate">
                  <Headphones className="w-5 h-5 text-amber-300 shrink-0" />
                  <span className="truncate">{serverName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-stone-200 drop-shadow-sm truncate">
                  กำลังคุยไมค์ <strong className="text-emerald-400 font-bold">{voiceCount}</strong> คน ใน <strong className="text-white font-semibold">{rooms.length}</strong> ห้องเสียง
                </DialogDescription>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative p-5 sm:p-6 pb-4 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-[#EBDCD0]/60 dark:border-[#2C221D]/60">
            <div className="space-y-1.5 min-w-0 mr-8">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-[#5C3D2E] dark:text-[#EAD8C8] flex items-center gap-2 tracking-tight">
                <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                {serverName}
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
          </div>
        )}

        {/* Category Filter Pills (if any) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-5 sm:px-6 py-2.5 border-b border-[#EBDCD0]/40 dark:border-[#2C221D]/40 no-scrollbar text-xs bg-muted/20">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1 rounded-full shrink-0 font-medium transition-colors cursor-pointer text-xs',
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
                    'px-3 py-1 rounded-full shrink-0 font-medium transition-colors cursor-pointer text-xs',
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

        {/* Rooms List Area (2-column rectangular cards) */}
        <ScrollArea className="max-h-[60vh] sm:max-h-[55vh] px-4 sm:px-6 py-4">
          {filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Radio className="w-10 h-10 mx-auto text-muted-foreground/40 animate-pulse" />
              <p className="text-sm font-semibold">ไม่พบห้องเสียงในหมวดหมู่นี้</p>
              <p className="text-xs">ลองเลือกดูหมวดหมู่อื่นดูนะคะ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-2">
              {filteredRooms.map((room) => {
                const discordDirectLink = `https://discord.com/channels/${guildId}/${room.id}`;
                const totalMembers = Math.max(room.count || 0, room.members.length);
                const displayMembers = room.members.slice(0, 5);
                const remainingCount = totalMembers - displayMembers.length;

                return (
                  <div
                    key={room.id}
                    className="
                      p-4 rounded-2xl
                      bg-white/80 dark:bg-[#1A1411]/80
                      border border-[#EBDCD0] dark:border-[#2E231D]
                      hover:border-[#8C6239]/40 dark:hover:border-amber-500/40
                      hover:shadow-md transition-all duration-200
                      flex flex-col justify-between gap-3 group
                    "
                  >
                    {/* Top: Room Title & Member Count */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4
                            className="font-semibold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-1.5 truncate"
                            title={room.name}
                          >
                            <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate">{room.name}</span>
                          </h4>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                          <Users className="w-3 h-3" />
                          {room.count} คน
                        </span>
                      </div>

                      {room.category && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-2 rounded-md bg-stone-100 dark:bg-stone-800/80 text-muted-foreground font-normal border-0"
                        >
                          {room.category}
                        </Badge>
                      )}
                    </div>

                    {/* Middle: Profile Avatars (Max 5 + Remaining Badge) */}
                    <div className="py-0.5">
                      {displayMembers.length === 0 ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                          <Users className="w-3.5 h-3.5 opacity-60" />
                          <span>กำลังมีคนคุยสายอยู่ {totalMembers} คน</span>
                        </div>
                      ) : (
                        <div className="flex items-center -space-x-1.5 overflow-hidden py-1">
                          {displayMembers.map((member) => (
                            <div
                              key={member.id}
                              className="group/avatar relative flex items-center"
                              title={`${member.name}${member.activity ? ` (${member.activity})` : ''}`}
                            >
                              <div className="relative">
                                <img
                                  src={member.avatar}
                                  alt={member.name}
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-background ring-1 ring-border/40 shadow-xs transition-transform group-hover/avatar:scale-110 group-hover/avatar:z-10"
                                  loading="lazy"
                                />
                                {member.streaming && (
                                  <span
                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-[7px] text-white shadow-xs z-20"
                                    title="กำลังแชร์หน้าจอ / Live"
                                  >
                                    <Tv className="w-2 h-2" />
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {remainingCount > 0 && (
                            <div
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/15 dark:bg-amber-500/20 border-2 border-background ring-1 ring-amber-500/30 flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-amber-800 dark:text-amber-300 shadow-xs shrink-0 z-0"
                              title={`มีสมาชิกอีก ${remainingCount} คน`}
                            >
                              +{remainingCount}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Join Room Button */}
                    <Button
                      size="sm"
                      asChild
                      className="
                        w-full h-8 sm:h-8.5 text-xs rounded-xl font-medium
                        bg-[#8C6239] hover:bg-[#724e2c] text-white
                        shadow-xs active:scale-[0.98] transition-all
                      "
                    >
                      <a
                        href={discordDirectLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5"
                      >
                        เข้าร่วมห้องนี้
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    </Button>
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
              เข้าสู่เซิร์ฟเวอร์หลัก 🐻
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
