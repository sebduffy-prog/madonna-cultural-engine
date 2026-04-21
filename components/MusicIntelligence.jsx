import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { KpiStripSkeleton, PanelSkeleton } from "./Skeleton";
import { fadeUp, kpiTween, hoverLift } from "../lib/motion";
import LineChart from "./LineChart";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", AMBER = "#F59E0B", PINK = "#F472B6", CORAL = "#FB923C";
const FONT = "'Inter Tight', system-ui, sans-serif";

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function Kpi({ label, value, sub, color = WHITE, delta }) {
  const deltaColor = delta == null ? null : delta > 0 ? GREEN : delta < 0 ? RED : MUTED;
  const deltaGlyph = delta == null ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  return (
    <motion.div
      variants={kpiTween}
      initial="initial"
      animate="animate"
      whileHover={hoverLift}
      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}`, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: FONT, display: "flex", alignItems: "baseline", gap: 6 }}>
        {value}
        {delta != null && (
          <span style={{ fontSize: 11, color: deltaColor, fontWeight: 700 }}>{deltaGlyph} {fmt(Math.abs(delta))}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{sub}</div>}
    </motion.div>
  );
}

function Panel({ title, subtitle, children, right, accent = PURPLE }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      whileHover={hoverLift}
      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: FONT }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: WHITE, marginTop: 3, fontFamily: FONT }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </motion.div>
  );
}

function HorizontalBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ background: BG, borderRadius: 2, height, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
    </div>
  );
}

// Circular 3D album carousel — covers arranged in a ring around a central
// hub. Drag left/right to rotate with inertia; idles into a slow auto-spin.
// Live banner above the ring updates to the "front" album as it rotates.
// Glassy container + edge-fade gradients keep the composition clean on any
// background in the Music tab.
function CircularAlbumCarousel({
  albums = [],
  panelHeight = 340,
  radius = 200,
  itemW = 150,
  itemH = 150,
  perspective = 1400,
  tilt = -14,
  autoSpeed = 0.12,      // deg per frame
  damping = 0.93,         // inertia decay per frame
  dragSensitivity = 0.45, // drag px → deg
}) {
  const wrapRef = useRef(null);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const velocityRef = useRef(0);
  const lastPointerRef = useRef(null);

  const n = albums.length;

  useEffect(() => {
    let raf;
    const step = () => {
      setAngle((prev) => {
        let next = prev + velocityRef.current;
        if (!dragging) {
          velocityRef.current *= damping;
          if (Math.abs(velocityRef.current) < 0.02) {
            velocityRef.current = 0;
            next = prev + autoSpeed;
          }
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging, autoSpeed, damping]);

  if (!n) return null;

  const perItem = 360 / n;

  // Normalise angle and pick the album currently closest to facing camera.
  const normalised = ((angle % 360) + 360) % 360;
  const frontIndex = ((Math.round(-normalised / perItem) % n) + n) % n;
  const frontAlbum = albums[frontIndex];

  function onPointerDown(e) {
    setDragging(true);
    velocityRef.current = 0;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e) {
    if (!lastPointerRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const deg = dx * dragSensitivity;
    velocityRef.current = deg;
    setAngle((a) => a + deg);
  }
  function onPointerUp(e) {
    setDragging(false);
    lastPointerRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        background: "linear-gradient(180deg, rgba(167,139,250,0.10), rgba(21,21,21,0.25))",
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Trending banner — updates live as the ring rotates */}
      <div style={{
        position: "relative", zIndex: 3,
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        borderBottom: `1px solid ${BORDER}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: CORAL, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: FONT }}>
            Trending now · #{frontIndex + 1} of {n}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: FONT, marginTop: 2, letterSpacing: "-0.01em" }}>
            {frontAlbum?.name || ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: WHITE, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: FONT, fontWeight: 700, opacity: 0.7 }}>Plays</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: WHITE, fontFamily: FONT, fontVariantNumeric: "tabular-nums" }}>
              {fmt(frontAlbum?.playcount)}
            </div>
          </div>
          {frontAlbum?.rank ? (
            <div style={{
              background: `${CORAL}22`, border: `1px solid ${CORAL}66`, borderRadius: 6,
              padding: "6px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: 8, color: CORAL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: FONT }}>Rank</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: FONT }}>#{frontAlbum.rank}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3D ring */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "relative",
          width: "100%",
          height: panelHeight,
          perspective,
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "pan-y",
          userSelect: "none",
        }}
      >
        <div style={{
          position: "absolute",
          left: "50%", top: "50%",
          width: itemW, height: itemH,
          marginLeft: -itemW / 2, marginTop: -itemH / 2,
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt}deg) rotateY(${angle}deg)`,
          pointerEvents: "none",
        }}>
          {albums.map((a, i) => {
            const itemAngle = i * perItem;
            // Position "facing camera" is when itemAngle + angle ≡ 0 (mod 360)
            const effective = ((itemAngle + angle) % 360 + 360) % 360;
            const delta = effective > 180 ? effective - 360 : effective; // -180..180
            const absDelta = Math.abs(delta);
            const depthOpacity = Math.max(0.35, 1 - absDelta / 180);   // back = dimmer
            const isFront = i === frontIndex;
            const scale = isFront ? 1.08 : 1;
            return (
              <div key={`${a.name}-${i}`} style={{
                position: "absolute",
                inset: 0,
                transformStyle: "preserve-3d",
                transform: `rotateY(${itemAngle}deg) translateZ(${radius}px) scale(${scale})`,
                transition: "transform 0.25s",
              }}>
                <a
                  href={a.url || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    display: "block", width: "100%", height: "100%",
                    borderRadius: 14, overflow: "hidden",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                    opacity: depthOpacity,
                    textDecoration: "none", color: WHITE,
                    pointerEvents: "auto",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {a.image ? (
                    <img src={a.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: CARD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 10, color: WHITE, padding: 12, textAlign: "center" }}>
                      {a.name}
                    </div>
                  )}
                </a>
              </div>
            );
          })}
        </div>

        {/* Edge fades — glassy trailing trend effect */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(to right, rgba(12,12,12,0.95) 0%, rgba(12,12,12,0) 14%, rgba(12,12,12,0) 86%, rgba(12,12,12,0.95) 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(167,139,250,0.10) 0%, rgba(167,139,250,0) 60%)",
        }} />
      </div>

      {/* Footer hint */}
      <div style={{
        position: "relative", zIndex: 3,
        padding: "10px 18px",
        borderTop: `1px solid ${BORDER}`,
        fontSize: 10, color: WHITE, fontFamily: FONT, letterSpacing: "0.04em",
        display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
      }}>
        <span>Drag to spin · releases with inertia · auto-idles</span>
        <span style={{ color: CORAL, fontWeight: 700 }}>{n} albums in rotation</span>
      </div>
    </div>
  );
}

function Sparkline({ data, color = WHITE, width = 120, height = 32 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  // Scale to the actual min/max of the series so small deltas on huge baselines
  // (e.g. 11.1B → 11.2B streams) still show visible movement.
  const numeric = data.filter((v) => typeof v === "number" && isFinite(v));
  if (numeric.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...numeric);
  const min = Math.min(...numeric);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Heatmap: songs (rows) x markets (cols), cell colored by chart position
function ChartHeatmap({ songs, markets }) {
  if (!songs.length || !markets.length) return null;
  const cellW = 30, cellH = 24, labelW = 200, headerH = 60;
  const w = labelW + markets.length * cellW + 20;
  const h = headerH + songs.length * cellH + 10;

  function posColor(pos) {
    if (pos == null) return BG;
    if (pos <= 10) return "#34D399";
    if (pos <= 40) return "#2DD4BF";
    if (pos <= 100) return "#A78BFA";
    return "#555";
  }

  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <svg width={w} height={h} style={{ fontFamily: FONT }}>
        {markets.map((m, i) => (
          <g key={m.code}>
            <text x={labelW + i * cellW + cellW / 2} y={headerH - 8} textAnchor="end" transform={`rotate(-45, ${labelW + i * cellW + cellW / 2}, ${headerH - 8})`} fontSize="10" fill={MUTED}>
              {m.code.toUpperCase()}
            </text>
          </g>
        ))}
        {songs.map((s, rowIdx) => {
          const posByMarket = Object.fromEntries(s.markets.map(m => [m.market, m.position]));
          return (
            <g key={s.name}>
              <text x={labelW - 6} y={headerH + rowIdx * cellH + cellH / 2 + 4} textAnchor="end" fontSize="10.5" fill={WHITE}>
                {s.name.length > 32 ? s.name.slice(0, 30) + "…" : s.name}
              </text>
              {markets.map((m, colIdx) => {
                const pos = posByMarket[m.code];
                return (
                  <g key={m.code}>
                    <rect
                      x={labelW + colIdx * cellW + 1}
                      y={headerH + rowIdx * cellH + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      rx={3}
                      fill={posColor(pos)}
                      opacity={pos == null ? 0.15 : 1}
                    >
                      <title>{`${s.name} — ${m.label}: ${pos ? `#${pos}` : "not charting"}`}</title>
                    </rect>
                    {pos != null && (
                      <text x={labelW + colIdx * cellW + cellW / 2} y={headerH + rowIdx * cellH + cellH / 2 + 3} textAnchor="middle" fontSize="9" fill={BG} fontWeight="700">
                        {pos}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: DIM, fontFamily: FONT }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#34D399", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Top 10</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2DD4BF", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 11–40</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#A78BFA", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 41–100</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#555", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> 101–200</span>
      </div>
    </div>
  );
}

function SimilarArtistsNetwork({ similar }) {
  const size = 560;
  const cx = size / 2, cy = size / 2;
  const centerRadius = 44;

  const artists = useMemo(() => (similar || []).slice(0, 16), [similar]);

  // Rest positions — radial, closer to the centre when match is higher
  const initial = useMemo(() => {
    const maxR = size / 2 - 48;
    return artists.map((a, i) => {
      const angle = (i / Math.max(artists.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const rest = centerRadius + 60 + (1 - a.match) * (maxR - centerRadius - 60);
      return {
        id: a.name,
        name: a.name,
        match: a.match,
        url: a.url,
        rx: cx + Math.cos(angle) * rest,
        ry: cy + Math.sin(angle) * rest,
      };
    });
  }, [artists, cx, cy]);

  const [nodes, setNodes] = useState(() => initial.map(n => ({ ...n, x: n.rx, y: n.ry, vx: 0, vy: 0 })));
  const [draggingId, setDraggingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const dragRef = useRef(null);
  const pointerStartRef = useRef(null);
  const svgRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    setNodes(initial.map(n => ({ ...n, x: n.rx, y: n.ry, vx: 0, vy: 0 })));
  }, [initial]);

  useEffect(() => {
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      setNodes(curr => {
        const next = curr.map(n => ({ ...n }));
        for (let i = 0; i < next.length; i++) {
          const n = next[i];
          if (dragRef.current && dragRef.current.id === n.id) {
            n.x = dragRef.current.x;
            n.y = dragRef.current.y;
            n.vx = 0; n.vy = 0;
            continue;
          }
          // Spring toward rest position
          const dxr = n.rx - n.x, dyr = n.ry - n.y;
          n.vx += dxr * 4.5 * dt;
          n.vy += dyr * 4.5 * dt;
          // Repulsion away from Madonna hub (don't overlap the centre)
          const toX = n.x - cx, toY = n.y - cy;
          const distC = Math.sqrt(toX * toX + toY * toY) || 0.001;
          const clearance = centerRadius + 22;
          if (distC < clearance) {
            const push = (clearance - distC) * 20 * dt;
            n.vx += (toX / distC) * push;
            n.vy += (toY / distC) * push;
          }
          // Repulsion between nodes
          for (let j = 0; j < next.length; j++) {
            if (i === j) continue;
            const m = next[j];
            const dxx = n.x - m.x, dyy = n.y - m.y;
            const d2 = dxx * dxx + dyy * dyy;
            const minD = 54;
            if (d2 > 0.1 && d2 < minD * minD) {
              const d = Math.sqrt(d2);
              const push = (minD - d) * 10 * dt;
              n.vx += (dxx / d) * push;
              n.vy += (dyy / d) * push;
            }
          }
          // Damping + integrate
          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x += n.vx * dt * 60;
          n.y += n.vy * dt * 60;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cx, cy, centerRadius]);

  function toSvgCoords(e) {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * size,
      y: ((e.clientY - r.top) / r.height) * size,
    };
  }
  function onPointerDown(e, node) {
    e.preventDefault();
    const { x, y } = toSvgCoords(e);
    dragRef.current = { id: node.id, x, y };
    pointerStartRef.current = { id: node.id, x, y };
    setDraggingId(node.id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const { x, y } = toSvgCoords(e);
    dragRef.current = { ...dragRef.current, x, y };
  }
  function onPointerUp() {
    // Treat a pointerdown→pointerup with no meaningful movement as a click,
    // so you can tap a node to see its correlation without triggering drag.
    const start = pointerStartRef.current;
    const drag = dragRef.current;
    if (start && drag) {
      const dx = drag.x - start.x;
      const dy = drag.y - start.y;
      if (Math.hypot(dx, dy) < 6) {
        const clickedId = start.id;
        setSelectedId((prev) => (prev === clickedId ? null : clickedId));
      }
    }
    dragRef.current = null;
    pointerStartRef.current = null;
    setDraggingId(null);
  }

  if (!artists.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640, margin: "0 auto" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, userSelect: "none", touchAction: "none", cursor: draggingId ? "grabbing" : "default" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Links to Madonna */}
        {nodes.map(n => {
          const op = 0.25 + (n.match || 0) * 0.75;
          return (
            <line key={`L-${n.id}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke={PURPLE} strokeWidth={(n.match || 0) * 2 + 0.3} opacity={op} />
          );
        })}
        {/* Madonna hub */}
        <circle cx={cx} cy={cy} r={centerRadius} fill={Y} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={BG}>Madonna</text>
        {/* Artist nodes */}
        {nodes.map(n => {
          const op = 0.4 + (n.match || 0) * 0.6;
          const r = 6 + (n.match || 0) * 10;
          const active = draggingId === n.id;
          const selected = selectedId === n.id;
          return (
            <g key={n.id} style={{ cursor: active ? "grabbing" : "pointer" }} onPointerDown={(e) => onPointerDown(e, n)}>
              <circle cx={n.x} cy={n.y} r={r + 14} fill="transparent" pointerEvents="all" />
              <circle cx={n.x} cy={n.y} r={r} fill={PURPLE} opacity={active || selected ? 1 : op}
                stroke={active || selected ? WHITE : "none"} strokeWidth={active || selected ? 2 : 0}>
                <title>{`${n.name} — ${Math.round((n.match || 0) * 100)}% match`}</title>
              </circle>
              <text x={n.x} y={n.y - (r + 8)} textAnchor="middle" fontSize="11" fill={WHITE} style={{ pointerEvents: "none" }}>{n.name}</text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 10, color: WHITE, textAlign: "center", margin: "8px 0 0", fontFamily: FONT }}>
        Click a node for details — drag to reposition
      </p>
      {(() => {
        if (!selectedId) return null;
        const idx = artists.findIndex((a) => a.name === selectedId);
        if (idx < 0) return null;
        const a = artists[idx];
        const matchPct = Math.round((a.match || 0) * 100);
        const rank = idx + 1;
        const rankLabel = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
        return (
          <div style={{
            marginTop: 12, background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${PURPLE}`,
            borderRadius: 8, padding: "14px 16px", fontFamily: FONT,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Similarity detail</div>
                <div style={{ fontSize: 18, color: WHITE, fontWeight: 700, marginTop: 4 }}>{a.name}</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: `${PURPLE}22`, border: `1px solid ${PURPLE}66`, borderRadius: 6, padding: "6px 12px", textAlign: "center", minWidth: 84 }}>
                  <div style={{ fontSize: 9, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Match</div>
                  <div style={{ fontSize: 20, color: WHITE, fontWeight: 800 }}>{matchPct}%</div>
                </div>
                <div style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", textAlign: "center", minWidth: 84 }}>
                  <div style={{ fontSize: 9, color: WHITE, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: 0.8 }}>Rank</div>
                  <div style={{ fontSize: 18, color: WHITE, fontWeight: 700 }}>{rankLabel}</div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: WHITE, lineHeight: 1.55, margin: "10px 0 0" }}>
              Last.fm scores {a.name} at <b>{matchPct}%</b> similarity to Madonna — the {rankLabel} strongest co-listening overlap in her similar-artist graph. The match score is derived from users who play both: the higher it is, the more routinely a Madonna fan also spins {a.name}.
            </p>
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer noopener" style={{
                display: "inline-block", marginTop: 10, fontSize: 11, color: PURPLE, textDecoration: "none",
                border: `1px solid ${PURPLE}66`, borderRadius: 6, padding: "4px 10px", fontWeight: 700,
              }}>
                Open on Last.fm →
              </a>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default function MusicIntelligence() {
  const [apple, setApple] = useState(null);
  const [lastfm, setLastfm] = useState(null);
  const [kworb, setKworb] = useState(null);
  const [marketIndex, setMarketIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force) => {
    setRefreshing(true);
    const q = force ? "?refresh=1" : "";
    const [a, l, k, ms] = await Promise.all([
      fetch(`/api/apple-charts${q}`).then(r => r.json()).catch(() => ({ error: true })),
      fetch(`/api/lastfm${q}`).then(r => r.json()).catch(() => ({ error: true })),
      fetch(`/api/kworb${q}`).then(r => r.json()).catch(() => ({ error: true })),
      fetch(`/api/market-strength${q}`).then(r => r.json()).catch(() => ({ error: true })),
    ]);
    setApple(a);
    setLastfm(l);
    setKworb(k);
    setMarketIndex(ms);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(false); }, []);

  if (loading) {
    return (
      <div>
        <KpiStripSkeleton count={4} />
        <PanelSkeleton rows={4} accent={GREEN} />
        <PanelSkeleton rows={6} accent={PURPLE} />
      </div>
    );
  }

  const songHits = apple?.totalSongHits;
  const albumHits = apple?.totalAlbumHits;
  const marketsCharting = apple?.marketsCharting;

  // Composite Market Strength Index (Apple + Last.fm + kworb per-country), sorted
  const strengthMarkets = (marketIndex?.markets || []).filter(m => m.total > 0);
  const maxStrength = Math.max(1, ...strengthMarkets.map(m => m.total));

  // Build { date, value } series for the Trend panel from the stored history.
  // Each kworb / apple history entry carries an ISO date plus the value. We
  // append the latest live value so the line always reaches "now".
  function buildSeries(history, valueKey, liveValue) {
    const rows = [...(history || [])]
      .reverse()
      .filter((h) => h?.date && h?.[valueKey] != null)
      .map((h) => ({ date: h.date, value: h[valueKey] }));
    if (liveValue != null) {
      const today = new Date().toISOString();
      if (!rows.find((r) => r.date.slice(0, 10) === today.slice(0, 10))) {
        rows.push({ date: today, value: liveValue });
      } else {
        rows[rows.length - 1] = { ...rows[rows.length - 1], value: liveValue };
      }
    }
    return rows;
  }
  const spotifyTrend = buildSeries(kworb?.history, "totalStreams", kworb?.totalStreams);
  const appleTrend = buildSeries(apple?.history, "totalSongHits", songHits);

  function trendStats(series) {
    if (!series.length) return { count: 0, delta: 0, pct: null };
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const delta = last - first;
    const pct = first > 0 ? (delta / first) * 100 : null;
    return { count: series.length, delta, pct };
  }
  const spotifyStats = trendStats(spotifyTrend);
  const appleStats = trendStats(appleTrend);
  const showSpotifyTrend = spotifyTrend.length >= 2;
  const showAppleTrend = appleTrend.length >= 2 && appleStats.delta !== 0;

  const maxTrackPlaycount = Math.max(1, ...((lastfm?.topTracks || []).map(t => t.playcount || 0)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: FONT, letterSpacing: "-0.01em" }}>Music intelligence</h2>
          <p style={{ fontSize: 12, color: WHITE, margin: 0, fontFamily: FONT }}>
            Spotify streams (kworb) · Apple Music chart trending (15 markets) · Last.fm weekly trending
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{
          padding: "6px 16px", fontSize: 10, fontWeight: 700, color: refreshing ? MUTED : BG,
          background: refreshing ? BORDER : PURPLE, border: "none", borderRadius: 6, cursor: refreshing ? "default" : "pointer",
          fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>

      {lastfm?.configured === false && (
        <div style={{ background: `${RED}11`, border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: DIM, fontFamily: FONT }}>
          <b style={{ color: RED }}>Last.fm not configured.</b> Add <code style={{ color: WHITE, background: BG, padding: "1px 5px", borderRadius: 3 }}>LASTFM_API_KEY</code> to Vercel env vars and redeploy. Top tracks, fan tags, and similar-artists panels will populate once the key is live.
        </div>
      )}

      {/* KPI strip */}
      <div className="kpi-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        <Kpi label="Spotify streams (all-time)" value={kworb?.totalStreams != null ? fmt(kworb.totalStreams) : "—"} sub={kworb?.error ? "kworb unavailable" : "kworb.net · full catalogue"} color={GREEN} delta={kworb?.momentum?.totalStreamsChange} />
        <Kpi label="Spotify streams (daily)" value={kworb?.dailyStreams ? fmt(kworb.dailyStreams) : "—"} sub={kworb?.trackCount ? `across ${kworb.trackCount} tracks` : ""} color={PINK} delta={kworb?.momentum?.dailyStreamsChange} />
        <Kpi label="Apple song chart hits" value={songHits != null ? songHits : "—"} sub={marketsCharting != null ? `${marketsCharting} markets charting` : ""} color={PURPLE} delta={apple?.momentum?.totalSongHitsChange} />
        <Kpi label="Apple album chart hits" value={albumHits != null ? albumHits : "—"} sub={apple?.albumAggregate?.length != null ? `${apple.albumAggregate.length} albums in charts` : ""} color={CORAL} delta={apple?.momentum?.totalAlbumHitsChange} />
      </div>

      {/* Trend slot — now a circular album carousel. Glassy ring, live
          trending banner above, drag-to-spin with inertia + auto-idle. */}
      {(lastfm?.topAlbums || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <CircularAlbumCarousel albums={(lastfm.topAlbums || []).slice(0, 12)} />
        </div>
      )}

      {/* Spotify streams (kworb) */}
      {kworb?.tracks?.length > 0 && (
        <Panel title="Spotify most-streamed tracks" subtitle={`${fmt(kworb.totalStreams)} all-time streams · ${fmt(kworb.dailyStreams)}/day across catalogue (source: kworb.net)`} accent={GREEN}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {kworb.tracks.slice(0, 20).map((t, i) => {
              const maxTotal = Math.max(1, ...kworb.tracks.map(x => x.total || 0));
              const pct = Math.max(2, (t.total / maxTotal) * 100);
              return (
                <a key={`${t.name}-${i}`} href={t.url || "#"} target="_blank" rel="noreferrer noopener" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderBottom: `1px solid ${BORDER}`, textDecoration: "none", color: WHITE }}>
                  <span style={{ fontSize: 11, color: MUTED, minWidth: 22, fontFamily: FONT }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                    <div style={{ background: BG, borderRadius: 2, height: 5, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: GREEN }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 70 }}>
                    <div style={{ fontSize: 12, color: WHITE, fontFamily: FONT, fontWeight: 700 }}>{fmt(t.total)}</div>
                    {t.daily != null && <div style={{ fontSize: 9, color: DIM, fontFamily: FONT }}>{fmt(t.daily)}/day</div>}
                  </div>
                </a>
              );
            })}
          </div>
          {kworb.note && <p style={{ fontSize: 10, color: DIM, margin: "12px 0 0", fontFamily: FONT, fontStyle: "italic" }}>{kworb.note}</p>}
        </Panel>
      )}

      {kworb?.error && (
        <div style={{ background: `${AMBER}11`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: DIM, fontFamily: FONT }}>
          <b style={{ color: AMBER }}>Kworb unavailable:</b> {kworb.error}. Spotify stream counts will return when the scraper recovers.
        </div>
      )}

      {/* Trending — Last.fm + Apple side by side */}
      {(lastfm?.trending?.rising?.length > 0 || apple?.trending?.rising?.length > 0 || apple?.trending?.new?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {/* Last.fm weekly trending */}
          {lastfm?.trending?.rising?.length > 0 && (
            <Panel title="Last.fm — weekly trending" subtitle={`Rising vs previous week (Last.fm scrobble signal)`} accent={TEAL}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lastfm.trending.rising.slice(0, 8).map((t, i) => (
                  <a key={`${t.name}-${i}`} href={t.url || "#"} target="_blank" rel="noreferrer noopener" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < 7 ? `1px solid ${BORDER}` : "none", textDecoration: "none", color: WHITE }}>
                    <span style={{ fontSize: 11, color: MUTED, minWidth: 20, fontFamily: FONT }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: DIM, fontFamily: FONT }}>{t.plays} plays {t.prevPlays > 0 ? `(was ${t.prevPlays})` : "(new entry)"}</div>
                    </div>
                    <div style={{ background: t.isNew ? `${Y}22` : `${GREEN}22`, color: t.isNew ? Y : GREEN, border: `1px solid ${t.isNew ? Y : GREEN}55`, padding: "3px 8px", borderRadius: 6, fontFamily: FONT, fontSize: 10, fontWeight: 800 }}>
                      {t.isNew ? "NEW" : `+${t.deltaPct}%`}
                    </div>
                  </a>
                ))}
              </div>
            </Panel>
          )}

          {/* Apple chart trending */}
          {(apple?.trending?.rising?.length > 0 || apple?.trending?.new?.length > 0) ? (
            <Panel title="Apple Music — chart climbers" subtitle={apple.trending.hasBaseline ? "Tracks improving position or market count vs last snapshot" : "Building baseline — climbers appear after next snapshot"} accent={GREEN}>
              {apple.trending.rising.length > 0 && (
                <div style={{ marginBottom: apple.trending.new.length > 0 ? 12 : 0 }}>
                  {apple.trending.rising.slice(0, 6).map((t, i) => (
                    <a key={`R-${t.name}-${i}`} href={t.url} target="_blank" rel="noreferrer noopener" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${BORDER}`, textDecoration: "none", color: WHITE }}>
                      {t.artwork && <img src={t.artwork} alt="" width={32} height={32} style={{ borderRadius: 4 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: DIM, fontFamily: FONT }}>#{t.prevBestPosition} → #{t.bestPosition} · {t.prevMarketCount} → {t.marketCount} markets</div>
                      </div>
                      <div style={{ background: `${GREEN}22`, color: GREEN, border: `1px solid ${GREEN}55`, padding: "3px 8px", borderRadius: 6, fontFamily: FONT, fontSize: 10, fontWeight: 800 }}>
                        {t.posDelta > 0 ? `↑${t.posDelta}` : `+${t.marketDelta} mkts`}
                      </div>
                    </a>
                  ))}
                </div>
              )}
              {apple.trending.new.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: Y, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: FONT, fontWeight: 700 }}>New entries</div>
                  {apple.trending.new.slice(0, 4).map((t, i) => (
                    <a key={`N-${t.name}-${i}`} href={t.url} target="_blank" rel="noreferrer noopener" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < Math.min(3, apple.trending.new.length - 1) ? `1px solid ${BORDER}` : "none", textDecoration: "none", color: WHITE }}>
                      {t.artwork && <img src={t.artwork} alt="" width={32} height={32} style={{ borderRadius: 4 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: DIM, fontFamily: FONT }}>#{t.bestPosition} · {t.marketCount} markets</div>
                      </div>
                      <div style={{ background: `${Y}22`, color: Y, border: `1px solid ${Y}55`, padding: "3px 8px", borderRadius: 6, fontFamily: FONT, fontSize: 10, fontWeight: 800 }}>NEW</div>
                    </a>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
        </div>
      )}

      {/* Apple Music: chart heatmap */}
      {apple && !apple.error && apple.songAggregate?.length > 0 && (
        <Panel title="Apple Music — song chart heatmap" subtitle={`Madonna tracks in top-200 across ${apple.markets?.length || 15} markets`} accent={GREEN}>
          <ChartHeatmap songs={apple.songAggregate.slice(0, 20)} markets={apple.markets} />
        </Panel>
      )}

      {/* Apple: best positions */}
      {apple?.bestPositions?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Panel title="Best chart positions" subtitle="Sorted by position across every chart and market" accent={GREEN}>
            <div className="scroll-fade" style={{ maxHeight: 360, overflowY: "auto" }}>
              {apple.bestPositions.slice(0, 12).map((p, i) => (
                <a key={`${p.market}-${p.name}-${i}`} href={p.url} target="_blank" rel="noreferrer noopener" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: `1px solid ${BORDER}`,
                  textDecoration: "none", color: WHITE,
                }}>
                  {p.artwork && <img src={p.artwork} alt="" width={40} height={40} style={{ borderRadius: 4 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{p.marketFlag} {p.marketLabel} · {p.chart}</div>
                  </div>
                  <div style={{
                    background: p.position <= 10 ? GREEN : p.position <= 40 ? TEAL : p.position <= 100 ? PURPLE : "#555",
                    color: BG, padding: "4px 10px", borderRadius: 6, fontFamily: FONT, fontSize: 12, fontWeight: 800,
                  }}>#{p.position}</div>
                </a>
              ))}
            </div>
          </Panel>

          <Panel title="Album chart presence" subtitle={`${apple.totalAlbumHits || 0} album appearances across markets`} accent={PINK}>
            <div className="scroll-fade" style={{ maxHeight: 360, overflowY: "auto" }}>
              {(apple.albumAggregate || []).slice(0, 10).map((a, i) => (
                <a key={`${a.name}-${i}`} href={a.url} target="_blank" rel="noreferrer noopener" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: `1px solid ${BORDER}`,
                  textDecoration: "none", color: WHITE,
                }}>
                  {a.artwork && <img src={a.artwork} alt="" width={40} height={40} style={{ borderRadius: 4 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT }}>{a.marketCount} markets · best #{a.bestPosition}</div>
                  </div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 120 }}>
                    {a.markets.slice(0, 8).map(m => (
                      <span key={m.market} title={`${m.marketLabel} #${m.position}`} style={{ fontSize: 10, fontFamily: FONT }}>{m.marketFlag}</span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Universal Market Strength — Apple + Last.fm + kworb composite */}
      {strengthMarkets.length > 0 && (
        <Panel title="Market strength index" subtitle="Composite 0–100 score per market — Apple chart presence (30) + Last.fm local rank (30) + Kworb Spotify daily streams (40)" accent={TEAL}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, rowGap: 12 }}>
            {strengthMarkets.map((m) => {
              const pctTotal = Math.max(3, (m.total / maxStrength) * 100);
              const applePct = m.total > 0 ? (m.appleScore / m.total) * pctTotal : 0;
              const lastfmPct = m.total > 0 ? (m.lastfmScore / m.total) * pctTotal : 0;
              const kworbPct = m.total > 0 ? (m.kworbScore / m.total) * pctTotal : 0;
              const deltaColor = m.delta == null ? MUTED : m.delta > 0 ? GREEN : m.delta < 0 ? RED : MUTED;
              const deltaGlyph = m.delta == null ? "" : m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "→";
              return (
                <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, minWidth: 26 }}>{m.flag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: WHITE, fontFamily: FONT, fontWeight: 600 }}>{m.label}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                        {m.delta != null && (
                          <span style={{ fontSize: 9, color: deltaColor, fontFamily: FONT, fontWeight: 700 }}>{deltaGlyph}{Math.abs(m.delta)}</span>
                        )}
                        <span style={{ fontSize: 13, color: TEAL, fontFamily: FONT, fontWeight: 800 }}>{m.total}</span>
                      </span>
                    </div>
                    <div
                      title={`Apple: ${m.appleScore}/30 (${m.apple_entries} chart entries)\nLast.fm rank: ${m.lastfm_rank ? `#${m.lastfm_rank}` : "unranked"} → ${m.lastfmScore}/30\nKworb Spotify: ${m.kworb_daily_streams.toLocaleString()} daily streams across ${m.kworb_track_count} tracks → ${m.kworbScore}/40`}
                      style={{ background: BG, borderRadius: 2, height: 8, overflow: "hidden", display: "flex" }}
                    >
                      {m.appleScore > 0 && <div style={{ width: `${applePct}%`, height: "100%", background: PURPLE }} />}
                      {m.lastfmScore > 0 && <div style={{ width: `${lastfmPct}%`, height: "100%", background: TEAL }} />}
                      {m.kworbScore > 0 && <div style={{ width: `${kworbPct}%`, height: "100%", background: GREEN }} />}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 9, color: DIM, fontFamily: FONT }}>
                      <span style={{ color: PURPLE }}>Apple {m.appleScore}</span>
                      <span style={{ color: TEAL }}>Last.fm {m.lastfmScore}{m.lastfm_rank ? ` (#${m.lastfm_rank})` : ""}</span>
                      <span style={{ color: GREEN }}>Spotify {m.kworbScore}{m.kworb_daily_streams > 0 ? ` (${fmt(m.kworb_daily_streams)}/d)` : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 10, color: DIM, fontFamily: FONT, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: PURPLE, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Apple charts</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: TEAL, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Last.fm rank</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /> Kworb Spotify streams</span>
            </div>
            <span style={{ fontStyle: "italic" }}>
              {marketIndex?.hasBaseline ? `Δ vs ${marketIndex.previousSnapshotAt ? new Date(marketIndex.previousSnapshotAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "last snapshot"}` : "Building baseline — deltas appear on next refresh"}
            </span>
          </div>
        </Panel>
      )}

      {/* Top tracks + tags */}
      {(lastfm?.topTracks?.length > 0 || lastfm?.topTags?.length > 0) && (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        {lastfm?.topTracks?.length > 0 && (
        <Panel title="Top tracks on Last.fm" subtitle="By all-time playcount" accent={PURPLE}>
          {(lastfm?.topTracks || []).slice(0, 10).map((t, i) => (
            <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: i < 9 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 11, color: MUTED, minWidth: 20, fontFamily: FONT }}>#{i + 1}</span>
              {t.albumImage && <img src={t.albumImage} alt="" width={32} height={32} style={{ borderRadius: 4 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: WHITE, fontFamily: FONT, fontWeight: 600 }}>{t.name}</div>
                {t.album && <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>{t.album}</div>}
              </div>
              <div style={{ minWidth: 100, display: "flex", alignItems: "center", gap: 6 }}>
                <HorizontalBar value={t.playcount || 0} max={maxTrackPlaycount} color={PURPLE} />
                <span style={{ fontSize: 10, color: DIM, fontFamily: FONT, minWidth: 44, textAlign: "right" }}>{fmt(t.playcount)}</span>
              </div>
            </div>
          ))}
        </Panel>
        )}

        {lastfm?.topTags?.length > 0 && (
        <Panel title="Fan tags" subtitle="Most-applied Last.fm tags" accent={AMBER}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(lastfm?.topTags || []).slice(0, 24).map(t => {
              const maxCount = Math.max(1, ...(lastfm.topTags || []).map(x => x.count || 0));
              const scale = Math.max(0.8, Math.min(1.25, (t.count || 0) / maxCount + 0.5));
              return (
                <span key={t.name} style={{
                  fontSize: `${12 * scale}px`, padding: "5px 11px", borderRadius: 20,
                  background: `${AMBER}1a`, border: `1px solid ${AMBER}55`,
                  color: WHITE, fontFamily: FONT, fontWeight: 600,
                }}>{t.name}</span>
              );
            })}
          </div>
        </Panel>
        )}
      </div>
      )}

      {/* Similar artists network */}
      {(lastfm?.similarArtists || []).length > 0 && (
        <Panel title="Artists fans also play" subtitle="Similarity network — larger = stronger co-listening overlap" accent={PURPLE}>
          <SimilarArtistsNetwork similar={lastfm.similarArtists} />
        </Panel>
      )}

      {/* New releases */}
      {apple?.newReleases?.length > 0 && (
        <Panel title="New releases featuring Madonna" subtitle={`${apple.newReleases.length} appearances in market new-release feeds`} accent={Y}>
          <div className="kpi-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {apple.newReleases.slice(0, 8).map((r, i) => (
              <a key={`${r.market}-${r.name}-${i}`} href={r.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none", color: WHITE }}>
                {r.artwork && <img src={r.artwork} alt="" style={{ width: "100%", aspectRatio: "1/1", borderRadius: 6, display: "block" }} />}
                <div style={{ fontSize: 11, color: WHITE, marginTop: 6, fontFamily: FONT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>{r.marketFlag} {r.marketLabel} · #{r.position}</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

    </div>
  );
}
