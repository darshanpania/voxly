# Voxly — Local Setup Guide

Voxly is a voice-first language tutor. You speak in the language you're learning, the app transcribes you, an LLM tutor replies with corrections and feedback, and the reply is spoken back to you. It also tracks vocabulary with spaced repetition (FSRS) and shows progress stats.

This guide gets the whole app running on your machine from scratch.

## What's in the repo

This is an npm-workspaces monorepo orchestrated by [Turborepo](https://turbo.build):

| Path | What it is |
| --- | --- |
| `apps/web` | React 18 + Vite + Tailwind CSS 4 frontend (chat, progress, vocabulary, history pages) |
| `backend` | Fastify 5 API server — auth, sessions, audio transcription/synthesis, progress tracking |
| `backend/prisma` | Prisma schema + migrations for a PostgreSQL database |
| `packages/core` | Shared TypeScript types and API client code |
| `packages/ui` | Shared UI package |

External services the app talks to:

- **Supabase** — user authentication (email login) *and* the PostgreSQL database
- **OpenAI** — Whisper (`whisper-1`) for speech-to-text, `tts-1` for text-to-speech, and a chat model for the tutor's replies

## Prerequisites

- **Node.js 20 or newer** (the repo is developed on Node 22) — check with `node --version`
- **npm 10+** (comes with recent Node) — the repo pins `npm@10.9.4` via the `packageManager` field
- **Git**
- A free **Supabase** account ([supabase.com](https://supabase.com))
- An **OpenAI API key** ([platform.openai.com](https://platform.openai.com)) with a few dollars of credit — needed for the voice + tutor features

## 1. Clone and install

```bash
git clone https://github.com/darshanpania/voxly.git
cd voxly
npm install
```

`npm install` at the root installs every workspace (frontend, backend, packages) in one go.

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any name/region and set a database password (save it — you'll need it for the connection strings).
2. Once the project is ready, collect these values:
   - **Project URL** and **anon key**: Project Settings → API (`https://<ref>.supabase.co` and the `anon` public key)
   - **service_role key**: same page, under "Project API keys" (keep this secret)
   - **JWT secret**: Project Settings → API → JWT Settings
   - **Connection strings**: Project Settings → Database → Connection string. You need two:
     - `DATABASE_URL` — the **pooled** connection (port `6543`, "Transaction" mode; add `?pgbouncer=true` if Supabase shows it)
     - `DIRECT_URL` — the **direct** connection (port `5432`, "Session" mode). Prisma uses this one for migrations.
3. Enable email auth: Authentication → Providers → Email should be on by default. For quick local testing you can turn **off** "Confirm email" so sign-ups work instantly.

## 3. Configure environment variables

Two `.env` files, one per app. Templates are provided.

**Backend** — `backend/.env` (copy from `backend/.env.example`):

```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_JWT_SECRET=<jwt secret>
DATABASE_URL=<pooled connection string, port 6543>
DIRECT_URL=<direct connection string, port 5432>
OPENAI_API_KEY=sk-...
PORT=3001
# Optional, local dev only — see "Dev auth bypass" below
ALLOW_DEV_AUTH=
```

The backend validates all of these at startup with Zod (`backend/src/env.ts`) — if anything is missing it exits immediately with a clear error, which is the first thing to check if the server won't boot.

**Frontend** — `apps/web/.env` (copy from `apps/web/.env.example`):

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_URL=http://localhost:3001
```

## 4. Set up the database

From the repo root:

```bash
cd backend
npm run db:generate   # generates the Prisma client
npm run db:migrate    # applies migrations to your Supabase Postgres
cd ..
```

`db:migrate` runs `prisma migrate dev`, which applies the committed migrations (users, sessions, messages, vocabulary with FSRS fields, etc.). If it complains about connectivity, double-check that `DIRECT_URL` is the port-5432 direct connection.

## 5. Run the app

From the repo root:

```bash
npm run dev
```

Turborepo starts everything: the backend on **http://localhost:3001** (with `tsx watch` hot reload) and the Vite frontend on **http://localhost:5173**.

Verify the backend is up:

```bash
curl http://localhost:3001/health
```

Then open http://localhost:5173, sign up with an email/password (this creates a Supabase auth user), and start a conversation. Your browser will ask for microphone permission the first time you record.

## Dev auth bypass (optional)

If you don't want to deal with Supabase auth while hacking on the backend, set this in `backend/.env`:

```bash
ALLOW_DEV_AUTH=true
```

The backend then accepts unauthenticated requests as a hardcoded `dev-user-000` (see `backend/src/middleware/auth.ts`). It fails closed — anything other than the exact string `"true"` keeps real JWT verification on. **Never set this in a deployed environment.**

## Where things live (orientation for making changes)

| You want to change… | Look in… |
| --- | --- |
| Speech-to-text | `backend/src/services/sttService.ts` |
| Text-to-speech (voice choice, format) | `backend/src/services/ttsService.ts` |
| The tutor LLM (prompt, model, response schema, streaming) | `backend/src/services/llmService.ts` |
| Audio HTTP endpoints (`/audio/transcribe`, `/audio/synthesize`) | `backend/src/routes/audio.ts` |
| Conversation flow, incl. the SSE streaming endpoint | `backend/src/routes/sessions.ts` |
| Spaced repetition / vocab tracking | `backend/src/services/fsrs.ts`, `progressService.ts` |
| The chat UI and recording logic | `apps/web/src/pages/ConversationPage.tsx`, `apps/web/src/hooks` |
| Database schema | `backend/prisma/schema.prisma` (run `db:migrate` after edits) |

## Troubleshooting

- **Backend exits immediately with a Zod error** — an env var in `backend/.env` is missing or malformed. The error names the field.
- **`prisma migrate dev` hangs or fails** — you're probably using the pooled (6543) URL as `DIRECT_URL`. Migrations need the direct 5432 connection.
- **401s from the API** — your Supabase session expired or `SUPABASE_JWT_SECRET` doesn't match the project. Re-login, or use `ALLOW_DEV_AUTH=true` locally.
- **429 Too Many Requests** — the backend rate-limits to 60 requests/minute per user/IP (`backend/src/index.ts`). Normal usage won't hit it; rapid scripted testing might.
- **Mic recording does nothing** — the browser only exposes the microphone on `localhost` or HTTPS, and you must accept the permission prompt.
- **STT/TTS errors** — check your OpenAI key has credit; Whisper and TTS calls fail with 401/429 from OpenAI otherwise.
