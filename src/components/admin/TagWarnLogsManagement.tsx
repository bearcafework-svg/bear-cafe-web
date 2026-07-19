import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import {
  RefreshCw, Ban, AlertTriangle, Clock, User, Shield, Hash,
  MessageSquare, Gavel, X, ChevronLeft, ChevronRight,
  EyeOff, Eye, Loader2, Plus, UploadCloud, Trash2,
  Bell, BellOff, Mail, Pencil, Check, ImagePlus, Send, Search,
  LayoutGrid, List, Menu, History,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;

const PUNISH_OPTIONS = [
  { value: 'ชื่อ/รูปไม่เหมาะสม', label: 'ชื่อ/รูปไม่เหมาะสม' },
  { value: 'ミ ชาเขียวเตือนใจ 𓂃 🍵', label: 'ชาเขียวเตือนใจ' },
  { value: 'ミ ถ้วยกาแฟ 𓂃 ☕', label: 'ถ้วยกาแฟ' },
  { value: 'ミ กาแฟดับเบิ้ลช็อต 𓂃 ☕☕', label: 'กาแฟดับเบิ้ลช็อต' },
  { value: 'เตะ', label: 'เตะ' },
  { value: 'แบนถาวร', label: 'แบนถาวร' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarnRecord {
  id: string;
  log_timestamp: string | null;
  created_at: string;
  sequence: number;
  barista_id: string | null;
  member_id: string | null;
  message: string | null;
  punish: string | null;
  image_url: string | null;
  image_url_2: string | null;
  is_spoiler: boolean;
  is_spoiler_2: boolean;
  _cancelStatus?: 'pending' | 'approved' | 'rejected' | null;
  _cancelledAt?: string | null;
  _requestedBy?: string | null;
  _showBlur?: boolean;
}

interface DiscordProfile {
  discord_id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
}

type TagWarnCancelRequestInsert = TablesInsert<'tag_warn_cancel_requests'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(raw: string | null | undefined): string {
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatPunishLabel(punish: string | null): string {
  if (!punish) return '-';
  const clean = punish
    .replace('🍵', '')
    .replace('☕☕', '')
    .replace('☕', '')
    .replace('ミ', '')
    .replace('𓂃', '')
    .trim();
  return clean || punish;
}

function getPunishBadgeStyle(punish: string | null): string {
  if (!punish) return "bg-muted text-muted-foreground border-border/30";
  const clean = punish.toLowerCase();
  if (clean.includes('ชาเขียว')) {
    return "bg-green-500/10 border-green-500/25 text-green-700 dark:text-green-400";
  }
  if (clean.includes('ถ้วยกาแฟ')) {
    return "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-400";
  }
  if (clean.includes('ดับเบิ้ลช็อต') || clean.includes('ดับเบิ้ล')) {
    return "bg-orange-500/10 border-orange-500/25 text-orange-800 dark:text-orange-400";
  }
  if (clean.includes('เตะ')) {
    return "bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400";
  }
  if (clean.includes('แบน')) {
    return "bg-destructive/15 border-destructive/25 text-destructive";
  }
  return "bg-muted text-muted-foreground border-border/30";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TagWarnLogsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // core data
  const [records, setRecords] = useState<WarnRecord[]>([]);
  const recordsRef = useRef<WarnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // pagination & filters
  const [currentPage, setCurrentPage] = useState(1);
  const [caseQuery, setCaseQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [baristaQuery, setBaristaQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');

  // profile resolution
  const [profileMap, setProfileMap] = useState<Map<string, DiscordProfile>>(new Map());

  // image preview
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // cancel
  const [cancelTarget, setCancelTarget] = useState<WarnRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState<WarnRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // add warn
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newWarn, setNewWarn] = useState({ memberId: '', message: '', punish: '' });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [spoilerFlags, setSpoilerFlags] = useState<boolean[]>([false, false]);
  const [spoilerAll, setSpoilerAll] = useState(false);

  // send to discord
  const [sendTarget, setSendTarget] = useState<WarnRecord | null>(null);
  const [isSending, setIsSending] = useState(false);

  // edit
  const [editTarget, setEditTarget] = useState<WarnRecord | null>(null);
  const [editForm, setEditForm] = useState({ message: '', punish: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // webhook toggle
  const [webhookEnabled, setWebhookEnabled] = useState(true);

  // layout settings
  const [layoutView, setLayoutView] = useState<'cozy' | 'list' | 'compact'>(() => {
    return (localStorage.getItem('tag_layout_view') as 'cozy' | 'list' | 'compact') || 'cozy';
  });

  const handleSetLayoutView = (view: 'cozy' | 'list' | 'compact') => {
    setLayoutView(view);
    localStorage.setItem('tag_layout_view', view);
  };

  // template manager
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState({ title: '', message: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // case change logs
  const [selectedCaseLogs, setSelectedCaseLogs] = useState<any[]>([]);
  const [loadingCaseLogs, setLoadingCaseLogs] = useState(false);
  const [isCaseLogsOpen, setIsCaseLogsOpen] = useState(false);
  const [caseLogsTarget, setCaseLogsTarget] = useState<WarnRecord | null>(null);

  // fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tag_warn_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // template select helper
  const handleSelectTemplate = (templateMsg: string, target: 'add' | 'edit') => {
    if (target === 'add') {
      setNewWarn(prev => ({
        ...prev,
        message: prev.message ? `${prev.message}\n${templateMsg}` : templateMsg
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        message: prev.message ? `${prev.message}\n${templateMsg}` : templateMsg
      }));
    }
  };

  // template save/edit/delete handlers
  const handleSaveTemplate = async () => {
    if (!templateForm.title.trim() || !templateForm.message.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', variant: 'destructive' });
      return;
    }
    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('tag_warn_templates')
          .update({
            title: templateForm.title.trim(),
            message: templateForm.message.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast({ title: 'แก้ไขข้อความเทมเพลตสำเร็จ' });
      } else {
        const { error } = await supabase
          .from('tag_warn_templates')
          .insert({
            title: templateForm.title.trim(),
            message: templateForm.message.trim(),
            created_by: user?.username || 'Admin',
          });
        if (error) throw error;
        toast({ title: 'เพิ่มข้อความเทมเพลตสำเร็จ' });
      }
      setTemplateForm({ title: '', message: '' });
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการบันทึกเทมเพลต', description: err.message, variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleStartEditTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTemplateForm({ title: tpl.title, message: tpl.message });
  };

  const handleCancelEditTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ title: '', message: '' });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('ยืนยันที่จะลบข้อความเทมเพลตนี้ใช่หรือไม่?')) return;
    try {
      const { error } = await supabase
        .from('tag_warn_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบเทมเพลตสำเร็จ' });
      await fetchTemplates();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบเทมเพลต', description: err.message, variant: 'destructive' });
    }
  };

  // case change logs helpers
  const fetchCaseLogs = async (caseId: string) => {
    setLoadingCaseLogs(true);
    try {
      const { data, error } = await supabase
        .from('tag_warn_case_logs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSelectedCaseLogs(data || []);
    } catch (err) {
      console.error('Error fetching case logs:', err);
    } finally {
      setLoadingCaseLogs(false);
    }
  };

  const handleOpenCaseLogs = (record: WarnRecord) => {
    setCaseLogsTarget(record);
    setSelectedCaseLogs([]);
    setIsCaseLogsOpen(true);
    fetchCaseLogs(record.id);
  };

  // ── Derived: preview URLs (revoke on change) ──────────────────────────────
  const previewUrls = useMemo(
    () => selectedFiles.map((f) => URL.createObjectURL(f)),
    [selectedFiles],
  );
  useEffect(() => {
    return () => { previewUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [previewUrls]);

  // ── Derived: filtered + paginated records ─────────────────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (caseQuery && !String(r.sequence).includes(caseQuery.trim())) return false;
      if (memberQuery) {
        const q = memberQuery.toLowerCase().trim();
        const member = r.member_id ? profileMap.get(r.member_id) : null;
        const matchesId = (r.member_id ?? '').toLowerCase().includes(q);
        const matchesUsername = member ? member.username.toLowerCase().includes(q) : false;
        const matchesDiscordUsername = member && member.discord_username ? member.discord_username.toLowerCase().includes(q) : false;
        if (!matchesId && !matchesUsername && !matchesDiscordUsername) return false;
      }
      if (baristaQuery) {
        const q = baristaQuery.toLowerCase().trim();
        const barista = r.barista_id ? profileMap.get(r.barista_id) : null;
        const matchesId = (r.barista_id ?? '').toLowerCase().includes(q);
        const matchesUsername = barista ? barista.username.toLowerCase().includes(q) : false;
        const matchesDiscordUsername = barista && barista.discord_username ? barista.discord_username.toLowerCase().includes(q) : false;
        if (!matchesId && !matchesUsername && !matchesDiscordUsername) return false;
      }
      if (dateQuery) {
        const d = new Date(r.log_timestamp || r.created_at);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (ymd !== dateQuery) return false;
      }
      return true;
    });
  }, [records, caseQuery, memberQuery, baristaQuery, dateQuery, profileMap]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isCancelled = (r: WarnRecord) => r._cancelStatus === 'approved';

  const updateRecords = useCallback((next: WarnRecord[]) => {
    recordsRef.current = next;
    setRecords(next);
  }, []);

  const resolveDisplayName = useCallback(
    (id: string | null): { name: string; discord_username: string | null; avatar: string | null } => {
      if (!id) return { name: '-', discord_username: null, avatar: null };
      const p = profileMap.get(id);
      if (p) return { name: p.username, discord_username: p.discord_username ?? null, avatar: p.avatar_url ?? null };
      if (id.length > 8) return { name: `User-${id.slice(-4)}`, discord_username: null, avatar: null };
      return { name: id, discord_username: null, avatar: null };
    },
    [profileMap],
  );

  const toggleBlur = useCallback((id: string) => {
    updateRecords(recordsRef.current.map((r) => r.id === id ? { ...r, _showBlur: !r._showBlur } : r));
  }, [updateRecords]);

  const toggleSpoilerFlag = (idx: number) => {
    setSpoilerFlags((prev) => { const n = [...prev]; n[idx] = !n[idx]; return n; });
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setSpoilerFlags((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 2 - selectedFiles.length;
    if (remaining <= 0) return;
    setSelectedFiles((prev) => [...prev, ...files.slice(0, remaining)]);
    setSpoilerFlags((prev) => [...prev, ...Array(Math.min(files.length, remaining)).fill(false)]);
    e.target.value = '';
  };

  // ── Fetch profiles ────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async (discordIds: string[]) => {
    const uniqueIds = [...new Set(discordIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('discord_id, username, discord_username, avatar_url')
      .in('discord_id', uniqueIds);
    if (data) {
      const map = new Map<string, DiscordProfile>();
      (data as DiscordProfile[]).forEach((p) => map.set(p.discord_id, p));
      setProfileMap(map);
    }
  }, []);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: logs, error: logsErr } = await supabase
        .from('tag_warn_logs')
        .select('id, log_timestamp, created_at, sequence, barista_id, member_id, message, punish, image_url, image_url_2, is_spoiler, is_spoiler_2')
        .order('sequence', { ascending: false });
      if (logsErr) throw logsErr;

      const { data: cancelReqs } = await supabase
        .from('tag_warn_cancel_requests')
        .select('warn_timestamp, status, requested_by_name, approved_at')
        .in('status', ['pending', 'approved']);

      const cancelMap = new Map<string, { status: 'pending' | 'approved'; requestedBy: string | null; cancelledAt: string | null }>();
      (cancelReqs ?? []).forEach((req: any) => {
        cancelMap.set(req.warn_timestamp, {
          status: req.status,
          requestedBy: req.requested_by_name ?? null,
          cancelledAt: req.approved_at ?? null,
        });
      });

      const enriched: WarnRecord[] = (logs ?? []).map((log: any) => {
        const cancel = cancelMap.get(log.log_timestamp);
        return {
          ...log,
          _cancelStatus: cancel?.status ?? null,
          _cancelledAt: cancel?.cancelledAt ? formatTimestamp(cancel.cancelledAt) : null,
          _requestedBy: cancel?.requestedBy ?? null,
          _showBlur: cancel?.status === 'approved' || cancel?.status === 'pending',
        };
      });

      updateRecords(enriched);
      const ids = enriched.flatMap((r) => [r.barista_id, r.member_id]).filter(Boolean) as string[];
      await fetchProfiles(ids);
    } catch (e: any) {
      setError(e?.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles, updateRecords]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Load webhook setting ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'tag_warn_webhook_enabled').single()
      .then(({ data }) => {
        if (data) setWebhookEnabled(data.value === true || data.value === 'true');
      });
  }, []);

  // ── Toggle webhook ────────────────────────────────────────────────────────
  const toggleWebhook = async (enabled: boolean) => {
    if (!user?.is_owner) return;
    setWebhookEnabled(enabled);
    const { error: settingsError } = await supabase
      .from('site_settings')
      .upsert({ key: 'tag_warn_webhook_enabled', value: enabled });
    if (settingsError) {
      toast({ title: 'บันทึกการตั้งค่าไม่สำเร็จ', variant: 'destructive' });
    } else {
      toast({ title: enabled ? 'เปิดการแจ้งเตือน Discord แล้ว' : 'ปิดการแจ้งเตือน Discord แล้ว' });
    }
  };

  // ── Add warn ──────────────────────────────────────────────────────────────
  const handleAddWarn = async () => {
    if (!newWarn.memberId.trim() || !newWarn.message.trim() || !newWarn.punish || selectedFiles.length === 0) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วนและอัปโหลดรูปภาพอย่างน้อย 1 รูป', variant: 'destructive' });
      return;
    }
    setAddLoading(true);

    const inputId = newWarn.memberId.trim();
    let resolvedMemberId = inputId;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('discord_id')
        .or(`discord_id.eq."${inputId}",username.ilike."${inputId}",discord_username.ilike."${inputId}"`)
        .maybeSingle();

      if (profileData) {
        resolvedMemberId = profileData.discord_id;
      } else {
        const isNumeric = /^\d+$/.test(inputId);
        if (!isNumeric) {
          toast({
            title: 'ไม่พบผู้ใช้',
            description: 'ไม่พบชื่อผู้ใช้หรือข้อมูลที่ระบุในระบบ กรุณาตรวจสอบหรือใช้ Discord ID (ตัวเลข) เท่านั้น',
            variant: 'destructive'
          });
          setAddLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('Error resolving member ID:', e);
    }

    try {
      const uploadUrl = async (file: File, idx: number): Promise<string> => {
        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `tag-warn/${Date.now()}-${idx}.${ext}`;
        const { error: upErr } = await supabase.storage.from('evidence').upload(path, compressed, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(path);
        return urlData.publicUrl;
      };

      const url1 = await uploadUrl(selectedFiles[0], 0);
      const url2 = selectedFiles[1] ? await uploadUrl(selectedFiles[1], 1) : null;

      const { error: insertErr } = await supabase.from('tag_warn_logs').insert({
        member_id: resolvedMemberId,
        message: newWarn.message.trim(),
        punish: newWarn.punish,
        barista_id: user?.discord_id ?? null,
        image_url: url1,
        image_url_2: url2,
        is_spoiler: spoilerFlags[0] ?? false,
        is_spoiler_2: spoilerFlags[1] ?? false,
        log_timestamp: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      toast({ title: 'เพิ่มแท็กเตือนสำเร็จ' });
      setIsAddDialogOpen(false);
      setNewWarn({ memberId: '', message: '', punish: '' });
      setSelectedFiles([]);
      setSpoilerFlags([false, false]);
      setSpoilerAll(false);
      await fetchData();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e?.message, variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  // ── Send to Discord ───────────────────────────────────────────────────────
  const handleSendToDiscord = async () => {
    if (!sendTarget) return;
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-tag-warn-embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          member_id: sendTarget.member_id,
          message: sendTarget.message,
          punish: sendTarget.punish,
          image_url_1: sendTarget.image_url,
          image_url_2: sendTarget.image_url_2 ?? undefined,
          is_spoiler_1: sendTarget.is_spoiler ?? false,
          is_spoiler_2: sendTarget.is_spoiler_2 ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast({ title: 'ส่งแจ้งเตือน Discord สำเร็จ' });
      setSendTarget(null);
    } catch (e: any) {
      toast({ title: 'ส่งแจ้งเตือนไม่สำเร็จ', description: e?.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // ── Save edit ─────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setIsSavingEdit(true);
    try {
      const { error: editErr } = await supabase
        .from('tag_warn_logs')
        .update({ message: editForm.message, punish: editForm.punish })
        .eq('id', editTarget.id);
      if (editErr) throw editErr;

      // Insert case log for tracking edits
      await supabase.from('tag_warn_case_logs').insert({
        case_id: editTarget.id,
        operator_id: user?.discord_id || user?.id || 'unknown',
        operator_name: user?.username || 'Unknown',
        operator_avatar: user?.avatar_url || null,
        before_data: { message: editTarget.message, punish: editTarget.punish },
        after_data: { message: editForm.message, punish: editForm.punish },
        details: `แก้ไขข้อความเตือน หรือบทลงโทษ`,
      });

      toast({ title: 'แก้ไขข้อมูลสำเร็จ' });
      setEditTarget(null);
      await fetchData();
    } catch (e: any) {
      toast({ title: 'แก้ไขข้อมูลไม่สำเร็จ', description: e?.message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Cancel case ───────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelTarget || !user) return;
    setCancelling(true);
    try {
      const insert: TagWarnCancelRequestInsert = {
        warn_timestamp: cancelTarget.log_timestamp,
        warn_sequence: String(cancelTarget.sequence),
        member_id: cancelTarget.member_id ?? undefined,
        requested_by: user.id,
        requested_by_name: user.username ?? null,
        status: 'pending',
      };
      const { error: reqErr } = await supabase.from('tag_warn_cancel_requests').insert(insert);
      if (reqErr) throw reqErr;
      toast({ title: 'ส่งคำขอยกเลิกเคสเรียบร้อย รอ Owner อนุมัติ' });
      setCancelTarget(null);
      await fetchData();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e?.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget || !user?.is_owner) return;
    setIsDeleting(true);
    try {
      for (const url of [deleteTarget.image_url, deleteTarget.image_url_2].filter(Boolean) as string[]) {
        const path = url.split('/evidence/')[1];
        if (path) await supabase.storage.from('evidence').remove([path]);
      }
      const { error: delErr } = await supabase.from('tag_warn_logs').delete().eq('id', deleteTarget.id);
      if (delErr) throw delErr;
      toast({ title: 'ลบข้อมูลสำเร็จ' });
      setDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      toast({ title: 'ลบข้อมูลไม่สำเร็จ', description: e?.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (loading && records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">ประวัติแท็กเตือน</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">ไม่สามารถโหลดข้อมูลได้</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> ลองใหม่
        </Button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#8C6239] dark:text-[#EAD8C8]">ประวัติแท็กเตือน</h2>
          <p className="text-xs text-muted-foreground">
            {filteredRecords.length}/{records.length} รายการ • หน้า {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {/* Layout Setting Selectors */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-latte/15 mr-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 transition-all',
                layoutView === 'cozy'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => handleSetLayoutView('cozy')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              แบบการ์ด
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 transition-all',
                layoutView === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => handleSetLayoutView('list')}
            >
              <List className="h-3.5 w-3.5" />
              แบบรายการ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 rounded-lg text-xs font-semibold gap-1 transition-all',
                layoutView === 'compact'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => handleSetLayoutView('compact')}
            >
              <Menu className="h-3.5 w-3.5" />
              แบบกระชับ
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-latte/40 hover:bg-cream/10 rounded-xl"
            onClick={() => { setIsTemplateManagerOpen(true); fetchTemplates(); }}
          >
            <MessageSquare className="h-4 w-4 text-[#8C6239] dark:text-[#EAD8C8]" />
            จัดการข้อความ
          </Button>

          {user?.is_owner && (
            <div className="flex items-center gap-2 mr-2 border-r border-latte/20 pr-4">
              <Switch checked={webhookEnabled} onCheckedChange={toggleWebhook} id="webhook-toggle" />
              <Label htmlFor="webhook-toggle" className="text-xs flex items-center gap-1 cursor-pointer select-none">
                {webhookEnabled ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                แจ้งเตือน Discord
              </Label>
            </div>
          )}
          <Badge variant="outline" className="text-xs text-muted-foreground gap-1.5 border-latte/40 rounded-xl">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            อัปเดตอัตโนมัติ
          </Badge>

          {/* Add Warn Dialog */}
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(o) => {
              setIsAddDialogOpen(o);
              if (!o) { setSelectedFiles([]); setSpoilerFlags([false, false]); setSpoilerAll(false); }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4" /> เพิ่มแท็กเตือน
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>เพิ่มประวัติแท็กเตือน</DialogTitle>
                <DialogDescription>กรอกข้อมูลให้ครบถ้วน — กดปุ่ม 📬 บน card เพื่อส่งแจ้งเตือน Discord ภายหลัง</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="memberId">Member ID</Label>
                  <Input id="memberId" value={newWarn.memberId} onChange={(e) => setNewWarn({ ...newWarn, memberId: e.target.value })} placeholder="ไอดีสมาชิกที่ถูกเตือน" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="warnMsg">ข้อความเตือน</Label>
                    {templates.length > 0 && (
                      <Select onValueChange={(v) => handleSelectTemplate(v, 'add')}>
                        <SelectTrigger className="h-7 text-xs w-[180px] bg-primary/5 border-primary/20 text-primary rounded-lg font-semibold">
                          <SelectValue placeholder="เลือกจากเทมเพลต" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(tpl => (
                            <SelectItem key={tpl.id} value={tpl.message} className="text-xs font-medium">
                              {tpl.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Textarea id="warnMsg" value={newWarn.message} onChange={(e) => setNewWarn({ ...newWarn, message: e.target.value })} placeholder="ระบุรายละเอียดการเตือน..." className="min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <Label>บทลงโทษ</Label>
                  <Select value={newWarn.punish} onValueChange={(v) => setNewWarn({ ...newWarn, punish: v })}>
                    <SelectTrigger><SelectValue placeholder="เลือกบทลงโทษ" /></SelectTrigger>
                    <SelectContent>
                      {PUNISH_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>รูปภาพหลักฐาน (อย่างน้อย 1 รูป, สูงสุด 2 รูป)</Label>
                    {selectedFiles.length === 2 && (
                      <div className="flex items-center gap-1.5">
                        <Checkbox id="spoiler-all" checked={spoilerAll} onCheckedChange={(v) => { const b = !!v; setSpoilerAll(b); setSpoilerFlags([b, b]); }} />
                        <Label htmlFor="spoiler-all" className="text-xs cursor-pointer">ซ่อนภาพทั้งหมด</Label>
                      </div>
                    )}
                  </div>
                  {selectedFiles.length < 2 && (
                    <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-lg p-3 hover:border-primary/50 transition-colors">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">คลิกเพื่ออัปโหลดรูปภาพ</span>
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-3 mt-2 flex-wrap">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={previewUrls[i]} alt={f.name} className={cn('w-24 h-24 object-cover rounded-lg border border-border', spoilerFlags[i] && 'blur-sm')} />
                          <button type="button" onClick={() => removeFile(i)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow-md z-10">
                            <X className="h-3 w-3" />
                          </button>
                          <div className="flex items-center gap-1 mt-1">
                            <Checkbox id={`spoiler-${i}`} checked={spoilerFlags[i]} onCheckedChange={() => toggleSpoilerFlag(i)} />
                            <Label htmlFor={`spoiler-${i}`} className="text-[10px] cursor-pointer">ซ่อนภาพ</Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addLoading}>ยกเลิก</Button>
                <Button onClick={handleAddWarn} disabled={addLoading} className="gap-2">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  บันทึกข้อมูล
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search filters */}
      <div className="p-4 rounded-2xl border border-border/40 bg-card/60 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Search className="w-3.5 h-3.5 text-primary" /> ค้นหาและกรองประวัติ
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">เลขเคส</Label>
            <Input
              value={caseQuery}
              onChange={(e) => { setCaseQuery(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหาเลขเคส..."
              className="h-9 text-xs rounded-xl bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Member ID (ผู้ถูกเตือน)</Label>
            <Input
              value={memberQuery}
              onChange={(e) => { setMemberQuery(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหา Member ID..."
              className="h-9 text-xs rounded-xl bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Barista ID (ผู้เตือน)</Label>
            <Input
              value={baristaQuery}
              onChange={(e) => { setBaristaQuery(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหา Barista ID..."
              className="h-9 text-xs rounded-xl bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">วันที่ทำรายการ</Label>
            <div className="flex gap-2 items-center">
              <DatePicker
                value={dateQuery}
                onChange={(date) => { setDateQuery(date); setCurrentPage(1); }}
                placeholder="เลือกวันที่"
                className="w-full"
              />
              {dateQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-transparent text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => { setDateQuery(''); setCurrentPage(1); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Records Layout Views */}
      {filteredRecords.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">ไม่พบรายการ</div>
      ) : (
        <>
          {layoutView === 'cozy' && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedRecords.map((r, idx) => {
                const cancelled = isCancelled(r);
                const pendingApproval = r._cancelStatus === 'pending';
                const showBlur = r._showBlur ?? false;
                const allImages = [r.image_url, r.image_url_2].filter(Boolean) as string[];
                const barista = resolveDisplayName(r.barista_id);
                const member = resolveDisplayName(r.member_id);
                const memberName = /^User-\d+$/i.test(member.name) ? (r.member_id ?? '-') : member.name;

                return (
                  <Card key={r.id} className="overflow-hidden transition-all relative">
                    <CardContent className="p-0">
                      <div className={cn('h-1.5', cancelled ? 'bg-muted-foreground/30' : pendingApproval ? 'bg-amber-500/60' : 'bg-destructive/80')} />

                      {/* overlay — pending */}
                      {pendingApproval && showBlur && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg p-4">
                          <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-2" />
                          <Badge variant="outline" className="mb-2 text-amber-600 border-amber-500/60">กำลังรอการอนุมัติ</Badge>
                          <p className="text-xs text-muted-foreground text-center">คำขอยกเลิกถูกส่งไปหน้า "รายงาน" แล้ว</p>
                          <Button variant="outline" size="sm" className="gap-1 text-xs mt-3" onClick={() => toggleBlur(r.id)}>
                            <Eye className="h-3 w-3" /> ดูรายละเอียด
                          </Button>
                        </div>
                      )}

                      {/* overlay — cancelled */}
                      {cancelled && showBlur && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg p-4 text-center">
                          <Badge variant="destructive" className="mb-3 gap-1 text-sm"><X className="h-3.5 w-3.5" /> ยกเลิกเคสแล้ว</Badge>
                          <div className="space-y-1.5 mb-4 text-xs text-muted-foreground">
                            {r._requestedBy && <p className="flex items-center justify-center gap-1"><User className="h-3 w-3 text-orange-500" />ผู้ขอ: <span className="font-medium text-foreground">{r._requestedBy}</span></p>}
                            {r._cancelledAt && <p className="flex items-center justify-center gap-1"><Clock className="h-3 w-3" />เมื่อ: {r._cancelledAt}</p>}
                          </div>
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => toggleBlur(r.id)}>
                            <Eye className="h-3 w-3" /> ดูรายละเอียด
                          </Button>
                        </div>
                      )}

                      <div className={cn('p-4 space-y-3', (cancelled || pendingApproval) && !showBlur && 'opacity-60')}>
                        {/* header row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={cancelled ? 'outline' : 'secondary'} className="gap-1 text-xs font-mono">
                              <Hash className="h-3 w-3" />{r.sequence ?? idx + 1}
                            </Badge>
                            {cancelled && !showBlur && <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" /> ยกเลิกแล้ว</Badge>}
                            {pendingApproval && !showBlur && <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/60">รออนุมัติ</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            {webhookEnabled && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10" onClick={() => setSendTarget(r)} title="ส่งแจ้งเตือน Discord">
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleOpenCaseLogs(r)} title="ประวัติการแก้ไข">
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setEditTarget(r); setEditForm({ message: r.message ?? '', punish: r.punish ?? '' }); }} title="แก้ไขข้อมูล">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {(cancelled || pendingApproval) && !showBlur && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleBlur(r.id)} title="ซ่อน">
                                <EyeOff className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {user?.is_owner && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(r)} title="ลบข้อมูลถาวร">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{formatTimestamp(r.log_timestamp || r.created_at)}
                        </div>

                        {/* barista & member */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              {barista.avatar && <AvatarImage src={barista.avatar} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary"><Shield className="h-3.5 w-3.5" /></AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Barista</p>
                              {barista.discord_username
                                ? <><p className="text-xs font-semibold truncate">{barista.discord_username}</p><p className="text-[10px] text-muted-foreground truncate">{barista.name}</p></>
                                : <p className="text-xs font-medium truncate">{barista.name}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              {member.avatar && <AvatarImage src={member.avatar} />}
                              <AvatarFallback className="text-xs bg-destructive/10 text-destructive"><User className="h-3.5 w-3.5" /></AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Member</p>
                              {member.discord_username
                                ? <><p className="text-xs font-semibold truncate">{member.discord_username}</p><p className="text-[10px] text-muted-foreground truncate">{memberName}</p></>
                                : <p className="text-xs font-medium break-all">{memberName}</p>}
                            </div>
                          </div>
                        </div>

                        {r.message && (
                          <div className="flex gap-2 rounded-md bg-muted/30 p-2">
                            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                            <p className="text-sm leading-snug max-h-24 overflow-y-auto pr-1 break-words">{r.message}</p>
                          </div>
                        )}

                        {r.punish && (
                          <div className="flex items-center gap-2">
                            <Gavel className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Badge variant="outline" className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", getPunishBadgeStyle(r.punish))}>
                              {formatPunishLabel(r.punish)}
                            </Badge>
                          </div>
                        )}

                        {allImages.length > 0 && (
                          <div className={cn('grid gap-2', allImages.length >= 2 ? 'grid-cols-2' : 'grid-cols-1')}>
                            {allImages.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="relative cursor-pointer overflow-hidden rounded-lg border border-border/60 hover:ring-2 hover:ring-primary/40 transition-all aspect-video bg-muted/20"
                                onClick={() => { setPreviewImages(allImages); setPreviewIndex(imgIdx); }}
                              >
                                <img src={imgUrl} alt={`หลักฐาน ${imgIdx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </div>
                            ))}
                          </div>
                        )}

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
          )}

          {layoutView === 'list' && (
            <div className="space-y-3">
              {paginatedRecords.map((r, idx) => {
                const cancelled = isCancelled(r);
                const pendingApproval = r._cancelStatus === 'pending';
                const showBlur = r._showBlur ?? false;
                const allImages = [r.image_url, r.image_url_2].filter(Boolean) as string[];
                const barista = resolveDisplayName(r.barista_id);
                const member = resolveDisplayName(r.member_id);
                const memberName = /^User-\d+$/i.test(member.name) ? (r.member_id ?? '-') : member.name;

                return (
                  <Card key={r.id} className="overflow-hidden transition-all relative">
                    <div className={cn('h-1', cancelled ? 'bg-muted-foreground/30' : pendingApproval ? 'bg-amber-500/60' : 'bg-destructive/80')} />
                    
                    {/* Blur Overlays */}
                    {pendingApproval && showBlur && (
                      <div className="absolute inset-0 z-10 flex items-center justify-between bg-background/80 backdrop-blur-sm px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          <Badge variant="outline" className="text-amber-600 border-amber-500/60 text-xs">กำลังรอการอนุมัติยกเลิก</Badge>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => toggleBlur(r.id)}>
                          <Eye className="h-3 w-3" /> ดูข้อมูล
                        </Button>
                      </div>
                    )}
                    {cancelled && showBlur && (
                      <div className="absolute inset-0 z-10 flex items-center justify-between bg-background/90 backdrop-blur-sm px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="gap-1 text-xs"><X className="h-3 w-3" /> ยกเลิกเคสแล้ว</Badge>
                          <span className="text-xs text-muted-foreground">โดย {r._requestedBy} • {r._cancelledAt}</span>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => toggleBlur(r.id)}>
                          <Eye className="h-3 w-3" /> ดูข้อมูล
                        </Button>
                      </div>
                    )}

                    <div className={cn("p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4", (cancelled || pendingApproval) && !showBlur && 'opacity-60')}>
                      {/* Left: Sequence and User Avatars */}
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={cancelled ? 'outline' : 'secondary'} className="font-mono text-xs h-7 w-12 flex items-center justify-center shrink-0">
                          #{r.sequence ?? idx + 1}
                        </Badge>
                        
                        {/* Barista & Member Stack */}
                        <div className="flex items-center -space-x-2 shrink-0">
                          <Avatar className="h-8 w-8 border-2 border-background ring-1 ring-primary/20 shrink-0" title={`Barista: ${barista.name}`}>
                            {barista.avatar && <AvatarImage src={barista.avatar} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">☕</AvatarFallback>
                          </Avatar>
                          <Avatar className="h-8 w-8 border-2 border-background ring-1 ring-destructive/20 shrink-0" title={`Member: ${memberName}`}>
                            {member.avatar && <AvatarImage src={member.avatar} />}
                            <AvatarFallback className="text-[10px] bg-destructive/10 text-destructive">👤</AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="min-w-0 font-medium">
                          <p className="text-xs font-bold leading-tight truncate">
                            {member.discord_username || memberName}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-none">
                            เตือนโดย: {barista.discord_username || barista.name}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Warning message & Punishment */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {r.message && (
                          <p className="text-sm font-semibold truncate max-w-xl text-foreground" title={r.message}>
                            {r.message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatTimestamp(r.log_timestamp || r.created_at)}</span>
                          {r.punish && (
                            <Badge variant="outline" className={cn("text-[9px] font-semibold py-0 px-2 rounded-full border shrink-0 scale-95 origin-left", getPunishBadgeStyle(r.punish))}>
                              {formatPunishLabel(r.punish)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Right: Images and Actions */}
                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        {allImages.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {allImages.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="relative cursor-pointer overflow-hidden rounded-md border border-border w-12 h-8 hover:ring-2 hover:ring-primary/40 transition-all bg-muted/20 shrink-0"
                                onClick={() => { setPreviewImages(allImages); setPreviewIndex(imgIdx); }}
                              >
                                <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1 border-l border-latte/20 pl-3">
                          {webhookEnabled && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10" onClick={() => setSendTarget(r)} title="ส่งแจ้งเตือน Discord">
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenCaseLogs(r)} title="ประวัติการแก้ไข">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditTarget(r); setEditForm({ message: r.message ?? '', punish: r.punish ?? '' }); }} title="แก้ไขข้อมูล">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user?.is_owner && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(r)} title="ลบเคส">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {!cancelled && !pendingApproval && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => setCancelTarget(r)} title="ยกเลิกเคส">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {layoutView === 'compact' && (
            <div className="border border-latte/40 rounded-2xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-cream/10 dark:bg-card/40 border-b border-latte/45 text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">
                      <th className="py-3 px-4 font-mono w-16">เลขเคส</th>
                      <th className="py-3 px-4">ผู้ถูกเตือน (Member)</th>
                      <th className="py-3 px-4">ผู้เตือน (Barista)</th>
                      <th className="py-3 px-4 max-w-xs">รายละเอียดการเตือน</th>
                      <th className="py-3 px-4">บทลงโทษ</th>
                      <th className="py-3 px-4">วันที่ทำรายการ</th>
                      <th className="py-3 px-4">หลักฐาน</th>
                      <th className="py-3 px-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((r, idx) => {
                      const cancelled = isCancelled(r);
                      const pendingApproval = r._cancelStatus === 'pending';
                      const allImages = [r.image_url, r.image_url_2].filter(Boolean) as string[];
                      const barista = resolveDisplayName(r.barista_id);
                      const member = resolveDisplayName(r.member_id);
                      const memberName = /^User-\d+$/i.test(member.name) ? (r.member_id ?? '-') : member.name;

                      return (
                        <tr key={r.id} className={cn("border-b border-border/20 text-xs hover:bg-muted/10 transition-colors", (cancelled || pendingApproval) && "opacity-60 bg-muted/5")}>
                          <td className="py-3 px-4 font-mono font-bold">
                            #{r.sequence ?? idx + 1}
                            {cancelled && <span className="ml-1 text-[9px] text-destructive font-semibold">(ยกเลิก)</span>}
                            {pendingApproval && <span className="ml-1 text-[9px] text-amber-600 font-semibold">(รออนุมัติ)</span>}
                          </td>
                          <td className="py-3 px-4 font-semibold">{member.discord_username || memberName}</td>
                          <td className="py-3 px-4 text-muted-foreground">{barista.discord_username || barista.name}</td>
                          <td className="py-3 px-4 truncate max-w-[200px]" title={r.message ?? ''}>{r.message || '-'}</td>
                          <td className="py-3 px-4">
                            {r.punish ? (
                              <Badge variant="outline" className={cn("text-[9px] font-bold py-0 px-2 rounded-full border", getPunishBadgeStyle(r.punish))}>
                                {formatPunishLabel(r.punish)}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatTimestamp(r.log_timestamp || r.created_at)}</td>
                          <td className="py-3 px-4">
                            {allImages.length > 0 ? (
                              <div className="flex gap-0.5">
                                {allImages.map((imgUrl, imgIdx) => (
                                  <button
                                    key={imgIdx}
                                    className="w-8 h-6 border border-border/85 rounded bg-muted/20 overflow-hidden text-[9px] font-mono hover:border-primary transition-all shrink-0"
                                    onClick={() => { setPreviewImages(allImages); setPreviewIndex(imgIdx); }}
                                  >
                                    รูป {imgIdx + 1}
                                  </button>
                                ))}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              {webhookEnabled && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-500" onClick={() => setSendTarget(r)} title="ส่งแจ้งเตือน Discord">
                                  <Mail className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleOpenCaseLogs(r)} title="ประวัติการแก้ไข">
                                <History className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => { setEditTarget(r); setEditForm({ message: r.message ?? '', punish: r.punish ?? '' }); }} title="แก้ไขข้อมูล">
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {user?.is_owner && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(r)} title="ลบข้อมูล">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {!cancelled && !pendingApproval && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setCancelTarget(r)} title="ยกเลิกเคส">
                                  <Ban className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-muted-foreground px-1">...</span>}
                      <Button variant={p === currentPage ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setCurrentPage(p)}>{p}</Button>
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
                    <button key={i} type="button" onClick={() => setPreviewIndex(i)} className={cn('w-12 h-12 rounded-md overflow-hidden border-2 transition-all', i === previewIndex ? 'border-primary ring-1 ring-primary/30' : 'border-border/40 opacity-60 hover:opacity-100')}>
                      <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">{previewIndex + 1} / {previewImages.length}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send to Discord Dialog */}
      <Dialog open={Boolean(sendTarget)} onOpenChange={(o) => !o && setSendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-blue-500" /> ยืนยันส่งแจ้งเตือน Discord</DialogTitle>
            <DialogDescription>
              ต้องการส่ง Component v2 ไปยัง Discord สำหรับเคส <strong>#{sendTarget?.sequence}</strong> ของสมาชิก <strong>{resolveDisplayName(sendTarget?.member_id ?? null).name}</strong> ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSendTarget(null)} disabled={isSending}>ยกเลิก</Button>
            <Button onClick={handleSendToDiscord} disabled={isSending} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ยืนยันส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> แก้ไขข้อมูลแท็กเตือน</DialogTitle>
            <DialogDescription>เคส #{editTarget?.sequence} — {resolveDisplayName(editTarget?.member_id ?? null).name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ข้อความเตือน</Label>
                {templates.length > 0 && (
                  <Select onValueChange={(v) => handleSelectTemplate(v, 'edit')}>
                    <SelectTrigger className="h-7 text-xs w-[180px] bg-primary/5 border-primary/20 text-primary rounded-lg font-semibold">
                      <SelectValue placeholder="เลือกจากเทมเพลต" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.message} className="text-xs font-medium">
                          {tpl.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea value={editForm.message} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>บทลงโทษ</Label>
              <Select value={editForm.punish} onValueChange={(v) => setEditForm({ ...editForm, punish: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกบทลงโทษ" /></SelectTrigger>
                <SelectContent>
                  {PUNISH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isSavingEdit}>ยกเลิก</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="gap-2">
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> ยืนยันยกเลิกเคส</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิกเคส <strong>#{cancelTarget?.sequence}</strong> ของสมาชิก <strong>{resolveDisplayName(cancelTarget?.member_id ?? null).name}</strong> ใช่หรือไม่?
              <br /><span className="text-destructive">ระบบจะส่งคำขอไปหน้า "รายงาน" เพื่อให้ Owner อนุมัติการยกเลิก</span>
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

      {/* Delete Confirm Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> ยืนยันการลบข้อมูลถาวร</DialogTitle>
            <DialogDescription>
              คุณต้องการลบเคส <strong>#{deleteTarget?.sequence}</strong> ของสมาชิก <strong>{resolveDisplayName(deleteTarget?.member_id ?? null).name}</strong> ใช่หรือไม่?
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

      {/* Template Manager Dialog */}
      <Dialog open={isTemplateManagerOpen} onOpenChange={setIsTemplateManagerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-latte/45 bg-cream/10 dark:bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#8C6239] dark:text-[#EAD8C8]">
              <MessageSquare className="h-5 w-5" /> จัดการข้อความเทมเพลต
            </DialogTitle>
            <DialogDescription className="text-xs">
              สร้าง แก้ไข หรือลบข้อความเทมเพลตสำหรับใช้ในการกรอกข้อความเตือน
            </DialogDescription>
          </DialogHeader>

          {/* Form */}
          <div className="p-4 rounded-xl border border-latte/40 bg-muted/20 space-y-3">
            <h4 className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8]">{editingTemplate ? 'แก้ไขเทมเพลต' : 'เพิ่มเทมเพลตใหม่'}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">หัวข้อ (Title)</Label>
                <Input
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="เช่น เตือนพฤติกรรมไม่เหมาะสม"
                  className="h-9 rounded-xl border-latte/40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ข้อความเตือน (Message)</Label>
                <Textarea
                  value={templateForm.message}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="รายละเอียดข้อความที่จะแทรกลงในช่องข้อความเตือน..."
                  className="min-h-[80px] border-latte/40 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editingTemplate && (
                <Button variant="ghost" size="sm" onClick={handleCancelEditTemplate} className="hover:bg-cream/10">
                  ยกเลิกแก้ไข
                </Button>
              )}
              <Button size="sm" onClick={handleSaveTemplate} disabled={savingTemplate} className="gap-1 bg-green-600 hover:bg-green-700">
                {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {editingTemplate ? 'บันทึกการแก้ไข' : 'เพิ่มเทมเพลต'}
              </Button>
            </div>
          </div>

          {/* Templates list */}
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8]">รายการเทมเพลตทั้งหมด ({templates.length})</h4>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">ยังไม่มีข้อความเทมเพลตในระบบ</p>
            ) : (
              <div className="space-y-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="p-3 border border-latte/30 rounded-xl bg-background/50 hover:bg-background/80 transition-colors flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-bold text-foreground">{tpl.title}</p>
                      <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">{tpl.message}</p>
                      <p className="text-[10px] text-muted-foreground pt-1">
                        สร้างโดย {tpl.created_by} • {formatTimestamp(tpl.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleStartEditTemplate(tpl)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Case Logs Dialog */}
      <Dialog open={isCaseLogsOpen} onOpenChange={setIsCaseLogsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border-latte/45 bg-cream/10 dark:bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#8C6239] dark:text-[#EAD8C8]">
              <History className="h-5 w-5 text-primary" /> ประวัติการแก้ไขเคส #{caseLogsTarget?.sequence}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ดูรายละเอียดการแก้ไขข้อมูลของเคสนี้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingCaseLogs ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : selectedCaseLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">เคสนี้ยังไม่เคยถูกแก้ไขประวัติ</p>
            ) : (
              <div className="space-y-4">
                {selectedCaseLogs.map((log) => (
                  <div key={log.id} className="p-3 border border-latte/30 rounded-xl bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          {log.operator_avatar && <AvatarImage src={log.operator_avatar} />}
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">👤</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold">{log.operator_name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatTimestamp(log.created_at)}</span>
                    </div>
                    <div className="text-xs text-foreground bg-muted/30 p-2 rounded-lg font-semibold">
                      รายละเอียด: {log.details}
                    </div>
                    
                    {log.before_data && log.after_data && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                        <div className="space-y-1">
                          <span className="font-bold text-destructive">ก่อนแก้:</span>
                          <div className="p-1.5 bg-red-500/5 border border-red-500/10 rounded text-[10px] space-y-1 text-muted-foreground">
                            <p><strong>ข้อความ:</strong> {log.before_data.message || '-'}</p>
                            <p><strong>บทลงโทษ:</strong> {log.before_data.punish || '-'}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="font-bold text-green-600 dark:text-green-400">หลังแก้:</span>
                          <div className="p-1.5 bg-green-500/5 border border-green-500/10 rounded text-[10px] space-y-1">
                            <p><strong>ข้อความ:</strong> {log.after_data.message || '-'}</p>
                            <p><strong>บทลงโทษ:</strong> {log.after_data.punish || '-'}</p>
                          </div>
                        </div>
                      </div>
                    )}
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
