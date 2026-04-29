import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Music2, Folder, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MusicCategory {
  id: string;
  label: string;
  sort_order: number;
}

interface MusicTrack {
  id: string;
  category_id: string;
  title: string;
  src: string;
  sort_order: number;
}

// ─── Category Dialog ──────────────────────────────────────────────────────────
function CategoryDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicCategory | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(editing?.label ?? ''); }, [editing, open]);

  async function handleSave() {
    if (!label.trim()) {
      toast({ title: 'กรุณากรอกชื่อหมวด', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from('chat_music_categories')
          .update({ label: label.trim() })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหมวดแล้ว' });
      } else {
        const { data: existing } = await (supabase as any)
          .from('chat_music_categories')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any)
          .from('chat_music_categories')
          .insert({ label: label.trim(), sort_order: nextOrder });
        if (error) throw error;
        toast({ title: 'เพิ่มหมวดแล้ว' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชื่อหมวดหมู่ *</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="เช่น Lo-fi Chill, Jazz Cafe"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Track Dialog ─────────────────────────────────────────────────────────────
function TrackDialog({
  open, onClose, editing, categoryId, categories, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicTrack | null;
  categoryId: string;
  categories: MusicCategory[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', src: '', category_id: categoryId });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      title: editing?.title ?? '',
      src: editing?.src ?? '',
      category_id: editing?.category_id ?? categoryId,
    });
  }, [editing, open, categoryId]);

  async function handleSave() {
    if (!form.title.trim() || !form.src.trim()) {
      toast({ title: 'กรุณากรอกชื่อเพลงและ URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from('chat_music_tracks')
          .update({ title: form.title.trim(), src: form.src.trim(), category_id: form.category_id })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตเพลงแล้ว' });
      } else {
        const { data: existing } = await (supabase as any)
          .from('chat_music_tracks')
          .select('sort_order')
          .eq('category_id', form.category_id)
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any)
          .from('chat_music_tracks')
          .insert({
            category_id: form.category_id,
            title: form.title.trim(),
            src: form.src.trim(),
            sort_order: nextOrder,
          });
        if (error) throw error;
        toast({ title: 'เพิ่มเพลงแล้ว' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'แก้ไขเพลง' : 'เพิ่มเพลงใหม่'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>หมวดหมู่ *</Label>
            <select
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อเพลง *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="เช่น Cozy Rain, Late Night Study"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL เพลง (MP3/OGG) *</Label>
            <Input
              value={form.src}
              onChange={e => setForm(f => ({ ...f, src: e.target.value }))}
              placeholder="https://example.com/music.mp3"
            />
            <p className="text-[11px] text-muted-foreground">
              ใช้ URL ตรงของไฟล์เสียง เช่น จาก Pixabay, Supabase Storage หรือ CDN อื่นๆ
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ChatMusicManagement() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: MusicCategory | null }>({
    open: false, editing: null,
  });
  const [trackDialog, setTrackDialog] = useState<{
    open: boolean; editing: MusicTrack | null; categoryId: string;
  }>({ open: false, editing: null, categoryId: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, trackRes] = await Promise.all([
      (supabase as any).from('chat_music_categories').select('*').order('sort_order'),
      (supabase as any).from('chat_music_tracks').select('*').order('sort_order'),
    ]);
    const cats: MusicCategory[] = catRes.data ?? [];
    setCategories(cats);
    setTracks(trackRes.data ?? []);
    setExpandedCats(new Set(cats.map(c => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteCategory(cat: MusicCategory) {
    if (!confirm(`ลบหมวด "${cat.label}" และเพลงทั้งหมดในหมวดนี้?`)) return;
    const { error } = await (supabase as any)
      .from('chat_music_categories').delete().eq('id', cat.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' }); return; }
    toast({ title: 'ลบหมวดแล้ว' });
    fetchAll();
  }

  async function deleteTrack(track: MusicTrack) {
    if (!confirm(`ลบเพลง "${track.title}"?`)) return;
    const { error } = await (supabase as any)
      .from('chat_music_tracks').delete().eq('id', track.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' }); return; }
    toast({ title: 'ลบเพลงแล้ว' });
    fetchAll();
  }

  function toggleExpand(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="w-5 h-5" />
              จัดการเพลง BGM
              <Badge variant="secondary" className="text-xs">{tracks.length} เพลง</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              เพลงที่เพิ่มที่นี่จะแสดงใน Music Player ของห้องแชท
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setCatDialog({ open: true, editing: null })}
            >
              <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={categories.length === 0}
              onClick={() => setTrackDialog({
                open: true,
                editing: null,
                categoryId: categories[0]?.id ?? '',
              })}
            >
              <Plus className="w-4 h-4" /> เพิ่มเพลง
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">ยังไม่มีหมวดหมู่</p>
            <p className="text-xs mt-1">เริ่มต้นด้วยการเพิ่มหมวดหมู่ก่อน</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setCatDialog({ open: true, editing: null })}
            >
              <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่แรก
            </Button>
          </div>
        ) : (
          categories.map(cat => {
            const catTracks = tracks.filter(t => t.category_id === cat.id);
            const expanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
                {/* Category row */}
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                  >
                    {expanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <Folder className="w-4 h-4 text-[#c8956c] shrink-0" />
                    <span className="font-semibold text-sm truncate">{cat.label}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {catTracks.length} เพลง
                    </Badge>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setCatDialog({ open: true, editing: cat })}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(cat)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                      onClick={() => setTrackDialog({ open: true, editing: null, categoryId: cat.id })}
                    >
                      <Plus className="w-3 h-3" /> เพิ่มเพลง
                    </Button>
                  </div>
                </div>

                {/* Track list */}
                {expanded && (
                  <div className="divide-y divide-border/50">
                    {catTracks.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <p className="text-sm text-muted-foreground">ยังไม่มีเพลงในหมวดนี้</p>
                        <Button
                          variant="outline" size="sm" className="mt-2 gap-1.5 text-xs"
                          onClick={() => setTrackDialog({ open: true, editing: null, categoryId: cat.id })}
                        >
                          <Plus className="w-3 h-3" /> เพิ่มเพลงแรก
                        </Button>
                      </div>
                    ) : (
                      catTracks.map((track, i) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{track.src}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setTrackDialog({ open: true, editing: track, categoryId: cat.id })}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteTrack(track)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      <CategoryDialog
        open={catDialog.open}
        onClose={() => setCatDialog({ open: false, editing: null })}
        editing={catDialog.editing}
        onSaved={fetchAll}
      />
      <TrackDialog
        open={trackDialog.open}
        onClose={() => setTrackDialog({ open: false, editing: null, categoryId: '' })}
        editing={trackDialog.editing}
        categoryId={trackDialog.categoryId}
        categories={categories}
        onSaved={fetchAll}
      />
    </Card>
  );
}
