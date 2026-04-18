import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { PostgrestError } from '@supabase/supabase-js';
import {
  RefreshCw,
  ExternalLink,
  Ban,
  AlertTriangle,
  Clock,
  User,
  Shield,
  Hash,
  MessageSquare,
  Gavel,
  X,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Eye,
  Loader2,
  Plus,
  ImagePlus,
  UploadCloud,
  Trash2,
  Bell,
  BellOff,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const API_URL =
  'https://script.google.com/macros/s/AKfycbycKl_xUfYzwRwRNRH2D9P-nRlx-KClzRRInEVHBWqZfCjzMmmuM9Yt9UfY_e1cjsQV1A/exec';

const ITEMS_PER_PAGE = 12;

// Webhook สำหรับแจ้งเตือนการเพิ่ม Tag Warn
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1438715792362569820/FE5hvcrW3OATp-3dRr4LoMlBYQrUIsLs2r_jv4CXKNe7b7PrjD1kr-8K5U0lJrsTHvQW';

interface WarnRecord {
  id: string;
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
  _cancelledBy?: string; // ชื่อคนอนุมัติ (ถ้ามี) หรือคนทำรายการ
  _localCancelled?: boolean;
  _showBlur?: boolean;
  _cancelRequestStatus?: 'pending' | 'approved' | 'rejected';
  // เพิ่ม Field ใหม่
  _requestedBy?: string; // ชื่อคนขอ Cancel
  _approvedBy?: string;  // ชื่อคนอนุมัติ
}

// อัปเดต Interface เพื่อรับข้อมูล Join จาก Supabase
interface CancelRequest {
  warn_timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  requested_by_name: string | null;
  requester: { username: string | null } | null;
  approver: { username: string | null } | null;
}

type TagWarnCancelRequestInsert = TablesInsert<'tag_warn_cancel_requests'>;

interface DiscordProfile {
  discord_id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
}

function normalizeWarnTimestampKey(value: string): string {
  return (value || '').trim();
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

function sortWarnRecordsDesc(a: WarnRecord, b: WarnRecord): number {
  const caseA = Number.parseInt((a.sequence || '').replace(/[^0-9]/g, ''), 10);
  const caseB = Number.parseInt((b.sequence || '').replace(/[^0-9]/g, ''), 10);

  if (!Number.isNaN(caseA) && !Number.isNaN(caseB) && caseA !== caseB) {
    return caseB - caseA;
  }

  const t1 = new Date(a.timestamp).getTime();
  const t2 = new Date(b.timestamp).getTime();
  if (!Number.isNaN(t1) && !Number.isNaN(t2)) {
    return t2 - t1;
  }

  return (b.sequence || '').localeCompare(a.sequence || '');
}

function parseImages(imageField: string): string[] {
  if (!imageField || !imageField.trim()) return [];
  return imageField
    .split(',')
    .map((url) => {
      const trimmed = url.trim();
      const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
      }
      const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
      }
      return trimmed;
    })
    .filter((url) => url.length > 0);
}

export function TagWarnLogsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [records, setRecords] = useState<WarnRecord[]>([]);
  const recordsRef = useRef<WarnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<WarnRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarnRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [profileMap, setProfileMap] = useState<Map<string, DiscordProfile>>(new Map());
  const [caseQuery, setCaseQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [baristaQuery, setBaristaQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');

  // Add Warn Log State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newWarn, setNewWarn] = useState({
    baristaId: '',
    memberId: '',
    message: '',
    punish: '',
    punishLink: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [webhookEnabled, setWebhookEnabled] = useState(true);

  // Load webhook setting
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'tag_warn_webhook_enabled')
        .single();
      if (data) {
        setWebhookEnabled(Boolean(data.value));
      }
    };
    loadSettings();
  }, []);

  const toggleWebhook = async (enabled: boolean) => {
    if (!user?.is_owner) return;
    setWebhookEnabled(enabled);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'tag_warn_webhook_enabled', value: enabled });
    
    if (error) {
      console.error('Failed to save setting', error);
      toast({ title: 'บันทึกการตั้งค่าไม่สำเร็จ', variant: 'destructive' });
    } else {
      toast({ title: enabled ? 'เปิดการแจ้งเตือน Discord แล้ว' : 'ปิดการแจ้งเตือน Discord แล้ว' });
    }
  };

  // Fetch Discord profiles for username resolution
  const fetchProfiles = useCallback(async (discordIds: string[]) => {
    if (discordIds.length === 0) return;
    const uniqueIds = [...new Set(discordIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('discord_id, username, discord_username, avatar_url')
        .in('discord_id', uniqueIds);

      if (data) {
        const map = new Map<string, DiscordProfile>();
        data.forEach((p) => map.set(p.discord_id, p));
        setProfileMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch profiles', err);
    }
  }, []);

  const resolveDisplayName = useCallback(
    (id: string): { name: string; discord_username: string | null; avatar: string | null } => {
      if (!id) return { name: '-', discord_username: null, avatar: null };
      const profile = profileMap.get(id);
      if (profile) return { name: profile.username, discord_username: (profile as any).discord_username || null, avatar: profile.avatar_url };
      if (id.length > 8) return { name: `User-${id.slice(-4)}`, discord_username: null, avatar: null };
      return { name: id, discord_username: null, avatar: null };
    },
    [profileMap],
  );

  const updateRecords = useCallback((newRecords: WarnRecord[]) => {
    recordsRef.current = newRecords;
    setRecords(newRecords);
  }, []);

const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. ดึงข้อมูลจากตาราง tag_warn_logs
      const { data: tagWarnData, error: dbError } = await supabase
        .from('tag_warn_logs')
        .select('*')
        .order('log_timestamp', { ascending: false });

      if (dbError) throw dbError;

      const formattedData: WarnRecord[] = (tagWarnData || []).map((row) => ({
        id: row.id,
        timestamp: row.log_timestamp,
        // ใช้ sequence จริงถ้ามีและไม่ใช่ 0, ไม่งั้น fallback เป็น id เพื่อป้องกัน key ซ้ำ
        sequence: (row.sequence != null && row.sequence !== 0 && row.sequence !== '')
          ? String(row.sequence)
          : row.id,
        // เก็บ sequence จริงจาก DB ไว้สำหรับ cancel request (ไม่ใช้ fallback)
        _rawSequence: (row.sequence != null && row.sequence !== 0 && row.sequence !== '')
          ? String(row.sequence)
          : null,
        email: '',
        baristaId: row.barista_id || '',
        memberId: row.member_id || '',
        warningMessage: row.message || '',
        punishment: row.punish || '',
        punishmentLink: row.punish_link || '',
        image: row.image_url || '',
        cancelStatus: '',
      }));

const allIds = formattedData.reduce((acc: string[], r) => {
  acc.push(r.baristaId, r.memberId);
  return acc;
}, []);
      fetchProfiles(allIds);

      // เก็บสถานะเบลอเดิม โดยใช้เลขเคส (sequence) เป็นตัวอ้างอิง
      const existingCancelMap = new Map<string, Partial<WarnRecord>>();
      recordsRef.current.forEach((r) => {
        const key = String(r.sequence).trim();
        if (key && (r._cancelRequestStatus || r._localCancelled)) {
          existingCancelMap.set(key, {
            _cancelRequestStatus: r._cancelRequestStatus,
            _localCancelled: r._localCancelled,
            _cancelledAt: r._cancelledAt,
            _cancelledBy: r._cancelledBy,
            _requestedBy: r._requestedBy,
            _approvedBy: r._approvedBy,
            _showBlur: r._showBlur,
          });
        }
      });

      // 2. ดึง Cancel Requests ทั้งหมดมาจับคู่ผ่าน "sequence" (เลขเคส) ป้องกันปัญหา Timestamp ไม่ตรงกัน
      // ใช้ 2-step query เพื่อหลีกเลี่ยง PGRST200 เมื่อ FK ยังไม่ได้ migrate
      const { data: cancelRaw } = await supabase
        .from('tag_warn_cancel_requests')
        .select('warn_sequence, status, created_at, approved_at, requested_by_name, requested_by, approved_by')
        .order('created_at', { ascending: false });

      const cancelRawRows1 = (cancelRaw ?? []) as any[];

      // รวบรวม profile IDs ที่ต้องการ
      const profileIds = [...new Set([
        ...cancelRawRows1.map((r: any) => r.requested_by).filter(Boolean),
        ...cancelRawRows1.map((r: any) => r.approved_by).filter(Boolean),
      ])];
      const profileUsernameMap: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', profileIds);
        (profileRows ?? []).forEach((p: any) => { profileUsernameMap[p.id] = p.username; });
      }

      // แปลงให้มี requester/approver เหมือนเดิม
      const cancelData = cancelRawRows1.map((r: any) => ({
        ...r,
        requester: r.requested_by ? { username: profileUsernameMap[r.requested_by] ?? null } : null,
        approver: r.approved_by ? { username: profileUsernameMap[r.approved_by] ?? null } : null,
      }));

      const cancelRequestMap = new Map<string, any>();
      cancelData.forEach((r: any) => {
        const key = String(r.warn_sequence).trim();
        if (!key || cancelRequestMap.has(key)) return;
        cancelRequestMap.set(key, r);
      });

      // จัดการนำ Cancel Status มาใส่ใน Data ปัจจุบัน
      const enriched = formattedData.map((record) => {
        const key = String(record.sequence).trim();
        const cr = cancelRequestMap.get(key);
        const existing = existingCancelMap.get(key);

        if (!cr) {
          return {
            ...record,
            _cancelRequestStatus: existing?._cancelRequestStatus,
            _localCancelled: existing?._localCancelled ?? false,
            _cancelledAt: existing?._cancelledAt,
            _cancelledBy: existing?._cancelledBy,
            _requestedBy: existing?._requestedBy,
            _approvedBy: existing?._approvedBy,
            _showBlur: existing?._showBlur ?? false,
          };
        }

        const isApproved = cr.status === 'approved';
        return {
          ...record,
          _cancelRequestStatus: cr.status,
          _localCancelled: isApproved,
          _cancelledAt: isApproved ? formatTimestamp(cr.approved_at ?? cr.created_at ?? '') : undefined,
          _cancelledBy: isApproved ? (cr.requester?.username ?? cr.requested_by_name ?? '-') : undefined,
          _requestedBy: cr.requester?.username ?? cr.requested_by_name ?? '-',
          _approvedBy: isApproved ? (cr.approver?.username ?? '-') : undefined,
          _showBlur: existing?._showBlur !== undefined ? existing._showBlur : (isApproved || cr.status === 'pending'),
        };
      });

      updateRecords(enriched);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles, updateRecords]);

  // แก้ไข refreshCancelStatuses ให้จับคู่ด้วย Sequence เช่นกัน
  const refreshCancelStatuses = useCallback(async () => {
    try {
      const currentRecords = recordsRef.current;
      if (currentRecords.length === 0) return;

      const { data: cancelRaw2 } = await supabase
        .from('tag_warn_cancel_requests')
        .select('warn_sequence, status, created_at, approved_at, requested_by_name, requested_by, approved_by')
        .order('created_at', { ascending: false });

      const cancelRawRows = (cancelRaw2 ?? []) as any[];

      const profileIds2 = [...new Set([
        ...cancelRawRows.map((r: any) => r.requested_by).filter(Boolean),
        ...cancelRawRows.map((r: any) => r.approved_by).filter(Boolean),
      ])];
      const profileUsernameMap2: Record<string, string> = {};
      if (profileIds2.length > 0) {
        const { data: profileRows2 } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', profileIds2);
        (profileRows2 ?? []).forEach((p: any) => { profileUsernameMap2[p.id] = p.username; });
      }

      const cancelRequests2 = cancelRawRows.map((r: any) => ({
        ...r,
        requester: r.requested_by ? { username: profileUsernameMap2[r.requested_by] ?? null } : null,
        approver: r.approved_by ? { username: profileUsernameMap2[r.approved_by] ?? null } : null,
      }));

      const cancelRequestMap = new Map<string, any>();
      cancelRequests2.forEach((r: any) => {
        const key = String(r.warn_sequence).trim();
        if (!key || cancelRequestMap.has(key)) return;
        cancelRequestMap.set(key, r);
      });

      const updated = currentRecords.map((record) => {
        const key = String(record.sequence).trim();
        const cr = cancelRequestMap.get(key);
        if (!cr) return record;

        const isApproved = cr.status === 'approved';
        const userToggledBlur = record._showBlur;
        return {
          ...record,
          _cancelRequestStatus: cr.status,
          _localCancelled: isApproved,
          _cancelledAt: isApproved ? formatTimestamp(cr.approved_at ?? cr.created_at ?? '') : record._cancelledAt,
          _cancelledBy: isApproved ? (cr.requester?.username ?? cr.requested_by_name ?? '-') : record._cancelledBy,
          _requestedBy: cr.requester?.username ?? cr.requested_by_name ?? record._requestedBy ?? '-',
          _approvedBy: isApproved ? (cr.approver?.username ?? '-') : record._approvedBy,
          _showBlur: userToggledBlur !== undefined ? userToggledBlur : (isApproved || cr.status === 'pending'),
        };
      });

      updateRecords(updated);
    } catch (err) {
      console.error('Failed to refresh cancel request statuses', err);
    }
  }, [updateRecords]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (recordsRef.current.length === 0) return;

    const onFocus = () => {
      refreshCancelStatuses();
    };

    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(refreshCancelStatuses, 10000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [refreshCancelStatuses]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const caseMatched = !caseQuery.trim() || (r.sequence || '').toLowerCase().includes(caseQuery.trim().toLowerCase());
      const memberResolved = resolveDisplayName(r.memberId);
      const memberMatched =
        !memberQuery.trim() ||
        r.memberId.toLowerCase().includes(memberQuery.trim().toLowerCase()) ||
        memberResolved.name.toLowerCase().includes(memberQuery.trim().toLowerCase()) ||
        (memberResolved.discord_username || '').toLowerCase().includes(memberQuery.trim().toLowerCase());
      const baristaResolved = resolveDisplayName(r.baristaId);
      const baristaMatched =
        !baristaQuery.trim() ||
        r.baristaId.toLowerCase().includes(baristaQuery.trim().toLowerCase()) ||
        baristaResolved.name.toLowerCase().includes(baristaQuery.trim().toLowerCase()) ||
        (baristaResolved.discord_username || '').toLowerCase().includes(baristaQuery.trim().toLowerCase());

      const dateMatched = !dateQuery || (() => {
        const d = new Date(r.timestamp);
        if (Number.isNaN(d.getTime())) return false;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}` === dateQuery;
      })();

      return caseMatched && memberMatched && baristaMatched && dateMatched;
    });
  }, [records, caseQuery, memberQuery, baristaQuery, dateQuery, resolveDisplayName]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handleCancel = async () => {
    if (!cancelTarget || !user?.id) return;
    setCancelling(true);
    try {
      const payload: TagWarnCancelRequestInsert = {
        warn_timestamp: cancelTarget.timestamp,
        warn_sequence: (cancelTarget as any)._rawSequence ?? cancelTarget.sequence,
        member_id: cancelTarget.memberId,
        requested_by: user.id,
        requested_by_name: user.username ?? null,
      };

      const { error: insertError } = await supabase.from('tag_warn_cancel_requests').insert(payload);

      if (insertError) {
        const isDuplicate = (insertError as PostgrestError).code === '23505';
        if (isDuplicate) {
          toast({ title: 'มีคำขอยกเลิกอยู่แล้ว', description: `เคส #${cancelTarget.sequence} มีคำขอที่กำลังรออนุมัติอยู่` });
          setCancelTarget(null);
          return;
        }
        throw insertError;
      }

      const updated = recordsRef.current.map((r) =>
        r.timestamp === cancelTarget.timestamp ? { ...r, _cancelRequestStatus: 'pending' as const, _showBlur: true } : r,
      );
      updateRecords(updated);

      toast({ title: 'ส่งคำขอยกเลิกแล้ว', description: `เคส #${cancelTarget.sequence} ถูกส่งรอ Owner อนุมัติ` });
      setCancelTarget(null);
    } catch (err) {
      console.error('Cancel failed', err);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user?.is_owner) return;
    setIsDeleting(true);

    try {
      // 1. Delete images from storage (if any)
      const images = parseImages(deleteTarget.image);
      const supabaseImagePaths: string[] = [];

      for (const url of images) {
        if (url.includes('/storage/v1/object/public/warn-images/')) {
          const parts = url.split('/warn-images/');
          if (parts.length > 1) {
            // Decode URI component to handle spaces/special chars in filename
            supabaseImagePaths.push(decodeURIComponent(parts[1]));
          }
        }
      }

      if (supabaseImagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('warn-images')
          .remove(supabaseImagePaths);
        
        if (storageError) {
          console.error('Failed to delete images:', storageError);
          // Continue to delete record
        }
      }

      // 2. Delete record from database
      const { error: deleteError } = await supabase
        .from('tag_warn_logs')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteError) throw deleteError;

      toast({ title: 'ลบข้อมูลเรียบร้อยแล้ว', className: 'bg-green-500 text-white' });
      setDeleteTarget(null);
      fetchData(); // Reload data

    } catch (err: any) {
      console.error('Delete failed:', err);
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleBlur = (timestamp: string) => {
    const updated = recordsRef.current.map((r) => (r.timestamp === timestamp ? { ...r, _showBlur: !r._showBlur } : r));
    updateRecords(updated);
  };

  const isCancelled = (r: WarnRecord) => Boolean(r.cancelStatus && r.cancelStatus.trim() !== '') || r._localCancelled;

  // Add Warn Logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddWarn = async () => {
    // Auto-assign Barista ID from current user
    const baristaId = user?.discord_id;

    if (!baristaId) {
      toast({ title: 'ไม่พบข้อมูลผู้ใช้งาน (Barista ID)', variant: 'destructive' });
      return;
    }

    if (!newWarn.memberId || !newWarn.message || !newWarn.punish || selectedFiles.length === 0) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบและอัปโหลดรูปภาพอย่างน้อย 1 รูป', variant: 'destructive' });
      return;
    }

    setAddLoading(true);
    try {
      const imageUrls: string[] = [];

      // 1. Compress and Upload Images
      for (const file of selectedFiles) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        
        try {
          const compressedFile = await imageCompression(file, options);
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${compressedFile.type.split('/')[1]}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('warn-images')
            .upload(fileName, compressedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('warn-images')
            .getPublicUrl(fileName);
            
          imageUrls.push(publicUrl);
        } catch (error) {
          console.error('Error uploading image:', error);
          throw new Error('Upload failed');
        }
      }

      const finalImageUrl = imageUrls.join(',');

      // 2. Insert to Database
      const { error: insertError } = await supabase.from('tag_warn_logs').insert({
        barista_id: baristaId,
        member_id: newWarn.memberId,
        message: newWarn.message,
        punish: newWarn.punish,
        punish_link: newWarn.punishLink,
        image_url: finalImageUrl,
        log_timestamp: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // 3. Send Discord Webhook
      if (webhookEnabled && DISCORD_WEBHOOK_URL) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const discordTimestamp = `<t:${nowSeconds}:F> (<t:${nowSeconds}:R>)`;
        const description = `## <a:bearg22:1396016006572412998>︲__\` แท็กเตือนจากบาริสต้า! \`__
<:line:1144701793989840997>
- __\`แท็ก\`__: <@${newWarn.memberId}> — \`${newWarn.memberId}\`
- __\`เวลา\`__: ${discordTimestamp}
- __\`บทลงโทษ\`__: **${newWarn.punish}**
- __\`ลิงก์ลงโทษ\`__: [คลิกฉันสิ](${newWarn.punishLink || '#'})
### ${newWarn.message}
`.trim();

        const payload = {
          username: "⊹ ꒰ แท็กเตือนจากบาริสต้า ꒱ 🚫",
          content: `<@${newWarn.memberId}>`,
          embeds: [{
            description: description,
            color: 0xFC6868,
            image: imageUrls.length > 0 ? { url: imageUrls[0] } : undefined
          }]
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      toast({ title: 'บันทึกข้อมูลสำเร็จ', className: 'bg-green-500 text-white' });
      setIsAddDialogOpen(false);
      setNewWarn({ baristaId: '', memberId: '', message: '', punish: '', punishLink: '' });
      setSelectedFiles([]);
      fetchData(); // Reload data

    } catch (err: any) {
      console.error('Add warn failed:', err);
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึก', description: err.message, variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  // Loading
  if (loading && records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">ประวัติแท็กเตือน</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error && records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">ไม่สามารถโหลดข้อมูลได้</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> ลองใหม่</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">ประวัติแท็กเตือน</h2>
          <p className="text-xs text-muted-foreground">{filteredRecords.length}/{records.length} รายการ • หน้า {currentPage}/{totalPages}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.is_owner && (
            <div className="flex items-center gap-2 mr-2 border-r pr-4">
              <Switch checked={webhookEnabled} onCheckedChange={toggleWebhook} id="webhook-toggle" />
              <Label htmlFor="webhook-toggle" className="text-xs flex items-center gap-1 cursor-pointer select-none">
                {webhookEnabled ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                แจ้งเตือน Discord
              </Label>
            </div>
          )}
          <Badge variant="outline" className="text-xs text-muted-foreground gap-1.5">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            อัปเดตอัตโนมัติ
          </Badge>
          
          {/* Add Warn Button */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4" /> เพิ่มแท็กเตือน
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มประวัติแท็กเตือน</DialogTitle>
                <DialogDescription>กรอกข้อมูลให้ครบถ้วนเพื่อบันทึกและแจ้งเตือนไปยัง Discord</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="memberId">Member ID</Label>
                  <Input id="memberId" value={newWarn.memberId} onChange={(e) => setNewWarn({...newWarn, memberId: e.target.value})} placeholder="ไอดีสมาชิกที่ถูกเตือน" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">ข้อความเตือน</Label>
                  <Textarea id="message" value={newWarn.message} onChange={(e) => setNewWarn({...newWarn, message: e.target.value})} placeholder="ระบุรายละเอียดการเตือน..." className="min-h-[80px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>บทลงโทษ</Label>
                    <div className="flex gap-2">
                      {[
                        { emoji: "🍵", value: "ミ ชาเขียวเตือนใจ 𓂃 🍵", label: "ชาเขียว" },
                        { emoji: "☕", value: "ミ ถ้วยกาแฟ 𓂃 ☕", label: "กาแฟ" },
                        { emoji: "☕☕", value: "ミ กาแฟดับเบิ้ลช็อต 𓂃 ☕☕", label: "Double Shot" },
                      ].map((option) => (
                        <Button
                          key={option.emoji}
                          type="button"
                          variant={newWarn.punish === option.value ? "default" : "outline"}
                          onClick={() => setNewWarn({ ...newWarn, punish: option.value })}
                          className="flex-1 text-lg h-10 px-0"
                          title={option.label}
                        >
                          {option.emoji}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="punishLink">ลิงก์หลักฐาน/ลงโทษ</Label>
                    <Input id="punishLink" value={newWarn.punishLink} onChange={(e) => setNewWarn({...newWarn, punishLink: e.target.value})} placeholder="คัดลอกลิงก์จากห้องลงโทษ" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>รูปภาพหลักฐาน (อย่างน้อย 1 รูป)</Label>
                  <Input type="file" multiple accept="image/*" onChange={handleFileChange} className="cursor-pointer" />
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} alt={f.name} className="w-20 h-20 object-cover rounded-lg border border-border" />
                          <button onClick={() => removeFile(i)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow-md">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addLoading}>ยกเลิก</Button>
                <Button onClick={handleAddWarn} disabled={addLoading} className="gap-2">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} บันทึกข้อมูล
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input value={caseQuery} onChange={(e) => { setCaseQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหาเลขเคส" />
        <Input value={memberQuery} onChange={(e) => { setMemberQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหา Member ID" />
        <Input value={baristaQuery} onChange={(e) => { setBaristaQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหา Barista ID" />
        
        <div className="relative">
          <Input
            type="date"
            value={dateQuery}
            onChange={(e) => {
              setDateQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="กรองวันที่"
            className={cn("w-full pr-9", !dateQuery && "text-muted-foreground")}
          />
          {dateQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-9 hover:bg-transparent text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDateQuery('');
                setCurrentPage(1);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Card Grid */}
      {filteredRecords.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">ไม่พบรายการ</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedRecords.map((r, idx) => {
              const cancelled = isCancelled(r);
              const pendingApproval = r._cancelRequestStatus === 'pending';
              const showBlur = r._showBlur ?? false;
              const images = parseImages(r.image);
              const barista = resolveDisplayName(r.baristaId);
              const member = resolveDisplayName(r.memberId);
              const memberNameForDisplay = /^User-\d+$/i.test(member.name) ? r.memberId : member.name;

              return (
                <Card key={`${r.timestamp}-${idx}`} className="overflow-hidden transition-all relative">
                  <CardContent className="p-0">
                    <div className={`h-1.5 ${cancelled ? 'bg-muted-foreground/30' : pendingApproval ? 'bg-amber-500/60' : 'bg-destructive/80'}`} />

                    {/* Pending approval overlay */}
                    {pendingApproval && showBlur && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-2" />
                        <Badge variant="outline" className="mb-2 text-amber-600 border-amber-500/60">กำลังรอการอนุมัติ</Badge>
                        <p className="text-xs text-muted-foreground text-center">คำขอยกเลิกถูกส่งไปหน้า "รายงาน" แล้ว</p>
                        <Button variant="outline" size="sm" className="gap-1 text-xs mt-3" onClick={() => toggleBlur(r.timestamp)}>
                          <Eye className="h-3 w-3" /> ดูรายละเอียด
                        </Button>
                      </div>
                    )}

                    {/* Cancelled overlay - ปรับปรุงใหม่ */}
                    {cancelled && showBlur && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg p-4 text-center">
                        <Badge variant="destructive" className="mb-3 gap-1 text-sm"><X className="h-3.5 w-3.5" /> ยกเลิกเคสแล้ว</Badge>
                        
                        <div className="space-y-1.5 mb-4 text-xs text-muted-foreground">
                          {r._requestedBy && (
                            <p className="flex items-center justify-center gap-1">
                              <User className="h-3 w-3 text-orange-500" />
                              ผู้ขอ: <span className="font-medium text-foreground">{r._requestedBy}</span>
                            </p>
                          )}
                          {r._approvedBy && (
                            <p className="flex items-center justify-center gap-1">
                              <Shield className="h-3 w-3 text-green-500" />
                              อนุมัติโดย: <span className="font-medium text-foreground">{r._approvedBy}</span>
                            </p>
                          )}
                          {r._cancelledAt && (
                            <p className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />
                              เมื่อ: {r._cancelledAt}
                            </p>
                          )}
                        </div>

                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => toggleBlur(r.timestamp)}>
                          <Eye className="h-3 w-3" /> ดูรายละเอียด
                        </Button>
                      </div>
                    )}

                    <div className={`p-4 space-y-3 ${(cancelled || pendingApproval) && !showBlur ? 'opacity-60' : ''}`}>
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={cancelled ? 'outline' : 'secondary'} className="gap-1 text-xs font-mono">
                            <Hash className="h-3 w-3" />{
                              // ถ้า sequence เป็น UUID (fallback) แสดง ? แทน
                              r.sequence && r.sequence.includes('-') ? '?' : (r.sequence || idx + 1)
                            }
                          </Badge>
                          {cancelled && !showBlur && <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" /> ยกเลิกแล้ว</Badge>}
                          {pendingApproval && !showBlur && <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/60">รออนุมัติ</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          {(cancelled || pendingApproval) && !showBlur && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleBlur(r.timestamp)} title="ซ่อน">
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {user?.is_owner && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(r)}
                              title="ลบข้อมูลถาวร"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{formatTimestamp(r.timestamp)}
                      </div>

                      {/* Barista & Member */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            {barista.avatar && <AvatarImage src={barista.avatar} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary"><Shield className="h-3.5 w-3.5" /></AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Barista</p>
                            {barista.discord_username ? (
                              <>
                                <p className="text-xs font-semibold truncate" title={barista.discord_username}>{barista.discord_username}</p>
                                <p className="text-[10px] text-muted-foreground truncate" title={barista.name}>{barista.name}</p>
                              </>
                            ) : (
                              <p className="text-xs font-medium truncate" title={r.baristaId}>{barista.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            {member.avatar && <AvatarImage src={member.avatar} />}
                            <AvatarFallback className="text-xs bg-destructive/10 text-destructive"><User className="h-3.5 w-3.5" /></AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Member</p>
                            {member.discord_username ? (
                              <>
                                <p className="text-xs font-semibold truncate" title={member.discord_username}>{member.discord_username}</p>
                                <p className="text-[10px] text-muted-foreground truncate" title={memberNameForDisplay}>{memberNameForDisplay}</p>
                              </>
                            ) : (
                              <p className="text-xs font-medium break-all" title={r.memberId}>{memberNameForDisplay}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Warning message */}
                      {r.warningMessage && (
                        <div className="flex gap-2 rounded-md bg-muted/30 p-2">
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <p className="text-sm leading-snug max-h-24 overflow-y-auto pr-1 break-words">{r.warningMessage}</p>
                        </div>
                      )}

                      {/* Punishment with inline link */}
                      {r.punishment && (
                        <div className="flex items-center gap-2 text-sm">
                          <Gavel className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{r.punishment}</span>
                          {r.punishmentLink && (
                            <a href={r.punishmentLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-1">
                              <ExternalLink className="h-3 w-3" />ดูหลักฐาน
                            </a>
                          )}
                        </div>
                      )}

                      {/* Image - single large preview */}
                      {images.length > 0 && (
                        <div
                          className="relative cursor-pointer overflow-hidden rounded-lg border border-border/60 hover:ring-2 hover:ring-primary/40 transition-all aspect-video bg-muted/20"
                          onClick={() => { setPreviewImages(images); setPreviewIndex(0); }}
                        >
                          <img
                            src={images[0]}
                            alt="หลักฐาน"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {images.length > 1 && (
                            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                              +{images.length - 1} รูป
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cancel action */}
                      {!cancelled && !pendingApproval && (
                        <div className="pt-1 border-t border-border/50">
                          <Button variant="destructive" size="sm" className="h-7 gap-1 text-xs" onClick={() => setCancelTarget(r)}>
                            <Ban className="h-3 w-3" /> Cancel Case
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-muted-foreground px-1">...</span>}
                      <Button
                        variant={p === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    </React.Fragment>
                  ))}
              </div>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="gap-1">
                ถัดไป <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={previewImages.length > 0} onOpenChange={(o) => !o && setPreviewImages([])}>
        <DialogContent className="max-w-3xl p-2 sm:p-4">
          <DialogHeader className="sr-only"><DialogTitle>ภาพหลักฐาน</DialogTitle></DialogHeader>
          {previewImages.length > 0 && (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center min-h-[200px] bg-muted/20 rounded-lg">
                <img src={previewImages[previewIndex]} alt={`หลักฐาน ${previewIndex + 1}`} className="max-w-full max-h-[70vh] rounded-lg object-contain" referrerPolicy="no-referrer" />
                {previewImages.length > 1 && (
                  <>
                    <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100" onClick={() => setPreviewIndex((i) => (i - 1 + previewImages.length) % previewImages.length)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100" onClick={() => setPreviewIndex((i) => (i + 1) % previewImages.length)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {previewImages.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {previewImages.map((url, i) => (
                    <button key={i} onClick={() => setPreviewIndex(i)} className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${i === previewIndex ? 'border-primary ring-1 ring-primary/30' : 'border-border/40 opacity-60 hover:opacity-100'}`}>
                      <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">{previewIndex + 1} / {previewImages.length}</span>
                </div>
              )}
              <div className="flex justify-center">
                <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
                  <a href={previewImages[previewIndex]} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> เปิดในแท็บใหม่</a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> ยืนยันยกเลิกเคส</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิกเคส #{cancelTarget?.sequence} ของสมาชิก <strong>{resolveDisplayName(cancelTarget?.memberId ?? '').name}</strong> ใช่หรือไม่?
              <br /><span className="text-destructive">เมื่อยืนยันแล้ว ระบบจะส่งคำขอไปที่หน้า "รายงาน" เพื่อให้ Owner อนุมัติการยกเลิก</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling} className="gap-2">
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />} ยืนยันยกเลิกเคส
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> ยืนยันการลบข้อมูลถาวร</DialogTitle>
            <DialogDescription>
              คุณต้องการลบเคส #{deleteTarget?.sequence} ของสมาชิก <strong>{resolveDisplayName(deleteTarget?.memberId ?? '').name}</strong> ใช่หรือไม่?
              <br /><span className="text-destructive font-semibold">การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลและรูปภาพจะถูกลบออกจากระบบทันที</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />} ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
