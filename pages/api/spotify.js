// Spotify Tracker — Madonna
// 4 sequential calls + 1 playlist deep-dive = 5 total
// Connected artists from playlist co-occurrence analysis

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const MADONNA_ID = "6tbjWDEIzxoDsBA1FuhfPW";
const CACHE_TTL = 43200;
const CACHE_KEY = "spotify_data";

let tokenCache = { token: null, expires: 0 };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
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
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) {
      const wait = Math.min(parseInt(r.headers.get("retry-after") || "5", 10), 15);
      console.log(`[spotify] 429 on ${path.split("?")[0]}, waiting ${wait}s`);
      await delay(wait * 1000);
      const r2 = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      return r2.ok ? r2.json() : null;
    }
    if (!r.ok) { console.error(`[spotify] ${r.status} on ${path.split("?")[0]}`); return null; }
    return r.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.artist) return res.status(200).json(cached);
    } catch {}
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.status(200).json({ hasCredentials: false, error: "Missing Spotify credentials in Vercel env vars" });
  }

  const token = await getToken();
  if (!token) return res.status(200).json({ hasCredentials: false, error: "Token failed" });

  // ── Call 1: Artist ──
  const artist = await spGet(`/artists/${MADONNA_ID}`, token);
  if (!artist) return res.status(200).json({ hasCredentials: true, artist: null, debug: { error: "Artist fetch failed" } });

  // ── Call 2: Search tracks + playlists (1 call) ──
  await delay(1000);
  const search = await spGet("/search?q=Madonna&type=track,playlist&limit=10&market=GB", token);

  // ── Call 3: Albums ──
  await delay(1000);
  const albums = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=0`, token);

  // ── Call 4: More albums ──
  await delay(1000);
  const albums2 = await spGet(`/artists/${MADONNA_ID}/albums?include_groups=album,single,compilation&limit=10&offset=10`, token);

  // Process tracks
  const seenTracks = new Set();
  const tracks = (search?.tracks?.items || [])
    .filter(t => { if (seenTracks.has(t.id)) return false; seenTracks.add(t.id); return t.artists?.some(a => a.id === MADONNA_ID); })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const playlists = (search?.playlists?.items || []).filter(Boolean);

  // ── Call 5: Fetch the BIGGEST playlist for connected artists ──
  // Pick the playlist with the most tracks
  const connectedMap = {};
  let playlistAnalysed = null;
  let playlistTrackCount = 0;
  const connectedSongs = [];

  const biggestPlaylist = playlists.filter(p => p.tracks?.total > 20).sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0))[0];

  if (biggestPlaylist) {
    await delay(1000);
    const plData = await spGet(`/playlists/${biggestPlaylist.id}?fields=name,tracks.total,tracks.items(track(id,name,popularity,artists(id,name)))`, token);
    if (plData?.tracks?.items) {
      playlistAnalysed = plData.name || biggestPlaylist.name;
      playlistTrackCount = plData.tracks.items.length;

      for (const item of plData.tracks.items) {
        const track = item.track;
        if (!track?.artists) continue;

        // Check if Madonna is on this track
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
          // If they appear on the SAME track as Madonna = featured/collab
          if (hasMadonna) {
            connectedMap[a.id].isFeatured = true;
            if (!connectedSongs.find(s => s.trackId === track.id)) {
              connectedSongs.push({
                trackId: track.id,
                trackName: track.name,
                artists: track.artists.map(a => a.name).join(", "),
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
    relatedArtists: [],
    audienceTrending: [],
    history: [],
  };

  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  res.status(200).json(result);
}
