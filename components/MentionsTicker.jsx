import { useState, useEffect } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";

// Highlight "Madonna" in yellow within text
function renderTitle(text) {
  if (!text) return null;
  const parts = text.split(/(madonna)/gi);
  if (parts.length === 1) return <span style={{ color: WHITE }}>{text}</span>;
  return parts.map((part, i) =>
    part.toLowerCase() === "madonna"
      ? <span key={i} style={{ color: Y, fontWeight: 700 }}>{part}</span>
      : <span key={i} style={{ color: WHITE }}>{part}</span>
  );
}

// For description-only mentions, extract the sentence containing "Madonna"
function extractMadonnaQuote(description) {
  if (!description) return null;
  // Split on sentence boundaries
  const sentences = description.split(/(?<=[.!?])\s+/);
  const match = sentences.find((s) => /madonna/i.test(s));
  if (match) {
    // Trim to reasonable length
    const trimmed = match.length > 120 ? match.slice(0, 117) + "\u2026" : match;
    return trimmed;
  }
  // Fallback: extract ~120 chars around the mention
  const idx = description.toLowerCase().indexOf("madonna");
  if (idx === -1) return null;
  const start = Math.max(0, idx - 40);
  const end = Math.min(description.length, idx + 80);
  let snippet = description.slice(start, end);
  if (start > 0) snippet = "\u2026" + snippet;
  if (end < description.length) snippet = snippet + "\u2026";
  return snippet;
}

export default function MentionsTicker() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch("/api/news?category=madonna")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) {
          const tickerItems = [];
          for (const item of data.items) {
            if (tickerItems.length >= 20) break;
            const titleHasMadonna = /madonna/i.test(item.title || "");
            const descHasMadonna = /madonna/i.test(item.description || "");
            if (titleHasMadonna) {
              tickerItems.push({
                ...item,
                displayTitle: item.title.slice(0, 120),
              });
            } else if (descHasMadonna) {
              const quote = extractMadonnaQuote(item.description);
              if (quote) {
                tickerItems.push({
                  ...item,
                  displayTitle: quote,
                });
              }
            }
          }
          setItems(tickerItems);
        }
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div style={{ borderBottom: `1px solid ${BORDER}`, marginBottom: 20, padding: "8px 0" }}>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: "'Inter Tight', sans-serif" }}>
          No Madonna mentions loaded yet. Run a search in the Media tab to populate the ticker.
        </span>
      </div>
    );
  }

  // Double items for seamless loop
  const displayItems = [...items, ...items];

  return (
    <div style={{
      overflow: "hidden", borderBottom: `1px solid ${BORDER}`,
      marginBottom: 20, padding: "8px 0", position: "relative",
    }}>
      <div style={{
        display: "flex", gap: 40, whiteSpace: "nowrap",
        animation: `ticker ${items.length * 5}s linear infinite`,
      }}>
        {displayItems.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 11, textDecoration: "none", flexShrink: 0,
            }}
          >
            <span style={{
              fontSize: 9, color: BG, background: WHITE, padding: "1px 5px",
              borderRadius: 3, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif",
            }}>{item.source}</span>
            {renderTitle(item.displayTitle)}
          </a>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
