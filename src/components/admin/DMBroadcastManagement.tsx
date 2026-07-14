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
import { cn } from '@/lib/utils';
import { 
  Send, Users, Mail, AlertCircle, Play, Square, RefreshCw, XCircle, 
  CheckCircle, Shield, FileText, CheckCircle2, ChevronDown, ChevronUp,
  MessageSquare, Eye, Search
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
  let embeds: any[] = [];
  let buttons: any[] = [];

  if (inputMode === 'text') {
    content = textContent;
  } else {
    try {
      if (jsonContent.trim()) {
        const parsed = JSON.parse(jsonContent);
        // Discord Webhook standard format
        if (parsed.content) content = parsed.content;
        if (parsed.embeds) embeds = parsed.embeds;

        // Custom Component v2 format
        const data = parsed.data || parsed;
        if (data.components) {
          data.components.forEach((row: any) => {
            if (row.type === 1) {
              row.components?.forEach((comp: any) => {
                if (comp.type === 2) {
                  buttons.push(comp);
                } else if (comp.type === 3) {
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
                    if (comp.type === 2) {
                      buttons.push(comp);
                    } else if (comp.type === 3) {
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

  // Simple formatter for Discord markdown (bold, subtext, headers, emojis)
  const formatMarkdown = (text: string) => {
    if (!text) return '';
    let html = text;
    // Remove custom emojis syntax <:name:id>
    html = html.replace(/<a?:[a-zA-Z0-9_]+:(\d+)>/g, (match) => {
      const nameMatch = match.match(/:([a-zA-Z0-9_]+):/);
      const name = nameMatch ? nameMatch[1] : 'emoji';
      return `:${name}:`;
    });
    // Replace headers
    html = html.replace(/^##\s+(.*)$/gm, '<h3 class="text-sm font-bold text-white mt-1 mb-1">$1</h3>');
    html = html.replace(/^#\s+(.*)$/gm, '<h2 class="text-base font-bold text-white mt-1 mb-1">$1</h2>');
    // Replace subtext
    html = html.replace(/^-#\s+(.*)$/gm, '<span class="text-[10px] text-zinc-400 block mt-0.5">$1</span>');
    // Replace bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace underline
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    // Replace inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#1e1f22] px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
    // Replace newline
    html = html.replace(/\\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-xs sm:text-sm text-[#dbdee1] leading-relaxed break-words whitespace-pre-wrap" />;
  };

  return (
    <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-500 shrink-0" />
          หน้าต่างพรีวิว (Discohook Style)
        </CardTitle>
        <CardDescription className="text-[10px]">แสดงตัวอย่างจำลองบนระบบแชท Discord</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-start py-2">
        {parseError ? (
          <div className="flex-1 min-h-[220px] border border-dashed border-red-300 bg-red-50/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <XCircle className="w-8 h-8 text-red-500 mb-2 shrink-0" />
            <p className="text-xs font-bold text-red-500">รูปแบบ JSON ไม่ถูกต้อง</p>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] font-mono leading-tight break-all">{parseError}</p>
          </div>
        ) : !content && !mediaUrl && textBlocks.length === 0 && embeds.length === 0 ? (
          <div className="flex-1 min-h-[220px] border border-dashed border-[#EAD8C8] dark:border-[#2D2520] rounded-2xl p-4 flex flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 opacity-40 mb-2 shrink-0" />
            <p className="text-xs">พิมพ์ข้อความหรือวาง JSON เพื่อดูพรีวิว</p>
          </div>
        ) : (
          <div className="bg-[#313338] text-[#dbdee1] rounded-2xl p-3 border border-[#1e1f22] text-left font-sans flex items-start gap-3 shadow-md max-w-full overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center shrink-0 text-white font-bold select-none text-xs">
              🐻
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1 leading-none">
                <span className="font-semibold text-white text-xs hover:underline cursor-pointer">Bearcafe Bot</span>
                <span className="bg-[#5865f2] text-white text-[8px] font-bold px-0.5 py-0.2 rounded leading-none shrink-0">BOT</span>
                <span className="text-[9px] text-zinc-400 font-medium ml-1 shrink-0">วันนี้ 12:00</span>
              </div>
              
              {content && formatMarkdown(content)}

              {textBlocks.map((block, idx) => (
                <div key={idx} className="space-y-1">
                  {formatMarkdown(block)}
                </div>
              ))}

              {mediaUrl && (
                <div className="mt-1 rounded-lg overflow-hidden border border-zinc-700 max-w-xs select-none shrink-0">
                  <img src={mediaUrl} alt="attachment" className="w-full h-auto object-cover max-h-48" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
              )}

              {embeds.map((emb, idx) => {
                const embedColor = emb.color 
                  ? `#${Number(emb.color).toString(16).padStart(6, '0')}`
                  : '#1e1f22';
                return (
                  <div 
                    key={idx} 
                    className="mt-1 bg-[#2b2d31] rounded border-l-4 p-2.5 max-w-md space-y-1"
                    style={{ borderLeftColor: embedColor }}
                  >
                    {emb.title && <h4 className="font-bold text-xs text-white">{emb.title}</h4>}
                    {emb.description && <div className="text-[11px] text-[#dbdee1] leading-normal whitespace-pre-wrap">{emb.description}</div>}
                    {emb.image?.url && (
                      <div className="mt-1.5 rounded overflow-hidden select-none">
                        <img src={emb.image.url} alt="embed" className="w-full h-auto object-cover max-h-36" />
                      </div>
                    )}
                  </div>
                );
              })}

              {selectMenuOptions.length > 0 && (
                <div className="mt-2 max-w-xs shrink-0">
                  <div className="bg-[#1e1f22] border border-[#2b2d31] rounded px-2 py-1.5 text-[10px] flex items-center justify-between cursor-pointer select-none">
                    <span className="text-zinc-400 font-medium truncate mr-2">{selectPlaceholder}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </div>
                </div>
              )}

              {buttons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-xs shrink-0">
                  {buttons.map((btn, idx) => {
                    const btnStyle = 
                      btn.style === 1 ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white border-0' :
                      btn.style === 3 ? 'bg-[#248046] hover:bg-[#1a6535] text-white border-0' :
                      btn.style === 4 ? 'bg-[#da373c] hover:bg-[#a92b2f] text-white border-0' :
                      'bg-[#4e5058] hover:bg-[#6d6f78] text-white border-0';
                    return (
                      <button 
                        key={idx} 
                        type="button" 
                        className={cn("px-2 py-1 rounded text-[10px] font-semibold select-none flex items-center gap-1 transition-colors leading-tight cursor-default", btnStyle)}
                      >
                        {btn.emoji?.name && <span>{btn.emoji.name}</span>}
                        {btn.label && <span>{btn.label}</span>}
                      </button>
                    );
                  })}
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

  // Member subscriptions list states
  const [memberSubs, setMemberSubs] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<string>('all');

  const fetchMemberSubscriptions = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data: optionsData, error: optionsErr } = await supabase
        .from('dms_options' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (optionsErr) throw optionsErr;
      if (!optionsData) return;

      // Group options by user_id
      const grouped: Record<string, { userId: string; options: string[]; updatedAt: string }> = {};
      optionsData.forEach((item: any) => {
        const uid = item.user_id;
        if (!uid) return;
        if (!grouped[uid]) {
          grouped[uid] = {
            userId: uid,
            options: [],
            updatedAt: item.created_at
          };
        }
        if (!grouped[uid].options.includes(item.option_value)) {
          grouped[uid].options.push(item.option_value);
        }
        if (new Date(item.created_at) > new Date(grouped[uid].updatedAt)) {
          grouped[uid].updatedAt = item.created_at;
        }
      });

      const uniqueUids = Object.keys(grouped);

      // Fetch profiles mapping
      const profilesMap: Record<string, { username: string; discord_username: string | null }> = {};
      if (uniqueUids.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < uniqueUids.length; i += chunkSize) {
          const chunk = uniqueUids.slice(i, i + chunkSize);
          const { data: profilesData, error: profilesErr } = await (supabase as any)
            .from('profiles')
            .select('discord_id, username, discord_username')
            .in('discord_id', chunk);

          if (!profilesErr && profilesData) {
            profilesData.forEach((p: any) => {
              profilesMap[p.discord_id] = {
                username: p.username,
                discord_username: p.discord_username ?? null
              };
            });
          }
        }
      }

      // Map results
      const list = uniqueUids.map(uid => {
        const profile = profilesMap[uid];
        return {
          userId: uid,
          username: profile?.username ?? null,
          discordUsername: profile?.discord_username ?? null,
          options: grouped[uid].options,
          updatedAt: grouped[uid].updatedAt
        };
      });

      setMemberSubs(list);
    } catch (e) {
      console.error('Error fetching member subscriptions:', e);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Fetch all stats and campaigns list
  const fetchDashboardData = useCallback(async () => {
    try {
      fetchMemberSubscriptions();
      // 1. Fetch Subscription Stats
      const { data: rawSubs, error: subErr } = await supabase
        .from('dms_options' as any)
        .select('user_id, option_value');

      if (!subErr && rawSubs) {
        const counts = {
          '49B40A9yBS': 0,
          'JNySCX80ja': 0,
          'DsMHlVrjze': 0,
          '6io1xnaMWJ': 0
        };
        const uniqueUsers = new Set<string>();
        rawSubs.forEach((item: any) => {
          if (item.user_id) {
            uniqueUsers.add(item.user_id);
          }
          if (item.option_value in counts) {
            counts[item.option_value as keyof typeof counts]++;
          }
        });
        setSubStats({
          totalSubs: uniqueUsers.size,
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

  // 1. Initial fetch on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // 2. Poll active campaigns counts every 5 seconds for live progress
  useEffect(() => {
    const hasActive = campaigns.some(c => c.status === 'processing' || c.status === 'pending');
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchDashboardData();
      if (expandedCampaignId) {
        fetchCampaignLogs(expandedCampaignId);
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

  const filteredMemberSubs = memberSubs.filter(sub => {
    if (searchQuery) {
      const matchUserId = sub.userId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchUsername = (sub.username ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDiscord = (sub.discordUsername ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchUserId && !matchUsername && !matchDiscord) return false;
    }
    if (filterOption !== 'all') {
      if (!sub.options.includes(filterOption)) return false;
    }
    return true;
  });

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

      {/* 2. Composer, Preview, and Campaigns list side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Campaign Composer */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-[#8C6239] dark:text-[#EAD8C8] font-bold">
                <Send className="w-5 h-5 text-primary" /> สร้างการส่งบรอดแคสต์
              </CardTitle>
              <CardDescription className="text-xs">สร้างแคมเปญส่งข้อความ DM หาผู้ใช้งานที่กำหนดผ่านระบบ Queue</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between py-2">
              <form onSubmit={handleSubmitCampaign} className="space-y-4">
                
                {/* Campaign Title */}
                <div className="space-y-1">
                  <Label htmlFor="title" className="text-xs font-semibold text-[#827160]">ชื่อแคมเปญ (อ้างอิงภายใน)</Label>
                  <Input 
                    id="title"
                    placeholder="เช่น ประกันกิจกรรมกิลด์ 15 เม.ย."
                    value={composerTitle}
                    onChange={(e) => setComposerTitle(e.target.value)}
                    required
                    className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus-visible:ring-[#FAC4CD] h-9"
                  />
                </div>

                {/* Target Audience Selector */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#827160]">กลุ่มเป้าหมายผู้รับสาร</Label>
                  <Select value={targetType} onValueChange={(val: 'all' | 'option') => setTargetType(val)}>
                    <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus:ring-[#FAC4CD] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option">แยกตามหมวดหมู่การติดตาม</SelectItem>
                      <SelectItem value="all">ส่งหาสมาชิกทุกคน (ทั้งหมด)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Option Selector (Conditional) */}
                {targetType === 'option' && (
                  <div className="space-y-1">
                    <Label htmlFor="option" className="text-xs font-semibold text-[#827160]">หมวดหมู่ข่าวสาร</Label>
                    <Select value={targetOption} onValueChange={setTargetOption}>
                      <SelectTrigger id="option" className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus:ring-[#FAC4CD] h-9"><SelectValue /></SelectTrigger>
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
                  <Label className="text-xs font-semibold text-[#827160]">บอทที่ใช้ส่งข้อความ (Credentials)</Label>
                  <Select value={tokenType} onValueChange={(val: 'token1' | 'token2') => setTokenType(val)}>
                    <SelectTrigger className="border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus:ring-[#FAC4CD] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="token1">Token 1 (บอทหลัก)</SelectItem>
                      <SelectItem value="token2">Token 2 (บอทสำรอง)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Input Mode Selector */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#827160]">รูปแบบเนื้อหาข้อความ</Label>
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
                      <Shield className="w-3.5 h-3.5 mr-1" /> Component JSON
                    </Button>
                  </div>
                </div>

                {/* Content Box */}
                {inputMode === 'text' ? (
                  <div className="space-y-1">
                    <Label htmlFor="textContent" className="text-xs font-semibold text-[#827160]">ข้อความข่าวสาร</Label>
                    <Textarea 
                      id="textContent"
                      placeholder="พิมพ์ข่าวสารที่คุณต้องการส่งที่นี่..."
                      className="h-32 border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus-visible:ring-[#FAC4CD] text-xs"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="jsonContent" className="text-xs font-semibold text-[#827160]">JSON Payload (Discord format)</Label>
                    <Textarea 
                      id="jsonContent"
                      placeholder="วาง JSON รูปแบบ Component v2 ที่นี่..."
                      className="h-32 font-mono text-[10px] border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus-visible:ring-[#FAC4CD]"
                      value={jsonContent}
                      onChange={(e) => setJsonContent(e.target.value)}
                    />
                  </div>
                )}

                {/* Submit Campaign Button */}
                <Button type="submit" className="w-full rounded-xl gap-2 mt-2 bg-[#8C6239] hover:bg-[#74502D] text-white" disabled={submitting}>
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 text-white" />}
                  นำส่งเข้าคิวออกอากาศ
                </Button>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Discord Preview */}
        <div className="lg:col-span-4 flex flex-col">
          <DiscordPreview 
            inputMode={inputMode} 
            textContent={textContent} 
            jsonContent={jsonContent} 
          />
        </div>

        {/* Right Column: Active & Past Campaigns */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#8C6239] dark:text-[#EAD8C8] font-bold">ประวัติและสถานะการบรอดแคสต์</CardTitle>
              <CardDescription className="text-xs">แสดงรายการคิวการส่งและแสดงความคืบหน้าแบบ Real-time</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-y-auto max-h-[600px] py-2 pr-1.5 scrollbar-thin">
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  ยังไม่มีการบรอดแคสต์ใดๆ ถูกสร้างขึ้น
                </div>
              ) : (
                <div className="space-y-3.5">
                  {campaigns.map((c) => {
                    const percent = c.total_targets > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_targets) * 100) : 0;
                    const isExpanded = expandedCampaignId === c.id;

                    return (
                      <Card key={c.id} className="border border-[#EAD8C8] dark:border-[#2D2520] overflow-hidden shadow-xs bg-white dark:bg-[#1E1B18]">
                        <CardContent className="p-3.5 space-y-2.5">
                          
                          {/* Queue Header info */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="space-y-0.5">
                              <h3 className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                                {c.title}
                                <Badge variant="outline" className="text-[9px] py-0 px-1 border-[#EAD8C8]">{c.token_type === 'token2' ? 'บอทสำรอง' : 'บอทหลัก'}</Badge>
                              </h3>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(c.status)}
                              
                              {/* Cancel button if running */}
                              {(c.status === 'processing' || c.status === 'pending') && (
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="h-6.5 px-2 rounded-lg text-[10px] gap-1 shrink-0"
                                  onClick={() => handleCancelCampaign(c.id)}
                                >
                                  <Square className="w-2.5 h-2.5" /> หยุดส่ง
                                </Button>
                              )}

                              {/* Details toggle button */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6.5 px-2 rounded-lg text-[10px] gap-1 shrink-0 border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18]"
                                onClick={() => handleToggleExpand(c.id)}
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>

                          {/* Target Info */}
                          <div className="text-[11px] text-muted-foreground">
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
                              <div className="flex justify-between items-center text-[10px]">
                                <span>ความคืบหน้า: <strong>{c.sent_count + c.failed_count} / {c.total_targets} คน</strong> ({percent}%)</span>
                                <div className="flex gap-2">
                                  <span className="text-emerald-500 font-medium">สำเร็จ: {c.sent_count}</span>
                                  <span className="text-destructive font-medium">ล้มเหลว: {c.failed_count}</span>
                                </div>
                              </div>
                              <Progress value={percent} className="h-1 bg-muted" />
                            </div>
                          )}

                          {/* Detailed Logs area (Expanded) */}
                          {isExpanded && (
                            <div className="pt-2.5 border-t border-border/40 space-y-1.5 animate-in fade-in duration-200">
                              <h4 className="text-[10px] font-semibold text-foreground flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3 text-muted-foreground" /> รายละเอียดการจัดส่ง (DMs Logs)
                              </h4>

                              {loadingLogs ? (
                                <div className="text-center py-4 text-[10px] text-muted-foreground animate-pulse">กำลังดึงข้อมูล...</div>
                              ) : campaignLogs.length === 0 ? (
                                <div className="text-center py-4 text-[10px] text-muted-foreground">ไม่มีข้อมูลการส่งให้ตรวจสอบ</div>
                              ) : (
                                <div className="border border-border/30 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                  <Table>
                                    <TableHeader className="bg-muted/50">
                                      <TableRow className="h-7">
                                        <TableHead className="text-[9px] h-7 py-0.5 px-2">User ID</TableHead>
                                        <TableHead className="text-[9px] h-7 py-0.5 px-2">ชื่อ</TableHead>
                                        <TableHead className="text-[9px] h-7 py-0.5 px-2">ผลลัพธ์</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {campaignLogs.map((log) => (
                                        <TableRow key={log.id} className="h-7 text-[10px]">
                                          <TableCell className="font-mono text-[9px] py-0.5 px-2 max-w-[80px] truncate" title={log.user_id}>{log.user_id}</TableCell>
                                          <TableCell className="py-0.5 px-2 truncate max-w-[80px]" title={log.username || ''}>{log.username || '-'}</TableCell>
                                          <TableCell className="py-0.5 px-2">
                                            {log.status === 'success' ? (
                                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] py-0 px-1 leading-none">สำเร็จ</Badge>
                                            ) : log.status === 'failed' ? (
                                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[8px] py-0 px-1 leading-none" title={log.error_message || ''}>ล้มเหลว</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-[8px] py-0 px-1 leading-none">รอ</Badge>
                                            )}
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

      {/* 3. Member Subscriptions Directory */}
      <Card className="border-[#EAD8C8] bg-[#FDFBF7] dark:bg-[hsl(var(--card))] dark:border-[#2D2520] shadow-sm rounded-3xl overflow-hidden mt-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-lg text-[#8C6239] dark:text-[#EAD8C8] font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                รายชื่อสมาชิกและสิทธิ์การรับข่าวสาร
              </CardTitle>
              <CardDescription className="text-xs">แสดงรายการผู้ใช้ที่ยินยอมรับข่าวสารแยกตามหมวดหมู่</CardDescription>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:w-60">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 text-xs border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl focus-visible:ring-[#FAC4CD]"
                  placeholder="ค้นหาผู้ใช้ หรือ Member ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterOption} onValueChange={setFilterOption}>
                <SelectTrigger className="w-40 border-[#EAD8C8] dark:border-[#2D2520] bg-white dark:bg-[#1E1B18] text-[#6B5A4B] dark:text-foreground rounded-xl h-9 focus:ring-[#FAC4CD]">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="49B40A9yBS">🎉 กิจกรรม</SelectItem>
                  <SelectItem value="JNySCX80ja">📢 ประกาศสำคัญ</SelectItem>
                  <SelectItem value="DsMHlVrjze">📑 ข่าวสารทั่วไป</SelectItem>
                  <SelectItem value="6io1xnaMWJ">🎁 โปรโมชันและโฆษณา</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {loadingMembers ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse text-xs">กำลังโหลดรายชื่อสมาชิก...</div>
          ) : filteredMemberSubs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-[#EAD8C8] dark:border-[#2D2520] rounded-2xl bg-[#FAF6F0]/20 dark:bg-muted/5">
              ไม่พบรายชื่อสมาชิกที่ค้นหา
            </div>
          ) : (
            <div className="border border-[#EAD8C8] dark:border-[#2D2520] rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-[#1E1B18]">
              <Table>
                <TableHeader className="bg-[#FAF6F0]/50 dark:bg-[#25201C]/50">
                  <TableRow className="border-b border-[#EAD8C8] dark:border-[#2D2520]">
                    <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] py-3.5 px-4">สมาชิก</TableHead>
                    <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] py-3.5 px-4">หัวข้อข่าวสารที่ติดตาม</TableHead>
                    <TableHead className="text-xs font-bold text-[#8C6239] dark:text-[#EAD8C8] py-3.5 px-4">ลงทะเบียนล่าสุด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMemberSubs.map((sub) => (
                    <TableRow key={sub.userId} className="border-b border-[#EAD8C8]/60 dark:border-[#2D2520]/60 hover:bg-[#FAF6F0]/20 dark:hover:bg-[#25201C]/20 transition-colors text-xs sm:text-sm">
                      <TableCell className="py-3 px-4 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[#4E3F30] dark:text-[#E8E1D9]">
                            {sub.username ? `@${sub.username}` : (sub.discordUsername ? `@${sub.discordUsername}` : 'Unknown Member')}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">{sub.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {sub.options.map((opt: string) => {
                            let label = '';
                            let badgeStyle = '';
                            if (opt === '49B40A9yBS') {
                              label = '🎉 กิจกรรม';
                              badgeStyle = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
                            } else if (opt === 'JNySCX80ja') {
                              label = '📢 ประกาศสำคัญ';
                              badgeStyle = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
                            } else if (opt === 'DsMHlVrjze') {
                              label = '📑 ข่าวสารทั่วไป';
                              badgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
                            } else if (opt === '6io1xnaMWJ') {
                              label = '🎁 โปรโมชันและโฆษณา';
                              badgeStyle = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
                            }
                            return (
                              <Badge key={opt} variant="outline" className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border", badgeStyle)}>
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(sub.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
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
  );
}
