// Daily intelligence cron — runs at 8am via Vercel Cron
// Refreshes all data sources in sequence
//
// QUERY BUDGET (6,000/month):
// Social: ~25 queries per run = 750/month
// News: 24 queries per run (6 per category × 4) = 720/month
// Daily total: ~49 Brave queries
// Monthly: ~1,470 committed, ~4,530 headroom for manual refreshes
// Spotify + AI: use their own APIs, no Brave cost

import newsHandler from "../news";
import socialHandler from "../social";
import spotifyHandler from "../spotify";
import aiHandler from "../ai-strategy";

function createMockReqRes(query = {}) {
  const req = { query, headers: {}, method: "GET" };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseData = data; return res; },
    setHeader() { return res; },
  };
  return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
}

export default async function handler(req, res) {
  const results = { startedAt: new Date().toISOString(), steps: {}, queryBudget: {} };
  let totalQueries = 0;

  // Step 1: Refresh all feed categories (6 queries each × 4 = 24)
  for (const category of ["madonna", "fashion", "gay", "culture"]) {
    try {
      const mock = createMockReqRes({ category, refresh: "1" });
      await newsHandler(mock.req, mock.res);
      const r = mock.getResult();
      const queries = r.data?.queriesUsed || 0;
      totalQueries += queries;
      results.steps[`feeds_${category}`] = {
        ok: r.status === 200,
        items: r.data?.items?.length || 0,
        braveResults: r.data?.braveResults || 0,
        rssResults: r.data?.rssResults || 0,
        queriesUsed: queries,
      };
    } catch (err) {
      results.steps[`feeds_${category}`] = { ok: false, error: err.message };
    }
  }

  // Step 2: Social trend index (~25 queries)
  try {
    const mock = createMockReqRes({ refresh: "1" });
    await socialHandler(mock.req, mock.res);
    const r = mock.getResult();
    const queries = r.data?.queriesUsed || 0;
    totalQueries += queries;
    results.steps.social = {
      ok: r.status === 200,
      index: r.data?.index || 0,
      isFirstRun: r.data?.isFirstRun || false,
      totalSources: r.data?.totalSources || 0,
      queriesUsed: queries,
    };
  } catch (err) {
    results.steps.social = { ok: false, error: err.message };
  }

  // Step 3: Spotify (uses Spotify API, 0 Brave queries)
  try {
    const mock = createMockReqRes({ refresh: "1", snapshot: "1" });
    await spotifyHandler(mock.req, mock.res);
    const r = mock.getResult();
    results.steps.spotify = {
      ok: r.status === 200,
      tracks: r.data?.topTracks?.length || 0,
      albums: r.data?.albums?.length || 0,
      artists: r.data?.relatedArtists?.length || 0,
    };
  } catch (err) {
    results.steps.spotify = { ok: false, error: err.message };
  }

  // Step 4: AI recommendations (uses Anthropic API, 0 Brave queries)
  try {
    const mock = createMockReqRes({ refresh: "1" });
    await aiHandler(mock.req, mock.res);
    const r = mock.getResult();
    results.steps.ai = { ok: r.status === 200, generated: !!r.data?.recommendations };
  } catch (err) {
    results.steps.ai = { ok: false, error: err.message };
  }

  // Budget tracking
  const dayOfMonth = new Date().getDate();
  results.queryBudget = {
    todayBraveQueries: totalQueries,
    estimatedMonthly: totalQueries * 30,
    monthlyLimit: 6000,
    usedThisMonth: totalQueries * dayOfMonth, // rough estimate
    remaining: 6000 - (totalQueries * dayOfMonth),
  };

  results.completedAt = new Date().toISOString();
  res.status(200).json(results);
}
