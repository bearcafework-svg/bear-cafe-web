import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type CheckinRewardModalData = {
  type: 'points' | 'role';
  pointsAdded?: number;
  roleName?: string;
  message?: string;
};

interface CheckinRewardModalProps {
  reward: CheckinRewardModalData | null;
  onClose: () => void;
}

export function CheckinRewardModal({ reward, onClose }: CheckinRewardModalProps) {
  const { user } = useAuth();
  const [totalPoints, setTotalPoints] = useState<number | null>(null);

  const fetchTotalPoints = useCallback(async () => {
    if (!user?.discord_id) {
      setTotalPoints(0);
      return;
    }

    const { data } = await supabase
      .from('user_points')
      .select('points')
      .eq('discord_id', user.discord_id)
      .maybeSingle();

    setTotalPoints(data?.points ?? 0);
  }, [user?.discord_id]);

  useEffect(() => {
    if (!reward) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    void fetchTotalPoints();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [reward, onClose, fetchTotalPoints]);

  if (!reward || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="ปิด"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-reward-title"
        className={cn(
          'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 p-5 sm:gap-5 md:p-7',
          'bg-[#FDFAF7] border-[#F4EEE5]',
          'dark:bg-[#121212] dark:border-[#51443A]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <p
          id="checkin-reward-title"
          className="bear-h3-bold text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
        >
          รับรางวัลสำเร็จ!
        </p>
        <div>
          {
            reward.type === 'role' ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-md sm:h-20 sm:w-20 sm:text-4xl">
                🎭
              </div>
            ) : (
              <></>
            )
          }
        </div>
        <div className="flex w-full items-center justify-between gap-3">
          <p className="bear-body-small-medium text-[#51443A] md:bear-body-regular-medium dark:text-[#E9E6E2]">
            ยอดสะสมปัจจุบัน
          </p>
          {/* show all user points if reward.type is points */}
          {reward.type === 'points' ? (
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              {totalPoints !== null ? `${totalPoints.toLocaleString()} แต้ม` : '...'}
            </p>
          ) : (
            <></>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'w-full rounded-full border px-8 py-2 bear-body-small-medium sm:w-auto md:bear-body-regular-medium',
            'bg-[#FAF2E4] border-[#EACB8F] text-[#46362A]',
            'hover:bg-[#F7E6C5] hover:border-[#D7A042]',
            'dark:bg-[#242424] dark:border-[#51443A] dark:text-[#E9E6E2]',
            'dark:hover:bg-[#333333] dark:hover:border-[#51443A]',
            'transition-all duration-200',
          )}
        >
          กลับไปหน้าคาเฟ่เลย
        </button>
      </div>
    </div>,
    document.body,
  );
}
