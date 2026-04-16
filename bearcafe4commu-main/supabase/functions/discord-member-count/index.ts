import { discordFetch } from "../_shared/discord-fetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    const DISCORD_GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

    if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
      console.error('Missing Discord configuration');
      return new Response(
        JSON.stringify({ error: 'Missing Discord configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch guild info from Discord API
    const response = await discordFetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch guild info' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const guildData = await response.json();
    
    console.log('Guild data fetched successfully:', {
      name: guildData.name,
      member_count: guildData.approximate_member_count,
      presence_count: guildData.approximate_presence_count,
    });

    return new Response(
      JSON.stringify({
        member_count: guildData.approximate_member_count || 0,
        online_count: guildData.approximate_presence_count || 0,
        guild_name: guildData.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Discord member count:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
