import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, Users, Mail, AlertCircle, Play, Square, RefreshCw, XCircle, 
  CheckCircle, Shield, FileText, CheckCircle2, ChevronDown, ChevronUp 
} from 'lucide-react';

interface CampaignQueue {
  id: string;
  title: string;
  message_payload: any;
  target_type: string;
  target_value: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  token_type: 'token1' | 'token2';
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

interface CampaignLog {
  id: string;
  user_id: string;
  username: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  sent_at: string | null;
}

export function DMBroadcastManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Subscription stats
  const [subStats, setSubStats] = useState({
    totalSubs: 0,
    options: {
      '49B40A9yBS': 0, // กิจกรรม
      'JNySCX80ja': 0, // ประกาศสำคัญ
      'DsMHlVrjze': 0, // ข่าวสารทั่วไป
      '6io1xnaMWJ': 0  // โปรโมชันและโฆษณา
    }
  });

  // Reachability stats
  const [dmStatusStats, setDmStatusStats] = useState({
    open: 0,
    closed: 0,
    unknown: 0
  });

  // Campaigns list
  const [campaigns, setCampaigns] = useState<CampaignQueue[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Composer Form
  const [composerTitle, setComposerTitle] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'option'>('option');
  const [targetOption, setTargetOption] = useState('49B40A9yBS');
  const [tokenType, setTokenType] = useState<'token1' | 'token2'>('token1');
  const [inputMode, setInputMode] = useState<'text' | 'json'>('text');
  const [textContent, setTextContent] = useState('');
  const [jsonContent, setJsonContent] = useState(`{
  "data": {
    "flags": 32768,
    "components": [
      {
        "type": 17,
        "components": [
          {
            "type": 12,
            "items": [
              {
                "media": {
                  "url": "https://cdn.discordapp.com/attachments/1524704267015819274/1526522750460498021/d8c5887ba3276d401ff1af64efa6add6.jpg?ex=6a575499&is=6a560319&hm=44ac8a4b15d5f3beed9c9a4c0413df475b60afdea1dc2e96035ee6499612bd04&"
                }
              }
            ]
          },
          {
            "type": 14,
            "spacing": 2
          },
          {
            "type": 10,
            "content": "## <:bee20000:1256669436350562355>︲__\` 𝖭𝗈𝗍𝗂𝖿𝗂𝖼𝖺𝗍𝗂𝗈𝗇𝗌 ₊ เลือกการแจ้งเตือนที่ต้องการ 𓂃 \`__\\n-# เลือกรับการแจ้งเตือนเฉพาะหัวข้อที่คุณสนใจ เพื่อไม่ให้พลาดข่าวสารสำคัญและลดการแจ้งเตือนที่ไม่จำเป็น <:cuteplant:1152834055528783872>\\n"
          },
          {
            "type": 1,
            "components": [
              {
                "type": 3,
                "options": [
                  {
                    "label": "กิจกรรม",
                    "value": "49B40A9yBS",
                    "description": "ลุ้นของรางวัล อีเวนต์ และกิจกรรมพิเศษ",
                    "emoji": {
                      "name": "🎉"
                    }
                  },
                  {
                    "label": "ประกาศสำคัญ",
                    "value": "JNySCX80ja",
                    "description": "ข่าวสำคัญที่อาจส่งผลต่อการใช้งานเซิร์ฟเวอร์",
                    "emoji": {
                      "name": "📢"
                    }
                  },
                  {
                    "label": "ข่าวสารทั่วไป",
                    "value": "DsMHlVrjze",
                    "description": "อัปเดตฟีเจอร์และความเคลื่อนไหวของ Bear Cafe",
                    "emoji": {
                      "name": "📑"
                    }
                  },
                  {
                    "label": "โปรโมชันและโฆษณา",
                    "value": "6io1xnaMWJ",
                    "description": "โปรโมชัน และสิทธิพิเศษสำหรับสมาชิก",
                    "emoji": {
                      "name": "🎁"
                    }
                  }
                ],
                "placeholder": "🐻︲เลือกการแจ้งเตือนที่ต้องการ",
                "flows": {},
                "custom_id": "p_324120127182213152",
                "min_values": 1,
                "max_values": 1
              }
            ]
          },
          {
            "type": 14,
            "spacing": 2
          }
        ]
      }
    ]
  },
  "_id": "SxhRPO1xeN"
}`);
  const [submitting, setSubmitting] = useState(false);

  // Fetch all stats and campaigns list
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Fetch Subscription Stats
      const { data: rawSubs, error: subErr } = await supabase
        .from('dms_options' as any)
        .select('option_value');

      if (!subErr && rawSubs) {
        const counts = {
          '49B40A9yBS': 0,
          'JNySCX80ja': 0,
          'DsMHlVrjze': 0,
          '6io1xnaMWJ': 0
        };
        rawSubs.forEach((item: any) => {
          if (item.option_value in counts) {
            counts[item.option_value as keyof typeof counts]++;
          }
        });
        setSubStats({
          totalSubs: rawSubs.length,
          options: counts
        });
      }

      // 2. Fetch Reachability Stats
      const { data: rawStatuses, error: statusErr } = await supabase
        .from('member_dm_status' as any)
        .select('dm_status');

      if (!statusErr && rawStatuses) {
        const counts = { open: 0, closed: 0, unknown: 0 };
        rawStatuses.forEach((item: any) => {
          if (item.dm_status in counts) {
            counts[item.dm_status as keyof typeof counts]++;
          }
        });
        setDmStatusStats(counts);
      }

      // 3. Fetch Campaigns Queue
      const { data: rawQueues, error: queueErr } = await supabase
        .from('dm_broadcast_queues' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!queueErr && rawQueues) {
        setCampaigns(rawQueues as CampaignQueue[]);
      }

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll active campaigns counts every 5 seconds for live progress
  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(() => {
      // Only refresh if we have active campaigns running
      const hasActive = campaigns.some(c => c.status === 'processing' || c.status === 'pending');
      if (hasActive) {
        fetchDashboardData();
        // If details are open, refresh logs too
        if (expandedCampaignId) {
          fetchCampaignLogs(expandedCampaignId);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns, expandedCampaignId, fetchDashboardData]);

  // Fetch logs for specific campaign (errors & status)
  const fetchCampaignLogs = async (queueId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('dm_broadcast_logs' as any)
        .select('*')
        .eq('queue_id', queueId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setCampaignLogs((data || []) as CampaignLog[]);
    } catch (e) {
      console.error('Error fetching campaign logs:', e);
      toast({ title: 'ผิดพลาด', description: 'ไม่สามารถดึงข้อมูลประวัติการส่งได้', variant: 'destructive' });
    } finally {
      setLoadingLogs(false);
    }
  };

  // Expand campaign details
  const handleToggleExpand = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setCampaignLogs([]);
    } else {
      setExpandedCampaignId(campaignId);
      fetchCampaignLogs(campaignId);
    }
  };

  // Cancel Campaign
  const handleCancelCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;
      
      toast({ title: 'ยกเลิกแคมเปญแล้ว', description: 'ระบบระงับคิวส่งบอร์ดแคสต์นี้เรียบร้อยแล้วค่ะ' });
      fetchDashboardData();
    } catch (e) {
      toast({ title: 'ผิดพลาด', description: 'ไม่สามารถยกเลิกแคมเปญได้', variant: 'destructive' });
    }
  };

  // Submit new Campaign
  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerTitle.trim()) {
      toast({ title: 'กรุณากรอกชื่อแคมเปญ', variant: 'destructive' });
      return;
    }

    let payload: any = {};
    if (inputMode === 'text') {
      if (!textContent.trim()) {
        toast({ title: 'กรุณากรอกข้อความ', variant: 'destructive' });
        return;
      }
      payload = { content: textContent };
    } else {
      try {
        payload = JSON.parse(jsonContent);
      } catch (err) {
        toast({ title: 'รูปแบบ JSON ไม่ถูกต้อง', description: 'กรุณาตรวจสอบวงเล็บหรือเครื่องหมายคำพูดคู่', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .insert({
          title: composerTitle,
          message_payload: payload,
          target_type: targetType,
          target_value: targetType === 'option' ? targetOption : null,
          token_type: tokenType,
          status: 'pending'
        });

      if (error) throw error;

      toast({ title: 'สร้างแคมเปญสำเร็จ', description: 'ระบบนำเข้าคิวเพื่อเตรียมส่งเรียบร้อยแล้วค่ะ' });
      setComposerTitle('');
      setTextContent('');
      fetchDashboardData();

    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message || 'ไม่สามารถส่งแคมเปญได้', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">รอดำเนินการ</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 animate-pulse">กำลังส่ง DMs</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">สำเร็จเสร็จสิ้น</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">ถูกยกเลิก</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total stats */}
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> สมาชิกที่รับแจ้งเตือนทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subStats.totalSubs}</div>
            <p className="text-xs text-muted-foreground mt-1">ยอดรวมสมาชิกที่เลือกช่องทางรับข่าวสาร</p>
          </CardContent>
        </Card>

        {/* Categories break downs */}
        <Card className="border-border/60 shadow-sm bg-card col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">สัดส่วนผู้รับข่าวสารแยกตามหัวข้อ</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">🎉 กิจกรรม</div>
              <div className="text-lg font-bold">{subStats.options['49B40A9yBS']} คน</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">📢 ประกาศสำคัญ</div>
              <div className="text-lg font-bold">{subStats.options['JNySCX80ja']} คน</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">📑 ข่าวสารทั่วไป</div>
              <div className="text-lg font-bold">{subStats.options['DsMHlVrjze']} คน</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">🎁 โปรโมชันและโฆษณา</div>
              <div className="text-lg font-bold">{subStats.options['6io1xnaMWJ']} คน</div>
            </div>
          </CardContent>
        </Card>

        {/* Reachability stats */}
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-500" /> สถานะช่องทางการส่ง DM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> เปิดรับ DM:</span>
              <span className="font-semibold">{dmStatusStats.open}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> ปิดรับ DM:</span>
              <span className="font-semibold">{dmStatusStats.closed}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ยังไม่ทดสอบ:</span>
              <span className="font-semibold">{dmStatusStats.unknown}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Composer and Campaigns list side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Campaign Composer */}
        <Card className="border-border/60 shadow-sm bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="w-5 h-5 text-primary" /> สร้างการส่งบรอดแคสต์ใหม่
            </CardTitle>
            <CardDescription>สร้างแคมเปญส่งข้อความ DM หาผู้ใช้งานที่กำหนดผ่านระบบ Queue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitCampaign} className="space-y-4">
              
              {/* Campaign Title */}
              <div className="space-y-1">
                <Label htmlFor="title" className="text-sm font-semibold">ชื่อแคมเปญ (อ้างอิงภายใน)</Label>
                <Input 
                  id="title"
                  placeholder="เช่น ประกันกิจกรรมกิลด์ 15 เม.ย."
                  value={composerTitle}
                  onChange={(e) => setComposerTitle(e.target.value)}
                  required
                />
              </div>

              {/* Target Audience Selector */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">กลุ่มเป้าหมายผู้รับสาร</Label>
                <Select value={targetType} onValueChange={(val: 'all' | 'option') => setTargetType(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option">แยกตามหมวดหมู่การติดตาม</SelectItem>
                    <SelectItem value="all">ส่งหาสมาชิกทุกคนในเซิร์ฟเวอร์ (ทั้งหมด)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Option Selector (Conditional) */}
              {targetType === 'option' && (
                <div className="space-y-1">
                  <Label htmlFor="option" className="text-sm font-semibold">หมวดหมู่ข่าวสาร</Label>
                  <Select value={targetOption} onValueChange={setTargetOption}>
                    <SelectTrigger id="option"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="49B40A9yBS">🎉 กิจกรรม</SelectItem>
                      <SelectItem value="JNySCX80ja">📢 ประกาศสำคัญ</SelectItem>
                      <SelectItem value="DsMHlVrjze">📑 ข่าวสารทั่วไป</SelectItem>
                      <SelectItem value="6io1xnaMWJ">🎁 โปรโมชันและโฆษณา</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Token Selector */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">บอทที่ใช้ส่งข้อความ (Credentials)</Label>
                <Select value={tokenType} onValueChange={(val: 'token1' | 'token2') => setTokenType(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token1">Token 1 (บอทหลัก - ดึงจาก Env บอท)</SelectItem>
                    <SelectItem value="token2">Token 2 (บอทสำรอง - SECONDARY_BOT_TOKEN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Input Mode Selector */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">รูปแบบเนื้อหาข้อความ</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant={inputMode === 'text' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={() => setInputMode('text')}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" /> ข้อความธรรมดา
                  </Button>
                  <Button 
                    type="button"
                    variant={inputMode === 'json' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={() => setInputMode('json')}
                  >
                    <Shield className="w-3.5 h-3.5 mr-1" /> Discord Component v2 (JSON)
                  </Button>
                </div>
              </div>

              {/* Content Box */}
              {inputMode === 'text' ? (
                <div className="space-y-1">
                  <Label htmlFor="textContent" className="text-sm font-semibold">ข้อความข่าวสาร</Label>
                  <Textarea 
                    id="textContent"
                    placeholder="พิมพ์ข่าวสารที่คุณต้องการส่งที่นี่..."
                    className="h-40 bg-background/50 rounded-xl"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="jsonContent" className="text-sm font-semibold">JSON Payload (Discord format)</Label>
                  <Textarea 
                    id="jsonContent"
                    placeholder="วาง JSON รูปแบบ Component v2 ที่นี่..."
                    className="h-48 font-mono text-xs bg-background/50 rounded-xl"
                    value={jsonContent}
                    onChange={(e) => setJsonContent(e.target.value)}
                  />
                </div>
              )}

              {/* Submit Campaign Button */}
              <Button type="submit" className="w-full rounded-xl gap-2 mt-2" disabled={submitting}>
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                นำส่งเข้าคิวออกอากาศ
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Right Side: Active & Past Campaigns */}
        <Card className="border-border/60 shadow-sm bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">ประวัติและสถานะการบรอดแคสต์</CardTitle>
            <CardDescription>แสดงรายการบรอดแคสต์ คิวการส่ง ข้อความ และแสดงความคืบหน้าแบบ Real-time</CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                ยังไม่มีการบรอดแคสต์ใดๆ ถูกสร้างขึ้น
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((c) => {
                  const percent = c.total_targets > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_targets) * 100) : 0;
                  const isExpanded = expandedCampaignId === c.id;

                  return (
                    <Card key={c.id} className="border border-border/40 overflow-hidden shadow-xs">
                      <CardContent className="p-4 space-y-3">
                        
                        {/* Queue Header info */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              {c.title}
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">{c.token_type === 'token2' ? 'บอทสำรอง' : 'บอทหลัก'}</Badge>
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              สร้างเมื่อ: {new Date(c.created_at).toLocaleString('th-TH')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(c.status)}
                            
                            {/* Cancel button if running */}
                            {(c.status === 'processing' || c.status === 'pending') && (
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="h-7 px-2.5 rounded-lg text-xs gap-1.5"
                                onClick={() => handleCancelCampaign(c.id)}
                              >
                                <Square className="w-3 h-3" /> ยกเลิกการส่ง
                              </Button>
                            )}

                            {/* Details toggle button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 rounded-lg text-xs gap-1"
                              onClick={() => handleToggleExpand(c.id)}
                            >
                              ประวัติ {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {/* Target Info */}
                        <div className="text-xs text-muted-foreground">
                          กลุ่มเป้าหมาย: {c.target_type === 'all' ? (
                            <strong className="text-foreground">สมาชิกทุกคน</strong>
                          ) : (
                            <span>หัวข้อ <strong className="text-foreground">
                              {c.target_value === '49B40A9yBS' && 'กิจกรรม'}
                              {c.target_value === 'JNySCX80ja' && 'ประกาศสำคัญ'}
                              {c.target_value === 'DsMHlVrjze' && 'ข่าวสารทั่วไป'}
                              {c.target_value === '6io1xnaMWJ' && 'โปรโมชันและโฆษณา'}
                            </strong></span>
                          )}
                        </div>

                        {/* Progress Bar (Only visible if processing or completed or cancelled) */}
                        {c.status !== 'pending' && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span>ความคืบหน้า: <strong>{c.sent_count + c.failed_count} / {c.total_targets} คน</strong> ({percent}%)</span>
                              <div className="flex gap-3">
                                <span className="text-emerald-500 font-medium">สำเร็จ: {c.sent_count}</span>
                                <span className="text-destructive font-medium">ล้มเหลว: {c.failed_count}</span>
                              </div>
                            </div>
                            <Progress value={percent} className="h-1.5 bg-muted" />
                          </div>
                        )}

                        {/* Detailed Logs area (Expanded) */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-border/40 space-y-2 animate-in fade-in duration-200">
                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" /> รายละเอียดผลลัพธ์การจัดส่ง (DMs Logs)
                            </h4>

                            {loadingLogs ? (
                              <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">กำลังดึงข้อมูล...</div>
                            ) : campaignLogs.length === 0 ? (
                              <div className="text-center py-4 text-xs text-muted-foreground">ไม่มีข้อมูลการส่งให้ตรวจสอบ</div>
                            ) : (
                              <div className="border border-border/30 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                                <Table>
                                  <TableHeader className="bg-muted/50">
                                    <TableRow className="h-8">
                                      <TableHead className="text-[10px] h-8 py-1">User ID</TableHead>
                                      <TableHead className="text-[10px] h-8 py-1">ชื่อบัญชี</TableHead>
                                      <TableHead className="text-[10px] h-8 py-1">ผลลัพธ์</TableHead>
                                      <TableHead className="text-[10px] h-8 py-1">รายละเอียดข้อผิดพลาด</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {campaignLogs.map((log) => (
                                      <TableRow key={log.id} className="h-8 text-xs">
                                        <TableCell className="font-mono text-[10px] py-1">{log.user_id}</TableCell>
                                        <TableCell className="py-1">{log.username || '-'}</TableCell>
                                        <TableCell className="py-1">
                                          {log.status === 'success' ? (
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] py-0 px-1">สำเร็จ</Badge>
                                          ) : log.status === 'failed' ? (
                                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] py-0 px-1">ล้มเหลว</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[9px] py-0 px-1">รอส่ง</Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-destructive text-[10px] py-1 max-w-[150px] truncate" title={log.error_message || ''}>
                                          {log.error_message || '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
