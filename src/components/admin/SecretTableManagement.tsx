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
import { Plus, Trash2, Edit, Coffee, Tag, Type, Upload, X, AlertTriangle, User, ShieldAlert } from 'lucide-react';
import { compressImage } from '@/lib/image-compress';

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
    const { data, error } = await supabase
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
        const { error } = await supabase.from('chat_topics').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหัวข้อแล้ว' });
      } else {
        const { error } = await supabase.from('chat_topics').insert({ ...payload, sort_order: topics.length });
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
    const { error } = await supabase.from('chat_topics').delete().eq('id', t.id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'ลบหัวข้อแล้ว' });
    fetchTopics();
  }

  async function toggleActive(t: ChatTopic) {
    await supabase.from('chat_topics').update({ is_active: !t.is_active }).eq('id', t.id);
    setTopics(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">จัดการหัวข้อ/บรรยากาศที่ผู้ใช้เลือกก่อนเข้าห้องแชท</p>
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
    const { data } = await supabase.from('chat_profiles').select('*').order('sort_order');
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
        const { error } = await supabase.from('chat_profiles').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตโปรไฟล์แล้ว' });
      } else {
        const { error } = await supabase.from('chat_profiles').insert({ ...payload, sort_order: profiles.length });
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
    const { error } = await supabase.from('chat_profiles').delete().eq('id', p.id);
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
    const { data } = await supabase
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
              <Tag className="w-4 h-4" /> หัวข้อ
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
