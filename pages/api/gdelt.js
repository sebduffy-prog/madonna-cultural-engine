// GDELT integration — free global news/event database.
// Two modes combined into one response:
//   1. ArtList — recent articles mentioning Madonna across thousands of global outlets
//   2. TimelineTone — mentions over time with article tone (sentiment proxy)
//
// No API key required. Rate limits are generous for daily/hourly polling.
// Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "gdelt_madonna";
const CACHE_TTL = 14400; // 4 hours
const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const QUERY = '"madonna" (music OR singer OR album OR tour OR pop)';

async function gdeltGet(params) {
  const url = `${BASE}?${new URLSearchParams(params).toString()}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { return null; }
  } catch (err) {
    console.error(`[gdelt] ${err.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const timespan = req.query.timespan || "7d";

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.articles) return res.status(200).json(cached);
    } catch {}
  }

  const [artlistRaw, timelineRaw, tonelineRaw] = await Promise.all([
    gdeltGet({ query: QUERY, mode: "ArtList", maxrecords: 150, format: "json", timespan, sort: "DateDesc" }),
    gdeltGet({ query: QUERY, mode: "TimelineVolInfo", format: "json", timespan }),
    gdeltGet({ query: QUERY, mode: "TimelineTone", format: "json", timespan }),
  ]);

  const articles = (artlistRaw?.articles || []).map(a => ({
    url: a.url,
    title: a.title,
    domain: a.domain,
    language: a.language,
    country: a.sourcecountry,
    seenAt: a.seendate,
    tone: typeof a.tone === "number" ? a.tone : null,
    image: a.socialimage || null,
  }));

  const timeline = (timelineRaw?.timeline?.[0]?.data || []).map(d => ({
    date: d.date,
    value: d.value,
    normalized: d.norm ?? null,
  }));

  const toneline = (tonelineRaw?.timeline?.[0]?.data || []).map(d => ({
    date: d.date,
    avgTone: d.value,
  }));

  const domainCounts = {};
  const countryCounts = {};
  articles.forEach(a => {
    if (a.domain) domainCounts[a.domain] = (domainCounts[a.domain] || 0) + 1;
    if (a.country) countryCounts[a.country] = (countryCounts[a.country] || 0) + 1;
  });
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([domain, count]) => ({ domain, count }));
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([country, count]) => ({ country, count }));

  const avgTone = articles.length
    ? Math.round((articles.reduce((s, a) => s + (a.tone || 0), 0) / articles.length) * 100) / 100
    : 0;

  const result = {
    source: "gdelt",
    fetchedAt: new Date().toISOString(),
    period: { timespan },
    query: QUERY,
    totalArticles: articles.length,
    avgTone,
    articles: articles.slice(0, 100),
    timeline,
    toneline,
    topDomains,
    topCountries,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
  return res.status(200).json(result);
}
