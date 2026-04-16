import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceState {
  discord_user_id: string;
  channel_id: string | null;
  channel_name: string | null;
  is_connected: boolean;
  joined_at: string | null;
}

export function useVoiceState(discordUserId: string | null) {
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!discordUserId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    async function fetchVoiceState() {
      const { data, error } = await supabase
        .from('voice_states')
        .select('*')
        .eq('discord_user_id', discordUserId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching voice state:', error);
      }
      
      setVoiceState(data as VoiceState | null);
      setIsLoading(false);
    }

    fetchVoiceState();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`voice-state-${discordUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_states',
          filter: `discord_user_id=eq.${discordUserId}`,
        },
        (payload) => {
          console.log('Voice state update received:', payload);
          if (payload.eventType === 'DELETE') {
            setVoiceState(null);
          } else {
            setVoiceState(payload.new as VoiceState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [discordUserId]);

  return { voiceState, isLoading };
}
