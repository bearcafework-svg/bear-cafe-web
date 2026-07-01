import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { CozySidebar, COZY_SIDEBAR_WIDTH } from '@/components/bear-cafe/CozySidebar';
import { LoadingBear } from '@/components/bear-cafe/LoadingBear';
import { useAuth } from '@/lib/auth-context';

export default function InventoryPage() {
  const { isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingBear message="กำลังโหลด..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center"
        aria-label="เปิดเมนู"
      >
        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      <div className="hidden lg:block shrink-0">
        <CozySidebar />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSidebar}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-50 h-full max-w-[85vw]"
              style={{ width: COZY_SIDEBAR_WIDTH }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('a, button')) closeSidebar();
              }}
            >
              <CozySidebar />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="min-h-screen flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl min-w-0 flex-col items-center justify-center gap-4 px-4 py-16 pt-20 text-center min-h-svh">
          <div className="text-5xl">🎒</div>
          <h1 className="text-2xl font-bold text-foreground">กระเป๋าเก็บของ</h1>
          <p className="text-muted-foreground">เร็วๆ นี้ — ระบบกระเป๋าเก็บของกำลังจะมาเร็วๆ นี้</p>
        </main>
      </section>
    </div>
  );
}
