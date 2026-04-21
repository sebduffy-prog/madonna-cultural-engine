import { useEffect, useRef } from "react";

// Text rendered as a cloud of particles. Cursor repels nearby particles;
// each one springs back to its anchor position. Replaces the previous
// cursor-magnetic-tilt wordmark on the login screen.
export default function PulseParticleText({
  text = "Pulse",
  fontSize = 120,
  fontWeight = 900,
  color = "#EDEDE8",
  particleSize = 2,
  particleDensity = 4,   // pixel step between samples — lower = denser
  mouseRadius = 120,
  returnSpeed = 0.08,
  damping = 0.86,
  repelStrength = 5.5,
  padding = 48,
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -99999, y: -99999, active: false });
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

    const fontCSS = `${fontWeight} ${fontSize}px 'Inter Tight', system-ui, sans-serif`;

    // Measure text to size the canvas
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = fontCSS;
    const metrics = measure.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = Math.ceil(fontSize * 1.15);
    const w = textW + padding * 2;
    const h = textH + padding;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Offscreen sampling canvas at full DPR for crisp particle positioning
    const off = document.createElement("canvas");
    off.width = w * dpr;
    off.height = h * dpr;
    const offCtx = off.getContext("2d");
    offCtx.scale(dpr, dpr);
    offCtx.font = fontCSS;
    offCtx.fillStyle = "#ffffff";
    offCtx.textBaseline = "top";
    offCtx.textAlign = "left";
    offCtx.fillText(text, padding, padding / 2);

    const img = offCtx.getImageData(0, 0, w * dpr, h * dpr);
    const data = img.data;
    const step = Math.max(1, Math.round(particleDensity * dpr));
    const particles = [];
    for (let y = 0; y < h * dpr; y += step) {
      for (let x = 0; x < w * dpr; x += step) {
        const a = data[(y * w * dpr + x) * 4 + 3];
        if (a > 160) {
          const baseX = x / dpr;
          const baseY = y / dpr;
          particles.push({ x: baseX, y: baseY, baseX, baseY, vx: 0, vy: 0 });
        }
      }
    }
    particlesRef.current = particles;

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
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
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
  }, [text, fontSize, fontWeight, color, particleSize, particleDensity, mouseRadius, returnSpeed, damping, repelStrength, padding]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        margin: "0 auto",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}
