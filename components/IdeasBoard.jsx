import { useState, useEffect, useCallback } from "react";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", GREEN = "#34D399", RED = "#EF4444", TEAL = "#2DD4BF", PURPLE = "#A78BFA", CORAL = "#FB923C", PINK = "#F472B6";

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
  const [expandedDesc, setExpandedDesc] = useState({});
  const [dragOver, setDragOver] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formMockup, setFormMockup] = useState("");
  const [formExtensions, setFormExtensions] = useState([{ channel: "", format: "", description: "" }]);

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
    const r = await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create", name: formName, description: formDesc,
        mockupUrl: formMockup, extensions: formExtensions.filter(x => x.format || x.description),
        createdBy: userId,
      }),
    });
    if ((await r.json()).ok) {
      setShowForm(false);
      setFormName(""); setFormDesc(""); setFormMockup("");
      setFormExtensions([{ channel: "", format: "", description: "" }]);
      load();
    }
  }

  async function react(ideaId, action) {
    const userId = getUserId();
    await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ideaId, userId }),
    });
    load();
  }

  async function addComment(ideaId) {
    const text = commentTexts[ideaId];
    if (!text?.trim()) return;
    const userId = getUserId();
    await fetch("/api/ideas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", ideaId, author: userId, text }),
    });
    setCommentTexts({ ...commentTexts, [ideaId]: "" });
    load();
  }

  if (loading) return <p style={{ color: MUTED, fontSize: 14 }}>Loading ideas...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Ideas Board</h2>
          <p style={{ fontSize: 13, color: DIM, margin: 0 }}>Campaign ideas with mockups, extensions, and team reactions</p>
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
              border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none", resize: "vertical", fontFamily: "'Newsreader', Georgia, serif", lineHeight: 1.7, boxSizing: "border-box",
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
              onPaste={(e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of items) { if (item.type.startsWith("image/")) { e.preventDefault(); const file = item.getAsFile(); if (file) { const reader = new FileReader(); reader.onload = (re) => setFormMockup(re.target.result); reader.readAsDataURL(file); } break; } } }}
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
            {/* Paste catcher: contentEditable div that receives Ctrl+V from any app */}
            <div
              contentEditable
              suppressContentEditableWarning
              onPaste={(e) => {
                e.preventDefault();
                // Method 1: check clipboardData for image files
                const items = e.clipboardData?.items;
                if (items) {
                  for (const item of items) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => setFormMockup(re.target.result);
                        reader.readAsDataURL(file);
                        return;
                      }
                    }
                  }
                }
                // Method 2: check for HTML with <img> tags (Google Slides, PowerPoint paste as HTML)
                const html = e.clipboardData?.getData("text/html");
                if (html) {
                  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
                  if (imgMatch?.[1]) {
                    const src = imgMatch[1];
                    if (src.startsWith("data:")) {
                      setFormMockup(src);
                      return;
                    }
                    // External URL — fetch and convert to data URI
                    fetch(src).then(r => r.blob()).then(blob => {
                      const reader = new FileReader();
                      reader.onload = (re) => setFormMockup(re.target.result);
                      reader.readAsDataURL(blob);
                    }).catch(() => {
                      // If fetch fails (CORS), use the URL directly
                      setFormMockup(src);
                    });
                    return;
                  }
                }
                // Method 3: plain text URL
                const text = e.clipboardData?.getData("text/plain");
                if (text && (text.startsWith("http") && /\.(png|jpg|jpeg|gif|webp|svg)/i.test(text))) {
                  setFormMockup(text);
                  return;
                }
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
              onBlur={(e) => { e.target.textContent = "Click here then Ctrl+V to paste image"; e.target.style.borderColor = TEAL; }}
              onClick={(e) => { e.target.focus(); }}
            >Click here then Ctrl+V to paste image</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>EXTENSIONS (Channels & Formats)</label>
            {formExtensions.map((ext, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input value={ext.channel} onChange={e => {
                  const n = [...formExtensions]; n[i].channel = e.target.value; setFormExtensions(n);
                }} placeholder="Channel (e.g. Social, OOH)" style={{
                  padding: "8px 10px", fontSize: 12, color: WHITE, background: BG,
                  border: `1px solid ${BORDER}`, borderRadius: 6, width: 130, outline: "none",
                }} />
                <input value={ext.format} onChange={e => {
                  const n = [...formExtensions]; n[i].format = e.target.value; setFormExtensions(n);
                }} placeholder="Format (e.g. Reel, A3 poster)" style={{
                  flex: 1, padding: "8px 10px", fontSize: 12, color: WHITE, background: BG,
                  border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                }} />
                <input value={ext.description} onChange={e => {
                  const n = [...formExtensions]; n[i].description = e.target.value; setFormExtensions(n);
                }} placeholder="Description" style={{
                  flex: 2, padding: "8px 10px", fontSize: 12, color: WHITE, background: BG,
                  border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                }} />
              </div>
            ))}
            <button type="button" onClick={() => setFormExtensions([...formExtensions, { channel: "", format: "", description: "" }])} style={{
              padding: "4px 12px", fontSize: 11, color: TEAL, background: "transparent",
              border: `1px solid ${TEAL}44`, borderRadius: 4, cursor: "pointer", marginTop: 4,
            }}>+ Add extension</button>
          </div>
          <button type="submit" style={{
            padding: "10px 28px", fontSize: 13, fontWeight: 700, color: BG, background: Y,
            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>Create Idea</button>
        </form>
      )}

      {ideas.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 10, padding: "60px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: MUTED, margin: "0 0 8px" }}>No ideas yet</p>
          <p style={{ fontSize: 13, color: DIM }}>Click "+ New Idea" to add the first one</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
          {ideas.map(idea => {
            const userId = typeof window !== "undefined" ? localStorage.getItem("sweettooth_user") : "";
            const hasLiked = idea.likedBy?.includes(userId);
            const hasDisliked = idea.dislikedBy?.includes(userId);
            const isExpanded = expandedDesc[idea.id];
            const showComments = expandedComments[idea.id];

            return (
              <div key={idea.id} style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                {idea.mockupUrl && (
                  <div style={{ width: "100%", height: 200, overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
                    <img src={idea.mockupUrl} alt={idea.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={e => { e.target.style.display = "none"; }} />
                  </div>
                )}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{idea.name}</h3>
                    <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>
                      {idea.createdBy} &middot; {new Date(idea.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {idea.description && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 13, color: DIM, lineHeight: 1.7, margin: 0 }}>
                        {isExpanded ? idea.description : idea.description.slice(0, 200)}
                        {idea.description.length > 200 && (
                          <button onClick={() => setExpandedDesc({ ...expandedDesc, [idea.id]: !isExpanded })} style={{
                            background: "none", border: "none", color: TEAL, cursor: "pointer", fontSize: 12, padding: "0 4px",
                          }}>{isExpanded ? "Show less" : "...more"}</button>
                        )}
                      </p>
                    </div>
                  )}

                  {idea.extensions?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {idea.extensions.map((ext, i) => (
                        <div key={i} title={ext.description || `${ext.channel}: ${ext.format}`} style={{
                          padding: "3px 10px", fontSize: 10, fontWeight: 600, borderRadius: 20,
                          background: `${CHANNEL_COLORS[ext.channel] || MUTED}22`,
                          color: CHANNEL_COLORS[ext.channel] || MUTED,
                          fontFamily: "'Inter Tight', system-ui, sans-serif",
                          cursor: ext.description ? "help" : "default",
                        }}>
                          {ext.channel}{ext.format ? ` / ${ext.format}` : ""}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                    <button onClick={(e) => { e.stopPropagation(); react(idea.id, "like"); }} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 14, fontWeight: 700,
                      color: hasLiked ? BG : MUTED, background: hasLiked ? GREEN : `${GREEN}10`,
                      border: `1px solid ${hasLiked ? GREEN : BORDER}`, borderRadius: 8, cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}>&#9650; {idea.likes || 0}</button>

                    <button onClick={(e) => { e.stopPropagation(); react(idea.id, "dislike"); }} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 14, fontWeight: 700,
                      color: hasDisliked ? BG : MUTED, background: hasDisliked ? RED : `${RED}10`,
                      border: `1px solid ${hasDisliked ? RED : BORDER}`, borderRadius: 8, cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}>&#9660; {idea.dislikes || 0}</button>

                    <div onClick={(e) => { e.stopPropagation(); setExpandedComments({ ...expandedComments, [idea.id]: !showComments }); }} style={{
                      marginLeft: "auto", padding: "6px 14px", fontSize: 12, fontWeight: 600, color: showComments ? Y : WHITE,
                      background: showComments ? `${Y}15` : `${WHITE}08`, border: `1px solid ${showComments ? Y + "44" : BORDER}`,
                      borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s ease",
                    }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 20, height: 20, borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: (idea.comments || []).length > 0 ? Y : BORDER,
                        color: (idea.comments || []).length > 0 ? BG : MUTED,
                      }}>{(idea.comments || []).length}</span>
                      comment{(idea.comments || []).length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {showComments && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                      {(idea.comments || []).map(c => (
                        <div key={c.id} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{c.author}</span>
                            <span style={{ fontSize: 10, color: MUTED }}>{new Date(c.date).toLocaleDateString()}</span>
                          </div>
                          <p style={{ fontSize: 13, color: DIM, margin: "2px 0 0", lineHeight: 1.5 }}>{c.text}</p>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input value={commentTexts[idea.id] || ""} onChange={e => setCommentTexts({ ...commentTexts, [idea.id]: e.target.value })}
                          onKeyDown={e => { if (e.key === "Enter") addComment(idea.id); }}
                          placeholder="Add a comment..." style={{
                            flex: 1, padding: "8px 12px", fontSize: 12, color: WHITE, background: BG,
                            border: `1px solid ${BORDER}`, borderRadius: 6, outline: "none",
                          }} />
                        <button onClick={() => addComment(idea.id)} style={{
                          padding: "8px 14px", fontSize: 11, fontWeight: 700, color: BG, background: TEAL,
                          border: "none", borderRadius: 6, cursor: "pointer",
                        }}>Post</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
