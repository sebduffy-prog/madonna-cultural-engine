// Daily intelligence cron -- runs at 8am via Vercel Cron
// Calls each API endpoint directly via internal URL

export default async function handler(req, res) {
  // Build the correct base URL
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const results = { startedAt: new Date().toISOString(), steps: {} };

  // Helper to call our own API routes
  async function callApi(path) {
    try {
      const r = await fetch(`${baseUrl}${path}`, {
        headers: { "User-Agent": "SweetToothCron/1.0" },
        signal: AbortSignal.timeout(55000),
      });
      if (!r.ok) return { ok: false, status: r.status };
      const data = await r.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Step 1: Refresh all feed categories
  for (const category of ["madonna", "fashion", "gay", "culture"]) {
    const r = await callApi(`/api/news?category=${category}&refresh=1`);
    results.steps[`feeds_${category}`] = { ok: r.ok, items: r.data?.items?.length || 0 };
  }

  // Step 2: Refresh Spotify
  const sp = await callApi("/api/spotify?refresh=1&snapshot=1");
  results.steps.spotify = { ok: sp.ok, popularity: sp.data?.artist?.popularity, tracks: sp.data?.topTracks?.length || 0 };

  // Step 3: Social listening
  const so = await callApi("/api/social?refresh=1&period=pw");
  results.steps.social = { ok: so.ok, mentions: so.data?.metrics?.totalMentions || 0 };

  // Step 4: AI recommendations
  const ai = await callApi("/api/ai-strategy?refresh=1");
  results.steps.ai = { ok: ai.ok, generated: !!ai.data?.recommendations };

  results.completedAt = new Date().toISOString();
  res.status(200).json(results);
}
