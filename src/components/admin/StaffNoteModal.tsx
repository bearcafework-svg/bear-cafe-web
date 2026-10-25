import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  MessageSquareHeart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: {
    id: string;
    username: string;
    discord_username: string | null;
    avatar_url: string | null;
    discord_id: string;
    is_owner: boolean;
    is_admin: boolean;
  } | null;
}


export function StaffNoteModal({ open, onOpenChange, currentUser }: StaffNoteModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Load existing notes from staff_members when dialog opens
  useEffect(() => {
    if (!open || !currentUser?.discord_id) return;

    let isMounted = true;
    setLoading(true);

    async function loadStaffNote() {
      try {
        const { data, error } = await (supabase as any)
          .from('staff_members')
          .select('id, notes')
          .eq('discord_id', currentUser.discord_id)
          .maybeSingle();

        if (error) {
          console.warn('[StaffNoteModal] Error loading staff notes:', error.message);
        }

        if (isMounted) {
          if (data) {
            setStaffId(data.id);
            setNote(data.notes || '');
          } else {
            setStaffId(null);
            setNote('');
          }
        }
      } catch (err) {
        console.error('[StaffNoteModal] Failed to load staff note:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStaffNote();

    return () => {
      isMounted = false;
    };
  }, [open, currentUser?.discord_id]);

  const trimmedLength = note.trim().length;
  const isTooShort = trimmedLength < 10;
  const isTooLong = trimmedLength > 100;
  const isValid = !isTooShort && !isTooLong;

  async function handleSave() {
    if (!isValid || !currentUser?.discord_id) return;

    setSaving(true);
    const finalNote = note.trim();

    try {
      if (staffId) {
        // Update existing staff_members record
        const { error } = await (supabase as any)
          .from('staff_members')
          .update({
            notes: finalNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', staffId);

        if (error) throw error;
      } else {
        // Upsert record if staff record doesn't exist yet
        const { data, error } = await (supabase as any)
          .from('staff_members')
          .upsert(
            {
              discord_id: currentUser.discord_id,
              nickname: currentUser.username || 'Staff',
              notes: finalNote,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'discord_id' }
          )
          .select('id')
          .single();

        if (error) throw error;
        if (data?.id) setStaffId(data.id);
      }

      toast({
        title: 'บันทึกข้อความต้อนรับสำเร็จ 🎉',
        description: 'อัปเดตข้อมูลตาราง staff_members คอลัมน์ notes เรียบร้อยแล้ว',
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'บันทึกข้อความไม่สำเร็จ',
        description: err.message || 'โปรดตรวจสอบสิทธิ์การใช้งานหรือลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#FDFAF7] dark:bg-[#1E1B18] border-2 border-[#F4EEE5] dark:border-[#382F28] rounded-3xl p-6 shadow-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-[#8C6239]/10 dark:bg-[#8C6239]/20 flex items-center justify-center text-[#8C6239] dark:text-[#D4B89B]">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-1.5">
                ข้อความต้อนรับทีมงาน
              </DialogTitle>
              <DialogDescription className="text-xs text-[#827160] dark:text-[#A89889]">
                แก้ไขข้อมูลตาราง <code className="font-mono text-[#8C6239] dark:text-[#D4B89B] bg-[#8C6239]/10 px-1 py-0.5 rounded">staff_members.notes</code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Profile Card Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#25201C] border border-[#F0E8DC] dark:border-[#3A312A] shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 rounded-full border-2 border-[#8C6239]/30 ring-2 ring-primary/10 shrink-0">
              {currentUser?.avatar_url && (
                <AvatarImage src={currentUser.avatar_url} alt={currentUser.username} className="object-cover" />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#4E3F30] dark:text-[#E8E1D9] truncate">
                {currentUser?.username || 'ผู้ดูแลระบบ'}
              </p>
              <p className="text-[11px] font-mono text-[#827160] dark:text-[#A89889] truncate">
                ID: {currentUser?.discord_id || '-'}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
              currentUser?.is_owner
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                : 'bg-primary/10 text-primary border-primary/30'
            )}
          >
            {currentUser?.is_owner ? '👑 เจ้าของเซิร์ฟเวอร์' : '🛡️ แอดมิน/ทีมงาน'}
          </Badge>
        </div>

        {/* Input Area */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-[#4E3F30] dark:text-[#E8E1D9] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8C6239]" />
                ข้อความต้อนรับ (10 - 100 ตัวอักษร)
              </label>
              <span
                className={cn(
                  'font-mono font-bold text-[11px] px-2 py-0.5 rounded-md transition-colors',
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : trimmedLength > 100
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                )}
              >
                {trimmedLength} / 100
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-24 bg-white dark:bg-[#25201C] rounded-2xl border border-[#F0E8DC] dark:border-[#3A312A]">
                <Loader2 className="w-5 h-5 animate-spin text-[#8C6239]" />
              </div>
            ) : (
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ระบุข้อความต้อนรับสมาชิก เช่น ยินดีต้อนรับสู่ Bear Café ครับ มีอะไรให้ทีมงานช่วยเหลือสอบถามได้เลยน้า ☕✨"
                rows={4}
                className={cn(
                  'rounded-2xl resize-none text-xs leading-relaxed bg-white dark:bg-[#25201C] border-[#F0E8DC] dark:border-[#3A312A] focus-visible:ring-[#8C6239] p-3 transition-all',
                  !isValid && trimmedLength > 0 && 'border-amber-400 focus-visible:ring-amber-400'
                )}
              />
            )}

            {/* Validation Feedback Banner */}
            <div className="min-h-[22px]">
              {trimmedLength === 0 ? (
                <p className="text-[11px] text-[#827160] dark:text-[#A89889] flex items-center gap-1">
                  💡 กรุณาระบุข้อความอย่างน้อย 10 ตัวอักษรขึ้นไป
                </p>
              ) : isTooShort ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  ยังขาดอีก {10 - trimmedLength} ตัวอักษร (ขั้นต่ำ 10 ตัวอักษร)
                </p>
              ) : isTooLong ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  ข้อความยาวเกินกำหนด {trimmedLength - 100} ตัวอักษร (สูงสุด 100 ตัวอักษร)
                </p>
              ) : (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ความยาวถูกต้อง ({trimmedLength} ตัวอักษร) พร้อมบันทึก
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-xl border-[#EFE7DC] dark:border-[#3A312A] h-9 text-xs font-bold cursor-pointer"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid || saving || loading}
            className="rounded-xl bg-[#8C6239] hover:bg-[#74502D] text-white font-bold h-9 px-4 text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-white" />}
            บันทึกข้อความ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
