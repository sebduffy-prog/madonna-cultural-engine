// Universal Market Strength Index — blends Apple Music, Last.fm, and Kworb per-country.
//
// For each of the 15 target markets, scores 0-100:
//   Apple chart presence (0-30) — normalised songs+albums+releases
//   Last.fm local rank    (0-30) — inverse of rank in country's top 500
//   Kworb daily streams   (0-40) — normalised actual daily streams per country
//
// Also tracks per-market trending via snapshot history (score delta vs last snapshot).

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "market_strength";
const HISTORY_KEY = "market_strength_history";
const CACHE_TTL = 21600; // 6h

// Each market has an Apple code (lowercase ISO) + the country name Last.fm uses
const MARKETS = [
  { code: "us", label: "United States",  flag: "\ud83c\uddfa\ud83c\uddf8", lastfm: "United States" },
  { code: "gb", label: "United Kingdom", flag: "\ud83c\uddec\ud83c\udde7", lastfm: "United Kingdom" },
  { code: "de", label: "Germany",        flag: "\ud83c\udde9\ud83c\uddea", lastfm: "Germany" },
  { code: "fr", label: "France",         flag: "\ud83c\uddeb\ud83c\uddf7", lastfm: "France" },
  { code: "it", label: "Italy",          flag: "\ud83c\uddee\ud83c\uddf9", lastfm: "Italy" },
  { code: "es", label: "Spain",          flag: "\ud83c\uddea\ud83c\uddf8", lastfm: "Spain" },
  { code: "br", label: "Brazil",         flag: "\ud83c\udde7\ud83c\uddf7", lastfm: "Brazil" },
  { code: "mx", label: "Mexico",         flag: "\ud83c\uddf2\ud83c\uddfd", lastfm: "Mexico" },
  { code: "au", label: "Australia",      flag: "\ud83c\udde6\ud83c\uddfa", lastfm: "Australia" },
  { code: "jp", label: "Japan",          flag: "\ud83c\uddef\ud83c\uddf5", lastfm: "Japan" },
  { code: "ca", label: "Canada",         flag: "\ud83c\udde8\ud83c\udde6", lastfm: "Canada" },
  { code: "nl", label: "Netherlands",    flag: "\ud83c\uddf3\ud83c\uddf1", lastfm: "Netherlands" },
  { code: "se", label: "Sweden",         flag: "\ud83c\uddf8\ud83c\uddea", lastfm: "Sweden" },
  { code: "pl", label: "Poland",         flag: "\ud83c\uddf5\ud83c\uddf1", lastfm: "Poland" },
  { code: "ar", label: "Argentina",      flag: "\ud83c\udde6\ud83c\uddf7", lastfm: "Argentina" },
];

function parseNumber(s) {
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[,\s+]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

// Scrape kworb.net per-country Spotify daily chart and sum Madonna's streams
async function fetchKworbCountry(code) {
  const url = `https://kworb.net/spotify/country/${code}_daily.html`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Madonna-Cultural-Engine/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { tracks: [], dailyStreams: 0, totalStreams: 0, error: `HTTP ${r.status}` };
    const html = await r.text();

    const tableMatch = html.match(/<table[^>]*class="[^"]*sortable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return { tracks: [], dailyStreams: 0, totalStreams: 0, error: "table not found" };
    const tableHtml = tableMatch[1];

    // Locate columns from header: expected Pos, P+, Artist and Title, Days, Peak, [x?], Streams, Streams+, Total
    const headerMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
    const headers = headerMatch
      ? [...headerMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]).toLowerCase())
      : [];
    let titleCol = headers.findIndex(h => /artist.*title|title.*artist/i.test(h));
    let streamsCol = headers.findIndex(h => /^streams?$/i.test(h));
    let totalCol = headers.findIndex(h => h === "total");
    if (titleCol < 0) titleCol = 2;
    if (streamsCol < 0) streamsCol = 6;
    if (totalCol < 0) totalCol = 8;

    const bodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
    const bodyHtml = bodyMatch ? bodyMatch[0] : tableHtml;
    const rows = [...bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);

    const tracks = [];
    let dailyStreams = 0;
    let totalStreams = 0;
    for (const row of rows) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]));
      if (cells.length < Math.max(streamsCol, titleCol) + 1) continue;
      const title = cells[titleCol] || "";
      // Kworb format: "Artist - Song" (single Madonna) or "Madonna, Other - Song" (collab)
      const lower = title.toLowerCase();
      if (!lower.startsWith("madonna") && !lower.includes(", madonna") && !lower.includes("madonna,") && !lower.includes(" & madonna")) continue;
      const daily = parseNumber(cells[streamsCol]);
      const total = parseNumber(cells[totalCol]);
      if (daily > 0 || total > 0) {
        tracks.push({ title, daily, total });
        dailyStreams += daily;
        totalStreams += total;
      }
    }
    return { tracks, dailyStreams, totalStreams };
  } catch (err) {
    return { tracks: [], dailyStreams: 0, totalStreams: 0, error: err.message };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([
        kvGet(CACHE_KEY),
        new Promise((_, r) => setTimeout(() => r(), 3000)),
      ]);
      if (cached?.markets) return res.status(200).json(cached);
    } catch {}
  }

  // Pull existing Apple + Last.fm caches
  const [apple, lastfm] = await Promise.all([
    kvGet("apple_charts_madonna").catch(() => null),
    kvGet("lastfm_madonna").catch(() => null),
  ]);

  // Scrape kworb per country — batched with a small concurrency / polite delay
  const kworbByMarket = {};
  for (let i = 0; i < MARKETS.length; i += 3) {
    const batch = MARKETS.slice(i, i + 3);
    const results = await Promise.all(batch.map(m => fetchKworbCountry(m.code)));
    batch.forEach((m, idx) => { kworbByMarket[m.code] = results[idx]; });
    if (i + 3 < MARKETS.length) await new Promise(r => setTimeout(r, 400));
  }

  // Build per-market raw signals
  const raw = MARKETS.map(m => {
    const appleMarket = apple?.byMarket?.[m.code];
    const apple_songs = appleMarket?.charts?.songs?.hits?.length || 0;
    const apple_albums = appleMarket?.charts?.albums?.hits?.length || 0;
    const apple_releases = appleMarket?.charts?.releases?.hits?.length || 0;
    const apple_entries = apple_songs + apple_albums + apple_releases;

    const lastfmEntry = (lastfm?.countryRankingsAll || []).find(c => c.country === m.lastfm);
    const lastfm_rank = lastfmEntry?.rank || null;
    const lastfm_listeners = lastfmEntry?.listeners || 0;

    const k = kworbByMarket[m.code] || {};
    return {
      ...m,
      apple_entries, apple_songs, apple_albums, apple_releases,
      lastfm_rank, lastfm_listeners,
      kworb_daily_streams: k.dailyStreams || 0,
      kworb_total_streams: k.totalStreams || 0,
      kworb_track_count: (k.tracks || []).length,
      kworb_top_tracks: (k.tracks || []).slice(0, 3),
      kworb_error: k.error || null,
    };
  });

  // Normalise to score components
  const maxApple  = Math.max(1, ...raw.map(m => m.apple_entries));
  const maxKworb  = Math.max(1, ...raw.map(m => m.kworb_daily_streams));

  const scored = raw.map(m => {
    const appleScore   = Math.round(30 * (m.apple_entries / maxApple));
    const lastfmScore  = m.lastfm_rank
      ? Math.round(30 * Math.max(0, 1 - Math.min(m.lastfm_rank, 500) / 500))
      : 0;
    const kworbScore   = Math.round(40 * (m.kworb_daily_streams / maxKworb));
    const total        = appleScore + lastfmScore + kworbScore;
    return { ...m, appleScore, lastfmScore, kworbScore, total };
  }).sort((a, b) => b.total - a.total);

  // Trending — compare total score vs previous snapshot
  const history = await kvListGet(HISTORY_KEY).catch(() => []);
  const previous = (history || [])[0];
  const withDelta = scored.map(m => {
    const prev = previous?.scores?.[m.code];
    const delta = prev != null ? m.total - prev : null;
    const prevDailyStreams = previous?.dailyStreams?.[m.code];
    const streamsDelta = prevDailyStreams != null ? m.kworb_daily_streams - prevDailyStreams : null;
    return { ...m, delta, prevScore: prev ?? null, streamsDelta };
  });

  const result = {
    fetchedAt: new Date().toISOString(),
    markets: withDelta,
    sources: {
      apple: apple?.fetchedAt || null,
      lastfm: lastfm?.fetchedAt || null,
      kworb: "kworb.net/spotify/country/*",
    },
    hasBaseline: !!previous,
    previousSnapshotAt: previous?.date || null,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}

  try {
    await kvListPush(HISTORY_KEY, {
      date: new Date().toISOString(),
      scores: Object.fromEntries(scored.map(m => [m.code, m.total])),
      dailyStreams: Object.fromEntries(scored.map(m => [m.code, m.kworb_daily_streams])),
    }, 60);
  } catch {}

  return res.status(200).json(result);
}
