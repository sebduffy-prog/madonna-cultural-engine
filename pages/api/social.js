// Social Trend Index Engine
//
// Runs a fixed battery of Brave Search queries. Counts actual returned
// results (filtered to Madonna-relevant only). First run with pw (past week)
// sets the baseline. Daily runs with pd (past day) compare against it.
//
// Paid plan: count=50 per query + pagination = up to 100 results per query.
// 48 queries × 2 pages = 96 API calls per run = 2,880/month at daily.

import { kvGet, kvSet, kvListPush, kvListGet, kvDiagnostic } from "../../lib/kv";

const BASELINE_KEY = "social_trend_baseline";
const HISTORY_KEY = "social_trend_history";
const CACHE_KEY = "social_trend_cache";
const CACHE_TTL = 86400;

// ── Fixed query battery ──
const QUERIES = [
  // Reddit (10)
  { platform: "reddit", q: "site:reddit.com Madonna" },
  { platform: "reddit", q: "site:reddit.com Madonna COADF2" },
  { platform: "reddit", q: 'site:reddit.com Madonna "Confessions on a Dance Floor 2"' },
  { platform: "reddit", q: 'site:reddit.com Madonna "Confessions II"' },
  { platform: "reddit", q: "site:reddit.com madonna music 2026" },
  { platform: "reddit", q: "site:reddit.com madonna album new single" },
  { platform: "reddit", q: "site:reddit.com madonna tour concert live" },
  { platform: "reddit", q: "site:reddit.com madonna Netflix documentary" },
  { platform: "reddit", q: 'site:reddit.com madonna "Stuart Price"' },
  { platform: "reddit", q: "site:reddit.com madonna warner records" },
  // TikTok (8)
  { platform: "tiktok", q: "site:tiktok.com Madonna" },
  { platform: "tiktok", q: "site:tiktok.com Madonna COADF2" },
  { platform: "tiktok", q: "site:tiktok.com madonna confessions" },
  { platform: "tiktok", q: 'site:tiktok.com Madonna "confessions II"' },
  { platform: "tiktok", q: "site:tiktok.com madonna dance trend" },
  { platform: "tiktok", q: "site:tiktok.com madonna hung up vogue" },
  { platform: "tiktok", q: "site:tiktok.com madonna material girl sound" },
  { platform: "tiktok", q: "site:tiktok.com madonna 2026" },
  // YouTube (8)
  { platform: "youtube", q: "site:youtube.com Madonna" },
  { platform: "youtube", q: "site:youtube.com Madonna COADF2" },
  { platform: "youtube", q: "site:youtube.com madonna 2026" },
  { platform: "youtube", q: 'site:youtube.com Madonna "confessions on a dance floor 2"' },
  { platform: "youtube", q: "site:youtube.com madonna reaction" },
  { platform: "youtube", q: "site:youtube.com madonna live performance concert" },
  { platform: "youtube", q: "site:youtube.com madonna interview documentary" },
  { platform: "youtube", q: "site:youtube.com madonna music video official" },
  // Instagram (6)
  { platform: "instagram", q: "site:instagram.com Madonna" },
  { platform: "instagram", q: "site:instagram.com Madonna COADF2" },
  { platform: "instagram", q: "site:instagram.com madonna confessions" },
  { platform: "instagram", q: "site:instagram.com madonna fashion style" },
  { platform: "instagram", q: "site:instagram.com madonna fan" },
  { platform: "instagram", q: "site:instagram.com madonna 2026" },
  // News (10)
  { platform: "news", q: "Madonna" },
  { platform: "news", q: "Madonna COADF2" },
  { platform: "news", q: 'Madonna "Confessions II"' },
  { platform: "news", q: '"Confessions on a Dance Floor 2"' },
  { platform: "news", q: "madonna album 2026" },
  { platform: "news", q: "madonna warner records" },
  { platform: "news", q: "madonna Netflix series biopic" },
  { platform: "news", q: 'madonna "Stuart Price" new music' },
  { platform: "news", q: "madonna tour concert announcement" },
  { platform: "news", q: "madonna interview profile feature 2026" },
  // Video (6)
  { platform: "video", q: "Madonna Confessions video" },
  { platform: "video", q: "Madonna COADF2 video" },
  { platform: "video", q: "Madonna 2026 video" },
  { platform: "video", q: "Madonna new album music video" },
  { platform: "video", q: "Madonna live performance 2026" },
  { platform: "video", q: "Madonna documentary Netflix trailer" },
];

const PLATFORM_META = {
  reddit: { label: "Reddit", color: "#FF4500", icon: "R" },
  tiktok: { label: "TikTok", color: "#00F2EA", icon: "T" },
  youtube: { label: "YouTube", color: "#FF0000", icon: "Y" },
  instagram: { label: "Instagram", color: "#E1306C", icon: "I" },
  news: { label: "News", color: "#A78BFA", icon: "N" },
  video: { label: "Video", color: "#F59E0B", icon: "V" },
};

// Madonna relevance filter
function isMadonnaRelevant(item) {
  const text = `${item.title} ${item.description} ${item.url}`.toLowerCase();
  return text.includes("madonna") || text.includes("coadf") ||
    text.includes("confessions on a dance floor") || text.includes("confessions ii");
}

// ── Brave Search with pagination ──
// Returns all Madonna-relevant items found across 2 pages (up to 100 results)
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
      }));

      allItems.push(...items);

      // If we got fewer than 50, no more pages
      if (items.length < 50) break;
    } catch { break; }
  }

  // Filter to Madonna-relevant only
  return allItems.filter(isMadonnaRelevant);
}

export default async function handler(req, res) {
  const { refresh, reset } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  // Reset baseline
  if (reset) {
    await kvSet(BASELINE_KEY, null);
    await kvSet(CACHE_KEY, null);
  }

  // Serve cache if not refreshing
  if (!refresh && !reset) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && cached.platforms) {
      cached.history = await kvListGet(HISTORY_KEY, 0, 364);
      return res.status(200).json(cached);
    }
  }

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [], index: 0 });
  }

  // ── Load baseline ──
  let baseline = await kvGet(BASELINE_KEY);
  const isFirstRun = !baseline || !baseline.queries;

  // Baseline uses pw (past week) for a larger sample
  // Daily runs use pd (past day) to capture today's volume
  const freshness = isFirstRun ? "pw" : "pd";

  // ── Run all queries in parallel ──
  const raw = await Promise.all(
    QUERIES.map((q) => braveSearchDeep(q.q, apiKey, freshness))
  );

  // ── Build snapshot ──
  const snapshot = {
    date: new Date().toISOString(),
    freshness,
    queries: QUERIES.map((q, i) => ({
      platform: q.platform,
      query: q.q,
      count: raw[i].length,
      items: raw[i],
    })),
  };

  // Set baseline on first run
  if (isFirstRun) {
    baseline = snapshot;
    await kvSet(BASELINE_KEY, baseline);
  }

  // ── Calculate % change per query ──
  const queryScores = QUERIES.map((q, i) => {
    const todayCount = raw[i].length;
    const baseCount = baseline.queries?.[i]?.count || 0;
    const pctChange = baseCount > 0
      ? Math.round(((todayCount - baseCount) / baseCount) * 1000) / 10
      : (todayCount > 0 ? 100 : 0);
    return {
      platform: q.platform,
      query: q.q,
      todayCount,
      baselineCount: baseCount,
      pctChange: isFirstRun ? 0 : pctChange,
    };
  });

  // ── Aggregate by platform ──
  const platformMap = {};
  const allItems = [];

  QUERIES.forEach((q, i) => {
    if (!platformMap[q.platform]) {
      platformMap[q.platform] = {
        id: q.platform,
        ...PLATFORM_META[q.platform],
        queries: [],
        todayTotal: 0,
        baselineTotal: 0,
        items: [],
      };
    }
    const p = platformMap[q.platform];
    p.queries.push(queryScores[i]);
    p.todayTotal += raw[i].length;
    p.baselineTotal += baseline.queries?.[i]?.count || 0;
    p.items.push(...raw[i]);
    allItems.push(...raw[i].map((item) => ({ ...item, platform: q.platform })));
  });

  const platformList = Object.values(platformMap).map((p) => {
    p.avgChange = p.baselineTotal > 0 && !isFirstRun
      ? Math.round(((p.todayTotal - p.baselineTotal) / p.baselineTotal) * 1000) / 10
      : 0;
    // Dedup items
    const seen = new Set();
    p.items = p.items.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }).slice(0, 25);
    return p;
  });

  // ── Overall index ──
  const totalToday = queryScores.reduce((s, q) => s + q.todayCount, 0);
  const totalBaseline = queryScores.reduce((s, q) => s + q.baselineCount, 0);
  const overallIndex = totalBaseline > 0 && !isFirstRun
    ? Math.round(((totalToday - totalBaseline) / totalBaseline) * 1000) / 10
    : 0;

  // Dedup all items
  const seenAll = new Set();
  const uniqueItems = allItems.filter((item) => {
    if (!item.url || seenAll.has(item.url)) return false;
    seenAll.add(item.url);
    return true;
  });

  // ── AI Sentiment ──
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
          const parsed = JSON.parse(m[0]);
          const scale = uniqueItems.length / Math.min(uniqueItems.length, 80);
          pos = Math.round((parsed.positive || 0) * scale);
          neg = Math.round((parsed.negative || 0) * scale);
          neu = Math.round((parsed.neutral || 0) * scale);
          sentimentMethod = parsed.summary ? `claude-ai: ${parsed.summary}` : "claude-ai";
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

  // ── Storage diagnostic ──
  const storageDiag = await kvDiagnostic();

  // ── Build result ──
  const result = {
    hasBraveKey: true,
    storage: storageDiag,
    storageWarning: !storageDiag.canWrite ? `Blob not working: ${storageDiag.error || "write failed"}` : undefined,
    fetchedAt: snapshot.date,
    isFirstRun,
    baselineDate: baseline.date,
    baselineFreshness: baseline.freshness,
    todayFreshness: freshness,
    index: overallIndex,
    totalToday,
    totalBaseline,
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
    queriesUsed: QUERIES.length * 2, // 2 pages per query
  };

  // ── Persist ──
  await kvSet(CACHE_KEY, result, CACHE_TTL);

  // Store history snapshot
  await kvListPush(HISTORY_KEY, {
    date: snapshot.date,
    index: overallIndex,
    totalToday,
    totalBaseline,
    totalSources: uniqueItems.length,
    freshness,
    platforms: Object.fromEntries(platformList.map((p) => [p.id, {
      today: p.todayTotal,
      baseline: p.baselineTotal,
      change: p.avgChange,
    }])),
    sentiment: result.sentiment,
  }, 365);

  result.history = await kvListGet(HISTORY_KEY, 0, 364);
  res.status(200).json(result);
}
