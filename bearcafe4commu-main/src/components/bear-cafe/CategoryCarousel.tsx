import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconDisplay } from './IconDisplay';
import { ParticleEffect } from './ParticleEffect';

interface Category {
  id: string;
  icon: string;
  name: string;
  description: string | null;
}

interface CategoryCarouselProps {
  categories: Category[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

// Pastel gradient colors for category cards
const categoryColors = [
  'from-pink-200 to-pink-100',
  'from-amber-200 to-amber-100',
  'from-emerald-200 to-emerald-100',
  'from-violet-200 to-violet-100',
  'from-sky-200 to-sky-100',
  'from-rose-200 to-rose-100',
  'from-lime-200 to-lime-100',
  'from-cyan-200 to-cyan-100',
];

// Glow colors matching the gradients
const glowColors = [
  'shadow-pink-300/50',
  'shadow-amber-300/50',
  'shadow-emerald-300/50',
  'shadow-violet-300/50',
  'shadow-sky-300/50',
  'shadow-rose-300/50',
  'shadow-lime-300/50',
  'shadow-cyan-300/50',
];

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categories,
  activeIndex,
  onIndexChange,
}) => {
  const [showParticles, setShowParticles] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const goNext = () => {
    setShowParticles(true);
    onIndexChange((activeIndex + 1) % categories.length);
  };

  const goPrev = () => {
    setShowParticles(true);
    onIndexChange((activeIndex - 1 + categories.length) % categories.length);
  };

  const handleCardClick = () => {
    setShowParticles(true);
  };

  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        ไม่มีหมวดหมู่
      </div>
    );
  }

  const currentCategory = categories[activeIndex];
  const colorClass = categoryColors[activeIndex % categoryColors.length];
  const glowClass = glowColors[activeIndex % glowColors.length];

  return (
    <div className="relative w-full">
      {/* Main Category Display */}
      <div className="flex items-center justify-center gap-4 py-6">
        {/* Previous Button */}
        <motion.button
          onClick={goPrev}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-card border border-latte/30 dark:border-coffee/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-sm hover:shadow-lg"
          aria-label="Previous category"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        {/* Category Card */}
        <div className="relative flex-1 max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCategory.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleCardClick}
              className={`relative bg-gradient-to-br ${colorClass} rounded-3xl p-8 cursor-pointer transition-all duration-300 ${
                isHovered 
                  ? `shadow-2xl ${glowClass} scale-[1.02]` 
                  : 'shadow-xl'
              }`}
              style={{
                boxShadow: isHovered 
                  ? `0 0 40px 10px var(--tw-shadow-color), 0 25px 50px -12px rgba(0, 0, 0, 0.25)` 
                  : undefined
              }}
            >
              {/* Shimmer effect on hover */}
              <motion.div
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ 
                  opacity: isHovered ? 0.3 : 0, 
                  x: isHovered ? '200%' : '-100%' 
                }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent rounded-3xl pointer-events-none"
              />

              {/* Category Icon - Large */}
              <div className="flex flex-col items-center gap-4 relative">
                <motion.div 
                  animate={{ 
                    scale: isHovered ? 1.1 : 1,
                    rotate: isHovered ? [0, -5, 5, 0] : 0
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-32 h-32 rounded-2xl bg-white/50 backdrop-blur-sm flex items-center justify-center shadow-inner"
                >
                  <IconDisplay icon={currentCategory.icon} fallback="📁" size="xl" className="text-6xl" />
                </motion.div>
                
                {/* Category Name */}
                <h3 className="text-2xl font-display font-bold text-foreground text-center">
                  {currentCategory.name}
                </h3>
                
                {/* Category Description */}
                {currentCategory.description && (
                  <p className="text-sm text-muted-foreground text-center line-clamp-2 max-w-xs">
                    {currentCategory.description}
                  </p>
                )}

                {/* Particle Effect */}
                <ParticleEffect 
                  trigger={showParticles} 
                  onComplete={() => setShowParticles(false)} 
                />
              </div>

              {/* Decorative floating elements */}
              <motion.div 
                animate={{ 
                  y: [0, -5, 0],
                  opacity: [0.6, 0.8, 0.6]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-4 right-4 w-3 h-3 rounded-full bg-white/60" 
              />
              <motion.div 
                animate={{ 
                  y: [0, 5, 0],
                  opacity: [0.4, 0.6, 0.4]
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                className="absolute bottom-6 left-6 w-2 h-2 rounded-full bg-white/40" 
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute top-1/2 left-4 w-2 h-2 rounded-full bg-white/30" 
              />

              {/* Glow ring on hover */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: isHovered ? 0.5 : 0, 
                  scale: isHovered ? 1.05 : 0.8 
                }}
                transition={{ duration: 0.3 }}
                className={`absolute inset-0 rounded-3xl border-2 border-white/50 pointer-events-none`}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Button */}
        <motion.button
          onClick={goNext}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-card border border-latte/30 dark:border-coffee/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-sm hover:shadow-lg"
          aria-label="Next category"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Dot Indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {categories.map((cat, index) => (
          <motion.button
            key={cat.id}
            onClick={() => {
              setShowParticles(true);
              onIndexChange(index);
            }}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            className={`transition-all duration-300 rounded-full ${
              index === activeIndex
                ? 'w-8 h-2 bg-primary shadow-lg'
                : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`Go to ${cat.name}`}
          />
        ))}
      </div>
    </div>
  );
};
