// Media Trend Index — tracks Madonna media mention volume over time
// Uses Brave Search with count=50 + pagination for deep results
// Baseline set on first run (pw = past week), daily runs use pd (past day)
// Persistent feed pool: always 100 items, newest in, oldest out

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const BASELINE_KEY = "media_trend_baseline";
const HISTORY_KEY = "media_trend_history";
const CACHE_KEY = "media_trend_cache";
const FEED_KEY = "media_feed_pool";
const CACHE_TTL = 86400;
const MAX_FEED = 100;

// Media mention queries — news, features, coverage
const QUERIES = [
  { q: "Madonna", label: "General" },
  { q: "Madonna news 2026", label: "News" },
  { q: "Madonna interview OR profile OR feature", label: "Features" },
  { q: "Madonna album OR tour OR concert OR comeback", label: "Album/Tour" },
  { q: 'Madonna "Confessions on a Dance Floor 2" OR COADF2 OR "Confessions II"', label: "COADF2" },
  { q: 'Madonna "Stuart Price" OR "Warner Records" OR "new album"', label: "Stuart Price" },
  { q: "Madonna Netflix OR biopic OR documentary OR series", label: "Netflix" },
  { q: 'Madonna fashion OR style OR "Met Gala" OR Vogue OR campaign', label: "Fashion" },
  { q: "Madonna LGBTQ OR pride OR queer OR ballroom", label: "LGBTQ" },
  { q: "Madonna legacy OR influence OR icon OR pioneer", label: "Legacy" },
  { q: "Madonna viral OR trending OR moment OR reaction", label: "Viral" },
  { q: "Madonna Coachella OR festival OR live OR performance", label: "Live" },
];

function isMadonnaRelevant(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return text.includes("madonna") || text.includes("coadf") ||
    text.includes("confessions on a dance floor") || text.includes("confessions ii");
}

async function braveSearchDeep(query, apiKey, freshness = "pd") {
  if (!apiKey) return [];
  const allItems = [];

  for (const offset of [0, 50]) {
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
      if (items.length < 50) break;
    } catch { break; }
  }

  return allItems.filter(isMadonnaRelevant);
}

export default async function handler(req, res) {
  const { refresh, reset } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (reset) {
    await kvSet(BASELINE_KEY, null);
    await kvSet(CACHE_KEY, null);
  }

  if (!refresh && !reset) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.index !== undefined) {
      cached.history = await kvListGet(HISTORY_KEY, 0, 364);
      return res.status(200).json(cached);
    }
  }

  if (!apiKey) {
    return res.status(200).json({ error: "No Brave API key" });
  }

  // Load baseline
  let baseline = await kvGet(BASELINE_KEY);
  const isFirstRun = !baseline || !baseline.queries;
  const freshness = isFirstRun ? "pw" : "pd";

  // Run all queries in parallel (12 queries × 2 pages = 24 API calls)
  const raw = await Promise.all(
    QUERIES.map((q) => braveSearchDeep(q.q, apiKey, freshness))
  );

  // Build snapshot
  const snapshot = {
    date: new Date().toISOString(),
    freshness,
    queries: QUERIES.map((q, i) => ({
      label: q.label,
      query: q.q,
      count: raw[i].length,
    })),
  };

  if (isFirstRun) {
    baseline = snapshot;
    await kvSet(BASELINE_KEY, baseline);
  }

  // Per-query % change
  const queryScores = QUERIES.map((q, i) => {
    const today = raw[i].length;
    const base = baseline.queries?.[i]?.count || 0;
    const pct = base > 0 ? Math.round(((today - base) / base) * 1000) / 10 : (today > 0 ? 100 : 0);
    return { label: q.label, todayCount: today, baselineCount: base, pctChange: isFirstRun ? 0 : pct };
  });

  const totalToday = queryScores.reduce((s, q) => s + q.todayCount, 0);
  const totalBaseline = queryScores.reduce((s, q) => s + q.baselineCount, 0);
  const overallIndex = totalBaseline > 0 && !isFirstRun
    ? Math.round(((totalToday - totalBaseline) / totalBaseline) * 1000) / 10
    : 0;

  // Dedup all items
  const seen = new Set();
  const todaysItems = raw.flat().filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Persistent feed pool
  let feedPool = await kvGet(FEED_KEY) || [];
  const poolUrls = new Set(feedPool.map((i) => i.url));
  const newItems = todaysItems.filter((i) => i.url && !poolUrls.has(i.url));
  feedPool = [...newItems, ...feedPool];
  if (feedPool.length > MAX_FEED) feedPool = feedPool.slice(0, MAX_FEED);
  await kvSet(FEED_KEY, feedPool);

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

  const result = {
    fetchedAt: snapshot.date,
    isFirstRun,
    baselineDate: baseline.date,
    index: overallIndex,
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
    queriesUsed: QUERIES.length * 2,
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  await kvListPush(HISTORY_KEY, {
    date: snapshot.date,
    index: overallIndex,
    totalToday,
    totalBaseline,
    newItems: newItems.length,
    sentiment: result.sentiment,
  }, 365);

  result.history = await kvListGet(HISTORY_KEY, 0, 364);
  res.status(200).json(result);
}
