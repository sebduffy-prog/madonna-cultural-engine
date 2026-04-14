// Weekly intelligence cron -- runs every Tuesday at 14:05 via Vercel Cron
// Orchestrates: RSS/Brave refresh → Spotify snapshot → Social scan → AI recommendations

export default async function handler(req, res) {
  // Verify cron secret in production (Vercel sets this automatically)
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  const results = { startedAt: new Date().toISOString(), steps: {} };

  // Step 1: Refresh all feed categories
  for (const category of ["madonna", "fashion", "gay", "culture"]) {
    try {
      const r = await fetch(`${baseUrl}/api/news?category=${category}&refresh=1`);
      const data = await r.json();
      results.steps[`feeds_${category}`] = { ok: r.ok, items: data.items?.length || 0 };
    } catch (err) {
      results.steps[`feeds_${category}`] = { ok: false, error: err.message };
    }
  }

  // Step 2: Refresh Spotify data
  try {
    const r = await fetch(`${baseUrl}/api/spotify?refresh=1&snapshot=1`);
    const data = await r.json();
    results.steps.spotify = { ok: r.ok, hasCredentials: data.hasCredentials, popularity: data.artist?.popularity };
  } catch (err) {
    results.steps.spotify = { ok: false, error: err.message };
  }

  // Step 3: Social listening scan
  try {
    const r = await fetch(`${baseUrl}/api/social?refresh=1`);
    const data = await r.json();
    results.steps.social = { ok: r.ok, mentions: data.sentiment?.total || 0, sentiment: data.sentiment };
  } catch (err) {
    results.steps.social = { ok: false, error: err.message };
  }

  // Step 4: Generate AI recommendations (uses data from steps 1-3)
  try {
    const r = await fetch(`${baseUrl}/api/ai-strategy?refresh=1`);
    const data = await r.json();
    results.steps.ai = { ok: r.ok, generated: !!data.recommendations, generatedAt: data.generatedAt };
  } catch (err) {
    results.steps.ai = { ok: false, error: err.message };
  }

  results.completedAt = new Date().toISOString();
  res.status(200).json(results);
}
