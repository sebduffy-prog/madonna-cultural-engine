// Spotify Tracker — Madonna
// 6 sequential API calls with 500ms gaps:
//   1. Artist profile
//   2. Search (tracks + playlists combined)
//   3-4. Albums × 2 pages
//   5. Biggest playlist content → connected artists
//   6. Second playlist content → more connected data
// All Blob calls have timeouts

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW";
const CACHE_TTL_MS = 43200000;
const CACHE_KEY = "spotify_data";
const HISTORY_KEY = "spotify_popularity_history";

let tokenCache = { token: null, expires: 0 };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    tokenCache = { token: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return d.access_token;
  } catch { return null; }
}

async function spGet(path, token) {
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) {
      const wait = Math.min(parseInt(r.headers.get("retry-after") || "3", 10), 10);
      await delay(wait * 1000);
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      return r2.ok ? r2.json() : null;
    }
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.artist) {
        let history = [];
        try { history = await Promise.race([kvListGet(HISTORY_KEY, 0, 29), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}
        cached.history = history || [];
        return res.status(200).json(cached);
      }
    } catch {}
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(200).json({ hasCredentials: false, error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to Vercel env vars." });
  }

  const token = await getToken();
  if (!token) return res.status(200).json({ hasCredentials: false, error: "Token failed" });

  // 1. Artist
  const artist = await spGet(`/artists/${MADONNA_ID}`, token);
  if (!artist) return res.status(200).json({ hasCredentials: true, artist: null, debug: { error: "Artist fetch failed" }, topTracks: [], albums: [], playlists: [], connectedArtists: [] });

  // 2. Combined search: tracks + playlists in ONE call
  await delay(500);
  const search = await spGet("/search?q=Madonna&type=track,playlist&limit=10&market=GB", token);

  // 3-4. Albums (2 pages)
  await delay(500);
  const albums1 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=0`, token);
  await delay(500);
  const albums2 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=10`, token);

  // Process tracks
  const seenTracks = new Set();
  const tracks = (search?.tracks?.items || [])
    .filter(t => { if (seenTracks.has(t.id)) return false; seenTracks.add(t.id); return t.artists?.some(a => a.id === MADONNA_ID); })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const playlists = (search?.playlists?.items || []).filter(Boolean);

  // 5-6. Fetch 2 biggest playlists for connected artists
  const connectedMap = {};
  const playlistsWithTracks = [];

  for (const pl of playlists.filter(p => p.tracks?.total > 10).slice(0, 2)) {
    await delay(500);
    const plData = await spGet(`/playlists/${pl.id}?fields=name,tracks.items(track(name,artists,popularity))`, token);
    if (plData?.tracks?.items) {
      playlistsWithTracks.push({ name: pl.name, trackCount: plData.tracks.items.length });
      for (const item of plData.tracks.items) {
        const track = item.track;
        if (!track?.artists) continue;
        for (const a of track.artists) {
          if (a.id === MADONNA_ID) continue;
          if (!connectedMap[a.id]) connectedMap[a.id] = { id: a.id, name: a.name, count: 0, tracks: [] };
          connectedMap[a.id].count++;
          if (connectedMap[a.id].tracks.length < 3) connectedMap[a.id].tracks.push(track.name);
        }
      }
    }
  }

  const totalPlTracks = playlistsWithTracks.reduce((s, p) => s + p.trackCount, 0);
  const connectedArtists = Object.values(connectedMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((a) => ({ ...a, connectivity: totalPlTracks > 0 ? Math.round((a.count / totalPlTracks) * 1000) / 10 : 0 }));

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL_MS / 1000,
    artist: {
      name: artist.name, followers: artist.followers?.total || 0,
      popularity: artist.popularity || 0, genres: artist.genres || [],
      image: artist.images?.[0]?.url || "", imageSmall: artist.images?.[1]?.url || "",
    },
    topTracks: tracks.slice(0, 20).map(t => ({
      name: t.name, album: t.album?.name || "",
      albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
      albumImageSmall: t.album?.images?.[2]?.url || "",
      popularity: t.popularity || 0, externalUrl: t.external_urls?.spotify || "",
      durationMs: t.duration_ms, releaseDate: t.album?.release_date || "",
    })),
    albums: [...(albums1?.items || []), ...(albums2?.items || [])].map(a => ({
      name: a.name, type: a.album_type, releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "", imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    playlists: playlists.map(p => ({
      name: p.name, owner: p.owner?.display_name || "", tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "", image: p.images?.[0]?.url || "",
    })),
    connectedArtists,
    playlistsAnalysed: playlistsWithTracks.length,
    totalPlaylistTracks: totalPlTracks,
    relatedArtists: [], audienceTrending: [],
  };

  // Persist with timeout
  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL_MS / 1000), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}
  try { await Promise.race([kvListPush(HISTORY_KEY, { date: result.fetchedAt, popularity: result.artist.popularity, followers: result.artist.followers, topTracks: result.topTracks.slice(0, 5).map(t => ({ name: t.name, popularity: t.popularity })) }, 90), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  let history = [];
  try { history = await Promise.race([kvListGet(HISTORY_KEY, 0, 29), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}
  result.history = history || [];

  res.status(200).json(result);
}
