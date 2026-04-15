// Spotify Tracker — Madonna
// Single combined search call + one albums call = 2 API calls total
// Caches in Blob for persistence across deploys

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify_snapshot";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 43200;

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
      await new Promise((r) => setTimeout(r, wait * 1000));
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      return r2.ok ? r2.json() : null;
    }
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  // Serve cache
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
    return res.status(200).json({ hasCredentials: false, error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local" });
  }

  const token = await getToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: "Could not get access token — check credentials" });
  }

  // ── ONE combined search: artist + tracks + playlists in a single call ──
  const search = await spGet("/search?q=Madonna&type=artist,track,playlist&limit=50&market=GB", token);

  if (!search) {
    const stale = await kvGet(CACHE_KEY);
    if (stale && stale.artist) {
      stale.fromCache = true;
      stale.history = await kvListGet("spotify_history", 0, 11);
      return res.status(200).json(stale);
    }
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Spotify API returned null — likely rate limited. Wait 30s and retry." },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const artist = search.artists?.items?.find(a => a.name.toLowerCase() === "madonna");
  if (!artist) {
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Madonna not found in search results", results: search.artists?.items?.map(a => a.name) },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const ARTIST_ID = artist.id;

  // Filter tracks to only Madonna's
  const tracks = (search.tracks?.items || [])
    .filter(t => t.artists?.some(a => a.id === ARTIST_ID))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // ── ONE albums call ──
  await new Promise((r) => setTimeout(r, 500));
  const albumsData = await spGet(`/artists/${ARTIST_ID}/albums?limit=50&include_groups=album,single,compilation`, token);

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
    albums: (albumsData?.items || []).map(a => ({
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    playlists: (search.playlists?.items || []).filter(Boolean).map(p => ({
      name: p.name,
      owner: p.owner?.display_name || "",
      tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "",
      image: p.images?.[0]?.url || "",
    })),
    relatedArtists: [],
    audienceTrending: [],
  };

  // Persist to Blob
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
