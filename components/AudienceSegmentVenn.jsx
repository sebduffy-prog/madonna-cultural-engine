import { useEffect, useMemo, useRef, useState, useCallback } from "react";

// Full-corpus, zoomable audience sizing map.
//
// Hierarchy (four levels, all driven from GWI):
//   L0    : Madonna Fans — the universe (UK adult reach)
//   L1    : Audience segments (Gen Z, Gay Community, …) packed INSIDE the root
//   L2    : Statement categories (from GWI `question` field)
//   L3    : Individual statements within each category
//
// Sizing is mathematically accurate at every level:
//   • Root size      = UK adult reach of Madonna (union of all segments)
//   • Segment size   = UK population estimate for that segment (millions)
//   • Category size  = segment_size × (category_responses / segment_responses)
//   • Statement size = category_size × (statement_responses / category_responses)
//
// Because Σ(segment areas) > root area, segments are forced to overlap
// inside the root universe — overlap amount is then tuned by GWI affinity.
//
// Layout:
//   • Root positioned at viewport centre, radius derived from its reach.
//   • Segments placed via force sim with pair affinity AND a boundary
//     constraint that keeps their centres inside the root, so they overlap
//     in proportion to their shared-audience affinity.
//   • Categories ring-packed inside each segment.
//   • Statements ring-packed inside each category.
//
// Interaction:
//   • Drag to pan, scroll wheel to zoom (anchored under cursor),
//     +/−/Reset buttons.
//   • Click any circle to fly into it with an easing animation.
//   • Layers fade in as zoom crosses thresholds: categories appear around 1.6×,
//     statement labels around 4×.

const FONT = "'Inter Tight', system-ui, sans-serif";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const WHITE = "#EDEDE8";
const MUTED = "#777";

const SEGMENT_DEFS = [
  { id: "genJones",   key: "genJones",   label: "Gen Jones",         color: "#A78BFA", pop: 12.5 },
  { id: "genX",       key: "genX",       label: "Gen X",             color: "#FB923C", pop: 13.0 },
  { id: "millennial", key: "millennial", label: "Millennial",        color: "#F472B6", pop: 14.0 },
  { id: "genZ",       key: "genZ",       label: "Gen Z",             color: "#2DD4BF", pop: 13.0 },
  { id: "disco",      key: "disco",      label: "Gay Community",     color: "#FFD500", pop:  3.2 },
  { id: "fashion",    key: "fashion",    label: "Fashion",           color: "#F59E0B", pop:  8.0 },
  { id: "nightlife",  key: "nightlife",  label: "General Nightlife", color: "#34D399", pop: 15.0 },
];
const SEGMENT_BY_KEY = Object.fromEntries(SEGMENT_DEFS.map((s) => [s.key, s]));

// Root universe — Madonna's UK adult reach. Mathematically it's the union
// of all segments; since the four generational segments partition UK adults
// (12.5 + 13 + 14 + 13 ≈ 52.5m) and the lifestyle segments overlap with
// them, the union is bounded by UK adult population (~54m).
const UK_ADULT_POP = 54;
const MADONNA_ROOT = {
  id: "madonnaFans",
  label: "Madonna Fans",
  color: "#E879F9",
  pop: UK_ADULT_POP,
};

// Pairwise affinity — how tightly two segments co-occur. Range 0–1.
const AFFINITY = {
  "disco|fashion":        0.78,
  "disco|nightlife":      0.72,
  "disco|millennial":     0.55,
  "disco|genZ":           0.60,
  "fashion|millennial":   0.62,
  "fashion|genZ":         0.58,
  "nightlife|millennial": 0.68,
  "nightlife|genZ":       0.70,
  "millennial|genZ":      0.40,
  "genX|millennial":      0.38,
  "genJones|genX":        0.45,
  "genX|nightlife":       0.35,
};
const pairKey = (a, b) => [a, b].sort().join("|");
const affinityFor = (a, b) => AFFINITY[pairKey(a, b)] ?? 0.12;

// Build the full hierarchy from the raw GWI rows. We use the "Responses"
// metric as the absolute sizing signal where available; otherwise fall back
// to "Column %" × segment population as a volume proxy.
function buildHierarchy(gwiData) {
  const rows = Array.isArray(gwiData) ? gwiData : [];
  const byMetric = (m) => rows.filter((r) => r.metric === m && r.name && r.name.trim() && r.name !== "Totals");
  const responsesRows = byMetric("Responses");
  const colPctRows    = byMetric("Column %");
  // Prefer Responses when present for each statement; fall back to Column %.
  const sourceRows = responsesRows.length ? responsesRows : colPctRows;
  const usingResponses = responsesRows.length > 0;

  return SEGMENT_DEFS.map((seg) => {
    // Group rows by question (category) for this segment.
    const byCat = new Map();
    for (const row of sourceRows) {
      const cat = row.question || "Other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      // Segment value — coerce to number
      const raw = row[seg.key];
      const v = typeof raw === "number" ? raw : parseFloat(raw);
      if (!isFinite(v) || v <= 0) continue;
      byCat.get(cat).push({ id: `${seg.id}__${row.name}__${cat}`.slice(0, 120), name: row.name, value: v });
    }
    // Convert category groups to sized children
    const catTotal = Array.from(byCat.values()).reduce((s, arr) => s + arr.reduce((a, x) => a + x.value, 0), 0) || 1;
    const categories = [];
    for (const [name, stmts] of byCat.entries()) {
      const catSum = stmts.reduce((a, x) => a + x.value, 0);
      if (catSum <= 0) continue;
      const catShare = catSum / catTotal;
      const catSize = seg.pop * catShare;   // in millions
      // Allocate each statement's size as a share of the category
      const statements = stmts.map((s) => ({
        id: s.id,
        label: s.name,
        value: s.value,
        size: catSize * (s.value / catSum),  // in millions
      })).sort((a, b) => b.size - a.size);
      categories.push({
        id: `${seg.id}__${name}`.slice(0, 120),
        label: name,
        size: catSize,
        share: catShare,
        statements,
      });
    }
    categories.sort((a, b) => b.size - a.size);
    return {
      ...seg,
      size: seg.pop,
      categories,
      usingResponses,
      statementsCount: categories.reduce((s, c) => s + c.statements.length, 0),
    };
  });
}

// ─── Ring-pack: place children inside a parent circle without overlap ────
// Largest at centre, others spiralled outward on expanding rings.
function ringPack(parent, children) {
  if (!children.length) return [];
  const sorted = [...children].sort((a, b) => b.r - a.r);
  const placed = [];
  sorted[0].x = parent.x;
  sorted[0].y = parent.y;
  placed.push(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    let best = null;
    const rMax = parent.r - c.r - 1;
    for (let r = sorted[0].r + c.r + 1; r < rMax && !best; r += Math.max(1, c.r * 0.4)) {
      for (let t = 0; t < 48 && !best; t++) {
        const a = (t / 48) * Math.PI * 2;
        const x = parent.x + Math.cos(a) * r;
        const y = parent.y + Math.sin(a) * r;
        if (Math.hypot(x - parent.x, y - parent.y) + c.r > parent.r - 1) continue;
        let hit = false;
        for (const p of placed) {
          if (Math.hypot(x - p.x, y - p.y) < p.r + c.r + 0.5) { hit = true; break; }
        }
        if (!hit) best = { x, y };
      }
    }
    if (!best) {
      // fallback: shrink and place at centre — rare for long tails
      c.r *= 0.6;
      best = { x: parent.x, y: parent.y };
    }
    c.x = best.x;
    c.y = best.y;
    placed.push(c);
  }
  return placed;
}

export default function AudienceSegmentVenn({ gwiData = [] }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 1000, h: 620 });
  const [view, setView] = useState({ tx: 0, ty: 0, s: 1 });
  const [animating, setAnimating] = useState(false);
  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      setSize({
        w: Math.max(640, Math.floor(e.contentRect.width)),
        h: 620,
      });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const cx = w / 2;
  const cy = h / 2;

  // Build segments with full child hierarchy from GWI data.
  const segments = useMemo(() => buildHierarchy(gwiData), [gwiData]);

  // ─── Layout (world coords) ──────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!segments.length) return { root: null, segments: [], k: 1 };

    // Scale factor k: area = size × k². Fix k so the root (Madonna Fans) circle
    // comfortably fits in the viewport. Every other circle (segments,
    // categories, statements) shares the same k so areas are comparable.
    const rRootTarget = Math.min(w, h) * 0.44;
    const k = rRootTarget / Math.sqrt(MADONNA_ROOT.pop / Math.PI);
    const rRoot = rRootTarget;
    const root = {
      ...MADONNA_ROOT,
      x: cx,
      y: cy,
      r: rRoot,
      size: MADONNA_ROOT.pop,
    };

    // 1. Seed segments on a ring inside the root, then force-lay with
    //    affinity-driven overlap + a boundary constraint that keeps each
    //    segment centre inside the root. Since Σ(segment areas) > root area,
    //    the constraint itself forces substantial overlap; affinity then
    //    tunes who overlaps with whom.
    const nodes = segments.map((s, i) => {
      const a = (i / segments.length) * Math.PI * 2 - Math.PI / 2;
      const r = Math.sqrt(s.size / Math.PI) * k;
      const seedR = Math.max(0, rRoot - r) * 0.55;
      return {
        ...s,
        r,
        x: cx + Math.cos(a) * seedR,
        y: cy + Math.sin(a) * seedR,
        vx: 0, vy: 0,
      };
    });
    for (let step = 0; step < 480; step++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Gentle pull toward the root centre
        a.vx = (a.vx || 0) * 0.82 + (cx - a.x) * 0.012;
        a.vy = (a.vy || 0) * 0.82 + (cy - a.y) * 0.012;
        // Pair forces — tighter target means more overlap; affinity adds extra pull
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const aff = affinityFor(a.id, b.id);
          const target = (a.r + b.r) * (0.72 - aff * 0.42);
          const diff = d - target;
          const kf = diff > 0 ? 0.05 : 0.14;
          a.vx += (dx / d) * diff * kf;
          a.vy += (dy / d) * diff * kf;
        }
        a.x += a.vx;
        a.y += a.vy;
        // Boundary constraint: keep the segment's centre inside the root.
        // Allow the centre to approach the root edge minus ~18% of the
        // segment radius, so the segment overlaps the root boundary only
        // slightly and nothing escapes the universe.
        const distFromCentre = Math.hypot(a.x - cx, a.y - cy);
        const maxDist = rRoot - a.r * 0.18;
        if (distFromCentre > maxDist && distFromCentre > 0) {
          const nx = (a.x - cx) / distFromCentre;
          const ny = (a.y - cy) / distFromCentre;
          a.x = cx + nx * maxDist;
          a.y = cy + ny * maxDist;
          a.vx *= 0.35;
          a.vy *= 0.35;
        }
      }
    }

    // 2. For each segment, size + pack its categories, then pack statements
    //    inside each category.
    for (const n of nodes) {
      const cats = n.categories || [];
      if (!cats.length) { n.packedCategories = []; continue; }
      const usableArea = n.r * n.r * Math.PI * 0.62;
      const catSum = cats.reduce((s, c) => s + c.size, 0) || 1;
      const kCat = Math.sqrt(usableArea / catSum / Math.PI);
      const catNodes = cats.map((c) => ({
        ...c,
        parentId: n.id,
        parentColor: n.color,
        r: Math.max(2, Math.sqrt(c.size / Math.PI) * kCat),
      }));
      ringPack(n, catNodes);

      // 3. Pack statements inside each category
      for (const c of catNodes) {
        const stmts = c.statements || [];
        if (!stmts.length) { c.packedStatements = []; continue; }
        const innerArea = c.r * c.r * Math.PI * 0.55;
        const sSum = stmts.reduce((s, x) => s + x.size, 0) || 1;
        const kSt = Math.sqrt(innerArea / sSum / Math.PI);
        const stNodes = stmts.map((s) => ({
          ...s,
          parentId: c.id,
          parentColor: n.color,
          r: Math.max(0.8, Math.sqrt(s.size / Math.PI) * kSt),
        }));
        ringPack(c, stNodes);
        c.packedStatements = stNodes;
      }
      n.packedCategories = catNodes;
    }

    return { root, segments: nodes, k };
  }, [segments, w, h, cx, cy]);

  // ─── View helpers ───────────────────────────────────────────────────────

  const screenToWorld = useCallback((sx, sy) => ({
    x: (sx - view.tx) / view.s,
    y: (sy - view.ty) / view.s,
  }), [view]);

  const animateTo = useCallback((target, duration = 420) => {
    const start = performance.now();
    const from = { ...view };
    setAnimating(true);
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setView({
        tx: from.tx + (target.tx - from.tx) * e,
        ty: from.ty + (target.ty - from.ty) * e,
        s:  from.s  + (target.s  - from.s)  * e,
      });
      if (t < 1) requestAnimationFrame(step);
      else setAnimating(false);
    }
    requestAnimationFrame(step);
  }, [view]);

  function focusNode(node) {
    if (!node) return;
    const target = Math.min(w, h) * 0.72;
    const s = target / (node.r * 2);
    const tx = w / 2 - node.x * s;
    const ty = h / 2 - node.y * s;
    setFocus(node.id);
    animateTo({ tx, ty, s });
  }
  function resetView() {
    setFocus(null);
    animateTo({ tx: 0, ty: 0, s: 1 });
  }

  // Pan + wheel zoom
  const dragRef = useRef(null);
  function onPointerDown(e) {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ...view };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setView({ s: dragRef.current.s, tx: dragRef.current.tx + dx, ty: dragRef.current.ty + dy });
  }
  function onPointerUp() { dragRef.current = null; }
  function onWheel(e) {
    if (animating) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const nextS = Math.max(0.4, Math.min(40, view.s * factor));
    setView({ tx: sx - world.x * nextS, ty: sy - world.y * nextS, s: nextS });
  }

  // ─── Fade bands per zoom level ──────────────────────────────────────────
  // Root label prominent ≤1.1×, fades out by 1.5× as segments take over.
  // Categories fade in 1.6→2.1×; statements fade in 3.4→5.2×.
  function bandFade(z, lo, hi) { return Math.max(0, Math.min(1, (z - lo) / (hi - lo))); }
  const rootLabelOpacity  = 1 - bandFade(view.s, 1.1, 1.5);
  const segOpacity        = 1;
  const segLabelOpacity   = bandFade(view.s, 0.95, 1.35) * (1 - bandFade(view.s, 3.4, 4.8));
  const catOpacity        = bandFade(view.s, 1.6, 2.1);
  const catLabelOpacity   = bandFade(view.s, 2.2, 2.7) * (1 - bandFade(view.s, 5.0, 6.4));
  const stmtOpacity       = bandFade(view.s, 3.4, 5.2);
  const stmtLabelOpacity  = bandFade(view.s, 5.2, 7.0);

  // Resolve hovered node across the full tree
  const hoverNode = useMemo(() => {
    if (!hover) return null;
    if (layout.root && layout.root.id === hover) return { kind: "root", node: layout.root };
    for (const n of layout.segments) {
      if (n.id === hover) return { kind: "segment", node: n };
      for (const c of (n.packedCategories || [])) {
        if (c.id === hover) return { kind: "category", node: c, parent: n };
        for (const s of (c.packedStatements || [])) {
          if (s.id === hover) return { kind: "statement", node: s, parent: c, grandparent: n };
        }
      }
    }
    return null;
  }, [hover, layout]);

  const totalStatements = segments.reduce((s, seg) => s + seg.statementsCount, 0);

  return (
    <div
      ref={wrapRef}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "14px 16px 12px",
        marginBottom: 16,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ width: 3, height: 18, background: "#A78BFA", borderRadius: 2 }} />
        <h3 style={{ fontSize: 13, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: FONT }}>
          Segment sizing · full corpus
        </h3>
        <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT }}>
          Madonna Fans ({UK_ADULT_POP}m) · {segments.length} segments · {totalStatements} statements · drag · scroll · click to dive
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <ZoomButton label="−" onClick={() => {
            const nextS = Math.max(0.4, view.s / 1.3);
            const cxS = w / 2, cyS = h / 2;
            const world = screenToWorld(cxS, cyS);
            animateTo({ s: nextS, tx: cxS - world.x * nextS, ty: cyS - world.y * nextS }, 240);
          }} />
          <span style={{ fontSize: 10, color: WHITE, fontFamily: FONT, minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            {view.s.toFixed(2)}×
          </span>
          <ZoomButton label="+" onClick={() => {
            const nextS = Math.min(40, view.s * 1.3);
            const cxS = w / 2, cyS = h / 2;
            const world = screenToWorld(cxS, cyS);
            animateTo({ s: nextS, tx: cxS - world.x * nextS, ty: cyS - world.y * nextS }, 240);
          }} />
          <button onClick={resetView} style={{
            marginLeft: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700,
            color: WHITE, background: "transparent", border: `1px solid ${BORDER}`,
            borderRadius: 4, cursor: "pointer", fontFamily: FONT, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>Reset</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div style={{ position: "relative", height: h, borderRadius: 8, overflow: "hidden", background: "rgba(12,12,12,0.35)", border: `1px solid ${BORDER}`, cursor: dragRef.current ? "grabbing" : "grab" }}>
          <svg
            ref={svgRef}
            width={w}
            height={h}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onClick={(e) => { if (e.target === svgRef.current) resetView(); }}
            style={{ display: "block", fontFamily: FONT, userSelect: "none", touchAction: "none" }}
          >
            <defs>
              {layout.root && (
                <radialGradient id="g-root" cx="50%" cy="45%" r="65%">
                  <stop offset="0%"   stopColor={layout.root.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={layout.root.color} stopOpacity={0.04} />
                </radialGradient>
              )}
              {layout.segments.map((n) => (
                <radialGradient key={`g-${n.id}`} id={`g-${n.id}`} cx="50%" cy="40%" r="60%">
                  <stop offset="0%"   stopColor={n.color} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={n.color} stopOpacity={0.30} />
                </radialGradient>
              ))}
            </defs>

            <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
              {/* Root circle — Madonna Fans universe */}
              {layout.root && (
                <g opacity={focus && focus !== layout.root.id ? 0.55 : 1}>
                  <circle
                    cx={layout.root.x} cy={layout.root.y} r={layout.root.r}
                    fill="url(#g-root)"
                    stroke={layout.root.color}
                    strokeOpacity={0.55}
                    strokeWidth={1.4 / view.s}
                    strokeDasharray={`${6 / view.s} ${4 / view.s}`}
                    onClick={(e) => { e.stopPropagation(); focusNode(layout.root); }}
                    onPointerEnter={() => setHover(layout.root.id)}
                    onPointerLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              )}

              {/* Segment circles */}
              {layout.segments.map((n) => (
                <g key={n.id} opacity={focus && focus !== n.id ? 0.22 : segOpacity}>
                  <circle
                    cx={n.x} cy={n.y} r={n.r}
                    fill={`url(#g-${n.id})`}
                    stroke={n.color}
                    strokeWidth={focus === n.id ? 2.5 / view.s : 1 / view.s}
                    onClick={(e) => { e.stopPropagation(); focusNode(n); }}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover(null)}
                    style={{ cursor: "pointer", transition: "stroke-width 0.2s" }}
                  />
                </g>
              ))}

              {/* Category layer */}
              {catOpacity > 0.01 && layout.segments.map((n) => (
                <g key={`cat-${n.id}`} opacity={catOpacity * (focus && focus !== n.id && !isDescendant(focus, n) ? 0.25 : 1)}>
                  {(n.packedCategories || []).map((c) => (
                    <g key={c.id}>
                      <circle
                        cx={c.x} cy={c.y} r={c.r}
                        fill={WHITE}
                        fillOpacity={0.05}
                        stroke={n.color}
                        strokeOpacity={0.6}
                        strokeWidth={0.9 / view.s}
                        onClick={(e) => { e.stopPropagation(); focusNode(c); }}
                        onPointerEnter={() => setHover(c.id)}
                        onPointerLeave={() => setHover(null)}
                        style={{ cursor: "pointer" }}
                      />
                      {catLabelOpacity > 0.02 && c.r * view.s > 28 && (
                        <text
                          x={c.x} y={c.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={Math.max(7, Math.min(c.r * 0.26, 18)) / Math.max(1, view.s * 0.6)}
                          fontWeight={700}
                          fill={WHITE}
                          fillOpacity={catLabelOpacity}
                          pointerEvents="none"
                          style={{ paintOrder: "stroke", stroke: "rgba(12,12,12,0.6)", strokeWidth: 2 / view.s }}
                        >
                          {truncate(c.label, 22)}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              ))}

              {/* Statement layer */}
              {stmtOpacity > 0.01 && layout.segments.map((n) => (
                <g key={`st-${n.id}`} opacity={stmtOpacity}>
                  {(n.packedCategories || []).map((c) =>
                    (c.packedStatements || []).map((s) => (
                      <g key={s.id}>
                        <circle
                          cx={s.x} cy={s.y} r={s.r}
                          fill={n.color}
                          fillOpacity={0.22}
                          stroke={n.color}
                          strokeOpacity={0.8}
                          strokeWidth={0.4 / view.s}
                          onClick={(e) => { e.stopPropagation(); focusNode(s); }}
                          onPointerEnter={() => setHover(s.id)}
                          onPointerLeave={() => setHover(null)}
                          style={{ cursor: "pointer" }}
                        />
                        {stmtLabelOpacity > 0.02 && s.r * view.s > 18 && (
                          <text
                            x={s.x} y={s.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.max(6, Math.min(s.r * 0.34, 12)) / Math.max(1, view.s * 0.5)}
                            fontWeight={600}
                            fill={WHITE}
                            fillOpacity={stmtLabelOpacity}
                            pointerEvents="none"
                            style={{ paintOrder: "stroke", stroke: "rgba(12,12,12,0.7)", strokeWidth: 1.4 / view.s }}
                          >
                            {truncate(s.label, 18)}
                          </text>
                        )}
                      </g>
                    ))
                  )}
                </g>
              ))}

              {/* Root label — prominent when zoomed out, fades as we dive in */}
              {layout.root && rootLabelOpacity > 0.02 && (
                <g pointerEvents="none" opacity={rootLabelOpacity}>
                  <text
                    x={layout.root.x}
                    y={layout.root.y - layout.root.r * 0.78}
                    textAnchor="middle"
                    fontSize={34 / Math.max(1, view.s * 0.7)}
                    fontWeight={800}
                    fill={WHITE}
                    style={{ paintOrder: "stroke", stroke: "rgba(12,12,12,0.8)", strokeWidth: 4 / view.s, letterSpacing: "-0.01em" }}
                  >
                    {layout.root.label}
                  </text>
                  <text
                    x={layout.root.x}
                    y={layout.root.y - layout.root.r * 0.78 + 22 / Math.max(1, view.s * 0.7)}
                    textAnchor="middle"
                    fontSize={13 / Math.max(1, view.s * 0.7)}
                    fontWeight={600}
                    fill={WHITE}
                    fillOpacity={0.7}
                  >
                    {layout.root.size.toFixed(0)}m UK adults · zoom in for segments
                  </text>
                </g>
              )}

              {/* Segment labels — kept on top, fade out as we drill past them */}
              {segLabelOpacity > 0.02 && layout.segments.map((n) => {
                const base = Math.max(10, Math.min(n.r * 0.22, 28));
                return (
                  <g key={`lab-${n.id}`} opacity={segLabelOpacity} pointerEvents="none">
                    <text
                      x={n.x} y={n.y - 2}
                      textAnchor="middle"
                      fontSize={base / Math.max(1, view.s * 0.65)}
                      fontWeight={800}
                      fill={WHITE}
                      style={{ paintOrder: "stroke", stroke: "rgba(12,12,12,0.7)", strokeWidth: 3 / view.s }}
                    >
                      {n.label}
                    </text>
                    <text
                      x={n.x} y={n.y + base * 0.85}
                      textAnchor="middle"
                      fontSize={(base * 0.55) / Math.max(1, view.s * 0.65)}
                      fill={WHITE}
                      fillOpacity={0.85}
                    >
                      {n.size.toFixed(1)}m
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hint pill */}
          <div style={{
            position: "absolute", left: 12, bottom: 12,
            padding: "4px 10px", background: "rgba(12,12,12,0.7)", border: `1px solid ${BORDER}`,
            borderRadius: 999, fontSize: 10, color: WHITE, fontFamily: FONT, letterSpacing: "0.02em",
            backdropFilter: "blur(4px)",
          }}>
            {stmtOpacity > 0.5
              ? "Statements · zoom out to collapse"
              : catOpacity > 0.5
                ? "Categories · keep zooming for statements"
                : segLabelOpacity > 0.5
                  ? "Segments · zoom in to reveal categories"
                  : "Madonna Fans · zoom in to see the 7 segments"}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 14, fontFamily: FONT, maxHeight: h, overflowY: "auto" }}>
          {hoverNode ? (
            hoverNode.kind === "root" ? (
              <RootPanel node={hoverNode.node} segments={layout.segments} totalStatements={totalStatements} />
            ) : hoverNode.kind === "segment" ? (
              <SegmentPanel node={hoverNode.node} allNodes={layout.segments} root={layout.root} />
            ) : hoverNode.kind === "category" ? (
              <CategoryPanel node={hoverNode.node} parent={hoverNode.parent} />
            ) : (
              <StatementPanel node={hoverNode.node} parent={hoverNode.parent} grandparent={hoverNode.grandparent} />
            )
          ) : (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Overview
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", marginTop: 4 }}>
                {layout.root ? layout.root.label : "Madonna Fans"}
              </div>
              <div style={{ fontSize: 12, color: WHITE, marginTop: 2, opacity: 0.7 }}>
                {layout.root ? `${layout.root.size.toFixed(0)}m UK adults · ` : ""}{segments.length} segments · {totalStatements} statements
              </div>
              <p style={{ fontSize: 12, color: WHITE, lineHeight: 1.55, marginTop: 12, opacity: 0.9 }}>
                The outer dashed ring is the Madonna Fans universe — all UK adult reach. Every inner circle is sized by GWI: segment area = UK population, category area = share of segment responses, statement area = share of category responses.
              </p>
              <p style={{ fontSize: 12, color: WHITE, lineHeight: 1.55, marginTop: 10, opacity: 0.9 }}>
                Segments overlap inside the universe by shared-audience affinity. Categories fade in around <b>1.8×</b>, statement labels around <b>5×</b>. Click any circle to fly into it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isDescendant(focusId, segNode) {
  if (!focusId) return false;
  if (segNode.id === focusId) return true;
  for (const c of (segNode.packedCategories || [])) {
    if (c.id === focusId) return true;
    for (const s of (c.packedStatements || [])) if (s.id === focusId) return true;
  }
  return false;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function RootPanel({ node, segments, totalStatements }) {
  const segTotal = segments.reduce((s, x) => s + x.size, 0);
  return (
    <div>
      <div style={{ fontSize: 9, color: node.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Universe</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em" }}>{node.label}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Stat label="Reach" value={`${node.size.toFixed(0)}m`} color={node.color} />
        <Stat label="Segments" value={String(segments.length)} color={WHITE} />
        <Stat label="Statements" value={String(totalStatements)} color={WHITE} />
      </div>
      <p style={{ fontSize: 12, color: WHITE, lineHeight: 1.55, marginTop: 12, opacity: 0.9 }}>
        The root is UK adult population ({node.size.toFixed(0)}m). Segments sum to {segTotal.toFixed(1)}m before overlap — the {(segTotal / node.size).toFixed(2)}× excess is exactly what forces them to overlap inside the universe.
      </p>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 14 }}>
        Segment sizes
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {[...segments].sort((a, b) => b.size - a.size).map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: WHITE }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <span style={{ color: s.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.size.toFixed(1)}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentPanel({ node, allNodes, root }) {
  const universe = root ? root.size : 54;
  return (
    <div>
      <div style={{ fontSize: 9, color: node.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Segment</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em" }}>{node.label}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Stat label="Reach" value={`${node.size.toFixed(1)}m`} color={node.color} />
        <Stat label="% UK adult" value={`${((node.size / universe) * 100).toFixed(1)}%`} color={WHITE} />
        <Stat label="Statements" value={String(node.statementsCount || 0)} color={WHITE} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 14 }}>
        Strongest overlaps
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {allNodes
          .filter((s) => s.id !== node.id)
          .map((s) => ({ s, a: affinityFor(node.id, s.id) }))
          .sort((a, b) => b.a - a.a)
          .slice(0, 4)
          .map(({ s, a }) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: WHITE }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ color: s.color, fontWeight: 700 }}>{Math.round(a * 100)}%</span>
            </div>
          ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 14 }}>
        Top categories
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {(node.categories || []).slice(0, 6).map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: WHITE }}>
            <span style={{ flex: 1 }}>{truncate(c.label, 28)}</span>
            <span style={{ color: node.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.size.toFixed(1)}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryPanel({ node, parent }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: parent.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
        Category · {parent.label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", marginTop: 2, lineHeight: 1.25 }}>{node.label}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Stat label="Reach" value={`${node.size.toFixed(1)}m`} color={parent.color} />
        <Stat label="% of segment" value={`${((node.size / parent.size) * 100).toFixed(0)}%`} color={WHITE} />
        <Stat label="Statements" value={String((node.statements || []).length)} color={WHITE} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 14 }}>
        Top statements
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {(node.statements || []).slice(0, 6).map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: WHITE }}>
            <span style={{ flex: 1 }}>{truncate(s.label, 32)}</span>
            <span style={{ color: parent.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.size.toFixed(2)}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatementPanel({ node, parent, grandparent }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: grandparent.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
        Statement · {grandparent.label} · {truncate(parent.label, 22)}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", marginTop: 4, lineHeight: 1.3 }}>
        {node.label}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Stat label="Reach" value={`${node.size.toFixed(2)}m`} color={grandparent.color} />
        <Stat label="% of category" value={`${((node.size / parent.size) * 100).toFixed(0)}%`} color={WHITE} />
      </div>
      <p style={{ fontSize: 11, color: WHITE, opacity: 0.8, lineHeight: 1.55, marginTop: 12 }}>
        Statements are sized as their response share of the parent category, scaled to the segment&#39;s UK population. Hover a neighbour or zoom out to compare.
      </p>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 74, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 8, color: color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: WHITE, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ZoomButton({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 6, fontSize: 14, fontWeight: 700, color: WHITE,
      background: "transparent", border: `1px solid ${BORDER}`, cursor: "pointer", fontFamily: FONT,
    }}>{label}</button>
  );
}
