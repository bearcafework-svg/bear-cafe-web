import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ball1 from '@/assets/gacha-ball1.png';
import ball2 from '@/assets/gacha-ball2.png';

type ClawState = 'idle' | 'moving' | 'dropping' | 'grabbing' | 'rising' | 'done';

interface ClawMachineProps {
  isPlaying: boolean;
  onDone: () => void;
}

const BALLS = [ball1, ball2];

const generateItems = () =>
  Array.from({ length: 12 }, (_, i) => ({
    src: BALLS[i % 2],
    x: 10 + Math.random() * 75,
    y: 45 + Math.random() * 40,
    size: 36 + Math.random() * 14,
    rotate: Math.random() * 30 - 15,
  }));

export default function ClawMachine({ isPlaying, onDone }: ClawMachineProps) {
  const [state, setState] = useState<ClawState>('idle');
  const [clawX, setClawX] = useState(50);
  const [items] = useState(generateItems);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Idle sway
  useEffect(() => {
    if (isPlaying || state !== 'idle') return;
    let t = 0;
    let raf: number;
    const tick = () => { t += 0.02; setClawX(50 + Math.sin(t) * 8); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, state]);

  // Animation sequence — simplified & faster
  useEffect(() => {
    if (!isPlaying) return;
    const target = 20 + Math.random() * 60;
    setState('moving');
    setClawX(target);

    const timers = [
      setTimeout(() => setState('dropping'), 500),
      setTimeout(() => setState('grabbing'), 1200),
      setTimeout(() => setState('rising'), 1600),
      setTimeout(() => {
        setState('done');
        doneRef.current();
      }, 2200),
      setTimeout(() => { setState('idle'); setClawX(50); }, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isPlaying]);

  const cableH = state === 'dropping' || state === 'grabbing' ? 140 : 18;
  const clawOpen = state === 'idle' || state === 'moving' || state === 'dropping';

  return (
    <div className="relative w-full max-w-[320px] mx-auto aspect-[3/4] select-none">
      {/* Frame */}
      <div className="absolute inset-0 rounded-2xl border-4 border-border bg-card shadow-xl overflow-hidden">
        <div className="absolute inset-2 rounded-xl bg-gradient-to-b from-[hsl(var(--peach)/0.3)] to-[hsl(var(--cream)/0.5)] border-2 border-border/50 border-dashed">
          {/* Rail */}
          <div className="absolute top-0 left-0 right-0 h-6 bg-secondary/80 border-b border-border flex items-center justify-center">
            <div className="w-[80%] h-1 bg-border rounded-full" />
          </div>

          {/* Claw */}
          <motion.div
            className="absolute top-0 z-20"
            animate={{ left: `${clawX}%`, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            <motion.div
              className="w-0.5 bg-muted-foreground/60 mx-auto"
              animate={{ height: cableH }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
            <div className="relative flex flex-col items-center -mt-1">
              <div className="w-6 h-4 bg-muted rounded-b-lg border border-border" />
              <div className="relative w-12 h-8">
                <motion.div className="absolute left-0 top-0 w-1.5 h-7 bg-muted-foreground/70 rounded-b-full origin-top" animate={{ rotate: clawOpen ? -25 : -5 }} transition={{ duration: 0.2 }} />
                <motion.div className="absolute right-0 top-0 w-1.5 h-7 bg-muted-foreground/70 rounded-b-full origin-top" animate={{ rotate: clawOpen ? 25 : 5 }} transition={{ duration: 0.2 }} />
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1.5 h-7 bg-muted-foreground/70 rounded-b-full" />
              </div>
              <AnimatePresence>
                {(state === 'rising' || state === 'done') && (
                  <motion.img
                    src={BALLS[0]}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0, y: 20 }}
                    className="absolute top-5 w-10 h-10 rounded-full object-cover"
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Ball pile */}
          {items.map((item, i) => (
            <motion.img
              key={i}
              src={item.src}
              className="absolute rounded-full object-cover shadow-sm"
              style={{ left: `${item.x}%`, top: `${item.y}%`, width: item.size, height: item.size, transform: `rotate(${item.rotate}deg)` }}
              animate={state === 'grabbing' ? { x: [0, (Math.random() - 0.5) * 6, 0], y: [0, (Math.random() - 0.5) * 4, 0] } : {}}
              transition={{ duration: 0.12, repeat: state === 'grabbing' ? 3 : 0 }}
            />
          ))}
        </div>
      </div>

      {/* Top label */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-bold shadow-md border-2 border-primary/80 flex items-center gap-1.5">
        🐻 Bear Gacha
      </div>

      {/* Bottom chute */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-secondary rounded-b-2xl border-2 border-t-0 border-border flex items-center justify-center">
        <div className="w-10 h-3 bg-muted rounded-full" />
      </div>
    </div>
  );
}
