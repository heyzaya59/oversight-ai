// Auth + persistence helpers for Oversight (Supabase-backed, dependency-free).
// Verifies a Supabase user JWT via GoTrue, and reads/writes Postgres via PostgREST
// using the service-role key (server-side only). All functions no-op gracefully when
// Supabase env vars are absent, so the site still runs (everyone = anonymous).

const URL_ = () => process.env.SUPABASE_URL;
const ANON = () => process.env.SUPABASE_ANON_KEY;
const SERVICE = () => process.env.SUPABASE_SERVICE_KEY;

export function supabaseConfigured() {
  return !!(URL_() && ANON() && SERVICE());
}

export function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// Resolve the logged-in user from a request's Bearer token. Returns { id, email } or null.
export async function getUser(req) {
  if (!supabaseConfigured()) return null;
  const token = bearer(req);
  if (!token) return null;
  try {
    const r = await fetch(`${URL_()}/auth/v1/user`, {
      headers: { apikey: ANON(), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

// --- PostgREST helpers (service role; enforce user scoping in the query) ---
async function rest(path, { method = "GET", body, prefer } = {}) {
  if (!supabaseConfigured()) return null;
  const headers = {
    apikey: SERVICE(),
    Authorization: `Bearer ${SERVICE()}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${URL_()}/rest/v1/${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`db ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

export function recordScan(row) {
  // fire-and-forget; never block or fail a scan on logging
  if (!supabaseConfigured()) return Promise.resolve(null);
  return rest("scans", { method: "POST", body: row, prefer: "return=minimal" }).catch(() => null);
}

export function listScans(userId, limit = 50) {
  return rest(`scans?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`);
}

export function listSites(userId) {
  return rest(`sites?user_id=eq.${userId}&order=created_at.desc`);
}

export function addSite(userId, url) {
  return rest("sites", { method: "POST", body: { user_id: userId, url }, prefer: "return=representation" });
}

export function deleteSite(userId, id) {
  return rest(`sites?id=eq.${id}&user_id=eq.${userId}`, { method: "DELETE", prefer: "return=minimal" });
}
