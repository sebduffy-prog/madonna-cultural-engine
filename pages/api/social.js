// Social listening — deep Madonna monitoring
// Three metric layers:
//   1. Madonna's Own Accounts — engagement on her official posts
//   2. Public Mentions — unique pages/posts where "madonna" appears in text
//   3. Total Engagement — real comments, scores, views extracted from results
// All metrics start from midnight UTC and compound daily via history
//
// BUDGET: 6,000 queries/month
// Social: ~30 queries per daily run = 900/month

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "social:pulse";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 86400;

// ── Madonna's own accounts — search for her actual posts ──
const OWN_ACCOUNT_QUERIES = [
  { platform: "instagram", query: 'site:instagram.com/madonna', label: "Instagram" },
  { platform: "twitter", query: 'from:madonna OR site:x.com/madonna OR site:twitter.com/madonna', label: "Twitter / X" },
  { platform: "tiktok", query: 'site:tiktok.com/@madonna', label: "TikTok" },
  { platform: "youtube", query: 'site:youtube.com/@madonna OR site:youtube.com/channel/UC', label: "YouTube" },
];

// ── Public mentions per platform ──
const PLATFORM_QUERIES = [
  { id: "reddit", label: "Reddit", icon: "R", queries: [
    '"Madonna" site:reddit.com',
    'Madonna site:reddit.com/r/popheads OR site:reddit.com/r/pop OR site:reddit.com/r/music OR site:reddit.com/r/Madonna',
    'Madonna album OR tour OR Netflix OR concert reddit',
  ]},
  { id: "twitter", label: "Twitter / X", icon: "X", queries: [
    '"Madonna" site:twitter.com OR site:x.com',
    'Madonna trending OR viral OR fan site:twitter.com OR site:x.com',
    'Madonna concert OR tour OR album twitter',
  ]},
  { id: "tiktok", label: "TikTok", icon: "T", queries: [
    'Madonna site:tiktok.com',
    'Madonna TikTok trend OR dance OR challenge OR sound',
    'Madonna "Hung Up" OR "Material Girl" OR "Vogue" TikTok',
  ]},
  { id: "youtube", label: "YouTube", icon: "Y", queries: [
    'Madonna site:youtube.com',
    'Madonna reaction OR compilation OR performance youtube',
    'Madonna interview OR documentary OR concert youtube 2026',
  ]},
  { id: "instagram", label: "Instagram", icon: "I", queries: [
    'Madonna site:instagram.com -site:instagram.com/madonna',
    'Madonna fashion OR fan instagram',
  ]},
];

// ── Hashtag/trend tracking ──
const TREND_QUERIES = [
  '#Madonna OR #MadonnaQueen OR #MaterialGirl OR #QueenOfPop',
  '#CelebrationTour OR #MadonnaTour OR #MadonnaLive',
  '#ConfessionsII OR #MadonnaNetflix OR #MadonnaNewAlbum',
  'Madonna "cultural impact" OR legacy OR influence OR icon',
];

const ALL_HASHTAGS = [
  "#Madonna", "#MadonnaQueen", "#MaterialGirl", "#QueenOfPop",
  "#CelebrationTour", "#MadonnaTour", "#MadonnaLive", "#MadonnaConcert",
  "#ConfessionsII", "#MadonnaNetflix", "#MadonnaNewAlbum",
  "#LikeAPrayer", "#HungUp", "#RayOfLight", "#MadonnaForever",
];

// ── Engagement extraction ──
function parseEngagement(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const metrics = { comments: 0, score: 0, views: 0 };

  const commentMatch = text.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:comments?|replies|responses|answers)/i);
  if (commentMatch) metrics.comments = parseCount(commentMatch[1]);

  const pointMatch = text.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:points?|upvotes?|score|likes?|hearts?|reactions?)/i);
  if (pointMatch) metrics.score = parseCount(pointMatch[1]);

  const viewMatch = text.match(/(\d[\d,.]*\s*[kmb]?)\s*(?:views?|plays?|watches|streams?)/i);
  if (viewMatch) metrics.views = parseCount(viewMatch[1]);

  return metrics;
}

function parseCount(str) {
  if (!str) return 0;
  const clean = str.replace(/[,\s]/g, "").toLowerCase();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (clean.endsWith("b")) return Math.round(num * 1_000_000_000);
  if (clean.endsWith("m")) return Math.round(num * 1_000_000);
  if (clean.endsWith("k")) return Math.round(num * 1_000);
  return Math.round(num);
}

function parsePublishDate(pageAge) {
  if (!pageAge) return null;
  const d = new Date(pageAge);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Brave Search ──
async function braveSearch(query, apiKey, count = 20, freshness = "pd") {
  if (!apiKey) return { web: [], discussions: [] };
  try {
    const params = new URLSearchParams({ q: query, count: String(count), freshness });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { web: [], discussions: [] };
    const data = await res.json();

    const web = (data.web?.results || []).map((r) => {
      const eng = parseEngagement(r);
      return {
        title: r.title || "",
        url: r.url || "",
        description: (r.description || "").slice(0, 400),
        date: r.page_age || "",
        publishedAt: parsePublishDate(r.page_age),
        source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
        comments: eng.comments,
        score: eng.score,
        views: eng.views,
        // Check if "madonna" actually appears in text
        hasMadonnaInText: /madonna/i.test(`${r.title || ""} ${r.description || ""}`),
      };
    });

    const discussions = (data.discussions?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: (r.description || "").slice(0, 400),
      date: r.data?.question_posted_at || r.page_age || "",
      publishedAt: parsePublishDate(r.data?.question_posted_at || r.page_age),
      source: r.data?.forum_name || (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
      comments: r.data?.num_answers || 0,
      score: r.data?.score || 0,
      views: 0,
      hasMadonnaInText: /madonna/i.test(`${r.title || ""} ${r.description || ""}`),
    }));

    return { web, discussions };
  } catch {
    return { web: [], discussions: [] };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      const history = await kvListGet("social:history", 0, 364);
      cached.history = history;
      cached.metrics.cumulativeMentions = (history || []).reduce((sum, s) => sum + (s.textMentions || s.todayMentions || 0), 0);
      cached.metrics.cumulativeEngagement = (history || []).reduce((sum, s) => sum + (s.totalEngagement || 0), 0);
      return res.status(200).json(cached);
    }
  }

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], metrics: {} });
  }

  // ── Layer 1: Madonna's own accounts (freshness: past day) ──
  const ownAccountResults = await Promise.all(
    OWN_ACCOUNT_QUERIES.map(async (q) => {
      const { web, discussions } = await braveSearch(q.query, apiKey, 20, "pd");
      const all = [...web, ...discussions];
      return {
        platform: q.platform,
        label: q.label,
        posts: all.length,
        totalComments: all.reduce((s, i) => s + i.comments, 0),
        totalScore: all.reduce((s, i) => s + i.score, 0),
        totalViews: all.reduce((s, i) => s + i.views, 0),
        items: all.slice(0, 5),
      };
    })
  );

  const ownEngagement = {
    posts: ownAccountResults.reduce((s, r) => s + r.posts, 0),
    comments: ownAccountResults.reduce((s, r) => s + r.totalComments, 0),
    score: ownAccountResults.reduce((s, r) => s + r.totalScore, 0),
    views: ownAccountResults.reduce((s, r) => s + r.totalViews, 0),
    platforms: ownAccountResults,
  };

  // ── Layer 2: Public mentions per platform (freshness: past day) ──
  const platformPromises = PLATFORM_QUERIES.map(async (p) => {
    const allResults = await Promise.all(
      p.queries.map((q) => braveSearch(q, apiKey, 20, "pd"))
    );
    const seen = new Set();
    const all = allResults
      .flatMap((r) => [...r.discussions, ...r.web])
      .filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    const textMentions = all.filter((i) => i.hasMadonnaInText).length;
    return {
      id: p.id, label: p.label, icon: p.icon,
      items: all.map((item) => ({ ...item, platform: p.id })),
      textMentions,
      totalComments: all.reduce((s, i) => s + i.comments, 0),
      totalScore: all.reduce((s, i) => s + i.score, 0),
      totalViews: all.reduce((s, i) => s + i.views, 0),
    };
  });

  // ── Layer 3: Trend/hashtag queries (past week for broader context) ──
  const trendPromises = TREND_QUERIES.map((q) => braveSearch(q, apiKey, 20, "pw"));

  const [platformResults, trendResults] = await Promise.all([
    Promise.all(platformPromises),
    Promise.all(trendPromises),
  ]);

  // ── Process trend data ──
  const trendItems = trendResults.flatMap((r) => [...r.web, ...r.discussions]);
  const hashtagMentions = {};
  ALL_HASHTAGS.forEach((tag) => {
    const tagLower = tag.toLowerCase().replace("#", "");
    hashtagMentions[tag] = trendItems.filter((item) =>
      `${item.title} ${item.description} ${item.url}`.toLowerCase().includes(tagLower)
    ).length;
  });
  const seenUrls = new Set();
  const uniqueTrendItems = trendItems.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  // ── Aggregate metrics ──
  const allItems = [...platformResults.flatMap((r) => r.items), ...uniqueTrendItems];
  const sourcesTracked = allItems.length;
  const textMentions = allItems.filter((i) => i.hasMadonnaInText).length;
  const totalComments = allItems.reduce((s, i) => s + (i.comments || 0), 0);
  const totalScore = allItems.reduce((s, i) => s + (i.score || 0), 0);
  const totalViews = allItems.reduce((s, i) => s + (i.views || 0), 0);
  const totalEngagement = totalComments + totalScore + totalViews;

  // Timestamps for timeline
  const mentionTimestamps = allItems
    .filter((item) => item.publishedAt)
    .map((item) => ({
      date: item.publishedAt,
      platform: item.platform || "web",
      title: item.title,
      comments: item.comments,
      score: item.score,
      views: item.views,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── AI Sentiment ──
  let pos = 0, neg = 0, neu = 0;
  let sentimentMethod = "keyword-fallback";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey && allItems.length > 0) {
    try {
      const batch = allItems.slice(0, 100).map((item, i) => (
        `${i + 1}. [${item.platform || "web"}] ${item.title}${item.description ? " — " + item.description.slice(0, 150) : ""}`
      )).join("\n");

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: `You analyse social media mentions about Madonna and return sentiment counts. For each mention, classify as positive (fan love, praise, excitement, nostalgia), negative (criticism, mockery, controversy), or neutral (news reporting, factual, mixed). Return ONLY a JSON object: {"positive":N,"negative":N,"neutral":N,"summary":"one sentence overall read"}`,
          messages: [{ role: "user", content: `Analyse these ${Math.min(allItems.length, 100)} Madonna mentions:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const aiText = aiData.content?.[0]?.text || "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const scale = allItems.length / Math.min(allItems.length, 100);
          pos = Math.round((parsed.positive || 0) * scale);
          neg = Math.round((parsed.negative || 0) * scale);
          neu = Math.round((parsed.neutral || 0) * scale);
          sentimentMethod = "claude-ai";
          if (parsed.summary) sentimentMethod = `claude-ai: ${parsed.summary}`;
        }
      }
    } catch { /* fallback */ }
  }

  if (pos === 0 && neg === 0 && neu === 0) {
    const posWords = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay",
      "masterpiece", "brilliant", "beautiful", "gorgeous", "stunning", "perfect", "obsessed"];
    const negWords = ["hate", "bad", "worst", "overrated", "cringe", "fake", "flop",
      "awful", "terrible", "finished", "cancelled", "embarrassing"];
    allItems.forEach((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      const hasPos = posWords.some((w) => text.includes(w));
      const hasNeg = negWords.some((w) => text.includes(w));
      if (hasPos && !hasNeg) pos++;
      else if (hasNeg && !hasPos) neg++;
      else neu++;
    });
  }
  const sentTotal = Math.max(pos + neg + neu, 1);

  // ── Cumulative from history ──
  const existingHistory = await kvListGet("social:history", 0, 364);
  const cumulativeMentions = (existingHistory || []).reduce((sum, s) => sum + (s.textMentions || s.todayMentions || 0), 0) + textMentions;
  const cumulativeEngagement = (existingHistory || []).reduce((sum, s) => sum + (s.totalEngagement || 0), 0) + totalEngagement;

  const queriesUsed = OWN_ACCOUNT_QUERIES.length + PLATFORM_QUERIES.reduce((s, p) => s + p.queries.length, 0) + TREND_QUERIES.length;

  const result = {
    hasBraveKey: true,
    fetchedAt: new Date().toISOString(),
    platforms: platformResults,
    ownAccounts: ownEngagement,
    metrics: {
      sourcesTracked,
      textMentions,
      cumulativeMentions,
      totalComments,
      totalScore,
      totalViews,
      totalEngagement,
      cumulativeEngagement,
      platformBreakdown: Object.fromEntries(platformResults.map((p) => [p.id, p.items.length])),
      textMentionsByPlatform: Object.fromEntries(platformResults.map((p) => [p.id, p.textMentions])),
      hashtags: hashtagMentions,
      hashtagArticles: uniqueTrendItems.slice(0, 20),
      mentionTimestamps: mentionTimestamps.slice(0, 100),
      queriesUsed,
    },
    sentiment: {
      positive: Math.round((pos / sentTotal) * 100),
      negative: Math.round((neg / sentTotal) * 100),
      neutral: Math.round((neu / sentTotal) * 100),
      total: textMentions,
      positiveCount: pos,
      negativeCount: neg,
      neutralCount: neu,
      method: sentimentMethod,
    },
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  if (refresh) {
    await kvListPush("social:history", {
      date: result.fetchedAt,
      textMentions,
      sourcesTracked,
      totalEngagement,
      totalComments,
      totalScore,
      totalViews,
      ownAccountPosts: ownEngagement.posts,
      ownAccountEngagement: ownEngagement.comments + ownEngagement.score + ownEngagement.views,
      sentiment: result.sentiment,
      platformBreakdown: result.metrics.platformBreakdown,
    }, 365);
  }

  const history = await kvListGet("social:history", 0, 364);
  result.history = history;

  res.status(200).json(result);
}
