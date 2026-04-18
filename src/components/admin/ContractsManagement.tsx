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
//   icon_url TEXT,
//   operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
//   operator_name TEXT,
//   edit_log JSONB DEFAULT '[]',
//   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
//   updated_at TIMESTAMPTZ
// );
// ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "contracts: authenticated read" ON public.contracts FOR SELECT TO authenticated USING (true);
// CREATE POLICY "contracts: authenticated write" ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
// -- Storage bucket: contract-icons (public)
// -- INSERT INTO storage.buckets (id, name, public) VALUES ('contract-icons', 'contract-icons', true) ON CONFLICT DO NOTHING;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Home, Crown, User, Clock, Bell, Edit2, Search, RefreshCw,
  Loader2, CheckCircle2, X, Upload, ImageIcon,
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
  icon_url: string | null;
  operator_id: string | null;
  operator_name: string | null;
  created_at: string;
  updated_at: string | null;
  edit_log: Array<{ editor: string; avatar: string | null; timestamp: string }> | null;
}

// ─── Per-type icon state (shared across cards, loaded once) ──────────────────
interface TypeIcons { house: string | null; role: string | null; personal_role: string | null; }

const DEFAULT_TYPE_ICONS: TypeIcons = { house: null, role: null, personal_role: null };

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

const TYPE_LABELS: Record<ContractType, string> = {
  house: 'สัญญาเช่าบ้าน',
  role: 'สัญญาเช่ายศ',
  personal_role: 'สัญญายศส่วนตัว',
};

const TYPE_COLORS: Record<ContractType, string> = {
  house: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  role: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  personal_role: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const TYPE_BORDER: Record<string, string> = {
  house_ok: 'border-green-500',
  house_warn: 'border-orange-400',
  house_urgent: 'border-red-500',
  house_expired: 'border-gray-400',
  role: 'border-purple-500/40',
  personal_role: 'border-amber-500/40',
};

function formatRemaining(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'หมดอายุแล้ว';
  const totalHours = Math.floor(diff / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `สัญญาคงเหลือ ${hours} ชั่วโมง`;
  return `สัญญาคงเหลือ ${days} วัน — ${hours} ชั่วโมง`;
}

function formatElapsed(startAt: string) {
  const diff = Date.now() - new Date(startAt).getTime();
  const totalHours = Math.floor(diff / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `สร้างมาแล้ว ${hours} ชั่วโมง`;
  return `สร้างมาแล้ว ${days} วัน — ${hours} ชั่วโมง`;
}

function daysRemaining(endAt: string) {
  return (new Date(endAt).getTime() - Date.now()) / 86400000;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Icon Upload (Owner only) ─────────────────────────────────────────────────
interface IconUploadProps {
  typeIcons: TypeIcons;
  onUploaded: (type: ContractType, url: string) => void;
}

function IconUpload({ typeIcons, onUploaded }: IconUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<ContractType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<ContractType | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingType) return;
    setUploading(pendingType);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `type-icons/${pendingType}.${ext}`;
      const { error } = await supabase.storage.from('contract-icons').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('contract-icons').getPublicUrl(path);
      onUploaded(pendingType, data.publicUrl + `?t=${Date.now()}`);
      toast({ title: 'อัปโหลดไอคอนสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'อัปโหลดไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(null);
      setPendingType(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">จัดการไอคอนตามประเภท (Owner)</span>
      <div className="flex gap-1.5">
        {(['house', 'role', 'personal_role'] as ContractType[]).map(t => (
          <button
            key={t}
            title={TYPE_LABELS[t]}
            onClick={() => { setPendingType(t); setTimeout(() => inputRef.current?.click(), 50); }}
            className="relative w-8 h-8 rounded-lg border border-border/60 overflow-hidden hover:border-primary/50 transition-colors bg-background"
          >
            {typeIcons[t] ? (
              <img src={typeIcons[t]!} alt={t} className="w-full h-full object-cover" />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-[10px] text-muted-foreground">
                {t === 'house' ? '🏠' : t === 'role' ? '👑' : '👤'}
              </span>
            )}
            {uploading === t && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-3 h-3 animate-spin text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
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

  // personal_role: Discord roles from API
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedDiscordRole, setSelectedDiscordRole] = useState<DiscordRole | null>(null);

  async function fetchDiscordRoles() {
    setRolesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setDiscordRoles(data?.roles ?? []);
    } catch (e: any) {
      toast({ title: 'โหลดยศ Discord ไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRolesLoading(false);
    }
  }

  // Auto-fetch when switching to personal_role step 2
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
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="ค้นหาชื่อบทบาท..."
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                  />
                </div>
                {/* Role list */}
                {rolesLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
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
    const newLog = [...(contract.edit_log ?? []), { editor: operatorName, avatar: operatorAvatar, timestamp: new Date().toISOString() }];
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
  onEdit: (c: Contract) => void;
  onRefresh: () => void;
}

function ContractCard({ contract, typeIcons, onEdit, onRefresh }: ContractCardProps) {
  const { toast } = useToast();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const days = contract.end_at ? daysRemaining(contract.end_at) : null;

  const borderColor =
    contract.type !== 'house' ? TYPE_BORDER[contract.type] :
    days === null ? 'border-border' :
    days <= 0 ? TYPE_BORDER.house_expired :
    days <= 3 ? TYPE_BORDER.house_urgent :
    days <= 7 ? TYPE_BORDER.house_warn :
    TYPE_BORDER.house_ok;

  const statusText =
    contract.type !== 'house' ? null :
    days === null ? null :
    days <= 0 ? 'หมดอายุแล้ว' :
    days <= 3 ? 'ใกล้หมด (เร่งด่วน)' :
    days <= 7 ? 'ใกล้หมด' :
    'ปกติ';

  const statusColor =
    days !== null && days <= 0 ? 'text-gray-400' :
    days !== null && days <= 3 ? 'text-red-500' :
    days !== null && days <= 7 ? 'text-orange-400' :
    'text-green-500';

  const iconSrc = typeIcons[contract.type];
  const fallbackEmoji = contract.type === 'house' ? '🏠' : contract.type === 'role' ? '👑' : '👤';

  async function sendNotify() {
    if (!contract.end_at) return;
    setSending(true);
    const endUnix = Math.floor(new Date(contract.end_at).getTime() / 1000);
    const body = {
      content: `<@${contract.member_id}>`,
      embeds: [{
        color: 16758671,
        description: `## <a:bearg11:1396016056035840140>︲__\` แท็กเตือนจากเซอร์วิส \`__<:line:1144701793989840997>\n- <:bear_star1:1152782839671169184>︲บ้านเช่าของคุณใกล้หมดแล้ว *!*\n- __\`แท็ก\`__: <@${contract.member_id}> — \`${contract.member_id}\`\n- __\`ห้องของคุณ\`__: ${contract.room_link ?? '-'}\n- __\`ระยะสัญญา\`__: <t:${endUnix}:F> (<t:${endUnix}:R>)\n<:line:1144701793989840997>`,
      }],
      components: [{
        type: 1,
        components: [{
          type: 2, style: 5,
          emoji: { id: '1212856675053346897', name: 'bearcafe_star' },
          label: '︲ต่อบ้านเช่าของคุณ',
          url: 'https://discord.com/channels/1144251788493602848/1202239170219868190',
        }],
      }],
    };
    try {
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
      <Card className={cn('border-2 transition-colors hover:shadow-sm overflow-hidden', borderColor)}>
        <div className="flex">
          {/* ─── Left: Icon ─── */}
          <div className="w-16 shrink-0 flex items-center justify-center bg-muted/20 border-r border-border/40">
            {iconSrc ? (
              <img src={iconSrc} alt={contract.type} className="w-10 h-10 object-contain rounded-lg" />
            ) : (
              <span className="text-2xl">{fallbackEmoji}</span>
            )}
          </div>

          {/* ─── Right: Info ─── */}
          <div className="flex-1 min-w-0 p-3 space-y-1.5">
            {/* Header row */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', TYPE_COLORS[contract.type])}>
                  {TYPE_LABELS[contract.type]}
                </Badge>
                {contract.type === 'house' && statusText && (
                  <span className={cn('text-[10px] font-medium shrink-0', statusColor)}>{statusText}</span>
                )}
              </div>
              {contract.type === 'house' && (
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => onEdit(contract)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Member */}
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-mono text-foreground/80 truncate">{contract.member_id}</span>
            </div>

            {/* Role name */}
            {(contract.type === 'role' || contract.type === 'personal_role') && contract.role_name && (
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] truncate">{contract.role_name}</span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className={cn('text-[11px]', contract.type === 'house' ? statusColor : 'text-muted-foreground')}>
                {contract.type === 'personal_role'
                  ? formatElapsed(contract.start_at)
                  : contract.end_at ? formatRemaining(contract.end_at) : '—'}
              </span>
            </div>

            {/* Room link */}
            {contract.type === 'house' && contract.room_link && (
              <a href={contract.room_link} target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-400 hover:underline truncate block">
                🔗 {contract.room_link}
              </a>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground truncate">
                {contract.operator_name ?? '—'}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(contract.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              </span>
            </div>

            {/* Notify button */}
            {contract.type === 'house' && days !== null && days > 0 && days <= 3 && (
              <Button size="sm" variant="destructive" className="w-full h-6 text-[11px] gap-1 mt-1" onClick={() => setNotifyOpen(true)}>
                <Bell className="w-3 h-3" />กดแจ้งเตือน
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ยืนยันการแจ้งเตือน</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">ส่งแจ้งเตือนไปยัง <span className="font-mono">{contract.member_id}</span>?</p>
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
  const [typeIcons, setTypeIcons] = useState<TypeIcons>(DEFAULT_TYPE_ICONS);

  // Filters
  const [searchMember, setSearchMember] = useState('');
  const [searchOperator, setSearchOperator] = useState('');
  const [filterType, setFilterType] = useState<ContractType | 'all'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Load type icons from storage
  useEffect(() => {
    async function loadIcons() {
      const icons: TypeIcons = { house: null, role: null, personal_role: null };
      for (const t of ['house', 'role', 'personal_role'] as ContractType[]) {
        for (const ext of ['png', 'jpg', 'gif', 'webp']) {
          const { data } = supabase.storage.from('contract-icons').getPublicUrl(`type-icons/${t}.${ext}`);
          // Check if file exists by trying to fetch headers
          try {
            const r = await fetch(data.publicUrl, { method: 'HEAD' });
            if (r.ok) { icons[t] = data.publicUrl + `?t=${Date.now()}`; break; }
          } catch { /* not found */ }
        }
      }
      setTypeIcons(icons);
    }
    loadIcons();
  }, []);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('contracts').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast({ title: 'โหลดข้อมูลไม่สำเร็จ', description: error.message, variant: 'destructive' }); return; }
    setContracts(data ?? []);
  }, [toast]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);
  useEffect(() => { setPage(1); }, [searchMember, searchOperator, filterType, filterDateFrom, filterDateTo]);

  const filtered = contracts.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (searchMember && !c.member_id.toLowerCase().includes(searchMember.toLowerCase())) return false;
    if (searchOperator && !(c.operator_name ?? '').toLowerCase().includes(searchOperator.toLowerCase())) return false;
    if (filterDateFrom && new Date(c.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(c.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchMember(''); setSearchOperator('');
    setFilterType('all'); setFilterDateFrom(''); setFilterDateTo('');
  };
  const hasFilter = searchMember || searchOperator || filterType !== 'all' || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">สัญญาเช่า</h2>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />เพิ่มข้อมูล
          </Button>
        </div>
      </div>

      {/* Icon upload (Owner only) */}
      {user?.is_owner && (
        <IconUpload
          typeIcons={typeIcons}
          onUploaded={(t, url) => setTypeIcons(prev => ({ ...prev, [t]: url }))}
        />
      )}

      {/* Filters */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ผู้เช่า (Member ID)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="ค้นหา ID..." value={searchMember} onChange={e => setSearchMember(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ผู้ดำเนินการ</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="ค้นหาชื่อ..." value={searchOperator} onChange={e => setSearchOperator(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ประเภทสัญญา</Label>
            <Select value={filterType} onValueChange={v => setFilterType(v as ContractType | 'all')}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="house">สัญญาเช่าบ้าน</SelectItem>
                <SelectItem value="role">สัญญาเช่ายศ</SelectItem>
                <SelectItem value="personal_role">สัญญายศส่วนตัว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">วันที่สร้าง</Label>
            <div className="flex gap-1.5 items-center">
              <Input type="date" className="h-8 text-xs flex-1" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground shrink-0">—</span>
              <Input type="date" className="h-8 text-xs flex-1" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>
        </div>
        {hasFilter && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" />ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">ไม่พบข้อมูลสัญญา</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginated.map(c => (
            <ContractCard key={c.id} contract={c} typeIcons={typeIcons} onEdit={setEditTarget} onRefresh={fetchContracts} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">หน้า {page} / {totalPages} ({filtered.length} รายการ)</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="h-7 px-2 text-xs">ก่อนหน้า</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-7 px-2 text-xs">ถัดไป</Button>
          </div>
        </div>
      )}

      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); fetchContracts(); }}
        operatorId={user?.id ?? ''}
        operatorName={user?.username ?? ''}
      />
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

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('contracts').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast({ title: 'โหลดข้อมูลไม่สำเร็จ', description: error.message, variant: 'destructive' }); return; }
    setContracts(data ?? []);
  }, [toast]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchMember, searchOperator, filterType, filterDateFrom, filterDateTo]);

  const filtered = contracts.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (searchMember && !c.member_id.toLowerCase().includes(searchMember.toLowerCase())) return false;
    if (searchOperator && !(c.operator_name ?? '').toLowerCase().includes(searchOperator.toLowerCase())) return false;
    if (filterDateFrom && new Date(c.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(c.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const typeLabel = (t: ContractType) =>
    t === 'house' ? 'เช่าบ้าน' : t === 'role' ? 'เช่ายศ' : 'ยศส่วนตัว';

  const typeBadgeClass = (t: ContractType) =>
    t === 'house' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    t === 'role' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
    'bg-amber-500/10 text-amber-400 border-amber-500/20';

  const statusInfo = (c: Contract) => {
    if (c.type !== 'house' || !c.end_at) return null;
    const d = daysRemaining(c.end_at);
    if (d <= 0) return { dot: 'bg-gray-400', text: 'หมดอายุ' };
    if (d <= 3) return { dot: 'bg-red-500', text: 'เร่งด่วน' };
    if (d <= 7) return { dot: 'bg-orange-400', text: 'ใกล้หมด' };
    return { dot: 'bg-green-500', text: 'ปกติ' };
  };

  const clearFilters = () => {
    setSearchMember(''); setSearchOperator('');
    setFilterType('all'); setFilterDateFrom(''); setFilterDateTo('');
  };

  const hasFilter = searchMember || searchOperator || filterType !== 'all' || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">สัญญาเช่า</h2>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />เพิ่มข้อมูล
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* ค้นหาผู้เช่า */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ผู้เช่า (Member ID)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm" placeholder="ค้นหา ID..." value={searchMember} onChange={e => setSearchMember(e.target.value)} />
              </div>
            </div>
            {/* ค้นหาผู้ดำเนินการ */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ผู้ดำเนินการ</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm" placeholder="ค้นหาชื่อ..." value={searchOperator} onChange={e => setSearchOperator(e.target.value)} />
              </div>
            </div>
            {/* ประเภท */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ประเภทสัญญา</Label>
              <Select value={filterType} onValueChange={v => setFilterType(v as ContractType | 'all')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="house">สัญญาเช่าบ้าน</SelectItem>
                  <SelectItem value="role">สัญญาเช่ายศ</SelectItem>
                  <SelectItem value="personal_role">สัญญายศส่วนตัว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* วันที่ */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">วันที่สร้าง</Label>
              <div className="flex gap-1.5 items-center">
                <Input type="date" className="h-8 text-xs flex-1" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground shrink-0">—</span>
                <Input type="date" className="h-8 text-xs flex-1" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
            </div>
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <X className="w-3 h-3" />ล้างตัวกรอง
            </button>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">ไม่พบข้อมูลสัญญา</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginated.map(c => (
            <ContractCard key={c.id} contract={c} onEdit={setEditTarget} onRefresh={fetchContracts} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">หน้า {page} / {totalPages} ({filtered.length} รายการ)</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="h-7 px-2 text-xs">ก่อนหน้า</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-7 px-2 text-xs">ถัดไป</Button>
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
