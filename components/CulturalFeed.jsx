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
const CORAL = "#FB923C";

const TABS = [
  { id: "madonna", label: "Madonna", color: Y, icon: "\u2605" },
  { id: "fashion", label: "Fashion", color: PINK, icon: "\u2666" },
  { id: "gay", label: "Gay Community", color: TEAL, icon: "\u2665" },
  { id: "culture", label: "General Cultural", color: AMBER, icon: "\u266B" },
];

const RECOMMENDATIONS = {
  madonna: [
    {
      type: "Media",
      title: "Cross-Platform Narrative Seeding",
      description: "Coordinate a simultaneous editorial drop across Vogue, Dazed, and PinkNews: three different angles on the same week. Vogue gets the fashion legacy. Dazed gets the club culture roots. PinkNews gets the queer community story. Same Madonna, three audiences, one unified message: the original is still writing the playbook.",
    },
    {
      type: "Strategic",
      title: "Stuart Price Album Rollout via Culture, Not Charts",
      description: "Don't chase streaming numbers. Seed the new album through the cultural channels that matter: Resident Advisor reviews, Mixmag features, underground DJ sets. Let the dance music press validate the sound before pop media covers it. The narrative becomes 'Madonna made an album the clubs are already playing' not 'Madonna releases new album.'",
    },
    {
      type: "Strategic",
      title: "Netflix Series as Cultural Reset",
      description: "Use the Shawn Levy Netflix series not as biography but as cultural intervention. Time the trailer to drop during a major fashion week or Pride month. Partner with Them and Gay Times for exclusive behind-the-scenes content that positions the series as a queer history document, not a celebrity biopic.",
    },
  ],
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
  culture: [
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

// Decode HTML entities that RSS feeds often include
function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&#038;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace(/&#|;/g, ""), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    });
}

function highlightMadonna(text) {
  if (!text) return text;
  const parts = text.split(/(madonna)/gi);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === "madonna"
      ? <span key={i} style={{ color: Y, fontWeight: 700 }}>{part}</span>
      : part
  );
}

function FeedCard({ item }) {
  const hasMadonna = /madonna/i.test(item.title || "");
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: CARD,
        border: `1px solid ${hasMadonna ? Y + "44" : BORDER}`,
        borderLeft: hasMadonna ? `3px solid ${Y}` : undefined,
        borderRadius: 8,
        padding: "14px 18px",
        textDecoration: "none",
        transition: "border-color 0.15s ease",
      }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = Y)}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = hasMadonna ? Y + "44" : BORDER)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: WHITE, margin: 0, lineHeight: 1.4, fontFamily: "'Newsreader', serif" }}>
          {highlightMadonna(decodeEntities(item.title))}
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
          {decodeEntities(item.description).length > 200 ? decodeEntities(item.description).slice(0, 200) + "..." : decodeEntities(item.description)}
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

function RecommendationCard({ rec }) {
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

const PLATFORM_COLORS = {
  reddit: "#FF4500",
  twitter: WHITE,
  tiktok: "#00F2EA",
  youtube: "#FF0000",
  instagram: "#E1306C",
};

export default function CulturalFeed() {
  const [activeTab, setActiveTab] = useState("madonna");
  const [socialPlatform, setSocialPlatform] = useState("all");
  const [feeds, setFeeds] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [aiRecs, setAiRecs] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load AI recommendations on mount
  useEffect(() => {
    fetch("/api/ai-strategy")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.recommendations) setAiRecs(data); })
      .catch(() => {});
  }, []);

  const fetchFeed = useCallback(async (category) => {
    setLoading((prev) => ({ ...prev, [category]: true }));
    setErrors((prev) => ({ ...prev, [category]: null }));
    try {
      // Social tab uses its own API endpoint
      const url = category === "social"
        ? "/api/social?refresh=1"
        : `/api/news?category=${category}&refresh=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeeds((prev) => ({ ...prev, [category]: data }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [category]: err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchFeed(activeTab);
  }, [activeTab, fetchFeed]);

  // Load data on tab switch -- try cache first, auto-refresh if empty
  useEffect(() => {
    if (!feeds[activeTab] && !loading[activeTab] && !errors[activeTab]) {
      setLoading((prev) => ({ ...prev, [activeTab]: true }));
      const url = `/api/news?category=${activeTab}`;
      fetch(url)
        .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then((data) => {
          if (data?.items?.length > 0) {
            setFeeds((prev) => ({ ...prev, [activeTab]: data }));
          } else {
            // Empty cache -- fetch fresh
            return fetch(`/api/news?category=${activeTab}&refresh=1`)
              .then((r) => r.ok ? r.json() : null)
              .then((fresh) => { if (fresh) setFeeds((prev) => ({ ...prev, [activeTab]: fresh })); });
          }
        })
        .catch(() => {})
        .finally(() => setLoading((prev) => ({ ...prev, [activeTab]: false })));
    }
  }, [activeTab]);

  const currentFeed = feeds[activeTab];
  const isLoading = loading[activeTab];
  const error = errors[activeTab];
  const tabDef = TABS.find((t) => t.id === activeTab);
  // Use AI recommendations if available, fall back to hardcoded
  const tabKey = activeTab === "social" ? "madonna" : activeTab;
  const recs = (aiRecs?.recommendations?.[tabKey]) || RECOMMENDATIONS[tabKey] || [];

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
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 2, height: 14, background: tabDef.color, borderRadius: 1 }} />
            <span style={{
              fontSize: 12, fontWeight: 600, color: tabDef.color,
              textTransform: "uppercase", letterSpacing: "0.04em",
              fontFamily: "'Inter Tight', sans-serif",
            }}>
              {activeTab === "madonna" ? "All Madonna coverage" : activeTab === "social" ? "Madonna across social platforms" : `Latest from ${tabDef.label}`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {currentFeed && (
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
                {activeTab === "social"
                  ? `${(currentFeed.metrics?.textMentions || 0).toLocaleString()} mentions today \u00B7 ${(currentFeed.metrics?.cumulativeMentions || 0).toLocaleString()} cumulative`
                  : `${currentFeed.items?.length || 0} results`}
                {(currentFeed.cachedAt || currentFeed.fetchedAt) ? ` \u00B7 updated ${new Date(currentFeed.cachedAt || currentFeed.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                padding: "4px 12px", fontSize: 11, fontWeight: 600,
                color: isLoading ? MUTED : BG, background: isLoading ? BORDER : Y,
                border: "none", borderRadius: 5, cursor: isLoading ? "default" : "pointer",
                fontFamily: "'Inter Tight', sans-serif", letterSpacing: "0.02em",
                transition: "all 0.15s ease",
              }}
            >
              {isLoading ? "Searching..." : "New Search"}
            </button>
          </div>
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

        {!currentFeed && !isLoading && !error && (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: "32px 24px", textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>
              No search results yet
            </p>
            <p style={{ fontSize: 12, color: MUTED, margin: "0 0 16px" }}>
              Weekly search runs every Tuesday at 14:05. Hit New Search to fetch now.
            </p>
            <button
              onClick={handleRefresh}
              style={{
                padding: "8px 20px", fontSize: 12, fontWeight: 600,
                color: BG, background: Y, border: "none", borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif",
              }}
            >
              New Search
            </button>
          </div>
        )}

        {currentFeed && !isLoading && activeTab === "social" && (() => {
          const platforms = currentFeed.platforms || [];
          const activePlatform = socialPlatform === "all" ? null : platforms.find((p) => p.id === socialPlatform);
          const displayItems = activePlatform ? activePlatform.items : platforms.flatMap((p) => p.items);

          return (
            <>
              {/* Madonna's Own Accounts */}
              {currentFeed.ownAccounts && currentFeed.ownAccounts.posts > 0 && (
                <div style={{ background: CARD, border: `1px solid ${Y}33`, borderLeft: `3px solid ${Y}`, borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: Y, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Madonna's Own Accounts</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div><span style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{currentFeed.ownAccounts.posts}</span><span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>posts</span></div>
                    {currentFeed.ownAccounts.comments > 0 && <div><span style={{ fontSize: 20, fontWeight: 800, color: TEAL, fontFamily: "'Inter Tight', sans-serif" }}>{currentFeed.ownAccounts.comments.toLocaleString()}</span><span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>comments</span></div>}
                    {currentFeed.ownAccounts.score > 0 && <div><span style={{ fontSize: 20, fontWeight: 800, color: AMBER, fontFamily: "'Inter Tight', sans-serif" }}>{currentFeed.ownAccounts.score.toLocaleString()}</span><span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>likes</span></div>}
                    {currentFeed.ownAccounts.views > 0 && <div><span style={{ fontSize: 20, fontWeight: 800, color: GREEN, fontFamily: "'Inter Tight', sans-serif" }}>{currentFeed.ownAccounts.views.toLocaleString()}</span><span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>views</span></div>}
                  </div>
                </div>
              )}

              {/* Core metrics row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                {/* Text Mentions — "madonna" in actual text */}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Text Mentions</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>{(currentFeed.metrics?.textMentions || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>today (past 24h)</div>
                </div>

                {/* Cumulative */}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Cumulative</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: Y, fontFamily: "'Inter Tight', sans-serif" }}>{(currentFeed.metrics?.cumulativeMentions || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>
                    {currentFeed.history?.length > 0 ? `${currentFeed.history.length} days tracked` : "all time"}
                  </div>
                </div>

                {/* Total Engagement */}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Engagement</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: TEAL, fontFamily: "'Inter Tight', sans-serif" }}>{(currentFeed.metrics?.totalEngagement || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 2 }}>comments + likes + views</div>
                </div>

                {/* Sentiment */}
                {currentFeed.sentiment && (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Inter Tight', sans-serif" }}>Sentiment</div>
                      {currentFeed.sentiment.method?.startsWith("claude") && (
                        <span style={{ fontSize: 8, color: TEAL, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", background: TEAL + "18", padding: "1px 5px", borderRadius: 3 }}>AI</span>
                      )}
                    </div>
                    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${currentFeed.sentiment.positive}%`, background: GREEN }} />
                      <div style={{ width: `${currentFeed.sentiment.neutral}%`, background: MUTED }} />
                      <div style={{ width: `${currentFeed.sentiment.negative}%`, background: "#EF4444" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'Inter Tight', sans-serif" }}>
                      <span style={{ color: GREEN, fontWeight: 600 }}>{currentFeed.sentiment.positiveCount} pos</span>
                      <span style={{ color: MUTED }}>{currentFeed.sentiment.neutralCount} neu</span>
                      <span style={{ color: "#EF4444", fontWeight: 600 }}>{currentFeed.sentiment.negativeCount} neg</span>
                    </div>
                    {currentFeed.sentiment.method?.includes(":") && (
                      <div style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif", marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>
                        {currentFeed.sentiment.method.split(": ").slice(1).join(": ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Sources / Platforms */}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>Sources</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: PURPLE, fontFamily: "'Inter Tight', sans-serif", marginBottom: 4 }}>{(currentFeed.metrics?.sourcesTracked || 0).toLocaleString()}</div>
                  {currentFeed.metrics?.platformBreakdown && Object.entries(currentFeed.metrics.platformBreakdown).map(([p, count]) => {
                    const max = Math.max(...Object.values(currentFeed.metrics.platformBreakdown), 1);
                    return (
                      <div key={p} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 8, color: PLATFORM_COLORS[p] || DIM, width: 50, fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>{p}</span>
                        <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: PLATFORM_COLORS[p] || PURPLE, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: WHITE, fontWeight: 600, width: 20, textAlign: "right", fontFamily: "'Inter Tight', sans-serif" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hashtag tracking */}
              {currentFeed.metrics?.hashtags && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Hashtag Tracking</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {Object.entries(currentFeed.metrics.hashtags).map(([tag, count]) => (
                      <div key={tag} style={{
                        padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                        background: count > 0 ? PURPLE + "22" : BORDER + "44",
                        border: `1px solid ${count > 0 ? PURPLE + "44" : BORDER}`,
                        color: count > 0 ? PURPLE : MUTED, fontFamily: "'Inter Tight', sans-serif",
                      }}>
                        {tag} <span style={{ color: count > 0 ? WHITE : MUTED, marginLeft: 3 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform sub-tabs */}
              <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                <button onClick={() => setSocialPlatform("all")} style={{
                  padding: "5px 12px", fontSize: 10, fontWeight: socialPlatform === "all" ? 700 : 400,
                  color: socialPlatform === "all" ? BG : DIM, background: socialPlatform === "all" ? PURPLE : "transparent",
                  border: socialPlatform === "all" ? "none" : `1px solid ${BORDER}`,
                  borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
                }}>All ({displayItems.length})</button>
                {platforms.map((p) => (
                  <button key={p.id} onClick={() => setSocialPlatform(p.id)} style={{
                    padding: "5px 12px", fontSize: 10, fontWeight: socialPlatform === p.id ? 700 : 400,
                    color: socialPlatform === p.id ? BG : DIM,
                    background: socialPlatform === p.id ? (PLATFORM_COLORS[p.id] || PURPLE) : "transparent",
                    border: socialPlatform === p.id ? "none" : `1px solid ${BORDER}`,
                    borderRadius: 5, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
                  }}>
                    {p.icon} {p.label} ({p.items.length})
                  </button>
                ))}
              </div>

              {/* Feed for selected platform */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
                {displayItems.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 12, padding: "16px 0" }}>No mentions found for this platform.</p>
                ) : (
                  displayItems.map((item, i) => <FeedCard key={item.url || i} item={item} />)
                )}
              </div>

              {/* Hashtag coverage */}
              {currentFeed.metrics?.hashtagArticles?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Hashtag Coverage</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 250, overflowY: "auto" }}>
                    {currentFeed.metrics.hashtagArticles.map((item, i) => <FeedCard key={item.url || i} item={item} />)}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {currentFeed && !isLoading && activeTab !== "social" && (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: activeTab === "madonna" ? 800 : 600, overflowY: "auto" }}>
              {(currentFeed.items || []).length === 0 ? (
                <p style={{ color: MUTED, fontSize: 13, padding: 20 }}>No results found. Try New Search or check back after the weekly search runs Tuesday 14:05.</p>
              ) : (
                currentFeed.items.map((item, i) => <FeedCard key={item.url || i} item={item} />)
              )}
            </div>
          </>
        )}
      </div>

      {/* Strategic Recommendations */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 2, height: 14, background: Y, borderRadius: 1 }} />
            <span style={{
              fontSize: 12, fontWeight: 600, color: Y,
              textTransform: "uppercase", letterSpacing: "0.04em",
              fontFamily: "'Inter Tight', sans-serif",
            }}>
              Madonna: Strategic Recommendations
            </span>
            {aiRecs?.generatedAt && (
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
                AI-generated {new Date(aiRecs.generatedAt).toLocaleDateString("en-GB")}
              </span>
            )}
          </div>
          <button
            onClick={async () => {
              setAiLoading(true);
              try {
                const r = await fetch("/api/ai-strategy?refresh=1");
                if (r.ok) { const d = await r.json(); if (d.recommendations) setAiRecs(d); }
              } catch { /* ignore */ }
              setAiLoading(false);
            }}
            disabled={aiLoading}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 600,
              color: aiLoading ? MUTED : BG, background: aiLoading ? BORDER : CORAL,
              border: "none", borderRadius: 5, cursor: aiLoading ? "default" : "pointer",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            {aiLoading ? "Generating..." : "Generate AI Recommendations"}
          </button>
        </div>
        <p style={{ fontSize: 13, color: DIM, margin: "0 0 12px", lineHeight: 1.5, fontStyle: "italic" }}>
          {aiRecs?.recommendations ? "AI-generated based on this week's intelligence data." : "What could Madonna do right now to own this space?"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recs.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} />
          ))}
        </div>
      </div>
    </div>
  );
}
