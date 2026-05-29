# RunTable local workflow

This repo is wired for a local edit -> build check -> push to GitHub main -> Vercel deployment flow.

## First-time setup

```powershell
.\scripts\setup_local.ps1
```

Fill in `.env` after the script creates it. Keep real secrets out of Git.

Required local and Vercel variables:

```env
VITE_SUPABASE_URL=https://otvlvdjjtuhobeslcvwr.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Required Supabase Edge Function secret:

```env
DEEPSEEK_API_KEY=...
```

## Daily development

```powershell
npm run dev
```

Open `http://localhost:5173`.

## Publish to GitHub main

```powershell
.\scripts\publish_main.ps1 -Message "Describe the change"
```

The script fetches `origin/main`, fast-forwards if possible, runs `npm run build`, commits all changes, and pushes to `origin/main`.

## Supabase deploy

```powershell
$env:DEEPSEEK_API_KEY="your_deepseek_api_key"
.\scripts\deploy_supabase.ps1
```

The script links project `otvlvdjjtuhobeslcvwr`, sets the Edge Function secret when available, pushes migrations, and deploys `ask-ai`.

## Vercel link and deploy

```powershell
.\scripts\deploy_vercel.ps1
```

This links the local checkout to `meta-virgos-projects/run-table`, pulls Vercel env values into `.env.local`, and lists configured env vars.

To deploy immediately:

```powershell
.\scripts\deploy_vercel.ps1 -DeployProd
```

Pushing to GitHub `main` can also trigger Vercel automatically when the Git integration is enabled.
