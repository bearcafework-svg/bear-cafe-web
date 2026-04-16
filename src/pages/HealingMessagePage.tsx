import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const MAX_MESSAGE_LENGTH = 300;

type HealingMessageStatus = 'pending' | 'approved' | 'rejected';

interface HealingMessageRow {
  id: string;
  message: string;
  status: HealingMessageStatus;
  author_id: string;
  created_at: string;
}

function statusBadge(status: HealingMessageStatus) {
  if (status === 'pending') return <Badge variant="outline">⏳ รออนุมัติ</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">❌ ถูกปฏิเสธ</Badge>;
  return <Badge>✅ อนุมัติแล้ว</Badge>;
}

export default function HealingMessagePage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messages, setMessages] = useState<HealingMessageRow[]>([]);

  const remaining = MAX_MESSAGE_LENGTH - message.length;

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
      toast({
        title: 'โหลดข้อความล้มเหลว',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [isAuthenticated, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const visibleMessages = useMemo(() => {
    const currentUserId = user?.id;
    return messages.filter((row) => row.status === 'approved' || row.author_id === currentUserId);
  }, [messages, user?.id]);

  const containsBannedWord = useCallback(async (text: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('banned_words')
      .select('word');

    if (error) throw error;

    const lowerText = text.toLowerCase();
    for (const row of data || []) {
      const word = String(row.word || '').trim();
      if (word && lowerText.includes(word.toLowerCase())) {
        return word;
      }
    }

    return null;
  }, []);

  const handleSubmit = async () => {
    if (!isAuthenticated || !user?.id) {
      toast({ title: 'กรุณาเข้าสู่ระบบก่อน', variant: 'destructive' });
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      toast({ title: 'กรุณากรอกข้อความกำลังใจ', variant: 'destructive' });
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast({ title: `ข้อความยาวเกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const blockedWord = await containsBannedWord(trimmed);
      if (blockedWord) {
        toast({
          title: 'ไม่สามารถส่งข้อความได้',
          description: `พบคำต้องห้าม: "${blockedWord}"`,
          variant: 'destructive',
        });
        return;
      }

      const { error } = await (supabase as any)
        .from('healing_messages')
        .insert({
          message: trimmed,
          author_id: user.id,
          status: 'pending',
        });

      if (error) throw error;

      setMessage('');
      toast({
        title: 'ส่งข้อความสำเร็จ',
        description: 'ข้อความของคุณกำลังรอการอนุมัติจากแอดมิน',
      });

      await fetchMessages();
    } catch (error: any) {
      toast({
        title: 'ส่งข้อความไม่สำเร็จ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>กระดานให้กำลังใจ (Healing Messages)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="เขียนข้อความให้กำลังใจชุมชนของเรา..."
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
            <div className="flex items-center justify-between text-sm">
              <span className={remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                เหลือ {remaining} ตัวอักษร
              </span>
              <Button onClick={handleSubmit} disabled={submitting || !message.trim()}>
                {submitting ? 'กำลังส่ง...' : 'ส่งข้อความกำลังใจ'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ข้อความจากชุมชน</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <p className="text-muted-foreground">กำลังโหลดข้อความ...</p>
            ) : visibleMessages.length === 0 ? (
              <p className="text-muted-foreground">ยังไม่มีข้อความในตอนนี้</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleMessages.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <p className="text-sm whitespace-pre-wrap break-words">{row.message}</p>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{new Date(row.created_at).toLocaleString()}</span>
                      {row.status !== 'approved' && row.author_id === user?.id ? statusBadge(row.status) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
