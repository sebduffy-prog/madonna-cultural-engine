import React, { useEffect, useRef, useState, useMemo } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const TEAL = "#2DD4BF";
const PURPLE = "#A78BFA";
const CORAL = "#FB923C";
const PINK = "#F472B6";
const GREEN = "#34D399";
const AMBER = "#F59E0B";
const RED = "#EF4444";

const THEMES = [
  {
    id: "nostalgia",
    label: "Nostalgia & Memory",
    color: PURPLE,
    keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "old", "back in the day", "years ago"],
  },
  {
    id: "musical",
    label: "Musical Appreciation",
    color: TEAL,
    keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"],
  },
  {
    id: "icon",
    label: "Icon & Legacy",
    color: Y,
    keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"],
  },
  {
    id: "emotional",
    label: "Emotional Connection",
    color: PINK,
    keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"],
  },
  {
    id: "discovery",
    label: "Discovery & Surprise",
    color: GREEN,
    keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "wow", "omg", "wait"],
  },
  {
    id: "cultural",
    label: "Cultural Commentary",
    color: AMBER,
    keywords: ["era", "generation", "culture", "society", "fashion", "style", "trend", "relevant", "today"],
  },
  {
    id: "criticism",
    label: "Criticism & Debate",
    color: RED,
    keywords: ["overrated", "hate", "bad", "worst", "old", "surgery", "cringe", "fake"],
  },
  {
    id: "general",
    label: "General",
    color: MUTED,
    keywords: [],
  },
];

function classifyComment(content) {
  const lower = (content || "").toLowerCase();
  for (const theme of THEMES) {
    if (theme.id === "general") continue;
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) return theme.id;
    }
  }
  return "general";
}

function sampleArray(arr, n) {
  if (arr.length <= n) return arr.slice();
  const sampled = [];
  const indices = new Set();
  while (sampled.length < n) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      sampled.push(arr[idx]);
    }
  }
  return sampled;
}

export default function AudienceCommentsGraph({ comments, fullThemeCounts = {}, totalCommentCount = 0 }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [expandedThemes, setExpandedThemes] = useState(new Set());

  const classified = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return comments.map((c, i) => ({
      ...c,
      _theme: classifyComment(c.content),
      _id: `comment-${i}`,
    }));
  }, [comments]);

  const themeCounts = useMemo(() => {
    // Use server-side full counts if available (reflects all 122K+ comments)
    if (fullThemeCounts && Object.keys(fullThemeCounts).length > 0) {
      const counts = {};
      THEMES.forEach((t) => (counts[t.id] = fullThemeCounts[t.id] || 0));
      return counts;
    }
    const counts = {};
    THEMES.forEach((t) => (counts[t.id] = 0));
    classified.forEach((c) => {
      counts[c._theme] = (counts[c._theme] || 0) + 1;
    });
    return counts;
  }, [classified, fullThemeCounts]);

  const sampledByTheme = useMemo(() => {
    const grouped = {};
    THEMES.forEach((t) => (grouped[t.id] = []));
    classified.forEach((c) => {
      grouped[c._theme].push(c);
    });
    const result = {};
    const totalSample = 300;
    const total = classified.length || 1;
    THEMES.forEach((t) => {
      const proportion = Math.max(1, Math.round((grouped[t.id].length / total) * totalSample));
      result[t.id] = sampleArray(grouped[t.id], proportion);
    });
    return result;
  }, [classified]);

  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 900;
    const height = 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .style("transition", "transform 0.08s ease-out");

    const zoom = d3.zoom()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    function buildGraph() {
      g.selectAll("*").remove();

      const nodes = [];
      const links = [];

      THEMES.forEach((theme) => {
        const count = themeCounts[theme.id] || 0;
        if (count === 0) return;
        const maxCount = Math.max(...Object.values(themeCounts), 1);
        const radius = 30 + (count / maxCount) * 20;
        nodes.push({
          id: theme.id,
          type: "theme",
          label: theme.label,
          color: theme.color,
          radius,
          count,
        });

        if (expandedThemes.has(theme.id)) {
          const sampled = sampledByTheme[theme.id] || [];
          sampled.forEach((c) => {
            const nodeId = c._id;
            nodes.push({
              id: nodeId,
              type: "comment",
              data: c,
              color: theme.color,
              radius: 3 + Math.min(2, (c.content || "").length / 200),
              themeId: theme.id,
            });
            links.push({ source: theme.id, target: nodeId });
          });
        }
      });

      const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius((d) => d.radius + 2))
        .force("link", d3.forceLink(links).id((d) => d.id).distance(60).strength(0.4))
        .force("charge", d3.forceManyBody().strength((d) => (d.type === "theme" ? -100 : -2)))
        .alpha(1)
        .alphaDecay(0.02);

      simulationRef.current = simulation;

      const link = g.append("g")
        .attr("stroke", BORDER)
        .attr("stroke-opacity", 0.3)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", 0.5);

      const commentNodes = g.append("g")
        .selectAll("circle")
        .data(nodes.filter((n) => n.type === "comment"))
        .join("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.6)
        .attr("stroke", (d) => d.color)
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          setSelectedComment(d.data);
        });

      commentNodes.append("title").text((d) => (d.data.content || "").slice(0, 80));

      const themeGroup = g.append("g")
        .selectAll("g")
        .data(nodes.filter((n) => n.type === "theme"))
        .join("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          setExpandedThemes((prev) => {
            const next = new Set(prev);
            if (next.has(d.id)) {
              next.delete(d.id);
            } else {
              next.add(d.id);
            }
            return next;
          });
        });

      themeGroup.append("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.15)
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", 2);

      themeGroup.append("text")
        .text((d) => d.label)
        .attr("text-anchor", "middle")
        .attr("dy", -4)
        .attr("fill", (d) => d.color)
        .attr("font-size", 9)
        .attr("font-weight", 700)
        .attr("pointer-events", "none");

      themeGroup.append("text")
        .text((d) => d.count)
        .attr("text-anchor", "middle")
        .attr("dy", 10)
        .attr("fill", WHITE)
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("pointer-events", "none");

      const expandIndicator = themeGroup.append("text")
        .text((d) => (expandedThemes.has(d.id) ? "−" : "+"))
        .attr("text-anchor", "middle")
        .attr("dy", (d) => d.radius + 14)
        .attr("fill", MUTED)
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .attr("pointer-events", "none");

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        commentNodes
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y);

        themeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

      const drag = d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      themeGroup.call(drag);
      commentNodes.call(drag);
    }

    buildGraph();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [themeCounts, sampledByTheme, expandedThemes]);

  if (!comments || comments.length === 0) {
    return (
      <div style={{ color: MUTED, padding: 20 }}>No comments to display.</div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>
          Comment Universe
        </h2>
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>
          {(totalCommentCount || comments.length).toLocaleString()} comments across all banks
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: 600,
            background: BG,
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
          }}
        />

        {selectedComment && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 300,
              maxHeight: 560,
              overflowY: "auto",
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 16,
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                Comment Detail
              </span>
              <button
                onClick={() => setSelectedComment(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: MUTED,
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>
                {selectedComment.username || "Anonymous"}
              </span>
              {selectedComment.date && (
                <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>
                  {selectedComment.date}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.5, margin: "0 0 12px 0", wordBreak: "break-word" }}>
              {selectedComment.content}
            </p>
            {selectedComment.video_title && (
              <div style={{ fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <span style={{ fontWeight: 600 }}>Video:</span> {selectedComment.video_title}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
          padding: "12px 0",
        }}
      >
        {THEMES.map((theme) => {
          const count = themeCounts[theme.id] || 0;
          if (count === 0) return null;
          return (
            <div
              key={theme.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: theme.color + "18",
                border: `1px solid ${theme.color}33`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: theme.color,
                }}
              />
              <span style={{ fontSize: 11, color: theme.color, fontWeight: 600 }}>
                {theme.label}
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
