import React, { useState, useEffect, useCallback } from 'react';
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
import { Plus, Trash2, Edit, Coffee, Tag, Type } from 'lucide-react';

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

interface NameWord {
  id: string;
  word: string;
  created_at: string;
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

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_topics')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error) setTopics(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
        image_url: form.image_url.trim() || null,
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
      fetch();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบหัวข้อนี้?')) return;
    const { error } = await supabase.from('chat_topics').delete().eq('id', id);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'ลบหัวข้อแล้ว' });
    fetch();
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
              <TableHead>ชื่อหัวข้อ</TableHead>
              <TableHead>คำอธิบาย</TableHead>
              <TableHead>รูปภาพ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {t.description ?? '-'}
                </TableCell>
                <TableCell>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
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
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-destructive hover:text-destructive">
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
              <Label>ชื่อหัวข้อ *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น Latte, Matcha" />
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="บรรยากาศของหัวข้อนี้" />
            </div>
            <div className="space-y-1.5">
              <Label>URL รูปภาพ</Label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
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
          <TabsList className="mb-4">
            <TabsTrigger value="topics" className="gap-2">
              <Tag className="w-4 h-4" /> หัวข้อ (Topics)
            </TabsTrigger>
            <TabsTrigger value="prefixes" className="gap-2">
              <Type className="w-4 h-4" /> คำนำหน้า
            </TabsTrigger>
            <TabsTrigger value="menus" className="gap-2">
              <Coffee className="w-4 h-4" /> ชื่อเมนู
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topics">
            <TopicsTab />
          </TabsContent>
          <TabsContent value="prefixes">
            <WordListTab table="chat_name_prefixes" label="คำนำหน้า" placeholder="เช่น นุ่มนิ่ม" />
          </TabsContent>
          <TabsContent value="menus">
            <WordListTab table="chat_name_menus" label="ชื่อเมนู" placeholder="เช่น ลาเต้" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
