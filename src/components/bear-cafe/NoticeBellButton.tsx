import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface WebNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string | null;
}

export function NoticeBellButton() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<WebNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // คำนวณจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // โหลดข้อมูลแจ้งเตือนของผู้ใช้
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('web_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Error fetching web notifications:', error);
        return;
      }

      setNotifications((data as WebNotification[]) || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [user?.id]);

  // โหลดเมื่อเริ่มต้น และเชื่อมต่อ Supabase Realtime
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    fetchNotifications().finally(() => setIsLoading(false));

    // สมัครรับการแจ้งเตือน Realtime สำหรับ user_id ของตัวเอง
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'web_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, fetchNotifications]);

  // ทำเครื่องหมายว่าอ่านแล้วรายการเดียว
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { error } = await supabase
        .from('web_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
  const handleMarkAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    try {
      const { error } = await supabase
        .from('web_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // ลบการแจ้งเตือน
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('web_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  if (!isAuthenticated) return null;

  // เลือกไอคอนและสไตล์ตามประเภทของการแจ้งเตือน
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return (
          <div className="p-1.5 rounded-lg bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      case 'warning':
        return (
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'success':
        return (
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-1.5 rounded-lg bg-latte/30 text-mocha dark:bg-stone-800 dark:text-stone-300 shrink-0">
            <Info className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-latte/40 dark:border-border/60 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs flex items-center justify-center shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            unreadCount > 0 && 'border-amber-400/50 dark:border-amber-500/50 text-foreground'
          )}
          title={unreadCount > 0 ? `มีการแจ้งเตือนใหม่ (${unreadCount})` : 'การแจ้งเตือน'}
          aria-label="การแจ้งเตือน"
        >
          <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

          {/* จุดแจ้งเตือน / ตัวเลข Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[90vw] max-w-[380px] p-0 rounded-2xl border border-latte/40 dark:border-[#2A221E] bg-card/95 dark:bg-[#181412]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
      >
        {/* Header */}
        <div className="p-3.5 border-b border-latte/30 dark:border-[#2A221E] flex items-center justify-between bg-latte/10 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">การแจ้งเตือน</h4>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[10px] font-semibold">
                ใหม่ {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 gap-1 rounded-lg"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {/* Content Body */}
        <ScrollArea className="max-h-[380px]">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-xs">กำลังโหลดข้อความ...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <span className="text-2xl">☕</span>
              <p className="text-xs font-medium text-foreground">ไม่มีการแจ้งเตือนใหม่</p>
              <p className="text-[11px] text-muted-foreground">
                การแจ้งเตือนเรื่องการตรวจงานหรือประกาศจะแสดงที่นี่
              </p>
            </div>
          ) : (
            <div className="divide-y divide-latte/20 dark:divide-[#2A221E]">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                  className={cn(
                    'p-3.5 transition-colors flex gap-3 items-start group relative cursor-pointer hover:bg-latte/15 dark:hover:bg-white/5',
                    !notif.is_read
                      ? 'bg-amber-500/5 dark:bg-amber-500/10'
                      : 'opacity-85'
                  )}
                >
                  {/* Status Icon */}
                  {getNotificationIcon(notif.type)}

                  {/* Message Detail */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h5
                        className={cn(
                          'text-xs font-semibold leading-snug',
                          !notif.is_read ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {notif.title}
                      </h5>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                    </div>

                    {/* ข้อความรายละเอียด / เหตุผลที่แอดมินใส่ */}
                    <div className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed break-words bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-latte/20 dark:border-white/5">
                      {notif.message}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {notif.created_at
                          ? format(new Date(notif.created_at), 'd MMM yy HH:mm น.', {
                              locale: th,
                            })
                          : ''}
                      </span>

                      {/* Action buttons on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.is_read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            className="p-1 rounded text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                            title="ทำเครื่องหมายว่าอ่านแล้ว"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(notif.id, e)}
                          className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="ลบข้อความนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
