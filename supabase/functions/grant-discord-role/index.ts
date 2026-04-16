 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
     // Parse request body
     const body = await req.json();
     const { discordUserId, discordRoleId } = body;
 
     if (!discordUserId || !discordRoleId) {
       return new Response(
         JSON.stringify({ error: 'Missing discordUserId or discordRoleId' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Verify the user making the request
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: 'Missing authorization header' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Verify JWT
     const token = authHeader.replace('Bearer ', '');
     const { data: { user }, error: authError } = await supabase.auth.getUser(token);
     
     if (authError || !user) {
       return new Response(
         JSON.stringify({ error: 'Invalid token' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get user's discord_id from metadata to verify they're granting to themselves
     const userDiscordId = user.user_metadata?.discord_id || user.user_metadata?.provider_id;
     if (!userDiscordId) {
       return new Response(
         JSON.stringify({ error: 'No Discord ID found in user profile' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Security: Only allow users to grant roles to themselves
     if (userDiscordId !== discordUserId) {
       return new Response(
         JSON.stringify({ error: 'Cannot grant role to another user' }),
         { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get Discord bot credentials
     const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
     const guildId = Deno.env.get('DISCORD_GUILD_ID');
 
     if (!botToken || !guildId) {
       console.error('Discord configuration missing');
       return new Response(
         JSON.stringify({ error: 'Discord configuration missing' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Grant the role via Discord API
     const discordResponse = await discordFetch(
       `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${discordRoleId}`,
       {
         method: 'PUT',
         headers: {
           'Authorization': `Bot ${botToken}`,
           'Content-Type': 'application/json',
         },
       }
     );
 
     if (!discordResponse.ok) {
       const errorText = await discordResponse.text();
       console.error('Discord API error:', discordResponse.status, errorText);
       
       // Handle specific Discord errors
       if (discordResponse.status === 404) {
         return new Response(
           JSON.stringify({ error: 'user_not_in_guild', message: 'ไม่พบผู้ใช้ในเซิร์ฟเวอร์ Discord' }),
           { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       if (discordResponse.status === 403) {
         return new Response(
           JSON.stringify({ error: 'bot_permission_denied', message: 'Bot ไม่มีสิทธิ์แอดยศนี้' }),
           { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
 
       return new Response(
         JSON.stringify({ error: 'discord_api_error', message: 'ไม่สามารถแอดยศได้' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log(`Successfully granted role ${discordRoleId} to user ${discordUserId}`);
 
     return new Response(
       JSON.stringify({ success: true, message: 'ได้รับยศเรียบร้อยแล้ว' }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error granting Discord role:', error);
     return new Response(
       JSON.stringify({ error: 'Internal server error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });