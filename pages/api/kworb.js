// Kworb — actual Spotify stream counts for Madonna's catalogue.
// Public HTML at kworb.net, no API. Updated daily.
// Scrapes the "songs" table (name, total streams, daily streams).

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "kworb_madonna";
const HISTORY_KEY = "kworb_history";
const CACHE_TTL = 43200; // 12h — kworb updates once per day
const MADONNA_SPOTIFY_ID = "6tbjWDEIzxoDsBA1FuhfPW";

function parseNumber(s) {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function stripTags(s) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

function extractHref(cell) {
  const m = cell.match(/href="([^"]+)"/);
  if (!m) return null;
  const href = m[1];
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://kworb.net${href}`;
  return `https://kworb.net/spotify/${href}`;
}

function parseTracks(html) {
  const tableMatch = html.match(/<table[^>]*class="[^"]*sortable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const tableHtml = tableMatch[1];

  // Find header row to locate Streams and Daily columns
  const headerMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
  const headerCells = headerMatch
    ? [...headerMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]).toLowerCase())
    : [];
  let streamsCol = headerCells.findIndex(h => /^streams?$/i.test(h) || h === "total");
  let dailyCol = headerCells.findIndex(h => h === "daily");
  if (streamsCol < 0) streamsCol = 1;
  if (dailyCol < 0) dailyCol = 2;

  const bodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  const bodyHtml = bodyMatch ? bodyMatch[0] : tableHtml;

  const rows = [...bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  const tracks = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length < 2) continue;
    const name = stripTags(cells[0]);
    if (!name || /^total$/i.test(name)) continue;
    const url = extractHref(cells[0]);
    const total = parseNumber(stripTags(cells[streamsCol] || ""));
    const daily = parseNumber(stripTags(cells[dailyCol] || ""));
    if (name && total != null && total > 0) tracks.push({ name, total, daily, url });
  }
  return tracks;
}

function parseArtistSummary(html) {
  // Kworb sometimes includes totals in the summary at the top
  // Example markers: "Total Streams: 12,345,678,901" or similar
  const totalMatch = html.match(/Total[^:]*:\s*<[^>]+>\s*([\d,]+)/i)
                  || html.match(/Total\s+[Ss]treams[^<]*<[^>]+>\s*([\d,]+)/);
  return totalMatch ? parseNumber(totalMatch[1]) : null;
}

async function fetchKworb(path) {
  const url = `https://kworb.net/spotify/${path}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Madonna-Cultural-Engine/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`kworb ${path} returned ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([
        kvGet(CACHE_KEY),
        new Promise((_, r) => setTimeout(() => r(), 3000)),
      ]);
      if (cached?.tracks) return res.status(200).json(cached);
    } catch {}
  }

  try {
    const html = await fetchKworb(`artist/${MADONNA_SPOTIFY_ID}_songs.html`);
    const tracks = parseTracks(html).sort((a, b) => b.total - a.total);

    if (tracks.length === 0) {
      return res.status(200).json({
        error: "No tracks parsed — kworb layout may have changed",
        fetchedAt: new Date().toISOString(),
      });
    }

    const summaryTotal = parseArtistSummary(html);
    const tracksTotal = tracks.reduce((s, t) => s + (t.total || 0), 0);
    const tracksDaily = tracks.reduce((s, t) => s + (t.daily || 0), 0);

    // History / momentum
    const history = await kvListGet(HISTORY_KEY).catch(() => []);
    const previous = (history || [])[0];
    const momentum = previous ? {
      totalStreamsChange: tracksTotal - (previous.totalStreams || 0),
      dailyStreamsChange: tracksDaily - (previous.dailyStreams || 0),
      previousSnapshotAt: previous.date,
    } : null;

    const result = {
      source: "kworb.net — Spotify stream counts",
      fetchedAt: new Date().toISOString(),
      totalStreams: summaryTotal || tracksTotal,
      dailyStreams: tracksDaily,
      trackCount: tracks.length,
      tracks: tracks.slice(0, 40),
      momentum,
      history: (history || []).slice(0, 30),
      note: summaryTotal && summaryTotal !== tracksTotal
        ? "Headline total from kworb artist summary; per-track sum may differ slightly."
        : "Totals summed from per-track stream counts.",
    };

    try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
    try {
      await kvListPush(HISTORY_KEY, {
        date: new Date().toISOString(),
        totalStreams: result.totalStreams,
        dailyStreams: tracksDaily,
        trackCount: tracks.length,
        topTrack: tracks[0]?.name || null,
        topTrackStreams: tracks[0]?.total || null,
      }, 60);
    } catch {}

    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({
      error: err.message,
      fetchedAt: new Date().toISOString(),
    });
  }
}
