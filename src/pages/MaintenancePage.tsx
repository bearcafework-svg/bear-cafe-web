import { motion } from 'framer-motion';
import { Wrench, Clock } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

interface MaintenancePageProps {
  message?: string;
}

export default function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-background dark:via-background dark:to-muted/20 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {/* Bear Mascot */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20
          }}
          className="relative mx-auto w-40 h-40 mb-6"
        >
          <img
            src={bearMascot}
            alt="Bear Mascot"
            className="w-full h-full object-contain drop-shadow-lg"
          />
          {/* Wrench overlay */}
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full bg-warning/20 dark:bg-warning/30 flex items-center justify-center border-2 border-warning/50"
          >
            <Wrench className="w-7 h-7 text-warning" />
          </motion.div>
        </motion.div>

        {/* Message Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card/80 backdrop-blur-sm rounded-3xl p-8 border-2 border-border shadow-xl"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">กำลังปรับปรุง</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-4">
            พักก่อนนะ! 🐻
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-6">
            {message || 'เว็บไซต์กำลังปรับปรุง กรุณากลับมาใหม่ภายหลัง'}
          </p>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
                className="w-3 h-3 rounded-full bg-primary/50"
              />
            ))}
          </div>
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          เราจะกลับมาเร็วๆ นี้! ขอบคุณที่รอนะคะ ❤️
        </motion.p>
      </motion.div>
    </div>
  );
}
