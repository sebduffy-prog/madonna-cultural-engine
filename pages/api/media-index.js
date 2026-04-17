// Media Trend Index — tracks Madonna media mention volume
// Focused queries: Madonna, COADF2, Confessions II only
// Paginates until no more results — gets everything Brave has
// Feed pool: 200 items, newest in, oldest out

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const HISTORY_KEY = "media_trend_history";
const CACHE_KEY = "media_trend_cache";
const FEED_KEY = "media_feed_pool";
const CACHE_TTL = 86400;
const MAX_FEED = 200;
// Baseline: typical weekly Madonna media mentions from 29 RSS feeds + 8 Brave queries
// Set to approximate normal-week volume. Album announcement week was ~600.
const MENTION_BASELINE = 350;

// Focused queries — Madonna and the new album only
const QUERIES = [
  { q: "Madonna", label: "Madonna" },
  { q: "Madonna COADF2", label: "COADF2" },
  { q: '"Confessions on a Dance Floor 2"', label: "Confessions 2" },
  { q: 'Madonna "Confessions II"', label: "Confessions II" },
];

function isMadonnaRelevant(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return text.includes("madonna") || text.includes("coadf") ||
    text.includes("confessions on a dance floor") || text.includes("confessions ii");
}

// Paginate until Brave returns no more results
async function braveSearchAll(query, apiKey, freshness = "pd") {
  if (!apiKey) return [];
  const allItems = [];
  let offset = 0;

  while (true) {
    try {
      const params = new URLSearchParams({
        q: query, count: "50", freshness, offset: String(offset),
      });
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) break;
      const data = await res.json();

      const items = (data.web?.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        description: (r.description || "").slice(0, 300),
        date: r.page_age || "",
        age: r.age || "",
        source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
        type: "brave",
      }));

      allItems.push(...items);

      // Stop if fewer than 50 returned (no more pages) or hit 500 cap
      if (items.length < 50 || allItems.length >= 500) break;

      offset += 50;
    } catch { break; }
  }

  return allItems.filter(isMadonnaRelevant);
}

export default async function handler(req, res) {
  const { refresh, reset } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (reset) {
    await kvSet(CACHE_KEY, null);
  }

  if (!refresh && !reset) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached && cached.index !== undefined) {
        let history = [];
        try { history = await Promise.race([kvListGet(HISTORY_KEY, 0, 364), new Promise((_, r) => setTimeout(() => r(), 3000))]); } catch {}
        cached.history = history || [];
        return res.status(200).json(cached);
      }
    } catch {}
  }

  // Pull total madonna coverage from the news feed cache (same data as Cultural Feed)
  let newsFeedTotal = 0;
  let newsFeedItems = [];
  try {
    const newsCache = await Promise.race([kvGet("feeds:madonna"), new Promise((_, r) => setTimeout(() => r(), 3000))]);
    if (newsCache) {
      newsFeedTotal = newsCache.totalFound || newsCache.items?.length || 0;
      newsFeedItems = newsCache.items || [];
    }
  } catch {}

  // If no cached news data and we have an API key, trigger a fresh news pull
  if (newsFeedTotal === 0 && apiKey) {
    const raw = await Promise.all(
      QUERIES.map((q) => braveSearchAll(q.q, apiKey, "pw"))
    );
    newsFeedItems = raw.flat();
    // Dedup
    const seen = new Set();
    newsFeedItems = newsFeedItems.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    newsFeedTotal = newsFeedItems.length;
  }

  // Trend index = Brave search + RSS mentions ONLY (not Brand24 — that's a separate metric)
  const totalToday = newsFeedTotal;
  const totalBaseline = MENTION_BASELINE;
  const overallIndex = totalToday === 0 ? 0 : Math.round(((totalToday - totalBaseline) / totalBaseline) * 1000) / 10;

  // Spotify popularity signal
  let spotifyDelta = 0;
  let spotifyPopularity = null;
  try {
    const spotifyHistory = await kvListGet("spotify_popularity_history", 0, 6);
    if (spotifyHistory?.length >= 1) {
      spotifyPopularity = spotifyHistory[0].artistPopularity;
      if (spotifyHistory.length >= 2) {
        spotifyDelta = spotifyHistory[0].artistPopularity - spotifyHistory[1].artistPopularity;
      }
    }
  } catch {}

  // Build query-level breakdown from news items (keyword matching)
  const queryScores = QUERIES.map((q) => {
    const qLower = q.q.replace(/"/g, "").toLowerCase();
    const count = newsFeedItems.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return qLower.split(/\s+/).every((w) => text.includes(w));
    }).length;
    const perQueryBaseline = MENTION_BASELINE / QUERIES.length;
    const pct = Math.round(((count - perQueryBaseline) / perQueryBaseline) * 1000) / 10;
    return { label: q.label, todayCount: count, baselineCount: perQueryBaseline, pctChange: pct };
  });

  // Feed pool = news feed items (already deduped by news endpoint)
  let feedPool = newsFeedItems.slice(0, MAX_FEED);
  const newItems = feedPool;

  // AI Sentiment
  let pos = 0, neg = 0, neu = 0;
  let sentimentMethod = "keyword";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const sentimentItems = feedPool.slice(0, 80);

  if (anthropicKey && sentimentItems.length > 0) {
    try {
      const batch = sentimentItems.map((item, i) =>
        `${i + 1}. ${item.title}${item.description ? " — " + item.description.slice(0, 100) : ""}`
      ).join("\n");
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 250,
          system: 'Analyse Madonna media mentions. Classify each as positive/negative/neutral. Return ONLY: {"positive":N,"negative":N,"neutral":N,"summary":"one sentence"}',
          messages: [{ role: "user", content: `${sentimentItems.length} mentions:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (aiRes.ok) {
        const t = (await aiRes.json()).content?.[0]?.text || "";
        const m = t.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          pos = parsed.positive || 0;
          neg = parsed.negative || 0;
          neu = parsed.neutral || 0;
          sentimentMethod = parsed.summary ? `claude-ai: ${parsed.summary}` : "claude-ai";
        }
      }
    } catch { /* fallback */ }
  }
  if (pos === 0 && neg === 0 && neu === 0) {
    const pw = ["love", "amazing", "queen", "icon", "legend", "masterpiece", "brilliant", "stunning"];
    const nw = ["hate", "worst", "overrated", "cringe", "flop", "awful", "cancelled"];
    sentimentItems.forEach((item) => {
      const t = `${item.title} ${item.description}`.toLowerCase();
      if (pw.some((w) => t.includes(w)) && !nw.some((w) => t.includes(w))) pos++;
      else if (nw.some((w) => t.includes(w))) neg++;
      else neu++;
    });
  }
  const sentTotal = Math.max(pos + neg + neu, 1);

  // Daily change: compare to previous history entry
  let dailyChange = null;
  try {
    const prevHistory = await kvListGet(HISTORY_KEY, 0, 0);
    if (prevHistory?.length > 0 && prevHistory[0].totalToday > 0) {
      const prev = prevHistory[0].totalToday;
      dailyChange = Math.round(((totalToday - prev) / prev) * 1000) / 10;
    }
  } catch {}

  const result = {
    fetchedAt: new Date().toISOString(),
    isFirstRun: false,
    baselineDate: null,
    baseline: MENTION_BASELINE,
    index: overallIndex,
    totalMentions: totalToday,
    dailyChange,
    totalToday,
    totalBaseline,
    queryScores,
    newItems: newItems.length,
    feedSize: feedPool.length,
    items: feedPool,
    sentiment: {
      positive: Math.round((pos / sentTotal) * 100),
      negative: Math.round((neg / sentTotal) * 100),
      neutral: Math.round((neu / sentTotal) * 100),
      positiveCount: pos, negativeCount: neg, neutralCount: neu,
      method: sentimentMethod,
    },
    spotifyPopularity,
    spotifyDelta,
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  await kvListPush(HISTORY_KEY, {
    date: new Date().toISOString(),
    index: overallIndex,
    totalToday,
    totalBaseline,
    newItems: newItems.length,
    sentiment: result.sentiment,
  }, 365);

  result.history = await kvListGet(HISTORY_KEY, 0, 364);
  res.status(200).json(result);
}
