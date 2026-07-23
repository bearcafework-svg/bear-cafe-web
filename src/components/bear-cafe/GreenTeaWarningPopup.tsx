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
      <DialogContent className="z-[100] max-w-[94vw] sm:max-w-[520px] rounded-3xl border border-amber-500/20 bg-card p-0 text-card-foreground shadow-2xl overflow-hidden">
        <div className="relative px-6 pb-6 pt-7 space-y-4">
          {/* Glowing Header Icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
          >
            <img
              src={iconSrc}
              alt="ถ้วยชาเขียว"
              className="h-12 w-12 object-contain drop-shadow-md"
            />
          </motion.div>

          {/* Title & Description */}
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center justify-center gap-2">
              🍵 คุณมียศ ถ้วยชาเขียว
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">
              คุณเคยถูกเตือนจากการกระทำที่ไม่เหมาะสม กรุณาระมัดระวังการกระทำในครั้งถัดไป 
              หากมีการเตือนเพิ่มเติมอีก <span className="font-semibold text-destructive underline underline-offset-2">อาจถูกระงับการใช้งานเว็บไซต์</span>
            </p>
          </div>

          {/* Section label */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground pt-1"
          >
            <Eye className="h-4 w-4 text-emerald-500" />
            <span>รายละเอียดการเตือนล่าสุด</span>
          </motion.div>

          {/* Warn details card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border bg-muted/60 p-4 space-y-3 shadow-inner"
          >
            {/* Timestamp + Punish badge */}
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{formatThaiDate(latestRecord.timestamp, true)}</span>
              </div>
              {latestRecord.punish && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {latestRecord.punish}
                </span>
              )}
            </div>

            {/* Message */}
            {latestRecord.message && (
              <p className="text-xs sm:text-sm leading-relaxed text-foreground font-medium bg-background/80 p-3 rounded-xl border border-border/50">
                {latestRecord.message}
              </p>
            )}

            {/* Evidence image */}
            {latestRecord.image_url && (
              <div className="overflow-hidden rounded-xl border border-border bg-background/50">
                <img
                  src={latestRecord.image_url}
                  alt="หลักฐาน"
                  className="max-h-[340px] w-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
          </motion.div>

          {/* Acknowledge button */}
          <Button
            onClick={() => setOpen(false)}
            className="h-11 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-md transition-all cursor-pointer"
          >
            รับทราบการเตือน
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
