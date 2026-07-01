import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { CozySidebar, COZY_SIDEBAR_WIDTH } from '@/components/bear-cafe/CozySidebar';
import { LoadingBear } from '@/components/bear-cafe/LoadingBear';
import { cn } from '@/lib/utils';

interface CozyAppShellProps {
  children: React.ReactNode;
  /** Optional overlays rendered above layout (e.g. GreenTeaWarningPopup, CooldownBox). */
  overlays?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  /** Scrollable content section className override. */
  contentClassName?: string;
}

export function CozyAppShell({
  children,
  overlays,
  isLoading = false,
  loadingMessage = 'กำลังโหลด...',
  contentClassName,
}: CozyAppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingBear message={loadingMessage} />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {overlays}

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
                // Auto-close drawer after navigating via sidebar link/button
                const target = e.target as HTMLElement;
                if (target.closest('a, button')) closeSidebar();
              }}
            >
              <CozySidebar />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className={cn('flex-1 min-w-0 overflow-y-auto', contentClassName)}>
        {children}
      </section>
    </div>
  );
}
