import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface VoiceStateUpdate {
  event: 'VOICE_STATE_UPDATE';
  data: {
    user_id: string;
    channel_id: string | null;
    channel_name: string | null;
    guild_id: string;
  };
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret (optional but recommended)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('DISCORD_VOICE_WEBHOOK_SECRET');
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: VoiceStateUpdate = await req.json();
    
    console.log('Received voice state update:', JSON.stringify(payload));

    if (payload.event !== 'VOICE_STATE_UPDATE') {
      return new Response(
        JSON.stringify({ error: 'Unknown event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, channel_id, channel_name, guild_id } = payload.data;

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CASE B: User left voice channel
    // แก้ไข: ใช้ !channel_id เพื่อดักทั้ง null, undefined และ string ว่าง
    if (!channel_id) {
      const { error } = await supabase
        .from('voice_states')
        .delete()
        .eq('discord_user_id', user_id);

      if (error) {
        console.error('Error deleting voice state:', error);
        return new Response(
          JSON.stringify({ error: 'Database error', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Voice state deleted for user ${user_id}: left channel`);

      return new Response(
        JSON.stringify({ success: true, user_id, action: 'deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CASE A: User joined/moved to a channel (channel_id is present) -> UPSERT
    // First, check if user already has a record and what channel they were in
    const { data: existingRecord } = await supabase
      .from('voice_states')
      .select('channel_id, joined_at')
      .eq('discord_user_id', user_id)
      .maybeSingle();

    // Determine joined_at value:
    // - If no existing record OR channel changed -> set to now()
    // - If same channel (duplicate event like mute/deafen) -> keep existing joined_at
    const shouldUpdateJoinedAt = !existingRecord || existingRecord.channel_id !== channel_id;
    const joinedAt = shouldUpdateJoinedAt ? new Date().toISOString() : existingRecord.joined_at;

    const { error } = await supabase
      .from('voice_states')
      .upsert({
        discord_user_id: user_id,
        channel_id: channel_id,
        channel_name: channel_name,
        guild_id: guild_id,
        is_connected: true,
        joined_at: joinedAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'discord_user_id',
      });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const action = shouldUpdateJoinedAt ? (existingRecord ? 'moved' : 'joined') : 'updated';
    console.log(`Voice state ${action} for user ${user_id}: channel ${channel_name}`);

    return new Response(
      JSON.stringify({ success: true, user_id, action, channel_name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in discord-voice-webhook:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
