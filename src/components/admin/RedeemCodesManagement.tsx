import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Copy, Edit, Check, ChevronsUpDown, Loader2, Plus, Power, Search, Trash2,
  ChevronLeft, ChevronRight, Pencil, RotateCcw, MinusCircle, PlusCircle,
} from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatNumber } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { formatThaiDate } from '@/lib/thai-date';

type RewardType = 'points' | 'role' | 'both';
type StatusFilter = 'all' | 'enabled' | 'disabled' | 'expired' | 'not_started';

type RedeemCode = {
  code: string;
  reward_type: string | null;
  points: number | null;
  role_id: string | null;
  max_uses: number | null;
  used_count: number | null;
  start_at: string | null;
  end_at: string | null;
  is_enabled: boolean | null;
  created_at: string | null;
};

type RedeemLog = {
  id: string;
  redeemed_at: string | null;
  discord_id: string | null;
  code: string | null;
  reward_details: any;
};

type UserPoint = {
  discord_id: string;
  points: number;
  max_cap: number;
  updated_at: string | null;
};

type FormState = {
  code: string;
  rewardType: RewardType;
  points: string;
  roleId: string;
  startAt: string;
  endAt: string;
  maxUses: string;
  enabled: boolean;
};

const defaultForm: FormState = {
  code: '', rewardType: 'points', points: '0', roleId: '',
  startAt: '', endAt: '', maxUses: '0', enabled: true,
};

const ITEMS_PER_PAGE = 20;

export function RedeemCodesManagement({ initialTab = 'codes' }: { initialTab?: string }) {
  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="codes">โค้ดแลกรับ</TabsTrigger>
        <TabsTrigger value="logs">ประวัติการแลก</TabsTrigger>
        <TabsTrigger value="users">แต้มผู้ใช้ทั้งหมด</TabsTrigger>
      </TabsList>
      <TabsContent value="codes"><CodesTab /></TabsContent>
      <TabsContent value="logs"><LogsTab /></TabsContent>
      <TabsContent value="users"><UserPointsTab /></TabsContent>
    </Tabs>
  );
}

/* ═══════════════════════════════════════════════════════
   Codes Tab
   ═══════════════════════════════════════════════════════ */
function CodesTab() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<RedeemCode | null>(null);
  const [discordRoles, setDiscordRoles] = useState<{ discord_role_id: string; display_name: string; emoji: string | null; color: string | null }[]>([]);
  const [discordRolesLoading, setDiscordRolesLoading] = useState(false);

  useEffect(() => { fetchCodes(); }, []);

  useEffect(() => {
    if (dialogOpen && (formState.rewardType === 'role' || formState.rewardType === 'both')) {
      fetchDiscordRoles();
    }
  }, [dialogOpen, formState.rewardType]);

  async function fetchDiscordRoles() {
    if (discordRoles.length > 0) return;
    setDiscordRolesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const roles = (data?.roles ?? []) as { id: string; name: string; color: string | null; icon: string | null; unicode_emoji: string | null }[];
      setDiscordRoles(roles.map(r => ({
        discord_role_id: r.id, display_name: r.name,
        emoji: r.icon || r.unicode_emoji || null, color: r.color,
      })));
    } catch (e) {
      console.error('Failed to fetch discord roles:', e);
    } finally {
      setDiscordRolesLoading(false);
    }
  }

  async function fetchCodes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('redeem_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCodes(data ?? []);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดรายการโค้ดได้', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const filteredCodes = useMemo(() => {
    return codes.filter(c => {
      if (!c.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter === 'all') return true;
      return getStatus(c) === statusFilter;
    });
  }, [codes, searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setEditingCode(null);
    setFormState(defaultForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: RedeemCode) => {
    setEditingCode(c);
    setFormState({
      code: c.code,
      rewardType: (c.reward_type as RewardType) ?? 'points',
      points: `${c.points ?? 0}`,
      roleId: c.role_id ?? '',
      startAt: formatDateTimeLocal(c.start_at),
      endAt: formatDateTimeLocal(c.end_at),
      maxUses: `${c.max_uses ?? 0}`,
      enabled: c.is_enabled ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formState.code.trim()) {
      toast({ title: 'กรุณากรอกโค้ด', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const upsertData: any = {
        code: formState.code.trim().toUpperCase(),
        reward_type: formState.rewardType,
        points: formState.rewardType === 'role' ? 0 : Number(formState.points) || 0,
        role_id: formState.rewardType === 'points' ? null : formState.roleId.trim() || null,
        max_uses: Number(formState.maxUses) || 0,
        is_enabled: formState.enabled,
        start_at: formState.startAt ? new Date(formState.startAt).toISOString() : null,
        end_at: formState.endAt ? new Date(formState.endAt).toISOString() : null,
      };

      // If editing, don't change used_count
      if (!editingCode) {
        upsertData.used_count = 0;
      }

      const { error } = await supabase
        .from('redeem_codes')
        .upsert(upsertData, { onConflict: 'code' });

      if (error) throw error;
      await fetchCodes();
      toast({ title: 'บันทึกโค้ดเรียบร้อย' });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: RedeemCode) => {
    setActionCode(c.code);
    try {
      const { error } = await supabase
        .from('redeem_codes')
        .update({ is_enabled: !c.is_enabled })
        .eq('code', c.code);
      if (error) throw error;
      await fetchCodes();
      toast({ title: `${!c.is_enabled ? 'เปิด' : 'ปิด'}ใช้งานโค้ดแล้ว` });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setActionCode(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteCode) return;
    setActionCode(pendingDeleteCode.code);
    try {
      const { error } = await supabase
        .from('redeem_codes')
        .delete()
        .eq('code', pendingDeleteCode.code);
      if (error) throw error;
      await fetchCodes();
      toast({ title: 'ลบโค้ดเรียบร้อย' });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setActionCode(null);
      setDeleteDialogOpen(false);
      setPendingDeleteCode(null);
    }
  };

  return (
    <>
      <Card className="border-latte/40 dark:border-coffee/40 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg sm:text-xl font-semibold">โค้ดแลกรับ</CardTitle>
            <p className="text-sm text-muted-foreground">จัดการโค้ดแลกรับแต้มและยศ (Supabase)</p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มโค้ดใหม่
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหาโค้ด" className="w-full lg:max-w-xs" />
            <div className="w-full lg:w-60">
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger><SelectValue placeholder="กรองสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="enabled">เปิดใช้งาน</SelectItem>
                  <SelectItem value="disabled">ปิดใช้งาน</SelectItem>
                  <SelectItem value="not_started">ยังไม่เริ่ม</SelectItem>
                  <SelectItem value="expired">หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-latte/40 dark:border-coffee/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>ช่วงเวลา</TableHead>
                  <TableHead>Used / Max</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : filteredCodes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">ไม่พบรายการโค้ด</TableCell></TableRow>
                ) : filteredCodes.map(c => {
                  const status = getStatus(c);
                  const { variant, className: badgeClass } = getStatusBadgeStyles(status);
                  return (
                    <TableRow key={c.code}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.code}</span>
                          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(c.code); toast({ title: 'คัดลอกแล้ว' }); }}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{renderReward(c)}</TableCell>
                      <TableCell>{renderDateRange(c)}</TableCell>
                      <TableCell>{`${c.used_count ?? 0} / ${c.max_uses === 0 || !c.max_uses ? '∞' : c.max_uses}`}</TableCell>
                      <TableCell><Badge variant={variant} className={badgeClass}>{getStatusLabel(status)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggle(c)} disabled={actionCode === c.code}><Power className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setPendingDeleteCode(c); setDeleteDialogOpen(true); }} disabled={actionCode === c.code}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'แก้ไขโค้ด' : 'เพิ่มโค้ดใหม่'}</DialogTitle>
            <DialogDescription>กรอกข้อมูลโค้ดแลกรับให้ครบถ้วน</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Code</Label>
              <Input value={formState.code} onChange={e => setFormState(p => ({ ...p, code: e.target.value }))} placeholder="WELCOME2026" disabled={!!editingCode} />
            </div>
            <div className="space-y-2">
              <Label>Reward Type</Label>
              <Select value={formState.rewardType} onValueChange={v => setFormState(p => ({ ...p, rewardType: v as RewardType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">points</SelectItem>
                  <SelectItem value="role">role</SelectItem>
                  <SelectItem value="both">both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formState.rewardType === 'points' || formState.rewardType === 'both') && (
              <div className="space-y-2">
                <Label>Points</Label>
                <Input type="number" min="0" value={formState.points} onChange={e => setFormState(p => ({ ...p, points: e.target.value }))} />
              </div>
            )}
            {(formState.rewardType === 'role' || formState.rewardType === 'both') && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Discord Role</Label>
                {discordRolesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" />กำลังโหลดยศ...</div>
                ) : discordRoles.length === 0 ? (
                  <div>
                    <Input value={formState.roleId} onChange={e => setFormState(p => ({ ...p, roleId: e.target.value }))} placeholder="กรอก Role ID" />
                  </div>
                ) : (
                  <RoleCombobox roles={discordRoles} value={formState.roleId} onSelect={roleId => setFormState(p => ({ ...p, roleId }))} />
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Start At</Label>
              <Input type="datetime-local" value={formState.startAt} onChange={e => setFormState(p => ({ ...p, startAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>End At</Label>
              <Input type="datetime-local" value={formState.endAt} onChange={e => setFormState(p => ({ ...p, endAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Max Uses (0 = ไม่จำกัด)</Label>
              <Input type="number" min="0" value={formState.maxUses} onChange={e => setFormState(p => ({ ...p, maxUses: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Enabled</Label>
              <div className="flex items-center gap-3">
                <Switch checked={formState.enabled} onCheckedChange={checked => setFormState(p => ({ ...p, enabled: checked }))} />
                <span className="text-sm text-muted-foreground">{formState.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกโค้ด'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบโค้ด</AlertDialogTitle>
            <AlertDialogDescription>โค้ด <strong>{pendingDeleteCode?.code}</strong> จะถูกลบอย่างถาวร</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบโค้ดถาวร</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Redeem Logs Tab
   ═══════════════════════════════════════════════════════ */
function LogsTab() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<RedeemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [matchedDiscordIds, setMatchedDiscordIds] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setMatchedDiscordIds([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('discord_id')
          .or(`discord_id.ilike."%${trimmed}%",username.ilike."%${trimmed}%",discord_username.ilike."%${trimmed}%"`);
        setMatchedDiscordIds((data || []).map(p => p.discord_id));
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchLogs(); }, [page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      let query = supabase
        .from('redeem_logs')
        .select('*', { count: 'exact' })
        .order('redeemed_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      setLogs(data ?? []);
      setTotal(count ?? 0);
    } catch {
      toast({ title: 'โหลดประวัติไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase().trim();
    return logs.filter(l => 
      l.discord_id?.toLowerCase().includes(q) || 
      l.code?.toLowerCase().includes(q) ||
      (l.discord_id && matchedDiscordIds.includes(l.discord_id))
    );
  }, [logs, search, matchedDiscordIds]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <Card className="border-latte/40 dark:border-coffee/40 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">ประวัติการแลกโค้ด</CardTitle>
        <p className="text-sm text-muted-foreground">ทั้งหมด {total} รายการ</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา Discord ID / Code" className="pl-9" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discord ID</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>เวลาแลก</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.discord_id ?? '-'}</TableCell>
                  <TableCell className="font-medium">{l.code ?? '-'}</TableCell>
                  <TableCell className="text-sm">{formatRewardDetails(l.reward_details)}</TableCell>
                  <TableCell className="text-sm">{formatThaiDate(l.redeemed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   User Points Tab
   ═══════════════════════════════════════════════════════ */
function UserPointsTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  // Edit dialog state
  const [editUser, setEditUser] = useState<UserPoint | null>(null);
  const [editAction, setEditAction] = useState<'add' | 'sub' | 'set'>('add');
  const [editAmount, setEditAmount] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, [page, search]);

  async function fetchUsers() {
    setLoading(true);
    try {
      let query = supabase
        .from('user_points')
        .select('*', { count: 'exact' })
        .order('points', { ascending: false });

      if (search.trim()) {
        const q = search.trim();
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('discord_id')
          .or(`discord_id.ilike."%${q}%",username.ilike."%${q}%",discord_username.ilike."%${q}%"`);
        
        const matchedIds = (matchedProfiles || []).map(p => p.discord_id);
        if (!matchedIds.includes(q)) {
          matchedIds.push(q);
        }
        query = query.in('discord_id', matchedIds);
      }

      const { data, error, count } = await query
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
      if (error) throw error;
      setUsers(data ?? []);
      setTotal(count ?? 0);
    } catch {
      toast({ title: 'โหลดข้อมูลไม่สำเร็จ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const filtered = users;

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const openEdit = (u: UserPoint) => {
    setEditUser(u);
    setEditAction('add');
    setEditAmount('');
  };

  const handleEditSubmit = async () => {
    if (!editUser) return;
    const amt = Number(editAmount) || 0;
    if (editAction !== 'set' && amt <= 0) {
      toast({ title: 'กรุณากรอกจำนวนที่มากกว่า 0', variant: 'destructive' });
      return;
    }

    let newPoints: number;
    if (editAction === 'add') newPoints = editUser.points + amt;
    else if (editAction === 'sub') newPoints = editUser.points - amt;
    else newPoints = 0; // reset

    setEditSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_points')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('discord_id', editUser.discord_id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('ไม่พบข้อมูล');

      toast({ title: 'อัปเดตแต้มเรียบร้อย', description: `${editUser.discord_id}: ${formatNumber(editUser.points)} → ${formatNumber(newPoints)}` });
      setEditUser(null);
      await fetchUsers();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      <Card className="border-latte/40 dark:border-coffee/40 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">แต้มผู้ใช้ทั้งหมด</CardTitle>
          <p className="text-sm text-muted-foreground">ทั้งหมด {total} คน (รวมแต้มติดลบและ 0)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="ค้นหา Discord ID" className="pl-9" />
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discord ID</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Max Cap</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>อัปเดตล่าสุด</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                ) : filtered.map(u => {
                  const percent = u.max_cap > 0 ? Math.max(0, Math.min(100, (u.points / u.max_cap) * 100)) : 0;
                  const isNegative = u.points < 0;
                  return (
                    <TableRow key={u.discord_id}>
                      <TableCell className="font-mono text-xs">{u.discord_id}</TableCell>
                      <TableCell className={cn('font-bold', isNegative ? 'text-destructive' : 'text-foreground')}>
                        {u.points.toLocaleString()}
                      </TableCell>
                      <TableCell>{u.max_cap.toLocaleString()}</TableCell>
                      <TableCell className="w-32">
                        <Progress value={percent} className="h-2" />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatThaiDate(u.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="แก้ไขแต้ม">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Points Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขแต้ม</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs">{editUser?.discord_id}</span> — แต้มปัจจุบัน:{' '}
              <span className={cn('font-bold', (editUser?.points ?? 0) < 0 ? 'text-destructive' : '')}>{editUser?.points?.toLocaleString()}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={editAction === 'add' ? 'default' : 'outline'} className="flex-1 gap-1" onClick={() => setEditAction('add')}>
                <PlusCircle className="w-4 h-4" /> เพิ่ม
              </Button>
              <Button variant={editAction === 'sub' ? 'default' : 'outline'} className="flex-1 gap-1" onClick={() => setEditAction('sub')}>
                <MinusCircle className="w-4 h-4" /> ลด
              </Button>
              <Button variant={editAction === 'set' ? 'destructive' : 'outline'} className="flex-1 gap-1" onClick={() => setEditAction('set')}>
                <RotateCcw className="w-4 h-4" /> รีเซ็ต (0)
              </Button>
            </div>
            {editAction !== 'set' && (
              <div className="space-y-2">
                <Label>จำนวน</Label>
                <Input type="number" min="1" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="กรอกจำนวนแต้ม" />
              </div>
            )}
            {editUser && editAction !== 'set' && editAmount && Number(editAmount) > 0 && (
              <p className="text-sm text-muted-foreground">
                ผลลัพธ์: {editUser.points.toLocaleString()} {editAction === 'add' ? '+' : '−'} {Number(editAmount).toLocaleString()} ={' '}
                <span className="font-bold">
                  {(editAction === 'add' ? editUser.points + Number(editAmount) : editUser.points - Number(editAmount)).toLocaleString()}
                </span>
              </p>
            )}
            {editAction === 'set' && (
              <p className="text-sm text-destructive font-medium">แต้มจะถูกรีเซ็ตเป็น 0</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>ยกเลิก</Button>
            <Button onClick={handleEditSubmit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */
function getStatus(c: RedeemCode): StatusFilter {
  if (!c.is_enabled) return 'disabled';
  const now = new Date();
  if (c.start_at && new Date(c.start_at) > now) return 'not_started';
  if (c.end_at && new Date(c.end_at) < now) return 'expired';
  return 'enabled';
}

function getStatusLabel(s: StatusFilter) {
  const map: Record<string, string> = { enabled: 'เปิดใช้งาน', disabled: 'ปิดใช้งาน', not_started: 'ยังไม่เริ่ม', expired: 'หมดอายุ' };
  return map[s] ?? 'ไม่ทราบ';
}

function getStatusBadgeStyles(s: StatusFilter) {
  switch (s) {
    case 'enabled': return { variant: 'default' as const, className: 'bg-success text-success-foreground' };
    case 'disabled': return { variant: 'secondary' as const, className: 'text-muted-foreground' };
    case 'not_started': return { variant: 'outline' as const, className: 'border-amber-500 text-amber-600' };
    case 'expired': return { variant: 'destructive' as const, className: '' };
    default: return { variant: 'secondary' as const, className: '' };
  }
}

function renderReward(c: RedeemCode) {
  if (c.reward_type === 'both') return `+${formatNumber(c.points ?? 0)} แต้ม + ยศ`;
  if (c.reward_type === 'role') return `ยศ: ${c.role_id ?? '-'}`;
  return `+${formatNumber(c.points ?? 0)} แต้ม`;
}

function renderDateRange(c: RedeemCode) {
  return `${formatThaiDate(c.start_at)} – ${formatThaiDate(c.end_at)}`;
}

function formatRewardDetails(details: any): string {
  if (!details) return '-';
  const parts: string[] = [];
  if (details.pointsAdded) parts.push(`+${details.pointsAdded} แต้ม`);
  if (details.roleGranted) parts.push(`ยศ: ${details.roleGranted}`);
  return parts.length > 0 ? parts.join(', ') : '-';
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ─── Role Combobox ─── */
function RoleCombobox({ roles, value, onSelect }: {
  roles: { discord_role_id: string; display_name: string; emoji: string | null; color: string | null }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = roles.find(r => r.discord_role_id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <IconDisplay icon={selected.emoji} fallback="🎭" size="sm" />
              {selected.display_name}
            </span>
          ) : <span className="text-muted-foreground">เลือกยศ Discord...</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="ค้นหายศ..." />
          <CommandList>
            <CommandEmpty>ไม่พบยศที่ค้นหา</CommandEmpty>
            <CommandGroup>
              {roles.map(r => (
                <CommandItem key={r.discord_role_id} value={r.display_name} onSelect={() => { onSelect(r.discord_role_id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === r.discord_role_id ? 'opacity-100' : 'opacity-0')} />
                  <IconDisplay icon={r.emoji} fallback="🎭" size="sm" />
                  <span style={r.color ? { color: r.color } : undefined} className="ml-2">{r.display_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
