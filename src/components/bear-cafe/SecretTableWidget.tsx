import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

export function SecretTableWidget() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [onlineCount, setOnlineCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('chat_queue')
        .select('*', { count: 'exact', head: true });
      setOnlineCount(count ?? 0);
    };

    fetchCount();

    // Realtime updates
    const ch = supabase
      .channel('secret-table-online')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_queue' }, fetchCount)
      .subscribe();

    const interval = setInterval(fetchCount, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] bg-gradient-to-br from-[#fdf8f3] to-[#f5ede4] dark:from-[#221810] dark:to-[#1a1410] p-4 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-xl shrink-0">
          ☕
        </div>
        <div>
          <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm leading-tight">Secret Table</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Live dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e]">
              {onlineCount > 0 ? `${onlineCount} คนกำลังรอ` : 'ยังไม่มีคนรอ'}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate(isAuthenticated ? '/secret-chat' : '/login')}
        className="shrink-0 bg-[#c8956c] hover:bg-[#b07d58] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        นั่งโต๊ะลับ
      </button>
    </motion.div>
  );
}
