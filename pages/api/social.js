// Social listening — real Madonna mention counts across platforms
//
// Core approach: search "madonna" on each platform, count results returned.
// Each result = 1 verified mention. Extract engagement from descriptions.
// Track Madonna's own accounts separately.
// All platform queries use freshness=pd (past day) for daily accuracy.
//
// BUDGET: 6,000 queries/month — using ~40/day = 1,200/month

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "social:pulse";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 86400;

// ── Platform mention queries ──
// Multiple queries per platform catch different content types
const PLATFORMS = [
  { id: "reddit", label: "Reddit", icon: "R", queries: [
    { q: '"madonna" site:reddit.com', freshness: "pw" },
    { q: 'madonna site:reddit.com/r/popheads OR site:reddit.com/r/music OR site:reddit.com/r/Madonna', freshness: "pw" },
    { q: 'madonna album OR tour OR concert site:reddit.com', freshness: "pw" },
  ]},
  { id: "twitter", label: "Twitter / X", icon: "X", queries: [
    { q: '"madonna" site:twitter.com OR site:x.com', freshness: "pw" },
    { q: 'madonna trending OR viral site:twitter.com OR site:x.com', freshness: "pw" },
    { q: 'madonna tour OR album OR concert site:twitter.com OR site:x.com', freshness: "pw" },
  ]},
  { id: "tiktok", label: "TikTok", icon: "T", queries: [
    { q: '"madonna" site:tiktok.com', freshness: "pw" },
    { q: 'madonna trend OR dance OR sound site:tiktok.com', freshness: "pw" },
  ]},
  { id: "youtube", label: "YouTube", icon: "Y", queries: [
    { q: '"madonna" site:youtube.com', freshness: "pw" },
    { q: 'madonna reaction OR performance OR interview site:youtube.com', freshness: "pw" },
    { q: 'madonna music video OR concert OR documentary site:youtube.com', freshness: "pw" },
  ]},
  { id: "web", label: "News / Web", icon: "W", queries: [
    { q: '"madonna" news OR interview OR feature', freshness: "pw" },
    { q: 'madonna 2026 profile OR cover OR exclusive', freshness: "pw" },
  ]},
];

// ── Madonna's own accounts ──
const OWN_ACCOUNT_QUERIES = [
  { platform: "twitter", label: "Twitter / X", q: 'from:madonna OR "x.com/madonna/status" OR "twitter.com/madonna/status"' },
  { platform: "tiktok", label: "TikTok", q: 'site:tiktok.com/@madonna' },
  { platform: "youtube", label: "YouTube", q: 'site:youtube.com/@madonna OR "youtube.com/watch" madonna official channel' },
];

// ── Hashtag tracking ──
const TREND_QUERIES = [
  { q: '#Madonna OR #MadonnaQueen OR #MaterialGirl OR #QueenOfPop', freshness: "pw" },
  { q: '#CelebrationTour OR #MadonnaTour OR #ConfessionsII OR #MadonnaNetflix', freshness: "pw" },
  { q: 'madonna "cultural impact" OR legacy OR influence OR trending', freshness: "pw" },
];

const ALL_HASHTAGS = [
  "#Madonna", "#MadonnaQueen", "#MaterialGirl", "#QueenOfPop",
  "#CelebrationTour", "#MadonnaTour", "#MadonnaLive",
  "#ConfessionsII", "#MadonnaNetflix", "#MadonnaNewAlbum",
  "#LikeAPrayer", "#HungUp", "#RayOfLight", "#MadonnaForever",
];

// ── Engagement parsing ──
function parseEngagement(text) {
  const t = (text || "").toLowerCase();
  let comments = 0, score = 0, views = 0;
  const cm = t.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:comments?|replies|responses|answers)/i);
  if (cm) comments = parseNum(cm[1]);
  const pm = t.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:points?|upvotes?|score|likes?|hearts?)/i);
  if (pm) score = parseNum(pm[1]);
  const vm = t.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:views?|plays?|watches|streams?)/i);
  if (vm) views = parseNum(vm[1]);
  return { comments, score, views };
}

function parseNum(str) {
  if (!str) return 0;
  const c = str.replace(/[,\s]/g, "").toLowerCase();
  const n = parseFloat(c);
  if (isNaN(n)) return 0;
  if (c.endsWith("b")) return Math.round(n * 1e9);
  if (c.endsWith("m")) return Math.round(n * 1e6);
  if (c.endsWith("k")) return Math.round(n * 1e3);
  return Math.round(n);
}

// ── Brave Search — returns count of results + parsed items ──
async function braveSearch(query, apiKey, count = 20, freshness = "pd") {
  if (!apiKey) return { items: [], total: 0 };
  try {
    const params = new URLSearchParams({ q: query, count: String(count), freshness });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json();

    // total_count from Brave = estimated total matches (not just returned)
    const estimatedTotal = data.web?.total_count || 0;

    const items = (data.web?.results || []).map((r) => {
      const eng = parseEngagement(`${r.title} ${r.description}`);
      return {
        title: r.title || "", url: r.url || "",
        description: (r.description || "").slice(0, 300),
        date: r.page_age || "",
        source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
        comments: eng.comments, score: eng.score, views: eng.views,
      };
    });

    // Discussions with real comment/score data
    const discussions = (data.discussions?.results || []).map((r) => ({
      title: r.title || "", url: r.url || "",
      description: (r.description || "").slice(0, 300),
      date: r.data?.question_posted_at || r.page_age || "",
      source: r.data?.forum_name || "",
      comments: r.data?.num_answers || 0,
      score: r.data?.score || 0, views: 0,
    }));

    return { items: [...items, ...discussions], total: estimatedTotal, returned: items.length + discussions.length };
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    // Only serve cache if it has real data (not a stale 0-mention run)
    if (cached && cached.metrics?.mentionsFound > 0) {
      const history = await kvListGet("social:history", 0, 364);
      cached.history = history;
      cached.metrics.cumulativeMentions = (history || []).reduce((sum, s) => sum + (s.mentionsFound || 0), 0);
      cached.metrics.cumulativeEngagement = (history || []).reduce((sum, s) => sum + (s.totalEngagement || 0), 0);
      return res.status(200).json(cached);
    }
    // Stale/empty cache — fall through to re-fetch
  }

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], metrics: {} });
  }

  // ── Fire ALL queries in parallel for speed ──
  const allQueries = [];

  // Platform queries
  PLATFORMS.forEach((p) => {
    p.queries.forEach((q) => {
      allQueries.push({ type: "platform", platformId: p.id, ...q });
    });
  });

  // Own account queries
  OWN_ACCOUNT_QUERIES.forEach((q) => {
    allQueries.push({ type: "own", ...q });
  });

  // Trend queries
  TREND_QUERIES.forEach((q) => {
    allQueries.push({ type: "trend", ...q });
  });

  // Fire everything at once
  const results = await Promise.all(
    allQueries.map((q) => braveSearch(q.q, apiKey, 20, q.freshness || "pd"))
  );

  // ── Reassemble by type ──
  let idx = 0;

  // Platform results
  const platformResults = PLATFORMS.map((p) => {
    const seen = new Set();
    let allItems = [];
    let totalEstimated = 0;
    for (const q of p.queries) {
      const r = results[idx++];
      totalEstimated += r.total;
      r.items.forEach((item) => {
        if (!item.url || seen.has(item.url)) return;
        seen.add(item.url);
        allItems.push({ ...item, platform: p.id });
      });
    }
    return {
      id: p.id, label: p.label, icon: p.icon,
      items: allItems,
      mentionsFound: allItems.length,
      estimatedTotal: totalEstimated,
      totalComments: allItems.reduce((s, i) => s + i.comments, 0),
      totalScore: allItems.reduce((s, i) => s + i.score, 0),
      totalViews: allItems.reduce((s, i) => s + i.views, 0),
    };
  });

  // Own account results
  const ownResults = OWN_ACCOUNT_QUERIES.map((q) => {
    const r = results[idx++];
    return {
      platform: q.platform, label: q.label,
      posts: r.items.length,
      totalComments: r.items.reduce((s, i) => s + i.comments, 0),
      totalScore: r.items.reduce((s, i) => s + i.score, 0),
      totalViews: r.items.reduce((s, i) => s + i.views, 0),
      items: r.items.slice(0, 5),
    };
  });

  const ownEngagement = {
    posts: ownResults.reduce((s, r) => s + r.posts, 0),
    comments: ownResults.reduce((s, r) => s + r.totalComments, 0),
    score: ownResults.reduce((s, r) => s + r.totalScore, 0),
    views: ownResults.reduce((s, r) => s + r.totalViews, 0),
    platforms: ownResults,
  };

  // Trend results
  const trendItems = [];
  const trendSeen = new Set();
  TREND_QUERIES.forEach(() => {
    const r = results[idx++];
    r.items.forEach((item) => {
      if (!item.url || trendSeen.has(item.url)) return;
      trendSeen.add(item.url);
      trendItems.push(item);
    });
  });

  // Hashtag counts
  const hashtagMentions = {};
  ALL_HASHTAGS.forEach((tag) => {
    const tagLower = tag.toLowerCase().replace("#", "");
    hashtagMentions[tag] = trendItems.filter((item) =>
      `${item.title} ${item.description} ${item.url}`.toLowerCase().includes(tagLower)
    ).length;
  });

  // ── Aggregate ──
  const allItems = [...platformResults.flatMap((r) => r.items), ...trendItems];
  const mentionsFound = platformResults.reduce((s, p) => s + p.mentionsFound, 0);
  const totalComments = allItems.reduce((s, i) => s + (i.comments || 0), 0);
  const totalScore = allItems.reduce((s, i) => s + (i.score || 0), 0);
  const totalViews = allItems.reduce((s, i) => s + (i.views || 0), 0);
  const totalEngagement = totalComments + totalScore + totalViews;

  // ── AI Sentiment ──
  let pos = 0, neg = 0, neu = 0;
  let sentimentMethod = "keyword";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey && allItems.length > 0) {
    try {
      const batch = allItems.slice(0, 80).map((item, i) =>
        `${i + 1}. [${item.platform || item.source}] ${item.title}${item.description ? " — " + item.description.slice(0, 120) : ""}`
      ).join("\n");

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 250,
          system: 'Analyse Madonna social mentions. Classify each as positive/negative/neutral. Return ONLY: {"positive":N,"negative":N,"neutral":N,"summary":"one sentence"}',
          messages: [{ role: "user", content: `${allItems.length} mentions:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (aiRes.ok) {
        const t = (await aiRes.json()).content?.[0]?.text || "";
        const m = t.match(/\{[\s\S]*\}/);
        if (m) {
          const p2 = JSON.parse(m[0]);
          const scale = allItems.length / Math.min(allItems.length, 80);
          pos = Math.round((p2.positive || 0) * scale);
          neg = Math.round((p2.negative || 0) * scale);
          neu = Math.round((p2.neutral || 0) * scale);
          sentimentMethod = p2.summary ? `claude-ai: ${p2.summary}` : "claude-ai";
        }
      }
    } catch { /* fallback */ }
  }

  if (pos === 0 && neg === 0 && neu === 0) {
    const pw = ["love", "amazing", "queen", "icon", "legend", "slay", "masterpiece", "brilliant", "stunning", "perfect", "iconic"];
    const nw = ["hate", "worst", "overrated", "cringe", "flop", "awful", "terrible", "cancelled"];
    allItems.forEach((item) => {
      const t = `${item.title} ${item.description}`.toLowerCase();
      if (pw.some((w) => t.includes(w)) && !nw.some((w) => t.includes(w))) pos++;
      else if (nw.some((w) => t.includes(w))) neg++;
      else neu++;
    });
  }
  const sentTotal = Math.max(pos + neg + neu, 1);

  // ── History ──
  const existingHistory = await kvListGet("social:history", 0, 364);
  const cumulativeMentions = (existingHistory || []).reduce((sum, s) => sum + (s.mentionsFound || 0), 0) + mentionsFound;
  const cumulativeEngagement = (existingHistory || []).reduce((sum, s) => sum + (s.totalEngagement || 0), 0) + totalEngagement;

  const result = {
    hasBraveKey: true,
    fetchedAt: new Date().toISOString(),
    platforms: platformResults,
    ownAccounts: ownEngagement,
    metrics: {
      mentionsFound,
      cumulativeMentions,
      totalComments, totalScore, totalViews, totalEngagement, cumulativeEngagement,
      platformBreakdown: Object.fromEntries(platformResults.map((p) => [p.id, p.mentionsFound])),
      hashtags: hashtagMentions,
      hashtagArticles: trendItems.slice(0, 20),
      queriesUsed: allQueries.length,
    },
    sentiment: {
      positive: Math.round((pos / sentTotal) * 100),
      negative: Math.round((neg / sentTotal) * 100),
      neutral: Math.round((neu / sentTotal) * 100),
      total: mentionsFound, positiveCount: pos, negativeCount: neg, neutralCount: neu,
      method: sentimentMethod,
    },
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  if (refresh) {
    await kvListPush("social:history", {
      date: result.fetchedAt, mentionsFound, totalEngagement, totalComments, totalScore, totalViews,
      ownPosts: ownEngagement.posts,
      sentiment: result.sentiment, platformBreakdown: result.metrics.platformBreakdown,
    }, 365);
  }

  result.history = await kvListGet("social:history", 0, 364);
  res.status(200).json(result);
}
