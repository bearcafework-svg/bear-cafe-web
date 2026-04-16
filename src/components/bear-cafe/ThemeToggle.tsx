import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

// Sparkle particle component
const Sparkle = ({ delay, x, y }: { delay: number; x: number; y: number }) => (
  <motion.span
    className="absolute w-1.5 h-1.5 rounded-full"
    style={{ 
      background: 'linear-gradient(135deg, hsl(var(--honey)), hsl(var(--primary)))',
      boxShadow: '0 0 4px hsl(var(--honey))'
    }}
    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
    animate={{ 
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
      x: x,
      y: y,
    }}
    transition={{ 
      duration: 0.6,
      delay: delay,
      ease: "easeOut"
    }}
  />
);

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setIsAnimating(true);
    
    // Add transition class for smooth page-wide fade
    document.documentElement.classList.add('theme-transitioning');
    
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Remove transition class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
      setIsAnimating(false);
    }, 500);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative w-10 h-10 rounded-xl bg-cream/80 dark:bg-muted/80 backdrop-blur-sm border border-latte dark:border-border shadow-sm"
      >
        <div className="w-5 h-5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  // Generate sparkle positions
  const sparklePositions = [
    { x: -15, y: -15, delay: 0 },
    { x: 15, y: -12, delay: 0.05 },
    { x: -12, y: 12, delay: 0.1 },
    { x: 18, y: 8, delay: 0.15 },
    { x: 0, y: -18, delay: 0.08 },
    { x: -18, y: 0, delay: 0.12 },
    { x: 10, y: 15, delay: 0.18 },
    { x: -8, y: -20, delay: 0.06 },
  ];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`
        relative w-10 h-10 rounded-xl 
        bg-cream/80 dark:bg-muted/80 backdrop-blur-sm 
        border border-latte dark:border-border
        shadow-sm hover:shadow-md
        transition-all duration-300 ease-out
        overflow-visible
        group
      `}
      title={isDark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด'}
    >
      {/* Glow ring effect */}
      <motion.div 
        className="absolute inset-0 rounded-xl"
        initial={false}
        animate={isAnimating ? {
          boxShadow: isDark 
            ? '0 0 20px 4px hsl(var(--primary) / 0.4)' 
            : '0 0 20px 4px hsl(var(--honey) / 0.5)',
        } : {
          boxShadow: '0 0 0px 0px transparent',
        }}
        transition={{ duration: 0.4 }}
      />

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-honey/20 to-transparent dark:from-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Icon container with rotation animation */}
      <div className="relative w-5 h-5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ 
                duration: 0.4,
                ease: [0.68, -0.55, 0.265, 1.55] // Bounce effect
              }}
              className="absolute"
            >
              <Moon className="w-5 h-5 text-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={{ 
                duration: 0.4,
                ease: [0.68, -0.55, 0.265, 1.55] // Bounce effect
              }}
              className="absolute"
            >
              <Sun className="w-5 h-5 text-honey" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Sparkle burst effect */}
      <AnimatePresence>
        {isAnimating && (
          <>
            {sparklePositions.map((pos, i) => (
              <Sparkle key={i} delay={pos.delay} x={pos.x} y={pos.y} />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Center flash effect */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: isDark 
                ? 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)'
                : 'radial-gradient(circle, hsl(var(--honey) / 0.4), transparent 70%)'
            }}
          />
        )}
      </AnimatePresence>
    </Button>
  );
}
