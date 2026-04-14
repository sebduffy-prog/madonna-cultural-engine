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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Try cached first
      let [m, s, sp, a] = await Promise.all([
        fetch("/api/news?category=madonna").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/social").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/spotify").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/ai-strategy").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      // Auto-refresh any empty results
      const refreshes = [];
      if (!m?.items?.length) refreshes.push(fetch("/api/news?category=madonna&refresh=1").then(r => r.ok ? r.json() : null).then(d => { m = d || m; }).catch(() => {}));
      if (!s?.platforms?.length || s.platforms.every(p => p.items.length === 0)) refreshes.push(fetch("/api/social?refresh=1").then(r => r.ok ? r.json() : null).then(d => { s = d || s; }).catch(() => {}));
      if (!sp?.topTracks?.length) refreshes.push(fetch("/api/spotify?refresh=1").then(r => r.ok ? r.json() : null).then(d => { sp = d || sp; }).catch(() => {}));
      if (refreshes.length > 0) await Promise.all(refreshes);
      setMedia(m); setSocial(s); setSpotify(sp); setAi(a);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Loading dashboard...</div>;
  }

  const madonnaArticles = (media?.items || []).filter((i) => /madonna/i.test(i.title));
  const totalSocialMentions = social?.metrics?.totalMentions || 0;
  const sentiment = social?.sentiment;
  const spotifyTracks = spotify?.topTracks?.length || 0;
  const topTrack = spotify?.topTracks?.[0];
  const aiRecs = ai?.recommendations?.madonna || [];

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
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Social mentions</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: PURPLE, fontFamily: "'Inter Tight', sans-serif" }}>{totalSocialMentions}</div>
          <div style={{ fontSize: 9, color: DIM }}>across all platforms</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Spotify catalogue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{spotifyTracks || "---"}</div>
          <div style={{ fontSize: 9, color: DIM }}>tracks found</div>
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

      {/* Mentions trend line chart */}
      {social?.history && social.history.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Daily Mentions Trend
          </div>
          <LineChart
            height={130}
            showLegend={false}
            series={[{
              label: "Total Mentions",
              color: PURPLE,
              data: social.history.slice().reverse().map(s => ({ date: s.date, value: s.totalMentions || 0 })),
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
        <Panel title="Social listening snapshot" color={PURPLE}>
          {!social || totalSocialMentions === 0 ? (
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
                    <span style={{ color: GREEN }}>{sentiment.positiveCount} positive</span>
                    <span style={{ color: MUTED }}>{sentiment.neutralCount} neutral</span>
                    <span style={{ color: RED }}>{sentiment.negativeCount} negative</span>
                  </div>
                </div>
              )}
              {social.metrics?.platformBreakdown && (
                <div>
                  {Object.entries(social.metrics.platformBreakdown).map(([p, count]) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: DIM, width: 55, fontFamily: "'Inter Tight', sans-serif" }}>{p}</span>
                      <div style={{ flex: 1, height: 4, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${(count / Math.max(...Object.values(social.metrics.platformBreakdown), 1)) * 100}%`, height: "100%", background: PURPLE, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: WHITE, fontWeight: 600, width: 20, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
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
                  <div style={{ fontSize: 10, color: DIM }}>{spotify.topTracks?.length || 0} tracks \u00B7 {spotify.relatedArtists?.length || 0} connected artists</div>
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

        {/* Recommended actions */}
        <Panel title="Recommended actions" color={AMBER}>
          {aiRecs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aiRecs.slice(0, 3).map((rec, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: BG, background: rec.type === "Media" ? PINK : rec.type === "Partnership" ? TEAL : AMBER, padding: "1px 6px", borderRadius: 3, fontFamily: "'Inter Tight', sans-serif" }}>{rec.type}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{rec.title}</span>
                  </div>
                  <p style={{ fontSize: 11, color: DIM, margin: 0, lineHeight: 1.4 }}>{rec.description?.slice(0, 150)}{rec.description?.length > 150 ? "..." : ""}</p>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: MUTED, margin: "0 0 8px" }}>No AI recommendations generated yet. Run feed searches first, then generate recommendations in the Media tab.</p>
              <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
                Actions to take:<br />
                1. Run a search in the Media tab to pull latest coverage<br />
                2. Run a scan in Social Listening for current mentions<br />
                3. Connect Spotify in the Streaming tab<br />
                4. Generate AI recommendations from the Media tab
              </div>
            </div>
          )}
        </Panel>
      </div>

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
