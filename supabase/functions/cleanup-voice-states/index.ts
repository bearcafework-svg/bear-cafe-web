import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting cleanup of stale voice states...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get threshold from request body or use default (15 minutes)
    let thresholdMinutes = 15;
    try {
      const body = await req.json();
      if (body?.threshold_minutes && typeof body.threshold_minutes === 'number') {
        thresholdMinutes = Math.max(5, Math.min(30, body.threshold_minutes)); // Clamp between 5-30 minutes
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Calculate the threshold timestamp
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    console.log(`Cleaning up voice states older than ${thresholdMinutes} minutes (before ${thresholdTime})`);

    // First, delete records where channel_id is null (should have been deleted but wasn't)
    const { data: nullChannelRecords, error: nullError } = await supabase
      .from('voice_states')
      .delete()
      .is('channel_id', null)
      .select('discord_user_id, channel_name, updated_at');

    if (nullError) {
      console.error('Error cleaning up null channel records:', nullError);
    } else {
      console.log(`Deleted ${nullChannelRecords?.length || 0} records with null channel_id`);
    }

    // Then, delete stale records where updated_at is older than threshold
    const { data: staleRecords, error: staleError } = await supabase
      .from('voice_states')
      .delete()
      .lt('updated_at', thresholdTime)
      .select('discord_user_id, channel_name, updated_at');

    if (staleError) {
      console.error('Error cleaning up stale records:', staleError);
      return new Response(
        JSON.stringify({ success: false, error: staleError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const deletedRecords = [...(nullChannelRecords || []), ...(staleRecords || [])];
    const deletedCount = deletedRecords.length;
    
    console.log(`Successfully cleaned up ${deletedCount} stale voice state records`);

    if (deletedCount > 0) {
      console.log('Deleted records:', JSON.stringify(deletedRecords, null, 2));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: deletedCount,
        threshold_minutes: thresholdMinutes,
        message: `Cleaned up ${deletedCount} stale voice state records`,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
