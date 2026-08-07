// ContractsManagement — สัญญาเช่า
//
// SQL:
// CREATE TABLE public.contracts (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   type TEXT NOT NULL CHECK (type IN ('house', 'role', 'personal_role')),
//   member_id TEXT NOT NULL,
//   start_at TIMESTAMPTZ NOT NULL,
//   end_at TIMESTAMPTZ,
//   room_link TEXT,
//   role_name TEXT,
//   discord_role_id TEXT,
//   operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
//   operator_name TEXT,
//   edit_log JSONB DEFAULT '[]',
//   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
//   updated_at TIMESTAMPTZ
// );

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Plus, Home, User, Clock, Bell, Edit2, Search, RefreshCw,
  Loader2, CheckCircle2, X, Upload, Star, Link, Hash, Users, Calendar,
  AlertTriangle, Copy, History, HelpCircle, ArrowRight, Megaphone, Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/date-time-picker';

type ContractType = 'house' | 'personal_role' | 'boost_role' | 'ad';

interface Contract {
  id: string;
  type: 'house' | 'personal_role' | 'boost_role' | 'ad' | 'role'; // Keep 'role' in interface to filter legacy records
  member_id: string;
  start_at: string;
  end_at: string | null;
  room_link: string | null;
  role_name: string | null;
  discord_role_id: string | null;
  package_name?: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
  updated_at: string | null;
  edit_log: Array<{ editor: string; avatar: string | null; timestamp: string }> | null;
}

interface TypeIcons {
  house: string | null;
  personal_role: string | null;
  boost_role: string | null;
  ad: string | null;
}

const typeIconsMap: Record<ContractType, React.ComponentType<any>> = {
  house: Home,
  personal_role: Star,
  boost_role: Rocket,
  ad: Megaphone,
};

function formatRemaining(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'หมดอายุแล้ว';
  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = totalHours % 24;
  const mins = totalMinutes % 60;

  if (months > 0 && days > 0) return `เหลือ ${months} เดือน ${days} วัน`;
  if (months > 0) return `เหลือ ${months} เดือน`;
  if (days > 0 && hours > 0) return `เหลือ ${days} วัน ${hours} ชม.`;
  if (days > 0) return `เหลือ ${days} วัน`;
  if (hours > 0 && mins > 0) return `เหลือ ${hours} ชม. ${mins} นาที`;
  if (hours > 0) return `เหลือ ${hours} ชม.`;
  return `เหลือ ${mins} นาที`;
}

// Helper to format remaining days purely as a number for internal color boundaries
function daysRemaining(endAt: string) {
  return (new Date(endAt).getTime() - Date.now()) / 86400000;
}

function formatElapsed(startAt: string) {
  const diff = Date.now() - new Date(startAt).getTime();
  const totalHours = Math.floor(diff / 3600000);
  const totalDays = Math.floor(totalHours / 24);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = totalHours % 24;
  if (months > 0 && days > 0) return `สร้างมาแล้ว ${months} เดือน ${days} วัน`;
  if (months > 0) return `สร้างมาแล้ว ${months} เดือน`;
  if (days > 0 && hours > 0) return `สร้างมาแล้ว ${days} วัน ${hours} ชม.`;
  if (days > 0) return `สร้างมาแล้ว ${days} วัน`;
  return `สร้างมาแล้ว ${hours} ชม.`;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Format date nicely for Thai display
function formatDateThai(isoString: string, includeTime = false) {
  const d = new Date(isoString);
  const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  if (includeTime) {
    const formattedTime = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${formattedDate} เวลา ${formattedTime} น.`;
  }
  return formattedDate;
}

// ─── IconUpload Component (Owner only) ───────────────────────────────────────

interface IconUploadProps {
  typeIcons: TypeIcons;
  onUploaded: (type: ContractType, url: string) => void;
}

function IconUpload({ typeIcons, onUploaded }: IconUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<ContractType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<ContractType | null>(null);

  const typeLabel: Record<ContractType, string> = {
    house: 'บ้าน',
    personal_role: 'ยศส่วนตัว',
    boost_role: 'ยศบูสต์',
    ad: 'โฆษณา',
  };

  function handleClick(type: ContractType) {
    pendingType.current = type;
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const type = pendingType.current;
    if (!file || !type) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    setUploading(type);
    try {
      const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      await Promise.allSettled(
        exts.map(oldExt =>
          supabase.storage.from('contract-icons').remove([`type-icons/${type}.${oldExt}`])
        )
      );

      const { error: upErr } = await supabase.storage
        .from('contract-icons')
        .upload(`type-icons/${type}.${ext}`, file, { upsert: true, cacheControl: '31536000' });
      if (upErr) throw upErr;

      const { data } = supabase.storage
        .from('contract-icons')
        .getPublicUrl(`type-icons/${type}.${ext}`);

      onUploaded(type, `${data.publicUrl}?t=${Date.now()}`);
      toast({ title: `อัปโหลดไอคอน ${typeLabel[type]} สำเร็จ` });
    } catch (err: any) {
      toast({ title: 'อัปโหลดไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(type: ContractType) {
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    await Promise.allSettled(
      exts.map(ext => supabase.storage.from('contract-icons').remove([`type-icons/${type}.${ext}`]))
    );
    onUploaded(type, '');
    toast({ title: `ลบไอคอน ${typeLabel[type]} แล้ว` });
  }

  return (
    <div className="flex items-center gap-2 bg-[#FAF6F0] dark:bg-[#2C241E] px-3 py-1 rounded-xl border border-[#F0E8DC] dark:border-[#42352B]">
      <span className="text-[11px] font-medium text-[#827160] dark:text-[#A89889]">ไอคอน:</span>
      {(['house', 'personal_role', 'boost_role', 'ad'] as ContractType[]).map(type => (
        <div key={type} className="relative group">
          <button
            onClick={() => handleClick(type)}
            title={`อัปโหลดไอคอน ${typeLabel[type]}`}
            className="relative w-8 h-8 rounded-lg border border-dashed border-[#DFD5C0] hover:border-[#8C6239] bg-white dark:bg-[#1E1B18] transition-colors flex items-center justify-center overflow-hidden"
          >
            {uploading === type ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : typeIcons[type] ? (
              <img src={typeIcons[type]!} alt={type} className="w-full h-full object-cover rounded-lg" />
            ) : (
              React.createElement(typeIconsMap[type], { className: "w-3.5 h-3.5 text-[#827160]" })
            )}
            <span className="absolute bottom-0 right-0 bg-background/80 rounded-tl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="w-2 h-2 text-muted-foreground" />
            </span>
          </button>
          {typeIcons[type] && (
            <button
              onClick={() => handleDelete(type)}
              title={`ลบไอคอน ${typeLabel[type]}`}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="w-2 h-2" />
            </button>
          )}
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ─── Add Dialog (Single screen visual configuration) ────────────────────────

interface AddDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  operatorId: string;
  operatorName: string;
}

interface DiscordRole { id: string; name: string; color: string | null; }

function AddDialog({ open, onClose, onSaved, operatorId, operatorName }: AddDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<ContractType>('house');
  const [saving, setSaving] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [packageName, setPackageName] = useState('');

  // Promo Packages catalog
  const [promoPackages, setPromoPackages] = useState<string[]>([]);
  const [isCustomPackage, setIsCustomPackage] = useState(false);

  // End Date Dual Mode ('picker' | 'days')
  const [endMode, setEndMode] = useState<'picker' | 'days'>('picker');
  const [daysInput, setDaysInput] = useState('');

  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedDiscordRole, setSelectedDiscordRole] = useState<DiscordRole | null>(null);

  async function fetchDiscordRoles() {
    setRolesLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      }
      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setDiscordRoles(data?.roles ?? []);
    } catch (e: any) {
      toast({ title: 'โหลดยศ Discord ไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRolesLoading(false);
    }
  }

  useEffect(() => {
    if (open && (type === 'personal_role' || type === 'boost_role') && discordRoles.length === 0) {
      fetchDiscordRoles();
    }
  }, [open, type]);

  useEffect(() => {
    if (open) {
      (supabase as any)
        .from('product_catalog')
        .select('display_name')
        .eq('product_type', 'promo_package')
        .eq('is_active', true)
        .order('display_name', { ascending: true })
        .then(({ data, error }: any) => {
          if (!error && data) {
            setPromoPackages(data.map((p: any) => p.display_name));
          }
        });
    }
  }, [open]);

  const handleDaysChange = (val: string) => {
    setDaysInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && startAt) {
      const startDate = new Date(startAt);
      const endDate = new Date(startDate.getTime() + num * 86400000);
      setEndAt(toLocalDatetimeValue(endDate.toISOString()));
    }
  };

  useEffect(() => {
    if (endMode === 'days' && daysInput && startAt) {
      handleDaysChange(daysInput);
    }
  }, [startAt]);

  const filteredDiscordRoles = discordRoles.filter(r =>
    !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  function reset() {
    setType('house'); setMemberId(''); setStartAt(''); setEndAt('');
    setRoomLink(''); setRoleSearch(''); setPackageName('');
    setEndMode('picker'); setDaysInput(''); setIsCustomPackage(false);
    setSelectedDiscordRole(null);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!memberId.trim() || !startAt) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' }); return;
    }
    if ((type === 'personal_role' || type === 'boost_role') && !selectedDiscordRole) {
      toast({ title: 'กรุณาเลือกยศ Discord', variant: 'destructive' }); return;
    }
    if (type === 'ad' && !packageName.trim()) {
      toast({ title: 'กรุณากรอก/เลือกชื่อแพ็กเกจโฆษณา', variant: 'destructive' }); return;
    }
    setSaving(true);

    const inputId = memberId.trim();
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
          setSaving(false);
          return;
        }
      }
    } catch (e) {
      console.error('Error resolving member ID:', e);
    }

    const isRoleType = (type === 'personal_role' || type === 'boost_role');

    const payload: Record<string, unknown> = {
      type,
      member_id: resolvedMemberId,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      room_link: !isRoleType && roomLink.trim() ? roomLink.trim() : null,
      role_name: isRoleType ? selectedDiscordRole?.name ?? null : null,
      discord_role_id: isRoleType ? selectedDiscordRole?.id ?? null : null,
      package_name: type === 'ad' ? packageName.trim() : null,
      operator_id: operatorId,
      operator_name: operatorName,
      edit_log: [],
    };
    const { error } = await (supabase as any).from('contracts').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'เพิ่มสัญญาสำเร็จ' });
    reset(); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2.5">
            <Plus className="w-6 h-6 text-[#8C6239]" />
            เพิ่มสัญญาเช่าใหม่
          </DialogTitle>
          <DialogDescription className="text-sm text-[#827160] dark:text-[#A89889]">
            ระบุประเภทและรายละเอียดสัญญาเพื่อลงทะเบียนในระบบ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Selector for Contract Type */}
          <div className="grid grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setType('house')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center justify-center min-h-[80px] cursor-pointer',
                type === 'house'
                  ? 'border-[#8C6239] bg-[#8C6239]/10 text-[#8C6239] shadow-sm font-bold'
                  : 'border-[#F4EEE5] dark:border-[#2D2520] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC] dark:hover:border-stone-850'
              )}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">เช่าบ้าน</span>
            </button>

            <button
              type="button"
              onClick={() => setType('personal_role')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center justify-center min-h-[80px] cursor-pointer',
                type === 'personal_role'
                  ? 'border-[#D97706] bg-[#D97706]/10 text-[#D97706] shadow-sm font-bold'
                  : 'border-[#F4EEE5] dark:border-[#2D2520] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC] dark:hover:border-stone-850'
              )}
            >
              <Star className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">ยศส่วนตัว</span>
            </button>

            <button
              type="button"
              onClick={() => setType('boost_role')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center justify-center min-h-[80px] cursor-pointer',
                type === 'boost_role'
                  ? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-sm font-bold'
                  : 'border-[#F4EEE5] dark:border-[#2D2520] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC] dark:hover:border-stone-850'
              )}
            >
              <Rocket className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">ยศบูสต์</span>
            </button>

            <button
              type="button"
              onClick={() => setType('ad')}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center justify-center min-h-[80px] cursor-pointer',
                type === 'ad'
                  ? 'border-[#6366F1] bg-[#6366F1]/10 text-[#6366F1] shadow-sm font-bold'
                  : 'border-[#F4EEE5] dark:border-[#2D2520] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC] dark:hover:border-stone-850'
              )}
            >
              <Megaphone className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold">โฆษณา</span>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">Discord Member ID</Label>
              <Input
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                placeholder="ป้อน Discord User ID (ตัวเลข)"
                className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-10 text-sm font-medium focus-visible:ring-offset-0"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">วันที่เริ่มต้นสัญญา</Label>
              <DateTimePicker
                value={startAt}
                onChange={setStartAt}
                className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28]"
              />
            </div>

            {/* End Date Dual Input Mode */}
            <div className="space-y-2 pt-2 border-t border-dashed border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">วันที่สิ้นสุดสัญญา (ถ้ามี)</Label>
                <div className="flex items-center gap-1 bg-[#FAF6F0] dark:bg-[#25201C] p-1 rounded-xl border border-[#F0E8DC] dark:border-[#382F28]">
                  <button
                    type="button"
                    onClick={() => setEndMode('picker')}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer', endMode === 'picker' ? 'bg-white dark:bg-[#1E1B18] shadow-sm text-foreground' : 'text-muted-foreground')}
                  >
                    📅 เลือกปฏิทิน
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndMode('days')}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer', endMode === 'days' ? 'bg-white dark:bg-[#1E1B18] shadow-sm text-foreground' : 'text-muted-foreground')}
                  >
                    ⏱️ ระบุจำนวนวัน
                  </button>
                </div>
              </div>

              {endMode === 'picker' ? (
                <DateTimePicker
                  value={endAt}
                  onChange={setEndAt}
                  className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28]"
                />
              ) : (
                <div className="space-y-2.5 bg-[#FAF6F0]/60 dark:bg-[#25201C]/60 p-3 rounded-2xl border border-[#F0E8DC] dark:border-[#382F28]">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="เช่น 2 หรือ 7 หรือ 30"
                      value={daysInput}
                      onChange={e => handleDaysChange(e.target.value)}
                      className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] text-sm h-9 w-40 font-bold"
                    />
                    <span className="text-sm font-bold text-foreground">วัน</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1, 2, 3, 7, 14, 30, 90, 365].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDaysChange(String(d))}
                        className={cn('h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer', daysInput === String(d) ? 'bg-[#8C6239] text-white border-[#8C6239]' : 'border-[#EFE7DC] dark:border-[#382F28]')}
                      >
                        +{d} วัน
                      </Button>
                    ))}
                  </div>
                  {endAt && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold pt-0.5">
                      ✓ วันสิ้นสุด: {formatDateThai(endAt, true)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Fields for House */}
            {type === 'house' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">Room Link (ช่อง Discord)</Label>
                <Input
                  value={roomLink}
                  onChange={e => setRoomLink(e.target.value)}
                  placeholder="https://discord.com/channels/..."
                  className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm font-medium h-10 focus-visible:ring-[#8C6239] focus-visible:ring-offset-0"
                />
              </div>
            )}

            {/* Fields for Ad */}
            {type === 'ad' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">ชื่อแพ็กเกจโฆษณา</Label>
                {promoPackages.length > 0 && !isCustomPackage ? (
                  <div className="space-y-1.5">
                    <Select value={packageName} onValueChange={(val) => {
                      if (val === '__custom__') {
                        setIsCustomPackage(true);
                        setPackageName('');
                      } else {
                        setPackageName(val);
                      }
                    }}>
                      <SelectTrigger className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm h-10 font-bold">
                        <SelectValue placeholder="เลือกแพ็กเกจจาก Catalog..." />
                      </SelectTrigger>
                      <SelectContent>
                        {promoPackages.map((pkg) => (
                          <SelectItem key={pkg} value={pkg} className="text-sm font-semibold">{pkg}</SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="text-sm font-semibold">✏️ กรอกชื่อแพ็กเกจด้วยตัวเอง...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {promoPackages.length > 0 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setIsCustomPackage(false)}
                          className="text-xs text-blue-500 hover:underline font-bold"
                        >
                          ← เลือกแพ็กเกจจาก Catalog
                        </button>
                      </div>
                    )}
                    <Input
                      value={packageName}
                      onChange={e => setPackageName(e.target.value)}
                      placeholder="เช่น แพ็ก Banner A"
                      className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl h-10 text-sm font-medium focus-visible:ring-[#8C6239] focus-visible:ring-offset-0"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Fields for Personal Role & Boost Role */}
            {(type === 'personal_role' || type === 'boost_role') && (
              <div className="space-y-3 bg-[#FAF6F0] dark:bg-[#24201E] p-3.5 rounded-2xl border border-[#F0E8DC] dark:border-[#3C322A]">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                    เชื่อมโยงยศ Discord ({type === 'boost_role' ? 'ยศบูสต์' : 'ยศส่วนตัว'})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchDiscordRoles}
                    disabled={rolesLoading}
                    className="h-7.5 text-xs font-bold gap-1.5 px-2.5 border-[#DFD5C0] dark:border-[#3E3229] hover:bg-white text-[#827160] cursor-pointer"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', rolesLoading && 'animate-spin')} />
                    ซิงค์ยศจาก Discord
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-xs font-medium bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#3E3229]"
                    placeholder="ค้นหาชื่อบทบาท/ยศ..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                  />
                </div>

                {rolesLoading ? (
                  <div className="flex justify-center py-5">
                    <Loader2 className="w-6 h-6 animate-spin text-[#8C6239]" />
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border bg-white dark:bg-[#1E1B18] border-[#EAD8C8] dark:border-[#2D2520] divide-y divide-[#EAD8C8] dark:divide-[#2D2520] text-sm">
                    {filteredDiscordRoles.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-5">
                        {discordRoles.length === 0 ? 'กดปุ่มซิงค์ด้านบนเพื่อโหลดยศ' : 'ไม่พบยศที่ตรงกัน'}
                      </p>
                    ) : filteredDiscordRoles.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedDiscordRole(r)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-accent transition-colors cursor-pointer',
                          selectedDiscordRole?.id === r.id && 'bg-[#D97706]/15 font-bold'
                        )}
                      >
                        {r.color ? (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <span className="truncate flex-1 font-semibold text-sm">{r.name}</span>
                        {selectedDiscordRole?.id === r.id && (
                          <CheckCircle2 className="w-4 h-4 text-[#D97706] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedDiscordRole && (
                  <div className="text-xs font-bold text-[#827160] flex items-center gap-2">
                    <span>ยศที่เลือก:</span>
                    <Badge className="bg-[#D97706]/15 hover:bg-[#D97706]/20 text-[#A66E2E] border-[#FAE3C1] font-bold text-xs rounded-lg px-2 py-0.5">
                      {selectedDiscordRole.name}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3">
          <Button variant="outline" onClick={handleClose} className="rounded-xl border-[#EFE7DC] dark:border-[#2D2520] h-10 px-4 text-sm font-bold cursor-pointer">ยกเลิก</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'rounded-xl text-white font-bold h-10 px-5 shadow-sm transition-all cursor-pointer',
              type === 'house'
                ? 'bg-[#8C6239] hover:bg-[#76522E] text-white'
                : type === 'personal_role'
                  ? 'bg-[#D97706] hover:bg-[#B45F06] text-white'
                  : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white'
            )}
          >
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-white" />}
            บันทึกสัญญา
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog (House details only) ─────────────────────────────────────────

interface EditDialogProps {
  contract: Contract;
  onClose: () => void;
  onSaved: () => void;
  operatorName: string;
  operatorAvatar: string | null;
}

function EditDialog({ contract, onClose, onSaved, operatorName, operatorAvatar }: EditDialogProps) {
  const { toast } = useToast();
  const [endAt, setEndAt] = useState(contract.end_at ? toLocalDatetimeValue(contract.end_at) : '');
  const [roomLink, setRoomLink] = useState(contract.room_link ?? '');
  const [packageName, setPackageName] = useState(contract.package_name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const newLog = [
      ...(contract.edit_log ?? []),
      { editor: operatorName, avatar: operatorAvatar, timestamp: new Date().toISOString() },
    ];
    const updatePayload: Record<string, any> = {
      end_at: endAt ? new Date(endAt).toISOString() : null,
      updated_at: new Date().toISOString(),
      edit_log: newLog,
    };
    if (contract.type === 'house') {
      updatePayload.room_link = roomLink.trim() || null;
    } else if (contract.type === 'ad') {
      updatePayload.package_name = packageName.trim() || null;
    }

    const { error } = await (supabase as any).from('contracts').update(updatePayload).eq('id', contract.id);
    setSaving(false);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'แก้ไขสำเร็จ' });
    onSaved();
  }

  const isAd = contract.type === 'ad';
  const themeColor = isAd ? 'bg-[#6366F1] hover:bg-[#4F46E5]' : 'bg-[#8C6239] hover:bg-[#76522E]';

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2.5">
            {isAd ? <Megaphone className="w-5 h-5 text-[#6366F1]" /> : <Edit2 className="w-5 h-5 text-[#8C6239]" />}
            {isAd ? 'แก้ไขสัญญาโฆษณา' : 'แก้ไขสัญญาเช่าบ้าน'}
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold text-[#827160]">
            สมาชิก ID: {contract.member_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">วันที่สิ้นสุดสัญญา</Label>
            <DateTimePicker
              value={endAt}
              onChange={setEndAt}
              className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28]"
            />
          </div>
          
          {!isAd ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">Room Link (ช่อง Discord)</Label>
              <Input
                value={roomLink}
                onChange={e => setRoomLink(e.target.value)}
                placeholder="https://discord.com/channels/..."
                className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm font-medium h-10 focus-visible:ring-[#8C6239] focus-visible:ring-offset-0"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">ชื่อแพ็กเกจโฆษณา</Label>
              <Input
                value={packageName}
                onChange={e => setPackageName(e.target.value)}
                placeholder="เช่น แพ็ก Banner A"
                className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm font-medium h-10 focus-visible:ring-[#8C6239] focus-visible:ring-offset-0"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-[#EFE7DC] dark:border-[#2D2520] h-10 px-4 text-sm font-bold cursor-pointer">ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving} className={cn("text-white rounded-xl font-bold h-10 px-5 shadow-sm transition-all cursor-pointer", themeColor)}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-white" />}บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Log Timeline Dialog ──────────────────────────────────────────────────

interface EditLogDialogProps {
  contract: Contract;
  onClose: () => void;
}

function EditLogDialog({ contract, onClose }: EditLogDialogProps) {
  const logs = contract.edit_log ?? [];

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-[#8C6239]" />
            ประวัติการแก้ไขสัญญา
          </DialogTitle>
          <DialogDescription className="text-xs text-[#827160]">
            บันทึกการปรับปรุงข้อมูลของ สมาชิก ID: {contract.member_id}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-60 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">ไม่มีประวัติการแก้ไขข้อมูลสำหรับสัญญานี้</p>
          ) : (
            <div className="relative border-l border-[#EFE7DC] dark:border-[#382F28] ml-3.5 pl-6 space-y-4">
              {logs.map((log, index) => (
                <div key={index} className="relative">
                  <span className="absolute -left-[30px] top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#FAF5EE] dark:bg-[#201D1A] border border-[#8C6239]/40 text-[#8C6239] text-[9px] font-bold">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      {log.avatar ? (
                        <img src={log.avatar} alt={log.editor} className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-[#8C6239]/20 text-[#8C6239] flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
                          {log.editor.slice(0, 1)}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-[#4E3F30] dark:text-[#E8E1D9]">{log.editor}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatDateThai(log.timestamp, true)}</span>
                    </div>
                    <p className="text-[11px] text-[#827160] dark:text-[#A89889] bg-white dark:bg-[#221F1D] px-2.5 py-1.5 rounded-lg border border-[#F4EEE5] dark:border-[#302B27] mt-1 inline-block w-fit">
                      ทำรายการปรับปรุงรายละเอียดและบันทึกข้อมูลสัญญาใหม่
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={onClose} className="bg-[#8C6239] hover:bg-[#76522E] text-white rounded-xl w-full">
            ปิดหน้านี้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contract Card ────────────────────────────────────────────────────────────

interface ContractCardProps {
  contract: Contract;
  typeIcons: TypeIcons;
  memberProfiles: Record<string, { username: string; discord_username: string | null }>;
  onEdit: (c: Contract) => void;
  onRefresh: () => void;
  onShowLogs: (c: Contract) => void;
}

function ContractCard({ contract, typeIcons, memberProfiles, onEdit, onRefresh, onShowLogs }: ContractCardProps) {
  const { toast } = useToast();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await (supabase as any).from('contracts').delete().eq('id', contract.id);
    setDeleting(false);
    if (error) {
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'ลบสัญญาเรียบร้อยแล้ว' });
    setDeleteOpen(false);
    onRefresh();
  }

  const [roleTotal, setRoleTotal] = useState<number | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [discordRoleName, setDiscordRoleName] = useState<string | null>(contract.role_name);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (contract.type !== 'personal_role' && contract.type !== 'boost_role') return;

    async function fetchExtra() {
      setLoadingExtra(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const body: Record<string, string> = {};
        if (contract.discord_role_id) body.role_id = contract.discord_role_id;
        if (contract.room_link) body.channel_url = contract.room_link;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-role-members`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
            },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.total != null) setRoleTotal(data.total);
        if (data.channel_name) setChannelName(data.channel_name);
        if (data.role_name) {
          setDiscordRoleName(data.role_name);
          if (contract.role_name !== data.role_name) {
            (supabase as any)
              .from('contracts')
              .update({ role_name: data.role_name })
              .eq('id', contract.id)
              .then(() => {
                contract.role_name = data.role_name;
              });
          }
        }
      } catch { /* silent */ } finally {
        setLoadingExtra(false);
      }
    }
    fetchExtra();
  }, [contract.type, contract.discord_role_id, contract.room_link]);

  const [houseChannelName, setHouseChannelName] = useState<string | null>(null);
  const [loadingHouseChannel, setLoadingHouseChannel] = useState(false);

  useEffect(() => {
    if (contract.type !== 'house' || !contract.room_link) return;
    if (houseChannelName !== null) return;

    async function fetchHouseChannel() {
      setLoadingHouseChannel(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-role-members`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
            },
            body: JSON.stringify({ channel_url: contract.room_link }),
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.channel_name) setHouseChannelName(data.channel_name);
      } catch { /* silent */ } finally {
        setLoadingHouseChannel(false);
      }
    }
    fetchHouseChannel();
  }, [contract.type, contract.room_link]);

  const days = contract.end_at ? daysRemaining(contract.end_at) : null;

  const isExpired = days !== null && days <= 0;
  const isUrgent = days !== null && days <= 3 && !isExpired;
  const isWarning = days !== null && days <= 7 && !isExpired && !isUrgent;

  const hasEndAt = Boolean(contract.end_at);

  const cardBorder =
    !hasEndAt ? 'border-[#F4EEE5] dark:border-[#382F28]' :
      isExpired ? 'border-red-300 dark:border-red-900/60 shadow-red-50/30' :
        isUrgent ? 'border-rose-300 dark:border-rose-900/60 shadow-rose-50/30' :
          isWarning ? 'border-amber-300 dark:border-amber-900/60' :
            'border-[#F4EEE5] dark:border-[#382F28]';

  const cardBackground =
    !hasEndAt ? 'bg-white dark:bg-[#1E1B18]' :
      isExpired ? 'bg-red-50/20 dark:bg-red-950/20' :
        isUrgent ? 'bg-rose-50/25 dark:bg-rose-950/20' :
          isWarning ? 'bg-amber-50/20 dark:bg-amber-950/20' :
            'bg-white dark:bg-[#1E1B18]';

  const statusBadgeColor =
    !hasEndAt ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400' :
      isExpired ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 font-bold' :
        isUrgent ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 font-bold animate-pulse' :
          isWarning ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 font-semibold' :
            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400';

  const statusText =
    !hasEndAt ? 'ถาวร/ไม่กำหนด' :
      isExpired ? 'หมดอายุแล้ว' :
        isUrgent ? 'ใกล้หมดอายุ (วิกฤต)' :
          isWarning ? 'ใกล้หมดอายุ' :
            'ปกติ';

  const typeLabel = 
    contract.type === 'house' ? 'สัญญาเช่าบ้าน' : 
    contract.type === 'personal_role' ? 'สัญญายศส่วนตัว' : 
    contract.type === 'boost_role' ? 'สัญญายศบูสต์' :
    'สัญญาโฆษณา';

  const typeBadgeStyle =
    contract.type === 'house'
      ? 'bg-[#8B5E3C]/10 text-[#8B5E3C] border-[#8B5E3C]/20 dark:bg-[#36261A]/40 dark:text-[#B8956A]'
      : contract.type === 'personal_role'
        ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30 dark:bg-[#3A2208]/40 dark:text-[#E9A84E]'
        : contract.type === 'boost_role'
          ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300'
          : 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20 dark:bg-[#1E1B4B]/40 dark:text-[#A5B4FC]';

  const TypeIcon = typeIconsMap[contract.type as ContractType] || HelpCircle;
  const iconUrl = typeIcons[contract.type as ContractType];

  const profile = memberProfiles[contract.member_id];
  const discordName = profile?.discord_username ?? profile?.username ?? null;

  async function sendNotify() {
    if (!contract.end_at) return;
    setSending(true);
    const end_unix = Math.floor(new Date(contract.end_at).getTime() / 1000);
    try {
      const { error } = await supabase.functions.invoke('send-contract-notify', {
        body: {
          member_id: contract.member_id,
          end_unix,
          room_link: contract.room_link ?? '-',
        },
      });
      if (error) throw error;
      toast({ title: 'ส่งการแจ้งเตือนสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'ส่งไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false); setNotifyOpen(false);
    }
  }

  const startMs = new Date(contract.start_at).getTime();
  const endMs = contract.end_at ? new Date(contract.end_at).getTime() : 0;
  const nowMs = Date.now();
  let progressPercent = 0;
  if (contract.end_at && endMs > startMs) {
    progressPercent = Math.min(100, Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100));
  }

  const progressBarColor =
    isExpired ? 'bg-red-500' :
      isUrgent ? 'bg-rose-500' :
        isWarning ? 'bg-amber-500' :
          'bg-[#50A582]';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contract.member_id);
    toast({ title: 'คัดลอก Member ID แล้ว', description: contract.member_id });
  };

  return (
    <>
      <div className={cn(
        'group relative rounded-3xl border-2 p-5 flex flex-col justify-between gap-4 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] h-full',
        cardBorder,
        cardBackground
      )}>
        {/* Top Card Section: Icon, Badges, Member ID */}
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#FAF6F0] dark:bg-[#2C241E] flex items-center justify-center border border-[#F0E8DC] dark:border-[#42352B] relative overflow-hidden shadow-inner">
                {iconUrl ? (
                  <img src={iconUrl} alt={contract.type} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <TypeIcon className="w-5 h-5 text-[#827160] dark:text-[#A89889]" />
                )}
              </div>
              <div className="min-w-0">
                <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold mb-1', typeBadgeStyle)}>
                  {typeLabel}
                </Badge>
                {discordName ? (
                  <p className="text-xs font-bold text-foreground truncate max-w-[150px]">@{discordName}</p>
                ) : (
                  <p className="text-xs font-bold text-muted-foreground italic">ผู้ใช้ท่านนี้ยังไม่ได้ล็อคอิน</p>
                )}
              </div>
            </div>

            <Badge className={cn('text-[10px] font-bold px-2.5 py-0.5 border rounded-full shrink-0 shadow-sm', statusBadgeColor)}>
              {statusText}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#FAF5EE] dark:bg-[#2B231D] px-3 py-1.5 rounded-xl border border-[#EFE7DC] dark:border-[#3E3229]">
            <span className="font-mono font-bold text-xs text-[#8C6239] dark:text-[#B8956A] truncate">
              ID: {contract.member_id}
            </span>
            <button
              onClick={copyToClipboard}
              title="คัดลอก Member ID"
              className="text-muted-foreground hover:text-[#8C6239] transition-colors p-1 cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Details based on contract type */}
          <div className="space-y-2 text-xs pt-1">
            {contract.type === 'ad' && contract.package_name && (
              <Badge variant="secondary" className="bg-[#FAF5EE] dark:bg-[#25201C] text-[#6366F1] dark:text-[#A5B4FC] border border-[#6366F1]/20 text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 shadow-sm w-fit">
                <Megaphone className="w-3.5 h-3.5 text-[#6366F1]" />
                {contract.package_name}
              </Badge>
            )}

            {(contract.type === 'personal_role' || contract.type === 'boost_role') && (
              <div className="flex items-center gap-2 flex-wrap">
                {(discordRoleName || contract.role_name) && (
                  <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs px-2.5 py-1 rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {discordRoleName || contract.role_name}
                  </Badge>
                )}

                {roleTotal !== null && (
                  <span className={cn(
                    'text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border',
                    roleTotal > 5
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  )}>
                    <Users className="w-3 h-3 shrink-0" />
                    <span>{roleTotal} / 5 คน</span>
                  </span>
                )}
              </div>
            )}

            {contract.room_link && (
              <a
                href={contract.room_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#25201C] text-[#8B5E3C] dark:text-[#D4B28C] border border-[#EFE8DD] dark:border-[#382F28] hover:bg-[#8B5E3C]/10 transition-all font-bold shadow-sm w-fit truncate max-w-full"
              >
                <Link className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{houseChannelName ?? channelName ?? 'ดูช่อง Discord'}</span>
              </a>
            )}

            {/* Date range display */}
            <div className="space-y-1 text-muted-foreground text-[11px] font-medium pt-1 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#8C6239]" /> เริ่มต้น:</span>
                <span className="font-semibold text-foreground">{formatDateThai(contract.start_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#8C6239]" /> สิ้นสุด:</span>
                <span className="font-semibold text-foreground">{contract.end_at ? formatDateThai(contract.end_at) : 'ถาวร/ไม่กำหนด'}</span>
              </div>
            </div>

            {/* Remaining time countdown & progress bar */}
            {contract.end_at && (
              <div className="space-y-1.5 pt-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-amber-500" /> เวลาคงเหลือ:
                  </span>
                  <span className={cn('font-bold text-xs', isExpired ? 'text-red-500' : 'text-[#827160] dark:text-[#C5B4A5]')}>
                    {formatRemaining(contract.end_at)}
                  </span>
                </div>
                <div className="w-full bg-[#EFE8DD] dark:bg-[#302720] h-1.5 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={cn('h-full transition-all duration-500 rounded-full', progressBarColor)}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="space-y-2 pt-2 border-t border-[#F4EEE5] dark:border-[#2D2520]">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>ผู้บันทึก: <strong className="text-foreground">{contract.operator_name ?? '—'}</strong></span>
            {contract.edit_log && contract.edit_log.length > 0 && (
              <button
                onClick={() => onShowLogs(contract)}
                className="flex items-center gap-1 text-[#8C6239] dark:text-[#B8956A] hover:underline font-bold"
              >
                <History className="w-3 h-3" />
                ประวัติ ({contract.edit_log.length})
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {contract.end_at && days !== null && days <= 3 && days > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 border-rose-300 hover:bg-rose-50 text-rose-600 text-[11px] rounded-lg shadow-sm cursor-pointer"
                disabled={sending}
                onClick={() => setNotifyOpen(true)}
              >
                <Bell className={cn('w-3 h-3 text-rose-500', sending && 'animate-spin')} />
                แจ้งเตือน
              </Button>
            ) : <div />}

            <div className="flex items-center gap-1 bg-[#FAF5EE] dark:bg-[#25201C] p-0.5 rounded-xl border border-[#EFE8DD] dark:border-[#382F28]">
              <Button size="icon" variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-[#8C6239] hover:bg-white dark:hover:bg-[#1E1B18] rounded-lg cursor-pointer"
                onClick={() => onEdit(contract)}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-white dark:hover:bg-[#1E1B18] rounded-lg cursor-pointer"
                onClick={() => setDeleteOpen(true)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการลบสัญญา
            </DialogTitle>
            <DialogDescription className="text-xs">
              การลบไม่สามารถย้อนกลับรายการได้
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            คุณแน่ใจหรือไม่ว่าต้องการลบสัญญาเช่า <span className="font-bold text-foreground">{typeLabel}</span> ของ สมาชิก ID: <span className="font-mono text-foreground">{contract.member_id}</span>?
            <br />
            <span className="text-red-500 font-medium">คำเตือน: ข้อมูลและประวัติสัญญาจะถูกลบออกจากฐานข้อมูลทันที</span>
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting} className="rounded-xl border-[#EFE7DC]">ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl">
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify confirm dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-sm bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#4E3F30] flex items-center gap-2">
              <Bell className="w-4.5 h-4.5 text-rose-500" />
              ยืนยันการส่งข้อความแจ้งเตือน
            </DialogTitle>
            <DialogDescription className="text-xs" />
          </DialogHeader>
          <p className="text-xs text-[#827160] leading-relaxed">
            ระบบจะส่งข้อความแจ้งเตือนสัญญาเช่าบ้านใกล้หมดอายุไปยัง สมาชิก ID: <span className="font-mono font-semibold">{contract.member_id}</span> ผ่านระบบแจ้งเตือนของ Discord
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setNotifyOpen(false)} className="rounded-xl border-[#EFE7DC]">ยกเลิก</Button>
            <Button onClick={sendNotify} disabled={sending} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl">
              {sending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ส่งข้อความทันที
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;

export function ContractsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [selectedLogContract, setSelectedLogContract] = useState<Contract | null>(null);

  const [typeIcons, setTypeIcons] = useState<TypeIcons>({ house: null, personal_role: null });
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { username: string; discord_username: string | null }>>({});

  // Filters state
  const [searchMember, setSearchMember] = useState('');
  const [searchOperator, setSearchOperator] = useState('');
  const [filterType, setFilterType] = useState<ContractType | 'all' | 'urgent'>('all');
  const [page, setPage] = useState(1);

  // Load stored icon URLs from storage
  useEffect(() => {
    const types: ContractType[] = ['house', 'personal_role'];
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    const result: TypeIcons = { house: null, personal_role: null };

    for (const type of types) {
      for (const ext of exts) {
        const { data } = supabase.storage
          .from('contract-icons')
          .getPublicUrl(`type-icons/${type}.${ext}`);
        if (data?.publicUrl) {
          result[type] = data.publicUrl;
          break;
        }
      }
    }
    setTypeIcons(result);
  }, []);

  async function fetchMemberProfiles(memberIds: string[]) {
    if (memberIds.length === 0) return;
    const map: Record<string, { username: string; discord_username: string | null }> = {};
    const chunkSize = 150;
    for (let i = 0; i < memberIds.length; i += chunkSize) {
      const chunk = memberIds.slice(i, i + chunkSize);
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('discord_id, username, discord_username')
        .in('discord_id', chunk);
      if (error || !data) continue;
      for (const p of data) {
        map[p.discord_id] = { username: p.username, discord_username: p.discord_username ?? null };
      }
    }
    setMemberProfiles(map);
  }

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'โหลดข้อมูลไม่สำเร็จ', description: error.message, variant: 'destructive' });
      return;
    }
    // FILTER OUT LEGACY 'role' TYPE CONTRACTS
    const list: Contract[] = (data ?? []).filter((c: any) => c.type !== 'role');
    setContracts(list);
    const memberIds = [...new Set(list.map(c => c.member_id))];
    fetchMemberProfiles(memberIds);
  }, [toast]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchMember, searchOperator, filterType]);

  const filtered = contracts.filter(c => {
    // Quick filter check
    if (filterType === 'urgent') {
      if (!c.end_at) return false;
      const days = daysRemaining(c.end_at);
      if (days > 3) return false;
    } else if (filterType !== 'all' && c.type !== filterType) {
      return false;
    }

    // Enhanced Search: Member ID, Discord Username, Role Name, Package Name, Room Link
    if (searchMember.trim()) {
      const q = searchMember.trim().toLowerCase();
      const memberIdMatch = c.member_id.toLowerCase().includes(q);
      const profile = memberProfiles[c.member_id];
      const usernameMatch = Boolean(
        profile?.username?.toLowerCase().includes(q) ||
        profile?.discord_username?.toLowerCase().includes(q)
      );
      const roleNameMatch = Boolean((c.role_name ?? '').toLowerCase().includes(q));
      const packageNameMatch = Boolean((c.package_name ?? '').toLowerCase().includes(q));
      const roomLinkMatch = Boolean((c.room_link ?? '').toLowerCase().includes(q));

      if (!memberIdMatch && !usernameMatch && !roleNameMatch && !packageNameMatch && !roomLinkMatch) {
        return false;
      }
    }

    // Search by Operator name
    if (searchOperator && !(c.operator_name ?? '').toLowerCase().includes(searchOperator.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchMember(''); setSearchOperator('');
    setFilterType('all');
  };

  const hasFilter = searchMember || searchOperator || filterType !== 'all';

  function handleIconUploaded(type: ContractType, url: string) {
    setTypeIcons(prev => ({ ...prev, [type]: url || null }));
  }

  // Derived stats
  const countByType = {
    house: contracts.filter(c => c.type === 'house').length,
    personal_role: contracts.filter(c => c.type === 'personal_role').length,
    boost_role: contracts.filter(c => c.type === 'boost_role').length,
    ad: contracts.filter(c => c.type === 'ad').length,
  };
  const urgentCount = contracts.filter(c => {
    if (!c.end_at) return false;
    return daysRemaining(c.end_at) <= 3;
  }).length;

  return (
    <div className="space-y-5">
      {/* ── Header Banner Card (Cozy Bear Cafe Style) ── */}
      <div className="rounded-3xl bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] p-6 shadow-sm hover:shadow transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
              <span className="text-xl">📜</span>
              ระบบจัดการสัญญาเช่า
            </h2>
            <p className="text-xs text-[#827160] dark:text-[#A89889]">
              ลงทะเบียน ดูแล และบันทึกสัญญาเช่าบ้าน สัญญายศส่วนตัว ยศบูสต์ และโฆษณา
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto">
            {user?.is_owner && (
              <IconUpload typeIcons={typeIcons} onUploaded={handleIconUploaded} />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchContracts}
              disabled={loading}
              className="gap-1.5 h-9 rounded-xl border-[#EFE7DC] text-[#827160] cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              รีเฟรช
            </Button>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 h-9 rounded-xl bg-[#8C6239] hover:bg-[#74502D] text-white font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              เพิ่มสัญญาใหม่
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Panel (Interactive Quick Filters) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { key: 'all', label: 'สัญญาทั้งหมด', count: contracts.length, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#8C6239] bg-[#8C6239]/5 text-[#8C6239]', icon: Home },
          { key: 'house', label: 'สัญญาเช่าบ้าน', count: countByType.house, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#8B5E3C] bg-[#8B5E3C]/5 text-[#8B5E3C]', icon: Home },
          { key: 'personal_role', label: 'สัญญายศส่วนตัว', count: countByType.personal_role, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#D97706] bg-[#D97706]/5 text-[#D97706]', icon: Star },
          { key: 'boost_role', label: 'สัญญายศบูสต์', count: countByType.boost_role, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-purple-500 bg-purple-500/5 text-purple-600', icon: Rocket },
          { key: 'ad', label: 'สัญญาโฆษณา', count: countByType.ad, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#6366F1] bg-[#6366F1]/5 text-[#6366F1]', icon: Megaphone },
          { key: 'urgent', label: 'ใกล้หมดอายุ/หมดอายุ', count: urgentCount, color: 'bg-white dark:bg-[#1E1B18] text-[#C23B51] dark:text-red-400 border-[#F4EEE5] dark:border-[#2D2520] hover:border-red-200', activeBg: 'border-red-500 bg-red-500/5 text-red-600', icon: AlertTriangle },
        ] as const).map(({ key, label, count, color, activeBg, icon: IconComponent }) => {
          const isActive = filterType === key;
          return (
            <button
              key={key}
              onClick={() => { setFilterType(key); setPage(1); }}
              className={cn(
                'rounded-2xl p-3.5 text-left transition-all border-2 flex flex-col gap-2 relative overflow-hidden shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-200 cursor-pointer',
                isActive ? activeBg : color
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold tracking-tight opacity-75">{label}</span>
                <IconComponent className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </div>
              <p className="text-xl font-bold leading-none tracking-tight">{count}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filters Bar ── */}
      <div className="rounded-2xl bg-[#FAF6F0]/60 dark:bg-[#25201C]/40 p-4 border border-[#F0E8DC] dark:border-[#382F28] flex flex-wrap items-center gap-3">
        {/* Search member & details */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#3A322C] rounded-xl focus-visible:ring-[#8C6239]"
            placeholder="ค้นหา ID, ชื่อผู้ใช้, ยศ, แพ็กเกจ..."
            value={searchMember}
            onChange={e => setSearchMember(e.target.value)}
          />
          {searchMember && (
            <button onClick={() => setSearchMember('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search operator */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#3A322C] rounded-xl focus-visible:ring-[#8C6239]"
            placeholder="ค้นหาผู้ดำเนินการ..."
            value={searchOperator}
            onChange={e => setSearchOperator(e.target.value)}
          />
          {searchOperator && (
            <button onClick={() => setSearchOperator('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Clear all */}
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="text-xs font-semibold text-[#8C6239] hover:underline flex items-center gap-1 transition-colors px-2 py-1 rounded-md cursor-pointer"
          >
            <X className="w-3 h-3" />ล้างตัวกรองทั้งหมด
          </button>
        )}

        {/* Result count */}
        <span className="text-xs text-muted-foreground ml-auto font-medium">
          ผลลัพธ์: {filtered.length} รายการ
        </span>
      </div>

      {/* ── Main List Panel (Responsive Compact Grid) ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#8C6239]" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1E1B18] rounded-3xl border border-[#F4EEE5] text-muted-foreground text-xs font-semibold">
          ไม่พบข้อมูลสัญญาที่ค้นหา
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              typeIcons={typeIcons}
              memberProfiles={memberProfiles}
              onEdit={setEditTarget}
              onRefresh={fetchContracts}
              onShowLogs={setSelectedLogContract}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-[#F4EEE5] dark:border-[#2D2520]">
          <p className="text-xs text-muted-foreground">
            หน้า <span className="font-semibold text-foreground">{page}</span> / {totalPages}
            <span className="ml-2 text-muted-foreground/60">({filtered.length} รายการ)</span>
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1} className="h-8 px-2.5 text-xs rounded-xl border-[#EFE7DC]">«</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="h-8 px-2.5 text-xs rounded-xl border-[#EFE7DC]">ก่อนหน้า</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-8 px-2.5 text-xs rounded-xl border-[#EFE7DC]">ถัดไป</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="h-8 px-2.5 text-xs rounded-xl border-[#EFE7DC]">»</Button>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); fetchContracts(); }}
        operatorId={user?.id ?? ''}
        operatorName={user?.username ?? ''}
      />

      {/* Edit Dialog */}
      {editTarget && (
        <EditDialog
          contract={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchContracts(); }}
          operatorName={user?.username ?? ''}
          operatorAvatar={user?.avatar_url ?? null}
        />
      )}

      {/* Edit History Log Dialog */}
      {selectedLogContract && (
        <EditLogDialog
          contract={selectedLogContract}
          onClose={() => setSelectedLogContract(null)}
        />
      )}
    </div>
  );
}
