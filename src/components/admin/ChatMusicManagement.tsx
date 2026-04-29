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

// â”€â”€â”€ Category Form Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (!label.trim()) { toast({ title: 'à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¸«à¸¡à¸§à¸”', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_categories').update({ label: label.trim() }).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'à¸­à¸±à¸›à¹€à¸”à¸•à¸«à¸¡à¸§à¸”à¹à¸¥à¹‰à¸§' });
      } else {
        const { data: existing } = await (supabase as any).from('chat_music_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any).from('chat_music_categories').insert({ label: label.trim(), sort_order: nextOrder });
        if (error) throw error;
        toast({ title: 'à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¡à¸§à¸”à¹à¸¥à¹‰à¸§' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'à¹à¸à¹‰à¹„à¸‚à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆ'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>à¸Šà¸·à¹ˆà¸­à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ *</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="à¹€à¸Šà¹ˆà¸™ Lo-fi Chill, Jazz Cafe"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>à¸¢à¸à¹€à¸¥à¸´à¸</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...' : 'à¸šà¸±à¸™à¸—à¸¶à¸'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Track Form Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      toast({ title: 'à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¹€à¸žà¸¥à¸‡à¹à¸¥à¸° URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_tracks')
          .update({ title: form.title.trim(), src: form.src.trim() })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'à¸­à¸±à¸›à¹€à¸”à¸•à¹€à¸žà¸¥à¸‡à¹à¸¥à¹‰à¸§' });
      } else {
        const { data: existing } = await (supabase as any).from('chat_music_tracks')
          .select('sort_order').eq('category_id', categoryId)
          .order('sort_order', { ascending: false }).limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;
        const { error } = await (supabase as any).from('chat_music_tracks')
          .insert({ category_id: categoryId, title: form.title.trim(), src: form.src.trim(), sort_order: nextOrder });
        if (error) throw error;
        toast({ title: 'à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸žà¸¥à¸‡à¹à¸¥à¹‰à¸§' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'à¹à¸à¹‰à¹„à¸‚à¹€à¸žà¸¥à¸‡' : 'à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸žà¸¥à¸‡à¹ƒà¸«à¸¡à¹ˆ'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>à¸Šà¸·à¹ˆà¸­à¹€à¸žà¸¥à¸‡ *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="à¹€à¸Šà¹ˆà¸™ Cozy Rain, Late Night Study"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL à¹€à¸žà¸¥à¸‡ (MP3/OGG) *</Label>
            <Input
              value={form.src}
              onChange={e => setForm(f => ({ ...f, src: e.target.value }))}
              placeholder="https://example.com/music.mp3"
            />
            <p className="text-[11px] text-muted-foreground">
              à¸£à¸­à¸‡à¸£à¸±à¸š URL à¸•à¸£à¸‡à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œà¹€à¸ªà¸µà¸¢à¸‡ à¹€à¸Šà¹ˆà¸™ à¸ˆà¸²à¸ Pixabay, SoundCloud CDN à¸«à¸£à¸·à¸­ Supabase Storage
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>à¸¢à¸à¹€à¸¥à¸´à¸</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...' : 'à¸šà¸±à¸™à¸—à¸¶à¸'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (!confirm(`à¸¥à¸šà¸«à¸¡à¸§à¸” "${cat.label}" à¹à¸¥à¸°à¹€à¸žà¸¥à¸‡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸™à¸«à¸¡à¸§à¸”à¸™à¸µà¹‰?`)) return;
    const { error } = await (supabase as any).from('chat_music_categories').delete().eq('id', cat.id);
    if (error) { toast({ title: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', variant: 'destructive' }); return; }
    toast({ title: 'à¸¥à¸šà¸«à¸¡à¸§à¸”à¹à¸¥à¹‰à¸§' });
    fetchAll();
  }

  async function deleteTrack(track: MusicTrack) {
    if (!confirm(`à¸¥à¸šà¹€à¸žà¸¥à¸‡ "${track.title}"?`)) return;
    const { error } = await (supabase as any).from('chat_music_tracks').delete().eq('id', track.id);
    if (error) { toast({ title: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', variant: 'destructive' }); return; }
    toast({ title: 'à¸¥à¸šà¹€à¸žà¸¥à¸‡à¹à¸¥à¹‰à¸§' });
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
            à¸ˆà¸±à¸”à¸à¸²à¸£à¹€à¸žà¸¥à¸‡ BGM
            <Badge variant="secondary" className="text-xs">{totalTracks} à¹€à¸žà¸¥à¸‡</Badge>
          </CardTitle>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setCatDialog({ open: true, editing: null })}
          >
            <Plus className="w-4 h-4" /> à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          à¹€à¸žà¸¥à¸‡à¸—à¸µà¹ˆà¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸™à¸µà¹ˆà¸ˆà¸°à¹à¸ªà¸”à¸‡à¹ƒà¸™ Music Player à¸‚à¸­à¸‡à¸«à¹‰à¸­à¸‡à¹à¸Šà¸—
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</p>
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
              <Plus className="w-4 h-4" /> à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆà¹à¸£à¸
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
                    <Folder className="w-4 h-4 text-[#c8956c] shrink-0" />
                    <span className="font-semibold text-sm">{cat.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{catTracks.length} à¹€à¸žà¸¥à¸‡</Badge>
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
                      <Plus className="w-3 h-3" /> à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸žà¸¥à¸‡
                    </Button>
                  </div>
                </div>

                {/* Track list */}
                {expanded && (
                  <div className="divide-y divide-border/50">
                    {catTracks.length === 0 ? (
                      <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                        à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸žà¸¥à¸‡à¹ƒà¸™à¸«à¸¡à¸§à¸”à¸™à¸µà¹‰
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
