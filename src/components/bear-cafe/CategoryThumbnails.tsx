import React from 'react';
import { motion } from 'framer-motion';

interface Category {
  id: string;
  icon: string;
  name: string;
}

interface CategoryThumbnailsProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

// Pastel gradient colors for thumbnails
const thumbnailColors = [
  'from-pink-200 to-pink-100',
  'from-amber-200 to-amber-100',
  'from-emerald-200 to-emerald-100',
  'from-violet-200 to-violet-100',
  'from-sky-200 to-sky-100',
  'from-rose-200 to-rose-100',
  'from-lime-200 to-lime-100',
  'from-cyan-200 to-cyan-100',
];

export const CategoryThumbnails: React.FC<CategoryThumbnailsProps> = ({
  categories,
  activeId,
  onSelect,
}) => {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center justify-center gap-3 px-4 py-2 min-w-max">
        {categories.map((category, index) => {
          const isActive = category.id === activeId;
          const colorClass = thumbnailColors[index % thumbnailColors.length];

          return (
            <motion.button
              key={category.id}
              onClick={() => onSelect(category.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex flex-col items-center gap-1.5 transition-all duration-200 ${
                isActive ? 'scale-110' : ''
              }`}
            >
              {/* Macaroon thumbnail */}
              <div
                className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${colorClass} shadow-md transition-all duration-200 ${
                  isActive 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg' 
                    : 'opacity-80 hover:opacity-100 hover:shadow-lg'
                }`}
              >
                {/* Top shell highlight */}
                <div className="absolute top-1 left-1/4 right-1/4 h-1.5 bg-white/40 rounded-full" />
                
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg">{category.icon}</span>
                </div>

                {/* Bottom edge detail */}
                <div className="absolute bottom-2 left-1/4 right-1/4 h-0.5 bg-black/10 rounded-full" />
              </div>

              {/* Label - only show on active or hover via CSS */}
              <span className={`text-[10px] font-medium transition-opacity duration-200 max-w-[60px] truncate ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {category.name}
              </span>

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
