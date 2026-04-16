import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  scale: number;
  rotation: number;
}

interface ParticleEffectProps {
  trigger: boolean;
  onComplete?: () => void;
}

const particleEmojis = ['✨', '🌟', '💖', '🐻', '🎀', '💫', '⭐', '🧁'];

export const ParticleEffect: React.FC<ParticleEffectProps> = ({ trigger, onComplete }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger) {
      const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        emoji: particleEmojis[Math.floor(Math.random() * particleEmojis.length)],
        scale: 0.5 + Math.random() * 0.8,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  return (
    <AnimatePresence>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ 
            opacity: 1, 
            scale: 0, 
            x: 0, 
            y: 0,
            rotate: 0 
          }}
          animate={{ 
            opacity: 0, 
            scale: particle.scale, 
            x: particle.x, 
            y: particle.y,
            rotate: particle.rotation 
          }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.8, 
            ease: 'easeOut' 
          }}
          className="absolute pointer-events-none text-2xl z-50"
          style={{ 
            left: '50%', 
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {particle.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  );
};
