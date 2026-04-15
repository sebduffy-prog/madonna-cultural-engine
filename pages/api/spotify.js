// Spotify Tracker — Madonna
// Per OpenAPI spec: https://developer.spotify.com/reference/web-api/open-api-schema.yaml
// Client Credentials flow — no user auth needed for search, artists, albums
//
// API limits from spec:
//   /search: limit max=10, offset max=1000
//   /artists/{id}/albums: limit max=10
// Rate limits: exponential backoff with Retry-After header on 429

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify_snapshot";
const CACHE_TTL = 43200; // 12 hours

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

// Spotify fetch with exponential backoff on 429
async function spGet(path, token, attempt = 0) {
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 429 && attempt < 3) {
      const wait = parseInt(r.headers.get("retry-after") || "2", 10);
      const backoff = wait * 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return spGet(path, token, attempt + 1);
    }
    if (!r.ok) {
      console.error(`[spotify] ${r.status} ${r.statusText} for ${path}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[spotify] fetch error for ${path}:`, err.message);
    return null;
  }
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
    console.error("[spotify] Missing credentials:", { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return res.status(200).json({
      hasCredentials: false,
      error: "Spotify credentials missing. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to Vercel Environment Variables (Settings → Environment Variables).",
      debug: { hasClientId: !!clientId, hasClientSecret: !!clientSecret },
    });
  }

  const token = await getToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: "Could not get access token — check credentials" });
  }

  // ── Step 1: Search for Madonna (artist + tracks in one call, limit=10 per spec) ──
  const search = await spGet("/search?q=Madonna&type=artist,track&limit=10&market=GB", token);

  if (!search) {
    // Serve stale cache
    const stale = await kvGet(CACHE_KEY);
    if (stale && stale.artist) {
      stale.fromCache = true;
      stale.history = await kvListGet("spotify_history", 0, 11);
      return res.status(200).json(stale);
    }
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Spotify API call failed — check Vercel logs for status code" },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const artist = search.artists?.items?.find(a => a.name.toLowerCase() === "madonna");
  if (!artist) {
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Madonna not found", searchResults: (search.artists?.items || []).map(a => a.name) },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const ARTIST_ID = artist.id;

  // Tracks from initial search (filtered to Madonna's)
  const searchTracks = (search.tracks?.items || []).filter(t =>
    t.artists?.some(a => a.id === ARTIST_ID)
  );

  // ── Step 2: Get more tracks via paginated search (offset=10, limit=10) ──
  await new Promise((r) => setTimeout(r, 300));
  const search2 = await spGet(`/search?q=artist:Madonna&type=track&limit=10&offset=10&market=GB`, token);
  const moreTracks = (search2?.tracks?.items || []).filter(t =>
    t.artists?.some(a => a.id === ARTIST_ID)
  );

  // ── Step 3: Get albums (paginate: 2 calls × limit=10 = up to 20 albums) ──
  await new Promise((r) => setTimeout(r, 300));
  const albums1 = await spGet(`/artists/${ARTIST_ID}/albums?include_groups=album,single,compilation&limit=10&offset=0`, token);
  await new Promise((r) => setTimeout(r, 300));
  const albums2 = await spGet(`/artists/${ARTIST_ID}/albums?include_groups=album,single,compilation&limit=10&offset=10`, token);

  const allAlbums = [...(albums1?.items || []), ...(albums2?.items || [])];

  // ── Step 4: Playlists ──
  await new Promise((r) => setTimeout(r, 300));
  const playlistSearch = await spGet("/search?q=Madonna&type=playlist&limit=10", token);

  // ── Merge and deduplicate tracks ──
  const seenTracks = new Set();
  const allTracks = [...searchTracks, ...moreTracks].filter(t => {
    if (seenTracks.has(t.id)) return false;
    seenTracks.add(t.id);
    return true;
  }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

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
    topTracks: allTracks.slice(0, 20).map(t => ({
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
    playlists: (playlistSearch?.playlists?.items || []).filter(Boolean).map(p => ({
      name: p.name,
      owner: p.owner?.display_name || "",
      tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "",
      image: p.images?.[0]?.url || "",
    })),
    relatedArtists: [],
    audienceTrending: [],
  };

  // Persist
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
