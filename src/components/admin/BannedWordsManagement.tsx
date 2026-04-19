import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Trash2, Ban, Globe, Pencil } from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkDeleteToolbar } from '@/components/admin/BulkDeleteToolbar';

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
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const filteredWords = bannedWords.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWordId = useCallback((word: BannedWord) => word.id, []);
  const {
    selectedCount,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleItem,
    toggleAll,
    clearSelection,
  } = useBulkSelection({ items: filteredWords, getItemId: getWordId });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch banned words
      const { data: wordsData, error: wordsError } = await supabase
        .from('banned_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (wordsError) throw wordsError;
      setBannedWords(wordsData || []);

      // Fetch categories
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
      toast({
        title: 'กรุณากรอกคำต้องห้าม',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Split by comma and clean up each word, remove duplicates
      const words = [...new Set(
        newWords
          .split(',')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length > 0)
      )];

      if (words.length === 0) {
        toast({
          title: 'กรุณากรอกคำต้องห้าม',
          variant: 'destructive',
        });
        return;
      }

      // Insert words one by one to handle duplicates gracefully
      let addedCount = 0;
      let skippedCount = 0;

      for (const word of words) {
        const { error } = await supabase.from('banned_words').insert({
          word,
          category_id: selectedCategoryId === 'global' ? null : selectedCategoryId,
        });

        if (error) {
          // Check if it's a duplicate key error
          if (error.code === '23505' || error.message.includes('duplicate')) {
            skippedCount++;
          } else {
            console.error('Error adding word:', word, error);
            skippedCount++;
          }
        } else {
          addedCount++;
        }
      }

      if (addedCount === 0) {
        toast({
          title: 'คำเหล่านี้มีอยู่แล้ว',
          description: 'ทุกคำที่กรอกมีอยู่ในระบบแล้ว',
          variant: 'destructive',
        });
        return;
      }

      let description = `เพิ่ม ${addedCount} คำเรียบร้อยแล้ว`;
      if (skippedCount > 0) {
        description += ` (ข้าม ${skippedCount} คำที่ซ้ำ)`;
      }

      toast({
        title: 'เพิ่มคำต้องห้ามแล้ว',
        description,
      });

      setNewWords('');
      setSelectedCategoryId('global');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error adding words:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเพิ่มคำต้องห้ามได้',
        variant: 'destructive',
      });
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
      toast({
        title: 'กรุณากรอกคำต้องห้าม',
        variant: 'destructive',
      });
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

      toast({
        title: 'แก้ไขคำต้องห้ามแล้ว',
        description: `"${editWordValue}" ถูกแก้ไขเรียบร้อยแล้ว`,
      });

      setEditingWord(null);
      setEditWordValue('');
      setEditCategoryId('global');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error editing word:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถแก้ไขคำต้องห้ามได้',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteWord(wordId: string, word: string) {
    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .eq('id', wordId);

      if (error) throw error;

      setBannedWords(bannedWords.filter((w) => w.id !== wordId));

      toast({
        title: 'ลบคำต้องห้ามแล้ว',
        description: `"${word}" ถูกลบเรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Error deleting word:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId);
  };

  async function handleBulkDelete() {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = selectedItems.map((item) => item.id);
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setBannedWords(bannedWords.filter((w) => !idsToDelete.includes(w.id)));
      clearSelection();
      setBulkDeleteDialogOpen(false);

      toast({
        title: 'ลบคำต้องห้ามแล้ว',
        description: `ลบ ${idsToDelete.length} คำเรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Error bulk deleting words:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบคำต้องห้ามได้',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5" />
            จัดการคำต้องห้าม
          </CardTitle>
          <div className="flex items-center gap-3">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาคำ..." className="w-64" />
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              เพิ่มคำต้องห้าม
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BulkDeleteToolbar
          selectedCount={selectedCount}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onClear={clearSelection}
          isDeleting={isDeleting}
          itemLabel="คำ"
        />
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredWords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'ไม่พบคำที่ค้นหา' : 'ยังไม่มีคำต้องห้าม'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleAll}
                    aria-label="เลือกทั้งหมด"
                    className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    {...(isSomeSelected ? { 'data-state': 'checked' } : {})}
                  />
                </TableHead>
                <TableHead>คำต้องห้าม</TableHead>
                <TableHead>ขอบเขต</TableHead>
                <TableHead>วันที่เพิ่ม</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWords.map((word) => {
                const category = getCategoryName(word.category_id);
                return (
                  <TableRow key={word.id} className={isSelected(word.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected(word.id)}
                        onCheckedChange={() => toggleItem(word.id)}
                        aria-label={`เลือก ${word.word}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="font-mono">
                        {word.word}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {category ? (
                        <div className="flex items-center gap-2">
                          <IconDisplay icon={category.icon} fallback="📁" size="sm" />
                          <span>{category.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe className="w-4 h-4" />
                          <span>ทุกหมวดหมู่</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(word.created_at).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(word)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteWord(word.id, word.word)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddWords}>เพิ่มคำต้องห้าม</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Word Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขคำต้องห้าม</DialogTitle>
            <DialogDescription>
              แก้ไขคำหรือเปลี่ยนขอบเขตการใช้งาน
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleEditWord}>บันทึกการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบคำต้องห้าม {selectedCount} คำหรือไม่?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'กำลังลบ...' : `ลบ ${selectedCount} คำ`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
