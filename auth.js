// Oversight — tiny client auth layer over Supabase GoTrue (no SDK).
// Handles magic-link + Google sign-in, token storage, and redirect capture.
window.OVS = (function () {
  const TKEY = "ovs_token", RKEY = "ovs_refresh";
  let _cfg = null;

  async function config() {
    if (_cfg) return _cfg;
    try { _cfg = await (await fetch("/api/config")).json(); }
    catch { _cfg = { authReady: false }; }
    return _cfg;
  }
  const token = () => localStorage.getItem(TKEY);
  const setTokens = (a, r) => { if (a) localStorage.setItem(TKEY, a); if (r) localStorage.setItem(RKEY, r); };
  const clear = () => { localStorage.removeItem(TKEY); localStorage.removeItem(RKEY); };
  const authHeader = () => token() ? { Authorization: "Bearer " + token() } : {};

  // Capture #access_token=... after a magic-link / OAuth redirect.
  function captureRedirect() {
    if (!location.hash || location.hash.indexOf("access_token") === -1) return false;
    const p = new URLSearchParams(location.hash.slice(1));
    const a = p.get("access_token"), r = p.get("refresh_token");
    if (a) {
      setTokens(a, r);
      history.replaceState(null, "", location.pathname + location.search);
      return true;
    }
    return false;
  }

  async function sendMagicLink(email) {
    const c = await config();
    if (!c.authReady) throw new Error("Auth isn't configured yet.");
    const redirect = location.origin + "/dashboard.html";
    const r = await fetch(c.supabaseUrl + "/auth/v1/otp", {
      method: "POST",
      headers: { apikey: c.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, options: { email_redirect_to: redirect } }),
    });
    if (!r.ok) throw new Error("Could not send the link. Check the email and try again.");
    return true;
  }

  async function googleSignIn() {
    const c = await config();
    if (!c.authReady) throw new Error("Auth isn't configured yet.");
    const redirect = encodeURIComponent(location.origin + "/dashboard.html");
    location.href = c.supabaseUrl + "/auth/v1/authorize?provider=google&redirect_to=" + redirect;
  }

  async function refresh() {
    const c = await config();
    const rt = localStorage.getItem(RKEY);
    if (!c.authReady || !rt) return false;
    try {
      const r = await fetch(c.supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: c.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!r.ok) return false;
      const d = await r.json();
      setTokens(d.access_token, d.refresh_token);
      return true;
    } catch { return false; }
  }

  // Current user, refreshing the token once if it expired.
  async function me() {
    if (!token()) return null;
    let r = await fetch("/api/me", { headers: authHeader() });
    let d = await r.json();
    if (!d.user && await refresh()) {
      r = await fetch("/api/me", { headers: authHeader() });
      d = await r.json();
    }
    return d.user || null;
  }

  function signOut() { clear(); location.href = "/"; }

  captureRedirect();
  return { config, token, authHeader, sendMagicLink, googleSignIn, me, signOut, captureRedirect };
})();
