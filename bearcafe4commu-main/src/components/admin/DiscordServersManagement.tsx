import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { 
  Loader2, Check, X, ExternalLink, Users, Trash2, Pencil, Plus, 
  MousePointerClick, FolderOpen
} from 'lucide-react';

interface DiscordServer {
  id: string;
  name: string;
  description: string;
  member_count: number;
  icon_url: string;
  banner_url: string;
  invite_url: string;
  status: string;
  owner_id: string;
  category_id: string;
  qc_comment?: string;
  click_count: number;
  bumped_at: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

export function DiscordServersManagement() {
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Edit server state
  const [editServer, setEditServer] = useState<DiscordServer | null>(null);
  const [editForm, setEditForm] = useState({ description: '', category_id: '', qc_comment: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Delete server state
  const [deleteTarget, setDeleteTarget] = useState<DiscordServer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category management
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎮');
  const [catLoading, setCatLoading] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  // Profile map for owner display
  const [profileMap, setProfileMap] = useState<Map<string, { username: string; avatar_url: string | null }>>(new Map());

  const fetchData = async () => {
    try {
      setLoading(true);
      const [serverRes, catRes] = await Promise.all([
        (supabase.from('discord_servers' as any).select('*').order('created_at', { ascending: false })) as any,
        (supabase.from('discord_server_categories' as any).select('*').order('sort_order', { ascending: true })) as any,
      ]);

      const serverData = (serverRes.data || []) as DiscordServer[];
      setServers(serverData);
      setCategories((catRes.data || []) as Category[]);

      // Fetch owner profiles
      const ownerIds = [...new Set(serverData.map(s => s.owner_id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('discord_id, username, avatar_url')
          .in('discord_id', ownerIds);
        if (profiles) {
          const map = new Map<string, { username: string; avatar_url: string | null }>();
          profiles.forEach(p => map.set(p.discord_id, { username: p.username, avatar_url: p.avatar_url }));
          setProfileMap(map);
        }
      }
    } catch (error: any) {
      toast({ title: 'Error fetching servers', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .update({ status })
        .eq('id', id)) as any;
      if (error) throw error;
      toast({ 
        title: status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย',
        className: status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (server: DiscordServer) => {
    setEditServer(server);
    setEditForm({
      description: server.description || '',
      category_id: server.category_id || '',
      qc_comment: server.qc_comment || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editServer) return;
    setEditLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .update({
          description: editForm.description,
          category_id: editForm.category_id || null,
          qc_comment: editForm.qc_comment || null,
        } as any)
        .eq('id', editServer.id)) as any;
      if (error) throw error;
      toast({ title: 'บันทึกเรียบร้อย', className: 'bg-green-500 text-white' });
      setEditServer(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase
        .from('discord_servers' as any)
        .delete()
        .eq('id', deleteTarget.id)) as any;
      if (error) throw error;
      toast({ title: 'ลบเซิร์ฟเวอร์เรียบร้อย', className: 'bg-green-500 text-white' });
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Category CRUD
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setCatLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_server_categories' as any)
        .insert({ name: newCatName, icon: newCatIcon, sort_order: categories.length } as any)) as any;
      if (error) throw error;
      toast({ title: 'เพิ่มหมวดหมู่สำเร็จ', className: 'bg-green-500 text-white' });
      setNewCatName('');
      setNewCatIcon('🎮');
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCatLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCat) return;
    setCatLoading(true);
    try {
      const { error } = await (supabase
        .from('discord_server_categories' as any)
        .update({ name: editCat.name, icon: editCat.icon } as any)
        .eq('id', editCat.id)) as any;
      if (error) throw error;
      toast({ title: 'แก้ไขหมวดหมู่สำเร็จ', className: 'bg-green-500 text-white' });
      setEditCat(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setCatLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      const { error } = await (supabase
        .from('discord_server_categories' as any)
        .delete()
        .eq('id', catId)) as any;
      if (error) throw error;
      toast({ title: 'ลบหมวดหมู่สำเร็จ', className: 'bg-green-500 text-white' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : '-';
  };

  const getOwnerName = (ownerId: string) => {
    const profile = profileMap.get(ownerId);
    return profile?.username || ownerId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">จัดการเซิร์ฟเวอร์</h2>
        <Button size="sm" variant="outline" onClick={() => setIsCatDialogOpen(true)} className="gap-1">
          <FolderOpen className="h-4 w-4" /> จัดการหมวดหมู่
        </Button>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : servers.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground">
            ยังไม่มีเซิร์ฟเวอร์ที่ส่งมาให้ตรวจสอบ
          </div>
        ) : (
          servers.map((server) => (
            <Card key={server.id} className="overflow-hidden border-2 border-latte/20 dark:border-coffee/20">
              {server.banner_url ? (
                <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${server.banner_url})` }} />
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-peach/30 to-blush/30" />
              )}
              
              <CardContent className="p-4 -mt-10">
                <div className="flex justify-between items-end mb-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white dark:border-coffee shadow-lg bg-white">
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-peach flex items-center justify-center text-2xl font-bold text-white">
                        {server.name[0]}
                      </div>
                    )}
                  </div>
                  <Badge variant={server.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {server.status === 'approved' ? 'อนุมัติแล้ว' : 
                     server.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจสอบ'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-lg truncate">{server.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {server.description || 'ไม่มีคำอธิบาย'}
                  </p>
                  
                  {/* Category badge */}
                  {server.category_id && (
                    <Badge variant="outline" className="text-[10px]">
                      {getCategoryName(server.category_id)}
                    </Badge>
                  )}
                  
                  {/* Owner */}
                  <div className="text-xs text-muted-foreground">
                    เจ้าของ: <span className="font-medium text-foreground">{getOwnerName(server.owner_id)}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-y border-latte/10 dark:border-coffee/10">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{(server.member_count || 0).toLocaleString()} สมาชิก</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" />
                      <span>{(server.click_count || 0).toLocaleString()} คลิก</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 flex-wrap">
                    {server.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-green-500 hover:bg-green-600"
                          onClick={() => handleUpdateStatus(server.id, 'approved')}
                        >
                          <Check className="w-4 h-4 mr-1" /> อนุมัติ
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="flex-1"
                          onClick={() => handleUpdateStatus(server.id, 'rejected')}
                        >
                          <X className="w-4 h-4 mr-1" /> ปฏิเสธ
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEdit(server)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(server)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={server.invite_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editServer} onOpenChange={(o) => !o && setEditServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขเซิร์ฟเวอร์: {editServer?.name}</DialogTitle>
            <DialogDescription>แก้ไขคำอธิบาย หมวดหมู่ หรือหมายเหตุ QC</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>คำอธิบาย</Label>
              <Textarea 
                value={editForm.description} 
                onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} 
                placeholder="คำอธิบายเซิร์ฟเวอร์"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select value={editForm.category_id} onValueChange={(v) => setEditForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ QC (ภายใน)</Label>
              <Input 
                value={editForm.qc_comment} 
                onChange={(e) => setEditForm(p => ({ ...p, qc_comment: e.target.value }))} 
                placeholder="หมายเหตุสำหรับทีมงาน..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditServer(null)}>ยกเลิก</Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบเซิร์ฟเวอร์ <strong>{deleteTarget?.name}</strong> ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>จัดการหมวดหมู่เซิร์ฟเวอร์</DialogTitle>
            <DialogDescription>เพิ่ม แก้ไข หรือลบหมวดหมู่สำหรับเซิร์ฟเวอร์ดิสคอร์ด</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Add new */}
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-shrink-0">
                <Label className="text-xs">ไอคอน</Label>
                <Input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="w-16 text-center" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">ชื่อหมวดหมู่</Label>
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="เช่น Community, Gaming" />
              </div>
              <Button size="sm" onClick={handleAddCategory} disabled={catLoading || !newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing categories */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  {editCat?.id === cat.id ? (
                    <>
                      <Input value={editCat.icon} onChange={e => setEditCat({ ...editCat, icon: e.target.value })} className="w-12 text-center text-sm" />
                      <Input value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} className="flex-1 text-sm" />
                      <Button size="sm" variant="ghost" onClick={handleUpdateCategory} disabled={catLoading}>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditCat(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">{cat.icon}</span>
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setEditCat(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีหมวดหมู่</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
