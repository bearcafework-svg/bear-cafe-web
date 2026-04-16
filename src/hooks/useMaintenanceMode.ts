import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceSettings {
  enabled_users: boolean;   // บล็อก User ทั่วไป
  enabled_staff: boolean;   // บล็อก Staff (ผู้มีสิทธิ์) ด้วย
  message: string;
}

const DEFAULT_SETTINGS: MaintenanceSettings = {
  enabled_users: false,
  enabled_staff: false,
  message: 'เว็บไซต์กำลังปรับปรุง กรุณากลับมาใหม่ภายหลัง',
};

function parseSettings(raw: unknown): MaintenanceSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;

  // Backward compat: old format had single `enabled` boolean
  if ('enabled' in obj && !('enabled_users' in obj)) {
    return {
      enabled_users: Boolean(obj.enabled),
      enabled_staff: false,
      message: (obj.message as string) || DEFAULT_SETTINGS.message,
    };
  }

  return {
    enabled_users: Boolean(obj.enabled_users),
    enabled_staff: Boolean(obj.enabled_staff),
    message: (obj.message as string) || DEFAULT_SETTINGS.message,
  };
}

export function useMaintenanceMode() {
  const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        if (!error && data && isMounted) {
          setSettings(parseSettings(data.value));
        }
      } catch (err) {
        console.error('Failed to fetch maintenance status:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel('maintenance-mode')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: 'key=eq.maintenance_mode',
        },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            setSettings(parseSettings(payload.new.value));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const updateMaintenanceMode = async (
    updates: Partial<MaintenanceSettings>
  ) => {
    const newSettings = { ...settings, ...updates };
    const { error } = await supabase
      .from('site_settings')
      .upsert(
        {
          key: 'maintenance_mode',
          value: newSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) throw error;
    setSettings(newSettings);
  };

  return {
    // Backward-compat aliases
    isMaintenanceMode: settings.enabled_users,
    maintenanceMessage: settings.message,
    // New granular values
    enabledUsers: settings.enabled_users,
    enabledStaff: settings.enabled_staff,
    loading,
    updateMaintenanceMode,
    // Legacy (still used by AdminPage)
    toggleMaintenanceMode: async (enabled: boolean, message?: string) => {
      await updateMaintenanceMode({
        enabled_users: enabled,
        enabled_staff: enabled ? settings.enabled_staff : false,
        ...(message ? { message } : {}),
      });
    },
  };
}
