# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Security configuration (Cloudflare + Turnstile)

This project expects Cloudflare to sit in front of the app and uses Turnstile for bot protection.

### Required environment variables

Set the following environment variables (no hardcoded secrets):

- `TURNSTILE_SITE_KEY` (public site key used by the frontend)
- `TURNSTILE_SECRET_KEY` (server-side secret used by Supabase Edge Functions)
- `DISCORD_BOT_TOKEN` (required for `send-session-webhook` and any Bot API messaging flow)
- `DISCORD_SESSION_CHANNEL_ID` (target channel for session announcements sent by Bot API)

### Discord session delivery policy

- **Messages that must include buttons/components must go through `supabase/functions/send-session-webhook/index.ts` only.**
- `supabase/functions/discord-webhook/index.ts` is a deprecated legacy endpoint and now returns a migration error instead of sending Discord messages.
- Legacy/plain Discord webhooks may still be used by unrelated automations that do not need buttons, but session announcement flows must use the Bot API path above.

### Recommended Cloudflare rate limiting rules

These rules complement the lightweight in-app limits and should be configured in Cloudflare:

- `/login` (or the Discord auth endpoint) → **5 requests per minute per IP**
- `/register` (if added in the future) → **3 requests per minute per IP**
- `/api/*` or message/session submission endpoints → **10-20 requests per minute per IP**

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Redeem/points API (Google Apps Script)

If you are using Google Apps Script for the points/redeem API, you can deploy the script in
`apps-script/points_api.gs`. It supports:

- user actions (`get`, `add`, `sub`, `set`, `reset`, `redeem`)
- admin actions (`admin_list_codes`, `admin_upsert_code`, `admin_toggle_code`, `admin_disable_code`)

Deploy it as a web app and set `VITE_POINTS_API_URL` to the published URL.
