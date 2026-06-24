import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Edit, Loader2, ArrowUp, ArrowDown, ExternalLink,
  Layers, ChevronDown, ChevronRight, Eye, EyeOff, Link2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type DeliveryMode = 'all' | 'random_one' | 'ordered';

type AdPlacement = {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  delivery_mode: DeliveryMode;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SessionAd = {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
};

type PlacementItem = {
  placement_id: string;
  ad_id: string;
  sort_order: number;
  session_ads: SessionAd | null;
};

type PlacementFormData = {
  display_name: string;
  key: string;
  description: string;
  delivery_mode: DeliveryMode;
  is_active: boolean;
};

const INITIAL_FORM: PlacementFormData = {
  display_name: '',
  key: '',
  description: '',
  delivery_mode: 'all',
  is_active: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
}

function isValidKey(k: string): boolean {
  return /^[a-z0-9_]+$/.test(k) && k.length > 0;
}

const DELIVERY_MODE_META: Record<DeliveryMode, { label: string; desc: string; color: string }> = {
  all:        { label: 'แสดงทั้งหมด',  desc: 'แสดงทุกชิ้นตามลำดับที่กำหนด',          color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  ordered:    { label: 'เรียงลำดับ',   desc: 'แสดงทุกชิ้นตามลำดับ (semantic ชัดเจน)', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  random_one: { label: 'สุ่ม 1 ชิ้น',  desc: 'สุ่มแสดง 1 ชิ้นจากรายการที่ assign ไว้', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
};

// ── DeliveryModeBadge ──────────────────────────────────────────────────────────
function DeliveryModeBadge({ mode }: { mode: DeliveryMode }) {
  const meta = DELIVERY_MODE_META[mode];
  return (
    <Badge variant="outline" className={`text-xs ${meta.color}`}>
      {meta.label}
    </Badge>
  );
}

// ── PlacementItemsPanel ────────────────────────────────────────────────────────
interface PlacementItemsPanelProps {
  placement: AdPlacement;
  onItemCountChange: (placementId: string, count: number) => void;
}

function PlacementItemsPanel({ placement, onItemCountChange }: PlacementItemsPanelProps) {
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [allAds, setAllAds] = useState<SessionAd[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('ad_placement_items')
        .select('placement_id, ad_id, sort_order, session_ads(id, image_url, link_url, sort_order, is_active)')
        .eq('placement_id', placement.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const rows = (data as PlacementItem[]) || [];
      setItems(rows);
      onItemCountChange(placement.id, rows.length);
    } catch (err: any) {
      toast({ title: 'โหลด items ไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [placement.id, toast, onItemCountChange]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const removeItem = async (adId: string) => {
    if (!confirm('ลบโฆษณานี้ออกจาก placement?')) return;
    try {
      const { error } = await (supabase as any)
        .from('ad_placement_items')
        .delete()
        .eq('placement_id', placement.id)
        .eq('ad_id', adId);
      if (error) throw error;
      toast({ title: 'ลบออกสำเร็จ' });
      fetchItems();
    } catch (err: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    }
  };

  const moveItem = async (item: PlacementItem, dir: 'up' | 'down') => {
    const idx = items.findIndex(i => i.ad_id === item.ad_id);
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const other = items[newIdx];
    try {
      await Promise.all([
        (supabase as any).from('ad_placement_items')
          .update({ sort_order: newIdx })
          .eq('placement_id', placement.id).eq('ad_id', item.ad_id),
        (supabase as any).from('ad_placement_items')
          .update({ sort_order: idx })
          .eq('placement_id', placement.id).eq('ad_id', other.ad_id),
      ]);
      const updated = [...items];
      updated[idx] = { ...other, sort_order: idx };
      updated[newIdx] = { ...item, sort_order: newIdx };
      setItems(updated);
    } catch {
      toast({ title: 'เรียงลำดับไม่สำเร็จ', variant: 'destructive' });
    }
  };

  const openAddDialog = async () => {
    setSelectedAdIds(new Set());
    setAddDialogOpen(true);
    setLoadingAds(true);
    try {
      const { data, error } = await (supabase as any)
        .from('session_ads')
        .select('id, image_url, link_url, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const assignedIds = new Set(items.map(i => i.ad_id));
      setAllAds(((data as SessionAd[]) || []).filter(a => !assignedIds.has(a.id)));
    } catch (err: any) {
      toast({ title: 'โหลดโฆษณาไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingAds(false);
    }
  };

  const handleAddItems = async () => {
    if (selectedAdIds.size === 0) return;
    setAdding(true);
    try {
      const baseOrder = items.length;
      const rows = Array.from(selectedAdIds).map((adId, i) => ({
        placement_id: placement.id,
        ad_id: adId,
        sort_order: baseOrder + i,
      }));
      const { error } = await (supabase as any).from('ad_placement_items').insert(rows);
      if (error) throw error;
      toast({ title: `เพิ่ม ${rows.length} โฆษณาสำเร็จ` });
      setAddDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      toast({ title: 'เพิ่มไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedAdIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isOrdered = placement.delivery_mode === 'all' || placement.delivery_mode === 'ordered';

  return (
    <div className="p-4 bg-muted/30 border-t border-border/50">
      {/* Hint row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {isOrdered
            ? '📋 แสดงตามลำดับด้านล่าง'
            : '🎲 ลำดับไม่มีผลกับการแสดงผล — สุ่ม 1 ชิ้นต่อครั้ง'}
        </p>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openAddDialog}>
          <Plus className="w-3 h-3" />เพิ่มโฆษณา
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          ยังไม่มีโฆษณาใน placement นี้
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const ad = item.session_ads;
            if (!ad) return null;
            return (
              <div key={item.ad_id}
                className="flex items-center gap-3 bg-background rounded-lg border border-border/40 p-2">
                {/* reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-5 w-5"
                    onClick={() => moveItem(item, 'up')} disabled={index === 0 || !isOrdered}>
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5"
                    onClick={() => moveItem(item, 'down')} disabled={index === items.length - 1 || !isOrdered}>
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>

                {/* thumbnail */}
                <img src={ad.image_url} alt=""
                  className="w-24 h-[38px] object-cover rounded border border-border/40 shrink-0" />

                {/* link */}
                <a href={ad.link_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline truncate flex-1 min-w-0">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ad.link_url}</span>
                </a>

                {/* status */}
                <Badge variant={ad.is_active ? 'default' : 'secondary'}
                  className={`text-xs shrink-0 ${ad.is_active ? 'bg-matcha/80 text-white border-0' : ''}`}>
                  {ad.is_active ? <><Eye className="w-3 h-3 mr-1" />แสดง</> : <><EyeOff className="w-3 h-3 mr-1" />ซ่อน</>}
                </Badge>

                {/* remove */}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeItem(item.ad_id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add ads dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />เพิ่มโฆษณาเข้า — {placement.display_name}
            </DialogTitle>
          </DialogHeader>
          {loadingAds ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allAds.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              ไม่มีโฆษณาที่สามารถเพิ่มได้ (โฆษณาทั้งหมดถูก assign แล้ว หรือไม่มีโฆษณาที่ active)
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {allAds.map(ad => {
                const sel = selectedAdIds.has(ad.id);
                return (
                  <button key={ad.id} type="button"
                    onClick={() => toggleSelect(ad.id)}
                    className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                      sel ? 'border-primary shadow-md' : 'border-border/40 hover:border-primary/40'
                    }`}>
                    <img src={ad.image_url} alt=""
                      className="w-full aspect-[2.5/1] object-cover" />
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground truncate">{ad.link_url}</p>
                    </div>
                    {sel && (
                      <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={adding}>ยกเลิก</Button>
            <Button onClick={handleAddItems} disabled={adding || selectedAdIds.size === 0}>
              {adding
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังเพิ่ม...</>
                : `เพิ่ม ${selectedAdIds.size > 0 ? selectedAdIds.size + ' ' : ''}โฆษณา`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdPlacementsManagement() {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<AdPlacement | null>(null);
  const [form, setForm] = useState<PlacementFormData>(INITIAL_FORM);
  const [keyManual, setKeyManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('ad_placements')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPlacements((data as AdPlacement[]) || []);
    } catch (err: any) {
      toast({ title: 'โหลด placements ไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  const handleItemCountChange = useCallback((placementId: string, count: number) => {
    setItemCounts(prev => ({ ...prev, [placementId]: count }));
  }, []);

  // ── Dialog helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingPlacement(null);
    setForm(INITIAL_FORM);
    setKeyManual(false);
    setDialogOpen(true);
  };

  const openEdit = (p: AdPlacement) => {
    setEditingPlacement(p);
    setForm({
      display_name: p.display_name,
      key: p.key,
      description: p.description ?? '',
      delivery_mode: p.delivery_mode,
      is_active: p.is_active,
    });
    setKeyManual(true);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setKeyManual(false);
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      display_name: name,
      key: keyManual ? prev.key : toKey(name),
    }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast({ title: 'กรุณากรอกชื่อ placement', variant: 'destructive' }); return;
    }
    if (!isValidKey(form.key)) {
      toast({ title: 'Key ไม่ถูกต้อง', description: 'ใช้ได้เฉพาะ a-z, 0-9 และ _', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (editingPlacement) {
        const { error } = await (supabase as any)
          .from('ad_placements')
          .update({
            display_name: form.display_name.trim(),
            key: form.key,
            description: form.description.trim() || null,
            delivery_mode: form.delivery_mode,
            is_active: form.is_active,
          })
          .eq('id', editingPlacement.id);
        if (error) throw error;
        toast({ title: 'แก้ไขสำเร็จ' });
      } else {
        const { error } = await (supabase as any)
          .from('ad_placements')
          .insert({
            display_name: form.display_name.trim(),
            key: form.key,
            description: form.description.trim() || null,
            delivery_mode: form.delivery_mode,
            is_active: form.is_active,
            sort_order: placements.length,
          });
        if (error) throw error;
        toast({ title: 'สร้าง placement สำเร็จ' });
      }
      closeDialog();
      fetchPlacements();
    } catch (err: any) {
      const isDuplKey = err?.message?.includes('unique') || err?.message?.includes('duplicate');
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: isDuplKey ? `Key "${form.key}" มีอยู่แล้ว` : err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (p: AdPlacement) => {
    const count = itemCounts[p.id] ?? 0;
    if (count > 0) {
      toast({
        title: 'ลบไม่ได้',
        description: `มีโฆษณา ${count} ชิ้นอยู่ใน placement นี้ กรุณาลบออกก่อน`,
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`ลบ placement "${p.display_name}"?`)) return;
    try {
      const { error } = await (supabase as any).from('ad_placements').delete().eq('id', p.id);
      if (error) throw error;
      toast({ title: 'ลบสำเร็จ' });
      fetchPlacements();
    } catch (err: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────────
  const toggleActive = async (p: AdPlacement) => {
    try {
      const { error } = await (supabase as any)
        .from('ad_placements')
        .update({ is_active: !p.is_active })
        .eq('id', p.id);
      if (error) throw error;
      setPlacements(prev => prev.map(pl => pl.id === p.id ? { ...pl, is_active: !pl.is_active } : pl));
    } catch (err: any) {
      toast({ title: 'อัปเดตไม่สำเร็จ', variant: 'destructive' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Ad Placements
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />สร้าง Placement
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            จัดกลุ่มโฆษณาและกำหนดโหมดการแสดงผลสำหรับแต่ละตำแหน่ง
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : placements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-primary/40" />
              </div>
              <p className="font-medium text-foreground/60">ยังไม่มี Placement</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />สร้าง Placement แรก
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>ชื่อ / Key</TableHead>
                  <TableHead className="w-[130px]">โหมด</TableHead>
                  <TableHead className="w-[80px]">โฆษณา</TableHead>
                  <TableHead className="w-[80px]">สถานะ</TableHead>
                  <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placements.map(p => {
                  const expanded = expandedId === p.id;
                  const count = itemCounts[p.id] ?? 0;
                  const isWebhook = p.key === 'session_webhook';
                  return (
                    <React.Fragment key={p.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(expanded ? null : p.id)}>
                        <TableCell className="w-8">
                          {expanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{p.display_name}</span>
                            {isWebhook && (
                              <Badge variant="outline" className="text-xs gap-1 border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/5">
                                <Link2 className="w-3 h-3" />ระบบหาเพื่อน
                              </Badge>
                            )}
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                              {p.key}
                            </code>
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[320px]">
                              {p.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DeliveryModeBadge mode={p.delivery_mode} />
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Badge variant="outline" className="text-xs tabular-nums">
                            {count} ชิ้น
                          </Badge>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(p)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0 bg-muted/10">
                            <PlacementItemsPanel
                              placement={p}
                              onItemCountChange={handleItemCountChange}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlacement ? 'แก้ไข Placement' : 'สร้าง Placement ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* display_name */}
            <div className="space-y-2">
              <Label htmlFor="pl-name">ชื่อ *</Label>
              <Input id="pl-name" placeholder="เช่น ระบบหาเพื่อน"
                value={form.display_name}
                onChange={e => handleNameChange(e.target.value)} />
            </div>

            {/* key */}
            <div className="space-y-2">
              <Label htmlFor="pl-key">Key *
                <span className="text-muted-foreground font-normal ml-1 text-xs">(a-z, 0-9, _)</span>
              </Label>
              <Input id="pl-key"
                placeholder="เช่น session_webhook"
                value={form.key}
                className={`font-mono text-sm ${!isValidKey(form.key) && form.key ? 'border-destructive' : ''}`}
                onChange={e => { setKeyManual(true); setForm(prev => ({ ...prev, key: e.target.value })); }} />
              {form.key && !isValidKey(form.key) && (
                <p className="text-xs text-destructive">ใช้ได้เฉพาะ a-z, 0-9 และ _ (ห้ามมีช่องว่าง)</p>
              )}
            </div>

            {/* description */}
            <div className="space-y-2">
              <Label htmlFor="pl-desc">คำอธิบาย <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></Label>
              <Textarea id="pl-desc" placeholder="อธิบายว่า placement นี้ใช้ที่ไหน"
                rows={2}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>

            {/* delivery_mode */}
            <div className="space-y-2">
              <Label>โหมดการแสดงผล</Label>
              <Select value={form.delivery_mode}
                onValueChange={v => setForm(prev => ({ ...prev, delivery_mode: v as DeliveryMode }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DELIVERY_MODE_META) as [DeliveryMode, typeof DELIVERY_MODE_META['all']][]).map(([mode, meta]) => (
                    <SelectItem key={mode} value={mode}>
                      <div className="flex flex-col">
                        <span className="font-medium">{meta.label}</span>
                        <span className="text-xs text-muted-foreground">{meta.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* is_active */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <Label>เปิดใช้งาน</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ปิด placement = webhook ไม่แสดงโฆษณาจาก placement นี้
                </p>
              </div>
              <Switch checked={form.is_active}
                onCheckedChange={v => setForm(prev => ({ ...prev, is_active: v }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving || !isValidKey(form.key)}>
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</>
                : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
