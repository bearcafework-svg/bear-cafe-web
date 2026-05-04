import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Ban, Globe, Pencil, X } from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';

interface BannedWord {
  id: string;
  word: string;
  category_id: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface WordGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  words: BannedWord[];
}

export function BannedWordsManagement() {
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newWords, setNewWords] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('global');
  const [editingWord, setEditingWord] = useState<BannedWord | null>(null);
  const [editWordValue, setEditWordValue] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string>('global');
  const [deleteTarget, setDeleteTarget] = useState<BannedWord | null>(null);
  const { toast } = useToast();

  const filteredWords = bannedWords.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group words by category
  const wordGroups: WordGroup[] = React.useMemo(() => {
    const globalWords = filteredWords.filter((w) => !w.category_id);
    const groups: WordGroup[] = [];

    if (globalWords.length > 0) {
      groups.push({
        key: 'global',
        label: 'ทุกหมวดหมู่',
        icon: <Globe className="w-3.5 h-3.5" />,
        words: globalWords,
      });
    }

    categories.forEach((cat) => {
      const catWords = filteredWords.filter((w) => w.category_id === cat.id);
      if (catWords.length > 0) {
        groups.push({
          key: cat.id,
          label: cat.name,
          icon: <IconDisplay icon={cat.icon} fallback="📁" size="sm" />,
          words: catWords,
        });
      }
    });

    return groups;
  }, [filteredWords, categories]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: wordsData, error: wordsError } = await supabase
        .from('banned_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (wordsError) throw wordsError;
      setBannedWords(wordsData || []);

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddWords() {
    if (!newWords.trim()) {
      toast({ title: 'กรุณากรอกคำต้องห้าม', variant: 'destructive' });
      return;
    }

    try {
      const words = [...new Set(
        newWords.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
      )];

      if (words.length === 0) {
        toast({ title: 'กรุณากรอกคำต้องห้าม', variant: 'destructive' });
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const word of words) {
        const { error } = await supabase.from('banned_words').insert({
          word,
          category_id: selectedCategoryId === 'global' ? null : selectedCategoryId,
        });
        if (error) { skippedCount++; } else { addedCount++; }
      }

      if (addedCount === 0) {
        toast({ title: 'คำเหล่านี้มีอยู่แล้ว', description: 'ทุกคำที่กรอกมีอยู่ในระบบแล้ว', variant: 'destructive' });
        return;
      }

      toast({
        title: 'เพิ่มคำต้องห้ามแล้ว',
        description: `เพิ่ม ${addedCount} คำ${skippedCount > 0 ? ` (ข้าม ${skippedCount} คำที่ซ้ำ)` : ''}`,
      });

      setNewWords('');
      setSelectedCategoryId('global');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเพิ่มคำต้องห้ามได้', variant: 'destructive' });
    }
  }

  function openEditDialog(word: BannedWord) {
    setEditingWord(word);
    setEditWordValue(word.word);
    setEditCategoryId(word.category_id || 'global');
    setEditDialogOpen(true);
  }

  async function handleEditWord() {
    if (!editingWord || !editWordValue.trim()) {
      toast({ title: 'กรุณากรอกคำต้องห้าม', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('banned_words')
        .update({
          word: editWordValue.trim().toLowerCase(),
          category_id: editCategoryId === 'global' ? null : editCategoryId,
        })
        .eq('id', editingWord.id);

      if (error) throw error;

      toast({ title: 'แก้ไขคำต้องห้ามแล้ว', description: `"${editWordValue}" ถูกแก้ไขเรียบร้อยแล้ว` });
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถแก้ไขคำต้องห้ามได้', variant: 'destructive' });
    }
  }

  async function handleDeleteWord() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('banned_words').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setBannedWords(bannedWords.filter((w) => w.id !== deleteTarget.id));
      toast({ title: 'ลบคำต้องห้ามแล้ว', description: `"${deleteTarget.word}" ถูกลบเรียบร้อยแล้ว` });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId);
  };

  return (
    <Card className="admin-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Ban className="w-4 h-4" />
            จัดการคำต้องห้าม
            {!loading && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({bannedWords.length} คำ)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาคำ..." className="w-48 sm:w-56" />
            <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              เพิ่มคำ
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredWords.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {searchQuery ? 'ไม่พบคำที่ค้นหา' : 'ยังไม่มีคำต้องห้าม'}
          </div>
        ) : (
          <div className="space-y-5">
            {wordGroups.map((group) => (
              <div key={group.key}>
                {/* Group header */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-muted-foreground">{group.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground/60 ml-0.5">
                    ({group.words.length})
                  </span>
                </div>

                {/* Word chips */}
                <div className="flex flex-wrap gap-1.5">
                  {group.words.map((word) => (
                    <div
                      key={word.id}
                      className="group/chip inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-colors"
                    >
                      <span className="text-xs font-mono text-destructive leading-none">
                        {word.word}
                      </span>
                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5">
                        <button
                          onClick={() => openEditDialog(word)}
                          className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(word)}
                          className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="ลบ"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Words Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มคำต้องห้าม</DialogTitle>
            <DialogDescription>
              คำต้องห้ามจะถูกตรวจสอบในช่อง "หมายเหตุ" เมื่อสร้างแมตช์
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>คำต้องห้าม</Label>
              <Textarea
                placeholder="กรอกคำที่ต้องการห้าม (แยกด้วยจุลภาค)&#10;ตัวอย่าง: คำที่ 1, คำที่ 2, คำที่ 3"
                value={newWords}
                onChange={(e) => setNewWords(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                💡 เพิ่มหลายคำพร้อมกันได้โดยคั่นด้วยจุลภาค (,)
              </p>
            </div>
            <div className="space-y-2">
              <Label>ขอบเขต</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกขอบเขต" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>ทุกหมวดหมู่ (Global)</span>
                    </div>
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <IconDisplay icon={cat.icon} fallback="📁" size="sm" />
                        <span>{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                เลือก "ทุกหมวดหมู่" เพื่อห้ามในทุกหมวดหมู่ หรือเลือกหมวดหมู่เฉพาะ
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleAddWords}>เพิ่มคำต้องห้าม</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Word Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขคำต้องห้าม</DialogTitle>
            <DialogDescription>แก้ไขคำหรือเปลี่ยนขอบเขตการใช้งาน</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>คำต้องห้าม</Label>
              <Input
                placeholder="กรอกคำที่ต้องการห้าม..."
                value={editWordValue}
                onChange={(e) => setEditWordValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ขอบเขต</Label>
              <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกขอบเขต" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>ทุกหมวดหมู่ (Global)</span>
                    </div>
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <IconDisplay icon={cat.icon} fallback="📁" size="sm" />
                        <span>{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditWord}>บันทึกการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              ลบคำต้องห้าม{' '}
              <span className="font-mono font-semibold text-destructive">"{deleteTarget?.word}"</span>{' '}
              ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWord}
              className="bg-destructive hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
