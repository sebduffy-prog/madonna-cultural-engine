import { motion } from "framer-motion";

const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const SHIMMER = "rgba(237,237,232,0.08)";
const SHIMMER_HOT = "rgba(237,237,232,0.18)";

// Shared shimmer animation for all skeleton primitives
const shimmerBg = {
  background: `linear-gradient(90deg, ${SHIMMER} 0%, ${SHIMMER_HOT} 50%, ${SHIMMER} 100%)`,
  backgroundSize: "200% 100%",
};

const shimmerAnim = {
  animate: { backgroundPosition: ["200% 0", "-200% 0"] },
  transition: { duration: 1.8, ease: "linear", repeat: Infinity },
};

function Line({ width = "100%", height = 10, radius = 3 }) {
  return (
    <motion.div
      {...shimmerAnim}
      style={{ ...shimmerBg, width, height, borderRadius: radius }}
    />
  );
}

// Panel-shaped skeleton — mirrors the Panel wrapper used across the dashboard
export function PanelSkeleton({ rows = 3, height, accent = "rgba(237,237,232,0.25)" }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: "16px 18px",
      marginBottom: 14,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      minHeight: height,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 3, height: 12, background: accent, borderRadius: 2 }} />
        <Line width={120} height={10} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Line key={i} width={`${80 - i * 8}%`} height={12} />
        ))}
      </div>
    </div>
  );
}

// KPI-shaped skeleton — narrow card with tiny label + big number bar
export function KpiSkeleton({ accent = "rgba(237,237,232,0.25)" }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: "12px 14px",
      borderTop: `2px solid ${accent}`,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <Line width={70} height={8} />
      <div style={{ height: 6 }} />
      <Line width="85%" height={22} radius={4} />
      <div style={{ height: 4 }} />
      <Line width={50} height={7} />
    </div>
  );
}

// Feed-row skeleton — article-style card with title + snippet + meta
export function RowSkeleton() {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 8,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <Line width="80%" height={12} />
      <div style={{ height: 8 }} />
      <Line width="95%" height={9} />
      <div style={{ height: 4 }} />
      <Line width="60%" height={9} />
    </div>
  );
}

// A pre-built grid of Kpi skeletons
export function KpiStripSkeleton({ count = 4 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 10, marginBottom: 14 }}>
      {Array.from({ length: count }).map((_, i) => <KpiSkeleton key={i} />)}
    </div>
  );
}
