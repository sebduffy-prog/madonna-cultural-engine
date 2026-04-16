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
      const d = await res.json();
      setData(d);
      if (res.ok && d.artist) {
        setLastRefresh(new Date());
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

        {/* Era Breakdown — which decade dominates streaming */}
        {data.insights?.eraBreakdown?.length > 0 && (
          <Panel title="Era Breakdown — What's Streaming" color={TEAL} span={3}>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 8, fontStyle: "italic" }}>
              Which era of Madonna's catalogue dominates current streaming
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.insights.eraBreakdown.length, 5)}, 1fr)`, gap: 8 }}>
              {data.insights.eraBreakdown.map(era => {
                const colors = { "1980s": Y, "1990s": PURPLE, "2000s": TEAL, "2010s": PINK, "2020s": GREEN };
                const c = colors[era.era] || AMBER;
                return (
                  <div key={era.era} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px", borderTop: `3px solid ${c}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'Inter Tight', sans-serif" }}>{era.era}</div>
                    <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{era.tracks} tracks in top 20</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: WHITE, marginTop: 4 }}>Avg pop: {era.avgPopularity}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{era.topTracks.join(", ")}</div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* Competitive Position + Popularity Distribution */}
        <Panel title="Competitive Position" color={AMBER} span={2}>
          {data.insights?.competitivePosition ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>
                  {data.insights.competitivePosition.popularityPercentile}th
                </span>
                <span style={{ fontSize: 11, color: DIM }}>percentile among related artists</span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 10, color: DIM }}>
                <div>
                  <span style={{ color: WHITE, fontWeight: 700 }}>{data.artist.popularity}</span> Madonna
                </div>
                <div>
                  <span style={{ color: MUTED, fontWeight: 700 }}>{data.insights.competitivePosition.relatedAvgPopularity}</span> avg related
                </div>
                <div style={{ color: data.insights.competitivePosition.popularityDelta > 0 ? GREEN : RED }}>
                  {data.insights.competitivePosition.popularityDelta > 0 ? "+" : ""}{data.insights.competitivePosition.popularityDelta} delta
                </div>
              </div>
              {data.insights.popularityDistribution && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Track Popularity Distribution</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
                    <div><span style={{ color: GREEN, fontWeight: 700 }}>{data.insights.popularityDistribution.max}</span> peak</div>
                    <div><span style={{ color: WHITE, fontWeight: 700 }}>{data.insights.popularityDistribution.avg}</span> avg</div>
                    <div><span style={{ color: MUTED, fontWeight: 700 }}>{data.insights.popularityDistribution.min}</span> floor</div>
                    <div><span style={{ color: AMBER, fontWeight: 700 }}>{data.insights.popularityDistribution.top3SharePercent}%</span> top 3 share</div>
                  </div>
                </div>
              )}
            </div>
          ) : <div style={{ fontSize: 11, color: MUTED }}>Refresh to calculate</div>}
        </Panel>

        {/* Genre Positioning */}
        <Panel title="Genre Positioning" color={PURPLE}>
          {data.insights?.genrePositioning ? (
            <div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Madonna's Genres</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {data.insights.genrePositioning.madonnaGenres.map(g => (
                  <span key={g} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${PURPLE}22`, color: PURPLE, fontWeight: 600 }}>{g}</span>
                ))}
              </div>
              {data.insights.genrePositioning.adjacentGenres.length > 0 && (
                <>
                  <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>Adjacent (related artists)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {data.insights.genrePositioning.adjacentGenres.map(g => (
                      <span key={g.genre} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `${TEAL}15`, color: TEAL }}>
                        {g.genre} <span style={{ opacity: 0.6 }}>({g.count})</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : <div style={{ fontSize: 11, color: MUTED }}>Refresh to calculate</div>}
        </Panel>

        {/* Related Artists */}
        {data.relatedArtists?.length > 0 && (
          <Panel title={`Related Artists (${data.relatedArtists.length})`} color={PURPLE} span={3}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
              {data.relatedArtists.slice(0, 15).map((a) => (
                <a key={a.id} href={a.externalUrl} target="_blank" rel="noopener noreferrer" style={{
                  background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px",
                  textDecoration: "none", transition: "border-color 0.15s",
                }} onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE}
                   onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {a.imageSmall && <img src={a.imageSmall} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />}
                    <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{a.name}</span>
                  </div>
                  <div style={{ fontSize: 9, color: DIM }}>
                    Pop: <span style={{ color: PURPLE, fontWeight: 600 }}>{a.popularity}</span>
                    {a.followers > 0 && ` · ${(a.followers / 1000).toFixed(0)}K`}
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        )}

        {/* Catalogue Depth */}
        {data.insights?.catalogueDepth && (
          <Panel title="Catalogue Depth" color={GREEN} span={3}>
            <div style={{ display: "flex", gap: 20, marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{data.insights.catalogueDepth.totalReleases}</span>
                <span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>total releases</span>
              </div>
              {Object.entries(data.insights.catalogueDepth.byType).map(([type, count]) => (
                <div key={type}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{count}</span>
                  <span style={{ fontSize: 9, color: MUTED, marginLeft: 4 }}>{type}s</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: DIM }}>
              {data.insights.catalogueDepth.earliestRelease} — {data.insights.catalogueDepth.latestRelease}
            </div>
          </Panel>
        )}

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
          Data from Spotify Web API \u00B7 {data.apiCalls || "?"} API calls \u00B7 Cache: {Math.round((data.cacheTTL || 0) / 3600)}h \u00B7 {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString("en-GB") : ""}
        </span>
        <span style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
          {data.topTracks?.length || 0} tracks \u00B7 {data.albums?.length || 0} releases \u00B7 {data.relatedArtists?.length || 0} related
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
