// Apple Music charts — pulls top songs and top albums across key markets,
// filters for Madonna. Complements Spotify with Apple's separate audience.
// No API key required (Apple's public Marketing Tools RSS).
//
// Docs: https://rss.marketingtools.apple.com/

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "apple_charts_madonna";
const CACHE_TTL = 21600; // 6 hours

const MARKETS = [
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "it", label: "Italy" },
  { code: "es", label: "Spain" },
  { code: "br", label: "Brazil" },
  { code: "mx", label: "Mexico" },
  { code: "au", label: "Australia" },
  { code: "jp", label: "Japan" },
];

const CHART_TYPES = [
  { kind: "songs", path: "most-played/200/songs", label: "Top Songs" },
  { kind: "albums", path: "most-played/100/albums", label: "Top Albums" },
];

function isMadonna(entry) {
  const artist = (entry.artistName || "").toLowerCase();
  return artist === "madonna" || artist.startsWith("madonna ") || artist.includes(" madonna");
}

async function fetchChart(marketCode, path) {
  const url = `https://rss.marketingtools.apple.com/api/v2/${marketCode}/music/${path}.json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.byMarket) return res.status(200).json(cached);
    } catch {}
  }

  const jobs = [];
  MARKETS.forEach(m => CHART_TYPES.forEach(c => jobs.push({ market: m, chart: c })));

  const results = await Promise.all(
    jobs.map(async j => {
      const data = await fetchChart(j.market.code, j.chart.path);
      const entries = data?.feed?.results || [];
      const hits = entries
        .map((e, i) => ({ ...e, position: i + 1 }))
        .filter(isMadonna)
        .map(e => ({
          position: e.position,
          name: e.name,
          artist: e.artistName,
          releaseDate: e.releaseDate,
          url: e.url,
          artwork: e.artworkUrl100,
          contentAdvisoryRating: e.contentAdvisoryRating || null,
        }));
      return {
        market: j.market.code,
        marketLabel: j.market.label,
        chartKind: j.chart.kind,
        chartLabel: j.chart.label,
        chartSize: entries.length,
        madonnaHits: hits,
      };
    })
  );

  const byMarket = {};
  results.forEach(r => {
    if (!byMarket[r.market]) byMarket[r.market] = { label: r.marketLabel, charts: {} };
    byMarket[r.market].charts[r.chartKind] = {
      label: r.chartLabel,
      chartSize: r.chartSize,
      hits: r.madonnaHits,
    };
  });

  const totalHits = results.reduce((s, r) => s + r.madonnaHits.length, 0);
  const bestPositions = results
    .flatMap(r => r.madonnaHits.map(h => ({
      market: r.marketLabel, chart: r.chartLabel, position: h.position, name: h.name,
    })))
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const result = {
    source: "apple-music-rss",
    fetchedAt: new Date().toISOString(),
    totalHits,
    marketsChecked: MARKETS.length,
    byMarket,
    bestPositions,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
  return res.status(200).json(result);
}
