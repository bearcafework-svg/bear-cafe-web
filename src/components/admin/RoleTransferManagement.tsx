import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Search, Loader2, ShieldBan, CheckCircle2, XCircle, User, ArrowLeftRight, History, ChevronDown, RefreshCw, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
}

interface MemberPreview {
  id: string;
  username: string;
  avatar: string | null;
}

interface RolePreview {
  id: string;
  name: string;
  color: string | null;
  managed: boolean;
  blocked: boolean;
  blockReason: string | null;
}

interface TransferLog {
  id: string;
  source_discord_id: string;
  source_username: string | null;
  target_discord_id: string;
  target_username: string | null;
  roles_transferred: string[];
  roles_skipped: string[];
  status: string;
  created_at: string;
  completed_at: string | null;
  transferred_by: string | null;
  profiles?: { username: string; avatar_url: string | null } | null;
}

export function RoleTransferManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [sourceDiscordId, setSourceDiscordId] = useState('');
  const [targetDiscordId, setTargetDiscordId] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [sourceMember, setSourceMember] = useState<MemberPreview | null>(null);
  const [targetMember, setTargetMember] = useState<MemberPreview | null>(null);
  const [roles, setRoles] = useState<RolePreview[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferResult, setTransferResult] = useState<{ transferred: number; skipped: number } | null>(null);
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const { toast } = useToast();

  // Fetch all profiles on mount
  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, discord_id, username, avatar_url')
          .order('username');
        if (error) throw error;
        setProfiles(data || []);
      } catch (e) {
        console.error('Error loading profiles:', e);
      } finally {
        setLoadingProfiles(false);
      }
    }
    loadProfiles();
  }, []);

  const filterProfiles = (query: string, excludeId?: string) => {
    const q = query.toLowerCase().trim();
    return profiles.filter(p => {
      if (excludeId && p.discord_id === excludeId) return false;
      if (!q) return true;
      return (
        p.username.toLowerCase().includes(q) ||
        p.discord_id.includes(q) ||
        ((p as any).discord_username ?? '').toLowerCase().includes(q)
      );
    });
  };

  const filteredSourceProfiles = useMemo(() => filterProfiles(sourceSearch, targetDiscordId), [sourceSearch, profiles, targetDiscordId]);
  const filteredTargetProfiles = useMemo(() => filterProfiles(targetSearch, sourceDiscordId), [targetSearch, profiles, sourceDiscordId]);

  const selectedSourceProfile = profiles.find(p => p.discord_id === sourceDiscordId);
  const selectedTargetProfile = profiles.find(p => p.discord_id === targetDiscordId);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('role_transfer_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const rows = (data as any[]) || [];

      // Fetch operator profiles separately (no FK relationship)
      const operatorIds = [...new Set(rows.map((r: any) => r.transferred_by).filter(Boolean))];
      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      if (operatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', operatorIds);
        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
        });
      }

      setLogs(rows.map((r: any) => ({
        ...r,
        profiles: r.transferred_by ? (profileMap[r.transferred_by] ?? null) : null,
      })));
    } catch (e) {
      console.error('Error fetching transfer logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-preview when source is selected
  useEffect(() => {
    if (sourceDiscordId) previewSource(sourceDiscordId);
    else { setSourceMember(null); setRoles([]); setSelectedRoles(new Set()); setTransferResult(null); }
  }, [sourceDiscordId]);

  // Auto-preview target when selected
  useEffect(() => {
    if (targetDiscordId) previewTarget(targetDiscordId);
    else setTargetMember(null);
  }, [targetDiscordId]);

  async function previewSource(discordId: string) {
    setLoading(true);
    setRoles([]);
    setSourceMember(null);
    setSelectedRoles(new Set());
    setTransferResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'กรุณาเข้าสู่ระบบ', variant: 'destructive' }); return; }

      const { data, error } = await supabase.functions.invoke('transfer-roles', {
        body: { action: 'preview', sourceDiscordId: discordId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.member) setSourceMember(data.member);
      if (data?.roles) {
        setRoles(data.roles);
        const transferable = data.roles.filter((r: RolePreview) => !r.blocked).map((r: RolePreview) => r.id);
        setSelectedRoles(new Set(transferable));
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error?.message || 'ไม่สามารถดึงข้อมูลได้', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function previewTarget(discordId: string) {
    setLoadingTarget(true);
    setTargetMember(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('transfer-roles', {
        body: { action: 'preview', sourceDiscordId: discordId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.member) setTargetMember(data.member);
    } catch (error: any) {
      toast({ title: 'ไม่พบผู้ใช้ปลายทาง', description: error?.message || '', variant: 'destructive' });
    } finally {
      setLoadingTarget(false);
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  function selectAllTransferable() {
    const transferable = roles.filter(r => !r.blocked).map(r => r.id);
    setSelectedRoles(new Set(transferable));
  }

  function deselectAll() {
    setSelectedRoles(new Set());
  }

  async function executeTransfer() {
    setTransferring(true);
    setConfirmOpen(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('transfer-roles', {
        body: {
          action: 'transfer',
          sourceDiscordId: sourceDiscordId,
          targetDiscordId: targetDiscordId,
          rolesToTransfer: Array.from(selectedRoles),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setTransferResult({ transferred: data.transferred, skipped: data.skipped });
      toast({ title: 'ย้ายบทบาทสำเร็จ', description: data.message });

      setTimeout(() => { previewSource(sourceDiscordId); if (logsOpen) fetchLogs(); }, 1500);
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error?.message || 'ไม่สามารถย้ายบทบาทได้', variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  }

  const transferableCount = roles.filter(r => !r.blocked).length;
  const blockedCount = roles.filter(r => r.blocked).length;
  const selectedCount = selectedRoles.size;
  const progressPercent = transferableCount > 0 ? (selectedCount / transferableCount) * 100 : 0;

  function ProfileCombobox({
    value, onSelect, open, setOpen, search, setSearch, filteredProfiles, selectedProfile, placeholder, loading: comboLoading
  }: {
    value: string;
    onSelect: (discordId: string) => void;
    open: boolean;
    setOpen: (v: boolean) => void;
    search: string;
    setSearch: (v: string) => void;
    filteredProfiles: Profile[];
    selectedProfile?: Profile;
    placeholder: string;
    loading?: boolean;
  }) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 font-normal">
            {selectedProfile ? (
              <div className="flex items-center gap-2 min-w-0">
                {selectedProfile.avatar_url ? (
                  <img src={selectedProfile.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs shrink-0">👤</div>
                )}
                <span className="truncate">{selectedProfile.username}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{selectedProfile.discord_id}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="ค้นหาชื่อหรือ Discord ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <CommandList>
              <CommandEmpty>
                {loadingProfiles ? 'กำลังโหลด...' : 'ไม่พบผู้ใช้'}
              </CommandEmpty>
              <CommandGroup>
                {filteredProfiles.slice(0, 50).map(profile => (
                  <CommandItem
                    key={profile.id}
                    value={profile.discord_id}
                    onSelect={() => { onSelect(profile.discord_id); setOpen(false); setSearch(''); }}
                    className="flex items-center gap-2"
                  >
                    <Check className={cn("mr-1 h-4 w-4", value === profile.discord_id ? "opacity-100" : "opacity-0")} />
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs shrink-0">👤</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{profile.username}</p>
                      <p className="text-xs text-muted-foreground font-mono">{profile.discord_id}</p>
                      {(profile as any).discord_username && (
                        <p className="text-xs text-muted-foreground">@{(profile as any).discord_username}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source & Target Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              ผู้ทำเรื่องย้าย (ต้นทาง)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProfileCombobox
              value={sourceDiscordId}
              onSelect={setSourceDiscordId}
              open={sourceOpen}
              setOpen={setSourceOpen}
              search={sourceSearch}
              setSearch={setSourceSearch}
              filteredProfiles={filteredSourceProfiles}
              selectedProfile={selectedSourceProfile}
              placeholder="เลือกผู้ใช้ต้นทาง..."
            />
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดข้อมูลยศ...
              </div>
            )}
            {sourceMember && !loading && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {sourceMember.avatar ? (
                  <img src={sourceMember.avatar} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">👤</div>
                )}
                <div>
                  <p className="font-medium">{sourceMember.username}</p>
                  <p className="text-xs text-muted-foreground">{sourceMember.id}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Target */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              ย้ายไปยัง (ปลายทาง)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProfileCombobox
              value={targetDiscordId}
              onSelect={setTargetDiscordId}
              open={targetOpen}
              setOpen={setTargetOpen}
              search={targetSearch}
              setSearch={setTargetSearch}
              filteredProfiles={filteredTargetProfiles}
              selectedProfile={selectedTargetProfile}
              placeholder="เลือกผู้ใช้ปลายทาง..."
            />
            {loadingTarget && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
              </div>
            )}
            {targetMember && !loadingTarget && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {targetMember.avatar ? (
                  <img src={targetMember.avatar} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">👤</div>
                )}
                <div>
                  <p className="font-medium">{targetMember.username}</p>
                  <p className="text-xs text-muted-foreground">{targetMember.id}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Roles Selection */}
      {roles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                เลือกยศที่ต้องการย้าย
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllTransferable}>เลือกทั้งหมด</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>ยกเลิกทั้งหมด</Button>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  เลือกแล้ว {selectedCount} / {transferableCount} ยศ
                  {blockedCount > 0 && <span className="text-amber-500 ml-2">(ห้ามย้าย {blockedCount} ยศ)</span>}
                </span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {roles.map(role => {
                const isBlocked = role.blocked;
                const isChecked = selectedRoles.has(role.id);
                return (
                  <div
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isBlocked
                        ? 'bg-muted/30 border-amber-500/30 opacity-60 cursor-not-allowed'
                        : isChecked
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-card hover:bg-muted/40 border-border'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleRole(role.id)}
                      disabled={isBlocked}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium text-sm truncate"
                          style={{ color: role.color || undefined }}
                        >
                          {role.name}
                        </span>
                        {isBlocked && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-500 shrink-0">
                            <ShieldBan className="w-3 h-3 mr-0.5" />
                            {role.blockReason === 'non_transferable' ? 'ห้ามย้าย' : 'Bot'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transfer Result */}
            {transferResult && (
              <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    ย้ายสำเร็จ {transferResult.transferred} ยศ
                  </p>
                  {transferResult.skipped > 0 && (
                    <p className="text-muted-foreground mt-1">ข้ามไป {transferResult.skipped} ยศ (ห้ามย้าย)</p>
                  )}
                </div>
              </div>
            )}

            {/* Transfer Button */}
            <div className="mt-6 flex justify-end">
              <Button
                size="lg"
                onClick={() => setConfirmOpen(true)}
                disabled={selectedCount === 0 || !targetMember || transferring}
                className="gap-2"
              >
                {transferring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                ย้าย {selectedCount} ยศ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Logs */}
      <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  ประวัติการย้ายบทบาท
                </CardTitle>
                <div className="flex items-center gap-2">
                  {logsOpen && (
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); fetchLogs(); }}>
                      <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {loadingLogs ? (
                <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติการย้ายบทบาท</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ผู้ดำเนินการ</TableHead>
                        <TableHead>ต้นทาง</TableHead>
                        <TableHead></TableHead>
                        <TableHead>ปลายทาง</TableHead>
                        <TableHead>ย้ายสำเร็จ</TableHead>
                        <TableHead>ข้าม</TableHead>
                        <TableHead>สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '}
                            {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell>
                            {log.profiles ? (
                              <div className="flex items-center gap-2">
                                {log.profiles.avatar_url ? (
                                  <img src={log.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] shrink-0">👤</div>
                                )}
                                <span className="text-sm font-medium truncate">{log.profiles.username}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{log.source_username || '-'}</p>
                              <p className="text-xs text-muted-foreground font-mono">{log.source_discord_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{log.target_username || '-'}</p>
                              <p className="text-xs text-muted-foreground font-mono">{log.target_discord_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {log.roles_transferred?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(log.roles_skipped?.length || 0) > 0 ? (
                              <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/50">
                                <ShieldBan className="w-3 h-3" />
                                {log.roles_skipped.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'completed' ? 'default' : log.status === 'partial' ? 'secondary' : 'outline'}
                              className={log.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0' : ''}>
                              {log.status === 'completed' ? 'สำเร็จ' : log.status === 'partial' ? 'บางส่วน' : log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการย้ายบทบาท</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>ย้าย <strong>{selectedCount} ยศ</strong> จาก <strong>{sourceMember?.username}</strong> ไปยัง <strong>{targetMember?.username}</strong></p>
              <p className="text-amber-500">⚠️ ยศจะถูกลบออกจากผู้ใช้ต้นทางและเพิ่มให้ผู้ใช้ปลายทาง</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={executeTransfer}>ยืนยันย้าย</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
