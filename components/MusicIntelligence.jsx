import { useEffect, useState } from "react";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", AMBER = "#F59E0B", PINK = "#F472B6", CORAL = "#FB923C";
const FONT = "'Inter Tight', system-ui, sans-serif";

function fmt(n) {
  if (n == null) return "\u2014";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function Kpi({ label, value, sub, color = WHITE, delta }) {
  const deltaColor = delta == null ? null : delta > 0 ? GREEN : delta < 0 ? RED : MUTED;
  const deltaGlyph = delta == null ? "" : delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: FONT, display: "flex", alignItems: "baseline", gap: 6 }}>
        {value}
        {delta != null && (
          <span style={{ fontSize: 11, color: deltaColor, fontWeight: 700 }}>{deltaGlyph} {fmt(Math.abs(delta))}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, right, accent = PURPLE }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: FONT }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontFamily: FONT }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function HorizontalBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ background: BG, borderRadius: 2, height, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
    </div>
  );
}

function Sparkline({ data, color = WHITE, width = 120, height = 32 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Heatmap: songs (rows) x markets (cols), cell colored by chart position
function ChartHeatmap({ songs, markets }) {
  if (!songs.length || !markets.length) return null;
  const cellW = 30, cellH = 24, labelW = 200, headerH = 60;
  const w = labelW + markets.length * cellW + 20;
  const h = headerH + songs.length * cellH + 10;

  function posColor(pos) {
    if (pos == null) return BG;
    if (pos <= 10) return "#34D399";
    if (pos <= 40) return "#2DD4BF";
    if (pos <= 100) return "#A78BFA";
    return "#555";
  }

  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <svg width={w} height={h} style={{ fontFamily: FONT }}>
        {markets.map((m, i) => (
          <g key={m.code}>
            <text x={labelW + i * cellW + cellW / 2} y={headerH - 8} textAnchor="end" transform={`rotate(-45, ${labelW + i * cellW + cellW / 2}, ${headerH - 8})`} fontSize="10" fill={MUTED}>
              {m.code.toUpperCase()}
            </text>
          </g>
        ))}
        {songs.map((s, rowIdx) => {
          const posByMarket = Object.fromEntries(s.markets.map(m => [m.market, m.position]));
          return (
            <g key={s.name}>
              <text x={labelW - 6} y={headerH + rowIdx * cellH + cellH / 2 + 4} textAnchor="end" fontSize="10.5" fill={WHITE}>
                {s.name.length > 32 ? s.name.slice(0, 30) + "\u2026" : s.name}
              </text>
              {markets.map((m, colIdx) => {
                const pos = posByMarket[m.code];
                return (
                  <g key={m.code}>
                    <rect
                      x={labelW + colIdx * cellW + 1}
                      y={headerH + rowIdx * cellH + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      rx={3}
                      fill={posColor(pos)}
                      opacity={pos == null ? 0.15 : 1}
                    >
                      <title>{`${s.name} — ${m.label}: ${pos ? `#${pos}` : "not charting"}`}</title>
                    </rect>
                    {pos != null && (
                      <text x={labelW + colIdx * cellW + cellW / 2} y={headerH + rowIdx * cellH + cellH / 2 + 3} textAnchor="middle" fontSize="9" fill={BG} fontWeight="700">
                        {pos}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: DIM, fontFamily: FONT }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#34D399", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Top 10</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2DD4BF", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 11\u201340</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#A78BFA", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 41\u2013100</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#555", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 101\u2013200</span>
      </div>
    </div>
  );
}

function SimilarArtistsNetwork({ similar }) {
  if (!similar.length) return null;
  const size = 320, cx = size / 2, cy = size / 2;
  const centerRadius = 32;
  const maxR = size / 2 - 16;
  return (
    <svg width={size} height={size} style={{ fontFamily: FONT, display: "block", margin: "0 auto" }}>
      {similar.slice(0, 16).map((s, i) => {
        const angle = (i / Math.min(similar.length, 16)) * Math.PI * 2 - Math.PI / 2;
        const distance = centerRadius + 16 + (1 - s.match) * (maxR - centerRadius - 16);
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance;
        const edgeEndX = cx + Math.cos(angle) * (centerRadius + 2);
        const edgeEndY = cy + Math.sin(angle) * (centerRadius + 2);
        const opacity = 0.25 + s.match * 0.75;
        return (
          <g key={s.name}>
            <line x1={edgeEndX} y1={edgeEndY} x2={x} y2={y} stroke={PURPLE} strokeWidth={s.match * 2 + 0.3} opacity={opacity} />
            <circle cx={x} cy={y} r={4 + s.match * 6} fill={PURPLE} opacity={opacity}>
              <title>{`${s.name} — ${Math.round(s.match * 100)}% match`}</title>
            </circle>
            <text x={x} y={y - (s.match * 6 + 8)} textAnchor="middle" fontSize="10" fill={WHITE}>{s.name}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={centerRadius} fill={Y} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill={BG}>Madonna</text>
    </svg>
  );
}

export default function MusicIntelligence() {
  const [apple, setApple] = useState(null);
  const [lastfm, setLastfm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force) => {
    setRefreshing(true);
    const q = force ? "?refresh=1" : "";
    const [a, l] = await Promise.all([
      fetch(`/api/apple-charts${q}`).then(r => r.json()).catch(() => ({ error: true })),
      fetch(`/api/lastfm${q}`).then(r => r.json()).catch(() => ({ error: true })),
    ]);
    setApple(a);
    setLastfm(l);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(false); }, []);

  if (loading) {
    return <p style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>Loading music data\u2026</p>;
  }

  const listeners = lastfm?.info?.listeners;
  const scrobbles = lastfm?.info?.playcount;
  const globalRank = lastfm?.globalRank;
  const songHits = apple?.totalSongHits;
  const albumHits = apple?.totalAlbumHits;
  const marketsCharting = apple?.marketsCharting;
  const countriesWhereRanked = lastfm?.countryRankings?.length;

  // Sparkline data for Last.fm listeners (reversed so newest on right)
  const listenerSpark = [...(lastfm?.history || [])].reverse().map(h => h.listeners).concat([listeners]).filter(v => v != null);
  const appleHitSpark = [...(apple?.history || [])].reverse().map(h => h.totalSongHits).concat([songHits]).filter(v => v != null);

  const maxCountryListeners = Math.max(1, ...((lastfm?.countryRankings || []).map(c => c.listeners || 0)));
  const maxTrackPlaycount = Math.max(1, ...((lastfm?.topTracks || []).map(t => t.playcount || 0)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: FONT, letterSpacing: "-0.01em" }}>Music intelligence</h2>
          <p style={{ fontSize: 12, color: MUTED, margin: 0, fontFamily: FONT }}>
            Chart performance (Apple Music, 15 markets) and listener base (Last.fm, 20 countries)
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{
          padding: "6px 16px", fontSize: 10, fontWeight: 700, color: refreshing ? MUTED : BG,
          background: refreshing ? BORDER : PURPLE, border: "none", borderRadius: 6, cursor: refreshing ? "default" : "pointer",
          fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>{refreshing ? "Refreshing\u2026" : "Refresh"}</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
        <Kpi label="Monthly listeners" value={fmt(listeners)} sub="Last.fm" color={TEAL} delta={lastfm?.momentum?.listenersChange} />
        <Kpi label="All-time scrobbles" value={fmt(scrobbles)} sub="Last.fm" color={PURPLE} delta={lastfm?.momentum?.playcountChange} />
        <Kpi label="Global artist rank" value={globalRank ? `#${globalRank}` : "—"} sub={globalRank ? `of ${lastfm?.globalOutOf || "500"}` : "not in top chart"} color={AMBER} />
        <Kpi label="Countries ranked" value={countriesWhereRanked || 0} sub={`of ${lastfm?.countryRankingsAll?.length || 20} checked`} color={CORAL} />
        <Kpi label="Song chart hits" value={songHits || 0} sub={`${marketsCharting || 0} markets`} color={GREEN} delta={apple?.momentum?.totalSongHitsChange} />
        <Kpi label="Album chart hits" value={albumHits || 0} sub={`${apple?.albumAggregate?.length || 0} albums`} color={PINK} delta={apple?.momentum?.totalAlbumHitsChange} />
      </div>

      {/* Trends */}
      {(listenerSpark.length > 2 || appleHitSpark.length > 2) && (
        <Panel title="Trend" subtitle="Daily snapshots since first refresh" accent={PURPLE}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {listenerSpark.length > 2 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: TEAL, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.05em" }}>Last.fm listeners</span>
                  <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT }}>{fmt(listeners)}</span>
                </div>
                <Sparkline data={listenerSpark} color={TEAL} width={380} height={60} />
              </div>
            )}
            {appleHitSpark.length > 2 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: GREEN, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.05em" }}>Apple song chart hits</span>
                  <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT }}>{songHits}</span>
                </div>
                <Sparkline data={appleHitSpark} color={GREEN} width={380} height={60} />
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Apple Music: chart heatmap */}
      {apple && !apple.error && apple.songAggregate?.length > 0 && (
        <Panel title="Apple Music \u2014 song chart heatmap" subtitle={`Madonna tracks in top-200 across ${apple.markets?.length || 15} markets`} accent={GREEN}>
          <ChartHeatmap songs={apple.songAggregate.slice(0, 20)} markets={apple.markets} />
        </Panel>
      )}

      {/* Apple: best positions */}
      {apple?.bestPositions?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Panel title="Best chart positions" subtitle="Sorted by position across every chart and market" accent={GREEN}>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {apple.bestPositions.slice(0, 12).map((p, i) => (
                <a key={`${p.market}-${p.name}-${i}`} href={p.url} target="_blank" rel="noreferrer noopener" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: `1px solid ${BORDER}`,
                  textDecoration: "none", color: WHITE,
                }}>
                  {p.artwork && <img src={p.artwork} alt="" width={40} height={40} style={{ borderRadius: 4 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{p.marketFlag} {p.marketLabel} \u00b7 {p.chart}</div>
                  </div>
                  <div style={{
                    background: p.position <= 10 ? GREEN : p.position <= 40 ? TEAL : p.position <= 100 ? PURPLE : "#555",
                    color: BG, padding: "4px 10px", borderRadius: 6, fontFamily: FONT, fontSize: 12, fontWeight: 800,
                  }}>#{p.position}</div>
                </a>
              ))}
            </div>
          </Panel>

          <Panel title="Album chart presence" subtitle={`${apple.totalAlbumHits || 0} album appearances across markets`} accent={PINK}>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {(apple.albumAggregate || []).slice(0, 10).map((a, i) => (
                <a key={`${a.name}-${i}`} href={a.url} target="_blank" rel="noreferrer noopener" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: `1px solid ${BORDER}`,
                  textDecoration: "none", color: WHITE,
                }}>
                  {a.artwork && <img src={a.artwork} alt="" width={40} height={40} style={{ borderRadius: 4 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{a.marketCount} markets \u00b7 best #{a.bestPosition}</div>
                  </div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 120 }}>
                    {a.markets.slice(0, 8).map(m => (
                      <span key={m.market} title={`${m.marketLabel} #${m.position}`} style={{ fontSize: 10, fontFamily: FONT }}>{m.marketFlag}</span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Country rankings (Last.fm) */}
      {lastfm?.countryRankings?.length > 0 && (
        <Panel title="Listener geography" subtitle="Madonna's rank among all artists on Last.fm, per country" accent={TEAL}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {(lastfm.countryRankings || []).slice(0, 20).map((c, i) => (
              <div key={c.country} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, minWidth: 26 }}>{c.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT }}>{c.label}</span>
                    <span style={{ fontSize: 11, color: TEAL, fontFamily: FONT, fontWeight: 700 }}>#{c.rank}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <HorizontalBar value={c.listeners || 0} max={maxCountryListeners} color={TEAL} />
                    <span style={{ fontSize: 9, color: DIM, fontFamily: FONT, minWidth: 40, textAlign: "right" }}>{fmt(c.listeners)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {lastfm.countryRankingsAll?.some(c => !c.rank) && (
            <p style={{ fontSize: 10, color: DIM, marginTop: 12, fontFamily: FONT }}>
              Not ranked in top 500 in: {lastfm.countryRankingsAll.filter(c => !c.rank).map(c => `${c.flag} ${c.label}`).join(" \u00b7 ")}
            </p>
          )}
        </Panel>
      )}

      {/* Top tracks + tags */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <Panel title="Top tracks on Last.fm" subtitle="By all-time playcount" accent={PURPLE}>
          {(lastfm?.topTracks || []).slice(0, 10).map((t, i) => (
            <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: i < 9 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 11, color: MUTED, minWidth: 20, fontFamily: FONT }}>#{i + 1}</span>
              {t.albumImage && <img src={t.albumImage} alt="" width={32} height={32} style={{ borderRadius: 4 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: WHITE, fontFamily: FONT, fontWeight: 600 }}>{t.name}</div>
                {t.album && <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>{t.album}</div>}
              </div>
              <div style={{ minWidth: 100, display: "flex", alignItems: "center", gap: 6 }}>
                <HorizontalBar value={t.playcount || 0} max={maxTrackPlaycount} color={PURPLE} />
                <span style={{ fontSize: 10, color: DIM, fontFamily: FONT, minWidth: 44, textAlign: "right" }}>{fmt(t.playcount)}</span>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Fan tags" subtitle="Most-applied Last.fm tags" accent={AMBER}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(lastfm?.topTags || []).slice(0, 24).map(t => {
              const maxCount = Math.max(1, ...(lastfm.topTags || []).map(x => x.count || 0));
              const scale = Math.max(0.6, Math.min(1.3, (t.count || 0) / maxCount + 0.4));
              return (
                <span key={t.name} style={{
                  fontSize: `${11 * scale}px`, padding: "4px 9px", borderRadius: 20,
                  background: `${AMBER}22`, color: AMBER, fontFamily: FONT, fontWeight: 600,
                }}>{t.name}</span>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Similar artists network */}
      {(lastfm?.similarArtists || []).length > 0 && (
        <Panel title="Artists fans also play" subtitle="Similarity network \u2014 larger = stronger co-listening overlap" accent={PURPLE}>
          <SimilarArtistsNetwork similar={lastfm.similarArtists} />
        </Panel>
      )}

      {/* Top albums */}
      {(lastfm?.topAlbums || []).length > 0 && (
        <Panel title="Top albums on Last.fm" subtitle="By playcount" accent={CORAL}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {(lastfm.topAlbums || []).slice(0, 10).map((a, i) => (
              <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none", color: WHITE }}>
                {a.image && <img src={a.image} alt="" style={{ width: "100%", aspectRatio: "1/1", borderRadius: 6, display: "block" }} />}
                <div style={{ fontSize: 11, color: WHITE, marginTop: 6, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 10, color: DIM, fontFamily: FONT }}>{fmt(a.playcount)} plays</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {/* New releases */}
      {apple?.newReleases?.length > 0 && (
        <Panel title="New releases featuring Madonna" subtitle={`${apple.newReleases.length} appearances in market new-release feeds`} accent={Y}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {apple.newReleases.slice(0, 8).map((r, i) => (
              <a key={`${r.market}-${r.name}-${i}`} href={r.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none", color: WHITE }}>
                {r.artwork && <img src={r.artwork} alt="" style={{ width: "100%", aspectRatio: "1/1", borderRadius: 6, display: "block" }} />}
                <div style={{ fontSize: 11, color: WHITE, marginTop: 6, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>{r.marketFlag} {r.marketLabel} \u00b7 #{r.position}</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {/* Not configured state */}
      {lastfm?.configured === false && (
        <Panel title="Last.fm not configured" subtitle="Add LASTFM_API_KEY to Vercel env vars" accent={RED}>
          <p style={{ fontSize: 11, color: DIM, margin: 0 }}>{lastfm.error}</p>
        </Panel>
      )}
    </div>
  );
}
