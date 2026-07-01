import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VOICE_STALE_MINUTES = 20;
const POLL_INTERVAL_MS = 15 * 60 * 1000;

export function useActiveVoiceCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const threshold = new Date(
      Date.now() - VOICE_STALE_MINUTES * 60 * 1000,
    ).toISOString();

    const fetchCount = async () => {
      const { count: voiceCount } = await supabase
        .from('voice_states')
        .select('discord_user_id', { count: 'exact', head: true })
        .eq('is_connected', true)
        .not('channel_id', 'is', null)
        .gte('updated_at', threshold);

      if (mounted) setCount(voiceCount ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);

    const channel = supabase
      .channel('active-voice-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_states' },
        fetchCount,
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
