import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/retry';
import { useAdminNotification } from '@/components/admin/AdminNotificationToast';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, UserPlus, UserMinus, Key, Shield, Users, User, ChevronDown, ChevronUp,
  Search, Check, Copy, Sparkles,
} from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/admin/SearchBar';
import { StackedList, type StackedMemberItem } from '@/components/ui/stacked-list';
import { cn } from '@/lib/utils';

import { ASSIGNABLE_PAGES, getPermissionGroups } from '@/lib/admin-pages';

/* ─── Page options derived from shared admin pages config ─── */
const PAGE_OPTIONS = ASSIGNABLE_PAGES.map(p => ({ id: p.id, label: p.label, group: p.groupLabel }));

interface CustomPermission {
  id: string;
  name: string;
  description: string | null;
  allowed_pages: string[];
  color: string | null;
  created_at: string;
}

interface UserWithPermissions {
  id: string;
  username: string;
  avatar_url: string | null;
  discord_id: string;
  permissions: { permission_id: string; permission_name: string }[];
}

interface AssignedUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  permission_id: string;
}

export function PermissionsManagement() {
  const { notify } = useAdminNotification();
  const { user } = useAuth();

  const [permissions, setPermissions] = useState<CustomPermission[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<CustomPermission | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formPages, setFormPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CustomPermission | null>(null);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPermission, setAssignPermission] = useState<CustomPermission | null>(null);
  const [allUsers, setAllUsers] = useState<UserWithPermissions[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignTab, setAssignTab] = useState<'current' | 'add'>('current');

  // View mode
  const [viewMode, setViewMode] = useState<'stacked' | 'cards'>('stacked');

  // All assigned users (for cards + grouped view)
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [allProfiles, setAllProfiles] = useState<Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    discord_username: string | null;
    discord_id: string | null;
  }>>([]);
  const [expandedPermId, setExpandedPermId] = useState<string | null>(null);

  // Quick user perm assignment dialog (from drawer)
  const [userQuickDialogUser, setUserQuickDialogUser] = useState<{ id: string; username: string } | null>(null);
  const [userQuickPermIds, setUserQuickPermIds] = useState<string[]>([]);
  const [savingUserQuick, setSavingUserQuick] = useState(false);

  // New Search & Assign Member Modal
  const [assignMemberModalOpen, setAssignMemberModalOpen] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from('custom_permissions')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
      });
      setPermissions((data || []).map(d => ({
        ...d,
        allowed_pages: d.allowed_pages as string[],
      })));
    } catch (e) {
      console.error(e);
      notify.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลสิทธิ์จากระบบได้');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const fetchAssignedUsers = useCallback(async () => {
    try {
      const [{ data: assignments, error: aErr }, { data: profiles, error: pErr }] = await Promise.all([
        supabase.from('user_custom_permissions').select('user_id, permission_id'),
        supabase.from('profiles').select('id, username, avatar_url, discord_username, discord_id').order('username'),
      ]);
      if (aErr) throw aErr;
      if (pErr) throw pErr;

      if (profiles) {
        setAllProfiles(profiles as any);
      }

      if (!assignments || assignments.length === 0) {
        setAssignedUsers([]);
        return;
      }

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setAssignedUsers(assignments.map(a => {
        const p = profileMap.get(a.user_id);
        return {
          user_id: a.user_id,
          username: p?.username || a.user_id,
          avatar_url: p?.avatar_url || null,
          permission_id: a.permission_id,
        };
      }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchAssignedUsers(); }, [fetchAssignedUsers]);

  function openUserQuickPermDialog(u: { id: string; username: string }, currentPermIds: string[]) {
    setUserQuickDialogUser(u);
    setUserQuickPermIds(currentPermIds);
  }

  async function handleSaveUserQuickPerms() {
    if (!userQuickDialogUser) return;
    setSavingUserQuick(true);
    try {
      await supabase.from('user_custom_permissions').delete().eq('user_id', userQuickDialogUser.id);
      if (userQuickPermIds.length > 0) {
        const { error } = await supabase.from('user_custom_permissions').insert(
          userQuickPermIds.map(pid => ({
            user_id: userQuickDialogUser.id,
            permission_id: pid,
            assigned_by: user?.id,
          }))
        );
        if (error) throw error;
      }
      notify.success('บันทึกสิทธิ์สำเร็จ', `อัปเดตสิทธิ์ของ ${userQuickDialogUser.username} แล้ว`);
      setUserQuickDialogUser(null);
      fetchAssignedUsers();
    } catch (e: any) {
      const errMsg = e?.message?.includes('row-level security')
        ? 'ไม่มีสิทธิ์แก้ไขสิทธิ์สมาชิก (ติดเงื่อนไขความปลอดภัย RLS)'
        : (e?.message || 'บันทึกสิทธิ์สมาชิกไม่สำเร็จ');
      notify.error('เกิดข้อผิดพลาด', errMsg);
    } finally {
      setSavingUserQuick(false);
    }
  }

  function openCreateDialog() {
    setEditingPermission(null);
    setFormName('');
    setFormDescription('');
    setFormColor('#6366f1');
    setFormPages([]);
    setDialogOpen(true);
  }

  function openEditDialog(perm: CustomPermission) {
    setEditingPermission(perm);
    setFormName(perm.name);
    setFormDescription(perm.description || '');
    setFormColor(perm.color || '#6366f1');
    setFormPages([...perm.allowed_pages]);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      notify.warning('ข้อมูลไม่ครบถ้วน', 'พิมพ์ชื่อสิทธิ์ก่อนบันทึก');
      return;
    }
    if (formPages.length === 0) {
      notify.warning('ข้อมูลไม่ครบถ้วน', 'เลือกหน้าที่อนุญาตอย่างน้อย 1 หน้า');
      return;
    }
    setSaving(true);
    try {
      if (editingPermission) {
        const { data, error } = await supabase
          .from('custom_permissions')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            color: formColor,
            allowed_pages: formPages,
          })
          .eq('id', editingPermission.id)
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error('ไม่สามารถอัปเดตได้');
        notify.success('อัปเดตสิทธิ์สำเร็จ', `บันทึกการแก้ไขสิทธิ์ "${formName.trim()}" แล้ว`);
      } else {
        const { data, error } = await supabase
          .from('custom_permissions')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            color: formColor,
            allowed_pages: formPages,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error('ไม่สามารถสร้างได้');
        notify.success('สร้างสิทธิ์สำเร็จ', `เพิ่มสิทธิ์ "${formName.trim()}" ในระบบแล้ว`);
      }
      setDialogOpen(false);
      fetchPermissions();
    } catch (e: any) {
      console.error(e);
      const errMsg = e?.message?.includes('row-level security')
        ? 'ไม่มีสิทธิ์บันทึกข้อมูลสิทธิ์ (ติดเงื่อนไขความปลอดภัย RLS)'
        : (e?.message || 'บันทึกข้อมูลสิทธิ์ไม่สำเร็จ');
      notify.error('เกิดข้อผิดพลาด', errMsg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await supabase.from('user_custom_permissions').delete().eq('permission_id', deleteTarget.id);
      const { error } = await supabase.from('custom_permissions').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      notify.success('ลบสิทธิ์สำเร็จ', `ลบสิทธิ์ "${deleteTarget.name}" และถอนออกจากสมาชิกทั้งหมดแล้ว`);
      setDeleteTarget(null);
      fetchPermissions();
    } catch (e: any) {
      const errMsg = e?.message?.includes('row-level security')
        ? 'ไม่มีสิทธิ์ลบข้อมูลสิทธิ์นี้ (ติดเงื่อนไขความปลอดภัย RLS)'
        : (e?.message || 'ลบข้อมูลสิทธิ์ไม่สำเร็จ');
      notify.error('ลบสิทธิ์ไม่สำเร็จ', errMsg);
    }
  }

  function togglePage(pageId: string) {
    setFormPages(prev =>
      prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
    );
  }

  /* ─── Assign users ─── */
  async function openAssignDialog(perm: CustomPermission) {
    setAssignPermission(perm);
    setUserSearch('');
    setAssignDialogOpen(true);
    setLoadingUsers(true);
    setAssignTab('current');
    try {
      const [{ data: profiles }, { data: assignments }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, discord_id, discord_username').order('username'),
        supabase.from('user_custom_permissions').select('user_id, permission_id, custom_permissions(name)'),
      ]);

      const usersWithPerms: UserWithPermissions[] = (profiles || []).map(p => ({
        ...p,
        permissions: (assignments || [])
          .filter((a: any) => a.user_id === p.id)
          .map((a: any) => ({
            permission_id: a.permission_id,
            permission_name: (a.custom_permissions as any)?.name || '',
          })),
      }));
      setAllUsers(usersWithPerms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function toggleUserPermission(userId: string, permissionId: string, hasIt: boolean) {
    try {
      if (hasIt) {
        const { error } = await supabase
          .from('user_custom_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('permission_id', permissionId);
        if (error) throw error;
        notify.success('ถอดสิทธิ์สำเร็จ', 'นำสิทธิ์ออกจากสมาชิกแล้ว');
      } else {
        const { error } = await supabase
          .from('user_custom_permissions')
          .insert({ user_id: userId, permission_id: permissionId, assigned_by: user?.id });
        if (error) throw error;
        notify.success('มอบสิทธิ์สำเร็จ', 'เพิ่มสิทธิ์ให้สมาชิกแล้ว');
      }
      openAssignDialog(assignPermission!);
      fetchAssignedUsers();
    } catch (e: any) {
      const errMsg = e?.message?.includes('row-level security')
        ? 'ไม่มีสิทธิ์แก้ไขสิทธิ์สมาชิก (ติดเงื่อนไขความปลอดภัย RLS)'
        : (e?.message || 'ปรับสิทธิ์ไม่สำเร็จ');
      notify.error('เกิดข้อผิดพลาด', errMsg);
    }
  }

  const filteredAssignUsers = allUsers.filter(u => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username ?? '').toLowerCase().includes(q) ||
      (u.discord_id ?? '').includes(q) ||
      ((u as any).discord_username ?? '').toLowerCase().includes(q)
    );
  });

  const groups = [...new Set(PAGE_OPTIONS.map(p => p.group))];

  // Map to StackedMemberItem for StackedList (Grouped by user so users with multiple permissions don't duplicate!)
  const activeStackedMembers = useMemo<StackedMemberItem[]>(() => {
    const userMap = new Map<string, {
      userId: string;
      username: string;
      avatar_url: string | null;
      perms: CustomPermission[];
    }>();

    assignedUsers.forEach(a => {
      const perm = permissions.find(p => p.id === a.permission_id);
      if (!userMap.has(a.user_id)) {
        userMap.set(a.user_id, {
          userId: a.user_id,
          username: a.username,
          avatar_url: a.avatar_url,
          perms: perm ? [perm] : [],
        });
      } else if (perm) {
        userMap.get(a.user_id)!.perms.push(perm);
      }
    });

    return Array.from(userMap.values()).map(item => {
      const profile = allProfiles.find(p => p.id === item.userId);
      const primaryPerm = item.perms[0];
      return {
        id: item.userId,
        name: item.username,
        avatar: item.avatar_url,
        roleName: item.perms.map(p => p.name).join(', '),
        roleColor: primaryPerm?.color || '#f59e0b',
        discordUsername: profile?.discord_username || undefined,
        subtext: item.perms.length === 1
          ? (primaryPerm?.description || `${primaryPerm?.allowed_pages.length || 0} หน้าที่ได้รับอนุญาต`)
          : `ได้รับสิทธิ์กำหนดเองทั้งหมด ${item.perms.length} สิทธิ์`,
        online: true,
        badgeContent: (
          <div className="flex flex-wrap gap-1 max-w-[220px] justify-end">
            {item.perms.map(p => {
              const color = p.color || '#f59e0b';
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shrink-0 transition-colors shadow-xs"
                  style={{
                    backgroundColor: `${color}18`,
                    color: color,
                    borderColor: `${color}40`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate max-w-[90px]">{p.name}</span>
                </div>
              );
            })}
          </div>
        ),
        data: { user: profile || { id: item.userId, username: item.username }, perms: item.perms },
        onAction: () => {
          openUserQuickPermDialog({ id: item.userId, username: item.username }, item.perms.map(p => p.id));
        },
      };
    });
  }, [assignedUsers, permissions, allProfiles]);

  const allStackedMembers = useMemo<StackedMemberItem[]>(() => {
    return allProfiles.map(p => {
      const userAssignments = assignedUsers.filter(a => a.user_id === p.id);
      const userPerms = userAssignments
        .map(a => permissions.find(perm => perm.id === a.permission_id))
        .filter(Boolean) as CustomPermission[];

      const hasPerms = userPerms.length > 0;
      const primaryPerm = userPerms[0];

      return {
        id: p.id,
        name: p.username || 'ไม่ระบุชื่อ',
        avatar: p.avatar_url,
        discordUsername: p.discord_username || undefined,
        roleName: hasPerms ? userPerms.map(up => up.name).join(', ') : 'ผู้ใช้ทั่วไป',
        roleColor: hasPerms ? (primaryPerm?.color || '#f59e0b') : '#78716c',
        subtext: p.discord_id ? `Discord ID: ${p.discord_id}` : (hasPerms ? 'มีสิทธิ์กำหนดเอง' : 'ยังไม่มีสิทธิ์พิเศษ'),
        online: hasPerms,
        data: { user: p, userPerms },
        onAction: () => {
          openUserQuickPermDialog(p, userPerms.map(up => up.id));
        },
      };
    });
  }, [allProfiles, assignedUsers, permissions]);

  // Filtered members for Assign Member Modal
  const searchedMembersForAssignment = useMemo(() => {
    const q = memberSearchTerm.toLowerCase().trim();
    if (!q) {
      const activeIds = new Set(assignedUsers.map(a => a.user_id));
      const withPerms = allProfiles.filter(p => activeIds.has(p.id));
      const withoutPerms = allProfiles.filter(p => !activeIds.has(p.id)).slice(0, 15 - Math.min(15, withPerms.length));
      return [...withPerms, ...withoutPerms];
    }
    return allProfiles
      .filter(p =>
        (p.username ?? '').toLowerCase().includes(q) ||
        (p.discord_id ?? '').includes(q) ||
        ((p as any).discord_username ?? '').toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allProfiles, assignedUsers, memberSearchTerm]);

  return (
    <div className="space-y-6">
      {/* ─── Custom Permissions Section ─── */}
      <div>
        {/* Header with View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">สิทธิ์กำหนดเอง</h2>
            <Badge variant="secondary">{permissions.length}</Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode('stacked')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
                  viewMode === 'stacked'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Users className="w-3.5 h-3.5" />
                ทำเนียบสมาชิก (Stacked List)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                การ์ดบทบาทสิทธิ์ ({permissions.length})
              </button>
            </div>

            <Button
              onClick={() => { setAssignMemberModalOpen(true); setMemberSearchTerm(''); }}
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-semibold cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-amber-500" />
              มอบหมายสิทธิ์ให้สมาชิก
            </Button>

            <Button onClick={openCreateDialog} size="sm" className="gap-1.5 rounded-xl cursor-pointer">
              <Plus className="w-4 h-4" />
              สร้างสิทธิ์ใหม่
            </Button>
          </div>
        </div>

        {/* Content based on view mode */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : viewMode === 'stacked' ? (
          <StackedList
            title="สมาชิกที่ได้รับสิทธิ์พิเศษ"
            subtitle="สมาชิกที่มีบทบาทและสิทธิ์กำหนดเองในระบบ"
            drawerTitle="รายชื่อสมาชิกทั้งหมด"
            drawerSubtitle="คลิกที่สมาชิกเพื่อจัดการหรือมอบหมายสิทธิ์"
            activeMembers={activeStackedMembers}
            allMembers={allStackedMembers}
            onAddClick={() => { setAssignMemberModalOpen(true); setMemberSearchTerm(''); }}
            onMemberClick={member => {
              if (member.onAction) member.onAction();
            }}
            emptyActiveText="ยังไม่มีสมาชิกที่ได้รับสิทธิ์พิเศษในระบบ"
            emptyDrawerText="ไม่พบข้อมูลสมาชิกในระบบ"
          />
        ) : permissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">ยังไม่มีสิทธิ์ที่สร้างไว้</p>
              <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-3 gap-1.5">
                <Plus className="w-4 h-4" /> สร้างสิทธิ์แรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {permissions.map(perm => {
              const members = assignedUsers.filter(a => a.permission_id === perm.id);
              const isExpanded = expandedPermId === perm.id;
              return (
                <Card key={perm.id} className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: perm.color || '#6366f1' }} />
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: perm.color || '#6366f1' }} />
                          {perm.name}
                        </CardTitle>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{perm.description}</p>
                        )}
                      </div>
                      <DropdownMenu
                        options={[
                          {
                            label: "จัดการผู้ใช้",
                            onClick: () => openAssignDialog(perm),
                            Icon: <UserPlus className="h-3.5 w-3.5" />,
                          },
                          {
                            label: "แก้ไขสิทธิ์",
                            onClick: () => openEditDialog(perm),
                            Icon: <Pencil className="h-3.5 w-3.5" />,
                          },
                          {
                            label: "ลบสิทธิ์",
                            onClick: () => setDeleteTarget(perm),
                            Icon: <Trash2 className="h-3.5 w-3.5" />,
                            variant: "destructive",
                          },
                        ]}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {perm.allowed_pages.map(pageId => {
                        const page = PAGE_OPTIONS.find(p => p.id === pageId);
                        return page ? (
                          <Badge key={pageId} variant="outline" className="text-[10px] px-1.5">
                            {page.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>

                    {/* Assigned members preview */}
                    {members.length > 0 && (
                      <div className="mb-3">
                        <button
                          onClick={() => setExpandedPermId(isExpanded ? null : perm.id)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-medium">{members.length} สมาชิก</span>
                          <div className="flex -space-x-1.5 ml-1">
                            {members.slice(0, 5).map(m => (
                              m.avatar_url ? (
                                <img key={m.user_id} src={m.avatar_url} className="w-5 h-5 rounded-full border-2 border-background" alt="" />
                              ) : (
                                <div key={m.user_id} className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] text-muted-foreground"><User className="w-2.5 h-2.5" /></div>
                              )
                            ))}
                            {members.length > 5 && (
                              <div className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-medium">
                                +{members.length - 5}
                              </div>
                            )}
                          </div>
                          <span className="ml-auto">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {members.map(m => (
                              <div key={m.user_id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted/50">
                                {m.avatar_url ? (
                                  <img src={m.avatar_url} className="w-5 h-5 rounded-full shrink-0" alt="" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] text-muted-foreground"><User className="w-2.5 h-2.5" /></div>
                                )}
                                <span className="text-xs truncate">{m.username}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {members.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">ยังไม่มีสมาชิก</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create/Edit Permission Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPermission ? 'แก้ไขสิทธิ์' : 'สร้างสิทธิ์ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อสิทธิ์ *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="เช่น Content Manager" className="mt-1" />
            </div>
            <div>
              <Label>คำอธิบาย</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className="mt-1" />
            </div>
            <div>
              <Label>สี</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={formColor} onChange={e => setFormColor(e.target.value)} className="w-28 text-sm font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">หน้าที่เข้าถึงได้ *</Label>
              <div className="mt-2 space-y-4">
                {groups.map(group => (
                  <div key={group} className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">{group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAGE_OPTIONS.filter(p => p.group === group).map(page => {
                        const isChecked = formPages.includes(page.id);
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => togglePage(page.id)}
                            className={cn(
                              'flex items-center gap-2.5 p-2.5 rounded-xl border text-xs text-left transition-all hover:scale-[1.01]',
                              isChecked
                                ? 'bg-primary/10 border-primary/50 text-primary font-semibold ring-1 ring-primary/10'
                                : 'bg-card border-border/40 hover:bg-muted/40 text-muted-foreground'
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => togglePage(page.id)}
                              className="pointer-events-none"
                            />
                            <span className="truncate">{page.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving ? 'กำลังบันทึก...' : editingPermission ? 'อัปเดต' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสิทธิ์ "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้จะลบสิทธิ์และถอนออกจากผู้ใช้ทั้งหมดที่มีสิทธิ์นี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Assign Users Dialog ─── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              จัดการสิทธิ์การเข้าถึง — {assignPermission?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Simple Tab Toggles */}
          <div className="flex border-b border-border/40 mb-3">
            <button
              onClick={() => { setAssignTab('current'); setUserSearch(''); }}
              className={cn(
                'flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-all',
                assignTab === 'current'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              สมาชิกปัจจุบัน ({allUsers.filter(u => u.permissions.some(p => p.permission_id === assignPermission?.id)).length})
            </button>
            <button
              onClick={() => { setAssignTab('add'); setUserSearch(''); }}
              className={cn(
                'flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-all',
                assignTab === 'add'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              เพิ่มสมาชิกใหม่
            </button>
          </div>

          {/* Search bar */}
          <SearchBar value={userSearch} onChange={setUserSearch} placeholder="ค้นหาตามชื่อ หรือ Discord ID..." />

          {loadingUsers ? (
            <div className="text-center py-8 text-sm text-muted-foreground">กำลังโหลดรายชื่อผู้ใช้...</div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pt-2">
              {(() => {
                const isCurrent = assignTab === 'current';
                const usersList = filteredAssignUsers.filter(u => {
                  const hasPerm = u.permissions.some(p => p.permission_id === assignPermission?.id);
                  return isCurrent ? hasPerm : !hasPerm;
                });

                if (usersList.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-muted-foreground italic bg-muted/25 rounded-2xl border border-dashed border-border/40 p-4">
                      {isCurrent ? 'ยังไม่มีสมาชิกกลุ่มสิทธิ์นี้' : 'ไม่พบผู้ใช้ที่ต้องการเพิ่ม'}
                    </div>
                  );
                }

                return usersList.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/40 bg-card hover:bg-muted/40 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} className="w-8 h-8 rounded-full shrink-0 object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm text-muted-foreground"><User className="w-4 h-4" /></div>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-semibold truncate block text-foreground">{u.username}</span>
                        
                        {/* Other assigned permissions badges */}
                        {u.permissions.filter(p => p.permission_id !== assignPermission?.id).length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {u.permissions.filter(p => p.permission_id !== assignPermission?.id).map(p => {
                              const permData = permissions.find(pp => pp.id === p.permission_id);
                              return (
                                <Badge
                                  key={p.permission_id}
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 h-4 rounded"
                                  style={permData?.color ? { backgroundColor: `${permData.color}15`, color: permData.color, borderColor: `${permData.color}30` } : {}}
                                >
                                  {p.permission_name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant={isCurrent ? 'destructive' : 'default'}
                      size="sm"
                      className="h-8 px-3 text-xs gap-1 shrink-0 rounded-xl"
                      onClick={() => toggleUserPermission(u.id, assignPermission!.id, isCurrent)}
                    >
                      {isCurrent ? (
                        <><UserMinus className="w-3.5 h-3.5" /> ถอดสิทธิ์</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5" /> เพิ่มสิทธิ์</>
                      )}
                    </Button>
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Quick Member Permissions Dialog */}
      <Dialog open={!!userQuickDialogUser} onOpenChange={open => { if (!open) setUserQuickDialogUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              จัดการสิทธิ์ — {userQuickDialogUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {permissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีสิทธิ์กำหนดเองในระบบ</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {permissions.map(perm => {
                  const checked = userQuickPermIds.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: perm.color || '#f59e0b' }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{perm.name}</p>
                          {perm.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{perm.description}</p>
                          )}
                        </div>
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          setUserQuickPermIds(prev =>
                            prev.includes(perm.id) ? prev.filter(id => id !== perm.id) : [...prev, perm.id]
                          );
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUserQuickDialogUser(null)}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleSaveUserQuickPerms} disabled={savingUserQuick}>
              {savingUserQuick ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Search & Assign Member Modal ─── */}
      <Dialog open={assignMemberModalOpen} onOpenChange={setAssignMemberModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-3xl p-6 bg-[#FAF6F0] dark:bg-[#181412] border border-[#EAD8C8] dark:border-[#2D2420] shadow-2xl">
          <DialogHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2420]">
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" /> มอบหมายสิทธิ์ให้สมาชิก
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              ค้นหาสมาชิกจากชื่อ หรือ Discord ID เพื่อเลือกมอบหมายหรือปรับเปลี่ยนสิทธิ์
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="relative my-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="ค้นหาด้วยชื่อผู้ใช้, @discord หรือ Discord ID..."
              value={memberSearchTerm}
              onChange={e => setMemberSearchTerm(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-xl border-[#EAD8C8] dark:border-[#2D2420] bg-white dark:bg-[#14100E] text-xs"
              autoFocus
            />
          </div>

          {/* Members Results List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh] [scrollbar-width:thin]">
            {searchedMembersForAssignment.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-[#EAD8C8] dark:border-[#2D2420] rounded-2xl">
                ไม่พบสมาชิกที่ตรงกับ "{memberSearchTerm}"
              </div>
            ) : (
              searchedMembersForAssignment.map(p => {
                const userAssignments = assignedUsers.filter(a => a.user_id === p.id);
                const userPerms = userAssignments
                  .map(a => permissions.find(perm => perm.id === a.permission_id))
                  .filter(Boolean) as CustomPermission[];

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#EAD8C8]/80 dark:border-[#2D2420] bg-white dark:bg-[#15110E] hover:border-amber-500/40 hover:bg-amber-500/5 transition-all cursor-pointer"
                    onClick={() => {
                      setAssignMemberModalOpen(false);
                      openUserQuickPermDialog(p, userPerms.map(up => up.id));
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-border" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                            {(p.username || 'U').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {userPerms.length > 0 && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate">{p.username}</span>
                          {p.discord_username && (
                            <span className="text-[10px] text-muted-foreground truncate">@{p.discord_username}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono truncate">{p.discord_id || p.id}</span>
                        </div>

                        {/* Current Permissions Tags */}
                        {userPerms.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {userPerms.map(up => (
                              <Badge
                                key={up.id}
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 rounded-md font-semibold"
                                style={{
                                  backgroundColor: `${up.color || '#f59e0b'}15`,
                                  color: up.color || '#f59e0b',
                                  borderColor: `${up.color || '#f59e0b'}35`,
                                }}
                              >
                                {up.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-0.5">ยังไม่มีสิทธิ์พิเศษ</p>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 rounded-xl text-xs font-semibold gap-1 shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignMemberModalOpen(false);
                        openUserQuickPermDialog(p, userPerms.map(up => up.id));
                      }}
                    >
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      {userPerms.length > 0 ? 'ปรับสิทธิ์' : 'มอบสิทธิ์'}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-[#EAD8C8]/60 dark:border-[#2D2420]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignMemberModalOpen(false)}
              className="rounded-xl text-xs cursor-pointer"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
