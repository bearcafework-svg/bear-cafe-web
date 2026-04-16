import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IconDisplay } from './IconDisplay';
import { ParticleEffect } from './ParticleEffect';

interface Category {
  id: string;
  icon: string;
  name: string;
}

interface CategoryGridProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

// Pastel gradient colors for thumbnails
const gridColors = [
  { bg: 'from-pink-200 to-pink-100', glow: 'hover:shadow-pink-300/50' },
  { bg: 'from-amber-200 to-amber-100', glow: 'hover:shadow-amber-300/50' },
  { bg: 'from-emerald-200 to-emerald-100', glow: 'hover:shadow-emerald-300/50' },
  { bg: 'from-violet-200 to-violet-100', glow: 'hover:shadow-violet-300/50' },
  { bg: 'from-sky-200 to-sky-100', glow: 'hover:shadow-sky-300/50' },
  { bg: 'from-rose-200 to-rose-100', glow: 'hover:shadow-rose-300/50' },
  { bg: 'from-lime-200 to-lime-100', glow: 'hover:shadow-lime-300/50' },
  { bg: 'from-cyan-200 to-cyan-100', glow: 'hover:shadow-cyan-300/50' },
];

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  activeId,
  onSelect,
}) => {
  const [clickedId, setClickedId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    setClickedId(id);
    onSelect(id);
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 px-2">
      {categories.map((category, index) => {
        const isActive = category.id === activeId;
        const showParticles = clickedId === category.id;
        const colors = gridColors[index % gridColors.length];

        return (
          <motion.button
            key={category.id}
            onClick={() => handleClick(category.id)}
            whileHover={{ 
              scale: 1.08,
              y: -4,
            }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 relative"
          >
            {/* Category Icon Card */}
            <motion.div
              animate={isActive ? {
                boxShadow: [
                  '0 0 0 0 rgba(var(--primary), 0)',
                  '0 0 20px 5px rgba(var(--primary), 0.3)',
                  '0 0 0 0 rgba(var(--primary), 0)',
                ]
              } : {}}
              transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${colors.bg} shadow-md transition-all duration-300 flex items-center justify-center group ${colors.glow} hover:shadow-xl ${
                isActive 
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg' 
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              {/* Icon with bounce animation */}
              <motion.div
                whileHover={{ 
                  rotate: [0, -10, 10, -5, 5, 0],
                  transition: { duration: 0.5 }
                }}
              >
                <IconDisplay icon={category.icon} fallback="📁" size="lg" className="text-3xl sm:text-4xl" />
              </motion.div>
              
              {/* Highlight */}
              <div className="absolute top-2 left-3 right-3 h-2 bg-white/30 rounded-full group-hover:bg-white/50 transition-colors" />
              
              {/* Shimmer on hover */}
              <motion.div
                initial={{ opacity: 0, x: '-100%' }}
                whileHover={{ 
                  opacity: 0.4, 
                  x: '200%',
                  transition: { duration: 0.6 }
                }}
                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent rounded-2xl pointer-events-none"
              />

              {/* Particle Effect */}
              <ParticleEffect 
                trigger={showParticles} 
                onComplete={() => setClickedId(null)} 
              />
            </motion.div>

            {/* Label */}
            <motion.span 
              animate={{ 
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                scale: isActive ? 1.05 : 1
              }}
              className="text-xs font-medium transition-colors duration-200 max-w-[70px] truncate"
            >
              {category.name}
            </motion.span>

            {/* Active indicator with pulse */}
            {isActive && (
              <motion.div
                layoutId="gridActiveIndicator"
                initial={{ scale: 0 }}
                animate={{ 
                  scale: [1, 1.3, 1],
                }}
                transition={{ 
                  scale: { duration: 1, repeat: Infinity }
                }}
                className="w-1.5 h-1.5 rounded-full bg-primary -mt-1"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
