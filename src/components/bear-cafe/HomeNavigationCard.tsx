import { motion } from 'framer-motion';

export interface HomeNavigationCardProps {
  /** Display title (e.g. "หาเพื่อนลงห้อง") */
  title: string;
  /** Short description shown below the title */
  description: string;
  /** Badge label shown as an orange accent pill */
  badge: string;
  /** Emoji or icon character displayed prominently on the card */
  icon: string;
  /** Click handler — undefined for coming-soon cards */
  onClick?: () => void;
  /** When true, card is visually dimmed and not interactive */
  isComingSoon?: boolean;
  /** framer-motion animation delay in seconds */
  animationDelay?: number;
}

export function HomeNavigationCard({
  title,
  description,
  badge,
  icon,
  onClick,
  isComingSoon = false,
  animationDelay,
}: HomeNavigationCardProps) {
  const isInteractive = !!onClick && !isComingSoon;

  return (
    <motion.div
      data-testid="nav-card"
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`${title}: ${description}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay ?? 0, duration: 0.4 }}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={[
        'relative flex flex-col gap-3 rounded-2xl p-6 min-h-[180px]',
        'bg-[#F5E6C8] text-[#2C1A0E]',
        'select-none',
        isComingSoon
          ? 'opacity-50 pointer-events-none cursor-default'
          : 'cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Large icon at top */}
      <span className="text-4xl leading-none" aria-hidden="true">
        {icon}
      </span>

      {/* Title */}
      <h3 className="text-xl font-bold text-[#2C1A0E] leading-tight">{title}</h3>

      {/* Description */}
      <p className="text-sm text-[#5C3D1E] leading-snug flex-1">{description}</p>

      {/* Badge pill */}
      <span className="self-start bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
        {badge}
      </span>

      {/* Coming-soon overlay label */}
      {isComingSoon && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
          <span className="bg-[#2C1A0E]/70 text-white text-sm font-bold px-3 py-1 rounded-full">
            เร็วๆ นี้
          </span>
        </div>
      )}
    </motion.div>
  );
}
