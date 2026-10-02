import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Sparkles,
  Dices,
  Plus,
  Edit2,
  Trash2,
  Save,
  RefreshCw,
  History,
  Settings,
  Flame,
  Award,
  Coins,
  Home,
  Palette,
  Shield,
  Search,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Gift,
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

export interface GachaItem {
  id: string;
  name: string;
  type: 'points' | 'rent_house_days' | 'color_role' | 'special_role';
  tier: 'UR' | 'SSR' | 'SR' | 'R' | 'N';
  weight: number;
  reward_amount: number | null;
  role_id: string | null;
  rent_days: number | null;
  duplicate_compensation_points: number;
  icon_emoji: string | null;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GachaSettings {
  id: number;
  cost_per_roll: number;
  is_enabled: boolean;
  dev_unlimited: boolean;
  banner_url: string | null;
  announcement_channel_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GachaRollLog {
  id: string;
  user_id: string;
  username: string | null;
  item_id: string | null;
  item_name: string;
  tier: string;
  roll_type: 'single' | 'multi10';
  cost_paid: number;
  is_duplicate: boolean;
  compensation_points: number;
  created_at: string;
}

export function normalizeTier(rawTier?: string | null): 'UR' | 'SSR' | 'SR' | 'R' | 'N' {
  if (!rawTier) return 'SR';
  const upper = String(rawTier).toUpperCase().trim();
  if (upper === 'UR' || upper === 'LEGENDARY') return 'UR';
  if (upper === 'SSR' || upper === 'EPIC') return 'SSR';
  if (upper === 'SR' || upper === 'RARE') return 'SR';
  if (upper === 'R' || upper === 'UNCOMMON') return 'R';
  if (upper === 'N' || upper === 'COMMON') return 'N';
  return 'SR';
}

export function tierToRarity(tier: string): 'LEGENDARY' | 'EPIC' | 'RARE' | 'COMMON' {
  const norm = normalizeTier(tier);
  switch (norm) {
    case 'UR': return 'LEGENDARY';
    case 'SSR': return 'EPIC';
    case 'SR': return 'RARE';
    case 'R': return 'RARE';
    case 'N': return 'COMMON';
    default: return 'COMMON';
  }
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  UR: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  LEGENDARY: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  SSR: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  EPIC: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  SR: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  RARE: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  R: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  UNCOMMON: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  N: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
  COMMON: { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  points: Coins,
  rent_house_days: Home,
  color_role: Palette,
  special_role: Shield,
};

const TYPE_LABELS: Record<string, string> = {
  points: 'แต้มคาเฟ่ (Points)',
  rent_house_days: 'วันเช่าบ้าน (Rent House Days)',
  color_role: 'ยศสีส่วนตัว (Color Role)',
  special_role: 'ยศพิเศษ (Special Role ID)',
};

export function GachaponManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'items' | 'settings' | 'logs' | 'overview'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [items, setItems] = useState<GachaItem[]>([]);
  const [settings, setSettings] = useState<GachaSettings>({
    id: 1,
    cost_per_roll: 50,
    is_enabled: true,
    dev_unlimited: false,
    banner_url: null,
    announcement_channel_id: null,
  });
  const [logs, setLogs] = useState<GachaRollLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logTierFilter, setLogTierFilter] = useState('ALL');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<GachaItem> | null>(null);

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Settings (Safe fetch first record)
      const { data: settingsRows } = await supabase
        .from('gacha_settings')
        .select('*')
        .limit(1);

      if (settingsRows && settingsRows.length > 0) {
        const row: any = settingsRows[0];
        if (row.value) {
          setSettings({
            id: 1,
            cost_per_roll: row.value.single_roll_price || 50,
            is_enabled: row.value.is_enabled ?? true,
            dev_unlimited: Boolean(row.value.dev_unlimited),
            banner_url: row.value.banner_url || null,
            announcement_channel_id: row.value.announcement_channel_id || null,
          });
        } else {
          setSettings(row as GachaSettings);
        }
      }

      // 2. Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('gacha_items')
        .select('*')
        .order('weight', { ascending: false });

      if (itemsError) {
        console.warn('Gacha items query notice:', itemsError.message);
        setItems([]);
      } else {
        const mappedItems: GachaItem[] = (itemsData || []).map((it: any) => ({
          id: it.id,
          name: it.name,
          type: it.type || it.category || 'points',
          tier: normalizeTier(it.tier || it.rarity),
          weight: Number(it.weight) || 1,
          reward_amount: it.reward_amount ?? it.reward_value?.points ?? null,
          role_id: it.role_id ?? it.reward_value?.role_id ?? null,
          rent_days: it.rent_days ?? it.reward_value?.rent_days ?? null,
          duplicate_compensation_points: it.duplicate_compensation_points ?? it.compensation_points ?? 0,
          icon_emoji: it.icon_emoji || (it.category === 'points' ? '🪙' : it.category === 'rent_house' ? '🏠' : it.category === 'color_role' ? '🎨' : '🎁'),
          description: it.description || null,
          is_active: it.is_active ?? true,
          created_at: it.created_at,
          updated_at: it.updated_at,
        }));
        setItems(mappedItems);
      }

      // 3. Roll Logs (Recent 100)
      const { data: logsData, error: logsError } = await supabase
        .from('gacha_roll_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.warn('Gacha logs query notice:', logsError.message);
        setLogs([]);
      } else {
        const mappedLogs: GachaRollLog[] = (logsData || []).map((l: any) => ({
          id: l.id,
          user_id: l.user_id || l.discord_id || '-',
          username: l.username || null,
          item_id: l.item_id || null,
          item_name: l.item_name || 'ไอเทม',
          tier: normalizeTier(l.tier || l.rarity),
          roll_type: l.roll_type || 'single',
          cost_paid: l.cost_paid ?? 0,
          is_duplicate: Boolean(l.is_duplicate),
          compensation_points: l.compensation_points ?? l.compensated_points ?? 0,
          created_at: l.created_at,
        }));
        setLogs(mappedLogs);
      }
    } catch (err: any) {
      console.error('Failed to load gachapon data:', err);
      toast({
        title: 'แจ้งเตือนการเชื่อมต่อตู้กาชาปอง',
        description: err.message || 'กรุณารัน SQL Migration บน Supabase หรือกดใส่รางวัลเริ่มต้น',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Total Active Weight & Rates
  const totalWeight = useMemo(() => {
    return items.filter(i => i.is_active).reduce((sum, i) => sum + (i.weight || 0), 0);
  }, [items]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const valuePayload = {
        dev_unlimited: settings.dev_unlimited,
        single_roll_price: Number(settings.cost_per_roll),
        ten_roll_price: Number(settings.cost_per_roll) * 10,
        banner_url: settings.banner_url || null,
        announcement_channel_id: settings.announcement_channel_id || null,
        is_enabled: settings.is_enabled,
      };

      // Try key-value format (from sql/create_gachapon_system.sql)
      const { error: kvError } = await supabase
        .from('gacha_settings')
        .upsert({
          key: 'main_gacha',
          value: valuePayload,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (kvError) {
        // Fallback to flat column format if exists
        const { error: flatError } = await supabase
          .from('gacha_settings')
          .upsert({
            id: 1,
            cost_per_roll: Number(settings.cost_per_roll),
            is_enabled: settings.is_enabled,
            dev_unlimited: settings.dev_unlimited,
            banner_url: settings.banner_url || null,
            announcement_channel_id: settings.announcement_channel_id || null,
            updated_at: new Date().toISOString(),
          });
        if (flatError) throw flatError;
      }

      toast({
        title: 'บันทึกการตั้งค่าสำเร็จ',
        description: 'อัปเดตการตั้งค่าตู้กาชาปองเรียบร้อยแล้วค่ะ',
      });
    } catch (err: any) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Item (Add/Edit)
  const handleSaveItem = async () => {
    if (!editingItem?.name || !editingItem?.type || !editingItem?.tier) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกชื่อ, ประเภท และระดับความหายาก (Tier) ให้ครบถ้วนค่ะ',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const tier = normalizeTier(editingItem.tier);
      const rarity = tierToRarity(tier);
      const category = editingItem.type === 'rent_house_days' ? 'rent_house' : editingItem.type;
      const code = editingItem.id || `item_${Date.now()}`;

      const rewardValue: any = {};
      if (editingItem.type === 'points') rewardValue.points = Number(editingItem.reward_amount) || 50;
      if (editingItem.type === 'rent_house_days' || editingItem.type === 'rent_house') rewardValue.rent_days = Number(editingItem.rent_days) || 3;
      if (editingItem.type === 'color_role') rewardValue.free_changes = 1;
      if (editingItem.type === 'special_role') rewardValue.role_id = editingItem.role_id;

      // Flexible payload compatible with both schema types
      const payload: any = {
        code,
        name: editingItem.name,
        category,
        rarity,
        tier,
        weight: Math.max(1, Number(editingItem.weight) || 1),
        reward_value: rewardValue,
        compensation_points: Number(editingItem.duplicate_compensation_points) || 0,
        is_active: editingItem.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      if (editingItem.id) {
        // Try update key-based schema
        const { error } = await supabase
          .from('gacha_items')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) {
          // Fallback to flat column update if needed
          const flatPayload: any = {
            name: editingItem.name,
            type: editingItem.type,
            tier,
            weight: Math.max(1, Number(editingItem.weight) || 1),
            reward_amount: editingItem.type === 'points' ? Number(editingItem.reward_amount) || 0 : null,
            role_id: editingItem.role_id || null,
            rent_days: editingItem.rent_days || null,
            duplicate_compensation_points: Number(editingItem.duplicate_compensation_points) || 0,
            is_active: editingItem.is_active ?? true,
            updated_at: new Date().toISOString(),
          };
          const { error: flatErr } = await supabase
            .from('gacha_items')
            .update(flatPayload)
            .eq('id', editingItem.id);
          if (flatErr) throw flatErr;
        }
      } else {
        // Try insert key-based schema
        const { error } = await supabase
          .from('gacha_items')
          .insert(payload);

        if (error) {
          // Fallback to flat column insert if needed
          const flatPayload: any = {
            name: editingItem.name,
            type: editingItem.type,
            tier,
            weight: Math.max(1, Number(editingItem.weight) || 1),
            reward_amount: editingItem.type === 'points' ? Number(editingItem.reward_amount) || 0 : null,
            role_id: editingItem.role_id || null,
            rent_days: editingItem.rent_days || null,
            duplicate_compensation_points: Number(editingItem.duplicate_compensation_points) || 0,
            is_active: editingItem.is_active ?? true,
            updated_at: new Date().toISOString(),
          };
          const { error: flatErr } = await supabase
            .from('gacha_items')
            .insert(flatPayload);
          if (flatErr) throw flatErr;
        }
      }

      toast({
        title: editingItem.id ? 'แก้ไขไอเทมสำเร็จ' : 'เพิ่มไอเทมใหม่สำเร็จ',
        description: `บันทึก "${editingItem.name}" เรียบร้อยแล้วค่ะ`,
      });

      setIsDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาดในการบันทึกไอเทม',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Seed Default Items (Quick Setup 80:20:15:1)
  const handleSeedDefaultItems = async () => {
    setSaving(true);
    try {
      // 1. Settings
      await supabase.from('gacha_settings').upsert({
        key: 'main_gacha',
        value: {
          dev_unlimited: true,
          single_roll_price: 100,
          ten_roll_price: 900,
          banner_url: "https://cdn.discordapp.com/attachments/1524704267015819274/1524758921233825852/-_6.png",
          title: "🎰 𝖡𝖾𝖺𝗋 𝖢𝖺𝖿𝖾 𝖫𝗎𝖼𝗄𝗒 𝖦𝖺𝖼𝗁𝖺 ₊ ตู้สุ่มของรางวัลคาเฟ่หมี 𓂃",
          description: "หมุนตู้สุ่มลุ้นรับแต้มสะสม, สิทธิ์บ้านเช่าห้องเสียงส่วนตัว, ยศเปลี่ยนสีชื่อ และยศพิเศษประจำเซิร์ฟเวอร์!"
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      // 2. Default Items (Ratio 80:20:15:1)
      const defaultItems = [
        { code: 'pts_50', name: '🪙 แต้มสะสม +50 แต้ม', category: 'points', rarity: 'N', tier: 'N', weight: 40, reward_value: { points: 50 }, compensation_points: 50, is_active: true },
        { code: 'pts_100', name: '🪙 แต้มสะสม +100 แต้ม', category: 'points', rarity: 'N', tier: 'N', weight: 25, reward_value: { points: 100 }, compensation_points: 100, is_active: true },
        { code: 'pts_250', name: '🪙 แต้มสะสม +250 แต้ม', category: 'points', rarity: 'R', tier: 'R', weight: 10, reward_value: { points: 250 }, compensation_points: 250, is_active: true },
        { code: 'pts_500', name: '💰 แต้มสะสมก้อนโต +500 แต้ม', category: 'points', rarity: 'SR', tier: 'SR', weight: 5, reward_value: { points: 500 }, compensation_points: 500, is_active: true },
        { code: 'rent_3days', name: '🏠 สิทธิ์บ้านเช่าห้องเสียง (3 วัน)', category: 'rent_house', rarity: 'SR', tier: 'SR', weight: 15, reward_value: { rent_days: 3 }, compensation_points: 200, is_active: true },
        { code: 'rent_7days', name: '🏡 สิทธิ์บ้านเช่าห้องเสียง (7 วัน)', category: 'rent_house', rarity: 'SSR', tier: 'SSR', weight: 5, reward_value: { rent_days: 7 }, compensation_points: 400, is_active: true },
        { code: 'color_role_pass', name: '🎨 สิทธิ์เปลี่ยนสียศฟรี 1 ครั้ง', category: 'color_role', rarity: 'SR', tier: 'SR', weight: 15, reward_value: { free_changes: 1 }, compensation_points: 150, is_active: true },
        { code: 'role_lucky_bear', name: '👑 ยศพิเศษ: นักสุ่มนำโชค (Lucky Gacha Bear)', category: 'special_role', rarity: 'UR', tier: 'UR', weight: 1, reward_value: { role_id: "1318580353752895583" }, compensation_points: 1000, is_active: true },
      ];

      for (const it of defaultItems) {
        await supabase.from('gacha_items').upsert(it, { onConflict: 'code' });
      }

      toast({
        title: '🌱 ตั้งค่าของรางวัลเริ่มต้นสำเร็จ',
        description: 'สร้างรางวัลตามโมเดล 80:20:15:1 ในตู้กาชาปองเรียบร้อยแล้วค่ะ',
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: 'ตั้งค่าไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (item: GachaItem) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบไอเทม "${item.name}" ออกจากตู้กาชาปอง?`)) return;

    try {
      const { error } = await supabase
        .from('gacha_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: 'ลบไอเทมสำเร็จ',
        description: `นำ "${item.name}" ออกจากตู้กาชาปองเรียบร้อยแล้ว`,
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: 'ไม่สามารถลบไอเทมได้',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Toggle Item Active
  const handleToggleItemActive = async (item: GachaItem) => {
    try {
      const { error } = await supabase
        .from('gacha_items')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchQuery =
        !logSearch ||
        l.username?.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.user_id.includes(logSearch) ||
        l.item_name.toLowerCase().includes(logSearch.toLowerCase());
      const matchTier = logTierFilter === 'ALL' || l.tier === logTierFilter;
      return matchQuery && matchTier;
    });
  }, [logs, logSearch, logTierFilter]);

  // Analytics Stats
  const totalRollsCount = logs.length;
  const totalPointsSpent = logs.reduce((sum, l) => sum + (l.cost_paid || 0), 0);
  const totalURSSRCount = logs.filter(l => l.tier === 'UR' || l.tier === 'SSR').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-500 animate-pulse" />
            ระบบตู้กาชาปอง Bear Cafe
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            จัดการรายการไอเทมในตู้กาชาปอง, กำหนดน้ำหนักเรทโอกาสดรอป, ตรวจสอบประวัติการสุ่ม และตั้งค่าราคาต่อการหมุน
          </p>
        </div>

        <div className="flex items-center gap-2">
          {items.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={handleSeedDefaultItems}
              disabled={saving}
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
              ใส่รางวัลเริ่มต้น (80:20:15:1)
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            รีเฟรชข้อมูล
          </Button>

          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              setEditingItem({
                name: '',
                type: 'points',
                tier: 'SR',
                weight: 15,
                reward_amount: 100,
                role_id: '',
                rent_days: 1,
                duplicate_compensation_points: 50,
                icon_emoji: '🎁',
                description: '',
                is_active: true,
              });
              setIsDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มไอเทมในตู้
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-xl">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            ภาพรวม & เรท
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <Dices className="w-4 h-4" />
            รายการไอเทม ({items.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            ตั้งค่าตู้กาชา
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="w-4 h-4" />
            ประวัติการหมุน
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: OVERVIEW & ANALYTICS ─── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">สถานะตู้กาชาปอง</CardTitle>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {settings.is_enabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xl">
                      <CheckCircle2 className="w-5 h-5" /> เปิดให้บริการ
                    </span>
                  ) : (
                    <span className="text-destructive flex items-center gap-1.5 text-xl">
                      <AlertTriangle className="w-5 h-5" /> ปิดปรับปรุง
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ราคา {settings.cost_per_roll} แต้ม/ครั้ง {settings.dev_unlimited && '• 🛠️ โหมดฟรี Dev เปิดอยู่'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">น้ำหนักรวมในตู้ (Total Weight)</CardTitle>
                <Flame className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalWeight}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  จากไอเทมที่เปิดใช้งาน {items.filter(i => i.is_active).length} / {items.length} รายการ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">แต้มที่หมุนไป (ล่าสุด 100 รอบ)</CardTitle>
                <Coins className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totalPointsSpent)} แต้ม</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ยอดหมุนสะสม {totalRollsCount} ครั้ง
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">รางวัลแรร์แตก (UR / SSR)</CardTitle>
                <Award className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalURSSRCount} ครั้ง</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalRollsCount > 0 ? ((totalURSSRCount / totalRollsCount) * 100).toFixed(1) : 0}% จากการสุ่มทั้งหมด
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rate Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Dices className="w-5 h-5 text-amber-500" />
                อัตราเรทโอกาสดรอปปัจจุบัน (Live Drop Rate Distribution)
              </CardTitle>
              <CardDescription>
                ระบบคำนวณโอกาสได้รับรางวัลแต่ละประเภทแบบอัตโนมัติตามสัดส่วนน้ำหนัก (Weight / Total Weight)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ความหายาก (Tier)</TableHead>
                    <TableHead>รางวัล / ไอเทม</TableHead>
                    <TableHead>ประเภทรางวัล</TableHead>
                    <TableHead className="text-center">น้ำหนัก (Weight)</TableHead>
                    <TableHead className="text-right">โอกาสได้รับ (Drop Rate)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.filter(i => i.is_active).map((item) => {
                    const rate = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) : '0.00';
                    const TypeIcon = TYPE_ICONS[item.type] || Gift;
                    const tierStyle = TIER_COLORS[item.tier] || TIER_COLORS.N;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-bold px-2 py-0.5", tierStyle.bg, tierStyle.text, tierStyle.border)}>
                            {item.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon_emoji || '🎁'}</span>
                            <div>
                              <div>{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground">{item.description}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TypeIcon className="w-3.5 h-3.5" />
                            {TYPE_LABELS[item.type]}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold">
                          {item.weight}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {rate}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: ITEMS MANAGEMENT ─── */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">รายการไอเทมในตู้กาชาปอง</CardTitle>
                <CardDescription>
                  กำหนดไอเทมรางวัล, น้ำหนักความน่าจะเป็น, และแต้มชดเชยเมื่อสุ่มได้ของซ้ำ
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">สถานะ</TableHead>
                    <TableHead className="w-20">Tier</TableHead>
                    <TableHead>ชื่อไอเทม & รายละเอียด</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-center">น้ำหนัก</TableHead>
                    <TableHead className="text-center">ชดเชยเมื่อซ้ำ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const tierStyle = TIER_COLORS[item.tier] || TIER_COLORS.N;
                    const TypeIcon = TYPE_ICONS[item.type] || Gift;

                    return (
                      <TableRow key={item.id} className={cn(!item.is_active && "opacity-50 bg-muted/20")}>
                        <TableCell>
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => handleToggleItemActive(item)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-bold", tierStyle.bg, tierStyle.text, tierStyle.border)}>
                            {item.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.icon_emoji || '🎁'}</span>
                            <div>
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.type === 'points' && `จำนวน: +${item.reward_amount} แต้ม`}
                                {item.type === 'rent_house_days' && `ต่ออายุบ้าน: +${item.rent_days} วัน`}
                                {(item.type === 'color_role' || item.type === 'special_role') && `Role ID: ${item.role_id || 'ตามผู้ใช้'}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs">
                            <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            {TYPE_LABELS[item.type]}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">
                          {item.weight}
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono">
                          {item.duplicate_compensation_points > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              +{item.duplicate_compensation_points} แต้ม
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: SETTINGS ─── */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ตั้งค่าระบบตู้กาชาปอง</CardTitle>
              <CardDescription>
                ปรับเปลี่ยนราคาค่าหมุน, เปิด-ปิดระบบ และโหมดทดสอบสำหรับนักพัฒนา
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-2xl">
              {/* Enable / Disable */}
              <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">เปิดให้บริการตู้กาชาปอง (Enable Gacha)</Label>
                  <p className="text-sm text-muted-foreground">
                    หากปิด สมาชิกจะไม่สามารถกดหมุนตู้กาชาปองได้
                  </p>
                </div>
                <Switch
                  checked={settings.is_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_enabled: checked }))}
                />
              </div>

              {/* Dev Unlimited Mode */}
              <div className="flex items-center justify-between p-4 border rounded-xl bg-amber-500/5 border-amber-500/20">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold text-amber-700 dark:text-amber-400">
                    🛠️ โหมดทดสอบฟรีสำหรับ Dev (Unlimited Dev Mode)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    หมุนฟรี 0 แต้มเพื่อความสะดวกรวดเร็วในการทดสอบระบบและเรทการ์ด
                  </p>
                </div>
                <Switch
                  checked={settings.dev_unlimited}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, dev_unlimited: checked }))}
                />
              </div>

              {/* Cost Per Roll */}
              <div className="space-y-2">
                <Label htmlFor="cost_per_roll" className="font-semibold">
                  ราคาต่อการหมุน 1 ครั้ง (แต้ม Points)
                </Label>
                <div className="relative">
                  <Coins className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    id="cost_per_roll"
                    type="number"
                    min="1"
                    className="pl-9"
                    value={settings.cost_per_roll}
                    onChange={(e) => setSettings(prev => ({ ...prev, cost_per_roll: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  (การหมุน 10 ครั้งจะคำนวณเป็น {settings.cost_per_roll * 10} แต้มอัตโนมัติ)
                </p>
              </div>

              {/* Banner URL */}
              <div className="space-y-2">
                <Label htmlFor="banner_url" className="font-semibold">
                  รูปภาพแบนเนอร์ตู้กาชาปอง (Banner Image URL)
                </Label>
                <Input
                  id="banner_url"
                  type="url"
                  placeholder="https://..."
                  value={settings.banner_url || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, banner_url: e.target.value }))}
                />
              </div>

              {/* Announcement Channel */}
              <div className="space-y-2">
                <Label htmlFor="announcement_channel_id" className="font-semibold">
                  Discord Channel ID สำหรับประกาศรางวัลใหญ่ (UR / SSR)
                </Label>
                <Input
                  id="announcement_channel_id"
                  placeholder="เช่น 123456789012345678"
                  value={settings.announcement_channel_id || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, announcement_channel_id: e.target.value }))}
                />
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: ROLL LOGS ─── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">ประวัติการสุ่มกาชาปอง</CardTitle>
                <CardDescription>
                  รายการบันทึกการหมุนกาชาปองล่าสุดของผู้ใช้ในเซิร์ฟเวอร์
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, User ID..."
                    className="pl-9 h-9"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                </div>

                <Select value={logTierFilter} onValueChange={setLogTierFilter}>
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ทุก Tier</SelectItem>
                    <SelectItem value="UR">UR</SelectItem>
                    <SelectItem value="SSR">SSR</SelectItem>
                    <SelectItem value="SR">SR</SelectItem>
                    <SelectItem value="R">R</SelectItem>
                    <SelectItem value="N">N</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วัน/เวลา</TableHead>
                    <TableHead>ผู้ใช้</TableHead>
                    <TableHead>รูปแบบ</TableHead>
                    <TableHead>ไอเทมที่ได้รับ</TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="text-right">แต้มที่จ่าย</TableHead>
                    <TableHead className="text-right">ชดเชยของซ้ำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        ไม่พบประวัติการหมุนกาชาปอง
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const tierStyle = TIER_COLORS[log.tier] || TIER_COLORS.N;
                      const dateStr = new Date(log.created_at).toLocaleString('th-TH');

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {dateStr}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{log.username || log.user_id}</div>
                            <div className="text-xs text-muted-foreground font-mono">{log.user_id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.roll_type === 'multi10' ? '🎰 10 หมุน' : '🎯 1 หมุน'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.item_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("font-bold text-xs", tierStyle.bg, tierStyle.text, tierStyle.border)}>
                              {log.tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {log.cost_paid > 0 ? `${log.cost_paid} แต้ม` : <span className="text-muted-foreground">ฟรี (Dev)</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {log.is_duplicate ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                +{log.compensation_points} แต้ม
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── ADD/EDIT ITEM DIALOG ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {editingItem?.id ? 'แก้ไขไอเทมในตู้กาชาปอง' : 'เพิ่มไอเทมใหม่ในตู้กาชาปอง'}
            </DialogTitle>
            <DialogDescription>
              กำหนดคุณสมบัติ, น้ำหนักความน่าจะเป็น และการชดเชยของรางวัล
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <Label htmlFor="name">ชื่อไอเทม / รางวัล *</Label>
                  <Input
                    id="name"
                    placeholder="เช่น 1,000 แต้ม หรือ วันเช่าบ้าน"
                    value={editingItem.name || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input
                    id="emoji"
                    placeholder="🎁"
                    value={editingItem.icon_emoji || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, icon_emoji: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ระดับความหายาก (Tier) *</Label>
                  <Select
                    value={normalizeTier(editingItem.tier)}
                    onValueChange={(val: any) => setEditingItem(prev => ({ ...prev, tier: normalizeTier(val) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UR">🟡 UR (Ultra Rare - พิเศษสุด)</SelectItem>
                      <SelectItem value="SSR">🟣 SSR (Super Special)</SelectItem>
                      <SelectItem value="SR">🔵 SR (Super Rare)</SelectItem>
                      <SelectItem value="R">🟢 R (Rare)</SelectItem>
                      <SelectItem value="N">⚪ N (Normal - ทั่วไป)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>ประเภทรางวัล *</Label>
                  <Select
                    value={editingItem.type || 'points'}
                    onValueChange={(val: any) => setEditingItem(prev => ({ ...prev, type: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">🪙 แต้มคาเฟ่ (Points)</SelectItem>
                      <SelectItem value="rent_house_days">🏠 วันเช่าบ้าน (Rent Days)</SelectItem>
                      <SelectItem value="color_role">🎨 ยศสีส่วนตัว (Color Role)</SelectItem>
                      <SelectItem value="special_role">🛡️ ยศพิเศษตาม Role ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional fields based on type */}
              {editingItem.type === 'points' && (
                <div className="space-y-1.5">
                  <Label htmlFor="reward_amount">จำนวนแต้มที่มอบให้ *</Label>
                  <Input
                    id="reward_amount"
                    type="number"
                    min="1"
                    value={editingItem.reward_amount || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, reward_amount: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              )}

              {editingItem.type === 'rent_house_days' && (
                <div className="space-y-1.5">
                  <Label htmlFor="rent_days">จำนวนวันที่เพิ่มให้สัญญาเช่าบ้าน *</Label>
                  <Input
                    id="rent_days"
                    type="number"
                    min="1"
                    value={editingItem.rent_days || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, rent_days: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              )}

              {(editingItem.type === 'color_role' || editingItem.type === 'special_role') && (
                <div className="space-y-1.5">
                  <Label htmlFor="role_id">Discord Role ID (เว้นว่างไว้หากให้ระบบจัดการยศสี)</Label>
                  <Input
                    id="role_id"
                    placeholder="เช่น 123456789012345678"
                    value={editingItem.role_id || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, role_id: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="weight">น้ำหนักโอกาสสุ่มได้ (Weight) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="1"
                    value={editingItem.weight || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ยิ่งค่าน้ำหนักสูง โอกาสสุ่มได้ยิ่งมาก
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="duplicate_compensation_points">แต้มชดเชยเมื่อได้ซ้ำ</Label>
                  <Input
                    id="duplicate_compensation_points"
                    type="number"
                    min="0"
                    value={editingItem.duplicate_compensation_points ?? ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, duplicate_compensation_points: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    หากมียศแล้วจะแปลงเป็นแต้มนี้แทน
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">คำอธิบายเพิ่มเติม</Label>
                <Input
                  id="description"
                  placeholder="คำอธิบายสั้นๆ ของรางวัลนี้"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="is_active"
                  checked={editingItem.is_active ?? true}
                  onCheckedChange={(checked) => setEditingItem(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  เปิดให้สุ่มได้ทันที (Active in pool)
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveItem} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? 'กำลังบันทึก...' : 'บันทึกไอเทม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GachaponManagement;
