// GET /api/history — the signed-in user's recent scans.
import { getUser, listScans } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const user = await getUser(req);
  if (!user) { res.status(401).json({ error: "Sign in to view scan history." }); return; }
  try {
    const scans = (await listScans(user.id)) || [];
    res.status(200).json({ scans });
  } catch (e) {
    res.status(500).json({ error: "Could not load history." });
  }
}
