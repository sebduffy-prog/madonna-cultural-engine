// Spotify Tracker — Madonna
// Client Credentials flow. Minimal API calls to avoid rate limits.
// 5 total calls: 1 search + 1 artist albums + 2 track searches + 1 playlist
// Cache for 12 hours. Daily cron refresh.

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify:snapshot";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 43200;

let tokenCache = { token: null, expires: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json();
    tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

async function spotifyGet(endpoint, token) {
  try {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("retry-after") || "5", 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      const retry = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!retry.ok) return null;
      return retry.json();
    }
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  const { refresh, snapshot } = req.query;

  // Serve cache
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.artist) {
      cached.history = await kvListGet("spotify:history", 0, 11);
      return res.status(200).json(cached);
    }
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(200).json({ hasCredentials: false, error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local" });
  }

  const token = await getAccessToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: "Could not get access token" });
  }

  // ── Call 1: Search for Madonna artist ──
  const search = await spotifyGet("/search?q=Madonna&type=artist&limit=5", token);
  const artist = search?.artists?.items?.find(a => a.name.toLowerCase() === "madonna");

  if (!artist) {
    // Serve stale cache if available
    const stale = await kvGet(CACHE_KEY);
    if (stale && stale.artist) {
      stale.fromCache = true;
      stale.history = await kvListGet("spotify:history", 0, 11);
      return res.status(200).json(stale);
    }
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: {
        error: "Search returned no match for Madonna",
        searchReturned: search === null ? "API error (likely 429 rate limit — wait 30s)" : `${search?.artists?.items?.length || 0} results`,
        tokenObtained: true,
      },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const ARTIST_ID = artist.id;

  // ── Calls 2-5: parallel batch with one-second stagger ──
  await new Promise((r) => setTimeout(r, 500));

  const [trackSearch, albums, playlists] = await Promise.all([
    spotifyGet(`/search?q=artist:Madonna&type=track&limit=50&market=GB`, token),
    spotifyGet(`/artists/${ARTIST_ID}/albums?limit=50&include_groups=album,single,compilation`, token),
    spotifyGet(`/search?q=Madonna&type=playlist&limit=15`, token),
  ]);

  // ── Process tracks ──
  const tracks = (trackSearch?.tracks?.items || [])
    .filter(t => t.artists?.some(a => a.id === ARTIST_ID))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // ── Build result ──
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
    albums: (albums?.items || []).map(a => ({
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    playlists: (playlists?.playlists?.items || []).filter(Boolean).map(p => ({
      name: p.name,
      owner: p.owner?.display_name || "",
      tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "",
      image: p.images?.[0]?.url || "",
    })),
    // Related artists and audience trending removed — those endpoints
    // require Extended Quota Mode which this app doesn't have
    relatedArtists: [],
    audienceTrending: [],
  };

  if (result.topTracks.length > 0 || result.albums.length > 0) {
    await kvSet(CACHE_KEY, result, CACHE_TTL);
  }

  if (snapshot) {
    await kvListPush("spotify:history", {
      date: result.fetchedAt,
      popularity: result.artist.popularity,
      followers: result.artist.followers,
      topTrackPopularity: result.topTracks.slice(0, 5).map(t => ({ name: t.name, popularity: t.popularity })),
    });
  }

  result.history = await kvListGet("spotify:history", 0, 11);
  res.status(200).json(result);
}
