// Spotify Tracker — Madonna
// Uses proper artist endpoints: top-tracks, albums, related-artists
// Connected artists from playlist co-occurrence analysis

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW";
const CACHE_TTL = 43200;
const CACHE_KEY = "spotify_data";
const MAX_RETRIES = 3;

let tokenCache = { token: null, expires: 0 };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return { error: "missing_credentials" };
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error(`[spotify] Token request failed: ${r.status} — ${errBody.slice(0, 200)}`);
      return { error: "token_failed", status: r.status, detail: errBody.slice(0, 200) };
    }
    const d = await r.json();
    tokenCache = { token: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return { token: d.access_token };
  } catch (err) {
    console.error("[spotify] Token fetch error:", err.message);
    return { error: "token_exception", message: err.message };
  }
}

async function spGet(path, token, attempt = 1) {
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) {
      if (attempt >= MAX_RETRIES) {
        console.error(`[spotify] 429 on ${path.split("?")[0]} after ${MAX_RETRIES} retries`);
        return null;
      }
      const retryAfter = parseInt(r.headers.get("retry-after") || "5", 10);
      const wait = Math.min(retryAfter, 30) * Math.pow(2, attempt - 1);
      console.log(`[spotify] 429 on ${path.split("?")[0]}, retry ${attempt}/${MAX_RETRIES} in ${wait}s`);
      await delay(wait * 1000);
      return spGet(path, token, attempt + 1);
    }
    if (!r.ok) {
      console.error(`[spotify] ${r.status} on ${path.split("?")[0]}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[spotify] Exception on ${path.split("?")[0]}:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.artist) return res.status(200).json(cached);
    } catch {}
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.status(503).json({ hasCredentials: false, error: "Missing Spotify credentials in Vercel env vars" });
  }

  const tokenResult = await getToken();
  if (tokenResult.error) {
    return res.status(503).json({
      hasCredentials: tokenResult.error !== "missing_credentials",
      error: `Token failed: ${tokenResult.error}`,
      debug: {
        tokenError: tokenResult.error,
        tokenStatus: tokenResult.status || null,
        detail: tokenResult.detail || null,
        hasId: !!process.env.SPOTIFY_CLIENT_ID,
        hasSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
        idPrefix: process.env.SPOTIFY_CLIENT_ID ? process.env.SPOTIFY_CLIENT_ID.slice(0, 6) + "..." : null,
      },
    });
  }
  const token = tokenResult.token;

  // ── Call 1: Artist profile ──
  const artist = await spGet(`/artists/${MADONNA_ID}`, token);
  if (!artist) {
    return res.status(502).json({
      hasCredentials: true, artist: null,
      debug: { error: "Artist fetch failed — Spotify may be down or rate-limiting" },
    });
  }

  // ── Call 2: Top tracks ──
  await delay(500);
  const topTracksData = await spGet(`/artists/${MADONNA_ID}/top-tracks?market=GB`, token);

  // ── Call 3: Search playlists ──
  await delay(500);
  const playlistSearch = await spGet("/search?q=Madonna&type=playlist&limit=15&market=GB", token);

  // ── Call 4: Albums page 1 ──
  await delay(500);
  const albums = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=20&offset=0`, token);

  // ── Call 5: Albums page 2 ──
  await delay(500);
  const albums2 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=20&offset=20`, token);

  // ── Call 6: Related artists ──
  await delay(500);
  const relatedData = await spGet(`/artists/${MADONNA_ID}/related-artists`, token);

  // Process top tracks — fall back to search if top-tracks endpoint fails
  let tracks = (topTracksData?.tracks || [])
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  if (tracks.length === 0) {
    // Fallback: search for Madonna tracks
    await delay(500);
    const searchFallback = await spGet("/search?q=Madonna&type=track&limit=20&market=GB", token);
    const seenTracks = new Set();
    tracks = (searchFallback?.tracks?.items || [])
      .filter(t => { if (seenTracks.has(t.id)) return false; seenTracks.add(t.id); return t.artists?.some(a => a.id === MADONNA_ID); })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }

  const playlists = (playlistSearch?.playlists?.items || []).filter(Boolean);

  // ── Call 7: Fetch the BIGGEST playlist for connected artists ──
  const connectedMap = {};
  let playlistAnalysed = null;
  let playlistTrackCount = 0;
  const connectedSongs = [];

  const biggestPlaylist = playlists.filter(p => p.tracks?.total > 20).sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0))[0];

  if (biggestPlaylist) {
    await delay(300);
    const plData = await spGet(`/playlists/${biggestPlaylist.id}?fields=name,tracks.total,tracks.items(track(id,name,popularity,artists(id,name)))`, token);
    if (plData?.tracks?.items) {
      playlistAnalysed = plData.name || biggestPlaylist.name;
      playlistTrackCount = plData.tracks.items.length;

      for (const item of plData.tracks.items) {
        const track = item.track;
        if (!track?.artists) continue;

        const hasMadonna = track.artists.some(a => a.id === MADONNA_ID);

        for (const a of track.artists) {
          if (a.id === MADONNA_ID) continue;
          if (!connectedMap[a.id]) {
            connectedMap[a.id] = { id: a.id, name: a.name, count: 0, tracks: [], isFeatured: false };
          }
          connectedMap[a.id].count++;
          if (connectedMap[a.id].tracks.length < 5) {
            connectedMap[a.id].tracks.push(track.name);
          }
          if (hasMadonna) {
            connectedMap[a.id].isFeatured = true;
            if (!connectedSongs.find(s => s.trackId === track.id)) {
              connectedSongs.push({
                trackId: track.id,
                trackName: track.name,
                artists: track.artists.map(x => x.name).join(", "),
                popularity: track.popularity || 0,
              });
            }
          }
        }
      }
    }
  }

  const connectedArtists = Object.values(connectedMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map(a => ({
      ...a,
      connectivity: playlistTrackCount > 0 ? Math.round((a.count / playlistTrackCount) * 1000) / 10 : 0,
    }));

  const allAlbums = [...(albums?.items || []), ...(albums2?.items || [])];

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL,
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
    albums: allAlbums.map(a => ({
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
    connectedSongs: connectedSongs.sort((a, b) => b.popularity - a.popularity),
    playlistAnalysed,
    playlistTrackCount,
    relatedArtists: (relatedData?.artists || []).slice(0, 20).map(a => ({
      id: a.id, name: a.name, popularity: a.popularity || 0,
      genres: a.genres || [], followers: a.followers?.total || 0,
      image: a.images?.[0]?.url || "", imageSmall: a.images?.[1]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    audienceTrending: [],
    history: [],
  };

  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  // Track popularity over time
  try {
    await kvListPush("spotify_popularity_history", {
      date: new Date().toISOString(),
      artistPopularity: artist.popularity || 0,
      followers: artist.followers?.total || 0,
      topTrackAvgPopularity: tracks.length > 0
        ? Math.round(tracks.slice(0, 10).reduce((s, t) => s + (t.popularity || 0), 0) / Math.min(tracks.length, 10))
        : 0,
    }, 365);
  } catch {}

  // Load history into result
  let spotifyHistory = [];
  try { spotifyHistory = await kvListGet("spotify_popularity_history", 0, 364); } catch {}
  result.history = spotifyHistory;
  result.audienceTrending = spotifyHistory.slice(0, 7).map(h => ({
    date: h.date,
    popularity: h.artistPopularity,
    avgTrackPopularity: h.topTrackAvgPopularity,
  }));

  res.status(200).json(result);
}
