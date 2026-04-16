import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  Upload,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { BulkDeleteToolbar } from './BulkDeleteToolbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import type { Tables } from '@/integrations/supabase/types';
import { compressImage } from '@/lib/image-compress';

type Banner = Tables<'banners'>;

export function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    items: banners,
    getItemId: (item) => item.id,
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link_url: '',
    button_text: '',
    button_url: '',
    is_active: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  async function fetchBanners() {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูล Banner ได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingBanner(null);
    setFormData({
      title: '',
      description: '',
      link_url: '',
      button_text: '',
      button_url: '',
      is_active: true,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setDialogOpen(true);
  }

  function openEditDialog(banner: Banner) {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      link_url: banner.link_url || '',
      button_text: banner.button_text || '',
      button_url: banner.button_url || '',
      is_active: banner.is_active,
    });
    setSelectedFile(null);
    setPreviewUrl(banner.image_url);
    setDialogOpen(true);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'ไฟล์ไม่ถูกต้อง',
        description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        variant: 'destructive',
      });
      return;
    }

    // Auto-compress if needed (max 5MB, max 1920x1080)
    let processed = file;
    if (file.size > 5 * 1024 * 1024 || file.type === 'image/png' || file.type === 'image/bmp') {
      try {
        processed = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          maxSizeBytes: 5 * 1024 * 1024,
        });
        if (processed !== file) {
          const savedKB = Math.round((file.size - processed.size) / 1024);
          toast({
            title: 'ปรับขนาดรูปภาพแล้ว',
            description: `ลดขนาดลง ${savedKB} KB โดยอัตโนมัติ`,
          });
        }
      } catch {
        // If compression fails, still try original
        processed = file;
      }
    }

    if (processed.size > 5 * 1024 * 1024) {
      toast({
        title: 'ไฟล์ใหญ่เกินไป',
        description: 'ไม่สามารถบีบอัดให้ต่ำกว่า 5MB ได้ กรุณาเลือกรูปอื่น',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(processed);
    setPreviewUrl(URL.createObjectURL(processed));
  }

  async function uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('banners').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleSave() {
    // Validate
    if (!editingBanner && !selectedFile) {
      toast({
        title: 'กรุณาเลือกรูปภาพ',
        description: 'ต้องอัพโหลดรูปภาพสำหรับ Banner',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      let imageUrl = editingBanner?.image_url || '';

      // Upload new image if selected
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }

      if (editingBanner) {
        // Update existing banner
        const { error } = await supabase
          .from('banners')
          .update({
            title: formData.title || null,
            description: formData.description || null,
            link_url: formData.link_url || null,
            button_text: formData.button_text || null,
            button_url: formData.button_url || null,
            is_active: formData.is_active,
            image_url: imageUrl,
          })
          .eq('id', editingBanner.id);

        if (error) throw error;

        toast({
          title: 'บันทึกสำเร็จ',
          description: 'อัปเดต Banner เรียบร้อยแล้ว',
        });
      } else {
        // Create new banner
        const { error } = await supabase.from('banners').insert({
          title: formData.title || null,
          description: formData.description || null,
          link_url: formData.link_url || null,
          button_text: formData.button_text || null,
          button_url: formData.button_url || null,
          is_active: formData.is_active,
          image_url: imageUrl,
          sort_order: banners.length,
        });

        if (error) throw error;

        toast({
          title: 'เพิ่มสำเร็จ',
          description: 'เพิ่ม Banner ใหม่เรียบร้อยแล้ว',
        });
      }

      setDialogOpen(false);
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึก Banner ได้',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(banner: Banner) {
    if (!confirm('คุณต้องการลบ Banner นี้หรือไม่?')) return;

    try {
      // Delete from storage first
      const fileName = banner.image_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('banners').remove([fileName]);
      }

      // Delete from database
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', banner.id);

      if (error) throw error;

      toast({
        title: 'ลบสำเร็จ',
        description: 'ลบ Banner เรียบร้อยแล้ว',
      });

      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบ Banner ได้',
        variant: 'destructive',
      });
    }
  }

  async function toggleActive(banner: Banner) {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;

      setBanners(
        banners.map((b) =>
          b.id === banner.id ? { ...b, is_active: !b.is_active } : b
        )
      );

      toast({
        title: banner.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน',
        description: banner.is_active
          ? 'Banner ถูกปิดการใช้งานแล้ว'
          : 'Banner ถูกเปิดการใช้งานแล้ว',
      });
    } catch (error) {
      console.error('Error toggling active:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  async function moveBanner(banner: Banner, direction: 'up' | 'down') {
    const currentIndex = banners.findIndex((b) => b.id === banner.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= banners.length) return;

    const otherBanner = banners[newIndex];

    try {
      // Swap sort_order values
      await Promise.all([
        supabase
          .from('banners')
          .update({ sort_order: newIndex })
          .eq('id', banner.id),
        supabase
          .from('banners')
          .update({ sort_order: currentIndex })
          .eq('id', otherBanner.id),
      ]);

      // Update local state
      const newBanners = [...banners];
      newBanners[currentIndex] = { ...otherBanner, sort_order: currentIndex };
      newBanners[newIndex] = { ...banner, sort_order: newIndex };
      setBanners(newBanners);

      toast({
        title: 'เรียงลำดับสำเร็จ',
      });
    } catch (error) {
      console.error('Error moving banner:', error);
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
      const bannersToDelete = banners.filter(b => selectedIds.has(b.id));
      
      // Delete from storage first
      for (const banner of bannersToDelete) {
        const fileName = banner.image_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('banners').remove([fileName]);
        }
      }

      const { error } = await supabase
        .from('banners')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast({
        title: 'ลบ Banner แล้ว',
        description: `ลบ ${idsToDelete.length} Banner เรียบร้อยแล้ว`,
      });
      clearSelection();
      fetchBanners();
    } catch (error) {
      console.error('Error bulk deleting banners:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบ Banner ได้',
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
            <ImageIcon className="w-5 h-5" />
            จัดการ Banner
          </CardTitle>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            เพิ่ม Banner
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <BulkDeleteToolbar
          selectedCount={selectedCount}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
          isDeleting={isDeleting}
          itemLabel="Banner"
        />
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            กำลังโหลด...
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>ยังไม่มี Banner</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่ม Banner แรก
            </Button>
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
                <TableHead className="w-[60px]">ลำดับ</TableHead>
                <TableHead className="w-[120px]">รูปภาพ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ลิงก์</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner, index) => (
                <TableRow key={banner.id} className={isSelected(banner.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(banner.id)}
                      onCheckedChange={() => toggleItem(banner.id)}
                      aria-label={`เลือก ${banner.title || 'Banner'}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveBanner(banner, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <span className="text-center text-sm text-muted-foreground">
                        {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveBanner(banner, 'down')}
                        disabled={index === banners.length - 1}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <img
                      src={banner.image_url}
                      alt={banner.title || 'Banner'}
                      className="w-24 h-8 object-cover rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {banner.title || (
                        <span className="text-muted-foreground italic">
                          ไม่มีชื่อ
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    {banner.link_url ? (
                      <a
                        href={banner.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        เปิดลิงก์
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={banner.is_active ? 'default' : 'secondary'}
                      className={
                        banner.is_active
                          ? 'bg-success text-success-foreground'
                          : ''
                      }
                    >
                      {banner.is_active ? (
                        <>
                          <Eye className="w-3 h-3 mr-1" />
                          แสดง
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 mr-1" />
                          ซ่อน
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActive(banner)}
                      >
                        {banner.is_active ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(banner)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(banner)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? 'แก้ไข Banner' : 'เพิ่ม Banner ใหม่'}
            </DialogTitle>
            <DialogDescription>
              ขนาดรูปภาพที่แนะนำ: 909 x 304 pixels (อัตราส่วน 3:1)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>รูปภาพ Banner *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {previewUrl ? (
                <div className="relative group">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full aspect-[3/1] object-cover rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      เปลี่ยนรูป
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[3/1] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    คลิกเพื่ออัพโหลดรูปภาพ
                  </span>
                </button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">หัวข้อ Banner (ไม่บังคับ)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="เช่น โปรโมชันพิเศษ"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">รายละเอียด (ไม่บังคับ)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="คำอธิบายสั้นๆ เกี่ยวกับ Banner"
              />
            </div>

            {/* Button Text */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="button_text">ข้อความปุ่ม</Label>
                <Input
                  id="button_text"
                  value={formData.button_text}
                  onChange={(e) =>
                    setFormData({ ...formData, button_text: e.target.value })
                  }
                  placeholder="เช่น ดูเพิ่มเติม"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="button_url">ลิงก์ปุ่ม</Label>
                <Input
                  id="button_url"
                  type="url"
                  value={formData.button_url}
                  onChange={(e) =>
                    setFormData({ ...formData, button_url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Link URL (for clicking whole banner) */}
            <div className="space-y-2">
              <Label htmlFor="link_url">ลิงก์รูปภาพ (คลิกที่ภาพเปิดลิงก์)</Label>
              <Input
                id="link_url"
                type="url"
                value={formData.link_url}
                onChange={(e) =>
                  setFormData({ ...formData, link_url: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">เปิดใช้งาน</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={uploading}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
