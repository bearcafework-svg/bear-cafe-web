import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Heart, Send, Loader2, Sparkles, Pencil, Trash2,
  Users, MessageCircle, Mic, Shield, ExternalLink, UserX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { TurnstileWidget, TurnstileHandle } from '@/components/security/TurnstileWidget';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MIN_LEN = 10;
const MAX_LEN = 100;

type HealingMessageStatus = 'pending' | 'approved' | 'rejected';

interface HealingMessageRow {
  id: string;
  message: string;
  status: HealingMessageStatus;
  author_id: string;
  created_at: string;
  profiles?: {
    username: string;
    discord_username: string | null;
    avatar_url: string | null;
    discord_id: string;
  } | null;
}

export default function HealingMessagePage() {
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Auth / Login Overlay States
  const [isLoginClicked, setIsLoginClicked] = useState(false);
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const discordInviteLink = import.meta.env.VITE_DISCORD_INVITE_LINK || 'https://discord.gg/bearcafe';
  const isNotMember = searchParams.get('error') === 'not_member';

  // Compose State
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messages, setMessages] = useState<HealingMessageRow[]>([]);

  // Edit State
  const [editTarget, setEditTarget] = useState<HealingMessageRow | null>(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<HealingMessageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const len = message.trim().length;
  const isValid = len >= MIN_LEN && len <= MAX_LEN;
  const remaining = MAX_LEN - message.length;

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('healing_messages')
        .select(`
          id,
          message,
          status,
          author_id,
          created_at,
          profiles:author_id (
            username,
            discord_username,
            avatar_url,
            discord_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages((data || []) as unknown as HealingMessageRow[]);
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast({ title: 'โหลดข้อความล้มเหลว', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Enforce redirection to this page upon successful login
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem('redirect_after_login', '/healing-message');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (isLoginClicked) return;
    setIsLoginClicked(true);
    try {
      let token = 'TURNSTILE_BYPASS_DEV';
      if (siteKey && turnstileRef.current?.isReady()) {
        try {
          const turnstileToken = await turnstileRef.current.execute();
          if (turnstileToken) token = turnstileToken;
        } catch (err) {
          console.warn('[Login] Turnstile error:', err);
          turnstileRef.current?.reset();
        }
      }
      await login(token);
      setIsLoginClicked(false);
    } catch (error) {
      console.error('[Login] Error:', error);
      setIsLoginClicked(false);
      turnstileRef.current?.reset();
      toast({ title: 'เข้าสู่ระบบไม่สำเร็จ', description: 'ไม่สามารถติดต่อระบบยืนยันตัวตนได้', variant: 'destructive' });
    }
  };

  const containsBannedWord = useCallback(async (text: string): Promise<string | null> => {
    const { data, error } = await supabase.from('banned_name').select('word');
    if (error) throw error;
    const lower = text.toLowerCase();
    for (const row of data || []) {
      const w = String(row.word || '').trim();
      if (w && lower.includes(w.toLowerCase())) return w;
    }
    return null;
  }, []);

  const handleSubmit = async () => {
    if (!isAuthenticated || !user?.id) {
      toast({ title: 'กรุณาเข้าสู่ระบบก่อน', variant: 'destructive' });
      return;
    }

    const ownCount = messages.filter(m => m.author_id === user.id).length;
    if (ownCount >= 3) {
      toast({ title: 'ถึงขีดจำกัดแล้ว', description: 'คุณสามารถส่งข้อความให้กำลังใจได้สูงสุด 3 ข้อความเท่านั้นค่ะ', variant: 'destructive' });
      return;
    }

    const trimmed = message.trim();
    if (trimmed.length < MIN_LEN) {
      toast({ title: `ข้อความต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const blocked = await containsBannedWord(trimmed);
      if (blocked) {
        toast({ title: 'ไม่สามารถส่งได้', description: `พบชื่อ/คำต้องห้าม: "${blocked}"`, variant: 'destructive' });
        return;
      }
      const { error } = await supabase
        .from('healing_messages')
        .insert({ message: trimmed, author_id: user.id, status: 'pending' });
      if (error) throw error;
      setMessage('');
      toast({ title: '💌 ส่งข้อความสำเร็จ', description: 'กำลังรอการอนุมัติจากแอดมินนะคะ' });
      await fetchMessages();
    } catch (error: any) {
      toast({ title: 'ส่งไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;
    const trimmed = editText.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      toast({ title: `ข้อความต้องมี ${MIN_LEN}–${MAX_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      const blocked = await containsBannedWord(trimmed);
      if (blocked) {
        toast({ title: 'ไม่สามารถบันทึกได้', description: `พบชื่อ/คำต้องห้าม: "${blocked}"`, variant: 'destructive' });
        return;
      }

      // RLS policy forces status = 'pending' on update
      const { error } = await supabase
        .from('healing_messages')
        .update({ message: trimmed, status: 'pending' })
        .eq('id', editTarget.id);

      if (error) throw error;
      toast({ title: 'แก้ไขสำเร็จ', description: 'ส่งกลับไปรออนุมัติจากแอดมินใหม่อีกครั้งค่ะ' });
      setEditTarget(null);
      await fetchMessages();
    } catch (error: any) {
      toast({ title: 'แก้ไขไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('healing_messages')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast({ title: 'ลบข้อความเรียบร้อยแล้ว' });
      setDeleteTarget(null);
      await fetchMessages();
    } catch (error: any) {
      toast({ title: 'ลบไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Lists filtered by types
  const approvedMessages = useMemo(() => {
    return messages.filter(m => m.status === 'approved');
  }, [messages]);

  const ownMessages = useMemo(() => {
    if (!user?.id) return [];
    return messages.filter(m => m.author_id === user.id);
  }, [messages, user?.id]);

  const isLimitReached = ownMessages.length >= 3;

  // Helper to fill the marquee nicely
  const filledRow1 = useMemo(() => {
    if (approvedMessages.length === 0) return [];
    let items = [...approvedMessages];
    while (items.length < 8) {
      items = [...items, ...approvedMessages];
    }
    return [...items, ...items];
  }, [approvedMessages]);

  const filledRow2 = useMemo(() => {
    if (approvedMessages.length === 0) return [];
    // Shift by 1 to make it staggered
    const shifted = [...approvedMessages.slice(1), approvedMessages[0]];
    let items = [...shifted];
    while (items.length < 8) {
      items = [...items, ...shifted];
    }
    return [...items, ...items];
  }, [approvedMessages]);

  const loginFeatures = [
    { icon: Users, label: 'หาเพื่อนคุย', desc: 'เชื่อมต่อกับสมาชิกในชุมชน' },
    { icon: MessageCircle, label: 'ผู้รับฟัง', desc: 'มีคนพร้อมรับฟังเสมอ' },
    { icon: Mic, label: 'ลงห้องเสียง', desc: 'เข้าร่วม Voice Channel ด้วยกัน' },
    { icon: Shield, label: 'ปลอดภัย', desc: 'ระบบที่ดูแลความปลอดภัย' },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-background dark:via-background dark:to-muted/20">
      
      {/* Dynamic Keyframes injected locally */}
      <style>{`
        @keyframes marquee-l2r {
          0% { transform: translate3d(-50%, 0, 0); }
          100% { transform: translate3d(0%, 0, 0); }
        }
        .animate-marquee-l2r {
          display: flex;
          width: max-content;
          animation: marquee-l2r 32s linear infinite;
        }
        .animate-marquee-l2r-slow {
          display: flex;
          width: max-content;
          animation: marquee-l2r 46s linear infinite;
        }
      `}</style>

      {/* ── Main View (will be blurred if not logged in) ── */}
      <div className={cn(
        "transition-all duration-500",
        !isAuthenticated && "blur-md pointer-events-none select-none"
      )}>
        <div className="container mx-auto max-w-4xl px-4 py-10 space-y-8">
          
          {/* Hero Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-500/10 mb-2">
              <Heart className="w-7 h-7 text-pink-400 fill-pink-400/30" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#8C6239] dark:text-[#EAD8C8]">กระดานให้กำลังใจ 🧸</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              ส่งคำพูดดีๆ เติมพลังบวกให้ใจฟู ข้อความที่ผ่านการตรวจสอบโดยแอดมินจะปรากฏขึ้นบนบอร์ดนี้นะคะ
            </p>
          </div>

          {/* Marquee Ticker Section */}
          <div className="space-y-3.5 py-4 border-y border-latte/30 bg-cream/10 dark:bg-card/5 rounded-3xl overflow-hidden relative">
            
            {approvedMessages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs italic">
                ยังไม่มีข้อความส่งกำลังใจในบอร์ดตอนนี้...
              </div>
            ) : (
              <div className="flex flex-col gap-3 relative">
                {/* Row 1 */}
                <div className="w-full overflow-hidden flex">
                  <div className="animate-marquee-l2r flex gap-3">
                    {filledRow1.map((item, idx) => (
                      <div key={`r1-${item.id}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-latte/30 dark:border-zinc-800 shadow-sm shrink-0">
                        <img
                          src={item.profiles?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                          className="w-7 h-7 rounded-full border border-latte/20 shrink-0"
                          alt="avatar"
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-bold text-[#8C6239] dark:text-[#EAD8C8] leading-tight">
                            @{item.profiles?.username || 'Unknown'}
                          </span>
                          <span className="text-[11px] text-foreground font-medium mt-0.5 leading-snug">
                            {item.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2 */}
                <div className="w-full overflow-hidden flex">
                  <div className="animate-marquee-l2r-slow flex gap-3">
                    {filledRow2.map((item, idx) => (
                      <div key={`r2-${item.id}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-latte/30 dark:border-zinc-800 shadow-sm shrink-0">
                        <img
                          src={item.profiles?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                          className="w-7 h-7 rounded-full border border-latte/20 shrink-0"
                          alt="avatar"
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-bold text-[#8C6239] dark:text-[#EAD8C8] leading-tight">
                            @{item.profiles?.username || 'Unknown'}
                          </span>
                          <span className="text-[11px] text-foreground font-medium mt-0.5 leading-snug">
                            {item.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Compose Card */}
            <div className="md:col-span-5 space-y-4">
              <h2 className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                เขียนคำส่งกำลังใจ
              </h2>

              <div className="rounded-2xl border border-latte/40 bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
                {isLimitReached ? (
                  <div className="py-8 text-center space-y-2.5">
                    <div className="text-3xl">🧸</div>
                    <p className="text-xs font-semibold text-[#8C6239] dark:text-[#EAD8C8] leading-relaxed">
                      คุณเขียนข้อความครบโควตา 3 ข้อความแล้วค่ะ
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed px-2">
                      หากต้องการเขียนข้อความใหม่ สามารถแก้ไขหรือลบข้อความที่มีอยู่ได้เลยน้า
                    </p>
                  </div>
                ) : (
                  <>
                    <Textarea
                      placeholder={`เขียนข้อความให้กำลังใจใจฟู... (${MIN_LEN}–${MAX_LEN} ตัวอักษร)`}
                      maxLength={MAX_LEN}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[110px] resize-none border-latte/40 focus-visible:ring-pink-400 bg-transparent text-sm leading-relaxed"
                    />

                    {/* Progress Bar & Submit Button */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-semibold tabular-nums">
                          <span>{len} / {MAX_LEN}</span>
                          {len < MIN_LEN && <span className="text-amber-500">ต้องการอีก {MIN_LEN - len} ตัว</span>}
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-200',
                              len < MIN_LEN ? 'bg-amber-400' : 'bg-green-500'
                            )}
                            style={{ width: `${Math.min((len / MAX_LEN) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={submitting || !isValid}
                        size="sm"
                        className="gap-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white shadow-sm shadow-pink-500/25 shrink-0"
                      >
                        {submitting ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังส่ง...</>
                        ) : (
                          <><Send className="w-3.5 h-3.5" />ส่งข้อความ</>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* My Messages List */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-pink-500" />
                  ข้อความของฉัน ({ownMessages.length} / 3)
                </h2>
              </div>

              {loadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : ownMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-latte/40 p-10 text-center text-xs text-muted-foreground leading-relaxed">
                  <Heart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  คุณยังไม่ได้เริ่มเขียนข้อความใดๆ เลยค่ะ ลองพิมพ์เขียนให้กำลังใจกันดูน้า!
                </div>
              ) : (
                <div className="space-y-3">
                  {ownMessages.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-latte/30 bg-card p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3 text-xs leading-relaxed"
                    >
                      <p className="font-semibold text-sm leading-relaxed whitespace-pre-wrap break-words">{row.message}</p>
                      
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-latte/10 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(row.created_at).toLocaleDateString('th-TH', {
                              day: 'numeric', month: 'short', year: '2-digit'
                            })}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <Badge
                            variant={row.status === 'approved' ? 'success' : row.status === 'pending' ? 'warning' : 'destructive'}
                            className="text-[9px] px-1.5 py-0.5 rounded-full"
                          >
                            {row.status === 'approved' ? 'อนุมัติแล้ว' : row.status === 'pending' ? 'รออนุมัติ' : 'ถูกปฏิเสธ'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-amber-500 hover:bg-amber-500/10 rounded-lg"
                            onClick={() => {
                              setEditTarget(row);
                              setEditText(row.message);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-red-500 hover:bg-red-500/10 rounded-lg"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Unauthorized Blur Overlay Card ── */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-md">
          <Card className="w-full max-w-md shadow-2xl border border-primary/10 bg-[#FDFBF7]/95 dark:bg-zinc-950/95 shadow-primary/10 animate-fade-in">
            {/* Logo */}
            <div className="flex justify-center pt-8 pb-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-honey/30 blur-xl scale-125 opacity-40" />
                <BearLogo size="lg" noFloat className="relative" />
              </div>
            </div>

            <CardHeader className="text-center px-6 pb-2 pt-0">
              <DialogTitle className="font-display text-xl sm:text-2xl text-foreground">
                เข้าสู่ระบบสมาชิก
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                กรุณาเข้าสู่ระบบก่อนเพื่อส่งกระดานข้อความให้กำลังใจเพื่อนๆ ค่ะ
              </DialogDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-6 pt-2 pb-8">
              {/* Features list */}
              <div className="grid grid-cols-2 gap-2.5">
                {loginFeatures.map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/20">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-honey/10 flex items-center justify-center shrink-0">
                      <f.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] leading-tight">{f.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate leading-none">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Join Server notice if applicable */}
              {isNotMember && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex flex-col gap-2 animate-fade-in text-[11px]">
                  <div className="flex items-start gap-2">
                    <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">คุณยังไม่ได้อยู่ใน Discord Server</p>
                      <p className="text-amber-700 dark:text-amber-400 leading-snug mt-0.5">กรุณา Join Server และมาทำการล็อกอินใหม่อีกรอบนะคะ</p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="w-full h-8 text-[11px] bg-[#5865F2] hover:bg-[#4752C4]">
                    <a href={discordInviteLink} target="_blank" rel="noopener noreferrer">
                      Join Server <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Login Action Button */}
              <Button
                onClick={handleLogin}
                disabled={isLoginClicked}
                className="w-full h-12 text-sm sm:text-base font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-md shadow-[#5865F2]/20 transition-all hover:scale-[1.01]"
              >
                {isLoginClicked ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังเชื่อมต่อ Discord...</>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    เชื่อมต่อด้วย Discord
                  </>
                )}
              </Button>

              <div className="flex justify-center scale-95 mt-1.5">
                <TurnstileWidget ref={turnstileRef} siteKey={siteKey} action="login" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dialog: Edit Own Message ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#8C6239] dark:text-[#EAD8C8]">แก้ไขข้อความ</DialogTitle>
            <DialogDescription className="sr-only">พิมพ์แก้ไขข้อความของตนเอง</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <Label className="text-xs font-semibold">ข้อความ ({MIN_LEN}–{MAX_LEN} ตัวอักษร)</Label>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[100px] resize-none border-latte/40 rounded-xl"
              maxLength={MAX_LEN}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
              <span className={editText.trim().length < MIN_LEN ? 'text-amber-500' : 'text-green-500'}>
                {editText.trim().length} / {MAX_LEN} ตัวอักษร
              </span>
              <span>ขั้นต่ำ {MIN_LEN} ตัวอักษร</span>
            </div>
            <p className="text-[10px] text-amber-500 leading-normal">
              * การแก้ไขจะส่งผลให้สถานะถูกเปลี่ยนกลับเป็น "รออนุมัติ" และต้องได้รับการตรวจสอบจากแอดมินใหม่อีกครั้งค่ะ
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="rounded-xl">ยกเลิก</Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editSaving || editText.trim().length < MIN_LEN}
              className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white gap-2"
            >
              {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              ยืนยันการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirm Delete Own Message ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-[#FDFBF7] dark:bg-[hsl(var(--card))] border-[#EAD8C8] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-500 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> ยืนยันการลบข้อความ
            </DialogTitle>
            <DialogDescription className="sr-only">ยืนยันความประสงค์ลบข้อความถาวร</DialogDescription>
          </DialogHeader>

          <div className="my-2 text-xs leading-relaxed text-muted-foreground">
            <p>คุณแน่ใจน้าว่าจะลบข้อความนี้: </p>
            <div className="my-2 p-3 bg-secondary/50 rounded-xl font-medium text-foreground italic break-words">
              "{deleteTarget?.message}"
            </div>
            <p className="text-[10px] text-red-400">* ลบแล้วไม่สามารถย้อนกลับหรือกู้ข้อมูลได้ค่ะ</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="rounded-xl" disabled={deleting}>ยกเลิก</Button>
            <Button
              onClick={handleDeleteSubmit}
              disabled={deleting}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white gap-2"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              ยืนยันลบข้อความ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
