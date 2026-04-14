// Social listening -- deep Madonna monitoring across all platforms
// Extracts real engagement: comment counts, scores, views, publish timestamps
// Mentions compound daily via history snapshots
//
// BUDGET: 6,000 queries/month (Brave Search paid tier)
// Social: ~25 queries × 4x daily = 3,000/month
// Refreshes every 6 hours via cron

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "social:pulse";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 86400; // 5 min dev, 24 hours prod (daily cron)

// ── Platform queries: multiple angles per platform for depth ──
const PLATFORMS = [
  { id: "reddit", label: "Reddit", icon: "R", queries: [
    '"Madonna" site:reddit.com',
    'Madonna site:reddit.com/r/popheads OR site:reddit.com/r/pop OR site:reddit.com/r/music',
    'Madonna site:reddit.com/r/Madonna OR site:reddit.com/r/80smusic OR site:reddit.com/r/popculturechat',
    'Madonna album OR tour OR Netflix OR concert reddit',
  ]},
  { id: "twitter", label: "Twitter / X", icon: "X", queries: [
    '"Madonna" site:twitter.com OR site:x.com',
    'Madonna trending OR viral OR fan twitter',
    'Madonna concert OR tour OR album OR "new music" twitter',
    'Madonna fashion OR style OR "red carpet" twitter',
  ]},
  { id: "tiktok", label: "TikTok", icon: "T", queries: [
    'Madonna site:tiktok.com',
    'Madonna TikTok trend OR dance OR challenge OR sound',
    'Madonna "Hung Up" OR "Material Girl" OR "Vogue" OR "Like A Prayer" TikTok',
  ]},
  { id: "youtube", label: "YouTube", icon: "Y", queries: [
    'Madonna site:youtube.com',
    'Madonna reaction OR compilation OR "music video" OR performance youtube',
    'Madonna interview OR documentary OR live OR concert youtube 2026',
  ]},
  { id: "instagram", label: "Instagram", icon: "I", queries: [
    'Madonna site:instagram.com',
    'Madonna fashion OR style OR fan instagram 2026',
  ]},
];

// ── Hashtag + trend queries ──
const TREND_QUERIES = [
  '#Madonna OR #MadonnaQueen OR #MaterialGirl OR #QueenOfPop',
  '#CelebrationTour OR #MadonnaTour OR #MadonnaLive OR #MadonnaConcert',
  '#ConfessionsII OR #MadonnaNetflix OR #MadonnaNewAlbum OR #StuartPrice',
  '#LikeAPrayer OR #HungUp OR #RayOfLight OR #Vogue OR #LikeAVirgin',
  // Cultural moment: what are people connecting Madonna to right now
  'Madonna "cultural impact" OR legacy OR influence OR icon OR pioneer',
  // Competitor landscape: who's being talked about alongside her
  'Madonna OR "Lady Gaga" OR "Beyonce" OR "Taylor Swift" "queen of pop"',
];

const ALL_HASHTAGS = [
  "#Madonna", "#MadonnaQueen", "#MaterialGirl", "#QueenOfPop",
  "#CelebrationTour", "#MadonnaTour", "#MadonnaLive", "#MadonnaConcert",
  "#ConfessionsII", "#MadonnaNetflix", "#MadonnaNewAlbum", "#StuartPrice",
  "#LikeAPrayer", "#HungUp", "#RayOfLight", "#LikeAVirgin",
  "#MadonnaForever", "#Madonnafans",
];

// ── Engagement parsing ──
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

// ── Brave Search with full data extraction ──
async function braveSearch(query, apiKey, count = 20, freshness = "pw") {
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
        age: r.age || "",
      };
    });

    // Brave discussions: real forum data with comment counts and scores
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
      age: r.age || "",
    }));

    return { web, discussions };
  } catch {
    return { web: [], discussions: [] };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  // Return cached data if not refreshing
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      const history = await kvListGet("social:history", 0, 89);
      cached.history = history;
      cached.metrics.cumulativeMentions = (history || []).reduce((sum, s) => sum + (s.todayMentions || 0), 0);
      return res.status(200).json(cached);
    }
  }

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], metrics: {} });
  }

  // ── Fire all queries in parallel ──
  // Platform queries: multiple per platform for depth
  const platformPromises = PLATFORMS.map(async (p) => {
    const allResults = await Promise.all(
      p.queries.map((q) => braveSearch(q, apiKey, 20))
    );
    // Merge web + discussions from all queries, dedup by URL
    const seen = new Set();
    const all = allResults
      .flatMap((r) => [...r.discussions, ...r.web])
      .filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    return {
      id: p.id, label: p.label, icon: p.icon,
      items: all.map((item) => ({ ...item, platform: p.id })),
      totalComments: all.reduce((s, i) => s + i.comments, 0),
      totalScore: all.reduce((s, i) => s + i.score, 0),
      totalViews: all.reduce((s, i) => s + i.views, 0),
    };
  });

  // Trend/hashtag queries
  const trendPromises = TREND_QUERIES.map((q) => braveSearch(q, apiKey, 20));

  const [platformResults, trendResults] = await Promise.all([
    Promise.all(platformPromises),
    Promise.all(trendPromises),
  ]);

  // ── Process trend/hashtag data ──
  const trendItems = trendResults.flatMap((r) => [...r.web, ...r.discussions]);

  const hashtagMentions = {};
  ALL_HASHTAGS.forEach((tag) => {
    const tagLower = tag.toLowerCase().replace("#", "");
    hashtagMentions[tag] = trendItems.filter((item) => {
      const text = `${item.title} ${item.description} ${item.url}`.toLowerCase();
      return text.includes(tagLower);
    }).length;
  });

  // Dedup trend items
  const seenUrls = new Set();
  const uniqueTrendItems = trendItems.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  // ── Aggregate real metrics ──
  const allItems = [...platformResults.flatMap((r) => r.items), ...uniqueTrendItems];
  const todayMentions = allItems.length;
  const todayComments = allItems.reduce((s, i) => s + (i.comments || 0), 0);
  const todayScore = allItems.reduce((s, i) => s + (i.score || 0), 0);
  const todayViews = allItems.reduce((s, i) => s + (i.views || 0), 0);

  // Publish timestamps for timeline
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

  // ── Sentiment analysis via Claude ──
  let pos = 0, neg = 0, neu = 0;
  let sentimentMethod = "keyword-fallback";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey && allItems.length > 0) {
    try {
      // Build a compact list for Claude to analyse — up to 100 items
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
          messages: [{ role: "user", content: `Analyse these ${allItems.length} Madonna mentions from the past week. Here are ${Math.min(allItems.length, 100)} of them:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const aiText = aiData.content?.[0]?.text || "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Scale to full item count if we only sent a sample
          const scale = allItems.length / Math.min(allItems.length, 100);
          pos = Math.round((parsed.positive || 0) * scale);
          neg = Math.round((parsed.negative || 0) * scale);
          neu = Math.round((parsed.neutral || 0) * scale);
          sentimentMethod = "claude-ai";
          // Attach the AI summary
          if (parsed.summary) sentimentMethod = `claude-ai: ${parsed.summary}`;
        }
      }
    } catch {
      // Fall through to keyword fallback
    }
  }

  // Keyword fallback if Claude wasn't available or failed
  if (pos === 0 && neg === 0 && neu === 0) {
    const posWords = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay",
      "masterpiece", "brilliant", "beautiful", "gorgeous", "stunning", "perfect", "obsessed",
      "iconic", "legendary", "goat", "favourite", "blessed"];
    const negWords = ["hate", "bad", "worst", "overrated", "cringe", "fake", "surgery", "flop",
      "awful", "terrible", "finished", "cancelled", "washed", "embarrassing"];
    allItems.forEach((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      const hasPos = posWords.some((w) => text.includes(w));
      const hasNeg = negWords.some((w) => text.includes(w));
      if (hasPos && !hasNeg) pos++;
      else if (hasNeg && !hasPos) neg++;
      else neu++;
    });
  }
  const total = Math.max(pos + neg + neu, 1);

  // ── Cumulative from history ──
  const existingHistory = await kvListGet("social:history", 0, 89);
  const cumulativeMentions = (existingHistory || []).reduce((sum, s) => sum + (s.todayMentions || 0), 0) + todayMentions;

  // ── Query count tracking ──
  const queriesUsed = PLATFORMS.reduce((s, p) => s + p.queries.length, 0) + TREND_QUERIES.length;

  const result = {
    hasBraveKey: true,
    fetchedAt: new Date().toISOString(),
    platforms: platformResults,
    metrics: {
      totalMentions: todayMentions,
      cumulativeMentions,
      totalComments: todayComments,
      totalScore: todayScore,
      totalViews: todayViews,
      platformBreakdown: Object.fromEntries(platformResults.map((p) => [p.id, p.items.length])),
      hashtags: hashtagMentions,
      hashtagArticles: uniqueTrendItems.slice(0, 20),
      mentionTimestamps: mentionTimestamps.slice(0, 100),
      queriesUsed,
    },
    sentiment: {
      positive: Math.round((pos / total) * 100),
      negative: Math.round((neg / total) * 100),
      neutral: Math.round((neu / total) * 100),
      total: todayMentions,
      positiveCount: pos,
      negativeCount: neg,
      neutralCount: neu,
      method: sentimentMethod,
    },
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  // Store snapshot — mentions compound over time
  if (refresh) {
    await kvListPush("social:history", {
      date: result.fetchedAt,
      todayMentions,
      todayComments,
      todayScore,
      todayViews,
      sentiment: result.sentiment,
      platformBreakdown: result.metrics.platformBreakdown,
    }, 365); // Keep a full year
  }

  const history = await kvListGet("social:history", 0, 89);
  result.history = history;

  res.status(200).json(result);
}
