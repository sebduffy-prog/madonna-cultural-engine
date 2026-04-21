import { useState, useEffect, useCallback } from "react";
import { PanelSkeleton } from "./Skeleton";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", CORAL = "#FB923C", PINK = "#F472B6";

const CHANNEL_COLORS = {
  social: TEAL, flyposting: CORAL, experimental: PURPLE, ooh: Y, digital: "#60A5FA", radio: GREEN, cinema: PINK, partnerships: "#F59E0B",
};

const CATEGORY_COLORS = {
  madonna: Y, fashion: PINK, culture: TEAL, nightlife: PURPLE, lgbtq: CORAL,
};

const MONTHS = ["April", "May", "June", "July"];
const MONTH_STARTS = {
  "April": new Date(2026, 3, 1), "May": new Date(2026, 4, 1),
  "June": new Date(2026, 5, 1), "July": new Date(2026, 6, 1),
};

function daysInMonth(monthName) {
  const d = MONTH_STARTS[monthName];
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function dayOfWeek(monthName, day) {
  const d = MONTH_STARTS[monthName];
  return new Date(d.getFullYear(), d.getMonth(), day).getDay();
}

function dateStr(monthName, day) {
  const d = MONTH_STARTS[monthName];
  return `2026-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CampaignCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState("April");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "timeline"
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [searching, setSearching] = useState(false);

  // Block plan form
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockChannel, setBlockChannel] = useState("social");
  const [blockTitle, setBlockTitle] = useState("");
  const [blockDesc, setBlockDesc] = useState("");
  const [blockComment, setBlockComment] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/calendar");
      setData(await r.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addBlock(e) {
    e.preventDefault();
    const userName = localStorage.getItem("sweettooth_user") || "Team";
    await fetch("/api/calendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-block", startDate: blockStart, endDate: blockEnd || blockStart,
        channel: blockChannel, title: blockTitle, description: blockDesc, comment: blockComment, createdBy: userName,
      }),
    });
    setShowBlockForm(false);
    setBlockStart(""); setBlockEnd(""); setBlockTitle(""); setBlockDesc(""); setBlockComment("");
    load();
  }

  async function deleteBlock(blockId) {
    await fetch("/api/calendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-block", blockId }),
    });
    load();
  }

  async function searchEvents() {
    setSearching(true);
    try {
      await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search-events" }),
      });
      load();
    } catch {} finally { setSearching(false); }
  }

  if (loading) return <div><PanelSkeleton rows={5} /></div>;

  const allEvents = [
    ...(data?.campaignEvents || []),
    ...(data?.culturalEvents || []),
  ];

  const blockPlans = data?.blockPlans || [];
  const days = daysInMonth(activeMonth);
  const firstDay = dayOfWeek(activeMonth, 1);

  function eventsForDay(day) {
    const ds = dateStr(activeMonth, day);
    return allEvents.filter(e => e.date === ds);
  }

  function blocksForDay(day) {
    const ds = dateStr(activeMonth, day);
    return blockPlans.filter(b => ds >= b.startDate && ds <= b.endDate);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Campaign Calendar</h2>
          <p style={{ fontSize: 13, color: WHITE, margin: 0 }}>Madonna events, cultural moments, and media block plans</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={searchEvents} disabled={searching} style={{
            padding: "8px 16px", fontSize: 11, fontWeight: 700, color: TEAL, background: "transparent",
            border: `1px solid ${TEAL}`, borderRadius: 6, cursor: searching ? "wait" : "pointer",
            fontFamily: "'Inter Tight', system-ui, sans-serif", opacity: searching ? 0.6 : 1,
          }}>{searching ? "Searching..." : "Search UK Cultural Events"}</button>
          <button onClick={() => setShowBlockForm(!showBlockForm)} style={{
            padding: "8px 16px", fontSize: 11, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>{showBlockForm ? "Cancel" : "+ Block Plan"}</button>
        </div>
      </div>

      {showBlockForm && (
        <form onSubmit={addBlock} style={{ background: CARD, borderRadius: 10, padding: 20, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>START DATE *</label>
              <input type="date" value={blockStart} onChange={e => setBlockStart(e.target.value)} required style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, boxSizing: "border-box",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>END DATE</label>
              <input type="date" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, boxSizing: "border-box",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>CHANNEL *</label>
              <select value={blockChannel} onChange={e => setBlockChannel(e.target.value)} style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6,
              }}>
                {Object.keys(CHANNEL_COLORS).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>TITLE *</label>
              <input value={blockTitle} onChange={e => setBlockTitle(e.target.value)} required style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", boxSizing: "border-box",
              }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>DESCRIPTION</label>
              <textarea value={blockDesc} onChange={e => setBlockDesc(e.target.value)} rows={2} style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>INTERNAL COMMENT</label>
              <textarea value={blockComment} onChange={e => setBlockComment(e.target.value)} rows={2} style={{
                width: "100%", padding: "8px", fontSize: 12, color: WHITE, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box",
              }} />
            </div>
          </div>
          <button type="submit" style={{
            padding: "8px 24px", fontSize: 12, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>Add Block Plan</button>
        </form>
      )}

      {/* View toggle + month tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setViewMode("grid")} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: viewMode === "grid" ? 700 : 600,
            color: viewMode === "grid" ? BG : WHITE, background: viewMode === "grid" ? TEAL : "transparent",
            border: viewMode === "grid" ? "none" : `1px solid rgba(237,237,232,0.55)`,
            borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
            letterSpacing: "0.02em", textTransform: "uppercase",
          }}>Month grid</button>
          <button onClick={() => setViewMode("timeline")} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: viewMode === "timeline" ? 700 : 600,
            color: viewMode === "timeline" ? BG : WHITE, background: viewMode === "timeline" ? TEAL : "transparent",
            border: viewMode === "timeline" ? "none" : `1px solid rgba(237,237,232,0.55)`,
            borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
            letterSpacing: "0.02em", textTransform: "uppercase",
          }}>Timeline</button>
        </div>
        {viewMode === "grid" && (
          <div style={{ display: "flex", gap: 4 }}>
            {MONTHS.map(m => (
              <button key={m} onClick={() => setActiveMonth(m)} style={{
                padding: "6px 16px", fontSize: 12, fontWeight: activeMonth === m ? 700 : 600,
                color: activeMonth === m ? BG : WHITE, background: activeMonth === m ? Y : "transparent",
                border: activeMonth === m ? "none" : `1px solid rgba(237,237,232,0.55)`, borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter Tight', system-ui, sans-serif",
              }}>{m} 2026</button>
            ))}
          </div>
        )}
      </div>

      {viewMode === "timeline" && (
        <MediaPlanTimeline
          blockPlans={blockPlans}
          events={allEvents}
          onSelectEvent={(e) => setSelectedEvent(e)}
        />
      )}
      {viewMode === "grid" && (<>
      {/* Calendar grid */}
      <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${BORDER}` }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ padding: "8px 4px", fontSize: 10, fontWeight: 700, color: MUTED, textAlign: "center", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 80, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }} />
          ))}
          {/* Day cells */}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const dayEvents = eventsForDay(day);
            const dayBlocks = blocksForDay(day);
            const isToday = dateStr(activeMonth, day) === new Date().toISOString().slice(0, 10);

            return (
              <div key={day} style={{
                minHeight: 80, padding: 4, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
                background: isToday ? `${Y}08` : "transparent",
              }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? Y : DIM, marginBottom: 4 }}>{day}</div>
                {dayEvents.map((e, j) => (
                  <div key={j} onClick={() => setSelectedEvent(e)} style={{
                    padding: "2px 4px", fontSize: 9, fontWeight: 600, borderRadius: 3, marginBottom: 2, cursor: "pointer",
                    background: `${CATEGORY_COLORS[e.category] || MUTED}22`,
                    color: CATEGORY_COLORS[e.category] || MUTED, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }} title={e.title}>
                    {e.title}
                  </div>
                ))}
                {dayBlocks.map((b, j) => (
                  <div key={`b-${j}`} onClick={() => setSelectedEvent(b)} style={{
                    padding: "2px 4px", fontSize: 9, fontWeight: 600, borderRadius: 3, marginBottom: 2, cursor: "pointer",
                    background: `${CHANNEL_COLORS[b.channel] || MUTED}33`,
                    color: CHANNEL_COLORS[b.channel] || MUTED, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    borderLeft: `2px solid ${CHANNEL_COLORS[b.channel] || MUTED}`,
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }} title={`${b.channel}: ${b.title}`}>
                    {b.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Events:</span>
        {Object.entries(CATEGORY_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v }} />
            <span style={{ fontSize: 10, color: DIM }}>{k}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginLeft: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Blocks:</span>
        {Object.entries(CHANNEL_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v }} />
            <span style={{ fontSize: 10, color: DIM }}>{k}</span>
          </div>
        ))}
      </div>

      {/* Selected event detail */}
      {selectedEvent && (
        <div style={{ background: CARD, borderRadius: 10, padding: 20, border: `1px solid ${BORDER}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{selectedEvent.title}</h3>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                {selectedEvent.date}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` to ${selectedEvent.endDate}` : ""}
                {selectedEvent.category && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: `${CATEGORY_COLORS[selectedEvent.category] || MUTED}22`, color: CATEGORY_COLORS[selectedEvent.category] || MUTED, fontSize: 10, fontWeight: 600 }}>{selectedEvent.category}</span>}
                {selectedEvent.channel && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: `${CHANNEL_COLORS[selectedEvent.channel] || MUTED}33`, color: CHANNEL_COLORS[selectedEvent.channel] || MUTED, fontSize: 10, fontWeight: 600 }}>{selectedEvent.channel}</span>}
              </p>
            </div>
            <button onClick={() => setSelectedEvent(null)} style={{
              padding: "4px 10px", fontSize: 11, color: MUTED, background: "transparent",
              border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer",
            }}>Close</button>
          </div>
          {selectedEvent.detail && <p style={{ fontSize: 13, color: DIM, marginTop: 12, lineHeight: 1.6 }}>{selectedEvent.detail}</p>}
          {selectedEvent.description && <p style={{ fontSize: 13, color: DIM, marginTop: 12, lineHeight: 1.6 }}>{selectedEvent.description}</p>}
          {selectedEvent.comment && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: `${MUTED}11`, borderRadius: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED }}>Internal note: </span>
              <span style={{ fontSize: 12, color: DIM }}>{selectedEvent.comment}</span>
            </div>
          )}
          {selectedEvent.venue && <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{selectedEvent.venue}{selectedEvent.city ? `, ${selectedEvent.city}` : ""}</p>}
          {selectedEvent.type === "block" && (
            <button onClick={() => { deleteBlock(selectedEvent.id); setSelectedEvent(null); }} style={{
              marginTop: 12, padding: "6px 14px", fontSize: 11, color: RED, background: "transparent",
              border: `1px solid ${RED}44`, borderRadius: 6, cursor: "pointer",
            }}>Delete block plan</button>
          )}
        </div>
      )}

      {/* Block plans list */}
      {blockPlans.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Active Block Plans</h3>
          {blockPlans.map(b => (
            <div key={b.id} onClick={() => setSelectedEvent(b)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: CARD,
              borderRadius: 8, border: `1px solid ${BORDER}`, marginBottom: 6, cursor: "pointer",
              borderLeft: `3px solid ${CHANNEL_COLORS[b.channel] || MUTED}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: CHANNEL_COLORS[b.channel] || MUTED, minWidth: 80, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{b.channel}</span>
              <span style={{ fontSize: 13, color: WHITE, fontWeight: 600, flex: 1 }}>{b.title}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{b.startDate} to {b.endDate}</span>
            </div>
          ))}
        </div>
      )}
      </>)}
    </div>
  );
}

// Horizontal Gantt view: rows grouped by channel, bars span startDate→endDate
// across the April–July window. Events render as vertical pins on the same
// timeline so cultural / Madonna dates show alongside media blocks.
function MediaPlanTimeline({ blockPlans = [], events = [], onSelectEvent }) {
  const START = new Date(2026, 3, 1);
  const END = new Date(2026, 6, 31);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((END - START) / DAY_MS) + 1;

  // px per day — wide enough that monthly tick labels breathe
  const dayW = 14;
  const labelW = 130;
  const rowH = 34;

  const channelRows = [];
  const byChannel = {};
  for (const b of blockPlans) {
    const ch = b.channel || "other";
    if (!byChannel[ch]) { byChannel[ch] = []; channelRows.push(ch); }
    byChannel[ch].push(b);
  }
  if (channelRows.length === 0) channelRows.push("social");

  function dayIndex(iso) {
    if (!iso) return 0;
    const d = new Date(iso);
    return Math.max(0, Math.min(totalDays - 1, Math.round((d - START) / DAY_MS)));
  }

  const months = [
    { label: "April 2026", start: new Date(2026, 3, 1), end: new Date(2026, 3, 30) },
    { label: "May 2026",   start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) },
    { label: "June 2026",  start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) },
    { label: "July 2026",  start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) },
  ];

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: labelW + totalDays * dayW }}>
          {/* Month header */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ width: labelW, flexShrink: 0, padding: "10px 12px", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter Tight', system-ui, sans-serif", borderRight: `1px solid ${BORDER}` }}>
              Channel
            </div>
            {months.map((m) => {
              const days = Math.round((m.end - m.start) / DAY_MS) + 1;
              return (
                <div key={m.label} style={{
                  width: days * dayW, flexShrink: 0, padding: "10px 10px",
                  fontSize: 11, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase",
                  borderRight: `1px solid ${BORDER}`, fontFamily: "'Inter Tight', system-ui, sans-serif",
                }}>
                  {m.label}
                </div>
              );
            })}
          </div>

          {/* Day ticks */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, height: 22 }}>
            <div style={{ width: labelW, flexShrink: 0, borderRight: `1px solid ${BORDER}` }} />
            <div style={{ position: "relative", width: totalDays * dayW, height: 22 }}>
              {Array.from({ length: totalDays }, (_, i) => {
                const date = new Date(START.getTime() + i * DAY_MS);
                const dom = date.getDate();
                const isMonday = date.getDay() === 1;
                return (
                  <div key={i} style={{
                    position: "absolute", left: i * dayW, top: 0, width: dayW, height: 22,
                    borderRight: dom === 1 ? `1px solid ${BORDER}` : "none",
                    textAlign: "center",
                  }}>
                    {(isMonday || dom === 1) && (
                      <span style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif", lineHeight: "22px" }}>{dom}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Channel rows with blocks */}
          {channelRows.map((channel) => (
            <div key={channel} style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, minHeight: rowH * 1.4 }}>
              <div style={{
                width: labelW, flexShrink: 0, padding: "10px 12px",
                fontSize: 11, fontWeight: 700, color: CHANNEL_COLORS[channel] || WHITE,
                textTransform: "uppercase", letterSpacing: "0.06em",
                borderRight: `1px solid ${BORDER}`, fontFamily: "'Inter Tight', system-ui, sans-serif",
              }}>
                {channel}
              </div>
              <div style={{ position: "relative", width: totalDays * dayW, minHeight: rowH * 1.4 }}>
                {/* Weekly grid lines */}
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                  <div key={i} style={{ position: "absolute", left: i * 7 * dayW, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.04)" }} />
                ))}
                {(byChannel[channel] || []).map((b, i) => {
                  const s = dayIndex(b.startDate);
                  const e = dayIndex(b.endDate);
                  const w = Math.max(dayW, (e - s + 1) * dayW - 2);
                  const col = CHANNEL_COLORS[channel] || "#60A5FA";
                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectEvent(b)}
                      title={`${b.title} · ${b.startDate} → ${b.endDate}`}
                      style={{
                        position: "absolute",
                        left: s * dayW + 1, top: 6 + (i % 2) * 18,
                        width: w, height: 22,
                        background: `${col}33`, border: `1px solid ${col}`,
                        borderRadius: 4, color: WHITE, fontSize: 10, fontWeight: 700,
                        padding: "2px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
                      }}
                    >
                      {b.title || channel}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Events row — pins */}
          {events.length > 0 && (
            <div style={{ display: "flex", minHeight: rowH }}>
              <div style={{
                width: labelW, flexShrink: 0, padding: "10px 12px",
                fontSize: 11, fontWeight: 700, color: Y, textTransform: "uppercase", letterSpacing: "0.06em",
                borderRight: `1px solid ${BORDER}`, fontFamily: "'Inter Tight', system-ui, sans-serif",
              }}>
                Events
              </div>
              <div style={{ position: "relative", width: totalDays * dayW, minHeight: rowH }}>
                {events.map((ev, idx) => {
                  const s = dayIndex(ev.date);
                  const col = CATEGORY_COLORS[ev.category] || Y;
                  return (
                    <div
                      key={`${ev.date}-${idx}`}
                      onClick={() => onSelectEvent(ev)}
                      title={`${ev.title} · ${ev.date}`}
                      style={{
                        position: "absolute",
                        left: s * dayW + 1, top: 4,
                        width: Math.max(dayW - 2, 10), height: rowH - 8,
                        background: `${col}66`, border: `1px solid ${col}`,
                        borderRadius: 3, cursor: "pointer",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "8px 12px", fontSize: 10, color: WHITE, fontFamily: "'Inter Tight', system-ui, sans-serif", opacity: 0.7 }}>
        Scroll horizontally · click any bar or event pin for detail
      </div>
    </div>
  );
}
