import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import bearMascot from '@/assets/bear-mascot.png';

function AnimatedBear() {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWaving, setIsWaving] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    const waveInterval = setInterval(() => {
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 1500);
    }, 8000 + Math.random() * 4000);
    return () => clearInterval(waveInterval);
  }, []);

  return (
    <motion.div
      className="relative w-8 h-8 flex-shrink-0"
      animate={{
        y: [0, -3, 0],
        rotate: isWaving ? [0, -5, 5, -5, 0] : 0,
      }}
      transition={{
        y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 0.8, ease: "easeInOut" },
      }}
    >
      <img src={bearMascot} alt="Bear Mascot" className="w-full h-full object-contain drop-shadow-md" />
      <AnimatePresence>
        {isBlinking && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div className="absolute w-1.5 h-0.5 bg-mocha dark:bg-cream rounded-full" style={{ top: '35%', left: '32%' }} />
            <motion.div className="absolute w-1.5 h-0.5 bg-mocha dark:bg-cream rounded-full" style={{ top: '35%', right: '32%' }} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWaving && (
          <>
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }} className="absolute -top-1 -right-1 text-[10px]">✨</motion.span>
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }} transition={{ delay: 0.2 }} className="absolute top-0 right-2.5 text-[10px]">💖</motion.span>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type MessageData = { message: string; username: string };

export function MascotMessage() {
  const [current, setCurrent] = useState<MessageData>({
    message: "วันนี้คุณเก่งมากเลยนะ พักผ่อนเยอะๆ นะคะ! ✨",
    username: "Bear Café",
  });
  const [next, setNext] = useState<MessageData | null>(null);
  const [visible, setVisible] = useState(true);
  const poolRef = useRef<MessageData[]>([]);

  const fetchPool = async () => {
    try {
      const { data, error } = await supabase
        .from('healing_messages')
        .select('message, profiles ( username )')
        .eq('status', 'approved')
        .limit(20);
      if (error) throw error;
      if (data && data.length > 0) {
        poolRef.current = data.map((d) => ({
          message: d.message,
          username: (d.profiles as any)?.username || "ผู้ใช้ไม่ระบุชื่อ",
        }));
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const cycleMessage = () => {
    const pool = poolRef.current;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // fade out → swap → fade in, no layout shift
    setVisible(false);
    setNext(pick);
  };

  // When fade-out finishes, commit the new message and fade back in
  const handleAnimationComplete = (definition: string) => {
    if (definition === "hidden" && next) {
      setCurrent(next);
      setNext(null);
      setVisible(true);
    }
  };

  useEffect(() => {
    fetchPool().then(() => {
      // first cycle after data loads
      setTimeout(cycleMessage, 3000);
    });
    const interval = setInterval(cycleMessage, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-3 py-2">
      {/* Bubble */}
      <div className="bg-gradient-to-br from-honey/30 via-peach/30 to-blush/20 dark:from-honey/20 dark:via-coffee/30 dark:to-mocha/20 rounded-2xl border border-honey/40 dark:border-honey/20 shadow-sm overflow-hidden">

        {/* Header row — bear + label inside the bubble */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <AnimatedBear />
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-semibold text-foreground">น้องหมี 🐻</span>
            <span className="text-[10px] text-muted-foreground">พูดว่า...</span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-honey/30 dark:bg-honey/15" />

        {/* Message body — fixed min-height so it never collapses */}
        <div className="px-3 pt-2 pb-2.5 min-h-[3.8rem]">
          <motion.div
            animate={visible ? "visible" : "hidden"}
            variants={{
              visible: { opacity: 1, y: 0 },
              hidden:  { opacity: 0, y: 4 },
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onAnimationComplete={handleAnimationComplete}
          >
            <p className="text-[12px] font-bold text-primary leading-snug mb-0.5">
              @{current.username}
            </p>
            <p className="text-[12px] text-foreground leading-relaxed font-normal">
              {current.message}
            </p>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
