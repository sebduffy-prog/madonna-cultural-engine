import { useState, useEffect, useCallback } from "react";

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

  if (loading) return <p style={{ color: MUTED, fontSize: 14 }}>Loading calendar...</p>;

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
          <p style={{ fontSize: 13, color: DIM, margin: 0 }}>Madonna events, cultural moments, and media block plans</p>
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

      {/* Month tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {MONTHS.map(m => (
          <button key={m} onClick={() => setActiveMonth(m)} style={{
            padding: "6px 16px", fontSize: 12, fontWeight: activeMonth === m ? 700 : 400,
            color: activeMonth === m ? BG : MUTED, background: activeMonth === m ? Y : "transparent",
            border: activeMonth === m ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
            fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>{m} 2026</button>
        ))}
      </div>

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
    </div>
  );
}
