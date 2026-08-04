import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Plus,
  Trash2,
  Edit,
  Upload,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Loader2,
  Images,
  Eye,
  EyeOff,
  Megaphone,
  Save,
  Smile,
  GripVertical,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
type SessionAd = {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
  has_button: boolean;
  button_label: string | null;
  button_emoji: string | null;
  button_emoji_id: string | null;
  button_emoji_name: string | null;
  button_emoji_animated: boolean;
  created_at: string;
  updated_at: string;
};

type AdFormData = {
  link_url: string;
  is_active: boolean;
  has_button: boolean;
  button_label: string;
  button_emoji: string;
  button_emoji_id: string;
  button_emoji_name: string;
  button_emoji_animated: boolean;
};

const INITIAL_FORM: AdFormData = {
  link_url: '',
  is_active: true,
  has_button: true,
  button_label: 'ดูรายละเอียด',
  button_emoji: '',
  button_emoji_id: '',
  button_emoji_name: '',
  button_emoji_animated: false,
};

const BUCKET = 'campaign-images';
const AD_WIDTH = 1200;
const AD_HEIGHT = 480;

// ── Canvas crop + resize to exact 1200×480 ────────────────────────────────────
function cropAndResize(
  img: HTMLImageElement,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = AD_WIDTH;
    canvas.height = AD_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, AD_WIDTH, AD_HEIGHT);
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, AD_WIDTH, AD_HEIGHT);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.88,
    );
  });
}

// ── CropModal ─────────────────────────────────────────────────────────────────
interface CropModalProps {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

function CropModal({ file, onConfirm, onCancel }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 }); // display size
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);

  // drag state
  const dragging = useRef<{ type: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  // Load image once
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      URL.revokeObjectURL(url);
      const cw = containerRef.current?.clientWidth || 560;
      const scale = Math.min(1, cw / el.naturalWidth);
      const dw = Math.round(el.naturalWidth * scale);
      const dh = Math.round(el.naturalHeight * scale);
      setDisp({ w: dw, h: dh });
      // initial crop: max 2.5:1 rect centred
      const ch = Math.min(dh, dw / 2.5);
      const cW = ch * 2.5;
      setCrop({ x: Math.round((dw - cW) / 2), y: Math.round((dh - ch) / 2), w: Math.round(cW), h: Math.round(ch) });
    };
    el.onerror = () => URL.revokeObjectURL(url);
    el.src = url;
  }, [file]);

  // Draw overlay every time crop changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img || disp.w === 0) return;
    canvas.width = disp.w;
    canvas.height = disp.h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, disp.w, disp.h);
    ctx.drawImage(img, 0, 0, disp.w, disp.h);
    // dim outside
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, disp.w, disp.h);
    // show original image inside crop area
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, crop.x, crop.y, crop.w, crop.h);
    // border
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    // resize handle corner
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(crop.x + crop.w - 10, crop.y + crop.h - 10, 10, 10);
  }, [img, crop, disp]);

  const clamp = useCallback((c: typeof crop): typeof crop => {
    const minH = 30;
    let { x, y, w, h } = c;
    w = Math.max(minH * 2.5, w);
    h = w / 2.5;
    x = Math.max(0, Math.min(x, disp.w - w));
    y = Math.max(0, Math.min(y, disp.h - h));
    if (x + w > disp.w) { w = disp.w - x; h = w / 2.5; }
    if (y + h > disp.h) { h = disp.h - y; w = h * 2.5; x = Math.max(0, Math.min(x, disp.w - w)); }
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }, [disp]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { mx: e.clientX - r.left, my: e.clientY - r.top };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { mx, my } = getPos(e);
    const inResize = mx >= crop.x + crop.w - 14 && mx <= crop.x + crop.w + 4
      && my >= crop.y + crop.h - 14 && my <= crop.y + crop.h + 4;
    const inMove = mx >= crop.x && mx <= crop.x + crop.w && my >= crop.y && my <= crop.y + crop.h;
    if (inResize) {
      dragging.current = { type: 'resize', sx: mx, sy: my, ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
    } else if (inMove) {
      dragging.current = { type: 'move', sx: mx, sy: my, ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const { mx, my } = getPos(e);
    const d = dragging.current;
    if (d.type === 'move') {
      setCrop(prev => clamp({ ...prev, x: d.ox + (mx - d.sx), y: d.oy + (my - d.sy) }));
    } else {
      const newW = Math.max(75, d.ow + (mx - d.sx));
      setCrop(prev => clamp({ ...prev, w: newW, h: newW / 2.5 }));
    }
  };

  const onMouseUp = () => { dragging.current = null; };

  const handleConfirm = async () => {
    if (!img) return;
    setProcessing(true);
    try {
      const scaleX = img.naturalWidth / disp.w;
      const scaleY = img.naturalHeight / disp.h;
      const blob = await cropAndResize(img, crop.x * scaleX, crop.y * scaleY, crop.w * scaleX, crop.h * scaleY);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ครอปภาพโฆษณา (ผลลัพธ์ {AD_WIDTH} × {AD_HEIGHT} px)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-2">
          ลากกรอบสีทองเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด (อัตราส่วน 2.5:1 ถูกล็อกไว้)
        </p>
        <div ref={containerRef} className="w-full rounded-xl overflow-hidden border border-border/50 bg-muted/20">
          {disp.w > 0 ? (
            <canvas
              ref={canvasRef}
              style={{ width: disp.w, height: disp.h, maxWidth: '100%', display: 'block', cursor: 'crosshair' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          ) : (
            <div className="flex items-center justify-center h-36 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />กำลังโหลดภาพ...
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={processing}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={processing || !img}>
            {processing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังครอป...</>
              : 'ยืนยันครอป'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SessionAdsManagement() {
  const [ads, setAds] = useState<SessionAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<SessionAd | null>(null);
  const [formData, setFormData] = useState<AdFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // image selection
  const [cropFile, setCropFile] = useState<File | null>(null);       // triggers crop modal
  const [pendingImageUrl, setPendingImageUrl] = useState<string>(''); // url after crop+upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // bucket picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<{ name: string; url: string }[]>([]);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [selectedPickerFiles, setSelectedPickerFiles] = useState<string[]>([]);
  const [deletingPickerFiles, setDeletingPickerFiles] = useState(false);
  const [pickerDeleteMode, setPickerDeleteMode] = useState(false);

  const { toast } = useToast();

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('session_ads')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setAds((data as SessionAd[]) || []);
      setHasOrderChanged(false);
    } catch (err: any) {
      toast({ title: 'โหลดไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  // ── Dialog helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingAd(null);
    setFormData(INITIAL_FORM);
    setPendingImageUrl('');
    setDialogOpen(true);
  };

  const openEdit = (ad: SessionAd) => {
    setEditingAd(ad);
    setFormData({
      link_url: ad.link_url,
      is_active: ad.is_active,
      has_button: ad.has_button ?? true,
      button_label: ad.button_label || 'ดูรายละเอียด',
      button_emoji: ad.button_emoji || '',
      button_emoji_id: ad.button_emoji_id || '',
      button_emoji_name: ad.button_emoji_name || '',
      button_emoji_animated: !!ad.button_emoji_animated,
    });
    setPendingImageUrl(ad.image_url);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCropFile(null);
    setPendingImageUrl('');
  };

  // ── File select → open crop modal ───────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      toast({ title: 'ไฟล์ไม่ถูกต้อง', description: 'รองรับเฉพาะไฟล์รูปภาพ', variant: 'destructive' });
      return;
    }
    setCropFile(file);
  };

  // ── After crop confirmed: compress → upload ─────────────────────────────────
  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      const rawFile = new File([blob], `${Date.now()}-ad-raw.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(rawFile, {
        maxWidth: AD_WIDTH,
        maxHeight: AD_HEIGHT,
        maxSizeBytes: 300 * 1024,
        initialQuality: 0.88,
        outputType: 'image/jpeg',
      });
      const fileName = `${Date.now()}-session-ad.jpg`;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, compressed, { cacheControl: '86400', upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      setPendingImageUrl(publicUrl);
      setPickerFiles([]);
      toast({ title: 'อัปโหลดสำเร็จ', description: 'ภาพถูกครอป บีบ และอัปโหลดแล้ว' });
    } catch (err: any) {
      toast({ title: 'อัปโหลดไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ── Bucket picker ───────────────────────────────────────────────────────────
  const openPicker = async () => {
    setPickerOpen(true);
    setPickerDeleteMode(false);
    setSelectedPickerFiles([]);
    if (pickerFiles.length > 0) return;
    setLoadingPicker(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      setPickerFiles(
        (data || [])
          .filter(f => f.name && !f.name.endsWith('/'))
          .map(f => ({
            name: f.name,
            url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
          })),
      );
    } catch (err: any) {
      toast({ title: 'โหลดรูปไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingPicker(false);
    }
  };

  const toggleSelectPickerFile = (fileName: string) => {
    setSelectedPickerFiles(prev =>
      prev.includes(fileName) ? prev.filter(name => name !== fileName) : [...prev, fileName]
    );
  };

  const selectAllPickerFiles = () => {
    if (selectedPickerFiles.length === pickerFiles.length) {
      setSelectedPickerFiles([]);
    } else {
      setSelectedPickerFiles(pickerFiles.map(f => f.name));
    }
  };

  const handleBulkDeletePickerFiles = async () => {
    if (selectedPickerFiles.length === 0) return;
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพที่เลือกจำนวน ${selectedPickerFiles.length} รายการ?`)) return;

    try {
      setDeletingPickerFiles(true);
      const { error } = await supabase.storage.from(BUCKET).remove(selectedPickerFiles);
      if (error) throw error;

      setPickerFiles(prev => prev.filter(f => !selectedPickerFiles.includes(f.name)));
      toast({
        title: 'ลบรูปภาพสำเร็จ',
        description: `ลบรูปภาพจำนวน ${selectedPickerFiles.length} รายการเรียบร้อยแล้ว`,
      });
      setSelectedPickerFiles([]);
    } catch (err: any) {
      toast({ title: 'ลบรูปภาพไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setDeletingPickerFiles(false);
    }
  };

  const deleteBucketFile = async (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fileName = url.split('/').pop();
    if (!fileName) return;
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพนี้?')) return;
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([fileName]);
      if (error) throw error;
      setPickerFiles(prev => prev.filter(f => f.url !== url));
      setSelectedPickerFiles(prev => prev.filter(name => name !== fileName));
      if (pendingImageUrl === url) setPendingImageUrl('');
      toast({ title: 'ลบภาพสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'ลบภาพไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    }
  };

  // ── Save Ad Details ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pendingImageUrl) {
      toast({ title: 'กรุณาเลือกหรืออัปโหลดภาพ', variant: 'destructive' }); return;
    }
    if (!formData.link_url.trim() || !formData.link_url.match(/^https?:\/\//)) {
      toast({ title: 'ลิงก์ไม่ถูกต้อง', description: 'ต้องขึ้นต้นด้วย https://', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const payload = {
        image_url: pendingImageUrl,
        link_url: formData.link_url.trim(),
        is_active: formData.is_active,
        has_button: formData.has_button,
        button_label: formData.has_button ? (formData.button_label.trim() || 'ดูรายละเอียด') : null,
        button_emoji: formData.has_button && formData.button_emoji.trim() ? formData.button_emoji.trim() : null,
        button_emoji_id: formData.has_button && formData.button_emoji_id.trim() ? formData.button_emoji_id.trim() : null,
        button_emoji_name: formData.has_button && formData.button_emoji_name.trim() ? formData.button_emoji_name.trim() : null,
        button_emoji_animated: formData.has_button ? formData.button_emoji_animated : false,
      };

      if (editingAd) {
        const { error } = await (supabase as any)
          .from('session_ads')
          .update(payload)
          .eq('id', editingAd.id);
        if (error) throw error;
        toast({ title: 'แก้ไขสำเร็จ' });
      } else {
        const maxSort = ads.length === 0 ? -1 : Math.max(...ads.map(a => Number(a.sort_order) || 0));
        const { error } = await (supabase as any)
          .from('session_ads')
          .insert({ ...payload, sort_order: maxSort + 1 });
        if (error) throw error;
        toast({ title: 'เพิ่มโฆษณาสำเร็จ' });
      }
      closeDialog();
      fetchAds();
    } catch (err: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (ad: SessionAd) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโฆษณานี้?')) return;
    try {
      const { error } = await (supabase as any).from('session_ads').delete().eq('id', ad.id);
      if (error) throw error;

      // Re-index remaining items cleanly
      const remaining = ads.filter(a => a.id !== ad.id);
      if (remaining.length > 0) {
        const reindexPromises = remaining.map((item, idx) =>
          (supabase as any).from('session_ads').update({ sort_order: idx }).eq('id', item.id)
        );
        await Promise.all(reindexPromises);
      }

      toast({ title: 'ลบสำเร็จ' });
      fetchAds();
    } catch (err: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const toggleActive = async (ad: SessionAd) => {
    try {
      const { error } = await (supabase as any)
        .from('session_ads')
        .update({ is_active: !ad.is_active })
        .eq('id', ad.id);
      if (error) throw error;
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !ad.is_active } : a));
    } catch (err: any) {
      toast({ title: 'อัปเดตไม่สำเร็จ', variant: 'destructive' });
    }
  };

  // ── Move up / down locally (Step 3: Save order separately) ────────────────────
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(ads);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((a, i) => ({ ...a, sort_order: i }));
    setAds(updated);
    setHasOrderChanged(true);
  }, [ads]);

  const moveAd = (ad: SessionAd, dir: 'up' | 'down') => {
    const idx = ads.findIndex(a => a.id === ad.id);
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ads.length) return;

    const updated = [...ads];
    const [moved] = updated.splice(idx, 1);
    updated.splice(newIdx, 0, moved);

    const reordered = updated.map((item, index) => ({ ...item, sort_order: index }));
    setAds(reordered);
    setHasOrderChanged(true);
  };

  // ── Batch save order to DB ──────────────────────────────────────────────────
  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true);
      const updates = ads.map((ad, index) =>
        (supabase as any).from('session_ads').update({ sort_order: index }).eq('id', ad.id)
      );
      await Promise.all(updates);
      setHasOrderChanged(false);
      toast({ title: 'สำเร็จ', description: 'บันทึกลำดับโฆษณาเรียบร้อยแล้ว' });
    } catch (err: any) {
      toast({ title: 'บันทึกลำดับไม่สำเร็จ', description: err?.message, variant: 'destructive' });
      fetchAds(); // revert
    } finally {
      setSavingOrder(false);
    }
  };

  // Helper to render button emoji in card / preview
  const renderEmoji = (ad: { button_emoji?: string | null; button_emoji_id?: string | null; button_emoji_animated?: boolean }) => {
    if (ad.button_emoji_id) {
      const ext = ad.button_emoji_animated ? 'gif' : 'png';
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${ad.button_emoji_id}.${ext}`}
          alt="emoji"
          className="w-4 h-4 inline-block shrink-0 object-contain"
        />
      );
    }
    if (ad.button_emoji) {
      return <span>{ad.button_emoji}</span>;
    }
    return null;
  };

  return (
    <>
      {/* hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Crop modal */}
      {cropFile && (
        <CropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Main card */}
      <Card className="rounded-2xl border-border/40 bg-card">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Megaphone className="w-5 h-5 text-primary" />
              โฆษณาผ่านระบบ
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasOrderChanged && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                  className="gap-2 rounded-xl text-xs h-9 bg-success hover:bg-success/90 text-white animate-pulse"
                >
                  {savingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึกลำดับ
                </Button>
              )}
              <Button size="sm" className="gap-2 rounded-xl text-xs h-9 bg-primary hover:bg-primary/90 text-white" onClick={openCreate}>
                <Plus className="w-4 h-4 text-white" />เพิ่มโฆษณา
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ภาพและลิงก์จะถูกส่งแสดงผลในระบบบอทหาเพื่อน ตามลำดับด้านล่าง (จัดลำดับก่อนแล้วกด "บันทึกลำดับ")
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {ads.length > 1 && !loading && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5" />
              ลากแถวหรือใช้ปุ่มเลื่อนขึ้น/ลงเพื่อเรียงลำดับ แล้วกด "บันทึกลำดับ"
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-honey/10 border border-honey/20 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-8 h-8 text-honey/60" />
              </div>
              <p className="font-medium text-foreground/60">ยังไม่มีโฆษณา</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                เพิ่มโฆษณาเพื่อแสดงในระบบหาเพื่อน
              </p>
              <Button variant="outline" className="mt-4 border-honey/30 hover:border-honey/60 hover:bg-honey/5" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />เพิ่มโฆษณาแรก
              </Button>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="session-ads">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {ads.map((ad, index) => (
                      <Draggable key={ad.id} draggableId={ad.id} index={index}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={cn(
                              "flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border bg-card transition-all hover:shadow-sm",
                              snapshot.isDragging
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md scale-[1.01]"
                                : "border-border/40 hover:bg-muted/30"
                            )}
                          >
                            {/* Drag handle & Up/Down buttons */}
                            <div className="flex items-center gap-1 shrink-0 self-center">
                              <button
                                type="button"
                                {...drag.dragHandleProps}
                                className="flex items-center justify-center p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 animate-none"
                                title="ลากเพื่อเรียงลำดับ"
                              >
                                <GripVertical className="w-4 h-4" />
                              </button>
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                                  onClick={() => moveAd(ad, 'up')}
                                  disabled={index === 0}
                                  title="เลื่อนขึ้น"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                                  onClick={() => moveAd(ad, 'down')}
                                  disabled={index === ads.length - 1}
                                  title="เลื่อนลง"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Left: Thumbnail */}
                            <div className="flex sm:flex-col items-center gap-2 shrink-0">
                              <div className="relative aspect-[2.5/1] w-44 sm:w-40 rounded-xl overflow-hidden border border-border/30 bg-muted">
                                <img src={ad.image_url} alt={`ad-${index + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full select-none">
                                  ลำดับที่ {index + 1}
                                </div>
                              </div>
                            </div>

                            {/* Right: Content details & Actions */}
                            <div className="flex-1 flex flex-col justify-between min-w-0 space-y-3">
                              <div className="space-y-2 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  {ad.is_active ? (
                                    <Badge className="bg-success/15 border-success/35 text-success hover:bg-success/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                                      แสดงผลอยู่
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-medium border border-border/30">
                                      ปิดการแสดงผล
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* URL link */}
                                <a
                                  href={ad.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium truncate max-w-full block"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{ad.link_url}</span>
                                </a>

                                {/* Button Details Badge */}
                                {ad.has_button !== false ? (
                                  <div className="flex items-center gap-1.5 text-xs bg-muted/40 border border-border/40 rounded-xl px-2.5 py-1.5 w-fit">
                                    {renderEmoji(ad)}
                                    <span className="font-semibold text-foreground">{ad.button_label || 'ดูรายละเอียด'}</span>
                                    {ad.button_emoji_animated && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 rounded text-accent border-accent/30 ml-1">GIF</Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground italic">ไม่มีปุ่มกด</span>
                                )}
                              </div>

                              {/* Actions block */}
                              <div className="flex items-center justify-end gap-1.5 border-t border-border/40 pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleActive(ad)}
                                  title={ad.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                                  className="h-8 px-2 hover:bg-muted rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                >
                                  {ad.is_active ? (
                                    <>
                                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                                      <span>ซ่อน</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 text-primary" />
                                      <span>แสดง</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(ad)}
                                  title="แก้ไข"
                                  className="h-8 w-8 p-0 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(ad)}
                                  title="ลบ"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAd ? 'แก้ไขโฆษณา' : 'เพิ่มโฆษณาใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Image upload area */}
            <div className="space-y-2">
              <Label>ภาพโฆษณา * <span className="text-muted-foreground font-normal">(1200 × 480 px)</span></Label>
              {pendingImageUrl ? (
                <div className="relative group">
                  <img src={pendingImageUrl} alt="preview"
                    className="w-full aspect-[2.5/1] object-cover rounded-xl border border-border/50" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm"
                      className="bg-white/90 text-foreground hover:bg-white border-0"
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" />เปลี่ยนรูป
                    </Button>
                    <Button variant="secondary" size="sm"
                      className="bg-white/90 text-foreground hover:bg-white border-0"
                      onClick={openPicker}>
                      <Images className="w-4 h-4 mr-1" />เลือกจาก Bucket
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[2.5/1] border-2 border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-honey/50 hover:bg-honey/5 transition-colors">
                    {uploading
                      ? <><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">กำลังอัปโหลด...</span></>
                      : <><Upload className="w-7 h-7 text-muted-foreground/50" /><span className="text-sm text-muted-foreground">คลิกเพื่ออัปโหลดและครอป</span><span className="text-xs text-muted-foreground/60">ผลลัพธ์ 1200 × 480 px · บีบให้ ≤300 KB อัตโนมัติ</span></>}
                  </button>
                  <Button variant="outline" size="sm" className="self-end gap-1 text-xs" onClick={openPicker}>
                    <Images className="w-3 h-3" />เลือกจาก Bucket
                  </Button>
                </div>
              )}
            </div>

            {/* Link */}
            <div className="space-y-2">
              <Label htmlFor="ad-link">ลิงก์ปุ่มกด *</Label>
              <Input id="ad-link" type="url" placeholder="https://example.com"
                value={formData.link_url}
                onChange={e => setFormData(p => ({ ...p, link_url: e.target.value }))} />
            </div>

            {/* Button Details Section (Point 4) */}
            <div className="space-y-3 rounded-2xl border border-border/40 p-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="has_button" className="font-semibold text-sm">แสดงปุ่มกดฝั่งบอท</Label>
                  <p className="text-xs text-muted-foreground">แสดงปุ่มกดนำทางไปยังลิงก์ด้านล่าง</p>
                </div>
                <Switch
                  id="has_button"
                  checked={formData.has_button}
                  onCheckedChange={v => setFormData(p => ({ ...p, has_button: v }))}
                />
              </div>

              {formData.has_button && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div>
                    <Label htmlFor="button_label">ชื่อปุ่มกด *</Label>
                    <Input
                      id="button_label"
                      value={formData.button_label}
                      onChange={e => setFormData(p => ({ ...p, button_label: e.target.value }))}
                      placeholder="เช่น: ดูรายละเอียด"
                      maxLength={80}
                    />
                  </div>

                  <div>
                    <Label htmlFor="button_emoji">อีโมจิปกติ (Unicode Emoji)</Label>
                    <Input
                      id="button_emoji"
                      value={formData.button_emoji}
                      onChange={e => setFormData(p => ({ ...p, button_emoji: e.target.value }))}
                      placeholder="เช่น: 🔥, 🔎, ✨"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">ใช้เมื่อไม่มี Discord Custom Emoji</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <Label className="text-xs font-semibold text-muted-foreground">Discord Custom Emoji (ID & Name)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="button_emoji_id" className="text-xs">Emoji ID</Label>
                        <Input
                          id="button_emoji_id"
                          value={formData.button_emoji_id}
                          onChange={e => setFormData(p => ({ ...p, button_emoji_id: e.target.value }))}
                          placeholder="เช่น: 1234567890"
                        />
                      </div>
                      <div>
                        <Label htmlFor="button_emoji_name" className="text-xs">Emoji Name</Label>
                        <Input
                          id="button_emoji_name"
                          value={formData.button_emoji_name}
                          onChange={e => setFormData(p => ({ ...p, button_emoji_name: e.target.value }))}
                          placeholder="เช่น: pepe_dance"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Label htmlFor="button_emoji_animated" className="text-xs cursor-pointer">เป็นอีโมจิภาพเคลื่อนไหว (Animated .gif)</Label>
                      <Switch
                        id="button_emoji_animated"
                        checked={formData.button_emoji_animated}
                        onCheckedChange={v => setFormData(p => ({ ...p, button_emoji_animated: v }))}
                      />
                    </div>
                  </div>

                  {/* Button Live Preview */}
                  <div className="pt-2">
                    <Label className="text-[11px] text-muted-foreground">ตัวอย่างปุ่มกดฝั่งบอท:</Label>
                    <div className="mt-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2b2d31] rounded-xl text-white font-medium text-xs border border-white/10 w-fit">
                      {renderEmoji(formData)}
                      <span>{formData.button_label || 'ดูรายละเอียด'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
              <div>
                <Label>เปิดใช้งาน</Label>
                <p className="text-xs text-muted-foreground mt-0.5">โฆษณาจะแสดงเมื่อเปิดอยู่เท่านั้น</p>
              </div>
              <Switch checked={formData.is_active}
                onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bucket Picker dialog ── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader className="pb-2 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Images className="w-5 h-5 text-primary" />
                เลือกภาพจาก Bucket
              </DialogTitle>
              {pickerFiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant={pickerDeleteMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      const next = !pickerDeleteMode;
                      setPickerDeleteMode(next);
                      if (!next) setSelectedPickerFiles([]);
                    }}
                    className={`h-8 text-xs rounded-xl gap-1.5 font-medium ${
                      pickerDeleteMode ? "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25" : ""
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    {pickerDeleteMode ? 'ออกจากโหมดลบรูป' : 'โหมดลบหลายรูป'}
                  </Button>

                  {(pickerDeleteMode || selectedPickerFiles.length > 0) && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllPickerFiles}
                        className="h-8 text-xs rounded-xl gap-1.5"
                      >
                        <Checkbox
                          checked={selectedPickerFiles.length === pickerFiles.length && pickerFiles.length > 0}
                          className="w-3.5 h-3.5"
                        />
                        {selectedPickerFiles.length === pickerFiles.length ? 'ยกเลิกการเลือก' : 'เลือกทั้งหมด'}
                      </Button>
                      {selectedPickerFiles.length > 0 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDeletePickerFiles}
                          disabled={deletingPickerFiles}
                          className="h-8 text-xs rounded-xl gap-1.5 animate-pulse shadow-md"
                        >
                          {deletingPickerFiles ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          ลบที่เลือก ({selectedPickerFiles.length})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {pickerDeleteMode ? (
                <span className="text-destructive font-semibold">
                  ⚠️ อยู่ในโหมดลบภาพ: คลิกที่การ์ดรูปใดก็ได้เพื่อเลือก/ยกเลิกรูปที่ต้องการลบ แล้วกด "ลบที่เลือก"
                </span>
              ) : (
                <span>
                  คลิกที่รูปเพื่อเลือกใช้งานใส่โฆษณา หรือกดปุ่ม "โหมดลบหลายรูป" เพื่อจัดการลบภาพ
                </span>
              )}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-3">
            {loadingPicker ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pickerFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">ไม่มีภาพใน bucket</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pickerFiles.map((f) => {
                  const isCheckedForDelete = selectedPickerFiles.includes(f.name);
                  const isChosen = pendingImageUrl === f.url;

                  return (
                    <div
                      key={f.url}
                      onClick={() => {
                        if (pickerDeleteMode || selectedPickerFiles.length > 0) {
                          toggleSelectPickerFile(f.name);
                        } else {
                          setPendingImageUrl(f.url);
                          setPickerOpen(false);
                        }
                      }}
                      className={`relative group rounded-2xl overflow-hidden border-2 transition-all aspect-[2.5/1] bg-muted cursor-pointer select-none ${
                        isCheckedForDelete
                          ? 'border-destructive ring-4 ring-destructive/20 bg-destructive/10 scale-[0.98]'
                          : isChosen
                          ? 'border-primary ring-4 ring-primary/20'
                          : 'border-border/40 hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />

                      {/* Large Checkbox Overlay top-left */}
                      <div
                        className="absolute top-2 left-2 z-10 p-2 rounded-xl bg-black/70 backdrop-blur-sm hover:bg-black/90 transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectPickerFile(f.name);
                        }}
                        title="ติ๊กเพื่อเลือก/ยกเลิกรูปนี้"
                      >
                        <Checkbox
                          checked={isCheckedForDelete}
                          onCheckedChange={() => toggleSelectPickerFile(f.name)}
                          className="w-4 h-4 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                        />
                      </div>

                      {/* Delete Icon top-right */}
                      <button
                        type="button"
                        onClick={(e) => deleteBucketFile(f.url, e)}
                        className="absolute top-2 right-2 z-10 p-2 rounded-xl bg-black/70 text-white hover:bg-destructive transition-colors opacity-80 hover:opacity-100"
                        title="ลบรูปภาพนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete mode checked badge overlay */}
                      {isCheckedForDelete && (
                        <div className="absolute inset-0 bg-destructive/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                          <Badge variant="destructive" className="text-xs px-2.5 py-1 rounded-xl shadow-lg gap-1.5 font-bold animate-in zoom-in-95">
                            <Trash2 className="w-3.5 h-3.5" />
                            เลือกเพื่อลบ
                          </Badge>
                        </div>
                      )}

                      {/* Selection badge for active form choice */}
                      {isChosen && !isCheckedForDelete && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
                          <Badge className="bg-primary text-primary-foreground text-xs px-2.5 py-1 rounded-xl shadow-lg gap-1.5 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            เลือกใช้อยู่
                          </Badge>
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-[10px] px-2 py-1 truncate opacity-90">
                        {f.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              ทั้งหมด <span className="font-bold text-foreground">{pickerFiles.length}</span> รูป
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  setPickerFiles([]);
                  setSelectedPickerFiles([]);
                  await openPicker();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                รีเฟรช
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(false)}>
                ปิด
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
