import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { useHealingBatchJob } from '@/hooks/useHealingBatchJob';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Check,
  X,
  Trash2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Heart,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Play,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_LEN = 10;
const MAX_LEN = 150;

type Status = 'pending' | 'approved' | 'rejected';

interface HealingMessage {
  id: string;
  message: string;
  status: Status;
  author_id: string;
  created_at: string;
  discord_id?: string | null;
  username?: string | null;
  discord_username?: string | null;
  avatar_url?: string | null;
}

// ─── API: fetch all messages joined with profiles ─────────────────────────────
async function fetchAllMessages(): Promise<HealingMessage[]> {
  const { data, error } = await supabase
    .from('healing_messages')
    .select(`
      id,
      message,
      status,
      author_id,
      created_at,
      profiles:author_id (
        username,
        discord_username,
        avatar_url,
        discord_id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data || []) as any[];
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    status: r.status,
    author_id: r.author_id,
    created_at: r.created_at,
    username: r.profiles?.username ?? null,
    discord_username: r.profiles?.discord_username ?? null,
    discord_id: r.profiles?.discord_id ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
  }));
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  if (status === 'approved')
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20 border gap-1 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> อนุมัติ
      </Badge>
    );
  if (status === 'rejected')
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 border gap-1 rounded-full">
        <XCircle className="w-3 h-3" /> ปฏิเสธ
      </Badge>
    );
  return (
    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 border gap-1 rounded-full">
      <Clock className="w-3 h-3" /> รออนุมัติ
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HealingMessagesManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HealingMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmAction, setBulkConfirmAction] = useState<Status | null>(null);

  // Background Batch Job Hook
  const batch = useHealingBatchJob();

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<HealingMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<HealingMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAllMessages());
    } catch (e: any) {
      toast({ title: 'โหลดข้อมูลไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Synchronize completed items from background batch job to in-memory rows
  useEffect(() => {
    if (!batch.job) return;
    const completedSet = new Set(batch.job.completedIds);
    if (completedSet.size > 0) {
      setRows((prev) =>
        prev.map((r) => {
          if (completedSet.has(r.id) && r.status !== batch.job!.action) {
            return { ...r, status: batch.job!.action };
          }
          return r;
        })
      );
    }
  }, [batch.job?.completedIds.length, batch.job?.action]);

  // Auto reload when batch job finishes
  useEffect(() => {
    if (batch.isCompleted && batch.total > 0) {
      load();
    }
  }, [batch.isCompleted, batch.total, load]);

  // ── Status update ────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: Status) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase.from('healing_messages').update({ status }).eq('id', id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast({ title: status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว' });
    } catch (e: any) {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Multi-select Handlers ────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = addText.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      toast({ title: `ข้อความต้องมี ${MIN_LEN}–${MAX_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }
    setAddSaving(true);
    try {
      const { error } = await supabase
        .from('healing_messages')
        .insert({ message: trimmed, author_id: user?.id, status: 'approved' });
      if (error) throw error;
      toast({ title: 'เพิ่มข้อความสำเร็จ' });
      setAddOpen(false);
      setAddText('');
      await load();
    } catch (e: any) {
      toast({ title: 'เพิ่มไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (row: HealingMessage) => {
    setEditTarget(row);
    setEditText(row.message);
  };
  const handleEdit = async () => {
    if (!editTarget) return;
    const trimmed = editText.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      toast({ title: `ข้อความต้องมี ${MIN_LEN}–${MAX_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('healing_messages')
        .update({ message: trimmed })
        .eq('id', editTarget.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === editTarget.id ? { ...r, message: trimmed } : r)));
      toast({ title: 'แก้ไขสำเร็จ' });
      setEditTarget(null);
    } catch (e: any) {
      toast({ title: 'แก้ไขไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('healing_messages')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast({ title: 'ลบสำเร็จ' });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        return (
          r.message.toLowerCase().includes(q) ||
          (r.username ?? '').toLowerCase().includes(q) ||
          (r.discord_username ?? '').toLowerCase().includes(q) ||
          (r.discord_id ?? '').includes(q)
        );
      }
      return true;
    });
  }, [rows, filterStatus, search]);

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  };

  // Check if all filtered rows are selected
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  // Confirm and start bulk background job
  const handleExecuteBulk = () => {
    if (!bulkConfirmAction || selectedIds.size === 0) return;
    const targetAction = bulkConfirmAction === 'approved' ? 'approved' : 'rejected';
    const targetIds = Array.from(selectedIds);

    batch.startJob(targetAction, targetIds);
    clearSelection();
    setBulkConfirmAction(null);

    toast({
      title: targetAction === 'approved' ? 'เริ่มอนุมัติในเบื้องหลังแล้ว' : 'เริ่มปฏิเสธในเบื้องหลังแล้ว',
      description: `กำลังประมวลผล ${targetIds.length} รายการ สามารถสลับหน้าหรือรีเฟรชได้ตามปกติ`,
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Active Background Batch Job Banner ── */}
      {batch.job && (
        <Card className="rounded-2xl border-pink-500/30 bg-gradient-to-r from-pink-500/5 via-primary/5 to-amber-500/5 dark:bg-card shadow-sm overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  batch.isRunning && 'bg-amber-500/15 text-amber-600',
                  batch.isPaused && 'bg-slate-500/15 text-slate-600',
                  batch.isCompleted && 'bg-emerald-500/15 text-emerald-600'
                )}
              >
                {batch.isRunning && <Loader2 className="w-5 h-5 animate-spin" />}
                {batch.isPaused && <Pause className="w-5 h-5" />}
                {batch.isCompleted && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {batch.job.action === 'approved'
                      ? 'ระบบกำลังอนุมัติข้อความในเบื้องหลัง'
                      : 'ระบบกำลังปฏิเสธข้อความในเบื้องหลัง'}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                      batch.isRunning && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                      batch.isPaused && 'bg-slate-500/10 text-slate-600 border-slate-500/30',
                      batch.isCompleted && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    )}
                  >
                    {batch.isRunning && 'กำลังทำงาน'}
                    {batch.isPaused && 'หยุดชั่วคราว'}
                    {batch.isCompleted && 'เสร็จสิ้น'}
                    {batch.job.status === 'cancelled' && 'ยกเลิกแล้ว'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  ดำเนินการแล้ว {batch.processed} จาก {batch.total} รายการ ({batch.progressPercent}%) •{' '}
                  <span className="text-emerald-600 font-medium">สำเร็จ {batch.completed}</span>
                  {batch.failed > 0 && (
                    <span className="text-rose-500 font-medium"> • ล้มเหลว {batch.failed}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {batch.isRunning && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={batch.pauseJob}
                    className="h-8 text-xs rounded-xl gap-1"
                  >
                    <Pause className="w-3.5 h-3.5" /> หยุดชั่วคราว
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={batch.cancelJob}
                    className="h-8 text-xs rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  >
                    ยกเลิกงาน
                  </Button>
                </>
              )}

              {batch.isPaused && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={batch.resumeJob}
                    className="h-8 text-xs rounded-xl gap-1 bg-pink-600 hover:bg-pink-700 text-white"
                  >
                    <Play className="w-3.5 h-3.5" /> ทำงานต่อ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={batch.cancelJob}
                    className="h-8 text-xs rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  >
                    ยกเลิกงาน
                  </Button>
                </>
              )}

              {batch.isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={batch.dismissJob}
                  className="h-8 text-xs rounded-xl"
                >
                  ปิดการแจ้งเตือน
                </Button>
              )}
            </div>
          </div>

          <Progress value={batch.progressPercent} className="h-2 rounded-full" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>💡 ทำงานต่อเนื่องในเบื้องหลัง ปลอดภัยแม้รีเฟรชเว็บหรือสลับไปหน้าอื่น</span>
            <span className="font-mono font-bold text-primary">{batch.progressPercent}%</span>
          </div>
        </Card>
      )}

      {/* Header card info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500/20" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#8C6239] dark:text-[#EAD8C8]">
              ข้อความให้กำลังใจ (Healing Messages)
            </h2>
            <p className="text-[10px] text-muted-foreground">
              จัดการ ตรวจสอบ และอนุมัติ/ปฏิเสธแบบชุดพร้อมทำงานในเบื้องหลัง
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-1.5 rounded-xl text-xs h-9"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-1.5 rounded-xl text-xs h-9 bg-pink-600 hover:bg-pink-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มข้อความ
          </Button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Stats tabs */}
        <div className="md:col-span-8 flex gap-1.5 flex-wrap">
          {(
            [
              { key: 'all', label: 'ทั้งหมด', count: counts.all, cls: 'bg-muted/60 hover:bg-muted text-muted-foreground' },
              { key: 'pending', label: 'รออนุมัติ', count: counts.pending, cls: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' },
              { key: 'approved', label: 'อนุมัติ', count: counts.approved, cls: 'bg-green-500/10 hover:bg-green-500/20 text-green-600' },
              { key: 'rejected', label: 'ปฏิเสธ', count: counts.rejected, cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-500' },
            ] as const
          ).map(({ key, label, count, cls }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key as Status | 'all')}
              className={cn(
                'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1.5 shadow-sm',
                cls,
                filterStatus === key ? 'ring-2 ring-primary border-primary/40' : 'border-border/40'
              )}
            >
              {key === 'pending' && <Clock className="w-3.5 h-3.5" />}
              {key === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {key === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
              <span>{label}</span>
              <span className="ml-0.5 bg-background/60 dark:bg-black/25 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs rounded-xl border-latte/40 focus-visible:ring-pink-500"
            placeholder="ค้นหาข้อความ, ชื่อ, Discord ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Multi-select Bulk Actions Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 p-3 rounded-2xl bg-card border border-border/60 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleSelectAllFiltered}
            disabled={filtered.length === 0}
            className="h-8 text-xs rounded-xl gap-1.5 border-border/60"
          >
            {allFilteredSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-pink-600" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span>
              {allFilteredSelected
                ? 'ยกเลิกเลือกทั้งหมดในมุมมองนี้'
                : `เลือกทั้งหมดในมุมมองนี้ (${filtered.length})`}
            </span>
          </Button>

          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-xs px-2.5 py-1 rounded-xl">
              เลือกแล้ว {selectedIds.size} รายการ
            </Badge>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="h-8 text-xs rounded-xl text-muted-foreground hover:text-foreground"
            >
              ยกเลิก
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkConfirmAction('approved')}
              disabled={batch.isRunning}
              className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              อนุมัติที่เลือก ({selectedIds.size})
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkConfirmAction('rejected')}
              disabled={batch.isRunning}
              className="h-8 text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              ปฏิเสธที่เลือก ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl text-muted-foreground text-xs">
          ไม่พบข้อความให้กำลังใจในขณะนี้ค่ะ
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((row) => {
            const isSelected = selectedIds.has(row.id);
            return (
              <Card
                key={row.id}
                className={cn(
                  'border-l-4 rounded-2xl bg-card shadow-sm hover:shadow transition-all overflow-hidden flex flex-col justify-between',
                  row.status === 'approved'
                    ? 'border-l-green-500 border-border/40'
                    : row.status === 'rejected'
                    ? 'border-l-red-500 border-border/40'
                    : 'border-l-amber-500 border-border/40',
                  isSelected &&
                    'ring-2 ring-pink-500/70 border-pink-500/40 bg-pink-500/5 dark:bg-pink-950/20'
                )}
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Author Info & Checkbox */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id={`select-${row.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(row.id)}
                        className="h-4 w-4 rounded-md border-border/80 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600 cursor-pointer"
                        aria-label={`เลือกข้อความของ ${row.username || 'Unknown'}`}
                      />

                      <img
                        src={row.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                        alt="avatar"
                        className="w-8 h-8 rounded-full border border-latte/20 shrink-0"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-foreground">
                          @{row.username || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID: {row.discord_id || '-'}
                        </span>
                      </div>
                    </div>

                    <StatusBadge status={row.status} />
                  </div>

                  {/* Message Box */}
                  <div
                    onClick={() => toggleSelect(row.id)}
                    className="p-3 bg-secondary/30 hover:bg-secondary/40 transition-colors rounded-xl border border-latte/10 text-xs text-foreground leading-relaxed italic break-words cursor-pointer select-none"
                    title="คลิกเพื่อเลือกหรือยกเลิกเลือกรายการนี้"
                  >
                    "{row.message}"
                  </div>

                  {/* Date & Actions */}
                  <div className="flex items-center justify-between border-t border-latte/15 pt-2.5 text-[10px] text-muted-foreground">
                    <span>
                      สร้างเมื่อ:{' '}
                      {new Date(row.created_at).toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Approve / Reject buttons */}
                      {row.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-green-600 hover:bg-green-500/10 rounded-lg text-[10px] font-bold"
                            disabled={updatingId === row.id}
                            onClick={() => updateStatus(row.id, 'approved')}
                          >
                            {updatingId === row.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:bg-red-500/10 rounded-lg text-[10px] font-bold"
                            disabled={updatingId === row.id}
                            onClick={() => updateStatus(row.id, 'rejected')}
                          >
                            <X className="w-3 h-3 mr-1" />
                            ปฏิเสธ
                          </Button>
                        </>
                      )}
                      {row.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-amber-600 hover:bg-amber-500/10 rounded-lg text-[10px] font-bold"
                          disabled={updatingId === row.id}
                          onClick={() => updateStatus(row.id, 'rejected')}
                        >
                          <X className="w-3 h-3 mr-1" />
                          ระงับอนุมัติ
                        </Button>
                      )}
                      {row.status === 'rejected' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-green-600 hover:bg-green-500/10 rounded-lg text-[10px] font-bold"
                          disabled={updatingId === row.id}
                          onClick={() => updateStatus(row.id, 'approved')}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          อนุมัติใหม่
                        </Button>
                      )}

                      <span className="w-px h-3.5 bg-latte/30 mx-0.5" />

                      {/* Edit / Delete */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Bulk Confirmation Dialog ── */}
      <Dialog open={!!bulkConfirmAction} onOpenChange={(o) => !o && setBulkConfirmAction(null)}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              {bulkConfirmAction === 'approved' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ยืนยันอนุมัติแบบกลุ่ม ({selectedIds.size} ข้อความ)
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-500" />
                  ยืนยันปฏิเสธแบบกลุ่ม ({selectedIds.size} ข้อความ)
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              ระบบจะทำการ
              {bulkConfirmAction === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} ข้อความที่เลือกจำนวน{' '}
              <span className="font-bold text-foreground">{selectedIds.size}</span> รายการ
              ในเบื้องหลัง
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-2 p-3 bg-secondary/30 rounded-2xl border border-border/50 text-xs">
            <div className="flex items-start gap-2 text-muted-foreground">
              <span className="text-amber-500 text-sm">💡</span>
              <p className="leading-relaxed">
                การทำงานนี้จะประมวลผลเป็นพื้นหลังอัตโนมัติ คุณสามารถรีเฟรชหน้าเว็บ สลับแท็บ
                หรือไปใช้งานหน้าอื่นได้ทันทีโดยไม่สูญเสียความคืบหน้าค่ะ
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setBulkConfirmAction(null)}
              className="rounded-xl text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleExecuteBulk}
              className={cn(
                'rounded-xl text-xs text-white',
                bulkConfirmAction === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              )}
            >
              {bulkConfirmAction === 'approved'
                ? `เริ่มอนุมัติ ${selectedIds.size} รายการ`
                : `เริ่มปฏิเสธ ${selectedIds.size} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Dialog ── */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setAddText('');
        }}
      >
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500/20" />
              เพิ่มข้อความกำลังใจ (แอดมิน)
            </DialogTitle>
            <DialogDescription className="sr-only">
              เขียนข้อความให้กำลังใจที่จะได้รับการอนุมัติโดยทันที
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <Label className="text-xs font-semibold">ข้อความ ({MIN_LEN}–{MAX_LEN} ตัวอักษร)</Label>
            <Textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="เขียนข้อความให้กำลังใจ..."
              className="min-h-[100px] resize-none border-latte/40 rounded-xl"
              maxLength={MAX_LEN}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
              <span className={addText.trim().length < MIN_LEN ? 'text-amber-500' : 'text-green-500'}>
                {addText.trim().length} / {MAX_LEN} ตัวอักษร
              </span>
              <span>ขั้นต่ำ {MIN_LEN} ตัวอักษร</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addSaving || addText.trim().length < MIN_LEN}
              className="rounded-xl bg-pink-600 text-white hover:bg-pink-700"
            >
              {addSaving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}เพิ่ม (อนุมัติทันที)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              แก้ไขข้อความ
            </DialogTitle>
            <DialogDescription className="sr-only">แอดมินพิมพ์แก้ไขข้อความ</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <Label className="text-xs font-semibold">ข้อความ ({MIN_LEN}–{MAX_LEN} ตัวอักษร)</Label>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[100px] resize-none border-latte/40 rounded-xl"
              maxLength={MAX_LEN}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
              <span className={editText.trim().length < MIN_LEN ? 'text-amber-500' : 'text-green-500'}>
                {editText.trim().length} / {MAX_LEN} ตัวอักษร
              </span>
              <span>ขั้นต่ำ {MIN_LEN} ตัวอักษร</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editSaving || editText.trim().length < MIN_LEN}
              className="rounded-xl"
            >
              {editSaving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />ยืนยันการลบข้อความ
            </DialogTitle>
            <DialogDescription className="sr-only">แอดมินยืนยันลบข้อความถาวร</DialogDescription>
          </DialogHeader>

          <div className="my-2 text-xs leading-relaxed text-muted-foreground">
            <p>ลบข้อความนี้ถาวร?</p>
            <div className="my-2 p-3 bg-secondary/50 rounded-xl font-medium text-foreground italic break-words">
              "{deleteTarget?.message}"
            </div>
            <p className="text-[10px] text-red-500 leading-normal">
              * การดำเนินการนี้ไม่สามารถยกเลิกภายหลังได้ค่ะ
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl"
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}ลบถาวร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
