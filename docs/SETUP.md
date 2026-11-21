# Oversight — Go-Live Setup

Everything is built. To make the hosted product live (real public scanner + accounts) takes two services and a handful of env vars.

## 1. Deploy to Vercel (makes the live scanner public)

```bash
vercel login          # one-time, interactive
vercel --prod         # from the repo root
```

The static site + all `/api/*` serverless functions deploy together. After this, the public scanner works for real (no more sample fallback) and rate limiting is active.

## 2. Supabase (adds accounts + history + saved sites)

1. Create a project at supabase.com (free tier is plenty to start).
2. SQL editor → paste & run [`docs/schema.sql`](schema.sql) (creates `sites` + `scans` with RLS).
3. Authentication → Providers → enable **Email** (magic link) and **Google** (OAuth; add client id/secret).
4. Authentication → URL config → add the Vercel domain to redirect allow-list.

## 3. Set env vars in Vercel (Project → Settings → Environment Variables)

| Var | Where to find it | Needed for |
|-----|------------------|-----------|
| `SUPABASE_URL` | Supabase → Project Settings → API | accounts |
| `SUPABASE_ANON_KEY` | same page (anon/public key) | accounts |
| `SUPABASE_SERVICE_KEY` | same page (service_role key — **secret**) | server DB writes |
| `UPSTASH_REDIS_REST_URL` | Upstash (optional) | durable rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash (optional) | durable rate limiting |
| `SCAN_RATE_LIMIT` | optional, default `12` | anon scans / 10 min |
| `SCAN_RATE_LIMIT_USER` | optional, default `60` | account scans / 10 min |
| `SCAN_RATE_WINDOW` | optional, default `600` | window seconds |

Redeploy after setting them. That's it — accounts, gating, history, and saved sites all come online automatically (the code no-ops gracefully until these exist, so nothing breaks before then).

## What works without any of this

The static marketing site + scanner UI run on GitHub Pages today (scanner shows a labeled sample until step 1). Steps 1–3 turn on the real product.

## Still to build (phase 4–5, on request)

- **Monitoring cron** — daily re-scan of saved sites + email alert on grade drop (the paid hook). Needs a Vercel Cron + Resend API key.
- **Stripe billing** — paid tiers. Needs Stripe keys + webhook.
