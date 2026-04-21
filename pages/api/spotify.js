// Spotify Tracker — Madonna
// Client Credentials flow (public data only, no user auth needed)
// 4 API calls in parallel: artist, top-tracks, albums, related-artists
// Zero search calls. Zero unnecessary delays.
//
// Per Spotify Developer Terms:
// - No caching beyond immediate use (we cache 12h for dashboard display)
// - Attribution to Spotify in UI
// - No ML training on this data

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW";
const CACHE_TTL = 43200; // 12 hours
const CACHE_KEY = "spotify_data";

let tokenCache = { token: null, expires: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return { error: "missing_credentials" };
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
      const errBody = await r.text().catch(() => "");
      console.error(`[spotify] Token failed: ${r.status} — ${errBody.slice(0, 200)}`);
      return { error: "token_failed", status: r.status, detail: errBody.slice(0, 200) };
    }
    const d = await r.json();
    tokenCache = { token: d.access_token, expires: Date.now() + (d.expires_in - 60) * 1000 };
    return tokenCache;
  } catch (err) {
    console.error("[spotify] Token error:", err.message);
    return { error: "token_exception", message: err.message };
  }
}

async function spGet(path, token) {
  try {
    const r = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) {
      const retryAfter = parseInt(r.headers.get("retry-after") || "5", 10);
      console.warn(`[spotify] 429 on ${path.split("?")[0]}, retry after ${retryAfter}s`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!r2.ok) return null;
      return r2.json();
    }
    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error(`[spotify] ${r.status} on ${path.split("?")[0]}: ${errBody.slice(0, 300)}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[spotify] Error on ${path.split("?")[0]}:`, err.message);
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
    return res.status(503).json({ hasCredentials: false, error: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in Vercel env vars" });
  }

  const tokenResult = await getToken();
  if (tokenResult.error) {
    return res.status(503).json({
      hasCredentials: tokenResult.error !== "missing_credentials",
      error: `Token failed: ${tokenResult.error}`,
      debug: {
        tokenError: tokenResult.error, tokenStatus: tokenResult.status || null,
        detail: tokenResult.detail || null,
        hasId: !!process.env.SPOTIFY_CLIENT_ID, hasSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
      },
    });
  }
  const token = tokenResult.token;

  // ── 4 calls in parallel — no search, no delays ──
  const [artist, topTracksData, albumsData, relatedData] = await Promise.all([
    spGet(`/artists/${MADONNA_ID}`, token),
    spGet(`/artists/${MADONNA_ID}/top-tracks?market=GB`, token),
    spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=50&market=GB`, token),
    spGet(`/artists/${MADONNA_ID}/related-artists`, token),
  ]);

  if (!artist) {
    return res.status(502).json({
      hasCredentials: true, artist: null,
      error: "Artist fetch failed — check Spotify credentials or Spotify may be down",
    });
  }

  // Detect restricted mode: artist returns but with 0 popularity and 0 followers
  const isRestricted = artist.popularity === 0 && (artist.followers?.total || 0) === 0 && artist.name;

  const tracks = (topTracksData?.tracks || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const allAlbums = albumsData?.items || [];
  const relatedArtists = relatedData?.artists || [];

  // ═══ DERIVED INSIGHTS ═══

  // Top track era analysis — which decade dominates her streaming?
  const eraMap = {};
  tracks.forEach(t => {
    const year = parseInt(t.album?.release_date?.slice(0, 4)) || 0;
    const decade = year >= 2020 ? "2020s" : year >= 2010 ? "2010s" : year >= 2000 ? "2000s" : year >= 1990 ? "1990s" : year >= 1980 ? "1980s" : "other";
    if (!eraMap[decade]) eraMap[decade] = { tracks: 0, totalPopularity: 0, names: [] };
    eraMap[decade].tracks++;
    eraMap[decade].totalPopularity += t.popularity || 0;
    if (eraMap[decade].names.length < 3) eraMap[decade].names.push(t.name);
  });
  const eraBreakdown = Object.entries(eraMap)
    .map(([era, d]) => ({ era, tracks: d.tracks, avgPopularity: d.tracks > 0 ? Math.round(d.totalPopularity / d.tracks) : 0, topTracks: d.names }))
    .sort((a, b) => b.avgPopularity - a.avgPopularity);

  // Popularity distribution — how concentrated is streaming?
  const popValues = tracks.map(t => t.popularity || 0);
  const popMax = Math.max(...popValues, 1);
  const popMin = Math.min(...popValues);
  const popAvg = popValues.length > 0 ? Math.round(popValues.reduce((s, v) => s + v, 0) / popValues.length) : 0;
  const top3Share = popValues.length >= 3 ? Math.round((popValues.slice(0, 3).reduce((s, v) => s + v, 0) / popValues.reduce((s, v) => s + v, 1)) * 100) : 0;

  // Catalogue depth — albums by type
  const albumsByType = {};
  allAlbums.forEach(a => {
    const type = a.album_type || "unknown";
    albumsByType[type] = (albumsByType[type] || 0) + 1;
  });

  // Genre positioning — Madonna's genres vs related artists' genres
  const madonnaGenres = new Set(artist.genres || []);
  const relatedGenreMap = {};
  relatedArtists.forEach(a => {
    (a.genres || []).forEach(g => {
      relatedGenreMap[g] = (relatedGenreMap[g] || 0) + 1;
    });
  });
  const sharedGenres = Object.entries(relatedGenreMap)
    .filter(([g]) => madonnaGenres.has(g))
    .map(([genre, count]) => ({ genre, count, shared: true }));
  const uniqueRelatedGenres = Object.entries(relatedGenreMap)
    .filter(([g]) => !madonnaGenres.has(g))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count, shared: false }));

  // Popularity percentile among related artists
  const relatedPops = relatedArtists.map(a => a.popularity || 0).sort((a, b) => a - b);
  const madonnaPopPercentile = relatedPops.length > 0
    ? Math.round((relatedPops.filter(p => p <= (artist.popularity || 0)).length / relatedPops.length) * 100)
    : 0;

  // Related artists summary stats
  const relatedAvgPop = relatedArtists.length > 0
    ? Math.round(relatedArtists.reduce((s, a) => s + (a.popularity || 0), 0) / relatedArtists.length)
    : 0;
  const relatedAvgFollowers = relatedArtists.length > 0
    ? Math.round(relatedArtists.reduce((s, a) => s + (a.followers?.total || 0), 0) / relatedArtists.length)
    : 0;

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL,
    apiCalls: 4,
    isRestricted,
    ...(isRestricted ? {
      restrictedWarning: "Spotify app appears to be in Development Mode or has restricted permissions. Artist data returns but top tracks, albums, and related artists are blocked (403). Go to developer.spotify.com/dashboard > your app > Settings and check: 1) App status is not in Development Mode, 2) Client ID and Secret are correct, 3) You may need to request Extended Quota Mode.",
    } : {}),

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
      name: a.name, type: a.album_type, releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "", imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),

    relatedArtists: relatedArtists.slice(0, 20).map(a => ({
      id: a.id, name: a.name, popularity: a.popularity || 0,
      genres: a.genres || [], followers: a.followers?.total || 0,
      image: a.images?.[0]?.url || "", imageSmall: a.images?.[1]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),

    // ═══ DERIVED INSIGHTS ═══
    insights: {
      eraBreakdown,
      popularityDistribution: {
        max: popMax, min: popMin, avg: popAvg,
        top3SharePercent: top3Share,
        trackCount: tracks.length,
      },
      catalogueDepth: {
        totalReleases: allAlbums.length,
        byType: albumsByType,
        latestRelease: allAlbums[0]?.release_date || null,
        earliestRelease: allAlbums[allAlbums.length - 1]?.release_date || null,
      },
      genrePositioning: {
        madonnaGenres: [...madonnaGenres],
        sharedWithRelated: sharedGenres,
        adjacentGenres: uniqueRelatedGenres,
      },
      competitivePosition: {
        popularityPercentile: madonnaPopPercentile,
        relatedAvgPopularity: relatedAvgPop,
        relatedAvgFollowers: relatedAvgFollowers,
        popularityDelta: (artist.popularity || 0) - relatedAvgPop,
      },
    },

    // Legacy fields for backwards compatibility
    playlists: [],
    connectedArtists: [],
    connectedSongs: [],
    playlistAnalysed: null,
    playlistTrackCount: 0,
    audienceTrending: [],
    history: [],
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}

  // Track popularity over time
  try {
    await kvListPush("spotify_popularity_history", {
      date: new Date().toISOString(),
      artistPopularity: artist.popularity || 0,
      followers: artist.followers?.total || 0,
      topTrackAvgPopularity: popAvg,
      topTrackNames: tracks.slice(0, 5).map(t => t.name),
    }, 365);
  } catch {}

  // Load history
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
