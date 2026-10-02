import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Search,
  BookOpen,
  Smile,
  Sparkles,
  RefreshCw,
  Tag,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Coffee,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIKnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AIStickerTrigger {
  id: string;
  keyword: string;
  mode: 'llm_select' | 'instant';
  sticker_ids: string[];
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'ทุกหมวดหมู่' },
  { value: 'rules', label: '📜 กฎระเบียบ (Rules)' },
  { value: 'systems', label: '🎮 ระบบร้าน & เกม (Systems)' },
  { value: 'cafe', label: '☕ ร้านกาแฟ (Cafe)' },
  { value: 'points', label: '🎙️ แต้มห้องเสียง (Points)' },
  { value: 'faq', label: '💡 คำถามที่พบบ่อย (FAQ)' },
  { value: 'general', label: '📌 ทั่วไป (General)' },
];

export function AIAssistantManagement() {
  const { toast } = useToast();

  // ─── Knowledge State ───
  const [knowledgeList, setKnowledgeList] = useState<AIKnowledgeItem[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<AIKnowledgeItem | null>(null);
  const [formCategory, setFormCategory] = useState('systems');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  // ─── Sticker Triggers State ───
  const [triggersList, setTriggersList] = useState<AIStickerTrigger[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [triggerSearch, setTriggerSearch] = useState('');

  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<AIStickerTrigger | null>(null);
  const [formKeyword, setFormKeyword] = useState('');
  const [formMode, setFormMode] = useState<'llm_select' | 'instant'>('llm_select');
  const [formStickerIds, setFormStickerIds] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggerActive, setFormTriggerActive] = useState(true);
  const [savingTrigger, setSavingTrigger] = useState(false);

  // ─── Delete Dialog ───
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'knowledge' | 'trigger';
    id: string;
    name: string;
  } | null>(null);

  // ─── Fetch Data ───
  const fetchKnowledge = useCallback(async () => {
    setLoadingKnowledge(true);
    try {
      const { data, error } = await supabase
        .from('ai_knowledge' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledgeList((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching ai_knowledge:', err.message);
      toast({
        title: 'โหลดคลังความรู้ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingKnowledge(false);
    }
  }, [toast]);

  const fetchTriggers = useCallback(async () => {
    setLoadingTriggers(true);
    try {
      const { data, error } = await supabase
        .from('ai_sticker_triggers' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTriggersList((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching ai_sticker_triggers:', err.message);
      toast({
        title: 'โหลด Sticker Triggers ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingTriggers(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchKnowledge();
    fetchTriggers();
  }, [fetchKnowledge, fetchTriggers]);

  // ─── Knowledge CRUD ───
  const handleOpenAddKnowledge = () => {
    setEditingKnowledge(null);
    setFormCategory('systems');
    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setFormActive(true);
    setKnowledgeDialogOpen(true);
  };

  const handleOpenEditKnowledge = (item: AIKnowledgeItem) => {
    setEditingKnowledge(item);
    setFormCategory(item.category || 'systems');
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormTags(Array.isArray(item.tags) ? item.tags.join(', ') : '');
    setFormActive(item.is_active);
    setKnowledgeDialogOpen(true);
  };

  const handleSaveKnowledge = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'หัวข้อและเนื้อหาห้ามเว้นว่าง', variant: 'destructive' });
      return;
    }

    setSavingKnowledge(true);
    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      if (editingKnowledge) {
        const { error } = await supabase
          .from('ai_knowledge' as any)
          .update({
            category: formCategory,
            title: formTitle.trim(),
            content: formContent.trim(),
            tags: tagsArray,
            is_active: formActive,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingKnowledge.id);

        if (error) throw error;
        toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตข้อมูลความรู้เรียบร้อยแล้ว' });
      } else {
        const { error } = await supabase.from('ai_knowledge' as any).insert({
          category: formCategory,
          title: formTitle.trim(),
          content: formContent.trim(),
          tags: tagsArray,
          is_active: formActive,
        } as any);

        if (error) throw error;
        toast({ title: 'เพิ่มสำเร็จ', description: 'เพิ่มข้อมูลความรู้ใหม่เรียบร้อยแล้ว' });
      }

      setKnowledgeDialogOpen(false);
      fetchKnowledge();
    } catch (err: any) {
      toast({ title: 'บันทึกล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleToggleKnowledge = async (item: AIKnowledgeItem) => {
    try {
      const { error } = await supabase
        .from('ai_knowledge' as any)
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() } as any)
        .eq('id', item.id);

      if (error) throw error;
      setKnowledgeList((prev) =>
        prev.map((k) => (k.id === item.id ? { ...k, is_active: !k.is_active } : k))
      );
    } catch (err: any) {
      toast({ title: 'เปลี่ยนสถานะล้มเหลว', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Trigger CRUD ───
  const handleOpenAddTrigger = () => {
    setEditingTrigger(null);
    setFormKeyword('');
    setFormMode('llm_select');
    setFormStickerIds('');
    setFormDescription('');
    setFormTriggerActive(true);
    setTriggerDialogOpen(true);
  };

  const handleOpenEditTrigger = (item: AIStickerTrigger) => {
    setEditingTrigger(item);
    setFormKeyword(item.keyword);
    setFormMode(item.mode || 'llm_select');
    setFormStickerIds(Array.isArray(item.sticker_ids) ? item.sticker_ids.join(', ') : '');
    setFormDescription(item.description || '');
    setFormTriggerActive(item.is_active);
    setTriggerDialogOpen(true);
  };

  const handleSaveTrigger = async () => {
    if (!formKeyword.trim()) {
      toast({ title: 'กรุณาระบุ Keyword', description: 'คำกระตุ้น (Trigger Keyword) ห้ามเว้นว่าง', variant: 'destructive' });
      return;
    }

    setSavingTrigger(true);
    const stickerArray = formStickerIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingTrigger) {
        const { error } = await supabase
          .from('ai_sticker_triggers' as any)
          .update({
            keyword: formKeyword.trim().toLowerCase(),
            mode: formMode,
            sticker_ids: stickerArray,
            description: formDescription.trim(),
            is_active: formTriggerActive,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingTrigger.id);

        if (error) throw error;
        toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดต Sticker Trigger เรียบร้อยแล้ว' });
      } else {
        const { error } = await supabase.from('ai_sticker_triggers' as any).insert({
          keyword: formKeyword.trim().toLowerCase(),
          mode: formMode,
          sticker_ids: stickerArray,
          description: formDescription.trim(),
          is_active: formTriggerActive,
        } as any);

        if (error) throw error;
        toast({ title: 'เพิ่มสำเร็จ', description: 'เพิ่ม Sticker Trigger ใหม่เรียบร้อยแล้ว' });
      }

      setTriggerDialogOpen(false);
      fetchTriggers();
    } catch (err: any) {
      toast({ title: 'บันทึกล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setSavingTrigger(false);
    }
  };

  const handleToggleTrigger = async (item: AIStickerTrigger) => {
    try {
      const { error } = await supabase
        .from('ai_sticker_triggers' as any)
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() } as any)
        .eq('id', item.id);

      if (error) throw error;
      setTriggersList((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, is_active: !t.is_active } : t))
      );
    } catch (err: any) {
      toast({ title: 'เปลี่ยนสถานะล้มเหลว', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Delete Execution ───
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.type === 'knowledge' ? 'ai_knowledge' : 'ai_sticker_triggers';

    try {
      const { error } = await supabase.from(table as any).delete().eq('id', deleteTarget.id);
      if (error) throw error;

      toast({ title: 'ลบข้อมูลสำเร็จ', description: `ลบ ${deleteTarget.name} เรียบร้อยแล้ว` });
      if (deleteTarget.type === 'knowledge') {
        setKnowledgeList((prev) => prev.filter((k) => k.id !== deleteTarget.id));
      } else {
        setTriggersList((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      }
    } catch (err: any) {
      toast({ title: 'ลบล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ─── Filtered Data ───
  const filteredKnowledge = knowledgeList.filter((item) => {
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchQuery =
      knowledgeSearch === '' ||
      item.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
      item.content.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
      (Array.isArray(item.tags) && item.tags.some((t) => t.includes(knowledgeSearch.toLowerCase())));
    return matchCat && matchQuery;
  });

  const filteredTriggers = triggersList.filter((t) =>
    t.keyword.toLowerCase().includes(triggerSearch.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(triggerSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* ─── Top Info Banner ─── */}
      <Card className="border-[#EAD8C8] bg-gradient-to-r from-[#FAF6F0] via-white to-[#FDFBF7] dark:from-[#1E1B18] dark:to-[#171412] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  ระบบผู้ช่วย AI "พี่หมี" (Bear Cafe AI Assistant)
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-semibold">
                    v2 Single-Pass
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  จัดการคลังความรู้สำหรับตอบคำถาม (Knowledge Base) และคีย์เวิร์ดส่งสติกเกอร์ (Sticker Triggers)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-2xl text-xs text-amber-800 dark:text-amber-300">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                เมื่อแก้ไขเสร็จ ให้พิมพ์ <strong>/ai-reload</strong> ใน Discord เพื่ออัปเดตเข้าสมองบอททันที
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Tabs ─── */}
      <Tabs defaultValue="knowledge" className="space-y-4">
        <TabsList className="bg-[#FAF5EE] dark:bg-[#1E1B18] p-1 border border-[#EAD8C8] dark:border-[#2D2520] rounded-2xl">
          <TabsTrigger value="knowledge" className="rounded-xl gap-2 text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#2A2420]">
            <BookOpen className="w-4 h-4 text-primary" />
            คลังความรู้ ({knowledgeList.length})
          </TabsTrigger>
          <TabsTrigger value="triggers" className="rounded-xl gap-2 text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#2A2420]">
            <Smile className="w-4 h-4 text-amber-500" />
            คีย์เวิร์ดสติกเกอร์ ({triggersList.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════
            TAB 1: KNOWLEDGE BASE
            ═══════════════════════════════════════════════════ */}
        <TabsContent value="knowledge" className="space-y-4">
          <Card className="border-[#EAD8C8] bg-white dark:bg-[#1E1B18] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={knowledgeSearch}
                      onChange={(e) => setKnowledgeSearch(e.target.value)}
                      placeholder="ค้นหาตามหัวข้อ, เนื้อหา หรือ Tags..."
                      className="pl-9 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-44 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520]">
                      <SelectValue placeholder="หมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-xs">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchKnowledge}
                    className="h-9 px-3 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                    title="รีเฟรชข้อมูล"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingKnowledge ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOpenAddKnowledge}
                    className="h-9 px-3.5 text-xs rounded-xl gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มความรู้ใหม่
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingKnowledge ? (
                <div className="text-center py-12 text-xs text-muted-foreground">กำลังโหลดคลังความรู้...</div>
              ) : filteredKnowledge.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  ไม่พบข้อมูลความรู้ในหมวดนี้
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#FAF5EE]/60 dark:bg-[#25201C]/60">
                    <TableRow className="border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
                      <TableHead className="w-24 text-xs">หมวดหมู่</TableHead>
                      <TableHead className="text-xs">หัวข้อ & รายละเอียด</TableHead>
                      <TableHead className="w-48 text-xs">Tags ค้นหา</TableHead>
                      <TableHead className="w-24 text-xs text-center">สถานะ</TableHead>
                      <TableHead className="w-24 text-xs text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKnowledge.map((item) => (
                      <TableRow key={item.id} className="border-b border-[#EAD8C8]/40 dark:border-[#2D2520]/40">
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-lg font-mono">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-y-1 py-3">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                            {item.title}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2 max-w-xl">
                            {item.content}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(item.tags) && item.tags.length > 0 ? (
                              item.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center text-[10px] bg-[#FAF5EE] dark:bg-[#2A2420] text-[#8C6239] dark:text-[#EAD8C8] px-1.5 py-0.5 rounded-md border border-[#EFE8DD] dark:border-[#382F28]"
                                >
                                  #{tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => handleToggleKnowledge(item)}
                            title={item.is_active ? 'เปิดใช้งานอยู่' : 'ปิดใช้งาน'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditKnowledge(item)}
                              className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ type: 'knowledge', id: item.id, name: item.title })}
                              className="w-8 h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 2: STICKER TRIGGERS
            ═══════════════════════════════════════════════════ */}
        <TabsContent value="triggers" className="space-y-4">
          <Card className="border-[#EAD8C8] bg-white dark:bg-[#1E1B18] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={triggerSearch}
                    onChange={(e) => setTriggerSearch(e.target.value)}
                    placeholder="ค้นหา Keyword หรือคำอธิบาย..."
                    className="pl-9 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchTriggers}
                    className="h-9 px-3 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520]"
                    title="รีเฟรชข้อมูล"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTriggers ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOpenAddTrigger}
                    className="h-9 px-3.5 text-xs rounded-xl gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่ม Trigger ใหม่
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingTriggers ? (
                <div className="text-center py-12 text-xs text-muted-foreground">กำลังโหลด Sticker Triggers...</div>
              ) : filteredTriggers.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">ไม่พบรายการ Trigger</div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#FAF5EE]/60 dark:bg-[#25201C]/60">
                    <TableRow className="border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
                      <TableHead className="w-36 text-xs">Keyword</TableHead>
                      <TableHead className="w-28 text-xs">โหมดการส่ง</TableHead>
                      <TableHead className="text-xs">Discord Sticker IDs & บริบท</TableHead>
                      <TableHead className="w-24 text-xs text-center">สถานะ</TableHead>
                      <TableHead className="w-24 text-xs text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTriggers.map((item) => (
                      <TableRow key={item.id} className="border-b border-[#EAD8C8]/40 dark:border-[#2D2520]/40">
                        <TableCell>
                          <span className="font-bold text-xs text-foreground bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/20 font-mono">
                            {item.keyword}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-y-1 py-3">
                          <div className="text-xs text-muted-foreground">{item.description || 'ไม่มีคำอธิบาย'}</div>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(item.sticker_ids) && item.sticker_ids.length > 0 ? (
                              item.sticker_ids.map((id, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono"
                                >
                                  ID: {id}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-amber-500">ยังไม่ได้ระบุ Sticker ID</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => handleToggleTrigger(item)}
                            title={item.is_active ? 'เปิดใช้งานอยู่' : 'ปิดใช้งาน'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditTrigger(item)}
                              className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ type: 'trigger', id: item.id, name: item.keyword })}
                              className="w-8 h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════
          MODAL: ADD / EDIT KNOWLEDGE
          ═══════════════════════════════════════════════════ */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <BookOpen className="w-4 h-4 text-primary" />
              {editingKnowledge ? 'แก้ไขข้อมูลความรู้' : 'เพิ่มข้อมูลความรู้ใหม่'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ข้อมูลนี้จะถูกส่งให้ AI เพื่อใช้เป็นหลักฐานในการตอบคำถามอย่างถูกต้อง (Zero Hallucination)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">หมวดหมู่</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.filter((c) => c.value !== 'all').map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-xs">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">สถานะ</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                  <span className="text-xs text-muted-foreground">
                    {formActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">หัวข้อเรื่อง (Title)</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="เช่น กฎระเบียบเซิร์ฟเวอร์, ระบบร้านกาแฟ"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">เนื้อหาข้อมูล (Content - รองรับ Markdown)</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="ระบุข้อเท็จจริง กฎเกณฑ์ หรือขั้นตอนการทำงานอย่างชัดเจน..."
                className="text-xs rounded-xl min-h-[140px] font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tags ค้นหา (คั่นด้วยเครื่องหมายจุลภาค ,)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="เช่น rules, กฎ, ข้อห้าม, แต้ม, voice"
                className="h-9 text-xs rounded-xl font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                AI จะดึงข้อมูลนี้เฉพาะเมื่อข้อความของผู้ใช้มีคำตรงกับ Tags เหล่านี้ (ช่วยประหยัด Input Tokens)
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setKnowledgeDialogOpen(false)} className="rounded-xl text-xs">
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSaveKnowledge}
              disabled={savingKnowledge}
              className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
            >
              {savingKnowledge ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          MODAL: ADD / EDIT TRIGGER
          ═══════════════════════════════════════════════════ */}
      <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Smile className="w-4 h-4 text-amber-500" />
              {editingTrigger ? 'แก้ไข Sticker Trigger' : 'เพิ่ม Sticker Trigger ใหม่'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              เมื่อมีสมาชิกพิมพ์คำนี้ AI จะนำ Candidate Stickers ไปพิจารณาส่งตามอารมณ์ของบทสนทนา
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Keyword กระตุ้น (Exact Match)</Label>
              <Input
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="เช่น อิอิว, โอโอเย, ไรเรย"
                className="h-9 text-xs rounded-xl font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Discord Sticker IDs (คั่นด้วย ,)</Label>
              <Input
                value={formStickerIds}
                onChange={(e) => setFormStickerIds(e.target.value)}
                placeholder="เช่น 123456789012345678, 987654321098765432"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">คำอธิบายอารมณ์ / บริบทของสติกเกอร์</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="เช่น สติกเกอร์ยิ้มกรุ้มกริ่ม, สติกเกอร์ดีใจเฮฮา"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">โหมดการตัดสินใจ</Label>
                <Select value={formMode} onValueChange={(val: any) => setFormMode(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm_select" className="text-xs">AI ตัดสินใจ (llm_select)</SelectItem>
                    <SelectItem value="instant" className="text-xs">ส่งทันที (instant)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">สถานะ</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={formTriggerActive} onCheckedChange={setFormTriggerActive} />
                  <span className="text-xs text-muted-foreground">
                    {formTriggerActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setTriggerDialogOpen(false)} className="rounded-xl text-xs">
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTrigger}
              disabled={savingTrigger}
              className="rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {savingTrigger ? 'กำลังบันทึก...' : 'บันทึก Trigger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          ALERT DIALOG: CONFIRM DELETE
          ═══════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600">
              ยืนยันการลบข้อมูล
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              คุณแน่ใจหรือไม่ว่าต้องการลบ "{deleteTarget?.name}" ? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
