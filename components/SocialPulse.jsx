import { useState, useEffect, useCallback } from "react";
import LineChart from "./LineChart";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const GREEN = "#34D399";
const RED = "#EF4444";
const PURPLE = "#A78BFA";
const AMBER = "#F59E0B";
const TEAL = "#2DD4BF";
const PINK = "#F472B6";

const PLATFORMS = {
  reddit: { label: "Reddit", color: "#FF4500", icon: "R" },
  twitter: { label: "Twitter / X", color: WHITE, icon: "X" },
  tiktok: { label: "TikTok", color: "#00F2EA", icon: "T" },
  youtube: { label: "YouTube", color: "#FF0000", icon: "Y" },
  instagram: { label: "Instagram", color: "#E1306C", icon: "I" },
};

const PERIODS = [
  { id: "pd", label: "24h", param: "pd" },
  { id: "pw", label: "7 days", param: "pw" },
  { id: "pm", label: "30 days", param: "pm" },
];

function MetricCard({ label, value, sub, color = WHITE }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'Inter Tight', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SentimentBar({ sentiment }) {
  if (!sentiment) return null;
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ width: `${sentiment.positive}%`, background: GREEN, transition: "width 0.3s" }} />
        <div style={{ width: `${sentiment.neutral}%`, background: MUTED, transition: "width 0.3s" }} />
        <div style={{ width: `${sentiment.negative}%`, background: RED, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'Inter Tight', sans-serif" }}>
        <span style={{ color: GREEN, fontWeight: 600 }}>{sentiment.positiveCount} positive ({sentiment.positive}%)</span>
        <span style={{ color: MUTED }}>{sentiment.neutralCount} neutral</span>
        <span style={{ color: RED, fontWeight: 600 }}>{sentiment.negativeCount} negative ({sentiment.negative}%)</span>
      </div>
    </div>
  );
}

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018").replace(/&#8217;/g, "\u2019")
    .replace(/&#8211;/g, "\u2013").replace(/&#8212;/g, "\u2014")
    .replace(/&#8230;/g, "\u2026").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, (m) => { const c = parseInt(m.replace(/&#|;/g, ""), 10); return isNaN(c) ? m : String.fromCharCode(c); });
}

function highlightMadonna(text) {
  if (!text) return text;
  const parts = text.split(/(madonna)/gi);
  if (parts.length === 1) return text;
  return parts.map((part, i) => part.toLowerCase() === "madonna" ? <span key={i} style={{ color: Y, fontWeight: 700 }}>{part}</span> : part);
}

function MentionCard({ item }) {
  const platDef = PLATFORMS[item.platform] || {};
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
      display: "block", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: "12px 14px", textDecoration: "none", transition: "border-color 0.15s",
    }} onMouseOver={(e) => e.currentTarget.style.borderColor = platDef.color || Y}
       onMouseOut={(e) => e.currentTarget.style.borderColor = BORDER}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 4, flexShrink: 0,
          background: platDef.color || PURPLE, color: platDef.color === WHITE ? BG : BG,
          fontSize: 10, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif",
        }}>{platDef.icon || "?"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: WHITE, margin: 0, lineHeight: 1.4 }}>
            {highlightMadonna(decodeEntities(item.title))}
          </h3>
        </div>
        <span style={{ fontSize: 9, color: MUTED, whiteSpace: "nowrap", fontFamily: "'Inter Tight', sans-serif" }}>{item.source}</span>
      </div>
      {item.description && (
        <p style={{ fontSize: 11, color: DIM, margin: "4px 0 0 32px", lineHeight: 1.4 }}>
          {decodeEntities(item.description).slice(0, 180)}
        </p>
      )}
    </a>
  );
}

export default function SocialPulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePlatform, setActivePlatform] = useState("all");
  const [period, setPeriod] = useState("pw");

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = `/api/social?refresh=${refresh ? "1" : "0"}&period=${period}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        // If we got empty data and weren't refreshing, try a fresh fetch
        if (!refresh && (!d.platforms || d.platforms.every(p => p.items.length === 0))) {
          const res2 = await fetch(`/api/social?refresh=1&period=${period}`);
          if (res2.ok) { setData(await res2.json()); setLoading(false); return; }
        }
        setData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    setData(null);
  };

  if (loading && !data) {
    return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Scanning social platforms...</div>;
  }

  if (!data && !loading) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>No social data yet</p>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 16px" }}>Hit Search to scan all platforms for Madonna mentions.</p>
        <button onClick={() => fetchData(true)} style={{
          padding: "8px 20px", fontSize: 12, fontWeight: 600, color: BG, background: PURPLE,
          border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>Search Now</button>
      </div>
    );
  }

  if (!data) return null;

  const platforms = data.platforms || [];
  const allItems = platforms.flatMap((p) => p.items);
  const activeItems = activePlatform === "all" ? allItems : (platforms.find((p) => p.id === activePlatform)?.items || []);
  const activePlatDef = activePlatform !== "all" ? PLATFORMS[activePlatform] : null;

  // Per-platform sentiment
  const platformSentiment = {};
  const positive = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay", "masterpiece", "brilliant", "beautiful", "gorgeous", "stunning", "perfect", "obsessed"];
  const negative = ["hate", "bad", "worst", "overrated", "cringe", "fake", "surgery", "flop", "awful", "terrible", "cancelled"];
  platforms.forEach((p) => {
    let pos = 0, neg = 0, neu = 0;
    p.items.forEach((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      const hasPos = positive.some((w) => text.includes(w));
      const hasNeg = negative.some((w) => text.includes(w));
      if (hasPos && !hasNeg) pos++;
      else if (hasNeg && !hasPos) neg++;
      else neu++;
    });
    const total = Math.max(pos + neg + neu, 1);
    platformSentiment[p.id] = {
      positive: Math.round((pos / total) * 100), negative: Math.round((neg / total) * 100),
      neutral: Math.round((neu / total) * 100), positiveCount: pos, negativeCount: neg, neutralCount: neu, total: pos + neg + neu,
    };
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: PURPLE, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          Social Pulse
        </h2>
        <span style={{ fontSize: 11, color: MUTED }}>Madonna across social platforms</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 3 }}>
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => handlePeriodChange(p.param)} style={{
                padding: "4px 10px", fontSize: 10, fontWeight: period === p.param ? 700 : 400,
                color: period === p.param ? BG : DIM, background: period === p.param ? PURPLE : "transparent",
                border: period === p.param ? "none" : `1px solid ${BORDER}`,
                borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
              }}>{p.label}</button>
            ))}
          </div>
          <button onClick={() => fetchData(true)} disabled={loading} style={{
            padding: "4px 12px", fontSize: 10, fontWeight: 600,
            color: loading ? MUTED : BG, background: loading ? BORDER : PURPLE,
            border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer",
            fontFamily: "'Inter Tight', sans-serif",
          }}>{loading ? "Scanning..." : "Refresh"}</button>
        </div>
      </div>

      {/* Top metrics row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <MetricCard label="Total Mentions" value={data.metrics?.totalMentions || 0} sub={`Past ${PERIODS.find((p) => p.param === period)?.label || "week"}`} color={WHITE} />
        <MetricCard label="Positive" value={`${data.sentiment?.positive || 0}%`} sub={`${data.sentiment?.positiveCount || 0} mentions`} color={GREEN} />
        <MetricCard label="Negative" value={`${data.sentiment?.negative || 0}%`} sub={`${data.sentiment?.negativeCount || 0} mentions`} color={RED} />
        <MetricCard label="Platforms" value={platforms.filter((p) => p.items.length > 0).length} sub={`of ${platforms.length} tracked`} color={PURPLE} />
      </div>

      {/* Overall sentiment bar */}
      <div style={{ marginBottom: 16 }}>
        <SentimentBar sentiment={data.sentiment} />
      </div>

      {/* Trend line charts */}
      {data.history && data.history.length > 0 && activePlatform === "all" && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Mentions by Platform Over Time
          </div>
          <LineChart
            height={140}
            series={[
              // Total line
              { label: "Total", color: WHITE, data: data.history.slice().reverse().map(s => ({ date: s.date, value: s.totalMentions || 0 })) },
              // Per-platform lines
              ...Object.entries(PLATFORMS).map(([id, def]) => ({
                label: def.label,
                color: def.color,
                data: data.history.slice().reverse().map(s => ({ date: s.date, value: s.platformBreakdown?.[id] || 0 })),
              })),
            ]}
          />
        </div>
      )}

      {/* Hashtag tracking */}
      {data.metrics?.hashtags && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
              Hashtag & Sound Tracking
            </div>
            <span style={{ fontSize: 9, color: DIM }}>Articles found per hashtag via search</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {Object.entries(data.metrics.hashtags)
              .sort(([, a], [, b]) => b - a)
              .map(([tag, count]) => (
              <div key={tag} style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                background: count > 0 ? PURPLE + "22" : BORDER + "44",
                border: `1px solid ${count > 0 ? PURPLE + "44" : BORDER}`,
                color: count > 0 ? PURPLE : MUTED, fontFamily: "'Inter Tight', sans-serif",
              }}>
                {tag} <span style={{ color: count > 0 ? WHITE : MUTED, marginLeft: 3 }}>{count >= 10 ? "10+" : count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setActivePlatform("all")} style={{
          padding: "6px 14px", fontSize: 11, fontWeight: activePlatform === "all" ? 700 : 400,
          color: activePlatform === "all" ? BG : DIM, background: activePlatform === "all" ? PURPLE : "transparent",
          border: activePlatform === "all" ? "none" : `1px solid ${BORDER}`,
          borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>All Platforms ({allItems.length})</button>
        {platforms.map((p) => {
          const def = PLATFORMS[p.id] || {};
          return (
            <button key={p.id} onClick={() => setActivePlatform(p.id)} style={{
              padding: "6px 14px", fontSize: 11, fontWeight: activePlatform === p.id ? 700 : 400,
              color: activePlatform === p.id ? (def.color === WHITE ? BG : BG) : DIM,
              background: activePlatform === p.id ? def.color : "transparent",
              border: activePlatform === p.id ? "none" : `1px solid ${BORDER}`,
              borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
            }}>{def.icon} {def.label} ({p.items.length})</button>
          );
        })}
      </div>

      {/* Platform-specific metrics when a platform is selected */}
      {activePlatform !== "all" && activePlatDef && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6, background: activePlatDef.color,
              color: activePlatDef.color === WHITE ? BG : BG,
              fontSize: 13, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif",
            }}>{activePlatDef.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{activePlatDef.label}</span>
            <span style={{ fontSize: 11, color: MUTED }}>{activeItems.length} mentions</span>
          </div>
          <SentimentBar sentiment={platformSentiment[activePlatform]} />
          {/* Per-platform trend line */}
          {data.history && data.history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: activePlatDef.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                {activePlatDef.label} mentions over time
              </div>
              <LineChart
                height={100}
                showLegend={false}
                series={[{
                  label: activePlatDef.label,
                  color: activePlatDef.color === WHITE ? PURPLE : activePlatDef.color,
                  data: data.history.slice().reverse().map(s => ({
                    date: s.date,
                    value: s.platformBreakdown?.[activePlatform] || 0,
                  })),
                }]}
              />
            </div>
          )}
          {activePlatform === "tiktok" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: BG, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: TEAL, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Sound Usage
              </div>
              <div style={{ fontSize: 11, color: DIM }}>
                Madonna sounds trending on TikTok are tracked via search mentions.
                {activeItems.length > 0 ? ` ${activeItems.length} results found referencing Madonna content.` : " No TikTok results found this period."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {["Hung Up", "Material Girl", "Vogue", "Like a Prayer", "4 Minutes", "Frozen"].map((sound) => {
                  const count = activeItems.filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(sound.toLowerCase())).length;
                  return (
                    <div key={sound} style={{
                      padding: "3px 8px", borderRadius: 999, fontSize: 9, fontWeight: 600,
                      background: count > 0 ? TEAL + "22" : BORDER + "44",
                      border: `1px solid ${count > 0 ? TEAL + "44" : BORDER}`,
                      color: count > 0 ? TEAL : MUTED, fontFamily: "'Inter Tight', sans-serif",
                    }}>
                      {sound} {count > 0 && <span style={{ color: WHITE }}>{count}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activePlatform === "youtube" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: BG, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#FF0000", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Video Content
              </div>
              <div style={{ fontSize: 11, color: DIM }}>
                {activeItems.length} Madonna-related videos found. Covers reactions, live performances, fan edits, and official content.
              </div>
            </div>
          )}
          {activePlatform === "reddit" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: BG, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#FF4500", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Community Discussion
              </div>
              <div style={{ fontSize: 11, color: DIM }}>
                {activeItems.length} threads across r/Madonna, r/popheads, r/music and other communities.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto" }}>
        {activeItems.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: MUTED, fontSize: 13 }}>
            No mentions found on {activePlatDef?.label || "any platform"} for this period. Try a different time range or hit Refresh.
          </div>
        ) : (
          activeItems.map((item, i) => <MentionCard key={item.url || i} item={item} />)
        )}
      </div>

      {/* Hashtag coverage */}
      {activePlatform === "all" && data.metrics?.hashtagArticles?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Hashtag Coverage
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 250, overflowY: "auto" }}>
            {data.metrics.hashtagArticles.map((item, i) => <MentionCard key={item.url || i} item={{ ...item, platform: "twitter" }} />)}
          </div>
        </div>
      )}

      {data.fetchedAt && (
        <div style={{ fontSize: 9, color: MUTED, marginTop: 12, fontFamily: "'Inter Tight', sans-serif" }}>
          Last scan: {new Date(data.fetchedAt).toLocaleString("en-GB")}
        </div>
      )}
    </div>
  );
}
