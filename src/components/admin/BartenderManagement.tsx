import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

type ProfileLite = {
  id: string;
  username: string | null;
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
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [alias, setAlias] = useState('☕ Bartender');
  const [statusText, setStatusText] = useState('🧸 พร้อมคุย');

  const fetchAll = useCallback(async () => {
    const [{ data: pData, error: pErr }, { data: bData, error: bErr }] = await Promise.all([
      (supabase as any).from('profiles').select('id, username').order('username', { ascending: true }),
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
    const ch = supabase
      .channel('admin-bartender-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_bartender_presence' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const rowMap = useMemo(() => new Map(rows.map(r => [r.user_id, r])), [rows]);
  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.username ?? '').toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const upsertPresence = async (userId: string, patch: Partial<BartenderPresence>) => {
    setSavingId(userId);
    const base = rowMap.get(userId);
    const payload = {
      user_id: userId,
      is_enabled: base?.is_enabled ?? false,
      is_online: base?.is_online ?? false,
      is_available: base?.is_available ?? false,
      standby_mode: base?.standby_mode ?? false,
      status_text: base?.status_text ?? '🧸 พร้อมคุย',
      alias: base?.alias ?? '☕ Bartender',
      avatar: base?.avatar ?? null,
      active_session_id: base?.active_session_id ?? null,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    const { error } = await (supabase as any).from('chat_bartender_presence').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } else {
      await fetchAll();
    }
    setSavingId(null);
  };

  const removeBartender = async (userId: string) => {
    setSavingId(userId);
    const { error } = await (supabase as any).from('chat_bartender_presence').delete().eq('user_id', userId);
    if (error) toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    await fetchAll();
    setSavingId(null);
  };

  const addBartender = async () => {
    if (!selectedUserId) return;
    await upsertPresence(selectedUserId, { is_enabled: true, alias, status_text, standby_mode: true, is_available: true });
    setSelectedUserId('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>จัดการ Bartender Mode</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">เพิ่ม/ลบ Bartender ได้หลายคน และเปิด/ปิดโหมด standby รายคน</p>
          <div className="grid gap-2 md:grid-cols-4">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาผู้ใช้..." />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">เลือกผู้ใช้เพื่อเพิ่ม</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.username ?? p.id}</option>
              ))}
            </select>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias bartender" />
            <div className="flex gap-2">
              <Input value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="สถานะ เช่น 🧸 พร้อมคุย" />
              <Button onClick={addBartender}>เพิ่ม</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>รายชื่อทีม Bartender</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {filteredProfiles.map((p) => {
            const row = rowMap.get(p.id);
            if (!row) return null;
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.username ?? p.id}</p>
                    <p className="text-xs text-muted-foreground">{row.status_text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.is_online ? 'default' : 'secondary'}>{row.is_online ? 'Online' : 'Offline'}</Badge>
                    <Badge variant={row.is_available ? 'default' : 'secondary'}>{row.is_available ? 'Available' : 'Busy'}</Badge>
                    <Button size="sm" variant="destructive" disabled={savingId === p.id} onClick={() => removeBartender(p.id)}>ลบ</Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-xs">Enable</span>
                    <Switch checked={row.is_enabled} onCheckedChange={(v) => upsertPresence(p.id, { is_enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-xs">Standby</span>
                    <Switch checked={row.standby_mode} onCheckedChange={(v) => upsertPresence(p.id, { standby_mode: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-xs">Available</span>
                    <Switch checked={row.is_available} onCheckedChange={(v) => upsertPresence(p.id, { is_available: v })} />
                  </div>
                  <Input value={row.status_text ?? ''} onChange={(e) => upsertPresence(p.id, { status_text: e.target.value })} placeholder="ข้อความสถานะ" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
