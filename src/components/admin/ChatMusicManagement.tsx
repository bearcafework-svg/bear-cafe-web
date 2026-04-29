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
import { Plus, Trash2, Edit, Music2, FolderMusic, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
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

// ─── Category Form Dialog ─────────────────────────────────────────────────────
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

  useEffect(() => {
    setLabel(editing?.label ?? '');
  }, [editing, open]);

  async function handleSave() {
    if (!label.trim()) { toast({ title: 'กรุณากรอกชื่อหมวด', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_categories').update({ label: label.trim() }).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหมวดแล้ว' });
      } else {
        const { data: existing } = await (supabase as any).from('chat_music_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any).from('chat_music_categories').insert({ label: label.trim(), sort_order: nextOrder });
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
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Track Form Dialog ────────────────────────────────────────────────────────
function TrackDialog({
  open, onClose, editing, categoryId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicTrack | null;
  categoryId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', src: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ title: editing?.title ?? '', src: editing?.src ?? '' });
  }, [editing, open]);

  async function handleSave() {
    if (!form.title.trim() || !form.src.trim()) {
      toast({ title: 'กรุณากรอกชื่อเพลงและ URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_tracks')
          .update({ title: form.title.trim(), src: form.src.trim() })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตเพลงแล้ว' });
      } else {
        const { data: existing } = await (supabase as any).from('chat_music_tracks')
          .select('sort_order').eq('category_id', categoryId)
          .order('sort_order', { ascending: false }).limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any).from('chat_music_tracks')
          .insert({ category_id: categoryId, title: form.title.trim(), src: form.src.trim(), sort_order: nextOrder });
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
              รองรับ URL ตรงของไฟล์เสียง เช่น จาก Pixabay, SoundCloud CDN หรือ Supabase Storage
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ChatMusicManagement() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Dialogs
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: MusicCategory | null }>({ open: false, editing: null });
  const [trackDialog, setTrackDialog] = useState<{ open: boolean; editing: MusicTrack | null; categoryId: string }>({ open: false, editing: null, categoryId: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, trackRes] = await Promise.all([
      (supabase as any).from('chat_music_categories').select('*').order('sort_order'),
      (supabase as any).from('chat_music_tracks').select('*').order('sort_order'),
    ]);
    const cats: MusicCategory[] = catRes.data ?? [];
    setCategories(cats);
    setTracks(trackRes.data ?? []);
    // Auto-expand all categories
    setExpandedCats(new Set(cats.map((c: MusicCategory) => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteCategory(cat: MusicCategory) {
    if (!confirm(`ลบหมวด "${cat.label}" และเพลงทั้งหมดในหมวดนี้?`)) return;
    const { error } = await (supabase as any).from('chat_music_categories').delete().eq('id', cat.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' }); return; }
    toast({ title: 'ลบหมวดแล้ว' });
    fetchAll();
  }

  async function deleteTrack(track: MusicTrack) {
    if (!confirm(`ลบเพลง "${track.title}"?`)) return;
    const { error } = await (supabase as any).from('chat_music_tracks').delete().eq('id', track.id);
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

  const totalTracks = tracks.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Music2 className="w-5 h-5" />
            จัดการเพลง BGM
            <Badge variant="secondary" className="text-xs">{totalTracks} เพลง</Badge>
          </CardTitle>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setCatDialog({ open: true, editing: null })}
          >
            <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          เพลงที่เพิ่มที่นี่จะแสดงใน Music Player ของห้องแชท
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderMusic className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">ยังไม่มีหมวดหมู่</p>
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
              <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่แรก
            </Button>
          </div>
        ) : (
          categories.map(cat => {
            const catTracks = tracks.filter(t => t.category_id === cat.id);
            const expanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                  <button onClick={() => toggleExpand(cat.id)} className="flex items-center gap-2 flex-1 text-left">
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <FolderMusic className="w-4 h-4 text-[#c8956c] shrink-0" />
                    <span className="font-semibold text-sm">{cat.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{catTracks.length} เพลง</Badge>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setCatDialog({ open: true, editing: cat })}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(cat)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                      onClick={() => setTrackDialog({ open: true, editing: null, categoryId: cat.id })}>
                      <Plus className="w-3 h-3" /> เพิ่มเพลง
                    </Button>
                  </div>
                </div>

                {/* Track list */}
                {expanded && (
                  <div className="divide-y divide-border/50">
                    {catTracks.length === 0 ? (
                      <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                        ยังไม่มีเพลงในหมวดนี้
                      </div>
                    ) : (
                      catTracks.map((track, i) => (
                        <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group">
                          <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          <div className="w-6 h-6 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-xs font-mono text-[#9c7c5e] shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{track.src}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setTrackDialog({ open: true, editing: track, categoryId: cat.id })}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteTrack(track)}>
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

      {/* Dialogs */}
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
        onSaved={fetchAll}
      />
    </Card>
  );
}
