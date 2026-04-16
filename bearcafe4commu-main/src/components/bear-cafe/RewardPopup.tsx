import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import strawberryIcon from '@/assets/strawberry-icon.png';
import { AlertTriangle, CheckCircle2, Clock, XCircle, Ban, ShieldAlert, Lock } from 'lucide-react';

export type RewardPopupData = {
  type: 'points' | 'role' | 'both';
  pointsAdded?: number;
  roleName?: string;
  roleEmoji?: string;
  roleColor?: string;
  message?: string;
};

interface RewardPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: RewardPopupData | null;
}

// Map error messages to popup styles
const ERROR_PATTERNS: { pattern: string; icon: React.ReactNode; title: string; color: string }[] = [
  { pattern: 'หมดอายุ', icon: <Clock className="w-6 h-6" />, title: 'โค้ดหมดอายุแล้ว', color: 'amber' },
  { pattern: 'ยังไม่ถึงเวลา', icon: <Clock className="w-6 h-6" />, title: 'ยังไม่ถึงเวลาใช้งาน', color: 'blue' },
  { pattern: 'ถูกใช้ไปแล้ว', icon: <Ban className="w-6 h-6" />, title: 'โค้ดถูกใช้แล้ว', color: 'orange' },
  { pattern: 'เคยใช้โค้ดนี้', icon: <CheckCircle2 className="w-6 h-6" />, title: 'ใช้โค้ดนี้แล้ว', color: 'blue' },
  { pattern: 'ครบโควต้า', icon: <ShieldAlert className="w-6 h-6" />, title: 'โค้ดถูกใช้ครบแล้ว', color: 'orange' },
  { pattern: 'ปิดใช้งาน', icon: <Lock className="w-6 h-6" />, title: 'โค้ดถูกปิดใช้งาน', color: 'gray' },
  { pattern: 'ไม่พบโค้ด', icon: <XCircle className="w-6 h-6" />, title: 'ไม่พบโค้ดนี้', color: 'red' },
  { pattern: 'ติดต่อแอดมิน', icon: <AlertTriangle className="w-6 h-6" />, title: 'โค้ดมีปัญหา', color: 'amber' },
  { pattern: 'กรุณากรอกโค้ด', icon: <AlertTriangle className="w-6 h-6" />, title: 'ยังไม่ได้กรอกโค้ด', color: 'amber' },
  { pattern: 'ขัดข้อง', icon: <AlertTriangle className="w-6 h-6" />, title: 'เกิดข้อผิดพลาด', color: 'red' },
  { pattern: 'ยังไม่พบข้อมูล', icon: <AlertTriangle className="w-6 h-6" />, title: 'ไม่พบข้อมูลผู้ใช้', color: 'amber' },
];

const COLOR_STYLES: Record<string, { bg: string; border: string; iconBg: string; text: string; btnClass: string }> = {
  red: { bg: 'bg-red-50/80 dark:bg-red-950/30', border: 'border-red-200/60 dark:border-red-800/40', iconBg: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400', text: 'text-red-700 dark:text-red-300', btnClass: 'bg-red-500 hover:bg-red-600 text-white' },
  amber: { bg: 'bg-amber-50/80 dark:bg-amber-950/30', border: 'border-amber-200/60 dark:border-amber-800/40', iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300', btnClass: 'bg-amber-500 hover:bg-amber-600 text-white' },
  orange: { bg: 'bg-orange-50/80 dark:bg-orange-950/30', border: 'border-orange-200/60 dark:border-orange-800/40', iconBg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400', text: 'text-orange-700 dark:text-orange-300', btnClass: 'bg-orange-500 hover:bg-orange-600 text-white' },
  blue: { bg: 'bg-blue-50/80 dark:bg-blue-950/30', border: 'border-blue-200/60 dark:border-blue-800/40', iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300', btnClass: 'bg-blue-500 hover:bg-blue-600 text-white' },
  gray: { bg: 'bg-muted/50', border: 'border-border', iconBg: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', btnClass: 'bg-muted-foreground hover:bg-muted-foreground/80 text-white' },
};

function getErrorStyle(message?: string) {
  if (!message) return null;
  for (const entry of ERROR_PATTERNS) {
    if (message.includes(entry.pattern)) {
      return { ...entry, colors: COLOR_STYLES[entry.color] || COLOR_STYLES.red };
    }
  }
  return null;
}

function isErrorMessage(reward: RewardPopupData): boolean {
  return !reward.pointsAdded && !reward.roleName && !!reward.message && getErrorStyle(reward.message) !== null;
}

export function RewardPopup({ open, onOpenChange, reward }: RewardPopupProps) {
  if (!reward) return null;

  // Determine if this is an error popup
  const errorInfo = isErrorMessage(reward) ? getErrorStyle(reward.message) : null;

  if (errorInfo) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className={`max-w-sm ${errorInfo.colors.border} overflow-hidden`}>
          {/* Top accent bar */}
          <motion.div
            className={`absolute top-0 left-0 right-0 h-1 ${errorInfo.colors.btnClass}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4 }}
          />
          
          <AlertDialogHeader className="items-center text-center gap-3 pt-2">
            {/* Animated icon */}
            <motion.div
              className={`w-16 h-16 rounded-full ${errorInfo.colors.iconBg} flex items-center justify-center`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              {errorInfo.icon}
            </motion.div>

            <AlertDialogTitle className="text-lg font-display">
              {errorInfo.title}
            </AlertDialogTitle>

            <AlertDialogDescription asChild>
              <motion.div
                className={`rounded-xl ${errorInfo.colors.bg} ${errorInfo.colors.border} border px-4 py-3`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <p className={`text-sm font-medium ${errorInfo.colors.text}`}>
                  {reward.message}
                </p>
              </motion.div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex justify-center pt-1">
            <AlertDialogAction className={`rounded-full font-semibold px-8 ${errorInfo.colors.btnClass}`}>
              เข้าใจแล้ว
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Success popup
  const showPoints = reward.type === 'points' || reward.type === 'both';
  const showRole = reward.type === 'role' || reward.type === 'both';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm border-rose-200/60 dark:border-coffee/40 overflow-hidden">
        {/* Top accent bar */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 via-pink-500 to-rose-400"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* Confetti-like sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-rose-300/40 dark:bg-rose-500/20"
              style={{ left: `${15 + i * 14}%`, top: `${10 + (i % 3) * 20}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 0.8], opacity: [0, 0.8, 0] }}
              transition={{ duration: 1.5, delay: 0.2 + i * 0.1, repeat: 1 }}
            />
          ))}
        </div>

        <AlertDialogHeader className="items-center text-center gap-3 pt-2 relative z-10">
          {/* Animated icon area */}
          <motion.div
            className="flex items-center justify-center gap-4 py-2"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            {showPoints && (
              <motion.img
                src={strawberryIcon}
                alt="Strawberry"
                className="w-16 h-16 drop-shadow-lg"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {showRole && (
              <motion.div
                className="flex items-center justify-center w-16 h-16 drop-shadow-lg"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              >
                <IconDisplay icon={reward.roleEmoji} fallback="🎭" size="xl" />
              </motion.div>
            )}
          </motion.div>

          <AlertDialogTitle className="text-xl font-display bg-gradient-to-r from-rose-600 via-pink-500 to-rose-600 bg-clip-text text-transparent">
            🎉 รับรางวัลสำเร็จ!
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-3 w-full">
              {/* Points reward */}
              {showPoints && (
                <motion.div
                  className="flex items-center justify-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/70 px-4 py-3.5 dark:border-coffee/40 dark:bg-coffee/20"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <img src={strawberryIcon} alt="" className="w-8 h-8" />
                  <span className="text-base font-bold text-rose-700 dark:text-rose-200">
                    +{reward.pointsAdded?.toLocaleString() ?? 0} สตอเบอรี่
                  </span>
                </motion.div>
              )}

              {/* Role reward */}
              {showRole && (
                <motion.div
                  className="flex items-center justify-center gap-3 rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor: reward.roleColor ? `${reward.roleColor}40` : undefined,
                    backgroundColor: reward.roleColor ? `${reward.roleColor}10` : undefined,
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="flex-shrink-0">
                    <IconDisplay icon={reward.roleEmoji} fallback="🎭" size="lg" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">ได้รับยศใหม่</span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: reward.roleColor || undefined }}
                    >
                      {reward.roleName || 'ยศพิเศษ'}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex justify-center pt-1 relative z-10">
          <AlertDialogAction className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold px-8 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30">
            เยี่ยมเลย! 🍓
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
