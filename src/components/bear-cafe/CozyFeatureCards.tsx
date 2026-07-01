import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useActiveVoiceCount } from '@/hooks/useActiveVoiceCount';
import { DailyCheckInCard } from '@/components/bear-cafe/DailyCheckinCard';
import {
  FeatureBadge,
  FeatureCardFrame,
  FeatureImage,
} from '@/components/bear-cafe/FeatureCardFrame';
import { BeeIcon } from '@/icon/outline';
import { OpenMicIcon } from '@/icon/inline';

const BEAR_CAFE_INVITE = 'https://discord.gg/bearcafe';

interface FindFriendsCardProps {
  isOnCooldown?: boolean;
  formattedTime?: string;
}

function FindFriendsCard({ isOnCooldown, formattedTime }: FindFriendsCardProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const voiceCount = useActiveVoiceCount();

  const hasDiscord = Boolean(user?.discord_id);
  const isDisabled = (isAuthenticated && !hasDiscord) || isOnCooldown;

  const handleClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isOnCooldown) return;
    if (hasDiscord) {
      navigate('/create-session');
      return;
    }
    window.open(BEAR_CAFE_INVITE, '_blank', 'noopener,noreferrer');
  };

  return (
    <FeatureCardFrame
      as={motion.button}
      tape={{ color: 'blush', rotate: 2 }}
      star={{ symbol: '✦', className: 'text-[hsl(var(--blush)/0.6)]', side: 'left' }}
      onClick={handleClick}
      whileHover={!isDisabled ? { y: -1, scale: 1.01 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      className={cn(
        'w-full h-full xl:min-w-[270px] xl:max-w-[270px] flex flex-col gap-4',
        isDisabled
          ? 'border-[hsl(var(--latte)/0.4)] dark:border-[hsl(var(--coffee)/0.3)] opacity-80 cursor-default'
          : 'cursor-pointer bg-[#FDFAF7] border-2 border-[#F4EEE5] dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.5)] dark:shadow-md dark:shadow-black/20',
      )}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <FeatureImage alt="หาเพื่อนลงห้อง">
        <div
          className={cn(
            'drop-shadow-md transition-transform duration-300',
            !isDisabled && 'group-hover:scale-105',
          )}
        >
          <BeeIcon size={{ mobile: 100, desktop: 112 }} />
        </div>
      </FeatureImage>

      {/* <FeatureBadge className="bg-[hsl(var(--blush)/0.4)] border-[hsl(var(--blush)/0.5)] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--primary))]">
        Join now!
      </FeatureBadge> */}

      <h3 className="bear-h2-bold text-foreground leading-tight">หาเพื่อนลงห้อง</h3>
      <div className='flex items-center gap-2'>
        <OpenMicIcon size={16} color='#50A582' strokeWidth={1.5} />
        <p className="bear-body-regular-medium text-[hsl(var(--matcha))]">
          {voiceCount} คนออนไลน์อยู่
        </p>
      </div>

      {isOnCooldown && formattedTime && (
        <p className="text-[11px] text-destructive mt-1.5 font-mono font-bold bg-destructive/10 px-2 py-0.5 rounded-full">
          ⏳ {formattedTime}
        </p>
      )}

      <button className='bear-body-regular-medium text-[#46362A] bg-[#FAC4CD] border border-[#CC97A0] rounded-full px-8 py-1'>
        หาเพื่อนเลย!
      </button>

      {/* {isAuthenticated && !hasDiscord && (
        <div className="mt-3 w-full">
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            ต้องเข้าร่วม Discord ของ Bear Cafe ก่อนนะ 🐻
          </p>
          <div className="w-full py-2 px-3 rounded-xl bg-[hsl(var(--honey))] text-[hsl(var(--accent-foreground))] text-xs font-bold shadow-sm">
            เข้าร่วม Discord ฟรี
          </div>
        </div>
      )} */}
    </FeatureCardFrame>
  );
}

interface CozyFeatureCardsProps {
  isOnCooldown?: boolean;
  formattedTime?: string;
}

export function CozyFeatureCards({ isOnCooldown, formattedTime }: CozyFeatureCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
      <DailyCheckInCard />
      <FindFriendsCard isOnCooldown={isOnCooldown} formattedTime={formattedTime} />
    </div>
  );
}
