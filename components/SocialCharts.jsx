import React, { useState } from "react";

const FONT = "'Inter Tight', system-ui, sans-serif";
const WHITE = "#EDEDE8";
const MUTED = "#777";
const DIM = "#999";
const BORDER = "#222";
const CARD = "#151515";
const BG = "#0C0C0C";

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function linspace(min, max, count) {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

// ---------------------------------------------------------------------------
// 1. DualLineChart
// ---------------------------------------------------------------------------
export function DualLineChart({ data = [], height = 200 }) {
  const [hover, setHover] = useState(null);

  if (!data.length) return null;

  const pad = { top: 20, right: 56, bottom: 48, left: 56 };
  const width = 600;
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const mentions = data.map((d) => d.mentions);
  const reaches = data.map((d) => d.reach);

  const mMin = 0;
  const mMax = Math.max(...mentions) || 1;
  const rMin = 0;
  const rMax = Math.max(...reaches) || 1;

  const xStep = data.length > 1 ? cw / (data.length - 1) : 0;

  const toMY = (v) => pad.top + ch - (ch * (v - mMin)) / (mMax - mMin || 1);
  const toRY = (v) => pad.top + ch - (ch * (v - rMin)) / (rMax - rMin || 1);
  const toX = (i) => pad.left + i * xStep;

  const mPoints = data.map((d, i) => `${toX(i)},${toMY(d.mentions)}`).join(" ");
  const rPoints = data.map((d, i) => `${toX(i)},${toRY(d.reach)}`).join(" ");

  const gridCount = 5;
  const mTicks = linspace(mMin, mMax, gridCount);
  const rTicks = linspace(rMin, rMax, gridCount);

  return (
    <div style={{ background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 16 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ overflow: "visible", fontFamily: FONT }}
      >
        {/* grid lines */}
        {mTicks.map((v, i) => {
          const y = toMY(v);
          return (
            <line key={i} x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={BORDER} strokeWidth={1} />
          );
        })}

        {/* left Y axis labels (mentions) */}
        {mTicks.map((v, i) => (
          <text key={i} x={pad.left - 8} y={toMY(v)} textAnchor="end" dominantBaseline="middle" fill="#A78BFA" fontSize={10}>
            {fmt(Math.round(v))}
          </text>
        ))}

        {/* right Y axis labels (reach) */}
        {rTicks.map((v, i) => (
          <text key={i} x={width - pad.right + 8} y={toRY(v)} textAnchor="start" dominantBaseline="middle" fill="#34D399" fontSize={10}>
            {fmt(Math.round(v))}
          </text>
        ))}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={height - pad.bottom + 16} textAnchor="middle" fill={MUTED} fontSize={9}>
            {d.date}
          </text>
        ))}

        {/* lines */}
        <polyline points={mPoints} fill="none" stroke="#A78BFA" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={rPoints} fill="none" stroke="#34D399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* data point circles */}
        {data.map((d, i) => (
          <React.Fragment key={i}>
            <circle cx={toX(i)} cy={toMY(d.mentions)} r={3} fill="#A78BFA" />
            <circle cx={toX(i)} cy={toRY(d.reach)} r={3} fill="#34D399" />
          </React.Fragment>
        ))}

        {/* hover overlay rects */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - xStep / 2}
            y={pad.top}
            width={xStep || cw}
            height={ch}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* tooltip */}
        {hover !== null && (
          <g>
            <line x1={toX(hover)} x2={toX(hover)} y1={pad.top} y2={pad.top + ch} stroke={DIM} strokeWidth={1} strokeDasharray="3,3" />
            <rect
              x={toX(hover) + 8}
              y={Math.min(toMY(data[hover].mentions), toRY(data[hover].reach)) - 36}
              width={130}
              height={48}
              rx={4}
              fill={BG}
              stroke={BORDER}
            />
            <text
              x={toX(hover) + 16}
              y={Math.min(toMY(data[hover].mentions), toRY(data[hover].reach)) - 18}
              fill="#A78BFA"
              fontSize={11}
            >
              Mentions: {fmt(data[hover].mentions)}
            </text>
            <text
              x={toX(hover) + 16}
              y={Math.min(toMY(data[hover].mentions), toRY(data[hover].reach)) + 0}
              fill="#34D399"
              fontSize={11}
            >
              Reach: {fmt(data[hover].reach)}
            </text>
          </g>
        )}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 4, fontFamily: FONT, fontSize: 11 }}>
        <span style={{ color: "#A78BFA" }}>&mdash; Mentions</span>
        <span style={{ color: "#34D399" }}>&mdash; Reach</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. SentimentLineChart
// ---------------------------------------------------------------------------
export function SentimentLineChart({ data = [], height = 180 }) {
  const [hover, setHover] = useState(null);

  if (!data.length) return null;

  const pad = { top: 20, right: 24, bottom: 48, left: 48 };
  const width = 600;
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const allVals = data.flatMap((d) => [d.positive, d.negative]);
  const yMin = 0;
  const yMax = Math.max(...allVals) || 1;

  const xStep = data.length > 1 ? cw / (data.length - 1) : 0;
  const toY = (v) => pad.top + ch - (ch * (v - yMin)) / (yMax - yMin || 1);
  const toX = (i) => pad.left + i * xStep;

  const posPoints = data.map((d, i) => `${toX(i)},${toY(d.positive)}`).join(" ");
  const negPoints = data.map((d, i) => `${toX(i)},${toY(d.negative)}`).join(" ");

  const posArea =
    `${toX(0)},${toY(0)} ` + posPoints + ` ${toX(data.length - 1)},${toY(0)}`;
  const negArea =
    `${toX(0)},${toY(0)} ` + negPoints + ` ${toX(data.length - 1)},${toY(0)}`;

  const gridCount = 5;
  const yTicks = linspace(yMin, yMax, gridCount);

  return (
    <div style={{ background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 16 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ overflow: "visible", fontFamily: FONT }}
      >
        {/* grid */}
        {yTicks.map((v, i) => {
          const y = toY(v);
          return (
            <line key={i} x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={BORDER} strokeWidth={1} />
          );
        })}

        {/* Y axis labels */}
        {yTicks.map((v, i) => (
          <text key={i} x={pad.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fill={DIM} fontSize={10}>
            {fmt(Math.round(v))}
          </text>
        ))}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={height - pad.bottom + 16} textAnchor="middle" fill={MUTED} fontSize={9}>
            {d.date}
          </text>
        ))}

        {/* area fills */}
        <polygon points={posArea} fill="#34D399" opacity={0.1} />
        <polygon points={negArea} fill="#EF4444" opacity={0.1} />

        {/* lines */}
        <polyline points={posPoints} fill="none" stroke="#34D399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={negPoints} fill="none" stroke="#EF4444" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* data points */}
        {data.map((d, i) => (
          <React.Fragment key={i}>
            <circle cx={toX(i)} cy={toY(d.positive)} r={3} fill="#34D399" />
            <circle cx={toX(i)} cy={toY(d.negative)} r={3} fill="#EF4444" />
          </React.Fragment>
        ))}

        {/* hover overlay */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - xStep / 2}
            y={pad.top}
            width={xStep || cw}
            height={ch}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {hover !== null && (
          <g>
            <line x1={toX(hover)} x2={toX(hover)} y1={pad.top} y2={pad.top + ch} stroke={DIM} strokeWidth={1} strokeDasharray="3,3" />
            <rect
              x={toX(hover) + 8}
              y={Math.min(toY(data[hover].positive), toY(data[hover].negative)) - 36}
              width={130}
              height={48}
              rx={4}
              fill={BG}
              stroke={BORDER}
            />
            <text
              x={toX(hover) + 16}
              y={Math.min(toY(data[hover].positive), toY(data[hover].negative)) - 18}
              fill="#34D399"
              fontSize={11}
            >
              Positive: {fmt(data[hover].positive)}
            </text>
            <text
              x={toX(hover) + 16}
              y={Math.min(toY(data[hover].positive), toY(data[hover].negative)) + 0}
              fill="#EF4444"
              fontSize={11}
            >
              Negative: {fmt(data[hover].negative)}
            </text>
          </g>
        )}
      </svg>

      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 4, fontFamily: FONT, fontSize: 11 }}>
        <span style={{ color: "#34D399" }}>&mdash; Positive</span>
        <span style={{ color: "#EF4444" }}>&mdash; Negative</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. DonutChart
// ---------------------------------------------------------------------------
export function DonutChart({ segments = [], size = 160 }) {
  if (!segments.length) return null;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const pad = 20; // padding to prevent clipping
  const svgSize = size + pad * 2;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const strokeWidth = radius * 0.32;

  let cumulativeOffset = 0;

  return (
    <div
      style={{
        background: CARD,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const offset = -cumulativeOffset;
          cumulativeOffset += dash;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.3s" }}
            />
          );
        })}

        {/* center text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={WHITE}
          fontSize={20}
          fontWeight={600}
          fontFamily={FONT}
        >
          {fmt(total)}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={MUTED}
          fontSize={10}
          fontFamily={FONT}
        >
          total
        </text>
      </svg>

      {/* labels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT, fontSize: 12 }}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: WHITE }}>
                {seg.label}: <span style={{ color: DIM }}>{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. StackedBarChart
// ---------------------------------------------------------------------------
export function StackedBarChart({ data = [], height = 200 }) {
  if (!data.length) return null;

  const pad = { top: 16, right: 16, bottom: 56, left: 44 };
  const width = 600;
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map((d) => d.positive + d.neutral + d.negative)) || 1;
  const barWidth = Math.min(36, (cw / data.length) * 0.6);
  const barGap = cw / data.length;

  const gridCount = 5;
  const yTicks = linspace(0, maxVal, gridCount);
  const toY = (v) => pad.top + ch - (ch * v) / maxVal;

  return (
    <div style={{ background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 16 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ overflow: "visible", fontFamily: FONT }}
      >
        {/* grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.left} x2={width - pad.right} y1={toY(v)} y2={toY(v)} stroke={BORDER} strokeWidth={1} />
            <text x={pad.left - 8} y={toY(v)} textAnchor="end" dominantBaseline="middle" fill={DIM} fontSize={10}>
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, i) => {
          const cx = pad.left + barGap * i + barGap / 2;
          const x = cx - barWidth / 2;

          const negH = (d.negative / maxVal) * ch;
          const neuH = (d.neutral / maxVal) * ch;
          const posH = (d.positive / maxVal) * ch;

          const negY = pad.top + ch - negH;
          const neuY = negY - neuH;
          const posY = neuY - posH;

          return (
            <g key={i}>
              <rect x={x} y={negY} width={barWidth} height={Math.max(negH, negH > 0 ? 2 : 0)} fill="#EF4444" rx={2} />
              <rect x={x} y={neuY} width={barWidth} height={Math.max(neuH, neuH > 0 ? 2 : 0)} fill="#555" rx={0} />
              <rect x={x} y={posY} width={barWidth} height={Math.max(posH, posH > 0 ? 2 : 0)} fill="#34D399" rx={2} />

              {/* x label */}
              <text
                x={cx}
                y={pad.top + ch + 8}
                textAnchor="end"
                fill={MUTED}
                fontSize={9}
                transform={`rotate(-35 ${cx} ${pad.top + ch + 8})`}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4, fontFamily: FONT, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#34D399" }} />
          <span style={{ color: WHITE }}>Positive</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#555" }} />
          <span style={{ color: WHITE }}>Neutral</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#EF4444" }} />
          <span style={{ color: WHITE }}>Negative</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. WordCloud — flex-wrap tag cloud (readable, no overlapping)
// ---------------------------------------------------------------------------
export function WordCloud({ words = [], showSentiment = true }) {
  const [sentVisible, setSentVisible] = useState(showSentiment);
  if (!words.length) return null;

  const maxWeight = Math.max(...words.map((w) => w.weight)) || 1;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
        {words.slice(0, 30).map((w, i) => {
          const norm = (w.weight || 0) / maxWeight;
          const fontSize = Math.max(11, Math.min(28, 11 + norm * 17));
          const opacity = 0.5 + norm * 0.5;
          const color = sentVisible
            ? (w.sentiment > 0 ? "#34D399" : w.sentiment < 0 ? "#EF4444" : WHITE)
            : WHITE;
          // Truncate long topic names
          const label = (w.text || "").length > 25 ? (w.text || "").slice(0, 22) + "..." : (w.text || "");

          return (
            <span key={i} title={`${w.text}: ${w.weight} mentions`} style={{
              fontSize, opacity, color,
              fontWeight: norm > 0.5 ? 700 : 500,
              fontFamily: FONT, padding: "2px 4px",
              lineHeight: 1.2, cursor: "default",
            }}>
              {label}
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={() => setSentVisible(!sentVisible)} style={{
          fontSize: 9, color: MUTED, background: "none", border: `1px solid ${BORDER}`,
          borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: FONT,
        }}>
          {sentVisible ? "Hide" : "Show"} sentiment
        </button>
      </div>
    </div>
  );
}
