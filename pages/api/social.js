// Social listening -- uses Brave Search to surface Madonna mentions across social platforms
// Only 4 Brave API calls per scan, cached for 6 hours

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "social:pulse";
const CACHE_TTL = 21600; // 6 hours

const PLATFORMS = [
  { id: "reddit", label: "Reddit", query: '"Madonna" site:reddit.com', icon: "R" },
  { id: "twitter", label: "Twitter / X", query: '"Madonna" site:twitter.com OR site:x.com', icon: "X" },
  { id: "tiktok", label: "TikTok", query: '"Madonna" site:tiktok.com', icon: "T" },
  { id: "youtube", label: "YouTube", query: '"Madonna" site:youtube.com', icon: "Y" },
];

async function braveSearch(query, apiKey) {
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ q: query, count: "12", freshness: "pw" });
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
      source: new URL(r.url).hostname.replace("www.", ""),
    }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  if (!apiKey) {
    return res.status(200).json({ hasBraveKey: false, platforms: [] });
  }

  // Check cache
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      return res.status(200).json(cached);
    }
  }

  // Fetch all platforms in parallel
  const results = await Promise.all(
    PLATFORMS.map(async (p) => {
      const items = await braveSearch(p.query, apiKey);
      return {
        id: p.id,
        label: p.label,
        icon: p.icon,
        items: items.map((item) => ({ ...item, platform: p.id })),
      };
    })
  );

  // Simple sentiment heuristic on titles/descriptions
  const allItems = results.flatMap((r) => r.items);
  const positive = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay", "masterpiece", "brilliant"];
  const negative = ["hate", "bad", "worst", "overrated", "cringe", "fake", "surgery", "flop", "awful"];
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
    platforms: results,
    sentiment: {
      positive: Math.round((pos / total) * 100),
      negative: Math.round((neg / total) * 100),
      neutral: Math.round((neu / total) * 100),
      total: allItems.length,
    },
  };

  await kvSet(CACHE_KEY, result, CACHE_TTL);
  res.status(200).json(result);
}
