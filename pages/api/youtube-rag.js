// YouTube Graph RAG — Viral Detection + Comment Pulling
//
// Searches for new Madonna/COADF2 videos, checks view counts,
// pulls comments from videos above threshold. Stores everything
// in Blob for the Graph RAG tab.
//
// YouTube Data API v3 quota: 10,000 units/day
// Budget per run:
//   Search: 4 queries × 100 units = 400
//   Video details: ~20 videos × 1 unit = 20
//   CommentThreads: ~10 videos × 5 pages × 1 unit = 50
//   Total: ~470 units per run = safe for 20+ runs/day

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "youtube_rag_cache";
const VIDEOS_KEY = "youtube_rag_videos";
const COMMENTS_KEY = "youtube_rag_comments";
const CACHE_TTL = 86400;
const VIRAL_THRESHOLD = 100000; // 100K views = viral

// Search terms
const SEARCH_QUERIES = [
  "Madonna",
  "Madonna COADF2",
  "Madonna Confessions on a Dance Floor 2",
  'Madonna "Confessions II"',
];

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytGet(path, apiKey) {
  try {
    const url = `${YT_BASE}${path}&key=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (r.status === 403) {
      console.error("[youtube] 403 — quota exceeded or API not enabled");
      return null;
    }
    if (!r.ok) {
      console.error(`[youtube] ${r.status} for ${path.split("?")[0]}`);
      return null;
    }
    return r.json();
  } catch (err) {
    console.error(`[youtube] error:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ error: "Add YOUTUBE_API_KEY to Vercel env vars" });
  }

  // Serve cache
  if (!refresh) {
    try {
      const cached = await Promise.race([
        kvGet(CACHE_KEY),
        new Promise((_, r) => setTimeout(() => r("timeout"), 3000)),
      ]);
      if (cached && cached.videos) {
        return res.status(200).json(cached);
      }
    } catch {}
  }

  // ── Step 1: Search for recent Madonna videos (4 searches = 400 units) ──
  const searchResults = [];
  for (const q of SEARCH_QUERIES) {
    const data = await ytGet(
      `/search?part=snippet&q=${encodeURIComponent(q)}&type=video&order=date&maxResults=10&publishedAfter=${new Date(Date.now() - 7 * 86400000).toISOString()}`,
      apiKey
    );
    if (data?.items) {
      searchResults.push(...data.items);
    }
  }

  // Dedup by video ID
  const seenIds = new Set();
  const uniqueVideos = searchResults.filter((v) => {
    if (seenIds.has(v.id.videoId)) return false;
    seenIds.add(v.id.videoId);
    return true;
  });

  // ── Step 2: Get view counts for all found videos (1 unit per 50 videos) ──
  const videoIds = uniqueVideos.map((v) => v.id.videoId).join(",");
  const statsData = videoIds ? await ytGet(
    `/videos?part=statistics,snippet&id=${videoIds}`,
    apiKey
  ) : null;

  const videosWithStats = (statsData?.items || []).map((v) => ({
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    description: (v.snippet.description || "").slice(0, 300),
    thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
    viewCount: parseInt(v.statistics.viewCount || "0", 10),
    likeCount: parseInt(v.statistics.likeCount || "0", 10),
    commentCount: parseInt(v.statistics.commentCount || "0", 10),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    isViral: parseInt(v.statistics.viewCount || "0", 10) >= VIRAL_THRESHOLD,
  }));

  // Filter to Madonna-relevant only
  const madonnaVideos = videosWithStats.filter((v) => {
    const text = `${v.title} ${v.description} ${v.channel}`.toLowerCase();
    return text.includes("madonna") || text.includes("coadf") ||
      text.includes("confessions on a dance floor") || text.includes("confessions ii");
  });

  // Sort: viral first, then by view count
  madonnaVideos.sort((a, b) => {
    if (a.isViral !== b.isViral) return b.isViral - a.isViral;
    return b.viewCount - a.viewCount;
  });

  // ── Step 3: Pull comments from viral/high-view videos (1 unit per page) ──
  // Pull from top 5 videos by views, up to 100 comments each
  const videosForComments = madonnaVideos
    .filter((v) => v.commentCount > 0)
    .slice(0, 5);

  const allNewComments = [];

  for (const video of videosForComments) {
    let pageToken = "";
    let commentsFetched = 0;
    const maxComments = video.isViral ? 100 : 50;

    while (commentsFetched < maxComments) {
      const commentsData = await ytGet(
        `/commentThreads?part=snippet&videoId=${video.id}&maxResults=50&order=relevance${pageToken ? `&pageToken=${pageToken}` : ""}`,
        apiKey
      );

      if (!commentsData?.items) break;

      for (const item of commentsData.items) {
        const snippet = item.snippet.topLevelComment.snippet;
        allNewComments.push({
          videoId: video.id,
          videoTitle: video.title,
          videoViews: video.viewCount,
          author: snippet.authorDisplayName,
          text: snippet.textDisplay,
          likeCount: snippet.likeCount || 0,
          publishedAt: snippet.publishedAt,
          isViral: video.isViral,
        });
        commentsFetched++;
      }

      pageToken = commentsData.nextPageToken;
      if (!pageToken) break;
    }
  }

  // ── Step 4: Merge with existing stored comments ──
  let existingComments = [];
  try {
    existingComments = await Promise.race([
      kvGet(COMMENTS_KEY),
      new Promise((_, r) => setTimeout(() => r("timeout"), 3000)),
    ]) || [];
  } catch {}

  // Dedup by comment text + video ID
  const existingSet = new Set(existingComments.map((c) => `${c.videoId}:${c.text?.slice(0, 50)}`));
  const genuinelyNew = allNewComments.filter((c) => !existingSet.has(`${c.videoId}:${c.text?.slice(0, 50)}`));

  // Add new to front, cap at 5000 total
  const mergedComments = [...genuinelyNew, ...existingComments].slice(0, 5000);

  // ── Step 5: Merge with existing video list ──
  let existingVideos = [];
  try {
    existingVideos = await Promise.race([
      kvGet(VIDEOS_KEY),
      new Promise((_, r) => setTimeout(() => r("timeout"), 3000)),
    ]) || [];
  } catch {}

  const existingVideoIds = new Set(existingVideos.map((v) => v.id));
  const newVideos = madonnaVideos.filter((v) => !existingVideoIds.has(v.id));
  const mergedVideos = [...newVideos, ...existingVideos].slice(0, 200);

  // ── Step 6: Build result ──
  const result = {
    fetchedAt: new Date().toISOString(),
    searchQueries: SEARCH_QUERIES.length,
    videosFound: madonnaVideos.length,
    newVideos: newVideos.length,
    viralVideos: madonnaVideos.filter((v) => v.isViral).length,
    newComments: genuinelyNew.length,
    totalComments: mergedComments.length,
    totalVideos: mergedVideos.length,
    viralThreshold: VIRAL_THRESHOLD,
    // Videos sorted: viral first, then newest
    videos: mergedVideos.slice(0, 50),
    // Latest comments
    latestComments: genuinelyNew.slice(0, 30),
    // Viral highlights
    viralHighlights: madonnaVideos.filter((v) => v.isViral).slice(0, 10),
    // Stats
    stats: {
      totalViews: madonnaVideos.reduce((s, v) => s + v.viewCount, 0),
      totalLikes: madonnaVideos.reduce((s, v) => s + v.likeCount, 0),
      avgViews: madonnaVideos.length > 0 ? Math.round(madonnaVideos.reduce((s, v) => s + v.viewCount, 0) / madonnaVideos.length) : 0,
    },
  };

  // Persist (with timeout)
  try {
    await Promise.race([
      Promise.all([
        kvSet(CACHE_KEY, result, CACHE_TTL),
        kvSet(COMMENTS_KEY, mergedComments),
        kvSet(VIDEOS_KEY, mergedVideos),
      ]),
      new Promise((_, r) => setTimeout(() => r("timeout"), 8000)),
    ]);
  } catch { console.error("[youtube-rag] Blob persist failed"); }

  // Store history snapshot
  try {
    await Promise.race([
      kvListPush("youtube_rag_history", {
        date: result.fetchedAt,
        videosFound: result.videosFound,
        newVideos: result.newVideos,
        viralVideos: result.viralVideos,
        newComments: result.newComments,
        totalComments: result.totalComments,
      }, 365),
      new Promise((_, r) => setTimeout(() => r("timeout"), 5000)),
    ]);
  } catch {}

  result.history = [];
  try { result.history = await Promise.race([kvListGet("youtube_rag_history", 0, 29), new Promise((_, r) => setTimeout(() => r("timeout"), 3000))]); } catch {}

  res.status(200).json(result);
}
