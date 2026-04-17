import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import PulseWordmark from "./PulseWordmark";

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

const ROTATION_IMAGES = [
  "/homepage-rotation/FirstImage.png",
  ...Array.from({ length: 16 }, (_, i) => `/homepage-rotation/rotation-${String(i + 1).padStart(2, "0")}.png`),
];

// Particle field drifting behind the wordmark (subtle golden "powder" effect).
// Canvas-based for performance; emits 80 particles drifting upward with gentle turbulence.
export function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = canvas.width = canvas.offsetWidth * devicePixelRatio;
    let h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    const dpr = devicePixelRatio || 1;

    const count = 90;
    const particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (0.4 + Math.random() * 1.6) * dpr,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (-0.15 - Math.random() * 0.6) * dpr,
      life: Math.random(),
      hueShift: Math.random(),
    }));

    let raf = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.04 * dpr;
        p.life -= 0.003;
        if (p.life <= 0 || p.y < -8 || p.x < -8 || p.x > w + 8) {
          p.x = Math.random() * w;
          p.y = h + Math.random() * 40;
          p.vx = (Math.random() - 0.5) * 0.25 * dpr;
          p.vy = (-0.15 - Math.random() * 0.6) * dpr;
          p.life = 0.6 + Math.random() * 0.4;
        }
        const alpha = Math.min(p.life, 1) * 0.55;
        const gold = `rgba(255, ${210 + Math.floor(p.hueShift * 25)}, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = gold;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    function onResize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", mixBlendMode: "screen", opacity: 0.9,
      }}
    />
  );
}

// Full-screen branded pre-entry loader.
// progress: 0..1, advances as parallel prefetches resolve.
export default function PulseLoader({ progress = 0 }) {
  const [labelIdx, setLabelIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(() => Math.floor(Math.random() * ROTATION_IMAGES.length));

  useEffect(() => {
    const t = setInterval(() => setLabelIdx(i => (i + 1) % STATUS_LABELS.length), 900);
    return () => clearInterval(t);
  }, []);

  // Rotate backgrounds every 500ms (matches login-screen cadence)
  useEffect(() => {
    const t = setInterval(() => setImageIdx(i => (i + 1) % ROTATION_IMAGES.length), 500);
    return () => clearInterval(t);
  }, []);

  const size = 120;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      transition={{ duration: 0.3 }}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: BG,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Image rotation layer — stacked crossfade like the login screen */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {ROTATION_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center",
              opacity: i === imageIdx ? 1 : 0,
              transition: "opacity 220ms ease-in-out",
            }}
          />
        ))}
        {/* Darkening overlay so the wordmark pops */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(12,12,12,0.65)" }} />
      </div>

      {/* Particle field — behind the wordmark, in front of the image */}
      <ParticleField />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* VCCP kicker */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ fontSize: 11, fontWeight: 700, color: Y, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}
        >
          VCCP Media Cultural Intelligence
        </motion.div>

        {/* Pulse wordmark — cursor-interactive, no glow */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ margin: "0 0 8px" }}
        >
          <PulseWordmark size={120} />
        </motion.div>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
          style={{ height: 3, width: 180, background: Y, borderRadius: 2, transformOrigin: "center", margin: "14px 0 40px" }}
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
            fontSize: 20, fontWeight: 700, color: WHITE, letterSpacing: "-0.02em",
          }}>
            {Math.round(clamped * 100)}%
          </div>
        </div>

        {/* Rotating status label */}
        <div style={{ height: 18, marginTop: 22, overflow: "hidden" }}>
          <motion.div
            key={labelIdx}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{ fontSize: 11, color: WHITE, opacity: 0.75, letterSpacing: "0.06em", textAlign: "center" }}
          >
            {STATUS_LABELS[labelIdx]}…
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
