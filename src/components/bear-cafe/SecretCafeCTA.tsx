import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

export function SecretCafeCTA() {
  const navigate = useNavigate();
  const [activeCount, setActiveCount] = useState<number | null>(null);

  // Fetch live count of active chat sessions (each session = 2 users chatting)
  useEffect(() => {
    let mounted = true;

    const fetchCount = async () => {
      const { count } = await (supabase as any)
        .from('chat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      if (mounted) setActiveCount((count ?? 0) * 2);
    };

    fetchCount();

    // Realtime: refresh when sessions change
    const ch = supabase
      .channel('secret-cafe-cta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, fetchCount)
      .subscribe();

    const interval = setInterval(fetchCount, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full rounded-2xl border border-orange-900/60 bg-gradient-to-r from-orange-950 via-amber-950 to-orange-900 overflow-hidden shadow-lg"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 px-5 py-5 sm:px-7 sm:py-6">

        {/* ── Left: Text ── */}
        <div className="space-y-1 flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
            ☕ 𓂃 กำลังเหงาอยู่ใช่มั้ย?
          </h2>
          <ul className="space-y-1.5">
            {[
              // 1. เปลี่ยนจาก icon เป็น iconSrc และใส่ที่อยู่รูปภาพของเรา
              { iconSrc: '/icons/SecretCafe-1.png', text: 'ตั้งโปรไฟล์ของตัวเองได้ — ชื่อสมมติ + รูปอวาตาร์' },
              { iconSrc: '/icons/SecretCafe-2.png', text: 'สุ่มแชทแบบไม่เปิดเผยตัวตน ปลอดภัย 100%' },
              { iconSrc: '/icons/SecretCafe-3.png', text: 'มีเพลง BGM เปิดคลอระหว่างคุย บรรยากาศคาเฟ่จริงๆ' },
            ].map(({ iconSrc, text }) => (
              <li key={text} className="flex items-start gap-2 text-sm text-orange-100">
                
                {/* 2. เปลี่ยนแท็ก span เดิม ให้กลายเป็นแท็ก img แทน */}
                <img 
                  src={iconSrc} 
                  alt="icon" 
                  className="w-5 h-5 shrink-0 mt-0.5" 
                  style={{ imageRendering: 'pixelated' }} 
                />
                
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: Button + Live status ── */}
        <div className="flex flex-col items-start sm:items-end gap-2.5 shrink-0 w-full sm:w-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/secret-chat')}
            className="w-full sm:w-auto bg-orange-400 hover:bg-orange-300 text-orange-950 rounded-xl px-6 py-3 font-bold text-base transition-all shadow-lg shadow-orange-950/50 whitespace-nowrap"
          >
            ☕ เข้าสู่คาเฟ่ลับ
          </motion.button>

          {/* Live status */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-sm text-orange-100/80">
              {activeCount === null
                ? 'กำลังโหลด...'
                : activeCount === 0
                ? 'ยังไม่มีคนแชทอยู่ — เป็นคนแรกเลย!'
                : `คนกำลังแชทอยู่ ${activeCount} คน`
              }
            </span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
