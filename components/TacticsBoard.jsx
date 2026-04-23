import { useState, useEffect, useCallback } from "react";
import { PanelSkeleton } from "./Skeleton";
import AddToPlanButton from "./AddToPlanButton";
import RevisionLog from "./RevisionLog";
import { AUDIENCE_OPTIONS, audienceLabel } from "../lib/audiences";

// Accepts legacy single-string audience or new array — returns array of keys.
function asAudienceArray(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean);
  return [a];
}

function tacticDescription(t) {
  const auds = asAudienceArray(t.audience).map(audienceLabel).filter(Boolean);
  const dates = formatTacticDates(t);
  return [
    t.roleOfChannel && `Role: ${t.roleOfChannel}`,
    auds.length ? `Audience: ${auds.join(", ")}` : null,
    t.audienceDetail && `Detail: ${t.audienceDetail}`,
    t.format && `Format: ${t.format}`,
    t.phase && `Phase: ${t.phase}`,
    t.budget && `Budget: ${t.budget}`,
    dates && `Dates: ${dates}`,
    t.notes && `Notes: ${t.notes}`,
  ].filter(Boolean).join(" \u2014 ");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTacticDates(t) {
  if (!t.startDate && !t.endDate) return "";
  if (t.startDate && t.endDate && t.startDate !== t.endDate) {
    return `${formatDate(t.startDate)} → ${formatDate(t.endDate)}`;
  }
  return formatDate(t.startDate || t.endDate);
}

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF";

const CHANNEL_OPTIONS = [
  { key: "Social",        label: "Social",        color: TEAL },
  { key: "OOH",           label: "OOH",           color: Y },
  { key: "PPC",           label: "PPC",           color: GREEN },
  { key: "Audio",         label: "Audio",         color: "#A78BFA" },
  { key: "Video",         label: "Video",         color: "#FB7185" },
  { key: "Experiential",  label: "Experiential",  color: "#F59E0B" },
];
const CHANNEL_KEYS = CHANNEL_OPTIONS.map(c => c.key);
const CHANNEL_BY_KEY = Object.fromEntries(CHANNEL_OPTIONS.map(c => [c.key, c]));

const PILLAR_OPTIONS = [
  { key: "tease",   label: "Tease",   color: "#F472B6" },
  { key: "launch",  label: "Launch",  color: TEAL },
  { key: "sustain", label: "Sustain", color: "#FB923C" },
];
const PILLAR_BY_KEY = Object.fromEntries(PILLAR_OPTIONS.map(p => [p.key, p]));

const STATUS_OPTIONS = [
  { key: "Proposed", color: MUTED },
  { key: "Planned",  color: TEAL },
  { key: "Approved", color: GREEN },
  { key: "Booked",   color: Y },
];
const STATUS_BY_KEY = Object.fromEntries(STATUS_OPTIONS.map(s => [s.key, s]));

// Legacy tactics stored freeform channel text and no title.
// For display/edit, treat that freeform value as the title and leave channel unset.
function displayTitle(t) {
  if (t.title) return t.title;
  if (t.channel && !CHANNEL_KEYS.includes(t.channel)) return t.channel;
  return "";
}
function displayChannel(t) {
  if (t.channel && CHANNEL_KEYS.includes(t.channel)) return t.channel;
  return "";
}

const FIELDS = [
  { key: "title", label: "Title", placeholder: "e.g. TikTok launch film, OOH takeover, Spotify sponsorship" },
  { key: "channel", label: "Channel", type: "channel-select", hint: "Pick one" },
  { key: "pillar", label: "Pillar", type: "pillar-select", hint: "Where does this sit in the campaign story?" },
  { key: "status", label: "Status", type: "status-select", hint: "Proposed · Planned · Approved · Booked" },
  { key: "objective", label: "Objective", placeholder: "What this tactic is here to achieve" },
  { key: "kpi", label: "Optimised KPI", placeholder: "e.g. view-through rate, completion, ticket sales" },
  { key: "roleOfChannel", label: "Tactic", placeholder: "What this channel is doing in the mix (reach, reappraisal, proof, depth...)" },
  { key: "audience", label: "Audience", type: "multi-audience", hint: "Pick one or more — click to toggle" },
  { key: "audienceDetail", label: "Audience Detail", placeholder: "Specific mindset, behaviour, sub-cohort — freeform" },
  { key: "format", label: "Format", placeholder: "Specific executional format (15s vertical, 6-sheet, native article...)" },
  { key: "phase", label: "Phase", placeholder: "e.g. Tease, Announce, Launch, Amplify, Sustain — freeform" },
  { key: "budget", label: "Budget", placeholder: "e.g. £25k, £100–150k, TBC — freeform" },
  { key: "campaignDates", label: "Campaign Dates", type: "date-range", hint: "Start and end dates for this tactic" },
  { key: "notes", label: "Notes", placeholder: "Anything else — rationale, dependencies, references" },
];

const EMPTY_FORM = { title: "", channel: "", pillar: "", status: "Proposed", objective: "", kpi: "", roleOfChannel: "", audience: [], audienceDetail: "", format: "", phase: "", budget: "", startDate: "", endDate: "", notes: "" };

function getUserId() {
  let id = localStorage.getItem("sweettooth_user");
  if (!id) {
    id = prompt("Enter your name for the Tactics Board:") || "Anonymous";
    localStorage.setItem("sweettooth_user", id);
  }
  return id;
}

export default function TacticsBoard() {
  const [tactics, setTactics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [commentTexts, setCommentTexts] = useState({});
  const [commentNames, setCommentNames] = useState({});

  const [form, setForm] = useState({ ...EMPTY_FORM });

  function toggleAudience(key) {
    setForm((f) => {
      const arr = Array.isArray(f.audience) ? f.audience : asAudienceArray(f.audience);
      const has = arr.includes(key);
      return { ...f, audience: has ? arr.filter((k) => k !== key) : [...arr, key] };
    });
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tactics");
      const d = await r.json();
      setTactics(d.tactics || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    const userId = getUserId();
    const r = await fetch("/api/tactics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...form, createdBy: userId }),
    });
    const data = await r.json();
    if (data.ok) {
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      load();
    } else {
      alert("Failed to create tactic: " + (data.error || r.status));
    }
  }

  async function react(tacticId, action) {
    const visitorId = (() => {
      let id = localStorage.getItem("sweettooth_voter");
      if (!id) { id = "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); localStorage.setItem("sweettooth_voter", id); }
      return id;
    })();
    await fetch("/api/tactics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tacticId, userId: visitorId }),
    });
    load();
  }

  async function addComment(tacticId) {
    const text = commentTexts[tacticId];
    const name = commentNames[tacticId];
    if (!text?.trim()) return;
    if (!name?.trim()) { alert("Please enter your name to comment"); return; }
    localStorage.setItem("sweettooth_user", name);
    await fetch("/api/tactics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", tacticId, author: name, text }),
    });
    setCommentTexts({ ...commentTexts, [tacticId]: "" });
    load();
  }

  const [selectedTactic, setSelectedTactic] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const [filterChannel, setFilterChannel] = useState("");
  const [filterPillar, setFilterPillar] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const channelCounts = CHANNEL_OPTIONS.map(c => ({
    key: c.key,
    label: c.label,
    color: c.color,
    count: tactics.filter(t => displayChannel(t) === c.key).length,
  }));
  const uncategorizedCount = tactics.filter(t => !displayChannel(t)).length;
  const filterOptions = [
    { key: "", label: "All", count: tactics.length, color: Y },
    ...channelCounts,
    ...(uncategorizedCount > 0 ? [{ key: "__uncategorized__", label: "Uncategorized", count: uncategorizedCount, color: MUTED }] : []),
  ];

  const pillarFilterOptions = [
    { key: "", label: "All", count: tactics.length, color: Y },
    ...PILLAR_OPTIONS.map(p => ({ key: p.key, label: p.label, color: p.color, count: tactics.filter(t => t.pillar === p.key).length })),
  ];
  const statusFilterOptions = [
    { key: "", label: "All", count: tactics.length, color: Y },
    ...STATUS_OPTIONS.map(s => ({ key: s.key, label: s.key, color: s.color, count: tactics.filter(t => (t.status || "Proposed") === s.key).length })),
  ];

  const effectiveFilter = filterOptions.some(o => o.key === filterChannel) ? filterChannel : "";
  const effectivePillar = filterPillar || "";
  const effectiveStatus = filterStatus || "";

  const sortComparators = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    "most-liked": (a, b) => ((b.likes || 0) - (b.dislikes || 0)) - ((a.likes || 0) - (a.dislikes || 0)) || (new Date(b.createdAt) - new Date(a.createdAt)),
    manual: (a, b) => (a.order || 0) - (b.order || 0),
    "channel-asc": (a, b) => (displayChannel(a) || "\uffff").localeCompare(displayChannel(b) || "\uffff") || (new Date(b.createdAt) - new Date(a.createdAt)),
    "channel-desc": (a, b) => (displayChannel(b) || "\uffff").localeCompare(displayChannel(a) || "\uffff") || (new Date(b.createdAt) - new Date(a.createdAt)),
  };

  const matchesFilter = (t) => {
    if (effectiveFilter) {
      if (effectiveFilter === "__uncategorized__") { if (displayChannel(t)) return false; }
      else if (displayChannel(t) !== effectiveFilter) return false;
    }
    if (effectivePillar && t.pillar !== effectivePillar) return false;
    if (effectiveStatus && (t.status || "Proposed") !== effectiveStatus) return false;
    return true;
  };

  const displayedTactics = [...tactics.filter(matchesFilter)].sort(
    sortComparators[sortBy] || sortComparators.newest
  );

  async function moveTactic(tacticId, direction) {
    const idx = displayedTactics.findIndex((t) => t.id === tacticId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= displayedTactics.length) return;
    const a = displayedTactics[idx];
    const b = displayedTactics[swapIdx];
    const aOrder = a.order ?? Date.parse(a.createdAt) ?? 0;
    const bOrder = b.order ?? Date.parse(b.createdAt) ?? 0;
    await fetch("/api/tactics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", items: [{ id: a.id, order: bOrder }, { id: b.id, order: aOrder }] }),
    });
    setSortBy("manual");
    load();
  }

  function openEdit(t) {
    setEditForm({
      title: displayTitle(t),
      channel: displayChannel(t),
      pillar: t.pillar || "",
      status: t.status || "Proposed",
      objective: t.objective || "",
      kpi: t.kpi || "",
      roleOfChannel: t.roleOfChannel || "",
      audience: asAudienceArray(t.audience),
      audienceDetail: t.audienceDetail || "",
      format: t.format || "",
      phase: t.phase || "",
      budget: t.budget || "",
      startDate: t.startDate || "",
      endDate: t.endDate || "",
      notes: t.notes || "",
    });
    setEditMode(true);
  }

  function toggleEditAudience(key) {
    setEditForm((f) => {
      const arr = asAudienceArray(f.audience);
      const has = arr.includes(key);
      return { ...f, audience: has ? arr.filter((k) => k !== key) : [...arr, key] };
    });
  }

  async function saveEdit(tacticId) {
    setEditSaving(true);
    try {
      const r = await fetch("/api/tactics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", tacticId, editedBy: getUserId(), ...editForm }),
      });
      const d = await r.json();
      if (!d.ok) { alert("Failed to save: " + (d.error || r.status)); return; }
      const primaryAudience = asAudienceArray(editForm.audience)[0] || "";
      await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-from-source",
          sourceType: "tactic",
          sourceId: tacticId,
          title: editForm.title || editForm.channel,
          description: tacticDescription({ ...editForm }),
          audience: primaryAudience,
        }),
      }).catch(() => {});
      setEditMode(false);
      setEditForm(null);
      load();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(tacticId) {
    await fetch("/api/tactics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", tacticId }),
    });
    setSelectedTactic(null);
    setConfirmDelete(false);
    load();
  }

  if (loading) return <div><PanelSkeleton rows={3} /><PanelSkeleton rows={4} /></div>;

  const activeTactic = selectedTactic ? tactics.find(t => t.id === selectedTactic) : null;

  const inputStyle = {
    width: "100%", padding: "10px 14px", fontSize: 14, color: WHITE, background: BG,
    border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
    fontFamily: "'Inter Tight', system-ui, sans-serif", boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 4,
    letterSpacing: "0.04em", textTransform: "uppercase",
    fontFamily: "'Inter Tight', system-ui, sans-serif",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Tactics Board</h2>
          <p style={{ fontSize: 13, color: WHITE, margin: 0 }}>Channel-level tactics with role, audience, format, notes, and team reactions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: "8px 20px", fontSize: 12, fontWeight: 700, color: BG, background: Y,
          border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
        }}>{showForm ? "Cancel" : "+ New Tactic"}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: CARD, borderRadius: 10, padding: 24, border: `1px solid ${BORDER}`, marginBottom: 24 }}>
          {FIELDS.map((f, i) => {
            const required = f.key === "title" || f.key === "channel";
            const isNotes = f.key === "notes";
            const isMultiAudience = f.type === "multi-audience";
            const isChannelSelect = f.type === "channel-select";
            const isPillarSelect = f.type === "pillar-select";
            const isStatusSelect = f.type === "status-select";
            const selected = isMultiAudience ? asAudienceArray(form.audience) : null;
            return (
              <div key={f.key} style={{ marginBottom: i === FIELDS.length - 1 ? 20 : 16 }}>
                <label style={labelStyle}>
                  {f.label}{required ? " *" : ""}
                  {f.hint && <span style={{ marginLeft: 8, fontSize: 10, color: DIM, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{f.hint}</span>}
                </label>
                {isPillarSelect ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PILLAR_OPTIONS.map((p) => {
                      const on = form.pillar === p.key;
                      return (
                        <button key={p.key} type="button"
                          onClick={() => setForm((fr) => ({ ...fr, pillar: on ? "" : p.key }))}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 14px", fontSize: 12, fontWeight: 700,
                            color: on ? WHITE : MUTED,
                            background: on ? `${p.color}22` : "transparent",
                            border: `1px solid ${on ? p.color : BORDER}`,
                            borderRadius: 999, cursor: "pointer",
                            fontFamily: "'Inter Tight', system-ui, sans-serif",
                            opacity: on ? 1 : 0.8,
                          }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.color, opacity: on ? 1 : 0.5 }} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                ) : isStatusSelect ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {STATUS_OPTIONS.map((s) => {
                      const on = form.status === s.key;
                      return (
                        <button key={s.key} type="button"
                          onClick={() => setForm((fr) => ({ ...fr, status: s.key }))}
                          style={{
                            padding: "6px 14px", fontSize: 12, fontWeight: 700,
                            color: on ? WHITE : MUTED,
                            background: on ? `${s.color}22` : "transparent",
                            border: `1px solid ${on ? s.color : BORDER}`,
                            borderRadius: 999, cursor: "pointer",
                            fontFamily: "'Inter Tight', system-ui, sans-serif",
                            opacity: on ? 1 : 0.8,
                          }}>{s.key}</button>
                      );
                    })}
                  </div>
                ) : isChannelSelect ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CHANNEL_OPTIONS.map((c) => {
                      const on = form.channel === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setForm((fr) => ({ ...fr, channel: on ? "" : c.key }))}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 14px", fontSize: 12, fontWeight: 700,
                            color: on ? WHITE : MUTED,
                            background: on ? `${c.color}22` : "transparent",
                            border: `1px solid ${on ? c.color : BORDER}`,
                            borderRadius: 999, cursor: "pointer",
                            fontFamily: "'Inter Tight', system-ui, sans-serif",
                            transition: "all 0.15s ease",
                            opacity: on ? 1 : 0.8,
                          }}
                        >
                          <span style={{
                            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                            background: c.color,
                            opacity: on ? 1 : 0.5,
                          }} />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                ) : isMultiAudience ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {AUDIENCE_OPTIONS.map((a) => {
                      const on = selected.includes(a.key);
                      return (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => toggleAudience(a.key)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", fontSize: 12, fontWeight: 700,
                            color: on ? WHITE : MUTED,
                            background: on ? `${a.color}22` : "transparent",
                            border: `1px solid ${on ? a.color : BORDER}`,
                            borderRadius: 999, cursor: "pointer",
                            fontFamily: "'Inter Tight', system-ui, sans-serif",
                            transition: "all 0.15s ease",
                            opacity: on ? 1 : 0.7,
                          }}
                        >
                          <span style={{
                            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                            background: a.color,
                            opacity: on ? 1 : 0.5,
                          }} />
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                ) : f.type === "date-range" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: DIM, marginBottom: 3, fontFamily: "'Inter Tight', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>Start</div>
                      <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                        style={{ ...inputStyle, colorScheme: "dark" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: DIM, marginBottom: 3, fontFamily: "'Inter Tight', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>End</div>
                      <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                        min={form.startDate || undefined}
                        style={{ ...inputStyle, colorScheme: "dark" }} />
                    </div>
                  </div>
                ) : isNotes ? (
                  <textarea
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    rows={4}
                    style={{ ...inputStyle, fontSize: 13, resize: "vertical", lineHeight: 1.7 }}
                  />
                ) : (
                  <input
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    required={required}
                    style={inputStyle}
                  />
                )}
              </div>
            );
          })}
          <button type="submit" disabled={!form.title?.trim() || !form.channel} style={{
            padding: "10px 28px", fontSize: 13, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: (!form.title?.trim() || !form.channel) ? "not-allowed" : "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
            opacity: (!form.title?.trim() || !form.channel) ? 0.5 : 1,
          }}>Create Tactic</button>
        </form>
      )}

      {tactics.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 10, padding: "60px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: MUTED, margin: "0 0 8px" }}>No tactics yet</p>
          <p style={{ fontSize: 13, color: DIM }}>Click "+ New Tactic" to add the first one</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, padding: "14px 16px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            <FilterRow label="Pillar" options={pillarFilterOptions} value={effectivePillar} onChange={setFilterPillar} />
            <FilterRow label="Status" options={statusFilterOptions} value={effectiveStatus} onChange={setFilterStatus} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Channel</span>
              {filterOptions.map(c => {
                const on = (effectiveFilter || "") === c.key;
                const showDot = c.key !== "";
                return (
                  <button
                    key={c.key || "__all__"}
                    type="button"
                    onClick={() => setFilterChannel(c.key)}
                    disabled={c.count === 0 && c.key !== ""}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", fontSize: 11, fontWeight: 700,
                      color: on ? WHITE : (c.count === 0 && c.key !== "" ? MUTED : WHITE),
                      background: on ? `${c.color}22` : "transparent",
                      border: `1px solid ${on ? c.color : BORDER}`,
                      borderRadius: 999,
                      cursor: c.count === 0 && c.key !== "" ? "not-allowed" : "pointer",
                      opacity: c.count === 0 && c.key !== "" ? 0.4 : 1,
                      fontFamily: "'Inter Tight', system-ui, sans-serif",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {showDot && (
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c.color, opacity: on ? 1 : 0.65 }} />
                    )}
                    {c.label} <span style={{ opacity: 0.65, fontWeight: 500 }}>({c.count})</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Sort</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: "6px 28px 6px 10px", fontSize: 12, fontWeight: 600, color: WHITE, background: BG,
                  border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                  fontFamily: "'Inter Tight', system-ui, sans-serif", cursor: "pointer",
                  appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path fill='${encodeURIComponent(MUTED)}' d='M1 3l4 4 4-4z'/></svg>")`,
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="most-liked">Most liked</option>
                <option value="manual">Manual order</option>
                <option value="channel-asc">Channel A–Z</option>
                <option value="channel-desc">Channel Z–A</option>
              </select>
            </div>
            </div>
          </div>
          {displayedTactics.length === 0 ? (
            <div style={{ background: CARD, borderRadius: 10, padding: "40px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No tactics match this filter.</p>
            </div>
          ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {displayedTactics.map(tactic => (
            <div key={tactic.id} style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = Y}
              onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
              <div onClick={() => { setSelectedTactic(tactic.id); setConfirmDelete(false); }} style={{ padding: "16px 16px 8px" }}>
                {(() => {
                  const ch = displayChannel(tactic);
                  const meta = ch ? CHANNEL_BY_KEY[ch] : null;
                  const pillar = tactic.pillar ? PILLAR_BY_KEY[tactic.pillar] : null;
                  const status = STATUS_BY_KEY[tactic.status || "Proposed"];
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {meta ? (
                        <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}66`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                          {meta.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                          Uncategorized
                        </span>
                      )}
                      {pillar && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: pillar.color, background: `${pillar.color}18`, border: `1px solid ${pillar.color}66`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                          {pillar.label}
                        </span>
                      )}
                      {status && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}66`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                          {status.key}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <h3 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: "0 0 10px", fontFamily: "'Inter Tight', system-ui, sans-serif", lineHeight: 1.3 }}>{displayTitle(tactic) || "(Untitled)"}</h3>
                {tactic.roleOfChannel && (
                  <div style={{ fontSize: 12, color: DIM, lineHeight: 1.55, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {tactic.roleOfChannel}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {asAudienceArray(tactic.audience).map((key) => {
                    const a = AUDIENCE_OPTIONS.find((o) => o.key === key);
                    const color = a?.color || TEAL;
                    return (
                      <span key={key} style={{ fontSize: 10, color, background: `${color}18`, border: `1px solid ${color}66`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        {a?.label || audienceLabel(key)}
                      </span>
                    );
                  })}
                  {tactic.format && (
                    <span style={{ fontSize: 10, color: WHITE, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px" }}>{tactic.format}</span>
                  )}
                </div>
                {tactic.audienceDetail && (
                  <div style={{ fontSize: 11, color: DIM, lineHeight: 1.4, marginBottom: 6, fontStyle: "italic" }}>
                    {tactic.audienceDetail}
                  </div>
                )}
                {(tactic.phase || tactic.budget) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {tactic.phase && (
                      <span style={{ fontSize: 10, color: Y, background: `${Y}14`, border: `1px solid ${Y}66`, borderRadius: 4, padding: "2px 8px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {tactic.phase}
                      </span>
                    )}
                    {tactic.budget && (
                      <span style={{ fontSize: 10, color: GREEN, background: `${GREEN}14`, border: `1px solid ${GREEN}66`, borderRadius: 4, padding: "2px 8px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {tactic.budget}
                      </span>
                    )}
                  </div>
                )}
                {(tactic.startDate || tactic.endDate) && (
                  <div style={{ fontSize: 10, color: DIM, marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
                    {formatTacticDates(tactic)}
                  </div>
                )}
                <span style={{ fontSize: 9, color: MUTED }}>{tactic.createdBy} &middot; {new Date(tactic.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 12px", flexWrap: "wrap" }}>
                <button onClick={(e) => { e.stopPropagation(); react(tactic.id, "like"); }} style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  color: (tactic.likes || 0) > 0 ? GREEN : MUTED, background: `${GREEN}10`,
                  border: `1px solid ${(tactic.likes || 0) > 0 ? GREEN + "66" : BORDER}`, borderRadius: 6, cursor: "pointer",
                }}>&#9650; {tactic.likes || 0}</button>
                <button onClick={(e) => { e.stopPropagation(); react(tactic.id, "dislike"); }} style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  color: (tactic.dislikes || 0) > 0 ? RED : MUTED, background: `${RED}10`,
                  border: `1px solid ${(tactic.dislikes || 0) > 0 ? RED + "66" : BORDER}`, borderRadius: 6, cursor: "pointer",
                }}>&#9660; {tactic.dislikes || 0}</button>
                <AddToPlanButton title={displayTitle(tactic) || displayChannel(tactic)} description={tacticDescription(tactic)} defaultChannel={displayChannel(tactic)} defaultAudience={asAudienceArray(tactic.audience)[0]} defaultStart={tactic.startDate} defaultEnd={tactic.endDate} sourceType="tactic" sourceId={tactic.id} size="sm" />
                {sortBy === "manual" && (
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    <button onClick={(e) => { e.stopPropagation(); moveTactic(tactic.id, -1); }} title="Move up"
                      style={{ padding: "2px 6px", fontSize: 11, color: WHITE, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer" }}>
                      ↑
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveTactic(tactic.id, 1); }} title="Move down"
                      style={{ padding: "2px 6px", fontSize: 11, color: WHITE, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer" }}>
                      ↓
                    </button>
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                  {(tactic.comments || []).length} comment{(tactic.comments || []).length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
          )}
        </>
      )}

      {activeTactic && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => { setSelectedTactic(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); setShowHistory(false); }}>
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedTactic(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); setShowHistory(false); }} style={{
              position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
              background: `${BG}cc`, color: WHITE, border: `1px solid ${BORDER}`, cursor: "pointer",
              fontSize: 16, lineHeight: "30px", zIndex: 2, textAlign: "center",
            }}>&times;</button>

            {showHistory && (
              <RevisionLog revisions={activeTactic.revisions || []} onClose={() => setShowHistory(false)} />
            )}

            <div style={{ padding: "24px 24px 20px" }}>
              {(() => {
                const ch = displayChannel(activeTactic);
                const meta = ch ? CHANNEL_BY_KEY[ch] : null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {meta ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}66`, borderRadius: 4, padding: "3px 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                        {meta.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                        Uncategorized
                      </span>
                    )}
                  </div>
                );
              })()}
              <div style={{ fontSize: 10, fontWeight: 700, color: Y, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Title</div>
              {editMode ? (
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  style={{
                    width: "100%", padding: "10px 14px", fontSize: 22, fontWeight: 800, color: WHITE, background: BG,
                    border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", marginBottom: 8, boxSizing: "border-box",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }} />
              ) : (
                <h2 style={{ fontSize: 24, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{displayTitle(activeTactic) || "(Untitled)"}</h2>
              )}
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>{activeTactic.createdBy} &middot; {new Date(activeTactic.createdAt).toLocaleDateString()}{activeTactic.updatedAt ? ` · edited ${new Date(activeTactic.updatedAt).toLocaleDateString()}` : ""}</div>

              {editMode && FIELDS.filter(f => f.key !== "title").map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{f.label}</div>
                  {f.type === "pillar-select" ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PILLAR_OPTIONS.map((p) => {
                        const on = editForm.pillar === p.key;
                        return (
                          <button key={p.key} type="button"
                            onClick={() => setEditForm(fr => ({ ...fr, pillar: on ? "" : p.key }))}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 14px", fontSize: 12, fontWeight: 700,
                              color: on ? WHITE : MUTED,
                              background: on ? `${p.color}22` : "transparent",
                              border: `1px solid ${on ? p.color : BORDER}`,
                              borderRadius: 999, cursor: "pointer",
                              fontFamily: "'Inter Tight', system-ui, sans-serif",
                              opacity: on ? 1 : 0.8,
                            }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.color, opacity: on ? 1 : 0.5 }} />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "status-select" ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {STATUS_OPTIONS.map((s) => {
                        const on = editForm.status === s.key;
                        return (
                          <button key={s.key} type="button"
                            onClick={() => setEditForm(fr => ({ ...fr, status: s.key }))}
                            style={{
                              padding: "6px 14px", fontSize: 12, fontWeight: 700,
                              color: on ? WHITE : MUTED,
                              background: on ? `${s.color}22` : "transparent",
                              border: `1px solid ${on ? s.color : BORDER}`,
                              borderRadius: 999, cursor: "pointer",
                              fontFamily: "'Inter Tight', system-ui, sans-serif",
                              opacity: on ? 1 : 0.8,
                            }}>{s.key}</button>
                        );
                      })}
                    </div>
                  ) : f.type === "channel-select" ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {CHANNEL_OPTIONS.map((c) => {
                        const on = editForm.channel === c.key;
                        return (
                          <button key={c.key} type="button"
                            onClick={() => setEditForm(fr => ({ ...fr, channel: on ? "" : c.key }))}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 14px", fontSize: 12, fontWeight: 700,
                              color: on ? WHITE : MUTED,
                              background: on ? `${c.color}22` : "transparent",
                              border: `1px solid ${on ? c.color : BORDER}`,
                              borderRadius: 999, cursor: "pointer",
                              fontFamily: "'Inter Tight', system-ui, sans-serif",
                              opacity: on ? 1 : 0.8,
                            }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color, opacity: on ? 1 : 0.5 }} />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "multi-audience" ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {AUDIENCE_OPTIONS.map((a) => {
                        const on = asAudienceArray(editForm.audience).includes(a.key);
                        return (
                          <button key={a.key} type="button" onClick={() => toggleEditAudience(a.key)} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", fontSize: 12, fontWeight: 700,
                            color: on ? WHITE : MUTED,
                            background: on ? `${a.color}22` : "transparent",
                            border: `1px solid ${on ? a.color : BORDER}`,
                            borderRadius: 999, cursor: "pointer",
                            fontFamily: "'Inter Tight', system-ui, sans-serif",
                            opacity: on ? 1 : 0.7,
                          }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: a.color, opacity: on ? 1 : 0.5 }} />
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "date-range" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: DIM, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Start</div>
                        <input type="date" value={editForm.startDate || ""} onChange={e => setEditForm(fr => ({ ...fr, startDate: e.target.value }))}
                          style={{
                            width: "100%", padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                            border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", colorScheme: "dark",
                            boxSizing: "border-box", fontFamily: "'Inter Tight', system-ui, sans-serif",
                          }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: DIM, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>End</div>
                        <input type="date" value={editForm.endDate || ""} onChange={e => setEditForm(fr => ({ ...fr, endDate: e.target.value }))}
                          min={editForm.startDate || undefined}
                          style={{
                            width: "100%", padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                            border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", colorScheme: "dark",
                            boxSizing: "border-box", fontFamily: "'Inter Tight', system-ui, sans-serif",
                          }} />
                      </div>
                    </div>
                  ) : f.key === "notes" ? (
                    <textarea value={editForm[f.key]} onChange={e => setEditForm(fr => ({ ...fr, [f.key]: e.target.value }))} rows={4}
                      placeholder={f.placeholder}
                      style={{
                        width: "100%", padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                        border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", resize: "vertical", lineHeight: 1.7,
                        boxSizing: "border-box", fontFamily: "'Inter Tight', system-ui, sans-serif",
                      }} />
                  ) : (
                    <input value={editForm[f.key]} onChange={e => setEditForm(fr => ({ ...fr, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{
                        width: "100%", padding: "10px 14px", fontSize: 14, color: WHITE, background: BG,
                        border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                        boxSizing: "border-box", fontFamily: "'Inter Tight', system-ui, sans-serif",
                      }} />
                  )}
                </div>
              ))}

              {!editMode && FIELDS.filter(f => f.key !== "title" && f.key !== "channel").map(f => {
                if (f.type === "pillar-select") {
                  const pillar = activeTactic.pillar ? PILLAR_BY_KEY[activeTactic.pillar] : null;
                  if (!pillar) return null;
                  return (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.label}</div>
                      <span style={{ fontSize: 12, color: pillar.color, background: `${pillar.color}18`, border: `1px solid ${pillar.color}66`, borderRadius: 999, padding: "4px 14px", fontWeight: 700, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                        {pillar.label}
                      </span>
                    </div>
                  );
                }
                if (f.type === "status-select") {
                  const s = STATUS_BY_KEY[activeTactic.status || "Proposed"];
                  if (!s) return null;
                  return (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.label}</div>
                      <span style={{ fontSize: 12, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}66`, borderRadius: 999, padding: "4px 14px", fontWeight: 700, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                        {s.key}
                      </span>
                    </div>
                  );
                }
                if (f.key === "audience") {
                  const auds = asAudienceArray(activeTactic.audience);
                  if (!auds.length) return null;
                  return (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.label}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {auds.map((k) => {
                          const a = AUDIENCE_OPTIONS.find((o) => o.key === k);
                          const color = a?.color || TEAL;
                          return (
                            <span key={k} style={{ fontSize: 12, color, background: `${color}18`, border: `1px solid ${color}66`, borderRadius: 999, padding: "4px 12px", fontWeight: 600 }}>
                              {a?.label || audienceLabel(k)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                if (f.type === "date-range") {
                  const dates = formatTacticDates(activeTactic);
                  if (!dates) return null;
                  return (
                    <div key={f.key} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.label}</div>
                      <p style={{ fontSize: 14, color: WHITE, lineHeight: 1.5, margin: 0, fontVariantNumeric: "tabular-nums", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{dates}</p>
                    </div>
                  );
                }
                const raw = activeTactic[f.key];
                if (!raw) return null;
                return (
                  <div key={f.key} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.label}</div>
                    <p style={{ fontSize: 14, color: DIM, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{raw}</p>
                  </div>
                );
              })}

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", paddingBottom: 16, borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
                <button onClick={() => react(activeTactic.id, "like")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 14, fontWeight: 700,
                  color: (activeTactic.likes || 0) > 0 ? GREEN : MUTED, background: `${GREEN}10`,
                  border: `1px solid ${(activeTactic.likes || 0) > 0 ? GREEN + "66" : BORDER}`, borderRadius: 8, cursor: "pointer",
                }}>&#9650; {activeTactic.likes || 0}</button>
                <button onClick={() => react(activeTactic.id, "dislike")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 14, fontWeight: 700,
                  color: (activeTactic.dislikes || 0) > 0 ? RED : MUTED, background: `${RED}10`,
                  border: `1px solid ${(activeTactic.dislikes || 0) > 0 ? RED + "66" : BORDER}`, borderRadius: 8, cursor: "pointer",
                }}>&#9660; {activeTactic.dislikes || 0}</button>
                <span style={{ marginLeft: "auto" }}>
                  <AddToPlanButton title={displayTitle(activeTactic) || displayChannel(activeTactic)} description={tacticDescription(activeTactic)} defaultChannel={displayChannel(activeTactic)} defaultAudience={asAudienceArray(activeTactic.audience)[0]} defaultStart={activeTactic.startDate} defaultEnd={activeTactic.endDate} sourceType="tactic" sourceId={activeTactic.id} size="md" />
                </span>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                  Comments ({(activeTactic.comments || []).length})
                </div>
                {(activeTactic.comments || []).length === 0 && (
                  <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>No comments yet. Be the first.</p>
                )}
                {(activeTactic.comments || []).map(c => (
                  <div key={c.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${BORDER}22` }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: WHITE }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: MUTED }}>{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: 13, color: DIM, margin: "4px 0 0", lineHeight: 1.6 }}>{c.text}</p>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input value={commentNames[activeTactic.id] || ""}
                    onChange={e => setCommentNames({ ...commentNames, [activeTactic.id]: e.target.value })}
                    placeholder="Your name *" style={{
                      width: 120, padding: "10px 12px", fontSize: 12, color: WHITE, background: BG,
                      border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }} />
                  <input value={commentTexts[activeTactic.id] || ""} onChange={e => setCommentTexts({ ...commentTexts, [activeTactic.id]: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") addComment(activeTactic.id); }}
                    placeholder="Add a comment..." style={{
                      flex: 1, padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                      border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                    }} />
                  <button onClick={() => addComment(activeTactic.id)} style={{
                    padding: "10px 18px", fontSize: 12, fontWeight: 700, color: BG, background: TEAL,
                    border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }}>Post</button>
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {editMode ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(activeTactic.id)} disabled={editSaving || !editForm?.title?.trim() || !editForm?.channel} style={{
                      padding: "9px 20px", fontSize: 12, fontWeight: 700, color: BG, background: Y,
                      border: "none", borderRadius: 6, cursor: editSaving ? "wait" : "pointer",
                      fontFamily: "'Inter Tight', system-ui, sans-serif", opacity: editSaving ? 0.6 : 1,
                    }}>{editSaving ? "Saving…" : "Save changes"}</button>
                    <button onClick={() => { setEditMode(false); setEditForm(null); }} disabled={editSaving} style={{
                      padding: "9px 18px", fontSize: 12, fontWeight: 700, color: MUTED, background: "transparent",
                      border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
                      fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(activeTactic)} style={{
                      padding: "8px 16px", fontSize: 11, fontWeight: 700, color: Y, background: `${Y}12`,
                      border: `1px solid ${Y}66`, borderRadius: 6, cursor: "pointer",
                      fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "0.02em",
                    }}>&#9998; Edit</button>
                    <button onClick={() => setShowHistory(true)} style={{
                      padding: "8px 16px", fontSize: 11, fontWeight: 700, color: TEAL, background: `${TEAL}12`,
                      border: `1px solid ${TEAL}66`, borderRadius: 6, cursor: "pointer",
                      fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "0.02em",
                    }}>History ({(activeTactic.revisions || []).length})</button>
                  </div>
                )}
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} disabled={editMode} style={{
                    padding: "8px 16px", fontSize: 11, color: RED, background: "transparent",
                    border: `1px solid ${RED}44`, borderRadius: 6, cursor: editMode ? "not-allowed" : "pointer",
                    fontFamily: "'Inter Tight', system-ui, sans-serif", opacity: editMode ? 0.4 : 1,
                  }}>Delete this tactic</button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Are you sure?</span>
                    <button onClick={() => handleDelete(activeTactic.id)} style={{
                      padding: "8px 18px", fontSize: 12, fontWeight: 700, color: WHITE, background: RED,
                      border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }}>Yes, delete</button>
                    <button onClick={() => setConfirmDelete(false)} style={{
                      padding: "8px 18px", fontSize: 12, color: MUTED, background: "transparent",
                      border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
                      fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4, fontFamily: "'Inter Tight', system-ui, sans-serif", minWidth: 54 }}>
        {label}
      </span>
      {options.map((o) => {
        const on = (value || "") === o.key;
        const disabled = o.count === 0 && o.key !== "";
        return (
          <button
            key={o.key || "__all__"}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={disabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", fontSize: 11, fontWeight: 700,
              color: "#EDEDE8",
              background: on ? `${o.color}22` : "transparent",
              border: `1px solid ${on ? o.color : "#222"}`,
              borderRadius: 999,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              fontFamily: "'Inter Tight', system-ui, sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            {o.key !== "" && (
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: o.color, opacity: on ? 1 : 0.65 }} />
            )}
            {o.label} <span style={{ opacity: 0.65, fontWeight: 500 }}>({o.count})</span>
          </button>
        );
      })}
    </div>
  );
}
