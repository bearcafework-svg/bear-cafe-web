import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, Play, CheckCircle2, XCircle, AlertTriangle,
  Loader2, DownloadCloud, RefreshCw, ArrowRight, Users,
  SkipForward, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const OLD_ROLE_NAMES: Record<string, string> = {
  '1304347182362660904': 'S',
  '1304347185646927915': 'A',
  '1304347189488910459': 'B',
  '1304347192651157514': 'C',
  '1304347196275298355': 'D',
  '1305120410106462228': 'E',
};

const NEW_CLASS_NAMES: Record<string, string> = {
  '1520600682179199116': 'คลาส 1',
  '1520598680690884644': 'คลาส 2',
  '1520607360836435988': 'คลาส 3',
};

const CLASS_COLORS: Record<string, string> = {
  '1520600682179199116': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  '1520598680690884644': 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  '1520607360836435988': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

const POLL_INTERVAL_MS = 2500;

// ─── Types ────────────────────────────────────────────────────────────────────

// scanning = waiting for dry_run job to complete (polling)
// preview  = dry_run done, summary ready
// running  = execute job in progress (polling)
// done     = execute job finished
type Step = 'idle' | 'scanning' | 'preview' | 'running' | 'done';

interface DryRunSummary {
  total_members: number;
  to_assign: number;
  class1_count: number;
  class2_count: number;
  class3_count: number;
  anomaly_count: number;
  already_has_count: number;
  no_old_role_count: number;
  anomaly_members: AnomalyMember[];
  already_has_members: { discord_user_id: string; username: string; new_role_id: string }[];
}

interface AnomalyMember {
  discord_user_id: string;
  username: string;
  old_role_ids: string[];
  resolved_old_role_id: string | null;
  new_role_id: string | null;
}

interface JobState {
  id: string;
  status: string;
  total_members: number | null;
  processed: number;
  success_count: number;
  skip_count: number;
  error_count: number;
  started_at: string | null;
  completed_at: string | null;
}

interface ErrorMember {
  discord_user_id: string;
  username: string | null;
  old_role_ids: string[];
  resolved_old_role_id: string | null;
  new_role_id: string | null;
  error_message: string | null;
  processed_at: string;
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colorClass,
}: { label: string; value: number | string; sub?: string; colorClass?: string }) {
  return (
    <div className={cn(
      'rounded-2xl border bg-card p-4 flex flex-col gap-1 text-center shadow-sm',
      colorClass,
    )}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium">{label}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function OldRoleBadge({ roleId }: { roleId: string }) {
  return (
    <Badge variant="outline" className="font-mono text-xs">
      {OLD_ROLE_NAMES[roleId] ?? roleId}
    </Badge>
  );
}

function NewClassBadge({ roleId }: { roleId: string | null }) {
  if (!roleId) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge className={cn('text-xs font-medium', CLASS_COLORS[roleId])}>
      {NEW_CLASS_NAMES[roleId] ?? roleId}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RoleMigrationManagement() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('idle');

  // dry-run state
  const [dryRunJobId, setDryRunJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DryRunSummary | null>(null);
  const [scanProgress, setScanProgress] = useState<{ processed: number; total: number | null } | null>(null);

  // execute state
  const [execJobId, setExecJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [errorMembers, setErrorMembers] = useState<ErrorMember[]>([]);

  // confirm dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [retryMode, setRetryMode] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup poll on unmount ─────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Build DryRunSummary from DB after dry_run job completes ─────
  const buildSummaryFromJob = useCallback(async (jobId: string): Promise<DryRunSummary | null> => {
    try {
      // Count each status in parallel — avoids the 1,000-row default limit
      const [
        { count: totalCount },
        { count: willAssignCount },
        { count: anomalyCount },
        { count: alreadyHasCount },
        { count: noOldRoleCount },
        { count: class1Count },
        { count: class2Count },
        { count: class3Count },
      ] = await Promise.all([
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).in('result_status', ['will_assign', 'anomaly_multiple_old']),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('result_status', 'anomaly_multiple_old'),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('result_status', 'skipped_already_has'),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('result_status', 'skipped_no_old_role'),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('new_role_id', '1520600682179199116').in('result_status', ['will_assign', 'anomaly_multiple_old']),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('new_role_id', '1520598680690884644').in('result_status', ['will_assign', 'anomaly_multiple_old']),
        supabase.from('role_migration_log').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('new_role_id', '1520607360836435988').in('result_status', ['will_assign', 'anomaly_multiple_old']),
      ]);

      // Fetch anomaly detail rows (typically small set)
      const { data: anomalyRows } = await supabase
        .from('role_migration_log')
        .select('discord_user_id, username, old_role_ids, resolved_old_role_id, new_role_id')
        .eq('job_id', jobId)
        .eq('result_status', 'anomaly_multiple_old')
        .limit(200);

      // Fetch already-has rows for display (cap at 500)
      const { data: alreadyHasRows } = await supabase
        .from('role_migration_log')
        .select('discord_user_id, username, new_role_id')
        .eq('job_id', jobId)
        .eq('result_status', 'skipped_already_has')
        .limit(500);

      return {
        total_members: totalCount ?? 0,
        to_assign: willAssignCount ?? 0,
        class1_count: class1Count ?? 0,
        class2_count: class2Count ?? 0,
        class3_count: class3Count ?? 0,
        anomaly_count: anomalyCount ?? 0,
        already_has_count: alreadyHasCount ?? 0,
        no_old_role_count: noOldRoleCount ?? 0,
        anomaly_members: (anomalyRows ?? []).map((r) => ({
          discord_user_id: r.discord_user_id,
          username: r.username ?? 'Unknown',
          old_role_ids: (r.old_role_ids as string[]) ?? [],
          resolved_old_role_id: r.resolved_old_role_id ?? null,
          new_role_id: r.new_role_id ?? null,
        })),
        already_has_members: (alreadyHasRows ?? []).map((r) => ({
          discord_user_id: r.discord_user_id,
          username: r.username ?? 'Unknown',
          new_role_id: r.new_role_id ?? '',
        })),
      };
    } catch {
      return null;
    }
  }, []);

  // ── Generic poll helper ─────────────────────────────────────────
  // onDone is called with the final JobState when status = completed/failed
  const startPolling = useCallback((
    jobId: string,
    onDone: (job: JobState) => void,
    onTick?: (job: JobState) => void,
  ) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await supabase.functions.invoke('bulk-role-migrate', {
          body: { action: 'progress', job_id: jobId },
        });
        if (res.error) throw new Error(res.error.message);
        const { job } = res.data as { job: JobState };
        onTick?.(job);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          onDone(job);
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, []);

  // ── Dry run ─────────────────────────────────────────────────────
  const handleDryRun = async () => {
    setStep('scanning');
    setSummary(null);
    setDryRunJobId(null);
    setExecJobId(null);
    setJobState(null);
    setErrorMembers([]);

    try {
      const res = await supabase.functions.invoke('bulk-role-migrate', {
        body: { action: 'dry_run' },
      });
      if (res.error) throw new Error(res.error.message);
      const { job_id } = res.data as { job_id: string };
      setDryRunJobId(job_id);

      // Poll until dry_run background job completes, then build summary from DB
      startPolling(
        job_id,
        async (job) => {
          setScanProgress(null);
          if (job.status === 'failed') {
            toast({ title: 'ตรวจสอบล้มเหลว', description: 'Job failed', variant: 'destructive' });
            setStep('idle');
            return;
          }
          const s = await buildSummaryFromJob(job_id);
          if (!s) {
            toast({ title: 'ตรวจสอบล้มเหลว', description: 'ไม่สามารถโหลดผลลัพธ์ได้', variant: 'destructive' });
            setStep('idle');
            return;
          }
          setSummary(s);
          setStep('preview');
        },
        (job) => setScanProgress({ processed: job.processed, total: job.total_members ?? null }),
      );
    } catch (e: any) {
      toast({ title: 'ตรวจสอบล้มเหลว', description: e.message, variant: 'destructive' });
      setStep('idle');
    }
  };

  // ── Execute ──────────────────────────────────────────────────────
  const handleExecute = async (isRetry = false) => {
    setShowConfirm(false);
    setRetryMode(isRetry);
    setStep('running');
    setJobState(null);
    setErrorMembers([]);

    try {
      const body: Record<string, unknown> = { action: 'execute' };
      if (isRetry && execJobId) {
        body.retry_errors_only = true;
        body.source_job_id = execJobId;
      }

      const res = await supabase.functions.invoke('bulk-role-migrate', { body });
      if (res.error) throw new Error(res.error.message);
      const { job_id } = res.data as { job_id: string };
      setExecJobId(job_id);

      startPolling(
        job_id,
        async (job) => {
          setJobState(job);
          setStep('done');
          if (job.error_count > 0) {
            const errRes = await supabase.functions.invoke('bulk-role-migrate', {
              body: { action: 'get_error_members', job_id },
            });
            if (!errRes.error) setErrorMembers(errRes.data?.members ?? []);
          }
        },
        (job) => setJobState(job),
      );
    } catch (e: any) {
      toast({ title: 'เริ่มงานล้มเหลว', description: e.message, variant: 'destructive' });
      setStep('preview');
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────
  const handleExportCsv = async () => {
    const jobId = execJobId;
    if (!jobId) return;
    try {
      const res = await supabase.functions.invoke('bulk-role-migrate', {
        body: { action: 'export_csv', job_id: jobId },
      });
      if (res.error) throw new Error(res.error.message);
      const blob = new Blob([res.data as string], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `role_migration_${jobId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Export ล้มเหลว', description: e.message, variant: 'destructive' });
    }
  };

  // ── Progress percentage ──────────────────────────────────────────
  const progressPct = jobState && jobState.total_members
    ? Math.round((jobState.processed / jobState.total_members) * 100)
    : 0;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 pb-10">
      {/* ── Page header ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-primary" />
            ย้ายคลาสยศสมาชิก (Bulk Migration)
          </CardTitle>
          <CardDescription>
            เพิ่ม role คลาสใหม่ (1–3) ให้สมาชิกตามยศเก่า (S–E) โดยไม่ลบยศเก่าออก
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mapping table */}
          <div className="rounded-xl border overflow-hidden text-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-28">ยศเก่า</TableHead>
                  <TableHead className="w-8 text-center"></TableHead>
                  <TableHead>คลาสใหม่</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">Role ID (เก่า)</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">Role ID (ใหม่)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['S', '1304347182362660904', '1520600682179199116'],
                  ['A', '1304347185646927915', '1520600682179199116'],
                  ['B', '1304347189488910459', '1520600682179199116'],
                  ['C', '1304347192651157514', '1520598680690884644'],
                  ['D', '1304347196275298355', '1520598680690884644'],
                  ['E', '1305120410106462228', '1520607360836435988'],
                ].map(([rank, oldId, newId]) => (
                  <TableRow key={rank}>
                    <TableCell><Badge variant="outline" className="font-bold">{rank}</Badge></TableCell>
                    <TableCell className="text-center"><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /></TableCell>
                    <TableCell><NewClassBadge roleId={newId} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{oldId}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{newId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── STEP: idle ───────────────────────────────────────────── */}
      {(step === 'idle') && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">พร้อมเริ่มตรวจสอบ</p>
              <p className="text-sm text-muted-foreground mt-1">
                กดปุ่มด้านล่างเพื่อ fetch สมาชิกทั้งหมดและดูพรีวิวก่อนทำจริง
              </p>
            </div>
            <Button onClick={handleDryRun} className="gap-2 mt-2">
              <Search className="w-4 h-4" />
              ตรวจสอบ (Dry Run)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: scanning ───────────────────────────────────────── */}
      {step === 'scanning' && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="w-full max-w-sm space-y-2">
              <p className="font-semibold">กำลังตรวจสอบสมาชิกทั้งหมด…</p>
              {scanProgress ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    ประมวลผลแล้ว{' '}
                    <span className="font-semibold text-foreground">
                      {scanProgress.processed.toLocaleString()}
                    </span>
                    {scanProgress.total ? ` / ${scanProgress.total.toLocaleString()}` : ''} คน
                  </p>
                  {scanProgress.total && (
                    <Progress
                      value={Math.round((scanProgress.processed / scanProgress.total) * 100)}
                      className="h-2 rounded-full"
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  กำลัง fetch สมาชิกจาก Discord และวิเคราะห์ role อาจใช้เวลา 1–2 นาที
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: preview ────────────────────────────────────────── */}
      {step === 'preview' && summary && (
        <>
          {/* Summary stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ผลการตรวจสอบ — สมาชิกทั้งหมด {summary.total_members.toLocaleString()} คน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard label="จะย้ายทั้งหมด" value={summary.to_assign} colorClass="border-primary/30" />
                <StatCard label="คลาส 1" value={summary.class1_count}
                  sub="S, A, B" colorClass={CLASS_COLORS['1520600682179199116']} />
                <StatCard label="คลาส 2" value={summary.class2_count}
                  sub="C, D" colorClass={CLASS_COLORS['1520598680690884644']} />
                <StatCard label="คลาส 3" value={summary.class3_count}
                  sub="E" colorClass={CLASS_COLORS['1520607360836435988']} />
                <StatCard label="มี role ใหม่แล้ว (ข้าม)" value={summary.already_has_count}
                  colorClass="border-muted" />
                <StatCard label="ไม่มียศเก่าเลย (ข้าม)" value={summary.no_old_role_count}
                  colorClass="border-muted" />
                <StatCard label="ผิดปกติ (ยศเก่าหลายระดับ)" value={summary.anomaly_count}
                  colorClass="border-amber-400/40 text-amber-700 dark:text-amber-400" />
              </div>

              <Separator />

              {/* Anomaly members */}
              {summary.anomaly_count > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    สมาชิกที่มียศเก่าหลายระดับพร้อมกัน ({summary.anomaly_count} คน)
                    <span className="text-muted-foreground font-normal ml-1">— ใช้ยศสูงสุดเป็นตัวตัดสิน</span>
                  </p>
                  <ScrollArea className="h-48 rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>สมาชิก</TableHead>
                          <TableHead>ยศเก่าที่ถือ</TableHead>
                          <TableHead>ใช้ยศ</TableHead>
                          <TableHead>คลาสที่จะได้</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.anomaly_members.map((m) => (
                          <TableRow key={m.discord_user_id}>
                            <TableCell className="font-medium text-sm">{m.username}</TableCell>
                            <TableCell className="flex flex-wrap gap-1">
                              {m.old_role_ids.map(id => <OldRoleBadge key={id} roleId={id} />)}
                            </TableCell>
                            <TableCell><OldRoleBadge roleId={m.resolved_old_role_id ?? ''} /></TableCell>
                            <TableCell><NewClassBadge roleId={m.new_role_id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Already has new role */}
              {summary.already_has_count > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <SkipForward className="w-4 h-4" />
                    สมาชิกที่มี role คลาสใหม่อยู่แล้ว (จะถูกข้าม)
                  </p>
                  <ScrollArea className="h-36 rounded-xl border p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {summary.already_has_members.map((m) => (
                        <Badge key={m.discord_user_id} variant="secondary" className="text-xs gap-1">
                          {m.username}
                          <NewClassBadge roleId={m.new_role_id} />
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => { setStep('idle'); setSummary(null); }} variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  ตรวจสอบใหม่
                </Button>
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={summary.to_assign === 0}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  ยืนยันเริ่มย้ายจริง ({summary.to_assign} คน)
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── STEP: running ────────────────────────────────────────── */}
      {step === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              กำลังย้าย role…{retryMode ? ' (retry เฉพาะที่ error)' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobState ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {jobState.processed.toLocaleString()}
                      {jobState.total_members ? ` / ${jobState.total_members.toLocaleString()}` : ''} คน
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-3 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="สำเร็จ" value={jobState.success_count}
                    colorClass="border-emerald-400/40 text-emerald-700 dark:text-emerald-400" />
                  <StatCard label="ข้าม" value={jobState.skip_count} colorClass="border-muted" />
                  <StatCard label="Error" value={jobState.error_count}
                    colorClass={jobState.error_count > 0 ? 'border-red-400/40 text-red-600 dark:text-red-400' : 'border-muted'} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังเริ่มต้น…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP: done ───────────────────────────────────────────── */}
      {step === 'done' && jobState && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {jobState.status === 'completed'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : <XCircle className="w-5 h-5 text-destructive" />}
              {jobState.status === 'completed' ? 'ย้าย role เสร็จสิ้น' : 'งานล้มเหลว'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatCard label="สำเร็จ" value={jobState.success_count}
                colorClass="border-emerald-400/40 text-emerald-700 dark:text-emerald-400" />
              <StatCard label="ข้าม" value={jobState.skip_count} colorClass="border-muted" />
              <StatCard label="Error" value={jobState.error_count}
                colorClass={jobState.error_count > 0 ? 'border-red-400/40 text-red-600 dark:text-red-400' : 'border-muted'} />
            </div>

            {/* Error member list */}
            {errorMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5 text-destructive">
                  <XCircle className="w-4 h-4" />
                  รายชื่อที่ error ({errorMembers.length} คน)
                </p>
                <ScrollArea className="h-52 rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>สมาชิก</TableHead>
                        <TableHead>Discord ID</TableHead>
                        <TableHead>คลาสที่พยายามเพิ่ม</TableHead>
                        <TableHead>เหตุผล</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorMembers.map((m) => (
                        <TableRow key={m.discord_user_id}>
                          <TableCell className="font-medium text-sm">{m.username ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{m.discord_user_id}</TableCell>
                          <TableCell><NewClassBadge roleId={m.new_role_id} /></TableCell>
                          <TableCell className="text-xs text-destructive max-w-xs truncate">
                            {m.error_message ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" className="gap-2" onClick={() => { setStep('idle'); setSummary(null); }}>
                <RefreshCw className="w-4 h-4" />
                เริ่มใหม่ทั้งหมด
              </Button>
              {errorMembers.length > 0 && (
                <Button variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={() => { setShowConfirm(true); setRetryMode(true); }}>
                  <RefreshCw className="w-4 h-4" />
                  รันใหม่เฉพาะที่ error ({errorMembers.length} คน)
                </Button>
              )}
              {execJobId && (
                <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
                  <DownloadCloud className="w-4 h-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Confirm dialog ───────────────────────────────────────── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {retryMode ? 'ยืนยัน: รันใหม่เฉพาะที่ error?' : 'ยืนยัน: เริ่มย้าย role จริง?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {retryMode ? (
                <span>ระบบจะพยายามเพิ่ม role ให้สมาชิกที่ error อีกครั้ง</span>
              ) : (
                <>
                  <span>
                    ระบบจะ <strong>เพิ่ม</strong> role คลาสใหม่ให้สมาชิก{' '}
                    <strong>{summary?.to_assign ?? 0} คน</strong> โดยไม่ลบยศเก่าออก
                  </span>
                  <br />
                  <span className="text-muted-foreground text-xs">
                    การดำเนินการนี้ไม่สามารถ undo อัตโนมัติได้ แต่สามารถตรวจสอบย้อนหลังผ่าน log ได้
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExecute(retryMode)}>
              {retryMode ? 'รันใหม่' : 'ยืนยัน เริ่มย้าย'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
