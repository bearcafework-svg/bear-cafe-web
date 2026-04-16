import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  FolderOpen,
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import { IconUpload } from '@/components/bear-cafe/IconUpload';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { DraggableRulesList } from './DraggableRulesList';
import { BulkDeleteToolbar } from './BulkDeleteToolbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import type { Tables } from '@/integrations/supabase/types';

type Category = Tables<'categories'>;
type DiscordRole = Tables<'discord_roles'>;
type RulesPreset = Tables<'rules_presets'>;

export function CategoriesManagement() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allRoles, setAllRoles] = useState<DiscordRole[]>([]);
  const [categoryRoles, setCategoryRoles] = useState<Record<string, string[]>>({});
  const [rulesPresets, setRulesPresets] = useState<RulesPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedRulesPreset, setSelectedRulesPreset] = useState<string>('');
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<RulesPreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetRules, setPresetRules] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const {
    selectedIds,
    selectedCount,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleItem,
    toggleAll,
    clearSelection,
  } = useBulkSelection({
    items: categories,
    getItemId: (item) => item.id,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📁',
    is_active: true,
    allow_voice_channel: true,
    require_role_selection: false,
    rules_text: '',
    sort_order: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchRulesPresets();
  }, []);

  async function fetchData() {
    try {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      const { data: rolesData, error: rolesError } = await supabase
        .from('discord_roles')
        .select('*')
        .eq('is_active', true)
        .order('display_name', { ascending: true });

      if (rolesError) throw rolesError;
      setAllRoles(rolesData || []);

      const { data: categoryRolesData, error: crError } = await supabase
        .from('category_roles')
        .select('category_id, role_id');

      if (crError) throw crError;

      const rolesMap: Record<string, string[]> = {};
      categoryRolesData?.forEach((cr) => {
        if (!rolesMap[cr.category_id]) {
          rolesMap[cr.category_id] = [];
        }
        rolesMap[cr.category_id].push(cr.role_id);
      });
      setCategoryRoles(rolesMap);
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

  async function fetchRulesPresets() {
    setLoadingPresets(true);
    try {
      const { data, error } = await supabase
        .from('rules_presets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRulesPresets(data || []);
    } catch (error) {
      console.error('Error fetching rules presets:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดกฎสำเร็จรูปได้',
        variant: 'destructive',
      });
    } finally {
      setLoadingPresets(false);
    }
  }

  function openCreateDialog() {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '📁',
      is_active: true,
      allow_voice_channel: true,
      require_role_selection: false,
      rules_text: '',
      sort_order: categories.length,
    });
    setSelectedRoleIds([]);
    setSelectedRulesPreset('');
    setDialogOpen(true);
  }

  function openCreatePresetDialog() {
    setEditingPreset(null);
    setPresetName('');
    setPresetRules([]);
    setPresetDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon,
      is_active: category.is_active,
      allow_voice_channel: category.allow_voice_channel,
      require_role_selection: category.require_role_selection,
      rules_text: category.rules_text || '',
      sort_order: category.sort_order || 0,
    });
    setSelectedRoleIds(categoryRoles[category.id] || []);
    setSelectedRulesPreset('');
    setDialogOpen(true);
  }

  function openEditPresetDialog(preset: RulesPreset) {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetRules(preset.rules_text ? preset.rules_text.split('\n').filter((rule) => rule.trim()) : []);
    setPresetDialogOpen(true);
  }

  function applyRulesPreset(mode: 'replace' | 'append') {
    if (!selectedRulesPreset) return;

    const preset = rulesPresets.find((item) => item.id === selectedRulesPreset);
    if (!preset) return;

    const presetRulesText = preset.rules_text
      ? preset.rules_text.split('\n').map((rule) => rule.trim()).filter(Boolean)
      : [];
    const existingRules = formData.rules_text
      ? formData.rules_text.split('\n').map((rule) => rule.trim()).filter(Boolean)
      : [];
    const nextRules = mode === 'append'
      ? [...existingRules, ...presetRulesText]
      : presetRulesText;

    setFormData({ ...formData, rules_text: nextRules.join('\n') });
  }

  async function handlePresetSave() {
    const trimmedName = presetName.trim();
    const normalizedRules = presetRules.map((rule) => rule.trim()).filter(Boolean);

    if (!trimmedName) {
      toast({
        title: 'กรุณากรอกชื่อกฎสำเร็จรูป',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedRules.length === 0) {
      toast({
        title: 'กรุณาเพิ่มกติกาอย่างน้อย 1 ข้อ',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingPreset) {
        const { error } = await supabase
          .from('rules_presets')
          .update({
            name: trimmedName,
            rules_text: normalizedRules.join('\n'),
          })
          .eq('id', editingPreset.id);

        if (error) throw error;
        toast({ title: 'แก้ไขกฎสำเร็จรูปแล้ว' });
      } else {
        const { error } = await supabase
          .from('rules_presets')
          .insert({
            name: trimmedName,
            rules_text: normalizedRules.join('\n'),
            created_by: user?.id || null,
          });

        if (error) throw error;
        toast({ title: 'เพิ่มกฎสำเร็จรูปแล้ว' });
      }

      setPresetDialogOpen(false);
      setEditingPreset(null);
      setPresetName('');
      setPresetRules([]);
      fetchRulesPresets();
    } catch (error) {
      console.error('Error saving rules preset:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกกฎสำเร็จรูปได้',
        variant: 'destructive',
      });
    }
  }

  async function deletePreset(preset: RulesPreset) {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบกฎสำเร็จรูป "${preset.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('rules_presets')
        .delete()
        .eq('id', preset.id);

      if (error) throw error;
      toast({ title: 'ลบกฎสำเร็จรูปแล้ว' });
      if (selectedRulesPreset === preset.id) {
        setSelectedRulesPreset('');
      }
      fetchRulesPresets();
    } catch (error) {
      console.error('Error deleting rules preset:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบกฎสำเร็จรูปได้',
        variant: 'destructive',
      });
    }
  }

  async function handleSubmit() {
    try {
      let categoryId = editingCategory?.id;
      
      const dataToSave = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        is_active: formData.is_active,
        allow_voice_channel: formData.allow_voice_channel,
        require_role_selection: formData.require_role_selection,
        rules_text: formData.rules_text,
        sort_order: formData.sort_order,
      };
      
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(dataToSave)
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        categoryId = data.id;
      }

      if (categoryId) {
        await supabase
          .from('category_roles')
          .delete()
          .eq('category_id', categoryId);

        if (selectedRoleIds.length > 0) {
          const { error: rolesError } = await supabase
            .from('category_roles')
            .insert(
              selectedRoleIds.map((roleId) => ({
                category_id: categoryId,
                role_id: roleId,
              }))
            );
          if (rolesError) throw rolesError;
        }
      }

      toast({ title: editingCategory ? 'อัปเดตหมวดหมู่แล้ว' : 'สร้างหมวดหมู่แล้ว' });
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบหมวดหมู่นี้?')) return;
    
    try {
      await supabase
        .from('category_roles')
        .delete()
        .eq('category_id', id);
        
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบหมวดหมู่แล้ว' });
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      
      // Delete category_roles first
      await supabase
        .from('category_roles')
        .delete()
        .in('category_id', idsToDelete);
      
      const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast({
        title: 'ลบหมวดหมู่แล้ว',
        description: `ลบ ${idsToDelete.length} หมวดหมู่เรียบร้อยแล้ว`,
      });
      clearSelection();
      fetchData();
    } catch (error) {
      console.error('Error bulk deleting categories:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบหมวดหมู่ได้',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function moveCategory(categoryId: string, direction: 'up' | 'down') {
    const currentIndex = categories.findIndex((category) => category.id === categoryId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const currentCategory = categories[currentIndex];
    const targetCategory = categories[targetIndex];
    const updatedCategories = [...categories];

    updatedCategories[currentIndex] = {
      ...targetCategory,
      sort_order: currentCategory.sort_order ?? 0,
    };
    updatedCategories[targetIndex] = {
      ...currentCategory,
      sort_order: targetCategory.sort_order ?? 0,
    };

    setCategories(updatedCategories);

    try {
      const { error: currentError } = await supabase
        .from('categories')
        .update({ sort_order: targetCategory.sort_order ?? 0 })
        .eq('id', currentCategory.id);
      if (currentError) throw currentError;

      const { error: targetError } = await supabase
        .from('categories')
        .update({ sort_order: currentCategory.sort_order ?? 0 })
        .eq('id', targetCategory.id);
      if (targetError) throw targetError;

      toast({ title: 'อัปเดตลำดับหมวดหมู่แล้ว' });
    } catch (error) {
      console.error('Error updating category order:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอัปเดตลำดับหมวดหมู่ได้',
        variant: 'destructive',
      });
      fetchData();
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Rules Presets Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                กฎสำเร็จรูป
              </CardTitle>
              <Button onClick={openCreatePresetDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                เพิ่มกฎสำเร็จรูป
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPresets ? (
              <div className="text-center py-6 text-muted-foreground">กำลังโหลด...</div>
            ) : rulesPresets.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                ยังไม่มีกฎสำเร็จรูป
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อชุดกฎ</TableHead>
                    <TableHead>จำนวนกฎ</TableHead>
                    <TableHead className="text-right">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesPresets.map((preset) => {
                    const ruleCount = preset.rules_text
                      ? preset.rules_text.split('\n').filter((rule) => rule.trim()).length
                      : 0;
                    return (
                      <TableRow key={preset.id}>
                        <TableCell className="font-medium">{preset.name}</TableCell>
                        <TableCell>{ruleCount} ข้อ</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPresetDialog(preset)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deletePreset(preset)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
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
        </Card>

        {/* Categories Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                จัดการหมวดหมู่
              </CardTitle>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                เพิ่มหมวดหมู่
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <BulkDeleteToolbar
              selectedCount={selectedCount}
              onDelete={handleBulkDelete}
              onClear={clearSelection}
              isDeleting={isDeleting}
              itemLabel="หมวดหมู่"
            />
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
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
                    <TableHead>ไอคอน</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>คำอธิบาย</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ตัวเลือก</TableHead>
                    <TableHead className="text-center">ลำดับ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id} className={isSelected(cat.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected(cat.id)}
                          onCheckedChange={() => toggleItem(cat.id)}
                          aria-label={`เลือก ${cat.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <IconDisplay icon={cat.icon} fallback="📁" size="lg" />
                      </TableCell>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {cat.description || '-'}
                      </TableCell>
                      <TableCell>
                        {cat.is_active ? (
                          <Badge variant="outline" className="text-success border-success gap-1">
                            <CheckCircle className="w-3 h-3" />
                            ใช้งาน
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            ปิด
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {cat.allow_voice_channel && (
                            <Badge variant="outline" className="text-xs">🎤 Voice</Badge>
                          )}
                          {cat.require_role_selection && (
                            <Badge variant="outline" className="text-xs">🎭 Role</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategory(cat.id, 'up')}
                            disabled={categories[0]?.id === cat.id}
                            aria-label="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategory(cat.id, 'down')}
                            disabled={categories[categories.length - 1]?.id === cat.id}
                            aria-label="เลื่อนลง"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(cat)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
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
      </div>

      {/* Create/Edit Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่ใหม่'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="gap-2">
                <FolderOpen className="w-4 h-4" />
                ข้อมูลพื้นฐาน
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2">
                <FileText className="w-4 h-4" />
                กติกา
              </TabsTrigger>
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <IconUpload
                    value={formData.icon}
                    onChange={(value) => setFormData({ ...formData, icon: value })}
                    label="ไอคอนหมวดหมู่"
                    placeholder="📁"
                    folder="categories"
                  />
                  <div>
                    <Label>ชื่อหมวดหมู่</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="เช่น หาเพื่อนเล่นเกม"
                    />
                  </div>
                  <div>
                    <Label>คำอธิบาย</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="คำอธิบายสั้นๆ"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>เปิดใช้งาน</Label>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>อนุญาต Voice Channel</Label>
                      <Switch
                        checked={formData.allow_voice_channel}
                        onCheckedChange={(checked) => setFormData({ ...formData, allow_voice_channel: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>ต้องเลือก Role</Label>
                      <Switch
                        checked={formData.require_role_selection}
                        onCheckedChange={(checked) => setFormData({ ...formData, require_role_selection: checked })}
                      />
                    </div>
                  </div>
                  {formData.require_role_selection && (
                    <div>
                      <Label>Role ที่อนุญาต</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                        {allRoles.map((role) => (
                          <div key={role.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                            <Checkbox
                              id={`role-${role.id}`}
                              checked={selectedRoleIds.includes(role.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRoleIds([...selectedRoleIds, role.id]);
                                } else {
                                  setSelectedRoleIds(selectedRoleIds.filter((id) => id !== role.id));
                                }
                              }}
                            />
                            <label htmlFor={`role-${role.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                              <IconDisplay icon={role.emoji} fallback="🎭" size="sm" />
                              <span className="truncate">{role.display_name}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <Label>เลือกกฎสำเร็จรูป</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={selectedRulesPreset} onValueChange={setSelectedRulesPreset}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="เลือกกฎสำเร็จรูป..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rulesPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyRulesPreset('replace')}
                      disabled={!selectedRulesPreset}
                    >
                      แทนที่
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyRulesPreset('append')}
                      disabled={!selectedRulesPreset}
                    >
                      เพิ่มท้าย
                    </Button>
                  </div>
                </div>
                <DraggableRulesList
                  rules={formData.rules_text ? formData.rules_text.split('\n').filter((r) => r.trim()) : []}
                  onChange={(rules) => setFormData({ ...formData, rules_text: rules.join('\n') })}
                />
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit}>
              {editingCategory ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? 'แก้ไขกฎสำเร็จรูป' : 'เพิ่มกฎสำเร็จรูปใหม่'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อชุดกฎ</Label>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="เช่น กฎทั่วไป"
              />
            </div>
            <DraggableRulesList
              rules={presetRules}
              onChange={setPresetRules}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handlePresetSave}>
              {editingPreset ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
