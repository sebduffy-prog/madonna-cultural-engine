import { useEffect, useRef, useState } from "react";

// Text rendered as a cloud of particles — one per physical pixel of the
// rasterised glyphs, each carrying its source alpha. At rest the canvas
// is pixel-identical to the native font; in motion the physics move the
// particles (with subpixel-accurate putImageData blending) so the glyphs
// dissolve and reform smoothly instead of flickering between chunky blocks.
//
// The canvas is sized `textW + 2·bleed` × `textH + 2·bleed`, anchored so the
// glyphs sit in the middle. Bleed is derived from the repel physics so a
// particle can always reach its physical maximum before clipping. The canvas
// is absolutely positioned inside a wrapper sized only to the text's visible
// footprint, so layout isn't pushed around.
export default function PulseParticleText({
  text = "The Recording Studio",
  fontSize = 64,
  fontWeight = 900,
  color = "#EDEDE8",
  mouseRadius = 90,
  returnSpeed = 0.08,
  damping = 0.86,
  repelStrength = 5.5,
  alphaThreshold = 8,       // capture every faint edge pixel
  bleed,                    // overridable; otherwise derived from physics
}) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -99999, y: -99999, active: false });
  const rafRef = useRef(0);
  const [size, setSize] = useState({ tW: 0, tH: 0, anchorX: 0, anchorY: 0 });

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const fontCSS = `${fontWeight} ${fontSize}px 'Inter Tight', system-ui, sans-serif`;

    const steadyStateReach = repelStrength / returnSpeed;   // spring v/k
    const autoBleed = Math.ceil(mouseRadius + steadyStateReach * 1.2 + 40);
    const effBleed = bleed != null ? bleed : autoBleed;

    async function build() {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        try { await document.fonts.ready; } catch {}
      }
      if (cancelled) return;

      const measure = document.createElement("canvas").getContext("2d");
      measure.font = fontCSS;
      const m = measure.measureText(text);
      const tW = Math.ceil(m.width);
      const tH = Math.ceil(fontSize * 1.15);
      const w = tW + effBleed * 2;
      const h = tH + effBleed * 2;
      const anchorX = effBleed;
      const anchorY = effBleed;
      const pw = w * dpr;
      const ph = h * dpr;

      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // Render glyphs once to an offscreen canvas at full DPR, then sample
      // every physical pixel whose alpha clears the threshold.
      const off = document.createElement("canvas");
      off.width = pw;
      off.height = ph;
      const oc = off.getContext("2d");
      oc.scale(dpr, dpr);
      oc.font = fontCSS;
      oc.fillStyle = "#ffffff";
      oc.textBaseline = "top";
      oc.textAlign = "left";
      oc.fillText(text, anchorX, anchorY);

      const src = oc.getImageData(0, 0, pw, ph).data;
      const ps = [];
      // Store positions in CSS coords so physics + cursor math stays simple.
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const a = src[(y * pw + x) * 4 + 3];
          if (a > alphaThreshold) {
            const bx = x / dpr;
            const by = y / dpr;
            ps.push({ x: bx, y: by, baseX: bx, baseY: by, vx: 0, vy: 0, a });
          }
        }
      }
      particlesRef.current = ps;
      setSize({ tW, tH, anchorX, anchorY });

      // Reusable ImageData buffer — allocated once, cleared per frame.
      const frame = ctx.createImageData(pw, ph);
      const out = frame.data;
      const parsed = parseHex(color);

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

      const R = parsed.r, G = parsed.g, B = parsed.b;

      function tick() {
        const mouse = mouseRef.current;
        // Zero the output buffer — clear each frame so stale particle
        // positions don't leave trails.
        out.fill(0);
        const r = mouseRadius;
        const r2 = r * r;
        const arr = particlesRef.current;

        for (let i = 0; i < arr.length; i++) {
          const p = arr[i];

          // --- physics ---
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

          // --- subpixel-accurate render to the ImageData buffer ---
          const fx = p.x * dpr;
          const fy = p.y * dpr;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          if (ix < 0 || iy < 0 || ix >= pw - 1 || iy >= ph - 1) continue;
          const sx = fx - ix;
          const sy = fy - iy;
          const w00 = (1 - sx) * (1 - sy);
          const w10 = sx * (1 - sy);
          const w01 = (1 - sx) * sy;
          const w11 = sx * sy;
          const srcA = p.a;
          const row = pw * 4;
          const base = iy * row + ix * 4;
          putPixel(out, base,               R, G, B, srcA * w00);
          putPixel(out, base + 4,           R, G, B, srcA * w10);
          putPixel(out, base + row,         R, G, B, srcA * w01);
          putPixel(out, base + row + 4,     R, G, B, srcA * w11);
        }

        ctx.putImageData(frame, 0, 0);
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
  }, [text, fontSize, fontWeight, color, mouseRadius, returnSpeed, damping, repelStrength, alphaThreshold, bleed]);

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
          left: -(size.anchorX || 0),
          top: -(size.anchorY || 0),
          display: "block",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </div>
  );
}

// "Nearest particle wins" pixel accumulator — keeps edges sharp when
// particles cluster back to rest (a lighter particle doesn't darken a
// heavier one behind it).
function putPixel(out, idx, r, g, b, a) {
  if (a <= 0.5) return;
  const A = a > 255 ? 255 : a | 0;
  if (A > out[idx + 3]) {
    out[idx] = r;
    out[idx + 1] = g;
    out[idx + 2] = b;
    out[idx + 3] = A;
  }
}

function parseHex(hex) {
  const s = (hex || "#ffffff").replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return {
    r: parseInt(full.slice(0, 2), 16) || 255,
    g: parseInt(full.slice(2, 4), 16) || 255,
    b: parseInt(full.slice(4, 6), 16) || 255,
  };
}
