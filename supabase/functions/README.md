# Edge Functions Local Development Setup

## Prerequisites

- Node.js and npm installed
- Docker Desktop running (required for Supabase local)

## Setup Instructions

### 1. Copy Environment Variables

Copy the example environment file and fill in the secrets:

```bash
cp .env.example .env
```

### 2. Get Discord Credentials

Ask your team lead for these values and add them to `.env`:
- `DISCORD_CLIENT_SECRET` - From Discord Developer Portal
- `DISCORD_BOT_TOKEN` - Already in example, but verify it's current

### 3. Configure Discord Application

**Important:** The Discord Application must have the redirect URI configured.

Go to: https://discord.com/developers/applications/998239118372917278/oauth2

Add these redirect URIs:
- `http://localhost:8080/auth/callback`
- `http://127.0.0.1:8080/auth/callback`

### 4. Start Supabase

```bash
npm run supabase:start
```

This will:
- Start local Supabase services (PostgreSQL, Auth, Storage, Edge Functions)
- Apply all migrations
- Serve edge functions at `http://127.0.0.1:54321/functions/v1/`

### 5. Start the Frontend

In a separate terminal:

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## Troubleshooting

### "name resolution failed" error

This was fixed by removing the problematic `esm-sh.d.ts` type reference from `deno.json`. If you see this error:
1. Make sure you have the latest `deno.json` from git
2. Restart Supabase: `npm run supabase:stop && npm run supabase:start`

### "invalid OAuth2 redirect_uri" error

The redirect URI is not configured in Discord. Ask an admin to add `http://localhost:8080/auth/callback` to the Discord Application OAuth2 settings.

### Edge function boot errors

Check the logs:
```bash
docker logs supabase_edge_runtime_itulsrbsluwdqwakldjs
```

## Useful Commands

```bash
# Stop Supabase
npm run supabase:stop

# Check Supabase status
npm run supabase:status

# Reset database (WARNING: deletes all local data)
npm run supabase:reset
```

## Notes

- The `.env` file is gitignored for security
- Local Supabase uses default keys (safe for development only)
- All services bind to `0.0.0.0` (network-accessible, not just localhost)
