import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import ball1 from '@/assets/gacha-ball1.png';
import ball2 from '@/assets/gacha-ball2.png';

type GachaReward = {
  id: string;
  name: string;
  type: 'point' | 'role' | 'money' | 'item' | 'other';
  value: string | null;
  drop_rate: number;
};

interface GachaResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: GachaReward | null;
}

const typeConfig: Record<string, { label: string; emoji: string; gradient: string }> = {
  point: { label: 'แต้มสะสม', emoji: '💰', gradient: 'from-amber-400 to-yellow-500' },
  role: { label: 'ยศ Discord', emoji: '🎖️', gradient: 'from-purple-400 to-indigo-500' },
  money: { label: 'เหรียญกาชา', emoji: '🪙', gradient: 'from-emerald-400 to-teal-500' },
  item: { label: 'ไอเทม', emoji: '🎁', gradient: 'from-rose-400 to-pink-500' },
  other: { label: 'พิเศษ', emoji: '✨', gradient: 'from-sky-400 to-blue-500' },
};

const FloatingParticle = ({ delay, x, y }: { delay: number; x: number; y: number }) => (
  <motion.div
    className="absolute text-lg pointer-events-none"
    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      scale: [0, 1.2, 1, 0.5],
      x: x,
      y: y,
    }}
    transition={{ duration: 1.5, delay, ease: 'easeOut' }}
  >
    {['⭐', '✨', '🌟', '💫', '🐻'][Math.floor(Math.random() * 5)]}
  </motion.div>
);

export default function GachaResultDialog({ open, onOpenChange, reward }: GachaResultDialogProps) {
  const config = reward ? typeConfig[reward.type] || typeConfig.other : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-2 border-[hsl(var(--honey)/0.4)] text-card-foreground text-center max-w-xs sm:max-w-sm rounded-3xl overflow-hidden p-0">
        <VisuallyHidden>
          <DialogTitle>ผลรางวัลกาชา</DialogTitle>
        </VisuallyHidden>

        {/* Decorative top band */}
        <div className="h-2 w-full bg-gradient-to-r from-[hsl(var(--peach))] via-[hsl(var(--honey))] to-[hsl(var(--blush))]" />

        <div className="px-6 py-8 flex flex-col items-center relative">
          <AnimatePresence>
            {reward ? (
              <motion.div
                key="win"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center relative"
              >
                {/* Floating particles */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <FloatingParticle
                    key={i}
                    delay={0.1 + i * 0.08}
                    x={(Math.random() - 0.5) * 160}
                    y={(Math.random() - 0.5) * 120 - 30}
                  />
                ))}

                {/* Glow ring */}
                <motion.div
                  className="absolute w-32 h-32 rounded-full bg-[hsl(var(--honey)/0.2)] blur-2xl"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Prize ball */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                  className="relative z-10 mb-4"
                >
                  <motion.img
                    src={Math.random() > 0.5 ? ball1 : ball2}
                    alt="รางวัล"
                    className="w-24 h-24 rounded-full object-cover shadow-[0_0_30px_hsl(var(--honey)/0.5)]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-[hsl(var(--honey))] to-[hsl(var(--peach))] rounded-full flex items-center justify-center shadow-md"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                  >
                    <Star className="w-4 h-4 text-white fill-white" />
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-primary mb-1"
                >
                  🎉 คว้าได้แล้ว!
                </motion.h2>
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-muted-foreground mb-5"
                >
                  คุณคว้ารางวัลจากตู้คีบสำเร็จ!
                </motion.p>

                {/* Reward card */}
                <motion.div
                  initial={{ y: 20, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring', damping: 12 }}
                  className="w-full bg-gradient-to-br from-[hsl(var(--cream)/0.8)] to-[hsl(var(--peach)/0.3)] dark:from-secondary dark:to-secondary/50 px-5 py-4 rounded-2xl border border-[hsl(var(--honey)/0.3)] shadow-inner"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{config?.emoji}</span>
                    <div className="text-left flex-1">
                      <p className="text-lg font-bold text-foreground leading-tight">{reward.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Sparkles className="w-3 h-3" />
                        {config?.label}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="lose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 shadow-inner"
                >
                  <motion.span
                    className="text-4xl"
                    animate={{ rotate: [0, -10, 10, -5, 0] }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    🐻
                  </motion.span>
                </motion.div>
                <h2 className="text-xl font-bold text-muted-foreground mb-1">หลุดมือ...</h2>
                <p className="text-sm text-muted-foreground">คว้าไม่ได้ ลองใหม่นะ! 🍯</p>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={() => onOpenChange(false)}
            className="w-full mt-6 rounded-xl h-11 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {reward ? '🎉 เย้! รับรางวัล' : '🔄 ลองใหม่!'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
