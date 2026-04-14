const BG = "#0C0C0C";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";

// SVG line chart -- accepts multiple series
// series: [{ label, color, data: [{ date, value }] }]
export default function LineChart({ series, height = 120, showLegend = true }) {
  if (!series || series.length === 0 || series.every(s => !s.data || s.data.length < 2)) {
    return <div style={{ color: MUTED, fontSize: 11, padding: "12px 0" }}>Not enough data points yet. Trends appear after multiple scans.</div>;
  }

  const allDates = [...new Set(series.flatMap(s => s.data.map(d => d.date)))].sort();
  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = Math.max(maxVal - minVal, 1);

  const w = 500;
  const h = height;
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  function x(i) { return padL + (i / Math.max(allDates.length - 1, 1)) * chartW; }
  function y(v) { return padT + chartH - ((v - minVal) / range) * chartH; }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height, display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const val = minVal + range * pct;
          const yPos = y(val);
          return (
            <g key={pct}>
              <line x1={padL} y1={yPos} x2={w - padR} y2={yPos} stroke={BORDER} strokeWidth={0.5} />
              <text x={padL - 4} y={yPos + 3} textAnchor="end" fill={MUTED} fontSize={8} fontFamily="'Inter Tight', sans-serif">{Math.round(val)}</text>
            </g>
          );
        })}
        {allDates.map((date, i) => (
          <text key={i} x={x(i)} y={h - 4} textAnchor="middle" fill={MUTED} fontSize={7} fontFamily="'Inter Tight', sans-serif">
            {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </text>
        ))}
        {series.map((s) => {
          if (!s.data || s.data.length < 2) return null;
          const dateMap = Object.fromEntries(s.data.map(d => [d.date, d.value]));
          const points = allDates.map((date, i) => {
            const val = dateMap[date];
            return val != null ? { x: x(i), y: y(val), val, date } : null;
          }).filter(Boolean);

          const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

          return (
            <g key={s.label}>
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} stroke={BG} strokeWidth={1}>
                  <title>{s.label}: {p.val}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {showLegend && series.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
          {series.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 3, borderRadius: 1, background: s.color }} />
              <span style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
