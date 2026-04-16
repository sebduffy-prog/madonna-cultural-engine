import { useState, useEffect, useCallback, useMemo } from "react";

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

  const fetchAll = useCallback(async (refresh = false) => {
    setLoading(true);
    const qs = refresh ? "?refresh=1" : "";
    const [b, l] = await Promise.all([
      fetch(`/api/brand24${qs}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/social-dashboard${qs}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (b) setB24(b);
    if (l) setLegacy(l);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  // Sentiment — prefer Brand24 if available
  const sentPos = hasB24 ? b24.sentiment.positive : (legacy?.sentiment?.counts?.positive || 0);
  const sentNeg = hasB24 ? b24.sentiment.negative : (legacy?.sentiment?.counts?.negative || 0);
  const sentNeu = hasB24 ? b24.sentiment.neutral : (legacy?.sentiment?.counts?.neutral || 0);
  const sentTotal = Math.max(sentPos + sentNeg + sentNeu, 1);

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
          {hasB24 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${GREEN}22`, color: GREEN, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>Brand24 Live</span>}
        </div>
        <button onClick={() => fetchAll(true)} disabled={loading} style={{
          padding: "6px 16px", fontSize: 10, fontWeight: 700, color: loading ? MUTED : BG, background: loading ? BORDER : PURPLE,
          border: "none", borderRadius: 6, cursor: loading ? "default" : "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>{loading ? "Loading..." : "Refresh All"}</button>
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
          <Stat label="Total Mentions" value={totalMentions.toLocaleString()} sub={hasB24 ? `Brand24: ${b24.totalMentions.toLocaleString()} + Legacy: ${(legacy?.totalItems || 0).toLocaleString()}` : `Reddit + YouTube`} color={WHITE} />
          <Stat label="Total Reach" value={totalReach > 0 ? `${(totalReach / 1000).toFixed(0)}K` : "—"} sub={hasB24 ? "estimated impressions" : "requires Brand24"} color={TEAL} />
          <Stat label="Engagement" value={totalEngagement > 0 ? totalEngagement.toLocaleString() : "—"} sub="likes + comments + shares" color={AMBER} />
          <Stat label="Positive" value={`${Math.round((sentPos / sentTotal) * 100)}%`} color={GREEN} />
          <Stat label="Negative" value={`${Math.round((sentNeg / sentTotal) * 100)}%`} color={RED} />
        </div>

        {/* Sentiment arc + Momentum + Events */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title="Sentiment Balance" color={GREEN}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SentimentArc positive={sentPos} negative={sentNeg} neutral={sentNeu} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 4 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{sentPos}</div>
                <div style={{ fontSize: 8, color: DIM }}>positive</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{sentNeu}</div>
                <div style={{ fontSize: 8, color: DIM }}>neutral</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: RED }}>{sentNeg}</div>
                <div style={{ fontSize: 8, color: DIM }}>negative</div>
              </div>
            </div>
          </Section>

          {/* Daily mentions chart */}
          <Section title="Daily Mentions (7d)" color={PURPLE}>
            {hasB24 && b24.dailyMetrics?.length > 0 ? (
              <div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                  {b24.dailyMetrics.map((d, i) => {
                    const max = Math.max(...b24.dailyMetrics.map(x => x.mentions), 1);
                    const h = Math.max(4, (d.mentions / max) * 70);
                    const sentColor = (d.sentiment?.positive || 0) > (d.sentiment?.negative || 0) ? GREEN : (d.sentiment?.negative || 0) > 0 ? RED : PURPLE;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${d.date}: ${d.mentions} mentions, reach ${d.reach?.toLocaleString()}`}>
                        <span style={{ fontSize: 8, color: WHITE, fontWeight: 600 }}>{d.mentions}</span>
                        <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: `linear-gradient(180deg, ${sentColor}, ${sentColor}44)`, cursor: "pointer" }} />
                        <span style={{ fontSize: 7, color: MUTED }}>{d.date?.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <MomentumPulse mentionsPerDay={avgMentionsPerDay} />
              </div>
            ) : legacy?.hourlyVolume?.length > 0 ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 80 }}>
                {legacy.hourlyVolume.map((h, i) => {
                  const max = Math.max(...legacy.hourlyVolume.map(x => x.total), 1);
                  return (
                    <div key={i} style={{ flex: 1, height: Math.max(2, (h.total / max) * 70), borderRadius: "2px 2px 0 0", background: h.total > 0 ? PURPLE : BORDER }} title={`${h.hour}: ${h.total}`} />
                  );
                })}
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No daily data yet</p>}
          </Section>

          {/* Spike events */}
          <Section title="Anomaly Events" color={CORAL}>
            {hasB24 && b24.events?.length > 0 ? (
              b24.events.slice(0, 4).map((e, i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{e.date}</span>
                    <span style={{ fontSize: 9, color: CORAL, fontWeight: 600 }}>+{e.peakMentions} peak</span>
                  </div>
                  <p style={{ fontSize: 10, color: DIM, margin: "2px 0 0", lineHeight: 1.4 }}>{(e.description || "").slice(0, 120)}</p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 11, color: MUTED }}>No anomalies detected{!hasB24 ? " — requires Brand24" : ""}</p>
            )}
          </Section>
        </div>

        {/* Trending hashtags + Top domains */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Section title="Trending Hashtags" color={PINK}>
            {hasB24 && b24.hashtags?.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b24.hashtags.slice(0, 15).map((h, i) => {
                  const maxMentions = b24.hashtags[0]?.mentions || 1;
                  const size = Math.max(10, Math.min(20, 10 + (h.mentions / maxMentions) * 12));
                  const sentColor = h.sentiment > 0 ? GREEN : h.sentiment < 0 ? RED : MUTED;
                  return (
                    <span key={i} title={`${h.mentions} mentions · reach ${h.reach?.toLocaleString()} · sentiment ${h.sentiment}`} style={{
                      fontSize: size, color: sentColor, fontWeight: 600, padding: "2px 6px", cursor: "pointer",
                      background: `${sentColor}11`, borderRadius: 4, fontFamily: "'Inter Tight', sans-serif",
                      transition: "transform 0.15s",
                    }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                       onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      {h.hashtag} <span style={{ fontSize: 8, opacity: 0.7 }}>{h.mentions}</span>
                    </span>
                  );
                })}
              </div>
            ) : legacy?.topBigrams?.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {legacy.topBigrams.slice(0, 25).map((b, i) => {
                  const size = Math.max(9, Math.min(18, 9 + (b.count / Math.max(legacy.topBigrams[0]?.count, 1)) * 12));
                  return <span key={i} style={{ fontSize: size, color: WHITE, opacity: 0.4 + (b.count / Math.max(legacy.topBigrams[0]?.count, 1)) * 0.6, padding: "1px 4px", fontFamily: "'Inter Tight', sans-serif" }}>{b.word}</span>;
                })}
              </div>
            ) : <p style={{ fontSize: 11, color: MUTED }}>No data</p>}
          </Section>

          <Section title="Top Sources" color={TEAL}>
            {hasB24 && b24.domains?.length > 0 ? (
              b24.domains.slice(0, 8).map((d, i) => {
                const maxM = b24.domains[0]?.mentions || 1;
                return (
                  <div key={i} onClick={() => setExpandedDomain(expandedDomain === i ? null : i)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${BORDER}22`, cursor: "pointer",
                  }}>
                    <span style={{ fontSize: 10, color: MUTED, width: 14, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
                    <span style={{ fontSize: 11, color: WHITE, flex: 1, fontWeight: expandedDomain === i ? 700 : 400 }}>{d.domain}</span>
                    <MiniBar value={d.mentions} max={maxM} color={TEAL} />
                    <span style={{ fontSize: 10, color: TEAL, fontWeight: 600, width: 30, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{d.mentions}</span>
                    {d.influence > 0 && <span style={{ fontSize: 8, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }} title="Influence score">★{d.influence}</span>}
                  </div>
                );
              })
            ) : <p style={{ fontSize: 11, color: MUTED }}>Requires Brand24</p>}
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

          <Section title="Sentiment by Platform" color={GREEN}>
            {Object.entries(legacy?.sentimentByPlatform || {}).map(([p, s]) => (
              <div key={p} onClick={() => { setFeedPlatform(p); setView("feed"); }} style={{ marginBottom: 10, cursor: "pointer" }}>
                <div style={{ fontSize: 10, color: PLATFORM_COLORS[p] || DIM, fontWeight: 600, marginBottom: 4 }}>{p}</div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${s.positive}%`, background: GREEN }} />
                  <div style={{ width: `${s.neutral}%`, background: `${MUTED}44` }} />
                  <div style={{ width: `${s.negative}%`, background: RED }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: DIM, marginTop: 2 }}>
                  <span style={{ color: GREEN }}>{s.positive}%</span><span style={{ color: RED }}>{s.negative}%</span>
                </div>
              </div>
            ))}
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
            <Section title="Top Influencers (Brand24)" color={AMBER}>
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
      {view === "demographics" && hasB24 && b24.demographics && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {b24.demographics.sex && (
            <Section title="Gender" color={PINK}>
              {Object.entries(b24.demographics.sex).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: WHITE, width: 60, textTransform: "capitalize" }}>{k}</span>
                  <MiniBar value={v} max={Math.max(...Object.values(b24.demographics.sex))} color={k === "female" ? PINK : TEAL} />
                  <span style={{ fontSize: 11, color: WHITE, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>{v}%</span>
                </div>
              ))}
            </Section>
          )}

          {b24.demographics.ages && (
            <Section title="Age Distribution" color={PURPLE}>
              {Object.entries(typeof b24.demographics.ages === "object" && !Array.isArray(b24.demographics.ages) ? b24.demographics.ages : {}).slice(0, 6).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: DIM, width: 50 }}>{k}</span>
                  <MiniBar value={typeof v === "number" ? v : 0} max={100} color={PURPLE} />
                  <span style={{ fontSize: 10, color: WHITE, fontWeight: 600 }}>{typeof v === "number" ? `${v}%` : JSON.stringify(v).slice(0, 20)}</span>
                </div>
              ))}
            </Section>
          )}

          {b24.demographics.interests && (
            <Section title="Interests" color={AMBER}>
              {(Array.isArray(b24.demographics.interests) ? b24.demographics.interests : Object.entries(b24.demographics.interests).map(([k, v]) => ({ name: k, value: v }))).slice(0, 8).map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: DIM, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
                  {typeof item === "string" ? item : `${item.name}: ${item.value}`}
                </div>
              ))}
            </Section>
          )}

          {b24.demographics.countries && (
            <Section title="Countries" color={TEAL}>
              {(Array.isArray(b24.demographics.countries) ? b24.demographics.countries : Object.entries(b24.demographics.countries).map(([k, v]) => ({ name: k, value: v }))).slice(0, 8).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DIM, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
                  <span>{typeof item === "string" ? item : item.name}</span>
                  {typeof item !== "string" && <span style={{ color: WHITE, fontWeight: 600 }}>{item.value}</span>}
                </div>
              ))}
            </Section>
          )}
        </div>
      </>}

      {/* Footer */}
      <div style={{ fontSize: 9, color: MUTED, marginTop: 16, fontFamily: "'Inter Tight', sans-serif" }}>
        Sources: {hasB24 ? `Brand24 (${b24.period?.from} to ${b24.period?.to}) · ` : ""}
        Reddit ({legacy?.hasBrand24 ? "Brand24 live" : `${legacy?.redditPosts || 0} posts, ${legacy?.redditComments || 0} comments`}) ·
        YouTube ({legacy?.youtubeComments || 0} API comments{hasB24 ? " + Brand24" : ""})
        {legacy?.hasBrand24 && legacy.brand24Platforms?.length > 0 && ` · Also tracking: ${legacy.brand24Platforms.join(", ")}`}
        {hasB24 && b24.fetchedAt && ` · Brand24: ${new Date(b24.fetchedAt).toLocaleString("en-GB")}`}
        {legacy?.fetchedAt && ` · Data: ${new Date(legacy.fetchedAt).toLocaleString("en-GB")}`}
      </div>
    </div>
  );
}
