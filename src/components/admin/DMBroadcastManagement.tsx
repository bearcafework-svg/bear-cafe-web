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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Send, Users, Mail, AlertCircle, Play, Square, RefreshCw, XCircle, 
  CheckCircle, Shield, FileText, ChevronDown, ChevronUp,
  Search, Eye, Trash2, ChevronLeft, ChevronRight, Activity, Database, Sparkles
} from 'lucide-react';

interface CampaignQueue {
  id: string;
  title: string;
  message_payload: any;
  target_type: string;
  target_value: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'paused';
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

interface SystemLog {
  id: number;
  queue_id: string | null;
  level: string;
  message_th: string;
  created_at: string;
}

interface MemberSub {
  userId: string;
  username: string | null;
  discordUsername: string | null;
  options: string[];
  updatedAt: string;
}

interface DiscordPreviewProps {
  inputMode: 'text' | 'json';
  textContent: string;
  jsonContent: string;
}

function DiscordPreview({ inputMode, textContent, jsonContent }: DiscordPreviewProps) {
  let content = '';
  let mediaUrl: string | null = null;
  let textBlocks: string[] = [];
  let selectMenuOptions: any[] = [];
  let selectPlaceholder = '🐻︲เลือกการแจ้งเตือนที่ต้องการ';
  let parseError: string | null = null;

  if (inputMode === 'text') {
    content = textContent;
  } else {
    try {
      if (jsonContent.trim()) {
        const parsed = JSON.parse(jsonContent);
        if (parsed.content) content = parsed.content;

        const data = parsed.data || parsed;
        if (data.components) {
          data.components.forEach((row: any) => {
            if (row.type === 1) {
              row.components?.forEach((comp: any) => {
                if (comp.type === 3) {
                  selectMenuOptions = comp.options || [];
                  if (comp.placeholder) selectPlaceholder = comp.placeholder;
                }
              });
            } else if (row.type === 17) {
              row.components?.forEach((child: any) => {
                if (child.type === 12 && child.items) {
                  const mediaItem = child.items[0]?.media;
                  if (mediaItem?.url) {
                    mediaUrl = mediaItem.url;
                  }
                } else if (child.type === 10 && child.content) {
                  textBlocks.push(child.content);
                } else if (child.type === 1) {
                  child.components?.forEach((comp: any) => {
                    if (comp.type === 3) {
                      selectMenuOptions = comp.options || [];
                      if (comp.placeholder) selectPlaceholder = comp.placeholder;
                    }
                  });
                }
              });
            }
          });
        }
      }
    } catch (e: any) {
      parseError = e.message;
    }
  }

  const formatMarkdown = (text: string) => {
    if (!text) return '';
    let html = text;
    html = html.replace(/<a?:[a-zA-Z0-9_]+:(\d+)>/g, (match) => {
      const nameMatch = match.match(/:([a-zA-Z0-9_]+):/);
      return `:${nameMatch ? nameMatch[1] : 'emoji'}:`;
    });
    html = html.replace(/^##\s+(.*)$/gm, '<h3 class="text-sm font-bold text-white mt-1 mb-1">$1</h3>');
    html = html.replace(/^#\s+(.*)$/gm, '<h2 class="text-base font-bold text-white mt-1 mb-1">$1</h2>');
    html = html.replace(/^-#\s+(.*)$/gm, '<span class="text-[11px] text-zinc-400 block mt-0.5">$1</span>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#1e1f22] px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    html = html.replace(/\\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-sm text-[#dbdee1] leading-relaxed break-words whitespace-pre-wrap" />;
  };

  return (
    <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
        <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
          หน้าต่างแสดงตัวอย่าง (Discord Live Preview)
        </CardTitle>
        <CardDescription className="text-xs">แสดงตัวอย่างรูปแบบข้อความเสมือนบนแอปพลิเคชัน Discord</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-start p-4">
        {parseError ? (
          <div className="flex-1 min-h-[250px] border border-dashed border-red-300 bg-red-50/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm font-semibold text-red-500">รูปแบบ JSON ไม่ถูกต้อง</p>
            <p className="text-xs text-red-400 mt-1 font-mono">{parseError}</p>
          </div>
        ) : (
          <div className="bg-[#313338] rounded-2xl p-4 text-[#dbdee1] flex items-start gap-3 shadow-inner border border-zinc-700/50">
            <div className="w-10 h-10 rounded-full bg-[#5865f2] shrink-0 flex items-center justify-center font-bold text-white text-base shadow">
              🐻
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">Bear Cafe Bot</span>
                <Badge className="bg-[#5865f2] hover:bg-[#5865f2] text-[10px] h-4 px-1 rounded font-normal text-white">BOT</Badge>
                <span className="text-[11px] text-zinc-400">วันนี้ เวลา 00:00</span>
              </div>

              {content && formatMarkdown(content)}

              {mediaUrl && (
                <div className="rounded-xl overflow-hidden max-w-sm border border-zinc-700 mt-2">
                  <img src={mediaUrl} alt="Discord Attachment" className="w-full object-cover max-h-60" />
                </div>
              )}

              {textBlocks.length > 0 && textBlocks.map((txt, idx) => (
                <div key={idx} className="mt-2 text-sm">{formatMarkdown(txt)}</div>
              ))}

              {selectMenuOptions.length > 0 && (
                <div className="mt-3 bg-[#2b2d31] border border-zinc-700 rounded-xl p-2.5 space-y-1 max-w-md">
                  <div className="text-xs text-zinc-400 flex items-center justify-between font-medium">
                    <span>{selectPlaceholder}</span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DMBroadcastManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('composer');

  // Stats
  const [subStats, setSubStats] = useState({
    totalSubs: 0,
    options: {
      '49B40A9yBS': 0,
      'JNySCX80ja': 0,
      'DsMHlVrjze': 0,
      '6io1xnaMWJ': 0
    }
  });

  const [dmStatusStats, setDmStatusStats] = useState({
    open: 0,
    closed: 0,
    unknown: 0
  });

  // Campaigns list
  const [campaigns, setCampaigns] = useState<CampaignQueue[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  
  // Paginated Campaign Logs
  const [campaignLogs, setCampaignLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalCount, setLogsTotalCount] = useState(0);
  const logsPageSize = 20;

  // Paginated Member Subscriptions
  const [memberSubs, setMemberSubs] = useState<MemberSub[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<string>('all');
  const [memberPage, setMemberPage] = useState(1);
  const memberPageSize = 15;

  // System Logs & DB Cleaner
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState(false);

  // Composer Form
  const [composerTitle, setComposerTitle] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'option' | 'test'>('option');
  const [targetOption, setTargetOption] = useState('49B40A9yBS');
  const [testUserId, setTestUserId] = useState('');
  const [tokenType, setTokenType] = useState<'token1' | 'token2'>('token1');
  const [inputMode, setInputMode] = useState<'text' | 'json'>('text');
  const [textContent, setTextContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Safety & Deduplication Controls
  const [excludePreviousSuccess, setExcludePreviousSuccess] = useState(true);
  const [safetyMode, setSafetyMode] = useState<'safe' | 'balanced'>('safe');
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
            "type": 10,
            "content": "## <:bee20000:1256669436350562355>︲__\` 𝖭𝗈𝗍𝗂𝖿𝗂𝖼𝖺𝗍𝗂𝗈𝗇𝗌 ₊ เลือกการแจ้งเตือนที่ต้องการ 𓂃 \`__\\n-# เลือกรับการแจ้งเตือนเฉพาะหัวข้อที่คุณสนใจ เพื่อไม่ให้พลาดข่าวสารสำคัญ <:cuteplant:1152834055528783872>\\n"
          }
        ]
      }
    ]
  }
}`);

  // Fetch Subscribers List
  const fetchMemberSubscriptions = useCallback(async () => {
    try {
      setLoadingMembers(true);
      let rawSubs: any[] | null = null;
      
      const { data, error: subErr } = await supabase
        .from('dms_options' as any)
        .select('user_id, option_value, created_at');

      if (subErr) {
        console.warn('Fallback selecting dms_options without created_at:', subErr.message);
        const { data: fallbackData } = await supabase
          .from('dms_options' as any)
          .select('user_id, option_value');
        rawSubs = fallbackData || [];
      } else {
        rawSubs = data || [];
      }

      const grouped: { [userId: string]: { options: string[]; updatedAt: string } } = {};
      (rawSubs || []).forEach((row: any) => {
        if (!grouped[row.user_id]) {
          grouped[row.user_id] = { options: [], updatedAt: row.created_at || new Date().toISOString() };
        }
        grouped[row.user_id].options.push(row.option_value);
      });

      const uids = Object.keys(grouped);
      const profilesMap: { [userId: string]: { username: string | null; discord_username: string | null } } = {};

      if (uids.length > 0) {
        for (let i = 0; i < uids.length; i += 100) {
          const chunk = uids.slice(i, i + 100);
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('discord_id, username, discord_username')
              .in('discord_id', chunk);

            if (profiles) {
              profiles.forEach(p => {
                profilesMap[p.discord_id] = { username: p.username, discord_username: p.discord_username };
              });
            }
          } catch (pErr) {
            console.error('Error fetching profile chunk:', pErr);
          }
        }
      }

      const list = uids.map(uid => ({
        userId: uid,
        username: profilesMap[uid]?.username ?? null,
        discordUsername: profilesMap[uid]?.discord_username ?? null,
        options: grouped[uid].options,
        updatedAt: grouped[uid].updatedAt
      }));

      setMemberSubs(list);
    } catch (e) {
      console.error('Error fetching member subs:', e);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Fetch Thai System Logs
  const fetchSystemLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dm_broadcast_system_logs' as any)
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

      if (!error && data) {
        setSystemLogs(data as SystemLog[]);
      }
    } catch (e) {
      console.error('Error fetching system logs:', e);
    }
  }, []);

  // Fetch Dashboard Stats & Campaigns (Silent Update)
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Fetch Subscription Stats
      const { data: rawSubs } = await supabase
        .from('dms_options' as any)
        .select('user_id, option_value');

      if (rawSubs) {
        const counts = { '49B40A9yBS': 0, 'JNySCX80ja': 0, 'DsMHlVrjze': 0, '6io1xnaMWJ': 0 };
        const uniqueUsers = new Set<string>();
        rawSubs.forEach((item: any) => {
          if (item.user_id) uniqueUsers.add(item.user_id);
          if (item.option_value in counts) counts[item.option_value as keyof typeof counts]++;
        });
        setSubStats({ totalSubs: uniqueUsers.size, options: counts });
      }

      // 2. Fetch Reachability Stats
      const { data: rawStatuses } = await supabase
        .from('member_dm_status' as any)
        .select('dm_status');

      if (rawStatuses) {
        const counts = { open: 0, closed: 0, unknown: 0 };
        rawStatuses.forEach((item: any) => {
          if (item.dm_status in counts) counts[item.dm_status as keyof typeof counts]++;
        });
        setDmStatusStats(counts);
      }

      // 3. Fetch Campaigns Queue
      const { data: rawQueues } = await supabase
        .from('dm_broadcast_queues' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (rawQueues) {
        setCampaigns(rawQueues as CampaignQueue[]);
      }

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchDashboardData(false);
    fetchMemberSubscriptions();
    fetchSystemLogs();
  }, [fetchDashboardData, fetchMemberSubscriptions, fetchSystemLogs]);

  // Silent Auto-Refresh Polling (No UI flicker)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
      fetchSystemLogs();
      if (expandedCampaignId) {
        fetchCampaignLogs(expandedCampaignId, logsPage);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, expandedCampaignId, logsPage, fetchDashboardData, fetchSystemLogs]);

  // Fetch Paginated Logs for Campaign
  const fetchCampaignLogs = async (queueId: string, page = 1) => {
    setLoadingLogs(true);
    try {
      const from = (page - 1) * logsPageSize;
      const to = from + logsPageSize - 1;

      let query = supabase
        .from('dm_broadcast_logs' as any)
        .select('*', { count: 'exact' })
        .eq('queue_id', queueId);

      if (logSearchQuery.trim()) {
        query = query.or(`user_id.ilike."%${logSearchQuery}%",username.ilike."%${logSearchQuery}%"`);
      }

      const { data, count, error } = await query
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      setCampaignLogs((data || []) as CampaignLog[]);
      setLogsTotalCount(count || 0);
      setLogsPage(page);
    } catch (e) {
      console.error('Error fetching campaign logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggleExpand = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setCampaignLogs([]);
    } else {
      setExpandedCampaignId(campaignId);
      setLogsPage(1);
      fetchCampaignLogs(campaignId, 1);
    }
  };

  // Retry Failed Items Only
  const handleRetryFailedCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      const { error: logErr } = await supabase
        .from('dm_broadcast_logs' as any)
        .update({ status: 'pending', error_message: null, sent_at: null })
        .eq('queue_id', campaignId)
        .eq('status', 'failed');

      if (logErr) throw logErr;

      const { error: queueErr } = await supabase
        .from('dm_broadcast_queues' as any)
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (queueErr) throw queueErr;

      toast({ title: 'เริ่มส่งซ่อมรายการล้มเหลวเรียบร้อยแล้วค่ะ', description: 'ระบบเปลี่ยนรายการที่ล้มเหลวกลับเข้าสู่คิวส่งต่อทันที' });
      fetchDashboardData(true);
      if (expandedCampaignId === campaignId) fetchCampaignLogs(campaignId, 1);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
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
      toast({ title: 'ยกเลิกแคมเปญแล้วค่ะ' });
      fetchDashboardData(true);
    } catch (e) {
      toast({ title: 'ผิดพลาด', description: 'ไม่สามารถยกเลิกได้', variant: 'destructive' });
    }
  };

  // Clean Old Completed Logs (Tool for 88.4K records cleanup)
  const handleCleanOldLogs = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการล้าง Log แคมเปญเก่าที่ส่งเสร็จสิ้นแล้วเกิน 14 วัน? การดำเนินการนี้จะช่วยคืนพื้นที่ DB')) return;

    setCleaningLogs(true);
    try {
      const { data, error } = await supabase.rpc('clean_old_dm_broadcast_logs', { days_older: 14 });
      if (error) throw error;
      toast({ title: 'ล้าง Log เก่าสำเร็จแล้วค่ะ', description: `ทำการลบ Log ซากแคมเปญเก่าเรียบร้อยแล้วจำนวน ${data || 0} รายการ` });
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'ล้าง Log ไม่สำเร็จ', description: e.message || 'ไม่สามารถเรียกใช้ฟังก์ชั่นล้าง Log ได้', variant: 'destructive' });
    } finally {
      setCleaningLogs(false);
    }
  };

  // Clear System Logs UI
  const handleClearSystemLogs = async () => {
    try {
      const { error } = await supabase.from('dm_broadcast_system_logs' as any).delete().neq('id', 0);
      if (!error) {
        setSystemLogs([]);
        toast({ title: 'ล้างประวัติการทำงานสำเร็จค่ะ' });
      }
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาดในการล้าง log', variant: 'destructive' });
    }
  };

  // Submit New Campaign
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
        toast({ title: 'รูปแบบ JSON ไม่ถูกต้อง', variant: 'destructive' });
        return;
      }
    }

    if (targetType === 'test' && !testUserId.trim()) {
      toast({ title: 'กรุณากรอก Discord User ID สำหรับทดสอบ', variant: 'destructive' });
      return;
    }

    const optionsObj = {
      exclude_previous_success: excludePreviousSuccess,
      min_delay_sec: safetyMode === 'safe' ? 15 : 5,
      max_delay_sec: safetyMode === 'safe' ? 35 : 15,
      hourly_limit: safetyMode === 'safe' ? 50 : 100,
      consecutive_failure_limit: 5
    };

    payload = { ...payload, options: optionsObj };
    setSubmitting(true);

    let targetVal = null;
    if (targetType === 'option') {
      targetVal = targetOption;
    } else if (targetType === 'test') {
      targetVal = testUserId.split(',').map(s => s.trim()).filter(Boolean).join(',');
    }

    try {
      const { error } = await supabase
        .from('dm_broadcast_queues' as any)
        .insert({
          title: composerTitle,
          message_payload: payload,
          target_type: targetType,
          target_value: targetVal,
          token_type: tokenType,
          status: 'pending'
        });

      if (error) throw error;
      toast({ title: 'สร้างแคมเปญสำเร็จ', description: 'ระบบนำเข้าคิวเพื่อเตรียมส่งเรียบร้อยแล้วค่ะ' });
      setComposerTitle('');
      setTextContent('');
      setActiveTab('campaigns');
      fetchDashboardData(true);
    } catch (e: any) {
      toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (c: CampaignQueue) => {
    switch (c.status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold">รอเข้าคิว</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/40 animate-pulse font-bold">⏸️ พักส่งชั่วคราว</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse font-bold">📡 กำลังกระจายข่าวสาร...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">✓ สำเร็จเสร็จสิ้น</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold">ถูกยกเลิก</Badge>;
      default:
        return <Badge variant="secondary">{c.status}</Badge>;
    }
  };

  // Paginated Subscribers Filtering
  const filteredMemberSubs = memberSubs.filter(sub => {
    if (memberSearchQuery) {
      const matchUserId = sub.userId.toLowerCase().includes(memberSearchQuery.toLowerCase());
      const matchUsername = (sub.username ?? '').toLowerCase().includes(memberSearchQuery.toLowerCase());
      const matchDiscord = (sub.discordUsername ?? '').toLowerCase().includes(memberSearchQuery.toLowerCase());
      if (!matchUserId && !matchUsername && !matchDiscord) return false;
    }
    if (filterOption !== 'all') {
      if (!sub.options.includes(filterOption)) return false;
    }
    return true;
  });

  const totalMemberPages = Math.ceil(filteredMemberSubs.length / memberPageSize) || 1;
  const paginatedMembers = filteredMemberSubs.slice((memberPage - 1) * memberPageSize, memberPage * memberPageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border border-[#EAD8C8] dark:border-[#2D2520] p-5 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2.5">
            <Send className="w-6 h-6 text-primary" /> ระบบกระจายข่าวสารบอท DM (DM Broadcast)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            ส่งข้อความข่าวสารหาผู้ใช้งาน Discord แบบรายบุคคลผ่านระบบคิวพร้อมกลไกป้องกัน Spam & Quarantine
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            className={cn("rounded-xl text-xs gap-1.5 font-bold", autoRefresh && "bg-emerald-600 hover:bg-emerald-700 text-white")}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={cn("w-3.5 h-3.5", autoRefresh && "animate-spin")} />
            {autoRefresh ? 'Auto-Refresh (เปิด)' : 'Auto-Refresh (ปิด)'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs gap-1.5 border-[#EAD8C8] dark:border-[#2D2520]"
            onClick={() => fetchDashboardData(false)}
          >
            <RefreshCw className="w-3.5 h-3.5" /> ดึงข้อมูลสด
          </Button>
        </div>
      </div>

      {/* 1. Statistics Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#EAD8C8] dark:border-[#2D2520] shadow-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> สมาชิกที่สมัครรับข่าวสาร
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#4E3F30] dark:text-[#E8E1D9]">{subStats.totalSubs} คน</div>
            <p className="text-[11px] text-muted-foreground mt-1">ยอดผู้ใช้ที่เลือกช่องทางรับข่าวสาร</p>
          </CardContent>
        </Card>

        <Card className="border-[#EAD8C8] dark:border-[#2D2520] shadow-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] rounded-2xl col-span-1 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">สัดส่วนตามหมวดหมู่ข่าวสาร</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">🎉 กิจกรรม</span>
              <div className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9]">{subStats.options['49B40A9yBS']} คน</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">📢 ประกาศสำคัญ</span>
              <div className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9]">{subStats.options['JNySCX80ja']} คน</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">📑 ข่าวสารทั่วไป</span>
              <div className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9]">{subStats.options['DsMHlVrjze']} คน</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground">🎁 โปรโมชัน</span>
              <div className="text-base font-bold text-[#4E3F30] dark:text-[#E8E1D9]">{subStats.options['6io1xnaMWJ']} คน</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EAD8C8] dark:border-[#2D2520] shadow-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-500" /> สถานะช่องทาง DM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">เปิดรับ DM:</span>
              <span className="font-bold">{dmStatusStats.open}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400 font-medium">ปิดรับ DM:</span>
              <span className="font-bold">{dmStatusStats.closed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        <TabsList className="bg-[#FAF6F0] dark:bg-[#25201C] p-1.5 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] grid grid-cols-2 md:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="composer" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Send className="w-4 h-4 text-primary" /> 1. สร้างแคมเปญ
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Activity className="w-4 h-4 text-indigo-500" /> 2. ประวัติและสถานะคิว ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Users className="w-4 h-4 text-emerald-500" /> 3. ผู้รับข่าวสาร ({filteredMemberSubs.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1E1B18] data-[state=active]:shadow-xs">
            <Database className="w-4 h-4 text-amber-500" /> 4. บันทึกบอท & DB
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Composer & Live Preview */}
        <TabsContent value="composer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Col: Composer Form */}
            <div className="lg:col-span-7 flex flex-col">
              <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl flex-1 flex flex-col">
                <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> กรอกข้อมูลบรอดแคสต์
                  </CardTitle>
                  <CardDescription className="text-xs">ตั้งชื่อ เลือกกลุ่มเป้าหมาย ข้อความข่าวสาร และกำหนดระดับความปลอดภัย</CardDescription>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <form onSubmit={handleSubmitCampaign} className="space-y-4">
                    
                    {/* Campaign Title */}
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">ชื่อแคมเปญ (อ้างอิงภายใน)</Label>
                      <Input 
                        id="title"
                        placeholder="เช่น ประกาศกิจกรรมกิลด์ 15 เม.ย."
                        value={composerTitle}
                        onChange={(e) => setComposerTitle(e.target.value)}
                        required
                        className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-sm rounded-xl h-10"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Target Audience */}
                      <div className="space-y-1.5">
                        <Label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">กลุ่มเป้าหมายผู้รับสาร</Label>
                        <Select value={targetType} onValueChange={(val: 'all' | 'option' | 'test') => setTargetType(val)}>
                          <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-sm rounded-xl h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="option">🏷️ แยกตามหมวดหมู่ข่าวสาร</SelectItem>
                            <SelectItem value="all">👥 สมาชิกทุกคนในเซิร์ฟเวอร์</SelectItem>
                            <SelectItem value="test">🧪 ทดสอบเฉพาะบุคคล (ป้อน ID)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Option Category */}
                      {targetType === 'option' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">หมวดหมู่ข่าวสาร</Label>
                          <Select value={targetOption} onValueChange={setTargetOption}>
                            <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-sm rounded-xl h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="49B40A9yBS">🎉 กิจกรรม</SelectItem>
                              <SelectItem value="JNySCX80ja">📢 ประกาศสำคัญ</SelectItem>
                              <SelectItem value="DsMHlVrjze">📑 ข่าวสารทั่วไป</SelectItem>
                              <SelectItem value="6io1xnaMWJ">🎁 โปรโมชันและโฆษณา</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Bot Credentials */}
                      <div className="space-y-1.5">
                        <Label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">บอทที่ใช้ส่ง (Credentials)</Label>
                        <Select value={tokenType} onValueChange={(val: 'token1' | 'token2') => setTokenType(val)}>
                          <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-sm rounded-xl h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="token1">Token 1 (บอทหลัก)</SelectItem>
                            <SelectItem value="token2">Token 2 (บอทสำรอง)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Test User ID Input */}
                    {targetType === 'test' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="testUserId" className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">Discord User ID สำหรับทดสอบ</Label>
                        <Input 
                          id="testUserId"
                          placeholder="ป้อน Discord User ID (เช่น 944920660759707658)"
                          value={testUserId}
                          onChange={(e) => setTestUserId(e.target.value)}
                          required
                          className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-xs rounded-xl h-9"
                        />
                      </div>
                    )}

                    {/* Safety & Deduplication Options Box */}
                    <div className="p-4 bg-[#FAF6F0]/80 dark:bg-[#25201C]/80 rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="dedup" className="text-xs sm:text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2 cursor-pointer">
                          <Shield className="w-4 h-4 text-emerald-500" /> ข้ามคนที่เคยส่งสำเร็จแล้ว (กันส่งซ้ำ 100%)
                        </Label>
                        <input 
                          id="dedup"
                          type="checkbox"
                          checked={excludePreviousSuccess}
                          onChange={(e) => setExcludePreviousSuccess(e.target.checked)}
                          className="w-4 h-4 accent-[#8C6239] rounded cursor-pointer"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-[#827160]">ระดับความเร็วส่งและระยะหน่วง (Safety Velocity)</Label>
                        <Select value={safetyMode} onValueChange={(val: 'safe' | 'balanced') => setSafetyMode(val)}>
                          <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-xs rounded-xl h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="safe">🛡️ Safe Mode (สุ่มหน่วง 15-35 วิ | โควตา 50 ข้อความ/ชม.)</SelectItem>
                            <SelectItem value="balanced">⚡ Balanced Mode (สุ่มหน่วง 5-15 วิ | โควตา 100 ข้อความ/ชม.)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Format Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">รูปแบบเนื้อหาข้อความ</Label>
                      <div className="flex gap-2">
                        <Button 
                          type="button"
                          variant={inputMode === 'text' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-semibold"
                          onClick={() => setInputMode('text')}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" /> ข้อความธรรมดา (Markdown)
                        </Button>
                        <Button 
                          type="button"
                          variant={inputMode === 'json' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-semibold"
                          onClick={() => setInputMode('json')}
                        >
                          <Shield className="w-3.5 h-3.5 mr-1" /> Component JSON (Discohook)
                        </Button>
                      </div>
                    </div>

                    {/* Content Textarea */}
                    {inputMode === 'text' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="textContent" className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">ข้อความข่าวสาร</Label>
                        <Textarea 
                          id="textContent"
                          placeholder="พิมพ์ข่าวสารที่คุณต้องการส่งที่นี่..."
                          className="h-36 border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-sm rounded-xl"
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor="jsonContent" className="text-xs sm:text-sm font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">JSON Payload (Discord Component format)</Label>
                        <Textarea 
                          id="jsonContent"
                          placeholder="วาง JSON รูปแบบ Component v2 ที่นี่..."
                          className="h-36 font-mono text-xs border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] rounded-xl"
                          value={jsonContent}
                          onChange={(e) => setJsonContent(e.target.value)}
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full rounded-2xl h-11 gap-2 bg-[#8C6239] hover:bg-[#74502D] text-white font-bold text-sm shadow-sm" disabled={submitting}>
                      {submitting ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 text-white" />}
                      นำส่งเข้าคิวออกอากาศ
                    </Button>

                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Live Preview */}
            <div className="lg:col-span-5 flex flex-col">
              <DiscordPreview inputMode={inputMode} textContent={textContent} jsonContent={jsonContent} />
            </div>

          </div>
        </TabsContent>

        {/* TAB 2: Campaigns History & Paginated Logs */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520]">
              <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">รายการแคมเปญทั้งหมด ({campaigns.length})</CardTitle>
              <CardDescription className="text-xs">แสดงแคมเปญการส่งบรอดแคสต์และความคืบหน้าพร้อมการเรียกดู Log รายคนแบบแบ่งหน้า</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">ยังไม่มีแคมเปญบรอดแคสต์ใดๆ ถูกสร้างขึ้น</div>
              ) : (
                campaigns.map((c) => {
                  const percent = c.total_targets > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_targets) * 100) : 0;
                  const isExpanded = expandedCampaignId === c.id;
                  const totalLogPages = Math.ceil(logsTotalCount / logsPageSize) || 1;

                  return (
                    <Card key={c.id} className="border border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] rounded-2xl overflow-hidden shadow-xs">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="font-bold text-sm text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-2">
                              {c.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400">{c.token_type === 'token2' ? 'บอทสำรอง' : 'บอทหลัก'}</Badge>
                              <span>สร้างเมื่อ: {new Date(c.created_at).toLocaleString('th-TH')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(c)}
                            
                            {c.failed_count > 0 && c.status !== 'processing' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 font-bold" onClick={() => handleRetryFailedCampaign(c.id)}>
                                <RefreshCw className="w-3 h-3" /> ส่งซ่อม ({c.failed_count})
                              </Button>
                            )}

                            {(c.status === 'processing' || c.status === 'pending' || c.status === 'paused') && (
                              <Button size="sm" variant="destructive" className="h-7 text-xs font-bold gap-1" onClick={() => handleCancelCampaign(c.id)}>
                                <Square className="w-3 h-3 text-white" /> หยุดส่ง
                              </Button>
                            )}

                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#EAD8C8] dark:border-[#2D2520]" onClick={() => handleToggleExpand(c.id)}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {isExpanded ? 'ซ่อน Log' : 'ดู Log รายคน'}
                            </Button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 bg-[#FAF6F0]/60 dark:bg-[#25201C]/60 p-3 rounded-xl border border-[#F0E8DC] dark:border-[#2D2520]">
                          <div className="flex justify-between items-center text-xs text-[#8C6239] dark:text-[#EAD8C8]">
                            <span>ความคืบหน้า: <strong>{c.sent_count + c.failed_count} / {c.total_targets} คน</strong> ({percent}%)</span>
                            <div className="flex gap-3 font-semibold text-xs">
                              <span className="text-emerald-600 dark:text-emerald-400">สำเร็จ: {c.sent_count}</span>
                              <span className="text-rose-600 dark:text-rose-400">ล้มเหลว: {c.failed_count}</span>
                            </div>
                          </div>
                          <Progress value={percent} className="h-2 bg-muted [&>div]:bg-emerald-500" />
                        </div>

                        {/* Paginated Logs Area (Expanded) */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-border/40 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <h4 className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-muted-foreground" /> ผลการจัดส่งรายคน (หน้า {logsPage} / {totalLogPages})
                              </h4>
                              
                              <div className="relative w-full sm:w-60">
                                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  value={logSearchQuery}
                                  onChange={(e) => setLogSearchQuery(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && fetchCampaignLogs(c.id, 1)}
                                  placeholder="ค้นหา User ID หรือชื่อ..."
                                  className="pl-8 h-7 text-xs rounded-xl"
                                />
                              </div>
                            </div>

                            {loadingLogs ? (
                              <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">กำลังโหลดบันทึก...</div>
                            ) : campaignLogs.length === 0 ? (
                              <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl">ไม่พบรายการ Log</div>
                            ) : (
                              <div className="border border-[#EAD8C8] dark:border-[#2D2520] rounded-xl overflow-hidden bg-white dark:bg-[#1E1B18]">
                                <Table>
                                  <TableHeader className="bg-[#FAF6F0]/40 dark:bg-[#25201C]/40">
                                    <TableRow className="h-8">
                                      <TableHead className="text-xs font-bold">User ID</TableHead>
                                      <TableHead className="text-xs font-bold">ชื่อสมาชิก</TableHead>
                                      <TableHead className="text-xs font-bold">สถานะการส่ง</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {campaignLogs.map((log) => (
                                      <TableRow key={log.id} className="h-8 text-xs">
                                        <TableCell className="font-mono text-xs truncate max-w-[120px]">{log.user_id}</TableCell>
                                        <TableCell className="truncate max-w-[120px]">{log.username || '-'}</TableCell>
                                        <TableCell>
                                          {log.status === 'success' ? (
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">สำเร็จ</Badge>
                                          ) : log.status === 'failed' ? (
                                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]" title={log.error_message || ''}>
                                              ล้มเหลว ({log.error_message || 'Closed DM'})
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">รอส่ง</Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}

                            {/* Pagination Controls for Logs */}
                            <div className="flex justify-between items-center pt-2">
                              <span className="text-xs text-muted-foreground">รวมทั้งหมด {logsTotalCount} รายการ</span>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" disabled={logsPage <= 1} onClick={() => fetchCampaignLogs(c.id, logsPage - 1)}>
                                  <ChevronLeft className="w-3.5 h-3.5" /> ก่อนหน้า
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" disabled={logsPage >= totalLogPages} onClick={() => fetchCampaignLogs(c.id, logsPage + 1)}>
                                  ถัดไป <ChevronRight className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Subscribers List (Paginated) */}
        <TabsContent value="subscribers" className="space-y-6">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
            <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">รายชื่อสมาชิกผู้รับข่าวสาร ({filteredMemberSubs.length} คน)</CardTitle>
                <CardDescription className="text-xs">แสดงรายชื่อผู้ใช้งานที่เลือกสมัครรับแจ้งเตือนแยกตามหมวดหมู่</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-xs rounded-xl"
                    placeholder="ค้นหาชื่อ หรือ User ID..."
                    value={memberSearchQuery}
                    onChange={(e) => { setMemberSearchQuery(e.target.value); setMemberPage(1); }}
                  />
                </div>
                <Select value={filterOption} onValueChange={(val) => { setFilterOption(val); setMemberPage(1); }}>
                  <SelectTrigger className="w-36 h-9 text-xs rounded-xl"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="49B40A9yBS">🎉 กิจกรรม</SelectItem>
                    <SelectItem value="JNySCX80ja">📢 ประกาศสำคัญ</SelectItem>
                    <SelectItem value="DsMHlVrjze">📑 ข่าวสารทั่วไป</SelectItem>
                    <SelectItem value="6io1xnaMWJ">🎁 โปรโมชัน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {loadingMembers ? (
                <div className="text-center py-12 text-muted-foreground animate-pulse text-xs">กำลังโหลดรายชื่อสมาชิก...</div>
              ) : paginatedMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs border border-dashed rounded-2xl">ไม่พบรายชื่อสมาชิกที่ค้นหา</div>
              ) : (
                <div className="border border-[#EAD8C8] dark:border-[#2D2520] rounded-2xl overflow-hidden bg-white dark:bg-[#1E1B18]">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]/50 dark:bg-[#25201C]/50">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">สมาชิก</TableHead>
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">หมวดหมู่ที่ติดตาม</TableHead>
                        <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8]">ลงทะเบียนเมื่อ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMembers.map((sub) => (
                        <TableRow key={sub.userId} className="text-xs">
                          <TableCell className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                                {sub.username ? `@${sub.username}` : (sub.discordUsername ? `@${sub.discordUsername}` : 'Unknown Member')}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">{sub.userId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {sub.options.map((opt) => (
                                <Badge key={opt} variant="outline" className="text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                  {opt === '49B40A9yBS' && '🎉 กิจกรรม'}
                                  {opt === 'JNySCX80ja' && '📢 ประกาศสำคัญ'}
                                  {opt === 'DsMHlVrjze' && '📑 ข่าวสารทั่วไป'}
                                  {opt === '6io1xnaMWJ' && '🎁 โปรโมชัน'}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                            {new Date(sub.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">หน้า {memberPage} จาก {totalMemberPages} (รวม {filteredMemberSubs.length} รายการ)</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl" disabled={memberPage <= 1} onClick={() => setMemberPage(m => m - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" /> ก่อนหน้า
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl" disabled={memberPage >= totalMemberPages} onClick={() => setMemberPage(m => m + 1)}>
                    ถัดไป <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Live Bot Logs & DB Cleanup Tool */}
        <TabsContent value="logs" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            
            {/* DB Log Cleanup Tool */}
            <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl">
              <CardHeader className="pb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-500" /> เครื่องมือจัดการพื้นที่ฐานข้อมูล (Database Log Cleaner)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    ล้างซาก Log แคมเปญเก่าที่ส่งเสร็จสิ้นแล้วเพื่อคืนสปีดและความเบาให้ฐานข้อมูล Supabase
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl text-xs gap-1.5 font-bold"
                  onClick={handleCleanOldLogs}
                  disabled={cleaningLogs}
                >
                  {cleaningLogs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  🗑️ ล้าง Log แคมเปญเก่า (เก่ากว่า 14 วัน)
                </Button>
              </CardHeader>
            </Card>

            {/* Thai Live Console Logs */}
            <Card className="border-[#EAD8C8] bg-[#1E1B18] text-[#EAD8C8] shadow-md rounded-3xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-[#2D2520] flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    📟 บันทึกการทำงานระบบบอทภาษาไทย (Live Bot Status Logs)
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    แสดงสถานะการทำงานสดจากบอทเป็นภาษาไทยแบบ Real-time (เก็บบันทึกล่าสุดไม่เกิน 500 แถว)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-[#2D2520] bg-[#25201C] text-zinc-300" onClick={fetchSystemLogs}>
                    <RefreshCw className="w-3 h-3 mr-1" /> รีเฟรช
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-400 hover:bg-rose-950/30" onClick={handleClearSystemLogs}>
                    ล้างหน้าจอ
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-1.5 scrollbar-thin">
                {systemLogs.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs italic">
                    ยังไม่มีบันทึกสถานะจากบอท (บอทจะส่งรายงานสถานะภาษาไทยมาที่นี่เมื่อเริ่มทำงาน)
                  </div>
                ) : (
                  systemLogs.map((log) => {
                    const colorClass =
                      log.level === 'error' ? 'text-rose-400 bg-rose-950/20 p-1 rounded border border-rose-900/30 font-bold' :
                      log.level === 'warn' ? 'text-amber-300' :
                      log.level === 'success' ? 'text-emerald-400 font-bold' :
                      'text-zinc-300';

                    return (
                      <div key={log.id} className={cn("leading-relaxed flex items-start gap-2", colorClass)}>
                        <span className="select-none text-zinc-500 shrink-0 text-[10px]">
                          {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span>{log.message_th}</span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
