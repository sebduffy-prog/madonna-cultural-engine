// Last.fm integration — Madonna artist data from scrobble network.
// Complements Spotify with self-reported listener demographics and fan-tagged context.
// Docs: https://www.last.fm/api

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "lastfm_madonna";
const CACHE_TTL = 21600; // 6 hours
const BASE = "http://ws.audioscrobbler.com/2.0/";
const ARTIST = "Madonna";

async function lfmGet(method, extraParams, apiKey) {
  const params = new URLSearchParams({
    method,
    artist: ARTIST,
    api_key: apiKey,
    format: "json",
    autocorrect: "1",
    ...extraParams,
  });
  try {
    const r = await fetch(`${BASE}?${params.toString()}`, { signal: AbortSignal.timeout(10000) });
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
    return res.status(200).json({
      configured: false,
      error: "LASTFM_API_KEY not set. Get one at https://www.last.fm/api/account/create",
    });
  }

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.info) return res.status(200).json(cached);
    } catch {}
  }

  const [infoRaw, topTracksRaw, topAlbumsRaw, topTagsRaw, similarRaw] = await Promise.all([
    lfmGet("artist.getInfo", { lang: "en" }, apiKey),
    lfmGet("artist.getTopTracks", { limit: 20 }, apiKey),
    lfmGet("artist.getTopAlbums", { limit: 15 }, apiKey),
    lfmGet("artist.getTopTags", {}, apiKey),
    lfmGet("artist.getSimilar", { limit: 20 }, apiKey),
  ]);

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

  const topTracks = (topTracksRaw?.toptracks?.track || []).map(t => ({
    name: t.name,
    playcount: parseInt(t.playcount || 0),
    listeners: parseInt(t.listeners || 0),
    url: t.url,
    rank: parseInt(t["@attr"]?.rank || 0),
  }));

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

  const result = {
    source: "lastfm",
    configured: true,
    fetchedAt: new Date().toISOString(),
    info,
    topTracks,
    topAlbums,
    topTags,
    similarArtists: similar,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
  return res.status(200).json(result);
}
