// Apple Music charts — Madonna's chart presence across global markets.
// Public RSS feeds, no API key required.
// Docs: https://rss.marketingtools.apple.com/
//
// Fetches most-played songs + albums + new-releases across 15 markets,
// aggregates song-level across markets, persists daily snapshots for trend analysis.

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "apple_charts_madonna";
const HISTORY_KEY = "apple_history";
const CACHE_TTL = 21600; // 6 hours

const MARKETS = [
  { code: "us", label: "United States", flag: "\ud83c\uddfa\ud83c\uddf8" },
  { code: "gb", label: "United Kingdom", flag: "\ud83c\uddec\ud83c\udde7" },
  { code: "de", label: "Germany", flag: "\ud83c\udde9\ud83c\uddea" },
  { code: "fr", label: "France", flag: "\ud83c\uddeb\ud83c\uddf7" },
  { code: "it", label: "Italy", flag: "\ud83c\uddee\ud83c\uddf9" },
  { code: "es", label: "Spain", flag: "\ud83c\uddea\ud83c\uddf8" },
  { code: "br", label: "Brazil", flag: "\ud83c\udde7\ud83c\uddf7" },
  { code: "mx", label: "Mexico", flag: "\ud83c\uddf2\ud83c\uddfd" },
  { code: "au", label: "Australia", flag: "\ud83c\udde6\ud83c\uddfa" },
  { code: "jp", label: "Japan", flag: "\ud83c\uddef\ud83c\uddf5" },
  { code: "ca", label: "Canada", flag: "\ud83c\udde8\ud83c\udde6" },
  { code: "nl", label: "Netherlands", flag: "\ud83c\uddf3\ud83c\uddf1" },
  { code: "se", label: "Sweden", flag: "\ud83c\uddf8\ud83c\uddea" },
  { code: "pl", label: "Poland", flag: "\ud83c\uddf5\ud83c\uddf1" },
  { code: "ar", label: "Argentina", flag: "\ud83c\udde6\ud83c\uddf7" },
];

const CHART_DEFS = [
  { kind: "songs",    path: "most-played/200/songs",   label: "Top Songs" },
  { kind: "albums",   path: "most-played/100/albums",  label: "Top Albums" },
  { kind: "releases", path: "new-releases/50/albums",  label: "New Releases" },
];

function isMadonna(entry) {
  const a = (entry.artistName || "").toLowerCase();
  return a === "madonna" || a.startsWith("madonna ") || a.startsWith("madonna,") || a.includes(" madonna") || a.includes("madonna &") || a.includes("madonna feat");
}

async function fetchChart(marketCode, path) {
  const url = `https://rss.marketingtools.apple.com/api/v2/${marketCode}/music/${path}.json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function normaliseTitle(s) {
  return (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
  MARKETS.forEach(m => CHART_DEFS.forEach(c => jobs.push({ market: m, chart: c })));

  const raw = await Promise.all(jobs.map(async j => {
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
        artwork: (e.artworkUrl100 || "").replace("100x100bb", "300x300bb"),
        contentAdvisoryRating: e.contentAdvisoryRating || null,
      }));
    return {
      market: j.market.code, marketLabel: j.market.label, marketFlag: j.market.flag,
      chartKind: j.chart.kind, chartLabel: j.chart.label,
      chartSize: entries.length, madonnaHits: hits,
    };
  }));

  // Group by market
  const byMarket = {};
  MARKETS.forEach(m => {
    byMarket[m.code] = { label: m.label, flag: m.flag, charts: {} };
  });
  raw.forEach(r => {
    byMarket[r.market].charts[r.chartKind] = {
      label: r.chartLabel,
      chartSize: r.chartSize,
      hits: r.madonnaHits,
    };
  });

  // Songs aggregation across markets
  const songMap = {};
  raw.filter(r => r.chartKind === "songs").forEach(r => {
    r.madonnaHits.forEach(h => {
      const key = normaliseTitle(h.name);
      if (!songMap[key]) {
        songMap[key] = {
          name: h.name, artist: h.artist, artwork: h.artwork, url: h.url,
          releaseDate: h.releaseDate,
          markets: [],
        };
      }
      songMap[key].markets.push({
        market: r.market, marketLabel: r.marketLabel, marketFlag: r.marketFlag,
        position: h.position, url: h.url,
      });
    });
  });
  const songAggregate = Object.values(songMap)
    .map(s => {
      const positions = s.markets.map(m => m.position);
      const best = Math.min(...positions);
      const avg = Math.round(positions.reduce((a, b) => a + b, 0) / positions.length);
      return { ...s, marketCount: s.markets.length, bestPosition: best, avgPosition: avg };
    })
    .sort((a, b) => b.marketCount - a.marketCount || a.bestPosition - b.bestPosition);

  // Albums aggregation
  const albumMap = {};
  raw.filter(r => r.chartKind === "albums").forEach(r => {
    r.madonnaHits.forEach(h => {
      const key = normaliseTitle(h.name);
      if (!albumMap[key]) {
        albumMap[key] = {
          name: h.name, artist: h.artist, artwork: h.artwork, url: h.url,
          releaseDate: h.releaseDate,
          markets: [],
        };
      }
      albumMap[key].markets.push({
        market: r.market, marketLabel: r.marketLabel, marketFlag: r.marketFlag,
        position: h.position, url: h.url,
      });
    });
  });
  const albumAggregate = Object.values(albumMap)
    .map(a => {
      const positions = a.markets.map(m => m.position);
      return {
        ...a,
        marketCount: a.markets.length,
        bestPosition: Math.min(...positions),
        avgPosition: Math.round(positions.reduce((x, y) => x + y, 0) / positions.length),
      };
    })
    .sort((a, b) => b.marketCount - a.marketCount);

  // New releases featuring Madonna
  const newReleases = raw
    .filter(r => r.chartKind === "releases")
    .flatMap(r => r.madonnaHits.map(h => ({
      market: r.market, marketLabel: r.marketLabel, marketFlag: r.marketFlag,
      ...h,
    })))
    .sort((a, b) => a.position - b.position);

  // Totals
  const totalSongHits = raw.filter(r => r.chartKind === "songs").reduce((s, r) => s + r.madonnaHits.length, 0);
  const totalAlbumHits = raw.filter(r => r.chartKind === "albums").reduce((s, r) => s + r.madonnaHits.length, 0);
  const marketsCharting = new Set(raw.filter(r => r.madonnaHits.length > 0).map(r => r.market)).size;

  const bestPositions = raw
    .flatMap(r => r.madonnaHits.map(h => ({
      market: r.market, marketLabel: r.marketLabel, marketFlag: r.marketFlag,
      chart: r.chartLabel, chartKind: r.chartKind, position: h.position, name: h.name, url: h.url, artwork: h.artwork,
    })))
    .sort((a, b) => a.position - b.position);

  // Compare to previous snapshot
  const history = await kvListGet(HISTORY_KEY).catch(() => []);
  const previous = (history || [])[0];
  const momentum = previous ? {
    totalSongHitsChange: totalSongHits - (previous.totalSongHits || 0),
    totalAlbumHitsChange: totalAlbumHits - (previous.totalAlbumHits || 0),
    marketsChartingChange: marketsCharting - (previous.marketsCharting || 0),
    previousSnapshotAt: previous.date,
  } : null;

  const result = {
    source: "apple-music-rss",
    fetchedAt: new Date().toISOString(),
    markets: MARKETS,
    marketsCharting,
    totalSongHits,
    totalAlbumHits,
    totalNewReleases: newReleases.length,
    byMarket,
    songAggregate,
    albumAggregate,
    newReleases,
    bestPositions: bestPositions.slice(0, 25),
    momentum,
    history: (history || []).slice(0, 30),
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}

  // Record a snapshot for trend analysis
  try {
    await kvListPush(HISTORY_KEY, {
      date: new Date().toISOString(),
      totalSongHits, totalAlbumHits, marketsCharting,
      topSongName: songAggregate[0]?.name || null,
      topSongMarkets: songAggregate[0]?.marketCount || 0,
    }, 60);
  } catch {}

  return res.status(200).json(result);
}
