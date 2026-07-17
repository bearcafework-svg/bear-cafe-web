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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
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
  if (status === 'approved') return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 border gap-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> อนุมัติ</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 border gap-1 rounded-full"><XCircle className="w-3 h-3" /> ปฏิเสธ</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 border gap-1 rounded-full"><Clock className="w-3 h-3" /> รออนุมัติ</Badge>;
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
      const { error } = await supabase
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
      const { error } = await supabase
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
      const { error } = await supabase
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
      const q = search.toLowerCase().trim();
      return r.message.toLowerCase().includes(q)
        || (r.username ?? '').toLowerCase().includes(q)
        || (r.discord_username ?? '').toLowerCase().includes(q)
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
    <div className="space-y-5">
      
      {/* Header card info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500/20" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#8C6239] dark:text-[#EAD8C8]">ข้อความให้กำลังใจ (Healing Messages)</h2>
            <p className="text-[10px] text-muted-foreground">จัดการและตรวจสอบคำให้กำลังใจจากคอมมูนิตี้บอร์ด</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 rounded-xl text-xs h-9">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 rounded-xl text-xs h-9 bg-pink-600 hover:bg-pink-700 text-white">
            <Plus className="w-3.5 h-3.5" /> เพิ่มข้อความ
          </Button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        
        {/* Stats tabs */}
        <div className="md:col-span-8 flex gap-1.5 flex-wrap">
          {([
            { key: 'all', label: 'ทั้งหมด', count: counts.all, cls: 'bg-muted/60 hover:bg-muted text-muted-foreground' },
            { key: 'pending', label: 'รออนุมัติ', count: counts.pending, cls: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' },
            { key: 'approved', label: 'อนุมัติ', count: counts.approved, cls: 'bg-green-500/10 hover:bg-green-500/20 text-green-600' },
            { key: 'rejected', label: 'ปฏิเสธ', count: counts.rejected, cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-500' },
          ] as const).map(({ key, label, count, cls }) => (
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
              <span className="ml-0.5 bg-background/60 dark:bg-black/25 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{count}</span>
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
          {filtered.map((row) => (
            <Card
              key={row.id}
              className={cn(
                'border-l-4 rounded-2xl bg-card shadow-sm hover:shadow transition-shadow overflow-hidden flex flex-col justify-between',
                row.status === 'approved' ? 'border-l-green-500 border-border/40' :
                row.status === 'rejected' ? 'border-l-red-500 border-border/40' : 'border-l-amber-500 border-border/40'
              )}
            >
              <CardContent className="p-4 space-y-3.5">
                
                {/* Author Info */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
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
                <div className="p-3 bg-secondary/30 rounded-xl border border-latte/10 text-xs text-foreground leading-relaxed italic break-words">
                  "{row.message}"
                </div>

                {/* Date & Actions */}
                <div className="flex items-center justify-between border-t border-latte/15 pt-2.5 text-[10px] text-muted-foreground">
                  <span>
                    สร้างเมื่อ: {new Date(row.created_at).toLocaleString('th-TH', {
                      day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
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
                          {updatingId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
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
          ))}
        </div>
      )}

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddText(''); }}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500/20" />เพิ่มข้อความกำลังใจ (แอดมิน)
            </DialogTitle>
            <DialogDescription className="sr-only">เขียนข้อความให้กำลังใจที่จะได้รับการอนุมัติโดยทันที</DialogDescription>
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
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleAdd} disabled={addSaving || addText.trim().length < MIN_LEN} className="rounded-xl bg-pink-600 text-white hover:bg-pink-700">
              {addSaving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}เพิ่ม (อนุมัติทันที)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">แก้ไขข้อความ</DialogTitle>
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
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={editSaving || editText.trim().length < MIN_LEN} className="rounded-xl">
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
            <p className="text-[10px] text-red-500 leading-normal">* การดำเนินการนี้ไม่สามารถยกเลิกภายหลังได้ค่ะ</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="rounded-xl" disabled={deleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl">
              {deleting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}ลบถาวร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
