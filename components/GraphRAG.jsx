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

function StatBox({ label, value, color = WHITE }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Inter Tight', sans-serif" }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", gap: 12, background: CARD, border: `1px solid ${video.isViral ? AMBER + "44" : BORDER}`,
      borderLeft: video.isViral ? `3px solid ${AMBER}` : undefined,
      borderRadius: 8, padding: "12px 14px", textDecoration: "none", transition: "border-color 0.15s",
    }} onMouseOver={(e) => e.currentTarget.style.borderColor = RED}
       onMouseOut={(e) => e.currentTarget.style.borderColor = video.isViral ? AMBER + "44" : BORDER}>
      {video.thumbnail && <img src={video.thumbnail} alt="" style={{ width: 120, height: 68, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: WHITE, margin: "0 0 4px", lineHeight: 1.3 }}>
          {video.isViral && <span style={{ color: AMBER, marginRight: 6 }}>VIRAL</span>}
          {video.title}
        </h3>
        <div style={{ fontSize: 10, color: DIM, fontFamily: "'Inter Tight', sans-serif" }}>
          {video.channel} · {video.viewCount?.toLocaleString()} views · {video.likeCount?.toLocaleString()} likes · {video.commentCount?.toLocaleString()} comments
        </div>
        <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>
          {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
        </div>
      </div>
    </a>
  );
}

function CommentCard({ comment }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: WHITE }}>{comment.author}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {comment.likeCount > 0 && <span style={{ fontSize: 9, color: AMBER }}>♥ {comment.likeCount}</span>}
          {comment.isViral && <span style={{ fontSize: 8, color: AMBER, background: AMBER + "18", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>VIRAL</span>}
        </div>
      </div>
      <p style={{ fontSize: 12, color: DIM, margin: "0 0 4px", lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: comment.text?.slice(0, 300) }} />
      <div style={{ fontSize: 9, color: MUTED }}>
        on: {comment.videoTitle?.slice(0, 60)} · {comment.publishedAt ? new Date(comment.publishedAt).toLocaleDateString("en-GB") : ""}
      </div>
    </div>
  );
}

export default function GraphRAG() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("updating");

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/youtube-rag${refresh ? "?refresh=1" : ""}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: RED, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
            Graph RAG
          </h2>
          <span style={{ fontSize: 11, color: MUTED }}>YouTube intelligence</span>
        </div>
        <button onClick={() => fetchData(true)} disabled={loading} style={{
          padding: "4px 12px", fontSize: 10, fontWeight: 600,
          color: loading ? MUTED : BG, background: loading ? BORDER : RED,
          border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer",
          fontFamily: "'Inter Tight', sans-serif",
        }}>{loading ? "Scanning..." : "Scan YouTube"}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "updating", label: "New & Viral" },
          { id: "catalogue", label: "Catalogue (100K comments)" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? BG : DIM,
            background: tab === t.id ? RED : "transparent",
            border: tab === t.id ? "none" : `1px solid ${BORDER}`,
            borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "updating" && (
        <>
          {/* Stats */}
          {data && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <StatBox label="Videos Found" value={data.videosFound || 0} color={RED} />
              <StatBox label="New This Run" value={data.newVideos || 0} color={GREEN} />
              <StatBox label="Viral" value={data.viralVideos || 0} color={AMBER} />
              <StatBox label="New Comments" value={data.newComments || 0} color={TEAL} />
              <StatBox label="Total in RAG" value={data.totalComments || 0} color={PURPLE} />
              <StatBox label="Total Views" value={data.stats?.totalViews || 0} color={WHITE} />
            </div>
          )}

          {/* Viral highlights */}
          {data?.viralHighlights?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Viral Content ({">"}100K views)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.viralHighlights.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            </div>
          )}

          {/* Recent videos */}
          {data?.videos?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: RED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Recent Videos (past 7 days)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                {data.videos.slice(0, 20).map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            </div>
          )}

          {/* Latest comments pulled */}
          {data?.latestComments?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: TEAL, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                New Comments Added to RAG
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                {data.latestComments.map((c, i) => <CommentCard key={i} comment={c} />)}
              </div>
            </div>
          )}

          {!data && !loading && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px" }}>No YouTube data yet</p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Hit Scan YouTube to search for new Madonna videos and pull comments.</p>
            </div>
          )}

          {data?.fetchedAt && (
            <div style={{ fontSize: 9, color: MUTED, marginTop: 12, fontFamily: "'Inter Tight', sans-serif" }}>
              Last scan: {new Date(data.fetchedAt).toLocaleString("en-GB")} · {data.totalVideos} videos tracked · {data.totalComments?.toLocaleString()} comments in RAG
            </div>
          )}
        </>
      )}

      {tab === "catalogue" && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 16, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}>100,000+ Catalogue Comments</p>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 4px", lineHeight: 1.5 }}>
            Pre-loaded from Madonna's YouTube channel. Videos with 20M+ views, 2000+ comments sampled per video.
            This is the permanent reference dataset for Graph RAG analysis.
          </p>
          <p style={{ fontSize: 11, color: DIM, margin: "8px 0 0" }}>
            The "New & Viral" tab adds fresh comments from new and trending videos to this base dataset.
          </p>
        </div>
      )}
    </div>
  );
}
