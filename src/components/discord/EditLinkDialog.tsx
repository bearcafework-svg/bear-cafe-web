import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { updateServerInviteLink } from '@/lib/discord-invite-checker';

// DiscordServer shape (subset needed by this component)
interface DiscordServer {
  id: string;
  name: string;
  invite_status: 'valid' | 'expired' | 'unknown';
  discord_id?: string;
  [key: string]: unknown;
}

interface EditLinkDialogProps {
  server: DiscordServer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the server ID after a successful link update */
  onSuccess: (serverId: string, updatedData?: Record<string, any>) => void;
}

/**
 * EditLinkDialog — lets a server owner submit a new invite link for a server
 * whose current link has expired.
 *
 * Flow:
 * 1. On open: re-check invite_status from DB
 *    - Not expired → close + toast "ลิงก์ใช้งานได้แล้ว"
 *    - Network error → close + toast error
 *    - Still expired → show input
 * 2. Submit → call updateServerInviteLink with strict Guild ID matching
 * 3. Success → call onSuccess(serverId, updatedData)
 */
export function EditLinkDialog({ server, open, onOpenChange, onSuccess }: EditLinkDialogProps) {
  const { toast } = useToast();

  const [isChecking, setIsChecking] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-check invite_status whenever the dialog opens (Req 5.3)
  useEffect(() => {
    if (!open || !server) return;

    setShowInput(false);
    setNewInviteUrl('');
    setIsChecking(true);

    (async () => {
      try {
        const { data, error } = await (supabase
          .from('discord_servers' as any)
          .select('invite_status')
          .eq('id', server.id)
          .single()) as any;

        if (error) throw error;

        const currentStatus = data?.invite_status as string | undefined;

        if (currentStatus !== 'expired') {
          // Link is no longer expired — close dialog and inform user
          onOpenChange(false);
          toast({
            title: 'ลิงก์ใช้งานได้แล้ว',
            description: `ลิงก์ของ "${server.name}" ไม่ได้หมดอายุแล้ว`,
            className: 'bg-green-500 text-white',
          });
          return;
        }

        // Still expired — show the input field
        setShowInput(true);
      } catch {
        // Network / DB error — close dialog and show error
        onOpenChange(false);
        toast({
          title: 'ไม่สามารถตรวจสอบสถานะได้',
          description: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะลิงก์ กรุณาลองใหม่อีกครั้ง',
          variant: 'destructive',
        });
      } finally {
        setIsChecking(false);
      }
    })();
  }, [open, server]);

  const handleSubmit = async () => {
    if (!server || !newInviteUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast({ title: 'กรุณาเข้าสู่ระบบก่อน', variant: 'destructive' });
        return;
      }

      // Execute update with Guild ID matching
      const result = await updateServerInviteLink(server.id, newInviteUrl.trim());

      if (!result.success) {
        if (result.isMismatchedGuild) {
          toast({
            title: '⚠️ ลิงก์นี้ไม่ใช่ของเซิร์ฟเวอร์เดิม',
            description: result.error,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'เกิดข้อผิดพลาดในการอัปเดต',
            description: result.error || 'ไม่สามารถอัปเดตลิงก์ได้',
            variant: 'destructive',
          });
        }
        return;
      }

      // Success
      toast({
        title: '✅ อัปเดตลิงก์สำเร็จ',
        description: `ลิงก์ของ "${result.updatedData?.name || server.name}" ได้รับการอัปเดตและใช้งานได้แล้ว`,
        className: 'bg-green-500 text-white',
      });
      onOpenChange(false);
      onSuccess(server.id, result.updatedData);
    } catch (err: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถอัปเดตลิงก์ได้',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />
            แก้ไขลิงก์เชิญ
          </DialogTitle>
          <DialogDescription>
            {server?.name} — ลิงก์เชิญปัจจุบันหมดอายุแล้ว กรุณากรอกลิงก์ใหม่
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          {/* Re-checking state */}
          {isChecking && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="text-sm">กำลังตรวจสอบสถานะลิงก์...</span>
            </div>
          )}

          {/* Input form — shown only when status is confirmed expired */}
          {!isChecking && showInput && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-orange-200/60 bg-orange-50/80 dark:bg-orange-950/20 dark:border-orange-800/30 p-3">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-orange-700 dark:text-orange-300/80 leading-relaxed">
                  ลิงก์เชิญของเซิร์ฟเวอร์นี้หมดอายุแล้ว เซิร์ฟเวอร์จะถูกซ่อนจากรายการสาธารณะจนกว่าจะอัปเดตลิงก์ใหม่
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-invite-url" className="text-sm font-medium">
                  ลิงก์เชิญใหม่ <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="new-invite-url"
                    placeholder="discord.gg/..."
                    className="pl-10 rounded-xl text-sm"
                    value={newInviteUrl}
                    onChange={(e) => setNewInviteUrl(e.target.value)}
                    disabled={isSubmitting}
                    aria-label="ลิงก์เชิญใหม่"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  ระบบจะตรวจสอบว่าลิงก์ชี้ไปยังเซิร์ฟเวอร์เดิมก่อนอัปเดต
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            ยกเลิก
          </Button>
          {!isChecking && showInput && (
            <Button
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!newInviteUrl.trim() || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'กำลังตรวจสอบ...' : 'อัปเดตลิงก์'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditLinkDialog;
