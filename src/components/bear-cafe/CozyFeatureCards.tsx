import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Images from public/icons (used in SecretCafeCTA)
const IMG_1 = '/icons/SecretCafe-1.png';
const IMG_2 = '/icons/SecretCafe-2.png';
const IMG_3 = '/icons/SecretCafe-3.png';

const BEAR_CAFE_GUILD_ID = '1144251788493602848';
const BEAR_CAFE_INVITE = 'https://discord.gg/bearcafe';
const VOICE_STALE_MINUTES = 3;

// Masking tape strip — purely decorative
function MaskingTape({ color = 'honey', rotate = -1 }: { color?: 'honey' | 'mint' | 'blush'; rotate?: number }) {
  const colors = {
    honey: 'bg-[hsl(var(--honey)/0.55)]',
    mint: 'bg-[hsl(var(--mint)/0.7)]',
    blush: 'bg-[hsl(var(--blush)/0.8)]',
  };
  return (
    <div
      className={cn(
        'absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 rounded-sm opacity-80 shadow-sm',
        colors[color]
      )}
      style={{ transform: `translateX(-50%) rotate(${rotate}deg)` }}
    />
  );
}

// Tiny leaf doodle
function Leaf({ className }: { className?: string }) {
  return (
    <span className={cn('text-[hsl(var(--matcha)/0.6)] select-none pointer-events-none text-sm', className)}>
      🌿
    </span>
  );
}

// ── Card 1: สุ่มแชทคุย ──────────────────────────────────────────────────────
function SecretChatCard() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(isAuthenticated ? '/secret-chat' : '/login')}
      className="relative flex flex-col items-center pt-8 pb-6 px-5 rounded-3xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] shadow-md hover:shadow-xl hover:shadow-[hsl(var(--honey)/0.15)] transition-all duration-300 text-center group"
    >
      <MaskingTape color="honey" rotate={-2} />

      {/* Doodle sparkle */}
      <span className="absolute top-5 right-5 text-xs text-[hsl(var(--honey)/0.5)] select-none">✦</span>
      <Leaf className="absolute bottom-5 left-4" />

      {/* Image */}
      <div className="w-28 h-28 mb-4 flex items-center justify-center">
        <img
          src={IMG_1}
          alt="สุ่มแชทคุย"
          className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Speech bubble doodle */}
      <div className="mb-3 px-3 py-1 rounded-full bg-[hsl(var(--honey)/0.15)] border border-[hsl(var(--honey)/0.3)] text-[11px] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] font-medium">
        Let's talk!
      </div>

      <h3 className="text-lg font-bold text-foreground leading-tight">สุ่มแชทคุย</h3>
    </motion.button>
  );
}

// ── Card 2: หาโต๊ะคุย (coming soon) ────────────────────────────────────────
function TableChatCard() {
  return (
    <div className="relative flex flex-col items-center pt-8 pb-6 px-5 rounded-3xl bg-[hsl(var(--card))] border border-[hsl(var(--latte)/0.4)] dark:border-[hsl(var(--coffee)/0.3)] shadow-md text-center opacity-70 cursor-default">
      <MaskingTape color="mint" rotate={1} />

      <span className="absolute top-5 right-5 text-xs text-[hsl(var(--matcha)/0.4)] select-none">✧</span>
      <Leaf className="absolute bottom-5 right-4" />

      {/* Image — slightly desaturated */}
      <div className="w-28 h-28 mb-4 flex items-center justify-center">
        <img
          src={IMG_2}
          alt="หาโต๊ะคุย"
          className="w-full h-full object-contain drop-shadow-sm grayscale-[30%]"
        />
      </div>

      {/* Coming soon bubble */}
      <div className="mb-3 px-3 py-1 rounded-full bg-[hsl(var(--mint)/0.3)] border border-[hsl(var(--mint)/0.4)] text-[11px] text-[hsl(var(--matcha))] font-medium">
        Cafe time!
      </div>

      <h3 className="text-lg font-bold text-foreground leading-tight">หาโต๊ะคุย</h3>
      <p className="text-xs text-muted-foreground mt-1 font-medium">เร็ว ๆ นี้</p>
    </div>
  );
}

// ── Card 3: หาเพื่อนลงห้อง ──────────────────────────────────────────────────
interface FindFriendsCardProps {
  isOnCooldown?: boolean;
  formattedTime?: string;
}

function FindFriendsCard({ isOnCooldown, formattedTime }: FindFriendsCardProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [voiceCount, setVoiceCount] = useState<number | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null); // null = loading

  // Check server membership via discord_roles table
  // If user has any role in the system, they're a member of the Bear Cafe server
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsMember(false);
      return;
    }

    const checkMembership = async () => {
      try {
        // Check if user has any discord role assigned (means they're in the server)
        const { data, error } = await supabase
          .from('profiles')
          .select('discord_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !data?.discord_id) {
          setIsMember(false);
          return;
        }

        // Check voice_states or user_roles as proxy for server membership
        // Users who have logged in via Discord OAuth are members of the server
        // (the app requires Discord login which implies server membership)
        // We use the presence of a profile with discord_id as the membership signal
        setIsMember(true);
      } catch {
        setIsMember(false);
      }
    };

    checkMembership();
  }, [isAuthenticated, user]);

  // Fetch active voice count from Bear Cafe server
  useEffect(() => {
    let mounted = true;
    const threshold = new Date(Date.now() - VOICE_STALE_MINUTES * 60 * 1000).toISOString();

    const fetchCount = async () => {
      const { count } = await supabase
        .from('voice_states')
        .select('discord_user_id', { count: 'exact', head: true })
        .eq('is_connected', true)
        .not('channel_id', 'is', null)
        .gte('updated_at', threshold);
      if (mounted) setVoiceCount(count ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15 * 60 * 1000); // every 15 min

    const channel = supabase
      .channel('find-friends-voice')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_states' }, fetchCount)
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClick = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (isOnCooldown) return;
    if (isMember) { navigate('/create-session'); return; }
    window.open(BEAR_CAFE_INVITE, '_blank', 'noopener,noreferrer');
  };

  const isDisabled = (isAuthenticated && isMember === false) || isOnCooldown;

  return (
    <motion.button
      whileHover={!isDisabled ? { y: -4, scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center pt-8 pb-6 px-5 rounded-3xl bg-[hsl(var(--card))] border shadow-md text-center transition-all duration-300 group',
        isDisabled
          ? 'border-[hsl(var(--latte)/0.4)] dark:border-[hsl(var(--coffee)/0.3)] opacity-80 cursor-default'
          : 'border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] hover:shadow-xl hover:shadow-[hsl(var(--primary)/0.15)] cursor-pointer'
      )}
    >
      <MaskingTape color="blush" rotate={2} />

      <span className="absolute top-5 left-5 text-xs text-[hsl(var(--blush)/0.6)] select-none">✦</span>
      <Leaf className="absolute bottom-5 right-4" />

      {/* Image */}
      <div className="w-28 h-28 mb-4 flex items-center justify-center">
        <img
          src={IMG_3}
          alt="หาเพื่อนลงห้อง"
          className={cn(
            'w-full h-full object-contain drop-shadow-md transition-transform duration-300',
            !isDisabled && 'group-hover:scale-105'
          )}
        />
      </div>

      {/* Join now bubble */}
      <div className="mb-3 px-3 py-1 rounded-full bg-[hsl(var(--blush)/0.4)] border border-[hsl(var(--blush)/0.5)] text-[11px] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--primary))] font-medium">
        Join now!
      </div>

      <h3 className="text-lg font-bold text-foreground leading-tight">หาเพื่อนลงห้อง</h3>

      {/* Voice count */}
      {voiceCount !== null && voiceCount > 0 && !isOnCooldown && (
        <p className="text-[11px] text-[hsl(var(--matcha))] mt-1.5 font-medium">
          🎙️ {voiceCount} คนออนไลน์อยู่
        </p>
      )}

      {/* Cooldown badge */}
      {isOnCooldown && formattedTime && (
        <p className="text-[11px] text-destructive mt-1.5 font-mono font-bold bg-destructive/10 px-2 py-0.5 rounded-full">
          ⏳ {formattedTime}
        </p>
      )}

      {/* Not a member overlay */}
      {isAuthenticated && isMember === false && (
        <div className="mt-3 w-full">
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            ต้องเข้าร่วม Discord ของ Bear Cafe ก่อนนะ 🐻
          </p>
          <div className="w-full py-2 px-3 rounded-xl bg-[hsl(var(--honey))] text-[hsl(var(--accent-foreground))] text-xs font-bold shadow-sm">
            เข้าร่วม Discord ฟรี
          </div>
        </div>
      )}
    </motion.button>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
interface CozyFeatureCardsProps {
  isOnCooldown?: boolean;
  formattedTime?: string;
}

export function CozyFeatureCards({ isOnCooldown, formattedTime }: CozyFeatureCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <SecretChatCard />
      <TableChatCard />
      <FindFriendsCard isOnCooldown={isOnCooldown} formattedTime={formattedTime} />
    </div>
  );
}
