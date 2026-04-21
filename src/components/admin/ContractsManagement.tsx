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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Home, Crown, User, Clock, Bell, Edit2, Search, RefreshCw,
  Loader2, CheckCircle2, X, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContractType = 'house' | 'role' | 'personal_role';

interface Contract {
  id: string;
  type: ContractType;
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
  role: string | null;
  personal_role: string | null;
}

const ROLE_OPTIONS = [
  'ヽ 𝐂𝐨𝐨𝐤𝐢𝐞 (ยศพรีเมี่ยม 𝐒) 𓂃 🍪',
  'ヽ 𝐌𝐚𝐜𝐚𝐫𝐨𝐧 (ยศพรีเมี่ยม 𝐀) 𓂃 🥯',
  'ヽ 𝐂𝐡𝐨𝐜 𝐓𝐫𝐮𝐟𝐟𝐥𝐞 (ยศพรีเมี่ยม 𝐁) 𓂃 🍫',
  'ヽ 𝐂𝐡𝐞𝐞𝐬𝐞𝐜𝐚𝐤𝐞 (ยศพรีเมี่ยม 𝐂) 𓂃 🍰',
  'ヽ 𝐃𝐨𝐧𝐮𝐭 (ยศพรีเมี่ยม 𝐃) 𓂃 🍩',
  'ヽ 𝐈𝐜𝐞 𝐜𝐫𝐞𝐚𝐦 (ยศพรีเมี่ยม 𝐄) 𓂃 🍦',
];

const WEBHOOK_URL =
  'https://discord.com/api/webhooks/1495041976918216734/zAedA8Zt1UXz7JttAggKoSsHWiaI8npV9KDacXaMYKeHYcj4nxEbRrEZxUePWagRV9NK';

function formatRemaining(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'หมดอายุแล้ว';
  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = totalHours % 24;
  if (months > 0 && days > 0) return `สัญญาคงเหลือ ${months} เดือน ${days} วัน`;
  if (months > 0) return `สัญญาคงเหลือ ${months} เดือน`;
  if (days > 0 && hours > 0) return `สัญญาคงเหลือ ${days} วัน ${hours} ชั่วโมง`;
  if (days > 0) return `สัญญาคงเหลือ ${days} วัน`;
  return `สัญญาคงเหลือ ${hours} ชั่วโมง`;
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
  if (days > 0 && hours > 0) return `สร้างมาแล้ว ${days} วัน ${hours} ชั่วโมง`;
  if (days > 0) return `สร้างมาแล้ว ${days} วัน`;
  return `สร้างมาแล้ว ${hours} ชั่วโมง`;
}

function daysRemaining(endAt: string) {
  return (new Date(endAt).getTime() - Date.now()) / 86400000;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  const typeEmoji: Record<ContractType, string> = {
    house: '🏠',
    role: '👑',
    personal_role: '⭐',
  };

  const typeLabel: Record<ContractType, string> = {
    house: 'บ้าน',
    role: 'ยศ',
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
      // ลบไฟล์เก่าทุก extension ก่อน (ไม่สนใจ error ถ้าไม่มีไฟล์)
      const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      await Promise.allSettled(
        exts.map(oldExt =>
          supabase.storage.from('contract-icons').remove([`type-icons/${type}.${oldExt}`])
        )
      );

      // Upload ไฟล์ใหม่
      const { error: upErr } = await supabase.storage
        .from('contract-icons')
        .upload(`type-icons/${type}.${ext}`, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage
        .from('contract-icons')
        .getPublicUrl(`type-icons/${type}.${ext}`);

      // เพิ่ม cache-bust เพื่อให้ browser โหลดรูปใหม่
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
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">ไอคอนประเภท:</span>
      {(['house', 'role', 'personal_role'] as ContractType[]).map(type => (
        <div key={type} className="relative group">
          <button
            onClick={() => handleClick(type)}
            title={`อัปโหลดไอคอน ${typeLabel[type]}`}
            className="relative w-9 h-9 rounded-md border border-dashed border-border hover:border-primary/60 bg-muted/40 hover:bg-muted/70 transition-colors flex items-center justify-center overflow-hidden"
          >
            {uploading === type ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : typeIcons[type] ? (
              <img src={typeIcons[type]!} alt={type} className="w-full h-full object-cover rounded-md" />
            ) : (
              <span className="text-base">{typeEmoji[type]}</span>
            )}
            <span className="absolute bottom-0 right-0 bg-background/80 rounded-tl p-0.5">
              <Upload className="w-2.5 h-2.5 text-muted-foreground" />
            </span>
          </button>
          {/* ปุ่มลบ — แสดงเมื่อมีรูปอยู่ */}
          {typeIcons[type] && (
            <button
              onClick={() => handleDelete(type)}
              title={`ลบไอคอน ${typeLabel[type]}`}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="w-2.5 h-2.5" />
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

// ─── Add Dialog ──────────────────────────────────────────────────────────────

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
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<ContractType>('house');
  const [saving, setSaving] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [roleName, setRoleName] = useState('');

  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedDiscordRole, setSelectedDiscordRole] = useState<DiscordRole | null>(null);

  async function fetchDiscordRoles() {
    setRolesLoading(true);
    try {
      // Refresh session to ensure token is valid
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
    if (open && type === 'personal_role' && step === 2 && discordRoles.length === 0) {
      fetchDiscordRoles();
    }
  }, [open, type, step]);

  const filteredDiscordRoles = discordRoles.filter(r =>
    !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  function reset() {
    setStep(1); setMemberId(''); setStartAt(''); setEndAt('');
    setRoomLink(''); setRoleName(''); setRoleSearch('');
    setSelectedDiscordRole(null);
  }

  function handleClose() { reset(); onClose(); }

  function computedEndAt() {
    if (type === 'role' && startAt) {
      return new Date(new Date(startAt).getTime() + 3 * 86400000).toISOString();
    }
    return endAt ? new Date(endAt).toISOString() : null;
  }

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
      end_at: computedEndAt(),
      room_link: type === 'house' ? roomLink.trim() || null : null,
      role_name: type === 'role' ? roleName || null
        : type === 'personal_role' ? selectedDiscordRole?.name ?? null : null,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มสัญญาเช่า</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">เลือกประเภทสัญญา</p>
            {([
              { t: 'house', label: 'สัญญาเช่าบ้าน', icon: <Home className="w-5 h-5" /> },
              { t: 'role', label: 'สัญญาเช่ายศ', icon: <Crown className="w-5 h-5" /> },
              { t: 'personal_role', label: 'สัญญายศส่วนตัว', icon: <User className="w-5 h-5" /> },
            ] as const).map(({ t, label, icon }) => (
              <button
                key={t}
                onClick={() => { setType(t); setStep(2); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
              >
                {icon}
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Member ID</Label>
              <Input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder="Discord user ID" />
            </div>
            <div className="space-y-1">
              <Label>วันที่เริ่ม</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </div>
            {type === 'house' && (
              <>
                <div className="space-y-1">
                  <Label>วันที่สิ้นสุด</Label>
                  <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Room Link</Label>
                  <Input value={roomLink} onChange={e => setRoomLink(e.target.value)} placeholder="https://discord.com/channels/..." />
                </div>
              </>
            )}
            {type === 'role' && (
              <div className="space-y-1">
                <Label>ยศ</Label>
                <Select value={roleName} onValueChange={setRoleName}>
                  <SelectTrigger><SelectValue placeholder="เลือกยศ" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {startAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    สิ้นสุด: {new Date(new Date(startAt).getTime() + 3 * 86400000).toLocaleString('th-TH')}
                  </p>
                )}
              </div>
            )}
            {type === 'personal_role' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ยศ Discord</Label>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={fetchDiscordRoles} disabled={rolesLoading}
                    className="h-7 text-xs gap-1"
                  >
                    <RefreshCw className={cn('w-3 h-3', rolesLoading && 'animate-spin')} />
                    ซิงค์ยศ
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="ค้นหาชื่อบทบาท..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                  />
                </div>
                {rolesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                    {filteredDiscordRoles.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {discordRoles.length === 0 ? 'กดซิงค์เพื่อโหลดยศ' : 'ไม่พบยศที่ค้นหา'}
                      </p>
                    ) : filteredDiscordRoles.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedDiscordRole(r)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                          selectedDiscordRole?.id === r.id && 'bg-primary/10'
                        )}
                      >
                        {r.color && (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        )}
                        <span className="truncate">{r.name}</span>
                        {selectedDiscordRole?.id === r.id && (
                          <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedDiscordRole && (
                  <p className="text-xs text-muted-foreground">
                    เลือก: <span className="font-medium text-foreground">{selectedDiscordRole.name}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>ย้อนกลับ</Button>}
          <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
          {step === 2 && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}บันทึก
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog (house only) ─────────────────────────────────────────────────

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
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>แก้ไขสัญญาเช่าบ้าน</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>วันที่สิ้นสุด</Label>
            <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Room Link</Label>
            <Input value={roomLink} onChange={e => setRoomLink(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}บันทึก
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
}

function ContractCard({ contract, typeIcons, memberProfiles, onEdit, onRefresh }: ContractCardProps) {
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
    toast({ title: 'ลบสัญญาแล้ว' });
    setDeleteOpen(false);
    onRefresh();
  }

  // personal_role: role members + channel name
  const [roleTotal, setRoleTotal] = useState<number | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Auto-fetch for personal_role cards — count only, no member list
  useEffect(() => {
    if (contract.type !== 'personal_role') return;
    if (roleTotal !== null) return; // already loaded

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
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
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

  // house: fetch channel name from room_link
  const [houseChannelName, setHouseChannelName] = useState<string | null>(null);
  const [loadingHouseChannel, setLoadingHouseChannel] = useState(false);

  useEffect(() => {
    if (contract.type !== 'house' || !contract.room_link) return;
    if (houseChannelName !== null) return; // already loaded

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
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
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

  const borderColor =
    contract.type !== 'house' ? 'border-border' :
    days === null ? 'border-border' :
    days <= 3 ? 'border-red-500' :
    days <= 7 ? 'border-orange-400' :
    'border-green-500';

  const statusText =
    contract.type !== 'house' ? null :
    days === null ? null :
    days <= 0 ? 'หมดอายุแล้ว' :
    days <= 3 ? 'สัญญาเช่าบ้านใกล้หมด (เร่งด่วน)' :
    days <= 7 ? 'สัญญาเช่าบ้านใกล้หมด' :
    'สัญญาเช่ายังไม่ใกล้หมด';

  const statusColor =
    days !== null && days <= 3 ? 'text-red-500' :
    days !== null && days <= 7 ? 'text-orange-400' :
    'text-green-500';

  const statusDot =
    days !== null && days <= 3 ? 'bg-red-500' :
    days !== null && days <= 7 ? 'bg-orange-400' :
    'bg-green-500';

  const typeLabel =
    contract.type === 'house' ? 'สัญญาเช่าบ้าน' :
    contract.type === 'role' ? 'สัญญาเช่ายศ' : 'สัญญายศส่วนตัว';

  const typeColor =
    contract.type === 'house' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    contract.type === 'role' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
    'bg-amber-500/10 text-amber-400 border-amber-500/20';

  const typeEmoji =
    contract.type === 'house' ? '🏠' :
    contract.type === 'role' ? '👑' : '⭐';

  const iconUrl = typeIcons[contract.type];
  const profile = memberProfiles[contract.member_id];
  const discordName = profile?.discord_username ?? profile?.username ?? null;

  async function sendNotify() {
    if (!contract.end_at) return;
    setSending(true);
    const endUnix = Math.floor(new Date(contract.end_at).getTime() / 1000);
    const member_id = contract.member_id;
    const room_link = contract.room_link ?? '-';
    const body = {
      content: `<@${member_id}>`,
      embeds: [{
        color: 16758671,
        description: `## <a:bearg11:1396016056035840140>︲__\` แท็กเตือนจากเซอร์วิส \`__\n<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲บ้านเช่าของคุณใกล้หมดแล้ว *!*\n  - __\`แท็ก\`__: <@${member_id}> — \`${member_id}\`\n  - __\`ห้องของคุณ\`__: ${room_link}\n  - __\`ระยะสัญญา\`__: <t:${endUnix}:F> (<t:${endUnix}:R>)\n<:line:1144701793989840997>\n# สามารถต่อบ้านเช่าได้ที่ <#1202239170219868190> <:cuteplant:1152834055528783872>`,
      }],
      attachments: [],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          emoji: { id: '1212856675053346897', name: 'bearcafe_star' },
          label: '︲ต่อบ้านเช่าของคุณ',
          url: 'https://discord.com/channels/1144251788493602848/1202239170219868190',
        }],
      }],
    };
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'ส่งการแจ้งเตือนสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'ส่งไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false); setNotifyOpen(false);
    }
  }

  return (
    <>
      <div className={cn(
        'group relative rounded-xl border-l-4 bg-card transition-all duration-200',
        'hover:shadow-md hover:bg-muted/20',
        borderColor.replace('border-', 'border-l-'),
        'border border-border/40'
      )}>
        {/* ── Main row ── */}
        <div className="flex items-start gap-3 px-4 py-3">

          {/* Icon */}
          <div className="shrink-0 w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center mt-0.5">
            {iconUrl ? (
              <img src={iconUrl} alt={contract.type} className="w-7 h-7 object-contain rounded"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className="text-lg leading-none">{typeEmoji}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">

            {/* Row 1: Member ID + type badge + actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm tracking-tight">{contract.member_id}</span>
              {discordName && (
                <span className="text-xs text-muted-foreground">@{discordName}</span>
              )}
              <Badge variant="outline" className={cn('text-xs px-2 py-0.5 ml-auto shrink-0 font-medium', typeColor)}>
                {typeLabel}
              </Badge>
              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                {contract.type === 'house' && (
                  <Button size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => onEdit(contract)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Row 2: Role name (if any) */}
            {(contract.type === 'role' || contract.type === 'personal_role') && contract.role_name && (
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-sm text-muted-foreground">{contract.role_name}</span>
              </div>
            )}

            {/* Row 3: Time status */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time remaining / elapsed */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className={cn(
                  'text-sm font-medium',
                  contract.type === 'house' ? statusColor : 'text-muted-foreground'
                )}>
                  {contract.type === 'personal_role'
                    ? formatElapsed(contract.start_at)
                    : contract.end_at ? formatRemaining(contract.end_at) : '—'}
                </span>
              </div>

              {/* Status dot for house */}
              {contract.type === 'house' && statusText && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot)} />
                  <span className={cn('text-xs font-medium', statusColor)}>{statusText}</span>
                </div>
              )}
            </div>

            {/* Row 3b: Channel link (own row so it never truncates) */}
            {contract.type === 'house' && contract.room_link && (
              <a href={contract.room_link} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors w-fit">
                <span>🔗</span>
                {loadingHouseChannel
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <span>{houseChannelName ?? 'ดูห้อง'}</span>
                }
              </a>
            )}

            {contract.type === 'personal_role' && contract.room_link && (
              <a href={contract.room_link} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors w-fit">
                <span>#</span>
                {loadingExtra
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <span>{channelName ?? 'ดูห้อง'}</span>
                }
              </a>
            )}

            {/* Row 4: personal_role member count + meta */}
            <div className="flex items-center gap-3 flex-wrap">
              {contract.type === 'personal_role' && (
                <>
                  {loadingExtra && roleTotal === null ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />โหลด...
                    </span>
                  ) : roleTotal !== null ? (
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      roleTotal > 5 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                    )}>
                      👥 {roleTotal.toLocaleString()} คน{roleTotal > 5 ? ' (เกิน)' : ''}
                    </span>
                  ) : null}
                </>
              )}

              {/* Operator + date — always at end */}
              <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                <span>{contract.operator_name ?? '—'}</span>
                <span className="shrink-0">
                  {new Date(contract.created_at).toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notify button — only when urgent */}
        {contract.type === 'house' && days !== null && days <= 3 && days > 0 && (
          <div className="px-4 pb-3 pt-0">
            <Button
              size="sm" variant="destructive"
              className="w-full h-7 text-xs font-medium gap-1.5 rounded-lg"
              onClick={() => setNotifyOpen(true)}
            >
              <Bell className="w-3 h-3" />แจ้งเตือนผู้เช่า
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="w-4 h-4" />ยืนยันการลบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ลบสัญญา <span className="font-medium text-foreground">{
              contract.type === 'house' ? 'เช่าบ้าน' :
              contract.type === 'role' ? 'เช่ายศ' : 'ยศส่วนตัว'
            }</span> ของ <span className="font-mono text-foreground">{contract.member_id}</span>?
            <br /><span className="text-destructive text-xs">ข้อมูลจะถูกลบออกจากระบบถาวร</span>
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify confirm dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ยืนยันการแจ้งเตือน</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ส่งการแจ้งเตือนไปยัง <span className="font-mono">{contract.member_id}</span> ว่าบ้านเช่าใกล้หมดอายุ?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={sendNotify} disabled={sending}>
              {sending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ส่งแจ้งเตือน
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

  const [typeIcons, setTypeIcons] = useState<TypeIcons>({ house: null, role: null, personal_role: null });
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { username: string; discord_username: string | null }>>({});

  // Filters
  const [searchMember, setSearchMember] = useState('');
  const [searchOperator, setSearchOperator] = useState('');
  const [filterType, setFilterType] = useState<ContractType | 'all'>('all');
  const [page, setPage] = useState(1);

  // Load stored icon URLs from storage on mount
  useEffect(() => {
    // โหลด icon โดยตรงจาก getPublicUrl — ไม่ probe extension
    // ถ้าไฟล์ไม่มีจริง img จะ fallback ผ่าน onError
    const types: ContractType[] = ['house', 'role', 'personal_role'];
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    const result: TypeIcons = { house: null, role: null, personal_role: null };

    // ลอง getPublicUrl ทุก ext แล้วเก็บตัวแรกที่ได้ URL (ไม่ fetch จริง)
    // การ validate จะเกิดที่ <img onError> แทน
    for (const type of types) {
      for (const ext of exts) {
        const { data } = supabase.storage
          .from('contract-icons')
          .getPublicUrl(`type-icons/${type}.${ext}`);
        if (data?.publicUrl) {
          result[type] = `${data.publicUrl}?t=${Date.now()}`;
          break; // ใช้ png เป็น default, ถ้าไม่มีจะ fallback ที่ onError
        }
      }
    }
    setTypeIcons(result);
  }, []);

  async function fetchMemberProfiles(memberIds: string[]) {
    if (memberIds.length === 0) return;
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('discord_id, username, discord_username')
      .in('discord_id', memberIds);
    if (error || !data) return;
    const map: Record<string, { username: string; discord_username: string | null }> = {};
    for (const p of data) {
      map[p.discord_id] = { username: p.username, discord_username: p.discord_username ?? null };
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
    const list: Contract[] = data ?? [];
    setContracts(list);
    const memberIds = [...new Set(list.map(c => c.member_id))];
    fetchMemberProfiles(memberIds);
  }, [toast]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchMember, searchOperator, filterType]);

  const filtered = contracts.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (searchMember && !c.member_id.toLowerCase().includes(searchMember.toLowerCase())) return false;
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
    role: contracts.filter(c => c.type === 'role').length,
    personal_role: contracts.filter(c => c.type === 'personal_role').length,
  };
  const urgentCount = contracts.filter(c => {
    if (c.type !== 'house' || !c.end_at) return false;
    return daysRemaining(c.end_at) <= 3 && daysRemaining(c.end_at) > 0;
  }).length;
  const expiredCount = contracts.filter(c =>
    c.end_at && daysRemaining(c.end_at) <= 0
  ).length;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">สัญญาเช่า</h2>
          <Badge variant="secondary" className="text-xs">{filtered.length} / {contracts.length}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {user?.is_owner && (
            <IconUpload typeIcons={typeIcons} onUploaded={handleIconUploaded} />
          )}
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />เพิ่มสัญญา
          </Button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Type counts — clickable quick-filter */}
        {([
          { key: 'all', label: 'ทั้งหมด', count: contracts.length, color: 'bg-muted/60 hover:bg-muted' },
          { key: 'house', label: '🏠 บ้าน', count: countByType.house, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400' },
          { key: 'role', label: '👑 ยศ', count: countByType.role, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400' },
          { key: 'personal_role', label: '⭐ ยศส่วนตัว', count: countByType.personal_role, color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' },
        ] as const).map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => { setFilterType(key as ContractType | 'all'); setPage(1); }}
            className={cn(
              'rounded-xl px-3 py-2.5 text-left transition-all border',
              color,
              filterType === key ? 'ring-2 ring-primary border-primary/40' : 'border-border/40'
            )}
          >
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold leading-tight">{count}</p>
          </button>
        ))}
        {/* Urgent alert */}
        <button
          onClick={() => { setFilterType('house'); setPage(1); }}
          className={cn(
            'rounded-xl px-3 py-2.5 text-left transition-all border',
            urgentCount > 0
              ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30'
              : 'bg-muted/40 border-border/40 opacity-60'
          )}
        >
          <p className="text-[11px] text-muted-foreground font-medium">🚨 ใกล้หมด</p>
          <p className={cn('text-xl font-bold leading-tight', urgentCount > 0 && 'text-red-400')}>{urgentCount}</p>
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search member */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="ค้นหา Member ID..."
            value={searchMember}
            onChange={e => setSearchMember(e.target.value)}
          />
          {searchMember && (
            <button onClick={() => setSearchMember('')} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Search operator */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="ค้นหาผู้ดำเนินการ..."
            value={searchOperator}
            onChange={e => setSearchOperator(e.target.value)}
          />
          {searchOperator && (
            <button onClick={() => setSearchOperator('')} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Clear all */}
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            <X className="w-3 h-3" />ล้างทั้งหมด
          </button>
        )}
        {/* Result count */}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} รายการ
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">ไม่พบข้อมูลสัญญา</div>
      ) : (
        <div className="space-y-1.5">
          {paginated.map(c => (
            <ContractCard
              key={c.id}
              contract={c}
              typeIcons={typeIcons}
              memberProfiles={memberProfiles}
              onEdit={setEditTarget}
              onRefresh={fetchContracts}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            หน้า <span className="font-medium text-foreground">{page}</span> / {totalPages}
            <span className="ml-2 text-muted-foreground/60">({filtered.length} รายการ)</span>
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1} className="h-7 px-2 text-xs">«</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="h-7 px-2 text-xs">ก่อนหน้า</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-7 px-2 text-xs">ถัดไป</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="h-7 px-2 text-xs">»</Button>
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
    </div>
  );
}
