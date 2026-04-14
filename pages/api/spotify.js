// Spotify Streaming Tracker -- Madonna
// Client Credentials flow (no user login)
// Dev mode: 2-minute cache for near-live updates
// Production: 30-minute cache to stay within rate limits
// Spotify free tier: no hard rate limit but recommends <30 req/min

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

// Resolved dynamically via search -- cached after first lookup
let resolvedArtistId = null;
const CACHE_KEY = "spotify:snapshot";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 120 : 1800; // 2 min dev, 30 min prod

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
      const errBody = await res.text().catch(() => "");
      tokenError = `Token request failed: ${res.status} ${errBody.slice(0, 200)}`;
      console.error(tokenError);
      return null;
    }
    const data = await res.json();
    tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    tokenError = null;
    return data.access_token;
  } catch (err) {
    tokenError = `Token request error: ${err.message}`;
    console.error(tokenError);
    return null;
  }
}

async function spotifyFetch(endpoint, token) {
  try {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`Spotify ${endpoint} failed: ${res.status} ${errBody.slice(0, 200)}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(`Spotify ${endpoint} error:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh, snapshot } = req.query;

  // Check cache unless forced refresh
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
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
      error: "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local\n\n1. Go to developer.spotify.com/dashboard\n2. Create an App\n3. Copy Client ID and Client Secret",
    });
  }

  const token = await getAccessToken();
  if (!token) {
    return res.status(200).json({
      hasCredentials: false,
      error: `Spotify credentials found but authentication failed.\n\n${tokenError || "Unknown error"}\n\nCheck your Client ID and Secret are correct.`,
      debugClientId: clientId ? clientId.slice(0, 8) + "..." : "missing",
    });
  }

  // Resolve Madonna's artist ID dynamically via search
  if (!resolvedArtistId) {
    const searchResult = await spotifyFetch(`/search?q=Madonna&type=artist&limit=5`, token);
    const match = searchResult?.artists?.items?.find(
      (a) => a.name.toLowerCase() === "madonna"
    );
    if (match) {
      resolvedArtistId = match.id;
    } else if (searchResult?.artists?.items?.[0]) {
      resolvedArtistId = searchResult.artists.items[0].id;
    }
  }

  if (!resolvedArtistId) {
    return res.status(200).json({
      hasCredentials: true,
      artist: null,
      debug: { tokenOk: true, tokenLength: token.length, error: "Could not find Madonna on Spotify via search" },
      topTracks: [], albums: [], relatedArtists: [], audienceTrending: [], playlists: [],
      fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL,
    });
  }

  const ARTIST_ID = resolvedArtistId;

  // Fetch everything in parallel
  const [artist, topTracks, albumsPage1, related, playlistSearch, newReleases] = await Promise.all([
    spotifyFetch(`/artists/${ARTIST_ID}`, token),
    spotifyFetch(`/artists/${ARTIST_ID}/top-tracks?market=GB`, token),
    spotifyFetch(`/artists/${ARTIST_ID}/albums?include_groups=album,single,compilation&limit=50&market=GB`, token),
    spotifyFetch(`/artists/${ARTIST_ID}/related-artists`, token),
    spotifyFetch(`/search?q=Madonna&type=playlist&limit=30&market=GB`, token),
    spotifyFetch(`/browse/new-releases?limit=20&country=GB`, token),
  ]);

  // Get top tracks from connected artists for audience trending
  const relatedArtists = (related?.artists || []).slice(0, 20);
  const relatedTopTracks = await Promise.all(
    relatedArtists.slice(0, 12).map((a) => spotifyFetch(`/artists/${a.id}/top-tracks?market=GB`, token))
  );

  const audienceTrending = [];
  relatedTopTracks.forEach((data, i) => {
    if (!data?.tracks) return;
    const art = relatedArtists[i];
    data.tracks.slice(0, 3).forEach((t) => {
      audienceTrending.push({
        name: t.name,
        artist: art.name,
        artistImage: art.images?.[2]?.url || "",
        album: t.album?.name || "",
        albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
        popularity: t.popularity || 0,
        externalUrl: t.external_urls?.spotify || "",
      });
    });
  });
  audienceTrending.sort((a, b) => b.popularity - a.popularity);

  // Debug: track which fetches failed
  const debug = {
    tokenOk: !!token,
    tokenLength: token ? token.length : 0,
    artistOk: !!artist,
    topTracksOk: !!topTracks,
    albumsOk: !!albumsPage1,
    relatedOk: !!related,
    playlistsOk: !!playlistSearch,
    relatedCount: relatedArtists.length,
    audienceTrendingCount: audienceTrending.length,
  };

  const result = {
    hasCredentials: true,
    fetchedAt: new Date().toISOString(),
    cacheTTL: CACHE_TTL,
    debug,
    artist: artist ? {
      name: artist.name,
      followers: artist.followers?.total || 0,
      popularity: artist.popularity || 0,
      genres: artist.genres || [],
      image: artist.images?.[0]?.url || "",
      imageSmall: artist.images?.[1]?.url || "",
    } : null,
    topTracks: (topTracks?.tracks || []).map((t) => ({
      name: t.name,
      album: t.album?.name || "",
      albumImage: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || "",
      albumImageSmall: t.album?.images?.[2]?.url || "",
      popularity: t.popularity || 0,
      externalUrl: t.external_urls?.spotify || "",
      durationMs: t.duration_ms,
      releaseDate: t.album?.release_date || "",
      explicit: t.explicit,
    })),
    albums: (albumsPage1?.items || []).map((a) => ({
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date || "",
      totalTracks: a.total_tracks || 0,
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[1]?.url || a.images?.[0]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    relatedArtists: relatedArtists.map((a) => ({
      name: a.name,
      popularity: a.popularity || 0,
      followers: a.followers?.total || 0,
      genres: (a.genres || []).slice(0, 3),
      image: a.images?.[0]?.url || "",
      imageSmall: a.images?.[2]?.url || "",
      externalUrl: a.external_urls?.spotify || "",
    })),
    audienceTrending: audienceTrending.slice(0, 36),
    playlists: (playlistSearch?.playlists?.items || []).filter(Boolean).map((p) => ({
      name: p.name,
      owner: p.owner?.display_name || "",
      tracks: p.tracks?.total || 0,
      externalUrl: p.external_urls?.spotify || "",
      image: p.images?.[0]?.url || "",
    })),
  };

  // Cache with appropriate TTL
  await kvSet(CACHE_KEY, result, CACHE_TTL);

  // Store weekly snapshot if explicitly requested (from cron)
  if (snapshot) {
    await kvListPush("spotify:history", {
      date: result.fetchedAt,
      popularity: result.artist?.popularity,
      followers: result.artist?.followers,
      topTrackPopularity: result.topTracks.slice(0, 10).map((t) => ({ name: t.name, popularity: t.popularity })),
    });
  }

  // Attach history
  const history = await kvListGet("spotify:history", 0, 11);
  result.history = history;

  res.status(200).json(result);
}
