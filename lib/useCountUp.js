import { useEffect, useState, useRef } from "react";

// Tween an integer from 0 → target over `duration` ms with an easing curve.
// Returns the current integer value; updates each animation frame.
// Respects prefers-reduced-motion — snaps to target instantly.
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target == null ? null : 0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target == null || typeof target !== "number" || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const prefersReduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(target);
      return;
    }
    fromRef.current = value ?? 0;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function tick(t) {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(target >= 1 ? Math.round(current) : current);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
