import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trophy, Sparkles, Star } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

export interface MilestoneData {
  milestoneCount: number;
  roleName: string;
  roleIcon: string | null;
  roleColor: string | null;
}

interface MilestonePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MilestoneData | null;
}

export function MilestonePopup({ open, onOpenChange, data }: MilestonePopupProps) {
  if (!data) return null;

  const roleColorStyle = data.roleColor ? { color: data.roleColor } : {};
  const roleColorBorder = data.roleColor ? { borderColor: data.roleColor } : {};
  const roleColorBg = data.roleColor
    ? { backgroundColor: `${data.roleColor}15` }
    : {};

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm rounded-2xl border-2 border-primary/30 bg-card overflow-hidden p-0">
        {/* Top decorative bar */}
        <div
          className="h-2 w-full"
          style={{ background: data.roleColor ? `linear-gradient(90deg, ${data.roleColor}, hsl(var(--primary)))` : 'hsl(var(--primary))' }}
        />

        <div className="px-6 pt-4 pb-6 space-y-4">
          <AlertDialogHeader className="space-y-3">
            {/* Bear mascot + sparkle animation */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              <div className="relative">
                <img src={bearMascot} alt="" className="w-16 h-16 object-contain" />
                <motion.div
                  className="absolute -top-1 -right-1"
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="w-5 h-5 text-primary" />
                </motion.div>
              </div>
            </motion.div>

            <AlertDialogTitle className="text-center text-lg font-bold">
              🎉 ยินดีด้วย!
            </AlertDialogTitle>

            <AlertDialogDescription className="text-center text-sm text-muted-foreground">
              คุณหาเพื่อนครบ <span className="font-bold text-foreground">{data.milestoneCount} ครั้ง</span> แล้ว!
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Role badge */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 backdrop-blur-sm"
              style={{ ...roleColorBorder, ...roleColorBg }}
            >
              {/* Role icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-card shadow-sm border border-border/50">
                {data.roleIcon ? (
                  data.roleIcon.startsWith('http') ? (
                    <img src={data.roleIcon} alt="" className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="text-xl">{data.roleIcon}</span>
                  )
                ) : (
                  <Trophy className="w-5 h-5" style={roleColorStyle} />
                )}
              </div>

              {/* Role name */}
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ได้รับยศ</p>
                <p className="text-base font-bold" style={roleColorStyle}>
                  {data.roleName}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Progress hint */}
          <motion.p
            className="text-center text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Star className="w-3 h-3 inline-block mr-1 text-primary" />
            หาเพื่อนต่อไปเพื่อปลดล็อกยศถัดไป!
          </motion.p>

          {/* Close button */}
          <AlertDialogAction className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
            เข้าใจแล้ว!
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
