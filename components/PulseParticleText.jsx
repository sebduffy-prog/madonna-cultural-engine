import { useEffect, useRef, useState } from "react";

// Text rendered as a cloud of particles. Cursor repels nearby particles and
// each one springs back to its anchor. The canvas is sized larger than the
// glyphs (via `bleed`) so particles can travel well outside the text bounds
// without being clipped; the canvas is absolutely positioned inside a sized
// wrapper so the outer layout only reserves the text-visual footprint and
// particles can drift behind neighbouring UI.
export default function PulseParticleText({
  text = "Pulse",
  fontSize = 64,
  fontWeight = 900,
  color = "#EDEDE8",
  particleSize = 2,
  particleDensity = 2,   // px stride between samples — must be ≤ particleSize to avoid a visible grid
  mouseRadius = 90,
  returnSpeed = 0.08,
  damping = 0.86,
  repelStrength = 5.5,
  bleed = 160,           // px of canvas area around the text for particles to travel through
  alphaThreshold = 190,  // pixel alpha cutoff — higher = tighter glyph silhouettes
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -99999, y: -99999, active: false });
  const rafRef = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0, tW: 0, tH: 0, baseX: 0, baseY: 0 });

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const fontCSS = `${fontWeight} ${fontSize}px 'Inter Tight', system-ui, sans-serif`;

    async function build() {
      // Wait for the font to be ready, otherwise the glyph metrics are wrong.
      if (typeof document !== "undefined" && document.fonts?.ready) {
        try { await document.fonts.ready; } catch {}
      }
      if (cancelled) return;

      const measure = document.createElement("canvas").getContext("2d");
      measure.font = fontCSS;
      const m = measure.measureText(text);
      const tW = Math.ceil(m.width);
      const tH = Math.ceil(fontSize * 1.15);
      const w = tW + bleed * 2;
      const h = tH + bleed * 2;
      // Anchor the glyphs at (bleed, bleed) within the canvas — gives equal
      // travel room in every direction.
      const baseX = bleed;
      const baseY = bleed;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const off = document.createElement("canvas");
      off.width = w * dpr;
      off.height = h * dpr;
      const oc = off.getContext("2d");
      oc.scale(dpr, dpr);
      oc.font = fontCSS;
      oc.fillStyle = "#ffffff";
      oc.textBaseline = "top";
      oc.textAlign = "left";
      oc.fillText(text, baseX, baseY);

      const data = oc.getImageData(0, 0, w * dpr, h * dpr).data;
      const stride = Math.max(1, Math.round(particleDensity * dpr));
      const ps = [];
      for (let y = 0; y < h * dpr; y += stride) {
        for (let x = 0; x < w * dpr; x += stride) {
          if (data[(y * w * dpr + x) * 4 + 3] > alphaThreshold) {
            const bx = x / dpr;
            const by = y / dpr;
            ps.push({ x: bx, y: by, baseX: bx, baseY: by, vx: 0, vy: 0 });
          }
        }
      }
      particlesRef.current = ps;
      setSize({ w, h, tW, tH, baseX, baseY });

      function onMove(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        mouseRef.current.x = mx;
        mouseRef.current.y = my;
        mouseRef.current.active =
          mx >= -mouseRadius && mx <= rect.width + mouseRadius &&
          my >= -mouseRadius && my <= rect.height + mouseRadius;
      }
      function onBlur() { mouseRef.current.active = false; }
      document.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("blur", onBlur);

      function tick() {
        const mouse = mouseRef.current;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color;
        const r = mouseRadius;
        const r2 = r * r;
        const arr = particlesRef.current;
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i];
          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const force = (r - d) / r;
              p.vx += (dx / d) * force * repelStrength;
              p.vy += (dy / d) * force * repelStrength;
            }
          }
          p.vx += (p.baseX - p.x) * returnSpeed;
          p.vy += (p.baseY - p.y) * returnSpeed;
          p.vx *= damping;
          p.vy *= damping;
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillRect(p.x, p.y, particleSize, particleSize);
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(rafRef.current);
        document.removeEventListener("mousemove", onMove);
        window.removeEventListener("blur", onBlur);
      };
    }

    let cleanup;
    build().then((fn) => { cleanup = fn; });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      cancelAnimationFrame(rafRef.current);
    };
  }, [text, fontSize, fontWeight, color, particleSize, particleDensity, mouseRadius, returnSpeed, damping, repelStrength, bleed, alphaThreshold]);

  // Outer wrapper takes up exactly the text's visual footprint so layout
  // flow is unchanged; the canvas itself bleeds outside that box so
  // particles can drift over adjacent UI.
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: size.tW || undefined,
        height: size.tH || undefined,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: -(size.baseX || 0),
          top: -(size.baseY || 0),
          display: "block",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </div>
  );
}
