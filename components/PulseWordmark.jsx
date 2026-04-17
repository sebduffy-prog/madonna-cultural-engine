import { useRef, useEffect, useState } from "react";

// Interactive wordmark with cursor-driven magnetic tilt physics.
// The tilt only engages when the cursor is on or near the wordmark
// (inside its bounding box + a small halo). Outside the halo, the wordmark
// springs back to rest.

const WORD = "Pulse";
const WHITE = "#EDEDE8";

// How far outside the wordmark bounds still counts as "near"
const HALO_PX = 72;
// Max tilt in degrees
const MAX_TILT_X = 12;
const MAX_TILT_Y = 18;
// Spring constants (higher = faster follow)
const STIFFNESS = 0.14;
const DAMPING = 0.78;

export default function PulseWordmark({ size = 120, mode = "magnetic" }) {
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const stateRef = useRef({ rx: 0, ry: 0, vrx: 0, vry: 0, targetRx: 0, targetRy: 0 });
  const [, force] = useState(0); // local force-rerender trigger
  const rafRef = useRef(0);

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    function updateTarget(clientX, clientY) {
      const r = heading.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      // Inflate bounds by HALO_PX in every direction
      const inside =
        clientX >= r.left - HALO_PX &&
        clientX <= r.right + HALO_PX &&
        clientY >= r.top - HALO_PX &&
        clientY <= r.bottom + HALO_PX;

      if (!inside) {
        stateRef.current.targetRx = 0;
        stateRef.current.targetRy = 0;
        return;
      }

      // Normalised position within the halo-expanded box, -1..1
      const halfW = r.width / 2 + HALO_PX;
      const halfH = r.height / 2 + HALO_PX;
      const nx = Math.max(-1, Math.min(1, (clientX - cx) / halfW));
      const ny = Math.max(-1, Math.min(1, (clientY - cy) / halfH));

      // Proximity falloff — closer to the text = stronger tilt
      const distX = Math.abs(clientX - cx);
      const distY = Math.abs(clientY - cy);
      const proximityX = Math.max(0, 1 - Math.max(0, distX - r.width / 2) / HALO_PX);
      const proximityY = Math.max(0, 1 - Math.max(0, distY - r.height / 2) / HALO_PX);
      const proximity = Math.min(proximityX, proximityY);

      stateRef.current.targetRy = nx * MAX_TILT_Y * proximity;
      stateRef.current.targetRx = -ny * MAX_TILT_X * proximity;
    }

    function onMove(e) { updateTarget(e.clientX, e.clientY); }
    function onLeave() {
      stateRef.current.targetRx = 0;
      stateRef.current.targetRy = 0;
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("blur", onLeave);

    function tick() {
      const s = stateRef.current;
      // Spring each axis toward its target
      s.vrx += (s.targetRx - s.rx) * STIFFNESS;
      s.vry += (s.targetRy - s.ry) * STIFFNESS;
      s.vrx *= DAMPING;
      s.vry *= DAMPING;
      s.rx += s.vrx;
      s.ry += s.vry;

      const el = headingRef.current;
      if (el) {
        el.style.transform = `rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("blur", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ perspective: 900, display: "inline-block", userSelect: "none" }}
    >
      <h1
        ref={headingRef}
        style={{
          fontSize: size,
          fontWeight: 900,
          color: WHITE,
          margin: 0,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontFamily: "'Inter Tight', system-ui, sans-serif",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {WORD}
      </h1>
    </div>
  );
}
