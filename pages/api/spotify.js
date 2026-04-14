// Spotify Streaming Tracker -- Madonna
// Client Credentials flow (no user auth needed)
// Staggered API calls to respect Development mode rate limits
// Caches for 12 hours — daily cron refreshes

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify:snapshot";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 43200; // 5 min dev, 12 hours prod

let tokenCache = { token: null, expires: 0 };
let tokenError = null;

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
    if (!res.ok) {
      tokenError = `Token request failed: ${res.status}`;
      return null;
    }
    const data = await res.json();
    tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    tokenError = null;
    return data.access_token;
  } catch (err) {
    tokenError = err.message;
    return null;
  }
}

// Small delay between API calls to avoid 429
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function spotifyFetch(endpoint, token) {
  try {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      // Read Retry-After header if present
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
      await delay(retryAfter * 1000);
      // One retry after waiting
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

  // Return cached data if available and not force-refreshing
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.artist) {
      const history = await kvListGet("spotify:history", 0, 11);
      cached.history = history;
      return res.status(200).json(cached);
    }
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(200).json({
      hasCredentials: false,
      error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local",
    });
  }

  const token = await getAccessToken();
  if (!token) {
    return res.status(200).json({ hasCredentials: false, error: tokenError || "Auth failed" });
  }

  // ── Step 1: Find Madonna (single search, no retry spam) ──
  const artistSearch = await spotifyFetch("/search?q=Madonna&type=artist&limit=5", token);
  const madonnaArtist = artistSearch?.artists?.items?.find(a =>
    a.name.toLowerCase() === "madonna"
  );

  if (!madonnaArtist) {
    // If rate limited, try to serve stale cache
    const stale = await kvGet(CACHE_KEY);
    if (stale && stale.artist) {
      stale.fromCache = true;
      const history = await kvListGet("spotify:history", 0, 11);
      stale.history = history;
      return res.status(200).json(stale);
    }

    return res.status(200).json({
      hasCredentials: true, artist: null,
      debug: {
        error: "Could not find Madonna via Spotify search",
        testError: artistSearch === null
          ? "Search endpoint returned error. If rate limited, wait 30 seconds and retry. Check developer.spotify.com/dashboard — ensure Web API is enabled in your app settings."
          : `Search returned ${artistSearch?.artists?.items?.length || 0} results but none matched 'Madonna'`,
        tokenObtained: true,
        searchReturned: artistSearch === null ? "null (API error or 429)" : `${artistSearch?.artists?.items?.length || 0} artists`,
        clientIdPrefix: clientId.slice(0, 8) + "...",
      },
      topTracks: [], albums: [], relatedArtists: [], audienceTrending: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const ARTIST_ID = madonnaArtist.id;

  // ── Step 2: Fetch data in two parallel batches with a gap between ──

  // Batch 1: tracks + albums (parallel)
  const [trackSearch1, trackSearch2, albumsDirect] = await Promise.all([
    spotifyFetch(`/search?q=artist:Madonna&type=track&limit=50&market=GB`, token),
    spotifyFetch(`/search?q=Madonna+Hung+Up+Like+A+Prayer+Material+Girl+Vogue+Ray+Of+Light+Frozen+Music+Holiday&type=track&limit=50`, token),
    spotifyFetch(`/artists/${ARTIST_ID}/albums?limit=50&include_groups=album,single,compilation`, token),
  ]);

  await delay(1000); // one second gap between batches

  // Batch 2: playlists + related (parallel)
  const [playlistSearch, relatedSearch] = await Promise.all([
    spotifyFetch(`/search?q=Madonna&type=playlist&limit=20`, token),
    spotifyFetch(`/search?q=Kylie+Minogue+OR+Cher+OR+Janet+Jackson+OR+Dua+Lipa+OR+Lady+Gaga+OR+Cyndi+Lauper&type=artist&limit=15`, token),
  ]);

  // ── Step 3: Process tracks ──
  const allTrackResults = [
    ...(trackSearch1?.tracks?.items || []),
    ...(trackSearch2?.tracks?.items || []),
  ];
  const seenTracks = new Set();
  const madonnaTracksRaw = allTrackResults.filter(t => {
    if (seenTracks.has(t.id)) return false;
    seenTracks.add(t.id);
    return t.artists?.some(a => a.id === ARTIST_ID);
  });
  madonnaTracksRaw.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // ── Step 4: Process related artists ──
  const relatedRaw = relatedSearch?.artists?.items || [];
  const seenArtists = new Set([ARTIST_ID]);
  const relatedArtists = relatedRaw.filter(a => {
    if (seenArtists.has(a.id)) return false;
    seenArtists.add(a.id);
    return true;
  }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 15);

  // Batch 3: Audience trending (parallel, one batch)
  await delay(1000);
  const topRelated = relatedArtists.slice(0, 5);
  const relatedTrackResults = await Promise.all(
    topRelated.map(a => spotifyFetch(`/search?q=artist:${encodeURIComponent(a.name)}&type=track&limit=5&market=GB`, token))
  );
  const audienceTrending = [];
  relatedTrackResults.forEach((data, i) => {
    const art = topRelated[i];
    (data?.tracks?.items || []).slice(0, 3).forEach(t => {
      audienceTrending.push({
        name: t.name,
        artist: art.name,
        artistImage: art.images?.[2]?.url || "",
        album: t.album?.name || "",
        albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
        albumImageSmall: t.album?.images?.[2]?.url || "",
        popularity: t.popularity || 0,
        externalUrl: t.external_urls?.spotify || "",
      });
    });
  });
  audienceTrending.sort((a, b) => b.popularity - a.popularity);

  // ── Step 5: Build result ──
  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL,
    artist: {
      name: madonnaArtist.name,
      followers: madonnaArtist.followers?.total || 0,
      popularity: madonnaArtist.popularity || 0,
      genres: madonnaArtist.genres || [],
      image: madonnaArtist.images?.[0]?.url || "",
      imageSmall: madonnaArtist.images?.[1]?.url || "",
    },
    topTracks: madonnaTracksRaw.slice(0, 20).map(t => ({
      name: t.name,
      album: t.album?.name || "",
      albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
      albumImageSmall: t.album?.images?.[2]?.url || "",
      popularity: t.popularity || 0,
      externalUrl: t.external_urls?.spotify || "",
      durationMs: t.duration_ms,
      releaseDate: t.album?.release_date || "",
    })),
    albums: (albumsDirect?.items || []).filter(a => {
      return !a.artists || a.artists.some(ar => ar.id === ARTIST_ID || ar.name?.toLowerCase() === "madonna");
    }).map(a => ({
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    relatedArtists: relatedArtists.map(a => ({
      name: a.name,
      popularity: a.popularity || 0,
      followers: a.followers?.total || 0,
      genres: (a.genres || []).slice(0, 3),
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[2]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    audienceTrending: audienceTrending.slice(0, 30),
    playlists: (playlistSearch?.playlists?.items || []).filter(Boolean).map(p => ({
      name: p.name,
      owner: p.owner?.display_name || "",
      tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "",
      image: p.images?.[0]?.url || "",
    })),
  };

  // Cache if we got anything useful
  if (result.topTracks.length > 0 || result.albums.length > 0) {
    await kvSet(CACHE_KEY, result, CACHE_TTL);
  }

  if (snapshot) {
    await kvListPush("spotify:history", {
      date: result.fetchedAt,
      popularity: result.artist.popularity,
      followers: result.artist.followers,
      topTrackPopularity: result.topTracks.slice(0, 10).map(t => ({ name: t.name, popularity: t.popularity })),
    });
  }

  const history = await kvListGet("spotify:history", 0, 11);
  result.history = history;

  res.status(200).json(result);
}
