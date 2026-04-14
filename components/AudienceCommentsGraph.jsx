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
const CYAN = "#22D3EE";
const LIME = "#84CC16";
const ROSE = "#FB7185";
const SKY = "#38BDF8";
const FUCHSIA = "#D946EF";
const INDIGO = "#818CF8";
const EMERALD = "#10B981";

const THEMES = [
  {
    id: "nostalgia",
    label: "Nostalgia & Memory",
    color: PURPLE,
    keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "old", "back in the day", "years ago"],
    subThemes: [
      { id: "nostalgia_childhood", label: "Childhood Memories", color: "#C4B5FD", keywords: ["childhood", "grew up", "kid", "young", "school"] },
      { id: "nostalgia_classic", label: "Classic & Timeless", color: "#8B5CF6", keywords: ["classic", "timeless", "never gets old", "forever"] },
      { id: "nostalgia_longing", label: "Longing & Missing", color: "#DDD6FE", keywords: ["miss", "memories", "remember", "nostalgia", "back in the day", "years ago"] },
    ],
  },
  {
    id: "musical",
    label: "Musical Appreciation",
    color: TEAL,
    keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"],
    subThemes: [
      { id: "musical_vocal", label: "Vocal & Voice", color: "#5EEAD4", keywords: ["voice", "sing", "vocal", "range", "note"] },
      { id: "musical_production", label: "Production & Sound", color: "#14B8A6", keywords: ["production", "beat", "melody", "sound", "mix", "bass"] },
      { id: "musical_praise", label: "Masterpiece & Genius", color: "#99F6E4", keywords: ["masterpiece", "genius", "brilliant", "incredible", "song", "music", "album"] },
      { id: "musical_dance", label: "Dance & Movement", color: "#0D9488", keywords: ["dance", "dancing", "choreograph", "moves", "groove"] },
    ],
  },
  {
    id: "icon",
    label: "Icon & Legacy",
    color: Y,
    keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"],
    subThemes: [
      { id: "icon_queen", label: "Queen & GOAT", color: "#FDE68A", keywords: ["queen", "goat", "greatest", "best"] },
      { id: "icon_legacy", label: "Legacy & Influence", color: "#FCD34D", keywords: ["legend", "pioneer", "original", "influence", "impact", "icon"] },
    ],
  },
  {
    id: "emotional",
    label: "Emotional Connection",
    color: PINK,
    keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"],
    subThemes: [
      { id: "emotional_love", label: "Love & Adoration", color: "#F9A8D4", keywords: ["love", "heart", "adore", "beautiful", "amazing", "perfect"] },
      { id: "emotional_tears", label: "Moved to Tears", color: "#EC4899", keywords: ["cry", "tears", "moved", "emotion", "feel", "soul"] },
    ],
  },
  {
    id: "discovery",
    label: "Discovery & Surprise",
    color: GREEN,
    keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "wow", "omg", "wait"],
    subThemes: [
      { id: "discovery_new", label: "First Discovery", color: "#6EE7B7", keywords: ["first time", "just found", "discovered", "never heard", "didn't know"] },
      { id: "discovery_shock", label: "Shock & Awe", color: "#059669", keywords: ["wow", "omg", "wait", "insane", "unreal", "shocked"] },
    ],
  },
  {
    id: "cultural",
    label: "Cultural Commentary",
    color: AMBER,
    keywords: ["era", "generation", "culture", "society", "fashion", "style", "trend", "relevant", "today"],
    subThemes: [
      { id: "cultural_era", label: "Era & Generation", color: "#FCD34D", keywords: ["era", "generation", "decade", "80s", "90s", "2000s"] },
      { id: "cultural_fashion", label: "Fashion & Style", color: "#D97706", keywords: ["fashion", "style", "trend", "look", "outfit", "wear"] },
      { id: "cultural_society", label: "Society & Relevance", color: "#FBBF24", keywords: ["culture", "society", "relevant", "today", "modern"] },
    ],
  },
  {
    id: "criticism",
    label: "Criticism & Debate",
    color: RED,
    keywords: ["overrated", "hate", "bad", "worst", "old", "surgery", "cringe", "fake"],
    subThemes: [
      { id: "criticism_negative", label: "Negative Opinion", color: "#FCA5A5", keywords: ["overrated", "hate", "bad", "worst", "cringe", "fake"] },
      { id: "criticism_debate", label: "Age & Appearance", color: "#DC2626", keywords: ["old", "surgery", "age", "plastic"] },
    ],
  },
  {
    id: "general",
    label: "General",
    color: MUTED,
    keywords: [],
    subThemes: [],
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

function classifySubTheme(content, themeId) {
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme || !theme.subThemes || theme.subThemes.length === 0) return null;
  const lower = (content || "").toLowerCase();
  for (const sub of theme.subThemes) {
    for (const kw of sub.keywords) {
      if (lower.includes(kw)) return sub.id;
    }
  }
  return theme.subThemes[0]?.id || null;
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
  const [expandedSubThemes, setExpandedSubThemes] = useState(new Set());

  const classified = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return comments.map((c, i) => {
      const theme = classifyComment(c.content);
      const subTheme = classifySubTheme(c.content, theme);
      return {
        ...c,
        _theme: theme,
        _subTheme: subTheme,
        _id: `comment-${i}`,
      };
    });
  }, [comments]);

  const themeCounts = useMemo(() => {
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

  const subThemeCounts = useMemo(() => {
    const counts = {};
    classified.forEach((c) => {
      if (c._subTheme) {
        counts[c._subTheme] = (counts[c._subTheme] || 0) + 1;
      }
    });
    return counts;
  }, [classified]);

  const groupedByTheme = useMemo(() => {
    const grouped = {};
    THEMES.forEach((t) => (grouped[t.id] = []));
    classified.forEach((c) => {
      grouped[c._theme].push(c);
    });
    return grouped;
  }, [classified]);

  const groupedBySubTheme = useMemo(() => {
    const grouped = {};
    classified.forEach((c) => {
      if (c._subTheme) {
        if (!grouped[c._subTheme]) grouped[c._subTheme] = [];
        grouped[c._subTheme].push(c);
      }
    });
    return grouped;
  }, [classified]);

  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 900;
    const height = 700;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .style("transition", "transform 0.08s ease-out");

    const zoom = d3.zoom()
      .scaleExtent([0.2, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Click on empty space to deselect
    svg.on("click", () => setSelectedComment(null));

    function buildGraph() {
      g.selectAll("*").remove();

      const nodes = [];
      const links = [];

      THEMES.forEach((theme) => {
        const count = themeCounts[theme.id] || 0;
        if (count === 0) return;
        const maxCount = Math.max(...Object.values(themeCounts), 1);
        const radius = 35 + (count / maxCount) * 25;
        nodes.push({
          id: theme.id,
          type: "theme",
          label: theme.label,
          color: theme.color,
          radius,
          count,
        });

        const isExpanded = expandedThemes.has(theme.id);

        if (isExpanded && theme.subThemes && theme.subThemes.length > 0) {
          // Show sub-theme nodes when macro theme is expanded
          theme.subThemes.forEach((sub) => {
            const subCount = subThemeCounts[sub.id] || 0;
            if (subCount === 0) return;
            const subRadius = 16 + Math.min(12, Math.sqrt(subCount) * 1.5);
            nodes.push({
              id: sub.id,
              type: "subtheme",
              label: sub.label,
              color: sub.color,
              parentColor: theme.color,
              radius: subRadius,
              count: subCount,
              themeId: theme.id,
            });
            links.push({ source: theme.id, target: sub.id });

            // If sub-theme is expanded, show its comments
            if (expandedSubThemes.has(sub.id)) {
              const subComments = groupedBySubTheme[sub.id] || [];
              const sampled = sampleArray(subComments, 60);
              sampled.forEach((c) => {
                nodes.push({
                  id: c._id,
                  type: "comment",
                  data: c,
                  color: sub.color,
                  radius: 3 + Math.min(2, (c.content || "").length / 200),
                  themeId: theme.id,
                  subThemeId: sub.id,
                });
                links.push({ source: sub.id, target: c._id });
              });
            }
          });
        } else if (isExpanded) {
          // For themes without sub-themes (general), show comments directly
          const themeComments = groupedByTheme[theme.id] || [];
          const sampled = sampleArray(themeComments, 80);
          sampled.forEach((c) => {
            nodes.push({
              id: c._id,
              type: "comment",
              data: c,
              color: theme.color,
              radius: 3 + Math.min(2, (c.content || "").length / 200),
              themeId: theme.id,
            });
            links.push({ source: theme.id, target: c._id });
          });
        }
      });

      const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius((d) => d.radius + 3).strength(0.8))
        .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => {
          if (d.target.type === "comment") return 40;
          if (d.target.type === "subtheme") return 80;
          return 60;
        }).strength(0.5))
        .force("charge", d3.forceManyBody().strength((d) => {
          if (d.type === "theme") return -200;
          if (d.type === "subtheme") return -60;
          return -3;
        }))
        .alpha(1)
        .alphaDecay(0.02);

      simulationRef.current = simulation;

      // Links
      const link = g.append("g")
        .attr("stroke", BORDER)
        .attr("stroke-opacity", 0.2)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", (d) => d.target.type === "subtheme" ? 1 : 0.5)
        .attr("stroke", (d) => {
          if (d.target.type === "subtheme") return d.target.parentColor || BORDER;
          return BORDER;
        })
        .attr("stroke-opacity", (d) => d.target.type === "subtheme" ? 0.3 : 0.15);

      // Comment nodes
      const commentNodes = g.append("g")
        .selectAll("circle")
        .data(nodes.filter((n) => n.type === "comment"))
        .join("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.7)
        .attr("stroke", (d) => d.color)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          setSelectedComment(d.data);
        })
        .on("mouseover", function (event, d) {
          d3.select(this).attr("r", d.radius * 2).attr("fill-opacity", 1);
        })
        .on("mouseout", function (event, d) {
          d3.select(this).attr("r", d.radius).attr("fill-opacity", 0.7);
        });

      commentNodes.append("title").text((d) => (d.data.content || "").slice(0, 120));

      // Sub-theme nodes
      const subThemeGroup = g.append("g")
        .selectAll("g")
        .data(nodes.filter((n) => n.type === "subtheme"))
        .join("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          setExpandedSubThemes((prev) => {
            const next = new Set(prev);
            if (next.has(d.id)) {
              next.delete(d.id);
            } else {
              next.add(d.id);
            }
            return next;
          });
        });

      subThemeGroup.append("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.2)
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", 1.5);

      subThemeGroup.append("text")
        .text((d) => d.label)
        .attr("text-anchor", "middle")
        .attr("dy", -3)
        .attr("fill", (d) => d.color)
        .attr("font-size", 8)
        .attr("font-weight", 600)
        .attr("pointer-events", "none");

      subThemeGroup.append("text")
        .text((d) => d.count.toLocaleString())
        .attr("text-anchor", "middle")
        .attr("dy", 9)
        .attr("fill", WHITE)
        .attr("font-size", 9)
        .attr("font-weight", 600)
        .attr("pointer-events", "none");

      subThemeGroup.append("text")
        .text((d) => (expandedSubThemes.has(d.id) ? "−" : "+"))
        .attr("text-anchor", "middle")
        .attr("dy", (d) => d.radius + 11)
        .attr("fill", MUTED)
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .attr("pointer-events", "none");

      // Macro theme nodes
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
              // Also collapse sub-themes when collapsing macro
              setExpandedSubThemes((prevSub) => {
                const nextSub = new Set(prevSub);
                const theme = THEMES.find((t) => t.id === d.id);
                if (theme && theme.subThemes) {
                  theme.subThemes.forEach((s) => nextSub.delete(s.id));
                }
                return nextSub;
              });
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
        .attr("dy", -6)
        .attr("fill", (d) => d.color)
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .attr("pointer-events", "none");

      themeGroup.append("text")
        .text((d) => d.count.toLocaleString())
        .attr("text-anchor", "middle")
        .attr("dy", 10)
        .attr("fill", WHITE)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .attr("pointer-events", "none");

      themeGroup.append("text")
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

        subThemeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
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
      subThemeGroup.call(drag);
      commentNodes.call(drag);
    }

    buildGraph();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [themeCounts, expandedThemes, expandedSubThemes, groupedByTheme, groupedBySubTheme, subThemeCounts]);

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
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px", lineHeight: 1.5 }}>
        Click a theme to reveal sub-themes. Click a sub-theme to show individual comments. Scroll to zoom, drag to pan.
      </p>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: 700,
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
              width: 320,
              maxHeight: 660,
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
                x
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
          const isExpanded = expandedThemes.has(theme.id);
          return (
            <div key={theme.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                onClick={() => {
                  setExpandedThemes((prev) => {
                    const next = new Set(prev);
                    if (next.has(theme.id)) {
                      next.delete(theme.id);
                      setExpandedSubThemes((prevSub) => {
                        const nextSub = new Set(prevSub);
                        if (theme.subThemes) theme.subThemes.forEach((s) => nextSub.delete(s.id));
                        return nextSub;
                      });
                    } else {
                      next.add(theme.id);
                    }
                    return next;
                  });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: theme.color + (isExpanded ? "30" : "18"),
                  border: `1px solid ${theme.color}${isExpanded ? "66" : "33"}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
