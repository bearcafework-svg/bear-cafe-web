import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface Mode {
  id: string;
  icon: string;
  name: string;
  description: string | null;
  ingredients: string[];
}

// Helper to check if icon is a URL
const isIconUrl = (icon: string) => {
  return icon.startsWith('http') || icon.startsWith('/');
};

interface ModeDetailsPanelProps {
  mode: Mode | null;
  onSelect: () => void;
  isLoading?: boolean;
}

export const ModeDetailsPanel: React.FC<ModeDetailsPanelProps> = ({
  mode,
  onSelect,
  isLoading = false,
}) => {
  if (!mode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden"
    >
      {/* Header with wave decoration */}
      <div className="relative bg-gradient-to-br from-peach/30 to-cream/50 dark:from-peach/20 dark:to-mocha/30 px-6 pt-6 pb-8">
        {/* Bear silhouette decoration */}
        <div className="absolute top-4 right-4 opacity-20">
          <svg width="60" height="48" viewBox="0 0 60 48" fill="currentColor" className="text-foreground">
            <ellipse cx="12" cy="10" rx="8" ry="8" />
            <ellipse cx="48" cy="10" rx="8" ry="8" />
            <ellipse cx="30" cy="28" rx="24" ry="20" />
          </svg>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              {isIconUrl(mode.icon) ? (
                <img src={mode.icon} alt={mode.name} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <span>{mode.icon}</span>
              )}
              {mode.name}
            </h3>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-5">
        {/* Ingredients Section */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            ส่วนผสม
          </h4>
          
          <AnimatePresence mode="wait">
            <motion.ul
              key={mode.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {mode.ingredients.map((ingredient, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="text-primary mt-0.5">•</span>
                  {ingredient}
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>

        {/* Description if available */}
        {mode.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {mode.description}
          </p>
        )}

        {/* CTA Button */}
        <Button
          onClick={onSelect}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-primary to-bear-light hover:from-primary/90 hover:to-bear-light/90 text-primary-foreground font-semibold py-6 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              กำลังโหลด...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              🐻 เลือกแบบนี้
            </span>
          )}
        </Button>
      </div>
    </motion.div>
  );
};
