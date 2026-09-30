import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowRight, Search, Loader2, ShieldBan, CheckCircle2, XCircle, User, ArrowLeftRight, History, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, ChevronsUpDown, Check, Trash2, ExternalLink, Calendar, AlertTriangle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

interface Profile {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  discord_username?: string | null;
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
  deleteOnTransfer: boolean;
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

function cleanDiscordId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const mentionMatch = trimmed.match(/<@!?(\d+)>/);
  if (mentionMatch) return mentionMatch[1];
  // If it contains only digits or looks like a snowflake
  const digitsOnly = trimmed.replace(/\s+/g, '');
  return digitsOnly;
}

export function RoleTransferManagement() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [sourceDiscordId, setSourceDiscordId] = useState('');
  const [targetDiscordId, setTargetDiscordId] = useState('');
  const [sourceMember, setSourceMember] = useState<MemberPreview | null>(null);
  const [targetMember, setTargetMember] = useState<MemberPreview | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RolePreview[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferResult, setTransferResult] = useState<{ transferred: number; skipped: number; deleted: number } | null>(null);
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  // Log filter & pagination state
  const [logSearch, setLogSearch] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const { toast } = useToast();

  // Fetch all profiles on mount
  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, discord_id, username, discord_username, avatar_url')
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
    if (sourceDiscordId) {
      previewSource(sourceDiscordId);
    } else {
      setSourceMember(null);
      setRoles([]);
      setSelectedRoles(new Set());
      setTransferResult(null);
      setSourceError(null);
    }
  }, [sourceDiscordId]);

  // Auto-preview target when selected
  useEffect(() => {
    if (targetDiscordId) {
      previewTarget(targetDiscordId);
    } else {
      setTargetMember(null);
      setTargetError(null);
    }
  }, [targetDiscordId]);

  async function previewSource(discordId: string) {
    const cleanId = cleanDiscordId(discordId);
    if (!cleanId) return;

    setLoading(true);
    setRoles([]);
    setSourceMember(null);
    setSourceError(null);
    setSelectedRoles(new Set());
    setTransferResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'กรุณาเข้าสู่ระบบ', variant: 'destructive' }); return; }

      const { data, error } = await supabase.functions.invoke('transfer-roles', {
        body: { action: 'preview', sourceDiscordId: cleanId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.member) setSourceMember(data.member);
      if (data?.roles) {
        setRoles(data.roles);
        // Pre-select all transferable roles; deleteOnTransfer are also pre-selected (locked)
        const transferable = data.roles
          .filter((r: RolePreview) => !r.blocked)
          .map((r: RolePreview) => r.id);
        setSelectedRoles(new Set(transferable));
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      const errMsg = error?.message || 'ไม่สามารถดึงข้อมูลจากบอทได้ (ตรวจสอบว่า Discord ID ถูกต้องและผู้ใช้อยู่ในเซิร์ฟเวอร์)';
      setSourceError(errMsg);
      toast({ title: 'เกิดข้อผิดพลาด', description: errMsg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function previewTarget(discordId: string) {
    const cleanId = cleanDiscordId(discordId);
    if (!cleanId) return;

    setLoadingTarget(true);
    setTargetMember(null);
    setTargetError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('transfer-roles', {
        body: { action: 'preview', sourceDiscordId: cleanId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.member) setTargetMember(data.member);
    } catch (error: any) {
      const errMsg = error?.message || 'ไม่พบผู้ใช้ปลายทางในเซิร์ฟเวอร์ Discord';
      setTargetError(errMsg);
      toast({ title: 'ไม่พบผู้ใช้ปลายทาง', description: errMsg, variant: 'destructive' });
    } finally {
      setLoadingTarget(false);
    }
  }

  function toggleRole(roleId: string) {
    // deleteOnTransfer roles are always locked — cannot be toggled
    const role = roles.find(r => r.id === roleId);
    if (role?.deleteOnTransfer) return;
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  function selectAllTransferable() {
    // Include non-blocked roles; deleteOnTransfer roles are always included via lock
    const transferable = roles.filter(r => !r.blocked).map(r => r.id);
    setSelectedRoles(new Set(transferable));
  }

  function deselectAll() {
    // Keep deleteOnTransfer roles checked (they are always selected)
    const alwaysSelected = roles.filter(r => r.deleteOnTransfer && !r.blocked).map(r => r.id);
    setSelectedRoles(new Set(alwaysSelected));
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
          sourceDiscordId: cleanDiscordId(sourceDiscordId),
          targetDiscordId: cleanDiscordId(targetDiscordId),
          rolesToTransfer: Array.from(selectedRoles),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setTransferResult({ transferred: data.transferred, skipped: data.skipped, deleted: data.deleted ?? 0 });
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
  const deleteOnTransferCount = roles.filter(r => r.deleteOnTransfer).length;
  const selectedCount = selectedRoles.size;
  const progressPercent = transferableCount > 0 ? (selectedCount / transferableCount) * 100 : 0;

  // Derived: filter logs by search query and date range, then paginate
  const filteredLogs = useMemo(() => {
    const q = logSearch.toLowerCase().trim();
    const from = logDateFrom ? new Date(logDateFrom + 'T00:00:00') : null;
    const to = logDateTo ? new Date(logDateTo + 'T23:59:59') : null;
    return logs.filter(log => {
      if (q) {
        const match =
          (log.source_username || '').toLowerCase().includes(q) ||
          log.source_discord_id.includes(q) ||
          (log.target_username || '').toLowerCase().includes(q) ||
          log.target_discord_id.includes(q) ||
          (log.profiles?.username || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (from || to) {
        const d = new Date(log.created_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [logs, logSearch, logDateFrom, logDateTo]);

  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setLogPage(1); }, [logSearch, logDateFrom, logDateTo]);

  /**
   * Enhanced Member Input & Selector Component
   * Supports:
   * 1. Direct Discord ID input (for non-logged-in users via Bot fetch)
   * 2. Searchable dropdown for registered web users
   * 3. Instant clear / change / reload
   */
  function MemberInputCard({
    title,
    icon: Icon,
    discordId,
    onSelectId,
    member,
    profile,
    loading,
    error,
    excludeDiscordId,
    placeholder,
  }: {
    title: string;
    icon: React.ElementType;
    discordId: string;
    onSelectId: (id: string) => void;
    member: MemberPreview | null;
    profile?: Profile;
    loading: boolean;
    error: string | null;
    excludeDiscordId?: string;
    placeholder: string;
  }) {
    const [mode, setMode] = useState<'search' | 'direct'>('search');
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [directInput, setDirectInput] = useState('');

    const filtered = useMemo(() => {
      const q = search.toLowerCase().trim();
      return profiles.filter(p => {
        if (excludeDiscordId && p.discord_id === excludeDiscordId) return false;
        if (!q) return true;
        return (
          p.username.toLowerCase().includes(q) ||
          p.discord_id.includes(q) ||
          ((p as any).discord_username ?? '').toLowerCase().includes(q)
        );
      });
    }, [search, excludeDiscordId]);

    const cleanedSearch = cleanDiscordId(search);
    const isSearchLooksLikeId = cleanedSearch.length >= 6;

    const handleApplyDirectId = () => {
      const cleaned = cleanDiscordId(directInput);
      if (!cleaned) {
        toast({ title: 'กรุณากรอก Discord ID', variant: 'destructive' });
        return;
      }
      onSelectId(cleaned);
    };

    const handleClear = () => {
      onSelectId('');
      setDirectInput('');
      setSearch('');
    };

    return (
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {title}
            </CardTitle>
            {discordId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                เปลี่ยนผู้ใช้
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* If user is selected & loaded */}
          {discordId && (member || profile) ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-honey/10 border border-honey/20">
                {member?.avatar || profile?.avatar_url ? (
                  <img
                    src={member?.avatar || profile?.avatar_url || ''}
                    alt=""
                    className="w-12 h-12 rounded-full border border-border/60 shadow-xs object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-honey/20 flex items-center justify-center text-xl shrink-0">👤</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">
                      {member?.username || profile?.username}
                    </p>
                    {profile ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        สมาชิกในเว็บ
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-600 border-sky-500/30">
                        Discord Bot Member
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {discordId}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(discordId);
                        toast({ title: 'คัดลอก ID แล้ว' });
                      }}
                      title="คัดลอก Discord ID"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  {profile?.discord_username && (
                    <p className="text-[11px] text-muted-foreground">@{profile.discord_username}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl shrink-0"
                  onClick={() => onSelectId(discordId)}
                  title="รีเฟรชข้อมูล"
                  disabled={loading}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                </Button>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  กำลังดึงข้อมูลยศจากบอท...
                </div>
              )}
            </div>
          ) : (
            /* Input / Selection Form */
            <div className="space-y-2.5">
              {/* Mode Toggle Tabs */}
              <div className="flex items-center p-1 bg-muted/60 rounded-xl gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('search')}
                  className={cn(
                    "flex-1 py-1 px-2.5 rounded-lg font-medium transition-all text-center",
                    mode === 'search'
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  เลือกจากสมาชิกเว็บ
                </button>
                <button
                  type="button"
                  onClick={() => setMode('direct')}
                  className={cn(
                    "flex-1 py-1 px-2.5 rounded-lg font-medium transition-all text-center",
                    mode === 'direct'
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ระบุ Discord ID โดยตรง
                </button>
              </div>

              {mode === 'search' ? (
                /* Search Combobox */
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between h-10 font-normal rounded-xl border-border/80"
                    >
                      <span className="text-muted-foreground truncate">{placeholder}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] sm:w-[420px] p-0 rounded-2xl" align="start">
                    <Command shouldFilter={false}>
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="พิมพ์ชื่อ, Discord ID หรือ @mention..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <CommandList className="max-h-[300px]">
                        {/* Option to use raw typed ID directly via bot */}
                        {isSearchLooksLikeId && (
                          <div className="p-1 border-b border-border/50 bg-primary/5">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectId(cleanedSearch);
                                setOpen(false);
                                setSearch('');
                              }}
                              className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-primary/10 transition-colors text-primary font-medium text-xs"
                            >
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">ใช้ Discord ID: <strong className="font-mono">{cleanedSearch}</strong> (ดึงข้อมูลผ่านบอท)</span>
                            </button>
                          </div>
                        )}

                        {filtered.length === 0 && !isSearchLooksLikeId && (
                          <CommandEmpty>
                            {loadingProfiles ? 'กำลังโหลด...' : 'ไม่พบสมาชิกในเว็บ (สามารถพิมพ์ Discord ID เพื่อค้นหาผ่านบอทได้)'}
                          </CommandEmpty>
                        )}

                        <CommandGroup heading="สมาชิกในเว็บ">
                          {filtered.slice(0, 40).map(p => (
                            <CommandItem
                              key={p.id}
                              value={p.discord_id}
                              onSelect={() => {
                                onSelectId(p.discord_id);
                                setOpen(false);
                                setSearch('');
                              }}
                              className="flex items-center gap-2.5 p-2 rounded-xl"
                            >
                              <Check className={cn("mr-1 h-3.5 w-3.5 shrink-0", discordId === p.discord_id ? "opacity-100" : "opacity-0")} />
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs shrink-0">👤</div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{p.username}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{p.discord_id}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                /* Direct Discord ID Input */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="ใส่ Discord ID (เช่น 123456789012345678)"
                      value={directInput}
                      onChange={(e) => setDirectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyDirectId();
                        }
                      }}
                      className="rounded-xl font-mono text-xs h-10"
                    />
                    <Button
                      type="button"
                      onClick={handleApplyDirectId}
                      disabled={!directInput.trim() || loading}
                      className="rounded-xl shrink-0 gap-1.5 text-xs h-10 px-3.5"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      ดึงข้อมูล
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    💡 กรอก Discord Snowflake ID (17-20 หลัก) หรือแท็ก mention เพื่อให้บอทดึงข้อมูลแม้ผู้ใช้ยังไม่เคยเข้าสู่ระบบเว็บ
                  </p>
                </div>
              )}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  กำลังดึงข้อมูลสมาชิกและยศจากบอท Discord...
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{error}</p>
                    <p className="text-[11px] opacity-80 mt-0.5">กรุณาตรวจสอบว่าผู้ใช้อยู่ในเซิร์ฟเวอร์ Bear Cafe และบอทมีสิทธิ์เข้าถึง</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner: link to roles-to-delete settings */}
      <div className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trash2 className="w-4 h-4 shrink-0 text-destructive" />
          <span>ยศที่ตั้งค่าไว้จะถูกลบออกจากต้นทางอัตโนมัติเมื่อย้าย (ไม่ถูกย้ายไปปลายทาง)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => navigate('/admin/roles-to-delete')}
        >
          จัดการรายการ
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

      {/* Source & Target Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source */}
        <MemberInputCard
          title="ผู้ทำเรื่องย้าย (ต้นทาง)"
          icon={User}
          discordId={sourceDiscordId}
          onSelectId={setSourceDiscordId}
          member={sourceMember}
          profile={selectedSourceProfile}
          loading={loading}
          error={sourceError}
          excludeDiscordId={targetDiscordId}
          placeholder="เลือกผู้ใช้ต้นทาง หรือระบุ Discord ID..."
        />

        {/* Target */}
        <MemberInputCard
          title="ย้ายไปยัง (ปลายทาง)"
          icon={ArrowRight}
          discordId={targetDiscordId}
          onSelectId={setTargetDiscordId}
          member={targetMember}
          profile={selectedTargetProfile}
          loading={loadingTarget}
          error={targetError}
          excludeDiscordId={sourceDiscordId}
          placeholder="เลือกผู้ใช้ปลายทาง หรือระบุ Discord ID..."
        />
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
                  {blockedCount > 0 && <span className="text-warning ml-2">(ห้ามย้าย {blockedCount} ยศ)</span>}
                  {deleteOnTransferCount > 0 && <span className="text-destructive ml-2">(ลบจากต้นทาง {deleteOnTransferCount} ยศ)</span>}
                </span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            {/* Normal transferable roles */}
            {roles.filter(r => !r.deleteOnTransfer).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">ย้ายไปปลายทาง</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {roles.filter(r => !r.deleteOnTransfer).map(role => {
                    const isBlocked = role.blocked;
                    const isChecked = selectedRoles.has(role.id);
                    return (
                      <div
                        key={role.id}
                        onClick={() => !isBlocked && toggleRole(role.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isBlocked
                            ? 'bg-warning/5 border-warning/20 opacity-60 cursor-not-allowed'
                            : isChecked
                              ? 'bg-honey/10 border-honey/30 cursor-pointer'
                              : 'bg-card hover:bg-latte/20 border-border cursor-pointer'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleRole(role.id)}
                          disabled={isBlocked}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-medium text-sm truncate"
                              style={{ color: role.color || undefined }}
                            >
                              {role.name}
                            </span>
                            {isBlocked && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning shrink-0">
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
              </div>
            )}

            {/* Delete-on-transfer roles — always selected, locked */}
            {roles.filter(r => r.deleteOnTransfer && !r.blocked).length > 0 && (
              <div>
                <p className="text-xs font-medium text-destructive/70 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  ลบจากต้นทาง (ไม่ถูกย้ายไปปลายทาง)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {roles.filter(r => r.deleteOnTransfer && !r.blocked).map(role => (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-destructive/5 border-destructive/20 cursor-not-allowed"
                    >
                      <Checkbox
                        checked={true}
                        disabled={true}
                        className="opacity-60"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-medium text-sm truncate"
                            style={{ color: role.color || undefined }}
                          >
                            {role.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive shrink-0">
                            <Trash2 className="w-3 h-3 mr-0.5" />
                            ลบจากต้นทาง
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

            {/* Transfer Result */}
            {transferResult && (
              <div className="mt-4 p-4 rounded-xl bg-honey/10 border border-honey/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-honey shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-honey">
                    ย้ายสำเร็จ {transferResult.transferred} ยศ
                  </p>
                  {transferResult.skipped > 0 && (
                    <p className="text-muted-foreground mt-1">ข้ามไป {transferResult.skipped} ยศ (ห้ามย้าย)</p>
                  )}
                  {transferResult.deleted > 0 && (
                    <p className="text-destructive/80 mt-1">ลบ {transferResult.deleted} ยศออกจากต้นทาง (ไม่ถูกย้ายไปปลายทาง)</p>
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
            <CardHeader className="cursor-pointer hover:bg-honey/5 transition-colors rounded-t-xl">
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
            <CardContent className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 h-9 text-sm"
                    placeholder="ค้นหาชื่อ, Discord ID, ผู้ดำเนินการ..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <DatePicker
                    value={logDateFrom}
                    onChange={setLogDateFrom}
                    placeholder="เริ่ม"
                    className="w-[140px]"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <DatePicker
                    value={logDateTo}
                    onChange={setLogDateTo}
                    placeholder="สิ้นสุด"
                    className="w-[140px]"
                  />
                </div>
                {(logSearch || logDateFrom || logDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs text-muted-foreground"
                    onClick={() => { setLogSearch(''); setLogDateFrom(''); setLogDateTo(''); }}
                  >
                    ล้างตัวกรอง
                  </Button>
                )}
              </div>

              {loadingLogs ? (
                <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {logs.length === 0 ? 'ยังไม่มีประวัติการย้ายบทบาท' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">วันที่</TableHead>
                          <TableHead className="whitespace-nowrap">ผู้ดำเนินการ</TableHead>
                          <TableHead className="whitespace-nowrap">ต้นทาง</TableHead>
                          <TableHead></TableHead>
                          <TableHead className="whitespace-nowrap">ปลายทาง</TableHead>
                          <TableHead className="whitespace-nowrap">ย้ายสำเร็จ</TableHead>
                          <TableHead className="whitespace-nowrap">ข้าม</TableHead>
                          <TableHead className="whitespace-nowrap">สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLogs.map(log => (
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
                                <Badge variant="outline" className="gap-1 text-warning border-warning/50">
                                  <ShieldBan className="w-3 h-3" />
                                  {log.roles_skipped.length}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'completed' ? 'default' : log.status === 'partial' ? 'secondary' : 'outline'}
                                className={log.status === 'completed' ? 'bg-success/15 text-success border-0' : ''}>
                                {log.status === 'completed' ? 'สำเร็จ' : log.status === 'partial' ? 'บางส่วน' : log.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-sm text-muted-foreground">
                      แสดง {Math.min((logPage - 1) * LOG_PAGE_SIZE + 1, filteredLogs.length)}–{Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} จาก {filteredLogs.length} รายการ
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {Array.from({ length: logTotalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === logTotalPages || Math.abs(p - logPage) <= 1)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                          ) : (
                            <Button
                              key={p}
                              variant={logPage === p ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 w-8 p-0 text-xs"
                              onClick={() => setLogPage(p as number)}
                            >
                              {p}
                            </Button>
                          )
                        )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))}
                        disabled={logPage === logTotalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
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
              <p className="text-warning flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-warning shrink-0" /> ยศจะถูกลบออกจากผู้ใช้ต้นทางและเพิ่มให้ผู้ใช้ปลายทาง</p>
              {deleteOnTransferCount > 0 && (
                <p className="text-destructive flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-destructive shrink-0" /> ยศที่ตั้งค่าให้ลบ {deleteOnTransferCount} ยศ จะถูกลบออกจากต้นทางโดยไม่ถูกย้ายไปปลายทาง</p>
              )}
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
