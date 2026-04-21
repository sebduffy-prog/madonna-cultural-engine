import { useState, useEffect } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
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
      <h4 style={{ fontSize: 15, fontWeight: 700, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
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
      {/* Strategy brief — Media That Strikes A Pose */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${Y}`, borderRadius: 10, padding: "22px 26px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: Y, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "'Inter Tight', sans-serif" }}>Distinctive media behaviour</div>
        <h2 style={{ fontSize: 34, fontWeight: 800, color: WHITE, margin: "0 0 14px", fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Media That Strikes <span style={{ color: Y }}>A&nbsp;Pose</span>
        </h2>
        <p style={{ fontSize: 14, color: WHITE, margin: "0 0 10px", lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          Position Madonna not as a legacy act making a comeback, but as the <b style={{ color: Y }}>Source Code</b> — the originator still writing the playbook for club culture. For <i>Confessions on a Dance Floor 2</i> we're chasing three KPIs: UK No.1 physical sales, growth in first-party fan data, and cultural belonging inside LGBTQ+ and club communities.
        </p>
        <p style={{ fontSize: 13, color: DIM, margin: 0, lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          High-fashion, unapologetically bold, curated for the right environment. Three pillars carry the campaign.
        </p>
      </div>

      {/* Three pillars */}
      <div className="pillar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { num: "01", color: PINK,  title: "Own the Dancefloor",  tagline: "Grassroots club takeover",                description: "Seed the record through the clubs that define taste — underground residencies, Resident Advisor reviews, DJ-led validation before pop media arrives." },
          { num: "02", color: TEAL,  title: "Own the Feed",        tagline: "Premium paid social surrounding earned hype", description: "Premium paid social that wraps earned cultural conversation — amplify the moments fans and tastemakers create, don't interrupt them." },
          { num: "03", color: CORAL, title: "Own Haute-Culture",   tagline: "D&G film, cinema & fashion-district OOH",    description: "Luxury-grade storytelling across the Dolce & Gabbana film, cinema pre-rolls, and fashion-district OOH that places Madonna back at the centre of high culture." },
        ].map((p) => (
          <div key={p.num} style={{
            background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${p.color}`,
            borderRadius: 10, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: p.color, background: `${p.color}18`,
                border: `1px solid ${p.color}55`, borderRadius: 4, padding: "2px 8px",
                letterSpacing: "0.12em", fontFamily: "'Inter Tight', sans-serif",
              }}>{p.num}</span>
              <span style={{ fontSize: 10, color: p.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Pillar</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: WHITE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
              {p.title}
            </h3>
            <p style={{ fontSize: 12, color: p.color, margin: 0, fontWeight: 700, lineHeight: 1.4, fontFamily: "'Inter Tight', sans-serif" }}>
              {p.tagline}
            </p>
            <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              {p.description}
            </p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: WHITE, margin: "0 0 20px", lineHeight: 1.5, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        Recommendations below are generated weekly against this brief, grounded in the week's intelligence data (media, social, YouTube, Spotify). Full brief lives in <code style={{ color: WHITE, background: BG, padding: "1px 6px", borderRadius: 3 }}>strategy-prompt.md</code>.
      </p>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
            Strategic Recommendations
          </h2>
          {data?.generatedAt && (
            <span style={{ fontSize: 10, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>
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
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
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
              padding: "8px 16px", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? BG : WHITE,
              background: activeTab === t.id ? t.color : "transparent",
              border: activeTab === t.id ? "none" : `1px solid ${WHITE}`,
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
          <p style={{ fontSize: 12, color: WHITE, margin: 0 }}>
            Hit Generate to create AI-powered strategic recommendations based on this week's intelligence data.
          </p>
        </div>
      )}
    </div>
  );
}
