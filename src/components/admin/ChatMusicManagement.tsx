import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Trash2, Edit, Music2, Folder, ChevronDown, ChevronRight,
  Upload, FileAudio, X, Check,
} from 'lucide-react';
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

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────
function UploadTab({
  categories,
  onUploaded,
}: {
  categories: MusicCategory[];
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface UploadItem {
    file: File;
    title: string;
    categoryId: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
  }

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const defaultCat = categories[0]?.id ?? '';
    const newItems: UploadItem[] = Array.from(files)
      .filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|ogg|wav|flac|aac)$/i))
      .map(f => ({
        file: f,
        title: f.name.replace(/\.[^.]+$/, ''), // strip extension as default title
        categoryId: defaultCat,
        status: 'pending',
        progress: 0,
      }));
    if (newItems.length === 0) {
      toast({ title: 'ไม่พบไฟล์เสียง', description: 'รองรับ MP3, OGG, WAV, FLAC, AAC', variant: 'destructive' });
      return;
    }
    setItems(prev => [...prev, ...newItems]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<UploadItem>) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  async function uploadAll() {
    const pending = items.filter(i => i.status === 'pending');
    if (pending.length === 0) return;
    if (categories.length === 0) {
      toast({ title: 'กรุณาเพิ่มหมวดหมู่ก่อน', variant: 'destructive' });
      return;
    }
    setUploading(true);

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.status !== 'pending') continue;

      updateItem(idx, { status: 'uploading', progress: 10 });

      try {
        // 1. Upload file to storage
        const ext = item.file.name.split('.').pop() ?? 'mp3';
        const path = `${Date.now()}_${sanitizeFilename(item.title)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-music')
          .upload(path, item.file, { contentType: item.file.type || 'audio/mpeg' });

        if (uploadError) throw uploadError;
        updateItem(idx, { progress: 70 });

        // 2. Get public URL
        const { data: urlData } = supabase.storage.from('chat-music').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        // 3. Insert track record
        const { data: existing } = await (supabase as any)
          .from('chat_music_tracks')
          .select('sort_order')
          .eq('category_id', item.categoryId)
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;

        const { error: dbError } = await (supabase as any)
          .from('chat_music_tracks')
          .insert({
            category_id: item.categoryId,
            title: item.title.trim() || item.file.name,
            src: publicUrl,
            sort_order: nextOrder,
          });

        if (dbError) throw dbError;
        updateItem(idx, { status: 'done', progress: 100 });
      } catch (e: any) {
        updateItem(idx, { status: 'error', progress: 0, error: e.message });
      }
    }

    setUploading(false);
    onUploaded();
    toast({ title: 'อัปโหลดเสร็จแล้ว' });
  }

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        อัปโหลดไฟล์เสียงโดยตรง ระบบจะบันทึกลง Supabase Storage และเพิ่มเข้าหมวดหมู่ที่เลือกอัตโนมัติ
      </p>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.ogg,.wav,.flac,.aac"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-sm">คลิกหรือลากไฟล์มาวางที่นี่</p>
        <p className="text-xs text-muted-foreground mt-1">รองรับ MP3, OGG, WAV, FLAC, AAC (สูงสุด 20 MB ต่อไฟล์)</p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{items.length} ไฟล์ · {doneCount} เสร็จแล้ว</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems(prev => prev.filter(i => i.status !== 'done'))}
                disabled={doneCount === 0}
              >
                ล้างรายการที่เสร็จ
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={uploadAll}
                disabled={uploading || pendingCount === 0 || categories.length === 0}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'กำลังอัปโหลด...' : `อัปโหลด ${pendingCount} ไฟล์`}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3 space-y-2 transition-colors ${
                  item.status === 'done' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20' :
                  item.status === 'error' ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20' :
                  'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {item.status === 'done'
                      ? <Check className="w-4 h-4 text-emerald-600" />
                      : item.status === 'error'
                      ? <X className="w-4 h-4 text-red-500" />
                      : <FileAudio className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title input */}
                    <Input
                      value={item.title}
                      onChange={e => updateItem(idx, { title: e.target.value })}
                      placeholder="ชื่อเพลง"
                      disabled={item.status !== 'pending'}
                      className="h-8 text-sm"
                    />

                    {/* Category select + file info */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={item.categoryId}
                        onChange={e => updateItem(idx, { categoryId: e.target.value })}
                        disabled={item.status !== 'pending'}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <span className="text-[11px] text-muted-foreground">
                        {formatBytes(item.file.size)}
                      </span>
                      {item.status === 'error' && (
                        <span className="text-[11px] text-red-500">{item.error}</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {item.status === 'uploading' && (
                      <Progress value={item.progress} className="h-1.5" />
                    )}
                  </div>

                  {item.status === 'pending' && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
    if (!label.trim()) { toast({ title: 'กรุณากรอกชื่อหมวด', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_categories').update({ label: label.trim() }).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหมวดแล้ว' });
      } else {
        const { data: ex } = await (supabase as any).from('chat_music_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const { error } = await (supabase as any).from('chat_music_categories').insert({ label: label.trim(), sort_order: ((ex?.[0]?.sort_order ?? -1) as number) + 1 });
        if (error) throw error;
        toast({ title: 'เพิ่มหมวดแล้ว' });
      }
      onSaved(); onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>ชื่อหมวดหมู่ *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="เช่น Lo-fi Chill, Jazz Cafe" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Track Edit Dialog ────────────────────────────────────────────────────────
function TrackEditDialog({
  open, onClose, editing, categories, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicTrack | null;
  categories: MusicCategory[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', src: '', category_id: '', image_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      title: editing?.title ?? '',
      src: editing?.src ?? '',
      category_id: editing?.category_id ?? categories[0]?.id ?? '',
      image_url: (editing as any)?.image_url ?? '',
    });
  }, [editing, open]);

  async function handleSave() {
    if (!form.title.trim()) { toast({ title: 'กรุณากรอกชื่อเพลง', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('chat_music_tracks')
        .update({ title: form.title.trim(), src: form.src.trim(), category_id: form.category_id, image_url: form.image_url.trim() || null })
        .eq('id', editing!.id);
      if (error) throw error;
      toast({ title: 'อัปเดตเพลงแล้ว' });
      onSaved(); onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>แก้ไขเพลง</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>หมวดหมู่</Label>
            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อเพลง *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>URL เพลง</Label>
            <Input value={form.src} onChange={e => setForm(f => ({ ...f, src: e.target.value }))} placeholder="https://..." />
            <p className="text-[11px] text-muted-foreground">URL จะอัปเดตอัตโนมัติถ้าอัปโหลดผ่านระบบ</p>
          </div>
          <div className="space-y-1.5">
            <Label>รูปปก (URL) — แสดงบนแผ่นเสียง</Label>
            <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            {form.image_url && (
              <img src={form.image_url} alt="cover" className="w-16 h-16 rounded-xl object-cover border border-border mt-1"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
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

// ─── Library Tab ──────────────────────────────────────────────────────────────
function LibraryTab({
  categories, tracks, onRefresh,
}: {
  categories: MusicCategory[];
  tracks: MusicTrack[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(categories.map(c => c.id)));
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: MusicCategory | null }>({ open: false, editing: null });
  const [trackDialog, setTrackDialog] = useState<{ open: boolean; editing: MusicTrack | null }>({ open: false, editing: null });

  useEffect(() => {
    setExpandedCats(new Set(categories.map(c => c.id)));
  }, [categories]);

  async function deleteCategory(cat: MusicCategory) {
    if (!confirm(`ลบหมวด "${cat.label}" และเพลงทั้งหมด?`)) return;
    // Delete storage files
    const catTracks = tracks.filter(t => t.category_id === cat.id);
    for (const t of catTracks) {
      const path = t.src.split('/chat-music/').pop();
      if (path) await supabase.storage.from('chat-music').remove([path]);
    }
    await (supabase as any).from('chat_music_categories').delete().eq('id', cat.id);
    toast({ title: 'ลบหมวดแล้ว' });
    onRefresh();
  }

  async function deleteTrack(track: MusicTrack) {
    if (!confirm(`ลบเพลง "${track.title}"?`)) return;
    // Delete storage file
    const path = track.src.split('/chat-music/').pop();
    if (path) await supabase.storage.from('chat-music').remove([path]);
    await (supabase as any).from('chat_music_tracks').delete().eq('id', track.id);
    toast({ title: 'ลบเพลงแล้ว' });
    onRefresh();
  }

  function toggleExpand(id: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
          <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">ยังไม่มีหมวดหมู่</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
            <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่แรก
          </Button>
        </div>
      ) : (
        categories.map(cat => {
          const catTracks = tracks.filter(t => t.category_id === cat.id);
          const expanded = expandedCats.has(cat.id);
          return (
            <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                <button onClick={() => toggleExpand(cat.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                  {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <Folder className="w-4 h-4 text-[#c8956c] shrink-0" />
                  <span className="font-semibold text-sm truncate">{cat.label}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{catTracks.length} เพลง</Badge>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCatDialog({ open: true, editing: cat })}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCategory(cat)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {expanded && (
                <div className="divide-y divide-border/50">
                  {catTracks.length === 0 ? (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">ยังไม่มีเพลง — อัปโหลดได้ที่แท็บ "อัปโหลด"</div>
                  ) : (
                    catTracks.map((track, i) => (
                      <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{track.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{track.src}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTrackDialog({ open: true, editing: track })}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTrack(track)}><Trash2 className="w-3.5 h-3.5" /></Button>
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

      <CategoryDialog open={catDialog.open} onClose={() => setCatDialog({ open: false, editing: null })} editing={catDialog.editing} onSaved={onRefresh} />
      <TrackEditDialog open={trackDialog.open} onClose={() => setTrackDialog({ open: false, editing: null })} editing={trackDialog.editing} categories={categories} onSaved={onRefresh} />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function ChatMusicManagement() {
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, trackRes] = await Promise.all([
      (supabase as any).from('chat_music_categories').select('*').order('sort_order'),
      (supabase as any).from('chat_music_tracks').select('*').order('sort_order'),
    ]);
    setCategories(catRes.data ?? []);
    setTracks(trackRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="w-5 h-5" />
          จัดการเพลง BGM
          <Badge variant="secondary" className="text-xs">{tracks.length} เพลง</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          เพลงที่เพิ่มที่นี่จะแสดงใน Music Player ของห้องแชทคาเฟ่ลับ
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : (
          <Tabs defaultValue="upload">
            <TabsList className="mb-4">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" /> อัปโหลดเพลง
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2">
                <Music2 className="w-4 h-4" /> คลังเพลง
                <Badge variant="secondary" className="text-[10px]">{tracks.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <UploadTab categories={categories} onUploaded={fetchAll} />
            </TabsContent>
            <TabsContent value="library">
              <LibraryTab categories={categories} tracks={tracks} onRefresh={fetchAll} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
