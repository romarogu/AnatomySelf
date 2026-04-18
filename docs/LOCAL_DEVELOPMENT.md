# Local Development (Single Source of Truth)

This document is the canonical local development guide for this repository.
If any other document conflicts with this file, follow this file.

## 1) Current recommended architecture

- Frontend: Vite + React (`src/*`)
- API: Vercel Serverless Functions (`api/*.js`)
- Data/Auth: Supabase

Local flow:

```text
Vite dev server (:3000)
  -> proxy /api to :4000
  -> Vercel local functions (`vercel dev --listen 4000`)
```

## 2) Prerequisites

- Node.js 20+
- npm

No global Vercel CLI install is required because this guide uses `npx vercel`.

## 3) Install dependencies

```bash
npm install
```

## 4) Environment variables

Create local env file:

```bash
cp .env.example .env.local
```

At minimum, configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
- `ZHIPU_API_KEY` (recommended main provider)

Optional fallbacks:

- `DEEPSEEK_API_KEY`
- `CLAUDE_API_KEY`

Optional KV settings (only for `api/user-data.js`):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

## 5) Start local development (recommended)

Run in two terminals:

Terminal 1 (local serverless API on :4000):

```bash
npx vercel dev --listen 4000
```

Terminal 2 (frontend on :3000):

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## 6) Build and preview

```bash
npm run build
npm run preview
```

## 7) Legacy fallback: local Express mode (non-default)

`server/index.js` is a legacy/local fallback path and is not the default workflow.

```bash
node server/index.js
```

Notes:

- This mode depends on packages like `express`, `cors`, `multer`, `better-sqlite3`.
- Keep using the serverless workflow above unless you are explicitly debugging legacy Express behavior.
