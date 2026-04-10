import { useState } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const GREEN = "#34D399";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const TEAL = "#2DD4BF";
const PURPLE = "#A78BFA";
const CORAL = "#FB923C";
const PINK = "#F472B6";

function Sect({ title, children, accent = Y }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}