import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PendingHealingMessage {
  id: string;
  message: string;
  created_at: string;
  profiles: {
    username: string | null;
  } | null;
}

export function HealingMessagesManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingHealingMessage[]>([]);

  const fetchPendingMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('healing_messages')
        .select('id, message, created_at, author_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // ดึง username แยก เพื่อหลีกเลี่ยง PGRST200
      const rows = (data || []) as any[];
      const authorIds = [...new Set(rows.map((r: any) => r.author_id).filter(Boolean))];
      const usernameMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, username')
          .in('id', authorIds);
        (profiles ?? []).forEach((p: any) => { usernameMap[p.id] = p.username; });
      }

      setRows(rows.map((r: any) => ({
        ...r,
        profiles: r.author_id ? { username: usernameMap[r.author_id] || null } : null,
      })) as PendingHealingMessage[]);
    } catch (error: any) {
      toast({
        title: 'โหลดข้อความรออนุมัติไม่สำเร็จ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendingMessages();
  }, [fetchPendingMessages]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    try {
      const { error } = await (supabase as any)
        .from('healing_messages')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({ title: status === 'approved' ? 'อนุมัติข้อความแล้ว' : 'ปฏิเสธข้อความแล้ว' });
      await fetchPendingMessages();
    } catch (error: any) {
      toast({
        title: 'อัปเดตสถานะไม่สำเร็จ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>จัดการข้อความกำลังใจ (รออนุมัติ)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีข้อความที่รออนุมัติ</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[460px] whitespace-pre-wrap break-words">{row.message}</TableCell>
                  <TableCell>{row.profiles?.username || '-'}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      onClick={() => updateStatus(row.id, 'approved')}
                      disabled={updatingId === row.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatus(row.id, 'rejected')}
                      disabled={updatingId === row.id}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
