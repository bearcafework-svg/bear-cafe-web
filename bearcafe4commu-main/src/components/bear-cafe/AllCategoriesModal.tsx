import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Category {
  id: string;
  icon: string;
  name: string;
  description: string | null;
}

interface AllCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  isLocked?: boolean;
  formattedTime?: string;
}

const isIconUrl = (icon: string) => {
  return icon.startsWith('http') || icon.startsWith('/');
};

export function AllCategoriesModal({ 
  open, 
  onOpenChange, 
  categories,
  isLocked = false,
  formattedTime 
}: AllCategoriesModalProps) {
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    if (isLocked) return;
    onOpenChange(false);
    navigate(`/create-session?category=${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-cream dark:bg-mocha">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            🐻 เลือกหมวดหมู่ที่ต้องการ
            {isLocked && (
              <span className="text-xs font-normal text-destructive flex items-center gap-1">
                <Lock className="w-3 h-3" />
                ล็อค {formattedTime}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleSelect(category.id)}
              disabled={isLocked}
              className={cn(
                "relative bg-white dark:bg-coffee/50 rounded-2xl p-4 text-center",
                "border border-latte/30 dark:border-coffee/30",
                "transition-all duration-300 group",
                isLocked ? [
                  "cursor-not-allowed opacity-70",
                  "border-destructive/30"
                ] : [
                  "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                ]
              )}
            >
              {/* Lock Overlay */}
              {isLocked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-background/50 dark:bg-background/60 backdrop-blur-[1px] rounded-2xl z-10 flex items-center justify-center"
                >
                  <Lock className="w-5 h-5 text-destructive" />
                </motion.div>
              )}

              <div className={cn(
                "w-12 h-12 mx-auto mb-2 flex items-center justify-center",
                isLocked && "grayscale"
              )}>
                {isIconUrl(category.icon) ? (
                  <img 
                    src={category.icon} 
                    alt={category.name} 
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <span className={cn(
                    "text-3xl transition-transform",
                    !isLocked && "group-hover:scale-110"
                  )}>
                    {category.icon}
                  </span>
                )}
              </div>
              <h3 className="font-medium text-foreground text-sm">{category.name}</h3>
              {category.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {category.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
