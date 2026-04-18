import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Wrench, AlertTriangle, Save, Construction, Users, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MaintenanceToggleProps {
  isEnabled: boolean;
  enabledStaff?: boolean;
  message: string;
  onToggle: (enabled: boolean, message?: string) => Promise<void>;
  onUpdateMaintenance?: (updates: { enabled_users?: boolean; enabled_staff?: boolean; message?: string }) => Promise<void>;
}

export function MaintenanceToggle({ isEnabled, enabledStaff = false, message, onToggle, onUpdateMaintenance }: MaintenanceToggleProps) {
  const [localMessage, setLocalMessage] = useState(message);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    setLocalMessage(message);
  }, [message]);

  const handleToggleUsers = (checked: boolean) => {
    if (checked) {
      setShowConfirmDialog(true);
    } else {
      performToggleUsers(false);
    }
  };

  const performToggleUsers = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      if (onUpdateMaintenance) {
        await onUpdateMaintenance({
          enabled_users: enabled,
          // ถ้าปิด user ให้ปิด staff ด้วย
          ...(enabled ? {} : { enabled_staff: false }),
        });
      } else {
        await onToggle(enabled, localMessage);
      }
      toast.success(enabled ? 'ปิดให้บริการสำหรับ User แล้ว' : 'เปิดให้บริการตามปกติแล้ว', {
        description: enabled
          ? 'User ทั่วไปจะไม่สามารถใช้งานเว็บได้'
          : 'เว็บไซต์กลับมาใช้งานได้ตามปกติ',
      });
    } catch (error) {
      console.error('Failed to toggle maintenance mode:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsUpdating(false);
      setShowConfirmDialog(false);
    }
  };

  const handleToggleStaff = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      if (onUpdateMaintenance) {
        await onUpdateMaintenance({ enabled_staff: checked });
      }
      toast.success(checked ? 'ปิดให้บริการสำหรับ Staff แล้ว' : 'Staff สามารถใช้งานได้แล้ว', {
        description: checked
          ? 'Staff จะไม่สามารถใช้งานเว็บได้ มีเพียง Owner เท่านั้น'
          : 'Staff ที่มีสิทธิ์สามารถเข้าใช้งานได้',
      });
    } catch (error) {
      console.error('Failed to toggle staff maintenance:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveMessage = async () => {
    setIsUpdating(true);
    try {
      if (onUpdateMaintenance) {
        await onUpdateMaintenance({ message: localMessage });
      } else {
        await onToggle(isEnabled, localMessage);
      }
      toast.success('บันทึกข้อความแล้ว');
    } catch (error) {
      console.error('Failed to save message:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsUpdating(false);
    }
  };

  const anyEnabled = isEnabled || enabledStaff;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* ─── Toggle: ปิดสำหรับ User ทั่วไป ─── */}
        <div className={cn(
          "rounded-2xl border-2 p-4 sm:p-5 transition-all duration-300",
          isEnabled
            ? "bg-destructive/5 border-destructive/40 dark:bg-destructive/10 dark:border-destructive/30"
            : "bg-card border-border"
        )}>
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              animate={isEnabled ? { rotate: [0, 15, -15, 0] } : { rotate: 0 }}
              transition={{ duration: 2, repeat: isEnabled ? Infinity : 0, ease: "easeInOut" }}
              className={cn(
                "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                isEnabled ? "bg-destructive/15 dark:bg-destructive/25" : "bg-muted"
              )}
            >
              {isEnabled ? (
                <Construction className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              ) : (
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              )}
            </motion.div>

            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-base sm:text-lg leading-tight">
                ปิดสำหรับ User ทั่วไป
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {isEnabled ? 'User ทั่วไปไม่สามารถเข้าใช้งานได้' : 'User ทั่วไปใช้งานได้ปกติ'}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className={cn(
                "text-xs font-semibold hidden sm:inline",
                isEnabled ? "text-destructive" : "text-muted-foreground"
              )}>
                {isEnabled ? 'ปิดอยู่' : 'เปิดอยู่'}
              </span>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleUsers}
                disabled={isUpdating}
                className={cn(isEnabled && "data-[state=checked]:bg-destructive")}
              />
            </div>
          </div>
        </div>

        {/* ─── Toggle: ปิดสำหรับ Staff ด้วย (เฉพาะเมื่อเปิด User แล้ว) ─── */}
        <AnimatePresence>
          {isEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "rounded-2xl border-2 p-4 sm:p-5 transition-all duration-300",
                enabledStaff
                  ? "bg-orange-500/5 border-orange-500/40 dark:bg-orange-500/10 dark:border-orange-500/30"
                  : "bg-card border-border"
              )}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={cn(
                    "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    enabledStaff ? "bg-orange-500/15 dark:bg-orange-500/25" : "bg-muted"
                  )}>
                    <ShieldCheck className={cn(
                      "w-5 h-5 sm:w-6 sm:h-6",
                      enabledStaff ? "text-orange-500" : "text-muted-foreground"
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm sm:text-base leading-tight">
                      ปิดสำหรับ Staff ด้วย
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {enabledStaff
                        ? 'มีเพียง Owner เท่านั้นที่เข้าได้'
                        : 'Staff ที่มีสิทธิ์ยังเข้าใช้งานได้'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={enabledStaff}
                      onCheckedChange={handleToggleStaff}
                      disabled={isUpdating}
                      className={cn(enabledStaff && "data-[state=checked]:bg-orange-500")}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Warning ─── */}
        <AnimatePresence>
          {anyEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-destructive/8 dark:bg-destructive/15 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-destructive dark:text-red-300 space-y-1">
                  <p className="font-semibold">โหมดปรับปรุงเปิดอยู่</p>
                  <p className="opacity-80 leading-relaxed">
                    {enabledStaff
                      ? 'User และ Staff ทุกคนจะไม่สามารถใช้งานเว็บได้ มีเพียง Owner เท่านั้นที่เข้าถึงได้'
                      : 'User ทั่วไปจะไม่สามารถใช้งานเว็บได้ แต่ Staff ที่มีสิทธิ์ยังเข้าใช้งานได้'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Message Editor ─── */}
        <div className="rounded-2xl border-2 p-4 sm:p-5 bg-card border-border">
          <Label htmlFor="maintenance-message" className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            ข้อความแสดงหน้าปรับปรุง
          </Label>
          <Textarea
            id="maintenance-message"
            value={localMessage}
            onChange={(e) => setLocalMessage(e.target.value)}
            placeholder="เว็บไซต์กำลังปรับปรุง กรุณากลับมาใหม่ภายหลัง"
            className="min-h-[80px] resize-none text-sm"
            disabled={isUpdating}
          />
          <div className="flex justify-end mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveMessage}
              disabled={isUpdating || localMessage === message}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              บันทึกข้อความ
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── Confirmation Dialog ─── */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ยืนยันการปิดให้บริการ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              User ทั่วไปจะไม่สามารถใช้งานเว็บได้ และจะเห็นหน้าแจ้งว่า "เว็บไซต์กำลังปรับปรุง" แทน
              <br /><br />
              <span className="text-foreground font-medium">
                Owner และ Staff ที่มีสิทธิ์ยังสามารถเข้าใช้งานได้ (สามารถปิด Staff เพิ่มได้ทีหลัง)
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performToggleUsers(true)}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating ? 'กำลังดำเนินการ...' : 'ปิดให้บริการ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
