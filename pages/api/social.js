// Social listening -- uses Brave Search to surface Madonna mentions across platforms
// Twitter/X is largely uncrawlable so we search for tweets via nitter mirrors and discussion sites
// Also surfaces hashtag usage and engagement metrics

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "social:pulse";
const CACHE_TTL = 21600; // 6 hours

// Search aliases -- album names, tour names, things people call her
const MADONNA_ALIASES = ["Madonna", "Confessions II", "Queen of Pop", "Material Girl"];

const PLATFORMS = [
  { id: "reddit", label: "Reddit", queries: [
    '"Madonna" site:reddit.com',
    'Madonna site:reddit.com/r/popheads',
    'Madonna site:reddit.com/r/music',
    'Madonna site:reddit.com/r/Madonna',
    '"Confessions II" OR "Queen of Pop" site:reddit.com',
    'Madonna album tour 2026 reddit',
  ], icon: "R" },
  { id: "twitter", label: "Twitter / X", queries: [
    '"Madonna" twitter',
    'Madonna tweet',
    '#Madonna',
    'Madonna trending',
    '"Confessions II"',
    'Madonna viral',
    'Madonna fan',
    'Madonna concert tour',
  ], icon: "X" },
  { id: "tiktok", label: "TikTok", queries: [
    '"Madonna" site:tiktok.com',
    'Madonna TikTok',
    'Madonna sound TikTok',
    'Madonna dance TikTok trend',
    'Madonna Hung Up TikTok',
    'Madonna Vogue TikTok',
    'Madonna Material Girl TikTok',
    '"Confessions II" TikTok',
  ], icon: "T" },
  { id: "youtube", label: "YouTube", queries: [
    '"Madonna" site:youtube.com',
    'Madonna reaction video',
    'Madonna live performance',
    'Madonna music video',
    'Madonna interview 2026',
    'Madonna fan compilation',
  ], icon: "Y" },
  { id: "instagram", label: "Instagram", queries: [
    'Madonna instagram',
    '#Madonna instagram',
    'Madonna post story instagram',
    'Madonna fan page instagram',
  ], icon: "I" },
];

// Hashtags and cultural metrics to track
const HASHTAG_QUERIES = [
  "#Madonna",
  "#MadonnaQueen",
  "#MaterialGirl",
  "#Madonnafans",
  "#CelebrationTour",
  "#MadonnaTour",
  "#LikeAVirgin",
  "#LikeAPrayer",
  "#HungUp",
  "#Vogue Madonna",
  "#RayOfLight",
  "#QueenOfPop",
  "#MadonnaForever",
  "#MadonnaNetflix",
  "#ConfessionsII",
  "#MadonnaNewAlbum",
  "#StuartPrice Madonna",
  "#MadonnaLive",
  "#MadonnaConcert",
  "Madonna hashtag trending",
];

async function braveSearch(query, apiKey, count = 10, freshness = "pw") {
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ q: query, count: String(count), freshness });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: (r.description || "").slice(0, 300),
      date: r.page_age || "",
      source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
    }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { refresh, period = "pw" } = req.query; // pd=24h, pw=7days, pm=30days
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], metrics: {} });
  }

  // Check cache
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) return res.status(200).json(cached);
  }

  // Fetch all platform queries in parallel
  const platformPromises = PLATFORMS.map(async (p) => {
    const allResults = await Promise.all(p.queries.map((q) => braveSearch(q, apiKey, 15, period)));
    const seen = new Set();
    const items = allResults.flat().filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    return { id: p.id, label: p.label, icon: p.icon, items: items.map((item) => ({ ...item, platform: p.id })) };
  });

  // Fetch hashtag/metric queries
  const hashtagPromises = HASHTAG_QUERIES.map((q) => braveSearch(q, apiKey, 10, period));

  const [platformResults, hashtagResults] = await Promise.all([
    Promise.all(platformPromises),
    Promise.all(hashtagPromises),
  ]);

  // Build hashtag metrics
  const hashtagItems = hashtagResults.flat();
  const hashtagMentions = {};
  HASHTAG_QUERIES.forEach((tag, i) => {
    hashtagMentions[tag] = hashtagResults[i].length;
  });

  // Dedup hashtag items
  const seenUrls = new Set();
  const uniqueHashtagItems = hashtagItems.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  // Sentiment analysis on ALL items
  const allItems = [...platformResults.flatMap((r) => r.items), ...uniqueHashtagItems];
  const positive = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay", "masterpiece", "brilliant", "beautiful", "gorgeous", "stunning", "perfect", "obsessed"];
  const negative = ["hate", "bad", "worst", "overrated", "cringe", "fake", "surgery", "flop", "awful", "terrible", "dead", "finished", "cancelled"];
  let pos = 0, neg = 0, neu = 0;
  allItems.forEach((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const hasPos = positive.some((w) => text.includes(w));
    const hasNeg = negative.some((w) => text.includes(w));
    if (hasPos && !hasNeg) pos++;
    else if (hasNeg && !hasPos) neg++;
    else neu++;
  });
  const total = Math.max(pos + neg + neu, 1);

  const result = {
    hasBraveKey: true,
    fetchedAt: new Date().toISOString(),
    platforms: platformResults,
    metrics: {
      totalMentions: allItems.length,
      platformBreakdown: Object.fromEntries(platformResults.map((p) => [p.id, p.items.length])),
      hashtags: hashtagMentions,
      hashtagArticles: uniqueHashtagItems.slice(0, 10),
    },
    sentiment: {
      positive: Math.round((pos / total) * 100),
      negative: Math.round((neg / total) * 100),
      neutral: Math.round((neu / total) * 100),
      total: allItems.length,
      positiveCount: pos,
      negativeCount: neg,
      neutralCount: neu,
    },
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);
  res.status(200).json(result);
}
