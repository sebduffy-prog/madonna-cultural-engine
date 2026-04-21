import { useEffect, useMemo, useRef, useState } from "react";

// Packed-circle visualisation of audience segments. Circle area encodes
// estimated UK population (overridable per-project); physics pulls pairs
// with higher shared-affinity closer together so clusters read as overlap.
// Click/hover a segment to show the live stats panel on the right.
//
// Size estimates below are rough planning figures — tune with real GWI /
// panel data when available.

const FONT = "'Inter Tight', system-ui, sans-serif";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const WHITE = "#EDEDE8";
const MUTED = "#777";

// UK reach estimates (millions) and pairwise affinity 0–1
// Affinity is how tightly these two segments co-occur in audience panels.
const DEFAULT_SEGMENTS = [
  { key: "genJones",   label: "Gen Jones",        color: "#A78BFA", size: 12.5 },
  { key: "genX",       label: "Gen X",            color: "#FB923C", size: 13.0 },
  { key: "millennial", label: "Millennial",       color: "#F472B6", size: 14.0 },
  { key: "genZ",       label: "Gen Z",            color: "#2DD4BF", size: 13.0 },
  { key: "disco",      label: "Gay Community",    color: "#FFD500", size:  3.2 },
  { key: "fashion",    label: "Fashion",          color: "#F59E0B", size:  8.0 },
  { key: "nightlife",  label: "General Nightlife",color: "#34D399", size: 15.0 },
];

// Affinity matrix — higher = more shared audience. Only pairs listed here
// exert extra pull. Everything else uses a mild default of 0.15.
const AFFINITY = {
  "disco|fashion":      0.78,
  "disco|nightlife":    0.72,
  "disco|millennial":   0.55,
  "disco|genZ":         0.60,
  "fashion|millennial": 0.62,
  "fashion|genZ":       0.58,
  "nightlife|millennial":0.68,
  "nightlife|genZ":     0.70,
  "millennial|genZ":    0.40,
  "genX|millennial":    0.38,
  "genJones|genX":      0.45,
  "genX|nightlife":     0.35,
};

function pairKey(a, b) {
  return [a, b].sort().join("|");
}
function affinityFor(a, b) {
  return AFFINITY[pairKey(a, b)] ?? 0.15;
}

export default function AudienceSegmentVenn({ segments = DEFAULT_SEGMENTS, height = 360 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(480, Math.floor(e.contentRect.width))));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Radii: proportional to sqrt(size) so AREA tracks audience volume.
  const cx = width / 2;
  const cy = height / 2;
  const maxSize = Math.max(...segments.map((s) => s.size));
  const scale = Math.min(width, height) * 0.22 / Math.sqrt(maxSize);
  const baseRadii = useMemo(
    () => Object.fromEntries(segments.map((s) => [s.key, Math.sqrt(s.size) * scale])),
    [segments, scale]
  );

  // Physics: initialise on a ring, then run force iterations synchronously so
  // the layout is stable (no jitter after mount). Recomputes when size changes.
  const positioned = useMemo(() => {
    const r0 = Math.min(width, height) * 0.25;
    let nodes = segments.map((s, i) => {
      const a = (i / segments.length) * Math.PI * 2;
      return { ...s, x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, r: baseRadii[s.key] };
    });
    // Simple force simulation: centre gravity + pairwise attraction by
    // affinity + circle-circle collision (softened so affine pairs overlap).
    for (let step = 0; step < 260; step++) {
      const t = 1 - step / 260;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // centre gravity
        a.vx = (a.vx || 0) * 0.82 + (cx - a.x) * 0.02;
        a.vy = (a.vy || 0) * 0.82 + (cy - a.y) * 0.02;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const aff = affinityFor(a.key, b.key);
          // Desired distance: circles overlap more when affinity is higher.
          const target = (a.r + b.r) * (1.05 - aff * 0.55);
          const delta = d - target;
          const k = delta > 0 ? 0.04 : 0.18;   // stronger repulsion when too close
          a.vx += (dx / d) * delta * k;
          a.vy += (dy / d) * delta * k;
        }
        a.x += a.vx * t;
        a.y += a.vy * t;
      }
      // Keep everything inside the viewport
      for (const n of nodes) {
        const pad = n.r + 6;
        n.x = Math.max(pad, Math.min(width - pad, n.x));
        n.y = Math.max(pad, Math.min(height - pad, n.y));
      }
    }
    return nodes;
  }, [segments, width, height, baseRadii, cx, cy]);

  const activeSeg = selected ? positioned.find((n) => n.key === selected) : null;

  return (
    <div
      ref={wrapRef}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "16px 18px 14px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ width: 3, height: 18, background: "#A78BFA", borderRadius: 2 }} />
        <h3 style={{ fontSize: 13, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: FONT }}>
          Segment sizing
        </h3>
        <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT }}>
          Circle area = UK reach (m) · closer clusters = higher audience overlap
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          style={{ display: "block", fontFamily: FONT, userSelect: "none" }}
        >
          <defs>
            {positioned.map((n) => (
              <radialGradient key={`g-${n.key}`} id={`g-${n.key}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%"   stopColor={n.color} stopOpacity={selected && selected !== n.key ? 0.25 : 0.8} />
                <stop offset="100%" stopColor={n.color} stopOpacity={selected && selected !== n.key ? 0.1 : 0.35} />
              </radialGradient>
            ))}
          </defs>
          {positioned.map((n) => {
            const on = selected === n.key;
            const dim = selected && !on;
            return (
              <g key={n.key}
                 onClick={() => setSelected(on ? null : n.key)}
                 onMouseEnter={() => setSelected(n.key)}
                 onMouseLeave={() => setSelected((cur) => (cur === n.key ? null : cur))}
                 style={{ cursor: "pointer" }}>
                <circle
                  cx={n.x} cy={n.y} r={n.r}
                  fill={`url(#g-${n.key})`}
                  stroke={n.color}
                  strokeOpacity={dim ? 0.3 : on ? 1 : 0.7}
                  strokeWidth={on ? 2 : 1}
                  style={{ transition: "stroke-opacity 0.15s" }}
                />
                <text
                  x={n.x} y={n.y + 4}
                  textAnchor="middle"
                  fill={WHITE}
                  fontSize={Math.max(11, Math.min(15, n.r * 0.32))}
                  fontWeight={700}
                  opacity={dim ? 0.35 : 1}
                  style={{ pointerEvents: "none" }}
                >
                  {n.label}
                </text>
                <text
                  x={n.x} y={n.y + 4 + Math.max(11, Math.min(15, n.r * 0.32)) * 0.95}
                  textAnchor="middle"
                  fill={WHITE}
                  fontSize={Math.max(9, Math.min(12, n.r * 0.24))}
                  opacity={dim ? 0.35 : 0.75}
                  style={{ pointerEvents: "none" }}
                >
                  {n.size.toFixed(1)}m
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
          {activeSeg ? (
            <div>
              <div style={{ fontSize: 9, color: activeSeg.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, fontFamily: FONT, marginBottom: 4 }}>Segment</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, fontFamily: FONT, letterSpacing: "-0.01em" }}>{activeSeg.label}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <Stat label="Reach" value={`${activeSeg.size.toFixed(1)}m`} color={activeSeg.color} />
                <Stat label="% UK adult" value={`${((activeSeg.size / 54) * 100).toFixed(1)}%`} color={WHITE} />
              </div>
              <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: FONT }}>
                Strongest overlaps
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {segments
                  .filter((s) => s.key !== activeSeg.key)
                  .map((s) => ({ s, a: affinityFor(activeSeg.key, s.key) }))
                  .sort((a, b) => b.a - a.a)
                  .slice(0, 4)
                  .map(({ s, a }) => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: WHITE, fontFamily: FONT }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 700 }}>{Math.round(a * 100)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: FONT }}>
                Hover a circle
              </div>
              <p style={{ fontSize: 12, color: WHITE, lineHeight: 1.55, marginTop: 8, fontFamily: FONT }}>
                Circle area encodes estimated UK reach. Tight clusters indicate audience pairs with the strongest affinity — e.g. Gay Community ⇄ Fashion ⇄ Nightlife — while isolated circles have more independent reach.
              </p>
              <p style={{ fontSize: 11, color: WHITE, lineHeight: 1.55, marginTop: 10, fontFamily: FONT }}>
                Click any segment to lock its stats panel on the right.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 70, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 8, color: color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: FONT }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: WHITE, fontFamily: FONT, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}
