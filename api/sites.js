// /api/sites — saved sites a user monitors.
//   GET    → list
//   POST   { url }   → add
//   DELETE ?id=...   → remove
import { getUser, listSites, addSite, deleteSite } from "./_auth.js";

function normalizeUrl(raw) {
  let u = (raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).href; } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const user = await getUser(req);
  if (!user) { res.status(401).json({ error: "Sign in to manage sites." }); return; }

  try {
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      const url = normalizeUrl(body?.url);
      if (!url) { res.status(400).json({ error: "Enter a valid URL." }); return; }
      const existing = (await listSites(user.id)) || [];
      if (existing.length >= 25) { res.status(400).json({ error: "Site limit reached for this plan." }); return; }
      const row = await addSite(user.id, url);
      res.status(200).json({ site: Array.isArray(row) ? row[0] : row });
      return;
    }
    if (req.method === "DELETE") {
      const id = req.query?.id || new URL(req.url, "http://x").searchParams.get("id");
      if (!id) { res.status(400).json({ error: "Missing site id." }); return; }
      await deleteSite(user.id, id);
      res.status(200).json({ ok: true });
      return;
    }
    // GET
    const sites = (await listSites(user.id)) || [];
    res.status(200).json({ sites });
  } catch (e) {
    res.status(500).json({ error: "Sites request failed." });
  }
}
