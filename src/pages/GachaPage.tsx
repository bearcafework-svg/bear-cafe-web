import { motion } from 'framer-motion';
import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import { PageBackHeader } from '@/components/bear-cafe/PageBackHeader';
import { useAuth } from '@/lib/auth-context';

export default function GachaPage() {
  const { isLoading } = useAuth();

  return (
    <CozyAppShell isLoading={isLoading}>
      <main className="mx-auto min-h-dvh w-full max-w-2xl min-w-0 px-4 py-6 pt-16 sm:px-6 sm:py-8 lg:pt-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <PageBackHeader
            title="กาชา"
            subtitle="ระบบกาชาใหม่กำลังจะมาเร็วๆ นี้"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-[hsl(var(--sidebar-border))] bg-card px-6 py-16 text-center shadow-sm min-h-[320px]"
        >
          <div className="text-5xl">🎰</div>
          <p className="bear-h3-medium text-foreground">เร็วๆ นี้</p>
          <p className="bear-body-small-regular text-muted-foreground max-w-sm">
            ระบบกาชา Bear Cafe กำลังอยู่ระหว่างพัฒนา รอติดตามอัปเดตได้เลยนะ
          </p>
        </motion.div>
      </main>

      <CozyPageFooter />
    </CozyAppShell>
  );
}
