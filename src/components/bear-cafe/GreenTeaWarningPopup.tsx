import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatThaiDate } from '@/lib/thai-date';
import { motion } from 'framer-motion';

interface WarnRecord {
  timestamp: string;
  message: string;
  image_url: string;
  punish: string;
}

interface GreenTeaWarningPopupProps {
  userId: string | undefined;
}

export function GreenTeaWarningPopup({ userId }: GreenTeaWarningPopupProps) {
  const [open, setOpen] = useState(false);
  const [latestRecord, setLatestRecord] = useState<WarnRecord | null>(null);
  const [roleIconUrl, setRoleIconUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!userId || checked) return;

    const checkWarnRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await supabase.functions.invoke('check-user-warn-role', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const body = res.data;
        if (!body?.hasRole) return;

        if (body.roleIconUrl) {
          setRoleIconUrl(body.roleIconUrl);
        }

        if (body.records && body.records.length > 0) {
          setLatestRecord(body.records[0]);
          setOpen(true);
        }
      } catch (e) {
        console.error('Failed to check warn role:', e);
      } finally {
        setChecked(true);
      }
    };

    checkWarnRole();
  }, [userId, checked]);

  if (!open || !latestRecord) return null;

  const iconSrc = roleIconUrl || 'https://cdn.discordapp.com/role-icons/1318580353752895583/5544a95a4da74545f2575914cbcc46dc.png?size=64';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[100] max-w-[92vw] sm:max-w-[460px] border border-border bg-card p-0 text-card-foreground shadow-2xl">
        <div className="relative px-5 pb-5 pt-6">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted"
          >
            <img
              src={iconSrc}
              alt="ถ้วยชาเขียว"
              className="h-8 w-8 object-contain"
            />
          </motion.div>

          {/* Title */}
          <h2 className="text-center text-base font-bold text-foreground">คุณมียศ ถ้วยชาเขียว</h2>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            คุณเคยถูกเตือนจากการกระทำที่ไม่เหมาะสม กรุณาระมัดระวังการกระทำ
            ในครั้งถัดไป หากมีการเตือนเพิ่มเติมอีก <span className="text-destructive">อาจถูกระงับการใช้งานเว็บไซต์</span>
          </p>

          {/* Section label */}
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>รายละเอียดการเตือนล่าสุด</span>
          </motion.p>

          {/* Warn details card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-border bg-muted/50 p-3"
          >
            {/* Timestamp + Punish badge */}
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatThaiDate(latestRecord.timestamp)}</span>
              {latestRecord.punish && (
                <span className="ml-auto rounded-full border border-green-600/40 bg-green-950/30 px-2 py-0.5 text-[10px] font-medium text-green-400 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-300">
                  {latestRecord.punish}
                </span>
              )}
            </div>

            {/* Message */}
            {latestRecord.message && (
              <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                {latestRecord.message}
              </p>
            )}

            {/* Evidence image */}
            {latestRecord.image_url && (
              <div className="overflow-hidden rounded-lg border border-border bg-background/50">
                <img
                  src={latestRecord.image_url}
                  alt="หลักฐาน"
                  className="max-h-[320px] w-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
          </motion.div>

          {/* Acknowledge button */}
          <Button
            onClick={() => setOpen(false)}
            className="mt-4 h-9 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            รับทราบ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
