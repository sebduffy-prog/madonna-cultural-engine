import { useState, useEffect, useCallback } from "react";

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

const PLATFORM_COLORS = { reddit: "#FF4500", youtube: "#FF0000" };

function highlightMadonna(text) {
  if (!text) return text;
  const parts = text.split(/(madonna)/gi);
  if (parts.length === 1) return text;
  return parts.map((part, i) => part.toLowerCase() === "madonna" ? <span key={i} style={{ color: Y, fontWeight: 700 }}>{part}</span> : part);
}

function FeedItem({ item }) {
  const pc = PLATFORM_COLORS[item.platform] || MUTED;
  const sc = item.sentiment === "positive" ? GREEN : item.sentiment === "negative" ? RED : MUTED;
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
      display: "block", background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${pc}`,
      borderRadius: 8, padding: "10px 14px", textDecoration: "none", transition: "border-color 0.15s",
    }} onMouseOver={e => e.currentTarget.style.borderColor = pc} onMouseOut={e => e.currentTarget.style.borderColor = BORDER}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: BG, background: pc, padding: "1px 6px", borderRadius: 3, fontFamily: "'Inter Tight', sans-serif" }}>{item.platform}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{item.author}</span>
          {item.title && <span style={{ fontSize: 10, color: DIM }}>· {item.title.slice(0, 50)}</span>}
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
}

function MiniBar({ value, max, color }) {
  return (
    <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

export default function SocialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/social-dashboard${refresh ? "?refresh=1" : ""}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data && loading) return <div style={{ color: MUTED, padding: 40, textAlign: "center" }}>Loading social data...</div>;
  if (!data) return <div style={{ color: MUTED, padding: 40, textAlign: "center" }}>No social data available.</div>;

  const filteredFeed = (data.feed || []).filter(i => {
    if (feedFilter !== "all" && i.platform !== feedFilter) return false;
    if (themeFilter && i.theme !== themeFilter) return false;
    return true;
  });

  const maxHourly = Math.max(...(data.hourlyVolume || []).map(h => h.total), 1);
  const maxTheme = Math.max(...(data.themes || []).map(t => t.count), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: PURPLE, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>Social Listening</h2>
          <span style={{ fontSize: 11, color: MUTED }}>{data.totalItems?.toLocaleString()} items · Reddit + YouTube</span>
        </div>
        <button onClick={() => fetchData(true)} disabled={loading} style={{
          padding: "4px 12px", fontSize: 10, fontWeight: 600, color: loading ? MUTED : BG, background: loading ? BORDER : PURPLE,
          border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>{loading ? "Loading..." : "Refresh"}</button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{data.totalItems?.toLocaleString()}</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#FF4500", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Reddit</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#FF4500", fontFamily: "'Inter Tight', sans-serif" }}>{data.platforms?.reddit?.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: DIM }}>{data.redditPosts} posts · {data.redditComments} comments</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#FF0000", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>YouTube</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#FF0000", fontFamily: "'Inter Tight', sans-serif" }}>{data.platforms?.youtube?.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: DIM }}>{data.youtubeComments} comments</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: GREEN, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Positive</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{data.sentiment?.positive}%</div>
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: RED, textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>Negative</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: RED, fontFamily: "'Inter Tight', sans-serif" }}>{data.sentiment?.negative}%</div>
        </div>
      </div>

      {/* Sentiment bar */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${data.sentiment?.positive}%`, background: GREEN }} />
        <div style={{ width: `${data.sentiment?.neutral}%`, background: MUTED }} />
        <div style={{ width: `${data.sentiment?.negative}%`, background: RED }} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>

        {/* Volume by hour (last 72 hours) */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Volume by Hour (last 3 days)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 80 }}>
            {(data.hourlyVolume || []).map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 80 }}>
                <div style={{ width: "100%", height: Math.max(2, (h.total / maxHourly) * 70), borderRadius: "2px 2px 0 0", background: h.total > 0 ? PURPLE : BORDER }} title={`${h.hour}: ${h.total} items`} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: MUTED, marginTop: 4 }}>
            <span>3 days ago</span><span>now</span>
          </div>
        </div>

        {/* Sentiment by platform */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Sentiment by Platform
          </div>
          {Object.entries(data.sentimentByPlatform || {}).map(([p, s]) => (
            <div key={p} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: PLATFORM_COLORS[p] || DIM, fontWeight: 600, marginBottom: 4 }}>{p}</div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${s.positive}%`, background: GREEN }} />
                <div style={{ width: `${s.neutral}%`, background: MUTED + "44" }} />
                <div style={{ width: `${s.negative}%`, background: RED }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: DIM, marginTop: 2 }}>
                <span style={{ color: GREEN }}>{s.positive}%</span><span style={{ color: RED }}>{s.negative}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme breakdown + Word cloud row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Themes */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Themes
          </div>
          {(data.themes || []).filter(t => t.count > 0).map(t => (
            <button key={t.id} onClick={() => setThemeFilter(themeFilter === t.id ? null : t.id)} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "3px 0", background: "transparent", border: "none", cursor: "pointer",
              opacity: themeFilter && themeFilter !== t.id ? 0.3 : 1, transition: "opacity 0.15s",
            }}>
              <span style={{ fontSize: 10, color: t.color, width: 70, textAlign: "left", fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{t.label}</span>
              <MiniBar value={t.count} max={maxTheme} color={t.color} />
              <span style={{ fontSize: 10, color: WHITE, fontWeight: 700, width: 30, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Word cloud / top phrases */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Top Phrases
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(data.topBigrams || []).slice(0, 30).map((b, i) => {
              const size = Math.max(9, Math.min(18, 9 + (b.count / Math.max(data.topBigrams[0]?.count, 1)) * 12));
              const opacity = 0.4 + (b.count / Math.max(data.topBigrams[0]?.count, 1)) * 0.6;
              return (
                <span key={i} style={{ fontSize: size, color: WHITE, opacity, fontFamily: "'Inter Tight', sans-serif", padding: "1px 4px" }}>
                  {b.word}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top authors + Top posts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Top authors */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Top Authors
          </div>
          {(data.topAuthors || []).slice(0, 10).map((a, i) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
              <span style={{ fontSize: 10, color: MUTED, width: 14, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
              <span style={{ fontSize: 11, color: WHITE, flex: 1 }}>{a.name}</span>
              <span style={{ fontSize: 9, color: PLATFORM_COLORS[a.platform] || DIM }}>{a.platform}</span>
              <span style={{ fontSize: 10, color: AMBER, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{a.count}</span>
            </div>
          ))}
        </div>

        {/* Top engaged */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Highest Engagement
          </div>
          {(data.topEngaged || []).slice(0, 10).map((a, i) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: `1px solid ${BORDER}22` }}>
              <span style={{ fontSize: 10, color: MUTED, width: 14, fontFamily: "'Inter Tight', sans-serif" }}>{i + 1}</span>
              <span style={{ fontSize: 11, color: WHITE, flex: 1 }}>{a.name}</span>
              <span style={{ fontSize: 10, color: GREEN, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>▲ {a.totalScore.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily volume chart */}
      {data.dailyVolume?.length > 1 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Daily Volume (14 days)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
            {data.dailyVolume.map((d, i) => {
              const max = Math.max(...data.dailyVolume.map(x => x.total), 1);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: Math.max(2, (d.youtube / max) * 50), background: "#FF0000", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ height: Math.max(2, (d.reddit / max) * 50), background: "#FF4500" }} />
                  </div>
                  <span style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{d.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 9 }}>
            <span style={{ color: "#FF4500" }}>■ Reddit</span>
            <span style={{ color: "#FF0000" }}>■ YouTube</span>
          </div>
        </div>
      )}

      {/* Feed */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Feed {themeFilter && `· ${themeFilter}`}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "reddit", "youtube"].map(f => (
              <button key={f} onClick={() => setFeedFilter(f)} style={{
                padding: "3px 10px", fontSize: 10, fontWeight: feedFilter === f ? 700 : 400,
                color: feedFilter === f ? BG : DIM, background: feedFilter === f ? (PLATFORM_COLORS[f] || PURPLE) : "transparent",
                border: feedFilter === f ? "none" : `1px solid ${BORDER}`,
                borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
              }}>{f}</button>
            ))}
            {themeFilter && <button onClick={() => setThemeFilter(null)} style={{
              padding: "3px 10px", fontSize: 10, color: BG, background: AMBER,
              border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
            }}>Clear theme</button>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
          {filteredFeed.length === 0 ? (
            <div style={{ color: MUTED, padding: 20, textAlign: "center", fontSize: 12 }}>No items match filters.</div>
          ) : filteredFeed.map((item, i) => <FeedItem key={item.id || i} item={item} />)}
        </div>
      </div>

      <div style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
        Sources: r/Madonna ({data.redditPosts} posts, {data.redditComments} comments) · YouTube API ({data.youtubeComments} comments) · Last updated: {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString("en-GB") : "—"}
      </div>
    </div>
  );
}
