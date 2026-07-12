import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/retry';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, UserPlus, UserMinus, Key, Shield, Users, User, ChevronDown, ChevronUp,
} from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
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
  const { toast } = useToast();
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

  // All assigned users (for cards + grouped view)
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [expandedPermId, setExpandedPermId] = useState<string | null>(null);

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
      toast({ title: 'โหลดข้อมูลล้มเหลว', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const fetchAssignedUsers = useCallback(async () => {
    try {
      const { data: assignments, error: aErr } = await supabase
        .from('user_custom_permissions')
        .select('user_id, permission_id');
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) { setAssignedUsers([]); return; }
      const userIds = [...new Set(assignments.map(a => a.user_id))];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      if (pErr) throw pErr;
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
      toast({ title: 'กรุณาใส่ชื่อสิทธิ์', variant: 'destructive' });
      return;
    }
    if (formPages.length === 0) {
      toast({ title: 'กรุณาเลือกหน้าอย่างน้อย 1 หน้า', variant: 'destructive' });
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
        toast({ title: 'อัปเดตสิทธิ์แล้ว' });
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
        toast({ title: 'สร้างสิทธิ์แล้ว' });
      }
      setDialogOpen(false);
      fetchPermissions();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
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
      toast({ title: 'ลบสิทธิ์แล้ว' });
      setDeleteTarget(null);
      fetchPermissions();
    } catch (e: any) {
      toast({ title: 'ลบล้มเหลว', description: e.message, variant: 'destructive' });
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
        supabase.from('profiles').select('id, username, avatar_url, discord_id').order('username'),
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
        toast({ title: 'ลบสิทธิ์จากผู้ใช้แล้ว' });
      } else {
        const { error } = await supabase
          .from('user_custom_permissions')
          .insert({ user_id: userId, permission_id: permissionId, assigned_by: user?.id });
        if (error) throw error;
        toast({ title: 'เพิ่มสิทธิ์ให้ผู้ใช้แล้ว' });
      }
      openAssignDialog(assignPermission!);
      fetchAssignedUsers();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
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

  return (
    <div className="space-y-6">
      {/* ─── Custom Permissions Section ─── */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">สิทธิ์กำหนดเอง</h2>
            <Badge variant="secondary">{permissions.length}</Badge>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            สร้างสิทธิ์ใหม่
          </Button>
        </div>

        {/* Permissions list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
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
                      <p className="text-[10px] text-muted-foreground mb-3">ยังไม่มีสมาชิก</p>
                    )}

                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openAssignDialog(perm)}>
                        <UserPlus className="w-3.5 h-3.5" />
                        จัดการผู้ใช้
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openEditDialog(perm)}>
                        <Pencil className="w-3.5 h-3.5" />
                        แก้ไข
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(perm)}>
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบ
                      </Button>
                    </div>
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
    </div>
  );
}
