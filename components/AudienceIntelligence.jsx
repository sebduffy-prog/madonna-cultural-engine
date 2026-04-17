import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const DocUploader = dynamic(() => import("./DocUploader"), { ssr: false });

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const TEAL = "#2DD4BF";
const PURPLE = "#A78BFA";
const CORAL = "#FB923C";
const PINK = "#F472B6";
const GREEN = "#34D399";
const AMBER = "#F59E0B";

const SEGMENTS = [
  { key: "genJones", label: "Gen Jones", color: PURPLE },
  { key: "millennial", label: "Millennial", color: PINK },
  { key: "genX", label: "Gen X", color: CORAL },
  { key: "genZ", label: "Gen Z", color: TEAL },
  { key: "disco", label: "Gay Community", color: Y },
  { key: "fashion", label: "Fashion", color: AMBER },
  { key: "nightlife", label: "General Nightlife", color: GREEN },
];

const SEGMENT_MAP = Object.fromEntries(SEGMENTS.map((s) => [s.key, s]));

const METRIC_OPTIONS = [
  { key: "Index", label: "Index", suffix: "", description: "How much more/less likely vs average (100 = average)" },
  { key: "Column %", label: "Column %", suffix: "%", description: "% of segment that matches this statement" },
  { key: "Row %", label: "Row %", suffix: "%", description: "% of respondents from each segment" },
  { key: "Responses", label: "Responses", suffix: "", description: "Raw response count per segment" },
];

function cleanData(gwiData, metricFilter = "Index") {
  if (!gwiData || !Array.isArray(gwiData)) return [];
  return gwiData.filter((row) => {
    if (!row.name || row.name.trim() === "" || row.name === "Totals") return false;
    if (row.metric && row.metric !== metricFilter) return false;
    const vals = SEGMENTS.map((s) => Number(row[s.key]) || 0);
    if (vals.every((v) => v === 0)) return false;
    // For Index, also filter out all-100 rows
    if (metricFilter === "Index" && vals.every((v) => v === 0 || v === 100)) return false;
    return true;
  });
}

const tabStyle = (active) => ({
  padding: "6px 14px",
  fontSize: 12,
  fontFamily: "'Inter Tight', sans-serif",
  fontWeight: active ? 700 : 500,
  color: active ? BG : DIM,
  background: active ? Y : "transparent",
  border: `1px solid ${active ? Y : BORDER}`,
  borderRadius: 6,
  cursor: "pointer",
  letterSpacing: "0.02em",
  transition: "all 0.2s ease",
  textTransform: "uppercase",
});

const selectStyle = {
  padding: "6px 12px",
  fontSize: 12,
  fontFamily: "'Inter Tight', sans-serif",
  fontWeight: 600,
  color: WHITE,
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  cursor: "pointer",
  outline: "none",
  letterSpacing: "0.02em",
};

/* ─── View 1: Segment Explorer ─── */
function SegmentExplorer({ data, metricSuffix = "" }) {
  const [segKey, setSegKey] = useState("genZ");
  const seg = SEGMENT_MAP[segKey];

  const items = useMemo(() => {
    return data
      .map((row) => ({ name: row.name, question: row.question, index: Number(row[segKey]) || 0 }))
      .filter((d) => d.index > 0 && d.index !== 100)
      .sort((a, b) => b.index - a.index)
      .slice(0, 50);
  }, [data, segKey]);

  const isIndexMetric = metricSuffix === "";
  const maxIndex = useMemo(() => {
    const dataMax = Math.max(...items.map((d) => d.index), 1);
    return isIndexMetric ? Math.max(dataMax, 200) : Math.max(dataMax, 10);
  }, [items, isIndexMetric]);
  const barH = 24;
  const gap = 4;
  const maxLabelChars = 55;
  const labelPad = 12;

  function truncLabel(text) {
    if (text.length <= maxLabelChars) return text;
    return text.slice(0, maxLabelChars - 1) + "\u2026";
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegKey(s.key)}
            style={{
              ...tabStyle(segKey === s.key),
              ...(segKey === s.key ? { background: s.color, borderColor: s.color, color: BG } : {}),
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p style={{ color: MUTED, fontFamily: "'Newsreader', serif", fontSize: 14 }}>
          No statements found for this segment.
        </p>
      ) : (
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: gap }}>
            {items.map((d) => {
              const barW = Math.max(4, (d.index / maxIndex) * 100);
              return (
                <div key={d.name + d.question} style={{ display: "flex", alignItems: "center", gap: 8, height: barH }}>
                  <div style={{
                    flex: "0 0 auto",
                    width: 340,
                    minWidth: 0,
                    fontSize: 11,
                    color: DIM,
                    fontFamily: "'Inter Tight', sans-serif",
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: labelPad,
                  }} title={d.name}>
                    {truncLabel(d.name)}
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: `${barW}%`,
                      height: barH - 4,
                      borderRadius: 3,
                      background: seg.color,
                      opacity: 0.85,
                      transition: "width 0.5s ease, background 0.3s ease",
                      minWidth: 4,
                    }} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: WHITE,
                      fontFamily: "'Inter Tight', sans-serif",
                      flexShrink: 0,
                    }}>
                      {d.index}{metricSuffix}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── View 2: Compare Segments (butterfly chart) ─── */
function CompareSegments({ data, metricSuffix = "" }) {
  const [segA, setSegA] = useState("genZ");
  const [segB, setSegB] = useState("genJones");

  const a = SEGMENT_MAP[segA];
  const b = SEGMENT_MAP[segB];

  const items = useMemo(() => {
    return data
      .map((row) => ({
        name: row.name,
        question: row.question,
        valA: Number(row[segA]) || 0,
        valB: Number(row[segB]) || 0,
      }))
      .filter((d) => {
        if (isIndexMetric) return (d.valA > 0 && d.valA !== 100) || (d.valB > 0 && d.valB !== 100);
        return d.valA > 0 || d.valB > 0;
      })
      .sort((x, y) => Math.max(y.valA, y.valB) - Math.max(x.valA, x.valB))
      .slice(0, 30);
  }, [data, segA, segB]);

  const isIndexMetric = metricSuffix === "";
  const maxVal = useMemo(() => {
    const dataMax = Math.max(...items.map((d) => Math.max(d.valA, d.valB)), 1);
    return isIndexMetric ? Math.max(dataMax, 200) : Math.max(dataMax, 10);
  }, [items, isIndexMetric]);
  const barH = 26;
  const gap = 4;
  const sideW = 200;
  const centerW = 320;
  const svgW = sideW + centerW + sideW;
  const svgH = items.length * (barH + gap) + 30;
  const centerX = sideW + centerW / 2;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select style={selectStyle} value={segA} onChange={(e) => setSegA(e.target.value)}>
          {SEGMENTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <span style={{ color: MUTED, fontSize: 12, fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>vs</span>
        <select style={selectStyle} value={segB} onChange={(e) => setSegB(e.target.value)}>
          {SEGMENTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      {items.length === 0 ? (
        <p style={{ color: MUTED, fontFamily: "'Newsreader', serif", fontSize: 14 }}>
          No statements found for either segment.
        </p>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
          <svg width={svgW} height={svgH} style={{ display: "block" }}>
            {/* header labels */}
            <text x={sideW / 2} y={14} textAnchor="middle" fill={a.color} fontSize={11} fontWeight={700} fontFamily="'Inter Tight', sans-serif">
              {a.label}
            </text>
            <text x={sideW + centerW + sideW / 2} y={14} textAnchor="middle" fill={b.color} fontSize={11} fontWeight={700} fontFamily="'Inter Tight', sans-serif">
              {b.label}
            </text>
            {items.map((d, i) => {
              const y = 28 + i * (barH + gap);
              const barA = (d.valA / maxVal) * sideW;
              const barB = (d.valB / maxVal) * sideW;
              return (
                <g key={d.name + d.question}>
                  {/* left bar (grows leftward from center) */}
                  <rect
                    x={sideW - barA}
                    y={y + 2}
                    width={barA}
                    height={barH - 4}
                    rx={3}
                    fill={a.color}
                    opacity={0.8}
                    style={{ transition: "width 0.5s ease, x 0.5s ease, fill 0.3s ease" }}
                  />
                  <text
                    x={sideW - barA - 6}
                    y={y + barH / 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    fill={WHITE}
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="'Inter Tight', sans-serif"
                  >
                    {d.valA}{metricSuffix}
                  </text>
                  {/* center label */}
                  <text
                    x={centerX}
                    y={y + barH / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={DIM}
                    fontSize={10}
                    fontFamily="'Inter Tight', sans-serif"
                  >
                    {d.name}
                  </text>
                  {/* right bar (grows rightward from center) */}
                  <rect
                    x={sideW + centerW}
                    y={y + 2}
                    width={barB}
                    height={barH - 4}
                    rx={3}
                    fill={b.color}
                    opacity={0.8}
                    style={{ transition: "width 0.5s ease, fill 0.3s ease" }}
                  />
                  <text
                    x={sideW + centerW + barB + 6}
                    y={y + barH / 2}
                    dominantBaseline="central"
                    fill={WHITE}
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="'Inter Tight', sans-serif"
                  >
                    {d.valB}{metricSuffix}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/* ─── View 3: Popular Statements (dot plot cards) ─── */
function PopularStatements({ data, metricSuffix = "" }) {
  // For Index: "strong" = >130. For %, "strong" = top quartile of values.
  const isIndex = metricSuffix === "";

  const items = useMemo(() => {
    const allVals = data.flatMap(row => SEGMENTS.map(s => Number(row[s.key]) || 0)).filter(v => v > 0);
    const threshold = isIndex ? 130 : (allVals.sort((a, b) => b - a)[Math.floor(allVals.length * 0.25)] || 10);

    return data
      .map((row) => {
        const vals = SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color, index: Number(row[s.key]) || 0 }));
        const strong = vals.filter((v) => v.index > threshold);
        const avg = vals.reduce((sum, v) => sum + v.index, 0) / vals.length;
        return { name: row.name, question: row.question, vals, strongCount: strong.length, avg, threshold };
      })
      .filter((d) => d.strongCount >= 2)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 30);
  }, [data, isIndex]);

  const axisMax = isIndex ? 350 : Math.max(...(items.flatMap(d => d.vals.map(v => v.index))), 100);

  if (items.length === 0) {
    return (
      <p style={{ color: MUTED, fontFamily: "'Newsreader', serif", fontSize: 14 }}>
        No statements strong enough across 2 or more segments.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 600, overflowY: "auto" }}>
      {items.map((d) => (
        <div
          key={d.name + d.question}
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: WHITE, fontFamily: "'Newsreader', serif" }}>
              {d.name}
            </span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
              avg {Math.round(d.avg)}{metricSuffix}
            </span>
          </div>
          <svg width="100%" height={28} viewBox={`0 0 ${axisMax + 40} 28`} preserveAspectRatio="xMinYMid meet" style={{ display: "block" }}>
            {/* axis line */}
            <line x1={0} y1={14} x2={axisMax} y2={14} stroke={BORDER} strokeWidth={1} />
            {/* tick marks — adaptive to metric type */}
            {(isIndex ? [100, 200, 300] : [Math.round(axisMax * 0.25), Math.round(axisMax * 0.5), Math.round(axisMax * 0.75)]).filter(t => t > 0 && t < axisMax).map(tick => (
              <g key={tick}>
                <line x1={tick} y1={tick === 100 && isIndex ? 4 : 6} x2={tick} y2={tick === 100 && isIndex ? 24 : 22} stroke={tick === 100 && isIndex ? MUTED : BORDER} strokeWidth={1} strokeDasharray="2,2" />
                <text x={tick} y={26} textAnchor="middle" fill={MUTED} fontSize={8} fontFamily="'Inter Tight', sans-serif">{tick}{metricSuffix}</text>
              </g>
            ))}
            {/* dots */}
            {d.vals.map((v) => (
              <circle
                key={v.key}
                cx={Math.min(v.index, axisMax)}
                cy={14}
                r={5}
                fill={v.color}
                opacity={0.9}
                stroke={BG}
                strokeWidth={1}
              >
                <title>{v.label}: {v.index}{metricSuffix}</title>
              </circle>
            ))}
          </svg>
          {/* legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {d.vals
              .filter((v) => v.index > (d.threshold || 130))
              .sort((a, b) => b.index - a.index)
              .map((v) => (
                <span key={v.key} style={{ fontSize: 10, color: v.color, fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>
                  {v.label} {v.index}{metricSuffix}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
const VIEWS = [
  { key: "explorer", label: "Segment Explorer" },
  { key: "compare", label: "Compare Segments" },
  { key: "popular", label: "Popular Statements" },
];

export default function AudienceIntelligence({ gwiData }) {
  const [view, setView] = useState("explorer");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [metricKey, setMetricKey] = useState("Index");

  const allData = useMemo(() => cleanData(gwiData, metricKey), [gwiData, metricKey]);
  const currentMetric = METRIC_OPTIONS.find(m => m.key === metricKey) || METRIC_OPTIONS[0];

  const categories = useMemo(() => {
    const cats = new Set();
    allData.forEach((row) => { if (row.question) cats.add(row.question); });
    return Array.from(cats).sort();
  }, [allData]);

  const data = useMemo(() => {
    if (categoryFilter === "all") return allData;
    return allData.filter((row) => row.question === categoryFilter);
  }, [allData, categoryFilter]);

  const [topTab, setTopTab] = useState("gwi");

  return (
    <div style={{ background: BG, padding: 24, borderRadius: 12 }}>
      {/* section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
          Audience Intelligence
        </h2>
      </div>

      {/* top-level sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[{ id: "gwi", label: "GWI Data" }, { id: "bridge", label: "Audience Bridge" }].map(st => (
          <button key={st.id} onClick={() => setTopTab(st.id)} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: topTab === st.id ? 700 : 400,
            color: topTab === st.id ? BG : MUTED, background: topTab === st.id ? TEAL : "transparent",
            border: topTab === st.id ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
            fontFamily: "'Inter Tight', sans-serif",
          }}>{st.label}</button>
        ))}
      </div>

      {topTab === "bridge" && (
        <DocUploader
          apiEndpoint="/api/audience-bridge"
          title="Audience Bridge"
          description="Upload synthetic audience conversation documents (Word docs) for team review and reference."
        />
      )}

      {topTab === "gwi" && <>
      {/* metric + category filter row */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Inter Tight', sans-serif" }}>
          Metric
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {METRIC_OPTIONS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetricKey(m.key)}
              title={m.description}
              style={{
                padding: "5px 12px", fontSize: 11, fontWeight: metricKey === m.key ? 700 : 500,
                color: metricKey === m.key ? BG : DIM,
                background: metricKey === m.key ? TEAL : "transparent",
                border: `1px solid ${metricKey === m.key ? TEAL : BORDER}`,
                borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif", transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: DIM, fontStyle: "italic" }}>{currentMetric.description}</span>
      </div>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Inter Tight', sans-serif" }}>
          Category
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...selectStyle, minWidth: 240 }}
        >
          <option value="all">All Categories ({allData.length} statements)</option>
          {categories.map((cat) => {
            const count = allData.filter((r) => r.question === cat).length;
            return (
              <option key={cat} value={cat}>{cat} ({count})</option>
            );
          })}
        </select>
        {categoryFilter !== "all" && (
          <button
            onClick={() => setCategoryFilter("all")}
            style={{ ...tabStyle(false), fontSize: 11, padding: "4px 10px" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* view tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)} style={tabStyle(view === v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {/* active view */}
      {view === "explorer" && <SegmentExplorer data={data} metricSuffix={currentMetric.suffix} />}
      {view === "compare" && <CompareSegments data={data} metricSuffix={currentMetric.suffix} />}
      {view === "popular" && <PopularStatements data={data} metricSuffix={currentMetric.suffix} />}
      </>}
    </div>
  );
}
