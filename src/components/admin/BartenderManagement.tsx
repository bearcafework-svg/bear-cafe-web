import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Trash2, Coffee } from 'lucide-react';

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

  // Add bartender form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newAlias, setNewAlias] = useState('☕ Bartender');
  const [newStatusText, setNewStatusText] = useState('🧸 พร้อมคุย');
  const [isAdding, setIsAdding] = useState(false);

  // Per-row edit state (status_text + alias edits before save)
  const [editingStatus, setEditingStatus] = useState<Record<string, string>>({});
  const [editingAlias, setEditingAlias] = useState<Record<string, string>>({});

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
    const ch = supabase
      .channel('admin-bartender-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_bartender_presence' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const rowMap = useMemo(() => new Map(rows.map(r => [r.user_id, r])), [rows]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  // Only show profiles that ARE bartenders
  const bartenderRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      if (!q) return true;
      const p = profileMap.get(r.user_id);
      return (p?.username ?? '').toLowerCase().includes(q) || r.user_id.toLowerCase().includes(q);
    });
  }, [rows, searchQuery, profileMap]);

  // Profiles not yet bartenders (for the add dropdown)
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
      status_text: base?.status_text ?? '🧸 พร้อมคุย',
      alias: base?.alias ?? '☕ Bartender',
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

  const removeBartender = async (userId: string) => {
    setSavingId(userId);
    const { error } = await (supabase as any)
      .from('chat_bartender_presence')
      .delete()
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'ลบ Bartender แล้ว' });
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
      alias: newAlias || '☕ Bartender',
      status_text: newStatusText || '🧸 พร้อมคุย',
      standby_mode: true,
      is_available: true,
    });
    toast({ title: '☕ เพิ่ม Bartender แล้ว' });
    setSelectedUserId('');
    setNewAlias('☕ Bartender');
    setNewStatusText('🧸 พร้อมคุย');
    setIsAdding(false);
  };

  const saveStatusText = async (userId: string) => {
    const text = editingStatus[userId];
    if (text === undefined) return;
    await upsertPresence(userId, { status_text: text });
    setEditingStatus(prev => { const n = { ...prev }; delete n[userId]; return n; });
  };

  const saveAlias = async (userId: string) => {
    const alias = editingAlias[userId];
    if (alias === undefined) return;
    await upsertPresence(userId, { alias });
    setEditingAlias(prev => { const n = { ...prev }; delete n[userId]; return n; });
  };

  return (
    <div className="space-y-6">
      {/* ── Add Bartender ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4" />
            เพิ่ม Bartender
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            เลือกผู้ใช้ที่ต้องการให้เป็น Bartender แล้วตั้งค่า alias และสถานะเริ่มต้น
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">เลือกผู้ใช้</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- เลือกผู้ใช้ --</option>
                {nonBartenderProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.username ?? p.id}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Alias (ชื่อที่แสดง)</Label>
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="☕ Bartender"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ข้อความสถานะ</Label>
              <Input
                value={newStatusText}
                onChange={(e) => setNewStatusText(e.target.value)}
                placeholder="🧸 พร้อมคุย"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={addBartender}
                disabled={!selectedUserId || isAdding}
                className="w-full gap-2"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                เพิ่ม Bartender
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bartender List ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coffee className="w-4 h-4" />
              ทีม Bartender
              <Badge variant="secondary">{rows.length} คน</Badge>
            </CardTitle>
            <Input
              className="w-full sm:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ..."
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              ยังไม่มี Bartender — เพิ่มจากด้านบนได้เลย
            </div>
          )}

          {bartenderRows.length === 0 && rows.length > 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              ไม่พบผู้ใช้ที่ค้นหา
            </div>
          )}

          {bartenderRows.map((row) => {
            const profile = profileMap.get(row.user_id);
            const isSaving = savingId === row.user_id;
            const statusVal = editingStatus[row.user_id] ?? row.status_text;
            const aliasVal = editingAlias[row.user_id] ?? (row.alias ?? '');

            return (
              <div
                key={row.user_id}
                className="rounded-xl border border-latte/40 dark:border-coffee/30 bg-card/60 p-4 space-y-3 hover:border-honey/30 transition-colors"
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-9 h-9 rounded-full shrink-0" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-base">🐻</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{profile?.username ?? row.user_id}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.alias ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={row.is_online ? 'default' : 'secondary'} className="text-xs">
                      {row.is_online ? '🟢 Online' : '🌙 Offline'}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${row.is_available ? 'bg-honey/20 text-honey border-honey/30' : 'bg-muted text-muted-foreground'}`}
                    >
                      {row.is_available ? '☕ Available' : '🍵 Busy'}
                    </Badge>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isSaving}
                      onClick={() => removeBartender(row.user_id)}
                      className="gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบ
                    </Button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-latte/40 dark:border-coffee/30 bg-muted/30 px-3 py-2">
                    <Label className="text-xs cursor-pointer">เปิดใช้งาน</Label>
                    <Switch
                      checked={row.is_enabled}
                      disabled={isSaving}
                      onCheckedChange={(v) => upsertPresence(row.user_id, { is_enabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-latte/40 dark:border-coffee/30 bg-muted/30 px-3 py-2">
                    <Label className="text-xs cursor-pointer">Standby</Label>
                    <Switch
                      checked={row.standby_mode}
                      disabled={isSaving}
                      onCheckedChange={(v) => upsertPresence(row.user_id, { standby_mode: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-latte/40 dark:border-coffee/30 bg-muted/30 px-3 py-2">
                    <Label className="text-xs cursor-pointer">Available</Label>
                    <Switch
                      checked={row.is_available}
                      disabled={isSaving}
                      onCheckedChange={(v) => upsertPresence(row.user_id, { is_available: v })}
                    />
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Alias</Label>
                    <div className="flex gap-2">
                      <Input
                        value={aliasVal}
                        onChange={(e) => setEditingAlias(prev => ({ ...prev, [row.user_id]: e.target.value }))}
                        placeholder="☕ Bartender"
                        className="text-sm"
                        disabled={isSaving}
                      />
                      {editingAlias[row.user_id] !== undefined && (
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => saveAlias(row.user_id)}
                        >
                          บันทึก
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">ข้อความสถานะ</Label>
                    <div className="flex gap-2">
                      <Input
                        value={statusVal}
                        onChange={(e) => setEditingStatus(prev => ({ ...prev, [row.user_id]: e.target.value }))}
                        placeholder="🧸 พร้อมคุย"
                        className="text-sm"
                        disabled={isSaving}
                      />
                      {editingStatus[row.user_id] !== undefined && (
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => saveStatusText(row.user_id)}
                        >
                          บันทึก
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
