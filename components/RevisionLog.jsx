// Revision log panel — shown inside an item modal (Idea or Tactic).
// Displays a compact list of prior edits with what changed from → to.
// Each revision stored as: { date, editedBy, changes: [{ field, from, to }] }
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const WHITE = "#EDEDE8";
const MUTED = "#777";
const Y = "#FFD500";
const TEAL = "#2DD4BF";
const FONT = "'Inter Tight', system-ui, sans-serif";

function renderValue(v) {
  if (v == null || v === "") return <span style={{ color: MUTED, fontStyle: "italic" }}>empty</span>;
  if (Array.isArray(v)) return v.filter(Boolean).join(", ") || <span style={{ color: MUTED, fontStyle: "italic" }}>empty</span>;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 200);
  const s = String(v);
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
}

export default function RevisionLog({ revisions = [], onClose }) {
  const list = Array.isArray(revisions) ? revisions : [];
  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: "min(420px, 92%)",
      background: BG, borderLeft: `1px solid ${BORDER}`, zIndex: 5,
      overflowY: "auto", boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
      fontFamily: FONT,
    }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.12em" }}>Revision log</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, letterSpacing: "-0.01em", marginTop: 2 }}>
            {list.length} revision{list.length === 1 ? "" : "s"}
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 28, height: 28, borderRadius: 14,
          background: "transparent", color: WHITE, border: `1px solid ${BORDER}`, cursor: "pointer",
          fontSize: 14, lineHeight: "26px", textAlign: "center",
        }}>×</button>
      </div>

      {list.length === 0 ? (
        <div style={{ padding: 20, fontSize: 12, color: WHITE, lineHeight: 1.55 }}>
          No revisions yet. Every future edit will appear here with a record of what changed, who changed it, and when.
        </div>
      ) : (
        <div style={{ padding: "4px 16px 20px" }}>
          {list.map((rev, i) => (
            <div key={i} style={{
              marginTop: 12, background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${Y}`,
              borderRadius: 6, padding: "10px 12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>
                  {rev.editedBy || "Anonymous"}
                </span>
                <span style={{ fontSize: 10, color: WHITE, opacity: 0.6 }}>
                  {rev.date ? new Date(rev.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}
                </span>
              </div>
              {(rev.changes || []).map((c, j) => (
                <div key={j} style={{ marginTop: 6, paddingTop: 6, borderTop: j ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {c.field}
                  </div>
                  <div style={{ fontSize: 11, color: WHITE, opacity: 0.7, marginTop: 3, lineHeight: 1.45 }}>
                    <span style={{ color: "#EF4444", textDecoration: "line-through" }}>{renderValue(c.from)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: WHITE, marginTop: 3, lineHeight: 1.45 }}>
                    <span style={{ color: "#34D399" }}>→ {renderValue(c.to)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
