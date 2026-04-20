import { useState, useEffect } from "react";
import { AUDIENCE_OPTIONS, resolveAudience } from "../lib/audiences";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", TEAL = "#2DD4BF";

const CHANNEL_OPTIONS = [
  "social", "flyposting", "experimental", "ooh", "digital", "radio", "cinema", "partnerships",
];

function guessChannel(raw) {
  if (!raw) return "social";
  const s = String(raw).toLowerCase();
  if (CHANNEL_OPTIONS.includes(s)) return s;
  if (/tiktok|insta|snap|facebook|twitter|x\b|reddit|threads|pinterest|social/.test(s)) return "social";
  if (/flypost|poster|stencil|wheatpaste/.test(s)) return "flyposting";
  if (/experiential|activation|install|pop.?up|stunt|guerrilla/.test(s)) return "experimental";
  if (/ooh|billboard|6-sheet|bus|tube|transit|out.?of.?home/.test(s)) return "ooh";
  if (/digital|display|programmatic|native|banner|pre.?roll/.test(s)) return "digital";
  if (/radio|podcast|audio|spotify|apple music/.test(s)) return "radio";
  if (/cinema|theatre|screen/.test(s)) return "cinema";
  if (/partner|collab|brand|sponsor/.test(s)) return "partnerships";
  return "social";
}

/**
 * AddToPlanButton — opens a small modal to pick date(s)+channel and posts
 * to /api/calendar (add-block). Works for ideas and tactics.
 *
 * Props:
 *  - title: required — becomes the block title
 *  - description: optional — becomes the block description
 *  - defaultChannel: optional string (raw channel name — will be normalized)
 *  - size: "sm" (card row) | "md" (detail modal)
 *  - onAdded: optional callback
 */
export default function AddToPlanButton({ title, description = "", defaultChannel, defaultAudience, size = "sm", onAdded }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [channel, setChannel] = useState(guessChannel(defaultChannel));
  const [audience, setAudience] = useState(resolveAudience(defaultAudience)?.key || "");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    // reset transient state each time the modal opens
    setStatus("idle"); setErrMsg("");
    setChannel(guessChannel(defaultChannel));
    setAudience(resolveAudience(defaultAudience)?.key || "");
    // default start date to today (YYYY-MM-DD in local tz)
    if (!start) {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setStart(iso);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    if (!start) { setErrMsg("Start date required"); return; }
    setStatus("saving"); setErrMsg("");
    try {
      const userName = (typeof window !== "undefined" && localStorage.getItem("sweettooth_user")) || "Team";
      const r = await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-block",
          startDate: start,
          endDate: end || start,
          channel,
          title,
          description,
          comment: "",
          audience,
          createdBy: userName,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setStatus("error"); setErrMsg(data.error || `Request failed (${r.status})`); return;
      }
      setStatus("saved");
      if (onAdded) onAdded(data.block);
      // auto-close after brief confirmation
      setTimeout(() => { setOpen(false); setStatus("idle"); setEnd(""); }, 900);
    } catch (err) {
      setStatus("error"); setErrMsg(err.message || "Network error");
    }
  }

  const btnSm = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", fontSize: 11, fontWeight: 700,
    color: Y, background: `${Y}12`,
    border: `1px solid ${Y}55`, borderRadius: 6, cursor: "pointer",
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  };
  const btnMd = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", fontSize: 12, fontWeight: 700,
    color: BG, background: Y,
    border: "none", borderRadius: 8, cursor: "pointer",
    fontFamily: "'Inter Tight', system-ui, sans-serif",
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px", fontSize: 13, color: WHITE, background: BG,
    border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
    fontFamily: "'Inter Tight', system-ui, sans-serif", boxSizing: "border-box",
    colorScheme: "dark",
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: MUTED, display: "block", marginBottom: 4,
    letterSpacing: "0.06em", textTransform: "uppercase",
    fontFamily: "'Inter Tight', system-ui, sans-serif",
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={size === "md" ? btnMd : btnSm}
        title="Add to campaign plan"
      >
        {size === "md" ? <>&#128197; Add to Plan</> : <>&#43; Plan</>}
      </button>

      {open && (
        <div
          onClick={() => { if (status !== "saving") setOpen(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 1100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={submit}
            style={{
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
              width: "100%", maxWidth: 440, padding: "22px 24px 20px", position: "relative",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={status === "saving"}
              style={{
                position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 14,
                background: `${BG}cc`, color: WHITE, border: `1px solid ${BORDER}`, cursor: "pointer",
                fontSize: 14, lineHeight: "26px", textAlign: "center", padding: 0,
              }}
            >&times;</button>

            <div style={{ fontSize: 10, fontWeight: 700, color: Y, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              Add to Plan
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: WHITE, margin: "0 0 16px", lineHeight: 1.3, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              {title}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Start date *</label>
                <input type="date" required value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End date</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} min={start || undefined} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {CHANNEL_OPTIONS.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Audience</label>
                <select value={audience} onChange={e => setAudience(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">All / unspecified</option>
                  {AUDIENCE_OPTIONS.map(a => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {defaultChannel && guessChannel(defaultChannel) !== String(defaultChannel).toLowerCase() && (
              <div style={{ fontSize: 10, color: DIM, margin: "-8px 0 12px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                Source channel: &ldquo;{defaultChannel}&rdquo; &middot; mapped for calendar colour
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 6, borderTop: `1px solid ${BORDER}55` }}>
              <div style={{ fontSize: 11, minHeight: 16, fontFamily: "'Inter Tight', system-ui, sans-serif",
                color: status === "error" ? "#EF4444" : status === "saved" ? GREEN : DIM,
              }}>
                {status === "saving" && "Adding to calendar..."}
                {status === "saved" && <>&#10003; Added &mdash; find it in the Calendar tab</>}
                {status === "error" && errMsg}
                {status === "idle" && (end && end !== start ? "Will span from start to end date" : "Will be placed on the start date")}
              </div>
              <button
                type="submit"
                disabled={status === "saving" || status === "saved"}
                style={{
                  padding: "9px 20px", fontSize: 12, fontWeight: 700, color: BG,
                  background: status === "saved" ? GREEN : Y,
                  border: "none", borderRadius: 6,
                  cursor: status === "saving" ? "wait" : "pointer",
                  fontFamily: "'Inter Tight', system-ui, sans-serif",
                  opacity: status === "saving" ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {status === "saved" ? "Added" : status === "saving" ? "Adding..." : "Add to Plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
