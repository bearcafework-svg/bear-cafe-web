import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MacaroonMode {
  id: string;
  icon: string;
  name: string;
  description: string | null;
  color: string;
  ingredients: string[];
}

interface MacaroonCarouselProps {
  modes: MacaroonMode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

// Pastel colors for each macaroon
const macaroonColors = [
  { bg: 'from-pink-200 to-pink-300', ring: 'ring-pink-300', shadow: 'shadow-pink-200/50' },
  { bg: 'from-amber-100 to-amber-200', ring: 'ring-amber-200', shadow: 'shadow-amber-200/50' },
  { bg: 'from-emerald-100 to-emerald-200', ring: 'ring-emerald-200', shadow: 'shadow-emerald-200/50' },
  { bg: 'from-violet-100 to-violet-200', ring: 'ring-violet-200', shadow: 'shadow-violet-200/50' },
  { bg: 'from-sky-100 to-sky-200', ring: 'ring-sky-200', shadow: 'shadow-sky-200/50' },
  { bg: 'from-rose-100 to-rose-200', ring: 'ring-rose-200', shadow: 'shadow-rose-200/50' },
];

export const MacaroonCarousel: React.FC<MacaroonCarouselProps> = ({
  modes,
  activeIndex,
  onIndexChange,
}) => {
  const goNext = () => {
    onIndexChange((activeIndex + 1) % modes.length);
  };

  const goPrev = () => {
    onIndexChange((activeIndex - 1 + modes.length) % modes.length);
  };

  const currentMode = modes[activeIndex];
  const colorScheme = macaroonColors[activeIndex % macaroonColors.length];

  return (
    <div className="relative flex flex-col items-center">
      {/* Main Macaroon Display */}
      <div className="relative w-full max-w-xs mx-auto">
        {/* Navigation Arrows */}
        <button
          onClick={goPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-card transition-colors border border-border"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={goNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-card transition-colors border border-border"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Macaroon Container */}
        <div className="flex items-center justify-center py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMode?.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative"
            >
              {/* Macaroon Shape - Top Shell */}
              <div className={`relative w-40 h-40 mx-auto`}>
                {/* Shadow/Glow */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colorScheme.bg} blur-2xl opacity-40 scale-110`} />
                
                {/* Top Shell */}
                <div className={`absolute top-0 left-0 right-0 h-[45%] rounded-t-full bg-gradient-to-br ${colorScheme.bg} shadow-lg`}>
                  {/* Texture dots */}
                  <div className="absolute inset-2 rounded-t-full opacity-30" 
                    style={{ 
                      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                      backgroundSize: '8px 8px'
                    }} 
                  />
                </div>

                {/* Filling */}
                <div className="absolute top-[43%] left-[5%] right-[5%] h-[14%] bg-card/90 shadow-inner rounded-sm" />

                {/* Bottom Shell */}
                <div className={`absolute bottom-0 left-0 right-0 h-[45%] rounded-b-full bg-gradient-to-br ${colorScheme.bg} shadow-lg`}>
                  {/* Ruffled edge effect */}
                  <div className="absolute top-0 left-[5%] right-[5%] h-2 bg-gradient-to-b from-black/5 to-transparent rounded-full" />
                </div>

                {/* Icon in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl drop-shadow-md">{currentMode?.icon}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mode Name */}
        <motion.p
          key={`name-${activeIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-lg font-display font-semibold text-foreground mt-2"
        >
          {currentMode?.name}
        </motion.p>
      </div>

      {/* Thumbnail Navigation */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {modes.map((mode, index) => {
          const thumbColor = macaroonColors[index % macaroonColors.length];
          const isActive = index === activeIndex;
          
          return (
            <button
              key={mode.id}
              onClick={() => onIndexChange(index)}
              className={`relative w-8 h-8 rounded-full transition-all duration-200 ${
                isActive 
                  ? `ring-2 ${thumbColor.ring} ring-offset-2 ring-offset-background scale-110` 
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${thumbColor.bg} flex items-center justify-center shadow-sm`}>
                <span className="text-xs">{mode.icon}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
