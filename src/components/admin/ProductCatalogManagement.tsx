import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, RefreshCw, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2, ShoppingBag,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminSkeletonRows } from '@/components/admin/AdminSkeletonCards';

// ─── Types ─────────────────────────────────────────────────────────────────
type ProductType = 'class_role' | 'decoration_role' | 'rental' | 'promo_package' | 'other';

interface ProductCatalogRow {
  id: string;
  role_id: string | null;
  display_name: string;
  product_type: ProductType;
  current_price: number | null;
  is_purchasable: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  class_role: 'ยศคลาส',
  decoration_role: 'ยศตกแต่ง',
  rental: 'เช่าห้อง',
  promo_package: 'แพ็กโปรโมท',
  other: 'อื่นๆ',
};

const PRODUCT_TYPE_COLORS: Record<ProductType, string> = {
  class_role: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700',
  decoration_role: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700',
  rental: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
  promo_package: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
  other: 'text-muted-foreground bg-muted/40 border-border',
};

const ALL_PRODUCT_TYPES: ProductType[] = [
  'class_role',
  'decoration_role',
  'rental',
  'promo_package',
  'other',
];

// ─── Blank form state ───────────────────────────────────────────────────────
const blankForm = {
  display_name: '',
  role_id: '',
  product_type: 'other' as ProductType,
  current_price: '',
  is_purchasable: true,
  is_active: true,
  sort_order: '0',
};

// ─── Component ──────────────────────────────────────────────────────────────
export function ProductCatalogManagement() {
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'all' | ProductType>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  // Add / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductCatalogRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProductCatalogRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    inserted: number; deactivated: number; renamed: number;
  } | null>(null);

  // ── fetch ──
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_catalog' as any)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('display_name', { ascending: true });
      if (error) throw error;
      setProducts((data as unknown as ProductCatalogRow[]) ?? []);
    } catch (err: any) {
      toast({ title: 'โหลดสินค้าไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── filtered list ──
  const filtered = products.filter((p) => {
    const typeOk = filterType === 'all' || p.product_type === filterType;
    const activeOk =
      filterActive === 'all' ||
      (filterActive === 'active' && p.is_active) ||
      (filterActive === 'inactive' && !p.is_active);
    return typeOk && activeOk;
  });

  // ── open dialogs ──
  function openAdd() {
    setEditTarget(null);
    setForm({ ...blankForm, sort_order: String(products.length) });
    setDialogOpen(true);
  }

  function openEdit(product: ProductCatalogRow) {
    setEditTarget(product);
    setForm({
      display_name: product.display_name,
      role_id: product.role_id ?? '',
      product_type: product.product_type,
      current_price: product.current_price != null ? String(product.current_price) : '',
      is_purchasable: product.is_purchasable,
      is_active: product.is_active,
      sort_order: String(product.sort_order),
    });
    setDialogOpen(true);
  }

  // ── save (insert / update) ──
  async function handleSave() {
    if (!form.display_name.trim()) {
      toast({ title: 'กรุณากรอกชื่อสินค้า', variant: 'destructive' });
      return;
    }

    const priceNum = form.current_price.trim() === '' ? null : Number(form.current_price);
    if (form.current_price.trim() !== '' && (isNaN(priceNum!) || priceNum! < 0)) {
      toast({ title: 'ราคาต้องเป็นตัวเลขที่ไม่ติดลบ', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        role_id: form.role_id.trim() || null,
        product_type: form.product_type,
        current_price: priceNum,
        is_purchasable: form.is_purchasable,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order, 10) || 0,
      };

      if (editTarget) {
        const { error } = await supabase
          .from('product_catalog' as any)
          .update(payload)
          .eq('id', editTarget.id);
        if (error) throw error;
        toast({ title: 'อัปเดตสินค้าแล้ว' });
      } else {
        const { error } = await supabase
          .from('product_catalog' as any)
          .insert(payload);
        if (error) throw error;
        toast({ title: 'เพิ่มสินค้าแล้ว' });
      }

      setDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── delete ──
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('product_catalog' as any)
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'ลบสินค้าแล้ว' });
      setDeleteTarget(null);
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  // ── sort order arrows ──
  async function moveProduct(id: string, direction: 'up' | 'down') {
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= products.length) return;

    const current = products[idx];
    const target = products[targetIdx];
    const next = [...products];
    next[idx] = { ...target, sort_order: current.sort_order };
    next[targetIdx] = { ...current, sort_order: target.sort_order };
    setProducts(next);

    try {
      await Promise.all([
        supabase.from('product_catalog' as any).update({ sort_order: target.sort_order }).eq('id', current.id),
        supabase.from('product_catalog' as any).update({ sort_order: current.sort_order }).eq('id', target.id),
      ]);
    } catch {
      fetchProducts(); // revert on error
    }
  }

  // ── quick toggle is_active ──
  async function toggleActive(product: ProductCatalogRow) {
    const { error } = await supabase
      .from('product_catalog' as any)
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    if (error) {
      toast({ title: 'อัปเดตสถานะไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } else {
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, is_active: !product.is_active } : p)
      );
    }
  }

  // ── sync from Discord ──
  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('ไม่พบ session กรุณา login ใหม่');

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-product-catalog`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด');

      const summary = json.summary ?? {};
      setSyncResult({
        inserted: summary.inserted ?? 0,
        deactivated: summary.deactivated ?? 0,
        renamed: summary.renamed ?? 0,
      });
      toast({
        title: 'ซิงค์สำเร็จ',
        description: `เพิ่ม ${summary.inserted} | ปิด ${summary.deactivated} | เปลี่ยนชื่อ ${summary.renamed}`,
      });
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'ซิงค์ไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                คลังสินค้า
                <Badge variant="secondary" className="text-xs">{products.length}</Badge>
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  ซิงค์จาก Discord
                </Button>
                <Button size="sm" className="gap-2" onClick={openAdd}>
                  <Plus className="w-4 h-4" />
                  เพิ่มสินค้า
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Sync result banner */}
            {syncResult && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm flex flex-wrap gap-4">
                <span className="text-green-600 dark:text-green-400">
                  ✦ เพิ่มใหม่ {syncResult.inserted}
                </span>
                <span className="text-destructive">
                  ✦ ปิดใช้งาน {syncResult.deactivated}
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  ✦ เปลี่ยนชื่อ {syncResult.renamed}
                </span>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={filterType}
                onValueChange={(v) => setFilterType(v as typeof filterType)}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="ประเภทสินค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {ALL_PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterActive}
                onValueChange={(v) => setFilterActive(v as typeof filterActive)}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ใช้งาน</SelectItem>
                  <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <AdminSkeletonRows count={6} />
            ) : filtered.length === 0 ? (
              <AdminEmptyState
                icon={ShoppingBag}
                title="ยังไม่มีสินค้า"
                description="กด 'ซิงค์จาก Discord' เพื่อดึง role หรือเพิ่มสินค้าด้วยตนเอง"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ราคา (บาท)</TableHead>
                      <TableHead>ขายได้</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-center">ลำดับ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{product.display_name}</p>
                            {product.role_id && (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {product.role_id}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${PRODUCT_TYPE_COLORS[product.product_type]}`}
                          >
                            {PRODUCT_TYPE_LABELS[product.product_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {product.current_price != null
                            ? product.current_price.toLocaleString('th-TH')
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {product.is_purchasable ? (
                            <Badge variant="outline" className="text-success border-success gap-1 text-xs">
                              <CheckCircle className="w-3 h-3" />
                              ขายได้
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <XCircle className="w-3 h-3" />
                              ปิดขาย
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleActive(product)}
                            className="focus:outline-none"
                            title="คลิกเพื่อสลับสถานะ"
                          >
                            {product.is_active ? (
                              <Badge variant="outline" className="text-success border-success gap-1 text-xs cursor-pointer hover:opacity-80">
                                <CheckCircle className="w-3 h-3" />
                                ใช้งาน
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:opacity-80">
                                <XCircle className="w-3 h-3" />
                                ปิด
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveProduct(product.id, 'up')}
                              disabled={products[0]?.id === product.id}
                              aria-label="เลื่อนขึ้น"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveProduct(product.id, 'down')}
                              disabled={products[products.length - 1]?.id === product.id}
                              aria-label="เลื่อนลง"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(product)}
                              aria-label="แก้ไข"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(product)}
                              aria-label="ลบ"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? 'แก้ไขข้อมูลสินค้าในคลัง'
                : 'เพิ่มสินค้าหรือ role ใหม่เข้าสู่คลังสินค้า'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* display_name */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-display-name">ชื่อสินค้า *</Label>
              <Input
                id="pc-display-name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="เช่น ยศ VIP, เช่าห้องเดือนละ..."
              />
            </div>

            {/* product_type */}
            <div className="space-y-1.5">
              <Label>ประเภทสินค้า</Label>
              <Select
                value={form.product_type}
                onValueChange={(v) => setForm({ ...form, product_type: v as ProductType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* role_id */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-role-id">Discord Role ID (ถ้ามี)</Label>
              <Input
                id="pc-role-id"
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                placeholder="เช่น 1234567890123456789"
                className="font-mono text-sm"
              />
            </div>

            {/* price */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-price">ราคา (บาท)</Label>
              <Input
                id="pc-price"
                type="number"
                min="0"
                step="1"
                value={form.current_price}
                onChange={(e) => setForm({ ...form, current_price: e.target.value })}
                placeholder="ว่างไว้ถ้ายังไม่ตั้งราคา"
              />
            </div>

            {/* sort_order */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-sort">ลำดับการแสดง</Label>
              <Input
                id="pc-sort"
                type="number"
                min="0"
                step="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>

            {/* toggles */}
            <div className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>ขายได้ (is_purchasable)</Label>
                <Switch
                  checked={form.is_purchasable}
                  onCheckedChange={(v) => setForm({ ...form, is_purchasable: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>ใช้งาน (is_active)</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editTarget ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              ลบสินค้า <span className="font-semibold">{deleteTarget?.display_name}</span> ออกจากคลัง?
              การลบจะล้มเหลวถ้ามีบิลที่อ้างอิงสินค้านี้อยู่
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
