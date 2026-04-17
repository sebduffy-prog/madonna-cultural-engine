import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import LineChart from "./LineChart";
import { DualLineChart } from "./SocialCharts";
import { fadeUp, hoverLift } from "../lib/motion";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
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
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      whileHover={hoverLift}
      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 2, height: 12, background: color, borderRadius: 1 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter Tight', sans-serif" }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

export default function DashboardSummary() {
  const [media, setMedia] = useState(null);
  const [social, setSocial] = useState(null);
  const [ai, setAi] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(null);
  const [b24, setB24] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Load fast sources first — don't wait for Spotify
      let [m, s, a, mi, b] = await Promise.all([
        fetch("/api/news?category=madonna").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/social").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/ai-strategy").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/media-index").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/brand24").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      // Auto-refresh empty results (without blocking)
      const refreshes = [];
      if (!m?.items?.length) refreshes.push(fetch("/api/news?category=madonna&refresh=1").then(r => r.ok ? r.json() : null).then(d => { m = d || m; setMedia(m); }).catch(() => {}));
      if (!s?.platforms?.length || s.totalSources === 0) refreshes.push(fetch("/api/social?refresh=1").then(r => r.ok ? r.json() : null).then(d => { s = d || s; setSocial(s); }).catch(() => {}));

      setMedia(m); setSocial(s); setAi(a); setMediaIndex(mi); if (b) setB24(b);
      setLoading(false); // Show dashboard immediately

      // Finish any refreshes in background
      if (refreshes.length > 0) Promise.all(refreshes).catch(() => {});

    }
    load();
  }, []);

  if (loading) {
    const { KpiStripSkeleton, PanelSkeleton } = require("./Skeleton");
    return (
      <div>
        <KpiStripSkeleton count={4} />
        <div className="panel-split-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <PanelSkeleton rows={5} accent={Y} />
          <PanelSkeleton rows={5} accent={TEAL} />
        </div>
        <PanelSkeleton rows={3} accent={PINK} />
      </div>
    );
  }

  const madonnaArticles = media?.items || [];
  const trendIndex = mediaIndex?.index ?? 0; // percentage change vs baseline
  const totalMentions = mediaIndex?.totalMentions || mediaIndex?.totalToday || 0;
  const dailyChange = mediaIndex?.dailyChange;
  const todayMentions = b24?.dailyMetrics?.length > 0 ? b24.dailyMetrics[b24.dailyMetrics.length - 1]?.mentions || 0 : null;
  const sentiment = social?.sentiment;
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
      <div className="kpi-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Madonna in media</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: Y, fontFamily: "'Inter Tight', sans-serif" }}>{madonnaArticles.length}</div>
          <div style={{ fontSize: 9, color: DIM }}>articles mentioning Madonna</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Trend Index</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: trendIndex > 0 ? GREEN : trendIndex < 0 ? RED : WHITE, fontFamily: "'Inter Tight', sans-serif" }}>
            {trendIndex > 0 ? "+" : ""}{trendIndex}%
          </div>
          <div style={{ fontSize: 9, color: DIM }}>
            {totalMentions > 0 ? `${totalMentions} media mentions` : "vs baseline"}
            {todayMentions != null ? ` · ${todayMentions} social today` : ""}
          </div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 9, color: TEAL, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Total Reach</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: TEAL, fontFamily: "'Inter Tight', sans-serif" }}>{b24?.totalReach ? (b24.totalReach >= 1000000 ? `${(b24.totalReach / 1000000).toFixed(1)}M` : `${(b24.totalReach / 1000).toFixed(0)}K`) : "---"}</div>
          <div style={{ fontSize: 9, color: DIM }}>{b24?.totalMentions ? `${b24.totalMentions.toLocaleString()} mentions` : "no data"}</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
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
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
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
      <div className="panel-split-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

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

        {/* Mentions & Reach chart */}
        <Panel title="Mentions & Reach" color={PURPLE}>
          {b24?.dailyMetrics?.length > 0 ? (
            <DualLineChart data={b24.dailyMetrics} height={180} />
          ) : (
            <p style={{ fontSize: 12, color: MUTED }}>No social data yet. Check Social Listening tab.</p>
          )}
        </Panel>

        {/* Platform breakdown */}
        <Panel title="Platform breakdown" color={GREEN}>
          {b24?.platforms?.length > 0 ? (
            <div>
              {b24.platforms.slice(0, 6).map((p, i) => (
                <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>
                  <span style={{ fontSize: 10, color: DIM, width: 60, fontFamily: "'Inter Tight', sans-serif" }}>{p.platform}</span>
                  <div style={{ flex: 1, height: 5, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(2, (p.mentions / Math.max(b24.platforms[0]?.mentions, 1)) * 100)}%`, height: "100%", background: GREEN, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: WHITE, fontWeight: 600, width: 35, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{p.mentions?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: MUTED }}>No platform data yet.</p>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEAL }}>{social.signals.brand24Mentions.reach >= 1000000 ? `${(social.signals.brand24Mentions.reach / 1000000).toFixed(1)}M` : `${(social.signals.brand24Mentions.reach / 1000).toFixed(0)}K`}</div>
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

      {/* Madonna strategy recommendations only */}
      {aiRecs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Panel title="Strategic Recommendations" color={AMBER}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {aiRecs.slice(0, 3).map((rec, i) => (
                <div key={i} style={{ paddingBottom: 8, borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: BG, background: rec.type === "Media" ? PINK : rec.type === "Partnership" ? TEAL : AMBER, padding: "2px 8px", borderRadius: 3, fontFamily: "'Inter Tight', sans-serif" }}>{rec.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{rec.title}</span>
                  </div>
                  <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.6 }}>{rec.description}</p>
                </div>
              ))}
            </div>
            {ai?.generatedAt && <div style={{ fontSize: 9, color: MUTED, marginTop: 8 }}>Generated: {new Date(ai.generatedAt).toLocaleString("en-GB")}</div>}
          </Panel>
        </div>
      )}

      {/* Last updated */}
      <div style={{ fontSize: 9, color: MUTED, marginTop: 12, fontFamily: "'Inter Tight', sans-serif" }}>
        Showing cached data. Run searches in individual tabs to refresh.
        {media?.cachedAt && ` Media: ${new Date(media.cachedAt).toLocaleString("en-GB")}.`}
        {social?.fetchedAt && ` Social: ${new Date(social.fetchedAt).toLocaleString("en-GB")}.`}
        {b24?.fetchedAt && ` Social: ${new Date(b24.fetchedAt).toLocaleString("en-GB")}.`}
      </div>
    </div>
  );
}
