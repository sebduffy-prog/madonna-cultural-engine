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

const Y = "#FFD500", BG = "#0C0C0C", CARD = "rgba(21,21,21,0.68)", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", CORAL = "#FB923C", PINK = "#F472B6";

const CHANNEL_COLORS = {
  Social: TEAL, OOH: CORAL, Digital: PURPLE, Experiential: PINK, Print: Y, Audio: GREEN, Video: RED, Partnerships: "#60A5FA",
};

function getUserId() {
  let id = localStorage.getItem("sweettooth_user");
  if (!id) {
    id = prompt("Enter your name for the Ideas Board:") || "Anonymous";
    localStorage.setItem("sweettooth_user", id);
  }
  return id;
}

export default function IdeasBoard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});
  const [commentNames, setCommentNames] = useState({});
  const [expandedDesc, setExpandedDesc] = useState({});
  const [dragOver, setDragOver] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formMockup, setFormMockup] = useState("");
  const [formTactics, setFormTactics] = useState([""]);
  const [formAudience, setFormAudience] = useState([]);

  function toggleFormAudience(key) {
    setFormAudience((arr) => {
      const list = asAudienceArray(arr);
      return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    });
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ideas");
      const d = await r.json();
      setIdeas(d.ideas || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    const userId = getUserId();
    try {
      // Compress image if it's a large data URI (>500KB)
      let mockup = formMockup;
      if (mockup && mockup.startsWith("data:") && mockup.length > 500000) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = mockup; });
          const canvas = document.createElement("canvas");
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          mockup = canvas.toDataURL("image/jpeg", 0.8);
        } catch {}
      }
      const r = await fetch("/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", name: formName, description: formDesc,
          mockupUrl: mockup, tactics: formTactics.filter(t => t.trim()),
          audience: formAudience, createdBy: userId,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setShowForm(false);
        setFormName(""); setFormDesc(""); setFormMockup("");
        setFormTactics([""]); setFormAudience([]);
        load();
      } else {
        alert("Failed to create idea: " + (data.error || r.status));
      }
    } catch (err) {
      alert("Error creating idea: " + err.message);
    }
  }

  async function react(ideaId, action) {
    // Anonymous voting — no name prompt, uses a device fingerprint
    const visitorId = (() => {
      let id = localStorage.getItem("sweettooth_voter");
      if (!id) { id = "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); localStorage.setItem("sweettooth_voter", id); }
      return id;
    })();
    await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ideaId, userId: visitorId }),
    });
    load();
  }

  async function addComment(ideaId) {
    const text = commentTexts[ideaId];
    const name = commentNames[ideaId];
    if (!text?.trim()) return;
    if (!name?.trim()) { alert("Please enter your name to comment"); return; }
    // Save name for next time
    localStorage.setItem("sweettooth_user", name);
    await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", ideaId, author: name, text }),
    });
    setCommentTexts({ ...commentTexts, [ideaId]: "" });
    load();
  }

  const [selectedIdea, setSelectedIdea] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(idea) {
    setEditForm({
      name: idea.name || "",
      description: idea.description || "",
      mockupUrl: idea.mockupUrl || "",
      tactics: idea.tactics?.length ? [...idea.tactics] : [""],
      audience: asAudienceArray(idea.audience),
    });
    setEditMode(true);
  }

  function pickEditImage() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (re) => {
        let mockup = re.target.result;
        // compress large images
        if (mockup && mockup.startsWith("data:") && mockup.length > 500000) {
          try {
            const img = new Image();
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = mockup; });
            const canvas = document.createElement("canvas");
            const maxDim = 1200;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              const scale = maxDim / Math.max(w, h);
              w = Math.round(w * scale); h = Math.round(h * scale);
            }
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            mockup = canvas.toDataURL("image/jpeg", 0.8);
          } catch {}
        }
        setEditForm(f => ({ ...f, mockupUrl: mockup }));
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  async function saveEdit(ideaId) {
    setEditSaving(true);
    try {
      const tactics = (editForm.tactics || []).filter(t => t && t.trim());
      const payload = {
        action: "update",
        ideaId,
        name: editForm.name,
        description: editForm.description,
        mockupUrl: editForm.mockupUrl,
        tactics,
        audience: editForm.audience,
      };
      const r = await fetch("/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.ok) { alert("Failed to save: " + (d.error || r.status)); return; }
      // Propagate to any calendar blocks that were created from this idea
      await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-from-source",
          sourceType: "idea",
          sourceId: ideaId,
          title: editForm.name,
          description: editForm.description,
          audience: editForm.audience,
        }),
      }).catch(() => {});
      setEditMode(false);
      setEditForm(null);
      load();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(ideaId) {
    await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ideaId }),
    });
    setSelectedIdea(null);
    setConfirmDelete(false);
    load();
  }

  if (loading) return <div><PanelSkeleton rows={3} /><PanelSkeleton rows={4} /></div>;

  const activeIdea = selectedIdea ? ideas.find(i => i.id === selectedIdea) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Ideas Board</h2>
          <p style={{ fontSize: 13, color: WHITE, margin: 0 }}>Campaign ideas with mockups, tactics, and team reactions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: "8px 20px", fontSize: 12, fontWeight: 700, color: BG, background: Y,
          border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
        }}>{showForm ? "Cancel" : "+ New Idea"}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: CARD, borderRadius: 10, padding: 24, border: `1px solid ${BORDER}`, marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>IDEA NAME *</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} required style={{
              width: "100%", padding: "10px 14px", fontSize: 14, color: WHITE, background: BG,
              border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", fontFamily: "'Inter Tight', system-ui, sans-serif", boxSizing: "border-box",
            }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>DESCRIPTION</label>
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={4} style={{
              width: "100%", padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
              border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", resize: "vertical", fontFamily: "'Inter Tight', system-ui, sans-serif", lineHeight: 1.7, boxSizing: "border-box",
            }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>MOCKUP IMAGE</label>
            <div
              tabIndex={0}
              onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = (ev) => { const file = ev.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (re) => setFormMockup(re.target.result); reader.readAsDataURL(file); } }; inp.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith("image/")) { const reader = new FileReader(); reader.onload = (re) => setFormMockup(re.target.result); reader.readAsDataURL(file); } }}
              style={{
                width: "100%", minHeight: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                border: `2px dashed ${dragOver ? Y : BORDER}`, borderRadius: 8, background: dragOver ? `${Y}08` : BG,
                cursor: "pointer", transition: "border-color 0.2s, background 0.2s", boxSizing: "border-box", padding: 16,
                outline: "none",
              }}
            >
              {formMockup ? (
                <div style={{ position: "relative", width: "100%", textAlign: "center" }}>
                  <img src={formMockup} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain" }} />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFormMockup(""); }} style={{
                    position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: RED,
                    color: WHITE, border: "none", cursor: "pointer", fontSize: 14, lineHeight: "24px", padding: 0,
                  }}>&times;</button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 28, color: MUTED, marginBottom: 8 }}>&#128247;</span>
                  <span style={{ fontSize: 12, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Drop, paste, or click to upload image</span>
                </>
              )}
            </div>
            {/* Paste catcher: contentEditable div — let browser do native paste, then extract the image */}
            <div
              contentEditable
              suppressContentEditableWarning
              onPaste={(e) => {
                // Method 1: direct image in clipboardData (screenshots, "Copy Image")
                const items = e.clipboardData?.items;
                if (items) {
                  for (const item of items) {
                    if (item.type.startsWith("image/")) {
                      e.preventDefault();
                      const file = item.getAsFile();
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => setFormMockup(re.target.result);
                        reader.readAsDataURL(file);
                      }
                      return;
                    }
                  }
                }
                // Method 2: let the browser paste natively (handles Google Slides, PowerPoint, etc)
                // After a tick, check if an <img> appeared in the div and extract it via canvas
                const target = e.currentTarget;
                setTimeout(() => {
                  const img = target.querySelector("img");
                  if (img && img.src) {
                    if (img.src.startsWith("data:")) {
                      setFormMockup(img.src);
                    } else {
                      // Render the image to canvas to get a data URI (bypasses blob: URL restrictions)
                      const canvas = document.createElement("canvas");
                      const naturalImg = new Image();
                      naturalImg.crossOrigin = "anonymous";
                      naturalImg.onload = () => {
                        canvas.width = naturalImg.naturalWidth || naturalImg.width;
                        canvas.height = naturalImg.naturalHeight || naturalImg.height;
                        canvas.getContext("2d").drawImage(naturalImg, 0, 0);
                        try {
                          setFormMockup(canvas.toDataURL("image/png"));
                        } catch {
                          setFormMockup(img.src); // fallback to original src
                        }
                      };
                      naturalImg.onerror = () => setFormMockup(img.src);
                      naturalImg.src = img.src;
                    }
                    target.innerHTML = "";
                    return;
                  }
                  // Check for pasted HTML text that looks like image content
                  const html = e.clipboardData?.getData("text/html") || target.innerHTML;
                  const imgMatch = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
                  if (imgMatch?.[1] && imgMatch[1].startsWith("data:")) {
                    setFormMockup(imgMatch[1]);
                  }
                  target.innerHTML = "";
                }, 100);
              }}
              style={{
                marginTop: 8, padding: "10px 20px", fontSize: 12, fontWeight: 600,
                color: TEAL, background: "transparent", border: `1px solid ${TEAL}`,
                borderRadius: 6, cursor: "text", fontFamily: "'Inter Tight', system-ui, sans-serif",
                width: "100%", boxSizing: "border-box", textAlign: "center",
                outline: "none", minHeight: 38, lineHeight: "18px",
                caretColor: "transparent",
              }}
              onFocus={(e) => { e.target.textContent = "Now press Ctrl+V / Cmd+V"; e.target.style.borderColor = Y; }}
              onBlur={(e) => { setTimeout(() => { e.target.textContent = "Click here, then Ctrl+V to paste image"; e.target.style.borderColor = TEAL; }, 200); }}
            >Click here, then Ctrl+V to paste image</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              AUDIENCE
              <span style={{ marginLeft: 8, fontSize: 10, color: DIM, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>Pick one or more — click to toggle</span>
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AUDIENCE_OPTIONS.map((a) => {
                const on = asAudienceArray(formAudience).includes(a.key);
                return (
                  <button key={a.key} type="button" onClick={() => toggleFormAudience(a.key)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", fontSize: 12, fontWeight: 700,
                    color: on ? WHITE : MUTED,
                    background: on ? `${a.color}22` : "transparent",
                    border: `1px solid ${on ? a.color : BORDER}`,
                    borderRadius: 999, cursor: "pointer",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                    transition: "all 0.15s ease",
                    opacity: on ? 1 : 0.7,
                  }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: a.color, opacity: on ? 1 : 0.5 }} />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>TACTICS</label>
            {formTactics.map((tactic, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input value={tactic} onChange={e => {
                  const n = [...formTactics]; n[i] = e.target.value; setFormTactics(n);
                }} placeholder="e.g. Flyposting in Camden, 30s Instagram Reel, OOH billboard..." style={{
                  flex: 1, padding: "8px 10px", fontSize: 12, color: WHITE, background: BG,
                  border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                }} />
              </div>
            ))}
            <button type="button" onClick={() => setFormTactics([...formTactics, ""])} style={{
              padding: "4px 12px", fontSize: 11, color: TEAL, background: "transparent",
              border: `1px solid ${TEAL}44`, borderRadius: 4, cursor: "pointer", marginTop: 4,
            }}>+ Add tactic</button>
          </div>
          <button type="submit" style={{
            padding: "10px 28px", fontSize: 13, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>Create Idea</button>
        </form>
      )}

      {/* ═══ CARD GRID: title, image, votes ═══ */}
      {ideas.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 10, padding: "60px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: MUTED, margin: "0 0 8px" }}>No ideas yet</p>
          <p style={{ fontSize: 13, color: DIM }}>Click "+ New Idea" to add the first one</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {ideas.map(idea => {
            return (
              <div key={idea.id} style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = Y}
                onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                {/* Clickable image + title area */}
                <div onClick={() => { setSelectedIdea(idea.id); setConfirmDelete(false); }}>
                  {idea.mockupUrl ? (
                    <div style={{ width: "100%", height: 180, overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
                      <img src={idea.mockupUrl} alt={idea.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { e.target.style.display = "none"; }} />
                    </div>
                  ) : (
                    <div style={{ width: "100%", height: 80, background: `${Y}08`, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 24, color: MUTED }}>&#128161;</span>
                    </div>
                  )}
                  <div style={{ padding: "12px 16px 8px" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: WHITE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif", lineHeight: 1.3 }}>{idea.name}</h3>
                    {asAudienceArray(idea.audience).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {asAudienceArray(idea.audience).map((k) => {
                          const a = AUDIENCE_OPTIONS.find((o) => o.key === k);
                          const color = a?.color || TEAL;
                          return (
                            <span key={k} style={{ fontSize: 10, color, background: `${color}18`, border: `1px solid ${color}66`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                              {a?.label || audienceLabel(k)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>{idea.createdBy} &middot; {new Date(idea.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {/* Votes + comment count — always visible */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 12px", flexWrap: "wrap" }}>
                  <button onClick={(e) => { e.stopPropagation(); react(idea.id, "like"); }} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                    color: (idea.likes || 0) > 0 ? GREEN : MUTED, background: `${GREEN}10`,
                    border: `1px solid ${(idea.likes || 0) > 0 ? GREEN + "66" : BORDER}`, borderRadius: 6, cursor: "pointer",
                  }}>&#9650; {idea.likes || 0}</button>
                  <button onClick={(e) => { e.stopPropagation(); react(idea.id, "dislike"); }} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                    color: (idea.dislikes || 0) > 0 ? RED : MUTED, background: `${RED}10`,
                    border: `1px solid ${(idea.dislikes || 0) > 0 ? RED + "66" : BORDER}`, borderRadius: 6, cursor: "pointer",
                  }}>&#9660; {idea.dislikes || 0}</button>
                  <AddToPlanButton title={idea.name} description={idea.description} defaultChannel="social" defaultAudience={asAudienceArray(idea.audience)[0]} sourceType="idea" sourceId={idea.id} size="sm" />
                  <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                    {(idea.comments || []).length} comment{(idea.comments || []).length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          }
          )}
        </div>
      )}

      {/* ═══ IDEA DETAIL POPUP ═══ */}
      {activeIdea && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => { setSelectedIdea(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); }}>
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button onClick={() => { setSelectedIdea(null); setConfirmDelete(false); setEditMode(false); setEditForm(null); }} style={{
              position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
              background: `${BG}cc`, color: WHITE, border: `1px solid ${BORDER}`, cursor: "pointer",
              fontSize: 16, lineHeight: "30px", zIndex: 2, textAlign: "center",
            }}>&times;</button>

            {/* Image (readonly or edit) */}
            {(editMode ? editForm?.mockupUrl : activeIdea.mockupUrl) && (
              <div style={{ width: "100%", maxHeight: 360, overflow: "hidden", borderRadius: "12px 12px 0 0", position: "relative" }}>
                <img src={editMode ? editForm.mockupUrl : activeIdea.mockupUrl} alt={activeIdea.name} style={{ width: "100%", objectFit: "cover" }} />
                {editMode && (
                  <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 6 }}>
                    <button type="button" onClick={pickEditImage} style={{
                      padding: "6px 14px", fontSize: 11, fontWeight: 700, color: BG, background: Y,
                      border: "none", borderRadius: 6, cursor: "pointer",
                    }}>Change image</button>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, mockupUrl: "" }))} style={{
                      padding: "6px 10px", fontSize: 11, fontWeight: 700, color: WHITE,
                      background: `${BG}cc`, border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
                    }}>Remove</button>
                  </div>
                )}
              </div>
            )}
            {editMode && !editForm?.mockupUrl && (
              <div style={{ padding: "16px 24px 0" }}>
                <button type="button" onClick={pickEditImage} style={{
                  width: "100%", padding: "20px", fontSize: 12, fontWeight: 700, color: MUTED,
                  background: "transparent", border: `2px dashed ${BORDER}`, borderRadius: 8, cursor: "pointer",
                }}>Click to add image</button>
              </div>
            )}

            <div style={{ padding: "20px 24px" }}>
              {/* Title + meta */}
              {editMode ? (
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Idea name *" style={{
                    width: "100%", padding: "10px 14px", fontSize: 20, fontWeight: 800, color: WHITE, background: BG,
                    border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", marginBottom: 10, boxSizing: "border-box",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }} />
              ) : (
                <h2 style={{ fontSize: 22, fontWeight: 800, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{activeIdea.name}</h2>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {!editMode && asAudienceArray(activeIdea.audience).map((k) => {
                  const a = AUDIENCE_OPTIONS.find((o) => o.key === k);
                  const color = a?.color || TEAL;
                  return (
                    <span key={k} style={{ fontSize: 11, color, background: `${color}18`, border: `1px solid ${color}66`, borderRadius: 999, padding: "3px 10px", fontWeight: 600 }}>
                      {a?.label || audienceLabel(k)}
                    </span>
                  );
                })}
                <span style={{ fontSize: 11, color: MUTED }}>{activeIdea.createdBy} &middot; {new Date(activeIdea.createdAt).toLocaleDateString()}{activeIdea.updatedAt ? ` · edited ${new Date(activeIdea.updatedAt).toLocaleDateString()}` : ""}</span>
              </div>

              {/* Description */}
              {editMode ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Description</div>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={4} style={{
                      width: "100%", padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                      border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", resize: "vertical", lineHeight: 1.7,
                      boxSizing: "border-box", fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }} />
                </div>
              ) : activeIdea.description ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Description</div>
                  <p style={{ fontSize: 14, color: DIM, lineHeight: 1.8, margin: 0 }}>{activeIdea.description}</p>
                </div>
              ) : null}

              {/* Audience (edit mode — multi-select pills; read mode shows chips in meta row above) */}
              {editMode && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Audience</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {AUDIENCE_OPTIONS.map((a) => {
                      const on = asAudienceArray(editForm.audience).includes(a.key);
                      return (
                        <button key={a.key} type="button" onClick={() => {
                          setEditForm((f) => {
                            const list = asAudienceArray(f.audience);
                            return { ...f, audience: list.includes(a.key) ? list.filter((k) => k !== a.key) : [...list, a.key] };
                          });
                        }} style={{
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
                </div>
              )}

              {/* Tactics */}
              {editMode ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Tactics</div>
                  {editForm.tactics.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input value={t} onChange={e => {
                        const arr = [...editForm.tactics]; arr[i] = e.target.value;
                        setEditForm(f => ({ ...f, tactics: arr }));
                      }} style={{
                        flex: 1, padding: "8px 10px", fontSize: 12, color: WHITE, background: BG,
                        border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", boxSizing: "border-box",
                      }} />
                      {editForm.tactics.length > 1 && (
                        <button type="button" onClick={() => {
                          const arr = editForm.tactics.filter((_, idx) => idx !== i);
                          setEditForm(f => ({ ...f, tactics: arr.length ? arr : [""] }));
                        }} style={{
                          padding: "4px 10px", fontSize: 11, color: MUTED, background: "transparent",
                          border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer",
                        }}>&times;</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, tactics: [...f.tactics, ""] }))} style={{
                    padding: "4px 12px", fontSize: 11, color: TEAL, background: "transparent",
                    border: `1px solid ${TEAL}44`, borderRadius: 4, cursor: "pointer", marginTop: 4,
                  }}>+ Add tactic</button>
                </div>
              ) : activeIdea.tactics?.length > 0 ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Tactics</div>
                  {activeIdea.tactics.map((tactic, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${BORDER}22` }}>
                      <span style={{ fontSize: 10, color: Y, fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: DIM }}>{tactic}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {/* Legacy: show extensions if idea was created before tactics rename */}
              {!activeIdea.tactics?.length && activeIdea.extensions?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Tactics</div>
                  {activeIdea.extensions.map((ext, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${BORDER}22`, fontSize: 13, color: DIM }}>
                      {ext.channel}{ext.format ? ` / ${ext.format}` : ""}{ext.description ? ` — ${ext.description}` : ""}
                    </div>
                  ))}
                </div>
              )}

              {/* Votes + add to plan */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
                <button onClick={() => react(activeIdea.id, "like")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 14, fontWeight: 700,
                  color: (activeIdea.likes || 0) > 0 ? GREEN : MUTED, background: `${GREEN}10`,
                  border: `1px solid ${(activeIdea.likes || 0) > 0 ? GREEN + "66" : BORDER}`, borderRadius: 8, cursor: "pointer",
                }}>&#9650; {activeIdea.likes || 0}</button>
                <button onClick={() => react(activeIdea.id, "dislike")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 14, fontWeight: 700,
                  color: (activeIdea.dislikes || 0) > 0 ? RED : MUTED, background: `${RED}10`,
                  border: `1px solid ${(activeIdea.dislikes || 0) > 0 ? RED + "66" : BORDER}`, borderRadius: 8, cursor: "pointer",
                }}>&#9660; {activeIdea.dislikes || 0}</button>
                <span style={{ marginLeft: "auto" }}>
                  <AddToPlanButton title={activeIdea.name} description={activeIdea.description} defaultChannel="social" defaultAudience={asAudienceArray(activeIdea.audience)[0]} sourceType="idea" sourceId={activeIdea.id} size="md" />
                </span>
              </div>

              {/* Comments */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
                  Comments ({(activeIdea.comments || []).length})
                </div>
                {(activeIdea.comments || []).length === 0 && (
                  <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>No comments yet. Be the first.</p>
                )}
                {(activeIdea.comments || []).map(c => (
                  <div key={c.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${BORDER}22` }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: WHITE }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: MUTED }}>{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: 13, color: DIM, margin: "4px 0 0", lineHeight: 1.6 }}>{c.text}</p>
                  </div>
                ))}
                {/* Add comment */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input value={commentNames[activeIdea.id] || ""}
                    onChange={e => setCommentNames({ ...commentNames, [activeIdea.id]: e.target.value })}
                    placeholder="Your name *" style={{
                      width: 120, padding: "10px 12px", fontSize: 12, color: WHITE, background: BG,
                      border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", fontFamily: "'Inter Tight', system-ui, sans-serif",
                    }} />
                  <input value={commentTexts[activeIdea.id] || ""} onChange={e => setCommentTexts({ ...commentTexts, [activeIdea.id]: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") addComment(activeIdea.id); }}
                    placeholder="Add a comment..." style={{
                      flex: 1, padding: "10px 14px", fontSize: 13, color: WHITE, background: BG,
                      border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                    }} />
                  <button onClick={() => addComment(activeIdea.id)} style={{
                    padding: "10px 18px", fontSize: 12, fontWeight: 700, color: BG, background: TEAL,
                    border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }}>Post</button>
                </div>
              </div>

              {/* Edit (left) + Delete (right) action bar */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {editMode ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(activeIdea.id)} disabled={editSaving || !editForm?.name?.trim()} style={{
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
                  <button onClick={() => openEdit(activeIdea)} style={{
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
                  }}>Delete this idea</button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>Are you sure?</span>
                    <button onClick={() => handleDelete(activeIdea.id)} style={{
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
