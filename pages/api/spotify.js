// Spotify Tracker — Madonna
// NO Blob dependency — in-memory cache only to avoid Blob SDK hangs
// 5 staggered API calls, all with 8-second timeouts
// Verified artist ID: 6tbjWDEIzxoDsBA1FuhfPW

const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW";
const CACHE_TTL = 43200000; // 12 hours in ms

let cache = { data: null, expires: 0 };
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
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error("[spotify] token failed:", r.status);
      return null;
    }
    const d = await r.json();
    tokenCache = { token: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return d.access_token;
  } catch (err) {
    console.error("[spotify] token error:", err.message);
    return null;
  }
}

async function spGet(path, token) {
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) {
      const wait = Math.min(parseInt(r.headers.get("retry-after") || "3", 10), 10);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      return r2.ok ? r2.json() : null;
    }
    if (!r.ok) {
      console.error(`[spotify] ${r.status} for ${path}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[spotify] error ${path}:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // Serve memory cache
  if (cache.data && Date.now() < cache.expires) {
    return res.status(200).json(cache.data);
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(200).json({
      hasCredentials: false,
      error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to Vercel Environment Variables.",
      debug: { hasClientId: !!clientId, hasClientSecret: !!clientSecret },
    });
  }

  const token = await getToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: "Token request failed" });
  }

  // Call 1: Artist profile
  const artist = await spGet(`/artists/${MADONNA_ID}`, token);
  if (!artist) {
    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: { error: "Could not fetch artist — check logs" },
      topTracks: [], albums: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL / 1000,
    });
  }

  // Calls 2-5: staggered
  await new Promise((r) => setTimeout(r, 300));
  const [tracks1, tracks2] = await Promise.all([
    spGet("/search?q=artist:Madonna&type=track&limit=10&market=GB", token),
    spGet("/search?q=artist:Madonna&type=track&limit=10&offset=10&market=GB", token),
  ]);

  await new Promise((r) => setTimeout(r, 300));
  const [albums1, albums2] = await Promise.all([
    spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=0`, token),
    spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=10`, token),
  ]);

  // Process tracks
  const seen = new Set();
  const tracks = [...(tracks1?.tracks?.items || []), ...(tracks2?.tracks?.items || [])]
    .filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return t.artists?.some(a => a.id === MADONNA_ID);
    })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL / 1000,
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
    albums: [...(albums1?.items || []), ...(albums2?.items || [])].map(a => ({
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
    history: [],
  };

  // Memory cache only — no Blob
  cache = { data: result, expires: Date.now() + CACHE_TTL };

  res.status(200).json(result);
}
