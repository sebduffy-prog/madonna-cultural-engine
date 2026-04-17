import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import GraphRAG from "./GraphRAG";

const AudienceCommentsGraph = dynamic(() => import("./AudienceCommentsGraph"), { ssr: false });

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const RED = "#EF4444";
const GREEN = "#34D399";
const PURPLE = "#A78BFA";
const AMBER = "#F59E0B";
const TEAL = "#2DD4BF";

// Theme definitions matching the catalogue universe
const LIVE_THEMES = [
  { id: "nostalgia", label: "Nostalgia & Memory", color: PURPLE,
    keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "back in the day", "years ago"] },
  { id: "musical", label: "Musical Appreciation", color: TEAL,
    keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"] },
  { id: "icon", label: "Icon & Legacy", color: Y,
    keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"] },
  { id: "emotional", label: "Emotional Connection", color: "#F472B6",
    keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"] },
  { id: "empowerment", label: "Feminism & Empowerment", color: "#A78BFA",
    keywords: ["feminist", "empowered", "strong", "powerful", "independent", "trailblazer", "barrier"] },
  { id: "sexuality", label: "Sexuality & Provocation", color: RED,
    keywords: ["sexy", "provocative", "controversial", "bold", "daring", "scandalous", "erotica"] },
  { id: "discovery", label: "Discovery & Surprise", color: GREEN,
    keywords: ["first time", "just found", "discovered", "never heard", "wow", "omg"] },
  { id: "humour", label: "Humour & Playfulness", color: "#06B6D4",
    keywords: ["lol", "lmao", "haha", "funny", "hilarious", "slay", "ate", "serve", "camp"] },
  { id: "cultural", label: "Cultural Commentary", color: AMBER,
    keywords: ["era", "generation", "culture", "fashion", "style", "trend", "relevant"] },
  { id: "criticism", label: "Criticism & Debate", color: "#6B7280",
    keywords: ["overrated", "hate", "bad", "worst", "surgery", "cringe", "fake"] },
];

function classifyLiveComment(text) {
  const lower = (text || "").toLowerCase();
  for (const theme of LIVE_THEMES) {
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) return theme.id;
    }
  }
  return "general";
}

export default function YouTubeIntelligence({ comments, fullThemeCounts, totalCommentCount }) {
  const [tab, setTab] = useState("universe");
  const [liveData, setLiveData] = useState(null);
  const [liveComments, setLiveComments] = useState([]);
  const [liveThemeCounts, setLiveThemeCounts] = useState({});
  const [liveTotalCount, setLiveTotalCount] = useState(0);

  // Load live data for the "New & Live" universe
  const loadLiveData = useCallback(async () => {
    try {
      const r = await fetch("/api/youtube-rag");
      if (!r.ok) return;
      const data = await r.json();
      setLiveData(data);

      // Transform YouTube RAG comments into the format AudienceCommentsGraph expects
      // Always reclassify with local keywords — AI themes from RAG use different IDs
      const allComments = (data.latestComments || []).map((c) => {
        const cleanText = (c.text || "").replace(/<[^>]+>/g, "");
        return {
          username: c.author || "",
          date: c.publishedAt || "",
          content: cleanText,
          video_title: c.videoTitle || "",
          _theme: classifyLiveComment(cleanText),
        };
      });

      // Build theme counts
      const counts = {};
      LIVE_THEMES.forEach((t) => { counts[t.id] = 0; });
      counts.general = 0;
      allComments.forEach((c) => {
        const theme = c._theme || "general";
        counts[theme] = (counts[theme] || 0) + 1;
      });

      setLiveComments(allComments);
      setLiveThemeCounts(counts);
      setLiveTotalCount(data.totalComments || allComments.length);
    } catch {}
  }, []);

  useEffect(() => { loadLiveData(); }, [loadLiveData]);

  const tabs = [
    { id: "universe", label: "Universe", color: PURPLE },
    { id: "newviral", label: "New & Viral", color: RED },
    { id: "newlive", label: "New & Live Graph", color: GREEN },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: RED, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          YouTube Intelligence
        </h2>
        <span style={{ fontSize: 11, color: WHITE, opacity: 0.8 }}>
          {tab === "universe" ? `${(totalCommentCount || 0).toLocaleString()} catalogue comments`
            : tab === "newlive" ? `${liveTotalCount.toLocaleString()} new comments in graph`
            : "New & viral content"}
        </span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", fontSize: 12, fontWeight: tab === t.id ? 700 : 600,
            color: tab === t.id ? BG : WHITE,
            background: tab === t.id ? t.color : "transparent",
            border: tab === t.id ? "none" : `1px solid rgba(237,237,232,0.55)`,
            borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Universe = existing 109K catalogue bubble chart */}
      {tab === "universe" && (
        <AudienceCommentsGraph comments={comments} fullThemeCounts={fullThemeCounts} totalCommentCount={totalCommentCount} />
      )}

      {/* New & Viral = feed/card view with search + themes */}
      {tab === "newviral" && (
        <GraphRAG />
      )}

      {/* New & Live Graph = same bubble chart format but with NEW comments */}
      {tab === "newlive" && (
        <>
          {liveComments.length > 0 ? (
            <AudienceCommentsGraph
              comments={liveComments}
              fullThemeCounts={liveThemeCounts}
              totalCommentCount={liveTotalCount}
            />
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
              <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>No new comments in the graph yet</p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Go to New & Viral tab and hit Search to pull comments from recent Madonna videos. They'll appear here as a live Comment Universe.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
