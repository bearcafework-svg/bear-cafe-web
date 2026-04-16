import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface HomeCategoryCardProps {
  id: string;
  icon: string;
  name: string;
  description: string | null;
  isLocked?: boolean;
  formattedTime?: string;
  requireLogin?: boolean;
}

// Helper to check if icon is a URL
const isIconUrl = (icon: string) => {
  return icon.startsWith('http') || icon.startsWith('/');
};

export function HomeCategoryCard({ 
  id, 
  icon, 
  name, 
  description, 
  isLocked = false,
  formattedTime,
  requireLogin = false
}: HomeCategoryCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isLocked) return;
    if (requireLogin) {
      navigate('/login');
      return;
    }
    navigate(`/create-session?category=${id}`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      className={cn(
        "relative bg-white dark:bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center w-full h-full",
        "border border-latte/30 dark:border-primary/20",
        "transition-all duration-300 group",
        "flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px]",
        isLocked ? [
          "cursor-not-allowed opacity-70",
          "border-destructive/30 dark:border-destructive/40"
        ] : [
          "hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1",
          "dark:hover:border-primary/40 dark:hover:shadow-primary/30"
        ]
      )}
    >
      {/* Lock Overlay */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-background/60 dark:bg-background/70 backdrop-blur-[2px] rounded-xl sm:rounded-2xl z-10 flex flex-col items-center justify-center gap-2"
        >
          <div className="relative">
            <Lock className="w-8 h-8 text-destructive" />
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
          {formattedTime && (
            <span className="text-xs font-mono font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              {formattedTime}
            </span>
          )}
        </motion.div>
      )}

      <div className={cn(
        "w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 flex items-center justify-center",
        isLocked && "grayscale"
      )}>
        {isIconUrl(icon) ? (
          <img 
            src={icon} 
            alt={name} 
            className="w-full h-full object-contain rounded-lg sm:rounded-xl"
          />
        ) : (
          <span className={cn(
            "text-3xl sm:text-4xl transition-transform",
            !isLocked && "group-hover:scale-110"
          )}>{icon}</span>
        )}
      </div>
      <h3 className="font-display font-semibold text-foreground text-sm sm:text-lg leading-tight line-clamp-2">{name}</h3>
      {description && (
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{description}</p>
      )}
    </button>
  );
}

interface MoreCategoriesCardProps {
  remainingCount: number;
  onClick: () => void;
  isLocked?: boolean;
  formattedTime?: string;
}

export function MoreCategoriesCard({ remainingCount, onClick, isLocked = false, formattedTime }: MoreCategoriesCardProps) {
  return (
    <button
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className={cn(
        "relative bg-white dark:bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center w-full h-full",
        "border border-latte/30 dark:border-primary/20",
        "transition-all duration-300 group",
        "flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px]",
        isLocked ? [
          "cursor-not-allowed opacity-70",
          "border-destructive/30 dark:border-destructive/40"
        ] : [
          "hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1",
          "dark:hover:border-primary/40 dark:hover:shadow-primary/30"
        ]
      )}
    >
      {/* Lock Overlay */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-background/60 dark:bg-background/70 backdrop-blur-[2px] rounded-xl sm:rounded-2xl z-10 flex flex-col items-center justify-center gap-2"
        >
          <div className="relative">
            <Lock className="w-8 h-8 text-destructive" />
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
          {formattedTime && (
            <span className="text-xs font-mono font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              {formattedTime}
            </span>
          )}
        </motion.div>
      )}

      <div className={cn(
        "w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 flex items-center justify-center",
        isLocked && "grayscale"
      )}>
        <span className={cn(
          "text-3xl sm:text-4xl transition-transform",
          !isLocked && "group-hover:scale-110"
        )}>🎁</span>
      </div>
      <h3 className="font-display font-semibold text-foreground text-sm sm:text-lg">ดูเพิ่มเติม</h3>
      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
        ตอนนี้มีให้เลือกมากกว่า +{remainingCount}
      </p>
    </button>
  );
}
