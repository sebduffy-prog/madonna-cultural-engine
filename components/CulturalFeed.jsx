import { useState, useEffect, useCallback } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const PINK = "#F472B6";
const TEAL = "#2DD4BF";
const AMBER = "#F59E0B";
const GREEN = "#34D399";
const PURPLE = "#A78BFA";

const TABS = [
  { id: "fashion", label: "Fashion", color: PINK, icon: "\u2666" },
  { id: "gay", label: "Gay Community", color: TEAL, icon: "\u2665" },
  { id: "underground", label: "Underground Trends", color: AMBER, icon: "\u2605" },
];

const RECOMMENDATIONS = {
  fashion: [
    {
      type: "Media",
      title: "Vogue Italia Heritage Cover",
      description: "Commission a Vogue Italia cover story positioning Madonna as the origin point of pop-fashion convergence. Frame it around the Dolce & Gabbana campaign with a photo essay showing her influence on every major designer collaboration since 1984. Include quotes from current designers who cite her as their entry point into fashion.",
    },
    {
      type: "Strategic",
      title: "Met Gala Moment Engineering",
      description: "Coordinate a Met Gala appearance where Madonna doesn't just attend but becomes the reference point. Pre-seed fashion media with a timeline graphic showing how every 'shocking' Met Gala moment traces back to her 1997 appearance. Partner with a rising Gen Z designer for the look to bridge generational credibility.",
    },
    {
      type: "Media",
      title: "Vanity Fair 'The Original' Feature",
      description: "Pitch a Vanity Fair long-form feature titled 'Before the Era Tour, There Was Every Era.' Map every current artist's signature style element back to a specific Madonna moment. Pair with behind-the-scenes footage from the new Stuart Price album sessions showing her creative process is still bleeding-edge.",
    },
  ],
  gay: [
    {
      type: "Strategic",
      title: "Pride Residency Partnership",
      description: "Establish an ongoing partnership with a major Pride event (London, NYC, or LA) where Madonna curates the main stage lineup. Not a one-off appearance but a creative director role. This positions her as the bridge between the underground ballroom scene she championed in Vogue and today's queer artists.",
    },
    {
      type: "Media",
      title: "Documentary: 'The Queen and Her Court'",
      description: "Commission a short documentary for PinkNews or Them exploring the direct lineage from Madonna's Truth or Dare (1991) vogueing scenes to today's ballroom renaissance. Interview current ballroom legends who cite that film as their awakening moment. Release timed to the new album campaign.",
    },
    {
      type: "Strategic",
      title: "Queer Artist Mentorship Programme",
      description: "Launch a public mentorship initiative with 3-5 emerging queer artists across music, performance, and fashion. Position it not as charity but as Madonna recognising the community that built her and investing back. Partner with Attitude magazine for ongoing coverage of the mentees' journeys.",
    },
  ],
  underground: [
    {
      type: "Media",
      title: "Dazed x Madonna: Club Culture Origin Map",
      description: "Commission Dazed to create an interactive digital feature mapping the DNA of current club culture back to the venues, DJs, and moments Madonna was part of in early-80s New York. Include unreleased audio from the Danceteria and Paradise Garage era. Embed in the new album's campaign as 'the receipts.'",
    },
    {
      type: "Strategic",
      title: "Underground Club Listening Sessions",
      description: "Before the new album's official release, host invite-only listening sessions in legendary underground venues: Fabric (London), Basement (NYC), Tresor (Berlin). No phones, no press, no VIP list. Let the music speak in the spaces it was built for. Let the word-of-mouth build from the floor up.",
    },
    {
      type: "Media",
      title: "i-D x Highsnobiety: 'Still on the Floor'",
      description: "Partner with i-D and Highsnobiety for a joint editorial series following Madonna through three nights in three underground clubs across three cities. No glam shots. Documentary style. Show her engaging with the scene as a participant, not a celebrity. The message: she never left the dancefloor, the cameras just stopped following her there.",
    },
  ],
};

function FeedCard({ item }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "14px 18px",
        textDecoration: "none",
        transition: "border-color 0.15s ease",
      }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = Y)}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = BORDER)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: WHITE, margin: 0, lineHeight: 1.4, fontFamily: "'Newsreader', serif" }}>
          {item.title}
        </h3>
        <span style={{
          fontSize: 10, color: BG, background: item.type === "brave" ? TEAL : MUTED,
          padding: "2px 6px", borderRadius: 4, fontWeight: 600, whiteSpace: "nowrap",
          fontFamily: "'Inter Tight', sans-serif",
        }}>
          {item.source}
        </span>
      </div>
      {item.description && (
        <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.5 }}>
          {item.description.length > 200 ? item.description.slice(0, 200) + "..." : item.description}
        </p>
      )}
      {item.date && (
        <div style={{ fontSize: 10, color: MUTED, marginTop: 6, fontFamily: "'Inter Tight', sans-serif" }}>
          {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </a>
  );
}

function RecommendationCard({ rec, color }) {
  const typeColors = { Media: PINK, Strategic: TEAL };
  const tc = typeColors[rec.type] || AMBER;
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
        }}>
          {rec.type}
        </span>
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

export default function CulturalFeed() {
  const [activeTab, setActiveTab] = useState("fashion");
  const [feeds, setFeeds] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const fetchFeed = useCallback(async (category) => {
    if (feeds[category]) return; // Already loaded
    setLoading((prev) => ({ ...prev, [category]: true }));
    try {
      const res = await fetch(`/api/news?category=${category}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeeds((prev) => ({ ...prev, [category]: data }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [category]: err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, [feeds]);

  useEffect(() => {
    fetchFeed(activeTab);
  }, [activeTab, fetchFeed]);

  const currentFeed = feeds[activeTab];
  const isLoading = loading[activeTab];
  const error = errors[activeTab];
  const tabDef = TABS.find((t) => t.id === activeTab);
  const recs = RECOMMENDATIONS[activeTab] || [];

  return (
    <div style={{ background: BG, borderRadius: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
        <h2 style={{
          fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em",
          textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif",
        }}>
          Cultural Feed
        </h2>
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>
          Live trends + strategic recommendations
        </span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
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
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Feed content */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 2, height: 14, background: tabDef.color, borderRadius: 1 }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: tabDef.color,
            textTransform: "uppercase", letterSpacing: "0.04em",
            fontFamily: "'Inter Tight', sans-serif",
          }}>
            Latest from {tabDef.label}
          </span>
        </div>

        {isLoading && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <span style={{ fontSize: 13, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
              Loading feeds...
            </span>
          </div>
        )}

        {error && !isLoading && (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: "16px 20px", marginBottom: 12,
          }}>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Could not load feeds. Make sure the dev server is running and your Brave API key is set in <code style={{ color: Y }}>.env.local</code>.
            </p>
            <button
              onClick={() => { setErrors((p) => ({ ...p, [activeTab]: null })); setFeeds((p) => { const n = { ...p }; delete n[activeTab]; return n; }); }}
              style={{
                marginTop: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                color: BG, background: Y, border: "none", borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {currentFeed && !isLoading && (
          <>
            {!currentFeed.hasBraveKey && (
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: "10px 16px", marginBottom: 12, fontSize: 11, color: MUTED,
                fontFamily: "'Inter Tight', sans-serif",
              }}>
                Brave Search API key not configured. Showing RSS feeds only. Add your key to <code style={{ color: Y }}>.env.local</code> for richer results.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
              {currentFeed.items.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 13, padding: 20 }}>No articles found. RSS feeds may be temporarily unavailable.</p>
              ) : (
                currentFeed.items.map((item, i) => <FeedCard key={item.url || i} item={item} />)
              )}
            </div>
          </>
        )}
      </div>

      {/* Strategic Recommendations */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 2, height: 14, background: Y, borderRadius: 1 }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: Y,
            textTransform: "uppercase", letterSpacing: "0.04em",
            fontFamily: "'Inter Tight', sans-serif",
          }}>
            Madonna: Strategic Recommendations
          </span>
        </div>
        <p style={{ fontSize: 13, color: DIM, margin: "0 0 12px", lineHeight: 1.5, fontStyle: "italic" }}>
          What could Madonna do right now to own this space?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recs.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} color={tabDef.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
