import { useState, useEffect } from "react";
import LineChart from "./LineChart";

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

function decodeEntities(str) {
  if (!str) return "";
  return str.replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D").replace(/&#8216;/g, "\u2018").replace(/&#8217;/g, "\u2019").replace(/&#8211;/g, "\u2013").replace(/&#8212;/g, "\u2014").replace(/&#8230;/g, "\u2026").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, (m) => { const c = parseInt(m.replace(/&#|;/g, ""), 10); return isNaN(c) ? m : String.fromCharCode(c); });
}

function Panel({ title, color = Y, children, action }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 2, height: 12, background: color, borderRadius: 1 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter Tight', sans-serif" }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function DashboardSummary() {
  const [media, setMedia] = useState(null);
  const [social, setSocial] = useState(null);
  const [spotify, setSpotify] = useState(null);
  const [ai, setAi] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Load fast sources first — don't wait for Spotify
      let [m, s, a, mi] = await Promise.all([
        fetch("/api/news?category=madonna").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/social").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/ai-strategy").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/media-index").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      // Auto-refresh empty results (without blocking)
      const refreshes = [];
      if (!m?.items?.length) refreshes.push(fetch("/api/news?category=madonna&refresh=1").then(r => r.ok ? r.json() : null).then(d => { m = d || m; setMedia(m); }).catch(() => {}));
      if (!s?.platforms?.length || s.totalSources === 0) refreshes.push(fetch("/api/social?refresh=1").then(r => r.ok ? r.json() : null).then(d => { s = d || s; setSocial(s); }).catch(() => {}));

      setMedia(m); setSocial(s); setAi(a); setMediaIndex(mi);
      setLoading(false); // Show dashboard immediately

      // Finish any refreshes in background
      if (refreshes.length > 0) Promise.all(refreshes).catch(() => {});

      // Load Spotify separately — slow and can fail
      fetch("/api/spotify").then(r => r.ok ? r.json() : null).then(sp => {
        if (sp) setSpotify(sp);
        // If empty, try one refresh
        if (!sp?.topTracks?.length) {
          fetch("/api/spotify?refresh=1").then(r => r.ok ? r.json() : null).then(sp2 => {
            if (sp2) setSpotify(sp2);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Loading dashboard...</div>;
  }

  const madonnaArticles = media?.items || [];
  const trendIndex = mediaIndex?.index ?? social?.index ?? 0;
  const isBaseline = mediaIndex?.isFirstRun || social?.isFirstRun;
  const sentiment = social?.sentiment;
  const spotifyTracks = spotify?.topTracks?.length || 0;
  const aiRecs = ai?.recommendations?.madonna || [];
  const trendTotal = mediaIndex?.totalToday || 0;
  const trendBaseline = mediaIndex?.baseline || 59;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          Dashboard
        </h2>
        <span style={{ fontSize: 11, color: MUTED }}>Summary of current activity</span>
      </div>

      {/* Top metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Madonna in media</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: Y, fontFamily: "'Inter Tight', sans-serif" }}>{madonnaArticles.length}</div>
          <div style={{ fontSize: 9, color: DIM }}>articles mentioning Madonna</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Trend Index</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: isBaseline ? MUTED : trendIndex > 0 ? GREEN : trendIndex < 0 ? RED : WHITE, fontFamily: "'Inter Tight', sans-serif" }}>
            {isBaseline ? "BASELINE" : `${trendIndex > 0 ? "+" : ""}${trendIndex}%`}
          </div>
          <div style={{ fontSize: 9, color: DIM }}>{isBaseline ? "tracking starts tomorrow" : `${trendTotal} mentions vs ${trendBaseline} baseline`}</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Spotify</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{spotifyTracks || "---"}</div>
          <div style={{ fontSize: 9, color: DIM }}>{spotify?.artist ? `${spotify.artist.popularity}/100 popularity` : "connecting..."}</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Sentiment</div>
          {sentiment ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: sentiment.positive >= sentiment.negative ? GREEN : RED, fontFamily: "'Inter Tight', sans-serif" }}>
                {sentiment.positive}%
              </div>
              <div style={{ fontSize: 9, color: DIM }}>positive social sentiment</div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: MUTED }}>No data</div>
          )}
        </div>
      </div>

      {/* Trend index chart */}
      {social?.history && social.history.length > 1 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Trend Index Over Time
          </div>
          <LineChart
            height={130}
            showLegend={false}
            series={[{
              label: "Index",
              color: PURPLE,
              data: social.history.slice().reverse().map(s => ({ date: s.date, value: s.index || 0 })),
            }]}
          />
        </div>
      )}

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Latest Madonna coverage */}
        <Panel title="Latest Madonna coverage" color={Y}>
          {madonnaArticles.length === 0 ? (
            <p style={{ fontSize: 12, color: MUTED }}>No recent coverage found. Run a search in the Media tab.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {madonnaArticles.slice(0, 8).map((item, i) => (
                <a key={item.url || i} href={item.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0",
                  borderBottom: `1px solid ${BORDER}22`, textDecoration: "none",
                }}>
                  <span style={{ fontSize: 12, color: WHITE, lineHeight: 1.3 }}>{decodeEntities(item.title).slice(0, 80)}</span>
                  <span style={{ fontSize: 9, color: MUTED, whiteSpace: "nowrap", flexShrink: 0 }}>{item.source}</span>
                </a>
              ))}
            </div>
          )}
        </Panel>

        {/* Social snapshot */}
        <Panel title="Social trend snapshot" color={PURPLE}>
          {!social?.signals ? (
            <p style={{ fontSize: 12, color: MUTED }}>No social data yet. Run a scan in the Social Listening tab.</p>
          ) : (
            <>
              {sentiment && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ width: `${sentiment.positive}%`, background: GREEN }} />
                    <div style={{ width: `${sentiment.neutral}%`, background: MUTED }} />
                    <div style={{ width: `${sentiment.negative}%`, background: RED }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "'Inter Tight', sans-serif" }}>
                    <span style={{ color: GREEN }}>{sentiment.positive}% positive</span>
                    <span style={{ color: MUTED }}>{sentiment.neutral}% neutral</span>
                    <span style={{ color: RED }}>{sentiment.negative}% negative</span>
                  </div>
                </div>
              )}
              <div>
                {Object.entries(social.signals || {}).map(([key, sig]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ fontSize: 9, color: DIM, flex: 1, fontFamily: "'Inter Tight', sans-serif" }}>{sig.label}</span>
                    <span style={{ fontSize: 11, color: WHITE, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{typeof sig.value === "number" ? sig.value.toLocaleString() : sig.value}</span>
                    {sig.delta != null && sig.delta !== 0 && (
                      <span style={{ fontSize: 9, color: sig.delta > 0 ? GREEN : RED, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>
                        {sig.delta > 0 ? "+" : ""}{sig.delta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 9, color: MUTED }}>
                {(social.platforms || []).length} sources active
              </div>
            </>
          )}
        </Panel>

        {/* Streaming snapshot */}
        <Panel title="Streaming snapshot" color={GREEN}>
          {!spotify?.artist ? (
            <p style={{ fontSize: 12, color: MUTED }}>Spotify not connected or no data yet. Check the Streaming tab.</p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {spotify.artist.image && <img src={spotify.artist.imageSmall || spotify.artist.image} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{spotify.artist.name}</div>
                  <div style={{ fontSize: 10, color: DIM }}>{spotify.topTracks?.length || 0} tracks \u00B7 {spotify.albums?.length || 0} albums</div>
                </div>
              </div>
              {spotify.topTracks?.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Top tracks right now</div>
                  {spotify.topTracks.slice(0, 5).map((t, i) => (
                    <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
                      <span style={{ fontSize: 10, color: MUTED, width: 14, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
                      <span style={{ fontSize: 11, color: WHITE, flex: 1 }}>{t.name}</span>
                      <span style={{ fontSize: 10, color: GREEN, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{t.popularity}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>

        {/* Social pulse */}
        <Panel title="Social pulse" color={AMBER}>
          {social?.signals?.brand24Mentions ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>{social.signals.brand24Mentions.value?.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: DIM }}>mentions (7 days)</div>
                </div>
                {social.signals.brand24Mentions.reach > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEAL }}>{(social.signals.brand24Mentions.reach / 1000).toFixed(0)}K</div>
                    <div style={{ fontSize: 9, color: DIM }}>reach</div>
                  </div>
                )}
              </div>
              {social.signals.brand24Sentiment && (
                <div style={{ fontSize: 10, color: social.signals.brand24Sentiment.value > 20 ? GREEN : DIM }}>
                  Sentiment: {social.signals.brand24Sentiment.value}% positive
                </div>
              )}
              <div style={{ fontSize: 9, color: MUTED, marginTop: 6 }}>
                Platforms: {(social.platforms || []).filter(p => !["reddit", "youtube", "brave_discussions"].includes(p)).join(", ") || "loading..."}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Social data loading. Check Social Listening tab for full analytics.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* Full strategy recommendations */}
      {ai?.recommendations && (
        <div style={{ marginTop: 16 }}>
          <Panel title="AI Strategy Recommendations" color={AMBER}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {["madonna", "fashion", "gay", "culture"].map(cat => {
                const recs = ai.recommendations[cat] || [];
                if (recs.length === 0) return null;
                const catLabels = { madonna: "Madonna", fashion: "Fashion", gay: "Gay Community", culture: "Culture" };
                const catColors = { madonna: Y, fashion: PINK, gay: PURPLE, culture: TEAL };
                return (
                  <div key={cat}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: catColors[cat], textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>{catLabels[cat]}</div>
                    {recs.slice(0, 3).map((rec, i) => (
                      <div key={i} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: i < recs.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: BG, background: rec.type === "Media" ? PINK : rec.type === "Partnership" ? TEAL : AMBER, padding: "1px 5px", borderRadius: 3, fontFamily: "'Inter Tight', sans-serif" }}>{rec.type}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{rec.title}</span>
                        </div>
                        <p style={{ fontSize: 11, color: DIM, margin: 0, lineHeight: 1.4 }}>{rec.description}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {ai.generatedAt && <div style={{ fontSize: 9, color: MUTED, marginTop: 8 }}>Generated: {new Date(ai.generatedAt).toLocaleString("en-GB")}</div>}
          </Panel>
        </div>
      )}

      {/* Last updated */}
      <div style={{ fontSize: 9, color: MUTED, marginTop: 12, fontFamily: "'Inter Tight', sans-serif" }}>
        Showing cached data. Run searches in individual tabs to refresh.
        {media?.cachedAt && ` Media: ${new Date(media.cachedAt).toLocaleString("en-GB")}.`}
        {social?.fetchedAt && ` Social: ${new Date(social.fetchedAt).toLocaleString("en-GB")}.`}
        {spotify?.fetchedAt && ` Streaming: ${new Date(spotify.fetchedAt).toLocaleString("en-GB")}.`}
      </div>
    </div>
  );
}
