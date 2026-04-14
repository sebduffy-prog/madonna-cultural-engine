// Daily intelligence cron -- runs at 8am via Vercel Cron
// Imports and calls each API handler directly (no HTTP self-calls)

import newsHandler from "../news";
import socialHandler from "../social";
import spotifyHandler from "../spotify";
import aiHandler from "../ai-strategy";

// Fake req/res to call handlers directly
function createMockReqRes(query = {}) {
  const req = {
    query,
    headers: {},
    method: "GET",
  };
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
  const results = { startedAt: new Date().toISOString(), steps: {} };

  // Step 1: Refresh all feed categories
  for (const category of ["madonna", "fashion", "gay", "culture"]) {
    try {
      const mock = createMockReqRes({ category, refresh: "1" });
      await newsHandler(mock.req, mock.res);
      const r = mock.getResult();
      results.steps[`feeds_${category}`] = { ok: r.status === 200, items: r.data?.items?.length || 0 };
    } catch (err) {
      results.steps[`feeds_${category}`] = { ok: false, error: err.message };
    }
  }

  // Step 2: Refresh Spotify
  try {
    const mock = createMockReqRes({ refresh: "1", snapshot: "1" });
    await spotifyHandler(mock.req, mock.res);
    const r = mock.getResult();
    results.steps.spotify = { ok: r.status === 200, tracks: r.data?.topTracks?.length || 0, artists: r.data?.relatedArtists?.length || 0 };
  } catch (err) {
    results.steps.spotify = { ok: false, error: err.message };
  }

  // Step 3: Social listening
  try {
    const mock = createMockReqRes({ refresh: "1", period: "pw" });
    await socialHandler(mock.req, mock.res);
    const r = mock.getResult();
    results.steps.social = { ok: r.status === 200, mentions: r.data?.metrics?.totalMentions || 0 };
  } catch (err) {
    results.steps.social = { ok: false, error: err.message };
  }

  // Step 4: AI recommendations
  try {
    const mock = createMockReqRes({ refresh: "1" });
    await aiHandler(mock.req, mock.res);
    const r = mock.getResult();
    results.steps.ai = { ok: r.status === 200, generated: !!r.data?.recommendations };
  } catch (err) {
    results.steps.ai = { ok: false, error: err.message };
  }

  results.completedAt = new Date().toISOString();
  res.status(200).json(results);
}
