import { useState, useEffect } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const TEAL = "#2DD4BF";
const PINK = "#F472B6";
const AMBER = "#F59E0B";
const GREEN = "#34D399";
const CORAL = "#FB923C";

const TABS = [
  { id: "madonna", label: "Madonna", color: Y },
  { id: "fashion", label: "Fashion", color: PINK },
  { id: "gay", label: "Gay Community", color: TEAL },
  { id: "culture", label: "Culture", color: AMBER },
];

const TYPE_COLORS = { Media: PINK, Strategic: TEAL, Partnership: CORAL };

function RecCard({ rec }) {
  const tc = TYPE_COLORS[rec.type] || AMBER;
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${tc}`,
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: BG, background: tc,
          padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
          letterSpacing: "0.06em", fontFamily: "'Inter Tight', sans-serif",
        }}>{rec.type}</span>
      </div>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: WHITE, margin: "0 0 8px", fontFamily: "'Newsreader', serif" }}>
        {rec.title}
      </h4>
      <p style={{ fontSize: 13, color: DIM, margin: 0, lineHeight: 1.6 }}>
        {rec.description}
      </p>
    </div>
  );
}

export default function StrategyRecommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("madonna");

  useEffect(() => {
    fetch("/api/ai-strategy")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  const recs = data?.recommendations?.[activeTab] || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
            Strategic Recommendations
          </h2>
          {data?.generatedAt && (
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
              Generated {new Date(data.generatedAt).toLocaleDateString("en-GB")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif" }}>
            Prompt: strategy-prompt.md
          </span>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const r = await fetch("/api/ai-strategy?refresh=1");
                if (r.ok) setData(await r.json());
              } catch {}
              setLoading(false);
            }}
            disabled={loading}
            style={{
              padding: "4px 12px", fontSize: 10, fontWeight: 600,
              color: loading ? MUTED : BG, background: loading ? BORDER : CORAL,
              border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >{loading ? "Generating..." : "Generate"}</button>
        </div>
      </div>

      {/* Error state */}
      {data?.error && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{data.error}</p>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? BG : DIM,
              background: activeTab === t.id ? t.color : "transparent",
              border: activeTab === t.id ? "none" : `1px solid ${BORDER}`,
              borderRadius: 6, cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Recommendations */}
      {recs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recs.map((rec, i) => <RecCard key={i} rec={rec} />)}
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>
            {data?.recommendations ? "No recommendations for this category" : "No recommendations generated yet"}
          </p>
          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
            Hit Generate to create AI-powered strategic recommendations based on this week's intelligence data.
          </p>
        </div>
      )}
    </div>
  );
}
