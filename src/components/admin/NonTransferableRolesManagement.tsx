import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { readRoleBanPayload } from '@/lib/role-ban';
import { ShieldBan, Plus, Trash2, Search, AlertTriangle, Loader2, Pencil, Check } from 'lucide-react';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkDeleteToolbar } from '@/components/admin/BulkDeleteToolbar';

interface NonTransferableRole {
  id: string;
  discord_role_id: string;
  role_name: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

interface DiscordRole {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  unicode_emoji: string | null;
}

export function NonTransferableRolesManagement() {
  const [roles, setRoles] = useState<NonTransferableRole[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDiscordRoles, setLoadingDiscordRoles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<NonTransferableRole | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<NonTransferableRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Multi-select for adding
  const [selectedDiscordRoles, setSelectedDiscordRoles] = useState<Set<string>>(new Set());
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [formReason, setFormReason] = useState('');
  // Edit form
  const [editFormData, setEditFormData] = useState({ role_name: '', reason: '' });

  const filteredRoles = roles.filter(
    r => r.role_name.toLowerCase().includes(searchQuery.toLowerCase()) || r.discord_role_id.includes(searchQuery)
  );

  const getRoleId = useCallback((role: NonTransferableRole) => role.id, []);
  const { selectedCount, selectedItems, isSelected, isAllSelected, isSomeSelected, toggleItem, toggleAll, clearSelection } =
    useBulkSelection({ items: filteredRoles, getItemId: getRoleId });

  useEffect(() => { fetchRoles(); }, []);

  async function fetchRoles() {
    try {
      const { data, error } = await supabase
        .from('non_transferable_roles' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRoles((data as any) || []);
    } catch (error) {
      console.error('Error fetching non-transferable roles:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดข้อมูลได้', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchDiscordRoles() {
    setLoadingDiscordRoles(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'กรุณาเข้าสู่ระบบ', variant: 'destructive' }); return; }
      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const roleBanPayload = await readRoleBanPayload(error);
        if (roleBanPayload) { navigate('/banned-role', { replace: true }); return; }
        throw error;
      }
      if (data?.roles) setDiscordRoles(data.roles);
    } catch (error) {
      console.error('Error fetching Discord roles:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถดึง Roles จาก Discord ได้', variant: 'destructive' });
    } finally {
      setLoadingDiscordRoles(false);
    }
  }

  function openCreateDialog() {
    setEditingRole(null);
    setSelectedDiscordRoles(new Set());
    setAddSearchQuery('');
    setFormReason('');
    setDialogOpen(true);
    if (discordRoles.length === 0) fetchDiscordRoles();
  }

  function openEditDialog(role: NonTransferableRole) {
    setEditingRole(role);
    setEditFormData({ role_name: role.role_name, reason: role.reason || '' });
    setDialogOpen(true);
  }

  function toggleDiscordRole(roleId: string) {
    setSelectedDiscordRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  async function handleSubmit() {
    if (editingRole) {
      // Edit mode
      setIsSaving(true);
      try {
        const { error } = await supabase.from('non_transferable_roles' as any)
          .update({ role_name: editFormData.role_name.trim(), reason: editFormData.reason.trim() || null } as any)
          .eq('id', editingRole.id);
        if (error) throw error;
        toast({ title: 'แก้ไขสำเร็จ' });
        setDialogOpen(false);
        fetchRoles();
      } catch (error) {
        console.error('Error saving:', error);
        toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Add mode - multi insert
    if (selectedDiscordRoles.size === 0) {
      toast({ title: 'กรุณาเลือกอย่างน้อย 1 Role', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const insertData = Array.from(selectedDiscordRoles).map(roleId => {
        const dr = discordRoles.find(r => r.id === roleId);
        return {
          discord_role_id: roleId,
          role_name: dr?.name || roleId,
          reason: formReason.trim() || null,
        };
      });

      const { error } = await supabase.from('non_transferable_roles' as any).insert(insertData as any);
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'บาง Role ถูกเพิ่มไปแล้ว', variant: 'destructive' });
          return;
        }
        throw error;
      }
      toast({ title: 'เพิ่มสำเร็จ', description: `เพิ่ม ${insertData.length} Role ในรายการห้ามย้ายแล้ว` });
      setDialogOpen(false);
      fetchRoles();
    } catch (error) {
      console.error('Error saving:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingRole) return;
    try {
      const { error } = await supabase.from('non_transferable_roles' as any).delete().eq('id', deletingRole.id);
      if (error) throw error;
      toast({ title: 'ลบสำเร็จ' });
      setDeleteDialogOpen(false);
      setDeletingRole(null);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setIsDeleting(true);
    try {
      const ids = selectedItems.map(i => i.id);
      const { error } = await supabase.from('non_transferable_roles' as any).delete().in('id', ids);
      if (error) throw error;
      setRoles(roles.filter(r => !ids.includes(r.id)));
      clearSelection();
      setBulkDeleteDialogOpen(false);
      toast({ title: 'ลบสำเร็จ', description: `ลบ ${ids.length} รายการแล้ว` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }

  const availableRoles = discordRoles.filter(dr => !roles.some(r => r.discord_role_id === dr.id));
  const filteredAvailableRoles = availableRoles.filter(r =>
    !addSearchQuery || r.name.toLowerCase().includes(addSearchQuery.toLowerCase()) || r.id.includes(addSearchQuery)
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <ShieldBan className="w-5 h-5 text-amber-500" />
              บทบาทห้ามย้าย
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="ค้นหา Role..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                เพิ่ม Role
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Role ที่อยู่ในรายการนี้จะไม่สามารถถูกย้ายได้</p>
              <p className="text-muted-foreground mt-1">ใช้สำหรับป้องกัน Role สำคัญไม่ให้ถูกย้ายในระบบ "ย้ายบทบาท"</p>
            </div>
          </div>

          <BulkDeleteToolbar selectedCount={selectedCount} onDelete={() => setBulkDeleteDialogOpen(true)} onClear={clearSelection} isDeleting={isDeleting} itemLabel="Role" />

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? 'ไม่พบ Role ที่ค้นหา' : 'ยังไม่มี Role ที่ห้ามย้าย'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} aria-label="เลือกทั้งหมด"
                      className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      {...(isSomeSelected ? { 'data-state': 'checked' } : {})} />
                  </TableHead>
                  <TableHead>ชื่อ Role</TableHead>
                  <TableHead>Discord Role ID</TableHead>
                  <TableHead>เหตุผล</TableHead>
                  <TableHead>วันที่เพิ่ม</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map(role => (
                  <TableRow key={role.id} className={isSelected(role.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox checked={isSelected(role.id)} onCheckedChange={() => toggleItem(role.id)} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                        <ShieldBan className="w-3 h-3" />
                        {role.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{role.discord_role_id}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{role.reason || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(role.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDeletingRole(role); setDeleteDialogOpen(true); }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldBan className="w-5 h-5 text-amber-500" />
              {editingRole ? 'แก้ไข Role ห้ามย้าย' : 'เพิ่ม Role ห้ามย้าย'}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'แก้ไขข้อมูล Role ห้ามย้าย'
                : 'เลือก Role จาก Discord ที่ต้องการเพิ่มเข้ารายการห้ามย้าย (เลือกได้หลาย Role)'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editingRole ? (
              /* Edit mode */
              <>
                <div className="space-y-2">
                  <Label>ชื่อ Role</Label>
                  <Input value={editFormData.role_name} onChange={e => setEditFormData({ ...editFormData, role_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>เหตุผล (ไม่บังคับ)</Label>
                  <Textarea placeholder="เหตุผลที่ห้ามย้าย..." value={editFormData.reason}
                    onChange={e => setEditFormData({ ...editFormData, reason: e.target.value })} rows={3} maxLength={500} />
                </div>
              </>
            ) : (
              /* Add mode - multi select */
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>เลือก Role จาก Discord</Label>
                    {selectedDiscordRoles.size > 0 && (
                      <Badge variant="secondary">{selectedDiscordRoles.size} เลือกแล้ว</Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="ค้นหา Role..." value={addSearchQuery}
                      onChange={e => setAddSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                  <ScrollArea className="h-64 rounded-md border">
                    {loadingDiscordRoles ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> กำลังโหลด...
                      </div>
                    ) : filteredAvailableRoles.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        {addSearchQuery ? 'ไม่พบ Role ที่ค้นหา' : 'ไม่มี Role ให้เลือก'}
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredAvailableRoles.map(role => {
                          const checked = selectedDiscordRoles.has(role.id);
                          return (
                            <div
                              key={role.id}
                              onClick={() => toggleDiscordRole(role.id)}
                              className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                                checked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                              }`}
                            >
                              <Checkbox checked={checked} onCheckedChange={() => toggleDiscordRole(role.id)} />
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {role.unicode_emoji && <span className="text-sm">{role.unicode_emoji}</span>}
                                <span className="text-sm font-medium truncate" style={{ color: role.color || undefined }}>
                                  {role.name}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground font-mono shrink-0">{role.id}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
                <div className="space-y-2">
                  <Label>เหตุผล (ไม่บังคับ - ใช้กับทุก Role ที่เลือก)</Label>
                  <Textarea placeholder="เหตุผลที่ห้ามย้าย..." value={formReason}
                    onChange={e => setFormReason(e.target.value)} rows={3} maxLength={500} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={isSaving || (!editingRole && selectedDiscordRoles.size === 0)}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingRole ? 'บันทึก' : `เพิ่ม ${selectedDiscordRoles.size > 0 ? selectedDiscordRoles.size + ' Role' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบ "{deletingRole?.role_name}" ออกจากรายการห้ามย้ายหรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ {selectedCount} รายการ</AlertDialogTitle>
            <AlertDialogDescription>การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ลบ {selectedCount} รายการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
