"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminNotificationItem {
  id: string;
  name: string;
  description: string;
  icon: string | React.ReactNode;
  color: string;
  time: string;
  duration?: number;
}

interface AdminNotificationContextValue {
  notifications: AdminNotificationItem[];
  showNotification: (item: Omit<AdminNotificationItem, "id" | "time">) => void;
  dismiss: (id: string) => void;
  notify: {
    error: (name: string, description: string, duration?: number) => void;
    success: (name: string, description: string, duration?: number) => void;
    warning: (name: string, description: string, duration?: number) => void;
    info: (name: string, description: string, duration?: number) => void;
  };
}

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

const noop = () => {};
const fallbackNotify = {
  error: noop,
  success: noop,
  warning: noop,
  info: noop,
};

export function useAdminNotification(): AdminNotificationContextValue {
  const ctx = useContext(AdminNotificationContext);
  if (!ctx) {
    return {
      notifications: [],
      showNotification: noop,
      dismiss: noop,
      notify: fallbackNotify,
    };
  }
  return ctx;
}

export function AdminNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const existing = timeoutsRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timeoutsRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback(
    ({ name, description, icon, color, duration = 6000 }: Omit<AdminNotificationItem, "id" | "time">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newItem: AdminNotificationItem = {
        id,
        name,
        description,
        icon,
        color,
        time: "เมื่อสักครู่",
        duration,
      };

      setNotifications((prev) => {
        // Keep at most 4 notifications in the floating stack
        const trimmed = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
        return [...trimmed, newItem];
      });

      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }
    },
    [dismiss]
  );

  const notify = {
    error: useCallback(
      (name: string, description: string, duration?: number) => {
        showNotification({
          name,
          description,
          icon: "❌",
          color: "#FF3D71",
          duration,
        });
      },
      [showNotification]
    ),
    success: useCallback(
      (name: string, description: string, duration?: number) => {
        showNotification({
          name,
          description,
          icon: "✅",
          color: "#00C9A7",
          duration,
        });
      },
      [showNotification]
    ),
    warning: useCallback(
      (name: string, description: string, duration?: number) => {
        showNotification({
          name,
          description,
          icon: "⚠️",
          color: "#FFB800",
          duration,
        });
      },
      [showNotification]
    ),
    info: useCallback(
      (name: string, description: string, duration?: number) => {
        showNotification({
          name,
          description,
          icon: "ℹ️",
          color: "#1E86FF",
          duration,
        });
      },
      [showNotification]
    ),
  };

  return (
    <AdminNotificationContext.Provider value={{ notifications, showNotification, dismiss, notify }}>
      {children}
      {/* Floating Corner Notification Stack */}
      <aside
        aria-live="polite"
        aria-label="การแจ้งเตือนระบบ"
        className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-3 pointer-events-none max-w-[380px] w-full"
      >
        <AnimatePresence>
          {notifications.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ scale: 0.7, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full pointer-events-auto"
            >
              <figure
                onClick={() => dismiss(item.id)}
                className={cn(
                  "relative mx-auto min-h-fit w-full cursor-pointer overflow-hidden rounded-2xl p-3.5",
                  // animation styles
                  "transition-all duration-200 ease-in-out hover:scale-[102%]",
                  // light styles
                  "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.04),0_2px_4px_rgba(0,0,0,.06),0_12px_24px_rgba(0,0,0,.08)]",
                  // dark styles
                  "transform-gpu dark:bg-[#1E1B18]/95 dark:backdrop-blur-md dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:border dark:border-white/10"
                )}
              >
                <div className="flex flex-row items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-2xl shrink-0 shadow-xs"
                    style={{
                      backgroundColor: item.color,
                    }}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                  </div>
                  <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                    <figcaption className="flex flex-row items-center text-sm font-semibold whitespace-pre dark:text-white truncate">
                      <span className="truncate">{item.name}</span>
                      <span className="mx-1 text-muted-foreground/60">·</span>
                      <span className="text-[11px] font-normal text-muted-foreground shrink-0">{item.time}</span>
                    </figcaption>
                    <p className="text-xs font-normal text-muted-foreground dark:text-white/70 line-clamp-2 leading-relaxed mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(item.id);
                    }}
                    className="text-muted-foreground/50 hover:text-foreground p-1 rounded-lg transition-colors shrink-0"
                    title="ปิดการแจ้งเตือน"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </figure>
            </motion.div>
          ))}
        </AnimatePresence>
      </aside>
    </AdminNotificationContext.Provider>
  );
}

export default AdminNotificationProvider;
