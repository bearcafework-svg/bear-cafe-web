import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit, Coffee, Tag, Type, Upload, X, AlertTriangle, User, ShieldAlert, GitMerge, RotateCcw } from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { ChatMusicManagement } from './ChatMusicManagement';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatTopic {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface ChatProfile {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface NameWord {
  id: string;
  word: string;
  created_at: string;
}

interface Violation {
  id: string;
  session_id: string;
  user_id: string;
  word: string;
  message: string;
  created_at: string;
  profile?: { username: string; discord_id: string; avatar_url: string | null };
}

// ─── Image Upload helper ──────────────────────────────────────────────────────
async function uploadTopicImage(file: File, bucket: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ─── ImageUploadField ─────────────────────────────────────────────────────────
function ImageUploadField({
  currentUrl,
  onUploaded,
  onRemove,
  bucket,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  bucket: string;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let processed = file;
      if (file.size > 2 * 1024 * 1024) {
        processed = await compressImage(file, { maxWidth: 512, maxHeight: 512, maxSizeBytes: 2 * 1024 * 1024 });
      }
      const url = await uploadTopicImage(processed, bucket);
      onUploaded(url);
    } catch (err: any) {
      toast({ title: 'อัปโหลดไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {currentUrl ? (
        <div className="relative w-24 h-24 group">
          <img src={currentUrl} alt="preview" className="w-24 h-24 rounded-xl object-cover border border-border" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-xl bg-black/40 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors text-muted-foreground"
        >
          <Upload className="w-5 h-5" />
          <span className="text-[10px]">{uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}</span>
        </button>
      )}
    </div>
  );
}

// ─── Topics Tab ───────────────────────────────────────────────────────────────
function TopicsTab() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChatTopic | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', image_url: '', is_active: true });

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('chat_topics')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error) setTopics(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', image_url: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(t: ChatTopic) {
    setEditing(t);
    setForm({ name: t.name, description: t.description ?? '', image_url: t.image_url ?? '', is_active: t.is_active });
    setDialogOpen(true);
  }

  async function deleteOldImage(url: string) {
    if (!url) return;
    try {
      const path = url.split('/chat-topic-images/').pop();
      if (path) await supabase.storage.from('chat-topic-images').remove([path]);
    } catch {}
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อหัวข้อ', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await (supabase as any).from('chat_topics').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหัวข้อแล้ว' });
      } else {
        const { error } = await (supabase as any).from('chat_topics').insert({ ...payload, sort_order: topics.length });
        if (error) throw error;
        toast({ title: 'เพิ่มหัวข้อแล้ว' });
      }
      setDialogOpen(false);
      fetchTopics();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: ChatTopic) {
    if (!confirm('ลบหัวข้อนี้?')) return;
    await deleteOldImage(t.image_url ?? '');
    const { error } = await (supabase as any).from('chat_topics').delete().eq('id', t.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'ลบหัวข้อแล้ว' });
    fetchTopics();
  }

  async function toggleActive(t: ChatTopic) {
    await (supabase as any).from('chat_topics').update({ is_active: !t.is_active }).eq('id', t.id);
    setTopics(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">จัดการหมวดหมู่การสนทนาที่ผู้ใช้เลือกก่อนเข้าห้องแชท</p>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> เพิ่มหัวข้อ
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีหัวข้อ</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รูปภาพ</TableHead>
              <TableHead>ชื่อหัวข้อ</TableHead>
              <TableHead>คำอธิบาย</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl">☕</div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {t.description ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleActive(t)}>
                    {t.is_active ? 'เปิด' : 'ปิด'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขหัวข้อ' : 'เพิ่มหัวข้อใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>รูปภาพหัวข้อ</Label>
              <ImageUploadField
                currentUrl={form.image_url}
                onUploaded={url => setForm(f => ({ ...f, image_url: url }))}
                onRemove={() => setForm(f => ({ ...f, image_url: '' }))}
                bucket="chat-topic-images"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ชื่อหัวข้อ *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น Latte, Matcha" />
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="บรรยากาศของหัวข้อนี้" />
            </div>
            <div className="flex items-center justify-between">
              <Label>เปิดใช้งาน</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Word List Tab (shared for prefixes & menus) ──────────────────────────────
function WordListTab({ table, label, placeholder }: { table: 'chat_name_prefixes' | 'chat_name_menus'; label: string; placeholder: string }) {
  const { toast } = useToast();
  const [words, setWords] = useState<NameWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [adding, setAdding] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table as any).select('*').order('word');
    if (!error) setWords(data ?? []);
    setLoading(false);
  }, [table]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleAdd() {
    const w = newWord.trim();
    if (!w) return;
    setAdding(true);
    const { error } = await supabase.from(table as any).insert({ word: w });
    if (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message.includes('unique') ? 'คำนี้มีอยู่แล้ว' : error.message, variant: 'destructive' });
    } else {
      toast({ title: `เพิ่ม ${label} แล้ว` });
      setNewWord('');
      fetch();
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' }); return; }
    setWords(prev => prev.filter(w => w.id !== id));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {table === 'chat_name_prefixes'
          ? 'คำนำหน้าชื่อสมมติ เช่น "นุ่มนิ่ม", "หอมกรุ่น"'
          : 'ชื่อเมนูที่ใช้ต่อท้าย เช่น "ลาเต้", "ครัวซองต์"'}
      </p>

      {/* Add new word */}
      <div className="flex gap-2">
        <Input
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={placeholder}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} disabled={adding || !newWord.trim()} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> เพิ่ม
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {words.map(w => (
            <div key={w.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
              <span>{w.word}</span>
              <button onClick={() => handleDelete(w.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                ×
              </button>
            </div>
          ))}
          {words.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีคำ</p>}
        </div>
      )}
    </div>
  );
}

// ─── Profiles Tab ─────────────────────────────────────────────────────────────
function ProfilesTab() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChatProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', image_url: '', is_active: true });

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('chat_profiles').select('*').order('sort_order');
    setProfiles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', image_url: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(p: ChatProfile) {
    setEditing(p);
    setForm({ name: p.name, image_url: p.image_url, is_active: p.is_active });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.image_url) {
      toast({ title: 'กรุณากรอกชื่อและอัปโหลดรูป', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), image_url: form.image_url, is_active: form.is_active };
      if (editing) {
        const { error } = await (supabase as any).from('chat_profiles').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตโปรไฟล์แล้ว' });
      } else {
        const { error } = await (supabase as any).from('chat_profiles').insert({ ...payload, sort_order: profiles.length });
        if (error) throw error;
        toast({ title: 'เพิ่มโปรไฟล์แล้ว' });
      }
      setDialogOpen(false);
      fetchProfiles();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ChatProfile) {
    if (!confirm('ลบโปรไฟล์นี้?')) return;
    try {
      const path = p.image_url.split('/chat-profile-images/').pop();
      if (path) await supabase.storage.from('chat-profile-images').remove([path]);
    } catch {}
    const { error } = await (supabase as any).from('chat_profiles').delete().eq('id', p.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' }); return; }
    toast({ title: 'ลบโปรไฟล์แล้ว' });
    fetchProfiles();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">โปรไฟล์สมมติที่ผู้ใช้เลือกได้ในห้องแชท</p>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> เพิ่มโปรไฟล์
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {profiles.map(p => (
            <div key={p.id} className={`relative rounded-2xl border p-3 flex flex-col items-center gap-2 ${p.is_active ? 'border-border' : 'border-border/40 opacity-50'}`}>
              <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-full object-cover" />
              <p className="text-sm font-medium text-center">{p.name}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">ยังไม่มีโปรไฟล์</p>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขโปรไฟล์' : 'เพิ่มโปรไฟล์ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>รูปโปรไฟล์ *</Label>
              <ImageUploadField
                currentUrl={form.image_url}
                onUploaded={url => setForm(f => ({ ...f, image_url: url }))}
                onRemove={() => setForm(f => ({ ...f, image_url: '' }))}
                bucket="chat-profile-images"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ชื่อโปรไฟล์ *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น หมีน้อย, แมวขาว" />
            </div>
            <div className="flex items-center justify-between">
              <Label>เปิดใช้งาน</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Monitor Tab ──────────────────────────────────────────────────────────────
function MonitorTab() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViolations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('chat_violations')
      .select('*, profile:profiles(username, discord_id, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(100);
    setViolations((data ?? []) as Violation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchViolations();
    // Realtime subscription
    const ch = supabase
      .channel('violations-monitor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_violations' }, () => {
        fetchViolations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchViolations]);

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">แชทที่มีการใช้คำต้องห้าม — อัปเดตแบบ Realtime</p>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : violations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">ยังไม่มีการละเมิด</p>
        </div>
      ) : (
        <div className="space-y-2">
          {violations.map(v => (
            <div
              key={v.id}
              className="rounded-xl border-2 border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 flex gap-3 items-start"
            >
              {/* Avatar */}
              <div className="shrink-0">
                {v.profile?.avatar_url ? (
                  <img src={v.profile.avatar_url} className="w-9 h-9 rounded-full" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-200 dark:bg-red-900 flex items-center justify-center">
                    <User className="w-4 h-4 text-red-600" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="w-3 h-3" /> สุ่มเสี่ยง
                  </Badge>
                  <span className="font-semibold text-sm text-red-700 dark:text-red-400">
                    {v.profile?.username ?? v.user_id.slice(0, 8)}
                  </span>
                  {v.profile?.discord_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {v.profile.discord_id}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{formatTime(v.created_at)}</span>
                </div>

                {/* Offending word */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">คำต้องห้าม:</span>
                  <code className="text-xs bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded font-mono">
                    {v.word}
                  </code>
                </div>

                {/* Full message */}
                <p className="text-sm text-foreground/80 bg-white dark:bg-black/20 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900/40 break-words">
                  "{v.message}"
                </p>

                {/* Session ID */}
                <p className="text-[10px] text-muted-foreground font-mono">
                  Session: {v.session_id.slice(0, 16)}...
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Similar Mood Tab ─────────────────────────────────────────────────────────
const CONFIG_KEY = 'similar_mood';

interface SimilarMoodConfig {
  enabled: boolean;
  similar_phase_delay_seconds: number;
  map: Record<string, string[]>;
}

const DEFAULT_CONFIG: SimilarMoodConfig = {
  enabled: true,
  similar_phase_delay_seconds: 15,
  map: {},
};

function SimilarMoodTab() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [config, setConfig] = useState<SimilarMoodConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For adding a new mapping row
  const [fromTopic, setFromTopic] = useState('');
  const [toTopics, setToTopics] = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [topicsRes, configRes] = await Promise.all([
      (supabase as any).from('chat_topics').select('id, name').eq('is_active', true).order('sort_order'),
      (supabase as any).from('chat_config').select('value').eq('key', CONFIG_KEY).maybeSingle(),
    ]);
    setTopics(topicsRes.data ?? []);
    if (configRes.data?.value) {
      setConfig({ ...DEFAULT_CONFIG, ...configRes.data.value });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Normalize: ensure bidirectional entries
  function normalizeBidirectional(map: Record<string, string[]>): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [a, bList] of Object.entries(map)) {
      if (!result[a]) result[a] = [];
      for (const b of bList) {
        if (!result[a].includes(b)) result[a].push(b);
        if (!result[b]) result[b] = [];
        if (!result[b].includes(a)) result[b].push(a);
      }
    }
    // Remove empty entries
    return Object.fromEntries(Object.entries(result).filter(([, v]) => v.length > 0));
  }

  async function saveConfig(updated: SimilarMoodConfig) {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('chat_config')
        .upsert({ key: CONFIG_KEY, value: updated, updated_at: new Date().toISOString() });
      if (error) throw error;
      setConfig(updated);
      toast({ title: 'บันทึกการตั้งค่าแล้ว' });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function addMapping() {
    if (!fromTopic || toTopics.length === 0) return;
    // Validate: no self-mapping
    if (toTopics.includes(fromTopic)) {
      toast({ title: 'ไม่สามารถเลือก mood เดียวกันได้', variant: 'destructive' });
      return;
    }
    const newMap = { ...config.map };
    newMap[fromTopic] = [...new Set([...(newMap[fromTopic] ?? []), ...toTopics])];
    const normalized = normalizeBidirectional(newMap);
    saveConfig({ ...config, map: normalized });
    setFromTopic('');
    setToTopics([]);
  }

  function removeMapping(fromId: string, toId: string) {
    const newMap = { ...config.map };
    newMap[fromId] = (newMap[fromId] ?? []).filter(id => id !== toId);
    if (newMap[fromId].length === 0) delete newMap[fromId];
    // Also remove reverse
    if (newMap[toId]) {
      newMap[toId] = newMap[toId].filter(id => id !== fromId);
      if (newMap[toId].length === 0) delete newMap[toId];
    }
    saveConfig({ ...config, map: newMap });
  }

  function resetToDefault() {
    if (!confirm('รีเซ็ต mapping ทั้งหมด?')) return;
    saveConfig({ ...config, map: {} });
  }

  function getTopicName(id: string) {
    return topics.find(t => t.id === id)?.name ?? id.slice(0, 8);
  }

  // Deduplicate display: only show A→B, not B→A again
  const displayPairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const [a, bList] of Object.entries(config.map)) {
    for (const b of bList) {
      const key = [a, b].sort().join('|');
      if (!seen.has(key)) { seen.add(key); displayPairs.push([a, b]); }
    }
  }

  const availableToTopics = topics.filter(t => t.id !== fromTopic);

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Similar Mood Matching</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            กำหนด mood ที่ใกล้เคียงกัน ระบบจะจับคู่ข้ามหัวข้อได้หลังรอ {config.similar_phase_delay_seconds} วินาที
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">เปิดใช้งาน</Label>
            <Switch
              checked={config.enabled}
              onCheckedChange={v => saveConfig({ ...config, enabled: v })}
            />
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-1.5 text-destructive hover:text-destructive">
            <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ต
          </Button>
        </div>
      </div>

      {/* Delay setting */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
        <Label className="text-sm shrink-0">รอก่อนจับคู่ข้าม mood (วินาที)</Label>
        <Input
          type="number"
          min={5}
          max={120}
          value={config.similar_phase_delay_seconds}
          onChange={e => setConfig(c => ({ ...c, similar_phase_delay_seconds: Number(e.target.value) }))}
          onBlur={() => saveConfig(config)}
          className="w-24"
        />
      </div>

      {/* Add mapping */}
      <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
        <p className="text-sm font-medium">เพิ่ม Mapping ใหม่</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">จาก Mood</Label>
            <Select value={fromTopic} onValueChange={setFromTopic}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="เลือก mood..." />
              </SelectTrigger>
              <SelectContent>
                {topics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">ใกล้เคียงกับ (เลือกได้หลาย)</Label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border min-h-[38px] bg-background">
              {availableToTopics.map(t => (
                <button
                  key={t.id}
                  onClick={() => setToTopics(prev =>
                    prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                  )}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    toTopics.includes(t.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {t.name}
                </button>
              ))}
              {availableToTopics.length === 0 && (
                <span className="text-xs text-muted-foreground">เลือก "จาก Mood" ก่อน</span>
              )}
            </div>
          </div>

          <Button
            onClick={addMapping}
            disabled={!fromTopic || toTopics.length === 0 || saving}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" /> เพิ่ม
          </Button>
        </div>
      </div>

      {/* Current mappings */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Mapping ปัจจุบัน</p>
        {displayPairs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            ยังไม่มี mapping — ระบบจะจับคู่เฉพาะ mood เดียวกัน
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayPairs.map(([a, b]) => (
              <div key={`${a}|${b}`} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-medium">{getTopicName(a)}</Badge>
                  <span className="text-muted-foreground text-xs">↔</span>
                  <Badge variant="outline" className="font-medium">{getTopicName(b)}</Badge>
                  <span className="text-[10px] text-muted-foreground">(bidirectional)</span>
                </div>
                <button
                  onClick={() => removeMapping(a, b)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config preview */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          ดู JSON config
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-muted text-[11px] overflow-auto max-h-48">
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────
interface ChatRole {
  id: string;
  key: string;
  label: string;
  sub: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const ROLE_KEY_OPTIONS = [
  { value: 'talk',   label: 'Talk' },
  { value: 'listen', label: 'Listen' },
  { value: 'both',   label: 'Both' },
  { value: 'chill',  label: 'Chill' },
];

function RolesTab() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<ChatRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChatRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', sub: '', image_url: '', is_active: true });

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('chat_roles')
      .select('*')
      .order('sort_order');
    setRoles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  function openEdit(r: ChatRole) {
    setEditing(r);
    setForm({ label: r.label, sub: r.sub, image_url: r.image_url ?? '', is_active: r.is_active });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim() || !form.sub.trim()) {
      toast({ title: 'กรุณากรอกชื่อและคำอธิบาย', variant: 'destructive' });
      return;
    }
    if (!editing) return;
    setSaving(true);
    try {
      // Delete old image from storage if replaced
      if (editing.image_url && editing.image_url !== form.image_url) {
        try {
          const oldPath = editing.image_url.split('/chat-role-images/').pop();
          if (oldPath) await supabase.storage.from('chat-role-images').remove([oldPath]);
        } catch {}
      }

      const { error } = await (supabase as any)
        .from('chat_roles')
        .update({
          label: form.label.trim(),
          sub: form.sub.trim(),
          image_url: form.image_url || null,
          is_active: form.is_active,
        })
        .eq('id', editing.id);
      if (error) throw error;
      toast({ title: 'อัปเดต Role แล้ว' });
      setDialogOpen(false);
      fetchRoles();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: ChatRole) {
    await (supabase as any).from('chat_roles').update({ is_active: !r.is_active }).eq('id', r.id);
    setRoles(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
  }

  const ROLE_ICONS: Record<string, string> = { talk: '💬', listen: '👂', both: '🤝', chill: '☕' };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        จัดการบทบาทที่ผู้ใช้เลือกก่อนเข้าห้องแชท (แก้ไขได้ ลบไม่ได้เพราะผูกกับ logic การจับคู่)
      </p>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roles.map(r => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 flex gap-3 items-start transition-opacity ${
                r.is_active ? 'border-border' : 'border-border/40 opacity-60'
              }`}
            >
              {/* Image or icon */}
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted flex items-center justify-center text-2xl">
                {r.image_url
                  ? <img src={r.image_url} alt={r.label} className="w-full h-full object-cover" />
                  : ROLE_ICONS[r.key] ?? '💬'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{r.label}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{r.key}</Badge>
                  <Badge
                    variant={r.is_active ? 'default' : 'secondary'}
                    className="text-[10px] cursor-pointer ml-auto"
                    onClick={() => toggleActive(r)}
                  >
                    {r.is_active ? 'เปิด' : 'ปิด'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.sub}</p>
              </div>

              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => openEdit(r)}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              แก้ไข Role: {editing && (ROLE_ICONS[editing.key] ?? '')} {editing?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>ชื่อที่แสดง *</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="เช่น Talk, Listen"
              />
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย *</Label>
              <Input
                value={form.sub}
                onChange={e => setForm(f => ({ ...f, sub: e.target.value }))}
                placeholder="เช่น อยากเล่า ระบาย หรือแชร์เรื่องราว"
              />
            </div>
            <div className="space-y-1.5">
              <Label>รูปภาพ</Label>
              <ImageUploadField
                currentUrl={form.image_url}
                onUploaded={url => setForm(f => ({ ...f, image_url: url }))}
                onRemove={() => setForm(f => ({ ...f, image_url: '' }))}
                bucket="chat-role-images"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>เปิดใช้งาน</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function SecretTableManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="w-5 h-5" />
          จัดการ Secret Table
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="topics">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="topics" className="gap-2">
              <Tag className="w-4 h-4" /> หมวดหมู่
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-2">
              <User className="w-4 h-4" /> โปรไฟล์
            </TabsTrigger>
            <TabsTrigger value="prefixes" className="gap-2">
              <Type className="w-4 h-4" /> คำนำหน้า
            </TabsTrigger>
            <TabsTrigger value="menus" className="gap-2">
              <Coffee className="w-4 h-4" /> ชื่อเมนู
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-2 data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950 dark:data-[state=active]:text-red-400">
              <ShieldAlert className="w-4 h-4" /> สังเกตการณ์
            </TabsTrigger>
            <TabsTrigger value="similar-mood" className="gap-2">
              <GitMerge className="w-4 h-4" /> Similar Mood
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <User className="w-4 h-4" /> บทบาท
            </TabsTrigger>
            <TabsTrigger value="music" className="gap-2">
              <Coffee className="w-4 h-4" /> เพลง BGM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topics"><TopicsTab /></TabsContent>
          <TabsContent value="profiles"><ProfilesTab /></TabsContent>
          <TabsContent value="prefixes">
            <WordListTab table="chat_name_prefixes" label="คำนำหน้า" placeholder="เช่น นุ่มนิ่ม" />
          </TabsContent>
          <TabsContent value="menus">
            <WordListTab table="chat_name_menus" label="ชื่อเมนู" placeholder="เช่น ลาเต้" />
          </TabsContent>
          <TabsContent value="monitor"><MonitorTab /></TabsContent>
          <TabsContent value="similar-mood"><SimilarMoodTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
          <TabsContent value="music"><ChatMusicManagement /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
