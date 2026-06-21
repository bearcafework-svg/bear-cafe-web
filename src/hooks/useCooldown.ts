import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from './useNotifications';
import { useAuth } from '@/lib/auth-context';

const COOLDOWN_MINUTES = 15;

interface CooldownState {
  isOnCooldown: boolean;
  remainingSeconds: number;
  remainingMinutes: number;
  formattedTime: string;
  lastSessionAt: Date | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useCooldown(userId: string | null): CooldownState {
  const { user } = useAuth();
  const isAdmin = user?.is_admin ?? false;
  const isOwner = user?.is_owner ?? false;
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [lastSessionAt, setLastSessionAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const wasOnCooldownRef = useRef(false);
  
  const { notifyCooldownEnd } = useNotifications();

  const fetchLastSession = useCallback(async () => {
    // Admins and Owners bypass cooldown
    if (isAdmin || isOwner) {
      setIsOnCooldown(false);
      setRemainingSeconds(0);
      wasOnCooldownRef.current = false;
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: lastSession, error } = await supabase
        .from('sessions')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching last session for cooldown:', error);
        setIsLoading(false);
        return;
      }

      if (lastSession) {
        const lastCreatedAt = new Date(lastSession.created_at);
        setLastSessionAt(lastCreatedAt);
        
        const now = Date.now();
        const elapsedMs = now - lastCreatedAt.getTime();
        const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
        
        if (elapsedMs < cooldownMs) {
          setIsOnCooldown(true);
          wasOnCooldownRef.current = true;
          setRemainingSeconds(Math.ceil((cooldownMs - elapsedMs) / 1000));
        } else {
          setIsOnCooldown(false);
          setRemainingSeconds(0);
        }
      } else {
        setIsOnCooldown(false);
        setRemainingSeconds(0);
        setLastSessionAt(null);
      }
    } catch (err) {
      console.error('Cooldown check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAdmin, isOwner]);

  // Initial fetch
  useEffect(() => {
    fetchLastSession();
  }, [fetchLastSession]);

  // Countdown timer
  useEffect(() => {
    if (!isOnCooldown || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsOnCooldown(false);
          // Notify when cooldown ends (only if user was previously on cooldown)
          if (wasOnCooldownRef.current) {
            notifyCooldownEnd();
            wasOnCooldownRef.current = false;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnCooldown, remainingSeconds, notifyCooldownEnd]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isOnCooldown,
    remainingSeconds,
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    formattedTime: formatTime(remainingSeconds),
    lastSessionAt,
    isLoading,
    refresh: fetchLastSession,
  };
}
