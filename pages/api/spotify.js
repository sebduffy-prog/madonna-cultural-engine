// Spotify Tracker — Madonna
// Client Credentials flow. Correct artist ID: 6tbjWDEIzxoDsBA1FuhfPW
// Per OpenAPI spec: search limit=10, albums limit=10, paginate for more
// 5 staggered API calls total

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify_snapshot";
const CACHE_TTL = 43200; // 12 hours
const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW"; // verified correct

let tokenCache = { token: null, expires: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
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
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 429) {
      const wait = parseInt(r.headers.get("retry-after") || "3", 10);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      return r2.ok ? r2.json() : null;
    }
    if (!r.ok) {
      console.error(`[spotify] ${r.status} for ${path}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[spotify] error for ${path}:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.artist) {
      cached.history = await kvListGet("spotify_history", 0, 11);
      return res.status(200).json(cached);
    }
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[spotify] Missing credentials:", { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return res.status(200).json({
      hasCredentials: false,
      error: "Spotify credentials missing. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to Vercel Environment Variables.",
    });
  }

  const token = await getToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: "Could not get access token" });
  }

  // ── Call 1: Get Madonna's artist profile directly (known ID) ──
  const artist = await spGet(`/artists/${MADONNA_ID}`, token);
  if (!artist) {
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Could not fetch artist profile" },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  // ── Call 2: Search for tracks (limit=10 per spec) ──
  await new Promise((r) => setTimeout(r, 300));
  const trackSearch = await spGet(`/search?q=artist:Madonna&type=track&limit=10&market=GB`, token);

  // ── Call 3: More tracks page 2 ──
  await new Promise((r) => setTimeout(r, 300));
  const trackSearch2 = await spGet(`/search?q=artist:Madonna&type=track&limit=10&offset=10&market=GB`, token);

  // ── Call 4: Albums (limit=10, paginate) ──
  await new Promise((r) => setTimeout(r, 300));
  const albums1 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=0`, token);

  // ── Call 5: Albums page 2 ──
  await new Promise((r) => setTimeout(r, 300));
  const albums2 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=10`, token);

  // Merge tracks, filter to Madonna's, dedup
  const allTrackItems = [
    ...(trackSearch?.tracks?.items || []),
    ...(trackSearch2?.tracks?.items || []),
  ];
  const seenTracks = new Set();
  const tracks = allTrackItems.filter(t => {
    if (seenTracks.has(t.id)) return false;
    seenTracks.add(t.id);
    return t.artists?.some(a => a.id === MADONNA_ID);
  }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const allAlbums = [...(albums1?.items || []), ...(albums2?.items || [])];

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL,
    artist: {
      name: artist.name,
      followers: artist.followers?.total || 0,
      popularity: artist.popularity || 0,
      genres: artist.genres || [],
      image: artist.images?.[0]?.url || "",
      imageSmall: artist.images?.[1]?.url || "",
    },
    topTracks: tracks.slice(0, 20).map(t => ({
      name: t.name,
      album: t.album?.name || "",
      albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
      albumImageSmall: t.album?.images?.[2]?.url || "",
      popularity: t.popularity || 0,
      externalUrl: t.external_urls?.spotify || "",
      durationMs: t.duration_ms,
      releaseDate: t.album?.release_date || "",
    })),
    albums: allAlbums.map(a => ({
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    playlists: [],
    relatedArtists: [],
    audienceTrending: [],
  };

  if (result.topTracks.length > 0 || result.albums.length > 0) {
    await kvSet(CACHE_KEY, result, CACHE_TTL);
  }

  await kvListPush("spotify_history", {
    date: result.fetchedAt,
    popularity: result.artist.popularity,
    followers: result.artist.followers,
  });

  result.history = await kvListGet("spotify_history", 0, 11);
  res.status(200).json(result);
}
