import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface NotificationOptions {
  enableCooldownNotification?: boolean;
  enableNewMatchNotification?: boolean;
}

interface NotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<void>;
  notifyCooldownEnd: () => void;
  notifyNewMatch: (count: number) => void;
}

export function useNotifications(options: NotificationOptions = {}): NotificationState {
  const { 
    enableCooldownNotification = true, 
    enableNewMatchNotification = true 
  } = options;
  
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const cooldownNotifiedRef = useRef(false);

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('เปิดใช้งานการแจ้งเตือนแล้ว! 🔔');
      } else if (result === 'denied') {
        toast.error('การแจ้งเตือนถูกปิดกั้น กรุณาเปิดในการตั้งค่าเบราว์เซอร์');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('เกิดข้อผิดพลาดในการขอสิทธิ์แจ้งเตือน');
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions & { body?: string; icon?: string }) => {
    if (!isSupported || permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission]);

  const notifyCooldownEnd = useCallback(() => {
    if (!enableCooldownNotification || cooldownNotifiedRef.current) return;
    
    cooldownNotifiedRef.current = true;
    
    // Browser notification
    showNotification('🐻 Bear Café', {
      body: 'Cooldown หมดแล้ว! พร้อมสร้างแมตช์ใหม่',
    });
    
    // In-app toast
    toast.success('Cooldown หมดแล้ว! พร้อมสร้างแมตช์ใหม่ 🎮', {
      duration: 5000,
      icon: '🐻',
    });
    
    // Reset after a delay so it can trigger again next time
    setTimeout(() => {
      cooldownNotifiedRef.current = false;
    }, 1000);
  }, [enableCooldownNotification, showNotification]);

  const notifyNewMatch = useCallback((count: number) => {
    if (!enableNewMatchNotification) return;
    
    // Browser notification
    showNotification('🎮 แมตช์ใหม่!', {
      body: `มี ${count} แมตช์ที่กำลังรอคุณอยู่`,
    });
    
    // In-app toast
    toast('มีแมตช์ใหม่! 🎉', {
      description: `มี ${count} แมตช์ที่กำลังรอคุณอยู่`,
      duration: 4000,
    });
  }, [enableNewMatchNotification, showNotification]);

  return {
    permission,
    isSupported,
    requestPermission,
    notifyCooldownEnd,
    notifyNewMatch,
  };
}
