import { useState, useEffect, useCallback } from "react";
import { PanelSkeleton } from "./Skeleton";
import AddToPlanButton from "./AddToPlanButton";
import { AUDIENCE_OPTIONS, audienceLabel } from "../lib/audiences";

// Accepts legacy single-string audience or new array — returns array of keys.
function asAudienceArray(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean);
  return [a];
}

function tacticDescription(t) {
  const auds = asAudienceArray(t.audience).map(audienceLabel).filter(Boolean);
  return [
    t.roleOfChannel && `Role: ${t.roleOfChannel}`,
    auds.length ? `Audience: ${auds.join(", ")}` : null,
    t.audienceDetail && `Detail: ${t.audienceDetail}`,
    t.format && `Format: ${t.format}`,
    t.notes && `Notes: ${t.notes}`,
  ].filter(Boolean).join(" \u2014 ");
}

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF";

const FIELDS = [
  { key: "channel", label: "Channel", placeholder: "e.g. TikTok, OOH, Spotify, Radio, Experiential" },
  { key: "roleOfChannel", label: "Role of Channel", placeholder: "What this channel is doing in the mix (reach, reappraisal, proof, depth...)" },
  { key: "audience", label: "Audience", type: "multi-audience", hint: "Pick one or more — click to toggle" },
  { key: "audienceDetail", label: "Audience Detail", placeholder: "Specific mindset, behaviour, sub-cohort — freeform" },
  { key: "format", label: "Format", placeholder: "Specific executional format (15s vertical, 6-sheet, native article...)" },
  { key: "notes", label: "Notes", placeholder: "Anything else — rationale, dependencies, references" },
];

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

  const [form, setForm] = useState({ channel: "", roleOfChannel: "", audience: [], audienceDetail: "", format: "", notes: "" });

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
      setForm({ channel: "", roleOfChannel: "", audience: [], audienceDetail: "", format: "", notes: "" });
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(t) {
    setEditForm({
      channel: t.channel || "",
      roleOfChannel: t.roleOfChannel || "",
      audience: asAudienceArray(t.audience),
      audienceDetail: t.audienceDetail || "",
      format: t.format || "",
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
        body: JSON.stringify({ action: "update", tacticId, ...editForm }),
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
          title: editForm.channel,
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
            const required = f.key === "channel";
            const isNotes = f.key === "notes";
            const isMultiAudience = f.type === "multi-audience";
            const selected = isMultiAudience ? asAudienceArray(form.audience) : null;
            return (
              <div key={f.key} style={{ marginBottom: i === FIELDS.length - 1 ? 20 : 16 }}>
                <label style={labelStyle}>
                  {f.label}{required ? " *" : ""}
                  {f.hint && <span style={{ marginLeft: 8, fontSize: 10, color: DIM, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{f.hint}</span>}
                </label>
                {isMultiAudience ? (
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
          <button type="submit" style={{
            padding: "10px 28px", fontSize: 13, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>Create Tactic</button>
        </form>
      )}

      {tactics.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 10, padding: "60px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: MUTED, margin: "0 0 8px" }}>No tactics yet</p>
          <p style={{ fontSize: 13, color: DIM }}>Click "+ New Tactic" to add the first one</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {tactics.map(tactic => (
            <div key={tactic.id} style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = Y}
              onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
              <div onClick={() => { setSelectedTactic(tactic.id); setConfirmDelete(false); }} style={{ padding: "16px 16px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: Y, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                  Channel
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: "0 0 10px", fontFamily: "'Inter Tight', system-ui, sans-serif", lineHeight: 1.3 }}>{tactic.channel}</h3>
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
                <AddToPlanButton title={tactic.channel} description={tacticDescription(tactic)} defaultChannel={tactic.channel} defaultAudience={asAudienceArray(tactic.audience)[0]} sourceType="tactic" sourceId={tactic.id} size="sm" />
                <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                  {(tactic.comments || []).length} comment{(tactic.comments || []).length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTactic && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => { setSelectedTactic(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); }}>
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedTactic(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); }} style={{
              position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
              background: `${BG}cc`, color: WHITE, border: `1px solid ${BORDER}`, cursor: "pointer",
              fontSize: 16, lineHeight: "30px", zIndex: 2, textAlign: "center",
            }}>&times;</button>

            <div style={{ padding: "24px 24px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: Y, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Channel</div>
              {editMode ? (
                <input value={editForm.channel} onChange={e => setEditForm(f => ({ ...f, channel: e.target.value }))}
                  style={{
                    width: "100%", padding: "10px 14px", fontSize: 22, fontWeight: 800, color: WHITE, background: BG,
                    border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", marginBottom: 8, boxSizing: "border-box",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }} />
              ) : (
                <h2 style={{ fontSize: 24, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{activeTactic.channel}</h2>
              )}
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>{activeTactic.createdBy} &middot; {new Date(activeTactic.createdAt).toLocaleDateString()}{activeTactic.updatedAt ? ` · edited ${new Date(activeTactic.updatedAt).toLocaleDateString()}` : ""}</div>

              {editMode && FIELDS.filter(f => f.key !== "channel").map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{f.label}</div>
                  {f.type === "multi-audience" ? (
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

              {!editMode && FIELDS.filter(f => f.key !== "channel").map(f => {
                const raw = activeTactic[f.key];
                const auds = f.key === "audience" ? asAudienceArray(raw) : null;
                if (f.key === "audience") {
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
                  <AddToPlanButton title={activeTactic.channel} description={tacticDescription(activeTactic)} defaultChannel={activeTactic.channel} defaultAudience={asAudienceArray(activeTactic.audience)[0]} sourceType="tactic" sourceId={activeTactic.id} size="md" />
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
                    <button onClick={() => saveEdit(activeTactic.id)} disabled={editSaving || !editForm?.channel?.trim()} style={{
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
                  <button onClick={() => openEdit(activeTactic)} style={{
                    padding: "8px 16px", fontSize: 11, fontWeight: 700, color: Y, background: `${Y}12`,
                    border: `1px solid ${Y}66`, borderRadius: 6, cursor: "pointer",
                    fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "0.02em",
                  }}>&#9998; Edit</button>
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
