// Framer Motion shared variants — one source of truth for dashboard physics.
// Every animation should use a variant from here (or be deliberate about why not).

export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 22, mass: 1 };
export const SPRING_TIGHT = { type: "spring", stiffness: 380, damping: 28 };
export const SPRING_BOUNCE = { type: "spring", stiffness: 420, damping: 16 };

// Page-level stagger — use on the top-level tab wrapper so every child panel cascades in
export const pageStagger = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
};

// Panel / card entry — subtle rise + fade, springs to rest
export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: SPRING_SOFT },
  exit: { opacity: 0, y: -8, transition: { duration: 0.14 } },
};

// KPI numeric tile — scales + fades in with a light spring
export const kpiTween = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

// Hover lift — apply via whileHover on Panel wrappers
export const hoverLift = { y: -2, transition: { type: "spring", stiffness: 300, damping: 20 } };

// SVG chart path draw — use on polyline/path with pathLength animation
export const chartDraw = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1, transition: { duration: 0.9, ease: "easeOut" } },
};

// Ticker physics — see MentionsTicker.jsx for velocity-based animation
export const TICKER_SPEED_PX_PER_SEC = 60; // constant velocity target
export const TICKER_HOVER_BRAKE = { type: "spring", stiffness: 40, damping: 18 };
export const TICKER_RESUME_SPRING = { type: "spring", stiffness: 30, damping: 20 };
