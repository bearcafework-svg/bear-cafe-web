import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    ClipboardList, Send, Settings, CheckCircle2, XCircle, Clock, AlertTriangle,
    Trash2, Eye, ShieldCheck, RefreshCw, Upload, Image as ImageIcon, Loader2, ArrowLeftRight,
    Search, Award, Percent, Users
} from 'lucide-react';

interface PromotionSettings {
    post_points: number;
    comment_points: number;
    max_count: number;
    max_images: number;
    weeks: { week: number; start: number; end: number }[];
    reminder_rounds: { id: string; hours_before: number; label: string }[];
}

interface Submission {
    id: string;
    user_id: string;
    discord_id: string;
    year: number;
    month: number;
    week_number: number;
    submission_type: 'โพสต์' | 'คอมเมนต์' | 'none';
    count: number;
    images: string[];
    notes: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'missed';
    approved_by: string | null;
    approved_at: string | null;
    rejected_by: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
    points_awarded: number;
    created_at: string;
    updated_at: string;
    profiles?: {
        username: string;
        discord_username: string | null;
        avatar_url: string | null;
    } | null;
}

export function SubmitPromotion({ currentUser, isOwner }: { currentUser: any; isOwner: boolean }) {
    const { toast } = useToast();

    // Date details (Bangkok time)
    const bangkokNow = useMemo(() => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })), []);
    const currentYear = bangkokNow.getFullYear();
    const currentMonth = bangkokNow.getMonth() + 1; // 1-12
    const currentDay = bangkokNow.getDate();

    // Settings & Submission Data
    const [settings, setSettings] = useState<PromotionSettings>({
        post_points: 30,
        comment_points: 15,
        max_count: 5,
        max_images: 5,
        weeks: [
            { week: 1, start: 1, end: 7 },
            { week: 2, start: 8, end: 14 },
            { week: 3, start: 15, end: 21 },
            { week: 4, start: 22, end: 31 }
        ],
        reminder_rounds: [
            { id: "3_days", hours_before: 72, label: "เหลือ 3 วัน" },
            { id: "1_day", hours_before: 24, label: "เหลือ 1 วัน" },
            { id: "12_hours", hours_before: 12, label: "เหลือ 12 ชั่วโมง" }
        ]
    });

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [personalHistory, setPersonalHistory] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Stats Dashboard
    const [stats, setStats] = useState({
        totalStaff: 0,
        totalTrainees: 0,
        totalPassed: 0,
        yetToSubmit: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0
    });

    // Current Active Week Config
    const activeWeekConfig = useMemo(() => {
        return settings.weeks.find(w => currentDay >= w.start && currentDay <= w.end) || settings.weeks[0];
    }, [settings.weeks, currentDay]);

    // Submission Form State
    const [submitForm, setSubmitForm] = useState({
        type: 'โพสต์' as Submission['submission_type'],
        count: 0,
        notes: '',
        images: [] as File[],
        previewUrls: [] as string[]
    });

    // Filters for review tab
    const [filterMonth, setFilterMonth] = useState(String(currentMonth));
    const [filterWeek, setFilterWeek] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSearch, setFilterSearch] = useState('');

    // Dialog reviews
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);
    const [syncingReminders, setSyncingReminders] = useState(false);

    // Settings Edit Form
    const [settingsForm, setSettingsForm] = useState<PromotionSettings>({ ...settings });

    // Staff Performance state
    const [allStaffPerformance, setAllStaffPerformance] = useState<any[]>([]);
    const [loadingPerformance, setLoadingPerformance] = useState(false);
    const [perfMonth, setPerfMonth] = useState(String(currentMonth));
    const [perfYear, setPerfYear] = useState(String(currentYear));
    const [perfSearch, setPerfSearch] = useState('');
    const [perfStats, setPerfStats] = useState({
        completedCount: 0,
        totalPoints: 0,
        activeStaffCount: 0,
        submissionRate: 0
    });

    useEffect(() => {
        fetchSettingsAndHistory();
        if (isOwner) {
            fetchAdminSubmissions();
        }
    }, [isOwner, filterMonth, filterWeek, filterStatus]);

    useEffect(() => {
        fetchStaffPerformance();
    }, [perfMonth, perfYear]);

    const fetchStaffPerformance = async () => {
        setLoadingPerformance(true);
        try {
            const { data: staffData, error: staffErr } = await supabase
                .from('staff_members')
                .select('*, staff_positions(name, color)')
                .eq('status', 'Active');

            if (staffErr) throw staffErr;
            if (!staffData || staffData.length === 0) {
                setAllStaffPerformance([]);
                return;
            }

            const discordIds = staffData.map(s => s.discord_id).filter(Boolean);
            const { data: profilesData, error: profErr } = await supabase
                .from('profiles')
                .select('id, username, discord_username, avatar_url, discord_id')
                .in('discord_id', discordIds);

            if (profErr) throw profErr;

            const { data: submissionsData, error: subErr } = await supabase
                .from('promotion_submissions')
                .select('*')
                .eq('year', Number(perfYear))
                .eq('month', Number(perfMonth));

            if (subErr) throw subErr;

            // Calculate stats for the selected month/year
            const completedSubs = (submissionsData || []).filter(s => s.status === 'approved');
            const totalPointsAwarded = (submissionsData || []).reduce((sum, s) => sum + (s.points_awarded || 0), 0);

            const uniqueSubmittingUsers = new Set((submissionsData || []).map(s => s.user_id)).size;
            const activeStaffCount = staffData.length;
            const rate = activeStaffCount > 0 ? Math.round((uniqueSubmittingUsers / activeStaffCount) * 100) : 0;

            setPerfStats({
                completedCount: completedSubs.length,
                totalPoints: totalPointsAwarded,
                activeStaffCount,
                submissionRate: rate
            });

            const merged = staffData.map(member => {
                const profile = (profilesData || []).find(p => p.discord_id === member.discord_id);
                const username = profile?.username || member.nickname || 'Unknown';
                const discord_username = profile?.discord_username || member.discord_id;
                const avatar_url = profile?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
                const userId = profile?.id;

                const memberSubs = userId
                    ? (submissionsData || []).filter(s => s.user_id === userId)
                    : [];

                const getWeekData = (weekNum: number) => {
                    const sub = memberSubs.find(s => s.week_number === weekNum);
                    if (!sub) return { status: 'none', count: 0, type: '-' };
                    return {
                        status: sub.status,
                        count: sub.count,
                        type: sub.submission_type
                    };
                };

                const totalPoints = memberSubs.reduce((sum, s) => sum + (s.points_awarded || 0), 0);

                return {
                    id: member.id,
                    username,
                    discord_username,
                    avatar_url,
                    position_name: member.staff_positions?.name || '-',
                    position_color: member.staff_positions?.color,
                    week1: getWeekData(1),
                    week2: getWeekData(2),
                    week3: getWeekData(3),
                    week4: getWeekData(4),
                    totalPoints
                };
            });

            setAllStaffPerformance(merged);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoadingPerformance(false);
        }
    };

    const filteredPerformance = useMemo(() => {
        if (!perfSearch.trim()) return allStaffPerformance;
        const q = perfSearch.toLowerCase().trim();
        return allStaffPerformance.filter(p =>
            (p.username || '').toLowerCase().includes(q) ||
            (p.discord_username || '').toLowerCase().includes(q)
        );
    }, [allStaffPerformance, perfSearch]);

    const fetchSettingsAndHistory = async () => {
        setLoading(true);
        try {
            // 1. Fetch system_settings
            const { data: settingsRow } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'promotion_settings')
                .maybeSingle();

            if (settingsRow?.value) {
                const val = settingsRow.value as unknown as PromotionSettings;
                setSettings(val);
                setSettingsForm(val);
            }

            // 2. Fetch User Personal Submissions (History)
            const { data: history } = await supabase
                .from('promotion_submissions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            setPersonalHistory(history || []);

            // If user has a pending submission for the current week, pre-fill form
            const currentWeekSub = history?.find(
                h => h.year === currentYear && h.month === currentMonth && h.week_number === activeWeekConfig.week
            );

            if (currentWeekSub && (currentWeekSub.status === 'pending' || (currentWeekSub.status === 'approved' && currentWeekSub.count < settings.max_count))) {
                setSubmitForm({
                    type: currentWeekSub.submission_type,
                    count: currentWeekSub.count,
                    notes: currentWeekSub.notes || '',
                    images: [],
                    previewUrls: currentWeekSub.images || []
                });
            }

        } catch (e: any) {
            toast({ title: 'โหลดการตั้งค่าล้มเหลว', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminSubmissions = async () => {
        try {
            let query = supabase
                .from('promotion_submissions')
                .select('*, profiles!promotion_submissions_user_id_fkey(username, discord_username, avatar_url)')
                .eq('year', currentYear)
                .eq('month', Number(filterMonth));

            if (filterWeek !== 'all') {
                query = query.eq('week_number', Number(filterWeek));
            }

            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setSubmissions(data || []);

            // Fetch Dashboard statistics
            const [staffRes, submissionsRes] = await Promise.all([
                supabase.from('staff_members').select('*').eq('status', 'Active'),
                supabase.from('promotion_submissions').select('*').eq('year', currentYear).eq('month', currentMonth)
            ]);

            if (staffRes.data && submissionsRes.data) {
                const staffList = staffRes.data;
                const subList = submissionsRes.data;

                const trainees = staffList.filter(s => s.intern_start_at && (!s.intern_end_at || new Date() < new Date(s.intern_end_at))).length;
                const passed = staffList.filter(s => s.intern_end_at && new Date() >= new Date(s.intern_end_at)).length;

                const thisWeekSubs = subList.filter(s => s.week_number === activeWeekConfig.week);
                const yetToSubmitCount = Math.max(0, staffList.length - thisWeekSubs.filter(s => s.status === 'approved' || s.status === 'pending').length);

                setStats({
                    totalStaff: staffList.length,
                    totalTrainees: trainees,
                    totalPassed: passed,
                    yetToSubmit: yetToSubmitCount,
                    pendingCount: subList.filter(s => s.status === 'pending').length,
                    approvedCount: subList.filter(s => s.status === 'approved').length,
                    rejectedCount: subList.filter(s => s.status === 'rejected').length
                });
            }

        } catch (e: any) {
            toast({ title: 'โหลดข้อมูลผู้ส่งงานล้มเหลว', description: e.message, variant: 'destructive' });
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        // Check constraints
        if (submitForm.images.length + files.length > settings.max_images) {
            toast({ title: `อัปโหลดรูปภาพได้สูงสุด ${settings.max_images} รูป`, variant: 'destructive' });
            return;
        }

        const newImages = [...submitForm.images, ...files];
        const newPreviews = [...submitForm.previewUrls, ...files.map(file => URL.createObjectURL(file))];

        setSubmitForm(prev => ({
            ...prev,
            images: newImages,
            previewUrls: newPreviews
        }));
    };

    const handleRemoveImage = (index: number) => {
        const newImages = [...submitForm.images];
        const newPreviews = [...submitForm.previewUrls];

        newImages.splice(index, 1);
        newPreviews.splice(index, 1);

        setSubmitForm(prev => ({
            ...prev,
            images: newImages,
            previewUrls: newPreviews
        }));
    };

    const handleSubmitWork = async () => {
        if (submitForm.count <= 0 || submitForm.count > settings.max_count) {
            toast({ title: `จำนวนครั้งต้องอยู่ระหว่าง 1 ถึง ${settings.max_count}`, variant: 'destructive' });
            return;
        }

        if (submitForm.previewUrls.length === 0) {
            toast({ title: 'กรุณาอัปโหลดรูปภาพหลักฐานอย่างน้อย 1 รูป', variant: 'destructive' });
            return;
        }

        setSubmitting(true);
        try {
            const year = currentYear;
            const month = currentMonth;
            const weekNumber = activeWeekConfig.week;
            const discordId = currentUser.discord_id;

            if (!discordId) throw new Error('ไม่พบข้อมูล Discord ID ของคุณในโปรไฟล์');

            // 1. Upload new files if any
            const uploadedUrls: string[] = [];

            // Preserve existing URLs if updating
            const existingUrls = submitForm.previewUrls.filter(url => url.startsWith('http'));
            uploadedUrls.push(...existingUrls);

            for (const file of submitForm.images) {
                const fileExt = file.name.split('.').pop();
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${currentUser.id}/${year}/${month}/week-${weekNumber}/${filename}`;

                const { data, error } = await supabase.storage
                    .from('promotion-submissions')
                    .upload(filePath, file, { upsert: true });

                if (error) throw error;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('promotion-submissions')
                    .getPublicUrl(filePath);

                uploadedUrls.push(publicUrl);
            }

            // 2. Save submission DB
            const submissionData = {
                user_id: currentUser.id,
                discord_id: discordId,
                year,
                month,
                week_number: weekNumber,
                submission_type: submitForm.type,
                count: submitForm.count,
                images: uploadedUrls,
                notes: submitForm.notes.trim() || null,
                status: 'pending' as Submission['status'],
                updated_at: new Date().toISOString()
            };

            // Check if updating or inserting
            const existingSub = personalHistory.find(
                h => h.year === year && h.month === month && h.week_number === weekNumber
            );

            if (existingSub) {
                if (existingSub.status !== 'pending' && existingSub.status !== 'rejected' && !(existingSub.status === 'approved' && existingSub.count < settings.max_count)) {
                    throw new Error('ไม่สามารถแก้ไขงานที่ได้รับการอนุมัติแล้วได้');
                }
                const { error } = await supabase
                    .from('promotion_submissions')
                    .update(submissionData)
                    .eq('id', existingSub.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('promotion_submissions')
                    .insert(submissionData);
                if (error) throw error;
            }

            toast({ title: 'ส่งงานโปรโมทเรียบร้อยแล้ว! รอดำเนินการตรวจสอบ 🐻' });
            fetchSettingsAndHistory();
        } catch (e: any) {
            toast({ title: 'เกิดข้อผิดพลาดในการส่งงาน', description: e.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    // Review Approvals
    const handleApprove = async (sub: Submission) => {
        setProcessingAction(true);
        try {
            const { data, error } = await supabase.functions.invoke('approve-promotion', {
                body: { submission_id: sub.id }
            });

            if (error) throw error;

            toast({ title: 'อนุมัติงานและแอดแต้มให้ผู้ใช้เรียบร้อยแล้ว!' });
            setDetailOpen(false);
            fetchAdminSubmissions();
        } catch (e: any) {
            toast({ title: 'ไม่สามารถอนุมัติได้', description: e.message || e, variant: 'destructive' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleOpenReject = () => {
        setRejectionReason('');
        setRejectOpen(true);
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            toast({ title: 'กรุณากรอกเหตุผลการปฏิเสธ', variant: 'destructive' });
            return;
        }
        if (!selectedSubmission) return;

        setProcessingAction(true);
        try {
            const { error } = await supabase
                .from('promotion_submissions')
                .update({
                    status: 'rejected',
                    rejected_by: currentUser.id,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: rejectionReason.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedSubmission.id);

            if (error) throw error;

            // Send Discord DM informing rejection
            const dmMsg = [
                `## 🐻︲__\` การตรวจงานโปรโมท 𓂃 \`__`,
                `-# **สถานะ:** งานของคุณถูกปฏิเสธ ✖`,
                ``,
                `> **ประเภทงาน:** ${selectedSubmission.submission_type}`,
                `> **รอบงาน:** สัปดาห์ที่ ${selectedSubmission.week_number} (${selectedSubmission.month}/${selectedSubmission.year})`,
                `> **เหตุผล:** ${rejectionReason.trim()}`,
                ``,
                `กรุณาตรวจสอบรูปหรืออัปโหลดรูปหลักฐานใหม่เพื่อยื่นส่งงานใหม่อีกครั้งค่ะ`
            ].join('\n');

            // Create negative notification
            await supabase.from('web_notifications').insert({
                user_id: selectedSubmission.user_id,
                title: 'งานโปรโมทไม่ผ่านการอนุมัติ ✖',
                message: `งานสัปดาห์ที่ ${selectedSubmission.week_number} ถูกปฏิเสธ: ${rejectionReason.trim()}`,
                type: 'error'
            });

            // Call Deno edge function to send DM (fire and forget)
            supabase.functions.invoke('approve-promotion', {
                body: {
                    submission_id: selectedSubmission.id,
                    action: 'reject',
                    rejection_reason: rejectionReason.trim()
                }
            }).catch(err => {
                console.warn('Failed to invoke rejection notification:', err);
            });

            toast({ title: 'ปฏิเสธงานโปรโมทเรียบร้อย' });
            setRejectOpen(false);
            setDetailOpen(false);
            fetchAdminSubmissions();
        } catch (e: any) {
            toast({ title: 'เกิดข้อผิดพลาดในการปฏิเสธงาน', description: e.message, variant: 'destructive' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleDeleteImage = async (urlToDelete: string) => {
        if (!selectedSubmission) return;
        if (!confirm('ยืนยันที่จะลบรูปภาพหลักฐานนี้ออกจากคลังเก็บไฟล์หรือไม่? (ประวัติและงานในระบบจะยังคงอยู่)')) return;

        setProcessingAction(true);
        try {
            // Extract file path from URL
            // https://.../storage/v1/object/public/promotion-submissions/user_id/...
            const urlParts = new URL(urlToDelete);
            const storageKey = 'promotion-submissions/';
            const index = urlParts.pathname.indexOf(storageKey);
            if (index === -1) throw new Error('ไม่พบตำแหน่งของไฟล์ใน Bucket');

            const filePath = decodeURIComponent(urlParts.pathname.substring(index + storageKey.length));

            // 1. Delete file from Supabase storage
            const { error: deleteErr } = await supabase.storage
                .from('promotion-submissions')
                .remove([filePath]);

            if (deleteErr) throw deleteErr;

            // 2. Remove URL from database submissions record
            const updatedImages = selectedSubmission.images.filter(url => url !== urlToDelete);
            const { error: dbErr } = await supabase
                .from('promotion_submissions')
                .update({ images: updatedImages })
                .eq('id', selectedSubmission.id);

            if (dbErr) throw dbErr;

            toast({ title: 'ลบรูปภาพหลักฐานออกจาก Bucket สำเร็จ' });

            // Update local state
            const updatedSub = { ...selectedSubmission, images: updatedImages };
            setSelectedSubmission(updatedSub);
            fetchAdminSubmissions();

        } catch (e: any) {
            toast({ title: 'ไม่สามารถลบรูปได้', description: e.message, variant: 'destructive' });
        } finally {
            setProcessingAction(false);
        }
    };

    // Run reminder scan manually
    const handleTriggerReminders = async () => {
        setSyncingReminders(true);
        try {
            const { data, error } = await supabase.functions.invoke('promotion-reminder-scheduler');
            if (error) throw error;
            toast({
                title: 'รันระบบแจ้งเตือนสำเร็จ',
                description: `ส่งการแจ้งเตือนสำเร็จ ${data?.remindersSent || 0} รายการ, ทำเครื่องหมายสตาฟขาดส่งงาน ${data?.missedMarked || 0} รายการ`
            });
            fetchAdminSubmissions();
        } catch (e: any) {
            toast({ title: 'รันแจ้งเตือนล้มเหลว', description: e.message, variant: 'destructive' });
        } finally {
            setSyncingReminders(false);
        }
    };

    // Save Settings
    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('system_settings')
                .update({
                    value: settingsForm as any,
                    updated_at: new Date().toISOString()
                })
                .eq('key', 'promotion_settings');

            if (error) throw error;
            toast({ title: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!' });
            setSettings(settingsForm);
        } catch (e: any) {
            toast({ title: 'เกิดข้อผิดพลาดในการบันทึก', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const getSubmissionsFiltered = useMemo(() => {
        let list = [...submissions];
        if (filterSearch.trim()) {
            const q = filterSearch.toLowerCase().trim();
            list = list.filter(s =>
                (s.profiles?.username || '').toLowerCase().includes(q) ||
                (s.profiles?.discord_username || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [submissions, filterSearch]);

    const activeSubmission = personalHistory.find(
        h => h.year === currentYear && h.month === currentMonth && h.week_number === activeWeekConfig.week
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#8C6239] dark:text-[#EAD8C8]">ส่งงานโปรโมทประจำเดือน</h1>
                    <p className="text-sm text-muted-foreground">ระบบส่งงานสตาฟประจำสัปดาห์ ตรวจสอบงานโดย Owner และรับแต้มของรางวัลสะสม</p>
                </div>
                {isOwner && (
                    <Button onClick={handleTriggerReminders} disabled={syncingReminders} variant="outline" className="gap-2 border-latte/40 dark:border-coffee/40">
                        {syncingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        รันระบบแจ้งเตือน/หมดเวลา
                    </Button>
                )}
            </div>

            {/* Week highlight cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {settings.weeks.map(w => {
                    const isCurrent = activeWeekConfig.week === w.week;
                    return (
                        <Card key={w.week} className={`border-latte/40 bg-card/85 backdrop-blur-sm overflow-hidden transition-all duration-300 relative ${isCurrent ? 'ring-2 ring-primary bg-primary/5 shadow-md scale-102' : 'opacity-70'}`}>
                            <CardHeader className="p-3 pb-0">
                                <div className="flex justify-between items-center">
                                    <Badge variant={isCurrent ? 'success' : 'secondary'} className="text-[10px]">
                                        Week {w.week}
                                    </Badge>
                                    {isCurrent && <Clock className="w-3.5 h-3.5 text-green-500 animate-pulse" />}
                                </div>
                                <CardTitle className="text-sm font-semibold mt-2">วันที่ {w.start} - {w.end}</CardTitle>
                                <CardDescription className="text-[10px] pb-3">
                                    {isCurrent ? 'กำลังเปิดรับส่งงาน' : 'ล็อกการส่งงาน'}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>

            <Tabs defaultValue="submit" className="w-full">
                <TabsList className="bg-cream/40 dark:bg-card/40 border border-latte/40 dark:border-coffee/40 rounded-2xl p-1 mb-4">
                    <TabsTrigger value="submit" className="rounded-xl px-4 py-2">ส่งงานและประวัติ</TabsTrigger>
                    <TabsTrigger value="performance" className="rounded-xl px-4 py-2">ผลงานทีมงาน</TabsTrigger>
                    {isOwner && <TabsTrigger value="review" className="rounded-xl px-4 py-2">ตรวจงานสตาฟ</TabsTrigger>}
                    {isOwner && <TabsTrigger value="settings" className="rounded-xl px-4 py-2">ตั้งค่าระบบแต้ม</TabsTrigger>}
                </TabsList>

                {/* TAB 1: SUBMIT WORK & PERSONAL HISTORY */}
                <TabsContent value="submit" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-base font-semibold">ฟอร์มส่งงานสัปดาห์นี้</CardTitle>
                                <CardDescription className="text-xs">
                                    สัปดาห์ที่ {activeWeekConfig.week} ({currentMonth}/{currentYear}) • หมดเขตวันที่ {activeWeekConfig.end}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeSubmission && activeSubmission.status !== 'pending' && activeSubmission.status !== 'rejected' && !(activeSubmission.status === 'approved' && activeSubmission.count < settings.max_count) ? (
                                    <div className="p-4 bg-green-50/5 border border-green-500/20 rounded-2xl text-center space-y-2">
                                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                                        <h3 className="font-bold text-sm">งานประจำสัปดาห์ผ่านการตรวจแล้ว!</h3>
                                        <p className="text-xs text-muted-foreground">คุณได้รับ {activeSubmission.points_awarded} แต้มสะสมเรียบร้อยแล้วค่ะ</p>
                                    </div>
                                ) : (
                                    <>
                                        {activeSubmission && activeSubmission.status === 'approved' && activeSubmission.count < settings.max_count && (
                                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                    <span>ตรวจผ่านแล้ว แต่ยังไม่ครบโควตา</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    คุณเคยส่งงานผ่านแล้ว {activeSubmission.count} ชิ้น หากส่งงานเพิ่ม ระบบจะดึงสถานะกลับเป็น <strong>รอตรวจ</strong> และหักแต้มเดิมออกชั่วคราวจนกว่าจะได้รับการอนุมัติรอบใหม่ค่ะ
                                                </p>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <Label className="text-xs">ประเภทงานโปรโมท</Label>
                                            <Select
                                                value={submitForm.type}
                                                onValueChange={v => setSubmitForm(prev => ({ ...prev, type: v as Submission['submission_type'] }))}
                                            >
                                                <SelectTrigger className="h-9 border-latte/40 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="โพสต์">โพสต์ (ได้รับ {settings.post_points} แต้ม/ชิ้น)</SelectItem>
                                                    <SelectItem value="คอมเมนต์">คอมเมนต์ (ได้รับ {settings.comment_points} แต้ม/ชิ้น)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs">จำนวนงานสำเร็จ</Label>
                                                <span className="text-[10px] font-bold text-primary">{submitForm.count} / {settings.max_count} ครั้ง</span>
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={settings.max_count}
                                                value={submitForm.count === 0 ? '' : submitForm.count}
                                                onChange={e => {
                                                    const val = Math.min(settings.max_count, Math.max(0, Number(e.target.value) || 0));
                                                    setSubmitForm(prev => ({ ...prev, count: val }));
                                                }}
                                                placeholder="กรอกจำนวนครั้ง (สูงสุด 5)"
                                                className="h-9 border-latte/40 rounded-xl"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs">รูปภาพหลักฐานงาน (สูงสุด {settings.max_images} รูป)</Label>

                                            {/* Image Preview Grid */}
                                            {submitForm.previewUrls.length > 0 && (
                                                <div className="grid grid-cols-5 gap-2 border border-latte/20 p-2 rounded-xl bg-background/30">
                                                    {submitForm.previewUrls.map((url, idx) => (
                                                        <div key={idx} className="relative aspect-square border border-latte/30 rounded-lg overflow-hidden group">
                                                            <img src={url} className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => handleRemoveImage(idx)}
                                                                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 shrink-0"
                                                            >
                                                                <Trash2 className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {submitForm.previewUrls.length < settings.max_images && (
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*"
                                                        onChange={handleImageChange}
                                                        className="hidden"
                                                        id="promotion-image-uploader"
                                                    />
                                                    <Label
                                                        htmlFor="promotion-image-uploader"
                                                        className="w-full h-16 border border-dashed border-latte/60 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-cream/10 transition-colors gap-1 text-[10px] text-muted-foreground"
                                                    >
                                                        <Upload className="w-4 h-4 text-primary" />
                                                        คลิกเพื่ออัปโหลดหลักฐานรูปภาพ
                                                    </Label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">หมายเหตุ</Label>
                                            <Textarea
                                                value={submitForm.notes}
                                                onChange={e => setSubmitForm(prev => ({ ...prev, notes: e.target.value }))}
                                                placeholder="พิมพ์หมายเหตุเพิ่มเติมหรือแปะลิงก์ผลงาน..."
                                                className="border-latte/40 rounded-xl h-14"
                                            />
                                        </div>

                                        <Button onClick={handleSubmitWork} disabled={submitting} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-bear-brown text-primary-foreground">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {activeSubmission ? 'ยื่นแก้ไขข้อมูลส่งงาน' : 'ส่งงานโปรโมทประจำสัปดาห์'}
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* User History */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-base font-semibold">ประวัติการส่งงานของคุณ</CardTitle>
                                <CardDescription className="text-xs">ตรวจสอบสถานะการยื่นคำร้องส่งงานและแต้มรางวัลสะสมรายบุคคล</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-cream/20">
                                        <TableRow>
                                            <TableHead className="pl-6">สัปดาห์</TableHead>
                                            <TableHead>ประเภท</TableHead>
                                            <TableHead>จำนวน</TableHead>
                                            <TableHead>สถานะ</TableHead>
                                            <TableHead>แต้มที่ได้รับ</TableHead>
                                            <TableHead className="pr-6">รายละเอียด</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                                        ) : personalHistory.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">ไม่มีประวัติการส่งงาน</TableCell></TableRow>
                                        ) : personalHistory.map(h => (
                                            <TableRow key={h.id}>
                                                <TableCell className="pl-6 font-semibold">Week {h.week_number} <span className="text-[10px] text-muted-foreground block">{h.month}/{h.year}</span></TableCell>
                                                <TableCell>{h.submission_type === 'none' ? '-' : h.submission_type}</TableCell>
                                                <TableCell>{h.count} / {settings.max_count}</TableCell>
                                                <TableCell>
                                                    <Badge variant={h.status === 'approved' ? 'success' : h.status === 'pending' ? 'warning' : h.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[9px]">
                                                        {h.status === 'approved' ? 'ผ่าน' : h.status === 'pending' ? 'รอตรวจ' : h.status === 'rejected' ? 'ไม่ผ่าน' : 'Missed'}
                                                    </Badge>
                                                    {h.status === 'rejected' && h.rejection_reason && (
                                                        <span className="text-[9px] text-red-500 block">เหตุผล: {h.rejection_reason}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-bold text-sm text-green-600">+{h.points_awarded} แต้ม</TableCell>
                                                <TableCell className="pr-6">
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => { setSelectedSubmission(h); setDetailOpen(true); }}>
                                                        เปิดดู
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB: STAFF PERFORMANCE (VISIBLE TO EVERYONE) */}
                <TabsContent value="performance" className="space-y-4">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm p-4 flex items-center gap-3.5 shadow-sm rounded-2xl">
                            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-500 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold truncate">งานอนุมัติแล้ว</span>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400 truncate">{perfStats.completedCount} รายการ</span>
                            </div>
                        </Card>
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm p-4 flex items-center gap-3.5 shadow-sm rounded-2xl">
                            <div className="p-2.5 rounded-xl bg-honey/10 text-honey shrink-0">
                                <Award className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold truncate">แต้มสะสมเดือนนี้</span>
                                <span className="text-lg font-bold text-honey truncate">+{perfStats.totalPoints} แต้ม</span>
                            </div>
                        </Card>
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm p-4 flex items-center gap-3.5 shadow-sm rounded-2xl">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold truncate">ทีมงาน Active</span>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 truncate">{perfStats.activeStaffCount} คน</span>
                            </div>
                        </Card>
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm p-4 flex items-center gap-3.5 shadow-sm rounded-2xl">
                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                                <Percent className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold truncate">อัตราการส่งงาน</span>
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">{perfStats.submissionRate}% ของทีม</span>
                            </div>
                        </Card>
                    </div>

                    <Card className="border-latte/40 dark:border-coffee/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
                        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <CardTitle className="text-base font-semibold">สรุปการส่งงานของทีมงาน</CardTitle>
                                <CardDescription className="text-xs">
                                    ตรวจสอบสถานะการทำผลงานและการส่งงานสะสมของเพื่อนร่วมทีมทุกคน ประจำปี {perfYear} เดือน {
                                        [
                                            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                                            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                                        ][Number(perfMonth) - 1]
                                    }
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <div className="relative w-full sm:w-48">
                                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                                    <Input
                                        value={perfSearch}
                                        onChange={e => setPerfSearch(e.target.value)}
                                        placeholder="ค้นหาชื่อสตาฟ..."
                                        className="pl-9 bg-background/50 border-latte/40 rounded-xl h-9 text-xs"
                                    />
                                </div>
                                <Select value={perfYear} onValueChange={setPerfYear}>
                                    <SelectTrigger className="w-24 bg-background/50 border-latte/40 rounded-xl h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            String(currentYear - 1),
                                            String(currentYear),
                                            String(currentYear + 1),
                                            String(currentYear + 2)
                                        ].map(y => (
                                            <SelectItem key={y} value={y}>ปี {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={perfMonth} onValueChange={setPerfMonth}>
                                    <SelectTrigger className="w-32 bg-background/50 border-latte/40 rounded-xl h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[
                                            { v: '1', l: 'มกราคม' },
                                            { v: '2', l: 'กุมภาพันธ์' },
                                            { v: '3', l: 'มีนาคม' },
                                            { v: '4', l: 'เมษายน' },
                                            { v: '5', l: 'พฤษภาคม' },
                                            { v: '6', l: 'มิถุนายน' },
                                            { v: '7', l: 'กรกฎาคม' },
                                            { v: '8', l: 'สิงหาคม' },
                                            { v: '9', l: 'กันยายน' },
                                            { v: '10', l: 'ตุลาคม' },
                                            { v: '11', l: 'พฤศจิกายน' },
                                            { v: '12', l: 'ธันวาคม' }
                                        ].map(m => (
                                            <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-cream/20 dark:bg-card/60">
                                        <TableRow>
                                            <TableHead className="pl-6 w-[220px]">สมาชิก</TableHead>
                                            <TableHead>ตำแหน่ง</TableHead>
                                            <TableHead className="text-center">สัปดาห์ที่ 1</TableHead>
                                            <TableHead className="text-center">สัปดาห์ที่ 2</TableHead>
                                            <TableHead className="text-center">สัปดาห์ที่ 3</TableHead>
                                            <TableHead className="text-center">สัปดาห์ที่ 4</TableHead>
                                            <TableHead className="text-right pr-6">แต้มสะสมเดือนนี้</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingPerformance ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลดผลงาน...</TableCell></TableRow>
                                        ) : filteredPerformance.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">ไม่พบข้อมูลผลงานสตาฟ</TableCell></TableRow>
                                        ) : filteredPerformance.map((member: any) => {
                                            const hasColor = member.position_color;
                                            const renderWeekBadge = (weekData: any) => {
                                                if (weekData.status === 'none') {
                                                    return <Badge variant="secondary" className="text-[10px] opacity-60">ยังไม่ส่ง</Badge>;
                                                }
                                                if (weekData.status === 'missed') {
                                                    return <Badge variant="destructive" className="text-[10px]">ขาดส่ง</Badge>;
                                                }
                                                const isApproved = weekData.status === 'approved';
                                                const label = `${weekData.type === 'โพสต์' ? 'โพสต์' : 'คอมเมนต์'} (${weekData.count} ครั้ง)`;
                                                return (
                                                    <Badge
                                                        variant={isApproved ? 'success' : 'warning'}
                                                        className="text-[10px] font-semibold whitespace-nowrap"
                                                    >
                                                        {label}
                                                    </Badge>
                                                );
                                            };

                                            return (
                                                <TableRow key={member.id} className="hover:bg-cream/5 dark:hover:bg-card/40 transition-colors">
                                                    <TableCell className="pl-6">
                                                        <div className="flex items-center gap-3">
                                                            <img
                                                                src={member.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                                                alt="Discord Avatar"
                                                                className="w-8 h-8 rounded-full border border-latte/30 dark:border-coffee/30 shrink-0"
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-sm truncate">{member.username || 'Loading...'}</span>
                                                                <span className="text-[10px] text-muted-foreground truncate">@{member.discord_username}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className="text-xs font-medium"
                                                            style={{
                                                                backgroundColor: hasColor ? `${hasColor}15` : 'rgba(var(--primary), 0.1)',
                                                                color: hasColor || 'var(--primary)',
                                                                border: `1px solid ${hasColor}30`
                                                            }}
                                                        >
                                                            {member.position_name}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">{renderWeekBadge(member.week1)}</TableCell>
                                                    <TableCell className="text-center">{renderWeekBadge(member.week2)}</TableCell>
                                                    <TableCell className="text-center">{renderWeekBadge(member.week3)}</TableCell>
                                                    <TableCell className="text-center">{renderWeekBadge(member.week4)}</TableCell>
                                                    <TableCell className="text-right pr-6 font-bold text-green-600">+{member.totalPoints} แต้ม</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: OWNER SUBMISSIONS REVIEW */}
                {isOwner && (
                    <TabsContent value="review" className="space-y-6">
                        {/* Stats Dashboard */}
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">ทีมงาน (Active)</span>
                                <span className="text-lg font-bold mt-1 text-[#8C6239]">{stats.totalStaff} คน</span>
                            </Card>
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">ผู้ฝึกงาน (Trainees)</span>
                                <span className="text-lg font-bold mt-1 text-indigo-500">{stats.totalTrainees} คน</span>
                            </Card>
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">สตาฟยังไม่ส่งงาน</span>
                                <span className="text-lg font-bold mt-1 text-red-500">{stats.yetToSubmit} คน</span>
                            </Card>
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">งานรอตรวจ (Pending)</span>
                                <span className="text-lg font-bold mt-1 text-amber-500">{stats.pendingCount} รายการ</span>
                            </Card>
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">อนุมัติแล้ว (Approved)</span>
                                <span className="text-lg font-bold mt-1 text-green-500">{stats.approvedCount} รายการ</span>
                            </Card>
                            <Card className="border-latte/40 bg-card/80 p-3 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground">ปฏิเสธแล้ว (Rejected)</span>
                                <span className="text-lg font-bold mt-1 text-red-600">{stats.rejectedCount} รายการ</span>
                            </Card>
                        </div>

                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden">
                            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-base font-semibold">รายการส่งงานของทีมงาน</CardTitle>
                                    <CardDescription className="text-xs">ค้นหาและตรวจสอบรูปภาพหลักฐานการทำโปรโมทและอนุมัติแต้มรางวัล</CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                    <div className="relative w-full sm:w-44">
                                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                                        <Input
                                            value={filterSearch}
                                            onChange={e => setFilterSearch(e.target.value)}
                                            placeholder="ค้นหาชื่อผู้ใช้..."
                                            className="pl-9 bg-background/50 border-latte/40 rounded-xl h-9 text-xs"
                                        />
                                    </div>
                                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                                        <SelectTrigger className="w-28 bg-background/50 border-latte/40 rounded-xl h-9 text-xs">
                                            <SelectValue placeholder="เลือกเดือน" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <SelectItem key={m} value={String(m)}>เดือน {m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterWeek} onValueChange={setFilterWeek}>
                                        <SelectTrigger className="w-28 bg-background/50 border-latte/40 rounded-xl h-9 text-xs">
                                            <SelectValue placeholder="สัปดาห์" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">ทุกสัปดาห์</SelectItem>
                                            <SelectItem value="1">Week 1</SelectItem>
                                            <SelectItem value="2">Week 2</SelectItem>
                                            <SelectItem value="3">Week 3</SelectItem>
                                            <SelectItem value="4">Week 4</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="w-32 bg-background/50 border-latte/40 rounded-xl h-9 text-xs">
                                            <SelectValue placeholder="กรองสถานะ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">ทุกสถานะ</SelectItem>
                                            <SelectItem value="pending">รอตรวจ</SelectItem>
                                            <SelectItem value="approved">ผ่าน</SelectItem>
                                            <SelectItem value="rejected">ไม่ผ่าน</SelectItem>
                                            <SelectItem value="missed">Missed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-cream/20">
                                        <TableRow>
                                            <TableHead className="pl-6">สตาฟสมาชิค</TableHead>
                                            <TableHead>เดือน/สัปดาห์</TableHead>
                                            <TableHead>ประเภทงาน</TableHead>
                                            <TableHead>จำนวนครั้ง</TableHead>
                                            <TableHead>วันที่ส่ง</TableHead>
                                            <TableHead>สถานะ</TableHead>
                                            <TableHead className="text-right pr-6">จัดการ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {getSubmissionsFiltered.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">ไม่พบรายการส่งงาน</TableCell></TableRow>
                                        ) : getSubmissionsFiltered.map(sub => (
                                            <TableRow key={sub.id} className="hover:bg-cream/5 transition-colors">
                                                <TableCell className="pl-6">
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={sub.profiles?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                                            className="w-7 h-7 rounded-full border"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-xs">{sub.profiles?.username || 'Unknown'}</span>
                                                            <span className="text-[9px] text-muted-foreground">@{sub.profiles?.discord_username || sub.discord_id}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium">สัปดาห์ที่ {sub.week_number} ({sub.month}/{sub.year})</TableCell>
                                                <TableCell className="text-xs">{sub.submission_type === 'none' ? '-' : sub.submission_type}</TableCell>
                                                <TableCell className="text-xs font-semibold">{sub.count} / {settings.max_count}</TableCell>
                                                <TableCell className="text-[10px]">{new Date(sub.created_at).toLocaleString('th-TH')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={sub.status === 'approved' ? 'success' : sub.status === 'pending' ? 'warning' : sub.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[9px] scale-90">
                                                        {sub.status === 'approved' ? 'ผ่าน' : sub.status === 'pending' ? 'รอตรวจ' : sub.status === 'rejected' ? 'ไม่ผ่าน' : 'Missed'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => { setSelectedSubmission(sub); setSelectedSubmission(sub); setDetailOpen(true); }}>
                                                        ตรวจสอบ
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* TAB 3: SETTINGS PANEL */}
                {isOwner && (
                    <TabsContent value="settings" className="space-y-4">
                        <Card className="border-latte/40 bg-card/85 backdrop-blur-sm shadow-md rounded-3xl overflow-hidden max-w-xl">
                            <CardHeader>
                                <CardTitle className="text-base font-semibold">ตั้งค่าระบบแต้มและสัปดาห์ส่งงาน</CardTitle>
                                <CardDescription className="text-xs">ปรับค่าแต้ม จำนวนสัปดาห์ และรอบแจ้งเตือนได้โดยไม่แก้ไขโค้ด</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs">แต้มรางวัล โพสต์ (Post)</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.post_points}
                                            onChange={e => setSettingsForm(prev => ({ ...prev, post_points: Number(e.target.value) || 0 }))}
                                            className="h-9 border-latte/40 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">แต้มรางวัล คอมเมนต์ (Comment)</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.comment_points}
                                            onChange={e => setSettingsForm(prev => ({ ...prev, comment_points: Number(e.target.value) || 0 }))}
                                            className="h-9 border-latte/40 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs">จำนวนครั้งสูงสุดที่จะส่ง</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.max_count}
                                            onChange={e => setSettingsForm(prev => ({ ...prev, max_count: Number(e.target.value) || 5 }))}
                                            className="h-9 border-latte/40 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">จำนวนรูปภาพสูงสุดหลักฐาน</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.max_images}
                                            onChange={e => setSettingsForm(prev => ({ ...prev, max_images: Number(e.target.value) || 5 }))}
                                            className="h-9 border-latte/40 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-[#8C6239]">ช่วงวันแต่ละสัปดาห์ (ระบุวันที่ในเดือน เช่น 1-7)</Label>
                                    <p className="text-[10px] text-muted-foreground leading-normal mb-2">กำหนดช่วงของวันที่ (Day of month) ที่สตาฟสามารถส่งงานได้ในแต่ละสัปดาห์</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                        {settingsForm.weeks.map((w, idx) => (
                                            <div key={w.week} className="p-2.5 border border-latte/40 rounded-xl bg-background/50 space-y-2">
                                                <Label className="text-[11px] font-bold text-[#8C6239] block">สัปดาห์ที่ {w.week}</Label>
                                                <div className="space-y-1 text-[10px]">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-muted-foreground w-12 shrink-0">วันที่เริ่ม:</span>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            value={w.start}
                                                            onChange={e => {
                                                                const newWeeks = [...settingsForm.weeks];
                                                                newWeeks[idx].start = Number(e.target.value) || 1;
                                                                setSettingsForm(prev => ({ ...prev, weeks: newWeeks }));
                                                            }}
                                                            className="h-7 w-16 px-1.5 text-center border-latte/40 rounded-lg text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-muted-foreground w-12 shrink-0">สิ้นสุด:</span>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            value={w.end}
                                                            onChange={e => {
                                                                const newWeeks = [...settingsForm.weeks];
                                                                newWeeks[idx].end = Number(e.target.value) || 1;
                                                                setSettingsForm(prev => ({ ...prev, weeks: newWeeks }));
                                                            }}
                                                            className="h-7 w-16 px-1.5 text-center border-latte/40 rounded-lg text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button onClick={handleSaveSettings} className="w-full gap-2 rounded-xl mt-2">
                                    <Settings className="w-4 h-4" />
                                    บันทึกการตั้งค่าระบบ
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* DIALOG: SUBMISSION DETAIL (OWNER & USER) */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">
                            รายละเอียดงานโปรโมท
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            ยื่นส่งสัปดาห์ที่ {selectedSubmission?.week_number} • ประเภท {selectedSubmission?.submission_type} ({selectedSubmission?.count} ครั้ง)
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSubmission && (
                        <div className="space-y-4 my-2 text-xs">
                            <div className="flex items-center gap-2 p-2 bg-cream/10 border border-latte/20 rounded-xl">
                                <img
                                    src={selectedSubmission.profiles?.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                    className="w-9 h-9 rounded-full"
                                />
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">{selectedSubmission.profiles?.username || 'Unknown'}</span>
                                    <span className="text-muted-foreground text-[10px]">Discord ID: {selectedSubmission.discord_id}</span>
                                </div>
                            </div>

                            {selectedSubmission.notes && (
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-[10px]">หมายเหตุ/ข้อความสตาฟ:</Label>
                                    <div className="p-2 border rounded-xl bg-background/50 leading-relaxed break-words">{selectedSubmission.notes}</div>
                                </div>
                            )}

                            {/* Uploaded Images Gallery */}
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-[10px]">หลักฐานรูปภาพ ({selectedSubmission.images.length} รูป):</Label>
                                {selectedSubmission.images.length === 0 ? (
                                    <p className="text-muted-foreground italic text-[11px] p-2 border rounded-xl">ไม่มีรูปภาพหลักฐาน</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedSubmission.images.map((url, idx) => (
                                            <div key={idx} className="relative aspect-video border rounded-xl overflow-hidden group bg-zinc-900 flex items-center justify-center">
                                                <img src={url} className="w-full h-full object-contain" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                                    <a href={url} target="_blank" rel="noreferrer" className="bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 shrink-0">
                                                        <Eye className="w-4 h-4" />
                                                    </a>
                                                    {isOwner && (
                                                        <button onClick={() => handleDeleteImage(url)} disabled={processingAction} className="bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full p-1.5 shrink-0">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Status Badge */}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-muted-foreground">สถานะตรวจสอบ:</span>
                                <Badge variant={selectedSubmission.status === 'approved' ? 'success' : selectedSubmission.status === 'pending' ? 'warning' : 'destructive'} className="text-[10px]">
                                    {selectedSubmission.status === 'approved' ? 'อนุมัติแล้ว' : selectedSubmission.status === 'pending' ? 'รอตรวจ' : 'ถูกปฏิเสธ/ขาดงาน'}
                                </Badge>
                            </div>

                            {/* Owner actions */}
                            {isOwner && selectedSubmission.status === 'pending' && (
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <Button onClick={handleOpenReject} disabled={processingAction} variant="outline" className="gap-1 rounded-xl text-red-500 border-red-200 hover:bg-red-50/10">
                                        <XCircle className="w-4 h-4" />
                                        ปฏิเสธคำร้อง
                                    </Button>
                                    <Button onClick={() => handleApprove(selectedSubmission)} disabled={processingAction} className="gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white">
                                        {processingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                        อนุมัติงาน (+แต้ม)
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* DIALOG: REJECTION REASON */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold">เหตุผลการปฏิเสธงาน</DialogTitle>
                        <DialogDescription className="sr-only">ระบุเหตุผลในการปฏิเสธการส่งงานของสตาฟ</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 my-2 text-xs">
                        <Label className="text-xs">เหตุผล</Label>
                        <Input
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder="ระบุเหตุผล เช่น รูปไม่ครบ / หลักฐานไม่ตรงกับสัปดาห์"
                            className="h-9 border-latte/40 rounded-xl"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectOpen(false)} className="rounded-xl">ยกเลิก</Button>
                        <Button onClick={handleReject} disabled={processingAction} className="rounded-xl bg-red-600 hover:bg-red-700 text-white gap-2">
                            {processingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                            ยืนยันปฏิเสธ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
