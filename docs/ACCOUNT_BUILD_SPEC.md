# Oversight — Account / Auth Build Spec

Status: **proposed, awaiting greenlight** · Owner: Zaya · Nov 21 2026

Goal: turn the free scanner into a lead-generating funnel without killing top-of-funnel. Open-source engine stays free to self-host; the **hosted** product gates value behind a free account.

## The funnel (what gates what)

| Tier | Who | Gets | We capture |
|------|-----|------|-----------|
| **Anonymous** | anyone, no signup | **1 scan / day**, score + grade only (no detailed fixes) | nothing (the hook) |
| **Free account** | email signup | Full reports w/ every finding & fix, scan history, up to ~10 scans/day, 1 saved site | email, sites, usage |
| **Paid** | card | Continuous monitoring + alerts, the agents that *fix* findings, multi-site, white-label | revenue |

The anonymous taste keeps the tool shareable and SEO/AEO-friendly; the account wall sits in front of the *detailed* report, which is exactly what a motivated visitor wants.

## Architecture

Static front end stays; add a thin backend. Recommended stack (fast, cheap, low-maintenance):

- **Host:** Vercel (already the target for `/api/scan`).
- **Auth + DB:** **Supabase** (Postgres + hosted auth). Magic-link email + Google OAuth. Generous free tier; one dashboard.
- **Rate limiting:** **Upstash Redis** (serverless, free tier) keyed by IP (anon) and user id (account) — protects the scanner from abuse.
- **Email:** Supabase built-in for magic links; **Resend** for product email (welcome, "your site dropped to a C", upsell).

No new language — all JS/serverless, same as today.

## Data model (minimal)

```
users         (id, email, created_at, plan)           ← Supabase auth + profile row
sites         (id, user_id, url, created_at)           ← saved sites a user monitors
scans         (id, user_id|null, url, overall, grade,
               agents_json, created_at, ip_hash)       ← every scan, for history + analytics
rate_limits   (handled in Redis, not Postgres)
```

## API changes

- `GET /api/scan` — add: resolve caller (session cookie or anon), enforce rate limit, **strip `checks[]` detail for anonymous** (return scores only), persist the scan row. Return `{ ...scores, locked: true }` for anon so the UI can show the upsell.
- `POST /api/auth/*` — Supabase handles (magic link / OAuth callback).
- `GET /api/history` — a user's past scans (account only).
- `POST /api/sites` / `GET /api/sites` — save/list monitored sites (account only).
- (later) a cron that re-scans saved sites daily and emails on grade drops → the monitoring product.

## Front-end changes

- Scan result for anon: show the four scores + overall, blur/lock the detailed findings with a **"Create a free account to see every fix"** CTA.
- Add `/login` (magic link + Google button), a lightweight `/dashboard` (history + saved sites), and an account menu in the nav.
- Keep everything in the current design system (amber/teal/paper).

## Effort estimate

| Phase | Scope | Rough effort |
|-------|-------|--------------|
| 0 | Vercel deploy of current site + live public scanner | ~30 min *(needs your Vercel login/token)* |
| 1 | Supabase project, auth (magic link + Google), users table | ~0.5 day |
| 2 | Gate scanner (anon scores-only + rate limiting), persist scans | ~0.5 day |
| 3 | Dashboard: history + saved sites | ~0.5–1 day |
| 4 | Monitoring cron + email alerts (the paid hook) | ~1 day |
| 5 | Stripe billing for paid tiers | ~1 day |

Phases 1–3 get you the lead-capturing free product. 4–5 turn it into revenue.

## What I need from you to start

1. **Vercel** login or token (unblocks phase 0 — live public scanner today).
2. Go/no-go on **Supabase** as the auth/DB (or name a preference — Clerk/Auth0/Firebase all work).
3. Confirm the gating line: **anonymous = scores only, account = full fixes.** (My recommendation.)

Say go and I start at phase 1.
