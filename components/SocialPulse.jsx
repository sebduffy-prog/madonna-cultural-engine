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

const PLATFORMS = {
  reddit: { label: "Reddit", color: "#FF4500", icon: "R" },
  tiktok: { label: "TikTok", color: "#00F2EA", icon: "T" },
  youtube: { label: "YouTube", color: "#FF0000", icon: "Y" },
  instagram: { label: "Instagram", color: "#E1306C", icon: "I" },
  news: { label: "News", color: "#A78BFA", icon: "N" },
  video: { label: "Video", color: "#F59E0B", icon: "V" },
};

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
          background: platDef.color || PURPLE, color: BG,
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

function IndexDisplay({ value, label, color, isBaseline }) {
  const c = isBaseline ? MUTED : value > 0 ? GREEN : value < 0 ? RED : WHITE;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 9, color: color || MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, fontFamily: "'Inter Tight', sans-serif" }}>
        {isBaseline ? "—" : `${value > 0 ? "+" : ""}${value}%`}
      </div>
    </div>
  );
}

export default function SocialPulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePlatform, setActivePlatform] = useState("all");

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social${refresh ? "?refresh=1" : ""}`);
      if (res.ok) {
        const d = await res.json();
        if (!refresh && (!d.platforms || d.platforms.length === 0 || d.totalSources === 0)) {
          const res2 = await fetch("/api/social?refresh=1");
          if (res2.ok) { setData(await res2.json()); setLoading(false); return; }
        }
        setData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return <div style={{ color: MUTED, padding: 40, textAlign: "center", fontFamily: "'Inter Tight', sans-serif" }}>Scanning social platforms...</div>;
  }

  if (!data && !loading) {
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>No social data yet</p>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 16px" }}>Hit Search to scan all platforms.</p>
        <button onClick={() => fetchData(true)} style={{
          padding: "8px 20px", fontSize: 12, fontWeight: 600, color: BG, background: PURPLE,
          border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>Search Now</button>
      </div>
    );
  }

  if (!data) return null;

  const platforms = data.platforms || [];
  const isBaseline = data.isFirstRun;
  const allItems = activePlatform === "all"
    ? (data.items || [])
    : (platforms.find((p) => p.id === activePlatform)?.items || []);
  const activePlatDef = activePlatform !== "all" ? PLATFORMS[activePlatform] : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: PURPLE, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          Social Pulse
        </h2>
        <span style={{ fontSize: 11, color: MUTED }}>Trend index vs {data?.baselineDate ? new Date(data.baselineDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "14 Apr"} baseline</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif" }}>
            {data.feedSize || 0} in feed{data.newItems > 0 ? ` · ${data.newItems} new` : ""} · {data.history?.length || 0} days
          </span>
          <button onClick={() => fetchData(true)} disabled={loading} style={{
            padding: "4px 12px", fontSize: 10, fontWeight: 600,
            color: loading ? MUTED : BG, background: loading ? BORDER : PURPLE,
            border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer",
            fontFamily: "'Inter Tight', sans-serif",
          }}>{loading ? "Scanning..." : "Search"}</button>
        </div>
      </div>

      {/* Storage warning */}
      {data.storageWarning && (
        <div style={{ background: "#F59E0B11", border: "1px solid #F59E0B44", borderRadius: 6, padding: "8px 14px", marginBottom: 14, fontSize: 11, color: "#F59E0B", fontFamily: "'Inter Tight', sans-serif" }}>
          {data.storageWarning}
        </div>
      )}

      {/* Overall index + per-platform indices */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <IndexDisplay value={data.index || 0} label="Overall Index" color={Y} isBaseline={isBaseline} />
        {platforms.map((p) => (
          <IndexDisplay key={p.id} value={p.avgChange || 0} label={p.label} color={PLATFORMS[p.id]?.color} isBaseline={isBaseline} />
        ))}
      </div>

      {/* Sentiment bar — percentages only */}
      {data.sentiment && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${data.sentiment.positive}%`, background: GREEN, transition: "width 0.3s" }} />
            <div style={{ width: `${data.sentiment.neutral}%`, background: MUTED, transition: "width 0.3s" }} />
            <div style={{ width: `${data.sentiment.negative}%`, background: RED, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'Inter Tight', sans-serif" }}>
            <span style={{ color: GREEN, fontWeight: 600 }}>{data.sentiment.positive}% positive</span>
            <span style={{ color: MUTED }}>{data.sentiment.neutral}% neutral</span>
            <span style={{ color: RED, fontWeight: 600 }}>{data.sentiment.negative}% negative</span>
          </div>
          {data.sentiment.method?.includes(":") && (
            <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 4, fontStyle: "italic" }}>
              {data.sentiment.method.split(": ").slice(1).join(": ")}
            </div>
          )}
        </div>
      )}

      {/* Trend chart — % change over time */}
      {data.history && data.history.length > 1 && activePlatform === "all" && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
            Trend Index Over Time
          </div>
          <LineChart
            height={140}
            series={[
              { label: "Index", color: WHITE, data: data.history.slice().reverse().map(s => ({ date: s.date, value: s.index || 0 })) },
              ...Object.entries(PLATFORMS).map(([id, def]) => ({
                label: def.label,
                color: def.color,
                data: data.history.slice().reverse().map(s => ({ date: s.date, value: s.platforms?.[id]?.change || 0 })),
              })),
            ]}
          />
        </div>
      )}

      {/* Platform filter tabs — no volume counts */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setActivePlatform("all")} style={{
          padding: "6px 14px", fontSize: 11, fontWeight: activePlatform === "all" ? 700 : 400,
          color: activePlatform === "all" ? BG : DIM, background: activePlatform === "all" ? PURPLE : "transparent",
          border: activePlatform === "all" ? "none" : `1px solid ${BORDER}`,
          borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>All Platforms</button>
        {platforms.map((p) => {
          const def = PLATFORMS[p.id] || {};
          const change = p.avgChange || 0;
          return (
            <button key={p.id} onClick={() => setActivePlatform(p.id)} style={{
              padding: "6px 14px", fontSize: 11, fontWeight: activePlatform === p.id ? 700 : 400,
              color: activePlatform === p.id ? BG : DIM,
              background: activePlatform === p.id ? def.color : "transparent",
              border: activePlatform === p.id ? "none" : `1px solid ${BORDER}`,
              borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
            }}>{def.icon} {def.label} {!isBaseline && change !== 0 ? `${change > 0 ? "+" : ""}${change}%` : ""}</button>
          );
        })}
      </div>

      {/* Feed — actual Madonna posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto" }}>
        {allItems.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: MUTED, fontSize: 13 }}>
            No mentions found on {activePlatDef?.label || "any platform"}. Hit Refresh to scan.
          </div>
        ) : (
          allItems.map((item, i) => <MentionCard key={item.url || i} item={item} />)
        )}
      </div>

      {data.fetchedAt && (
        <div style={{ fontSize: 9, color: MUTED, marginTop: 12, fontFamily: "'Inter Tight', sans-serif" }}>
          Last scan: {new Date(data.fetchedAt).toLocaleString("en-GB")} · Baseline: {data.baselineDate ? new Date(data.baselineDate).toLocaleString("en-GB") : "14 Apr 2026"}
        </div>
      )}
    </div>
  );
}
