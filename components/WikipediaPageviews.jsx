import { useEffect, useState } from "react";

const BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", MUTED = "#777", WHITE = "#EDEDE8", DIM = "#999";
const GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF";
const FONT = "'Inter Tight', system-ui, sans-serif";

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function Delta({ pct }) {
  if (pct == null || pct === 0) return null;
  const color = pct > 0 ? GREEN : RED;
  const glyph = pct > 0 ? "↑" : "↓";
  return <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: FONT }}>{glyph} {Math.abs(pct)}%</span>;
}

function Spark({ data, color = TEAL, width = 120, height = 32 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WikipediaPageviews() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/wikipedia-pageviews").then(r => r.json()).then(setData).catch(() => setData({ error: true }));
  }, []);

  if (!data || data.error) return null;

  const articles = data.articles || [];
  if (!articles.length) return null;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 20px", marginTop: 32, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: TEAL, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontFamily: FONT }}>Wikipedia pageviews</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontFamily: FONT }}>
            Daily attention signal across Madonna-related English Wikipedia articles — last {data.period?.days || 60} days
          </div>
        </div>
        {data.topMover && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", fontFamily: FONT, letterSpacing: "0.05em" }}>Top mover this week</div>
            <div style={{ fontSize: 12, color: WHITE, fontFamily: FONT, fontWeight: 600 }}>
              {data.topMover.label} <Delta pct={data.topMover.weekChangePercent} />
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {articles.map(a => (
          <div key={a.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: WHITE, fontWeight: 600, fontFamily: FONT }}>{a.label}</span>
              <Delta pct={a.weekChangePercent} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: TEAL, fontFamily: FONT }}>{fmt(a.last7days)}</div>
                <div style={{ fontSize: 9, color: MUTED, fontFamily: FONT }}>views · last 7d</div>
              </div>
              <Spark data={(a.daily || []).slice(-30).map(d => d.views)} color={TEAL} width={140} height={36} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 9, color: DIM, marginTop: 12, marginBottom: 0, fontFamily: FONT }}>
        Source: Wikimedia REST API. Data lags ~1 day.
      </p>
    </div>
  );
}
