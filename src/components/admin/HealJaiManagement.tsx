import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HeartHandshake, Users, ClipboardList, Wallet, Plus, Edit2, Trash2, Search,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, Eye, DollarSign, Calendar,
  ChevronLeft, ChevronRight, Copy, Check, MessageSquare, PhoneCall,
  VolumeX, Image as ImageIcon, Sparkles, X, UserCheck, ShieldAlert,
  ArrowRight, FileText, Download, CheckCheck, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counselor {
  id: number;
  guild_id?: string;
  user_id: string;
  display_name: string | null;
  status: 'ONLINE' | 'BUSY' | 'BREAK' | 'OFFLINE' | string;
  bio: string | null;
  image_url: string | null;
  service_modes: string[] | null;
  is_silent_companion: boolean | null;
  payout_account: string | null;
  payout_bank?: string | null;
  payout_name?: string | null;
  accumulated_earnings: number | null;
  total_sessions: number | null;
  average_rating: number | null;
  total_reviews: number | null;
  specialty_tags: string[] | null;
  created_at?: string;
  updated_at?: string;
}

interface OrderSession {
  id: number;
  order_code: string;
  guild_id: string;
  customer_id: string;
  counselor_id: string | null;
  package_tier: string | null;
  package_name: string | null;
  duration_minutes: number;
  is_silent: boolean | null;
  is_specific_counselor: boolean | null;
  service_mode: string | null;
  total_price: number;
  counselor_share: number;
  platform_share: number;
  payment_status: string;
  session_status: string;
  slip_url: string | null;
  slip_verified_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface PayoutRecord {
  id: number;
  guild_id?: string;
  counselor_id: string;
  amount: number;
  period_end: string;
  status: 'pending' | 'paid' | 'cancelled' | string;
  payout_account: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

const ALL_SPECIALTIES = [
  'ปัญหาการเรียน หรือ ชีวิตวัยรุ่น',
  'ปัญหาความรัก หรือ ความสัมพันธ์',
  'ปัญหาการทำงาน หรือ เพื่อนร่วมงาน',
  'การพัฒนาตัวเอง หรือ ให้กำลังใจ',
  'ไม่เจาะจง ขอแค่เป็นพื้นที่ปลอดภัยให้ระบายความในใจ',
];

interface HealJaiManagementProps {
  currentUser?: { id: string; username?: string; is_owner?: boolean } | null;
  isOwner?: boolean;
}

export function HealJaiManagement({ currentUser, isOwner }: HealJaiManagementProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'counselors' | 'logs' | 'revenue'>('counselors');

  // ── 1. Tab Counselors State ──
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loadingCounselors, setLoadingCounselors] = useState(false);
  const [counselorSearch, setCounselorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Edit / Add Counselor Dialog
  const [isCounselorDialogOpen, setIsCounselorDialogOpen] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState<Counselor | null>(null);
  const [counselorForm, setCounselorForm] = useState<{
    user_id: string;
    display_name: string;
    bio: string;
    image_url: string;
    status: string;
    service_modes: string[];
    is_silent_companion: boolean;
    payout_bank: string;
    payout_account: string;
    payout_name: string;
    specialty_tags: string[];
  }>({
    user_id: '',
    display_name: '',
    bio: '',
    image_url: '',
    status: 'ONLINE',
    service_modes: ['chat', 'voice'],
    is_silent_companion: true,
    payout_bank: 'พร้อมเพย์',
    payout_account: '',
    payout_name: '',
    specialty_tags: ['ไม่เจาะจง ขอแค่เป็นพื้นที่ปลอดภัยให้ระบายความในใจ'],
  });
  const [savingCounselor, setSavingCounselor] = useState(false);

  // ── 2. Tab Logs State ──
  const [orders, setOrders] = useState<OrderSession[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);

  // Delete Confirm Dialogs
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [isPurgeAllLogsOpen, setIsPurgeAllLogsOpen] = useState(false);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState('');
  const [deletingLogs, setDeletingLogs] = useState(false);

  // ── 3. Tab Revenue & Payouts State ──
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1); // 1-12

  // Cut-off Payout Dialog
  const [isCreatePayoutOpen, setIsCreatePayoutOpen] = useState(false);
  const [payoutTargetCounselor, setPayoutTargetCounselor] = useState<Counselor | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [creatingPayout, setCreatingPayout] = useState(false);

  // ── Fetch Functions ──
  const fetchCounselors = useCallback(async () => {
    setLoadingCounselors(true);
    try {
      const { data, error } = await supabase
        .from('heal_jai_counselors' as any)
        .select('*')
        .order('status', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setCounselors((data || []) as Counselor[]);
    } catch (err: any) {
      console.error('[HealJai] Error fetching counselors:', err);
      toast({
        title: 'โหลดข้อมูลผู้รับฟังไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingCounselors(false);
    }
  }, [toast]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('heal_jai_orders_sessions' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as OrderSession[]);
    } catch (err: any) {
      console.error('[HealJai] Error fetching orders:', err);
      toast({
        title: 'โหลดประวัติ Log ออเดอร์ไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingOrders(false);
    }
  }, [toast]);

  const fetchPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const { data, error } = await supabase
        .from('heal_jai_payouts' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts((data || []) as PayoutRecord[]);
    } catch (err: any) {
      console.error('[HealJai] Error fetching payouts:', err);
      toast({
        title: 'โหลดประวัติการโอนเงินไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingPayouts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCounselors();
    fetchOrders();
    fetchPayouts();
  }, [fetchCounselors, fetchOrders, fetchPayouts]);

  // ── Counselors Handlers ──
  const handleToggleTag = (tag: string) => {
    setCounselorForm((prev) => {
      const exists = prev.specialty_tags.includes(tag);
      return {
        ...prev,
        specialty_tags: exists
          ? prev.specialty_tags.filter((t) => t !== tag)
          : [...prev.specialty_tags, tag],
      };
    });
  };

  const openAddCounselor = () => {
    setEditingCounselor(null);
    setCounselorForm({
      user_id: '',
      display_name: '',
      bio: '',
      image_url: '',
      status: 'ONLINE',
      service_modes: ['chat', 'voice'],
      is_silent_companion: true,
      payout_bank: 'พร้อมเพย์',
      payout_account: '',
      payout_name: '',
      specialty_tags: ['ไม่เจาะจง ขอแค่เป็นพื้นที่ปลอดภัยให้ระบายความในใจ'],
    });
    setIsCounselorDialogOpen(true);
  };

  const openEditCounselor = (c: Counselor) => {
    setEditingCounselor(c);

    let bank = c.payout_bank || '';
    let account = c.payout_account || '';
    let name = c.payout_name || '';

    // If bank & name are not separately stored yet, try parsing from formatted payout_account
    if (!bank && !name && account) {
      const match = account.match(/^(.*?)\s+([0-9\-\s]+)\s*\((.*?)\)$/);
      if (match) {
        bank = match[1].trim();
        account = match[2].trim();
        name = match[3].trim();
      }
    }

    setCounselorForm({
      user_id: c.user_id,
      display_name: c.display_name || '',
      bio: c.bio || '',
      image_url: c.image_url || '',
      status: c.status || 'ONLINE',
      service_modes: Array.isArray(c.service_modes) ? c.service_modes : ['chat', 'voice'],
      is_silent_companion: c.is_silent_companion ?? true,
      payout_bank: bank,
      payout_account: account,
      payout_name: name,
      specialty_tags: Array.isArray(c.specialty_tags)
        ? [...c.specialty_tags]
        : (typeof c.specialty_tags === 'string'
            ? (c.specialty_tags as string).split(',').map((s) => s.trim()).filter(Boolean)
            : []),
    });
    setIsCounselorDialogOpen(true);
  };

  const handleSaveCounselor = async () => {
    if (!counselorForm.user_id.trim()) {
      toast({ title: 'กรุณากรอก Discord ID', variant: 'destructive' });
      return;
    }

    setSavingCounselor(true);
    try {
      const tagsArray = counselorForm.specialty_tags.filter(Boolean);
      const bank = counselorForm.payout_bank.trim();
      const accountNum = counselorForm.payout_account.trim();
      const recipientName = counselorForm.payout_name.trim();

      // Formatted account string for human readability
      let formattedAccount = accountNum;
      if (accountNum) {
        if (bank && recipientName) {
          formattedAccount = `${bank} ${accountNum} (${recipientName})`;
        } else if (bank) {
          formattedAccount = `${bank} ${accountNum}`;
        } else if (recipientName) {
          formattedAccount = `${accountNum} (${recipientName})`;
        }
      }

      const payload = {
        user_id: counselorForm.user_id.trim(),
        display_name: counselorForm.display_name.trim() || null,
        bio: counselorForm.bio.trim() || null,
        image_url: counselorForm.image_url.trim() || null,
        status: counselorForm.status,
        service_modes: counselorForm.service_modes,
        is_silent_companion: counselorForm.is_silent_companion,
        payout_bank: bank || null,
        payout_account: formattedAccount || null,
        payout_name: recipientName || null,
        specialty_tags: tagsArray,
        updated_at: new Date().toISOString(),
      };

      if (editingCounselor) {
        const { error } = await supabase
          .from('heal_jai_counselors' as any)
          .update(payload)
          .eq('id', editingCounselor.id);
        if (error) throw error;
        toast({ title: 'บันทึกข้อมูลบัตรพนักงานเรียบร้อยแล้วค่ะ' });
      } else {
        const { error } = await supabase
          .from('heal_jai_counselors' as any)
          .insert({
            ...payload,
            guild_id: '1144697475148566588',
            accumulated_earnings: 0,
            total_sessions: 0,
            average_rating: 5.0,
            total_reviews: 0,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
        toast({ title: 'เพิ่มพนักงานใหม่เรียบร้อยแล้วค่ะ' });
      }

      setIsCounselorDialogOpen(false);
      fetchCounselors();
    } catch (err: any) {
      console.error('[HealJai] Error saving counselor:', err);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingCounselor(false);
    }
  };

  const handleDeleteCounselor = async (id: number, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงาน "${name}" ออกจากระบบ?`)) return;
    try {
      const { error } = await supabase
        .from('heal_jai_counselors' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบข้อมูลพนักงานเรียบร้อยแล้ว' });
      fetchCounselors();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    }
  };

  const handleQuickStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('heal_jai_counselors' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setCounselors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
      toast({ title: `เปลี่ยนสถานะเป็น ${newStatus} เรียบร้อยแล้วค่ะ` });
    } catch (err: any) {
      toast({ title: 'ไม่สามารถเปลี่ยนสถานะได้', description: err.message, variant: 'destructive' });
    }
  };

  // ── Filtered Counselors ──
  const filteredCounselors = useMemo(() => {
    return counselors.filter((c) => {
      const matchesSearch =
        (c.display_name || '').toLowerCase().includes(counselorSearch.toLowerCase()) ||
        c.user_id.includes(counselorSearch);
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [counselors, counselorSearch, statusFilter]);

  // ── Log Tab Handlers ──
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.order_code.toLowerCase().includes(logSearch.toLowerCase()) ||
        o.customer_id.includes(logSearch) ||
        (o.counselor_id || '').includes(logSearch) ||
        (o.package_name || '').toLowerCase().includes(logSearch.toLowerCase());
      const matchesStatus = logStatusFilter === 'ALL' || o.session_status === logStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, logSearch, logStatusFilter]);

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  const handleDeleteSelectedLogs = async () => {
    if (selectedOrderIds.length === 0) return;
    setDeletingLogs(true);
    try {
      const { error } = await supabase
        .from('heal_jai_orders_sessions' as any)
        .delete()
        .in('id', selectedOrderIds);

      if (error) throw error;
      toast({ title: `ลบประวัติ Log เรียบร้อยแล้ว (${selectedOrderIds.length} รายการ)` });
      setSelectedOrderIds([]);
      setIsDeleteSelectedOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'ลบประวัติไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingLogs(false);
    }
  };

  const handlePurgeAllLogs = async () => {
    if (purgeConfirmationText !== 'DELETE') {
      toast({ title: 'กรุณาพิมพ์ DELETE เพื่อยืนยัน', variant: 'destructive' });
      return;
    }
    setDeletingLogs(true);
    try {
      // Delete completed & cancelled sessions
      const { error } = await supabase
        .from('heal_jai_orders_sessions' as any)
        .delete()
        .in('session_status', ['COMPLETED', 'CANCELLED']);

      if (error) throw error;
      toast({ title: 'ล้างประวัติ Log ทั้งหมดเรียบร้อยแล้วค่ะ' });
      setIsPurgeAllLogsOpen(false);
      setPurgeConfirmationText('');
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'ไม่สามารถล้างประวัติได้', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingLogs(false);
    }
  };

  // ── Revenue & Payout Calculations ──
  const monthlyOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.session_status !== 'COMPLETED' || o.payment_status !== 'PAID') return false;
      const date = new Date(o.created_at);
      return (
        date.getFullYear() === selectedYear &&
        date.getMonth() + 1 === selectedMonth
      );
    });
  }, [orders, selectedYear, selectedMonth]);

  const totalGross = useMemo(() => {
    return monthlyOrders.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  }, [monthlyOrders]);

  const totalCounselorsShare = useMemo(() => {
    return monthlyOrders.reduce((acc, curr) => acc + (Number(curr.counselor_share) || 0), 0);
  }, [monthlyOrders]);

  const totalPlatformShare = useMemo(() => {
    return monthlyOrders.reduce((acc, curr) => acc + (Number(curr.platform_share) || 0), 0);
  }, [monthlyOrders]);

  // Per-counselor monthly summary
  const counselorMonthlySummary = useMemo(() => {
    const summaryMap: Record<
      string,
      {
        counselorId: string;
        counselorName: string;
        payoutAccount: string;
        totalCases: number;
        grossRevenue: number;
        earnings70: number;
      }
    > = {};

    for (const ord of monthlyOrders) {
      if (!ord.counselor_id) continue;
      const cid = ord.counselor_id;
      if (!summaryMap[cid]) {
        const found = counselors.find((c) => c.user_id === cid);
        summaryMap[cid] = {
          counselorId: cid,
          counselorName: found?.display_name || cid,
          payoutAccount: found?.payout_account || '-',
          totalCases: 0,
          grossRevenue: 0,
          earnings70: 0,
        };
      }
      summaryMap[cid].totalCases += 1;
      summaryMap[cid].grossRevenue += Number(ord.total_price) || 0;
      summaryMap[cid].earnings70 += Number(ord.counselor_share) || 0;
    }

    return Object.values(summaryMap);
  }, [monthlyOrders, counselors]);

  // Create Payout Record
  const openCreatePayoutModal = (counselorSummary: typeof counselorMonthlySummary[0]) => {
    const fullCounselor = counselors.find((c) => c.user_id === counselorSummary.counselorId) || null;
    setPayoutTargetCounselor(fullCounselor);
    setPayoutAmount(counselorSummary.earnings70);
    setPayoutNotes(`ตัดรอบค่าตอบแทน เดือน ${selectedMonth}/${selectedYear} (${counselorSummary.totalCases} เคส)`);
    setIsCreatePayoutOpen(true);
  };

  const handleConfirmCreatePayout = async () => {
    if (!payoutTargetCounselor) return;
    setCreatingPayout(true);
    try {
      const periodEndDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      const { error } = await supabase.from('heal_jai_payouts' as any).insert({
        guild_id: '1144697475148566588',
        counselor_id: payoutTargetCounselor.user_id,
        amount: payoutAmount,
        period_end: periodEndDate,
        status: 'pending',
        payout_account: payoutTargetCounselor.payout_account || null,
        notes: payoutNotes,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast({ title: 'สร้างรอบโอนเงินสำเร็จแล้วค่ะ (สถานะ: กำลังรอ)' });
      setIsCreatePayoutOpen(false);
      fetchPayouts();
    } catch (err: any) {
      toast({ title: 'สร้างรอบโอนเงินไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingPayout(false);
    }
  };

  const handleUpdatePayoutStatus = async (
    payoutId: number,
    newStatus: 'pending' | 'paid' | 'cancelled'
  ) => {
    try {
      const updateData: any = {
        status: newStatus,
      };
      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else if (newStatus === 'pending') {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from('heal_jai_payouts' as any)
        .update(updateData)
        .eq('id', payoutId);

      if (error) throw error;
      toast({
        title: `อัปเดตสถานะเป็น "${
          newStatus === 'paid' ? 'โอนเงินแล้ว' : newStatus === 'pending' ? 'กำลังรอ' : 'ยกเลิก'
        }" เรียบร้อยแล้ว`,
      });
      fetchPayouts();
    } catch (err: any) {
      toast({ title: 'อัปเดตสถานะไม่สำเร็จ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeletePayout = async (id: number) => {
    if (!window.confirm('คุณต้องการลบประวัติการโอนเงินรายการนี้หรือไม่?')) return;
    try {
      const { error } = await supabase.from('heal_jai_payouts' as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบรายการโอนเงินเรียบร้อยแล้ว' });
      fetchPayouts();
    } catch (err: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 text-sm">
      {/* ─── Page Top Bar & Tab Navigation ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/70 dark:bg-card/40 backdrop-blur-md p-5 rounded-3xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
              จัดการโปรเจกต์ฮีลใจ (HealJai)
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                Staff & Revenue Hub
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              บริหารจัดการบัตรพนักงาน, ตรวจสอบบันทึก Log ออเดอร์, และตัดรอบคำนวณส่วนแบ่งรายได้
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchCounselors();
              fetchOrders();
              fetchPayouts();
            }}
            className="rounded-xl gap-2 text-sm font-medium h-10 px-4"
          >
            <RefreshCw className={cn('w-4 h-4', (loadingCounselors || loadingOrders || loadingPayouts) && 'animate-spin')} />
            รีเฟรช
          </Button>

          {activeTab === 'counselors' && (
            <Button
              onClick={openAddCounselor}
              size="sm"
              className="rounded-xl gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
            >
              <Plus className="w-4 h-4" />
              เพิ่มพนักงาน
            </Button>
          )}
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="bg-muted/50 p-1.5 rounded-2xl h-12 border border-border/60">
          <TabsTrigger value="counselors" className="rounded-xl text-sm sm:text-base gap-2 font-semibold px-4 py-2">
            <Users className="w-4 h-4" />
            จัดการพนักงาน ({counselors.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl text-sm sm:text-base gap-2 font-semibold px-4 py-2">
            <ClipboardList className="w-4 h-4" />
            บันทึก Log ทั้งหมด ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-xl text-sm sm:text-base gap-2 font-semibold px-4 py-2">
            <Wallet className="w-4 h-4" />
            รายได้และรอบโอนเงิน
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: จัดการพนักงาน (Counselor Cards)
           ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="counselors" className="space-y-4 pt-3">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ หรือ Discord ID..."
                  value={counselorSearch}
                  onChange={(e) => setCounselorSearch(e.target.value)}
                  className="pl-10 h-10 text-sm rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-10 text-sm rounded-xl">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-sm">
                  <SelectItem value="ALL">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="ONLINE">🟢 ออนไลน์</SelectItem>
                  <SelectItem value="BUSY">🟡 กำลังให้บริการ</SelectItem>
                  <SelectItem value="BREAK">⚪ พักเบรก</SelectItem>
                  <SelectItem value="OFFLINE">⚫ ออฟไลน์</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Counselors Grid */}
          {loadingCounselors ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">กำลังโหลดข้อมูลพนักงาน...</p>
            </div>
          ) : filteredCounselors.length === 0 ? (
            <Card className="rounded-3xl border border-dashed border-border/80">
              <CardContent className="p-12 text-center text-muted-foreground space-y-2">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="text-base font-semibold text-foreground">ไม่พบข้อมูลพนักงาน</p>
                <p className="text-sm">สามารถกดปุ่ม "เพิ่มพนักงาน" เพื่อลงทะเบียนพนักงานใหม่ได้ทันที</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCounselors.map((c) => {
                const modes = Array.isArray(c.service_modes) ? c.service_modes : [];
                return (
                  <Card
                    key={c.id}
                    className="rounded-3xl border border-border/60 bg-card/70 hover:bg-card hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header with Status & Avatar */}
                      <div className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <Avatar className="w-14 h-14 rounded-2xl border border-border/80 ring-2 ring-primary/20 shrink-0">
                              {c.image_url ? (
                                <AvatarImage src={c.image_url} alt={c.display_name || ''} className="object-cover" />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-br from-amber-500/20 to-primary/20 font-bold text-base">
                                {(c.display_name || c.user_id).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h3 className="font-bold text-base text-foreground truncate">
                                {c.display_name || 'ไม่ระบุชื่อ'}
                              </h3>
                              <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                                {c.user_id}
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.user_id);
                                    toast({ title: 'คัดลอก Discord ID แล้ว' });
                                  }}
                                  className="hover:text-foreground"
                                  title="คัดลอก ID"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </p>
                            </div>
                          </div>

                          {/* Quick Status Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border shadow-2xs transition-all',
                                  c.status === 'ONLINE' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                                  c.status === 'BUSY' && 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
                                  c.status === 'BREAK' && 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
                                  c.status === 'OFFLINE' && 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400'
                                )}
                              >
                                <span
                                  className={cn(
                                    'w-2 h-2 rounded-full',
                                    c.status === 'ONLINE' && 'bg-emerald-500 animate-pulse',
                                    c.status === 'BUSY' && 'bg-amber-500',
                                    c.status === 'BREAK' && 'bg-blue-500',
                                    c.status === 'OFFLINE' && 'bg-zinc-400'
                                  )}
                                />
                                {c.status === 'ONLINE' && 'ออนไลน์'}
                                {c.status === 'BUSY' && 'ติดเคส'}
                                {c.status === 'BREAK' && 'พักเบรก'}
                                {c.status === 'OFFLINE' && 'ออฟไลน์'}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl text-sm">
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(c.id, 'ONLINE')}>
                                🟢 ตั้งเป็น ออนไลน์ (ONLINE)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(c.id, 'BUSY')}>
                                🟡 ตั้งเป็น กำลังให้บริการ (BUSY)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(c.id, 'BREAK')}>
                                ⚪ ตั้งเป็น พักเบรก (BREAK)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickStatusChange(c.id, 'OFFLINE')}>
                                ⚫ ตั้งเป็น ออฟไลน์ (OFFLINE)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Bio snippet */}
                        <p className="mt-3.5 text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[42px] bg-muted/20 p-2.5 rounded-xl">
                          {c.bio || 'ยังไม่มีคำแนะนำตัวในบัตรพนักงาน'}
                        </p>

                        {/* Badges / Service Capabilities */}
                        <div className="flex flex-wrap gap-2 mt-3.5">
                          {modes.includes('chat') && (
                            <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 bg-primary/5 text-primary border-primary/20 font-medium">
                              <MessageSquare className="w-3 h-3" />
                              พิมพ์แชท
                            </Badge>
                          )}
                          {modes.includes('voice') && (
                            <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
                              <PhoneCall className="w-3 h-3" />
                              คอลเสียง
                            </Badge>
                          )}
                          {c.is_silent_companion && (
                            <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                              <VolumeX className="w-3 h-3" />
                              นั่งเงียบ
                            </Badge>
                          )}
                        </div>

                        {/* Specialty Tags */}
                        {Array.isArray(c.specialty_tags) && c.specialty_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3 pt-2.5 border-t border-border/40">
                            {c.specialty_tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-secondary/80 text-foreground/80 font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stats Section */}
                      <div className="px-5 py-3.5 border-t border-border/40 grid grid-cols-3 gap-2 bg-muted/10 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">เคสทั้งหมด</p>
                          <p className="text-sm font-bold text-foreground mt-0.5">{c.total_sessions || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">คะแนนรีวิว</p>
                          <p className="text-sm font-bold text-amber-500 mt-0.5">
                            ★ {Number(c.average_rating || 5.0).toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">รายได้สะสม</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ฿{(Number(c.accumulated_earnings) || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3.5 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/30">
                      <div className="text-xs text-muted-foreground truncate max-w-[190px]" title={c.payout_account || 'ไม่มีบัญชี'}>
                        💳 <span className="font-mono font-medium text-foreground">{c.payout_account || 'ยังไม่ระบุบัญชี'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCounselor(c)}
                          className="h-9 px-3 rounded-xl text-xs sm:text-sm gap-1.5 hover:bg-primary/10 hover:text-primary font-medium"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          แก้ไขบัตร
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCounselor(c.id, c.display_name || c.user_id)}
                          className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: บันทึกประวัติ Log (Order & Session Logs)
           ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="logs" className="space-y-4 pt-3">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-2xl border border-border/60">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหารหัสออเดอร์, ลูกค้า, หรือผู้รับฟัง..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-10 h-10 text-sm rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger className="w-[160px] h-10 text-sm rounded-xl">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-sm">
                  <SelectItem value="ALL">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="WAITING">🟠 รอรับเคส</SelectItem>
                  <SelectItem value="DISPATCHING">📡 กำลังจับคู่</SelectItem>
                  <SelectItem value="WAITING_FOR_PROVIDER">⏳ รอนัดหมาย</SelectItem>
                  <SelectItem value="IN_SESSION">🍵 กำลังสนทนา</SelectItem>
                  <SelectItem value="COMPLETED">✅ จบเซสชันแล้ว</SelectItem>
                  <SelectItem value="CANCELLED">❌ ยกเลิกแล้ว</SelectItem>
                </SelectContent>
              </Select>

              {/* Bulk Actions */}
              {selectedOrderIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteSelectedOpen(true)}
                  className="rounded-xl h-10 text-sm gap-2 px-3.5 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบที่เลือก ({selectedOrderIds.length})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPurgeAllLogsOpen(true)}
                className="rounded-xl h-10 text-sm text-destructive hover:bg-destructive/10 border-destructive/30 gap-2 px-3.5 font-medium"
              >
                <ShieldAlert className="w-4 h-4" />
                ล้าง Log ทั้งหมด
              </Button>
            </div>
          </div>

          {/* Orders Table */}
          <Card className="rounded-3xl border border-border/60 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[50px] text-center py-3.5">
                      <Checkbox
                        checked={
                          filteredOrders.length > 0 &&
                          selectedOrderIds.length === filteredOrders.length
                        }
                        onCheckedChange={toggleSelectAllOrders}
                        aria-label="เลือกทั้งหมด"
                      />
                    </TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">รหัสออเดอร์</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">ลูกค้า</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">ผู้รับฟัง</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">แพ็กเกจ / โหมด</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">ยอดเงิน</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">สลิป</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">สถานะ</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">เวลา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOrders ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        กำลังโหลดประวัติ Log ออเดอร์...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                        ไม่พบบันทึกประวัติ Log ตามเงื่อนไขที่เลือก
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((o) => {
                      const isSelected = selectedOrderIds.includes(o.id);
                      return (
                        <TableRow key={o.id} className={cn('py-3', isSelected && 'bg-primary/5')}>
                          <TableCell className="text-center py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOrder(o.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-foreground py-3">
                            #{o.order_code}
                          </TableCell>
                          <TableCell className="text-sm py-3">
                            <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded-md">
                              {o.customer_id}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm py-3">
                            {o.counselor_id ? (
                              <span className="font-mono text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-md font-medium">
                                {o.counselor_id}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">สุ่ม / ไม่เจาะจง</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-3">
                            <div>
                              <p className="font-semibold text-foreground truncate max-w-[170px]">
                                {o.package_name || 'แพ็กเกจมาตรฐาน'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                <span>{o.service_mode === 'voice' ? '🎙️ คอลเสียง' : '💬 แชท'}</span>
                                {o.is_silent && <span className="text-emerald-600 font-medium">🌿 นั่งเงียบ</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-foreground py-3">
                            ฿{o.total_price}
                          </TableCell>
                          <TableCell className="text-sm py-3">
                            {o.slip_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingSlipUrl(o.slip_url)}
                                className="h-8 px-2.5 text-xs font-medium gap-1.5 text-primary hover:bg-primary/10 rounded-lg"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                ดูสลิป
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs font-semibold px-2.5 py-0.5',
                                o.session_status === 'COMPLETED' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                                o.session_status === 'IN_SESSION' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                                o.session_status === 'DISPATCHING' && 'bg-blue-500/10 text-blue-600 border-blue-500/30',
                                o.session_status === 'WAITING' && 'bg-purple-500/10 text-purple-600 border-purple-500/30',
                                o.session_status === 'CANCELLED' && 'bg-red-500/10 text-red-600 border-red-500/30'
                              )}
                            >
                              {o.session_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono py-3">
                            {new Date(o.created_at).toLocaleString('th-TH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: รายได้และรอบการโอนเงิน (Revenue & Payouts)
           ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="revenue" className="space-y-6 pt-3">
          {/* Month & Year Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/70 p-4 rounded-3xl border border-border/70">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span className="text-base font-bold text-foreground">เลือกช่วงเวลารอบบัญชี:</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(Number(val))}
              >
                <SelectTrigger className="w-[150px] h-10 text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-sm">
                  {[
                    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                  ].map((m, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="w-[130px] h-10 text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-sm">
                  {[2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      พ.ศ. {y + 543}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metric Cards Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-card to-card/60 p-5 shadow-xs">
              <p className="text-sm text-muted-foreground font-semibold">ยอดขายรวมทั้งโปรเจกต์ (100%)</p>
              <h3 className="text-3xl font-extrabold text-foreground mt-2">฿{totalGross.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">คำนวณจากเคสที่จบสมบูรณ์ในเดือนนี้</p>
            </Card>

            <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500/10 to-card p-5 shadow-xs">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">ส่วนแบ่งพนักงานรวม (70%)</p>
              <h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                ฿{totalCounselorsShare.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">ยอดค่าตอบแทนที่ต้องจัดสรรให้พนักงาน</p>
            </Card>

            <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-amber-500/10 to-card p-5 shadow-xs">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">ส่วนแบ่งเจ้าของโปรเจกต์ (30%)</p>
              <h3 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                ฿{totalPlatformShare.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">รายได้สุทธิเข้าคลังโปรเจกต์ / แพลตฟอร์ม</p>
            </Card>

            <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-card to-card/60 p-5 shadow-xs">
              <p className="text-sm text-muted-foreground font-semibold">จำนวนเคสที่จบแล้ว</p>
              <h3 className="text-3xl font-extrabold text-foreground mt-2">{monthlyOrders.length} เซสชัน</h3>
              <p className="text-xs text-muted-foreground mt-1">เซสชันที่ให้บริการสำเร็จในเดือนนี้</p>
            </Card>
          </div>

          {/* Section 1: สรุปรายได้แยกตามพนักงานในเดือนนี้ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">สรุปรายได้แยกตามพนักงาน (ประจำเดือน)</h3>
                <p className="text-sm text-muted-foreground">แสดงยอดเคสและค่าตอบแทน 70% พร้อมสร้างรายการโอนเงิน</p>
              </div>
            </div>

            <Card className="rounded-3xl border border-border/60 overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-sm font-semibold py-3.5">พนักงาน / ผู้รับฟัง</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">บัญชีรับเงิน (PromptPay)</TableHead>
                    <TableHead className="text-sm font-semibold text-center py-3.5">เคสสำเร็จ</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">ยอดขายรวม</TableHead>
                    <TableHead className="text-sm font-semibold text-emerald-600 py-3.5">ส่วนแบ่งที่ได้รับ (70%)</TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3.5">ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counselorMonthlySummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                        ไม่มีประวัติการให้บริการในเดือนที่เลือก
                      </TableCell>
                    </TableRow>
                  ) : (
                    counselorMonthlySummary.map((item) => (
                      <TableRow key={item.counselorId} className="py-3.5">
                        <TableCell className="text-sm py-3.5">
                          <div>
                            <p className="font-bold text-foreground text-sm">{item.counselorName}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.counselorId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono py-3.5 font-medium">{item.payoutAccount}</TableCell>
                        <TableCell className="text-sm text-center font-bold py-3.5">{item.totalCases} เคส</TableCell>
                        <TableCell className="text-sm font-medium py-3.5">฿{item.grossRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600 dark:text-emerald-400 py-3.5">
                          ฿{item.earnings70.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          <Button
                            size="sm"
                            onClick={() => openCreatePayoutModal(item)}
                            className="rounded-xl h-9 text-xs sm:text-sm gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-3.5 font-medium"
                          >
                            <DollarSign className="w-4 h-4" />
                            ตัดรอบ / ทำรายการโอน
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Section 2: ประวัติรอบการโอนเงิน (Payout Management) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">ประวัติรอบการโอนเงิน (Payout Management)</h3>
                <p className="text-sm text-muted-foreground">ตรวจสอบสถานะการโอนเงินให้พนักงาน (กำลังรอ, โอนแล้ว, ยกเลิก)</p>
              </div>
            </div>

            <Card className="rounded-3xl border border-border/60 overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-sm font-semibold py-3.5">วันที่สร้าง</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">พนักงาน</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">งวดสิ้นสุด</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">ยอดโอน (บาท)</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">บัญชีปลายทาง</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">สถานะ</TableHead>
                    <TableHead className="text-sm font-semibold py-3.5">หมายเหตุ / เวลาโอน</TableHead>
                    <TableHead className="text-sm font-semibold text-right py-3.5">ปรับสถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPayouts ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                        กำลังโหลดประวัติการโอนเงิน...
                      </TableCell>
                    </TableRow>
                  ) : payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                        ยังไม่มีประวัติการตัดรอบโอนเงินในระบบ
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((p) => {
                      const found = counselors.find((c) => c.user_id === p.counselor_id);
                      return (
                        <TableRow key={p.id} className="py-3.5">
                          <TableCell className="text-xs font-mono text-muted-foreground py-3.5">
                            {new Date(p.created_at).toLocaleDateString('th-TH')}
                          </TableCell>
                          <TableCell className="text-sm py-3.5">
                            <p className="font-bold text-foreground">{found?.display_name || p.counselor_id}</p>
                          </TableCell>
                          <TableCell className="text-sm font-mono py-3.5">{p.period_end}</TableCell>
                          <TableCell className="text-sm font-bold text-foreground py-3.5">
                            ฿{Number(p.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-mono py-3.5">{p.payout_account || '-'}</TableCell>
                          <TableCell className="text-sm py-3.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs font-semibold px-2.5 py-1 gap-1.5',
                                p.status === 'paid' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                                p.status === 'pending' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                                p.status === 'cancelled' && 'bg-red-500/10 text-red-600 border-red-500/30'
                              )}
                            >
                              {p.status === 'paid' && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                              {p.status === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                              {p.status === 'cancelled' && <X className="w-3.5 h-3.5 text-red-600" />}
                              {p.status === 'paid' ? 'โอนเงินแล้ว' : p.status === 'pending' ? 'กำลังรอ' : 'ยกเลิก'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5">
                            <p className="truncate max-w-[170px] text-sm text-foreground">{p.notes || '-'}</p>
                            {p.paid_at && (
                              <p className="text-xs text-emerald-600 mt-0.5">
                                โอนเมื่อ: {new Date(p.paid_at).toLocaleString('th-TH')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 text-xs font-medium rounded-xl">
                                    เปลี่ยนสถานะ
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl text-sm">
                                  <DropdownMenuItem onClick={() => handleUpdatePayoutStatus(p.id, 'paid')}>
                                    ✅ ทำเครื่องหมายว่าโอนแล้ว
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdatePayoutStatus(p.id, 'pending')}>
                                    ⏳ ปรับเป็นกำลังรอ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdatePayoutStatus(p.id, 'cancelled')}>
                                    ❌ ยกเลิกรายการ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePayout(p.id)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG 1: แก้ไข / เพิ่มพนักงาน (Counselor Form Dialog)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={isCounselorDialogOpen} onOpenChange={setIsCounselorDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
              <Users className="w-5 h-5 text-primary" />
              {editingCounselor ? 'แก้ไขข้อมูลบัตรพนักงาน' : 'เพิ่มพนักงานผู้รับฟังใหม่'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              ข้อมูลจะถูกอัปเดตลงฐานข้อมูล และซิงค์กับการ์ดแนะนำตัวใน Discord โดยอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Discord User ID *</Label>
                <Input
                  disabled={Boolean(editingCounselor)}
                  placeholder="เช่น 123456789012345678"
                  value={counselorForm.user_id}
                  onChange={(e) => setCounselorForm({ ...counselorForm, user_id: e.target.value })}
                  className="rounded-xl h-10 text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ชื่อแสดงบนบัตร</Label>
                <Input
                  placeholder="เช่น พี่หมีใจดี"
                  value={counselorForm.display_name}
                  onChange={(e) => setCounselorForm({ ...counselorForm, display_name: e.target.value })}
                  className="rounded-xl h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">คำแนะนำตัว (Bio)</Label>
              <textarea
                rows={3}
                placeholder="คำแนะนำตัวสั้นๆ สไตล์การรับฟัง..."
                value={counselorForm.bio}
                onChange={(e) => setCounselorForm({ ...counselorForm, bio: e.target.value })}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">สถานะการทำงาน</Label>
                <Select
                  value={counselorForm.status}
                  onValueChange={(val) => setCounselorForm({ ...counselorForm, status: val })}
                >
                  <SelectTrigger className="rounded-xl h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-sm">
                    <SelectItem value="ONLINE">🟢 ออนไลน์ (ONLINE)</SelectItem>
                    <SelectItem value="BUSY">🟡 กำลังให้บริการ (BUSY)</SelectItem>
                    <SelectItem value="BREAK">⚪ พักเบรก (BREAK)</SelectItem>
                    <SelectItem value="OFFLINE">⚫ ออฟไลน์ (OFFLINE)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ลิงก์รูปภาพประจำตัว (Image URL)</Label>
                <Input
                  placeholder="https://cdn.discordapp.com/..."
                  value={counselorForm.image_url}
                  onChange={(e) => setCounselorForm({ ...counselorForm, image_url: e.target.value })}
                  className="rounded-xl h-10 text-sm font-mono"
                />
              </div>
            </div>

            {/* Payout Details (Bank Name, Account / PromptPay Number, Recipient Name) */}
            <div className="p-4 bg-muted/20 rounded-2xl border border-border/60 space-y-3">
              <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-500" />
                ข้อมูลบัญชีรับเงิน (PromptPay / บัญชีธนาคาร)
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">ชื่อธนาคาร / บริการ</Label>
                  <Input
                    placeholder="เช่น กสิกรไทย, พร้อมเพย์, SCB"
                    value={counselorForm.payout_bank}
                    onChange={(e) => setCounselorForm({ ...counselorForm, payout_bank: e.target.value })}
                    className="rounded-xl h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">เลขบัญชี / เบอร์พร้อมเพย์</Label>
                  <Input
                    placeholder="เช่น 0812345678 หรือ 1234567890"
                    value={counselorForm.payout_account}
                    onChange={(e) => setCounselorForm({ ...counselorForm, payout_account: e.target.value })}
                    className="rounded-xl h-10 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">ชื่อ-นามสกุล ผู้รับเงิน</Label>
                  <Input
                    placeholder="เช่น นายใจดี มีสุข"
                    value={counselorForm.payout_name}
                    onChange={(e) => setCounselorForm({ ...counselorForm, payout_name: e.target.value })}
                    className="rounded-xl h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Specialty Tags Pill Selector (Predefined Only) */}
            <div className="space-y-2.5 p-3.5 bg-muted/20 rounded-2xl border border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  แท็กความเชี่ยวชาญ / เรื่องที่รับฟัง (เลือกได้หลายข้อ)
                </Label>
                <span className="text-xs text-muted-foreground">
                  เลือกแล้ว {counselorForm.specialty_tags.length} จาก {ALL_SPECIALTIES.length} ข้อ
                </span>
              </div>

              {/* Predefined Tag Pill Options Only */}
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_SPECIALTIES.map((tag) => {
                  const isSelected = counselorForm.specialty_tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={cn(
                        'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border text-left',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                          : 'bg-background hover:bg-muted text-muted-foreground border-border/80 hover:text-foreground'
                      )}
                    >
                      {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Service Modes Checkbox */}
            <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/60 space-y-2">
              <Label className="text-sm font-bold text-foreground">โหมดบริการที่รองรับ</Label>
              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={counselorForm.service_modes.includes('chat')}
                    onCheckedChange={(checked) => {
                      const set = new Set(counselorForm.service_modes);
                      if (checked) set.add('chat');
                      else set.delete('chat');
                      setCounselorForm({ ...counselorForm, service_modes: Array.from(set) });
                    }}
                  />
                  💬 แชทข้อความ (Chat)
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={counselorForm.service_modes.includes('voice')}
                    onCheckedChange={(checked) => {
                      const set = new Set(counselorForm.service_modes);
                      if (checked) set.add('voice');
                      else set.delete('voice');
                      setCounselorForm({ ...counselorForm, service_modes: Array.from(set) });
                    }}
                  />
                  🎙️ คอลเสียง (Voice)
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={counselorForm.is_silent_companion}
                    onCheckedChange={(checked) =>
                      setCounselorForm({ ...counselorForm, is_silent_companion: Boolean(checked) })
                    }
                  />
                  🌿 นั่งเงียบเป็นเพื่อน
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCounselorDialogOpen(false)}
              className="rounded-xl h-10 text-sm px-4"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveCounselor}
              disabled={savingCounselor}
              className="rounded-xl h-10 text-sm bg-primary text-primary-foreground px-5 font-semibold"
            >
              {savingCounselor && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              บันทึกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG 2: ดูภาพสลิปโอนเงิน (Slip Preview Modal)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={Boolean(viewingSlipUrl)} onOpenChange={() => setViewingSlipUrl(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              หลักฐานสลิปโอนเงิน
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 flex items-center justify-center">
            {viewingSlipUrl && (
              <img
                src={viewingSlipUrl}
                alt="สลิปโอนเงิน"
                className="max-h-[500px] w-auto rounded-2xl border border-border shadow-sm object-contain"
              />
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setViewingSlipUrl(null)}
              className="w-full rounded-xl h-10 text-sm"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG 3: ลบรายการ Log ที่เลือก (Bulk Delete Selected)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={isDeleteSelectedOpen} onOpenChange={setIsDeleteSelectedOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              ยืนยันการลบ Log ที่เลือก ({selectedOrderIds.length} รายการ)
            </DialogTitle>
            <DialogDescription className="text-sm pt-1.5 text-muted-foreground leading-relaxed">
              รายการที่เลือกจะถูกลบออกจากฐานข้อมูลประวัติการทำงานถาวร
              <br />
              <strong className="text-foreground">หมายเหตุ:</strong> การลบนี้จะไม่กระทบยอดเงินสะสมของพนักงานและประวัติรอบโอนเงินที่บันทึกไว้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteSelectedOpen(false)}
              className="rounded-xl h-10 text-sm px-4"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedLogs}
              disabled={deletingLogs}
              className="rounded-xl h-10 text-sm px-4 font-semibold"
            >
              {deletingLogs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG 4: ล้าง Log ทั้งหมด (Safety Purge All Logs)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={isPurgeAllLogsOpen} onOpenChange={setIsPurgeAllLogsOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              คำเตือนความปลอดภัย: ล้างประวัติ Log ทั้งหมด
            </DialogTitle>
            <DialogDescription className="text-sm pt-1.5 text-muted-foreground leading-relaxed">
              ระบบจะลบข้อมูลออเดอร์และเซสชันที่สถานะเป็น "จบแล้ว (COMPLETED)" และ "ยกเลิกแล้ว (CANCELLED)" ทั้งหมด
              <br />
              ยอดเงินสะสมและประวัติการโอนเงินจะยังคงอยู่ปลอดภัย
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Label className="text-sm font-semibold text-foreground">
              พิมพ์คำว่า <span className="font-mono text-destructive font-bold">DELETE</span> เพื่อยืนยัน:
            </Label>
            <Input
              placeholder="DELETE"
              value={purgeConfirmationText}
              onChange={(e) => setPurgeConfirmationText(e.target.value)}
              className="rounded-xl h-10 text-sm font-mono"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPurgeAllLogsOpen(false);
                setPurgeConfirmationText('');
              }}
              className="rounded-xl h-10 text-sm px-4"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={purgeConfirmationText !== 'DELETE' || deletingLogs}
              onClick={handlePurgeAllLogs}
              className="rounded-xl h-10 text-sm px-4 font-semibold"
            >
              {deletingLogs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ล้างประวัติ Log ทั้งหมด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG 5: สร้างรอบโอนเงิน (Create Payout Modal)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={isCreatePayoutOpen} onOpenChange={setIsCreatePayoutOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <Wallet className="w-5 h-5 text-emerald-600" />
              สร้างรายการตัดรอบโอนเงิน
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              บันทึกรายการจ่ายเงินเข้าสู่ระบบรอบบัญชีเพื่อรอการโอนเงินจริง
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/60 space-y-1">
              <p className="text-sm font-bold text-foreground">
                ผู้รับฟัง: {payoutTargetCounselor?.display_name || payoutTargetCounselor?.user_id}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                บัญชีพร้อมเพย์: <span className="font-semibold text-foreground">{payoutTargetCounselor?.payout_account || 'ยังไม่ระบุ'}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">ยอดเงินที่จะโอน (บาท)</Label>
              <Input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(Number(e.target.value))}
                className="rounded-xl h-10 text-sm font-bold text-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">หมายเหตุ / งวดประจำรอบ</Label>
              <Input
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="เช่น ค่าตอบแทนประจำรอบ 15 ต.ค. 2026"
                className="rounded-xl h-10 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreatePayoutOpen(false)}
              className="rounded-xl h-10 text-sm px-4"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmCreatePayout}
              disabled={creatingPayout || payoutAmount <= 0}
              className="rounded-xl h-10 text-sm bg-emerald-600 text-white hover:bg-emerald-700 px-5 font-semibold"
            >
              {creatingPayout && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              บันทึกรายการรอบโอน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
