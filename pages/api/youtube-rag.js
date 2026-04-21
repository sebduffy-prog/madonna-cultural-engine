// YouTube Graph RAG — Deep comment pulling + AI-driven dynamic themes
//
// Daily budget: 10,000 YouTube API units
// Per run: ~4,500 units (leaves room for 2 runs/day)
//   Search: 4 × 100 = 400
//   Video details: ~30 × 1 = 30
//   Comments: ~4000 comments ÷ 100 per page × 1 = 40 pages = 40
//   Total YouTube: ~470 units
// Plus 1 Anthropic call for theme analysis
//
// Pulls 1000 comments from viral, 500 from non-viral, up to 8 videos

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";
import fs from "fs";
import path from "path";

const CACHE_KEY = "youtube_rag_cache";
const VIDEOS_KEY = "youtube_rag_videos";
const COMMENTS_KEY = "youtube_rag_comments";
const THEMES_KEY = "youtube_rag_themes";
const CACHE_TTL = 86400;
const VIRAL_THRESHOLD = 100000;
const COMMENTS_VIRAL = 2000;
const COMMENTS_NORMAL = 1000;
const MAX_STORED_COMMENTS = 50000;

const MADONNA_CHANNEL_ID = "UCJiLxJhBhSFtoddDw7cgQqQ"; // @madonna official channel

const SEARCH_QUERIES = [
  "Madonna",
  "Madonna COADF2",
  "Madonna Confessions on a Dance Floor 2",
  'Madonna "Confessions II"',
  "Madonna new album 2026",
  "Madonna comeback",
  "Madonna concert tour 2026",
  "Madonna reaction",
];

// Default themes — get replaced by AI analysis
const DEFAULT_THEMES = [
  { id: "nostalgia", label: "Nostalgia", color: "#F59E0B", keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "back in the day", "years ago"] },
  { id: "musical", label: "Musical", color: "#34D399", keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece"] },
  { id: "icon", label: "Icon", color: "#FFD500", keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"] },
  { id: "emotional", label: "Emotional", color: "#F472B6", keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved"] },
  { id: "empowerment", label: "Empowerment", color: "#A78BFA", keywords: ["feminist", "empowered", "strong", "powerful", "independent", "trailblazer", "barrier"] },
  { id: "sexuality", label: "Sexuality", color: "#EF4444", keywords: ["sexy", "provocative", "controversial", "bold", "daring", "scandalous", "erotica"] },
  { id: "discovery", label: "Discovery", color: "#2DD4BF", keywords: ["first time", "just found", "discovered", "never heard", "wow", "omg"] },
  { id: "humour", label: "Humour", color: "#FB923C", keywords: ["lol", "lmao", "haha", "funny", "hilarious", "slay", "ate", "serve", "camp"] },
  { id: "cultural", label: "Cultural", color: "#60A5FA", keywords: ["era", "generation", "culture", "fashion", "style", "trend", "relevant"] },
  { id: "criticism", label: "Criticism", color: "#6B7280", keywords: ["overrated", "hate", "bad", "worst", "surgery", "cringe", "fake"] },
];

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytGet(path, apiKey) {
  try {
    const url = `${YT_BASE}${path}&key=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error(`[yt] ${r.status} for ${path.split("?")[0]}: ${errBody.slice(0, 200)}`);
      return null;
    }
    return r.json();
  } catch (err) { console.error(`[yt] ${err.message}`); return null; }
}

function classifyComment(text, themes) {
  const lower = (text || "").toLowerCase();
  for (const theme of themes) {
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) return theme.id;
    }
  }
  return "general";
}

function loadThemePrompt() {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), "youtube-themes-prompt.md"), "utf-8");
    const parts = content.split("---");
    return parts.length > 2 ? parts.slice(2).join("---").trim() : content.trim();
  } catch {
    return "Analyse YouTube comments about Madonna. Identify 8-12 conversational themes. Return JSON array of {id, label, color, keywords}.";
  }
}

async function analyseThemes(comments, anthropicKey) {
  if (!anthropicKey || comments.length === 0) return null;
  try {
    const sample = comments.slice(0, 200).map((c, i) => `${i + 1}. ${c.text?.slice(0, 150)}`).join("\n");
    const systemPrompt = loadThemePrompt();

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: `Here are ${comments.length} new YouTube comments about Madonna. Identify the dominant themes:\n\n${sample}` }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].keywords) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error("[yt-themes] AI error:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh, retheme } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return res.status(200).json({ error: "Add YOUTUBE_API_KEY to Vercel env vars" });

  // Serve cache
  if (!refresh && !retheme) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.videos) return res.status(200).json(cached);
    } catch {}
  }

  // Load current themes from Blob or use defaults
  let themes = DEFAULT_THEMES;
  try {
    const stored = await Promise.race([kvGet(THEMES_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
    if (stored && Array.isArray(stored) && stored.length > 0) themes = stored;
  } catch {}

  // ── Retheme only (no new search) ──
  if (retheme && !refresh) {
    let existingComments = [];
    try { existingComments = await Promise.race([kvGet(COMMENTS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}

    if (existingComments.length > 0) {
      const newThemes = await analyseThemes(existingComments, anthropicKey);
      if (newThemes) {
        themes = newThemes;
        await Promise.race([kvSet(THEMES_KEY, themes), new Promise((_, r) => setTimeout(() => r(), 5000))]).catch(() => {});
        // Reclassify all comments
        existingComments = existingComments.map((c) => ({ ...c, theme: classifyComment(c.text, themes) }));
        await Promise.race([kvSet(COMMENTS_KEY, existingComments), new Promise((_, r) => setTimeout(() => r(), 5000))]).catch(() => {});
      }
    }

    // Rebuild cache with new themes
    const themeCounts = {};
    themes.forEach((t) => { themeCounts[t.id] = 0; });
    themeCounts.general = 0;
    existingComments.forEach((c) => { themeCounts[c.theme || "general"] = (themeCounts[c.theme || "general"] || 0) + 1; });

    let existingVideos = [];
    try { existingVideos = await Promise.race([kvGet(VIDEOS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}

    const result = {
      fetchedAt: new Date().toISOString(),
      rethemedAt: new Date().toISOString(),
      videosFound: 0, newVideos: 0, viralVideos: 0,
      newComments: 0, totalComments: existingComments.length, totalVideos: existingVideos.length,
      viralThreshold: VIRAL_THRESHOLD,
      themes: themes.map((t) => ({ ...t, newCount: 0, totalCount: themeCounts[t.id] || 0 })),
      videos: existingVideos.slice(0, 50),
      commentsByTheme: themes.reduce((acc, t) => {
        acc[t.id] = existingComments.filter((c) => c.theme === t.id).slice(0, 15);
        return acc;
      }, { general: existingComments.filter((c) => c.theme === "general").slice(0, 15) }),
      latestComments: existingComments,
      viralHighlights: existingVideos.filter((v) => v.isViral).slice(0, 10),
      stats: { totalViews: 0, totalLikes: 0, avgViews: 0 },
    };
    await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]).catch(() => {});
    result.history = [];
    try { result.history = await Promise.race([kvListGet("youtube_rag_history", 0, 29), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}
    return res.status(200).json(result);
  }

  // ── Full search + comment pull ──

  // Step 1a: Search by keywords (800 units)
  const searchResults = [];
  for (const q of SEARCH_QUERIES) {
    const data = await ytGet(
      `/search?part=snippet&q=${encodeURIComponent(q)}&type=video&order=date&maxResults=25&publishedAfter=${new Date(Date.now() - 14 * 86400000).toISOString().split(".")[0]}Z`,
      apiKey
    );
    if (data?.items) searchResults.push(...data.items);
  }

  // Step 1b: Get Madonna's channel uploads directly (100 units)
  const channelVideos = await ytGet(
    `/search?part=snippet&channelId=${MADONNA_CHANNEL_ID}&type=video&order=date&maxResults=25`,
    apiKey
  );
  if (channelVideos?.items) searchResults.push(...channelVideos.items);

  const seenIds = new Set();
  const unique = searchResults.filter((v) => {
    if (!v.id?.videoId || seenIds.has(v.id.videoId)) return false;
    seenIds.add(v.id.videoId);
    return true;
  });

  // Step 2: Stats — batch in chunks of 50 (YouTube API limit)
  const allVideoIds = unique.map((v) => v.id.videoId);
  const statsItems = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const chunk = allVideoIds.slice(i, i + 50).join(",");
    const batch = await ytGet(`/videos?part=statistics,snippet&id=${chunk}`, apiKey);
    if (batch?.items) statsItems.push(...batch.items);
  }

  const videos = statsItems.map((v) => ({
    id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    description: (v.snippet.description || "").slice(0, 300),
    thumbnail: v.snippet.thumbnails?.medium?.url || "",
    viewCount: parseInt(v.statistics.viewCount || "0", 10),
    likeCount: parseInt(v.statistics.likeCount || "0", 10),
    commentCount: parseInt(v.statistics.commentCount || "0", 10),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    isViral: parseInt(v.statistics.viewCount || "0", 10) >= VIRAL_THRESHOLD,
  }));

  const madonnaVideos = videos.filter((v) => {
    const t = `${v.title} ${v.description} ${v.channel}`.toLowerCase();
    return t.includes("madonna") || t.includes("coadf") || t.includes("confessions on a dance floor") ||
      t.includes("confessions ii") || t.includes("material girl") || t.includes("hung up") ||
      t.includes("like a prayer") || v.channel === "Madonna";
  }).sort((a, b) => b.viewCount - a.viewCount);

  // Step 3: Pull comments at depth
  const targets = madonnaVideos.filter((v) => v.commentCount > 0).slice(0, 15);
  const allNew = [];

  for (const video of targets) {
    const max = video.isViral ? COMMENTS_VIRAL : COMMENTS_NORMAL;
    let pageToken = "";
    let fetched = 0;

    while (fetched < max) {
      const data = await ytGet(
        `/commentThreads?part=snippet&videoId=${video.id}&maxResults=100&order=relevance${pageToken ? `&pageToken=${pageToken}` : ""}`,
        apiKey
      );
      if (!data?.items) break;

      for (const item of data.items) {
        const s = item.snippet.topLevelComment.snippet;
        allNew.push({
          videoId: video.id, videoTitle: video.title, videoViews: video.viewCount,
          author: s.authorDisplayName, text: s.textDisplay,
          likeCount: s.likeCount || 0, publishedAt: s.publishedAt,
          isViral: video.isViral,
          theme: classifyComment(s.textDisplay, themes),
        });
        fetched++;
        if (fetched >= max) break;
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }

  // Step 4: AI theme analysis on new comments
  if (allNew.length > 50) {
    const newThemes = await analyseThemes(allNew, anthropicKey);
    if (newThemes) {
      themes = newThemes;
      await Promise.race([kvSet(THEMES_KEY, themes), new Promise((_, r) => setTimeout(() => r(), 5000))]).catch(() => {});
      // Reclassify with new themes
      allNew.forEach((c) => { c.theme = classifyComment(c.text, themes); });
    }
  }

  // Step 5: Theme counts for new comments
  const newThemeCounts = {};
  themes.forEach((t) => { newThemeCounts[t.id] = 0; });
  newThemeCounts.general = 0;
  allNew.forEach((c) => { newThemeCounts[c.theme || "general"] = (newThemeCounts[c.theme || "general"] || 0) + 1; });

  // Step 6: Merge
  let existing = [];
  try { existing = await Promise.race([kvGet(COMMENTS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}

  const existingSet = new Set(existing.map((c) => `${c.videoId}:${(c.text || "").slice(0, 50)}`));
  const genuinelyNew = allNew.filter((c) => !existingSet.has(`${c.videoId}:${(c.text || "").slice(0, 50)}`));
  const merged = [...genuinelyNew, ...existing].slice(0, MAX_STORED_COMMENTS);

  // Reclassify all stored with current themes
  merged.forEach((c) => { if (!c.theme || c.theme === "general") c.theme = classifyComment(c.text, themes); });

  const totalThemeCounts = {};
  themes.forEach((t) => { totalThemeCounts[t.id] = 0; });
  totalThemeCounts.general = 0;
  merged.forEach((c) => { totalThemeCounts[c.theme || "general"] = (totalThemeCounts[c.theme || "general"] || 0) + 1; });

  let existingVideos = [];
  try { existingVideos = await Promise.race([kvGet(VIDEOS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}
  const existingVIds = new Set(existingVideos.map((v) => v.id));
  const newVids = madonnaVideos.filter((v) => !existingVIds.has(v.id));
  const mergedVideos = [...newVids, ...existingVideos].slice(0, 200);

  const result = {
    fetchedAt: new Date().toISOString(),
    videosFound: madonnaVideos.length, newVideos: newVids.length,
    viralVideos: madonnaVideos.filter((v) => v.isViral).length,
    newComments: genuinelyNew.length, totalComments: merged.length,
    totalVideos: mergedVideos.length, viralThreshold: VIRAL_THRESHOLD,
    themes: themes.map((t) => ({ ...t, newCount: newThemeCounts[t.id] || 0, totalCount: totalThemeCounts[t.id] || 0 })),
    videos: mergedVideos.slice(0, 50),
    commentsByTheme: themes.reduce((acc, t) => {
      acc[t.id] = genuinelyNew.filter((c) => c.theme === t.id).slice(0, 15);
      return acc;
    }, { general: genuinelyNew.filter((c) => c.theme === "general").slice(0, 15) }),
    latestComments: merged,
    viralHighlights: madonnaVideos.filter((v) => v.isViral).slice(0, 10),
    stats: {
      totalViews: madonnaVideos.reduce((s, v) => s + v.viewCount, 0),
      totalLikes: madonnaVideos.reduce((s, v) => s + v.likeCount, 0),
      avgViews: madonnaVideos.length > 0 ? Math.round(madonnaVideos.reduce((s, v) => s + v.viewCount, 0) / madonnaVideos.length) : 0,
    },
  };

  // Persist
  try {
    await Promise.race([
      Promise.all([kvSet(CACHE_KEY, result, CACHE_TTL), kvSet(COMMENTS_KEY, merged), kvSet(VIDEOS_KEY, mergedVideos)]),
      new Promise((_, r) => setTimeout(() => r(), 8000)),
    ]);
  } catch {}

  try {
    await Promise.race([
      kvListPush("youtube_rag_history", {
        date: result.fetchedAt, videosFound: result.videosFound, newVideos: result.newVideos,
        viralVideos: result.viralVideos, newComments: result.newComments, totalComments: result.totalComments,
        themeCounts: newThemeCounts,
      }, 365),
      new Promise((_, r) => setTimeout(() => r(), 5000)),
    ]);
  } catch {}

  result.history = [];
  try { result.history = await Promise.race([kvListGet("youtube_rag_history", 0, 29), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}

  res.status(200).json(result);
}
