import { useEffect, useMemo, useRef, useState } from "react";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", AMBER = "#F59E0B", PINK = "#F472B6", CORAL = "#FB923C";
const FONT = "'Inter Tight', system-ui, sans-serif";

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function Kpi({ label, value, sub, color = WHITE, delta }) {
  const deltaColor = delta == null ? null : delta > 0 ? GREEN : delta < 0 ? RED : MUTED;
  const deltaGlyph = delta == null ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
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
                {s.name.length > 32 ? s.name.slice(0, 30) + "…" : s.name}
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
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2DD4BF", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 11–40</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#A78BFA", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 41–100</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#555", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 101–200</span>
      </div>
    </div>
  );
}

function SimilarArtistsNetwork({ similar }) {
  const size = 560;
  const cx = size / 2, cy = size / 2;
  const centerRadius = 44;

  const artists = useMemo(() => (similar || []).slice(0, 16), [similar]);

  // Rest positions — radial, closer to the centre when match is higher
  const initial = useMemo(() => {
    const maxR = size / 2 - 48;
    return artists.map((a, i) => {
      const angle = (i / Math.max(artists.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const rest = centerRadius + 60 + (1 - a.match) * (maxR - centerRadius - 60);
      return {
        id: a.name,
        name: a.name,
        match: a.match,
        url: a.url,
        rx: cx + Math.cos(angle) * rest,
        ry: cy + Math.sin(angle) * rest,
      };
    });
  }, [artists, cx, cy]);

  const [nodes, setNodes] = useState(() => initial.map(n => ({ ...n, x: n.rx, y: n.ry, vx: 0, vy: 0 })));
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    setNodes(initial.map(n => ({ ...n, x: n.rx, y: n.ry, vx: 0, vy: 0 })));
  }, [initial]);

  useEffect(() => {
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      setNodes(curr => {
        const next = curr.map(n => ({ ...n }));
        for (let i = 0; i < next.length; i++) {
          const n = next[i];
          if (dragRef.current && dragRef.current.id === n.id) {
            n.x = dragRef.current.x;
            n.y = dragRef.current.y;
            n.vx = 0; n.vy = 0;
            continue;
          }
          // Spring toward rest position
          const dxr = n.rx - n.x, dyr = n.ry - n.y;
          n.vx += dxr * 4.5 * dt;
          n.vy += dyr * 4.5 * dt;
          // Repulsion away from Madonna hub (don't overlap the centre)
          const toX = n.x - cx, toY = n.y - cy;
          const distC = Math.sqrt(toX * toX + toY * toY) || 0.001;
          const clearance = centerRadius + 22;
          if (distC < clearance) {
            const push = (clearance - distC) * 20 * dt;
            n.vx += (toX / distC) * push;
            n.vy += (toY / distC) * push;
          }
          // Repulsion between nodes
          for (let j = 0; j < next.length; j++) {
            if (i === j) continue;
            const m = next[j];
            const dxx = n.x - m.x, dyy = n.y - m.y;
            const d2 = dxx * dxx + dyy * dyy;
            const minD = 54;
            if (d2 > 0.1 && d2 < minD * minD) {
              const d = Math.sqrt(d2);
              const push = (minD - d) * 10 * dt;
              n.vx += (dxx / d) * push;
              n.vy += (dyy / d) * push;
            }
          }
          // Damping + integrate
          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x += n.vx * dt * 60;
          n.y += n.vy * dt * 60;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cx, cy, centerRadius]);

  function toSvgCoords(e) {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * size,
      y: ((e.clientY - r.top) / r.height) * size,
    };
  }
  function onPointerDown(e, node) {
    e.preventDefault();
    const { x, y } = toSvgCoords(e);
    dragRef.current = { id: node.id, x, y };
    setDraggingId(node.id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const { x, y } = toSvgCoords(e);
    dragRef.current = { ...dragRef.current, x, y };
  }
  function onPointerUp() {
    dragRef.current = null;
    setDraggingId(null);
  }

  if (!artists.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640, margin: "0 auto" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, userSelect: "none", touchAction: "none", cursor: draggingId ? "grabbing" : "default" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Links to Madonna */}
        {nodes.map(n => {
          const op = 0.25 + (n.match || 0) * 0.75;
          return (
            <line key={`L-${n.id}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke={PURPLE} strokeWidth={(n.match || 0) * 2 + 0.3} opacity={op} />
          );
        })}
        {/* Madonna hub */}
        <circle cx={cx} cy={cy} r={centerRadius} fill={Y} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={BG}>Madonna</text>
        {/* Artist nodes */}
        {nodes.map(n => {
          const op = 0.4 + (n.match || 0) * 0.6;
          const r = 6 + (n.match || 0) * 10;
          const active = draggingId === n.id;
          return (
            <g key={n.id} style={{ cursor: active ? "grabbing" : "grab" }} onPointerDown={(e) => onPointerDown(e, n)}>
              <circle cx={n.x} cy={n.y} r={r + 14} fill="transparent" pointerEvents="all" />
              <circle cx={n.x} cy={n.y} r={r} fill={PURPLE} opacity={active ? 1 : op}
                stroke={active ? WHITE : "none"} strokeWidth={active ? 2 : 0}>
                <title>{`${n.name} — ${Math.round((n.match || 0) * 100)}% match`}</title>
              </circle>
              <text x={n.x} y={n.y - (r + 8)} textAnchor="middle" fontSize="11" fill={WHITE} style={{ pointerEvents: "none" }}>{n.name}</text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 10, color: MUTED, textAlign: "center", margin: "8px 0 0", fontFamily: FONT }}>
        Drag any artist to reposition — release to let it spring back
      </p>
    </div>
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
    return <p style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>Loading music data…</p>;
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
        }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>

      {lastfm?.configured === false && (
        <div style={{ background: `${RED}11`, border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: DIM, fontFamily: FONT }}>
          <b style={{ color: RED }}>Last.fm not configured.</b> Add <code style={{ color: WHITE, background: BG, padding: "1px 5px", borderRadius: 3 }}>LASTFM_API_KEY</code> to Vercel env vars and redeploy. Listener geography, top tracks, fan tags, and similar-artists panels will populate once the key is live.
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
        <Kpi label="Monthly listeners" value={listeners != null ? fmt(listeners) : "—"} sub="Last.fm" color={TEAL} delta={lastfm?.momentum?.listenersChange} />
        <Kpi label="All-time scrobbles" value={scrobbles != null ? fmt(scrobbles) : "—"} sub="Last.fm" color={PURPLE} delta={lastfm?.momentum?.playcountChange} />
        <Kpi label="Global artist rank" value={globalRank ? `#${globalRank}` : "—"} sub={globalRank ? `of ${lastfm?.globalOutOf || "500"}` : lastfm?.configured === false ? "not configured" : "not in top chart"} color={AMBER} />
        <Kpi label="Countries ranked" value={countriesWhereRanked != null ? countriesWhereRanked : "—"} sub={lastfm?.countryRankingsAll?.length ? `of ${lastfm.countryRankingsAll.length} checked` : ""} color={CORAL} />
        <Kpi label="Song chart hits" value={songHits != null ? songHits : "—"} sub={marketsCharting != null ? `${marketsCharting} markets` : ""} color={GREEN} delta={apple?.momentum?.totalSongHitsChange} />
        <Kpi label="Album chart hits" value={albumHits != null ? albumHits : "—"} sub={apple?.albumAggregate?.length != null ? `${apple.albumAggregate.length} albums` : ""} color={PINK} delta={apple?.momentum?.totalAlbumHitsChange} />
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
        <Panel title="Apple Music — song chart heatmap" subtitle={`Madonna tracks in top-200 across ${apple.markets?.length || 15} markets`} accent={GREEN}>
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
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{p.marketFlag} {p.marketLabel} · {p.chart}</div>
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
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{a.marketCount} markets · best #{a.bestPosition}</div>
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
              Not ranked in top 500 in: {lastfm.countryRankingsAll.filter(c => !c.rank).map(c => `${c.flag} ${c.label}`).join(" · ")}
            </p>
          )}
        </Panel>
      )}

      {/* Top tracks + tags */}
      {(lastfm?.topTracks?.length > 0 || lastfm?.topTags?.length > 0) && (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        {lastfm?.topTracks?.length > 0 && (
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
        )}

        {lastfm?.topTags?.length > 0 && (
        <Panel title="Fan tags" subtitle="Most-applied Last.fm tags" accent={AMBER}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(lastfm?.topTags || []).slice(0, 24).map(t => {
              const maxCount = Math.max(1, ...(lastfm.topTags || []).map(x => x.count || 0));
              const scale = Math.max(0.8, Math.min(1.25, (t.count || 0) / maxCount + 0.5));
              return (
                <span key={t.name} style={{
                  fontSize: `${12 * scale}px`, padding: "5px 11px", borderRadius: 20,
                  background: `${AMBER}1a`, border: `1px solid ${AMBER}55`,
                  color: WHITE, fontFamily: FONT, fontWeight: 600,
                }}>{t.name}</span>
              );
            })}
          </div>
        </Panel>
        )}
      </div>
      )}

      {/* Similar artists network */}
      {(lastfm?.similarArtists || []).length > 0 && (
        <Panel title="Artists fans also play" subtitle="Similarity network — larger = stronger co-listening overlap" accent={PURPLE}>
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
                <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>{r.marketFlag} {r.marketLabel} · #{r.position}</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

    </div>
  );
}
