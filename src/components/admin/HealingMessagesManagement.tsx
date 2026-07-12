import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Check, X, Trash2, Pencil, Plus, RefreshCw, Search, Heart, Loader2, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_LEN = 10;
const MAX_LEN = 100;

type Status = 'pending' | 'approved' | 'rejected';

interface HealingMessage {
  id: string;
  message: string;
  status: Status;
  author_id: string;
  created_at: string;
  discord_id?: string | null;
  username?: string | null;
}

// ─── API: fetch all messages joined with profiles ─────────────────────────────
async function fetchAllMessages(): Promise<HealingMessage[]> {
  const { data, error } = await (supabase as any)
    .from('healing_messages')
    .select('id, message, status, author_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data || []) as HealingMessage[];
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))];

  if (authorIds.length === 0) return rows;

  const { data: profiles } = await (supabase as any)
    .from('profiles')
    .select('id, discord_id, username')
    .in('id', authorIds);

  const profileMap: Record<string, { discord_id: string; username: string }> = {};
  (profiles ?? []).forEach((p: any) => {
    profileMap[p.id] = { discord_id: p.discord_id, username: p.username };
  });

  return rows.map((r) => ({
    ...r,
    discord_id: profileMap[r.author_id]?.discord_id ?? null,
    username: profileMap[r.author_id]?.username ?? null,
  }));
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  if (status === 'approved') return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 border gap-1"><CheckCircle2 className="w-3 h-3" /> อนุมัติ</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 border gap-1"><XCircle className="w-3 h-3" /> ปฏิเสธ</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 border gap-1"><Clock className="w-3 h-3" /> รออนุมัติ</Badge>;
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

  useEffect(() => { load(); }, [load]);

  // ── Status update ────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: Status) => {
    setUpdatingId(id);
    try {
      const { error } = await (supabase as any)
        .from('healing_messages').update({ status }).eq('id', id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      toast({ title: status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว' });
    } catch (e: any) {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
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
      const { error } = await (supabase as any)
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
  const openEdit = (row: HealingMessage) => { setEditTarget(row); setEditText(row.message); };
  const handleEdit = async () => {
    if (!editTarget) return;
    const trimmed = editText.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      toast({ title: `ข้อความต้องมี ${MIN_LEN}–${MAX_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('healing_messages').update({ message: trimmed }).eq('id', editTarget.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => r.id === editTarget.id ? { ...r, message: trimmed } : r));
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
      const { error } = await (supabase as any)
        .from('healing_messages').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast({ title: 'ลบสำเร็จ' });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.message.toLowerCase().includes(q)
        || (r.username ?? '').toLowerCase().includes(q)
        || (r.discord_id ?? '').includes(q);
    }
    return true;
  });

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-400" />
          <h2 className="text-lg font-semibold">ข้อความกำลังใจ</h2>
          <Badge variant="secondary" className="text-xs">{filtered.length} / {rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />เพิ่มข้อความ
          </Button>
        </div>
      </div>

      {/* ── Stats tabs ── */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: 'all', label: 'ทั้งหมด', count: counts.all, cls: 'bg-muted/60 hover:bg-muted' },
          { key: 'pending', label: 'รออนุมัติ', count: counts.pending, cls: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' },
          { key: 'approved', label: 'อนุมัติ', count: counts.approved, cls: 'bg-green-500/10 hover:bg-green-500/20 text-green-600' },
          { key: 'rejected', label: 'ปฏิเสธ', count: counts.rejected, cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-500' },
        ] as const).map(({ key, label, count, cls }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key as Status | 'all')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-all border flex items-center gap-1.5',
              cls,
              filterStatus === key ? 'ring-2 ring-primary border-primary/40' : 'border-border/40'
            )}
          >
            {key === 'pending' && <Clock className="w-3.5 h-3.5" />}
            {key === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {key === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
            <span>{label}</span>
            <span className="ml-1 font-bold">{count}</span>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-9 text-sm"
          placeholder="ค้นหาข้อความ, ชื่อ, Discord ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">ไม่พบข้อความ</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <div
              key={row.id}
              className={cn(
                'group rounded-xl border-l-4 border border-border/40 bg-card px-4 py-3 transition-all hover:bg-muted/20 hover:shadow-sm',
                row.status === 'approved' ? 'border-l-green-500' :
                row.status === 'rejected' ? 'border-l-red-400' : 'border-l-amber-400'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm leading-relaxed">{row.message}</p>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {row.username && <span className="font-medium text-foreground/70">@{row.username}</span>}
                    {row.discord_id && <span className="font-mono">{row.discord_id}</span>}
                    <span>{new Date(row.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    <StatusBadge status={row.status} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {row.status === 'pending' && (
                    <>
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-green-500 hover:bg-green-500/10"
                        disabled={updatingId === row.id}
                        onClick={() => updateStatus(row.id, 'approved')}
                        title="อนุมัติ"
                      >
                        {updatingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                        disabled={updatingId === row.id}
                        onClick={() => updateStatus(row.id, 'rejected')}
                        title="ปฏิเสธ"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  {row.status === 'approved' && (
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                      disabled={updatingId === row.id}
                      onClick={() => updateStatus(row.id, 'rejected')}
                      title="ถอนการอนุมัติ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {row.status === 'rejected' && (
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-green-500 hover:bg-green-500/10"
                      disabled={updatingId === row.id}
                      onClick={() => updateStatus(row.id, 'approved')}
                      title="อนุมัติใหม่"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => openEdit(row)}
                    title="แก้ไข"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                    title="ลบ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddText(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Heart className="w-4 h-4 text-pink-400" />เพิ่มข้อความกำลังใจ</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>ข้อความ ({MIN_LEN}–{MAX_LEN} ตัวอักษร)</Label>
            <Textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="เขียนข้อความให้กำลังใจ..."
              className="min-h-[100px] resize-none"
              maxLength={MAX_LEN}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={addText.trim().length < MIN_LEN ? 'text-amber-500' : 'text-green-500'}>
                {addText.trim().length} / {MAX_LEN} ตัวอักษร
              </span>
              <span>ขั้นต่ำ {MIN_LEN} ตัวอักษร</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleAdd} disabled={addSaving || addText.trim().length < MIN_LEN}>
              {addSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}เพิ่ม (อนุมัติทันที)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>แก้ไขข้อความ</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>ข้อความ ({MIN_LEN}–{MAX_LEN} ตัวอักษร)</Label>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={MAX_LEN}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={editText.trim().length < MIN_LEN ? 'text-amber-500' : 'text-green-500'}>
                {editText.trim().length} / {MAX_LEN} ตัวอักษร
              </span>
              <span>ขั้นต่ำ {MIN_LEN} ตัวอักษร</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={editSaving || editText.trim().length < MIN_LEN}>
              {editSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />ยืนยันการลบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ลบข้อความ <span className="text-foreground font-medium">"{deleteTarget?.message.slice(0, 40)}..."</span>?
            <br /><span className="text-destructive text-xs">ไม่สามารถย้อนกลับได้</span>
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
