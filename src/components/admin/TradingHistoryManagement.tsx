import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import imageCompression from 'browser-image-compression';
import jsQR from 'jsqr';
import {
  RefreshCw,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  CreditCard,
  Package,
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  DollarSign,
  Receipt,
  Plus,
  UploadCloud,
  Loader2,
  X,
  Bell,
  BellOff,
  List,
  PieChart,
  Trash2,
  Pencil,
  Mail,
  Tag,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { formatThaiDate } from '@/lib/thai-date';
import { computeSalmonPreview, computeSalmonDelta } from '@/lib/salmonPoint';
import fishIcon from '@/assets/fish-icon.png';

const ITEMS_PER_PAGE = 12;
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1410538470253793331/O1fVU-YMsPrHJNZao3NjbHlkxoutDbh29YA26A2Fb-t6fRZOCrjTjLlESZ4lQKP5cTMA';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_SEND_TRADING_EMBED = `${SUPABASE_URL}/functions/v1/send-trading-embed`;

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductType = 'class_role' | 'decoration_role' | 'rental' | 'promo_package' | 'other';

/** Unified record shown in the card grid — covers both legacy & new bills */
interface UnifiedRecord {
  id: string;
  source: 'legacy' | 'new';          // 'legacy' = trading_history, 'new' = orders
  member_id: string;
  staff_id: string | null;
  transaction_date: string | null;    // YYYY-MM-DD (legacy uses transaction field)
  total_amount: number;
  type_bill: string | null;
  slip_url: string | null;
  slip_url_2: string | null;
  log_timestamp: string;
  created_at: string;
  // legacy-only
  item?: string | null;
  // new-only: fetched separately
  purchase_items?: PurchaseItemDetail[];
}

interface PurchaseItemDetail {
  id: string;
  product_id: string;
  price_paid: number;
  original_price: number | null;
  is_promotion: boolean;
  product_display_name: string;
  product_type: ProductType;
}

interface ProductCatalogRow {
  id: string;
  role_id: string | null;
  display_name: string;
  product_type: ProductType;
  current_price: number | null;
  is_purchasable: boolean;
  is_active: boolean;
  sort_order: number;
}

interface DiscordProfile {
  discord_id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
}

// ─── Selected item for create-bill form ──────────────────────────────────────
interface SelectedItem {
  product_id: string;
  display_name: string;
  product_type: ProductType;
  price_paid: string;          // editable string
  original_price: string;      // editable string (promotion only)
  is_promotion: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUnicodeNumber(n: number): string {
  const unicodeDigits = ['𝟢','𝟣','𝟤','𝟥','𝟦','𝟧','𝟨','𝟩','𝟪','𝟫'];
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return formatted.replace(/[0-9]/g, (d) => unicodeDigits[parseInt(d)]);
}

function parseTransactionDate(raw: string | null): Date | null {
  if (!raw) return null;
  const slashMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashMatch) {
    const [, day, month, yearStr] = slashMatch;
    let year = parseInt(yearStr);
    if (year > 2400) year -= 543;
    const d = new Date(year, parseInt(month) - 1, parseInt(day));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTransactionDate(raw: string | null): string {
  if (!raw) return '-';
  const d = parseTransactionDate(raw);
  if (!d) return raw;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TradingHistoryManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Records (merged legacy + new)
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Discord roles mapping for icon & colors
  const [discordRolesMap, setDiscordRolesMap] = useState<Map<string, { display_name: string; color: string | null; emoji: string | null }>>(new Map());

  // Fetch discord_roles on mount
  useEffect(() => {
    supabase.from('discord_roles').select('id, display_name, color, emoji')
      .then(({ data }) => {
        if (data) {
          const map = new Map<string, { display_name: string; color: string | null; emoji: string | null }>();
          data.forEach(r => {
            map.set(r.id, { display_name: r.display_name, color: r.color, emoji: r.emoji });
          });
          setDiscordRolesMap(map);
        }
      });
  }, []);

  // Product catalog
  const [catalog, setCatalog] = useState<ProductCatalogRow[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Profile / salmon maps
  const [profileMap, setProfileMap] = useState<Map<string, DiscordProfile>>(new Map());
  const [salmonPointMap, setSalmonPointMap] = useState<Map<string, number>>(new Map());

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('data');

  // Delete / edit / embed targets
  const [deleteTarget, setDeleteTarget] = useState<UnifiedRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<UnifiedRecord | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', transaction: '', type_bill: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [embedTarget, setEmbedTarget] = useState<UnifiedRecord | null>(null);
  const [isSendingEmbed, setIsSendingEmbed] = useState(false);

  // Webhook toggle
  const [webhookEnabled, setWebhookEnabled] = useState(true);

  // ── Create Bill state ──
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newBill, setNewBill] = useState({
    memberId: '',
    transactionDate: '',
    billType: 'ธนาคารทั่วไป',
  });
  // 2 separate item lists: class_role (max 1) and others (multi)
  const [selectedClassItem, setSelectedClassItem] = useState<SelectedItem | null>(null);
  const [selectedOtherItems, setSelectedOtherItems] = useState<SelectedItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  useEffect(() => {
    if (!isAddDialogOpen) setCatalogSearch('');
  }, [isAddDialogOpen]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const previewUrls = useMemo(() => selectedFiles.map(f => URL.createObjectURL(f)), [selectedFiles]);
  useEffect(() => () => { previewUrls.forEach(URL.revokeObjectURL); }, [previewUrls]);

  // ── Filters ──
  const [serviceQuery, setServiceQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');
  const [billTypeQuery, setBillTypeQuery] = useState('');
  const [periodMode, setPeriodMode] = useState<'day' | 'month' | 'year'>('day');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // ── Load webhook setting ──
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'trading_webhook_enabled').single()
      .then(({ data }) => {
        if (data) setWebhookEnabled(data.value === true || data.value === 'true');
      });
  }, []);

  const toggleWebhook = async (enabled: boolean) => {
    if (!user?.is_owner) return;
    setWebhookEnabled(enabled);
    const { error } = await supabase.from('site_settings').upsert({ key: 'trading_webhook_enabled', value: enabled });
    if (error) toast({ title: 'บันทึกการตั้งค่าไม่สำเร็จ', variant: 'destructive' });
    else toast({ title: enabled ? 'เปิดการแจ้งเตือน Discord แล้ว' : 'ปิดการแจ้งเตือน Discord แล้ว' });
  };

  // ── Fetch product catalog ──
  const fetchCatalog = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('product_catalog')
      .select('id, role_id, display_name, product_type, current_price, is_purchasable, is_active, sort_order')
      .eq('is_active', true)
      .eq('is_purchasable', true)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });
    if (data) setCatalog(data as ProductCatalogRow[]);
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  // ── Fetch profiles / salmon ──
  const fetchProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return;
    const map = new Map<string, DiscordProfile>();
    const chunkSize = 150;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const { data } = await supabase.from('profiles').select('discord_id, username, discord_username, avatar_url').in('discord_id', chunk);
      if (data) {
        data.forEach(p => map.set(p.discord_id, p));
      }
    }
    setProfileMap(map);
  }, []);

  const fetchSalmonPoints = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return;
    const map = new Map<string, number>();
    const chunkSize = 150;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const { data } = await supabase.from('user_points').select('discord_id, salmon_point').in('discord_id', chunk);
      if (data) {
        data.forEach(p => map.set(p.discord_id, p.salmon_point ?? 0));
      }
    }
    setSalmonPointMap(map);
  }, []);

  // ── Fetch purchase_items for new orders ──
  const fetchPurchaseItems = useCallback(async (orderIds: string[]): Promise<Map<string, PurchaseItemDetail[]>> => {
    if (!orderIds.length) return new Map();
    const map = new Map<string, PurchaseItemDetail[]>();
    const chunkSize = 150;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      const { data } = await (supabase as any)
        .from('purchase_items')
        .select(`
          id, order_id, product_id, price_paid, original_price, is_promotion,
          product_catalog!inner(display_name, product_type)
        `)
        .in('order_id', chunk);
      if (data) {
        for (const row of data as any[]) {
          const item: PurchaseItemDetail = {
            id: row.id,
            product_id: row.product_id,
            price_paid: row.price_paid,
            original_price: row.original_price,
            is_promotion: row.is_promotion,
            product_display_name: row.product_catalog?.display_name ?? '?',
            product_type: row.product_catalog?.product_type ?? 'other',
          };
          const arr = map.get(row.order_id) ?? [];
          arr.push(item);
          map.set(row.order_id, arr);
        }
      }
    }
    return map;
  }, []);

  // ── Main fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Legacy records from trading_history
      const { data: legacyData, error: legacyErr } = await supabase
        .from('trading_history')
        .select('*')
        .order('transaction', { ascending: false, nullsFirst: false })
        .order('log_timestamp', { ascending: false });
      if (legacyErr) throw new Error(legacyErr.message);

      const legacyRecords: UnifiedRecord[] = (legacyData ?? []).map(r => ({
        id: r.id,
        source: 'legacy',
        member_id: r.member_id,
        staff_id: r.service_id ?? null,
        transaction_date: r.transaction ?? null,
        total_amount: r.amount ?? 0,
        type_bill: r.type_bill ?? null,
        slip_url: r.slip_url ?? null,
        slip_url_2: r.slip_url_2 ?? null,
        log_timestamp: r.log_timestamp,
        created_at: r.created_at,
        item: r.item ?? null,
      }));

      // 2. New orders
      const { data: ordersData, error: ordersErr } = await (supabase as any)
        .from('orders')
        .select('*')
        .order('transaction_date', { ascending: false, nullsFirst: false })
        .order('log_timestamp', { ascending: false });
      if (ordersErr) throw new Error(ordersErr.message);

      const newOrders: UnifiedRecord[] = (ordersData ?? []).map((r: any) => ({
        id: r.id,
        source: 'new',
        member_id: r.member_id,
        staff_id: r.staff_id ?? null,
        transaction_date: r.transaction_date ?? null,
        total_amount: r.total_amount ?? 0,
        type_bill: r.type_bill ?? null,
        slip_url: r.slip_url ?? null,
        slip_url_2: r.slip_url_2 ?? null,
        log_timestamp: r.log_timestamp,
        created_at: r.created_at,
      }));

      // 3. Fetch purchase_items for new orders
      const orderIds = newOrders.map(r => r.id);
      const itemsMap = await fetchPurchaseItems(orderIds);
      for (const r of newOrders) {
        r.purchase_items = itemsMap.get(r.id) ?? [];
      }

      // 4. Merge and sort by transaction_date desc, then log_timestamp desc
      const merged = [...legacyRecords, ...newOrders].sort((a, b) => {
        const da = parseTransactionDate(a.transaction_date);
        const db = parseTransactionDate(b.transaction_date);
        if (da && db) { const diff = db.getTime() - da.getTime(); if (diff !== 0) return diff; }
        if (da && !db) return -1;
        if (!da && db) return 1;
        return new Date(b.log_timestamp).getTime() - new Date(a.log_timestamp).getTime();
      });

      const allIds = merged.flatMap(r => [r.staff_id, r.member_id].filter(Boolean) as string[]);
      fetchProfiles(allIds);
      fetchSalmonPoints([...new Set(merged.map(r => r.member_id).filter(Boolean))]);
      setRecords(merged);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles, fetchSalmonPoints, fetchPurchaseItems]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setInterval(fetchData, 30000); return () => clearInterval(t); }, [fetchData]);

  // ── QR scan ──
  const scanQRCode = async (file: File): Promise<string | null> => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          canvas.width = img.width; canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(data.data, data.width, data.height);
          resolve(code ? code.data : null);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 2) {
      toast({ title: 'อัปโหลดได้สูงสุด 2 รูป', variant: 'destructive' }); return;
    }
    const newFiles = [...selectedFiles, ...files].slice(0, 2);
    setSelectedFiles(newFiles);
    if (files.length > 0) {
      try {
        const qr = await scanQRCode(files[0]);
        if (qr) {
          const isTrueMoney = qr.includes('140') || qr.toLowerCase().includes('truemoney');
          setNewBill(p => ({ ...p, billType: isTrueMoney ? 'ทรูมันนี่' : 'ธนาคารทั่วไป' }));
          toast({ title: `ตรวจพบสลิป${isTrueMoney ? ' TrueMoney' : 'ธนาคาร'}`, description: 'เลือกประเภทบิลอัตโนมัติ' });
        }
      } catch { /* ignore */ }
    }
  };

  // ── Class item select ──
  const handleSelectClassItem = (productId: string) => {
    if (productId === 'none' || !productId) {
      setSelectedClassItem(null);
      return;
    }
    const p = catalog.find(c => c.id === productId);
    if (!p) return;
    setSelectedClassItem({
      product_id: p.id,
      display_name: p.display_name,
      product_type: p.product_type,
      price_paid: p.current_price != null ? String(p.current_price) : '',
      original_price: '',
      is_promotion: false,
    });
  };

  // ── Other item add ──
  const handleAddOtherItem = (productId: string) => {
    const p = catalog.find(c => c.id === productId);
    if (!p) return;
    if (selectedOtherItems.find(i => i.product_id === p.id)) return; // already added
    setSelectedOtherItems(prev => [...prev, {
      product_id: p.id,
      display_name: p.display_name,
      product_type: p.product_type,
      price_paid: p.current_price != null ? String(p.current_price) : '',
      original_price: '',
      is_promotion: false,
    }]);
  };

  const handleRemoveOtherItem = (productId: string) => {
    setSelectedOtherItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateItem = (
    which: 'class' | 'other',
    productId: string,
    field: keyof SelectedItem,
    value: string | boolean,
  ) => {
    if (which === 'class') {
      setSelectedClassItem(prev => prev ? { ...prev, [field]: value } : prev);
    } else {
      setSelectedOtherItems(prev =>
        prev.map(i => i.product_id === productId ? { ...i, [field]: value } : i)
      );
    }
  };

  // Derived: all selected items
  const allSelectedItems = useMemo(() => {
    const items: SelectedItem[] = [];
    if (selectedClassItem) items.push(selectedClassItem);
    items.push(...selectedOtherItems);
    return items;
  }, [selectedClassItem, selectedOtherItems]);

  // Derived: total amount from selected items
  const computedTotalAmount = useMemo(() =>
    allSelectedItems.reduce((sum, i) => sum + (parseFloat(i.price_paid) || 0), 0),
    [allSelectedItems],
  );

  const salmonPointPreview = useMemo(() => computeSalmonPreview(String(computedTotalAmount)), [computedTotalAmount]);

  // ── Create bill (new system → orders + purchase_items) ──
  const handleAddBill = async () => {
    if (!newBill.memberId || !newBill.transactionDate || allSelectedItems.length === 0 || selectedFiles.length === 0) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'ต้องมีสินค้าอย่างน้อย 1 รายการ และรูปภาพอย่างน้อย 1 รูป', variant: 'destructive' });
      return;
    }
    // Validate prices
    for (const item of allSelectedItems) {
      if (!item.price_paid || parseFloat(item.price_paid) < 0) {
        toast({ title: `กรุณากรอกราคาสำหรับ "${item.display_name}"`, variant: 'destructive' });
        return;
      }
      if (item.is_promotion && (!item.original_price || parseFloat(item.original_price) <= 0)) {
        toast({ title: `กรุณากรอกราคาเต็มสำหรับ "${item.display_name}" (โปรโมชัน)`, variant: 'destructive' });
        return;
      }
    }

    setAddLoading(true);
    try {
      // 1. Upload slip images
      const imageUrls: string[] = [];
      for (const file of selectedFiles) {
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${compressed.type.split('/')[1]}`;
        const { error: uploadError } = await supabase.storage.from('slip-images').upload(fileName, compressed, { cacheControl: '86400' });
        if (uploadError) throw uploadError;
        imageUrls.push(supabase.storage.from('slip-images').getPublicUrl(fileName).data.publicUrl);
      }

      // 2. Insert order (total_amount will be set by trigger after purchase_items insert)
      const { data: orderData, error: orderError } = await (supabase as any).from('orders').insert({
        member_id: newBill.memberId.trim(),
        staff_id: user?.discord_id ?? null,
        transaction_date: newBill.transactionDate,
        total_amount: 0, // trigger will update this
        type_bill: newBill.billType,
        slip_url: imageUrls[0] ?? null,
        slip_url_2: imageUrls[1] ?? null,
        log_timestamp: new Date().toISOString(),
      }).select('id').single();
      if (orderError) throw orderError;

      const orderId = (orderData as any).id as string;

      // 3. Insert purchase_items
      const itemsPayload = allSelectedItems.map(i => ({
        order_id: orderId,
        product_id: i.product_id,
        price_paid: parseFloat(i.price_paid) || 0,
        original_price: i.is_promotion ? (parseFloat(i.original_price) || null) : null,
        is_promotion: i.is_promotion,
      }));
      const { error: itemsError } = await (supabase as any).from('purchase_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      // 4. Discord webhook notification
      if (webhookEnabled && DISCORD_WEBHOOK_URL) {
        const unixTime = Math.floor(Date.now() / 1000);
        const discordTimestamp = `<t:${unixTime}:F> (<t:${unixTime}:R>)`;
        const buyerId = user?.discord_id ?? 'Unknown';
        const productList = allSelectedItems.map(i => i.is_promotion ? `${i.display_name} (โปรโมชัน ฿${i.price_paid})` : `${i.display_name} (฿${i.price_paid})`).join(', ');
        const billType = newBill.billType;
        let thumbnailUrl = '';
        if (billType === 'ธนาคารทั่วไป') thumbnailUrl = 'https://cdn.discordapp.com/attachments/1144675871798591569/1410542166232531024/bank.png';
        else if (billType === 'ทรูมันนี่') thumbnailUrl = 'https://cdn.discordapp.com/attachments/1144675871798591569/1410542166664806510/truemoney.png';

        const description = `## <:Service:1395695113258274887>︲__\` มีการส่งบิลใหม่! \`__\n<:line:1144701793989840997>\n- __\`ผู้ดำเนินการ\`__: <@${buyerId}>\n- __\`ผู้ซื้อ\`__: <@${newBill.memberId}> - \`${newBill.memberId}\`\n- __\`เวลา\`__: ${discordTimestamp}\n- __\`ยอดรวม\`__: ${computedTotalAmount} บาท\n- __\`ประเภทบิล\`__: ${billType}\n- __\`สินค้า\`__: ${productList}`.trim();

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: '⊹ ꒰ แจ้งเตือนบิลใหม่ ꒱ 💸',
            content: `<@${buyerId}> <@${newBill.memberId}>`,
            embeds: [{ description, color: 0xffdf8f, thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined, image: imageUrls[0] ? { url: imageUrls[0] } : undefined }],
          }),
        });
      }

      toast({ title: 'สร้างบิลสำเร็จ', className: 'bg-success text-success-foreground' });
      setIsAddDialogOpen(false);
      setNewBill({ memberId: '', transactionDate: '', billType: 'ธนาคารทั่วไป' });
      setSelectedClassItem(null);
      setSelectedOtherItems([]);
      setSelectedFiles([]);
      fetchData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget || !user?.is_owner) return;
    setIsDeleting(true);
    try {
      const imagesToDelete = [deleteTarget.slip_url, deleteTarget.slip_url_2].filter(Boolean) as string[];
      const paths: string[] = [];
      for (const url of imagesToDelete) {
        if (url.includes('/storage/v1/object/public/slip-images/')) {
          const parts = url.split('/slip-images/');
          if (parts.length > 1) paths.push(decodeURIComponent(parts[1]));
        }
      }
      if (paths.length > 0) await supabase.storage.from('slip-images').remove(paths);

      if (deleteTarget.source === 'legacy') {
        const { error } = await supabase.from('trading_history').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      } else {
        // purchase_items will cascade, trigger updates salmon_point
        const { error } = await (supabase as any).from('orders').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      }

      toast({ title: 'ลบข้อมูลเรียบร้อยแล้ว', className: 'bg-success text-success-foreground' });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Edit ──
  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      if (editTarget.source === 'legacy') {
        const { error } = await supabase.from('trading_history').update({
          amount: parseFloat(editForm.amount) || 0,
          transaction: editForm.transaction,
          type_bill: editForm.type_bill,
        }).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('orders').update({
          transaction_date: editForm.transaction,
          type_bill: editForm.type_bill,
        }).eq('id', editTarget.id);
        if (error) throw error;
      }
      toast({ title: 'บันทึกเรียบร้อย', className: 'bg-success text-success-foreground' });
      setEditTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  // ── Display helpers ──
  const resolveDisplayName = useCallback((id: string) => {
    if (!id) return { name: '-', discord_username: null, avatar: null };
    const p = profileMap.get(id);
    return p ? { name: p.username, discord_username: p.discord_username ?? null, avatar: p.avatar_url } : { name: id, discord_username: null, avatar: null };
  }, [profileMap]);

  const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const totalAmountByMember = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => map.set(r.member_id, (map.get(r.member_id) ?? 0) + r.total_amount));
    return map;
  }, [records]);

  // ── Send embed ──
  const handleSendEmbed = async (r: UnifiedRecord) => {
    setIsSendingEmbed(true);
    try {
      const res = await fetch(EDGE_SEND_TRADING_EMBED, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          member_id: r.member_id,
          latest_amount: r.total_amount,
          total_amount: totalAmountByMember.get(r.member_id) ?? r.total_amount,
          avatar_url: profileMap.get(r.member_id)?.avatar_url ?? '',
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as any).details || (e as any).error || `HTTP ${res.status}`);
      }
      toast({ title: 'ส่ง embed สำเร็จ', className: 'bg-success text-success-foreground' });
    } catch (err: any) {
      toast({ title: 'ส่ง embed ไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingEmbed(false);
      setEmbedTarget(null);
    }
  };

  // ── Filters / pagination ──
  const filteredRecords = useMemo(() => records.filter(r => {
    const svcResolved = resolveDisplayName(r.staff_id ?? '');
    const svcMatch = !serviceQuery.trim() ||
      (r.staff_id ?? '').toLowerCase().includes(serviceQuery.toLowerCase()) ||
      svcResolved.name.toLowerCase().includes(serviceQuery.toLowerCase()) ||
      (svcResolved.discord_username ?? '').toLowerCase().includes(serviceQuery.toLowerCase());
    const memResolved = resolveDisplayName(r.member_id);
    const memMatch = !memberQuery.trim() ||
      r.member_id.toLowerCase().includes(memberQuery.toLowerCase()) ||
      memResolved.name.toLowerCase().includes(memberQuery.toLowerCase()) ||
      (memResolved.discord_username ?? '').toLowerCase().includes(memberQuery.toLowerCase());
    const typeMatch = !billTypeQuery.trim() || (r.type_bill ?? '').toLowerCase().includes(billTypeQuery.toLowerCase());
    const dateMatch = !dateQuery || (() => {
      const d = parseTransactionDate(r.transaction_date);
      if (!d) return false;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === dateQuery;
    })();
    const periodMatch = !selectedPeriod || selectedPeriod === 'all' || (() => {
      const d = parseTransactionDate(r.transaction_date);
      if (!d) return false;
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      if (periodMode === 'day') return `${yyyy}-${mm}-${dd}` === selectedPeriod;
      if (periodMode === 'month') return `${yyyy}-${mm}` === selectedPeriod;
      return yyyy === selectedPeriod;
    })();
    return svcMatch && memMatch && typeMatch && dateMatch && periodMatch;
  }), [records, serviceQuery, memberQuery, billTypeQuery, dateQuery, selectedPeriod, periodMode, resolveDisplayName]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

  // ── Stats ──
  const periodOptions = useMemo(() => {
    const days = new Set<string>(), months = new Set<string>(), years = new Set<string>();
    records.forEach(r => {
      const d = parseTransactionDate(r.transaction_date);
      if (!d) return;
      const yyyy = String(d.getFullYear()), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
      days.add(`${yyyy}-${mm}-${dd}`); months.add(`${yyyy}-${mm}`); years.add(yyyy);
    });
    return { days: [...days].sort().reverse(), months: [...months].sort().reverse(), years: [...years].sort().reverse() };
  }, [records]);

  const periodFilteredRecords = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'all') return records;
    return records.filter(r => {
      const d = parseTransactionDate(r.transaction_date);
      if (!d) return false;
      const yyyy = String(d.getFullYear()), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
      if (periodMode === 'day') return `${yyyy}-${mm}-${dd}` === selectedPeriod;
      if (periodMode === 'month') return `${yyyy}-${mm}` === selectedPeriod;
      return yyyy === selectedPeriod;
    });
  }, [records, periodMode, selectedPeriod]);

  const summaryStats = useMemo(() => {
    const totalAmount = records.reduce((s, r) => s + r.total_amount, 0);
    const totalBills = records.length;
    const dailyMap = new Map<string, { amount: number; count: number }>();
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    records.forEach(r => {
      const d = parseTransactionDate(r.transaction_date);
      if (!d) return;
      const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const a = r.total_amount;
      const pd = dailyMap.get(dk) ?? { amount: 0, count: 0 }; dailyMap.set(dk, { amount: pd.amount+a, count: pd.count+1 });
      const pm = monthlyMap.get(mk) ?? { amount: 0, count: 0 }; monthlyMap.set(mk, { amount: pm.amount+a, count: pm.count+1 });
    });
    const dailyData = [...dailyMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({ date: date.slice(5), ...v }));
    const monthlyData = [...monthlyMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,v])=>({ month, ...v }));
    const today = new Date();
    const tk = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    return { totalAmount, totalBills, dailyData, monthlyData, todayStats: dailyMap.get(tk) ?? { amount:0,count:0 }, thisMonthStats: monthlyMap.get(thisMonthKey) ?? { amount:0,count:0 } };
  }, [records]);

  const periodSummary = useMemo(() => ({
    totalAmount: periodFilteredRecords.reduce((s, r) => s + r.total_amount, 0),
    totalBills: periodFilteredRecords.length,
  }), [periodFilteredRecords]);

  const formatPeriodLabel = (val: string) => {
    if (periodMode === 'day') { const p = val.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
    if (periodMode === 'month') { const th = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; const p = val.split('-'); return `${th[parseInt(p[1])-1]} ${p[0]}`; }
    return `ปี ${val}`;
  };

  const currentPeriodOptions = periodMode === 'day' ? periodOptions.days : periodMode === 'month' ? periodOptions.months : periodOptions.years;

  const CustomTooltipContent = ({ active: a, payload: p, label: l }: any) => {
    if (!a || !p?.length) return null;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
        <p className="font-medium mb-1">{l}</p>
        {p.map((e: any) => <p key={e.dataKey} style={{ color: e.color }}>{e.dataKey === 'amount' ? `฿${formatCurrency(e.value)}` : `${e.value} บิล`}</p>)}
      </div>
    );
  };

  const UserBadge = ({ id }: { id: string }) => {
    const { name, discord_username, avatar } = resolveDisplayName(id);
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <Avatar className="w-5 h-5 shrink-0">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback className="text-[10px] bg-muted"><User className="w-3 h-3" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {discord_username ? (<><span className="text-xs font-semibold truncate block">{discord_username}</span><span className="text-[10px] text-muted-foreground truncate block">{name}</span></>) : <span className="text-xs font-medium truncate block">{name}</span>}
        </div>
      </div>
    );
  };

  // ── Catalog split ──
  const classItems = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return catalog.filter(c => c.product_type === 'class_role' && c.display_name.toLowerCase().includes(q));
  }, [catalog, catalogSearch]);
  const otherItems = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return catalog.filter(c => c.product_type !== 'class_role' && c.display_name.toLowerCase().includes(q));
  }, [catalog, catalogSearch]);

  // ── Loading / Error states ──
  if (loading && records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">ประวัติการซื้อขาย</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-8 w-24" />
            </CardContent></Card>
          ))}
        </div>
      </div>
    );
  }
  if (error && records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">ไม่สามารถโหลดข้อมูลได้</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> ลองใหม่</Button>
      </div>
    );
  }

  // ── JSX ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">ประวัติการซื้อขาย</h2>
          <Badge variant="secondary" className="gap-1.5 font-normal text-xs h-6">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" /> อัปเดตอัตโนมัติ
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground mr-2 hidden sm:block">{filteredRecords.length} รายการ</div>
          {user?.is_owner && (
            <div className="flex items-center gap-2 mr-2 border-r pr-4">
              <Switch checked={webhookEnabled} onCheckedChange={toggleWebhook} id="webhook-toggle" />
              <Label htmlFor="webhook-toggle" className="text-xs flex items-center gap-1 cursor-pointer select-none">
                {webhookEnabled ? <Bell className="h-3 w-3 text-success" /> : <BellOff className="h-3 w-3 text-muted-foreground" />} แจ้งเตือน Discord
              </Label>
            </div>
          )}
          {/* Create Bill Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> สร้างบิลใหม่</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  สร้างบิลใหม่
                </DialogTitle>
                <DialogDescription>บันทึกการขายเข้าระบบใหม่ (orders + purchase_items)</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Member / date / bill type */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted/40 p-4 rounded-2xl border border-border/40">
                  <div className="space-y-1">
                    <Label htmlFor="memberId" className="text-xs font-semibold">Member ID (ผู้ซื้อ) *</Label>
                    <Input id="memberId" value={newBill.memberId} onChange={e => setNewBill(p => ({ ...p, memberId: e.target.value }))} placeholder="Discord ID" className="h-9 text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="txDate" className="text-xs font-semibold">วันทำรายการ *</Label>
                    <Input type="date" id="txDate" value={newBill.transactionDate} onChange={e => setNewBill(p => ({ ...p, transactionDate: e.target.value }))} className="h-9 text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">ประเภทบิล</Label>
                    <Select value={newBill.billType} onValueChange={v => setNewBill(p => ({ ...p, billType: v }))}>
                      <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ธนาคารทั่วไป">ธนาคารทั่วไป</SelectItem>
                        <SelectItem value="ทรูมันนี่">ทรูมันนี่</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 2-Column Grid: Catalog vs Shopping Cart */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Product Catalog */}
                  <div className="flex flex-col border rounded-2xl p-4 bg-muted/20 h-[380px]">
                    <div className="flex flex-col gap-2 mb-3 shrink-0">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-primary" /> เลือกสินค้าใส่ตะกร้า
                      </h3>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          placeholder="ค้นหาชื่อสินค้า..."
                          className="pl-8 h-7 text-xs rounded-xl bg-card border-border/40 focus:ring-primary/20"
                        />
                        {catalogSearch && (
                          <button
                            onClick={() => setCatalogSearch('')}
                            className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      {/* Class Roles Section */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wide">คลาสเรียน (ยศหลัก — เลือกได้สูงสุด 1 คลาส)</h4>
                        {classItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic pl-1">ไม่มีสินค้าประเภทคลาสเรียน</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {classItems.map(p => {
                              const role = p.role_id ? discordRolesMap.get(p.role_id) : null;
                              const isAdded = selectedClassItem?.product_id === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectClassItem(p.id)}
                                  className={cn(
                                    'w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all hover:scale-[1.005] active:scale-[0.995]',
                                    isAdded
                                      ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/20'
                                      : 'bg-card border-border/40 hover:bg-muted/40'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-secondary/50 flex items-center justify-center border border-border/40 shrink-0">
                                      {role?.emoji ? (
                                        <IconDisplay icon={role.emoji} fallback="🎭" size="sm" />
                                      ) : (
                                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span className="font-medium text-foreground truncate">{p.display_name}</span>
                                  </div>
                                  <span className="font-bold text-primary shrink-0 ml-2">฿{p.current_price?.toLocaleString() ?? 0}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Other Items Section */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wide font-semibold">ยศตกแต่ง / ของแถม / บริการอื่น ๆ</h4>
                        {otherItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic pl-1">ไม่มีสินค้าอื่นที่เปิดขายอยู่</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {otherItems.map(p => {
                              const role = p.role_id ? discordRolesMap.get(p.role_id) : null;
                              const isAdded = !!selectedOtherItems.find(i => i.product_id === p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => isAdded ? handleRemoveOtherItem(p.id) : handleAddOtherItem(p.id)}
                                  className={cn(
                                    'w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all hover:scale-[1.005] active:scale-[0.995]',
                                    isAdded
                                      ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/20'
                                      : 'bg-card border-border/40 hover:bg-muted/40'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-secondary/50 flex items-center justify-center border border-border/40 shrink-0">
                                      {role?.emoji ? (
                                        <IconDisplay icon={role.emoji} fallback="🎭" size="sm" />
                                      ) : (
                                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span className="font-medium text-foreground truncate">{p.display_name}</span>
                                  </div>
                                  <span className="font-bold text-primary shrink-0 ml-2">฿{p.current_price?.toLocaleString() ?? 0}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Shopping Cart & Price Details */}
                  <div className="flex flex-col border rounded-2xl p-4 bg-muted/20 h-[380px]">
                    <h3 className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <ShoppingCart className="w-3.5 h-3.5 text-primary" /> ตะกร้าสินค้า ({allSelectedItems.length})
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                      {allSelectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs py-10">
                          <ShoppingCart className="w-8 h-8 opacity-20 mb-2" />
                          <span>ไม่มีสินค้าในตะกร้า</span>
                        </div>
                      ) : (
                        allSelectedItems.map(item => {
                          const catProduct = catalog.find(c => c.id === item.product_id);
                          const role = catProduct?.role_id ? discordRolesMap.get(catProduct.role_id) : null;
                          const which = item.product_type === 'class_role' ? 'class' : 'other';
                          return (
                            <div key={item.product_id} className="p-3 bg-card border border-border/40 rounded-xl space-y-2 relative shadow-sm">
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-5 h-5 rounded bg-secondary/50 flex items-center justify-center border border-border/40 shrink-0">
                                    {role?.emoji ? (
                                      <IconDisplay icon={role.emoji} fallback="🎭" size="xs" />
                                    ) : (
                                      <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="text-xs font-bold truncate text-foreground">{item.display_name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => which === 'class' ? setSelectedClassItem(null) : handleRemoveOtherItem(item.product_id)}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground font-semibold">ราคาขายจริง (บาท) *</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.price_paid}
                                    onChange={e => updateItem(which, item.product_id, 'price_paid', e.target.value)}
                                    className="h-7 text-xs px-2 rounded-lg"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 pt-4 pl-1">
                                  <input
                                    type="checkbox"
                                    id={`promo-${item.product_id}`}
                                    checked={item.is_promotion}
                                    onChange={e => updateItem(which, item.product_id, 'is_promotion', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-gray-300"
                                  />
                                  <Label htmlFor={`promo-${item.product_id}`} className="text-[10px] cursor-pointer select-none">โปรโมชัน</Label>
                                </div>
                              </div>

                              {item.is_promotion && (
                                <div className="space-y-0.5 pt-0.5">
                                  <Label className="text-[10px] text-muted-foreground font-semibold">ราคาเต็มก่อนลด *</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.original_price}
                                    onChange={e => updateItem(which, item.product_id, 'original_price', e.target.value)}
                                    className="h-7 text-xs px-2 rounded-lg"
                                    placeholder="ราคาปกติ"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Cart Summary */}
                    <div className="border-t border-border/40 pt-2.5 mt-2.5 space-y-1.5 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">ยอดรวมทั้งหมด:</span>
                        <span className="font-bold text-sm text-primary">฿{computedTotalAmount.toLocaleString()}</span>
                      </div>
                      {salmonPointPreview !== null && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/50 px-2 py-1.5 rounded-xl border border-border/40">
                          <span className="flex items-center gap-1"><img src={fishIcon} className="w-3.5 h-3.5 object-contain" alt="Salmon" /> Salmon Points:</span>
                          <span className="font-bold text-foreground">+{salmonPointPreview} แต้ม</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Slip upload */}
                <div className="space-y-1.5 bg-muted/40 p-4 rounded-2xl border border-border/40">
                  <Label className="text-xs font-semibold">หลักฐานการโอน (สลิป 1-2 รูป) *</Label>
                  <Input type="file" multiple accept="image/*" onChange={handleFileChange} className="cursor-pointer h-9 text-xs rounded-xl" />
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="relative group">
                          <img src={previewUrls[i]} alt={f.name} className="w-16 h-16 object-cover rounded-xl border" />
                          <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 shadow-md"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addLoading} className="rounded-xl">ยกเลิก</Button>
                <Button onClick={handleAddBill} disabled={addLoading} className="gap-2 rounded-xl">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} สร้างบิล
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-4">
          <TabsTrigger value="data" className="gap-2"><List className="h-4 w-4" /> ข้อมูลบิล</TabsTrigger>
          <TabsTrigger value="stats" className="gap-2"><PieChart className="h-4 w-4" /> สถิติ</TabsTrigger>
        </TabsList>

        {/* ── Stats Tab ── */}
        <TabsContent value="stats" className="space-y-4 mt-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> ดูสรุปตามช่วงเวลา</p>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={periodMode} onValueChange={v => { setPeriodMode(v as any); setSelectedPeriod(''); }} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="day" className="text-xs px-3 h-7">วัน</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-3 h-7">เดือน</TabsTrigger>
                    <TabsTrigger value="year" className="text-xs px-3 h-7">ปี</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder={`เลือก${periodMode === 'day' ? 'วัน' : periodMode === 'month' ? 'เดือน' : 'ปี'}...`} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">ทั้งหมด</SelectItem>
                    {currentPeriodOptions.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{formatPeriodLabel(opt)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedPeriod && selectedPeriod !== 'all' && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedPeriod('')}>ล้าง</Button>
                )}
              </div>
              {selectedPeriod && selectedPeriod !== 'all' && (
                <div className="grid gap-3 grid-cols-2 pt-1">
                  <div className="rounded-lg border bg-primary/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดรวม</p>
                    <p className="text-lg font-bold text-primary">฿{formatCurrency(periodSummary.totalAmount)}</p>
                  </div>
                  <div className="rounded-lg border bg-chart-2/10 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">จำนวนบิล</p>
                    <p className="text-lg font-bold">{periodSummary.totalBills}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { icon: DollarSign, label: 'ยอดวันนี้', amount: summaryStats.todayStats.amount, count: summaryStats.todayStats.count, color: 'bg-primary/10', iconColor: 'text-primary' },
              { icon: TrendingUp, label: 'ยอดเดือนนี้', amount: summaryStats.thisMonthStats.amount, count: summaryStats.thisMonthStats.count, color: 'bg-chart-2/20', iconColor: 'text-chart-2' },
              { icon: Receipt, label: 'ยอดทั้งหมด', amount: summaryStats.totalAmount, count: summaryStats.totalBills, color: 'bg-chart-3/20', iconColor: 'text-chart-3' },
              { icon: BarChart3, label: 'ทั้งหมด', amount: null, count: records.length, color: 'bg-accent/20', iconColor: 'text-accent-foreground' },
            ].map(({ icon: Icon, label, amount, count, color, iconColor }) => (
              <Card key={label}><CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg ${color} p-2.5`}><Icon className={`h-5 w-5 ${iconColor}`} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                  {amount != null && <p className="text-lg font-bold truncate">฿{formatCurrency(amount)}</p>}
                  <p className="text-[10px] text-muted-foreground">{count} {amount != null ? 'บิล' : 'รายการ'}</p>
                </div>
              </CardContent></Card>
            ))}
          </div>
          {records.length > 0 && (
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="w-full max-w-xs">
                <TabsTrigger value="daily" className="flex-1 gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> รายวัน</TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> รายเดือน</TabsTrigger>
              </TabsList>
              <TabsContent value="daily">
                <Card><CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">ยอดซื้อขายรายวัน (บาท)</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summaryStats.dailyData.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltipContent />} />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="monthly">
                <Card><CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">แนวโน้มยอดซื้อขายรายเดือน (บาท)</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={summaryStats.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltipContent />} />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ── Data Tab ── */}
        <TabsContent value="data" className="space-y-4 mt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input value={serviceQuery} onChange={e => { setServiceQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหาผู้ดำเนินการ" />
            <Input value={memberQuery} onChange={e => { setMemberQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหาผู้ซื้อ" />
            <Input value={billTypeQuery} onChange={e => { setBillTypeQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหาประเภทบิล" />
            <Input type="date" value={dateQuery} onChange={e => { setDateQuery(e.target.value); setCurrentPage(1); }} />
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">ไม่พบรายการ</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedRecords.map(r => (
                  <Card key={r.id} className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${r.source === 'new' ? 'border-primary/20' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      {/* Date row + source badge + actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatTransactionDate(r.transaction_date)}</span>
                          {r.source === 'new'
                            ? <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/40 text-primary">ใหม่</Badge>
                            : <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground">เก่า</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                            onClick={e => { e.stopPropagation(); setEmbedTarget(r); }} title="ส่ง Thank you embed">
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={e => {
                              e.stopPropagation();
                              setEditTarget(r);
                              let formattedDate = '';
                              if (r.transaction_date) {
                                const parsed = parseTransactionDate(r.transaction_date);
                                if (parsed) {
                                  formattedDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
                                }
                              }
                              setEditForm({
                                amount: String(r.total_amount),
                                transaction: formattedDate,
                                type_bill: r.type_bill ?? 'ธนาคารทั่วไป'
                              });
                            }} title="แก้ไขข้อมูล">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {user?.is_owner && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={e => { e.stopPropagation(); setDeleteTarget(r); }} title="ลบข้อมูล">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Staff */}
                      {r.staff_id && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ผู้ดำเนินการ</span>
                          <UserBadge id={r.staff_id} />
                        </div>
                      )}

                      {/* Member */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ผู้ซื้อ</span>
                        <UserBadge id={r.member_id} />
                      </div>

                      {/* Amount / bill type / salmon */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm font-bold text-primary">{formatCurrency(r.total_amount)} บาท</span>
                        </div>
                        {r.type_bill && <Badge variant="secondary" className="text-[10px]">{r.type_bill}</Badge>}
                        <div className="flex items-center gap-1 text-xs text-honey font-semibold">
                          <img src={fishIcon} className="w-3.5 h-3.5 object-contain" alt="Salmon" /><span>{computeSalmonDelta(r.total_amount)}</span>
                        </div>
                      </div>

                      {/* ── Item list ── */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          <Package className="w-3 h-3" /> สินค้า
                        </div>
                        {r.source === 'legacy' && r.item && (
                          <p className="text-xs text-foreground break-words">{r.item}</p>
                        )}
                        {r.source === 'new' && r.purchase_items && r.purchase_items.length > 0 && (
                          <div className="space-y-1.5">
                            {r.purchase_items.map(item => {
                              const catProduct = catalog.find(c => c.id === item.product_id);
                              const role = catProduct?.role_id ? discordRolesMap.get(catProduct.role_id) : null;
                              return (
                                <div key={item.id} className="text-xs">
                                  {item.is_promotion ? (
                                    <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 space-y-0.5">
                                      <div className="flex items-center gap-1 font-medium flex-wrap">
                                        <div className="w-4 h-4 rounded bg-secondary/50 flex items-center justify-center border border-border/40 shrink-0">
                                          {role?.emoji ? (
                                            <IconDisplay icon={role.emoji} fallback="🎭" size="xs" />
                                          ) : (
                                            <Tag className="h-3 w-3 text-amber-600" />
                                          )}
                                        </div>
                                        <span className="truncate max-w-[150px]">{item.product_display_name}</span>
                                        <Badge className="text-[9px] h-4 px-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 ml-1">โปรโมชัน</Badge>
                                      </div>
                                      {item.original_price != null && (
                                        <div className="text-[10px] text-muted-foreground font-medium">
                                          ราคาเต็ม <span className="line-through">฿{formatCurrency(item.original_price)}</span>
                                          {' → '}
                                          <span className="font-semibold text-foreground">จ่ายจริง ฿{formatCurrency(item.price_paid)}</span>
                                        </div>
                                      )}
                                      {item.original_price == null && (
                                        <div className="text-foreground font-semibold">฿{formatCurrency(item.price_paid)}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between py-0.5 border-b border-border/10 last:border-b-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-4.5 h-4.5 rounded bg-secondary/50 flex items-center justify-center border border-border/40 shrink-0">
                                          {role?.emoji ? (
                                            <IconDisplay icon={role.emoji} fallback="🎭" size="xs" />
                                          ) : (
                                            <Package className="w-3 h-3 text-muted-foreground" />
                                          )}
                                        </div>
                                        <span className="text-foreground truncate">{item.product_display_name}</span>
                                      </div>
                                      <span className="font-medium text-primary">฿{formatCurrency(item.price_paid)}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {r.source === 'new' && (!r.purchase_items || r.purchase_items.length === 0) && (
                          <p className="text-xs text-muted-foreground">ยังไม่มีรายการสินค้า</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                        <Clock className="w-3 h-3" />
                        <span>เวลาที่ทำรายการ: {formatThaiDate(r.log_timestamp)}</span>
                      </div>

                      {/* Slips */}
                      {(r.slip_url || r.slip_url_2) && (
                        <div className={`grid gap-2 ${r.slip_url && r.slip_url_2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {[r.slip_url, r.slip_url_2].filter(Boolean).map((url, i) => (
                            <button key={i} onClick={() => setPreviewImage(url!)} className="block w-full rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-pointer">
                              <img src={url!} alt={`บิล ${i+1}`} className="w-full h-32 object-cover" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p-1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Image preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black/80 border-none overflow-hidden flex items-center justify-center focus:outline-none">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><X className="w-5 h-5" /></button>
            {previewImage && <img src={previewImage} alt="ภาพบิล" className="max-w-full max-h-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> ยืนยันการลบข้อมูลถาวร</DialogTitle>
            <DialogDescription>
              คุณต้องการลบบิลของ <strong>{resolveDisplayName(deleteTarget?.member_id ?? '').name}</strong> ยอด <strong>{deleteTarget ? formatCurrency(deleteTarget.total_amount) : '0'}</strong> บาท ใช่หรือไม่?
              <br /><span className="text-destructive font-semibold">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />} ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editTarget)} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> แก้ไขข้อมูลบิล</DialogTitle>
            <DialogDescription>
              {editTarget?.source === 'legacy' ? 'แก้ไขได้: ยอดเงิน วันที่ ประเภทบิล' : 'แก้ไขได้: วันที่ ประเภทบิล (ยอดเงินคำนวณจาก purchase_items อัตโนมัติ)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editTarget?.source === 'legacy' && (
              <div className="space-y-2">
                <Label>ยอดเงิน (บาท)</Label>
                <Input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>วันทำรายการ</Label>
                <Input type="date" value={editForm.transaction} onChange={e => setEditForm(p => ({ ...p, transaction: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ประเภทบิล</Label>
                <Select value={editForm.type_bill} onValueChange={v => setEditForm(p => ({ ...p, type_bill: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ทรูมันนี่">ทรูมันนี่</SelectItem>
                    <SelectItem value="ธนาคารทั่วไป">ธนาคารทั่วไป</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editLoading}>ยกเลิก</Button>
            <Button onClick={handleEditSave} disabled={editLoading} className="gap-2">
              {editLoading && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send embed confirm */}
      <Dialog open={Boolean(embedTarget)} onOpenChange={o => !o && setEmbedTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-500" /> ยืนยันการส่ง Thank you embed</DialogTitle>
            <DialogDescription>ระบบจะส่ง embed ขอบคุณไปยัง Discord สำหรับ <strong>{resolveDisplayName(embedTarget?.member_id ?? '').name}</strong></DialogDescription>
          </DialogHeader>
          {embedTarget && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">ผู้ซื้อ</span><span className="font-medium">{resolveDisplayName(embedTarget.member_id).name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ยอดบิลนี้</span><span className="font-bold text-primary">{formatCurrency(embedTarget.total_amount)} บาท</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ยอดรวมทั้งหมด</span><span className="font-bold">{formatCurrency(totalAmountByMember.get(embedTarget.member_id) ?? 0)} บาท</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><img src={fishIcon} className="w-3.5 h-3.5 object-contain" alt="Salmon" /> Salmon Point</span><span className="font-bold text-warning">{salmonPointMap.get(embedTarget.member_id) ?? 0} แต้ม</span></div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmbedTarget(null)} disabled={isSendingEmbed}>ยกเลิก</Button>
            <Button onClick={() => embedTarget && handleSendEmbed(embedTarget)} disabled={isSendingEmbed} className="gap-2 bg-honey hover:bg-honey/90 text-accent-foreground">
              {isSendingEmbed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} ส่ง embed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
