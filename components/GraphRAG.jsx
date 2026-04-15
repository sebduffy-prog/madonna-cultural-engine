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

function StatBox({ label, value, color = WHITE }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Inter Tight', sans-serif" }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", gap: 12, background: CARD, border: `1px solid ${video.isViral ? AMBER + "44" : BORDER}`,
      borderLeft: video.isViral ? `3px solid ${AMBER}` : undefined,
      borderRadius: 8, padding: "10px 12px", textDecoration: "none", transition: "border-color 0.15s",
    }} onMouseOver={(e) => e.currentTarget.style.borderColor = RED}
       onMouseOut={(e) => e.currentTarget.style.borderColor = video.isViral ? AMBER + "44" : BORDER}>
      {video.thumbnail && <img src={video.thumbnail} alt="" style={{ width: 100, height: 56, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: WHITE, margin: "0 0 3px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {video.isViral && <span style={{ color: AMBER, marginRight: 4 }}>VIRAL</span>}
          {video.title}
        </h3>
        <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif" }}>
          {video.channel} · {video.viewCount?.toLocaleString()} views · {video.commentCount?.toLocaleString()} comments
        </div>
      </div>
    </a>
  );
}

function CommentBubble({ comment, themeColor }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderLeft: `2px solid ${themeColor || MUTED}`, borderRadius: 6, padding: "8px 10px", fontSize: 11 }}>
      <div style={{ color: DIM, lineHeight: 1.4, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: (comment.text || "").slice(0, 200) }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: MUTED }}>
        <span>{comment.author}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {comment.likeCount > 0 && <span>♥ {comment.likeCount}</span>}
          <span>{comment.videoTitle?.slice(0, 40)}</span>
        </div>
      </div>
    </div>
  );
}

export default function GraphRAG() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("updating");
  const [activeTheme, setActiveTheme] = useState(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/youtube-rag${refresh ? "?refresh=1" : ""}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const themes = data?.themes || [];
  const activeThemeDef = themes.find((t) => t.id === activeTheme);
  const activeComments = activeTheme
    ? (data?.commentsByTheme?.[activeTheme] || [])
    : (data?.latestComments?.slice(0, 20) || []);

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
          {/* Stats row */}
          {data && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <StatBox label="Videos" value={data.videosFound || 0} color={RED} />
              <StatBox label="New" value={data.newVideos || 0} color={GREEN} />
              <StatBox label="Viral" value={data.viralVideos || 0} color={AMBER} />
              <StatBox label="New Comments" value={data.newComments || 0} color={TEAL} />
              <StatBox label="Total in RAG" value={data.totalComments || 0} color={PURPLE} />
            </div>
          )}

          {/* Thematic breakdown — bar chart */}
          {themes.length > 0 && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: RED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Thematic Breakdown — New Comments
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {themes.filter((t) => t.newCount > 0 || t.totalCount > 0).map((t) => {
                  const maxCount = Math.max(...themes.map((th) => th.newCount), 1);
                  return (
                    <button key={t.id} onClick={() => setActiveTheme(activeTheme === t.id ? null : t.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
                      background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                      opacity: activeTheme && activeTheme !== t.id ? 0.4 : 1, transition: "opacity 0.15s",
                    }}>
                      <span style={{ fontSize: 10, color: t.color, width: 85, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif" }}>{t.label}</span>
                      <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(t.newCount / maxCount) * 100}%`, height: "100%", background: t.color, borderRadius: 4, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 10, color: WHITE, fontWeight: 700, width: 35, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{t.newCount}</span>
                      <span style={{ fontSize: 8, color: MUTED, width: 45, textAlign: "right" }}>({t.totalCount} total)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments for selected theme */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Left: videos */}
            <div>
              {data?.viralHighlights?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                    Viral ({">"}100K views)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.viralHighlights.map((v) => <VideoCard key={v.id} video={v} />)}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, color: RED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                Recent Videos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
                {(data?.videos || []).slice(0, 15).map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            </div>

            {/* Right: comments by theme */}
            <div>
              <div style={{ fontSize: 10, color: activeThemeDef?.color || TEAL, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>
                {activeTheme ? `${activeThemeDef?.label} Comments` : "Latest Comments"}
                <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>({activeComments.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 600, overflowY: "auto" }}>
                {activeComments.length === 0 ? (
                  <div style={{ color: MUTED, fontSize: 12, padding: 16 }}>No comments in this theme yet. Hit Scan YouTube.</div>
                ) : (
                  activeComments.map((c, i) => <CommentBubble key={i} comment={c} themeColor={activeThemeDef?.color} />)
                )}
              </div>
            </div>
          </div>

          {data?.fetchedAt && (
            <div style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
              Last scan: {new Date(data.fetchedAt).toLocaleString("en-GB")} · {data.totalVideos} videos · {data.totalComments?.toLocaleString()} comments in RAG
            </div>
          )}

          {!data && !loading && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px" }}>No YouTube data yet</p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Hit Scan YouTube to detect new and viral Madonna content.</p>
            </div>
          )}
        </>
      )}

      {tab === "catalogue" && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif", fontWeight: 700 }}>100,000+ Catalogue Comments</p>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 4px", lineHeight: 1.5 }}>
            Pre-loaded from Madonna's YouTube channel. Videos with 20M+ views, 2000+ comments sampled per video.
            This is the permanent reference dataset. The "New & Viral" tab adds fresh comments as they appear.
          </p>
        </div>
      )}
    </div>
  );
}
