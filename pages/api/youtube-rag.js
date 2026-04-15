// YouTube Graph RAG — Viral Detection + Deep Comment Pulling
//
// Searches for new Madonna/COADF2 videos, pulls comments at depth:
//   Viral (100K+ views): 1000 comments
//   Non-viral: 500 comments
// All comments are thematically classified to match the catalogue Graph RAG.
//
// YouTube Data API v3 quota: 10,000 units/day
// Budget per run:
//   Search: 4 × 100 = 400 units
//   Video details: ~30 × 1 = 30 units
//   CommentThreads: ~5000 comments ÷ 100 per page = 50 pages × 1 = 50 units
//   Total: ~480 units per run (safe for 20 runs/day)

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "youtube_rag_cache";
const VIDEOS_KEY = "youtube_rag_videos";
const COMMENTS_KEY = "youtube_rag_comments";
const CACHE_TTL = 86400;
const VIRAL_THRESHOLD = 100000;
const COMMENTS_VIRAL = 1000;
const COMMENTS_NORMAL = 500;

const SEARCH_QUERIES = [
  "Madonna",
  "Madonna COADF2",
  "Madonna Confessions on a Dance Floor 2",
  'Madonna "Confessions II"',
];

// Theme classification — matches the catalogue Graph RAG themes exactly
const THEMES = [
  { id: "nostalgia", label: "Nostalgia", color: "#F59E0B", keywords: ["remember", "nostalgia", "childhood", "grew up", "memories", "miss", "classic", "timeless", "old", "back in the day", "years ago"] },
  { id: "musical", label: "Musical", color: "#34D399", keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "sing", "vocal", "masterpiece", "genius"] },
  { id: "icon", label: "Icon", color: "#FFD500", keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence", "impact"] },
  { id: "emotional", label: "Emotional", color: "#F472B6", keywords: ["love", "heart", "cry", "feel", "soul", "beautiful", "amazing", "perfect", "tears", "moved", "emotion"] },
  { id: "empowerment", label: "Empowerment", color: "#A78BFA", keywords: ["feminist", "feminism", "empowered", "strong woman", "powerful woman", "independent", "boss", "trailblazer", "barrier", "broke the mold"] },
  { id: "sexuality", label: "Sexuality", color: "#EF4444", keywords: ["sexy", "sex", "provocative", "controversial", "bold", "daring", "scandalous", "shock", "erotica", "book", "naked"] },
  { id: "discovery", label: "Discovery", color: "#2DD4BF", keywords: ["first time", "just found", "discovered", "never heard", "didn't know", "wow", "omg", "wait"] },
  { id: "humour", label: "Humour", color: "#FB923C", keywords: ["lol", "lmao", "haha", "funny", "hilarious", "dead", "joke", "slay", "ate", "serve", "camp", "iconic moment"] },
  { id: "cultural", label: "Cultural", color: "#60A5FA", keywords: ["era", "generation", "culture", "society", "fashion", "style", "trend", "relevant", "today"] },
  { id: "criticism", label: "Criticism", color: "#6B7280", keywords: ["overrated", "hate", "bad", "worst", "old", "surgery", "cringe", "fake"] },
];

function classifyComment(text) {
  const lower = (text || "").toLowerCase();
  for (const theme of THEMES) {
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) return theme.id;
    }
  }
  return "general";
}

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytGet(path, apiKey) {
  try {
    const r = await fetch(`${YT_BASE}${path}&key=${apiKey}`, { signal: AbortSignal.timeout(10000) });
    if (r.status === 403) { console.error("[youtube] 403 quota/auth"); return null; }
    if (!r.ok) { console.error(`[youtube] ${r.status}`); return null; }
    return r.json();
  } catch (err) { console.error(`[youtube] ${err.message}`); return null; }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ error: "Add YOUTUBE_API_KEY to Vercel env vars" });
  }

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.videos) return res.status(200).json(cached);
    } catch {}
  }

  // ── Step 1: Search for recent videos (400 units) ──
  const searchResults = [];
  for (const q of SEARCH_QUERIES) {
    const data = await ytGet(
      `/search?part=snippet&q=${encodeURIComponent(q)}&type=video&order=date&maxResults=10&publishedAfter=${new Date(Date.now() - 7 * 86400000).toISOString()}`,
      apiKey
    );
    if (data?.items) searchResults.push(...data.items);
  }

  const seenIds = new Set();
  const uniqueVideos = searchResults.filter((v) => {
    if (!v.id?.videoId || seenIds.has(v.id.videoId)) return false;
    seenIds.add(v.id.videoId);
    return true;
  });

  // ── Step 2: Get stats (~30 units) ──
  const videoIds = uniqueVideos.map((v) => v.id.videoId).join(",");
  const statsData = videoIds ? await ytGet(`/videos?part=statistics,snippet&id=${videoIds}`, apiKey) : null;

  const videosWithStats = (statsData?.items || []).map((v) => ({
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    description: (v.snippet.description || "").slice(0, 300),
    thumbnail: v.snippet.thumbnails?.medium?.url || "",
    viewCount: parseInt(v.statistics.viewCount || "0", 10),
    likeCount: parseInt(v.statistics.likeCount || "0", 10),
    commentCount: parseInt(v.statistics.commentCount || "0", 10),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    isViral: parseInt(v.statistics.viewCount || "0", 10) >= VIRAL_THRESHOLD,
  }));

  // Filter Madonna-relevant
  const madonnaVideos = videosWithStats.filter((v) => {
    const text = `${v.title} ${v.description} ${v.channel}`.toLowerCase();
    return text.includes("madonna") || text.includes("coadf") ||
      text.includes("confessions on a dance floor") || text.includes("confessions ii");
  }).sort((a, b) => b.viewCount - a.viewCount);

  // ── Step 3: Pull comments at depth ──
  const videosForComments = madonnaVideos.filter((v) => v.commentCount > 0).slice(0, 8);
  const allNewComments = [];

  for (const video of videosForComments) {
    const maxComments = video.isViral ? COMMENTS_VIRAL : COMMENTS_NORMAL;
    let pageToken = "";
    let fetched = 0;

    while (fetched < maxComments) {
      const data = await ytGet(
        `/commentThreads?part=snippet&videoId=${video.id}&maxResults=100&order=relevance${pageToken ? `&pageToken=${pageToken}` : ""}`,
        apiKey
      );
      if (!data?.items) break;

      for (const item of data.items) {
        const s = item.snippet.topLevelComment.snippet;
        const theme = classifyComment(s.textDisplay);
        allNewComments.push({
          videoId: video.id,
          videoTitle: video.title,
          videoViews: video.viewCount,
          author: s.authorDisplayName,
          text: s.textDisplay,
          likeCount: s.likeCount || 0,
          publishedAt: s.publishedAt,
          isViral: video.isViral,
          theme,
        });
        fetched++;
        if (fetched >= maxComments) break;
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }

  // ── Step 4: Theme breakdown ──
  const themeCounts = {};
  THEMES.forEach((t) => { themeCounts[t.id] = 0; });
  themeCounts.general = 0;
  allNewComments.forEach((c) => {
    themeCounts[c.theme] = (themeCounts[c.theme] || 0) + 1;
  });

  // ── Step 5: Merge with existing ──
  let existingComments = [];
  try { existingComments = await Promise.race([kvGet(COMMENTS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}

  const existingSet = new Set(existingComments.map((c) => `${c.videoId}:${c.text?.slice(0, 50)}`));
  const genuinelyNew = allNewComments.filter((c) => !existingSet.has(`${c.videoId}:${c.text?.slice(0, 50)}`));
  const mergedComments = [...genuinelyNew, ...existingComments].slice(0, 10000);

  // Total theme counts across ALL stored comments
  const totalThemeCounts = {};
  THEMES.forEach((t) => { totalThemeCounts[t.id] = 0; });
  totalThemeCounts.general = 0;
  mergedComments.forEach((c) => {
    const theme = c.theme || classifyComment(c.text);
    totalThemeCounts[theme] = (totalThemeCounts[theme] || 0) + 1;
  });

  let existingVideos = [];
  try { existingVideos = await Promise.race([kvGet(VIDEOS_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]) || []; } catch {}

  const existingVideoIds = new Set(existingVideos.map((v) => v.id));
  const newVideos = madonnaVideos.filter((v) => !existingVideoIds.has(v.id));
  const mergedVideos = [...newVideos, ...existingVideos].slice(0, 200);

  // ── Step 6: Result ──
  const result = {
    fetchedAt: new Date().toISOString(),
    videosFound: madonnaVideos.length,
    newVideos: newVideos.length,
    viralVideos: madonnaVideos.filter((v) => v.isViral).length,
    newComments: genuinelyNew.length,
    totalComments: mergedComments.length,
    totalVideos: mergedVideos.length,
    viralThreshold: VIRAL_THRESHOLD,
    themes: THEMES.map((t) => ({
      ...t,
      newCount: themeCounts[t.id] || 0,
      totalCount: totalThemeCounts[t.id] || 0,
    })),
    generalNew: themeCounts.general || 0,
    generalTotal: totalThemeCounts.general || 0,
    videos: mergedVideos.slice(0, 50),
    // Group latest comments by theme for display
    commentsByTheme: THEMES.reduce((acc, t) => {
      acc[t.id] = genuinelyNew.filter((c) => c.theme === t.id).slice(0, 10);
      return acc;
    }, { general: genuinelyNew.filter((c) => c.theme === "general").slice(0, 10) }),
    latestComments: genuinelyNew.slice(0, 50),
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
      Promise.all([kvSet(CACHE_KEY, result, CACHE_TTL), kvSet(COMMENTS_KEY, mergedComments), kvSet(VIDEOS_KEY, mergedVideos)]),
      new Promise((_, r) => setTimeout(() => r(), 8000)),
    ]);
  } catch {}

  try {
    await Promise.race([
      kvListPush("youtube_rag_history", {
        date: result.fetchedAt, videosFound: result.videosFound, newVideos: result.newVideos,
        viralVideos: result.viralVideos, newComments: result.newComments, totalComments: result.totalComments,
        themeCounts,
      }, 365),
      new Promise((_, r) => setTimeout(() => r(), 5000)),
    ]);
  } catch {}

  result.history = [];
  try { result.history = await Promise.race([kvListGet("youtube_rag_history", 0, 29), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}

  res.status(200).json(result);
}
