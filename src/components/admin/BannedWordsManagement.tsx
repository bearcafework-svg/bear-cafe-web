import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Ban, Pencil, X } from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';

interface BannedWord {
  id: string;
  word: string;
  created_at: string;
  created_by: string | null;
  profiles?: {
    username: string;
  } | null;
}

export function BannedWordsManagement() {
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newWords, setNewWords] = useState('');
  const [editingWord, setEditingWord] = useState<BannedWord | null>(null);
  const [editWordValue, setEditWordValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BannedWord | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const filteredWords = bannedWords.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: wordsData, error: wordsError } = await supabase
        .from('banned_name')
        .select(`
          id,
          word,
          created_at,
          created_by,
          profiles:created_by (username)
        `)
        .order('created_at', { ascending: false });

      if (wordsError) throw wordsError;
      setBannedWords((wordsData as any) || []);
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
      toast({ title: 'กรุณากรอกชื่อต้องห้าม', variant: 'destructive' });
      return;
    }

    try {
      const words = [...new Set(
        newWords.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
      )];

      if (words.length === 0) {
        toast({ title: 'กรุณากรอกชื่อต้องห้าม', variant: 'destructive' });
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const word of words) {
        const { error } = await supabase.from('banned_name').insert({
          word,
          created_by: user?.id,
        });
        if (error) { skippedCount++; } else { addedCount++; }
      }

      if (addedCount === 0) {
        toast({ title: 'ชื่อเหล่านี้มีอยู่แล้ว', description: 'ทุกชื่อที่กรอกมีอยู่ในระบบแล้ว', variant: 'destructive' });
        return;
      }

      toast({
        title: 'เพิ่มชื่อต้องห้ามแล้ว',
        description: `เพิ่ม ${addedCount} ชื่อ${skippedCount > 0 ? ` (ข้าม ${skippedCount} ชื่อที่ซ้ำ)` : ''}`,
      });

      setNewWords('');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเพิ่มชื่อต้องห้ามได้', variant: 'destructive' });
    }
  }

  function openEditDialog(word: BannedWord) {
    setEditingWord(word);
    setEditWordValue(word.word);
    setEditDialogOpen(true);
  }

  async function handleEditWord() {
    if (!editingWord || !editWordValue.trim()) {
      toast({ title: 'กรุณากรอกชื่อต้องห้าม', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('banned_name')
        .update({
          word: editWordValue.trim().toLowerCase(),
        })
        .eq('id', editingWord.id);

      if (error) throw error;

      toast({ title: 'แก้ไขชื่อต้องห้ามแล้ว', description: `"${editWordValue}" ถูกแก้ไขเรียบร้อยแล้ว` });
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถแก้ไขชื่อต้องห้ามได้', variant: 'destructive' });
    }
  }

  async function handleDeleteWord() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('banned_name').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setBannedWords(bannedWords.filter((w) => w.id !== deleteTarget.id));
      toast({ title: 'ลบชื่อต้องห้ามแล้ว', description: `"${deleteTarget.word}" ถูกลบเรียบร้อยแล้ว` });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  return (
    <Card className="admin-card border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.3)] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#8C6239] dark:text-[#EAD8C8]">
              <Ban className="w-5 h-5 text-destructive" />
              จัดการชื่อต้องห้าม
              {!loading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({bannedWords.length} ชื่อ)
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              รายชื่อคำหรือข้อความที่ไม่อนุญาตให้ใช้เป็นชื่อผู้ใช้บนหน้าต่างระบบ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาชื่อ..." className="w-48 sm:w-56" />
            <Button 
              onClick={() => setDialogOpen(true)} 
              size="sm" 
              className="gap-1.5 shrink-0 bg-[#FAC4CD] hover:bg-[#F8AAB6] text-[#6B323B] border border-[#E9B1BA]"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มชื่อต้องห้าม
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredWords.length === 0 ? (
          <div className="text-center py-12 text-[#8C6239]/60 dark:text-muted-foreground bg-[#FAF3EC] dark:bg-muted/10 rounded-xl border border-dashed border-[#EAD8C8] dark:border-muted/30">
            {searchQuery ? 'ไม่พบชื่อที่ค้นหา' : 'ยังไม่มีรายชื่อต้องห้ามในระบบ'}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2.5 p-4 rounded-xl bg-[#FAF6F0] dark:bg-muted/10 border border-[#F4EEE5] dark:border-muted/20">
              {filteredWords.map((word) => {
                const creator = word.profiles?.username || 'ระบบ';
                const createdDate = new Date(word.created_at).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit',
                });
                const tooltipText = `เพิ่มโดย: ${creator} เมื่อ: ${createdDate}`;

                return (
                  <div
                    key={word.id}
                    title={tooltipText}
                    className="group/chip inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#EAD8C8] dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.5)] shadow-xs hover:border-[#FAC4CD] hover:bg-[#FFF8F8] dark:hover:bg-destructive/10 dark:hover:border-destructive/30 transition-all cursor-help"
                  >
                    <span className="text-sm font-medium text-[#6B5A4B] dark:text-foreground">
                      {word.word}
                    </span>
                    
                    {/* Actions — visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/chip:opacity-100 transition-opacity ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(word);
                        }}
                        className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(word);
                        }}
                        className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="ลบ"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Add Words Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))]">
          <DialogHeader>
            <DialogTitle className="text-[#8C6239] dark:text-[#EAD8C8] font-bold">เพิ่มชื่อต้องห้าม</DialogTitle>
            <DialogDescription>
              ระบุชื่อที่ต้องการห้ามใช้ในระบบ สามารถเพิ่มหลายชื่อได้โดยคั่นด้วยเครื่องหมายจุลภาค (,)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="words-input" className="text-[#6B5A4B] dark:text-foreground">รายชื่อต้องห้าม</Label>
              <Input
                id="words-input"
                placeholder="ตัวอย่าง: แอดมิน, สตาฟ, admin, staff"
                value={newWords}
                onChange={(e) => setNewWords(e.target.value)}
                className="border-[#EAD8C8] bg-white focus-visible:ring-[#FAC4CD]"
              />
              <p className="text-[11px] text-[#8C6239]/80 dark:text-muted-foreground">
                💡 คำแนะนำ: คั่นแต่ละชื่อด้วยจุลภาค เช่น "แอดมิน, ผู้ดูแล"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#EAD8C8]">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleAddWords}
              className="bg-[#FAC4CD] hover:bg-[#F8AAB6] text-[#6B323B] border border-[#E9B1BA]"
            >
              เพิ่มรายชื่อ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Word Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))]">
          <DialogHeader>
            <DialogTitle className="text-[#8C6239] dark:text-[#EAD8C8] font-bold">แก้ไขชื่อต้องห้าม</DialogTitle>
            <DialogDescription>แก้ไขชื่อผู้ใช้ที่ไม่ผ่านการยินยอม</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-word-input" className="text-[#6B5A4B] dark:text-foreground">ชื่อต้องห้าม</Label>
              <Input
                id="edit-word-input"
                placeholder="กรอกชื่อต้องห้าม..."
                value={editWordValue}
                onChange={(e) => setEditWordValue(e.target.value)}
                className="border-[#EAD8C8] bg-white focus-visible:ring-[#FAC4CD]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-[#EAD8C8]">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleEditWord}
              className="bg-[#FAC4CD] hover:bg-[#F8AAB6] text-[#6B323B] border border-[#E9B1BA]"
            >
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#8C6239] dark:text-[#EAD8C8] font-bold">ยืนยันการลบชื่อต้องห้าม</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบชื่อต้องห้าม{' '}
              <span className="font-semibold text-destructive">"{deleteTarget?.word}"</span>{' '}
              ออกจากระบบใช่หรือไม่? เมื่อลบแล้วคำนี้จะไม่ถูกกรองในระบบอีกต่อไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#EAD8C8]">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWord}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
