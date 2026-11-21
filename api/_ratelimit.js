// Rate limiter for the Oversight scanner.
// Durable path: Upstash Redis REST (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// as Vercel env vars). Fallback: in-memory fixed-window (per serverless instance) so the
// limiter works out of the box before Upstash is wired — just weaker across cold starts.

const MEM = new Map(); // key -> { count, resetMs }

export function clientIp(req) {
  const xff = req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

async function upstash(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(`${url}/${cmd.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error("upstash " + r.status);
  return (await r.json()).result;
}

/**
 * @returns {Promise<{ok:boolean, remaining:number, resetSec:number, limit:number, backend:string}>}
 */
export async function rateLimit(key, { limit = 10, windowSec = 600 } = {}) {
  const now = Date.now();

  // --- durable: Upstash ---
  try {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const rk = `rl:${key}`;
      const count = await upstash(["INCR", rk]);
      if (count === 1) await upstash(["EXPIRE", rk, String(windowSec)]);
      let ttl = await upstash(["TTL", rk]);
      if (typeof ttl !== "number" || ttl < 0) ttl = windowSec;
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        resetSec: ttl,
        limit,
        backend: "upstash",
      };
    }
  } catch {
    // fall through to in-memory if Upstash hiccups — never hard-fail a scan on the limiter
  }

  // --- fallback: in-memory fixed window ---
  let e = MEM.get(key);
  if (!e || e.resetMs <= now) {
    e = { count: 0, resetMs: now + windowSec * 1000 };
    MEM.set(key, e);
  }
  e.count += 1;
  // opportunistic cleanup so the map can't grow unbounded
  if (MEM.size > 5000) for (const [k, v] of MEM) if (v.resetMs <= now) MEM.delete(k);
  return {
    ok: e.count <= limit,
    remaining: Math.max(0, limit - e.count),
    resetSec: Math.ceil((e.resetMs - now) / 1000),
    limit,
    backend: "memory",
  };
}
