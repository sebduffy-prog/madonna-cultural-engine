import { useState } from "react";
import dynamic from "next/dynamic";
import fs from "fs";
import path from "path";

const StreetArtMap = dynamic(() => import("../components/StreetArtMap"), { ssr: false });
const AudienceCommentsGraph = dynamic(() => import("../components/AudienceCommentsGraph"), { ssr: false });
const AudienceIntelligence = dynamic(() => import("../components/AudienceIntelligence"), { ssr: false });
const CulturalFeed = dynamic(() => import("../components/CulturalFeed"), { ssr: false });
const SpotifyTracker = dynamic(() => import("../components/SpotifyTracker"), { ssr: false });
const SocialPulse = dynamic(() => import("../components/SocialPulse"), { ssr: false });
const SocialDashboard = dynamic(() => import("../components/SocialDashboard"), { ssr: false });
const DashboardSummary = dynamic(() => import("../components/DashboardSummary"), { ssr: false });
const MentionsTicker = dynamic(() => import("../components/MentionsTicker"), { ssr: false });
const StrategyRecommendations = dynamic(() => import("../components/StrategyRecommendations"), { ssr: false });
const GraphRAG = dynamic(() => import("../components/GraphRAG"), { ssr: false });
const YouTubeIntelligence = dynamic(() => import("../components/YouTubeIntelligence"), { ssr: false });
const IdeasBoard = dynamic(() => import("../components/IdeasBoard"), { ssr: false });
const CampaignCalendar = dynamic(() => import("../components/CampaignCalendar"), { ssr: false });
const DocUploader = dynamic(() => import("../components/DocUploader"), { ssr: false });

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const GREEN = "#34D399";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const TEAL = "#2DD4BF";
const PURPLE = "#A78BFA";
const CORAL = "#FB923C";
const PINK = "#F472B6";

function Sect({ title, children, accent = Y }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Insight({ text, color = MUTED }) {
  return <p style={{ fontSize: 14, color, lineHeight: 1.75, margin: "0 0 12px" }}>{text}</p>;
}

function Pull({ text, color = WHITE }) {
  return <p style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.4, margin: "20px 0", letterSpacing: "-0.01em" }}>{text}</p>;
}

function Card({ children, accent }) {
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "20px 24px", border: `1px solid ${BORDER}`, marginBottom: 12, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      {children}
    </div>
  );
}

function StatRow({ label, value, sub, color = WHITE }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: DIM }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  );
}

function MasterRefresh() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null);

  async function refreshAll() {
    setRunning(true);
    setStatus("Refreshing all data sources...");

    const endpoints = [
      { name: "News (Madonna)", url: "/api/news?category=madonna&refresh=1" },
      { name: "News (Fashion)", url: "/api/news?category=fashion&refresh=1" },
      { name: "News (Gay)", url: "/api/news?category=gay&refresh=1" },
      { name: "News (Culture)", url: "/api/news?category=culture&refresh=1" },
      { name: "Media Index", url: "/api/media-index?refresh=1" },
      { name: "Brand24", url: "/api/brand24?refresh=1" },
      { name: "Social Dashboard", url: "/api/social-dashboard?refresh=1" },
      { name: "Social Composite", url: "/api/social?refresh=1" },
      { name: "YouTube RAG", url: "/api/youtube-rag?refresh=1" },
      { name: "AI Strategy", url: "/api/ai-strategy?refresh=1" },
    ];

    let done = 0;
    const results = [];

    for (const ep of endpoints) {
      setStatus(`${ep.name}... (${done}/${endpoints.length})`);
      try {
        const r = await fetch(ep.url, { signal: AbortSignal.timeout(30000) });
        results.push({ name: ep.name, ok: r.ok, status: r.status });
      } catch (err) {
        results.push({ name: ep.name, ok: false, error: err.message });
      }
      done++;
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    setStatus(`Done: ${succeeded}/${endpoints.length} succeeded${failed.length > 0 ? ` — failed: ${failed.map(f => f.name).join(", ")}` : ""}`);
    setRunning(false);
    setTimeout(() => setStatus(null), 8000);
  }

  return (
    <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
      {status && (
        <span style={{ fontSize: 10, color: running ? "#A78BFA" : status.includes("failed") ? "#EF4444" : "#34D399", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          {status}
        </span>
      )}
      <button onClick={refreshAll} disabled={running} style={{
        padding: "10px 24px", fontSize: 12, fontWeight: 700,
        color: running ? "#777" : "#0C0C0C",
        background: running ? "#222" : "#FFD500",
        border: "none", borderRadius: 8, cursor: running ? "wait" : "pointer",
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        transition: "all 0.15s",
      }}>
        {running ? "Refreshing..." : "Refresh Everything"}
      </button>
    </div>
  );
}

export async function getStaticProps() {
  const dir = path.join(process.cwd(), "Market Research");

  function parseCSV(text) {
    const rows = [];
    let current = "";
    let inQuotes = false;
    const lines = text.split("\n");
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
      }
      current += (current ? "\n" : "") + line;
      if (!inQuotes) { rows.push(current); current = ""; }
    }
    if (current) rows.push(current);
    return rows.map(row => {
      const cols = []; let field = ""; let q = false;
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '"') { q = !q; }
        else if (row[i] === ',' && !q) { cols.push(field.trim()); field = ""; }
        else { field += row[i]; }
      }
      cols.push(field.trim());
      return cols;
    });
  }

  // Server-side theme classification (mirrors AudienceCommentsGraph keywords)
  const THEME_KEYWORDS = [
    { id: "nostalgia", keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "old", "back in the day", "years ago"] },
    { id: "musical", keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"] },
    { id: "icon", keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"] },
    { id: "emotional", keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"] },
    { id: "empowerment", keywords: ["feminist", "feminism", "empowered", "strong woman", "powerful woman", "independent", "boss", "trailblazer", "barrier", "broke the mold"] },
    { id: "sexuality", keywords: ["sexy", "sex", "provocative", "controversial", "bold", "daring", "scandalous", "shock", "erotica", "book", "naked"] },
    { id: "discovery", keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "wow", "omg", "wait"] },
    { id: "humour", keywords: ["lol", "lmao", "haha", "funny", "hilarious", "dead", "joke", "slay", "ate", "serve", "camp", "iconic moment"] },
    { id: "cultural", keywords: ["era", "generation", "culture", "society", "fashion", "style", "trend", "relevant", "today"] },
    { id: "criticism", keywords: ["overrated", "hate", "bad", "worst", "old", "surgery", "cringe", "fake"] },
  ];
  function classifyComment(content) {
    const lower = (content || "").toLowerCase();
    for (const theme of THEME_KEYWORDS) {
      for (const kw of theme.keywords) {
        if (lower.includes(kw)) return theme.id;
      }
    }
    return "general";
  }

  // YouTube comments - classify ALL for accurate counts, sample for visualization
  const commentFiles = ["youtube_comments_bank_1.csv","youtube_comments_bank_2.csv","youtube_comments_bank_3.csv","youtube_comments_bank_4.csv","youtube_comments_bank_5.csv"];
  let allComments = [];
  let totalCommentCount = 0;
  const fullThemeCounts = {};
  for (const f of commentFiles) {
    try {
      const text = fs.readFileSync(path.join(dir, f), "utf-8");
      const rows = parseCSV(text);
      const data = rows.slice(1).filter(r => r.length >= 4 && r[2]).map(r => ({
        username: r[0] || "", date: r[1] || "", content: r[2] || "", video_title: r[3] || ""
      }));
      totalCommentCount += data.length;
      // Classify all comments server-side for accurate theme counts
      data.forEach(c => {
        const theme = classifyComment(c.content);
        fullThemeCounts[theme] = (fullThemeCounts[theme] || 0) + 1;
      });
      // Sample ~4000 per file for visualization (20K total across 5 files)
      const sample = data.sort(() => Math.random() - 0.5).slice(0, 4000);
      allComments = allComments.concat(sample);
    } catch(e) {}
  }

  // GWI data - extract ALL metric rows (Index, Column %, Row %, Responses)
  // CSV has two column layouts:
  //   Location data (r[0] filled):    r[0]=category, r[1]=entity, r[2]=metric, r[3]=totals, r[4-10]=segments
  //   Non-location data (r[0] empty): r[0]="", r[1]=category, r[2]=entity, r[3]=metric, r[4]=totals, r[5-11]=segments
  const VALID_METRICS = ["Index", "Column %", "Row %", "Responses"];
  let gwiData = [];
  try {
    const gwiText = fs.readFileSync(path.join(dir, "Project_Sweet_Tooth_Master - All Internet Users (Audience....csv"), "utf-8");
    const rows = parseCSV(gwiText);
    let lastQuestion = "";
    let lastEntityName = "";
    let isShifted = false;
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 8) continue;
      if (r.every(c => !c || c.trim() === "")) continue;

      if (r[0] && r[0].trim()) {
        lastQuestion = r[0].trim();
        isShifted = false;
      } else if (r[1] && r[1].trim() && r[2] && r[2].trim() && VALID_METRICS.includes(r[3])) {
        lastQuestion = r[1].trim();
        isShifted = true;
      }

      if (!isShifted) {
        if (r[1] && r[1].trim()) lastEntityName = r[1].trim();
        const metric = r[2];
        if (VALID_METRICS.includes(metric) && lastEntityName) {
          const vals = [r[4],r[5],r[6],r[7],r[8],r[9],r[10]].map(v => parseFloat(v?.replace(/,/g, "").replace(/%/g, "")) || 0);
          if (vals.some(v => v > 0)) {
            gwiData.push({ question: lastQuestion, name: lastEntityName, metric, genJones: vals[0], millennial: vals[1], genX: vals[2], genZ: vals[3], disco: vals[4], fashion: vals[5], nightlife: vals[6] });
          }
        }
      } else {
        if (r[2] && r[2].trim()) lastEntityName = r[2].trim();
        const metric = r[3];
        if (VALID_METRICS.includes(metric) && lastEntityName) {
          const vals = [r[5],r[6],r[7],r[8],r[9],r[10],r[11]].map(v => parseFloat(v?.replace(/,/g, "").replace(/%/g, "")) || 0);
          if (vals.some(v => v > 0)) {
            gwiData.push({ question: lastQuestion, name: lastEntityName, metric, genJones: vals[0], millennial: vals[1], genX: vals[2], genZ: vals[3], disco: vals[4], fashion: vals[5], nightlife: vals[6] });
          }
        }
      }
    }
  } catch(e) {}

  // Destinations (Murals) with geocoded coords
  const muralCoords = {
    "E1 6LA": [51.5229, -0.0717], "E1 6RF": [51.5207, -0.0717], "SW9 8EQ": [51.4613, -0.1145],
    "SW9 8JX": [51.4624, -0.1163], "SE1 6JT": [51.4720, -0.0555], "NW1 0JH": [51.5392, -0.1426],
    "NW1 8AG": [51.5414, -0.1466], "EC2A 3EJ": [51.5256, -0.0825], "EC2A 3NT": [51.5250, -0.0807],
    "EC1V 9LP": [51.5264, -0.0878], "EC2A 3PQ": [51.5246, -0.0784], "E1 6QR": [51.5199, -0.0726],
    "E1 6QL": [51.5207, -0.0717], "WC2H 8NJ": [51.5145, -0.1290], "M4 4AA": [53.4858, -2.2382],
    "M4 1EU": [53.4849, -2.2360], "M1 1FB": [53.4826, -2.2335]
  };
  let murals = [];
  try {
    const dText = fs.readFileSync(path.join(dir, "destinations.csv"), "utf-8");
    const rows = parseCSV(dText);
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 4 || !r[0]) continue;
      const pc = r[3];
      const coords = muralCoords[pc] || [51.51 + (Math.random()-0.5)*0.04, -0.1 + (Math.random()-0.5)*0.06];
      murals.push({ name: r[0], address: r[1], city: r[2], postcode: pc, lat: coords[0], lng: coords[1] });
    }
  } catch(e) {}

  // LGBTQ venues with geocoded coords
  const venueCoords = {
    "W1D 4UD": [51.5134, -0.1313], "SW4 6DH": [51.4625, -0.1477], "E2 6NB": [51.5272, -0.0618],
    "EC1V 1JN": [51.5270, -0.0889], "N1 9SD": [51.5340, -0.1240], "W1D 3JN": [51.5136, -0.1318],
    "WC2N 6PA": [51.5074, -0.1223], "W1H 7AF": [51.5140, -0.1620], "SE11 4LD": [51.4890, -0.1097],
    "E9 5EN": [51.5454, -0.0354], "E2 6DG": [51.5242, -0.0718], "W1D 6HN": [51.5138, -0.1320],
    "E8 2PB": [51.5494, -0.0752], "N16 8BJ": [51.5535, -0.0741], "W1D 6QA": [51.5134, -0.1323],
    "SE11 5QY": [51.4855, -0.1134], "SW8 1RT": [51.4815, -0.1225], "W1F 0TA": [51.5126, -0.1352],
    "W1D 6QB": [51.5135, -0.1325], "W1D 4UR": [51.5133, -0.1310], "WC1N 1AB": [51.5266, -0.1203],
    "SE10 8DE": [51.4728, -0.0082], "SE1 7AE": [51.4997, -0.1138], "E8 2AA": [51.5480, -0.0760],
    "WC2N 4JF": [51.5082, -0.1264], "WC2N 6NG": [51.5086, -0.1239], "SE15 4TL": [51.4702, -0.0667],
    "NW3 1RE": [51.5560, -0.1781], "W1F 8QL": [51.5140, -0.1360], "WC2H 7BA": [51.5113, -0.1308],
    "E9 6RG": [51.5400, -0.0414], "W1D 5LB": [51.5136, -0.1316], "SE8 5TQ": [51.4776, -0.0268],
    "E2 7SB": [51.5298, -0.0622], "SE15 3QQ": [51.4658, -0.0558], "E14 7NW": [51.5118, -0.0265],
    "WB2H 8BU": [51.5109, -0.1272], "E2 9ED": [51.5323, -0.0600], "WC2N 6HH": [51.5095, -0.1251],
    "SE1 6AQ": [51.4937, -0.0970], "SE10 8ER": [51.4774, -0.0112], "SE11 5HY": [51.4848, -0.1145],
    "W1D 6DR": [51.5126, -0.1339], "W1D 5JL": [51.5130, -0.1314], "W14 9NS": [51.4870, -0.2010],
    "E20 1FT": [51.5437, -0.0136], "SE8 4AU": [51.4779, -0.0277], "SW4 7UJ": [51.4619, -0.1449],
    "N1 9SD2": [51.5341, -0.1242], "SE1 7TW": [51.4933, -0.1203], "W1T 5EN": [51.5218, -0.1371],
    "N16 7XB": [51.5544, -0.0739], "W1D 6QD": [51.5133, -0.1328], "E8 4AE": [51.5537, -0.0655],
    "E14 7JD": [51.5097, -0.0253], "E5 8EE": [51.5572, -0.0465], "W1D 7PL": [51.5126, -0.1336],
    "NW1 3EE": [51.5283, -0.1353]
  };
  let venues = [];
  try {
    const vText = fs.readFileSync(path.join(dir, "open_london_lgbtq_venues.csv"), "utf-8");
    const rows = parseCSV(vText);
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2 || !r[0]) continue;
      const addr = r[1] || "";
      const pcMatch = addr.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i);
      const pc = pcMatch ? pcMatch[1].toUpperCase().replace(/\s+/g, " ") : "";
      const pcKey = pc.replace(/\s/g, " ");
      const coords = venueCoords[pcKey] || venueCoords[pc.replace(/\s/g, "")] || [51.51 + (Math.random()-0.5)*0.03, -0.1 + (Math.random()-0.5)*0.05];
      venues.push({ name: r[0], address: addr, lat: coords[0], lng: coords[1] });
    }
  } catch(e) {}

  return { props: { comments: allComments, gwiData, murals, venues, fullThemeCounts, totalCommentCount } };
}

export default function Dashboard({ comments = [], gwiData = [], murals = [], venues = [], fullThemeCounts = {}, totalCommentCount = 0 }) {
  const [tab, setTab] = useState("dashboard");
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [researchSubTab, setResearchSubTab] = useState("library");

  if (!authed) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: Y }}>VCCP Media Cultural Intelligence</span>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: WHITE, margin: "8px 0 24px", letterSpacing: "-0.02em" }}>The Madonna Pulse</h1>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && pw === "Tune5") setAuthed(true); }} placeholder="Enter password" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 20px", fontSize: 14, color: WHITE, outline: "none", width: 220, textAlign: "center", fontFamily: "'Inter Tight', system-ui, sans-serif" }} autoFocus />
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { if (pw === "Tune5") setAuthed(true); }} style={{ background: Y, color: BG, border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Enter</button>
          </div>
          {pw.length > 0 && pw !== "Tune5" && <p style={{ color: RED, fontSize: 12, marginTop: 12 }}>Incorrect password</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Newsreader', 'Georgia', serif", color: WHITE }}>
      <div style={{ maxWidth: ["youtube","gwi","streetmap","culturalfeed","socialpulse","dashboard","ideas","calendar","strategy"].includes(tab) ? 1100 : 720, margin: "0 auto", padding: "32px 24px", transition: "max-width 0.3s ease" }}>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: Y, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>VCCP Media Cultural Intelligence</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: WHITE, lineHeight: 1.1, margin: "0 0 4px", letterSpacing: "-0.02em", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The Madonna Pulse</h1>
        <p style={{ fontSize: 15, color: MUTED, margin: "0 0 4px", fontStyle: "italic" }}>Cultural intelligence dashboard</p>
        <div style={{ height: 3, background: Y, borderRadius: 2, margin: "16px 0 24px" }} />

        <MentionsTicker />

        <div style={{ display: "flex", gap: 6, marginBottom: 32, flexWrap: "wrap" }}>
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "culturalfeed", label: "Media" },
            { id: "socialpulse", label: "Social listening" },
            { id: "youtube", label: "YouTube" },
            { id: "gwi", label: "Audience" },
            { id: "strategy", label: "Strategy" },
            { id: "streetmap", label: "Locations" },
            { id: "ideas", label: "Ideas" },
            { id: "calendar", label: "Calendar" },
            { id: "research", label: "Research" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? BG : MUTED, background: tab === t.id ? Y : "transparent",
              border: tab === t.id ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
              fontFamily: "'Inter Tight', system-ui, sans-serif", transition: "all 0.15s"
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "dashboard" && <DashboardSummary />}

        {tab === "_old_insight" && <>
          <Sect title="The human truth">
            <Pull text="The world is busy debating whether Madonna is still relevant. The answer is in every artist they compare her to." />
            <Insight text="This isn't a positioning exercise. It's a tension that already exists inside the audience's head. They know she's the origin. They just haven't said it out loud. The cultural engine doesn't argue the case. It makes the invisible visible." color={DIM} />
            <Insight text="Vanity Fair wrote that Taylor Swift owes the entire concept of having 'eras' to Madonna. Beyonce called her 'Queen Mother' on the Queens Remix and sampled Vogue with her explicit blessing. Beyonce herself said she wanted to 'follow in the footsteps of Madonna and be a powerhouse.' The lineage is there. It's just been buried under appearance discourse and nostalgia cycles." color={DIM} />
          </Sect>

          <Sect title="Why this moment matters" accent={CORAL}>
            <Card accent={CORAL}>
              <Pull text="Madonna is entering the highest-density cultural window she's had in a decade. And none of it is accidental." color={CORAL} />
              <Insight text="A new dance album with Stuart Price (the partnership that produced her most critically adored late-career work). A return to Warner Records, the label where it all began. A Netflix series with Shawn Levy. A Dolce & Gabbana fragrance campaign and front-row presence at two major fashion weeks. The Veronica Electronica remix album resurfacing unreleased Ray of Light material. Hung Up added to Just Dance 2026." color={DIM} />
              <Insight text="These aren't separate events. They're converging vectors. The engine's job is to make sure the narrative around this convergence is 'the original, returning to the floor she built' and not 'ageing icon attempts comeback.'" color={DIM} />
            </Card>
          </Sect>

          <Sect title="What brand heat actually means" accent={PURPLE}>
            <Insight text="Brand heat is not follower count, streaming numbers, or chart position. Madonna will never out-chart Sabrina Carpenter. She doesn't need to. She needs to be the artist Sabrina Carpenter references." color={DIM} />
            <Card accent={PURPLE}>
              <StatRow label="Primary metric" value="Association shift" sub="From 'surgery discourse' to 'original icon'" color={PURPLE} />
              <StatRow label="Measurement" value="Quarterly brand lift" sub="Unprompted: 'what comes to mind when I say Madonna?'" color={PURPLE} />
              <StatRow label="Behavioural signal" value="New cohort streaming" sub="Under-25 listener growth on catalogue + new album" color={TEAL} />
              <StatRow label="Cultural velocity" value="Earned media ratio" sub="Artistry coverage vs appearance coverage" color={CORAL} />
              <StatRow label="Social proof" value="Save + share rate" sub="Not views. Not likes. Saves and shares only." color={GREEN} />
            </Card>
            <Insight text="Platform ROAS overstates true incrementality by 2-10x. Attribution systematically punishes the emotional brand building that Madonna needs most. We measure what matters, not what's easy." color={MUTED} />
          </Sect>

          <Sect title="The strategic tension" accent={AMBER}>
            <Pull text="Madonna's biggest vulnerability is also her biggest asset: she refuses to disappear." />
            <Insight text="The appearance discourse dominates search. It drowns out the music, the fashion, the activism, the influence. But here's the counterintuitive truth: the scrutiny exists because she's still present. Artists who 'age gracefully' by retreating from public life don't get scrutinised. They get forgotten. Madonna chose visibility over comfort. That choice is what keeps her culturally alive." color={DIM} />
            <Insight text="The engine doesn't defend this choice. It redirects attention from the discourse to the work. Every time the appearance conversation spikes, the response isn't engagement. It's a flood of artistry content that gives publications and fans something better to write about and share." color={DIM} />
            <Card accent={RED}>
              <p style={{ fontSize: 13, color: RED, fontWeight: 700, marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The rule that governs everything</p>
              <Insight text="Never play defence. The original doesn't explain itself. It doesn't justify its existence. It simply continues to create. The moment the engine starts arguing that Madonna is still relevant, it has already lost. The frame is always offensive: she is the source." color={DIM} />
            </Card>
          </Sect>
        </>}

        {tab === "_removed_britishgas" && <>
          <Sect title="What people are actually saying">
            <Pull text="We scraped 50 TikTok videos, PopJustice forum threads, Reddit fan communities, and Instagram comments. Here's what the data reveals about how people talk about Madonna in April 2026." />
            <Insight text="The intelligence engine doesn't start with what Madonna wants to say. It starts with what people are already feeling, sharing, and saving. The Pulse methodology: scrape what's trending, score by save rate and share rate, classify the emotional territory, and build content back from the human truth underneath." color={DIM} />
          </Sect>

          <Sect title="Conversation territory 1: The anticipation" accent={TEAL}>
            <Card accent={TEAL}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: TEAL, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Album anticipation is the dominant positive signal</p>
                <span style={{ fontSize: 12, color: TEAL, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>451K top plays</span>
              </div>
              <Insight text="Metro Entertainment's COADF Part 2 announcement video hit 451,300 plays, 28,500 likes, 2,447 shares, and 1,728 saves. That's from a 305K follower account, meaning the content significantly outperformed the base. The save rate signals genuine intent: people are bookmarking this to come back to. They want to be ready." color={DIM} />
              <Insight text="The fan forum discourse on PopJustice reveals something deeper. Fans aren't just excited. They're anxious. The Stuart Price reunion generates genuine hope because his name is attached to the last album they universally loved. But there's a fear underneath: 'her previous three studio albums didn't result in any Grammy nominations.' The anticipation is conditional. It's 'please let this be the one.'" color={DIM} />
              <div style={{ background: `${TEAL}08`, border: `1px solid ${TEAL}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEAL, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The fans haven't lost faith in Madonna. They've lost faith in the albums. The Stuart Price reunion is the first time in a decade they've felt permission to believe again. The content engine's job: protect that anticipation. Feed it with craft signals (production diaries, B-side drops, Price studio content). Never overpromise. Let the music speak." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 2: The archive worship" accent={PURPLE}>
            <Card accent={PURPLE}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: PURPLE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Archive and tour footage massively outperforms new content</p>
                <span style={{ fontSize: 12, color: PURPLE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>684K top plays</span>
              </div>
              <Insight text="The single highest-performing TikTok in our scrape isn't about the new album. It's @madonna_tours posting Blond Ambition Tour footage from 1990: 684,300 plays, 61,900 likes, and 7,028 saves from a 23,500 follower account. That's a 29x follower multiplier. @madonnabloom's Virgin Tour 'Dress You Up' clip hit 656,900 plays with 39,400 likes and 3,227 saves from 110K followers." color={DIM} />
              <Insight text="The data is unambiguous: the catalogue IS the content. Archive footage consistently generates the highest engagement rates in the entire Madonna TikTok ecosystem. And the saves are disproportionately high, meaning people aren't just watching. They're collecting. They're building personal archives of her legacy." color={DIM} />
              <div style={{ background: `${PURPLE}08`, border: `1px solid ${PURPLE}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: PURPLE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="People don't want to be told Madonna is iconic. They want to experience it themselves. The archive footage doesn't need commentary. The performance IS the argument. This validates the 'she did it first' franchise structure: show the archive, let the audience draw the line to the present. The proof doesn't need a narrator." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 3: The family Madonna" accent={CORAL}>
            <Card accent={CORAL}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: CORAL, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Rocco, the kids, and the human behind the icon</p>
                <span style={{ fontSize: 12, color: CORAL, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>581K plays</span>
              </div>
              <Insight text="Rocco Ciccone's 'Habibi Let's Celebrate' New Year video hit 581,300 plays, 25,900 likes, 2,358 shares, and 1,679 saves. From a 110K account, that's massive organic reach. The Morocco family content, the makeup-free Hanukkah photos with daughters Stella and Estere, the D&G show with Lourdes Leon — this content performs because it shows the human being inside the icon." color={DIM} />
              <Insight text="The fan comments on her New Year post tell the story: 'We were waiting for these photos, it's a celebration! 2026 is going to be you and us, the fans.' The possessive 'you and us' is significant. The fans see themselves as participants in Madonna's life, not just consumers of her output. The family content makes that feel reciprocal." color={DIM} />
              <div style={{ background: `${CORAL}08`, border: `1px solid ${CORAL}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: CORAL, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The audience doesn't just want the icon. They want the person. The family content humanises without diminishing. It shows Madonna as a mother, a partner, a person who celebrates holidays and takes her kids to Morocco. This is the emotional layer that the 'stick around' franchise can draw from: persistence isn't just about career longevity. It's about still being present as a full human being." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 4: The fashion authority" accent={Y}>
            <Card accent={Y}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: Y, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Milan, Paris, D&G: the fashion presence is live</p>
                <span style={{ fontSize: 12, color: Y, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Active Q1 2026</span>
              </div>
              <Insight text="Vogue Taiwan covered Madonna at Saint Laurent SS2026 with Lourdes Leon and Akeem Morris (14,100 plays). Fan accounts documented her D&G FW2026 Milan appearance in detail. The La Bambola performance at D&G's Alta Moda salon generated coverage from Popline Brazil (84,200 plays, 7,908 likes). The fashion conversation is the only territory where the discourse is overwhelmingly positive with almost no appearance commentary." color={DIM} />
              <div style={{ background: `${Y}08`, border: `1px solid ${Y}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: Y, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="Fashion is the safe harbour. When Madonna is discussed in a fashion context, the conversation centres on craft, design, and creative relationships, not on her face. This is where the 'she did it first' franchise has the cleanest entry point. The D&G relationship spans decades. The Saint Laurent presence signals ongoing relevance. The fashion territory is where the appearance-to-artistry ratio is already favourable. Double down here." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 5: The sceptics" accent={AMBER}>
            <Card accent={AMBER}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: AMBER, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The conditional believers and the album anxiety</p>
                <span style={{ fontSize: 12, color: AMBER, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>PopJustice, Reddit</span>
              </div>
              <Insight text="The PopJustice forum thread on Madonna's 15th album runs to multiple pages of deep, passionate, anxious debate. The core tension: fans want to believe but they've been hurt before. 'Her previous three studio albums didn't result in any nominations.' 'I've never been a massive fan of Max Martin's stuff. It's rarely interesting and I wouldn't call him an innovator.' 'Madonna's best work was often with producers who were slightly avant-garde and experimental.'" color={DIM} />
              <Insight text="But then the counter-voices: 'She's clearly got something to prove, and we know how mother gets when she's really hungry.' 'Somewhere between Ray of Light and Confessions lies what we all need. She needs to reclaim the dance floor in a big way.' One fan described listening to Ray of Light for the first time and ordering the vinyl immediately. The love is conditional, but the conditions are being met: Stuart Price, Warner Records, dance floor, no compromises." color={DIM} />
              <div style={{ background: `${AMBER}08`, border: `1px solid ${AMBER}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: AMBER, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The music purists are the canary in the coal mine. If they believe, the album has a shot at critical reappraisal. If they don't, the narrative stays stuck on nostalgia and appearance. The 'when electronica was a risk' franchise speaks directly to this cluster: it reminds them that Madonna has been here before, choosing the risky path when the safe one was available, and being vindicated by the work. The Stuart Price reunion IS the signal they need. The engine's job is to make sure they see it." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="The content-back model" accent={Y}>
            <Pull text="This is the Pulse methodology. Scrape what people say. Score by saves and shares. Find the human truth. Build content back from the need." />

            <p style={{ fontSize: 13, fontWeight: 700, color: Y, marginBottom: 12, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Live feed: top performing Madonna TikToks (scraped April 2026)</p>

            {[
              { author: "themadonnatiktoks", fans: "173K", plays: "1.1M", likes: "73.5K", shares: "5,758", saves: "5,723", comments: "1,022", text: "Gen X Madonna icon compilation edit", url: "https://www.tiktok.com/@themadonnatiktoks/video/7412775885494963489", territory: "Archive worship", saveRate: "0.52%", date: "Sep 2024" },
              { author: "madonna_tours", fans: "23.5K", plays: "684K", likes: "61.9K", shares: "2,172", saves: "7,028", comments: "695", text: "Act of Contrition / Like a Prayer — Blond Ambition Tour 1990", url: "https://www.tiktok.com/@madonna_tours/video/7350707569377201414", territory: "Archive worship", saveRate: "1.03%", date: "Mar 2024" },
              { author: "madonnabloom", fans: "110K", plays: "657K", likes: "39.4K", shares: "4,640", saves: "3,227", comments: "1,789", text: "Dress You Up — The Virgin Tour (1985)", url: "https://www.tiktok.com/@madonnabloom/video/7544004309982170369", territory: "Archive worship", saveRate: "0.49%", date: "Aug 2025" },
              { author: "roccoccicone", fans: "110K", plays: "581K", likes: "25.9K", shares: "2,358", saves: "1,679", comments: "1,036", text: "Habibi Let's Celebrate 2026! Family New Year in Morocco", url: "https://www.tiktok.com/@roccoccicone/video/7591252603690814751", territory: "Family Madonna", saveRate: "0.29%", date: "Jan 2026" },
              { author: "__mrecords__", fans: "34K", plays: "502K", likes: "2.1K", shares: "153", saves: "385", comments: "98", text: "Madonna's evolution from the '80s to today — still iconic, still the Queen of Pop", url: "https://www.tiktok.com/@__mrecords__/video/7556987231324441878", territory: "Contested: ageing", saveRate: "0.08%", date: "Oct 2025" },
              { author: "metroentertainment", fans: "305K", plays: "451K", likes: "28.5K", shares: "2,447", saves: "1,728", comments: "508", text: "COADF Part 2 announced — every pop girl should be scared", url: "https://www.tiktok.com/@metroentertainment/video/7551432107860495638", territory: "Album anticipation", saveRate: "0.38%", date: "Sep 2025" },
              { author: "madonnabloom", fans: "110K", plays: "361K", likes: "17.2K", shares: "1,918", saves: "2,904", comments: "359", text: "Vogue — MTV VMAs 1990 performance", url: "https://www.tiktok.com/@madonnabloom/video/7279546435320810757", territory: "Archive worship", saveRate: "0.80%", date: "Sep 2023" },
              { author: "themadonnatiktoks", fans: "173K", plays: "196K", likes: "16.6K", shares: "1,000", saves: "1,382", comments: "285", text: "Gen X Madonna forever compilation", url: "https://www.tiktok.com/@themadonnatiktoks/video/7481753283892235542", territory: "Archive worship", saveRate: "0.71%", date: "Mar 2025" },
              { author: "dieguitopaes", fans: "16.4K", plays: "87.6K", likes: "497", shares: "42", saves: "97", comments: "11", text: "Madonna performing Hung Up at Coachella 2006 — nostalgia pop culture", url: "https://www.tiktok.com/@dieguitopaes/video/7498379640860347653", territory: "Archive worship", saveRate: "0.11%", date: "Apr 2025" },
              { author: "elheraldodemexico", fans: "8.2M", plays: "86.5K", likes: "7.2K", shares: "244", saves: "678", comments: "319", text: "La Reina del Pop regresa — COADF Part 2 announcement (Spanish)", url: "https://www.tiktok.com/@elheraldodemexico/video/7572406477231590712", territory: "Album anticipation", saveRate: "0.78%", date: "Nov 2025" },
              { author: "popline", fans: "2.3M", plays: "84.2K", likes: "7.9K", shares: "198", saves: "514", comments: "185", text: "La Bambola performance at Dolce & Gabbana — comeback aquecendo", url: "https://www.tiktok.com/@popline/video/7613561344109071636", territory: "Fashion authority", saveRate: "0.61%", date: "Mar 2026" },
              { author: "elliehenman", fans: "7.4K", plays: "45.4K", likes: "4.2K", shares: "530", saves: "347", comments: "201", text: "Madonna filming top secret music comeback in UK — 41 dancers, 200+ crew", url: "https://www.tiktok.com/@elliehenman/video/7613121124339076374", territory: "Album anticipation", saveRate: "0.76%", date: "Mar 2026" },
              { author: "ikaiique_", fans: "5.2K", plays: "46.3K", likes: "5.9K", shares: "84", saves: "554", comments: "229", text: "Confessions on a Dance Floor track ranking — fan discourse", url: "https://www.tiktok.com/@ikaiique_/video/7458435542590573829", territory: "Music purists", saveRate: "1.20%", date: "Jan 2025" },
              { author: "omuriloronchi", fans: "16.2K", plays: "11K", likes: "1.6K", shares: "151", saves: "114", comments: "115", text: "Madonna feat. Britney Spears rumour on new album — fan speculation", url: "https://www.tiktok.com/@omuriloronchi/video/7626537396481445138", territory: "Album anticipation", saveRate: "1.04%", date: "Apr 2026" },
              { author: "hudkonsulenten", fans: "4.4K", plays: "5.4K", likes: "216", shares: "42", saves: "57", comments: "5", text: "'To age is a sin' — reaction to Madonna's 2016 Billboard speech on ageism", url: "https://www.tiktok.com/@hudkonsulenten/video/7555624479917935894", territory: "Ageism reframe", saveRate: "1.05%", date: "Sep 2025" },
            ].map((p, i) => {
              const territoryColors = { "Archive worship": PURPLE, "Family Madonna": CORAL, "Album anticipation": TEAL, "Fashion authority": Y, "Music purists": GREEN, "Contested: ageing": AMBER, "Ageism reframe": AMBER };
              const tc = territoryColors[p.territory] || MUTED;
              return (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", background: CARD, borderRadius: 10, padding: "14px 18px", border: `1px solid ${BORDER}`, marginBottom: 8, transition: "border-color 0.15s", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = tc}
                  onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: WHITE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>@{p.author}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>{p.fans} followers</span>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${tc}22`, color: tc, fontWeight: 600, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{p.territory}</span>
                  </div>
                  <p style={{ fontSize: 13, color: DIM, lineHeight: 1.5, margin: "0 0 8px" }}>{p.text}</p>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: MUTED, flexWrap: "wrap" }}>
                    <span><span style={{ color: WHITE, fontWeight: 600 }}>{p.plays}</span> plays</span>
                    <span><span style={{ color: WHITE, fontWeight: 600 }}>{p.likes}</span> likes</span>
                    <span><span style={{ color: TEAL, fontWeight: 600 }}>{p.shares}</span> shares</span>
                    <span><span style={{ color: PURPLE, fontWeight: 600 }}>{p.saves}</span> saves</span>
                    <span><span style={{ color: tc, fontWeight: 700 }}>{p.saveRate}</span> save rate</span>
                    <span style={{ marginLeft: "auto", color: MUTED }}>{p.date}</span>
                  </div>
                </a>
              );
            })}

            <Card accent={Y}>
              <p style={{ fontSize: 13, fontWeight: 700, color: Y, margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>What the data tells us</p>
              {[
                { signal: "Archive tour footage dominates everything", insight: "7 of the top 15 posts are archive performances. Blond Ambition, VMAs, Virgin Tour, Confessions Tour. Save rates on archive content (0.49-1.03%) consistently outperform new content. The catalogue IS the engine.", color: PURPLE },
                { signal: "Save rate is the real quality signal", insight: "A COADF track ranking from a 5K-follower account hit 1.20% save rate. The Billboard ageism speech reaction hit 1.05%. Britney Spears album rumour hit 1.04%. High save rate from small accounts = genuine audience intent, not algorithmic luck.", color: TEAL },
                { signal: "Spanish and Portuguese language content is massive", insight: "El Heraldo de Mexico (86K plays), Popline Brazil (84K plays). The Latin fanbase is producing and consuming Madonna content at scale. The engine should be multilingual, not English-only.", color: CORAL },
                { signal: "The music video shoot leak drove real excitement", insight: "Ellie Henman's exclusive about Madonna filming in the UK with 41 dancers and 200+ crew hit 45K plays from a 7K account. That's a 6x follower multiplier. Behind-the-scenes production content generates genuine anticipation. Feed this.", color: GREEN },
                { signal: "The 'evolution' / before-and-after format is contested", insight: "MRecords' evolution compilation hit 502K plays but only 0.08% save rate. High views, low saves. People watch but don't keep it. This format feeds the appearance discourse more than the artistry narrative. Deprioritise.", color: AMBER },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < 4 ? `1px solid ${BORDER}` : "none" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: s.color, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{s.signal}</p>
                  <Insight text={s.insight} color={DIM} />
                </div>
              ))}
            </Card>

            <Card accent={TEAL}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEAL, margin: "0 0 6px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>How the Spark Board powers this</p>
              <Insight text="The same Apify pipeline that powers Firepit's content intelligence runs here. Scheduled TikTok scrapes across Madonna hashtags and search terms, scored by save rate and share rate, classified by conversation territory. The intelligence layer surfaces which territories are heating up or cooling down week over week. The content brief generator produces weekly briefs mapped to the six era franchises. One tool architecture. Two completely different clients. Same methodology: listen first, build content back from what people actually need." color={DIM} />
            </Card>
          </Sect>
        </>}

        {tab === "research" && <>
          <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
            {[{ id: "library", label: "Research Library" }, { id: "bearhunt", label: "Bear Hunt" }].map(st => (
              <button key={st.id} onClick={() => setResearchSubTab(st.id)} style={{
                padding: "6px 14px", fontSize: 11, fontWeight: researchSubTab === st.id ? 700 : 400,
                color: researchSubTab === st.id ? BG : MUTED, background: researchSubTab === st.id ? TEAL : "transparent",
                border: researchSubTab === st.id ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter Tight', system-ui, sans-serif"
              }}>{st.label}</button>
            ))}
          </div>

          {researchSubTab === "bearhunt" && <DocUploader apiEndpoint="/api/bear-hunt" title="Bear Hunt" description="Upload market research Word documents for analysis and reference." />}

          {researchSubTab === "library" && <>
          <Sect title="The Imperial Phase">
            <Card accent={Y}>
              <Pull text="No artist before or since has sustained that kind of totalising dominance for so long, across so many simultaneous verticals." color={Y} />
              <Insight text="Between 1984 and 1993, Madonna placed seventeen singles in the US Billboard Hot 100 top five. Seven reached number one. On the UK Singles Chart, she accumulated thirty-five consecutive top ten entries. True Blue debuted at number one in over twenty-eight countries simultaneously in 1986." color={DIM} />
              <div style={{ background: CARD, borderRadius: 8, padding: 16, margin: "16px 0", border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: Y, margin: "0 0 10px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Album-by-Album Commercial Anatomy</p>
                {[
                  { album: "Madonna", year: "1983", peak: "#8", sales: "10M+", singles: "Holiday, Borderline, Lucky Star" },
                  { album: "Like a Virgin", year: "1984", peak: "#1", sales: "21M+", singles: "Like a Virgin, Material Girl" },
                  { album: "True Blue", year: "1986", peak: "#1", sales: "25M+", singles: "Live to Tell, Papa Don't Preach" },
                  { album: "Like a Prayer", year: "1989", peak: "#1", sales: "15M+", singles: "Like a Prayer, Express Yourself" },
                  { album: "Immaculate Collection", year: "1990", peak: "#2", sales: "30M+", singles: "Justify My Love" },
                  { album: "Erotica", year: "1992", peak: "#2", sales: "6M+", singles: "Erotica, Deeper and Deeper, Rain" },
                ].map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 5 ? `1px solid ${BORDER}` : "none", fontSize: 13 }}>
                    <span style={{ color: WHITE, fontWeight: 600, flex: 1 }}>{a.album} <span style={{ color: MUTED, fontWeight: 400 }}>({a.year})</span></span>
                    <span style={{ color: Y, fontWeight: 700, width: 40, textAlign: "center" }}>{a.peak}</span>
                    <span style={{ color: TEAL, width: 50, textAlign: "right" }}>{a.sales}</span>
                  </div>
                ))}
              </div>
              <Insight text="The Blond Ambition World Tour in 1990 grossed nearly $63 million, setting a new commercial benchmark. The Immaculate Collection remains the best-selling compilation album by a solo artist ever, with certified sales exceeding 30 million units globally." color={DIM} />
            </Card>
            <Card accent={PURPLE}>
              <Pull text="She understood that the music video was not a supplement to the song. It was a parallel text, operating on its own semiotic register." color={PURPLE} />
              <Insight text="Madonna grasped, earlier and more completely than any of her contemporaries, that in the MTV era, a pop star was fundamentally a visual proposition. 'Express Yourself' drew on Fritz Lang's Metropolis. 'Like a Prayer' layered Catholic iconography with civil rights symbolism. 'Vogue' translated underground ballroom culture into a mass-market visual language." color={DIM} />
              <Insight text="The Jean Paul Gaultier cone bra for the Blond Ambition Tour remains, more than thirty-five years later, one of the most recognisable garments in the history of popular culture. Her fashion strategy was about perpetual reinvention at a pace that kept the press and public in constant anticipation." color={DIM} />
            </Card>
            <Card accent={CORAL}>
              <Pull text="She grasped that outrage was an attention-generation mechanism, and that attention, regardless of its valence, was the fundamental currency of pop stardom." color={CORAL} />
              <Insight text="The 1989 Pepsi deal: Madonna signed $5 million, the 'Like a Prayer' video provoked outrage, Pepsi withdrew the ad, Madonna retained the fee and received incalculable free media coverage. The album debuted at number one. This template would be replicated by every major pop act for three decades." color={DIM} />
            </Card>
            <Card accent={GREEN}>
              <Pull text="She built an infrastructure of cultural authority that survived the inevitable cooling of her chart dominance." color={GREEN} />
              <Insight text="Maverick Records (1992) was not a vanity label. It signed Alanis Morissette. Madonna positioned herself as an owner with equity, infrastructure, and a seat at the table. Multi-platform brand architecture across film, publishing, fashion, and endorsements ensured no single vertical's decline would be existential." color={DIM} />
            </Card>
          </Sect>

          <Sect title="The Cathedral and the Dancefloor" accent={PINK}>
            <Card accent={PINK}>
              <Pull text="She emerged from the sweat-drenched, racially mixed, overwhelmingly queer nightclubs of lower Manhattan. That origin story is the skeleton key to her entire artistic project." color={PINK} />
              <Insight text="The Mudd Club and Club 57 (1978-80): downtown art-world haunts where she mingled with Keith Haring and Jean-Michel Basquiat. The Fun House (1981-83): DJ Jellybean Benitez held 14-hour sets, playing freestyle that became the rhythmic backbone of her early recordings. Danceteria (1982-83): her first solo live performance, 16 December 1982. Sade tended bar; Keith Haring was a busboy." color={DIM} />
              <p style={{ fontSize: 12, fontWeight: 700, color: PINK, margin: "16px 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The Underground-to-Mainstream Pipeline</p>
              {[
                { name: "Jellybean Benitez", era: "1983-84", note: "Fun House DJ. Co-produced 'Holiday.' Freestyle sensibility defined the debut era." },
                { name: "Shep Pettibone", era: "1990-92", note: "Club DJ elevated to co-producer on 'Vogue' and the entire Erotica album." },
                { name: "William Orbit", era: "1998", note: "Unknown British electronic producer. Ray of Light won three Grammys and introduced electronica to mainstream pop." },
                { name: "Stuart Price", era: "2005, 2026", note: "Confessions on a Dance Floor structured like a DJ set. Now reunited for the sequel." },
                { name: "Honey Dijon / SOPHIE / Arca", era: "2010s-20s", note: "Continued pattern with openly queer, gender-nonconforming electronic artists." },
              ].map((c, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 4 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEAL }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{c.era}</span>
                  </div>
                  <Insight text={c.note} color={DIM} />
                </div>
              ))}
            </Card>
            <Card accent={TEAL}>
              <Pull text="50 number-one Dance Club Songs singles. The remix catalogue reads as a four-decade survey of underground dance music." color={TEAL} />
              <Insight text="In the pre-streaming era, Madonna's remix singles served as a mass-distribution vehicle for dancefloor aesthetics. Many young ears around the world were first introduced to house, techno, and other electronic genres through a Madonna remix rather than through a club." color={DIM} />
            </Card>
          </Sect>

          <Sect title="Advocacy, Visibility and Allyship" accent={PURPLE}>
            <Card accent={PURPLE}>
              <Pull text="No single ally has been a better friend or had a bigger impact on acceptance for the LGBTQ community than Madonna." color={PURPLE} />
              <Insight text="CNN's Anderson Cooper, introducing her GLAAD Advocate for Change Award in 2019 — only the second person ever honoured." color={MUTED} />
              <p style={{ fontSize: 12, fontWeight: 700, color: PURPLE, margin: "12px 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Key moments</p>
              {[
                { year: "1989", event: "Inserted HIV/AIDS education leaflet into Like a Prayer album packaging during the Reagan era." },
                { year: "1990", event: "Blond Ambition Tour: 6 of 7 male dancers were gay. 3 were HIV-positive. Truth or Dare showed 'being gay when it was not cool.'" },
                { year: "1990", event: "'Vogue' brought Harlem ballroom culture to global mainstream. Dancers from the House of Xtravaganza choreographed the video." },
                { year: "1992", event: "'In This Life' (Erotica) — one of the few mainstream pop songs to address AIDS directly and by name." },
                { year: "2018", event: "Surprise performance at the Stonewall Inn on New Year's Eve." },
                { year: "2023-24", event: "Celebration Tour: described as her most radical queer statement since Blond Ambition. 'Live to Tell' performed surrounded by photos of friends lost to AIDS." },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < 5 ? `1px solid ${BORDER}` : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE, minWidth: 48, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{m.year}</span>
                  <Insight text={m.event} color={DIM} />
                </div>
              ))}
            </Card>
          </Sect>

          <Sect title="Saints, Sinners & Sequins" accent={AMBER}>
            <Card accent={AMBER}>
              <Pull text="The icon's suffering is not voyeuristically consumed; it is recognised as structurally analogous to one's own. Her survival becomes proof that survival is possible." />
              <Insight text="The sociological relationship between the gay community and female pop icons rests on seven attributes: suffering and survival, performative excess, vocal authenticity, sexual agency, loyalty to the community, reinvention, and camp sensibility. Madonna scores maximally on every dimension." color={DIM} />
            </Card>
            <Card accent={CORAL}>
              <Pull text="The dancefloor was never merely a sonic environment. It was a political space — a space of liberation, of bodily autonomy, of queer survival." color={CORAL} />
              <Insight text="House music's name was literally derived from a safe space for queer Black community — The Warehouse in Chicago. The gay community's aesthetic judgement became the unofficial A&R department of the global music industry. The club-to-radio pipeline: tracks that worked on gay dancefloors were refined and released to the mainstream." color={DIM} />
            </Card>
          </Sect>

          <Sect title="The Postmodern Revolution" accent={TEAL}>
            <Card accent={TEAL}>
              <Insight text="Academic analysis from the Journal of Literature and Art Studies confirms Madonna used postmodern strategies to challenge foundational truths of sex and gender, promote gender deconstruction, create political sites of resistance, and question Catholic dissociation between the physical and the divine." color={DIM} />
              <Insight text="Her interaction with queer subcultures shows rejection of hegemonic heteronormative constructions and results in fluidity through appropriation. From voguing to the Like a Prayer controversy to the American Life anti-war statement, she created what scholars call 'political sites of resistance' within mass pop culture." color={DIM} />
            </Card>
          </Sect>

          <Sect title="Fandom in the 2020s" accent={GREEN}>
            <Card accent={GREEN}>
              <Pull text="45.2 million monthly Spotify listeners. 10 billion+ total streams. The catalog is undergoing simultaneous institutional consolidation and grassroots rediscovery." color={GREEN} />
              <div style={{ background: CARD, borderRadius: 8, padding: 16, margin: "16px 0", border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: GREEN, margin: "0 0 10px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The Generational Map</p>
                {[
                  { seg: "Gen Jones (1954-65)", format: "Vinyl/CD collectors", channel: "Reissues, word-of-mouth", mode: "Archival completionism", color: PURPLE },
                  { seg: "Gen X (1965-80)", format: "Streaming playlists", channel: "Spotify; Celebration Tour", mode: "Nostalgia-driven hits", color: CORAL },
                  { seg: "Millennials (1981-96)", format: "Streaming primary", channel: "Club/DJ culture", mode: "Event-driven spikes", color: PINK },
                  { seg: "Gen Z (1997-2012)", format: "Streaming-only", channel: "TikTok algorithm", mode: "Viral deep-catalog exploration", color: TEAL },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{s.seg}</span>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: MUTED, marginTop: 4 }}>
                      <span>{s.format}</span><span>{s.channel}</span><span style={{ color: DIM }}>{s.mode}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Insight text="The Celebration Tour (2023-24) grossed $225.4 million across 80 shows, including the largest standalone concert audience in history — 1.6 million at Copacabana Beach. Deep-catalog tracks from Erotica, Bedtime Stories, and Ray of Light are registering all-time peak streaming numbers in 2026, driven by TikTok-originated discovery loops." color={DIM} />
            </Card>
          </Sect>

          <Sect title="From the Underground to the Mainstream" accent={Y}>
            <Card accent={Y}>
              <Pull text="Every dominant genre in contemporary pop music traces its DNA to underground clubs in the 1970s and 1980s in New York and Chicago. The underground won." color={Y} />
              <Insight text="Disco Demolition Night (1979) forced the sound underground, where it mutated into house and techno. Frankie Knuckles at The Warehouse gave house music its name. Paradise Garage's 'Saturday Mass' defined garage music. Madonna's debut single was tested on a club dancefloor, signed because a club DJ believed in it." color={DIM} />
              <Insight text="The current revival: Dua Lipa's Future Nostalgia, Beyonce's Renaissance (dedicated to her late gay uncle Johnny), Chappell Roan's Grammy-winning queer club artistry, Charli xcx's BRAT — each draws directly from the traditions forged in Black gay clubs. The trajectory from David Mancuso's Loft in 1970 to Chappell Roan's Grammy in 2025 is a case study in how marginalised communities built cultural infrastructure that consumed the mainstream." color={DIM} />
            </Card>
          </Sect>
          </>}
        </>}

        {tab === "youtube" && <YouTubeIntelligence comments={comments} fullThemeCounts={fullThemeCounts} totalCommentCount={totalCommentCount} />}

        {tab === "gwi" && <AudienceIntelligence gwiData={gwiData} />}

        {tab === "strategy" && <StrategyRecommendations />}
        {tab === "streetmap" && <StreetArtMap murals={murals} venues={venues} />}

        {tab === "culturalfeed" && <CulturalFeed />}

        {tab === "socialpulse" && <SocialDashboard />}

        {tab === "ideas" && <IdeasBoard />}
        {tab === "calendar" && <CampaignCalendar />}

        <MasterRefresh />

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>VCCP Media Cultural Intelligence</span>
          <span style={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>The original. Not the comeback.</span>
        </div>
      </div>
    </div>
  );
}
