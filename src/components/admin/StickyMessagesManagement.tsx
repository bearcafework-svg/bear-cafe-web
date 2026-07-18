import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';

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
}

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

export function StickyMessagesManagement() {
  const [stickyList, setStickyList] = useState<StickyChannel[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  
  // Dialog controls
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StickyChannel | null>(null);
  const [previewTarget, setPreviewTarget] = useState<StickyChannel | null>(null);

  // Form states
  const [formChannelId, setFormChannelId] = useState('');
  const [formDelayMs, setFormDelayMs] = useState(6000);
  const [formPayloadStr, setFormPayloadStr] = useState('');
  const [editingTarget, setEditingTarget] = useState<StickyChannel | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    syncChannels(true); // silent sync
  }, []);

  async function fetchData() {
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
  }

  const syncChannels = async (silent = false) => {
    try {
      if (!silent) setLoadingChannels(true);
      const { data, error } = await supabase.functions.invoke('sync-discord-channels');
      if (error) throw error;
      if (data?.channels) {
        setChannels(data.channels);
        if (!silent) {
          toast({
            title: 'ซิงค์สำเร็จ',
            description: `ดึงข้อมูลช่องแชทจาก Discord จำนวน ${data.channels.length} ช่องแล้วค่ะ`,
          });
        }
      }
    } catch (error: any) {
      console.error('Error syncing channels:', error);
      if (!silent) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถดึงข้อมูลแชนเนล Discord ได้',
          variant: 'destructive',
        });
      }
    } finally {
      if (!silent) setLoadingChannels(false);
    }
  };

  const filteredStickyList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return stickyList;
    return stickyList.filter((s) => {
      const channelName = channels.find((c) => c.id === s.channel_id)?.name ?? '';
      return (
        s.channel_id.includes(q) ||
        channelName.toLowerCase().includes(q)
      );
    });
  }, [stickyList, channels, searchQuery]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [channels, channelSearch]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEXT);
    toast({
      title: 'คัดลอกคำสั่งเรียบร้อย',
      description: 'สามารถนำ Prompt นี้ไปวางใน ChatGPT/Gemini เพื่อจัดฟอร์แมต JSON ได้เลยค่ะ',
    });
  };

  const validateForm = (): { payloadObj: any } | null => {
    if (!formChannelId) {
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
          channel_id: formChannelId,
          delay_ms: formDelayMs,
          payload: valid.payloadObj,
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'ห้องนี้ได้รับการตั้งค่าไปแล้ว', description: 'กรุณาเลือกห้องอื่นหรือทำการแก้ไขแผ่นป้ายเดิมแทนค่ะ', variant: 'destructive' });
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
    setEditingTarget(item);
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
        .update({ refresh_trigger: nextTrigger })
        .eq('channel_id', item.channel_id);

      if (error) throw error;
      toast({
        title: 'ส่งสัญญาณรีเฟรชบอร์ดแล้ว',
        description: `บอทกำลังลบป้ายเก่าและสร้างบอร์ดใหม่ในช่อง # ${
          channels.find((c) => c.id === item.channel_id)?.name ?? item.channel_id
        } ทันทีค่ะ`,
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
    setFormChannelId('');
    setFormDelayMs(6000);
    setFormPayloadStr('');
    setEditingTarget(null);
    setChannelSearch('');
  };

  return (
    <Card className="admin-card border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.3)] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#8C6239] dark:text-[#EAD8C8]">
              <Pin className="w-5 h-5 text-primary rotate-45" />
              จัดการข้อความติดหนึบ (Sticky Message)
              {!loading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({stickyList.length} ห้องแชท)
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              ตั้งค่าข้อความแผงควบคุม (Component v2) ที่จะแสดงอยู่ด้านล่างสุดของช่องแชทเสมอเมื่อการสนทนาเงียบลง
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาห้อง..."
                className="pl-9 h-9 w-48 sm:w-56 bg-background rounded-xl border border-border"
              />
            </div>
            <Button
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
              size="sm"
              className="gap-1.5 shrink-0 bg-[#FAC4CD] hover:bg-[#F8AAB6] text-[#6B323B] border border-[#E9B1BA] rounded-xl h-9"
            >
              <Plus className="w-4 h-4" />
              เพิ่มแผงติดหนึบ
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#8C6239]" />
          </div>
        ) : filteredStickyList.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl border-border bg-muted/5">
            <Pin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-55" />
            <p className="text-sm font-medium text-muted-foreground">ไม่พบบันทึกการตั้งค่าข้อความติดหนึบ</p>
            <p className="text-xs text-muted-foreground mt-1">คลิกที่ปุ่มด้านบนขวาเพื่อเริ่มสร้างใหม่</p>
          </div>
        ) : (
          <div className="border border-border/40 rounded-2xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-xs">ช่อง Discord (Channel ID)</TableHead>
                  <TableHead className="font-semibold text-xs text-center w-32">เวลารอปักใหม่ (Delay)</TableHead>
                  <TableHead className="font-semibold text-xs text-center w-36">โครงสร้างข้อความ</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-28">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStickyList.map((item) => {
                  const discordChan = channels.find((c) => c.id === item.channel_id);
                  return (
                    <TableRow key={item.channel_id} className="hover:bg-muted/10">
                      <TableCell className="font-medium text-sm">
                        <div className="flex flex-col">
                          <span className="text-foreground">
                            # {discordChan?.name ?? 'ไม่พบห้องหรือยังไม่ได้ซิงค์'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.channel_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {(item.delay_ms / 1000).toFixed(1)} วินาที
                        <span className="text-[10px] text-muted-foreground block font-normal">
                          ({item.delay_ms} ms)
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTarget(item)}
                          className="h-8 gap-1.5 text-xs text-primary bg-primary/5 hover:bg-primary/10 rounded-xl"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          พรีวิว JSON
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleForceRefresh(item)}
                            className="w-8 h-8 rounded-lg hover:bg-honey/20 text-[#8C6239]"
                            title="ส่งบอร์ดใหม่ทันที"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            className="w-8 h-8 rounded-lg hover:bg-muted"
                          >
                            <Edit className="w-3.5 h-3.5 text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                            className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ─── Create Dialog ─── */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Plus className="w-5 h-5 text-primary" />
              สร้างข้อความติดหนึบใหม่
            </DialogTitle>
            <DialogDescription>
              ระบุช่องแชท ดีเลย์ และข้อความ Component v2 แบบ JSON โครงสร้างระบบจะส่งแจ้งเตือนและปักหมุดข้อความนี้ในช่องแชทอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Discord Channel Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ช่องแชทเป้าหมาย (Discord Channel) *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => syncChannels(false)}
                  disabled={loadingChannels}
                  className="gap-1.5 text-xs h-7 hover:bg-muted/80 rounded-lg"
                >
                  {loadingChannels ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  ซิงค์แชนเนล
                </Button>
              </div>

              {/* Channel List Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="ค้นหาห้อง..."
                  className="pl-8 h-8.5 text-xs rounded-xl bg-card border-border"
                />
              </div>

              <div className="border border-border/60 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1 bg-muted/10">
                {filteredChannels.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">
                    {channels.length === 0 ? 'คลิก "ซิงค์แชนเนล" เพื่อดึงข้อมูลห้องแชท' : 'ไม่พบช่องที่ตรงกับคำค้นหา'}
                  </p>
                ) : (
                  filteredChannels.map((chan) => (
                    <button
                      key={chan.id}
                      type="button"
                      onClick={() => setFormChannelId(chan.id)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-xs text-left transition-colors hover:bg-muted/60 ${
                        formChannelId === chan.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80'
                      }`}
                    >
                      <span className="font-semibold"># {chan.name}</span>
                      <span className="text-[10px] text-muted-foreground">({chan.id})</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Delay ms */}
            <div className="space-y-1.5">
              <Label htmlFor="create_delay">ระยะเวลารอก่อนปักข้อความใหม่ (Delay) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="create_delay"
                  type="number"
                  value={formDelayMs}
                  onChange={(e) => setFormDelayMs(parseInt(e.target.value) || 0)}
                  placeholder="6000"
                  className="rounded-xl w-32"
                />
                <span className="text-xs text-muted-foreground">
                  มิลลิวินาที (ms) — เช่น 6000 ms เท่ากับ 6 วินาที (ขั้นต่ำ 500 ms)
                </span>
              </div>
            </div>

            {/* Payload JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="create_payload">ข้อความ Component v2 (JSON Payload) *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="gap-1.5 text-xs h-7 border-honey/40 bg-honey/5 hover:bg-honey/10 text-[#8C6239] rounded-xl"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  💡 คัดลอก Prompt แปลง JSON สำหรับ AI
                </Button>
              </div>
              <Textarea
                id="create_payload"
                value={formPayloadStr}
                onChange={(e) => setFormPayloadStr(e.target.value)}
                placeholder='{\n  "flags": 32768,\n  "components": [\n    {\n      "type": 17,\n      "components": [\n        {\n          "type": 10,\n          "content": "สวัสดีค่ะ!"\n        }\n      ]\n    }\n  ]\n}'
                rows={10}
                className="font-mono text-xs rounded-xl focus:ring-primary/20 bg-muted/5 border-border"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button onClick={handleCreate} className="rounded-xl">
              สร้างการตั้งค่า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setEditDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Edit className="w-5 h-5 text-primary" />
              แก้ไขข้อความติดหนึบ
            </DialogTitle>
            <DialogDescription>
              แก้ไขตัวเลขหน่วงเวลาการส่ง หรือปรับปรุงโครงสร้าง Component v2 สำหรับห้องแชทที่เลือก
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Channel Info (Locked) */}
            <div className="bg-muted/30 border border-border p-3 rounded-xl">
              <span className="text-xs text-muted-foreground block">ช่องแชทเป้าหมาย (แก้ไขไม่ได้)</span>
              <span className="font-semibold text-sm">
                # {channels.find((c) => c.id === formChannelId)?.name ?? formChannelId}
              </span>
              <span className="text-[10px] text-muted-foreground block">({formChannelId})</span>
            </div>

            {/* Delay ms */}
            <div className="space-y-1.5">
              <Label htmlFor="edit_delay">ระยะเวลารอก่อนปักข้อความใหม่ (Delay) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit_delay"
                  type="number"
                  value={formDelayMs}
                  onChange={(e) => setFormDelayMs(parseInt(e.target.value) || 0)}
                  placeholder="6000"
                  className="rounded-xl w-32"
                />
                <span className="text-xs text-muted-foreground">
                  มิลลิวินาที (ms) (ขั้นต่ำ 500 ms)
                </span>
              </div>
            </div>

            {/* Payload JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_payload">ข้อความ Component v2 (JSON Payload) *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="gap-1.5 text-xs h-7 border-honey/40 bg-honey/5 hover:bg-honey/10 text-[#8C6239] rounded-xl"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  💡 คัดลอก Prompt แปลง JSON สำหรับ AI
                </Button>
              </div>
              <Textarea
                id="edit_payload"
                value={formPayloadStr}
                onChange={(e) => setFormPayloadStr(e.target.value)}
                placeholder='{\n  "flags": 32768,\n  "components": [\n    {\n      "type": 17,\n      "components": [\n        {\n          "type": 10,\n          "content": "สวัสดีค่ะ!"\n        }\n      ]\n    }\n  ]\n}'
                rows={10}
                className="font-mono text-xs rounded-xl focus:ring-primary/20 bg-muted/5 border-border"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button onClick={handleEdit} className="rounded-xl">
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ─── */}
      <Dialog open={!!previewTarget} onOpenChange={() => setPreviewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl font-mono text-xs">
          <DialogHeader>
            <DialogTitle className="font-sans flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" />
              โครงสร้างข้อความติดหนึบ JSON Payload
            </DialogTitle>
          </DialogHeader>
          {previewTarget && (
            <pre className="bg-muted p-4 rounded-xl overflow-x-auto select-all max-h-[50vh]">
              {JSON.stringify(previewTarget.payload, null, 2)}
            </pre>
          )}
          <DialogFooter className="font-sans">
            <Button
              onClick={() => {
                if (previewTarget) {
                  navigator.clipboard.writeText(JSON.stringify(previewTarget.payload, null, 2));
                  toast({ title: 'คัดลอก JSON แล้วค่ะ' });
                }
              }}
              size="sm"
              className="gap-1.5 rounded-xl"
            >
              <Copy className="w-3.5 h-3.5" />
              คัดลอกข้อความ JSON
            </Button>
            <Button variant="outline" onClick={() => setPreviewTarget(null)} size="sm" className="rounded-xl">
              ปิดแผงควบคุม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Alert Dialog ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">คุณแน่ใจหรือไม่ว่าต้องการลบการตั้งค่านี้?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบการตั้งค่าปักหมุดข้อความติดหนึบในช่องแชท{' '}
              <span className="font-bold text-foreground">
                #{channels.find((c) => c.id === deleteTarget?.channel_id)?.name ?? deleteTarget?.channel_id}
              </span>{' '}
              จะไม่สามารถย้อนกลับได้ บอทจะไม่ทำการปักหมุดในห้องนี้อีกต่อไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl">
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
