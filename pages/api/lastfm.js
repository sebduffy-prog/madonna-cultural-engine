// Last.fm — Madonna listener data across the scrobble network.
// Docs: https://www.last.fm/api
//
// Fetches: artist info, top tracks, top albums, tags, similar artists,
// plus per-country rankings (geo.getTopArtists across ~20 markets),
// plus global artist rank (chart.getTopArtists),
// plus per-track details for the top 5 tracks (track.getInfo).
// Persists daily snapshots for trend analysis.

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "lastfm_madonna";
const HISTORY_KEY = "lastfm_history";
const CACHE_TTL = 21600; // 6 hours
const BASE = "http://ws.audioscrobbler.com/2.0/";
const ARTIST = "Madonna";

const COUNTRIES = [
  { code: "United States",   label: "United States",   flag: "\ud83c\uddfa\ud83c\uddf8" },
  { code: "United Kingdom",  label: "United Kingdom",  flag: "\ud83c\uddec\ud83c\udde7" },
  { code: "Germany",         label: "Germany",         flag: "\ud83c\udde9\ud83c\uddea" },
  { code: "France",          label: "France",          flag: "\ud83c\uddeb\ud83c\uddf7" },
  { code: "Italy",           label: "Italy",           flag: "\ud83c\uddee\ud83c\uddf9" },
  { code: "Spain",           label: "Spain",           flag: "\ud83c\uddea\ud83c\uddf8" },
  { code: "Brazil",          label: "Brazil",          flag: "\ud83c\udde7\ud83c\uddf7" },
  { code: "Mexico",          label: "Mexico",          flag: "\ud83c\uddf2\ud83c\uddfd" },
  { code: "Australia",       label: "Australia",       flag: "\ud83c\udde6\ud83c\uddfa" },
  { code: "Japan",           label: "Japan",           flag: "\ud83c\uddef\ud83c\uddf5" },
  { code: "Canada",          label: "Canada",          flag: "\ud83c\udde8\ud83c\udde6" },
  { code: "Netherlands",     label: "Netherlands",     flag: "\ud83c\uddf3\ud83c\uddf1" },
  { code: "Sweden",          label: "Sweden",          flag: "\ud83c\uddf8\ud83c\uddea" },
  { code: "Poland",          label: "Poland",          flag: "\ud83c\uddf5\ud83c\uddf1" },
  { code: "Argentina",       label: "Argentina",       flag: "\ud83c\udde6\ud83c\uddf7" },
  { code: "Russia",          label: "Russia",          flag: "\ud83c\uddf7\ud83c\uddfa" },
  { code: "Turkey",          label: "Turkey",          flag: "\ud83c\uddf9\ud83c\uddf7" },
  { code: "Chile",           label: "Chile",           flag: "\ud83c\udde8\ud83c\uddf1" },
  { code: "Finland",         label: "Finland",         flag: "\ud83c\uddeb\ud83c\uddee" },
  { code: "Ireland",         label: "Ireland",         flag: "\ud83c\uddee\ud83c\uddea" },
];

async function lfmGet(method, extraParams, apiKey) {
  const params = new URLSearchParams({ method, api_key: apiKey, format: "json", autocorrect: "1", ...extraParams });
  try {
    const r = await fetch(`${BASE}?${params.toString()}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.error(`[lastfm] ${method}: ${err.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ configured: false, error: "LASTFM_API_KEY not set." });
  }

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.info) return res.status(200).json(cached);
    } catch {}
  }

  const [infoRaw, topTracksRaw, topAlbumsRaw, topTagsRaw, similarRaw, globalChartRaw, weeklyListRaw] = await Promise.all([
    lfmGet("artist.getInfo",              { artist: ARTIST, lang: "en" }, apiKey),
    lfmGet("artist.getTopTracks",         { artist: ARTIST, limit: 20 },  apiKey),
    lfmGet("artist.getTopAlbums",         { artist: ARTIST, limit: 15 },  apiKey),
    lfmGet("artist.getTopTags",           { artist: ARTIST },              apiKey),
    lfmGet("artist.getSimilar",           { artist: ARTIST, limit: 30 },   apiKey),
    lfmGet("chart.getTopArtists",         { limit: 500 },                  apiKey),
    lfmGet("artist.getWeeklyChartList",   { artist: ARTIST },              apiKey),
  ]);

  // Weekly trending — compare this week vs previous week
  const chartList = weeklyListRaw?.weeklychartlist?.chart || [];
  const recentWeeks = chartList.slice(-2); // last two weekly periods
  let trending = null;
  if (recentWeeks.length === 2) {
    const [prev, curr] = recentWeeks;
    const [prevChart, currChart] = await Promise.all([
      lfmGet("artist.getWeeklyTrackChart", { artist: ARTIST, from: prev.from, to: prev.to }, apiKey),
      lfmGet("artist.getWeeklyTrackChart", { artist: ARTIST, from: curr.from, to: curr.to }, apiKey),
    ]);
    const prevTracks = (prevChart?.weeklytrackchart?.track || []).reduce((acc, t) => {
      acc[t.name] = parseInt(t.playcount || 0);
      return acc;
    }, {});
    const currTracks = (currChart?.weeklytrackchart?.track || []).map(t => {
      const plays = parseInt(t.playcount || 0);
      const prevPlays = prevTracks[t.name] || 0;
      const delta = plays - prevPlays;
      const deltaPct = prevPlays > 0 ? Math.round((delta / prevPlays) * 100) : (plays > 0 ? 100 : 0);
      return { name: t.name, url: t.url, plays, prevPlays, delta, deltaPct, isNew: prevPlays === 0 && plays > 0 };
    }).filter(t => t.plays > 0);
    trending = {
      weekStart: new Date(parseInt(curr.from) * 1000).toISOString(),
      weekEnd: new Date(parseInt(curr.to) * 1000).toISOString(),
      prevWeekStart: new Date(parseInt(prev.from) * 1000).toISOString(),
      rising: currTracks.filter(t => t.delta > 0 || t.isNew).sort((a, b) => (b.deltaPct || 0) - (a.deltaPct || 0)).slice(0, 10),
      falling: currTracks.filter(t => t.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
      topThisWeek: currTracks.sort((a, b) => b.plays - a.plays).slice(0, 10),
    };
  }

  // Geo rankings — batched with a small concurrency guard
  const countryRankings = [];
  for (let i = 0; i < COUNTRIES.length; i += 4) {
    const batch = COUNTRIES.slice(i, i + 4);
    const results = await Promise.all(batch.map(async c => {
      const r = await lfmGet("geo.getTopArtists", { country: c.code, limit: 500 }, apiKey);
      const artists = r?.topartists?.artist || [];
      const idx = artists.findIndex(a => (a.name || "").toLowerCase() === "madonna");
      const entry = idx >= 0 ? artists[idx] : null;
      return {
        country: c.code, label: c.label, flag: c.flag,
        rank: idx >= 0 ? idx + 1 : null,
        listeners: entry ? parseInt(entry.listeners || 0) : null,
        outOf: artists.length,
      };
    }));
    countryRankings.push(...results);
    if (i + 4 < COUNTRIES.length) await new Promise(r => setTimeout(r, 200));
  }
  const countryRanked = [...countryRankings].filter(c => c.rank).sort((a, b) => a.rank - b.rank);

  // Global rank
  const globalArtists = globalChartRaw?.artists?.artist || [];
  const globalIdx = globalArtists.findIndex(a => (a.name || "").toLowerCase() === "madonna");
  const globalRank = globalIdx >= 0 ? globalIdx + 1 : null;

  // Artist summary
  const artist = infoRaw?.artist;
  const info = artist ? {
    name: artist.name,
    url: artist.url,
    listeners: parseInt(artist.stats?.listeners || 0),
    playcount: parseInt(artist.stats?.playcount || 0),
    bio: artist.bio?.summary?.replace(/<[^>]+>/g, "").trim() || null,
    tags: (artist.tags?.tag || []).map(t => ({ name: t.name, url: t.url })),
    image: (artist.image || []).find(i => i.size === "extralarge")?.["#text"] || null,
  } : null;

  // Top tracks
  const topTracksBase = (topTracksRaw?.toptracks?.track || []).map(t => ({
    name: t.name,
    playcount: parseInt(t.playcount || 0),
    listeners: parseInt(t.listeners || 0),
    url: t.url,
    rank: parseInt(t["@attr"]?.rank || 0),
  }));

  // Enrich top 5 tracks with track.getInfo (individual playcount, tags, wiki snippet)
  const trackDetails = await Promise.all(topTracksBase.slice(0, 5).map(async t => {
    const info = await lfmGet("track.getInfo", { artist: ARTIST, track: t.name }, apiKey);
    const tr = info?.track;
    return {
      ...t,
      duration: tr?.duration ? parseInt(tr.duration) : null,
      album: tr?.album?.title || null,
      albumImage: (tr?.album?.image || []).find(i => i.size === "large")?.["#text"] || null,
      trackTags: (tr?.toptags?.tag || []).map(tt => tt.name).slice(0, 5),
    };
  }));
  const topTracks = topTracksBase.map(t => {
    const extra = trackDetails.find(d => d.name === t.name);
    return extra ? { ...t, ...extra } : t;
  });

  const topAlbums = (topAlbumsRaw?.topalbums?.album || []).map(a => ({
    name: a.name,
    playcount: parseInt(a.playcount || 0),
    url: a.url,
    rank: parseInt(a["@attr"]?.rank || 0),
    image: (a.image || []).find(i => i.size === "large")?.["#text"] || null,
  }));

  const topTags = (topTagsRaw?.toptags?.tag || []).map(t => ({
    name: t.name,
    count: parseInt(t.count || 0),
    url: t.url,
  }));

  const similar = (similarRaw?.similarartists?.artist || []).map(a => ({
    name: a.name,
    match: parseFloat(a.match || 0),
    url: a.url,
    image: (a.image || []).find(i => i.size === "large")?.["#text"] || null,
  }));

  // History
  const history = await kvListGet(HISTORY_KEY).catch(() => []);
  const previous = (history || [])[0];
  const momentum = previous ? {
    listenersChange: (info?.listeners || 0) - (previous.listeners || 0),
    playcountChange: (info?.playcount || 0) - (previous.playcount || 0),
    previousSnapshotAt: previous.date,
  } : null;

  const result = {
    source: "lastfm",
    configured: true,
    fetchedAt: new Date().toISOString(),
    info,
    globalRank,
    globalOutOf: globalArtists.length,
    countryRankings: countryRanked,
    countryRankingsAll: countryRankings,
    topTracks,
    topAlbums,
    topTags,
    similarArtists: similar,
    trending,
    momentum,
    history: (history || []).slice(0, 30),
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}

  try {
    await kvListPush(HISTORY_KEY, {
      date: new Date().toISOString(),
      listeners: info?.listeners || 0,
      playcount: info?.playcount || 0,
      globalRank,
      countryCount: countryRanked.length,
    }, 60);
  } catch {}

  return res.status(200).json(result);
}
