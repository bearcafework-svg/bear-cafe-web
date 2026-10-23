import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHealingBatchJob } from '@/hooks/useHealingBatchJob';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Pause,
  Play,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function HealingBatchFloatingWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const {
    job,
    isRunning,
    isPaused,
    isCompleted,
    total,
    completed,
    failed,
    processed,
    progressPercent,
    pauseJob,
    resumeJob,
    cancelJob,
    dismissJob,
  } = useHealingBatchJob();

  // Don't render anything if no active job exists
  if (!job) return null;

  const isHealingAdminPage = location.pathname.includes('/admin/healing-messages');
  const actionText = job.action === 'approved' ? 'อนุมัติข้อความ' : 'ปฏิเสธข้อความ';
  const actionBadgeColor =
    job.action === 'approved'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] sm:w-96 transition-all duration-300">
      <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                isRunning && 'bg-amber-500/15 text-amber-600',
                isPaused && 'bg-slate-500/15 text-slate-600',
                isCompleted && 'bg-emerald-500/15 text-emerald-600'
              )}
            >
              {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPaused && <Pause className="w-4 h-4" />}
              {isCompleted && <CheckCircle2 className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {actionText}
                </span>
                <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', actionBadgeColor)}>
                  เบื้องหลัง
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {isRunning && 'กำลังทำงานในเบื้องหลัง...'}
                {isPaused && 'หยุดชั่วคราว'}
                {isCompleted && 'ดำเนินการเสร็จสมบูรณ์'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'ขยาย' : 'ย่อ'}
            >
              {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            {(isCompleted || isPaused) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                onClick={dismissJob}
                title="ปิด"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Expandable Body */}
        {!collapsed && (
          <div className="space-y-2.5 pt-1 border-t border-border/40">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-foreground">
                <span>ความคืบหน้า</span>
                <span className="font-mono text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 rounded-full" />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-0.5">
                <span>
                  {processed} จาก {total} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-medium">สำเร็จ {completed}</span>
                  {failed > 0 && <span className="text-rose-500 font-medium">ล้มเหลว {failed}</span>}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/80 leading-relaxed bg-muted/40 p-2 rounded-xl">
              💡 ทำงานต่อเนื่องในเบื้องหลัง แม้คุณจะรีเฟรชหน้าเว็บหรือเปิดหน้าอื่นอยู่ก็ตาม
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {!isHealingAdminPage ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/admin/healing-messages')}
                  className="h-7 px-2.5 text-[11px] rounded-xl gap-1 border-border/60 hover:bg-muted"
                >
                  <ExternalLink className="w-3 h-3" /> ไปที่หน้าจัดการ
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                {isRunning && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={pauseJob}
                      className="h-7 px-2 text-[10px] rounded-xl gap-1"
                    >
                      <Pause className="w-3 h-3" /> หยุดชั่วคราว
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelJob}
                      className="h-7 px-2 text-[10px] rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      ยกเลิก
                    </Button>
                  </>
                )}

                {isPaused && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={resumeJob}
                      className="h-7 px-2.5 text-[10px] rounded-xl gap-1 bg-primary text-primary-foreground"
                    >
                      <Play className="w-3 h-3" /> ทำงานต่อ
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelJob}
                      className="h-7 px-2 text-[10px] rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      ยกเลิก
                    </Button>
                  </>
                )}

                {isCompleted && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={dismissJob}
                    className="h-7 px-3 text-[10px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    รับทราบ
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
