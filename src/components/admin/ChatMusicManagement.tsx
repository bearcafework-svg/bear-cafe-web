import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Trash2, Edit, Music2, Folder, ChevronDown, ChevronRight,
  Upload, FileAudio, X, Check, Play, Square, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface MusicCategory {
  id: string;
  label: string;
  sort_order: number;
}

interface MusicTrack {
  id: string;
  category_id: string;
  title: string;
  src: string;
  sort_order: number;
  artist?: string | null;
  image_url?: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ─── Audio Converter (Web Audio API + MediaRecorder — no WASM needed) ─────────
// Decodes audio via AudioContext, re-encodes via MediaRecorder to webm/opus
interface ConvertResult {
  blob: Blob;
  originalSize: number;
  convertedSize: number;
}

async function convertToWebm(
  file: File,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  onProgress(5);

  // 1. Decode the source audio into raw PCM via AudioContext
  const arrayBuffer = await file.arrayBuffer();
  onProgress(20);

  const offlineCtx = new OfflineAudioContext(2, 1, 44100);
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
  } catch {
    // Fallback: try with a standard AudioContext
    const ctx = new AudioContext();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    ctx.close();
  }
  onProgress(40);

  // 2. Re-render through OfflineAudioContext at target sample rate
  const sampleRate = 44100;
  const renderCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.duration * sampleRate),
    sampleRate,
  );
  const src = renderCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(renderCtx.destination);
  src.start(0);
  const renderedBuffer = await renderCtx.startRendering();
  onProgress(60);

  // 3. Encode to webm/opus via MediaRecorder
  // Convert AudioBuffer → MediaStream via AudioContext + createMediaStreamDestination
  const streamCtx = new AudioContext({ sampleRate });
  const dest = streamCtx.createMediaStreamDestination();
  const bufSrc = streamCtx.createBufferSource();
  bufSrc.buffer = renderedBuffer;
  bufSrc.connect(dest);

  // Pick best supported mime type
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/ogg;codecs=opus';

  const recorder = new MediaRecorder(dest.stream, {
    mimeType,
    audioBitsPerSecond: 64_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = e => reject(new Error(`MediaRecorder error: ${(e as any).error?.message ?? 'unknown'}`));
    recorder.start(100); // collect in 100ms chunks
    bufSrc.start(0);
    bufSrc.onended = () => {
      setTimeout(() => recorder.stop(), 200); // small buffer after audio ends
    };
  });

  streamCtx.close();
  onProgress(95);

  const blob = new Blob(chunks, { type: mimeType });
  onProgress(100);

  return { blob, originalSize: file.size, convertedSize: blob.size };
}

// ─── Gapless Loop Preview (Web Audio API) ────────────────────────────────────
function useGaplessPreview() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(async (blob: Blob) => {
    stop();
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = true; // gapless via Web Audio API
    src.connect(ctx.destination);
    src.start(0);
    sourceRef.current = src;
    setPlaying(true);
  }, [stop]);

  // Cleanup on unmount — prevent memory leak
  useEffect(() => () => {
    stop();
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, [stop]);

  return { playing, play, stop };
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────
function UploadTab({
  categories,
  onUploaded,
}: {
  categories: MusicCategory[];
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preview = useGaplessPreview();

  interface UploadItem {
    file: File;
    title: string;
    artist: string;
    categoryId: string;
    imageFile: File | null;
    imageUrl: string;
    status: 'pending' | 'converting' | 'uploading' | 'done' | 'error';
    progress: number;
    convertProgress: number;
    originalSize: number;
    convertedSize: number | null;
    convertedBlob: Blob | null;
    error?: string;
  }

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const defaultCat = categories[0]?.id ?? '';
    const newItems: UploadItem[] = Array.from(files)
      .filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|ogg|wav|flac|aac)$/i))
      .map(f => ({
        file: f,
        title: f.name.replace(/\.[^.]+$/, ''),
        artist: '',
        categoryId: defaultCat,
        imageFile: null,
        imageUrl: '',
        status: 'pending' as const,
        progress: 0,
        convertProgress: 0,
        originalSize: f.size,
        convertedSize: null,
        convertedBlob: null,
      }));
    if (newItems.length === 0) {
      toast({ title: 'ไม่พบไฟล์เสียง', description: 'รองรับ MP3, OGG, WAV, FLAC, AAC', variant: 'destructive' });
      return;
    }
    setItems(prev => [...prev, ...newItems]);
  }

  function removeItem(idx: number) {
    if (previewIdx === idx) { preview.stop(); setPreviewIdx(null); }
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<UploadItem>) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  async function togglePreview(idx: number) {
    const item = items[idx];
    if (!item.convertedBlob) return;
    if (previewIdx === idx && preview.playing) {
      preview.stop();
      setPreviewIdx(null);
    } else {
      setPreviewIdx(idx);
      await preview.play(item.convertedBlob);
    }
  }

  async function uploadAll() {
    const pending = items.filter(i => i.status === 'pending');
    if (pending.length === 0) return;
    if (categories.length === 0) {
      toast({ title: 'กรุณาเพิ่มหมวดหมู่ก่อน', variant: 'destructive' });
      return;
    }
    setUploading(true);
    let successCount = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.status !== 'pending') continue;

      console.log(`[upload] ▶ [${idx}] เริ่มประมวลผล: "${item.title}" (${formatBytes(item.file.size)}, type=${item.file.type})`);

      // ── Step 1: Convert with ffmpeg.wasm ──
      updateItem(idx, { status: 'converting', progress: 5, convertProgress: 0 });
      let convertedBlob: Blob;
      let convertedSize = 0;

      try {
        console.log(`[upload] 🔄 [${idx}] เริ่มแปลงไฟล์ด้วย ffmpeg...`);
        const result = await convertToWebm(item.file, (pct) => {
          updateItem(idx, { convertProgress: pct, progress: Math.round(pct * 0.6) });
        });
        convertedBlob = result.blob;
        convertedSize = result.convertedSize;
        console.log(`[upload] ✅ [${idx}] แปลงเสร็จ: ${formatBytes(result.originalSize)} → ${formatBytes(convertedSize)}, blob.type=${convertedBlob.type}`);
        updateItem(idx, { convertedBlob, convertedSize, progress: 65 });
      } catch (e: any) {
        console.error(`[upload] ❌ [${idx}] แปลงไฟล์ล้มเหลว:`, e);
        updateItem(idx, { status: 'error', progress: 0, error: `แปลงไฟล์ไม่สำเร็จ: ${e.message}` });
        toast({ title: `แปลงไฟล์ล้มเหลว: ${item.title}`, description: e.message, variant: 'destructive' });
        continue;
      }

      // ── Step 2: Upload .webm to Supabase Storage ──
      updateItem(idx, { status: 'uploading', progress: 70 });
      try {
        const ext = convertedBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const path = `${Date.now()}_${sanitizeFilename(item.title)}.${ext}`;
        const contentType = convertedBlob.type || 'audio/webm';
        console.log(`[upload] ☁️ [${idx}] กำลังอัปโหลดไปที่ bucket "chat-music", path="${path}", size=${formatBytes(convertedSize)}, type=${contentType}`);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-music')
          .upload(path, convertedBlob, { contentType });

        if (uploadError) {
          console.error(`[upload] ❌ [${idx}] Storage error:`, JSON.stringify(uploadError, null, 2));
          throw new Error(`Storage: ${uploadError.message} (status=${(uploadError as any).statusCode ?? 'unknown'})`);
        }

        console.log(`[upload] ✅ [${idx}] อัปโหลดสำเร็จ:`, uploadData);
        updateItem(idx, { progress: 85 });

        const { data: urlData } = supabase.storage.from('chat-music').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;
        console.log(`[upload] 🔗 [${idx}] Public URL: ${publicUrl}`);

        // ── Step 3: Insert DB record ──
        console.log(`[upload] 💾 [${idx}] บันทึกลง DB, category_id="${item.categoryId}"`);
        const { data: existing } = await (supabase as any)
          .from('chat_music_tracks')
          .select('sort_order')
          .eq('category_id', item.categoryId)
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;

        // Upload cover image if provided
        let coverUrl: string | null = null;
        if (item.imageFile) {
          const imgExt = item.imageFile.name.split('.').pop() ?? 'jpg';
          const imgPath = `covers/${Date.now()}_${sanitizeFilename(item.title)}.${imgExt}`;
          const { error: imgErr } = await supabase.storage
            .from('chat-music')
            .upload(imgPath, item.imageFile, { contentType: item.imageFile.type });
          if (!imgErr) {
            const { data: imgUrl } = supabase.storage.from('chat-music').getPublicUrl(imgPath);
            coverUrl = imgUrl.publicUrl;
          }
        }

        const { error: dbError } = await (supabase as any)
          .from('chat_music_tracks')
          .insert({
            category_id: item.categoryId,
            title: item.title.trim() || item.file.name,
            artist: item.artist.trim() || null,
            src: publicUrl,
            image_url: coverUrl,
            sort_order: nextOrder,
          });

        if (dbError) {
          console.error(`[upload] ❌ [${idx}] DB error:`, JSON.stringify(dbError, null, 2));
          throw new Error(`DB: ${dbError.message}`);
        }

        console.log(`[upload] ✅ [${idx}] บันทึก DB สำเร็จ`);
        updateItem(idx, { status: 'done', progress: 100 });
        successCount++;
      } catch (e: any) {
        console.error(`[upload] ❌ [${idx}] ล้มเหลว:`, e);
        updateItem(idx, { status: 'error', progress: 0, error: e.message });
        toast({ title: `อัปโหลดล้มเหลว: ${item.title}`, description: e.message, variant: 'destructive' });
      }
    }

    setUploading(false);
    onUploaded();
    console.log(`[upload] 🏁 เสร็จสิ้น: สำเร็จ ${successCount} ไฟล์`);
    if (successCount > 0) toast({ title: `อัปโหลดเสร็จแล้ว ${successCount} ไฟล์` });
  }

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        อัปโหลดไฟล์เสียง ระบบจะ <strong>แปลงเป็น WebM (Opus 64kbps)</strong> อัตโนมัติก่อนอัปโหลด เพื่อลดขนาดและรองรับ Gapless Loop
      </p>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.ogg,.wav,.flac,.aac"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-sm">คลิกหรือลากไฟล์มาวางที่นี่</p>
        <p className="text-xs text-muted-foreground mt-1">รองรับ MP3, OGG, WAV, FLAC, AAC · จะแปลงเป็น WebM อัตโนมัติ</p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{items.length} ไฟล์ · {doneCount} เสร็จแล้ว</p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setItems(prev => prev.filter(i => i.status !== 'done'))}
                disabled={doneCount === 0}
              >
                ล้างรายการที่เสร็จ
              </Button>
              <Button
                size="sm" className="gap-2"
                onClick={uploadAll}
                disabled={uploading || pendingCount === 0 || categories.length === 0}
              >
                {uploading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
                {uploading ? 'กำลังประมวลผล...' : `แปลง & อัปโหลด ${pendingCount} ไฟล์`}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {items.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-xl border p-3 space-y-2 transition-colors ${
                    item.status === 'done'       ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20' :
                    item.status === 'error'      ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20' :
                    item.status === 'converting' ? 'border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      {item.status === 'done'       ? <Check className="w-4 h-4 text-emerald-600" /> :
                       item.status === 'error'      ? <X className="w-4 h-4 text-red-500" /> :
                       item.status === 'converting' ? <Loader2 className="w-4 h-4 text-violet-500 animate-spin" /> :
                       item.status === 'uploading'  ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> :
                       <FileAudio className="w-4 h-4 text-muted-foreground" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Title input */}
                      <Input
                        value={item.title}
                        onChange={e => updateItem(idx, { title: e.target.value })}
                        placeholder="ชื่อเพลง"
                        disabled={item.status !== 'pending'}
                        className="h-8 text-sm"
                      />
                      {/* Artist input */}
                      <Input
                        value={item.artist}
                        onChange={e => updateItem(idx, { artist: e.target.value })}
                        placeholder="ชื่อศิลปิน (ไม่บังคับ)"
                        disabled={item.status !== 'pending'}
                        className="h-7 text-xs"
                      />

                      {/* Cover image upload */}
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="file" accept="image/*" className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const url = URL.createObjectURL(f);
                                  updateItem(idx, { imageFile: f, imageUrl: url });
                                }
                                e.target.value = '';
                              }}
                            />
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="cover" className="w-8 h-8 rounded-lg object-cover border border-border" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary/50 transition-colors">
                                <Upload className="w-3.5 h-3.5 text-muted-foreground/50" />
                              </div>
                            )}
                          </label>
                          {item.imageUrl && (
                            <button
                              onClick={() => updateItem(idx, { imageFile: null, imageUrl: '' })}
                              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                            >
                              ลบรูป
                            </button>
                          )}
                          <span className="text-[10px] text-muted-foreground">รูปปก (ไม่บังคับ)</span>
                        </div>
                      )}

                      {/* Category + size info */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={item.categoryId}
                          onChange={e => updateItem(idx, { categoryId: e.target.value })}
                          disabled={item.status !== 'pending'}
                          className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>

                        {/* Size comparison */}
                        <span className="text-[11px] text-muted-foreground">
                          {formatBytes(item.originalSize)}
                          {item.convertedSize !== null && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {' → '}{formatBytes(item.convertedSize)}
                              {' '}
                              <span className="text-[10px]">
                                (-{Math.round((1 - item.convertedSize / item.originalSize) * 100)}%)
                              </span>
                            </span>
                          )}
                        </span>

                        {item.status === 'error' && (
                          <span className="text-[11px] text-red-500">{item.error}</span>
                        )}
                      </div>

                      {/* Progress: converting */}
                      {item.status === 'converting' && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                            🎵 กำลังรีดไขมันเพลง... {item.convertProgress}%
                          </span>
                          <Progress value={item.convertProgress} className="h-1.5 [&>div]:bg-violet-500" />
                        </div>
                      )}

                      {/* Progress: uploading */}
                      {item.status === 'uploading' && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            ☁️ กำลังอัปโหลด...
                          </span>
                          <Progress value={item.progress} className="h-1.5" />
                        </div>
                      )}

                      {/* Preview loop button — shown after done */}
                      {item.status === 'done' && item.convertedBlob && (
                        <button
                          onClick={() => togglePreview(idx)}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                            previewIdx === idx && preview.playing
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {previewIdx === idx && preview.playing
                            ? <><Square className="w-3 h-3" /> หยุดฟัง Loop</>
                            : <><Play className="w-3 h-3" /> ลองฟัง Gapless Loop</>}
                        </button>
                      )}
                    </div>

                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Dialog ──────────────────────────────────────────────────────────
function CategoryDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicCategory | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(editing?.label ?? ''); }, [editing, open]);

  async function handleSave() {
    if (!label.trim()) { toast({ title: 'กรุณากรอกชื่อหมวด', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from('chat_music_categories').update({ label: label.trim() }).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'อัปเดตหมวดแล้ว' });
      } else {
        const { data: ex } = await (supabase as any).from('chat_music_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const { error } = await (supabase as any).from('chat_music_categories').insert({ label: label.trim(), sort_order: ((ex?.[0]?.sort_order ?? -1) as number) + 1 });
        if (error) throw error;
        toast({ title: 'เพิ่มหมวดแล้ว' });
      }
      onSaved(); onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>ชื่อหมวดหมู่ *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="เช่น Lo-fi Chill, Jazz Cafe" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Track Edit Dialog ────────────────────────────────────────────────────────
function TrackEditDialog({
  open, onClose, editing, categories, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: MusicTrack | null;
  categories: MusicCategory[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', artist: '', src: '', category_id: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      title: editing?.title ?? '',
      artist: editing?.artist ?? '',
      src: editing?.src ?? '',
      category_id: editing?.category_id ?? categories[0]?.id ?? '',
      image_url: editing?.image_url ?? '',
    });
  }, [editing, open]);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'กรุณาเลือกไฟล์รูปภาพ', variant: 'destructive' });
      return;
    }
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `covers/${Date.now()}_${sanitizeFilename(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
      const { error } = await supabase.storage.from('chat-music').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('chat-music').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: urlData.publicUrl }));
      toast({ title: 'อัปโหลดรูปปกแล้ว' });
    } catch (e: any) {
      toast({ title: 'อัปโหลดรูปล้มเหลว', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleRemoveImage() {
    if (!form.image_url) return;
    // Try to delete from storage if it's our bucket
    const match = form.image_url.match(/chat-music\/(.+)$/);
    if (match) {
      await supabase.storage.from('chat-music').remove([match[1]]);
    }
    setForm(f => ({ ...f, image_url: '' }));
  }

  async function handleSave() {
    if (!form.title.trim()) { toast({ title: 'กรุณากรอกชื่อเพลง', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('chat_music_tracks')
        .update({
          title: form.title.trim(),
          artist: form.artist.trim() || null,
          src: form.src.trim(),
          category_id: form.category_id,
          image_url: form.image_url.trim() || null,
        })
        .eq('id', editing!.id);
      if (error) throw error;
      toast({ title: 'อัปเดตเพลงแล้ว' });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>แก้ไขเพลง</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>หมวดหมู่</Label>
            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อเพลง *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อศิลปิน</Label>
            <Input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="เช่น Nujabes, Idealism..." />
          </div>
          <div className="space-y-1.5">
            <Label>URL เพลง</Label>
            <Input value={form.src} onChange={e => setForm(f => ({ ...f, src: e.target.value }))} placeholder="https://..." />
            <p className="text-[11px] text-muted-foreground">URL จะอัปเดตอัตโนมัติถ้าอัปโหลดผ่านระบบ</p>
          </div>

          {/* Cover image — upload or remove */}
          <div className="space-y-1.5">
            <Label>รูปปก — แสดงบนแผ่นเสียง</Label>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
            />
            {form.image_url ? (
              <div className="flex items-center gap-3">
                <img
                  src={form.image_url}
                  alt="cover"
                  className="w-16 h-16 rounded-xl object-cover border border-border"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                    onClick={() => imgInputRef.current?.click()}
                    disabled={uploadingImg}
                  >
                    {uploadingImg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    เปลี่ยนรูป
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive"
                    onClick={handleRemoveImage}
                    disabled={uploadingImg}
                  >
                    <Trash2 className="w-3 h-3" /> ลบรูป
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button" variant="outline" size="sm" className="gap-2 w-full"
                onClick={() => imgInputRef.current?.click()}
                disabled={uploadingImg}
              >
                {uploadingImg
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังอัปโหลด...</>
                  : <><Upload className="w-4 h-4" /> อัปโหลดรูปปก</>
                }
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving || uploadingImg}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || uploadingImg}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────
function LibraryTab({
  categories, tracks, onRefresh,
}: {
  categories: MusicCategory[];
  tracks: MusicTrack[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(categories.map(c => c.id)));
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: MusicCategory | null }>({ open: false, editing: null });
  const [trackDialog, setTrackDialog] = useState<{ open: boolean; editing: MusicTrack | null }>({ open: false, editing: null });

  useEffect(() => {
    setExpandedCats(new Set(categories.map(c => c.id)));
  }, [categories]);

  async function deleteCategory(cat: MusicCategory) {
    if (!confirm(`ลบหมวด "${cat.label}" และเพลงทั้งหมด?`)) return;
    // Delete storage files
    const catTracks = tracks.filter(t => t.category_id === cat.id);
    for (const t of catTracks) {
      const path = t.src.split('/chat-music/').pop();
      if (path) await supabase.storage.from('chat-music').remove([path]);
    }
    await (supabase as any).from('chat_music_categories').delete().eq('id', cat.id);
    toast({ title: 'ลบหมวดแล้ว' });
    onRefresh();
  }

  async function deleteTrack(track: MusicTrack) {
    if (!confirm(`ลบเพลง "${track.title}"?`)) return;
    // Delete storage file
    const path = track.src.split('/chat-music/').pop();
    if (path) await supabase.storage.from('chat-music').remove([path]);
    await (supabase as any).from('chat_music_tracks').delete().eq('id', track.id);
    toast({ title: 'ลบเพลงแล้ว' });
    onRefresh();
  }

  function toggleExpand(id: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
          <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">ยังไม่มีหมวดหมู่</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setCatDialog({ open: true, editing: null })}>
            <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่แรก
          </Button>
        </div>
      ) : (
        categories.map(cat => {
          const catTracks = tracks.filter(t => t.category_id === cat.id);
          const expanded = expandedCats.has(cat.id);
          return (
            <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                <button onClick={() => toggleExpand(cat.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                  {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <Folder className="w-4 h-4 text-[#c8956c] shrink-0" />
                  <span className="font-semibold text-sm truncate">{cat.label}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{catTracks.length} เพลง</Badge>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCatDialog({ open: true, editing: cat })}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCategory(cat)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {expanded && (
                <div className="divide-y divide-border/50">
                  {catTracks.length === 0 ? (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">ยังไม่มีเพลง — อัปโหลดได้ที่แท็บ "อัปโหลด"</div>
                  ) : (
                    catTracks.map((track, i) => (
                      <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 group">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{track.title}</p>
                          {track.artist && (
                            <p className="text-[11px] text-[#c8956c] truncate">{track.artist}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground truncate">{track.src}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTrackDialog({ open: true, editing: track })}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTrack(track)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <CategoryDialog open={catDialog.open} onClose={() => setCatDialog({ open: false, editing: null })} editing={catDialog.editing} onSaved={onRefresh} />
      <TrackEditDialog open={trackDialog.open} onClose={() => setTrackDialog({ open: false, editing: null })} editing={trackDialog.editing} categories={categories} onSaved={onRefresh} />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function ChatMusicManagement() {
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  // Keep active tab stable — don't reset to 'upload' on data refresh
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');

  const fetchAll = useCallback(async () => {
    // Fetch without resetting loading to avoid tab flicker
    const [catRes, trackRes] = await Promise.all([
      (supabase as any).from('chat_music_categories').select('*').order('sort_order'),
      (supabase as any).from('chat_music_tracks').select('*').order('sort_order'),
    ]);
    setCategories(catRes.data ?? []);
    setTracks(trackRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="w-5 h-5" />
          จัดการเพลง BGM
          <Badge variant="secondary" className="text-xs">{tracks.length} เพลง</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          เพลงที่เพิ่มที่นี่จะแสดงใน Music Player ของห้องแชทคาเฟ่ลับ
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'upload' | 'library')}>
            <TabsList className="mb-4">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" /> อัปโหลดเพลง
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2">
                <Music2 className="w-4 h-4" /> คลังเพลง
                <Badge variant="secondary" className="text-[10px]">{tracks.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <UploadTab categories={categories} onUploaded={fetchAll} />
            </TabsContent>
            <TabsContent value="library">
              <LibraryTab categories={categories} tracks={tracks} onRefresh={fetchAll} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
