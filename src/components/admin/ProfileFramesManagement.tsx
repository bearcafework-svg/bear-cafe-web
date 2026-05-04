import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Upload, Loader2, Image as ImageIcon, Frame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileFrame {
  id: string;
  name: string;
  image_url: string;
  required_cohort: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const COHORT_OPTIONS = [
  { value: 'pioneer',   label: '🌱 Pioneer',   desc: 'ผู้ใช้ทั่วไป (ค่าเริ่มต้น)' },
  { value: 'veteran',   label: '⭐ Veteran',    desc: 'ผู้ใช้เก่าแก่' },
  { value: 'supporter', label: '💎 Supporter',  desc: 'ผู้สนับสนุน' },
  { value: 'staff',     label: '🛡️ Staff',      desc: 'ทีมงาน' },
];

function getCohortLabel(cohort: string) {
  return COHORT_OPTIONS.find(c => c.value === cohort)?.label ?? cohort;
}

// ─── Image Upload Helper ──────────────────────────────────────────────────────
async function uploadFrameImage(file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'png';
  const path = `frames/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage
    .from('cosmetics')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('cosmetics').getPublicUrl(path).data.publicUrl;
}

// ─── Frame Form Dialog ────────────────────────────────────────────────────────
function FrameDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProfileFrame | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '', required_cohort: 'pioneer', sort_order: 0, is_active: true,
  });
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name:            editing.name,
        required_cohort: editing.required_cohort,
        sort_order:      editing.sort_order,
        is_active:       editing.is_active,
      });
      setImageUrl(editing.image_url);
    } else {
      setForm({ name: '', required_cohort: 'pioneer', sort_order: 0, is_active: true });
      setImageUrl('');
    }
  }, [editing, open]);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'กรุณาเลือกไฟล์รูปภาพ', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFrameImage(file);
      setImageUrl(url);
      toast({ title: 'อัปโหลดรูปกรอบแล้ว' });
    } catch (e: any) {
      toast({ title: 'อัปโหลดล้มเหลว', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อกรอบ', variant: 'destructive' });
      return;
    }
    if (!imageUrl) {
      toast({ title: 'กรุณาอัปโหลดรูปกรอบ', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name:            form.name.trim(),
        image_url:       imageUrl,
        required_cohort: form.required_cohort,
        sort_order:      form.sort_order,
        is_active:       form.is_active,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from('profile_frames').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตกรอบแล้ว' });
      } else {
        const { error } = await (supabase as any)
          .from('profile_frames').insert(payload);
        if (error) throw error;
        toast({ title: 'เพิ่มกรอบแล้ว' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'แก้ไขกรอบโปรไฟล์' : 'เพิ่มกรอบโปรไฟล์ใหม่'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>ชื่อกรอบ *</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="เช่น Golden Pioneer, Crystal Veteran"
              autoFocus
            />
          </div>

          {/* Required cohort */}
          <div className="space-y-1.5">
            <Label>Cohort ที่ต้องการ</Label>
            <select
              value={form.required_cohort}
              onChange={e => setForm(f => ({ ...f, required_cohort: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {COHORT_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>
              ))}
            </select>
          </div>

          {/* Sort order + active */}
          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <Label>ลำดับ</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <div className="space-y-1.5 flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">เปิดใช้งาน</span>
              </label>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-1.5">
            <Label>รูปกรอบ (PNG/WebP โปร่งใส) *</Label>
            <input
              ref={imgRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
            />
            {imageUrl ? (
              <div className="flex items-center gap-3">
                {/* Preview: frame overlaid on a sample avatar */}
                <div className="relative w-16 h-16 shrink-0">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-2xl">
                    🐻
                  </div>
                  <img
                    src={imageUrl}
                    alt="frame preview"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                    onClick={() => imgRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    เปลี่ยนรูป
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setImageUrl('')}
                    disabled={uploading}
                  >
                    <Trash2 className="w-3 h-3" /> ลบรูป
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button" variant="outline" className="w-full gap-2"
                onClick={() => imgRef.current?.click()}
                disabled={uploading}
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังอัปโหลด...</>
                  : <><Upload className="w-4 h-4" /> อัปโหลดรูปกรอบ</>
                }
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              แนะนำ: PNG โปร่งใส 512×512px · กรอบหนา 40–60px · safe zone กลาง ~380px
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProfileFramesManagement() {
  const { toast } = useToast();
  const [frames, setFrames] = useState<ProfileFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; editing: ProfileFrame | null }>({
    open: false, editing: null,
  });

  const fetchFrames = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('profile_frames')
      .select('*')
      .order('sort_order');
    setFrames(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFrames(); }, [fetchFrames]);

  async function deleteFrame(frame: ProfileFrame) {
    if (!confirm(`ลบกรอบ "${frame.name}"?`)) return;
    // Remove from storage
    const match = frame.image_url.match(/cosmetics\/(.+)$/);
    if (match) await supabase.storage.from('cosmetics').remove([match[1]]);
    await (supabase as any).from('profile_frames').delete().eq('id', frame.id);
    toast({ title: 'ลบกรอบแล้ว' });
    fetchFrames();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Frame className="w-5 h-5 text-[#c8956c]" />
          กรอบโปรไฟล์
        </CardTitle>
        <Button
          size="sm" className="gap-2"
          onClick={() => setDialog({ open: true, editing: null })}
        >
          <Plus className="w-4 h-4" /> เพิ่มกรอบ
        </Button>
      </CardHeader>

      <CardContent>
        {/* Spec callout */}
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm space-y-1.5">
          <p className="font-semibold text-amber-800 dark:text-amber-300">📐 สเปคสำหรับทีมออกแบบ</p>
          <ul className="text-amber-700 dark:text-amber-400 space-y-0.5 text-xs leading-relaxed">
            <li>• <strong>ขนาด:</strong> 512 × 512 px (1:1 square)</li>
            <li>• <strong>กรอบ:</strong> หนา 40–60 px จากขอบ · safe zone กลาง ≈ 380 px</li>
            <li>• <strong>Format:</strong> PNG โปร่งใส (preferred) หรือ WebP</li>
            <li>• <strong>Layering:</strong> avatar เป็น base → frame เป็น <code>absolute inset-0 z-10 object-contain pointer-events-none</code></li>
            <li>• <strong>ขนาดไฟล์:</strong> ไม่เกิน 5 MB</li>
          </ul>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : frames.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Frame className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">ยังไม่มีกรอบโปรไฟล์</p>
            <Button
              variant="outline" size="sm" className="mt-4 gap-2"
              onClick={() => setDialog({ open: true, editing: null })}
            >
              <Plus className="w-4 h-4" /> เพิ่มกรอบแรก
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {frames.map(frame => (
                <motion.div
                  key={frame.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-xl border border-border bg-card p-3 space-y-2 group"
                >
                  {/* Preview */}
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center text-4xl">
                    🐻
                    <img
                      src={frame.image_url}
                      alt={frame.name}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold truncate">{frame.name}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {getCohortLabel(frame.required_cohort)}
                      </Badge>
                      {!frame.is_active && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ปิด</Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 flex-1"
                      onClick={() => setDialog({ open: true, editing: frame })}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 flex-1 text-destructive hover:text-destructive"
                      onClick={() => deleteFrame(frame)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      <FrameDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, editing: null })}
        editing={dialog.editing}
        onSaved={fetchFrames}
      />
    </Card>
  );
}
