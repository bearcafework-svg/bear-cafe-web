const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Channel {
  id: string;
  name: string;
  type: number;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!botToken || !guildId) {
      throw new Error('Discord not configured');
    }

    console.log('Fetching voice channels for guild:', guildId);

    // Get all channels from guild
    const channelsResponse = await fetch(
      `https://discord.com/api/guilds/${guildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error('Failed to get channels:', channelsResponse.status, errorText);
      throw new Error('Failed to get channels');
    }

    const channels: Channel[] = await channelsResponse.json();
    // Type 2 = Voice Channel, Type 13 = Stage Channel
    const voiceChannels = channels.filter(c => c.type === 2 || c.type === 13);

    console.log('Found voice channels:', voiceChannels.length);

    return new Response(
      JSON.stringify({
        voiceChannels: voiceChannels.map(c => ({
          id: c.id,
          name: c.name,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in discord-voice-state:', message);
    return new Response(
      JSON.stringify({ error: message, voiceChannels: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
