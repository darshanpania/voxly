# Deploying the Voxly backend (Vercel Hobby, free)

The backend is a Fastify app. Vercel deploys it with zero config as one
Vercel Function on Fluid compute (entrypoint: `src/index.ts`). The Hobby plan
is free for personal, non-commercial use.

Database and auth stay on Supabase (free plan). The function runs in `bom1`
(Mumbai), next to the Supabase `ap-south-1` region. Change `regions` in
`vercel.json` if the Supabase project lives elsewhere.

## One-time setup

1. In Vercel, click **Add New → Project** and import `darshanpania/voxly`.
2. Set **Root Directory** to `backend`. Leave the framework on auto-detect.
3. Add these environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase pooled URL (port 6543) + `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | Supabase session/direct URL (port 5432), used by migrations |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
   | `SUPABASE_JWT_SECRET` | Supabase JWT secret |
   | `OPENAI_API_KEY` | OpenAI key |
   | `VOXLY_*` (optional) | Model overrides, see `src/services/aiModels.ts` |

4. Deploy. Production builds run `prisma migrate deploy`; preview builds do not
   touch the database schema.
5. Check `https://<project>.vercel.app/health` returns `{"status":"ok"}`.
6. Set `VITE_API_URL` in the web app to the new backend URL.

## Limits to know

- Request and response bodies max out at 4.5 MB. Voice clips are far smaller,
  but the 10 MB multipart limit in `src/routes/audio.ts` is not reachable here.
- A request (including an SSE stream) can run for 300 s max.
- The in-memory rate limiter is per function instance, not global.

## Run it anywhere else

`npm run build && npx prisma migrate deploy && npm start` still works on any
Node 22 host (Render, Cloud Run, a VM).
