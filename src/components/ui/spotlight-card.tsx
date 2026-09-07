import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Users, MessageSquare, ArrowRight } from 'lucide-react';

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  glowColor?: string;
  borderGlowColor?: string;
  spotlightSize?: number;
  highlightBorder?: boolean;
}

/**
 * 💡 GlowCard / SpotlightCard
 * Provides smooth cursor-following spotlight tracking across the card surface and borders.
 */
export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  (
    {
      children,
      className,
      glowColor = 'rgba(255, 255, 255, 0.08)',
      borderGlowColor = 'rgba(255, 255, 255, 0.22)',
      spotlightSize = 380,
      highlightBorder = true,
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const cardRef = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--glow-x', `${x}px`);
      card.style.setProperty('--glow-y', `${y}px`);
    }, [cardRef]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card || e.touches.length === 0) return;
      const rect = card.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      card.style.setProperty('--glow-x', `${x}px`);
      card.style.setProperty('--glow-y', `${y}px`);
      setIsHovered(true);
    }, [cardRef]);

    return (
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setIsHovered(false)}
        className={cn(
          'group relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300',
          'bg-white/70 dark:bg-card/70 backdrop-blur-xl border-border/40',
          'shadow-sm hover:shadow-xl transition-all duration-500',
          className
        )}
        {...props}
      >
        {/* Layer 1: Cursor-following radial spotlight (Background) */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 z-0"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(${spotlightSize}px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${glowColor}, transparent 65%)`,
          }}
          aria-hidden="true"
        />

        {/* Layer 2: Cursor-following border highlight */}
        {highlightBorder && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500 z-10"
            style={{
              opacity: isHovered ? 1 : 0,
              padding: '1.5px',
              background: `radial-gradient(${spotlightSize * 0.75}px circle at var(--glow-x, 50%) var(--glow-y, 50%), ${borderGlowColor}, transparent 60%)`,
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
            aria-hidden="true"
          />
        )}

        {/* Layer 3: Card Content */}
        <div className="relative z-20 h-full flex flex-col">
          {children ?? <DefaultGlowCardContent />}
        </div>
      </div>
    );
  }
);

GlowCard.displayName = 'GlowCard';

export const SpotlightCard = GlowCard;

/**
 * Default sample content if GlowCard is rendered empty
 */
function DefaultGlowCardContent() {
  return (
    <div className="p-6 flex flex-col justify-between h-full min-h-[300px] w-full max-w-sm">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            Discord Spotlight
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> 1,280
          </span>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
          <MessageSquare className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold mb-2">
          Community Server
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          เซิร์ฟเวอร์ดิสคอร์ดสำหรับพูดคุย แลกเปลี่ยน และร่วมกิจกรรมสนุกๆ
        </p>
      </div>

      <div className="pt-6 mt-4 border-t border-border/40 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">ออนไลน์อยู่ 45 คน</span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <span>เข้าดิสคอร์ด</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Default() {
  return (
    <div className="w-screen h-screen flex flex-row items-center justify-center gap-10 custom-cursor">
      <GlowCard />
      <GlowCard />
      <GlowCard />
    </div>
  );
}

export default GlowCard;
