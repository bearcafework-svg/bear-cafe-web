import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { MINIGAME_CONFIGS } from './MinigamesManagement';
import {
  Gamepad2, CheckCircle2, XCircle, Clock, AlertTriangle, Trash2, Edit3, Plus,
  RefreshCw, CheckSquare, Square, ArrowRight, User, ShieldCheck, ShieldAlert
} from 'lucide-react';

export interface MinigameChangeRequest {
  id: string;
  question_id: number | null;
  action_type: 'create' | 'update' | 'delete';
  game_id: number;
  new_data: {
    word_or_question?: string;
    answer?: string;
    category?: string;
    hints?: string[];
    options?: string[];
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    is_active?: boolean;
  };
  old_data?: {
    word_or_question?: string;
    answer?: string;
    category?: string;
    hints?: string[];
    options?: string[];
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    is_active?: boolean;
  } | null;
  requested_by: string;
  requested_by_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

interface MinigameRequestsManagementProps {
  onPendingCountChange?: (count: number) => void;
}

export function MinigameRequestsManagement({ onPendingCountChange }: MinigameRequestsManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<MinigameChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  // Rejection Dialog state
  const [rejectDialogTarget, setRejectDialogTarget] = useState<string[] | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('minigame_change_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, handle gracefully
        if (error.code === '42P01' || error.code === 'PGRST205') {
          setRequests([]);
          onPendingCountChange?.(0);
          return;
        }
        throw error;
      }

      const list = (data as MinigameChangeRequest[]) || [];
      setRequests(list);

      const pendingCount = list.filter((r) => r.status === 'pending').length;
      onPendingCountChange?.(pendingCount);
    } catch (err: any) {
      console.error('Error fetching minigame change requests:', err);
      toast({
        title: 'เกิดข้อผิดพลาดในการโหลดคำขอมินิเกม',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterGame !== 'all' && String(r.game_id) !== filterGame) return false;
      return true;
    });
  }, [requests, filterStatus, filterGame]);

  const pendingRequests = useMemo(() => {
    return filteredRequests.filter((r) => r.status === 'pending');
  }, [filteredRequests]);

  const allPendingSelected = useMemo(() => {
    if (pendingRequests.length === 0) return false;
    return pendingRequests.every((r) => selectedIds.has(r.id));
  }, [pendingRequests, selectedIds]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  // Approval logic (RPC first with JS atomic fallback)
  const handleApproveRequests = async (requestIds: string[]) => {
    if (!user?.is_owner) {
      toast({
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        description: 'เฉพาะเจ้าของร้าน (Owner) เท่านั้นที่มีสิทธิ์อนุมัติคำขอ',
        variant: 'destructive',
      });
      return;
    }

    if (requestIds.length === 0) return;
    setProcessing(true);

    const approverId = user.discord_id || user.id;
    const approverName = user.username || user.discord_username || 'Owner';

    try {
      // 1. Try atomic RPC
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('batch_approve_minigame_requests', {
        _request_ids: requestIds,
        _approver_id: approverId,
        _approver_name: approverName,
      });

      if (!rpcErr) {
        toast({
          title: 'อนุมัติคำขอสำเร็จ 🎉',
          description: `อนุมัติคำขอมินิเกมจำนวน ${rpcRes?.approved_count ?? requestIds.length} รายการ และอัปเดตลงคลังโจทย์เรียบร้อยแล้ว`,
        });
        setSelectedIds(new Set());
        await fetchRequests();
        return;
      }

      // 2. Fallback JS Loop if RPC is not deployed yet
      console.warn('RPC batch_approve_minigame_requests unavailable, using JS fallback:', rpcErr);
      const targetReqs = requests.filter((r) => requestIds.includes(r.id) && r.status === 'pending');

      for (const req of targetReqs) {
        if (req.action_type === 'create') {
          const { data: inserted, error: insErr } = await (supabase as any)
            .from('minigame_questions')
            .insert({
              game_id: req.game_id,
              word_or_question: req.new_data?.word_or_question || '',
              answer: req.new_data?.answer || '',
              category: req.new_data?.category || 'คำทั่วไป',
              hints: req.new_data?.hints || [],
              options: req.new_data?.options || [],
              difficulty: req.new_data?.difficulty || null,
              is_active: req.new_data?.is_active ?? true,
              status: 'approved',
              created_by: req.requested_by,
              created_by_name: req.requested_by_name,
              updated_by: approverId,
              updated_by_name: approverName,
            })
            .select('id')
            .single();

          if (insErr) throw insErr;

          await (supabase as any)
            .from('minigame_change_requests')
            .update({
              status: 'approved',
              question_id: inserted?.id,
              approved_by: approverId,
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', req.id);
        } else if (req.action_type === 'update' && req.question_id) {
          const { error: updErr } = await (supabase as any)
            .from('minigame_questions')
            .update({
              word_or_question: req.new_data?.word_or_question,
              answer: req.new_data?.answer,
              category: req.new_data?.category || 'คำทั่วไป',
              hints: req.new_data?.hints || [],
              options: req.new_data?.options || [],
              difficulty: req.new_data?.difficulty || null,
              status: 'approved',
              pending_request_id: null,
              updated_by: req.requested_by,
              updated_by_name: req.requested_by_name,
              updated_at: new Date().toISOString(),
            })
            .eq('id', req.question_id);

          if (updErr) throw updErr;

          await (supabase as any)
            .from('minigame_change_requests')
            .update({
              status: 'approved',
              approved_by: approverId,
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', req.id);
        } else if (req.action_type === 'delete' && req.question_id) {
          const { error: delErr } = await (supabase as any)
            .from('minigame_questions')
            .delete()
            .eq('id', req.question_id);

          if (delErr) throw delErr;

          await (supabase as any)
            .from('minigame_change_requests')
            .update({
              status: 'approved',
              approved_by: approverId,
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', req.id);
        }
      }

      toast({
        title: 'อนุมัติคำขอสำเร็จ 🎉',
        description: `อนุมัติคำขอมินิเกมจำนวน ${targetReqs.length} รายการ เรียบร้อยแล้วค่ะ`,
      });
      setSelectedIds(new Set());
      await fetchRequests();
    } catch (err: any) {
      console.error('Error approving minigame request:', err);
      toast({
        title: 'เกิดข้อผิดพลาดในการอนุมัติ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Rejection logic (RPC first with JS fallback)
  const handleRejectRequests = async (requestIds: string[], reason?: string) => {
    if (!user?.is_owner) {
      toast({
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        description: 'เฉพาะเจ้าของร้าน (Owner) เท่านั้นที่มีสิทธิ์ปฏิเสธคำขอ',
        variant: 'destructive',
      });
      return;
    }

    if (requestIds.length === 0) return;
    setProcessing(true);

    const rejecterId = user.discord_id || user.id;

    try {
      // 1. Try atomic RPC
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('batch_reject_minigame_requests', {
        _request_ids: requestIds,
        _rejecter_id: rejecterId,
        _reason: reason?.trim() || null,
      });

      if (!rpcErr) {
        toast({
          title: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
          description: `ปฏิเสธคำขอจำนวน ${rpcRes?.rejected_count ?? requestIds.length} รายการ`,
        });
        setSelectedIds(new Set());
        setRejectDialogTarget(null);
        setRejectionReason('');
        await fetchRequests();
        return;
      }

      // 2. Fallback JS Loop
      console.warn('RPC batch_reject_minigame_requests unavailable, using JS fallback:', rpcErr);
      const targetReqs = requests.filter((r) => requestIds.includes(r.id) && r.status === 'pending');

      for (const req of targetReqs) {
        if (req.question_id) {
          await (supabase as any)
            .from('minigame_questions')
            .update({
              status: 'approved',
              pending_request_id: null,
            })
            .eq('id', req.question_id);
        }

        await (supabase as any)
          .from('minigame_change_requests')
          .update({
            status: 'rejected',
            rejected_by: rejecterId,
            rejected_at: new Date().toISOString(),
            rejection_reason: reason?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.id);
      }

      toast({
        title: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
        description: `ปฏิเสธคำขอจำนวน ${targetReqs.length} รายการ`,
      });
      setSelectedIds(new Set());
      setRejectDialogTarget(null);
      setRejectionReason('');
      await fetchRequests();
    } catch (err: any) {
      console.error('Error rejecting minigame request:', err);
      toast({
        title: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-[#1E1B18] border border-[#EAD8C8] dark:border-[#2D2520] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
            🎮
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              คำขอปรับปรุงคลังคำศัพท์มินิเกม
              {pendingRequests.length > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {pendingRequests.length} รออนุมัติ
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              คำขอเพิ่ม แก้ไข หรือลบคำถามจากทีมงาน สิทธิ์ Owner ตรวจสอบความถูกต้องและอนุมัติเข้าเกมได้ทันที
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-[#FAF6F0]/50 dark:bg-[#25201C]/50">
              <SelectValue placeholder="สถานะคำขอ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">⏳ รออนุมัติ</SelectItem>
              <SelectItem value="approved">✅ อนุมัติแล้ว</SelectItem>
              <SelectItem value="rejected">❌ ปฏิเสธ</SelectItem>
              <SelectItem value="all">ทั้งหมด</SelectItem>
            </SelectContent>
          </Select>

          {/* Game Filter */}
          <Select value={filterGame} onValueChange={setFilterGame}>
            <SelectTrigger className="w-44 h-9 text-xs rounded-xl border-[#EAD8C8] dark:border-[#2D2520] bg-[#FAF6F0]/50 dark:bg-[#25201C]/50">
              <SelectValue placeholder="เลือกมินิเกม" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">🎮 ทุกมินิเกม</SelectItem>
              {Object.values(MINIGAME_CONFIGS).map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.icon} เกม {g.id}: {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-xl border-[#EAD8C8] dark:border-[#2D2520] shrink-0"
            onClick={fetchRequests}
            title="รีเฟรชคำขอ"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Batch Operations Toolbar */}
      {user?.is_owner && pendingRequests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllPending}
              className="h-8 text-xs font-semibold rounded-xl border-amber-500/30 gap-1.5 bg-white dark:bg-[#1E1B18]"
            >
              {allPendingSelected ? <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
              {allPendingSelected ? 'ยกเลิกการเลือก' : `เลือกทั้งหมด (${pendingRequests.length})`}
            </Button>
            <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
              เลือกแล้ว <strong className="font-bold text-amber-700 dark:text-amber-300">{selectedIds.size}</strong> รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={selectedIds.size === 0 || processing}
              onClick={() => setRejectDialogTarget(Array.from(selectedIds))}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              ปฏิเสธที่เลือก ({selectedIds.size})
            </Button>

            <Button
              size="sm"
              disabled={selectedIds.size === 0 || processing}
              onClick={() => handleApproveRequests(Array.from(selectedIds))}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
            >
              {processing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              อนุมัติที่เลือก ({selectedIds.size}) ในคลิกเดียว
            </Button>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-white dark:bg-[#1E1B18] rounded-3xl border border-[#EAD8C8] dark:border-[#2D2520]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600 opacity-60" />
          กำลังโหลดรายการคำขอ...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-white dark:bg-[#1E1B18] rounded-3xl border border-dashed border-[#EAD8C8] dark:border-[#2D2520]">
          <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          {filterStatus === 'pending'
            ? 'ไม่มีคำขอที่รออนุมัติในขณะนี้ ทุกอย่างเป็นปัจจุบันแล้วค่ะ ✨'
            : 'ไม่พบรายการคำขอตามเงื่อนไขที่เลือก'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const gConfig = MINIGAME_CONFIGS[req.game_id];
            const isPending = req.status === 'pending';
            const isSelected = selectedIds.has(req.id);

            const isCreate = req.action_type === 'create';
            const isUpdate = req.action_type === 'update';
            const isDelete = req.action_type === 'delete';

            const cardBorderClass =
              req.status === 'approved'
                ? 'border-l-emerald-500'
                : req.status === 'rejected'
                ? 'border-l-rose-500'
                : isCreate
                ? 'border-l-emerald-500'
                : isUpdate
                ? 'border-l-amber-500'
                : 'border-l-rose-500';

            return (
              <Card
                key={req.id}
                className={cn(
                  "bg-white dark:bg-[#1E1B18] border border-[#EAD8C8] dark:border-[#2D2520] border-l-4 rounded-2xl shadow-xs overflow-hidden transition-all",
                  cardBorderClass,
                  isSelected && "ring-2 ring-amber-500/50 bg-amber-500/5"
                )}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    {/* Left: Content & Diff */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Badges & Meta row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {user?.is_owner && isPending && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(req.id)}
                            className="mr-1 h-4 w-4 rounded border-[#C4A482] data-[state=checked]:bg-amber-600"
                          />
                        )}

                        {/* Action Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md",
                            isCreate && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                            isUpdate && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                            isDelete && "bg-rose-500/10 text-rose-600 border-rose-500/30"
                          )}
                        >
                          {isCreate && <Plus className="w-3 h-3 mr-1 inline" />}
                          {isUpdate && <Edit3 className="w-3 h-3 mr-1 inline" />}
                          {isDelete && <Trash2 className="w-3 h-3 mr-1 inline" />}
                          {isCreate ? 'ขอเพิ่มคำถามใหม่' : isUpdate ? `ขอแก้ไขข้อ #${req.question_id}` : `ขอลบข้อ #${req.question_id}`}
                        </Badge>

                        {/* Game Badge */}
                        <Badge variant="secondary" className="bg-[#FAF5EE] dark:bg-[#25201C] text-[#8C6239] dark:text-[#EAD8C8] border border-[#EFE8DD] dark:border-[#382F28] text-[10px] px-2 py-0.5 rounded-md font-semibold">
                          <span>{gConfig?.icon || '🎮'}</span>
                          <span className="ml-1">เกม {req.game_id}: {gConfig?.name || `มินิเกม ${req.game_id}`}</span>
                        </Badge>

                        {/* Status Badge */}
                        <Badge
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-semibold",
                            req.status === 'pending' && "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                            req.status === 'approved' && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
                            req.status === 'rejected' && "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                          )}
                        >
                          {req.status === 'pending' ? '⏳ รออนุมัติ' : req.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธ'}
                        </Badge>

                        <span className="text-[11px] text-muted-foreground ml-auto">
                          ส่งเมื่อ {new Date(req.created_at).toLocaleString('th-TH')}
                        </span>
                      </div>

                      {/* Diff Box: Before vs After */}
                      {isUpdate && req.old_data && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-2xl bg-[#FAF6F0]/80 dark:bg-[#25201C]/80 border border-[#EAD8C8]/80 dark:border-[#2D2520] text-xs">
                          {/* Old Data */}
                          <div className="space-y-1.5 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                              ข้อมูลเดิม (Before)
                            </span>
                            <div className="space-y-1">
                              <div>
                                <span className="text-muted-foreground text-[11px]">โจทย์: </span>
                                <strong className="text-foreground">{req.old_data.word_or_question}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-[11px]">เฉลย: </span>
                                <strong className="text-rose-600 dark:text-rose-400 font-mono">{req.old_data.answer}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-[11px]">หมวดหมู่: </span>
                                <span>{req.old_data.category || 'คำทั่วไป'}</span>
                              </div>
                              {req.old_data.hints && req.old_data.hints.length > 0 && (
                                <div className="text-[11px] text-muted-foreground">
                                  คำใบ้: {req.old_data.hints.join(' | ')}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* New Data */}
                          <div className="space-y-1.5 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                              ข้อมูลใหม่ที่ขอแก้ (Proposed After)
                            </span>
                            <div className="space-y-1">
                              <div>
                                <span className="text-muted-foreground text-[11px]">โจทย์: </span>
                                <strong className="text-emerald-700 dark:text-emerald-300">{req.new_data.word_or_question}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-[11px]">เฉลย: </span>
                                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{req.new_data.answer}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-[11px]">หมวดหมู่: </span>
                                <span>{req.new_data.category || 'คำทั่วไป'}</span>
                              </div>
                              {req.new_data.hints && req.new_data.hints.length > 0 && (
                                <div className="text-[11px] text-muted-foreground">
                                  คำใบ้: {req.new_data.hints.join(' | ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {isCreate && (
                        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                            คำถามใหม่ที่ขอเพิ่ม
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground text-[11px]">โจทย์: </span>
                              <strong className="text-foreground">{req.new_data.word_or_question}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[11px]">เฉลยคำตอบ: </span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{req.new_data.answer}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[11px]">หมวดหมู่: </span>
                              <span>{req.new_data.category || 'คำทั่วไป'}</span>
                            </div>
                            {req.new_data.difficulty && (
                              <div>
                                <span className="text-muted-foreground text-[11px]">ความยาก: </span>
                                <span className="font-semibold">{req.new_data.difficulty}</span>
                              </div>
                            )}
                          </div>
                          {req.new_data.hints && req.new_data.hints.length > 0 && (
                            <div className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
                              คำใบ้: {req.new_data.hints.join(' | ')}
                            </div>
                          )}
                        </div>
                      )}

                      {isDelete && (
                        <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-1.5">
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                            ขอลบคำถามข้อ #{req.question_id} ออกจากระบบ
                          </span>
                          {req.old_data && (
                            <div>
                              <span className="text-muted-foreground text-[11px]">โจทย์: </span>
                              <strong className="text-foreground">{req.old_data.word_or_question}</strong>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="text-muted-foreground text-[11px]">เฉลย: </span>
                              <strong className="font-mono">{req.old_data.answer}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Requester & Audit Details */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-600" />
                          <span>ผู้ส่งคำขอ:</span>
                          <strong className="text-foreground font-semibold">
                            {req.requested_by_name || req.requested_by || 'Staff'}
                          </strong>
                        </span>

                        {req.approved_by && (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>อนุมัติโดย: {req.approved_by} ({new Date(req.approved_at || '').toLocaleTimeString('th-TH')})</span>
                          </span>
                        )}

                        {req.rejected_by && (
                          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>ปฏิเสธโดย: {req.rejected_by}</span>
                            {req.rejection_reason && <span className="italic">({req.rejection_reason})</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons (Only for Owner when status is pending) */}
                    {user?.is_owner && isPending && (
                      <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EAD8C8]/60">
                        <Button
                          size="sm"
                          disabled={processing}
                          onClick={() => handleApproveRequests([req.id])}
                          className="flex-1 sm:flex-initial h-8 text-xs font-bold rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer w-full"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          อนุมัติ
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={processing}
                          onClick={() => setRejectDialogTarget([req.id])}
                          className="flex-1 sm:flex-initial h-8 text-xs font-bold rounded-xl gap-1.5 cursor-pointer w-full"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          ปฏิเสธ
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

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectDialogTarget} onOpenChange={(open) => !open && setRejectDialogTarget(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              ปฏิเสธคำขอมินิเกม
            </DialogTitle>
            <DialogDescription className="text-xs">
              คุณกำลังจะปฏิเสธคำขอจำนวน {rejectDialogTarget?.length ?? 1} รายการ คำขอที่ถูกปฏิเสธจะไม่ถูกนำไปใช้ในเกม
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">
              เหตุผลการปฏิเสธ (ระบุหรือไม่ก็ได้)
            </label>
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="เช่น ข้อมูลเฉลยไม่ตรง, คำศัพท์ซ้ำซ้อน, กรอกผิดหมวดหมู่"
              className="text-xs rounded-xl h-10 border-[#EAD8C8] dark:border-[#2D2520]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogTarget(null)}
              className="rounded-xl text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={processing}
              onClick={() => rejectDialogTarget && handleRejectRequests(rejectDialogTarget, rejectionReason)}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              ยืนยันการปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
