// Oversight — free site scanner.
// Fetches a target URL server-side and runs real checks across four agents:
// AEO/SEO, Accessibility (WCAG heuristics), Security (headers/TLS), Social.
// No external deps — lightweight HTML parsing via regex so it deploys cold.

function clampUrl(raw) {
  let u = (raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    // block obvious SSRF to internal hosts
    const h = parsed.hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1)/i.test(h)) return null;
    return parsed;
  } catch { return null; }
}

const has = (re, s) => re.test(s);
const countMatches = (re, s) => (s.match(re) || []).length;
const attr = (tag, name) => {
  const m = tag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', "i"));
  return m ? m[1] : null;
};

function grade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  return "F";
}

// ---- AEO / SEO ----
function scanSeo(html, headTags, llmsTxtOk) {
  const checks = [];
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
  checks.push(["Title tag", !!title, title ? `“${title.slice(0, 60)}” (${title.length} chars)` : "Missing — the #1 ranking + AI-citation signal"]);
  const descTag = headTags.find(t => /name\s*=\s*["']description["']/i.test(t));
  const desc = descTag ? attr(descTag, "content") : null;
  checks.push(["Meta description", !!desc && desc.length >= 50, desc ? `${desc.length} chars` : "Missing — AI answer engines summarize from this"]);
  const h1 = countMatches(/<h1[\b>]/gi, html);
  checks.push(["Single H1", h1 === 1, h1 === 0 ? "No H1 found" : h1 === 1 ? "Exactly one — good" : `${h1} H1s — dilutes topic clarity`]);
  const jsonld = countMatches(/<script[^>]+application\/ld\+json/gi, html);
  checks.push(["JSON-LD structured data", jsonld > 0, jsonld > 0 ? `${jsonld} block(s) — this is what AI engines read to cite you` : "None — biggest AEO gap; add schema.org markup"]);
  const faq = /"@type"\s*:\s*"(FAQPage|QAPage|HowTo)"/i.test(html);
  checks.push(["Answer-style schema (FAQ/HowTo)", faq, faq ? "Present — ideal for AI Overviews" : "None — FAQ/HowTo schema wins AI citations"]);
  const canonical = headTags.some(t => /rel\s*=\s*["']canonical["']/i.test(t));
  checks.push(["Canonical URL", canonical, canonical ? "Set" : "Missing — risks duplicate-content splits"]);
  checks.push(["llms.txt (AI crawler guide)", llmsTxtOk, llmsTxtOk ? "Found — you're ahead of 99% of sites" : "Missing — emerging standard to guide AI crawlers"]);
  const og = headTags.some(t => /property\s*=\s*["']og:title["']/i.test(t));
  checks.push(["Open Graph tags", og, og ? "Present" : "Missing — hurts link previews + share CTR"]);
  const passed = checks.filter(c => c[1]).length;
  // weight JSON-LD + FAQ a touch heavier by giving base scaling
  let score = Math.round((passed / checks.length) * 100);
  if (jsonld > 0 && faq) score = Math.min(100, score + 3);
  return { score, grade: grade(score), checks };
}

// ---- Accessibility (WCAG 2.2 heuristics) ----
function scanA11y(html) {
  const checks = [];
  const lang = /<html[^>]+lang\s*=\s*["']?[a-z]/i.test(html);
  checks.push(["Page language set", lang, lang ? "<html lang> present" : "Missing <html lang> — screen readers can't pick a voice"]);
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const noAlt = imgs.filter(t => !/\balt\s*=/i.test(t)).length;
  checks.push(["Image alt text", imgs.length === 0 || noAlt === 0, imgs.length === 0 ? "No images" : noAlt === 0 ? `All ${imgs.length} images have alt` : `${noAlt}/${imgs.length} images missing alt`]);
  const title = /<title[^>]*>[\s\S]*?\S[\s\S]*?<\/title>/i.test(html);
  checks.push(["Document title", title, title ? "Present" : "Missing — required for orientation"]);
  const viewport = html.match(/<meta[^>]+name\s*=\s*["']viewport["'][^>]*>/i);
  const noZoom = viewport && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport[0]);
  checks.push(["Zoom not disabled", !noZoom, noZoom ? "Zoom is blocked — WCAG 1.4.4 failure" : "Users can zoom"]);
  const landmarks = /<(main|nav|header|footer)[\s>]/i.test(html) || /role\s*=\s*["'](main|navigation|banner)["']/i.test(html);
  checks.push(["Landmark regions", landmarks, landmarks ? "Semantic landmarks found" : "No <main>/<nav> — hard to navigate by assistive tech"]);
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const typedInputs = inputs.filter(t => !/type\s*=\s*["'](hidden|submit|button|image)["']/i.test(t));
  const labelled = /<label[\s>]/i.test(html) || typedInputs.every(t => /aria-label|aria-labelledby/i.test(t));
  checks.push(["Form inputs labelled", typedInputs.length === 0 || labelled, typedInputs.length === 0 ? "No form fields" : labelled ? "Labels/aria present" : `${typedInputs.length} field(s) may lack labels`]);
  const skip = /skip[\s-]*(to|nav|main|content)/i.test(html);
  checks.push(["Skip-to-content link", skip, skip ? "Present" : "Missing — keyboard users must tab through everything"]);
  const passed = checks.filter(c => c[1]).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, grade: grade(score), checks };
}

// ---- Security (response headers + TLS) ----
function scanSecurity(url, headers) {
  const checks = [];
  const https = url.protocol === "https:";
  checks.push(["HTTPS", https, https ? "Encrypted" : "No TLS — everything is in the clear"]);
  const g = n => headers.get(n);
  const hsts = !!g("strict-transport-security");
  checks.push(["HSTS", hsts, hsts ? "Enforced" : "Missing — allows SSL-strip downgrade attacks"]);
  const csp = !!g("content-security-policy");
  checks.push(["Content-Security-Policy", csp, csp ? "Set" : "Missing — primary XSS defense absent"]);
  const xcto = (g("x-content-type-options") || "").toLowerCase().includes("nosniff");
  checks.push(["X-Content-Type-Options", xcto, xcto ? "nosniff" : "Missing — MIME-sniffing risk"]);
  const frame = !!g("x-frame-options") || /frame-ancestors/i.test(g("content-security-policy") || "");
  checks.push(["Clickjacking protection", frame, frame ? "Protected" : "Missing X-Frame-Options / frame-ancestors"]);
  const ref = !!g("referrer-policy");
  checks.push(["Referrer-Policy", ref, ref ? "Set" : "Missing — leaks referrer data"]);
  const perm = !!g("permissions-policy");
  checks.push(["Permissions-Policy", perm, perm ? "Set" : "Missing — no limit on camera/mic/geo APIs"]);
  const leak = g("x-powered-by") || (g("server") && /\d/.test(g("server")) ? g("server") : null);
  checks.push(["No version leakage", !leak, leak ? `Leaks “${leak}” — tells attackers what to target` : "No tech/version disclosed"]);
  const passed = checks.filter(c => c[1]).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, grade: grade(score), checks };
}

// ---- Social ----
function scanSocial(headTags) {
  const checks = [];
  const get = re => headTags.some(t => re.test(t));
  const ogt = get(/property\s*=\s*["']og:title["']/i);
  checks.push(["og:title", ogt, ogt ? "Set" : "Missing"]);
  const ogd = get(/property\s*=\s*["']og:description["']/i);
  checks.push(["og:description", ogd, ogd ? "Set" : "Missing"]);
  const ogi = get(/property\s*=\s*["']og:image["']/i);
  checks.push(["og:image", ogi, ogi ? "Set — rich share cards" : "Missing — shares show no image (big CTR hit)"]);
  const tw = get(/name\s*=\s*["']twitter:card["']/i);
  checks.push(["twitter:card", tw, tw ? "Set" : "Missing"]);
  const passed = checks.filter(c => c[1]).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, grade: grade(score), checks };
}

import { rateLimit, clientIp } from "./_ratelimit.js";

// Anonymous limits. Tune via env without a redeploy.
const RL_LIMIT = parseInt(process.env.SCAN_RATE_LIMIT || "12", 10);   // scans
const RL_WINDOW = parseInt(process.env.SCAN_RATE_WINDOW || "600", 10); // seconds (10 min)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const parsed = clampUrl(req.query?.url || (req.url && new URL(req.url, "http://x").searchParams.get("url")));
  if (!parsed) { res.status(400).json({ error: "Enter a valid public website URL." }); return; }
  const url = parsed;

  // Rate limit by client IP (anonymous). Accounts will raise/replace this key later.
  const ip = clientIp(req);
  const rl = await rateLimit(`scan:${ip}`, { limit: RL_LIMIT, windowSec: RL_WINDOW });
  res.setHeader("X-RateLimit-Limit", String(rl.limit));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  res.setHeader("X-RateLimit-Reset", String(rl.resetSec));
  if (!rl.ok) {
    const mins = Math.max(1, Math.ceil(rl.resetSec / 60));
    res.setHeader("Retry-After", String(rl.resetSec));
    res.status(429).json({
      error: `Rate limit reached — ${rl.limit} scans per ${Math.round(RL_WINDOW / 60)} min. Try again in ~${mins} min, or create a free account for more.`,
      rateLimited: true,
      resetSec: rl.resetSec,
    });
    return;
  }
  const t0 = Date.now();
  let resp, html = "", headers;
  try {
    const ctl = AbortSignal.timeout(12000);
    resp = await fetch(url.href, { redirect: "follow", signal: ctl, headers: { "User-Agent": "OversightBot/1.0 (+site scanner)" } });
    headers = resp.headers;
    html = await resp.text();
  } catch (e) {
    res.status(502).json({ error: "Couldn't reach that site (timeout or blocked). Try another URL." });
    return;
  }
  // llms.txt probe
  let llmsTxtOk = false;
  try {
    const l = await fetch(new URL("/llms.txt", url.origin).href, { signal: AbortSignal.timeout(5000) });
    llmsTxtOk = l.ok && (l.headers.get("content-type") || "").includes("text");
  } catch {}

  const headTags = (html.match(/<meta[^>]*>|<link[^>]*>/gi) || []);
  const seo = scanSeo(html, headTags, llmsTxtOk);
  const a11y = scanA11y(html);
  const security = scanSecurity(url, headers);
  const social = scanSocial(headTags);
  const overall = Math.round((seo.score + a11y.score + security.score + social.score) / 4);

  res.status(200).json({
    url: url.href,
    status: resp.status,
    ms: Date.now() - t0,
    overall,
    overallGrade: grade(overall),
    agents: {
      "AEO / SEO": seo,
      "Accessibility": a11y,
      "Security": security,
      "Social": social,
    },
  });
}
