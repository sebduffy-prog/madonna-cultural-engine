import { useState, useEffect, useCallback, useRef } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const GREEN = "#1DB954";
const TEAL = "#2DD4BF";
const PINK = "#F472B6";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const PURPLE = "#A78BFA";

function Panel({ title, color = GREEN, children, span = 1 }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
      padding: "14px 16px", gridColumn: `span ${span}`, overflow: "hidden",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 10, fontFamily: "'Inter Tight', sans-serif",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{ width: 2, height: 12, background: color, borderRadius: 1 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniTrack({ track, rank, showArtist }) {
  return (
    <a href={track.externalUrl} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
      textDecoration: "none", borderBottom: `1px solid ${BORDER}22`,
    }}>
      {rank && <span style={{ fontSize: 10, color: MUTED, width: 16, textAlign: "right", fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>{rank}</span>}
      {track.albumImage && <img src={track.albumImageSmall || track.albumImage} alt="" style={{ width: 32, height: 32, borderRadius: 3 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: WHITE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
        <div style={{ fontSize: 9, color: DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {showArtist && track.artist ? `${track.artist} \u00B7 ` : ""}{track.album}
        </div>
      </div>
    </a>
  );
}

function ArtistRow({ artist, rank }) {
  return (
    <a href={artist.externalUrl} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
      textDecoration: "none", borderBottom: `1px solid ${BORDER}22`,
    }}>
      {rank && <span style={{ fontSize: 10, color: MUTED, width: 16, textAlign: "right", fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>{rank}</span>}
      {artist.imageSmall && <img src={artist.imageSmall} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: WHITE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist.name}</div>
        <div style={{ fontSize: 9, color: DIM }}>{artist.genres.join(", ") || "\u2014"}</div>
      </div>
    </a>
  );
}

export default function SpotifyTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(null);
  const [countdown, setCountdown] = useState("");
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spotify${refresh ? "?refresh=1" : ""}`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setLastRefresh(new Date());
        // Schedule next auto-refresh based on cache TTL
        const ttl = (d.cacheTTL || 120) * 1000;
        setNextRefresh(new Date(Date.now() + ttl));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh on cache expiry
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!data?.cacheTTL) return;
    const ttl = data.cacheTTL * 1000;
    intervalRef.current = setInterval(() => fetchData(true), ttl);
    return () => clearInterval(intervalRef.current);
  }, [data?.cacheTTL, fetchData]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      if (!nextRefresh) { setCountdown(""); return; }
      const diff = Math.max(0, nextRefresh.getTime() - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(diff > 0 ? `${m}:${s.toString().padStart(2, "0")}` : "refreshing...");
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [nextRefresh]);

  if (!data && loading) {
    return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Connecting to Spotify...</div>;
  }

  if (data && !data.hasCredentials) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{"\uD83C\uDFB5"}</div>
        <p style={{ fontSize: 16, color: WHITE, margin: "0 0 12px", fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}>Connect Spotify</p>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 4px", whiteSpace: "pre-line" }}>{data.error}</p>
        {data.debugClientId && <p style={{ fontSize: 10, color: DIM, marginTop: 8 }}>Client ID: {data.debugClientId}</p>}
      </div>
    );
  }

  if (!data) return null;

  // Show debug info if data came back but is empty
  if (data.hasCredentials && !data.artist && data.debug) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}>Spotify connected but API calls failing</p>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 4px" }}>
          {data.debug?.testStatus === 401 && "Token is invalid or expired. Check your Client ID and Secret."}
          {data.debug?.testStatus === 403 && "Access forbidden. Your Spotify app may need Web API access enabled in the dashboard."}
          {data.debug?.testStatus === 429 && "Rate limited. Wait a minute and try again."}
          {!data.debug?.testStatus && "Check the terminal for errors."}
        </p>
        {data.debug?.testError && (
          <p style={{ fontSize: 11, color: RED, margin: "0 0 12px", fontFamily: "monospace", wordBreak: "break-all" }}>
            {data.debug.testError.slice(0, 300)}
          </p>
        )}
        <div style={{ fontSize: 11, color: DIM, textAlign: "left", background: BG, padding: 12, borderRadius: 6, fontFamily: "monospace" }}>
          {Object.entries(data.debug).map(([k, v]) => (
            <div key={k}><span style={{ color: MUTED }}>{k}:</span> <span style={{ color: v === true ? GREEN : v === false ? RED : WHITE }}>{String(v)}</span></div>
          ))}
        </div>
        <button onClick={() => fetchData(true)} style={{ marginTop: 12, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: BG, background: GREEN, border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif" }}>
          Retry
        </button>
      </div>
    );
  }

  // Note: Spotify Client Credentials flow doesn't return popularity/follower metrics
  // We show track listings, albums, connected artists, and playlists instead

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: GREEN, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          Spotify Tracker
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {countdown && (
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
              Next update: {countdown}
            </span>
          )}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? AMBER : GREEN, animation: loading ? "pulse 1s infinite" : "none" }} />
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            style={{
              padding: "4px 12px", fontSize: 10, fontWeight: 600,
              color: BG, background: GREEN,
              border: "none", borderRadius: 4, cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif", opacity: loading ? 0.5 : 1,
            }}
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Artist hero card */}
      {data.artist && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
          background: `linear-gradient(135deg, ${CARD}, ${CARD}ee)`,
          border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 16,
        }}>
          {data.artist.image && <img src={data.artist.image} alt="" style={{ width: 80, height: 80, borderRadius: "50%", border: `2px solid ${GREEN}` }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{data.artist.name}</div>
            <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{data.artist.genres?.length > 0 ? data.artist.genres.join(" \u00B7 ") : "Pop \u00B7 Dance Pop \u00B7 Art Pop"}</div>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{data.topTracks?.length || 0}</div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tracks</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: PURPLE, fontFamily: "'Inter Tight', sans-serif" }}>{data.albums?.length || 0}</div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Albums</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>{data.playlists?.length || 0}</div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Playlists</div>
            </div>
          </div>
        </div>
      )}

      {/* Widget grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Top tracks panel */}
        <Panel title="Top Tracks" color={GREEN}>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {data.topTracks?.map((t, i) => <MiniTrack key={t.name} track={t} rank={i + 1} />)}
          </div>
        </Panel>

        {/* Playlists panel */}
        <Panel title={`Playlists (${data.playlists?.length || 0})`} color={PINK}>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {data.playlists?.length > 0 ? data.playlists.slice(0, 10).map((p, i) => (
              <a key={p.name + i} href={p.externalUrl} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 0",
                textDecoration: "none", borderBottom: `1px solid ${BORDER}22`,
              }}>
                {p.image && <img src={p.image} alt="" style={{ width: 28, height: 28, borderRadius: 3 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: WHITE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 8, color: DIM }}>{p.tracks?.toLocaleString()} tracks · {p.owner}</div>
                </div>
              </a>
            )) : <div style={{ fontSize: 11, color: MUTED, padding: 8 }}>No playlists found</div>}
          </div>
        </Panel>

        {/* Artist info panel */}
        <Panel title="Artist Profile" color={TEAL}>
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6 }}>
            {data.artist?.popularity > 0 && <div style={{ marginBottom: 6 }}>
              <span style={{ color: MUTED, fontSize: 9, textTransform: "uppercase" }}>Popularity</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${data.artist.popularity}%`, height: "100%", background: GREEN, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{data.artist.popularity}</span>
              </div>
            </div>}
            {data.artist?.followers > 0 && <div style={{ marginBottom: 6 }}>
              <span style={{ color: MUTED, fontSize: 9, textTransform: "uppercase" }}>Followers</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{data.artist.followers.toLocaleString()}</div>
            </div>}
            {data.artist?.genres?.length > 0 && <div>
              <span style={{ color: MUTED, fontSize: 9, textTransform: "uppercase" }}>Genres</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {data.artist.genres.map((g) => (
                  <span key={g} style={{ fontSize: 10, color: TEAL, background: TEAL + "18", padding: "2px 8px", borderRadius: 10, fontFamily: "'Inter Tight', sans-serif" }}>{g}</span>
                ))}
              </div>
            </div>}
          </div>
        </Panel>

        {/* Catalogue panel */}
        <Panel title={`Catalogue (${data.albums?.length || 0})`} color={PURPLE} span={2}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {data.albums?.map((a) => (
              <a key={a.name + a.releaseDate} href={a.externalUrl} target="_blank" rel="noopener noreferrer" style={{
                flexShrink: 0, width: 100, textDecoration: "none",
              }}>
                {a.imageSmall && <img src={a.imageSmall} alt="" style={{ width: 100, height: 100, borderRadius: 6, display: "block" }} />}
                <div style={{ fontSize: 10, fontWeight: 600, color: WHITE, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div style={{ fontSize: 8, color: MUTED }}>{a.releaseDate?.slice(0, 4)} \u00B7 {a.type}</div>
              </a>
            ))}
          </div>
        </Panel>

        {/* Connected Artists via Playlist Analysis */}
        <Panel title={`Connected Artists (${data.connectedArtists?.length || 0})`} color={TEAL} span={3}>
          {data.connectedArtists?.length > 0 ? (
            <>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 8, fontStyle: "italic" }}>
              Artists who appear alongside Madonna in curated playlists · {data.playlistsAnalysed} playlists · {data.totalPlaylistTracks} tracks analysed
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {data.connectedArtists.slice(0, 12).map((a) => (
                <div key={a.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{a.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEAL, fontFamily: "'Inter Tight', sans-serif" }}>{a.connectivity}%</span>
                  </div>
                  <div style={{ fontSize: 9, color: DIM }}>
                    {a.count} co-occurrences
                    {a.tracks?.length > 0 && ` · ${a.tracks.slice(0, 2).join(", ")}`}
                  </div>
                </div>
              ))}
            </div>
          </>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, padding: 8 }}>Hit Refresh Now to analyse playlists and find connected artists. Connectivity % shows how often each artist appears alongside Madonna in curated playlists.</div>
          )}
        </Panel>

        {/* Trend history panel */}
        {data.history && data.history.length > 1 && (
          <Panel title="Popularity History" color={GREEN} span={3}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70, padding: "4px 0" }}>
              {data.history.slice().reverse().map((snap, i) => {
                const h = Math.max(6, (snap.popularity / 100) * 60);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 10, color: WHITE, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{snap.popularity}</span>
                    <div style={{
                      width: "100%", maxWidth: 50, height: h, borderRadius: "4px 4px 0 0",
                      background: `linear-gradient(180deg, ${GREEN}, ${GREEN}66)`,
                    }} />
                    <span style={{ fontSize: 7, color: MUTED }}>{new Date(snap.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
          Data from Spotify Web API \u00B7 Cache: {data.cacheTTL}s \u00B7 {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString("en-GB") : ""}
        </span>
        <span style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
          {data.topTracks?.length || 0} tracks \u00B7 {data.albums?.length || 0} releases \u00B7 {data.playlists?.length || 0} playlists
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
