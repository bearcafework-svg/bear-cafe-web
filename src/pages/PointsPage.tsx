import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import { PageBackHeader } from '@/components/bear-cafe/PageBackHeader';
import { StrawberryJar } from '@/components/bear-cafe/StrawberryJar';
import { RewardPopup } from '@/components/bear-cafe/RewardPopup';
import { Input } from '@/components/ui/input';
import { useUserBalances } from '@/hooks/useUserBalances';
import { useRedeemCode } from '@/hooks/useRedeemCode';
import { StrawberryColorIcon } from '@/icon/outline';
import { cn } from '@/lib/utils';
import { Gift, Sparkles } from 'lucide-react';

export default function PointsPage() {
  const { user } = useAuth();
  const { points, maxCap, loading } = useUserBalances(user?.discord_id);
  const {
    redeemCode,
    setRedeemCode,
    isRedeeming,
    rewardPopupOpen,
    rewardPopup,
    handleRedeem,
    closeRewardPopup,
  } = useRedeemCode(user?.discord_id);

  return (
    <CozyAppShell>
      <main className="mx-auto w-full max-w-2xl min-w-0 px-4 py-6 pt-16 sm:px-6 sm:py-8 lg:pt-8 pb-12 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PageBackHeader
            title="กรอกโค้ด"
            subtitle="สะสมสตรอว์เบอร์รี่และแลกรางวัลจากกิจกรรม"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-card shadow-sm px-4 py-5 sm:px-6 sm:py-6"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <StrawberryColorIcon size={18} />
              <span className="text-xs font-bold text-muted-foreground">
                แต้มสตรอว์เบอร์รี่สะสม
              </span>
            </div>
            {loading && <Sparkles className="w-3.5 h-3.5 animate-pulse text-honey" />}
          </div>

          <StrawberryJar points={points} maxPoints={maxCap} isLoading={loading} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4 }}
          className={cn(
            'rounded-3xl shadow-md border border-[hsl(var(--latte)/0.5)]',
            'border-b-4 border-b-[hsl(var(--bear-brown)/0.35)]',
            'bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.5)] p-6 sm:p-7',
          )}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-honey/15 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-honey" />
            </div>
            <div>
              <h2 className="bear-h3-medium text-foreground">กรอกโค้ดรับรางวัล</h2>
              <p className="bear-body-small-regular text-muted-foreground">
                รับสตรอว์เบอร์รี่หรือยศพิเศษจากกิจกรรม
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder="พิมพ์โค้ดของคุณ..."
              className={cn(
                'flex-1 rounded-xl border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)]',
                'bg-background/60 focus-visible:ring-honey/30',
              )}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleRedeem}
              disabled={isRedeeming || !redeemCode.trim()}
              className={cn(
                'shrink-0 rounded-xl px-6 py-2.5 text-sm font-bold',
                'bg-honey hover:bg-honey/90 text-accent-foreground',
                'disabled:opacity-50 transition-opacity',
              )}
            >
              {isRedeeming ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  กำลังตรวจสอบ...
                </span>
              ) : (
                'ยืนยันโค้ด'
              )}
            </motion.button>
          </div>
        </motion.div>
      </main>

      <CozyPageFooter />

      <RewardPopup
        open={rewardPopupOpen}
        onOpenChange={closeRewardPopup}
        reward={rewardPopup}
      />
    </CozyAppShell>
  );
}
