import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  Ban,
  AlertTriangle,
  Clock,
  User,
  Shield,
  Hash,
  MessageSquare,
  Gavel,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  EyeOff
} from 'lucide-react';

// URL API เดิมของคุณ
const API_URL = 'https://script.google.com/macros/s/AKfycbycKl_xUfYzwRwRNRH2D9P-nRlx-KClzRRInEVHBWqZfCjzMmmuM9Yt9UfY_e1cjsQV1A/exec';

interface WarnRecord {
  timestamp: string;
  sequence: string;
  email: string;
  baristaId: string;
  memberId: string;
  warningMessage: string;
  punishment: string;
  punishmentLink: string;
  image: string;
  cancelStatus: string;
  _cancelledAt?: string;
  _cancelledBy?: string;
  _localCancelled?: boolean;
  _showBlur?: boolean;
}

function resolveDisplayName(id: string): string {
  if (!id) return '-';
  if (id.length > 8) return `User-${id.slice(-4)}`;
  return id;
}

function formatTimestamp(raw: string): string {
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseImages(imageField: string): string[] {
  if (!imageField || !imageField.trim()) return [];
  return imageField
    .split(',')
    .map((url) => {
      const trimmed = url.trim();
      const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = fileMatch ? fileMatch[1] : (idMatch ? idMatch[1] : null);

      if (fileId) {
        // 💡 ใช้บริการ Proxy รูปภาพฟรี (wsrv.nl) เพื่อทะลุกำแพงการบล็อกของ Google
        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        return `https://wsrv.nl/?url=${encodeURIComponent(driveUrl)}`;
      }
      return trimmed;
    })
    .filter((url) => url.length > 0);
}

export default function TagWarnLogsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const hasAdminAccess = user?.is_admin || user?.is_owner;

  const [records, setRecords] = useState<WarnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<WarnRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user && !hasAdminAccess) {
      navigate('/');
    }
  }, [user, hasAdminAccess, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ใส่ timestamp กัน cache
      const res = await fetch(`${API_URL}?t=${new Date().getTime()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WarnRecord[] = await res.json();
      setRecords(Array.isArray(json) ? json.reverse() : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast({
        title: 'โหลดข้อมูลไม่สำเร็จ',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (hasAdminAccess) {
      fetchData();
    }
  }, [fetchData, hasAdminAccess]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'cancel', timestamp: cancelTarget.timestamp }),
        mode: 'no-cors',
      });

      const now = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      
      setRecords((prev) =>
        prev.map((r) =>
          r.timestamp === cancelTarget.timestamp
            ? {
                ...r,
                cancelStatus: 'ยกเลิกแล้ว',
                _localCancelled: true,
                _cancelledAt: now,
                _showBlur: true,
              }
            : r,
        ),
      );

      toast({ title: 'ยกเลิกเคสเรียบร้อย' });
      setCancelTarget(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const toggleBlur = (timestamp: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.timestamp === timestamp ? { ...r, _showBlur: !r._showBlur } : r,
      ),
    );
  };

  const isCancelled = (r: WarnRecord) =>
    Boolean(r.cancelStatus && r.cancelStatus.trim() !== '') || r._localCancelled;

  if (!hasAdminAccess) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-background dark:via-background dark:to-muted/20">
      
      <header className="border-b border-latte dark:border-border bg-cream/50 dark:bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Tag-Warn Logs</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            รีเฟรช
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        
        {loading && records.length === 0 && (
          <div className="text-center py-10 text-muted-foreground animate-pulse">กำลังโหลดข้อมูล...</div>
        )}

        {!loading && error && (
          <div className="text-center py-10 text-destructive">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {records.map((r, idx) => {
            const cancelled = isCancelled(r);
            const showBlur = r._showBlur ?? false;
            const images = parseImages(r.image);

            return (
              <Card key={`${r.timestamp}-${idx}`} className="overflow-hidden relative hover:shadow-md transition-all">
                <CardContent className="p-0">
                  <div className={`h-1.5 ${cancelled ? 'bg-gray-400' : 'bg-red-500'}`} />

                  {/* Cancelled Overlay */}
                  {cancelled && showBlur && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm p-4">
                      <Badge variant="destructive" className="mb-2">ยกเลิกแล้ว</Badge>
                      <Button variant="outline" size="sm" onClick={() => toggleBlur(r.timestamp)}>
                        <Eye className="h-4 w-4 mr-2" /> ดูข้อมูล
                      </Button>
                    </div>
                  )}

                  <div className={`p-4 space-y-3 ${cancelled && !showBlur ? 'opacity-60 grayscale' : ''}`}>
                    
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="font-mono">#{r.sequence || idx + 1}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimestamp(r.timestamp)}
                      </span>
                    </div>

                    {/* Users */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 p-2 rounded">
                        <span className="block text-muted-foreground mb-1">Barista</span>
                        <span className="font-medium truncate block" title={r.baristaId}>{resolveDisplayName(r.baristaId)}</span>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <span className="block text-muted-foreground mb-1">Member</span>
                        <span className="font-medium truncate block" title={r.memberId}>{resolveDisplayName(r.memberId)}</span>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/50">
                      <p className="text-sm text-red-800 dark:text-red-200">{r.warningMessage || "ไม่มีข้อความ"}</p>
                    </div>

                    {/* Punishment */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">บทลงโทษ:</span>
                      <span className="font-medium">{r.punishment || "-"}</span>
                    </div>

                    {/* Images */}
                    {images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {images.map((img, i) => (
                          <div key={i} className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden border cursor-pointer hover:opacity-80"
                               onClick={() => { setPreviewImages(images); setPreviewIndex(i); }}>
                            <img src={img} className="h-full w-full object-cover" alt="หลักฐาน" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t flex justify-end gap-2">
                      {r.punishmentLink && (
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <a href={r.punishmentLink} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> ลิงก์
                          </a>
                        </Button>
                      )}
                      
                      {!cancelled ? (
                        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => setCancelTarget(r)}>
                          <Ban className="h-3 w-3 mr-1" /> ยกเลิก
                        </Button>
                      ) : (
                         !showBlur && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleBlur(r.timestamp)}>
                            <EyeOff className="h-3 w-3 mr-1" /> ซ่อน
                          </Button>
                         )
                      )}
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Image Preview */}
      <Dialog open={previewImages.length > 0} onOpenChange={(o) => !o && setPreviewImages([])}>
        <DialogContent className="max-w-4xl bg-black border-none text-white p-0 overflow-hidden">
          <div className="relative h-[80vh] flex items-center justify-center">
            <img src={previewImages[previewIndex]} className="max-h-full max-w-full object-contain" alt="Preview" referrerPolicy="no-referrer" />
            
            {previewImages.length > 1 && (
              <>
                <Button variant="ghost" size="icon" className="absolute left-2 text-white hover:bg-white/20" onClick={() => setPreviewIndex((i) => (i - 1 + previewImages.length) % previewImages.length)}>
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button variant="ghost" size="icon" className="absolute right-2 text-white hover:bg-white/20" onClick={() => setPreviewIndex((i) => (i + 1) % previewImages.length)}>
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}
          </div>
          <div className="absolute bottom-4 right-4">
             <Button variant="secondary" size="sm" asChild>
                <a href={previewImages[previewIndex]} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> เปิดรูปเต็ม
                </a>
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิก</DialogTitle>
            <DialogDescription>
              ต้องการยกเลิกการเตือนลำดับที่ {cancelTarget?.sequence} ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>ปิด</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'กำลังทำรายการ...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
