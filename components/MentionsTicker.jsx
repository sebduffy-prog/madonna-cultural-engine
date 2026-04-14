import { useState, useEffect } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";

export default function MentionsTicker() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Try to load Madonna-specific feed from cache
    fetch("/api/news?category=madonna")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) {
          // Only items mentioning Madonna in title
          const madonnaItems = data.items.filter((i) => /madonna/i.test(i.title)).slice(0, 20);
          setItems(madonnaItems);
        }
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  // Double the items for seamless loop
  const displayItems = [...items, ...items];

  return (
    <div style={{
      overflow: "hidden", borderBottom: `1px solid ${BORDER}`,
      marginBottom: 20, padding: "8px 0", position: "relative",
    }}>
      <div style={{
        display: "flex", gap: 32, whiteSpace: "nowrap",
        animation: `ticker ${items.length * 4}s linear infinite`,
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
              fontSize: 9, color: BG, background: MUTED, padding: "1px 5px",
              borderRadius: 3, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif",
            }}>{item.source}</span>
            <span style={{ color: WHITE }}>
              {item.title?.replace(/madonna/gi, "").trim().slice(0, 80) || item.title?.slice(0, 80)}
            </span>
            <span style={{ color: Y, fontWeight: 700 }}>Madonna</span>
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
