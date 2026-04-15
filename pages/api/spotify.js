// Spotify — DISABLED
// Awaiting Pulsar integration for streaming data.

export default async function handler(req, res) {
  res.status(200).json({
    hasCredentials: false,
    disabled: true,
    error: "Spotify tracker is being rebuilt with Pulsar integration.",
    topTracks: [],
    albums: [],
    playlists: [],
    relatedArtists: [],
    audienceTrending: [],
  });
}
