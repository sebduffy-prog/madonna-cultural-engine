import { useState, useEffect, useCallback, useMemo } from "react";
import { DualLineChart, SentimentLineChart, DonutChart, StackedBarChart, WordCloud } from "./SocialCharts";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", PURPLE = "#A78BFA", AMBER = "#F59E0B", TEAL = "#2DD4BF", PINK = "#F472B6", CORAL = "#FB923C";

const PLATFORM_COLORS = {
  twitter: "#1DA1F2", facebook: "#1877F2", instagram: "#E4405F", youtube: "#FF0000",
  tiktok: "#00F2EA", reddit: "#FF4500", news: "#A78BFA", web: MUTED, blog: TEAL,
  forum: CORAL, linkedin: "#0A66C2", brave_discussion: "#FB542B",
};

function highlightMadonna(text) {
  if (!text) return text;
  const parts = text.split(/(madonna)/gi);
  if (parts.length === 1) return text;
  return parts.map((p, i) => p.toLowerCase() === "madonna" ? <span key={i} style={{ color: Y, fontWeight: 700 }}>{p}</span> : p);
}

function MiniBar({ value, max, color }) {
  return (
    <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

function Stat({ label, value, sub, color = WHITE, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px",
      cursor: onClick ? "pointer" : "default", transition: "border-color 0.15s",
    }} onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color; }}
       onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; }}>
      <div style={{ fontSize: 9, color: typeof color === "string" ? color : MUTED, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'Inter Tight', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: DIM }}>{sub}</div>}
    </div>
  );
}

function Section({ title, color = PURPLE, children, right }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 10, color, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Sentiment arc — a creative half-donut showing sentiment balance
function SentimentArc({ positive, negative, neutral }) {
  const total = positive + negative + neutral || 1;
  const posAngle = (positive / total) * 180;
  const negAngle = (negative / total) * 180;
  const neuAngle = 180 - posAngle - negAngle;
  const r = 60, cx = 70, cy = 65;

  function arc(startDeg, endDeg, color) {
    const s = (startDeg - 180) * Math.PI / 180;
    const e = (endDeg - 180) * Math.PI / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />;
  }

  return (
    <svg width={140} height={75} viewBox="0 0 140 75">
      {arc(0, posAngle, GREEN)}
      {arc(posAngle, posAngle + neuAngle, `${MUTED}55`)}
      {arc(posAngle + neuAngle, 180, RED)}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={WHITE} fontSize={18} fontWeight={800} fontFamily="'Inter Tight', sans-serif">
        {Math.round((positive / total) * 100)}%
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill={DIM} fontSize={8} fontFamily="'Inter Tight', sans-serif">positive</text>
    </svg>
  );
}

// Momentum pulse — animated dots showing real-time volume intensity
function MomentumPulse({ mentionsPerDay, color = PURPLE }) {
  const intensity = Math.min(mentionsPerDay / 100, 1);
  const dots = 12;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 16 }}>
      {Array.from({ length: dots }, (_, i) => {
        const active = i / dots < intensity;
        return <div key={i} style={{
          width: 6, height: active ? 6 + Math.random() * 10 : 4, borderRadius: 2,
          background: active ? color : BORDER, transition: "height 0.3s ease, background 0.3s ease",
        }} />;
      })}
      <span style={{ fontSize: 9, color: DIM, marginLeft: 4, fontFamily: "'Inter Tight', sans-serif" }}>
        {mentionsPerDay}/day
      </span>
    </div>
  );
}

export default function SocialDashboard() {
  const [b24, setB24] = useState(null);
  const [legacy, setLegacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview"); // overview, platforms, topics, influencers, feed, demographics
  const [feedPlatform, setFeedPlatform] = useState("all");
  const [feedSentiment, setFeedSentiment] = useState("all");
  const [themeFilter, setThemeFilter] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [expandedDomain, setExpandedDomain] = useState(null);
  const [timeRange, setTimeRange] = useState(7); // 7, 14, or 30 days

  const fetchAll = useCallback(async (refresh = false) => {
    setLoading(true);
    const qs = refresh ? `?refresh=1&range=${timeRange}` : `?range=${timeRange}`;
    const [b, l] = await Promise.all([
      fetch(`/api/brand24${qs}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/social-dashboard${refresh ? "?refresh=1" : ""}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (b) setB24(b);
    if (l) setLegacy(l);
    setLoading(false);
  }, [timeRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function changeRange(days) {
    setTimeRange(days);
    // fetchAll will re-run due to useCallback dependency on timeRange
  }

  const hasB24 = b24?.configured && b24.totalMentions > 0;

  // Merge feed items from legacy (Reddit, YouTube, Brave) + Brand24 would need mention text
  const feedItems = useMemo(() => {
    const items = [...(legacy?.feed || [])];
    // Brand24 daily metrics don't contain individual mentions text, but events/topics provide context
    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [legacy]);

  const filteredFeed = feedItems.filter(i => {
    if (feedPlatform !== "all" && i.platform !== feedPlatform) return false;
    if (feedSentiment !== "all" && i.sentiment !== feedSentiment) return false;
    if (themeFilter && i.theme !== themeFilter) return false;
    return true;
  });

  // Computed metrics
  const totalMentions = (hasB24 ? b24.totalMentions : 0) + (legacy?.totalItems || 0);
  const totalReach = hasB24 ? b24.totalReach : 0;
  const totalEngagement = hasB24 ? b24.totalEngagement : 0;
  const avgMentionsPerDay = hasB24 && b24.dailyMetrics?.length > 0
    ? Math.round(b24.totalMentions / b24.dailyMetrics.length)
    : legacy?.totalItems ? Math.round(legacy.totalItems / 14) : 0;

  // Sentiment — prefer Brand24 if available (use integer counts, not proportions)
  const sentPos = hasB24 ? Math.round(b24.sentiment?.positive || 0) : (legacy?.sentiment?.counts?.positive || 0);
  const sentNeg = hasB24 ? Math.round(b24.sentiment?.negative || 0) : (legacy?.sentiment?.counts?.negative || 0);
  const sentNeu = hasB24 ? Math.round(b24.sentiment?.neutral || 0) : (legacy?.sentiment?.counts?.neutral || 0);
  const sentTotal = Math.max(sentPos + sentNeg + sentNeu, 1);
  // Use pre-computed percentages from Brand24 if available
  const sentPosPct = hasB24 ? (b24.sentiment?.positivePercent || Math.round((sentPos / sentTotal) * 100)) : Math.round((sentPos / sentTotal) * 100);
  const sentNegPct = hasB24 ? (b24.sentiment?.negativePercent || Math.round((sentNeg / sentTotal) * 100)) : Math.round((sentNeg / sentTotal) * 100);
  const sentNeuPct = 100 - sentPosPct - sentNegPct;

  if (loading && !b24 && !legacy) return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Loading social intelligence...</div>;

  const VIEWS = [
    { id: "overview", label: "Overview" },
    { id: "platforms", label: "Platforms" },
    { id: "topics", label: "Topics" },
    { id: "influencers", label: "Influencers" },
    { id: "feed", label: "Live Feed" },
    ...(hasB24 && b24.demographics ? [{ id: "demographics", label: "Demographics" }] : []),
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: PURPLE, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Social Listening</h2>
          {hasB24 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${GREEN}22`, color: GREEN, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>Live</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", background: CARD, borderRadius: 6, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => changeRange(d)} style={{
                padding: "5px 12px", fontSize: 10, fontWeight: timeRange === d ? 700 : 400,
                color: timeRange === d ? BG : DIM, background: timeRange === d ? PURPLE : "transparent",
                border: "none", cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
              }}>{d}d</button>
            ))}
          </div>
          <button onClick={() => fetchAll(true)} disabled={loading} style={{
            padding: "6px 16px", fontSize: 10, fontWeight: 700, color: loading ? MUTED : BG, background: loading ? BORDER : PURPLE,
            border: "none", borderRadius: 6, cursor: loading ? "default" : "pointer", fontFamily: "'Inter Tight', sans-serif",
          }}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: view === v.id ? 700 : 400,
            color: view === v.id ? BG : DIM, background: view === v.id ? PURPLE : "transparent",
            border: view === v.id ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
            fontFamily: "'Inter Tight', sans-serif",
          }}>{v.label}</button>
        ))}
      </div>

      {/* AI Summary banner */}
      {hasB24 && b24.aiSummary && view === "overview" && (
        <div style={{ background: `${PURPLE}11`, border: `1px solid ${PURPLE}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: PURPLE, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>AI Summary — Last 7 Days</div>
          <p style={{ fontSize: 13, color: DIM, margin: 0, lineHeight: 1.7 }}>{b24.aiSummary}</p>
        </div>
      )}

      {/* ═══ OVERVIEW ═══ */}
      {view === "overview" && <>
        {/* Hero stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Stat label="Total Mentions" value={totalMentions.toLocaleString()} sub={hasB24 ? `across ${b24.platforms?.length || 0} platforms (7d)` : `Reddit + YouTube`} color={WHITE} />
          <Stat label="Total Reach" value={totalReach > 0 ? `${(totalReach / 1000).toFixed(0)}K` : "—"} sub={totalReach > 0 ? "estimated impressions" : "no reach data"} color={TEAL} />
          <Stat label="Engagement" value={totalEngagement > 0 ? totalEngagement.toLocaleString() : "—"} sub="likes + comments + shares" color={AMBER} />
          <Stat label="Positive" value={`${sentPosPct}%`} color={GREEN} />
          <Stat label="Negative" value={`${sentNegPct}%`} color={RED} />
        </div>

        {/* Mentions & Reach line chart + Mentions by category donut */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title={`Mentions & Reach (${timeRange}d)`} color={PURPLE}>
            {hasB24 && b24.dailyMetrics?.length > 0 ? (
              <DualLineChart data={b24.dailyMetrics} height={220} />
            ) : <p style={{ fontSize: 11, color: MUTED }}>No daily data</p>}
          </Section>

          <Section title="Mentions by category" color={PURPLE}>
            {hasB24 && b24.platforms?.length > 0 ? (
              <DonutChart size={150} segments={b24.platforms.map(p => ({
                label: p.platform, value: p.mentions,
                color: PLATFORM_COLORS[p.platform] || MUTED,
              }))} />
            ) : <p style={{ fontSize: 11, color: MUTED }}>No platform data</p>}
          </Section>
        </div>

        {/* Sentiment line chart + Sentiment by category stacked bar */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title={`Sentiment (${timeRange}d)`} color={GREEN}>
            {hasB24 && b24.dailyMetrics?.length > 0 ? (
              <SentimentLineChart data={b24.dailyMetrics.map(d => ({
                date: d.date,
                positive: d.sentiment?.positive || 0,
                negative: d.sentiment?.negative || 0,
              }))} height={200} />
            ) : <p style={{ fontSize: 11, color: MUTED }}>No sentiment data</p>}
          </Section>

          <Section title="Sentiment by category" color={GREEN}>
            {hasB24 && b24.platforms?.length > 0 ? (
              <StackedBarChart data={b24.platforms.slice(0, 8).map(p => ({
                label: p.platform,
                positive: Math.round((p.mentions || 0) * (sentPosPct / 100)),
                neutral: Math.round((p.mentions || 0) * (sentNeuPct / 100)),
                negative: Math.round((p.mentions || 0) * (sentNegPct / 100)),
              }))} height={200} />
            ) : (
              <div>
                {Object.entries(legacy?.sentimentByPlatform || {}).map(([p, s]) => (
                  <div key={p} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => { setFeedPlatform(p); setView("feed"); }}>
                    <div style={{ fontSize: 10, color: PLATFORM_COLORS[p] || DIM, fontWeight: 600, marginBottom: 3 }}>{p}</div>
                    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${s.positive}%`, background: GREEN }} />
                      <div style={{ width: `${s.neutral}%`, background: `${MUTED}44` }} />
                      <div style={{ width: `${s.negative}%`, background: RED }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Anomaly events */}
        {hasB24 && b24.events?.length > 0 && (
          <Section title="Anomaly Events" color={CORAL}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {b24.events.slice(0, 4).map((e, i) => (
                <div key={i} style={{ background: `${CORAL}08`, border: `1px solid ${CORAL}22`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{e.date}</span>
                    <span style={{ fontSize: 9, color: CORAL, fontWeight: 700 }}>+{e.peakMentions?.toLocaleString()} mentions</span>
                  </div>
                  <p style={{ fontSize: 10, color: DIM, margin: 0, lineHeight: 1.4 }}>{(e.description || "").replace(/<[^>]+>/g, "").slice(0, 150)}</p>
                  {e.peakReach > 0 && <div style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>Peak reach: {(e.peakReach / 1000).toFixed(0)}K</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Trending hashtags + Trending links + Most active sites */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title="Trending Hashtags" color={PINK}>
            {hasB24 && b24.hashtags?.length > 0 ? (
              <div>
                {b24.hashtags.slice(0, 8).map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ fontSize: 12, color: WHITE, fontWeight: 500 }}>{h.hashtag}</span>
                    <span style={{ fontSize: 11, color: PINK, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{h.mentions?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : legacy?.topBigrams?.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {legacy.topBigrams.slice(0, 20).map((b, i) => {
                  const size = Math.max(9, Math.min(18, 9 + (b.count / Math.max(legacy.topBigrams[0]?.count, 1)) * 12));
                  return <span key={i} style={{ fontSize: size, color: WHITE, opacity: 0.4 + (b.count / Math.max(legacy.topBigrams[0]?.count, 1)) * 0.6, padding: "1px 4px", fontFamily: "'Inter Tight', sans-serif" }}>{b.word}</span>;
                })}
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No data</p>}
          </Section>

          <Section title="Trending Links" color={TEAL}>
            {hasB24 && b24.trendingLinks?.length > 0 ? (
              <div>
                {b24.trendingLinks.slice(0, 6).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0",
                    borderBottom: `1px solid ${BORDER}22`, textDecoration: "none",
                  }}>
                    <span style={{ fontSize: 10, color: TEAL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                      {l.url?.replace(/https?:\/\/(www\.)?/, "").slice(0, 40)}
                    </span>
                    <span style={{ fontSize: 11, color: WHITE, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{l.mentions}</span>
                  </a>
                ))}
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No links data</p>}
          </Section>

          <Section title="Most Active Sites" color={AMBER}>
            {hasB24 && (b24.activeSites?.length > 0 || b24.domains?.length > 0) ? (
              <div>
                {(b24.activeSites?.length > 0 ? b24.activeSites : b24.domains).slice(0, 6).map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${BORDER}22` }}>
                    <span style={{ fontSize: 11, color: WHITE }}>{d.domain}</span>
                    <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{d.mentions?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No site data</p>}
          </Section>
        </div>

        {/* Themes from legacy + sentiment by platform */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title="Conversation Themes" color={PURPLE}>
            {(legacy?.themes || []).filter(t => t.count > 0).map(t => {
              const maxT = Math.max(...(legacy?.themes || []).map(x => x.count), 1);
              return (
                <button key={t.id} onClick={() => { setThemeFilter(themeFilter === t.id ? null : t.id); setView("feed"); }} style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "3px 0", background: "transparent", border: "none", cursor: "pointer",
                  opacity: themeFilter && themeFilter !== t.id ? 0.3 : 1,
                }}>
                  <span style={{ fontSize: 10, color: t.color, width: 70, textAlign: "left", fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{t.label}</span>
                  <MiniBar value={t.count} max={maxT} color={t.color} />
                  <span style={{ fontSize: 10, color: WHITE, fontWeight: 700, width: 30, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{t.count}</span>
                </button>
              );
            })}
          </Section>

          <Section title="Context of discussion" color={TEAL}>
            {hasB24 && b24.topics?.length > 0 ? (
              <WordCloud words={b24.topics.map(t => ({
                text: t.name || t.description?.split(" ").slice(0, 3).join(" ") || "",
                weight: t.mentions || 0,
                sentiment: (t.sentiment?.positive || 0) - (t.sentiment?.negative || 0),
              }))} height={200} />
            ) : legacy?.topBigrams?.length > 0 ? (
              <WordCloud words={legacy.topBigrams.slice(0, 30).map(b => ({
                text: b.word, weight: b.count, sentiment: 0,
              }))} height={200} />
            ) : <p style={{ fontSize: 11, color: MUTED }}>No topic data</p>}
          </Section>
        </div>

        {/* Derived metrics row */}
        {hasB24 && b24.derived && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${AMBER}` }}>
              <div style={{ fontSize: 9, color: AMBER, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Momentum Score</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: b24.derived.momentumScore > 50 ? GREEN : b24.derived.momentumScore > 20 ? AMBER : RED, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived.momentumScore}</div>
              <div style={{ fontSize: 8, color: DIM }}>velocity + sentiment + engagement</div>
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${TEAL}` }}>
              <div style={{ fontSize: 9, color: TEAL, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Engagement Rate</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: TEAL, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived.engagementRate}%</div>
              <div style={{ fontSize: 8, color: DIM }}>{b24.derived.totalLikes?.toLocaleString()} likes · {b24.derived.totalComments?.toLocaleString()} comments · {b24.derived.totalShares?.toLocaleString()} shares</div>
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${PINK}` }}>
              <div style={{ fontSize: 9, color: PINK, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Virality Index</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: PINK, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived.viralityIndex}%</div>
              <div style={{ fontSize: 8, color: DIM }}>share rate per mention</div>
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${PURPLE}` }}>
              <div style={{ fontSize: 9, color: PURPLE, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Platform Diversity</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: PURPLE, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived.platformDiversity}</div>
              <div style={{ fontSize: 8, color: DIM }}>0-100 spread score ({b24.platforms?.length} platforms)</div>
            </div>
          </div>
        )}

        {/* Velocity + Reach breakdown + Influence + Hot hours */}
        {hasB24 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Mention velocity */}
            {b24.derived?.mentionVelocity && (
              <Section title="Mention Velocity" color={GREEN}>
                <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived.mentionVelocity.perHour}/hr</div>
                <div style={{ fontSize: 10, color: b24.derived.mentionVelocity.trend > 0 ? GREEN : b24.derived.mentionVelocity.trend < 0 ? RED : MUTED, marginTop: 4 }}>
                  {b24.derived.mentionVelocity.trend > 0 ? "▲" : b24.derived.mentionVelocity.trend < 0 ? "▼" : "—"} {Math.abs(b24.derived.mentionVelocity.trend)} vs yesterday
                </div>
                <div style={{ fontSize: 9, color: DIM, marginTop: 4 }}>Avg: {b24.derived.mentionVelocity.weekAvg}/day</div>
              </Section>
            )}

            {/* Reach breakdown */}
            {b24.reachBreakdown && (
              <Section title="Reach Split" color={TEAL}>
                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${b24.reachBreakdown.socialPct}%`, background: TEAL }} title="Social" />
                  <div style={{ width: `${100 - b24.reachBreakdown.socialPct}%`, background: PURPLE }} title="Non-social" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                  <span style={{ color: TEAL }}>Social {b24.reachBreakdown.socialPct}%</span>
                  <span style={{ color: PURPLE }}>Media {100 - b24.reachBreakdown.socialPct}%</span>
                </div>
                <div style={{ fontSize: 9, color: DIM, marginTop: 6 }}>
                  {(b24.reachBreakdown.social / 1000).toFixed(0)}K social · {(b24.reachBreakdown.nonSocial / 1000).toFixed(0)}K non-social
                </div>
              </Section>
            )}

            {/* Influence concentration */}
            <Section title="Influence" color={AMBER}>
              <div style={{ fontSize: 20, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>{b24.derived?.influenceConcentration || 0}%</div>
              <div style={{ fontSize: 9, color: DIM, marginTop: 4 }}>of reach from top 5 voices</div>
              <div style={{ fontSize: 10, color: WHITE, marginTop: 6 }}>
                Net sentiment reach: <span style={{ color: b24.derived?.sentimentWeightedReach > 0 ? GREEN : RED, fontWeight: 700 }}>{((b24.derived?.sentimentWeightedReach || 0) / 1000).toFixed(0)}K</span>
              </div>
            </Section>

            {/* Hot hours */}
            {b24.hotHours?.length > 0 && (
              <Section title="Peak Hours" color={CORAL}>
                {b24.hotHours.slice(0, 5).map((h, i) => {
                  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 10 }}>
                      <span style={{ color: DIM }}>{dayNames[h.day] || h.day} {h.hour}:00</span>
                      <span style={{ color: CORAL, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{h.mentions}</span>
                    </div>
                  );
                })}
              </Section>
            )}
          </div>
        )}

        {/* Trending links + AI Insights */}
        {hasB24 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {b24.trendingLinks?.length > 0 && (
              <Section title="Trending Links" color={TEAL}>
                {b24.trendingLinks.slice(0, 8).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0",
                    borderBottom: `1px solid ${BORDER}22`, textDecoration: "none", fontSize: 10,
                  }}>
                    <span style={{ color: TEAL, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                      {l.url?.replace(/https?:\/\/(www\.)?/, "").slice(0, 60)}
                    </span>
                    <span style={{ color: WHITE, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", flexShrink: 0 }}>{l.mentions}</span>
                  </a>
                ))}
              </Section>
            )}

            {b24.aiInsights?.length > 0 && (
              <Section title="AI Insights" color={AMBER}>
                {b24.aiInsights.slice(0, 4).map((ins, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: WHITE, marginBottom: 2 }}>{ins.headline}</div>
                    <p style={{ fontSize: 10, color: DIM, margin: 0, lineHeight: 1.4 }}>{(ins.text || "").slice(0, 150)}</p>
                    {ins.type && <span style={{ fontSize: 8, color: AMBER, marginTop: 2, display: "inline-block" }}>{ins.type}</span>}
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </>}

      {/* ═══ PLATFORMS ═══ */}
      {view === "platforms" && <>
        {hasB24 && b24.platforms?.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
              {b24.platforms.map(p => {
                const pc = PLATFORM_COLORS[p.platform] || MUTED;
                const pct = b24.totalMentions > 0 ? Math.round((p.mentions / b24.totalMentions) * 100) : 0;
                return (
                  <div key={p.platform} style={{
                    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px",
                    borderTop: `3px solid ${pc}`, cursor: "pointer", transition: "transform 0.15s",
                  }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                     onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: pc, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif", textTransform: "capitalize" }}>{p.platform}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{p.mentions.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: DIM, marginBottom: 8 }}>mentions · {pct}% share</div>
                    {/* Share bar */}
                    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pc, borderRadius: 2 }} />
                    </div>
                    {p.reach > 0 && <div style={{ fontSize: 9, color: DIM, marginTop: 6 }}>Reach: {(p.reach / 1000).toFixed(0)}K</div>}
                  </div>
                );
              })}
            </div>

            {/* Platform daily breakdown chart */}
            {b24.dailyMetrics?.some(d => d.bySource?.length > 0) && (
              <Section title="Platform Mix Over Time" color={PURPLE}>
                <div style={{ display: "flex", gap: 4, height: 100, alignItems: "flex-end" }}>
                  {b24.dailyMetrics.map((d, i) => {
                    const dayTotal = d.bySource?.reduce((s, src) => s + (src.mentions_count || 0), 0) || d.mentions || 1;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 100 }} title={d.date}>
                        {(d.bySource || []).map((src, j) => {
                          const pct = (src.mentions_count || 0) / dayTotal;
                          return <div key={j} style={{ width: "100%", height: Math.max(1, pct * 80), background: PLATFORM_COLORS[src.source] || MUTED }} title={`${src.source}: ${src.mentions_count}`} />;
                        })}
                        <span style={{ fontSize: 7, color: MUTED, textAlign: "center", marginTop: 2 }}>{d.date?.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {b24.platforms.map(p => (
                    <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: PLATFORM_COLORS[p.platform] || MUTED }} />
                      <span style={{ fontSize: 9, color: DIM }}>{p.platform}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {legacy?.platforms && Object.entries(legacy.platforms).map(([p, count]) => (
              <Stat key={p} label={p} value={count.toLocaleString()} color={PLATFORM_COLORS[p] || MUTED} onClick={() => { setFeedPlatform(p); setView("feed"); }} />
            ))}
          </div>
        )}
      </>}

      {/* ═══ TOPICS ═══ */}
      {view === "topics" && <>
        {hasB24 && b24.topics?.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {b24.topics.map((t, i) => {
              const isExpanded = expandedTopic === i;
              const sentPosT = t.sentiment?.positive || 0;
              const sentNegT = t.sentiment?.negative || 0;
              const sentTotalT = Math.max(sentPosT + sentNegT + (t.sentiment?.neutral || 0), 1);
              return (
                <div key={t.id || i} onClick={() => setExpandedTopic(isExpanded ? null : i)} style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px", cursor: "pointer",
                  borderLeft: `3px solid ${PURPLE}`, transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{t.name}</span>
                    {t.shareOfVoice != null && <span style={{ fontSize: 10, color: PURPLE, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{t.shareOfVoice}% SOV</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: DIM, marginBottom: 8 }}>
                    <span>{t.mentions} mentions</span>
                    {t.reach > 0 && <span>Reach: {(t.reach / 1000).toFixed(0)}K</span>}
                    <span style={{ color: GREEN }}>{Math.round((sentPosT / sentTotalT) * 100)}% pos</span>
                  </div>
                  {/* Sentiment mini-bar */}
                  <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${(sentPosT / sentTotalT) * 100}%`, background: GREEN }} />
                    <div style={{ flex: 1, background: `${MUTED}33` }} />
                    <div style={{ width: `${(sentNegT / sentTotalT) * 100}%`, background: RED }} />
                  </div>
                  {isExpanded && t.description && (
                    <p style={{ fontSize: 12, color: DIM, marginTop: 10, lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>{t.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Section title="Themes from YouTube & Reddit" color={PURPLE}>
            {(legacy?.themes || []).filter(t => t.count > 0).map(t => {
              const maxT = Math.max(...(legacy?.themes || []).map(x => x.count), 1);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 11, color: t.color, width: 80, fontWeight: 600 }}>{t.label}</span>
                  <MiniBar value={t.count} max={maxT} color={t.color} />
                  <span style={{ fontSize: 11, color: WHITE, fontWeight: 700, width: 40, textAlign: "right" }}>{t.count}</span>
                </div>
              );
            })}
          </Section>
        )}
      </>}

      {/* ═══ INFLUENCERS ═══ */}
      {view === "influencers" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {hasB24 && b24.influencers?.length > 0 && (
            <Section title="Top Influencers" color={AMBER}>
              {b24.influencers.map((inf, i) => (
                <a key={i} href={inf.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${BORDER}22`, textDecoration: "none",
                }}>
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 800, width: 24, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{inf.name}</div>
                    <div style={{ fontSize: 9, color: DIM }}>{inf.mentions} mentions · reach {inf.reach?.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>{(inf.followers / 1000).toFixed(0)}K</div>
                    <div style={{ fontSize: 8, color: DIM }}>followers</div>
                  </div>
                </a>
              ))}
            </Section>
          )}

          <Section title={hasB24 ? "Top Authors (Reddit + YouTube)" : "Top Authors"} color={PURPLE}>
            {(legacy?.topAuthors || []).slice(0, 12).map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>
                <span style={{ fontSize: 10, color: MUTED, width: 16, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
                <span style={{ fontSize: 11, color: WHITE, flex: 1 }}>{a.name}</span>
                <span style={{ fontSize: 9, color: PLATFORM_COLORS[a.platform] || DIM }}>{a.platform}</span>
                <span style={{ fontSize: 10, color: AMBER, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{a.count}</span>
              </div>
            ))}
          </Section>

          <Section title="Highest Engagement" color={GREEN}>
            {(legacy?.topEngaged || []).slice(0, 12).map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>
                <span style={{ fontSize: 10, color: MUTED, width: 16, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
                <span style={{ fontSize: 11, color: WHITE, flex: 1 }}>{a.name}</span>
                <span style={{ fontSize: 10, color: GREEN, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>▲ {a.totalScore.toLocaleString()}</span>
              </div>
            ))}
          </Section>
        </div>
      </>}

      {/* ═══ LIVE FEED ═══ */}
      {view === "feed" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["all", ...Object.keys(legacy?.platforms || {})].map(f => (
              <button key={f} onClick={() => setFeedPlatform(f)} style={{
                padding: "4px 10px", fontSize: 10, fontWeight: feedPlatform === f ? 700 : 400,
                color: feedPlatform === f ? BG : DIM, background: feedPlatform === f ? (PLATFORM_COLORS[f] || PURPLE) : "transparent",
                border: feedPlatform === f ? "none" : `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
              }}>{f}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "positive", "neutral", "negative"].map(s => {
              const sc = s === "positive" ? GREEN : s === "negative" ? RED : s === "neutral" ? MUTED : PURPLE;
              return (
                <button key={s} onClick={() => setFeedSentiment(s)} style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: feedSentiment === s ? 700 : 400,
                  color: feedSentiment === s ? BG : DIM, background: feedSentiment === s ? sc : "transparent",
                  border: feedSentiment === s ? "none" : `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
                }}>{s}</button>
              );
            })}
            {themeFilter && <button onClick={() => setThemeFilter(null)} style={{
              padding: "4px 10px", fontSize: 10, color: BG, background: AMBER,
              border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
            }}>#{themeFilter} ✕</button>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto" }}>
          {filteredFeed.length === 0 ? (
            <div style={{ color: MUTED, padding: 30, textAlign: "center", fontSize: 12 }}>No items match filters.</div>
          ) : filteredFeed.map((item, i) => {
            const pc = PLATFORM_COLORS[item.platform] || MUTED;
            const sc = item.sentiment === "positive" ? GREEN : item.sentiment === "negative" ? RED : MUTED;
            return (
              <a key={item.id || i} href={item.url} target="_blank" rel="noopener noreferrer" style={{
                display: "block", background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${pc}`,
                borderRadius: 8, padding: "10px 14px", textDecoration: "none", transition: "border-color 0.15s",
              }} onMouseOver={e => e.currentTarget.style.borderColor = pc} onMouseOut={e => e.currentTarget.style.borderColor = BORDER}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: BG, background: pc, padding: "1px 6px", borderRadius: 3, fontFamily: "'Inter Tight', sans-serif" }}>{item.platform}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{item.author}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, color: sc, fontWeight: 600 }}>{item.sentiment}</span>
                    {item.score > 0 && <span style={{ fontSize: 9, color: AMBER }}>▲ {item.score}</span>}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.4 }}>{highlightMadonna((item.text || "").slice(0, 250))}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 9, color: MUTED }}>
                  {item.date && <span>{new Date(item.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                  {item.theme && item.theme !== "general" && <span style={{ color: TEAL }}>#{item.theme}</span>}
                </div>
              </a>
            );
          })}
        </div>
      </>}

      {/* ═══ DEMOGRAPHICS ═══ */}
      {view === "demographics" && hasB24 && b24.demographics && (() => {
        const demo = b24.demographics?.demographics || b24.demographics;
        // Sex data is an array: [{name: "female", reachPercent: 49.45}, {name: "male", reachPercent: 50.6}]
        const sexArr = Array.isArray(demo.sex) ? demo.sex : [];
        const femalePct = sexArr.find(s => s.name === "female")?.reachPercent || 0;
        const malePct = sexArr.find(s => s.name === "male")?.reachPercent || 0;
        const totalReachDemo = sexArr.reduce((s, x) => s + (x.reachCount || 0), 0);
        // Ages: { female: [{name:"18-24", reachPercent:10.4, ...}], male: [...] }
        const agesFemale = Array.isArray(demo.ages?.female) ? demo.ages.female : [];
        const agesMale = Array.isArray(demo.ages?.male) ? demo.ages.male : [];
        const ageBrackets = agesFemale.map(a => a.name);
        const maxAgePct = Math.max(...agesFemale.map(a => a.reachPercent || 0), ...agesMale.map(a => a.reachPercent || 0), 1);

        return <>
        {/* Age + Gender row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* Age chart — grouped bars male/female */}
          <Section title="Age" color={PURPLE}>
            {ageBrackets.length > 0 ? (
              <div>
                <svg width="100%" viewBox={`0 0 ${ageBrackets.length * 70 + 40} 180`} style={{ display: "block" }}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = 10 + (1 - pct) * 130;
                    const val = Math.round(maxAgePct * pct);
                    return (
                      <g key={i}>
                        <line x1={30} y1={y} x2={ageBrackets.length * 70 + 30} y2={y} stroke={BORDER} strokeWidth={0.5} />
                        <text x={26} y={y + 3} textAnchor="end" fill={DIM} fontSize={8} fontFamily="'Inter Tight', sans-serif">{val}</text>
                      </g>
                    );
                  })}
                  {/* Bars */}
                  {ageBrackets.map((bracket, i) => {
                    const f = agesFemale[i]?.reachPercent || 0;
                    const m = agesMale[i]?.reachPercent || 0;
                    const x = 40 + i * 70;
                    const fH = (f / maxAgePct) * 130;
                    const mH = (m / maxAgePct) * 130;
                    return (
                      <g key={i}>
                        <rect x={x} y={140 - fH} width={22} height={fH} fill={GREEN} rx={2} />
                        <rect x={x + 26} y={140 - mH} width={22} height={mH} fill="#60A5FA" rx={2} />
                        <text x={x + 24} y={158} textAnchor="middle" fill={DIM} fontSize={9} fontFamily="'Inter Tight', sans-serif">{bracket}</text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 9, fontFamily: "'Inter Tight', sans-serif" }}>
                  <span><span style={{ color: GREEN }}>●</span> Female</span>
                  <span><span style={{ color: "#60A5FA" }}>●</span> Male</span>
                </div>
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No age data</p>}
          </Section>

          {/* Gender donut */}
          <Section title="Gender" color={PINK}>
            <DonutChart size={140} segments={[
              { label: "Female", value: femalePct, color: GREEN },
              { label: "Male", value: malePct, color: "#60A5FA" },
            ]} />
            {totalReachDemo > 0 && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: DIM }}>
                Total reach: {(totalReachDemo / 1000000).toFixed(0)}M
              </div>
            )}
          </Section>
        </div>

        {/* Interests + Countries + Top occupations */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {demo.interests && (
            <Section title="Interests" color={AMBER}>
              {(Array.isArray(demo.interests) ? demo.interests : []).slice(0, 10).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>
                  <span style={{ fontSize: 11, color: WHITE }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: AMBER, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{item.mentionsPercent || item.reachPercent || ""}%</span>
                </div>
              ))}
            </Section>
          )}

          {demo.countries && (
            <Section title="Top Countries" color={TEAL}>
              {(Array.isArray(demo.countries) ? demo.countries : []).slice(0, 10).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${BORDER}22` }}>
                  <span style={{ fontSize: 11, color: WHITE }}>{item.name}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: DIM }}>{item.mentionsCount?.toLocaleString()} mentions</span>
                    <span style={{ fontSize: 10, color: TEAL, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{item.reachPercent || item.mentionsPercent || ""}%</span>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>
      </>;
      })()}

      {/* Footer */}
      <div style={{ fontSize: 9, color: MUTED, marginTop: 16, fontFamily: "'Inter Tight', sans-serif" }}>
        {hasB24 && `${b24.period?.from} to ${b24.period?.to} · `}
        {hasB24 && b24.platforms?.length > 0 && `Tracking: ${b24.platforms.map(p => p.platform).join(", ")} · `}
        YouTube ({legacy?.youtubeComments || 0} comments) ·
        Reddit ({legacy?.redditPosts || 0} posts, {legacy?.redditComments || 0} comments)
        {hasB24 && b24.fetchedAt && ` · Updated: ${new Date(b24.fetchedAt).toLocaleString("en-GB")}`}
      </div>
    </div>
  );
}
