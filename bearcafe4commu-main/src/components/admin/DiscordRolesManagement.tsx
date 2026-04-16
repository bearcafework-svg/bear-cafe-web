import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { readRoleBanPayload } from '@/lib/role-ban';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Palette,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Edit,
} from 'lucide-react';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { BulkDeleteToolbar } from './BulkDeleteToolbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type DiscordRole = Tables<'discord_roles'>;
type DiscordRoleInsert = TablesInsert<'discord_roles'>;

interface DiscordAPIRole {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  unicode_emoji: string | null;
}

export function DiscordRolesManagement() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordAPIRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDiscordRoles, setLoadingDiscordRoles] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedBulkRoles, setSelectedBulkRoles] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingRole, setEditingRole] = useState<DiscordRole | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const { toast } = useToast();

  const {
    selectedIds,
    selectedCount,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleItem,
    toggleAll,
    clearSelection,
  } = useBulkSelection({
    items: roles,
    getItemId: (item) => item.id,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  async function fetchRoles() {
    try {
      const { data, error } = await supabase
        .from('discord_roles')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลด Discord Roles ได้',
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
        return null;
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
          return null;
        }
        throw error;
      }

      return data?.roles || [];
    } catch (error) {
      console.error('Error fetching Discord roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถดึงข้อมูล Roles จาก Discord ได้',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoadingDiscordRoles(false);
    }
  }

  async function openImportDialog() {
    setImportDialogOpen(true);
    const allDiscordRoles = await fetchDiscordRoles();
    if (allDiscordRoles) {
      // Filter out already added roles
      const existingRoleIds = roles.map(r => r.discord_role_id);
      const newRoles = allDiscordRoles.filter((r: DiscordAPIRole) => !existingRoleIds.includes(r.id));
      setDiscordRoles(newRoles);
      if (newRoles.length === 0) {
        toast({
          title: 'ไม่มี Role ใหม่',
          description: 'Role ทั้งหมดจาก Discord ถูกเพิ่มในระบบแล้ว',
        });
      } else {
        toast({
          title: 'โหลด Roles สำเร็จ',
          description: `พบ ${newRoles.length} roles ที่ยังไม่ได้เพิ่ม`,
        });
      }
    }
  }

  async function syncRolesFromDiscord() {
    if (roles.length === 0) {
      toast({
        title: 'ไม่มี Role ให้ซิงค์',
        description: 'กรุณานำเข้า Role จาก Discord ก่อน',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const allDiscordRoles = await fetchDiscordRoles();
      if (!allDiscordRoles) return;

      const discordRolesMap = new Map<string, DiscordAPIRole>();
      allDiscordRoles.forEach((role: DiscordAPIRole) => {
        discordRolesMap.set(role.id, role);
      });

      let updatedCount = 0;
      for (const role of roles) {
        const discordRole = discordRolesMap.get(role.discord_role_id);
        if (discordRole) {
          const newEmoji = discordRole.icon || discordRole.unicode_emoji || '🎭';
          const newColor = discordRole.color || '#8B6914';
          const newName = discordRole.name;

          // Check if any field needs updating
          if (role.emoji !== newEmoji || role.color !== newColor || role.display_name !== newName) {
            const { error } = await supabase
              .from('discord_roles')
              .update({
                display_name: newName,
                color: newColor,
                emoji: newEmoji,
              })
              .eq('id', role.id);

            if (!error) {
              updatedCount++;
            }
          }
        }
      }

      await fetchRoles();
      toast({
        title: 'ซิงค์ Roles สำเร็จ',
        description: `อัปเดต ${updatedCount} Role${updatedCount > 0 ? '' : ' (ไม่มีการเปลี่ยนแปลง)'}`,
      });
    } catch (error) {
      console.error('Error syncing roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถซิงค์ Roles ได้',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleBulkImport() {
    if (selectedBulkRoles.length === 0) {
      toast({
        title: 'กรุณาเลือกอย่างน้อย 1 Role',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const rolesToImport = selectedBulkRoles.map((roleId): DiscordRoleInsert | null => {
        const role = discordRoles.find(r => r.id === roleId);
        if (!role) return null;
        
        const emojiValue = role.icon || role.unicode_emoji || '🎭';
        return {
          discord_role_id: role.id,
          display_name: role.name,
          color: role.color || '#8B6914',
          emoji: emojiValue,
          is_active: true,
        };
      }).filter((role): role is DiscordRoleInsert => role !== null);

      const { error } = await supabase
        .from('discord_roles')
        .insert(rolesToImport);

      if (error) throw error;

      toast({
        title: 'นำเข้า Roles สำเร็จ',
        description: `นำเข้า ${rolesToImport.length} Roles เรียบร้อยแล้ว`,
      });

      setImportDialogOpen(false);
      setSelectedBulkRoles([]);
      setDiscordRoles(discordRoles.filter(r => !selectedBulkRoles.includes(r.id)));
      fetchRoles();
    } catch (error) {
      console.error('Error bulk importing roles:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถนำเข้า Roles ได้',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }

  function toggleBulkRole(roleId: string) {
    setSelectedBulkRoles(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  }

  function selectAllRoles() {
    if (selectedBulkRoles.length === discordRoles.length) {
      setSelectedBulkRoles([]);
    } else {
      setSelectedBulkRoles(discordRoles.map(r => r.id));
    }
  }

  async function deleteRole(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบ Role นี้?')) return;
    
    try {
      const { error } = await supabase
        .from('discord_roles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'ลบ Role แล้ว' });
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  async function toggleActive(role: DiscordRole) {
    try {
      const { error } = await supabase
        .from('discord_roles')
        .update({ is_active: !role.is_active })
        .eq('id', role.id);
      if (error) throw error;
      
      setRoles(roles.map(r => 
        r.id === role.id ? { ...r, is_active: !role.is_active } : r
      ));
      
      toast({ title: role.is_active ? 'ปิดใช้งาน Role แล้ว' : 'เปิดใช้งาน Role แล้ว' });
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      });
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await supabase
        .from('discord_roles')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setRoles(roles.filter((r) => !selectedIds.has(r.id)));
      clearSelection();
      setBulkDeleteDialogOpen(false);

      toast({
        title: 'ลบ Role แล้ว',
        description: `ลบ ${idsToDelete.length} Role เรียบร้อยแล้ว`,
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

  function openEditDialog(role: DiscordRole) {
    setEditingRole(role);
    setEditDescription(role.description || '');
  }

  async function saveEditDescription() {
    if (!editingRole) return;

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('discord_roles')
        .update({ description: editDescription || null })
        .eq('id', editingRole.id);

      if (error) throw error;

      // Verify the update persisted
      const { data: verifyData, error: verifyError } = await supabase
        .from('discord_roles')
        .select('description')
        .eq('id', editingRole.id)
        .single();

      if (verifyError) throw verifyError;

      setRoles(roles.map(r => 
        r.id === editingRole.id ? { ...r, description: verifyData.description } : r
      ));

      toast({
        title: 'บันทึกรายละเอียดแล้ว',
        description: `อัปเดตรายละเอียดของ "${editingRole.display_name}" เรียบร้อย`,
      });

      setEditingRole(null);
      setEditDescription('');
    } catch (error) {
      console.error('Error saving description:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกรายละเอียดได้',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            จัดการ Discord Roles
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={syncRolesFromDiscord} 
              variant="outline" 
              className="gap-2"
              disabled={isSyncing || roles.length === 0}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'กำลังซิงค์...' : 'ซิงค์จาก Discord'}
            </Button>
            <Button onClick={openImportDialog} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              นำเข้าจาก Discord
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BulkDeleteToolbar
          selectedCount={selectedCount}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onClear={clearSelection}
          isDeleting={isDeleting}
          itemLabel="Role"
        />
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>ยังไม่มี Discord Roles ในระบบ</p>
            <Button variant="outline" className="mt-4" onClick={openImportDialog}>
              <RefreshCw className="w-4 h-4 mr-2" />
              นำเข้าจาก Discord
            </Button>
          </div>
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
                <TableHead>ไอคอน</TableHead>
                <TableHead>ชื่อแสดง</TableHead>
                <TableHead className="min-w-[200px]">รายละเอียด</TableHead>
                <TableHead>สี</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} className={isSelected(role.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(role.id)}
                      onCheckedChange={() => toggleItem(role.id)}
                      aria-label={`เลือก ${role.display_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <IconDisplay icon={role.emoji} fallback="🎭" size="lg" />
                  </TableCell>
                  <TableCell className="font-medium">{role.display_name}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      {role.description ? (
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {role.description}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">
                          ไม่มีรายละเอียด
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: role.color || '#8B6914' }}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        {role.color || '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {role.is_active ? (
                      <Badge variant="outline" className="text-success border-success gap-1">
                        <CheckCircle className="w-3 h-3" />
                        ใช้งาน
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        ปิด
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openEditDialog(role)}
                        title="แก้ไขรายละเอียด"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleActive(role)}
                        title={role.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      >
                        {role.is_active ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteRole(role.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Import from Discord Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นำเข้า Roles จาก Discord</DialogTitle>
            <DialogDescription>
              เลือก Roles ที่ต้องการนำเข้าจาก Discord Server
            </DialogDescription>
          </DialogHeader>
          {loadingDiscordRoles ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">กำลังโหลด Roles จาก Discord...</span>
            </div>
          ) : discordRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ไม่พบ Roles ใหม่จาก Discord หรือทุก Role ถูกเพิ่มแล้ว
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllRoles}
                >
                  {selectedBulkRoles.length === discordRoles.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  เลือกแล้ว {selectedBulkRoles.length} / {discordRoles.length} roles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {discordRoles.map((role) => (
                  <div
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedBulkRoles.includes(role.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleBulkRole(role.id)}
                  >
                    <Checkbox
                      checked={selectedBulkRoles.includes(role.id)}
                      onCheckedChange={() => toggleBulkRole(role.id)}
                    />
                    <IconDisplay 
                      icon={role.icon || role.unicode_emoji} 
                      fallback="🎭" 
                      size="md" 
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{role.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{role.id}</span>
                    </div>
                    {role.color && (
                      <div 
                        className="w-4 h-4 rounded-full border flex-shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleBulkImport} 
              disabled={selectedBulkRoles.length === 0 || isImporting}
            >
              {isImporting ? 'กำลังนำเข้า...' : `นำเข้า ${selectedBulkRoles.length} Roles`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบ {selectedCount} Role หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? 'กำลังลบ...' : `ลบ ${selectedCount} Role`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              แก้ไขรายละเอียด Role
            </DialogTitle>
            <DialogDescription>
              รายละเอียดนี้จะแสดงในหน้าสร้างแมตช์เมื่อผู้ใช้เลือก Role
            </DialogDescription>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <IconDisplay icon={editingRole.emoji} fallback="🎭" size="lg" />
                <div>
                  <span className="font-medium">{editingRole.display_name}</span>
                  <span className="text-xs text-muted-foreground block font-mono">
                    {editingRole.discord_role_id}
                  </span>
                </div>
                {editingRole.color && (
                  <div 
                    className="w-5 h-5 rounded-full border ml-auto"
                    style={{ backgroundColor: editingRole.color }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">รายละเอียด (Description)</Label>
                <Textarea
                  id="role-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="เพิ่มรายละเอียดสำหรับ Role นี้ เช่น ลักษณะการเล่น หรือข้อมูลเพิ่มเติม..."
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editDescription.length}/500 ตัวอักษร
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              ยกเลิก
            </Button>
            <Button onClick={saveEditDescription} disabled={isSavingEdit}>
              {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
