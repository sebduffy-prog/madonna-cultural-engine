import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";

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
    subThemes: [
      { id: "nostalgia_childhood", label: "Childhood", color: "#C4B5FD", keywords: ["childhood", "grew up", "kid", "young", "school", "parent", "mom", "dad", "family"] },
      { id: "nostalgia_classic", label: "Timeless Classic", color: "#8B5CF6", keywords: ["classic", "timeless", "never gets old", "forever", "always", "eternal", "endure"] },
      { id: "nostalgia_longing", label: "Longing", color: "#DDD6FE", keywords: ["miss", "memories", "remember", "nostalgia", "back in the day", "years ago", "wish", "those days"] },
      { id: "nostalgia_era", label: "Past Era", color: "#7C3AED", keywords: ["80s", "90s", "70s", "disco", "retro", "vintage", "throwback", "old school"] },
      { id: "nostalgia_personal", label: "Personal Story", color: "#6D28D9", keywords: ["my life", "saved me", "got me through", "helped me", "part of my", "my story", "when i was"] },
    ],
  },
  {
    id: "musical",
    label: "Musical Appreciation",
    color: TEAL,
    keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"],
    subThemes: [
      { id: "musical_vocal", label: "Vocal Power", color: "#5EEAD4", keywords: ["voice", "sing", "vocal", "range", "note", "pitch", "tone", "singing"] },
      { id: "musical_production", label: "Production", color: "#14B8A6", keywords: ["production", "beat", "melody", "sound", "mix", "bass", "synth", "instrumental", "producer"] },
      { id: "musical_praise", label: "Masterpiece", color: "#99F6E4", keywords: ["masterpiece", "genius", "brilliant", "album", "track", "banger", "slaps"] },
      { id: "musical_dance", label: "Dance & Club", color: "#0D9488", keywords: ["dance", "dancing", "choreograph", "moves", "groove", "rhythm", "club", "dancefloor"] },
      { id: "musical_live", label: "Live & Concert", color: "#2DD4BF", keywords: ["concert", "live", "tour", "stage", "perform", "show", "gig", "audience", "crowd"] },
      { id: "musical_specific", label: "Specific Songs", color: "#0F766E", keywords: ["like a prayer", "vogue", "hung up", "ray of light", "material girl", "papa don't preach", "like a virgin", "frozen", "music", "holiday", "express yourself", "la isla bonita", "into the groove", "erotica", "justify my love", "bedtime story"] },
    ],
  },
  {
    id: "icon",
    label: "Icon & Legacy",
    color: Y,
    keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"],
    subThemes: [
      { id: "icon_queen", label: "Queen & GOAT", color: "#FDE68A", keywords: ["queen", "goat", "greatest", "best", "number one", "#1", "unmatched", "unrivalled"] },
      { id: "icon_legacy", label: "Legacy & Influence", color: "#FCD34D", keywords: ["legend", "pioneer", "original", "influence", "impact", "icon", "legacy", "history", "paved the way", "opened doors"] },
      { id: "icon_comparison", label: "Artist Comparisons", color: "#F59E0B", keywords: ["better than", "beyonce", "gaga", "rihanna", "janet", "britney", "cher", "comparison", "vs", "taylor", "dua lipa", "chappell"] },
      { id: "icon_respect", label: "Respect & Tribute", color: "#D97706", keywords: ["respect", "tribute", "honour", "honor", "salute", "bow down", "deserve", "credit", "recognition"] },
    ],
  },
  {
    id: "emotional",
    label: "Emotional Connection",
    color: PINK,
    keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"],
    subThemes: [
      { id: "emotional_love", label: "Love & Adoration", color: "#F9A8D4", keywords: ["love", "heart", "adore", "beautiful", "amazing", "perfect", "wonderful", "obsessed", "stan"] },
      { id: "emotional_tears", label: "Moved to Tears", color: "#EC4899", keywords: ["cry", "tears", "moved", "emotion", "emotional", "sobbing", "weep", "crying"] },
      { id: "emotional_spiritual", label: "Soul & Spirit", color: "#BE185D", keywords: ["feel", "soul", "spiritual", "deep", "powerful", "chills", "goosebumps", "transcend"] },
      { id: "emotional_healing", label: "Healing & Comfort", color: "#DB2777", keywords: ["healing", "comfort", "safe", "strength", "courage", "hope", "inspire", "uplift", "therapy"] },
    ],
  },
  {
    id: "empowerment",
    label: "Feminism & Empowerment",
    color: "#E879F9",
    keywords: ["feminist", "feminism", "empowered", "strong woman", "powerful woman", "independent", "boss", "trailblazer", "barrier", "broke the mold"],
    subThemes: [
      { id: "empowerment_feminist", label: "Feminist Icon", color: "#F0ABFC", keywords: ["feminist", "feminism", "women's rights", "equality", "fight for", "strong woman", "powerful woman"] },
      { id: "empowerment_independence", label: "Independence", color: "#D946EF", keywords: ["independent", "boss", "own terms", "control", "her own", "nobody tells", "didn't need", "self made"] },
      { id: "empowerment_barrier", label: "Breaking Barriers", color: "#C026D3", keywords: ["trailblazer", "barrier", "broke the mold", "first woman", "no one before", "changed the game", "rules", "taboo", "boundary", "controversial"] },
    ],
  },
  {
    id: "sexuality",
    label: "Sexuality & Provocation",
    color: "#F43F5E",
    keywords: ["sexy", "sex", "provocative", "controversial", "bold", "daring", "scandalous", "shock", "erotica", "book", "naked"],
    subThemes: [
      { id: "sexuality_bold", label: "Bold & Daring", color: "#FDA4AF", keywords: ["bold", "daring", "provocative", "controversial", "scandalous", "shock", "fearless", "unapologetic"] },
      { id: "sexuality_liberation", label: "Sexual Liberation", color: "#FB7185", keywords: ["sexy", "sex", "erotica", "justify my love", "liberation", "freedom", "express", "naked", "body"] },
      { id: "sexuality_queer", label: "Queer Culture", color: "#E11D48", keywords: ["gay", "queer", "lgbtq", "pride", "drag", "ballroom", "vogue", "community", "ally", "trans"] },
    ],
  },
  {
    id: "discovery",
    label: "Discovery & Surprise",
    color: GREEN,
    keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "wow", "omg", "wait"],
    subThemes: [
      { id: "discovery_new", label: "First Discovery", color: "#6EE7B7", keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "new to", "just started"] },
      { id: "discovery_shock", label: "Shock & Awe", color: "#059669", keywords: ["wow", "omg", "wait", "insane", "unreal", "shocked", "mindblown", "can't believe", "what"] },
      { id: "discovery_recommend", label: "Sharing & Recommending", color: "#34D399", keywords: ["recommend", "share", "check out", "listen to", "watch this", "you need", "everyone should", "go listen"] },
      { id: "discovery_genz", label: "Gen Z Discovery", color: "#10B981", keywords: ["gen z", "tiktok", "zoomer", "my generation", "born in", "young people", "just learned", "algorithm"] },
    ],
  },
  {
    id: "humour",
    label: "Humour & Playfulness",
    color: "#06B6D4",
    keywords: ["lol", "lmao", "haha", "funny", "hilarious", "dead", "joke", "slay", "ate", "serve", "camp", "iconic moment"],
    subThemes: [
      { id: "humour_slang", label: "Stan Slang", color: "#67E8F9", keywords: ["slay", "ate", "serve", "mother", "camp", "iconic", "period", "era", "understood the assignment", "main character"] },
      { id: "humour_funny", label: "Comedy", color: "#22D3EE", keywords: ["lol", "lmao", "haha", "funny", "hilarious", "dead", "joke", "rofl", "screaming", "dying"] },
      { id: "humour_meme", label: "Memes & References", color: "#0891B2", keywords: ["meme", "reference", "quote", "parody", "remix", "compilation", "reaction", "gif"] },
    ],
  },
  {
    id: "cultural",
    label: "Cultural Commentary",
    color: AMBER,
    keywords: ["era", "generation", "culture", "society", "fashion", "style", "trend", "relevant", "today"],
    subThemes: [
      { id: "cultural_era", label: "Era & Decade", color: "#FCD34D", keywords: ["era", "decade", "80s", "90s", "2000s", "period", "time", "century"] },
      { id: "cultural_fashion", label: "Fashion & Style", color: "#D97706", keywords: ["fashion", "style", "look", "outfit", "wear", "costume", "dress", "designer", "aesthetic"] },
      { id: "cultural_society", label: "Society & Identity", color: "#FBBF24", keywords: ["culture", "society", "relevant", "today", "modern", "generation", "identity", "representation"] },
      { id: "cultural_influence", label: "Pop Culture Impact", color: "#F59E0B", keywords: ["trend", "viral", "tiktok", "meme", "pop culture", "mainstream", "popular", "influence"] },
      { id: "cultural_religion", label: "Religion & Spirituality", color: "#B45309", keywords: ["religion", "catholic", "christian", "prayer", "god", "church", "spiritual", "kabbalah", "blasphemy", "cross"] },
    ],
  },
  {
    id: "criticism",
    label: "Criticism & Debate",
    color: RED,
    keywords: ["overrated", "hate", "bad", "worst", "old", "surgery", "cringe", "fake"],
    subThemes: [
      { id: "criticism_negative", label: "Negative Opinion", color: "#FCA5A5", keywords: ["overrated", "hate", "bad", "worst", "cringe", "fake", "terrible", "awful", "trash", "flop"] },
      { id: "criticism_appearance", label: "Appearance & Age", color: "#DC2626", keywords: ["surgery", "age", "plastic", "face", "botox", "look old", "aging", "filler", "work done"] },
      { id: "criticism_debate", label: "Debate & Defense", color: "#F87171", keywords: ["disagree", "wrong", "actually", "opinion", "argue", "fight", "defend", "unfair", "ageism", "misogyny"] },
      { id: "criticism_relevance", label: "Relevance Debate", color: "#B91C1C", keywords: ["relevant", "irrelevant", "past", "over", "done", "washed", "retired", "move on", "let it go"] },
    ],
  },
  {
    id: "general",
    label: "General",
    color: MUTED,
    keywords: [],
    subThemes: [
      { id: "general_short", label: "Short Reactions", color: "#9CA3AF", keywords: [] },
    ],
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
  if (!theme || !theme.subThemes || theme.subThemes.length === 0) return theme?.subThemes?.[0]?.id || null;
  const lower = (content || "").toLowerCase();
  for (const sub of theme.subThemes) {
    if (sub.keywords.length === 0) continue;
    for (const kw of sub.keywords) {
      if (lower.includes(kw)) return sub.id;
    }
  }
  return theme.subThemes[0].id;
}

// Detect likely non-English text by checking ratio of non-ASCII characters
function isLikelyNonEnglish(text) {
  if (!text || text.length < 5) return false;
  const stripped = text.replace(/[^a-zA-Z]/g, "");
  if (stripped.length === 0) return true;
  // If less than 40% of letters are ASCII Latin, likely non-English
  const totalLetters = text.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u3000-\u9FFF\uAC00-\uD7AF]/g, "").length;
  if (totalLetters === 0) return false;
  return stripped.length / totalLetters < 0.4;
}

function translateUrl(text) {
  return `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}`;
}

function sampleArray(arr, n) {
  if (arr.length <= n) return arr.slice();
  const copy = arr.slice();
  // Fisher-Yates shuffle for better randomness
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function AudienceCommentsGraph({ comments, fullThemeCounts = {}, totalCommentCount = 0 }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [expandedThemes, setExpandedThemes] = useState(new Set());
  const [expandedSubThemes, setExpandedSubThemes] = useState(new Set());
  const [focusTarget, setFocusTarget] = useState(null); // id of last-clicked theme/subtheme to pan to

  const classified = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return comments.map((c, i) => {
      const theme = classifyComment(c.content);
      const subTheme = classifySubTheme(c.content, theme);
      return { ...c, _theme: theme, _subTheme: subTheme, _id: `c-${i}` };
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
    classified.forEach((c) => { counts[c._theme] = (counts[c._theme] || 0) + 1; });
    return counts;
  }, [classified, fullThemeCounts]);

  const subThemeCounts = useMemo(() => {
    const counts = {};
    classified.forEach((c) => { if (c._subTheme) counts[c._subTheme] = (counts[c._subTheme] || 0) + 1; });
    return counts;
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

  const groupedByTheme = useMemo(() => {
    const grouped = {};
    THEMES.forEach((t) => (grouped[t.id] = []));
    classified.forEach((c) => { grouped[c._theme].push(c); });
    return grouped;
  }, [classified]);

  const toggleTheme = useCallback((id) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        const theme = THEMES.find((t) => t.id === id);
        if (theme?.subThemes) {
          setExpandedSubThemes((ps) => {
            const ns = new Set(ps);
            theme.subThemes.forEach((s) => ns.delete(s.id));
            return ns;
          });
        }
        setFocusTarget(null);
      } else {
        next.add(id);
        setFocusTarget(id);
      }
      return next;
    });
  }, []);

  const toggleSubTheme = useCallback((id) => {
    setExpandedSubThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setFocusTarget(null);
      } else {
        next.add(id);
        setFocusTarget(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const d3 = window.d3;
    if (!d3 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 900;
    const height = 700;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");

    // Smooth zoom with interpolation
    const zoom = d3.zoom()
      .scaleExtent([0.15, 12])
      .filter((event) => {
        // Allow all zoom events but prevent text selection during drag
        return !event.ctrlKey || event.type === "wheel";
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
      .on("dblclick.zoom", null); // disable double-click zoom

    // Smooth zoom on double click (custom)
    svg.on("dblclick", (event) => {
      event.preventDefault();
      const [x, y] = d3.pointer(event);
      svg.transition().duration(400).ease(d3.easeCubicOut)
        .call(zoom.scaleBy, 2, [x, y]);
    });

    // Right-click to zoom out
    svg.on("contextmenu", (event) => {
      event.preventDefault();
      const [x, y] = d3.pointer(event);
      svg.transition().duration(400).ease(d3.easeCubicOut)
        .call(zoom.scaleBy, 0.5, [x, y]);
    });

    // Click empty space to deselect
    svg.on("click", (event) => {
      if (event.target === svgRef.current) setSelectedComment(null);
    });

    function buildGraph() {
      g.selectAll("*").remove();
      const nodes = [];
      const links = [];

      // Build theme index for positioning children near parents
      const themeIndex = {};
      let ti = 0;
      const activeThemes = THEMES.filter((t) => (themeCounts[t.id] || 0) > 0);
      const angleStep = (2 * Math.PI) / Math.max(activeThemes.length, 1);

      activeThemes.forEach((theme) => {
        const count = themeCounts[theme.id] || 0;
        const maxCount = Math.max(...Object.values(themeCounts), 1);
        const radius = 38 + (count / maxCount) * 28;
        // Place themes in a circle so they start stable
        const angle = ti * angleStep;
        const cx = width / 2 + Math.cos(angle) * 220;
        const cy = height / 2 + Math.sin(angle) * 220;
        themeIndex[theme.id] = { x: cx, y: cy };
        nodes.push({ id: theme.id, type: "theme", label: theme.label, color: theme.color, radius, count, x: cx, y: cy });
        ti++;

        const isExpanded = expandedThemes.has(theme.id);
        if (!isExpanded) return;

        if (theme.subThemes && theme.subThemes.length > 0) {
          const subStep = (2 * Math.PI) / Math.max(theme.subThemes.length, 1);
          theme.subThemes.forEach((sub, si) => {
            const subCount = subThemeCounts[sub.id] || 0;
            if (subCount === 0) return;
            const subRadius = 18 + Math.min(14, Math.sqrt(subCount) * 1.8);
            // Position sub-themes near parent
            const sa = si * subStep;
            const sx = cx + Math.cos(sa) * 65;
            const sy = cy + Math.sin(sa) * 65;
            nodes.push({ id: sub.id, type: "subtheme", label: sub.label, color: sub.color, parentColor: theme.color, radius: subRadius, count: subCount, themeId: theme.id, x: sx, y: sy });
            links.push({ source: theme.id, target: sub.id });

            if (expandedSubThemes.has(sub.id)) {
              const subComments = groupedBySubTheme[sub.id] || [];
              const sampled = sampleArray(subComments, 250);
              sampled.forEach((c, ci) => {
                // Scatter comments in a small cluster near sub-theme
                const ca = (ci / sampled.length) * 2 * Math.PI;
                const cr = 15 + Math.random() * 25;
                nodes.push({ id: c._id, type: "comment", data: c, color: sub.color, radius: 3.5 + Math.min(2.5, (c.content || "").length / 150), themeId: theme.id, subThemeId: sub.id, x: sx + Math.cos(ca) * cr, y: sy + Math.sin(ca) * cr });
                links.push({ source: sub.id, target: c._id });
              });
            }
          });
        } else {
          const themeComments = groupedByTheme[theme.id] || [];
          const sampled = sampleArray(themeComments, 250);
          sampled.forEach((c, ci) => {
            const ca = (ci / sampled.length) * 2 * Math.PI;
            const cr = 15 + Math.random() * 25;
            nodes.push({ id: c._id, type: "comment", data: c, color: theme.color, radius: 3.5, themeId: theme.id, x: cx + Math.cos(ca) * cr, y: cy + Math.sin(ca) * cr });
            links.push({ source: theme.id, target: c._id });
          });
        }
      });

      const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.02))
        .force("collide", d3.forceCollide().radius((d) => d.radius + 1).strength(0.4).iterations(3))
        .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => {
          if (d.target.type === "comment") return 15;
          if (d.target.type === "subtheme") return 50;
          return 60;
        }).strength((d) => {
          if (d.target.type === "comment") return 0.9;
          return 0.5;
        }))
        .force("charge", d3.forceManyBody().strength((d) => {
          if (d.type === "theme") return -100;
          if (d.type === "subtheme") return -20;
          return -0.5;
        }))
        .alpha(0.15)
        .alphaDecay(0.04)
        .velocityDecay(0.65);

      simulationRef.current = simulation;

      // Links
      const link = g.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", (d) => d.target.type === "subtheme" ? (d.target.parentColor || BORDER) : BORDER)
        .attr("stroke-opacity", (d) => d.target.type === "subtheme" ? 0.25 : 0.1)
        .attr("stroke-width", (d) => d.target.type === "subtheme" ? 1 : 0.3);

      // Comment nodes
      const commentNodes = g.append("g")
        .selectAll("circle")
        .data(nodes.filter((n) => n.type === "comment"))
        .join("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.65)
        .attr("stroke", (d) => d.color)
        .attr("stroke-opacity", 0.35)
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", (event, d) => { event.stopPropagation(); setSelectedComment(d.data); })
        .on("mouseover", function (event, d) {
          d3.select(this).transition().duration(120).attr("r", d.radius * 2.2).attr("fill-opacity", 1).attr("stroke-width", 1.5);
        })
        .on("mouseout", function (event, d) {
          d3.select(this).transition().duration(200).attr("r", d.radius).attr("fill-opacity", 0.65).attr("stroke-width", 0.5);
        });

      commentNodes.append("title").text((d) => {
        const text = (d.data.content || "").slice(0, 120);
        return isLikelyNonEnglish(d.data.content) ? `[Non-English] ${text}` : text;
      });

      // Give non-English nodes a distinct white dashed stroke
      commentNodes
        .filter((d) => isLikelyNonEnglish(d.data.content))
        .attr("stroke", WHITE)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

      // Sub-theme nodes
      const subThemeGroup = g.append("g")
        .selectAll("g")
        .data(nodes.filter((n) => n.type === "subtheme"))
        .join("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => { event.stopPropagation(); toggleSubTheme(d.id); });

      subThemeGroup.append("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.18)
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", 1.5);

      subThemeGroup.append("text")
        .text((d) => d.label)
        .attr("text-anchor", "middle").attr("dy", -3)
        .attr("fill", (d) => d.color).attr("font-size", 8).attr("font-weight", 600).attr("pointer-events", "none");

      subThemeGroup.append("text")
        .text((d) => d.count.toLocaleString())
        .attr("text-anchor", "middle").attr("dy", 9)
        .attr("fill", WHITE).attr("font-size", 9).attr("font-weight", 600).attr("pointer-events", "none");

      subThemeGroup.append("text")
        .text((d) => (expandedSubThemes.has(d.id) ? "\u2212" : "+"))
        .attr("text-anchor", "middle").attr("dy", (d) => d.radius + 11)
        .attr("fill", MUTED).attr("font-size", 10).attr("font-weight", 700).attr("pointer-events", "none");

      // Macro theme nodes
      const themeGroup = g.append("g")
        .selectAll("g")
        .data(nodes.filter((n) => n.type === "theme"))
        .join("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => { event.stopPropagation(); toggleTheme(d.id); });

      themeGroup.append("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.color).attr("fill-opacity", 0.12)
        .attr("stroke", (d) => d.color).attr("stroke-width", 2.5);

      themeGroup.append("text")
        .text((d) => d.label)
        .attr("text-anchor", "middle").attr("dy", -8)
        .attr("fill", (d) => d.color).attr("font-size", 10).attr("font-weight", 700).attr("pointer-events", "none");

      themeGroup.append("text")
        .text((d) => d.count.toLocaleString())
        .attr("text-anchor", "middle").attr("dy", 8)
        .attr("fill", WHITE).attr("font-size", 13).attr("font-weight", 600).attr("pointer-events", "none");

      themeGroup.append("text")
        .text((d) => (expandedThemes.has(d.id) ? "\u2212" : "+"))
        .attr("text-anchor", "middle").attr("dy", (d) => d.radius + 15)
        .attr("fill", MUTED).attr("font-size", 13).attr("font-weight", 700).attr("pointer-events", "none");

      let hasFocused = false;
      simulation.on("tick", () => {
        link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
        commentNodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        subThemeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
        themeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);

        // Once simulation has mostly settled, pan to the focus target
        if (!hasFocused && focusTarget && simulation.alpha() < 0.15) {
          hasFocused = true;
          const target = nodes.find((n) => n.id === focusTarget);
          if (target && target.x != null && target.y != null) {
            const scale = target.type === "subtheme" ? 1.8 : 1.2;
            const tx = width / 2 - target.x * scale;
            const ty = height / 2 - target.y * scale;
            svg.transition().duration(600).ease(d3.easeCubicInOut)
              .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
          }
        }
      });

      const drag = d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        });

      themeGroup.call(drag);
      subThemeGroup.call(drag);
      commentNodes.call(drag);
    }

    buildGraph();

    return () => {
      if (simulationRef.current) { simulationRef.current.stop(); simulationRef.current = null; }
    };
  }, [themeCounts, expandedThemes, expandedSubThemes, groupedByTheme, groupedBySubTheme, subThemeCounts, toggleTheme, toggleSubTheme, focusTarget]);

  if (!comments || comments.length === 0) {
    return <div style={{ color: MUTED, padding: 20 }}>No comments to display.</div>;
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>
          Comment Universe
        </h2>
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>
          {(totalCommentCount || comments.length).toLocaleString()} comments across all banks
        </span>
      </div>
      <p style={{ fontSize: 11, color: MUTED, margin: "0 0 10px", lineHeight: 1.4 }}>
        Click theme to expand sub-themes. Click sub-theme to reveal comments. Scroll to zoom, drag to pan. Double-click to zoom in, right-click to zoom out. Hover a comment to highlight, click to read.
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
            display: "block",
          }}
        />

        {selectedComment && (
          <div
            style={{
              position: "absolute", top: 12, right: 12, width: 320, maxHeight: 670,
              overflowY: "auto", background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: 16, zIndex: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                Comment Detail
              </span>
              <button
                onClick={() => setSelectedComment(null)}
                style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
              >x</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{selectedComment.username || "Anonymous"}</span>
              {selectedComment.date && <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>{selectedComment.date}</span>}
            </div>
            <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.6, margin: "0 0 12px 0", wordBreak: "break-word" }}>
              {selectedComment.content}
            </p>
            {isLikelyNonEnglish(selectedComment.content) && (
              <a
                href={translateUrl(selectedComment.content)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block", fontSize: 11, fontWeight: 600, color: BG, background: TEAL,
                  padding: "4px 10px", borderRadius: 4, textDecoration: "none", marginBottom: 10,
                  fontFamily: "'Inter Tight', sans-serif",
                }}
              >
                Translate to English
              </a>
            )}
            {selectedComment.video_title && (
              <div style={{ fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                <span style={{ fontWeight: 600 }}>Video:</span> {selectedComment.video_title}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theme legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, padding: "8px 0" }}>
        {THEMES.map((theme) => {
          const count = themeCounts[theme.id] || 0;
          if (count === 0) return null;
          const isExpanded = expandedThemes.has(theme.id);
          return (
            <div
              key={theme.id}
              onClick={() => toggleTheme(theme.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
                borderRadius: 999, cursor: "pointer", transition: "all 0.15s ease",
                background: theme.color + (isExpanded ? "28" : "14"),
                border: `1px solid ${theme.color}${isExpanded ? "55" : "28"}`,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: theme.color }} />
              <span style={{ fontSize: 11, color: theme.color, fontWeight: 600 }}>{theme.label}</span>
              <span style={{ fontSize: 10, color: MUTED }}>{count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
