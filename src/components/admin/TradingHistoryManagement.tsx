import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  XCircle,
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

const ITEMS_PER_PAGE = 12;
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1410538470253793331/O1fVU-YMsPrHJNZao3NjbHlkxoutDbh29YA26A2Fb-t6fRZOCrjTjLlESZ4lQKP5cTMA';

// Edge Function URL สำหรับส่ง Components V2 embed ผ่าน Bot API
// Bot Token เก็บไว้ใน Edge Function เท่านั้น ไม่ expose ใน frontend
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_SEND_TRADING_EMBED = `${SUPABASE_URL}/functions/v1/send-trading-embed`;

const PRODUCT_LIST = [
 "ヽ 𝐂𝐨𝐨𝐤𝐢𝐞 (ยศพรีเมี่ยม 𝐒) 𓂃 🍪",
 "ヽ 𝐌𝐚𝐜𝐚𝐫𝐨𝐧 (ยศพรีเมี่ยม 𝐀) 𓂃 🥯",
 "ヽ 𝐂𝐡𝐨𝐜 𝐓𝐫𝐮𝐟𝐟𝐥𝐞 (ยศพรีเมี่ยม 𝐁) 𓂃 🍫",
 "ヽ 𝐂𝐡𝐞𝐞𝐬𝐞𝐜𝐚𝐤𝐞 (ยศพรีเมี่ยม 𝐂) 𓂃 🍰",
 "ヽ 𝐃𝐨𝐧𝐮𝐭 (ยศพรีเมี่ยม 𝐃) 𓂃 🍩",
 "ヽ 𝐈𝐜𝐞 𝐜𝐫𝐞𝐚𝐦 (ยศพรีเมี่ยม 𝐄) 𓂃 🍦",
 "⊹ ꒰ Raineybee ꒱ 🐝 . ✦",
 "หมีอ้วง",
 "ซูชิแมว",
 "อรุ่มเจ๊าะ",
 "เด็กขี้เซา",
 "หมีสายรุ้ง",
 "เด็กขี้อ้อน",
 "ต้าวนุ่มนิ่ม",
 "ไอเด็กเป็ด",
 "อัศวินนมผง",
 "ไอ แฮฟ สติ",
 "I love u 3000 ❤",
 "รับผมไปเลี้ยงมั้ยฮับ",
 "ฉลามนั้นชอบงับคุณ",
 "กินทำไมเค้ก กินเราดีกว่า",
 "เราเป็นอินโทรไมโครซอฟต์เวิร์ด",
 "UwU",
 "นอยด์อ่า",
 "เจ้าเขี้ยวกุด",
 "ขอบคุณที่แจ้งให้ทราบน้า",
 "อาาาาาาาาาาาาห์",
 "ติดเจ้าหมีงอมแงมเลยค้าบ",
 "เด็กดื้อ",
 "เจ้าหมีปุกปุย",
 "น้ำแข็งนุ่มฟู",
 "ไม่อยากถูกรัก แต่อยากถูกหวย",
 "คุณหมีสายลับ",
 "แบ๊ะ แบ๊ะ !",
 "เมลโล่บันนี่",
 "𝑴𝒐𝒐𝒏𝒊𝒆 ˚ ♡ ⋆",
 "𓆩⠀𝘉𝘪𝘵𝘦 𝘰𝘧 𝘉𝘭𝘢𝘤𝘬⠀𓆪"
];

interface TradingRecord {
  id: string;
  log_timestamp: string;
  service_id: string | null;
  transaction: string | null;
  member_id: string;
  amount: number | null;
  type_bill: string | null;
  item: string | null;
  slip_url: string | null;
  slip_url_2: string | null;
  created_at: string;
}

interface DiscordProfile {
  discord_id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
}

/** แปลงตัวเลขเป็น Unicode Mathematical Digits (𝟢𝟣𝟤...) พร้อม comma separator เมื่อ >= 1000 */
function toUnicodeNumber(n: number): string {
  const unicodeDigits = ['𝟢','𝟣','𝟤','𝟥','𝟦','𝟧','𝟨','𝟩','𝟪','𝟫'];
  // Format with comma for thousands
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return formatted.replace(/[0-9]/g, (d) => unicodeDigits[parseInt(d)]);
}

/** Parse the `transaction` field which may be "DD/MM/YYYY" (พ.ศ. or ค.ศ.) */
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
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function TradingHistoryManagement() {
  const [records, setRecords] = useState<TradingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [profileMap, setProfileMap] = useState<Map<string, DiscordProfile>>(new Map());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('data');
  const [deleteTarget, setDeleteTarget] = useState<TradingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<TradingRecord | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', transaction: '', type_bill: '', item: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Send embed state
  const [embedTarget, setEmbedTarget] = useState<TradingRecord | null>(null);
  const [isSendingEmbed, setIsSendingEmbed] = useState(false);
  // salmon_point map: member_id -> salmon_point
  const [salmonPointMap, setSalmonPointMap] = useState<Map<string, number>>(new Map());

  // Auto update - moved after fetchData declaration via separate useEffect below

  const scanQRCode = async (file: File) => {
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            resolve(null);
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            resolve(code.data);
          } else {
            resolve(null);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Add Bill State
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [newBill, setNewBill] = useState({
    memberId: '',
    transactionDate: '',
    amount: '',
    billType: 'ธนาคารทั่วไป',
    customProduct: '',
  });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // สร้าง object URL สำหรับ preview รูปภาพ และ revoke อัตโนมัติเมื่อ selectedFiles เปลี่ยน
  const previewUrls = useMemo(() => {
    const urls = selectedFiles.map(f => URL.createObjectURL(f));
    return urls;
  }, [selectedFiles]);
  useEffect(() => {
    return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [previewUrls]);

  // Load webhook setting
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'trading_webhook_enabled')
        .single();
      if (data) {
        // data.value is JSONB — could be boolean true/false or string "true"/"false"
        const val = data.value;
        setWebhookEnabled(val === true || val === 'true');
      }
    };
    loadSettings();
  }, []);

  const toggleWebhook = async (enabled: boolean) => {
    if (!user?.is_owner) return;
    setWebhookEnabled(enabled);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'trading_webhook_enabled', value: enabled });
    
    if (error) {
      console.error('Failed to save setting', error);
      toast({ title: 'บันทึกการตั้งค่าไม่สำเร็จ', variant: 'destructive' });
    } else {
      toast({ title: enabled ? 'เปิดการแจ้งเตือน Discord แล้ว' : 'ปิดการแจ้งเตือน Discord แล้ว' });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + selectedFiles.length > 2) {
        toast({ title: 'อัปโหลดได้สูงสุด 2 รูป', variant: 'destructive' });
        return;
      }
      
      const newFiles = [...selectedFiles, ...files].slice(0, 2);
      setSelectedFiles(newFiles);

      // Scan first file for QR
      if (files.length > 0) {
        try {
          const qrData = await scanQRCode(files[0]);
          if (qrData) {
            // Check for TrueMoney logic: contains '140' or 'truemoney'
            if (qrData.includes('140') || qrData.toLowerCase().includes('truemoney')) {
              setNewBill(prev => ({ ...prev, billType: 'ทรูมันนี่' }));
              toast({ title: 'ตรวจพบสลิป TrueMoney', description: 'เลือกประเภทบิลอัตโนมัติ' });
            } else {
              setNewBill(prev => ({ ...prev, billType: 'ธนาคารทั่วไป' }));
              toast({ title: 'ตรวจพบสลิปธนาคาร', description: 'เลือกประเภทบิลอัตโนมัติ' });
            }
          }
        } catch (err) {
          console.error("QR Scan failed", err);
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleAddProduct = (product: string) => {
    if (!product.trim()) return;
    if (!selectedProducts.includes(product)) {
      setSelectedProducts([...selectedProducts, product]);
    }
    setNewBill({ ...newBill, customProduct: '' });
  };

  const handleRemoveProduct = (product: string) => {
    setSelectedProducts(selectedProducts.filter(p => p !== product));
  };

  const handleAddBill = async () => {
    if (!newBill.memberId || !newBill.transactionDate || !newBill.amount || selectedProducts.length === 0 || selectedFiles.length === 0) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'รวมถึงสินค้าและรูปภาพอย่างน้อย 1 รูป', variant: 'destructive' });
      return;
    }

    // ใช้ค่าที่ผู้ใช้เลือกเองเป็นหลัก และ fallback เป็นธนาคารทั่วไป
    const selectedBillType = newBill.billType || 'ธนาคารทั่วไป';

    setAddLoading(true);
    try {
      const imageUrls: string[] = [];

      // 1. Compress and Upload Images
      for (const file of selectedFiles) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        
        try {
          const compressedFile = await imageCompression(file, options);
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${compressedFile.type.split('/')[1]}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('slip-images')
            .upload(fileName, compressedFile, { cacheControl: '86400' });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('slip-images')
            .getPublicUrl(fileName);
            
          imageUrls.push(publicUrl);
        } catch (error) {
          console.error('Error uploading image:', error);
          throw new Error('Upload failed');
        }
      }

      // 2. Insert to Database
      // Convert YYYY-MM-DD to proper Date object then save as ISO string for sorting
      // Or just save as YYYY-MM-DD string (ISO 8601) which sorts correctly as text
      const [y, m, d] = newBill.transactionDate.split('-');
      const formattedDate = `${y}-${m}-${d}`; // YYYY-MM-DD

      const { error: insertError } = await supabase.from('trading_history').insert({
        member_id: newBill.memberId,
        service_id: user?.discord_id,
        transaction: formattedDate,
        amount: parseFloat(newBill.amount),
        type_bill: selectedBillType,
        item: selectedProducts.join(', '),
        slip_url: imageUrls[0],
        slip_url_2: imageUrls[1] || null,
        log_timestamp: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // 3. Send Discord Webhook
      if (webhookEnabled && DISCORD_WEBHOOK_URL) {
        const unixTime = Math.floor(Date.now() / 1000);
        const discordTimestamp = `<t:${unixTime}:F> (<t:${unixTime}:R>)`;
        
        const billType = selectedBillType;
        const buyerId = user?.discord_id || 'Unknown';
        const sellerId = newBill.memberId;
        const count = newBill.amount;
        const productList = selectedProducts.join(', ');
        const imageUrl = imageUrls[0];

        let thumbnailUrl = "";
        if (billType === "ธนาคารทั่วไป" || billType === "ธนาคาร") {
          thumbnailUrl = "https://cdn.discordapp.com/attachments/1144675871798591569/1410542166232531024/bank.png"; 
        } else if (billType === "ทรูมันนี่") {
          thumbnailUrl = "https://cdn.discordapp.com/attachments/1144675871798591569/1410542166664806510/truemoney.png"; 
        }

        const description = `## <:Service:1395695113258274887>︲__\` มีการส่งบิลใหม่! \`__ 
<:line:1144701793989840997>
- __\`ผู้ดำเนินการ\`__: <@${buyerId}> 
- __\`ผู้ซื้อ\`__: <@${sellerId}> - \`${sellerId}\`
- __\`เวลา\`__: ${discordTimestamp} 
- __\`ยอดสั่งซื้อ\`__: ${count} บาท
- __\`ประเภทบิล\`__: ${billType} 
- __\`สินค้า\`__: ${productList} 
`.trim();

        const payload = {
          username: "⊹ ꒰ แจ้งเตือนบิลใหม่ ꒱ 💸",
          content: `<@${buyerId}> <@${sellerId}>`,
          embeds: [{
            description: description,
            color: 0xffdf8f,
            thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
            image: imageUrl ? { url: imageUrl } : undefined,
          }]
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      toast({ title: 'สร้างบิลสำเร็จ', className: 'bg-success text-success-foreground' });
      setIsAddDialogOpen(false);
      setNewBill({ memberId: '', transactionDate: '', amount: '', billType: 'ธนาคารทั่วไป', customProduct: '' });
      setSelectedProducts([]);
      setSelectedFiles([]);
      fetchData();

    } catch (err: any) {
      console.error('Create bill failed:', err);
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user?.is_owner) return;
    setIsDeleting(true);

    try {
      // 1. Delete images from storage (if any)
      const imagesToDelete = [deleteTarget.slip_url, deleteTarget.slip_url_2].filter(Boolean) as string[];
      const supabaseImagePaths: string[] = [];

      for (const url of imagesToDelete) {
        if (url.includes('/storage/v1/object/public/slip-images/')) {
          const parts = url.split('/slip-images/');
          if (parts.length > 1) {
            supabaseImagePaths.push(decodeURIComponent(parts[1]));
          }
        }
      }

      if (supabaseImagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('slip-images')
          .remove(supabaseImagePaths);
        
        if (storageError) {
          console.error('Failed to delete images:', storageError);
        }
      }

      // 2. Delete record from database
      const { error: deleteError } = await supabase
        .from('trading_history')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteError) throw deleteError;

      toast({ title: 'ลบข้อมูลเรียบร้อยแล้ว', className: 'bg-success text-success-foreground' });
      setDeleteTarget(null);
      fetchData(); // Reload data

    } catch (err: any) {
      console.error('Delete failed:', err);
      toast({ title: 'เกิดข้อผิดพลาดในการลบ', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filters
  const [serviceQuery, setServiceQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');
  const [billTypeQuery, setBillTypeQuery] = useState('');

  // Period filter
  const [periodMode, setPeriodMode] = useState<'day' | 'month' | 'year'>('day');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const fetchProfiles = useCallback(async (discordIds: string[]) => {
    const uniqueIds = [...new Set(discordIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('discord_id, username, discord_username, avatar_url')
        .in('discord_id', uniqueIds);
      if (data) {
        const map = new Map<string, DiscordProfile>();
        data.forEach((p) => map.set(p.discord_id, p));
        setProfileMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch profiles', err);
    }
  }, []);

  const fetchSalmonPoints = useCallback(async (discordIds: string[]) => {
    const uniqueIds = [...new Set(discordIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('user_points')
        .select('discord_id, salmon_point')
        .in('discord_id', uniqueIds);
      if (data) {
        const map = new Map<string, number>();
        data.forEach((p) => map.set(p.discord_id, p.salmon_point ?? 0));
        setSalmonPointMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch salmon points', err);
    }
  }, []);

  const resolveDisplayName = useCallback(
    (id: string): { name: string; discord_username: string | null; avatar: string | null } => {
      if (!id) return { name: '-', discord_username: null, avatar: null };
      const profile = profileMap.get(id);
      if (profile) return { name: profile.username, discord_username: (profile as any).discord_username || null, avatar: profile.avatar_url };
      return { name: id, discord_username: null, avatar: null };
    },
    [profileMap],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('trading_history')
        .select('*')
        .order('transaction', { ascending: false, nullsFirst: false })
        .order('log_timestamp', { ascending: false });

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('ไม่พบข้อมูล');

      const allIds = data.flatMap((r) => [r.service_id, r.member_id].filter(Boolean) as string[]);
      fetchProfiles(allIds);
      fetchSalmonPoints([...new Set(data.map((r) => r.member_id).filter(Boolean))]);
      setRecords(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles, fetchSalmonPoints]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto update every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const serviceResolved = resolveDisplayName(r.service_id || '');
      const serviceMatched =
        !serviceQuery.trim() ||
        (r.service_id || '').toLowerCase().includes(serviceQuery.trim().toLowerCase()) ||
        serviceResolved.name.toLowerCase().includes(serviceQuery.trim().toLowerCase()) ||
        (serviceResolved.discord_username || '').toLowerCase().includes(serviceQuery.trim().toLowerCase());
      const memberResolved = resolveDisplayName(r.member_id);
      const memberMatched =
        !memberQuery.trim() ||
        r.member_id.toLowerCase().includes(memberQuery.trim().toLowerCase()) ||
        memberResolved.name.toLowerCase().includes(memberQuery.trim().toLowerCase()) ||
        (memberResolved.discord_username || '').toLowerCase().includes(memberQuery.trim().toLowerCase());
      const billTypeMatched =
        !billTypeQuery.trim() ||
        (r.type_bill || '').toLowerCase().includes(billTypeQuery.trim().toLowerCase());
      const dateMatched = !dateQuery || (() => {
        const d = parseTransactionDate(r.transaction);
        if (!d) return false;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}` === dateQuery;
      })();
      const periodMatched = !selectedPeriod || selectedPeriod === 'all' || (() => {
        const d = parseTransactionDate(r.transaction);
        if (!d) return false;
        const yyyy = String(d.getFullYear());
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        if (periodMode === 'day') return `${yyyy}-${mm}-${dd}` === selectedPeriod;
        if (periodMode === 'month') return `${yyyy}-${mm}` === selectedPeriod;
        return yyyy === selectedPeriod;
      })();
      return serviceMatched && memberMatched && billTypeMatched && dateMatched && periodMatched;
    });
  }, [records, serviceQuery, memberQuery, billTypeQuery, dateQuery, selectedPeriod, periodMode, resolveDisplayName]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));

  // Salmon point preview for create-bill form (Requirements 8.1, 8.2, 8.3)
  const salmonPointPreview = useMemo(() => computeSalmonPreview(newBill.amount), [newBill.amount]);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const UserBadge = ({ id }: { id: string }) => {
    const { name, discord_username, avatar } = resolveDisplayName(id);
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <Avatar className="w-5 h-5 shrink-0">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback className="text-[10px] bg-muted">
            <User className="w-3 h-3" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {discord_username ? (
            <>
              <span className="text-xs font-semibold truncate block">{discord_username}</span>
              <span className="text-[10px] text-muted-foreground truncate block">{name}</span>
            </>
          ) : (
            <span className="text-xs font-medium truncate block">{name}</span>
          )}
        </div>
      </div>
    );
  };

  // ========== Summary computations ==========
  const periodOptions = useMemo(() => {
    const days = new Set<string>();
    const months = new Set<string>();
    const years = new Set<string>();
    records.forEach((r) => {
      const d = parseTransactionDate(r.transaction);
      if (!d) return;
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.add(`${yyyy}-${mm}-${dd}`);
      months.add(`${yyyy}-${mm}`);
      years.add(yyyy);
    });
    return {
      days: [...days].sort().reverse(),
      months: [...months].sort().reverse(),
      years: [...years].sort().reverse(),
    };
  }, [records]);

  const periodFilteredRecords = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'all') return records;
    return records.filter((r) => {
      const d = parseTransactionDate(r.transaction);
      if (!d) return false;
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      if (periodMode === 'day') return `${yyyy}-${mm}-${dd}` === selectedPeriod;
      if (periodMode === 'month') return `${yyyy}-${mm}` === selectedPeriod;
      return yyyy === selectedPeriod;
    });
  }, [records, periodMode, selectedPeriod]);

  const periodSummary = useMemo(() => {
    const totalAmount = periodFilteredRecords.reduce((s, r) => s + (r.amount || 0), 0);
    const totalBills = periodFilteredRecords.length;
    return { totalAmount, totalBills };
  }, [periodFilteredRecords]);

  const summaryStats = useMemo(() => {
    const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
    const totalBills = records.length;

    const dailyMap = new Map<string, { amount: number; count: number }>();
    const monthlyMap = new Map<string, { amount: number; count: number }>();

    records.forEach((r) => {
      const d = parseTransactionDate(r.transaction);
      if (!d) return;
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amt = r.amount || 0;

      const prevD = dailyMap.get(dayKey) ?? { amount: 0, count: 0 };
      dailyMap.set(dayKey, { amount: prevD.amount + amt, count: prevD.count + 1 });

      const prevM = monthlyMap.get(monthKey) ?? { amount: 0, count: 0 };
      monthlyMap.set(monthKey, { amount: prevM.amount + amt, count: prevM.count + 1 });
    });

    const dailyData = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), amount: v.amount, count: v.count }));

    const monthlyData = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, amount: v.amount, count: v.count }));

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayStats = dailyMap.get(todayKey) ?? { amount: 0, count: 0 };

    const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthStats = monthlyMap.get(thisMonthKey) ?? { amount: 0, count: 0 };

    return { totalAmount, totalBills, dailyData, monthlyData, todayStats, thisMonthStats };
  }, [records]);

  const formatCurrency = (n: number) =>
    n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // คำนวณยอดรวม amount ต่อ member_id จากทุก records
  const totalAmountByMember = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const prev = map.get(r.member_id) ?? 0;
      map.set(r.member_id, prev + (r.amount || 0));
    });
    return map;
  }, [records]);

  const handleSendEmbed = async (r: TradingRecord) => {
    setIsSendingEmbed(true);
    try {
      const memberId = r.member_id;
      const latestAmount = r.amount || 0;
      const totalAmount = totalAmountByMember.get(memberId) ?? latestAmount;
      const profile = profileMap.get(memberId);
      const avatarUrl = profile?.avatar_url ?? '';

      // ส่งผ่าน Edge Function แทน Webhook โดยตรง
      // เพราะ Components V2 (flags: 32768) ไม่รองรับบน Webhook endpoint — error 400
      // Bot Token เก็บไว้ใน Edge Function เท่านั้น
      const res = await fetch(EDGE_SEND_TRADING_EMBED, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          latest_amount: latestAmount,
          total_amount: totalAmount,
          avatar_url: avatarUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = [
          (errData as any).details,
          (errData as any).errorCode,
          (errData as any).errorCategory,
          (errData as any).discordErrorCode ? `Discord code: ${(errData as any).discordErrorCode}` : null,
          (errData as any).discordStatus ? `HTTP: ${(errData as any).discordStatus}` : null,
        ].filter(Boolean).join(' | ');
        throw new Error(detail || (errData as any).error || `Edge Function error: ${res.status}`);
      }

      toast({ title: 'ส่ง embed สำเร็จ', className: 'bg-success text-success-foreground' });
    } catch (err: any) {
      console.error('Send embed failed:', err);
      toast({ title: 'ส่ง embed ไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingEmbed(false);
      setEmbedTarget(null);
    }
  };

  const formatPeriodLabel = (val: string) => {
    if (periodMode === 'day') {
      const parts = val.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (periodMode === 'month') {
      const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const parts = val.split('-');
      return `${thMonths[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    return `ปี ${val}`;
  };

  const currentPeriodOptions = periodMode === 'day' ? periodOptions.days : periodMode === 'month' ? periodOptions.months : periodOptions.years;

  const CustomTooltipContent = ({ active: a, payload: p, label: l }: any) => {
    if (!a || !p?.length) return null;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
        <p className="font-medium mb-1">{l}</p>
        {p.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey === 'amount' ? `฿${formatCurrency(entry.value)}` : `${entry.value} บิล`}
          </p>
        ))}
      </div>
    );
  };

  // Loading
  if (loading && records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">ประวัติการซื้อขาย</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error && records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">ไม่สามารถโหลดข้อมูลได้</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">ประวัติการซื้อขาย</h2>
          <Badge variant="secondary" className="gap-1.5 font-normal text-xs h-6">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
            อัปเดตอัตโนมัติ
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground mr-2 hidden sm:block">
            {filteredRecords.length} รายการ
          </div>
          
          {/* Toggle Webhook (Owner only) */}
          {user?.is_owner && (
            <div className="flex items-center gap-2 mr-2 border-r pr-4">
              <Switch checked={webhookEnabled} onCheckedChange={toggleWebhook} id="webhook-toggle" />
              <Label htmlFor="webhook-toggle" className="text-xs flex items-center gap-1 cursor-pointer select-none">
                {webhookEnabled ? <Bell className="h-3 w-3 text-success" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                แจ้งเตือน Discord
              </Label>
            </div>
          )}

          {/* Create Bill Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> สร้างบิลใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>สร้างบิลใหม่</DialogTitle>
                <DialogDescription>กรอกข้อมูลการซื้อขายเพื่อบันทึกและแจ้งเตือน</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="memberId">Member ID (ผู้ซื้อ)</Label>
                    <Input id="memberId" value={newBill.memberId} onChange={(e) => setNewBill({...newBill, memberId: e.target.value})} placeholder="ระบุไอดีผู้ซื้อ" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transactionDate">วันทำรายการ</Label>
                    <Input type="date" id="transactionDate" value={newBill.transactionDate} onChange={(e) => setNewBill({...newBill, transactionDate: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">ยอดการสั่งซื้อ (บาท)</Label>
                    <Input type="number" id="amount" value={newBill.amount} onChange={(e) => setNewBill({...newBill, amount: e.target.value})} placeholder="0.00" />
                    {salmonPointPreview !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        🐟 Salmon Point ที่จะได้รับ: <span className="font-semibold text-foreground">{salmonPointPreview}</span> แต้ม
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>ประเภทของบิล</Label>
                    <Select value={newBill.billType} onValueChange={(v) => setNewBill({ ...newBill, billType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกประเภท" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ทรูมันนี่">ทรูมันนี่</SelectItem>
                        <SelectItem value="ธนาคารทั่วไป">ธนาคารทั่วไป</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">ระบบจะเดาประเภทจาก QR ให้ แต่คุณสามารถเลือกแก้เองได้ตลอด</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>สินค้า (เลือกได้หลายรายการ)</Label>
                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสินค้า..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {PRODUCT_LIST.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex gap-2 mt-2">
                    <Input 
                      placeholder="พิมพ์ชื่อสินค้าอื่นๆ..." 
                      value={newBill.customProduct} 
                      onChange={(e) => setNewBill({...newBill, customProduct: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProduct(newBill.customProduct);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => handleAddProduct(newBill.customProduct)}>เพิ่ม</Button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 border rounded-md bg-muted/20">
                    {selectedProducts.length === 0 && <span className="text-xs text-muted-foreground self-center">ยังไม่ได้เลือกสินค้า</span>}
                    {selectedProducts.map((p) => (
                      <Badge key={p} variant="secondary" className="gap-1 pr-1">
                        {p}
                        <button onClick={() => handleRemoveProduct(p)} className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>หลักฐานการโอน (1-2 รูป)</Label>
                  <Input type="file" multiple accept="image/*" onChange={handleFileChange} className="cursor-pointer" />
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="relative group">
                          <img 
                            src={previewUrls[i]} 
                            alt={f.name}
                            className="w-20 h-20 object-cover rounded-lg border border-border"
                          />
                          <button 
                            onClick={() => removeFile(i)}
                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow-md"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addLoading}>ยกเลิก</Button>
                <Button onClick={handleAddBill} disabled={addLoading} className="gap-2">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} สร้างบิล
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-4">
            <TabsTrigger value="data" className="gap-2"><List className="h-4 w-4"/> ข้อมูลบิล</TabsTrigger>
            <TabsTrigger value="stats" className="gap-2"><PieChart className="h-4 w-4"/> สถิติ</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4 mt-0">
            {/* Period Filter */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> ดูสรุปตามช่วงเวลา
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs value={periodMode} onValueChange={(v) => { setPeriodMode(v as any); setSelectedPeriod(''); }} className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="day" className="text-xs px-3 h-7">วัน</TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-3 h-7">เดือน</TabsTrigger>
                      <TabsTrigger value="year" className="text-xs px-3 h-7">ปี</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder={`เลือก${periodMode === 'day' ? 'วัน' : periodMode === 'month' ? 'เดือน' : 'ปี'}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">ทั้งหมด</SelectItem>
                      {currentPeriodOptions.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {formatPeriodLabel(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPeriod && selectedPeriod !== 'all' && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedPeriod('')}>
                      ล้าง
                    </Button>
                  )}
                </div>

                {/* Period Summary */}
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

            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดวันนี้</p>
                    <p className="text-lg font-bold truncate">฿{formatCurrency(summaryStats.todayStats.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{summaryStats.todayStats.count} บิล</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-chart-2/20 p-2.5">
                    <TrendingUp className="h-5 w-5 text-chart-2" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดเดือนนี้</p>
                    <p className="text-lg font-bold truncate">฿{formatCurrency(summaryStats.thisMonthStats.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{summaryStats.thisMonthStats.count} บิล</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-chart-3/20 p-2.5">
                    <Receipt className="h-5 w-5 text-chart-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ยอดทั้งหมด</p>
                    <p className="text-lg font-bold truncate">฿{formatCurrency(summaryStats.totalAmount)}</p>
                    <p className="text-[10px] text-muted-foreground">{summaryStats.totalBills} บิล</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-accent/20 p-2.5">
                    <BarChart3 className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ทั้งหมด</p>
                    <p className="text-lg font-bold truncate">{records.length}</p>
                    <p className="text-[10px] text-muted-foreground">รายการ</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            {records.length > 0 && (
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="w-full max-w-xs">
                  <TabsTrigger value="daily" className="flex-1 gap-1.5 text-xs">
                    <BarChart3 className="h-3.5 w-3.5" /> รายวัน
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="flex-1 gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5" /> รายเดือน
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="daily">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm font-medium mb-3">ยอดซื้อขายรายวัน (บาท)</p>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={summaryStats.dailyData.slice(-30)}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip content={<CustomTooltipContent />} />
                            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="monthly">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm font-medium mb-3">แนวโน้มยอดซื้อขายรายเดือน (บาท)</p>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={summaryStats.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip content={<CustomTooltipContent />} />
                            <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-0">
            {/* Filters */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                value={serviceQuery}
                onChange={(e) => { setServiceQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหาผู้ดำเนินการ"
              />
              <Input
                value={memberQuery}
                onChange={(e) => { setMemberQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหาผู้ซื้อ"
              />
              <Input
                value={billTypeQuery}
                onChange={(e) => { setBillTypeQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหาประเภทบิล"
              />
              <Input
                type="date"
                value={dateQuery}
                onChange={(e) => { setDateQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>

            {/* Records grid */}
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">ไม่พบรายการ</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedRecords.map((r) => (
                    <Card
                      key={r.id}
                      className="relative overflow-hidden transition-all duration-200 hover:shadow-md"
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Transaction date and action buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatTransactionDate(r.transaction)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmbedTarget(r);
                              }}
                              title="ส่ง Thank you embed"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditTarget(r);
                                setEditForm({
                                  amount: String(r.amount || ''),
                                  transaction: r.transaction || '',
                                  type_bill: r.type_bill || 'ธนาคารทั่วไป',
                                  item: r.item || '',
                                });
                              }}
                              title="แก้ไขข้อมูล"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {user?.is_owner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(r);
                                }}
                                title="ลบข้อมูล"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Service (ผู้ดำเนินการ) */}
                        {r.service_id && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              ผู้ดำเนินการ
                            </span>
                            <UserBadge id={r.service_id} />
                          </div>
                        )}

                        {/* Member (ผู้ซื้อ) */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            ผู้ซื้อ
                          </span>
                          <UserBadge id={r.member_id} />
                        </div>

                        {/* Amount & Bill type & Salmon point */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-bold text-primary">{formatCurrency(r.amount || 0)} บาท</span>
                          </div>
                          {r.type_bill && (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.type_bill}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-xs text-honey font-semibold">
                            <span>🐟</span>
                            <span>{computeSalmonDelta(r.amount)}</span>
                          </div>
                        </div>

                        {/* Item */}
                        {r.item && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              <Package className="w-3 h-3" /> สินค้า
                            </div>
                            <p className="text-xs text-foreground break-words">{r.item}</p>
                          </div>
                        )}

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                          <Clock className="w-3 h-3" />
                          <span>เวลาที่ทำรายการ: {formatThaiDate(r.log_timestamp)}</span>
                        </div>

                        {/* Slip images */}
                        {(r.slip_url || r.slip_url_2) && (
                          <div className={`grid gap-2 ${r.slip_url && r.slip_url_2 && r.slip_url.trim() !== '' && r.slip_url_2.trim() !== '' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {r.slip_url && r.slip_url.trim() !== '' && (
                              <button
                                onClick={() => setPreviewImage(r.slip_url)}
                                className="block w-full rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-pointer"
                              >
                                <img
                                  src={r.slip_url}
                                  alt="บิล 1"
                                  className="w-full h-32 object-cover"
                                  loading="lazy"
                                />
                              </button>
                            )}
                            {r.slip_url_2 && r.slip_url_2.trim() !== '' && (
                              <button
                                onClick={() => setPreviewImage(r.slip_url_2)}
                                className="block w-full rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-pointer"
                              >
                                <img
                                  src={r.slip_url_2}
                                  alt="บิล 2"
                                  className="w-full h-32 object-cover"
                                  loading="lazy"
                                />
                              </button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
        </TabsContent>
      </Tabs>

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black/80 border-none overflow-hidden flex items-center justify-center focus:outline-none">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            <button 
                onClick={() => setPreviewImage(null)} 
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
            {previewImage && (
            <img
                src={previewImage}
                alt="ภาพบิล"
                className="max-w-full max-h-full object-contain"
            />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> ยืนยันการลบข้อมูลถาวร</DialogTitle>
            <DialogDescription>
              คุณต้องการลบประวัติการซื้อขายของ <strong>{resolveDisplayName(deleteTarget?.member_id ?? '').name}</strong> ยอด <strong>{deleteTarget?.amount ? formatCurrency(deleteTarget.amount) : '0'}</strong> บาท ใช่หรือไม่?
              <br /><span className="text-destructive font-semibold">การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลและรูปสลิปจะถูกลบออกจากระบบทันที</span>
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

      {/* Edit Trading Record Dialog */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> แก้ไขข้อมูลบิล</DialogTitle>
            <DialogDescription>แก้ไขยอดเงิน วันที่ ประเภทบิล หรือสินค้า</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ยอดเงิน (บาท)</Label>
                <Input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>วันทำรายการ</Label>
                <Input type="date" value={editForm.transaction} onChange={e => setEditForm(p => ({ ...p, transaction: e.target.value }))} />
              </div>
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
            <div className="space-y-2">
              <Label>สินค้า</Label>
              <Input value={editForm.item} onChange={e => setEditForm(p => ({ ...p, item: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editLoading}>ยกเลิก</Button>
            <Button onClick={async () => {
              if (!editTarget) return;
              setEditLoading(true);
              try {
                const { error } = await supabase.from('trading_history').update({
                  amount: parseFloat(editForm.amount) || 0,
                  transaction: editForm.transaction,
                  type_bill: editForm.type_bill,
                  item: editForm.item,
                }).eq('id', editTarget.id);
                if (error) throw error;
                toast({ title: 'บันทึกเรียบร้อย', className: 'bg-success text-success-foreground' });
                setEditTarget(null);
                fetchData();
              } catch (err: any) {
                toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
              } finally {
                setEditLoading(false);
              }
            }} disabled={editLoading} className="gap-2">
              {editLoading && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Embed Confirm Dialog */}
      <Dialog open={Boolean(embedTarget)} onOpenChange={(o) => !o && setEmbedTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" /> ยืนยันการส่ง Thank you embed
            </DialogTitle>
            <DialogDescription>
              ระบบจะส่ง embed ขอบคุณไปยัง Discord สำหรับ{' '}
              <strong>{resolveDisplayName(embedTarget?.member_id ?? '').name}</strong>
            </DialogDescription>
          </DialogHeader>

          {embedTarget && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้ซื้อ</span>
                <span className="font-medium">{resolveDisplayName(embedTarget.member_id).name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ยอดบิลนี้</span>
                <span className="font-bold text-primary">{formatCurrency(embedTarget.amount || 0)} บาท</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ยอดรวมทั้งหมด</span>
                <span className="font-bold">{formatCurrency(totalAmountByMember.get(embedTarget.member_id) ?? 0)} บาท</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">🐟 Salmon Point</span>
                <span className="font-bold text-warning">{salmonPointMap.get(embedTarget.member_id) ?? 0} แต้ม</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmbedTarget(null)} disabled={isSendingEmbed}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => embedTarget && handleSendEmbed(embedTarget)}
              disabled={isSendingEmbed}
              className="gap-2 bg-honey hover:bg-honey/90 text-accent-foreground"
            >
              {isSendingEmbed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              ส่ง embed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
