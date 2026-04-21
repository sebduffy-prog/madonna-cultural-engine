import { useState, useEffect, useCallback } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "rgba(21,21,21,0.68)";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const TEAL = "#2DD4BF";
const PINK = "#F472B6";
const AMBER = "#F59E0B";
const GREEN = "#34D399";
const CORAL = "#FB923C";
const RED = "#EF4444";

const PILLAR_DEFS = [
  { key: "tease",   num: "01", color: PINK,  title: "Tease",   tagline: "Seed the story before anyone sees the album", description: "Build intrigue in the communities that matter — tastemakers, fan accounts, the club underground — before a single ad runs. Own the whisper before the shout." },
  { key: "launch",  num: "02", color: TEAL,  title: "Launch",  tagline: "Arrive with cultural weight, not just volume",   description: "When the album drops, show up everywhere it matters at once: premium paid social, cinema, fashion-district OOH, the editorial drop. Moment as a cultural event." },
  { key: "sustain", num: "03", color: CORAL, title: "Sustain", tagline: "Keep the record in the conversation",              description: "Long-tail momentum: club activations, creator partnerships, editorial waves tied to live dates. Make Confessions II the record people keep returning to." },
];
const PILLAR_KEYS = PILLAR_DEFS.map((p) => p.key);
const PILLAR_LABEL = Object.fromEntries(PILLAR_DEFS.map((p) => [p.key, p.title]));
const PILLAR_COLOR = Object.fromEntries(PILLAR_DEFS.map((p) => [p.key, p.color]));

const TABS = [
  { id: "madonna", label: "Madonna", color: Y },
  { id: "fashion", label: "Fashion", color: PINK },
  { id: "gay", label: "Gay Community", color: TEAL },
  { id: "culture", label: "Culture", color: AMBER },
];

const TYPE_COLORS = { Media: PINK, Strategic: TEAL, Partnership: CORAL };

function RecCard({ rec }) {
  const tc = TYPE_COLORS[rec.type] || AMBER;
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${tc}`,
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: BG, background: tc,
          padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
          letterSpacing: "0.06em", fontFamily: "'Inter Tight', sans-serif",
        }}>{rec.type}</span>
      </div>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        {rec.title}
      </h4>
      <p style={{ fontSize: 13, color: DIM, margin: 0, lineHeight: 1.6 }}>
        {rec.description}
      </p>
    </div>
  );
}

export default function StrategyRecommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("madonna");

  useEffect(() => {
    fetch("/api/ai-strategy")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  const recs = data?.recommendations?.[activeTab] || [];

  return (
    <div>
      {/* Strategy brief — Media That Strikes A Pose */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${Y}`, borderRadius: 10, padding: "22px 26px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: Y, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "'Inter Tight', sans-serif" }}>Distinctive media behaviour</div>
        <h2 style={{ fontSize: 34, fontWeight: 800, color: WHITE, margin: "0 0 14px", fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Media That Strikes <span style={{ color: Y }}>A&nbsp;Pose</span>
        </h2>
        <p style={{ fontSize: 14, color: WHITE, margin: "0 0 10px", lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          Position Madonna not as a legacy act making a comeback, but as the <b style={{ color: Y }}>Source Code</b> — the originator still writing the playbook for club culture. For <i>Confessions on a Dance Floor 2</i> we're chasing three KPIs: UK No.1 physical sales, growth in first-party fan data, and cultural belonging inside LGBTQ+ and club communities.
        </p>
        <p style={{ fontSize: 13, color: DIM, margin: 0, lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          High-fashion, unapologetically bold, curated for the right environment. Three pillars carry the campaign.
        </p>
      </div>

      {/* Three pillars — now Tease / Launch / Sustain with attached channels */}
      <PillarGrid />

      <p style={{ fontSize: 11, color: WHITE, margin: "0 0 20px", lineHeight: 1.5, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        Recommendations below are generated weekly against this brief, grounded in the week's intelligence data (media, social, YouTube, Spotify). Full brief lives in <code style={{ color: WHITE, background: BG, padding: "1px 6px", borderRadius: 3 }}>strategy-prompt.md</code>.
      </p>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: Y, borderRadius: 2 }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
            Strategic Recommendations
          </h2>
          {data?.generatedAt && (
            <span style={{ fontSize: 10, color: WHITE, fontFamily: "'Inter Tight', sans-serif" }}>
              Generated {new Date(data.generatedAt).toLocaleDateString("en-GB")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: DIM, fontFamily: "'Inter Tight', sans-serif" }}>
            Prompt: strategy-prompt.md
          </span>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const r = await fetch("/api/ai-strategy?refresh=1");
                if (r.ok) setData(await r.json());
              } catch {}
              setLoading(false);
            }}
            disabled={loading}
            style={{
              padding: "4px 12px", fontSize: 10, fontWeight: 600,
              color: loading ? MUTED : BG, background: loading ? BORDER : CORAL,
              border: "none", borderRadius: 4, cursor: loading ? "default" : "pointer",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >{loading ? "Generating..." : "Generate"}</button>
        </div>
      </div>

      {/* Error state */}
      {data?.error && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{data.error}</p>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? BG : WHITE,
              background: activeTab === t.id ? t.color : "transparent",
              border: activeTab === t.id ? "none" : `1px solid ${WHITE}`,
              borderRadius: 6, cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Recommendations */}
      {recs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recs.map((rec, i) => <RecCard key={i} rec={rec} />)}
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: WHITE, margin: "0 0 8px", fontFamily: "'Inter Tight', sans-serif" }}>
            {data?.recommendations ? "No recommendations for this category" : "No recommendations generated yet"}
          </p>
          <p style={{ fontSize: 12, color: WHITE, margin: 0 }}>
            Hit Generate to create AI-powered strategic recommendations based on this week's intelligence data.
          </p>
        </div>
      )}
    </div>
  );
}

// Three-pillar grid with attached channels. Channels render as chips along
// the bottom of each pillar; hovering opens a popover showing Role / Approach
// / Budget. "+ Channel" opens an inline mini-form.
function PillarGrid() {
  const [pillars, setPillars] = useState(() => Object.fromEntries(PILLAR_KEYS.map((k) => [k, []])));
  const [adding, setAdding] = useState(null);       // pillar key currently adding
  const [form, setForm] = useState({ channel: "", role: "", approach: "", budget: "" });
  const [hoverId, setHoverId] = useState(null);
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/strategy-pillars");
      const d = await r.json();
      if (d?.pillars) setPillars(d.pillars);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addChannel(pillarKey) {
    if (!form.channel.trim()) return;
    await fetch("/api/strategy-pillars", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", pillar: pillarKey, ...form }),
    });
    setForm({ channel: "", role: "", approach: "", budget: "" });
    setAdding(null);
    load();
  }
  async function updateChannel(pillarKey, id, patch) {
    await fetch("/api/strategy-pillars", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", pillar: pillarKey, id, ...patch }),
    });
    load();
  }
  async function deleteChannel(pillarKey, id) {
    await fetch("/api/strategy-pillars", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", pillar: pillarKey, id }),
    });
    setEditId(null);
    setHoverId(null);
    load();
  }

  return (
    <div className="pillar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
      {PILLAR_DEFS.map((p) => {
        const channels = pillars[p.key] || [];
        const totalBudget = channels.reduce((s, c) => s + (parseFloat(c.budget) || 0), 0);
        return (
          <div key={p.key} style={{
            background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${p.color}`,
            borderRadius: 10, padding: "18px 20px 14px", display: "flex", flexDirection: "column", gap: 10,
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: p.color, background: `${p.color}18`,
                border: `1px solid ${p.color}55`, borderRadius: 4, padding: "2px 8px",
                letterSpacing: "0.12em", fontFamily: "'Inter Tight', sans-serif",
              }}>{p.num}</span>
              <span style={{ fontSize: 10, color: p.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "'Inter Tight', sans-serif" }}>Pillar</span>
              {totalBudget > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: WHITE, fontFamily: "'Inter Tight', sans-serif", fontWeight: 600 }}>
                  Budget: {totalBudget}%
                </span>
              )}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: WHITE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
              {p.title}
            </h3>
            <p style={{ fontSize: 12, color: p.color, margin: 0, fontWeight: 700, lineHeight: 1.4, fontFamily: "'Inter Tight', sans-serif" }}>
              {p.tagline}
            </p>
            <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.55, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              {p.description}
            </p>

            {/* Channels strip */}
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {channels.map((c) => (
                <ChannelChip
                  key={c.id}
                  channel={c}
                  color={p.color}
                  hovered={hoverId === c.id}
                  onHover={(v) => setHoverId(v ? c.id : (hoverId === c.id ? null : hoverId))}
                  onEdit={() => setEditId(c.id)}
                  editing={editId === c.id}
                  onSave={(patch) => { updateChannel(p.key, c.id, patch); setEditId(null); }}
                  onCancel={() => setEditId(null)}
                  onDelete={() => deleteChannel(p.key, c.id)}
                />
              ))}

              {adding === p.key ? (
                <div style={{ flex: "1 1 100%", marginTop: 6, background: BG, border: `1px solid ${p.color}55`, borderRadius: 6, padding: 10 }}>
                  <ChannelForm
                    color={p.color}
                    value={form}
                    onChange={setForm}
                    onSave={() => addChannel(p.key)}
                    onCancel={() => { setAdding(null); setForm({ channel: "", role: "", approach: "", budget: "" }); }}
                    saveLabel="Add channel"
                  />
                </div>
              ) : (
                <button onClick={() => setAdding(p.key)} style={{
                  fontSize: 10, fontWeight: 700, color: p.color, background: "transparent",
                  border: `1px dashed ${p.color}66`, borderRadius: 999, padding: "4px 10px",
                  cursor: "pointer", letterSpacing: "0.06em", fontFamily: "'Inter Tight', sans-serif",
                }}>+ Channel</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelChip({ channel, color, hovered, onHover, onEdit, editing, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(channel);
  useEffect(() => { setForm(channel); }, [channel.id, editing]);
  if (editing) {
    return (
      <div style={{ flex: "1 1 100%", background: BG, border: `1px solid ${color}55`, borderRadius: 6, padding: 10 }}>
        <ChannelForm color={color} value={form} onChange={setForm} onSave={() => onSave(form)} onCancel={onCancel} onDelete={onDelete} saveLabel="Save" />
      </div>
    );
  }
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onEdit}
      style={{
        position: "relative",
        fontSize: 10, fontWeight: 700, color: color, background: `${color}18`,
        border: `1px solid ${color}55`, borderRadius: 999, padding: "4px 10px",
        cursor: "pointer", letterSpacing: "0.02em", fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      {channel.channel}
      {channel.budget ? <span style={{ color: WHITE, marginLeft: 6, fontWeight: 500 }}>· {channel.budget}%</span> : null}
      {hovered && (channel.role || channel.approach || channel.budget) && (
        <div style={{
          position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 10,
          minWidth: 240, maxWidth: 300,
          background: BG, border: `1px solid ${color}66`, borderRadius: 8,
          padding: "10px 12px", boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          textAlign: "left", fontFamily: "'Inter Tight', sans-serif",
        }}>
          <div style={{ fontSize: 9, color: color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>Channel</div>
          <div style={{ fontSize: 13, color: WHITE, fontWeight: 700, marginBottom: 8 }}>{channel.channel}</div>
          {channel.role && <PopoverLine label="Role of channel" value={channel.role} />}
          {channel.approach && <PopoverLine label="Approach / notes" value={channel.approach} />}
          {channel.budget && <PopoverLine label="Budget" value={`${channel.budget}%`} />}
          <div style={{ fontSize: 9, color: MUTED, marginTop: 6, fontStyle: "italic" }}>Click to edit</div>
        </div>
      )}
    </div>
  );
}

function PopoverLine({ label, value }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: WHITE, lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

function ChannelForm({ color, value, onChange, onSave, onCancel, onDelete, saveLabel = "Save" }) {
  const input = {
    width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 11, color: WHITE,
    background: "rgba(21,21,21,0.8)", border: `1px solid ${BORDER}`, borderRadius: 4, outline: "none",
    fontFamily: "'Inter Tight', sans-serif", marginBottom: 6,
  };
  const label = { fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 };
  return (
    <div>
      <label style={label}>Channel *</label>
      <input style={input} value={value.channel} onChange={(e) => onChange({ ...value, channel: e.target.value })} placeholder="e.g. TikTok paid, Cinema, OOH" autoFocus />
      <label style={label}>Role of channel</label>
      <input style={input} value={value.role} onChange={(e) => onChange({ ...value, role: e.target.value })} placeholder="Reach, reappraisal, proof…" />
      <label style={label}>Approach / notes</label>
      <textarea style={{ ...input, resize: "vertical", minHeight: 48, lineHeight: 1.45 }} value={value.approach} onChange={(e) => onChange({ ...value, approach: e.target.value })} placeholder="How this channel shows up in the pillar" />
      <label style={label}>Budget %</label>
      <input style={input} value={value.budget} onChange={(e) => onChange({ ...value, budget: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="e.g. 15" />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={onSave} disabled={!value.channel?.trim()} style={{
          padding: "5px 12px", fontSize: 10, fontWeight: 700, color: BG, background: color,
          border: "none", borderRadius: 4, cursor: value.channel?.trim() ? "pointer" : "not-allowed",
          fontFamily: "'Inter Tight', sans-serif", opacity: value.channel?.trim() ? 1 : 0.5,
        }}>{saveLabel}</button>
        <button onClick={onCancel} style={{
          padding: "5px 12px", fontSize: 10, fontWeight: 700, color: WHITE, background: "transparent",
          border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
        }}>Cancel</button>
        {onDelete && (
          <button onClick={onDelete} style={{
            padding: "5px 12px", fontSize: 10, fontWeight: 700, color: RED, background: "transparent",
            border: `1px solid ${RED}44`, borderRadius: 4, cursor: "pointer", fontFamily: "'Inter Tight', sans-serif",
            marginLeft: "auto",
          }}>Delete</button>
        )}
      </div>
    </div>
  );
}
