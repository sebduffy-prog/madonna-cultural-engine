import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { usePrefersReducedMotion } from "../lib/usePrefersReducedMotion";
import { TICKER_SPEED_PX_PER_SEC, TICKER_HOVER_BRAKE, TICKER_RESUME_SPRING } from "../lib/motion";

const Y = "#FFD500";
const BG = "#0C0C0C";
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

function extractMadonnaQuote(description) {
  if (!description) return null;
  const sentences = description.split(/(?<=[.!?])\s+/);
  const match = sentences.find((s) => /madonna/i.test(s));
  if (match) {
    return match.length > 120 ? match.slice(0, 117) + "\u2026" : match;
  }
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
  const reducedMotion = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const trackRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const speedRef = useRef(TICKER_SPEED_PX_PER_SEC);

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
              tickerItems.push({ ...item, displayTitle: item.title.slice(0, 120) });
            } else if (descHasMadonna) {
              const quote = extractMadonnaQuote(item.description);
              if (quote) tickerItems.push({ ...item, displayTitle: quote });
            }
          }
          setItems(tickerItems);
        }
      })
      .catch(() => {});
  }, []);

  // Velocity-driven marquee — continuously animate x leftward at `speedRef.current` px/sec.
  // Hover enter: spring speed to 0. Hover leave: spring speed back to full.
  useEffect(() => {
    if (reducedMotion || items.length === 0) return;
    let raf = null;
    let last = performance.now();

    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      const track = trackRef.current;
      if (!track) { raf = requestAnimationFrame(tick); return; }
      const half = track.scrollWidth / 2;
      if (half > 0) {
        let cx = x.get() - speedRef.current * dt;
        // Seamless loop — once we've scrolled past one half's width, jump back
        if (cx <= -half) cx += half;
        x.set(cx);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [items.length, reducedMotion, x]);

  function handleMouseEnter() {
    if (reducedMotion) return;
    if (animationRef.current) animationRef.current.stop();
    animationRef.current = animate(speedRef.current, 0, {
      ...TICKER_HOVER_BRAKE,
      onUpdate: (v) => { speedRef.current = v; },
    });
  }
  function handleMouseLeave() {
    if (reducedMotion) return;
    if (animationRef.current) animationRef.current.stop();
    animationRef.current = animate(speedRef.current, TICKER_SPEED_PX_PER_SEC, {
      ...TICKER_RESUME_SPRING,
      onUpdate: (v) => { speedRef.current = v; },
    });
  }

  if (items.length === 0) {
    return (
      <div style={{
        borderTop: `1px solid rgba(237,237,232,0.45)`,
        borderBottom: `1px solid rgba(237,237,232,0.45)`,
        marginBottom: 20, padding: "10px 0", textAlign: "center",
      }}>
        <span style={{ fontSize: 11, color: WHITE, opacity: 0.6, fontFamily: "'Inter Tight', sans-serif" }}>
          Loading breaking news…
        </span>
      </div>
    );
  }

  // Double items for seamless loop
  const displayItems = [...items, ...items];

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        borderTop: `1px solid rgba(237,237,232,0.45)`,
        borderBottom: `1px solid rgba(237,237,232,0.45)`,
        marginBottom: 20,
        padding: "10px 0",
        overflow: "hidden",
        WebkitMaskImage: "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
        maskImage: "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
      }}
    >
      <motion.div
        ref={trackRef}
        style={{
          display: "flex",
          gap: 44,
          whiteSpace: "nowrap",
          x,
          willChange: "transform",
        }}
      >
        {displayItems.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              fontSize: 11, textDecoration: "none", flexShrink: 0,
            }}
          >
            <span style={{
              fontSize: 9, color: BG, background: WHITE, padding: "2px 7px",
              borderRadius: 3, fontWeight: 700, fontFamily: "'Inter Tight', sans-serif",
              letterSpacing: "0.02em",
            }}>{item.source}</span>
            {renderTitle(item.displayTitle)}
          </a>
        ))}
      </motion.div>
    </div>
  );
}
