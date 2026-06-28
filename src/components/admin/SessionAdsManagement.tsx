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
} from 'lucide-react';
import { compressImage } from '@/lib/image-compress';

// ── Types ──────────────────────────────────────────────────────────────────────
type SessionAd = {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AdFormData = {
  link_url: string;
  is_active: boolean;
};

const INITIAL_FORM: AdFormData = { link_url: '', is_active: true };
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
    // show original image inside crop area (not clearRect which makes it transparent/black)
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
      // scale crop coords back to natural image size
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
    setFormData({ link_url: ad.link_url, is_active: ad.is_active });
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
      // extra compress pass if still large
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
      // refresh picker cache
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

  const deleteBucketFile = async (url: string) => {
    const fileName = url.split('/').pop();
    if (!fileName) return;
    await supabase.storage.from(BUCKET).remove([fileName]);
    setPickerFiles(prev => prev.filter(f => f.url !== url));
    if (pendingImageUrl === url) setPendingImageUrl('');
    toast({ title: 'ลบภาพสำเร็จ' });
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pendingImageUrl) {
      toast({ title: 'กรุณาเลือกหรืออัปโหลดภาพ', variant: 'destructive' }); return;
    }
    if (!formData.link_url.trim() || !formData.link_url.match(/^https?:\/\//)) {
      toast({ title: 'ลิงก์ไม่ถูกต้อง', description: 'ต้องขึ้นต้นด้วย https://', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (editingAd) {
        const { error } = await (supabase as any)
          .from('session_ads')
          .update({ image_url: pendingImageUrl, link_url: formData.link_url.trim(), is_active: formData.is_active })
          .eq('id', editingAd.id);
        if (error) throw error;
        toast({ title: 'แก้ไขสำเร็จ' });
      } else {
        const { error } = await (supabase as any)
          .from('session_ads')
          .insert({ image_url: pendingImageUrl, link_url: formData.link_url.trim(), is_active: formData.is_active, sort_order: ads.length });
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
    if (!confirm('ลบโฆษณานี้?')) return;
    try {
      const { error } = await (supabase as any).from('session_ads').delete().eq('id', ad.id);
      if (error) throw error;
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

  // ── Move up / down ──────────────────────────────────────────────────────────
  const moveAd = async (ad: SessionAd, dir: 'up' | 'down') => {
    const idx = ads.findIndex(a => a.id === ad.id);
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ads.length) return;
    const other = ads[newIdx];
    try {
      await Promise.all([
        (supabase as any).from('session_ads').update({ sort_order: newIdx }).eq('id', ad.id),
        (supabase as any).from('session_ads').update({ sort_order: idx }).eq('id', other.id),
      ]);
      const updated = [...ads];
      updated[idx] = { ...other, sort_order: idx };
      updated[newIdx] = { ...ad, sort_order: newIdx };
      setAds(updated);
    } catch {
      toast({ title: 'เรียงลำดับไม่สำเร็จ', variant: 'destructive' });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              โฆษณาผ่านระบบ
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />เพิ่มโฆษณา
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ภาพและลิงก์จะถูกแทรกใน Component v2 ทุกครั้งที่มีการโพสต์หาเพื่อน ตามลำดับด้านล่าง
          </p>
        </CardHeader>
        <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ลำดับ</TableHead>
                  <TableHead className="w-[160px]">ภาพตัวอย่าง</TableHead>
                  <TableHead>ลิงก์</TableHead>
                  <TableHead className="w-[90px]">สถานะ</TableHead>
                  <TableHead className="text-right w-[120px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad, index) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex flex-col items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => moveAd(ad, 'up')} disabled={index === 0}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => moveAd(ad, 'down')} disabled={index === ads.length - 1}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <img
                        src={ad.image_url}
                        alt={`ad-${index + 1}`}
                        className="w-36 h-[57px] object-cover rounded-lg border border-border/40"
                      />
                    </TableCell>
                    <TableCell>
                      <a href={ad.link_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm max-w-[260px] truncate">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ad.link_url}</span>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ad.is_active ? 'default' : 'secondary'}
                        className={ad.is_active ? 'bg-matcha/80 text-white border-0' : ''}>
                        {ad.is_active
                          ? <><Eye className="w-3 h-3 mr-1" />แสดง</>
                          : <><EyeOff className="w-3 h-3 mr-1" />ซ่อน</>}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon"
                          title={ad.is_active ? 'ซ่อน' : 'แสดง'}
                          onClick={() => toggleActive(ad)}>
                          {ad.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(ad)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(ad)}>
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
      </Card>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
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
              <Label htmlFor="ad-link">ลิงก์ปุ่ม "ดูรายละเอียด" *</Label>
              <Input id="ad-link" type="url" placeholder="https://example.com"
                value={formData.link_url}
                onChange={e => setFormData(p => ({ ...p, link_url: e.target.value }))} />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="w-4 h-4" />เลือกภาพจาก Bucket
            </DialogTitle>
          </DialogHeader>
          {loadingPicker ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pickerFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">ไม่มีภาพใน bucket</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {pickerFiles.map(f => (
                <div key={f.url}
                  className="relative group rounded-xl overflow-hidden border border-border/40 aspect-[2.5/1]">
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    <Button size="sm" className="text-xs h-7 w-[80px]"
                      onClick={() => { setPendingImageUrl(f.url); setPickerOpen(false); }}>
                      เลือก
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs h-7 w-[80px]"
                      onClick={() => deleteBucketFile(f.url)}>
                      <Trash2 className="w-3 h-3 mr-1" />ลบ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
