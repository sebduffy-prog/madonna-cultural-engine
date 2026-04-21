// Google Trends — low-volume daily check on Madonna-specific terms.
// Uses the `google-trends-api` npm package (unofficial wrapper on public endpoints).
// Rate limits are generous for our once-a-day schedule.
//
// Google Trends values are RELATIVE (0-100) within each keyword's own time window,
// so you can see shape/timing but not compare absolute volume across keywords.

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "google_trends_madonna";
const CACHE_TTL = 43200; // 12 hours — we only refresh daily anyway

// Keywords to track. Extend this list as campaigns/moments emerge.
const KEYWORDS = [
  "Madonna",
  "Confessions II",
  "COADF2",
  "Confessions on a Dance Floor",
  "Madonna new album",
  "Madonna tour 2026",
];

// Geo: "" = worldwide. Set to "GB" / "US" for per-country views.
const GEO = "";

async function trendsModule() {
  try {
    const mod = await import("google-trends-api");
    return mod.default || mod;
  } catch (err) {
    console.error("[google-trends] package not installed:", err.message);
    return null;
  }
}

async function interestOverTime(trends, keyword) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 86400000 * 90); // 90 days
    const raw = await trends.interestOverTime({
      keyword,
      startTime,
      endTime,
      geo: GEO,
    });
    const parsed = JSON.parse(raw);
    const timeline = (parsed.default?.timelineData || []).map(p => ({
      date: p.formattedAxisTime || p.formattedTime,
      timestamp: p.time,
      value: (p.value && p.value[0]) || 0,
      hasData: !p.isPartial,
    }));
    const recent7 = timeline.slice(-7);
    const prev7 = timeline.slice(-14, -7);
    const recent7Avg = recent7.length ? recent7.reduce((s, p) => s + p.value, 0) / recent7.length : 0;
    const prev7Avg = prev7.length ? prev7.reduce((s, p) => s + p.value, 0) / prev7.length : 0;
    const change = prev7Avg > 0 ? ((recent7Avg - prev7Avg) / prev7Avg) * 100 : 0;
    const peak = timeline.reduce((max, p) => p.value > max ? p.value : max, 0);
    return {
      keyword,
      timeline,
      recent7Avg: Math.round(recent7Avg * 10) / 10,
      prev7Avg: Math.round(prev7Avg * 10) / 10,
      weekChangePercent: Math.round(change * 10) / 10,
      peakInterest: peak,
      error: null,
    };
  } catch (err) {
    return { keyword, timeline: [], recent7Avg: 0, prev7Avg: 0, weekChangePercent: 0, peakInterest: 0, error: err.message };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.keywords) return res.status(200).json(cached);
    } catch {}
  }

  const trends = await trendsModule();
  if (!trends) {
    return res.status(200).json({
      configured: false,
      error: "google-trends-api npm package not installed. Run `npm install google-trends-api` (already in package.json — redeploy on Vercel to pick it up).",
    });
  }

  // Query sequentially rather than parallel to avoid Google rate-limiting this IP.
  const keywords = [];
  for (const kw of KEYWORDS) {
    keywords.push(await interestOverTime(trends, kw));
    await new Promise(r => setTimeout(r, 400));
  }

  const topMover = [...keywords]
    .filter(k => !k.error && k.prev7Avg > 1)
    .sort((a, b) => b.weekChangePercent - a.weekChangePercent)[0] || null;

  const result = {
    source: "google-trends",
    fetchedAt: new Date().toISOString(),
    geo: GEO || "worldwide",
    window: "last 90 days",
    note: "Values are 0-100 RELATIVE to each keyword's own peak in the window — use shape/timing, not absolute comparison.",
    keywords,
    topMover: topMover ? { keyword: topMover.keyword, weekChangePercent: topMover.weekChangePercent } : null,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
  return res.status(200).json(result);
}
