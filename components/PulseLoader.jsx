import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const Y = "#FFD500";
const BG = "#0C0C0C";
const WHITE = "#EDEDE8";
const DIM = "#999";

const STATUS_LABELS = [
  "Warming caches",
  "Pulling social listening",
  "Syncing chart data",
  "Fetching Spotify streams",
  "Indexing media",
  "Querying Wikipedia",
  "Reading sentiment",
  "Computing market strength",
];

// Full-screen branded pre-entry loader.
// progress: 0..1, advances as parallel prefetches resolve. Animates smoothly.
export default function PulseLoader({ progress = 0 }) {
  const [labelIdx, setLabelIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setLabelIdx(i => (i + 1) % STATUS_LABELS.length), 900);
    return () => clearInterval(t);
  }, []);

  const size = 140;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: BG,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter Tight', system-ui, sans-serif",
      }}
    >
      {/* VCCP kicker */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        style={{ fontSize: 10, fontWeight: 700, color: Y, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}
      >
        VCCP Media Cultural Intelligence
      </motion.div>

      {/* PULSE wordmark */}
      <motion.h1
        initial={{ opacity: 0, y: 10, letterSpacing: "-0.08em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "-0.02em" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontSize: 64, fontWeight: 800, color: WHITE, margin: "0 0 4px", lineHeight: 1,
        }}
      >
        Pulse
      </motion.h1>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
        style={{ height: 3, width: 120, background: Y, borderRadius: 2, transformOrigin: "center", margin: "12px 0 32px" }}
      />

      {/* Progress ring */}
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={`${WHITE}22`} strokeWidth={stroke}
            fill="none"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={Y} strokeWidth={stroke}
            fill="none" strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - clamped) }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: WHITE, letterSpacing: "-0.02em",
        }}>
          {Math.round(clamped * 100)}%
        </div>
      </div>

      {/* Rotating status label */}
      <div style={{ height: 18, marginTop: 24, overflow: "hidden" }}>
        <motion.div
          key={labelIdx}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          style={{ fontSize: 11, color: DIM, letterSpacing: "0.04em", textAlign: "center" }}
        >
          {STATUS_LABELS[labelIdx]}…
        </motion.div>
      </div>
    </motion.div>
  );
}
