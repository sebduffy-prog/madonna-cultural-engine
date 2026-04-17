import { useEffect, useState } from "react";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", AMBER = "#F59E0B";
const FONT = "'Inter Tight', system-ui, sans-serif";

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}

function Panel({ title, source, children, right }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: FONT }}>{title}</div>
          <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT, marginTop: 2 }}>{source}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function DeltaBadge({ pct }) {
  if (pct == null) return null;
  const color = pct > 0 ? GREEN : pct < 0 ? RED : MUTED;
  const glyph = pct > 0 ? "\u2191" : pct < 0 ? "\u2193" : "\u2192";
  return (
    <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: FONT }}>
      {glyph} {Math.abs(pct)}%
    </span>
  );
}

function Sparkline({ data, color = WHITE, height = 28 }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const w = 120;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function ExternalSignals() {
  const [gdelt, setGdelt] = useState(null);
  const [apple, setApple] = useState(null);
  const [wiki, setWiki] = useState(null);
  const [lastfm, setLastfm] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOne = (url, setter) => fetch(url).then(r => r.json()).then(setter).catch(() => setter({ error: true }));
    Promise.all([
      fetchOne("/api/gdelt", setGdelt),
      fetchOne("/api/apple-charts", setApple),
      fetchOne("/api/wikipedia-pageviews", setWiki),
      fetchOne("/api/lastfm", setLastfm),
      fetchOne("/api/google-trends", setTrends),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: FONT }}>External signals</h2>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 20px", fontFamily: FONT }}>
        Attention, listening and chart signals from sources outside our Brand24 / social pipeline.
      </p>

      {loading && <p style={{ fontSize: 12, color: MUTED }}>Loading\u2026</p>}

      {/* Wikipedia Pageviews */}
      {wiki && !wiki.error && (
        <Panel title="Wikipedia pageviews" source={`Wikimedia REST API \u00b7 last ${wiki.period?.days || 60} days`}
          right={wiki.topMover ? <DeltaBadge pct={wiki.topMover.weekChangePercent} /> : null}>
          {wiki.topMover && (
            <p style={{ fontSize: 11, color: DIM, margin: "0 0 10px" }}>
              Top mover this week: <b style={{ color: WHITE }}>{wiki.topMover.label}</b>
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {(wiki.articles || []).slice(0, 6).map(a => (
              <div key={a.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: WHITE, fontWeight: 600, fontFamily: FONT }}>{a.label}</span>
                  <DeltaBadge pct={a.weekChangePercent} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: TEAL, fontFamily: FONT }}>{fmt(a.last7days)}</div>
                    <div style={{ fontSize: 8, color: MUTED }}>views · last 7d</div>
                  </div>
                  <Sparkline data={a.daily.slice(-30).map(d => d.views)} color={TEAL} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Google Trends */}
      {trends && trends.configured !== false && !trends.error && (
        <Panel title="Google Trends" source={`google-trends-api \u00b7 ${trends.window || "90d"} \u00b7 ${trends.geo || "worldwide"}`}
          right={trends.topMover ? <DeltaBadge pct={trends.topMover.weekChangePercent} /> : null}>
          <p style={{ fontSize: 10, color: DIM, margin: "0 0 10px", lineHeight: 1.5 }}>
            Values are 0\u2013100 relative to each keyword\u2019s own peak in the window \u2014 use shape and timing, not absolute comparison between keywords.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {(trends.keywords || []).map(k => (
              <div key={k.keyword} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: WHITE, fontWeight: 600, fontFamily: FONT }}>{k.keyword}</span>
                  <DeltaBadge pct={k.weekChangePercent} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: AMBER, fontFamily: FONT }}>{k.recent7Avg}</div>
                    <div style={{ fontSize: 8, color: MUTED }}>7d avg · peak {k.peakInterest}</div>
                  </div>
                  <Sparkline data={k.timeline.slice(-30).map(p => p.value)} color={AMBER} />
                </div>
                {k.error && <div style={{ fontSize: 8, color: RED, marginTop: 4 }}>{k.error}</div>}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {trends && trends.configured === false && (
        <Panel title="Google Trends" source="Not yet configured">
          <p style={{ fontSize: 11, color: DIM, margin: 0 }}>{trends.error}</p>
        </Panel>
      )}

      {/* GDELT */}
      {gdelt && !gdelt.error && (
        <Panel title="Global news (GDELT)" source={`GDELT Doc 2.0 \u00b7 ${gdelt.period?.timespan || "7d"} \u00b7 ${gdelt.totalArticles || 0} articles`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT, letterSpacing: "0.05em" }}>Top outlets</div>
              {(gdelt.topDomains || []).slice(0, 8).map(d => (
                <div key={d.domain} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: DIM }}>
                  <span>{d.domain}</span>
                  <b style={{ color: WHITE, fontFamily: FONT }}>{d.count}</b>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT, letterSpacing: "0.05em" }}>Top countries</div>
              {(gdelt.topCountries || []).slice(0, 8).map(c => (
                <div key={c.country} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: DIM }}>
                  <span>{c.country}</span>
                  <b style={{ color: WHITE, fontFamily: FONT }}>{c.count}</b>
                </div>
              ))}
            </div>
          </div>
          {gdelt.avgTone != null && (
            <p style={{ fontSize: 10, color: DIM, margin: "10px 0 0" }}>
              Avg article tone: <b style={{ color: gdelt.avgTone > 0 ? GREEN : gdelt.avgTone < 0 ? RED : WHITE }}>{gdelt.avgTone}</b> (GDELT tone: \u221210 strongly negative to +10 strongly positive)
            </p>
          )}
        </Panel>
      )}

      {/* Apple Music */}
      {apple && !apple.error && (
        <Panel title="Apple Music charts" source={`${apple.marketsChecked} markets \u00b7 ${apple.totalHits} chart appearances`}>
          {apple.bestPositions?.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT, letterSpacing: "0.05em" }}>Best chart positions</div>
              {apple.bestPositions.slice(0, 8).map((p, i) => (
                <div key={`${p.market}-${p.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0", color: DIM, borderBottom: `1px solid ${BORDER}` }}>
                  <span><b style={{ color: WHITE, fontFamily: FONT }}>#{p.position}</b> <span style={{ color: WHITE }}>{p.name}</span></span>
                  <span style={{ fontSize: 10, color: MUTED }}>{p.market} \u00b7 {p.chart}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: DIM, margin: 0 }}>No Madonna tracks in top 200 Apple Music charts across monitored markets right now.</p>
          )}
        </Panel>
      )}

      {/* Last.fm */}
      {lastfm && lastfm.configured && !lastfm.error && (
        <Panel title="Last.fm listener data" source="scrobble network">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.05em" }}>Listeners</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEAL, fontFamily: FONT }}>{fmt(lastfm.info?.listeners)}</div>
            </div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.05em" }}>Scrobbles</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: PURPLE, fontFamily: FONT }}>{fmt(lastfm.info?.playcount)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 4, fontFamily: FONT, letterSpacing: "0.05em" }}>Fan tags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(lastfm.topTags || []).slice(0, 10).map(t => (
                  <span key={t.name} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${PURPLE}22`, color: PURPLE, fontFamily: FONT }}>{t.name}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT, letterSpacing: "0.05em" }}>Top tracks</div>
              {(lastfm.topTracks || []).slice(0, 6).map(t => (
                <div key={t.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: DIM }}>
                  <span style={{ color: WHITE }}>{t.name}</span>
                  <span style={{ fontFamily: FONT }}>{fmt(t.playcount)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT, letterSpacing: "0.05em" }}>Artists fans also play</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(lastfm.similarArtists || []).slice(0, 10).map(a => (
                  <span key={a.name} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: BG, border: `1px solid ${BORDER}`, color: WHITE, fontFamily: FONT }}>{a.name}</span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}
      {lastfm && lastfm.configured === false && (
        <Panel title="Last.fm listener data" source="Not yet configured">
          <p style={{ fontSize: 11, color: DIM, margin: 0 }}>{lastfm.error}</p>
        </Panel>
      )}
    </div>
  );
}
