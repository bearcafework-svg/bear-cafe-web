import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pin,
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  Loader2,
  FileCode,
  Copy,
  Sparkles,
  Server,
  Hash,
  Clock,
  Send,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StickyChannel {
  channel_id: string;
  delay_ms: number;
  payload: any;
  refresh_trigger: number;
  created_at: string;
  updated_at: string;
}

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  guild_id?: string;
}

interface GuildInfo {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  iconEmoji: string;
}

// ─── Known Guilds Configuration ───────────────────────────────────────────────

const SUPPORTED_GUILDS: GuildInfo[] = [
  {
    id: '1144251788493602848',
    name: '♡ ⸝⸝ 𝓑𝓮𝓪𝓻 𝓬𝓪𝓯𝓮 🐻𐙚',
    badge: 'เซิร์ฟเวอร์หลัก (Main)',
    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    iconEmoji: '🐻',
  },
  {
    id: '1536199707922141254',
    name: 'ห้องฮีลใจ (HealJai)',
    badge: 'ฮีลใจ & บริการ',
    badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    iconEmoji: '🌿',
  },
];

const AI_PROMPT_TEXT = `คุณเป็น AI ผู้เชี่ยวชาญด้าน Discord API และโครงสร้าง Discord Components v2 
หน้าที่ของคุณคือรับข้อความ JSON ดิบของ Discord Component v2 ที่ส่งมาให้ แล้วทำการจัดรูปแบบ (Format) และแก้ไขข้อบกพร่องให้ได้โครงสร้าง JSON ที่ถูกต้องตามมาตรฐาน เพื่อสามารถใช้งานร่วมกับคำสั่ง \`channel.send()\` ของบอทได้ทันทีโดยไม่มีข้อผิดพลาด (Error)

กรุณาแปลงข้อมูลตามกฎด้านล่างนี้อย่างเคร่งครัด:

1. **ลบส่วนห่อหุ้มที่ไม่เกี่ยวข้อง (Wrapper & Metadata)**:
   - ดึงคีย์ \`flags\` และ \`components\` ออกมาจากภายใต้คีย์ \`"data"\` หรือคีย์อื่น ๆ ขึ้นมาอยู่ที่ระดับสูงสุด (Root Level)
   - ลบคีย์ \`"_id"\` หรือคีย์อื่น ๆ ที่ไม่ได้เป็นค่ามาตรฐานของ Discord Message Payload ออกไป

2. **แก้ไขข้อผิดพลาดทางเทคนิคของปุ่มลิงก์ (Link Button - Style 5)**:
   - ตรวจสอบปุ่มใดก็ตามที่มี \`"type": 2\` และ \`"style": 5\` (Link Button)
   - **ต้องทำการลบคีย์ \`"custom_id"\` ออกจากปุ่มเหล่านั้นเสมอ** (เนื่องจาก Discord API จะไม่อนุญาตให้ระบุ custom_id ในปุ่มลิงก์ และจะเกิด Error ทันทีถ้าส่งไป)

3. **ตรวจสอบความสมบูรณ์ของ JSON**:
   - ตรวจสอบว่าอักขระพิเศษในเนื้อหาข้อความ เช่น เครื่องหมายอัญประกาศคู่ (\`"\`), การเว้นวรรค, การขึ้นบรรทัดใหม่ (\`\\n\`), หรือสัญลักษณ์ต่าง ๆ ได้รับการ Escape ไว้อย่างถูกต้องจนส่งผลให้ JSON นั้นสมบูรณ์ 100% (Valid JSON)

4. **คงรูปแบบตัวแปรและข้อมูลเฉพาะตัวเอาไว้**:
   - ห้ามดัดแปลงหรือลบตัวแปร เช่น \`<@0>\`, \`x เม็ด\`, หรือเครื่องหมายอีโมจิของ Discord (เช่น \`<:bee20000:1256669436350562355>\`) ให้อยู่ในตำแหน่งเดิมเหมือนต้นฉบับทุกประการ

เมื่อเข้าใจกติกาแล้ว กรุณาแปลงข้อมูล JSON ต่อไปนี้ให้เสร็จสิ้นและให้ผลลัพธ์เฉพาะโค้ด JSON ที่ถูกต้องเท่านั้น:

[ใส่ข้อความ JSON ดิบของคุณตรงนี้]`;

const DELAY_PRESETS = [
  { label: '3 วินาที', value: 3000 },
  { label: '6 วินาที (แนะนำ)', value: 6000 },
  { label: '10 วินาที', value: 10000 },
  { label: '15 วินาที', value: 15000 },
  { label: '30 วินาที', value: 30000 },
];

export function StickyMessagesManagement() {
  const { toast } = useToast();

  // State
  const [stickyList, setStickyList] = useState<StickyChannel[]>([]);
  const [channelsByGuild, setChannelsByGuild] = useState<Record<string, DiscordChannel[]>>({
    '1144251788493602848': [],
    '1536199707922141254': [],
  });
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('1144251788493602848');

  // Dialog controls
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StickyChannel | null>(null);
  const [previewTarget, setPreviewTarget] = useState<StickyChannel | null>(null);

  // Form states
  const [formGuildId, setFormGuildId] = useState<string>('1144251788493602848');
  const [formChannelId, setFormChannelId] = useState('');
  const [formDelayMs, setFormDelayMs] = useState(6000);
  const [formPayloadStr, setFormPayloadStr] = useState('');
  const [editingTarget, setEditingTarget] = useState<StickyChannel | null>(null);
  const [channelSearch, setChannelSearch] = useState('');

  // Flattened channel list for easy lookup
  const allChannelsMap = useMemo(() => {
    const map = new Map<string, { channel: DiscordChannel; guildId: string }>();
    Object.entries(channelsByGuild).forEach(([guildId, list]) => {
      list.forEach((ch) => {
        map.set(ch.id, { channel: ch, guildId });
      });
    });
    return map;
  }, [channelsByGuild]);

  // Fetch sticky messages from Supabase DB
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sticky_channels' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStickyList((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching sticky list:', err);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลข้อความติดหนึบได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Sync channels for a specific guild via Edge Function
  const syncGuildChannels = useCallback(async (guildId: string, silent = false) => {
    try {
      if (!silent) {
        setLoadingChannels((prev) => ({ ...prev, [guildId]: true }));
      }
      const requestBody: Record<string, any> = { guild_id: guildId };
      if (guildId === '1536199707922141254') {
        const healJaiToken = (import.meta as any).env.VITE_DISCORD_HEALJAI_TOKEN;
        if (healJaiToken) {
          requestBody.bot_token = healJaiToken;
        }
      }
      const { data, error } = await supabase.functions.invoke('sync-discord-channels', {
        body: requestBody,
      });
      if (error) throw error;
      if (data?.channels) {
        const mappedChannels: DiscordChannel[] = data.channels.map((ch: any) => ({
          ...ch,
          guild_id: guildId,
        }));
        setChannelsByGuild((prev) => ({
          ...prev,
          [guildId]: mappedChannels,
        }));
        if (!silent) {
          const gInfo = SUPPORTED_GUILDS.find((g) => g.id === guildId);
          toast({
            title: 'ซิงค์สำเร็จ',
            description: `ดึงข้อมูลช่องแชทจาก ${gInfo?.name || guildId} จำนวน ${data.channels.length} ช่องเรียบร้อยแล้วค่ะ`,
          });
        }
      }
    } catch (error: any) {
      console.error(`Error syncing channels for guild ${guildId}:`, error);
      if (!silent) {
        toast({
          title: 'เกิดข้อผิดพลาดในการซิงค์',
          description: error.message || 'ไม่สามารถดึงข้อมูลแชนเนล Discord ได้',
          variant: 'destructive',
        });
      }
    } finally {
      if (!silent) {
        setLoadingChannels((prev) => ({ ...prev, [guildId]: false }));
      }
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    fetchData();
    // Sync all supported guilds in parallel on startup
    SUPPORTED_GUILDS.forEach((g) => {
      syncGuildChannels(g.id, true);
    });
  }, [fetchData, syncGuildChannels]);

  // Helper to resolve guild info from channel ID
  const getChannelGuildInfo = (channelId: string): { guild: GuildInfo | null; channelName: string } => {
    const lookup = allChannelsMap.get(channelId);
    if (lookup) {
      const g = SUPPORTED_GUILDS.find((sg) => sg.id === lookup.guildId) || null;
      return { guild: g, channelName: lookup.channel.name };
    }
    // Fallback heuristic: check if any guild has it or guess
    return { guild: null, channelName: channelId };
  };

  // Filter sticky list by active tab and search query
  const filteredStickyList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return stickyList.filter((item) => {
      const { guild, channelName } = getChannelGuildInfo(item.channel_id);

      // Server Tab filter
      if (selectedTab !== 'all') {
        const itemGuildId = guild?.id;
        // If channel is found in active tab guild, include it
        if (itemGuildId) {
          if (itemGuildId !== selectedTab) return false;
        } else {
          // If not synced yet, keep in 'all' or show under fallback
          if (selectedTab !== '1144251788493602848' && selectedTab !== '1536199707922141254') {
            return false;
          }
        }
      }

      // Search query filter
      if (!q) return true;

      const payloadStr = JSON.stringify(item.payload || {}).toLowerCase();
      return (
        item.channel_id.includes(q) ||
        channelName.toLowerCase().includes(q) ||
        (guild?.name.toLowerCase().includes(q) ?? false) ||
        payloadStr.includes(q)
      );
    });
  }, [stickyList, selectedTab, searchQuery, allChannelsMap]);

  // Counts per guild
  const countsByGuild = useMemo(() => {
    const counts: Record<string, number> = {
      all: stickyList.length,
      '1144251788493602848': 0,
      '1536199707922141254': 0,
    };

    stickyList.forEach((item) => {
      const { guild } = getChannelGuildInfo(item.channel_id);
      if (guild && counts[guild.id] !== undefined) {
        counts[guild.id]++;
      } else {
        // Default to Bear Cafe if unsure or not yet indexed
        counts['1144251788493602848']++;
      }
    });

    return counts;
  }, [stickyList, allChannelsMap]);

  // Form filtered channels for creating dialog
  const formAvailableChannels = useMemo(() => {
    const list = channelsByGuild[formGuildId] || [];
    const q = channelSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((ch) => ch.name.toLowerCase().includes(q) || ch.id.includes(q));
  }, [channelsByGuild, formGuildId, channelSearch]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEXT);
    toast({
      title: 'คัดลอกคำสั่งเรียบร้อย',
      description: 'สามารถนำ Prompt นี้ไปวางใน ChatGPT/Gemini เพื่อจัดฟอร์แมต JSON ได้เลยค่ะ',
    });
  };

  const validateForm = (): { payloadObj: any } | null => {
    if (!formChannelId.trim()) {
      toast({ title: 'กรุณาเลือกช่องแชทเป้าหมาย', variant: 'destructive' });
      return null;
    }
    if (formDelayMs < 500 || formDelayMs > 300000) {
      toast({ title: 'ดีเลย์ต้องอยู่ระหว่าง 500ms - 300,000ms', variant: 'destructive' });
      return null;
    }
    try {
      const parsed = JSON.parse(formPayloadStr);
      if (!parsed.components || !Array.isArray(parsed.components)) {
        toast({
          title: 'JSON รูปแบบไม่ถูกต้อง',
          description: "จำเป็นต้องมีฟิลด์ 'components' ที่ระดับสูงสุดและต้องเป็น Array ค่ะ",
          variant: 'destructive',
        });
        return null;
      }
      return { payloadObj: parsed };
    } catch (err: any) {
      toast({
        title: 'ไวยากรณ์ JSON ไม่ถูกต้อง',
        description: `Error: ${err.message}`,
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleCreate = async () => {
    const valid = validateForm();
    if (!valid) return;

    try {
      const { error } = await supabase
        .from('sticky_channels' as any)
        .insert({
          channel_id: formChannelId.trim(),
          delay_ms: formDelayMs,
          payload: valid.payloadObj,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'ห้องนี้ได้รับการตั้งค่าไปแล้ว',
            description: 'กรุณาเลือกห้องอื่นหรือทำการแก้ไขแผ่นป้ายเดิมแทนค่ะ',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'สำเร็จ', description: 'สร้างการตั้งค่าข้อความติดหนึบเรียบร้อยแล้วค่ะ' });
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = async () => {
    if (!editingTarget) return;
    const valid = validateForm();
    if (!valid) return;

    try {
      const { error } = await supabase
        .from('sticky_channels' as any)
        .update({
          delay_ms: formDelayMs,
          payload: valid.payloadObj,
          updated_at: new Date().toISOString(),
        })
        .eq('channel_id', editingTarget.channel_id);

      if (error) throw error;

      toast({ title: 'สำเร็จ', description: 'อัปเดตการตั้งค่าข้อความติดหนึบเรียบร้อยแล้วค่ะ' });
      setEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('sticky_channels' as any)
        .delete()
        .eq('channel_id', deleteTarget.channel_id);

      if (error) throw error;
      toast({ title: 'ลบสำเร็จ', description: 'ลบแผงป้ายติดหนึบเรียบร้อยแล้วค่ะ' });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (item: StickyChannel) => {
    const { guild } = getChannelGuildInfo(item.channel_id);
    setEditingTarget(item);
    setFormGuildId(guild?.id || '1144251788493602848');
    setFormChannelId(item.channel_id);
    setFormDelayMs(item.delay_ms);
    setFormPayloadStr(JSON.stringify(item.payload, null, 2));
    setEditDialogOpen(true);
  };

  const handleForceRefresh = async (item: StickyChannel) => {
    try {
      const nextTrigger = (item.refresh_trigger || 0) + 1;
      const { error } = await supabase
        .from('sticky_channels' as any)
        .update({
          refresh_trigger: nextTrigger,
          updated_at: new Date().toISOString(),
        })
        .eq('channel_id', item.channel_id);

      if (error) throw error;
      const { channelName } = getChannelGuildInfo(item.channel_id);
      toast({
        title: 'ส่งสัญญาณรีเฟรชบอร์ดแล้ว',
        description: `บอทกำลังลบป้ายเก่าและสร้างบอร์ดใหม่ในช่อง #${channelName} ทันทีค่ะ`,
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormGuildId(selectedTab !== 'all' ? selectedTab : '1144251788493602848');
    setFormChannelId('');
    setFormDelayMs(6000);
    setFormPayloadStr('');
    setEditingTarget(null);
    setChannelSearch('');
  };

  const openCreateDialogWithCurrentGuild = () => {
    resetForm();
    if (selectedTab !== 'all') {
      setFormGuildId(selectedTab);
    }
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* ─── Header Card ─── */}
      <Card className="rounded-3xl border-2 border-[#F4EEE5] dark:border-[#382F28] bg-[#FDFAF7] dark:bg-[#1E1B18] shadow-sm">
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                <Pin className="w-5 h-5 text-[#8C6239] rotate-45" />
                จัดการข้อความติดหนึบ (Sticky Messages)
                <Badge variant="outline" className="ml-2 font-mono text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                  {stickyList.length} แผงที่ตั้งค่า
                </Badge>
              </CardTitle>
              <p className="text-xs text-[#827160] dark:text-[#A89889]">
                ระบบปักหมุดข้อความแผงควบคุม (Component v2) อัตโนมัติท้ายช่องแชท รองรับทั้งเซิร์ฟเวอร์ Bear Cafe (1144251788493602848) และ HealJai (1536199707922141254)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchData();
                  SUPPORTED_GUILDS.forEach((g) => syncGuildChannels(g.id, false));
                }}
                disabled={loading || Object.values(loadingChannels).some(Boolean)}
                className="gap-1.5 h-9 rounded-xl border-[#EFE7DC] dark:border-[#3E3229] text-[#827160] dark:text-[#C5B4A5] cursor-pointer"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', (loading || Object.values(loadingChannels).some(Boolean)) && 'animate-spin')} />
                ซิงค์ข้อมูลทั้งหมด
              </Button>
              <Button
                onClick={openCreateDialogWithCurrentGuild}
                size="sm"
                className="gap-1.5 h-9 rounded-xl bg-[#8C6239] hover:bg-[#76522E] text-white font-bold cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                เพิ่มแผงติดหนึบใหม่
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ─── Server Tabs Navigation ─── */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF6F0] dark:bg-[#241F1C] p-2 rounded-2xl border border-[#F0E8DC] dark:border-[#382F28]">
          <TabsList className="bg-white/80 dark:bg-[#1E1B18] p-1 rounded-xl h-auto border border-[#EFE7DC] dark:border-[#332A24] flex-wrap">
            <TabsTrigger
              value="1144251788493602848"
              className="gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#8C6239] data-[state=active]:text-white transition-all cursor-pointer"
            >
              <span>🐻</span>
              <span>Bear Cafe (เซิร์ฟเวอร์หลัก)</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200">
                {countsByGuild['1144251788493602848'] ?? 0}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="1536199707922141254"
              className="gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white transition-all cursor-pointer"
            >
              <span>🌿</span>
              <span>ห้องฮีลใจ (HealJai)</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold bg-rose-500/15 text-rose-800 dark:text-rose-200">
                {countsByGuild['1536199707922141254'] ?? 0}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="all"
              className="gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#4E3F30] data-[state=active]:text-white transition-all cursor-pointer"
            >
              <span>🌐</span>
              <span>ทั้งหมด</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold bg-muted text-foreground">
                {countsByGuild.all}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Search bar inside toolbar */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อห้อง, Channel ID, เนื้อหา..."
              className="pl-8.5 h-8.5 text-xs bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#382F28] rounded-xl"
            />
          </div>
        </div>

        {/* ─── Content Table / List ─── */}
        <div className="mt-4">
          <Card className="rounded-3xl border-2 border-[#F4EEE5] dark:border-[#382F28] bg-white dark:bg-[#1E1B18] overflow-hidden shadow-xs">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#8C6239]" />
                  <p className="text-xs text-[#827160] dark:text-[#A89889]">กำลังโหลดข้อมูลข้อความติดหนึบ...</p>
                </div>
              ) : filteredStickyList.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] dark:bg-[#28221D] flex items-center justify-center mx-auto mb-3 text-[#8C6239] border border-[#F0E8DC] dark:border-[#3A3027]">
                    <Pin className="w-6 h-6 rotate-45 opacity-60" />
                  </div>
                  <p className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9]">ไม่พบข้อความติดหนึบในเซิร์ฟเวอร์นี้</p>
                  <p className="text-xs text-[#827160] dark:text-[#A89889] mt-1 max-w-sm mx-auto">
                    ยังไม่มีการตั้งค่าแผงติดหนึบสำหรับเซิร์ฟเวอร์นี้ คลิกปุ่มด้านล่างเพื่อเริ่มสร้างได้ทันทีค่ะ
                  </p>
                  <Button
                    onClick={openCreateDialogWithCurrentGuild}
                    size="sm"
                    className="mt-4 gap-1.5 rounded-xl bg-[#8C6239] hover:bg-[#76522E] text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มแผงติดหนึบในเซิร์ฟเวอร์นี้
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]/80 dark:bg-[#241F1C]/80 border-b border-[#F0E8DC] dark:border-[#382F28]">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-[#4E3F30] dark:text-[#E8E1D9] py-3.5 pl-6">
                          เซิร์ฟเวอร์ & ช่องแชท Discord
                        </TableHead>
                        <TableHead className="font-bold text-xs text-center text-[#4E3F30] dark:text-[#E8E1D9] w-36">
                          เวลารอปักใหม่ (Delay)
                        </TableHead>
                        <TableHead className="font-bold text-xs text-center text-[#4E3F30] dark:text-[#E8E1D9] w-36">
                          โครงสร้าง JSON
                        </TableHead>
                        <TableHead className="font-bold text-xs text-right text-[#4E3F30] dark:text-[#E8E1D9] pr-6 w-36">
                          จัดการ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-[#F4EEE5] dark:divide-[#2F2721]">
                      {filteredStickyList.map((item) => {
                        const { guild, channelName } = getChannelGuildInfo(item.channel_id);
                        const isMainGuild = guild?.id === '1144251788493602848';

                        return (
                          <TableRow key={item.channel_id} className="hover:bg-[#FAF6F0]/40 dark:hover:bg-[#25201C]/40 transition-colors">
                            {/* Server & Channel info */}
                            <TableCell className="pl-6 py-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                      guild?.badgeColor || 'bg-stone-500/10 text-stone-600 border-stone-500/20'
                                    )}
                                  >
                                    <span className="mr-1">{guild?.iconEmoji || '🌐'}</span>
                                    {guild?.name || 'ไม่ทราบเซิร์ฟเวอร์'}
                                  </Badge>

                                  <div className="flex items-center gap-1 font-bold text-sm text-[#4E3F30] dark:text-[#E8E1D9]">
                                    <Hash className="w-4 h-4 text-[#8C6239] shrink-0" />
                                    <span>{channelName}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] font-mono text-[#827160] dark:text-[#A89889]">
                                  <span>ID: {item.channel_id}</span>
                                  {item.refresh_trigger > 0 && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">
                                      (ส่งใหม่แล้ว {item.refresh_trigger} ครั้ง)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Delay */}
                            <TableCell className="text-center py-4">
                              <div className="inline-flex flex-col items-center bg-[#FAF6F0] dark:bg-[#28221D] px-3 py-1.5 rounded-xl border border-[#F0E8DC] dark:border-[#3A3027]">
                                <span className="font-bold text-xs text-[#4E3F30] dark:text-[#E8E1D9]">
                                  {(item.delay_ms / 1000).toFixed(1)} วินาที
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {item.delay_ms} ms
                                </span>
                              </div>
                            </TableCell>

                            {/* JSON Payload preview button */}
                            <TableCell className="text-center py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewTarget(item)}
                                className="h-8 gap-1.5 text-xs font-bold text-[#8C6239] border-[#EAD8C8] dark:border-[#3E3229] hover:bg-[#8C6239]/10 rounded-xl cursor-pointer"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                                ดู JSON Payload
                              </Button>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="pr-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleForceRefresh(item)}
                                  className="w-8 h-8 rounded-xl text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 cursor-pointer"
                                  title="ส่งบอร์ดใหม่เข้าช่องแชททันที (Force Resend)"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(item)}
                                  className="w-8 h-8 rounded-xl text-[#8C6239] hover:bg-[#8C6239]/10 cursor-pointer"
                                  title="แก้ไขการตั้งค่า"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteTarget(item)}
                                  className="w-8 h-8 rounded-xl text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                  title="ลบแผงป้ายนี้"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* ─── Create Dialog ─── */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setCreateDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#8C6239]" />
              เพิ่มแผงข้อความติดหนึบใหม่
            </DialogTitle>
            <DialogDescription className="text-xs text-[#827160] dark:text-[#A89889]">
              เลือกเซิร์ฟเวอร์ Discord และระบุห้องแชทเป้าหมาย พร้อมตั้งค่าโครงสร้าง Component v2 (JSON Payload)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Server Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                1. เลือกเซิร์ฟเวอร์ Discord *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUPPORTED_GUILDS.map((guild) => {
                  const isSelected = formGuildId === guild.id;
                  return (
                    <button
                      key={guild.id}
                      type="button"
                      onClick={() => {
                        setFormGuildId(guild.id);
                        setFormChannelId('');
                        if (!channelsByGuild[guild.id]?.length) {
                          syncGuildChannels(guild.id, false);
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer',
                        isSelected
                          ? 'border-[#8C6239] bg-[#8C6239]/10 shadow-xs'
                          : 'border-[#F4EEE5] dark:border-[#332A24] bg-white dark:bg-[#25201C] hover:border-[#DFD5C0]'
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1B18] flex items-center justify-center text-lg border border-[#F0E8DC] dark:border-[#3A3027] shrink-0 shadow-xs">
                        {guild.iconEmoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-xs font-bold truncate', isSelected ? 'text-[#8C6239] dark:text-[#D4B28C]' : 'text-foreground')}>
                          {guild.name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          ID: {guild.id}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#8C6239] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Channel Selector */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                  2. เลือกช่องแชทเป้าหมาย (Discord Channel) *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => syncGuildChannels(formGuildId, false)}
                  disabled={loadingChannels[formGuildId]}
                  className="gap-1.5 text-xs h-7 px-2.5 rounded-xl border-[#EFE7DC] dark:border-[#3A3027] text-[#827160] hover:bg-white dark:hover:bg-[#25201C] cursor-pointer font-bold"
                >
                  <RefreshCw className={cn('w-3 h-3', loadingChannels[formGuildId] && 'animate-spin')} />
                  ซิงค์แชนเนลเซิร์ฟเวอร์นี้
                </Button>
              </div>

              {/* Channel List Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="พิมพ์ค้นหาชื่อห้องหรือ ID..."
                  className="pl-8.5 h-8.5 text-xs rounded-xl bg-white dark:bg-[#25201C] border-[#EFE7DC] dark:border-[#3A3027]"
                />
              </div>

              <div className="border border-[#F0E8DC] dark:border-[#382F28] rounded-2xl p-2 max-h-44 overflow-y-auto space-y-1 bg-white dark:bg-[#221D1A]">
                {formAvailableChannels.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    {channelsByGuild[formGuildId]?.length === 0
                      ? 'ยังไม่มีข้อมูลห้องแชท กรุณากด "ซิงค์แชนเนลเซิร์ฟเวอร์นี้" ด้านบน'
                      : 'ไม่พบช่องแชทที่ตรงกับคำค้นหา'}
                  </div>
                ) : (
                  formAvailableChannels.map((chan) => {
                    const isSelected = formChannelId === chan.id;
                    return (
                      <button
                        key={chan.id}
                        type="button"
                        onClick={() => setFormChannelId(chan.id)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer',
                          isSelected
                            ? 'bg-[#8C6239] text-white font-bold shadow-xs'
                            : 'hover:bg-[#FAF6F0] dark:hover:bg-[#2D2622] text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Hash className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-white' : 'text-[#8C6239]')} />
                          <span className="truncate">{chan.name}</span>
                        </div>
                        <span className={cn('text-[10px] font-mono shrink-0', isSelected ? 'text-white/80' : 'text-muted-foreground')}>
                          {chan.id}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Delay ms & Presets */}
            <div className="space-y-2 pt-1">
              <Label htmlFor="create_delay" className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                3. ระยะเวลารอก่อนปักข้อความใหม่ (Delay) *
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  id="create_delay"
                  type="number"
                  min="500"
                  max="300000"
                  value={formDelayMs}
                  onChange={(e) => setFormDelayMs(parseInt(e.target.value) || 0)}
                  className="rounded-xl w-32 h-9 text-xs font-bold bg-white dark:bg-[#25201C] border-[#EFE7DC] dark:border-[#3A3027]"
                />
                <span className="text-xs text-muted-foreground font-medium">
                  มิลลิวินาที (ms) — เช่น 6,000 ms = 6 วินาที
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {DELAY_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormDelayMs(p.value)}
                    className={cn(
                      'h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer border-[#EFE7DC] dark:border-[#382F28]',
                      formDelayMs === p.value ? 'bg-[#8C6239] text-white border-[#8C6239]' : ''
                    )}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 4. JSON Payload */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label htmlFor="create_payload" className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                  4. ข้อความ Component v2 (JSON Payload) *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="gap-1.5 text-xs h-7.5 px-3 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-[#8C6239] dark:text-amber-300 font-bold rounded-xl cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  💡 คัดลอก Prompt แปลง JSON สำหรับ AI
                </Button>
              </div>
              <Textarea
                id="create_payload"
                value={formPayloadStr}
                onChange={(e) => setFormPayloadStr(e.target.value)}
                placeholder='{\n  "flags": 32768,\n  "components": [\n    {\n      "type": 17,\n      "components": [\n        {\n          "type": 10,\n          "content": "## <:bee20000:1256669436350562355>︲__` ข้อความตัวอย่าง `__\\nยินดีต้อนรับสู่คาเฟ่หมี!"\n        }\n      ]\n    }\n  ]\n}'
                rows={9}
                className="font-mono text-xs rounded-2xl bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#382F28] focus-visible:ring-[#8C6239]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl border-[#EFE7DC] dark:border-[#382F28] cursor-pointer">
              ยกเลิก
            </Button>
            <Button onClick={handleCreate} className="rounded-xl bg-[#8C6239] hover:bg-[#76522E] text-white font-bold cursor-pointer">
              บันทึกการตั้งค่า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setEditDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
              <Edit className="w-5 h-5 text-[#8C6239]" />
              แก้ไขข้อความติดหนึบ
            </DialogTitle>
            <DialogDescription className="text-xs text-[#827160] dark:text-[#A89889]">
              ปรับปรุงระยะเวลาหน่วง หรือโครงสร้างข้อความ Component v2 สำหรับห้องนี้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Channel Info (Locked) */}
            <div className="bg-[#FAF6F0] dark:bg-[#25201C] border border-[#F0E8DC] dark:border-[#382F28] p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[#827160] dark:text-[#A89889] block">
                  ช่องแชทเป้าหมาย (แก้ไขไม่ได้)
                </span>
                <div className="flex items-center gap-1.5 text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9] mt-0.5">
                  <Hash className="w-4 h-4 text-[#8C6239]" />
                  <span>{getChannelGuildInfo(formChannelId).channelName}</span>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs border-[#EFE7DC] dark:border-[#3A3027]">
                ID: {formChannelId}
              </Badge>
            </div>

            {/* Delay ms & Presets */}
            <div className="space-y-2 pt-1">
              <Label htmlFor="edit_delay" className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                ระยะเวลารอก่อนปักข้อความใหม่ (Delay) *
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  id="edit_delay"
                  type="number"
                  min="500"
                  max="300000"
                  value={formDelayMs}
                  onChange={(e) => setFormDelayMs(parseInt(e.target.value) || 0)}
                  className="rounded-xl w-32 h-9 text-xs font-bold bg-white dark:bg-[#25201C] border-[#EFE7DC] dark:border-[#3A3027]"
                />
                <span className="text-xs text-muted-foreground font-medium">
                  มิลลิวินาที (ms)
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {DELAY_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormDelayMs(p.value)}
                    className={cn(
                      'h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer border-[#EFE7DC] dark:border-[#382F28]',
                      formDelayMs === p.value ? 'bg-[#8C6239] text-white border-[#8C6239]' : ''
                    )}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* JSON Payload */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label htmlFor="edit_payload" className="text-xs font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                  ข้อความ Component v2 (JSON Payload) *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="gap-1.5 text-xs h-7.5 px-3 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-[#8C6239] dark:text-amber-300 font-bold rounded-xl cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  💡 คัดลอก Prompt แปลง JSON สำหรับ AI
                </Button>
              </div>
              <Textarea
                id="edit_payload"
                value={formPayloadStr}
                onChange={(e) => setFormPayloadStr(e.target.value)}
                rows={10}
                className="font-mono text-xs rounded-2xl bg-white dark:bg-[#1E1B18] border-[#EFE7DC] dark:border-[#382F28] focus-visible:ring-[#8C6239]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl border-[#EFE7DC] dark:border-[#382F28] cursor-pointer">
              ยกเลิก
            </Button>
            <Button onClick={handleEdit} className="rounded-xl bg-[#8C6239] hover:bg-[#76522E] text-white font-bold cursor-pointer">
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ─── */}
      <Dialog open={!!previewTarget} onOpenChange={() => setPreviewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] p-6 font-mono text-xs">
          <DialogHeader className="font-sans">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
              <FileCode className="w-5 h-5 text-[#8C6239]" />
              โครงสร้างข้อความติดหนึบ (JSON Payload)
            </DialogTitle>
            <DialogDescription className="text-xs">
              ช่อง: #{getChannelGuildInfo(previewTarget?.channel_id || '').channelName} ({previewTarget?.channel_id})
            </DialogDescription>
          </DialogHeader>

          {previewTarget && (
            <pre className="bg-[#FAF6F0] dark:bg-[#25201C] p-4 rounded-2xl border border-[#F0E8DC] dark:border-[#382F28] overflow-x-auto select-all max-h-[50vh] text-xs font-mono leading-relaxed">
              {JSON.stringify(previewTarget.payload, null, 2)}
            </pre>
          )}

          <DialogFooter className="font-sans pt-2 gap-2">
            <Button
              onClick={() => {
                if (previewTarget) {
                  navigator.clipboard.writeText(JSON.stringify(previewTarget.payload, null, 2));
                  toast({ title: 'คัดลอก JSON แล้วค่ะ' });
                }
              }}
              size="sm"
              className="gap-1.5 rounded-xl bg-[#8C6239] hover:bg-[#76522E] text-white font-bold cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              คัดลอก JSON
            </Button>
            <Button variant="outline" onClick={() => setPreviewTarget(null)} size="sm" className="rounded-xl border-[#EFE7DC] dark:border-[#382F28] cursor-pointer">
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Alert Dialog ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] p-6 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              ยืนยันการลบการตั้งค่าข้อความติดหนึบ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#827160] dark:text-[#A89889] leading-relaxed pt-1">
              คุณต้องการลบแผงติดหนึบในช่องแชท{' '}
              <strong className="text-foreground">
                #{getChannelGuildInfo(deleteTarget?.channel_id || '').channelName} ({deleteTarget?.channel_id})
              </strong>{' '}
              ใช่หรือไม่? บอทจะไม่ทำการส่งและปักหมุดในช่องนี้อีกต่อไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl border-[#EFE7DC] dark:border-[#382F28] cursor-pointer">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
