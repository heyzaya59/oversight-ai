// GET /api/me — resolve the current user from the Bearer token (or null).
import { getUser, supabaseConfigured } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!supabaseConfigured()) { res.status(200).json({ user: null, authReady: false }); return; }
  const user = await getUser(req);
  res.status(200).json({ user, authReady: true });
}
