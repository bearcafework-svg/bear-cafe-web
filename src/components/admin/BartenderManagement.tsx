import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coffee, Loader2, Power, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';

type ProfileLite = {
  id: string;
  username: string | null;
  avatar_url?: string | null;
};

type BartenderPresence = {
  user_id: string;
  is_enabled: boolean;
  is_online: boolean;
  is_available: boolean;
  standby_mode: boolean;
  status_text: string;
  alias: string | null;
  avatar: string | null;
  active_session_id: string | null;
  updated_at: string;
};

export function BartenderManagement() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [rows, setRows] = useState<BartenderPresence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    const [{ data: pData, error: pErr }, { data: bData, error: bErr }] = await Promise.all([
      (supabase as any).from('profiles').select('id, username, avatar_url').order('username', { ascending: true }),
      (supabase as any).from('chat_bartender_presence').select('*').order('updated_at', { ascending: false }),
    ]);
    if (pErr || bErr) {
      toast({ title: 'โหลดข้อมูลไม่สำเร็จ', variant: 'destructive' });
      return;
    }
    setProfiles((pData ?? []) as ProfileLite[]);
    setRows((bData ?? []) as BartenderPresence[]);
  }, [toast]);

  useEffect(() => {
    fetchAll();
    (supabase as any).rpc('release_stale_bartenders');
    const ch = supabase
      .channel('admin-bartender-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_bartender_presence' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const rowMap = useMemo(() => new Map(rows.map(r => [r.user_id, r])), [rows]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const enabledCount = rows.filter(r => r.is_enabled).length;
  const standbyCount = rows.filter(r => r.is_enabled && r.standby_mode && r.is_online).length;
  const availableCount = rows.filter(r => r.is_enabled && r.standby_mode && r.is_online && r.is_available).length;
  const busyCount = rows.filter(r => r.active_session_id || !r.is_available).length;

  const bartenderRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      const p = profileMap.get(r.user_id);
      const name = p?.username ?? '';
      const alias = r.alias ?? '';
      return !q || name.toLowerCase().includes(q) || alias.toLowerCase().includes(q) || r.user_id.toLowerCase().includes(q);
    });
  }, [rows, searchQuery, profileMap]);

  const nonBartenderProfiles = useMemo(
    () => profiles.filter(p => !rowMap.has(p.id)),
    [profiles, rowMap]
  );

  const upsertPresence = async (userId: string, patch: Partial<BartenderPresence>) => {
    setSavingId(userId);
    const base = rowMap.get(userId);
    const payload = {
      user_id: userId,
      is_enabled: base?.is_enabled ?? false,
      is_online: base?.is_online ?? false,
      is_available: base?.is_available ?? false,
      standby_mode: base?.standby_mode ?? false,
      status_text: base?.status_text ?? 'พร้อมรับผู้รอคิว',
      alias: base?.alias ?? 'เพื่อนในคาเฟ่',
      avatar: base?.avatar ?? null,
      active_session_id: base?.active_session_id ?? null,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    const { error } = await (supabase as any)
      .from('chat_bartender_presence')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } else {
      await fetchAll();
    }
    setSavingId(null);
  };

  const removeBartender = async (row: BartenderPresence) => {
    setSavingId(row.user_id);
    if (row.active_session_id) {
      await (supabase as any).rpc('release_bartender_session', { p_session_id: row.active_session_id });
    }
    const { error } = await (supabase as any).from('chat_bartender_presence').delete().eq('user_id', row.user_id);
    if (error) {
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'ลบผู้ช่วย standby แล้ว' });
      await fetchAll();
    }
    setSavingId(null);
  };

  const addBartender = async () => {
    if (!selectedUserId) {
      toast({ title: 'กรุณาเลือกผู้ใช้', variant: 'destructive' });
      return;
    }
    setIsAdding(true);
    await upsertPresence(selectedUserId, {
      is_enabled: true,
      is_online: true,
      is_available: true,
      standby_mode: true,
      alias: 'เพื่อนในคาเฟ่',
      status_text: 'พร้อมรับผู้รอคิว',
    });
    toast({ title: 'เพิ่มผู้ช่วย standby แล้ว' });
    setSelectedUserId('');
    setIsAdding(false);
  };

  const resetBusyState = async (row: BartenderPresence) => {
    if (row.active_session_id) {
      await (supabase as any).rpc('release_bartender_session', { p_session_id: row.active_session_id });
    } else {
      await upsertPresence(row.user_id, { is_available: true, active_session_id: null });
    }
    toast({ title: 'คืนสถานะพร้อมรับแล้ว' });
    await fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-amber-50 via-background to-orange-50 p-5 shadow-sm dark:from-amber-950/20 dark:via-background dark:to-orange-950/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Coffee className="h-3.5 w-3.5" /> Secret Chat Standby
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">จัดการผู้ช่วย Standby</h2>
              <p className="text-sm text-muted-foreground">ผู้ช่วยจะรับผู้ใช้ที่รอสุ่มเกิน 7 วินาที โดยหน้าแชทจะแสดงเป็นเพื่อนในคาเฟ่เท่านั้น</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchAll} className="gap-2 bg-background/80">
            <RefreshCw className="h-4 w-4" /> รีเฟรชสถานะ
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="ทั้งหมด" value={rows.length} tone="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" />
          <StatCard icon={<Power className="h-4 w-4" />} label="เปิดรับงาน" value={enabledCount} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
          <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="ออนไลน์" value={standbyCount} tone="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" />
          <StatCard icon={<Sparkles className="h-4 w-4" />} label="พร้อมรับ" value={availableCount} sub={`${busyCount} กำลังคุย/ไม่ว่าง`} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        </div>
      </div>

      <Card className="border-amber-200/70 dark:border-amber-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> เพิ่มผู้ช่วย Standby
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">เลือกผู้ใช้</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="เลือกสมาชิกที่ยังไม่ได้เป็นผู้ช่วย standby" /></SelectTrigger>
              <SelectContent>
                {nonBartenderProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.username ?? p.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={addBartender} disabled={!selectedUserId || isAdding} className="w-full gap-2">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} เพิ่ม
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coffee className="h-4 w-4" /> รายชื่อผู้ช่วย Standby <Badge variant="secondary">{bartenderRows.length}</Badge>
            </CardTitle>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ค้นหาชื่อหรือ user id" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 && <EmptyState text="ยังไม่มีผู้ช่วย standby — เพิ่มสมาชิกจากฟอร์มด้านบนได้เลย" />}
          {bartenderRows.length === 0 && rows.length > 0 && <EmptyState text="ไม่พบผู้ช่วยที่ตรงกับคำค้นหา" />}
          <div className="grid gap-4 xl:grid-cols-2">
            {bartenderRows.map(row => {
              const profile = profileMap.get(row.user_id);
              const isSaving = savingId === row.user_id;
              const ready = row.is_enabled && row.is_online && row.standby_mode && row.is_available;
              return (
                <div key={row.user_id} className="rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {profile?.avatar_url ? <img src={profile.avatar_url} className="h-12 w-12 rounded-2xl object-cover" alt="" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl dark:bg-amber-950/40">🐻</div>}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{profile?.username ?? row.user_id}</p>
                        <p className="truncate text-xs text-muted-foreground">ผู้ช่วย standby แบบไม่เปิดเผยตัวตน</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Badge className={ready ? 'bg-emerald-500 text-white' : row.active_session_id ? 'bg-amber-500 text-white' : ''} variant={ready || row.active_session_id ? 'default' : 'secondary'}>
                        {ready ? 'พร้อมรับ' : row.active_session_id ? 'กำลังคุย' : 'พักอยู่'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <ToggleBox label="เปิดรับงาน" checked={row.is_enabled && row.is_online && row.standby_mode} disabled={isSaving} onChange={v => upsertPresence(row.user_id, { is_enabled: v, is_online: v, standby_mode: v, is_available: v && !row.active_session_id })} />
                    <ToggleBox label="พร้อมรับคิว" checked={row.is_available && !row.active_session_id} disabled={isSaving || !!row.active_session_id || !row.is_enabled} onChange={v => upsertPresence(row.user_id, { is_available: v })} />
                    <div className="rounded-xl border bg-muted/20 px-3 py-2.5 text-xs">
                      <p className="font-medium">สถานะห้อง</p>
                      <p className="mt-1 text-muted-foreground">{row.active_session_id ? 'กำลังคุยอยู่' : 'ไม่มีห้อง active'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="truncate text-xs text-muted-foreground">Session: {row.active_session_id ?? 'ไม่มี'} · อัปเดต {new Date(row.updated_at).toLocaleString('th-TH')}</p>
                    <div className="flex gap-2">
                      {(row.active_session_id || !row.is_available) && <Button size="sm" variant="outline" disabled={isSaving} onClick={() => resetBusyState(row)}>คืนสถานะ</Button>}
                      <Button size="sm" variant="destructive" disabled={isSaving} onClick={() => removeBartender(row)} className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> ลบ</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number; sub?: string; tone: string }) {
  return <div className="rounded-2xl border bg-background/80 p-4"><div className={`mb-3 inline-flex rounded-xl p-2 ${tone}`}>{icon}</div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

function ToggleBox({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2.5"><Label className="text-xs font-medium">{label}</Label><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} /></div>;
}
