// GET /api/config — public front-end config. Exposes only the publishable Supabase
// URL + anon key (both safe for the browser). The service key is NEVER sent here.
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    authReady: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
}
