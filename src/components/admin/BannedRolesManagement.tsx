import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { readRoleBanPayload } from '@/lib/role-ban';
import { ShieldX, Plus, Trash2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkDeleteToolbar } from '@/components/admin/BulkDeleteToolbar';

interface BannedRole {
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

export function BannedRolesManagement() {
  const [bannedRoles, setBannedRoles] = useState<BannedRole[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDiscordRoles, setLoadingDiscordRoles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<BannedRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    discord_role_id: '',
    role_name: '',
    reason: '',
  });

  const filteredRoles = bannedRoles.filter(
    (r) =>
      r.role_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.discord_role_id.includes(searchQuery)
  );

  const getRoleId = useCallback((role: BannedRole) => role.id, []);
  const {
    selectedCount,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleItem,
    toggleAll,
    clearSelection,
  } = useBulkSelection({ items: filteredRoles, getItemId: getRoleId });

  useEffect(() => {
    fetchBannedRoles();
  }, []);

  async function fetchBannedRoles() {
    try {
      const { data, error } = await supabase
        .from('banned_discord_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBannedRoles(data || []);
    } catch (error) {
      console.error('Error fetching banned roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูล Role ที่ถูกแบนได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchDiscordRoles() {
    setLoadingDiscordRoles(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'กรุณาเข้าสู่ระบบ',
          description: 'ต้องเข้าสู่ระบบก่อนดึงข้อมูล Discord Roles',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('discord-roles', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const roleBanPayload = await readRoleBanPayload(error);
        if (roleBanPayload) {
          toast({
            title: 'บัญชีถูกจำกัดการใช้งาน',
            description: roleBanPayload.message || 'ไม่สามารถใช้งานส่วนนี้ได้',
            variant: 'destructive',
          });
          navigate('/banned-role', { replace: true });
          return;
        }
        throw error;
      }

      if (data?.roles) {
        setDiscordRoles(data.roles);
        toast({
          title: 'โหลด Roles สำเร็จ',
          description: `พบ ${data.roles.length} roles จาก Discord Server`,
        });
      }
    } catch (error) {
      console.error('Error fetching Discord roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถดึงข้อมูล Roles จาก Discord ได้',
        variant: 'destructive',
      });
    } finally {
      setLoadingDiscordRoles(false);
    }
  }

  function openCreateDialog() {
    setFormData({
      discord_role_id: '',
      role_name: '',
      reason: '',
    });
    setDialogOpen(true);
    // Fetch Discord roles when opening dialog if not loaded yet
    if (discordRoles.length === 0) {
      fetchDiscordRoles();
    }
  }

  function handleRoleSelect(roleId: string) {
    const selectedRole = discordRoles.find((r) => r.id === roleId);
    if (selectedRole) {
      setFormData({
        ...formData,
        discord_role_id: selectedRole.id,
        role_name: selectedRole.name,
      });
    }
  }

  async function handleSubmit() {
    if (!formData.discord_role_id.trim() || !formData.role_name.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูลให้ครบ',
        description: 'ต้องระบุ Role ID และชื่อ Role',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('banned_discord_roles').insert({
        discord_role_id: formData.discord_role_id.trim(),
        role_name: formData.role_name.trim(),
        reason: formData.reason.trim() || null,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Role นี้ถูกเพิ่มไปแล้ว',
            description: 'Role ID นี้มีอยู่ในรายการแบนแล้ว',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'เพิ่ม Role สำเร็จ',
        description: `Role "${formData.role_name}" ถูกเพิ่มในรายการแบนแล้ว`,
      });

      setDialogOpen(false);
      fetchBannedRoles();
    } catch (error) {
      console.error('Error adding banned role:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเพิ่ม Role ได้',
        variant: 'destructive',
      });
    }
  }

  function confirmDelete(role: BannedRole) {
    setDeletingRole(role);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingRole) return;

    try {
      const { error } = await supabase
        .from('banned_discord_roles')
        .delete()
        .eq('id', deletingRole.id);

      if (error) throw error;

      toast({
        title: 'ลบ Role สำเร็จ',
        description: `Role "${deletingRole.role_name}" ถูกลบออกจากรายการแบนแล้ว`,
      });

      setDeleteDialogOpen(false);
      setDeletingRole(null);
      fetchBannedRoles();
    } catch (error) {
      console.error('Error deleting banned role:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบ Role ได้',
        variant: 'destructive',
      });
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = selectedItems.map((item) => item.id);
      const { error } = await supabase
        .from('banned_discord_roles')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setBannedRoles(bannedRoles.filter((r) => !idsToDelete.includes(r.id)));
      clearSelection();
      setBulkDeleteDialogOpen(false);

      toast({
        title: 'ลบ Role สำเร็จ',
        description: `ลบ ${idsToDelete.length} Role ออกจากรายการแบนแล้ว`,
      });
    } catch (error) {
      console.error('Error bulk deleting roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบ Role ได้',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // Filter out already banned roles from the dropdown
  const availableRoles = discordRoles.filter(
    (dr) => !bannedRoles.some((br) => br.discord_role_id === dr.id)
  );

  return (
    <>
      <Card className="admin-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldX className="w-4 h-4 text-destructive" />
              จัดการ Role ที่ถูกแบน
            </CardTitle>
            <div className="flex items-center gap-2">
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="ค้นหา Role..." className="w-64" />
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
              <p className="font-medium text-amber-600 dark:text-amber-400">
                ผู้ใช้ที่มี Role เหล่านี้จะไม่สามารถ Login เข้าระบบได้
              </p>
              <p className="text-muted-foreground mt-1">
                คุณสามารถเลือก Role จาก Discord Server ได้โดยตรง หรือพิมพ์ Role ID เอง
              </p>
            </div>
          </div>

          <BulkDeleteToolbar
            selectedCount={selectedCount}
            onDelete={() => setBulkDeleteDialogOpen(true)}
            onClear={clearSelection}
            isDeleting={isDeleting}
            itemLabel="Role"
          />

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : filteredRoles.length === 0 ? (
            <AdminEmptyState
              icon={ShieldX}
              title={searchQuery ? 'ไม่พบ Role ที่ค้นหา' : 'ยังไม่มี Role ที่ถูกแบน'}
              description={searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'กด "เพิ่ม Role" เพื่อเพิ่ม Role แรก'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleAll}
                      aria-label="เลือกทั้งหมด"
                      className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      {...(isSomeSelected ? { 'data-state': 'checked' } : {})}
                    />
                  </TableHead>
                  <TableHead>ชื่อ Role</TableHead>
                  <TableHead>Discord Role ID</TableHead>
                  <TableHead>เหตุผล</TableHead>
                  <TableHead>วันที่เพิ่ม</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id} className={isSelected(role.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected(role.id)}
                        onCheckedChange={() => toggleItem(role.id)}
                        aria-label={`เลือก ${role.role_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="gap-1">
                          <ShieldX className="w-3 h-3" />
                          {role.role_name}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {role.discord_role_id}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {role.reason || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(role.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(role)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="w-5 h-5 text-destructive" />
              เพิ่ม Role ที่ถูกแบน
            </DialogTitle>
            <DialogDescription>
              ผู้ใช้ที่มี Role นี้ใน Discord Server จะไม่สามารถ Login เข้าระบบได้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Discord Role Selector */}
            <div className="space-y-2">
              <Label>เลือก Role จาก Discord</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.discord_role_id}
                  onValueChange={handleRoleSelect}
                  disabled={loadingDiscordRoles}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loadingDiscordRoles ? 'กำลังโหลด...' : 'เลือก Role'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        {loadingDiscordRoles ? 'กำลังโหลด...' : 'ไม่มี Role ให้เลือก'}
                      </div>
                    ) : (
                      availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            {role.icon ? (
                              <img
                                src={role.icon}
                                alt=""
                                className="w-4 h-4 rounded-sm object-cover shrink-0"
                              />
                            ) : role.unicode_emoji ? (
                              <span className="text-sm shrink-0">{role.unicode_emoji}</span>
                            ) : role.color ? (
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: role.color }}
                              />
                            ) : null}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchDiscordRoles}
                  disabled={loadingDiscordRoles}
                  title="รีเฟรช Roles"
                >
                  {loadingDiscordRoles ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">หรือพิมพ์เอง</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discord_role_id">Discord Role ID *</Label>
              <Input
                id="discord_role_id"
                placeholder="เช่น 1234567890123456789"
                value={formData.discord_role_id}
                onChange={(e) =>
                  setFormData({ ...formData, discord_role_id: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_name">ชื่อ Role *</Label>
              <Input
                id="role_name"
                placeholder="เช่น Banned, Muted, Restricted"
                value={formData.role_name}
                onChange={(e) =>
                  setFormData({ ...formData, role_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">เหตุผล (ไม่บังคับ)</Label>
              <Textarea
                id="reason"
                placeholder="ระบุเหตุผลที่ Role นี้ถูกแบน..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} className="bg-destructive hover:bg-destructive/90">
              เพิ่ม Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Role</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ Role "{deletingRole?.role_name}" ออกจากรายการแบนหรือไม่?
              ผู้ใช้ที่มี Role นี้จะสามารถ Login เข้าระบบได้อีกครั้ง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              ลบ Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ {selectedCount} Role ออกจากรายการแบนหรือไม่?
              ผู้ใช้ที่มี Role เหล่านี้จะสามารถ Login เข้าระบบได้อีกครั้ง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'กำลังลบ...' : `ลบ ${selectedCount} Role`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
