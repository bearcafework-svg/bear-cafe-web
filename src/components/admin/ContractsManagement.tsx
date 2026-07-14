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
  Plus, Home, User, Clock, Bell, Edit2, Search, RefreshCw,
  Loader2, CheckCircle2, X, Upload, Star, Link, Hash, Users, Calendar,
  AlertTriangle, Copy, History, HelpCircle, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContractType = 'house' | 'personal_role';

interface Contract {
  id: string;
  type: 'house' | 'personal_role' | 'role'; // Keep 'role' in interface to filter legacy records
  member_id: string;
  start_at: string;
  end_at: string | null;
  room_link: string | null;
  role_name: string | null;
  discord_role_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
  updated_at: string | null;
  edit_log: Array<{ editor: string; avatar: string | null; timestamp: string }> | null;
}

interface TypeIcons {
  house: string | null;
  personal_role: string | null;
}

const typeIconsMap: Record<ContractType, React.ComponentType<any>> = {
  house: Home,
  personal_role: Star,
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
  if (months > 0 && days > 0) return `เหลือ ${months} เดือน ${days} วัน`;
  if (months > 0) return `เหลือ ${months} เดือน`;
  if (days > 0 && hours > 0) return `เหลือ ${days} วัน ${hours} ชม.`;
  if (days > 0) return `เหลือ ${days} วัน`;
  return `เหลือ ${hours} ชม.`;
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
      {(['house', 'personal_role'] as ContractType[]).map(type => (
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
    if (open && type === 'personal_role' && discordRoles.length === 0) {
      fetchDiscordRoles();
    }
  }, [open, type]);

  const filteredDiscordRoles = discordRoles.filter(r =>
    !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  function reset() {
    setType('house'); setMemberId(''); setStartAt(''); setEndAt('');
    setRoomLink(''); setRoleSearch('');
    setSelectedDiscordRole(null);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!memberId.trim() || !startAt) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' }); return;
    }
    if (type === 'personal_role' && !selectedDiscordRole) {
      toast({ title: 'กรุณาเลือกยศ Discord', variant: 'destructive' }); return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      type,
      member_id: memberId.trim(),
      start_at: new Date(startAt).toISOString(),
      end_at: type === 'house' && endAt ? new Date(endAt).toISOString() : null,
      room_link: roomLink.trim() || null,
      role_name: type === 'personal_role' ? selectedDiscordRole?.name ?? null : null,
      discord_role_id: type === 'personal_role' ? selectedDiscordRole?.id ?? null : null,
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
      <DialogContent className="max-w-md bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#8C6239]" />
            เพิ่มสัญญาเช่าใหม่
          </DialogTitle>
          <DialogDescription className="text-xs text-[#827160] dark:text-[#A89889]">
            ระบุประเภทและรายละเอียดสัญญาเพื่อลงทะเบียนในระบบ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Selector for Contract Type */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('house')}
              className={cn(
                'flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center',
                type === 'house'
                  ? 'border-[#8C6239] bg-[#8C6239]/5 text-[#8C6239] shadow-sm'
                  : 'border-[#F4EEE5] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC]'
              )}
            >
              <Home className="w-6 h-6 shrink-0" />
              <span className="text-xs font-semibold">สัญญาเช่าบ้าน</span>
            </button>

            <button
              type="button"
              onClick={() => setType('personal_role')}
              className={cn(
                'flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center',
                type === 'personal_role'
                  ? 'border-[#D97706] bg-[#D97706]/5 text-[#D97706] shadow-sm'
                  : 'border-[#F4EEE5] bg-white dark:bg-[#201D1A] text-[#827160] hover:border-[#EFE7DC]'
              )}
            >
              <Star className="w-6 h-6 shrink-0" />
              <span className="text-xs font-semibold">สัญญายศส่วนตัว</span>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#827160]">Discord Member ID</Label>
              <Input
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                placeholder="ป้อน Discord User ID (ตัวเลข)"
                className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-9.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#827160]">วันที่เริ่มต้น</Label>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-9.5 text-sm"
                />
              </div>

              {type === 'house' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#827160]">วันที่สิ้นสุด</Label>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={e => setEndAt(e.target.value)}
                    className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-9.5 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Fields for House */}
            {type === 'house' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#827160]">Room Link (ช่อง Discord)</Label>
                <Input
                  value={roomLink}
                  onChange={e => setRoomLink(e.target.value)}
                  placeholder="https://discord.com/channels/..."
                  className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-9.5 text-sm"
                />
              </div>
            )}

            {/* Fields for Personal Role */}
            {type === 'personal_role' && (
              <div className="space-y-2.5 bg-[#FAF6F0] dark:bg-[#24201E] p-3 rounded-xl border border-[#F0E8DC] dark:border-[#3C322A]">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-[#827160]">เชื่อมโยงยศ Discord</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchDiscordRoles}
                    disabled={rolesLoading}
                    className="h-6.5 text-[10px] gap-1 px-2 border-[#DFD5C0] hover:bg-white text-[#827160]"
                  >
                    <RefreshCw className={cn('w-2.5 h-2.5', rolesLoading && 'animate-spin')} />
                    ซิงค์ยศจาก Discord
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-7.5 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC]"
                    placeholder="ค้นหาชื่อบทบาท/ยศ..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                  />
                </div>

                {rolesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8C6239]" />
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg border bg-white dark:bg-[#1E1B18] divide-y text-xs">
                    {filteredDiscordRoles.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {discordRoles.length === 0 ? 'กดปุ่มซิงค์ด้านบนเพื่อโหลดยศ' : 'ไม่พบยศที่ตรงกัน'}
                      </p>
                    ) : filteredDiscordRoles.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedDiscordRole(r)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors',
                          selectedDiscordRole?.id === r.id && 'bg-[#D97706]/10'
                        )}
                      >
                        {r.color ? (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <span className="truncate flex-1 font-medium">{r.name}</span>
                        {selectedDiscordRole?.id === r.id && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedDiscordRole && (
                  <div className="text-[11px] text-[#827160] flex items-center gap-1.5">
                    <span>ยศที่เลือก:</span>
                    <Badge className="bg-[#D97706]/15 hover:bg-[#D97706]/20 text-[#A66E2E] border-[#FAE3C1] font-semibold text-[10px] rounded-md px-1.5 py-0">
                      {selectedDiscordRole.name}
                    </Badge>
                  </div>
                )}

                <div className="space-y-1 mt-1">
                  <Label className="text-xs font-semibold text-[#827160]">Room Link (ช่อง Discord ส่วนตัว - ไม่บังคับ)</Label>
                  <Input
                    value={roomLink}
                    onChange={e => setRoomLink(e.target.value)}
                    placeholder="https://discord.com/channels/..."
                    className="bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#382F28] rounded-xl focus-visible:ring-[#8C6239] h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} className="rounded-xl border-[#EFE7DC]">ยกเลิก</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'rounded-xl text-white font-medium',
              type === 'house'
                ? 'bg-[#8C6239] hover:bg-[#76522E] text-white'
                : 'bg-[#D97706] hover:bg-[#B45F06] text-white'
            )}
          >
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin text-white" />}
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
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const newLog = [
      ...(contract.edit_log ?? []),
      { editor: operatorName, avatar: operatorAvatar, timestamp: new Date().toISOString() },
    ];
    const { error } = await (supabase as any).from('contracts').update({
      end_at: endAt ? new Date(endAt).toISOString() : null,
      room_link: roomLink.trim() || null,
      updated_at: new Date().toISOString(),
      edit_log: newLog,
    }).eq('id', contract.id);
    setSaving(false);
    if (error) { toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'แก้ไขสำเร็จ' });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#FDFAF7] dark:bg-[#1A1816] border-2 border-[#F4EEE5] dark:border-[#2D2520] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-[#8C6239]" />
            แก้ไขสัญญาเช่าบ้าน
          </DialogTitle>
          <DialogDescription className="text-xs text-[#827160]">
            สมาชิก ID: {contract.member_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#827160]">วันที่สิ้นสุดสัญญา</Label>
            <Input
              type="datetime-local"
              value={endAt}
              onChange={e => setEndAt(e.target.value)}
              className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm h-9.5"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#827160]">Room Link (ช่อง Discord)</Label>
            <Input
              value={roomLink}
              onChange={e => setRoomLink(e.target.value)}
              placeholder="https://discord.com/channels/..."
              className="bg-white dark:bg-[#221F1D] border-[#EFE7DC] dark:border-[#382F28] rounded-xl text-sm h-9.5"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-[#EFE7DC]">ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#8C6239] hover:bg-[#76522E] text-white rounded-xl">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}บันทึก
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
            <div className="relative border-l border-[#EFE7DC] dark:border-[#382F28] ml-3.5 pl-5.5 space-y-4">
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
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (contract.type !== 'personal_role') return;
    if (roleTotal !== null) return;

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

  const cardBorder =
    contract.type !== 'house' ? 'border-[#F4EEE5]' :
      isExpired ? 'border-red-200 shadow-red-50/20' :
        isUrgent ? 'border-rose-200 shadow-rose-50/20' :
          isWarning ? 'border-amber-200' :
            'border-[#F4EEE5]';

  const cardBackground =
    contract.type !== 'house' ? 'bg-white dark:bg-[#1E1B18]' :
      isExpired ? 'bg-red-50/10 dark:bg-red-950/5' :
        isUrgent ? 'bg-rose-50/15 dark:bg-rose-950/5' :
          isWarning ? 'bg-amber-50/10 dark:bg-amber-950/5' :
            'bg-white dark:bg-[#1E1B18]';

  const statusBadgeColor =
    contract.type !== 'house' ? 'bg-[#50A582]/10 text-[#50A582] border-[#50A582]/20' :
      isExpired ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400' :
        isUrgent ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 animate-pulse' :
          isWarning ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-[#3E2E16] dark:text-amber-400' :
            'bg-[#50A582]/10 text-[#50A582] border-[#50A582]/20';

  const statusText =
    contract.type !== 'house' ? 'ปกติ' :
      isExpired ? 'หมดอายุแล้ว' :
        isUrgent ? 'ใกล้หมดอายุ (วิกฤต)' :
          isWarning ? 'ใกล้หมดอายุ' :
            'ปกติ';

  const typeLabel = contract.type === 'house' ? 'สัญญาเช่าบ้าน' : 'สัญญายศส่วนตัว';

  const typeBadgeStyle =
    contract.type === 'house'
      ? 'bg-[#8B5E3C]/10 text-[#8B5E3C] border-[#8B5E3C]/20 dark:bg-[#36261A]/40 dark:text-[#B8956A]'
      : 'bg-[#D97706]/10 text-[#A66E2E] border-[#FAE3C1] dark:bg-[#3A2208]/30 dark:text-[#E9A84E]';

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
  if (contract.type === 'house' && endMs > startMs) {
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
        'group relative rounded-2xl border-2 p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.002]',
        cardBorder,
        cardBackground
      )}>
        {/* Left Side: Avatar + Details */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#FAF6F0] dark:bg-[#2C241E] flex items-center justify-center border border-[#F0E8DC] dark:border-[#42352B] relative overflow-hidden">
            {iconUrl ? (
              <img src={iconUrl} alt={contract.type} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <TypeIcon className="w-5.5 h-5.5 text-[#827160] dark:text-[#A89889]" />
            )}
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            {/* Top row: Badges, ID, Copy button */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xs bg-[#FAF5EE] dark:bg-[#2B231D] px-2 py-0.5 rounded-lg text-[#8C6239] dark:text-[#B8956A] border border-[#EFE7DC] dark:border-[#3E3229] flex items-center gap-1">
                {contract.member_id}
                <button
                  onClick={copyToClipboard}
                  title="คัดลอก Member ID"
                  className="text-muted-foreground hover:text-[#8C6239] transition-colors p-0.5 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </span>
              {discordName && (
                <span className="text-xs font-semibold text-[#827160] dark:text-[#A89889]">@{discordName}</span>
              )}
              <Badge variant="outline" className={cn('text-[10px] px-2 rounded-full font-medium', typeBadgeStyle)}>
                {typeLabel}
              </Badge>
            </div>

            {/* Middle Row: Details depending on type */}
            {contract.type === 'house' && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {contract.room_link ? (
                    <a
                      href={contract.room_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#25201C] text-[#8B5E3C] border border-[#EFE8DD] dark:border-[#382F28] hover:bg-[#8B5E3C]/5 transition-colors font-semibold"
                    >
                      <Link className="w-3.5 h-3.5 shrink-0" />
                      {loadingHouseChannel ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>{houseChannelName ?? 'ดูห้องในเซิร์ฟเวอร์'}</span>
                      )}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">ไม่มีลิ้งก์ห้อง</span>
                  )}

                  {/* Date range display */}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDateThai(contract.start_at)}</span>
                    <ArrowRight className="w-3 h-3 mx-0.5" />
                    <span>{contract.end_at ? formatDateThai(contract.end_at) : 'ไม่ระบุ'}</span>
                  </span>
                </div>

                {/* Cozy Lease Timeline Progress Bar */}
                {contract.end_at && (
                  <div className="space-y-1 max-w-md pt-0.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground">ระยะเวลาสัญญาเช่า</span>
                      <span className="font-semibold text-[#827160]">
                        {isExpired ? 'หมดอายุสัญญาแล้ว' : `${Math.round(progressPercent)}% ผ่านไป`}
                      </span>
                    </div>
                    <div className="w-full bg-[#EFE8DD] dark:bg-[#302720] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full transition-all duration-500 rounded-full', progressBarColor)}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {contract.type === 'personal_role' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {contract.role_name && (
                    <Badge variant="secondary" className="bg-[#FAF5EE] dark:bg-[#25201C] text-[#4E3F30] dark:text-[#E8E1D9] border border-[#EFE8DD] dark:border-[#382F28] text-xs px-2.5 py-0.5 rounded-xl font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 text-[#D97706] fill-[#D97706]" />
                      {contract.role_name}
                    </Badge>
                  )}

                  {contract.room_link && (
                    <a
                      href={contract.room_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs bg-[#FAF5EE] dark:bg-[#25201C] text-[#8B5E3C] border border-[#EFE8DD] dark:border-[#382F28] hover:bg-[#8B5E3C]/5 transition-colors font-semibold"
                    >
                      <Hash className="w-3.5 h-3.5 shrink-0" />
                      {loadingExtra ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>{channelName ?? 'ดูห้อง'}</span>
                      )}
                    </a>
                  )}

                  {loadingExtra && roleTotal === null ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />โหลดจำนวนคน...
                    </span>
                  ) : roleTotal !== null ? (
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border',
                      roleTotal > 5
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20'
                    )}>
                      <Users className="w-3 h-3 shrink-0" />
                      <span>{roleTotal} / 5 คน</span>
                      {roleTotal > 5 && <span className="animate-pulse">(เกินสิทธิ์!)</span>}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>เริ่มเมื่อ: {formatDateThai(contract.start_at)}</span>
                  <span>•</span>
                  <span>{formatElapsed(contract.start_at)}</span>
                </div>
              </div>
            )}

            {/* Operator and Edit history triggers */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap pt-0.5">
              <span>ลงทะเบียนโดย: <span className="font-semibold text-foreground">{contract.operator_name ?? '—'}</span></span>
              {contract.edit_log && contract.edit_log.length > 0 && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onShowLogs(contract)}
                    className="flex items-center gap-1 text-[#8C6239] hover:underline cursor-pointer font-medium"
                  >
                    <History className="w-3.5 h-3.5" />
                    ประวัติการแก้ไข ({contract.edit_log.length})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Status & Action triggers */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-[#F4EEE5] dark:border-[#2D2520] shrink-0">
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <Badge className={cn('text-[10px] font-bold px-2.5 py-0.5 border rounded-full', statusBadgeColor)}>
              {statusText}
            </Badge>

            {contract.type === 'house' && contract.end_at && (
              <span className={cn(
                'text-xs font-semibold',
                isExpired ? 'text-red-500' :
                  isUrgent ? 'text-rose-500' :
                    isWarning ? 'text-amber-500' :
                      'text-muted-foreground'
              )}>
                {formatRemaining(contract.end_at)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Notify Trigger */}
            {contract.type === 'house' && days !== null && days <= 3 && days > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 gap-1.5 border-rose-300 hover:bg-rose-50 text-rose-600 text-xs rounded-xl shadow-sm cursor-pointer"
                disabled={sending}
                onClick={() => setNotifyOpen(true)}
              >
                <Bell className={cn('w-3.5 h-3.5 text-rose-500', sending && 'animate-spin')} />
                ส่งแจ้งเตือน
              </Button>
            )}

            <div className="flex items-center gap-1 bg-[#FAF5EE] dark:bg-[#25201C] p-1 rounded-xl border border-[#EFE8DD] dark:border-[#382F28]">
              {contract.type === 'house' && (
                <Button size="icon" variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-[#8C6239] hover:bg-white dark:hover:bg-[#1E1B18] rounded-lg cursor-pointer"
                  onClick={() => onEdit(contract)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-white dark:hover:bg-[#1E1B18] rounded-lg cursor-pointer"
                onClick={() => setDeleteOpen(true)}>
                <X className="w-4 h-4" />
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
      if (c.type !== 'house') return false;
      if (!c.end_at) return false;
      const days = daysRemaining(c.end_at);
      if (days > 3) return false;
    } else if (filterType !== 'all' && c.type !== filterType) {
      return false;
    }

    // Search by Member ID or discord name
    if (searchMember) {
      const memberIdMatch = c.member_id.toLowerCase().includes(searchMember.toLowerCase());
      const profile = memberProfiles[c.member_id];
      const usernameMatch = profile?.username?.toLowerCase().includes(searchMember.toLowerCase()) ||
        profile?.discord_username?.toLowerCase().includes(searchMember.toLowerCase());
      if (!memberIdMatch && !usernameMatch) return false;
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
    ad: contracts.filter(c => c.type === 'ad').length,
  };
  const urgentCount = contracts.filter(c => {
    if (c.type !== 'house' || !c.end_at) return false;
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
              ลงทะเบียน ดูแล และบันทึกสัญญาเช่าบ้านและสัญญายศส่วนตัวของคอมมูนิตี้
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {([
          { key: 'all', label: 'สัญญาทั้งหมด', count: contracts.length, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#8C6239] bg-[#8C6239]/5 text-[#8C6239]', icon: Home },
          { key: 'house', label: 'สัญญาเช่าบ้าน', count: countByType.house, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#8B5E3C] bg-[#8B5E3C]/5 text-[#8B5E3C]', icon: Home },
          { key: 'personal_role', label: 'สัญญายศส่วนตัว', count: countByType.personal_role, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#D97706] bg-[#D97706]/5 text-[#D97706]', icon: Star },
          { key: 'ad', label: 'สัญญาโฆษณา', count: countByType.ad, color: 'bg-white dark:bg-[#1E1B18] text-[#4E3F30] dark:text-[#E8E1D9] border-[#F4EEE5] dark:border-[#2D2520] hover:border-[#DFD5C0]', activeBg: 'border-[#6366F1] bg-[#6366F1]/5 text-[#6366F1]', icon: Megaphone },
          { key: 'urgent', label: 'ใกล้หมดอายุ/หมดอายุ', count: urgentCount, color: 'bg-white dark:bg-[#1E1B18] text-[#C23B51] dark:text-red-400 border-[#F4EEE5] dark:border-[#2D2520] hover:border-red-200', activeBg: 'border-red-500 bg-red-500/5 text-red-600', icon: AlertTriangle },
        ] as const).map(({ key, label, count, color, activeBg, icon: IconComponent }) => {
          const isActive = filterType === key;
          return (
            <button
              key={key}
              onClick={() => { setFilterType(key); setPage(1); }}
              className={cn(
                'rounded-2xl p-4 text-left transition-all border-2 flex flex-col gap-2.5 relative overflow-hidden shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-200 cursor-pointer',
                isActive ? activeBg : color
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold tracking-tight opacity-75">{label}</span>
                <IconComponent className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </div>
              <p className="text-2xl font-bold leading-none tracking-tight">{count}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filters Bar ── */}
      <div className="rounded-2xl bg-[#FAF6F0]/60 dark:bg-[#25201C]/40 p-4 border border-[#F0E8DC] dark:border-[#382F28] flex flex-wrap items-center gap-3">
        {/* Search member */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8.5 h-9 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#3A322C] rounded-xl focus-visible:ring-[#8C6239]"
            placeholder="ค้นหา Member ID หรือชื่อ..."
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
            className="pl-8.5 h-9 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#3A322C] rounded-xl focus-visible:ring-[#8C6239]"
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

      {/* ── Main List Panel ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#8C6239]" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1E1B18] rounded-3xl border border-[#F4EEE5] text-muted-foreground text-xs font-semibold">
          ไม่พบข้อมูลสัญญาที่ค้นหา
        </div>
      ) : (
        <div className="space-y-3">
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
