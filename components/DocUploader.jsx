import { useState, useEffect, useCallback } from "react";

const Y = "#FFD500", BG = "#0C0C0C", CARD = "#151515", BORDER = "#222", WHITE = "#EDEDE8", MUTED = "#777", DIM = "#999", TEAL = "#2DD4BF", RED = "#EF4444";

export default function DocUploader({ apiEndpoint, title, description }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiEndpoint);
      const d = await r.json();
      setDocs(d.documents || []);
    } catch {} finally { setLoading(false); }
  }, [apiEndpoint]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      let content = "";
      if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        content = await file.text();
      } else if (file.name.endsWith(".docx")) {
        // Extract text from DOCX (ZIP containing XML)
        const arrayBuffer = await file.arrayBuffer();
        const { extractDocxText } = await import("../lib/docx-extract");
        content = await extractDocxText(arrayBuffer);
      } else {
        // Fallback: read as text
        content = await file.text();
      }

      if (!content.trim()) {
        setError("Could not extract text from file");
        setUploading(false);
        return;
      }

      const userName = localStorage.getItem("sweettooth_user") || "Team";

      const r = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, content, uploadedBy: userName }),
      });
      const d = await r.json();
      if (d.ok) {
        await load();
      } else {
        setError(d.error || "Upload failed");
      }
    } catch (err) {
      setError("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  async function handleDelete(docId) {
    await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", docId }),
    });
    setDocs(docs.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) setSelectedDoc(null);
  }

  if (loading) return <p style={{ color: MUTED, fontSize: 14 }}>Loading...</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{title}</h2>
        <p style={{ fontSize: 13, color: DIM, margin: "0 0 16px", lineHeight: 1.6 }}>{description}</p>

        <label style={{
          display: "inline-block", padding: "8px 20px", fontSize: 12, fontWeight: 700,
          color: BG, background: TEAL, borderRadius: 6, cursor: uploading ? "wait" : "pointer",
          fontFamily: "'Inter Tight', system-ui, sans-serif", opacity: uploading ? 0.6 : 1,
        }}>
          {uploading ? "Uploading..." : "Upload Document"}
          <input type="file" accept=".docx,.doc,.txt,.md" onChange={handleUpload} style={{ display: "none" }} disabled={uploading} />
        </label>
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 12 }}>Supports .docx, .txt, .md</span>
        {error && <p style={{ color: RED, fontSize: 12, marginTop: 8 }}>{error}</p>}
      </div>

      {selectedDoc ? (
        <div>
          <button onClick={() => setSelectedDoc(null)} style={{
            padding: "6px 14px", fontSize: 11, fontWeight: 600, color: TEAL, background: "transparent",
            border: `1px solid ${TEAL}`, borderRadius: 6, cursor: "pointer", marginBottom: 16,
            fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}>Back to list</button>

          <div style={{ background: CARD, borderRadius: 10, padding: "24px", border: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{selectedDoc.name}</h3>
            <p style={{ fontSize: 11, color: MUTED, margin: "0 0 16px" }}>
              Uploaded by {selectedDoc.uploadedBy} on {new Date(selectedDoc.uploadedAt).toLocaleDateString()}
            </p>
            <div style={{ fontSize: 14, color: DIM, lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {selectedDoc.content}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {docs.length === 0 ? (
            <div style={{ background: CARD, borderRadius: 10, padding: "40px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: MUTED }}>No documents uploaded yet</p>
            </div>
          ) : (
            docs.map(doc => (
              <div key={doc.id} style={{
                background: CARD, borderRadius: 10, padding: "16px 20px", border: `1px solid ${BORDER}`, marginBottom: 8,
                cursor: "pointer", transition: "border-color 0.15s",
              }}
                onClick={() => setSelectedDoc(doc)}
                onMouseEnter={e => e.currentTarget.style.borderColor = TEAL}
                onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{doc.name}</h3>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>
                      {doc.uploadedBy} &middot; {new Date(doc.uploadedAt).toLocaleDateString()} &middot; {(doc.content || "").length.toLocaleString()} chars
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(doc.id); }} style={{
                    padding: "4px 10px", fontSize: 10, color: RED, background: "transparent",
                    border: `1px solid ${RED}44`, borderRadius: 4, cursor: "pointer",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                  }}>Delete</button>
                </div>
                <p style={{ fontSize: 12, color: DIM, margin: "8px 0 0", lineHeight: 1.5 }}>
                  {(doc.content || "").slice(0, 200)}...
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
