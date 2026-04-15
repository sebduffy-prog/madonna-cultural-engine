import { useState } from "react";
import dynamic from "next/dynamic";
import GraphRAG from "./GraphRAG";

const AudienceCommentsGraph = dynamic(() => import("./AudienceCommentsGraph"), { ssr: false });

const Y = "#FFD500";
const BG = "#0C0C0C";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const RED = "#EF4444";
const PURPLE = "#A78BFA";

export default function YouTubeIntelligence({ comments, fullThemeCounts, totalCommentCount }) {
  const [tab, setTab] = useState("catalogue");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: RED, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          YouTube Intelligence
        </h2>
        <span style={{ fontSize: 11, color: MUTED }}>
          {tab === "catalogue" ? `${(totalCommentCount || 0).toLocaleString()} catalogue comments` : "New & viral content"}
        </span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button onClick={() => setTab("catalogue")} style={{
          padding: "8px 16px", fontSize: 12, fontWeight: tab === "catalogue" ? 700 : 400,
          color: tab === "catalogue" ? BG : DIM,
          background: tab === "catalogue" ? PURPLE : "transparent",
          border: tab === "catalogue" ? "none" : `1px solid ${BORDER}`,
          borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>Catalogue</button>
        <button onClick={() => setTab("new")} style={{
          padding: "8px 16px", fontSize: 12, fontWeight: tab === "new" ? 700 : 400,
          color: tab === "new" ? BG : DIM,
          background: tab === "new" ? RED : "transparent",
          border: tab === "new" ? "none" : `1px solid ${BORDER}`,
          borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>New & Viral</button>
      </div>

      {/* Catalogue = existing bubble chart */}
      {tab === "catalogue" && (
        <AudienceCommentsGraph comments={comments} fullThemeCounts={fullThemeCounts} totalCommentCount={totalCommentCount} />
      )}

      {/* New & Viral = Graph RAG scanner */}
      {tab === "new" && (
        <GraphRAG />
      )}
    </div>
  );
}
