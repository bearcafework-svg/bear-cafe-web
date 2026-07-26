import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw, Play, Save, Image as ImageIcon, Trash2, Upload, Copy, Check,
  Settings2, Database, AlertCircle
} from 'lucide-react';

function getBotApiUrl(): string {
  if (import.meta.env.VITE_BOT_API_URL) return import.meta.env.VITE_BOT_API_URL as string;
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

interface BeeConfig {
  id: string;
  name: string;
  enabled: boolean;
  spawn_weight: number;
  sequence_order: number;
  win_rate: number;
  min_win_points: number;
  max_win_points: number;
  min_loss_points: number;
  max_loss_points: number;
  poison_loss_points: number;
  button_delay_ms: number;
  spawn_image_url: string | null;
  win_image_url: string | null;
  lose_image_url: string | null;
  poison_image_url: string | null;
}

interface SystemSetting {
  id: number;
  channel_id: string;
  auto_spawn_enabled: boolean;
  min_spawn_minutes: number;
  max_spawn_minutes: number;
  spawn_mode: 'weighted_random' | 'sequence';
  garden_background_url: string;
}

interface StorageFile {
  name: string;
  url: string;
  created_at?: string;
  size?: number;
}

// ─── Client-side Image Compression Helper ────────────────────────────────────
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = (err) => reject(err);
  });
}

export function BeesManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [spawning, setSpawning] = useState<string | null>(null);

  const [systemSetting, setSystemSetting] = useState<SystemSetting>({
    id: 1,
    channel_id: '1524123413122125964',
    auto_spawn_enabled: true,
    min_spawn_minutes: 5,
    max_spawn_minutes: 10,
    spawn_mode: 'weighted_random',
    garden_background_url: 'https://cdn.discordapp.com/attachments/1528780402544611348/1528780439836430487/Garden.png'
  });

  const [bees, setBees] = useState<BeeConfig[]>([]);
  const [galleryImages, setGalleryImages] = useState<StorageFile[]>([]);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Image Selector Modal State
  const [selectorTarget, setSelectorTarget] = useState<{ field: string; beeId?: string } | null>(null);

  // ─── Fetch Data from Supabase ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch system settings
      const { data: sysData, error: sysErr } = await supabase
        .from('bee_system_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (sysErr) console.warn('bee_system_settings fetch warning:', sysErr.message);
      if (sysData) setSystemSetting(sysData as SystemSetting);

      // 2. Fetch bee configs
      const { data: beesData, error: beesErr } = await supabase
        .from('bee_configs')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (beesErr) console.warn('bee_configs fetch warning:', beesErr.message);

      if (beesData && beesData.length > 0) {
        setBees(beesData as BeeConfig[]);
      } else {
        setBees([
          {
            id: 'fat_round_bee',
            name: 'เจ้าผึ้งอ้วนตัวกลม',
            enabled: true,
            spawn_weight: 1,
            sequence_order: 1,
            win_rate: 0.5,
            min_win_points: 15,
            max_win_points: 50,
            min_loss_points: 15,
            max_loss_points: 50,
            poison_loss_points: 150,
            button_delay_ms: 5000,
            spawn_image_url: 'https://cdn.discordapp.com/attachments/1528780402544611348/1528780439836430487/Garden.png',
            win_image_url: 'https://cdn.discordapp.com/attachments/1528780402544611348/1528780439836430487/Garden.png',
            lose_image_url: 'https://cdn.discordapp.com/attachments/1528780402544611348/1528780439836430487/Garden.png',
            poison_image_url: 'https://cdn.discordapp.com/attachments/1528780402544611348/1528780439836430487/Garden.png'
          }
        ]);
      }

      await fetchGalleryImages();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการโหลดข้อมูล', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchGalleryImages = async () => {
    try {
      const { data, error } = await supabase.storage.from('bee-assets').list('', { limit: 100 });
      if (error) throw error;
      if (data) {
        const files: StorageFile[] = data
          .filter((f) => !f.name.startsWith('.'))
          .map((f) => {
            const { data: pubUrl } = supabase.storage.from('bee-assets').getPublicUrl(f.name);
            return {
              name: f.name,
              url: pubUrl.publicUrl,
              created_at: f.created_at,
              size: f.metadata?.size
            };
          });
        setGalleryImages(files);
      }
    } catch (e: any) {
      console.warn('Storage bucket fetch warning:', e.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Save Single Bee Config to DB ──────────────────────────────────────────
  const saveBeeConfigToDb = async (beeObj: BeeConfig) => {
    // 1. Try upsert
    let { error } = await supabase.from('bee_configs').upsert(beeObj, { onConflict: 'id' });
    if (error) {
      // 2. Fallback update by ID
      const { error: updateErr } = await supabase
        .from('bee_configs')
        .update(beeObj)
        .eq('id', beeObj.id);
      if (updateErr) throw updateErr;
    }
  };

  // ─── Upload Image & AUTO-SAVE to Supabase DB ──────────────────────────────
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, targetField: string, beeId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(beeId ? `${beeId}_${targetField}` : targetField);
    try {
      // 1. Compress Image
      const compressedBlob = await compressImage(file, 1200, 0.82);
      const filename = `bee_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;

      // 2. Upload to Storage Bucket `bee-assets`
      const { error: uploadErr } = await supabase.storage
        .from('bee-assets')
        .upload(filename, compressedBlob, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      // 3. Get Public URL
      const { data: pub } = supabase.storage.from('bee-assets').getPublicUrl(filename);
      const uploadedUrl = pub.publicUrl;

      // 4. AUTO-SAVE directly to Supabase DB
      if (targetField === 'garden_background_url') {
        const updatedSetting = { ...systemSetting, garden_background_url: uploadedUrl };
        setSystemSetting(updatedSetting);

        const { error: sysDbErr } = await supabase.from('bee_system_settings').upsert({
          id: 1,
          ...updatedSetting,
          updated_at: new Date().toISOString()
        });
        if (sysDbErr) console.warn('sysDbErr:', sysDbErr.message);
      } else if (beeId) {
        const updatedBees = bees.map((b) => (b.id === beeId ? { ...b, [targetField]: uploadedUrl } : b));
        setBees(updatedBees);

        const targetBee = updatedBees.find((b) => b.id === beeId);
        if (targetBee) {
          await saveBeeConfigToDb(targetBee);
        }
      }

      toast({
        title: '✨ อัปโหลดและบันทึกรูปภาพลงฐานข้อมูลสำเร็จ!',
        description: 'รูปภาพถูกบันทึกลงตาราง bee_configs บน Supabase เรียบร้อยแล้ว',
      });

      await fetchGalleryImages();
    } catch (err: any) {
      toast({
        title: 'อัปโหลดสำเร็จ แต่บันทึก DB ไม่สำเร็จ',
        description: `โปรดรันสคริปต์ SQL บน Supabase: ${err.message}`,
        variant: 'destructive'
      });
    } finally {
      setUploadingField(null);
    }
  };

  // Assign image from gallery selector
  const handleAssignGalleryImage = async (url: string) => {
    if (!selectorTarget) return;

    const { field, beeId } = selectorTarget;

    try {
      if (field === 'garden_background_url') {
        const updatedSetting = { ...systemSetting, garden_background_url: url };
        setSystemSetting(updatedSetting);

        await supabase.from('bee_system_settings').upsert({
          id: 1,
          ...updatedSetting,
          updated_at: new Date().toISOString()
        });
      } else if (beeId) {
        const updatedBees = bees.map((b) => (b.id === beeId ? { ...b, [field]: url } : b));
        setBees(updatedBees);

        const targetBee = updatedBees.find((b) => b.id === beeId);
        if (targetBee) {
          await saveBeeConfigToDb(targetBee);
        }
      }

      toast({
        title: '🖼️ เลือกรูปภาพและอัปเดต DB เรียบร้อย!',
        description: 'บันทึกรูปภาพลงตาราง bee_configs สำเร็จ',
      });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึก DB', description: err.message, variant: 'destructive' });
    } finally {
      setSelectorTarget(null);
    }
  };

  // Delete Image from Bucket
  const handleDeleteGalleryImage = async (filename: string) => {
    if (!confirm(`คุณต้องการลบรูปภาพ "${filename}" ออกจากคลังใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase.storage.from('bee-assets').remove([filename]);
      if (error) throw error;

      toast({ title: '🗑️ ลบรูปภาพสำเร็จ', description: `ลบไฟล์เรียบร้อยแล้ว` });
      await fetchGalleryImages();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบรูปภาพ', description: err.message, variant: 'destructive' });
    }
  };

  // Save All Settings to Supabase DB
  const handleSaveToSupabase = async () => {
    setSaving(true);
    try {
      // 1. Save system settings
      const { error: sysErr } = await supabase.from('bee_system_settings').upsert({
        id: 1,
        channel_id: systemSetting.channel_id,
        auto_spawn_enabled: systemSetting.auto_spawn_enabled,
        min_spawn_minutes: systemSetting.min_spawn_minutes,
        max_spawn_minutes: systemSetting.max_spawn_minutes,
        spawn_mode: systemSetting.spawn_mode,
        garden_background_url: systemSetting.garden_background_url,
        updated_at: new Date().toISOString()
      });

      if (sysErr) throw new Error(`bee_system_settings: ${sysErr.message}`);

      // 2. Save bee configs
      for (const bee of bees) {
        await saveBeeConfigToDb(bee);
      }

      // Sync via Bot API if running
      fetch(`${getBotApiUrl()}/api/bees/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: systemSetting, bees })
      }).catch(() => { });

      toast({
        title: '🎉 บันทึกข้อมูลลงตาราง bee_configs สำเร็จ!',
        description: 'ข้อมูลและรูปภาพทั้งหมดถูกอัปเดตลง Supabase DB เรียบร้อยแล้ว',
      });
    } catch (err: any) {
      // Fallback: Try saving via Bot API (using Service Role Key)
      try {
        const res = await fetch(`${getBotApiUrl()}/api/bees/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setting: systemSetting, bees })
        });
        const json = await res.json();
        if (json.success) {
          toast({
            title: '🎉 บันทึกข้อมูลผ่าน Bot Engine สำเร็จ!',
            description: 'บันทึกข้อมูลลง Supabase DB ผ่าน Service Role เรียบร้อยแล้ว',
          });
          return;
        }
      } catch (_) { }

      toast({
        title: 'เกิดข้อผิดพลาดในการบันทึก DB (403 Forbidden)',
        description: `โปรดรันไฟล์ sql/create_bee_system.sql บน Supabase SQL Editor เพื่อเปิดสิทธิ์ RLS: ${err.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSpawn = async (beeId?: string) => {
    setSpawning(beeId || 'all');
    try {
      const res = await fetch(`${getBotApiUrl()}/api/bees/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beeId }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: '🐝 สั่งปล่อยเจ้าผึ้งลง Discord สำเร็จ!',
          description: `ส่งไปยังห้อง Discord เรียบร้อยแล้ว`,
        });
      } else {
        toast({ title: 'ปล่อยผึ้งไม่สำเร็จ', description: json.error || 'โปรดตรวจสอบสิทธิ์ของบอท', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'ไม่สามารถเชื่อมต่อกับบอทได้', description: 'โปรดตรวจสอบว่าบอทเปิดรันอยู่', variant: 'destructive' });
    } finally {
      setSpawning(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast({ title: 'คัดลอกลิงก์รูปภาพเรียบร้อย' });
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const currentBee = bees[0] || null;

  return (
    <div className="space-y-6 p-4 md:p-6 text-foreground max-w-7xl mx-auto">
      {/* Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-6 rounded-2xl border border-amber-500/30 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐝</span>
            <h1 className="text-2xl font-bold tracking-tight text-amber-400">
              ระบบจัดการเจ้าผึ้งประจำสวนคาเฟ่หมี
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            ปรับแต่งรูปภาพสวน, รูปภาพน้องผึ้ง, อัตราชนะ/แพ้ และควบคุมการปล่อยผึ้งลง Discord ได้ง่ายๆ ที่นี่
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2 border-amber-500/30 text-amber-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            ดึงข้อมูลล่าสุด
          </Button>
          <Button
            size="sm"
            onClick={handleSaveToSupabase}
            disabled={saving}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md"
          >
            <Save className="w-4 h-4" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมดลง DB'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="main" className="space-y-6">
        <TabsList className="bg-card/60 border border-border/50 p-1 rounded-xl">
          <TabsTrigger value="main" className="gap-2">
            <span>🐝</span> การตั้งค่ารูปภาพ & แต้มผึ้ง
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2">
            <span>🖼️</span> คลังภาพที่เคยอัปโหลด ({galleryImages.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Main Settings */}
        <TabsContent value="main" className="space-y-6">
          {/* System Config Box */}
          <Card className="border border-amber-500/20 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-300">
                <Settings2 className="w-5 h-5" />
                ⚙️ การตั้งค่าระบบสุ่มปล่อยผึ้ง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">📌 ID ห้อง Discord สำหรับปล่อยผึ้ง</Label>
                  <Input
                    value={systemSetting.channel_id}
                    onChange={(e) => setSystemSetting({ ...systemSetting, channel_id: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="1524123413122125964"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">⏰ ปล่อยผึ้งอัตโนมัติทุกๆ (นาที)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={systemSetting.min_spawn_minutes}
                      onChange={(e) => setSystemSetting({ ...systemSetting, min_spawn_minutes: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <span>ถึง</span>
                    <Input
                      type="number"
                      value={systemSetting.max_spawn_minutes}
                      onChange={(e) => setSystemSetting({ ...systemSetting, max_spawn_minutes: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">นาที</span>
                  </div>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/50">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">เปิดปล่อยผึ้งอัตโนมัติ</Label>
                      <p className="text-[11px] text-muted-foreground">ผึ้งจะบินสุ่มมาเองตามเวลา</p>
                    </div>
                    <Switch
                      checked={systemSetting.auto_spawn_enabled}
                      onCheckedChange={(val) => setSystemSetting({ ...systemSetting, auto_spawn_enabled: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => handleTestSpawn()}
                  disabled={spawning === 'all'}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-xs h-9"
                >
                  <Play className="w-4 h-4" />
                  {spawning === 'all' ? 'กำลังส่งลง Discord...' : '🚀 ทดสอบปล่อยผึ้งลง Discord ทันที'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Garden Background Image Tile */}
          <Card className="border border-amber-500/30 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-amber-300 flex items-center gap-2">
                🏡 ภาพพื้นหลังสวนผึ้ง (Garden Background)
              </CardTitle>
              <CardDescription className="text-xs">
                ภาพนี้จะถูกนำไปใช้เป็นภาพการ์ดขนาดใหญ่ด้านล่างในข้อความ Discord
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-64 aspect-video rounded-xl overflow-hidden border border-border bg-muted/20 relative group flex items-center justify-center">
                  <img
                    src={systemSetting.garden_background_url}
                    alt="Garden Background"
                    className="max-h-full max-w-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <Input
                    value={systemSetting.garden_background_url}
                    onChange={(e) => setSystemSetting({ ...systemSetting, garden_background_url: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="URL รูปภาพสวน..."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(e, 'garden_background_url')}
                      />
                      <Button variant="default" size="sm" asChild disabled={uploadingField === 'garden_background_url'} className="gap-2 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                        <span>
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingField === 'garden_background_url' ? 'กำลังบีบอัด/บันทึก...' : '📤 อัปโหลดรูปภาพใหม่ (ย่อไฟล์ให้อัตโนมัติ)'}
                        </span>
                      </Button>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectorTarget({ field: 'garden_background_url' })}
                      className="gap-2 text-xs border-amber-500/30 text-amber-300"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      🖼️ เลือกจากคลังภาพที่มี
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bee Character Details & Image Tiles */}
          {currentBee && (
            <Card className="border border-amber-500/40 bg-card/80">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
                    <span>🐝</span> {currentBee.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    ตั้งค่ารูปภาพของน้องผึ้งในแต่ละสถานะ และปรับแต่งแต้มชนะ/แพ้
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestSpawn(currentBee.id)}
                  disabled={spawning === currentBee.id}
                  className="gap-1.5 text-xs border-amber-500/40 text-amber-300"
                >
                  <Play className="w-3.5 h-3.5" />
                  ทดสอบปล่อยผึ้งตัวนี้
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rate & Point Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-background/50 border border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                      🎯 โอกาสชนะของผู้เล่น (%)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        value={Math.round((currentBee.win_rate || 0.5) * 100)}
                        onChange={(e) => {
                          const pct = Math.min(100, Math.max(0, Number(e.target.value)));
                          setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, win_rate: pct / 100 } : b)));
                        }}
                        className="font-bold text-amber-400"
                      />
                      <span className="text-xs text-muted-foreground font-mono">%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      🍓 แต้มสตรอว์เบอร์รีเมื่อชนะ
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={currentBee.min_win_points}
                        onChange={(e) =>
                          setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, min_win_points: Number(e.target.value) } : b)))
                        }
                        className="text-xs"
                      />
                      <span>ถึง</span>
                      <Input
                        type="number"
                        value={currentBee.max_win_points}
                        onChange={(e) =>
                          setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, max_win_points: Number(e.target.value) } : b)))
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                      🐝 แต้มที่โดนขโมยเมื่อแพ้
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={currentBee.min_loss_points}
                        onChange={(e) =>
                          setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, min_loss_points: Number(e.target.value) } : b)))
                        }
                        className="text-xs"
                      />
                      <span>ถึง</span>
                      <Input
                        type="number"
                        value={currentBee.max_loss_points}
                        onChange={(e) =>
                          setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, max_loss_points: Number(e.target.value) } : b)))
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                      💀 แต้มติดพิษ (แต้มหมด)
                    </Label>
                    <Input
                      type="number"
                      value={currentBee.poison_loss_points}
                      onChange={(e) =>
                        setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, poison_loss_points: Number(e.target.value) } : b)))
                      }
                      className="text-xs text-rose-400 font-bold"
                    />
                  </div>
                </div>

                {/* 4 Bee State Image Tiles */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <span>🖼️</span> รูปภาพแสดงตัวน้องผึ้งในแต่ละสถานะ (4 รูปภาพ)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'spawn_image_url', title: '1. ตอนผึ้งโผล่บินมา (Spawn)', desc: 'ภาพน้องผึ้งตอนบินโผล่มาในสวน' },
                      { key: 'win_image_url', title: '2. ตอนผู้เล่นชนะ (Win)', desc: 'ภาพน้องผึ้งตอนตกใจโดนแย่งแต้ม' },
                      { key: 'lose_image_url', title: '3. ตอนผึ้งต่อยผู้เล่นแพ้ (Loss)', desc: 'ภาพน้องผึ้งตอนต่อยขโมยแต้ม' },
                      { key: 'poison_image_url', title: '4. ตอนผู้เล่นติดพิษ (Poison Loss)', desc: 'ภาพน้องผึ้งปล่อยพิษเมื่อแต้มหมด' },
                    ].map(({ key, title, desc }) => {
                      const imgUrl = (currentBee as any)[key] || systemSetting.garden_background_url;
                      const isUploadingThis = uploadingField === `${currentBee.id}_${key}`;

                      return (
                        <div key={key} className="border border-border/60 rounded-xl p-3 bg-background/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-300">{title}</span>
                            <span className="text-[11px] text-muted-foreground">{desc}</span>
                          </div>

                          <div className="flex gap-3 items-center">
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted/20 shrink-0 flex items-center justify-center p-1">
                              <img src={imgUrl} alt={title} className="max-h-full max-w-full object-contain" />
                            </div>

                            <div className="flex-1 space-y-2">
                              <Input
                                value={(currentBee as any)[key] || ''}
                                onChange={(e) =>
                                  setBees(bees.map((b) => (b.id === currentBee.id ? { ...b, [key]: e.target.value } : b)))
                                }
                                className="font-mono text-[11px] h-7"
                                placeholder="URL รูปภาพ..."
                              />

                              <div className="flex flex-wrap gap-1.5">
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleUploadImage(e, key, currentBee.id)}
                                  />
                                  <Button variant="default" size="sm" asChild disabled={isUploadingThis} className="h-7 text-[11px] gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                                    <span>
                                      <Upload className="w-3 h-3" />
                                      {isUploadingThis ? 'กำลังอัปโหลด...' : '📤 เปลี่ยนภาพนี้'}
                                    </span>
                                  </Button>
                                </label>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectorTarget({ field: key, beeId: currentBee.id })}
                                  className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-300"
                                >
                                  <ImageIcon className="w-3 h-3" /> เลือกจากคลัง
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Storage Gallery */}
        <TabsContent value="gallery" className="space-y-6">
          <Card className="border border-border/50 bg-card/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
                  <ImageIcon className="w-5 h-5" />
                  🖼️ คลังรูปภาพในระบบ (Storage Bucket: bee-assets)
                </CardTitle>
                <CardDescription className="text-xs">
                  ภาพทั้งหมดที่เคยอัปโหลด สามารถกดลบไฟล์ออกหรือคัดลอกลิงก์ไปใช้ได้ทันที
                </CardDescription>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadImage(e, 'garden_background_url')}
                />
                <Button variant="default" size="sm" asChild className="gap-2 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                  <span>
                    <Upload className="w-4 h-4" /> อัปโหลดไฟล์ภาพเพิ่ม
                  </span>
                </Button>
              </label>
            </CardHeader>
            <CardContent>
              {galleryImages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl text-xs">
                  ยังไม่มีรูปภาพในคลัง กดอัปโหลดภาพใหม่ได้เลยครับ
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {galleryImages.map((img) => (
                    <div key={img.name} className="group relative border border-border/60 bg-background/50 rounded-xl overflow-hidden shadow-sm">
                      <div className="aspect-square bg-muted/20 relative overflow-hidden flex items-center justify-center p-2">
                        <img src={img.url} alt={img.name} className="max-h-full max-w-full object-contain rounded-md" />
                      </div>
                      <div className="p-2 space-y-1 bg-card/90 border-t border-border/40 text-xs">
                        <p className="font-mono text-[10px] truncate text-muted-foreground" title={img.name}>
                          {img.name}
                        </p>
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyUrl(img.url)}
                            className="h-6 w-6 text-amber-400 hover:bg-amber-500/10"
                            title="คัดลอก URL"
                          >
                            {copiedUrl === img.url ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteGalleryImage(img.name)}
                            className="h-6 w-6 text-rose-400 hover:bg-rose-500/10"
                            title="ลบไฟล์รูปภาพออก"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Selector Modal */}
      <Dialog open={Boolean(selectorTarget)} onOpenChange={() => setSelectorTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-300 flex items-center gap-2">
              🖼️ เลือกรูปภาพจากคลัง (Storage Bucket: bee-assets)
            </DialogTitle>
            <DialogDescription className="text-xs">
              คลิกเลือกรูปภาพที่ต้องการเพื่อนำมาใส่ในช่องตั้งค่าและอัปเดตลงระบบทันที
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {galleryImages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                ยังไม่มีรูปภาพในคลังภาพ กรุณาอัปโหลดรูปภาพใหม่ก่อนครับ
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {galleryImages.map((img) => (
                  <div
                    key={img.name}
                    onClick={() => handleAssignGalleryImage(img.url)}
                    className="group border border-border/60 hover:border-amber-500 bg-background/50 rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] p-2 space-y-2 flex flex-col items-center"
                  >
                    <div className="aspect-square w-full bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center p-1">
                      <img src={img.url} alt={img.name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <p className="font-mono text-[10px] truncate text-muted-foreground w-full text-center" title={img.name}>
                      {img.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
