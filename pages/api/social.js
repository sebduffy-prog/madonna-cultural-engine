// Social Trend Index Engine
//
// Uses Brave Search as a proxy mention tracker. Runs a fixed daily battery
// of site-scoped queries, records how many results Brave indexes each day.
// First run sets the baseline at zero. Every subsequent day, each query score
// is expressed as % change against that baseline. Aggregated by platform and
// rolled up into a single daily index score.
//
// This is a directional trend engine — not a raw headcount.
// A single drop, album announcement, or press spike pushes queries to
// saturation and drives the index sharply upward. Quiet periods register
// as flat or declining.
//
// 25 queries per daily run = 750/month

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "social:trend-index";
const BASELINE_KEY = "social:trend-baseline";
const IS_DEV = process.env.NODE_ENV === "development";
const CACHE_TTL = IS_DEV ? 300 : 86400;

// ── Fixed query battery ──
// Every query runs every day. Result count tracked over time.
const QUERIES = [
  // Reddit (5)
  { platform: "reddit", q: "site:reddit.com Madonna" },
  { platform: "reddit", q: "site:reddit.com Madonna COADF2" },
  { platform: "reddit", q: 'site:reddit.com Madonna "Confessions on a Dance Floor 2"' },
  { platform: "reddit", q: 'site:reddit.com Madonna "Confessions II"' },
  { platform: "reddit", q: "site:reddit.com madonna music 2026" },
  // TikTok (4)
  { platform: "tiktok", q: "site:tiktok.com Madonna" },
  { platform: "tiktok", q: "site:tiktok.com Madonna COADF2" },
  { platform: "tiktok", q: "site:tiktok.com madonna confessions" },
  { platform: "tiktok", q: 'site:tiktok.com Madonna "confessions II"' },
  // YouTube (4)
  { platform: "youtube", q: "site:youtube.com Madonna" },
  { platform: "youtube", q: "site:youtube.com Madonna COADF2" },
  { platform: "youtube", q: "site:youtube.com madonna 2026" },
  { platform: "youtube", q: 'site:youtube.com Madonna "confessions on a dance floor 2"' },
  // Instagram (3)
  { platform: "instagram", q: "site:instagram.com Madonna" },
  { platform: "instagram", q: "site:instagram.com Madonna COADF2" },
  { platform: "instagram", q: "site:instagram.com madonna confessions" },
  // News (6)
  { platform: "news", q: "Madonna", freshness: "pd" },
  { platform: "news", q: "Madonna COADF2", freshness: "pd" },
  { platform: "news", q: 'Madonna "Confessions II"', freshness: "pd" },
  { platform: "news", q: '"Confessions on a Dance Floor 2"', freshness: "pd" },
  { platform: "news", q: "madonna album 2026", freshness: "pd" },
  { platform: "news", q: "madonna warner records", freshness: "pd" },
  // Video (3)
  { platform: "video", q: "Madonna Confessions video", freshness: "pw" },
  { platform: "video", q: "Madonna COADF2 video", freshness: "pw" },
  { platform: "video", q: "Madonna 2026 video", freshness: "pw" },
];

const PLATFORM_META = {
  reddit: { label: "Reddit", color: "#FF4500", icon: "R" },
  tiktok: { label: "TikTok", color: "#00F2EA", icon: "T" },
  youtube: { label: "YouTube", color: "#FF0000", icon: "Y" },
  instagram: { label: "Instagram", color: "#E1306C", icon: "I" },
  news: { label: "News", color: "#A78BFA", icon: "N" },
  video: { label: "Video", color: "#F59E0B", icon: "V" },
};

// ── Brave Search — just count results ──
async function braveCount(query, apiKey, freshness = "pd") {
  if (!apiKey) return { count: 0, items: [] };
  try {
    const params = new URLSearchParams({ q: query, count: "20", freshness });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { count: 0, items: [] };
    const data = await res.json();

    const items = (data.web?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: (r.description || "").slice(0, 300),
      date: r.page_age || "",
      source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
    }));

    // Also count discussions
    const discussions = (data.discussions?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: (r.description || "").slice(0, 300),
      date: r.data?.question_posted_at || r.page_age || "",
      source: r.data?.forum_name || "",
      comments: r.data?.num_answers || 0,
      score: r.data?.score || 0,
    }));

    // Only keep results that are actually about Madonna
    const allItems = [...items, ...discussions].filter((item) => {
      const text = `${item.title} ${item.description} ${item.url}`.toLowerCase();
      return text.includes("madonna") || text.includes("coadf") || text.includes("confessions on a dance floor") || text.includes("confessions ii");
    });
    return { count: allItems.length, items: allItems };
  } catch {
    return { count: 0, items: [] };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  // Serve cache if not refreshing
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.index !== undefined) {
      const history = await kvListGet("social:trend-history", 0, 364);
      cached.history = history;
      return res.status(200).json(cached);
    }
    // No cache — fall through to fetch
  }

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], index: 0 });
  }

  // ── Run all queries in parallel ──
  const results = await Promise.all(
    QUERIES.map((q) => braveCount(q.q, apiKey, q.freshness || "pd"))
  );

  // ── Build per-query scores ──
  const baseline = await kvGet(BASELINE_KEY);
  const isFirstRun = !baseline;

  const queryScores = QUERIES.map((q, i) => {
    const count = results[i].count;
    const baseCount = baseline ? (baseline[i] || 0) : count;
    const pctChange = baseCount > 0 ? ((count - baseCount) / baseCount) * 100 : 0;
    return {
      platform: q.platform,
      query: q.q,
      count,
      baselineCount: baseCount,
      pctChange: isFirstRun ? 0 : Math.round(pctChange * 10) / 10,
    };
  });

  // Set baseline on first run
  if (isFirstRun) {
    await kvSet(BASELINE_KEY, QUERIES.map((_, i) => results[i].count));
  }

  // ── Aggregate by platform ──
  const platforms = {};
  const allItems = [];
  QUERIES.forEach((q, i) => {
    if (!platforms[q.platform]) {
      platforms[q.platform] = {
        id: q.platform,
        ...PLATFORM_META[q.platform],
        queries: [],
        totalCount: 0,
        avgChange: 0,
        items: [],
      };
    }
    platforms[q.platform].queries.push(queryScores[i]);
    platforms[q.platform].totalCount += results[i].count;
    platforms[q.platform].items.push(...results[i].items);
    allItems.push(...results[i].items.map((item) => ({ ...item, platform: q.platform })));
  });

  // Calculate platform index scores
  const platformList = Object.values(platforms).map((p) => {
    const changes = p.queries.map((q) => q.pctChange);
    p.avgChange = changes.length > 0 ? Math.round((changes.reduce((s, c) => s + c, 0) / changes.length) * 10) / 10 : 0;
    // Dedup items by URL
    const seen = new Set();
    p.items = p.items.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }).slice(0, 20);
    return p;
  });

  // ── Overall index = average of platform indices ──
  const overallIndex = platformList.length > 0
    ? Math.round((platformList.reduce((s, p) => s + p.avgChange, 0) / platformList.length) * 10) / 10
    : 0;

  // Total unique items across all platforms
  const seenAll = new Set();
  const uniqueItems = allItems.filter((item) => {
    if (!item.url || seenAll.has(item.url)) return false;
    seenAll.add(item.url);
    return true;
  });

  // ── AI Sentiment on today's items ──
  let pos = 0, neg = 0, neu = 0;
  let sentimentMethod = "keyword";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey && uniqueItems.length > 0) {
    try {
      const batch = uniqueItems.slice(0, 80).map((item, i) =>
        `${i + 1}. [${item.platform}] ${item.title}${item.description ? " — " + item.description.slice(0, 100) : ""}`
      ).join("\n");
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 250,
          system: 'Analyse Madonna social mentions. Classify each as positive/negative/neutral. Return ONLY: {"positive":N,"negative":N,"neutral":N,"summary":"one sentence"}',
          messages: [{ role: "user", content: `${uniqueItems.length} mentions:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (aiRes.ok) {
        const t = (await aiRes.json()).content?.[0]?.text || "";
        const m = t.match(/\{[\s\S]*\}/);
        if (m) {
          const p2 = JSON.parse(m[0]);
          const scale = uniqueItems.length / Math.min(uniqueItems.length, 80);
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
    uniqueItems.forEach((item) => {
      const t = `${item.title} ${item.description}`.toLowerCase();
      if (pw.some((w) => t.includes(w)) && !nw.some((w) => t.includes(w))) pos++;
      else if (nw.some((w) => t.includes(w))) neg++;
      else neu++;
    });
  }
  const sentTotal = Math.max(pos + neg + neu, 1);

  // ── Build result ──
  const result = {
    hasBraveKey: true,
    fetchedAt: new Date().toISOString(),
    isFirstRun,
    index: overallIndex,
    platforms: platformList,
    queryScores,
    totalSources: uniqueItems.length,
    items: uniqueItems.slice(0, 30),
    sentiment: {
      positive: Math.round((pos / sentTotal) * 100),
      negative: Math.round((neg / sentTotal) * 100),
      neutral: Math.round((neu / sentTotal) * 100),
      positiveCount: pos, negativeCount: neg, neutralCount: neu,
      total: uniqueItems.length,
      method: sentimentMethod,
    },
    queriesUsed: QUERIES.length,
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);

  // Store daily snapshot
  if (refresh) {
    await kvListPush("social:trend-history", {
      date: result.fetchedAt,
      index: overallIndex,
      totalSources: uniqueItems.length,
      platforms: Object.fromEntries(platformList.map((p) => [p.id, { count: p.totalCount, change: p.avgChange }])),
      sentiment: result.sentiment,
    }, 365);
  }

  result.history = await kvListGet("social:trend-history", 0, 364);
  res.status(200).json(result);
}
