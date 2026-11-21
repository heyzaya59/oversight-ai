<div align="center">

# ◉ Oversight

**Open-source AI agents for your website — and the free scanner that proves they work.**

*Content · AEO/SEO · Accessibility · Security. Every change approved by a human.*

[Live demo](https://heyzaya59.github.io/oversight-ai/) · [Report an issue](https://github.com/heyzaya59/oversight-ai/issues) · AGPL-3.0

</div>

---

Most "AI agent" vendors are a black box: no team, no code, no proof — just a contact form and a monthly invoice. Oversight is the opposite. **The scanner engine is open source.** Run it yourself, read every check, verify every score. The only thing we charge for is doing the work for you.

## What it does

Point the scanner at any public URL and four agents audit it in real time, each returning a 0–100 score, a letter grade, and specific findings:

| Agent | Checks |
|-------|--------|
| **AEO / SEO** | Title & meta description, single H1, JSON-LD structured data, FAQ/HowTo schema (for AI Overviews), canonical, `llms.txt`, Open Graph |
| **Accessibility** | `<html lang>`, image alt text, document title, zoom not disabled (WCAG 1.4.4), landmark regions, labelled form inputs, skip-to-content link |
| **Security** | HTTPS/TLS, HSTS, Content-Security-Policy, X-Content-Type-Options, clickjacking protection, Referrer-Policy, Permissions-Policy, version leakage |
| **Social** | `og:title`, `og:description`, `og:image`, `twitter:card` |

No login, no rate card, no "book a demo." You see the findings before you ever talk to us.

## Why it's trustworthy

- **Open source (AGPL-3.0).** Every check is in [`api/scan.js`](api/scan.js). No hidden scoring, no inflated numbers.
- **It runs on real data.** The scanner fetches your live page and inspects the actual HTML and response headers — not a cached guess.
- **Calibrated.** Representative scores: `example.com` 27 · `github.com` 88 · `stripe.com` 87. A well-built site should score in the 80s+.

## Run it yourself

The engine has **zero dependencies** — just Node 18+ (built-in `fetch`).

```bash
git clone https://github.com/heyzaya59/oversight-ai
cd oversight-ai

# Option A — deploy the whole thing (site + scanner API) to Vercel
vercel

# Option B — run locally
npx vercel dev          # serves index.html + /api/scan
# then open http://localhost:3000 and scan a URL
```

The API is a single serverless function:

```
GET /api/scan?url=example.com
→ { overall, overallGrade, agents: { "AEO / SEO": {score, grade, checks[]}, ... } }
```

## Self-host vs. hosted

- **Self-host** — free, forever. Clone it, deploy it, use it on your own sites. That's the point of open source.
- **Hosted ([oversight](https://heyzaya59.github.io/oversight-ai/))** — a free account unlocks full reports, scan history, and continuous monitoring. The paid tiers add the agents that *fix* what the scan finds (remediation, WCAG work, ongoing defense) with a human approving every change.

Free diagnosis. Paid treatment. The diagnosis is open.

## Project layout

```
index.html      — marketing site + live scanner UI (single file, responsive)
api/scan.js     — the open-source scanner engine (serverless function)
vercel.json     — clean URLs + function config
```

## Contributing

New checks are very welcome — especially AEO signals (the space is moving fast) and WCAG 2.2 coverage. Open a PR against `api/scan.js`; keep checks dependency-free and fail-open (never crash a scan on a weird site).

## License

[AGPL-3.0](LICENSE). You can self-host and modify freely. If you run a modified version as a network service, you must share your source. Commercial hosting of the service is reserved — talk to us.

<div align="center"><sub>Human-in-the-loop is not a temporary scaffold. It is the product.</sub></div>
