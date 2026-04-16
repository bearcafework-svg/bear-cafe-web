import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, X, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { readRoleBanPayload } from '@/lib/role-ban';

interface ActiveSessionCardProps {
  session: {
    id: string;
    duration_minutes: number;
    ends_at: string;
    note: string | null;
    include_voice_channel: boolean;
    voice_channel_name: string | null;
    status: string;
  };
  onCancel?: () => void;
}

export function ActiveSessionCard({ session, onCancel }: ActiveSessionCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRoleBanned, setIsRoleBanned] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const calculateTimeLeft = () => {
      const endTime = new Date(session.ends_at).getTime();
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('หมดเวลาแล้ว');
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [session.ends_at]);

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);

    try {
      const { error } = await supabase.functions.invoke('session-cancel', {
        body: { sessionId: session.id },
      });

      if (error) {
        const roleBanPayload = await readRoleBanPayload(error);
        if (roleBanPayload) {
          setIsRoleBanned(true);
          toast.error(roleBanPayload.message || 'บัญชีถูกระงับการใช้งาน');
          navigate('/banned-role', { replace: true });
          return;
        }

        throw error;
      }

      toast.success('ยกเลิก Session สำเร็จ');
      onCancel?.();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('ไม่สามารถยกเลิก Session ได้');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card className={`border-2 ${isExpired ? 'border-muted bg-muted/20' : 'border-success/50 bg-success/5'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isExpired ? 'bg-muted' : 'bg-success/20'}`}>
              <Clock className={`w-6 h-6 ${isExpired ? 'text-muted-foreground' : 'text-success'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Session กำลังใช้งาน</span>
                <Badge variant={isExpired ? 'secondary' : 'default'} className={isExpired ? '' : 'bg-success'}>
                  {isExpired ? 'หมดเวลา' : 'Active'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{session.duration_minutes} นาที</span>
                {session.include_voice_channel && session.voice_channel_name && (
                  <>
                    <span>•</span>
                    <Mic className="w-3 h-3" />
                    <span>{session.voice_channel_name}</span>
                  </>
                )}
              </div>
              {session.note && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  📝 {session.note}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-mono font-bold ${isExpired ? 'text-muted-foreground' : 'text-success'}`}>
              {timeLeft}
            </div>
            {!isExpired && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling || isRoleBanned}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
