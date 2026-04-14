// Spotify Streaming Tracker -- Madonna
// Client Credentials flow -- uses only endpoints available without Extended Quota
// Some endpoints (top-tracks, related-artists) are restricted since late 2024
// We use search-based workarounds to get equivalent data

import { kvGet, kvSet, kvIsFresh, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "spotify:snapshot";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 120 : 1800;

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
      tokenError = `Token failed: ${res.status}`;
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

async function spotifyFetch(endpoint, token) {
  try {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  const { refresh, snapshot } = req.query;

  // Return cached data if it has real content and not force-refreshing
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.artist && cached.topTracks?.length > 0) {
      const history = await kvListGet("spotify:history", 0, 11);
      cached.history = history;
      return res.status(200).json(cached);
    }
    // Bad/empty cache -- fall through to re-fetch
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

  // Use search to find Madonna and get her profile
  const artistSearch = await spotifyFetch(`/search?q=Madonna&type=artist&limit=5`, token);
  const madonnaArtist = artistSearch?.artists?.items?.find(a => a.name.toLowerCase() === "madonna");

  if (!madonnaArtist) {
    return res.status(200).json({ hasCredentials: true, artist: null, debug: { error: "Could not find Madonna via search" }, topTracks: [], albums: [], relatedArtists: [], audienceTrending: [], playlists: [], fetchedAt: new Date().toISOString(), cacheTTL: CACHE_TTL });
  }

  const ARTIST_ID = madonnaArtist.id;

  // All fetches use search-based approach (direct artist endpoints return 403)
  const [
    trackSearch1,
    trackSearch2,
    trackSearch3,
    trackSearch4,
    albumSearch,
    playlistSearch,
    relatedSearch1,
    relatedSearch2,
  ] = await Promise.all([
    spotifyFetch(`/search?q=artist:Madonna&type=track&limit=20&market=GB`, token),
    spotifyFetch(`/search?q=Madonna+Hung+Up+Like+A+Prayer+Vogue&type=track&limit=20`, token),
    spotifyFetch(`/search?q=Madonna+Material+Girl+Ray+Of+Light+Frozen&type=track&limit=20`, token),
    spotifyFetch(`/search?q=Madonna+Music+Holiday+Express+Yourself+Into+Groove&type=track&limit=20`, token),
    spotifyFetch(`/search?q=artist:Madonna&type=album&limit=20`, token),
    spotifyFetch(`/search?q=Madonna&type=playlist&limit=20`, token),
    spotifyFetch(`/search?q=genre:dance-pop+genre:pop&type=artist&limit=20`, token),
    spotifyFetch(`/search?q=Kylie+Minogue+OR+Cher+OR+Janet+Jackson+OR+Dua+Lipa+OR+Lady+Gaga&type=artist&limit=10`, token),
  ]);

  const albumsData = albumSearch;

  // Merge and deduplicate tracks, keep only Madonna's
  const allTrackResults = [
    ...(trackSearch1?.tracks?.items || []),
    ...(trackSearch2?.tracks?.items || []),
    ...(trackSearch3?.tracks?.items || []),
    ...(trackSearch4?.tracks?.items || []),
  ];
  const seenTracks = new Set();
  const madonnaTracksRaw = allTrackResults.filter(t => {
    if (seenTracks.has(t.id)) return false;
    seenTracks.add(t.id);
    return t.artists?.some(a => a.id === ARTIST_ID);
  });
  madonnaTracksRaw.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Build related artists from search results (deduplicate, exclude Madonna)
  const relatedRaw = [
    ...(relatedSearch1?.artists?.items || []),
    ...(relatedSearch2?.artists?.items || []),
  ];
  const seenArtists = new Set([ARTIST_ID]);
  const relatedArtists = relatedRaw.filter(a => {
    if (seenArtists.has(a.id)) return false;
    seenArtists.add(a.id);
    return true;
  }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);

  // Get top tracks from related artists for audience trending
  const relatedTrackPromises = relatedArtists.slice(0, 8).map(a =>
    spotifyFetch(`/search?q=artist:${encodeURIComponent(a.name)}&type=track&limit=5&market=GB`, token)
  );
  const relatedTrackResults = await Promise.all(relatedTrackPromises);

  const audienceTrending = [];
  relatedTrackResults.forEach((data, i) => {
    const art = relatedArtists[i];
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

  // Artist data comes from search result (direct endpoint is 403)
  const artist = madonnaArtist;

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
    albums: (albumsData?.items || albumsData?.albums?.items || []).filter(a => {
      // If from search, filter to only Madonna's albums
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

  // Only cache if we got real data
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
