import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Heart, Send, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_LEN = 10;
const MAX_LEN = 100;

type HealingMessageStatus = 'pending' | 'approved' | 'rejected';

interface HealingMessageRow {
  id: string;
  message: string;
  status: HealingMessageStatus;
  author_id: string;
  created_at: string;
}

function StatusPill({ status }: { status: HealingMessageStatus }) {
  if (status === 'approved') return null; // approved messages don't need a badge
  if (status === 'pending') return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
      รออนุมัติ
    </span>
  );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
      ถูกปฏิเสธ
    </span>
  );
}

export default function HealingMessagePage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messages, setMessages] = useState<HealingMessageRow[]>([]);

  const len = message.trim().length;
  const isValid = len >= MIN_LEN && len <= MAX_LEN;
  const remaining = MAX_LEN - message.length;

  const fetchMessages = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await (supabase as any)
        .from('healing_messages')
        .select('id, message, status, author_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMessages((data || []) as HealingMessageRow[]);
    } catch (error: any) {
      toast({ title: 'โหลดข้อความล้มเหลว', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
    }
  }, [isAuthenticated, toast]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const visibleMessages = useMemo(() => {
    return messages.filter((r) => r.status === 'approved' || r.author_id === user?.id);
  }, [messages, user?.id]);

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
    const trimmed = message.trim();
    if (trimmed.length < MIN_LEN) {
      toast({ title: `ข้อความต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }
    if (trimmed.length > MAX_LEN) {
      toast({ title: `ข้อความต้องไม่เกิน ${MAX_LEN} ตัวอักษร`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const blocked = await containsBannedWord(trimmed);
      if (blocked) {
        toast({ title: 'ไม่สามารถส่งได้', description: `พบชื่อต้องห้าม: "${blocked}"`, variant: 'destructive' });
        return;
      }
      const { error } = await (supabase as any)
        .from('healing_messages')
        .insert({ message: trimmed, author_id: user.id, status: 'pending' });
      if (error) throw error;
      setMessage('');
      toast({ title: '💌 ส่งข้อความสำเร็จ', description: 'กำลังรอการอนุมัติจากแอดมิน' });
      await fetchMessages();
    } catch (error: any) {
      toast({ title: 'ส่งไม่สำเร็จ', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto max-w-2xl px-4 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-500/10 mb-2">
            <Heart className="w-7 h-7 text-pink-400 fill-pink-400/30" />
          </div>
          <h1 className="text-2xl font-bold">กระดานให้กำลังใจ</h1>
          <p className="text-sm text-muted-foreground">ส่งข้อความให้กำลังใจชุมชน ข้อความที่ผ่านการอนุมัติจะแสดงให้ทุกคนเห็น</p>
        </div>

        {/* ── Compose box ── */}
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 space-y-3 shadow-sm">
          <Textarea
            placeholder={`เขียนข้อความให้กำลังใจ... (${MIN_LEN}–${MAX_LEN} ตัวอักษร)`}
            maxLength={MAX_LEN}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[90px] resize-none border-border/40 bg-transparent focus-visible:ring-pink-400/30 text-sm"
          />

          {/* Character counter + submit */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Progress bar */}
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-200',
                    len < MIN_LEN ? 'bg-amber-400' :
                    len > MAX_LEN ? 'bg-red-500' : 'bg-green-500'
                  )}
                  style={{ width: `${Math.min((len / MAX_LEN) * 100, 100)}%` }}
                />
              </div>
              <span className={cn(
                'text-xs font-medium tabular-nums',
                len < MIN_LEN ? 'text-amber-500' :
                remaining < 0 ? 'text-red-500' : 'text-muted-foreground'
              )}>
                {len < MIN_LEN
                  ? `ต้องการอีก ${MIN_LEN - len} ตัว`
                  : remaining >= 0
                  ? `เหลือ ${remaining} ตัว`
                  : `เกิน ${-remaining} ตัว`}
              </span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !isValid}
              size="sm"
              className="gap-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white shadow-sm shadow-pink-500/20"
            >
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังส่ง...</>
                : <><Send className="w-3.5 h-3.5" />ส่งข้อความ</>
              }
            </Button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold">ข้อความจากชุมชน</h2>
            {!loadingMessages && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {visibleMessages.filter((r) => r.status === 'approved').length} ข้อความ
              </Badge>
            )}
          </div>

          {loadingMessages ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-20" />
              ยังไม่มีข้อความในตอนนี้ เป็นคนแรกที่ส่งกำลังใจ!
            </div>
          ) : (
            <div className="grid gap-2.5">
              {visibleMessages.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm leading-relaxed transition-all',
                    row.status === 'approved'
                      ? 'bg-card/70 border-border/40 hover:border-pink-300/40 hover:bg-pink-50/30 dark:hover:bg-pink-950/10'
                      : 'bg-muted/30 border-dashed border-border/30 opacity-70'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{row.message}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                    <span>
                      {new Date(row.created_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: '2-digit',
                      })}
                    </span>
                    {row.author_id === user?.id && row.status !== 'approved' && (
                      <StatusPill status={row.status} />
                    )}
                    {row.author_id === user?.id && (
                      <span className="ml-auto text-pink-400/70 font-medium">ของฉัน</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
