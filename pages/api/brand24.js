// Brand24 Social Listening Integration
// Uses Brand24 Data API: https://api-data.brand24.com
// Auth: X-Api-Key header
//
// SETUP:
// 1. Get API key from app.brand24.com/account/integrations-api-data
// 2. Get project ID from your Brand24 Madonna project URL
// 3. Add BRAND24_API_KEY and BRAND24_PROJECT_ID to Vercel Environment Variables
//
// Endpoints used:
// - /daily-metrics (mentions, reach, sentiment, engagement by day + by source)
// - /mentions/sentiment (positive/negative daily breakdown)
// - /topics (AI-detected discussion topics)
// - /trending-hashtags (top hashtags with reach + sentiment)
// - /most-followers (top influencers)
// - /project_events (anomaly detection - spikes)
// - /ai-summary (auto-generated text summary)
// - /demographics (audience age, gender, interests)
// - /domains (top sources)
//
// NOTE: Existing Reddit JSONL + YouTube data is preserved as fallback.
// Brand24 supplements, doesn't replace.

import { kvGet, kvSet, kvListPush } from "../../lib/kv";

const CACHE_KEY = "brand24_data";
const CACHE_TTL = 43200; // 12 hours
const B24_BASE = "https://api-data.brand24.com/api-data/v1";

async function b24Get(path, apiKey) {
  try {
    const url = `${B24_BASE}${path}`;
    const r = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[brand24] ${r.status} on ${path}: ${errText.slice(0, 200)}`);
      return null;
    }
    const json = await r.json();
    return json.status === "success" ? (json.data || json.message) : null;
  } catch (err) {
    console.error(`[brand24] Error on ${path}:`, err.message);
    return null;
  }
}

function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const { refresh, action } = req.query;
  const apiKey = process.env.BRAND24_API_KEY;
  const projectId = process.env.BRAND24_PROJECT_ID;

  if (!apiKey) {
    return res.status(200).json({
      configured: false,
      error: "Brand24 not configured.",
      setup: {
        step1: "Get your API key from app.brand24.com/account/integrations-api-data",
        step2: "Get your project ID from the Brand24 dashboard URL (app.brand24.com/project/XXXXXX)",
        step3: "Add BRAND24_API_KEY and BRAND24_PROJECT_ID to Vercel env vars",
      },
    });
  }

  // Helper: list projects if no project ID set
  if (!projectId || action === "list-projects") {
    // Try to get account ID from a test call or use provided one
    const accountId = req.query.accountId || process.env.BRAND24_ACCOUNT_ID;
    if (accountId) {
      const projects = await b24Get(`/account/${accountId}/projects_list/`, apiKey);
      return res.status(200).json({
        configured: true,
        needsProjectId: true,
        accountId,
        projects: projects?.projects_list || projects,
        message: "Set BRAND24_PROJECT_ID to one of these project IDs",
      });
    }
    return res.status(200).json({
      configured: true,
      needsProjectId: true,
      error: "BRAND24_PROJECT_ID not set. Check your Brand24 dashboard URL for the project number, or set BRAND24_ACCOUNT_ID and call ?action=list-projects",
    });
  }

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.dailyMetrics) return res.status(200).json(cached);
    } catch {}
  }

  const today = dateStr(0);
  const weekAgo = dateStr(7);
  const monthAgo = dateStr(30);

  // Fetch all data in parallel for speed
  const [
    dailyMetrics,
    sentiment,
    topics,
    hashtags,
    influencers,
    events,
    aiSummary,
    demographics,
    domains,
  ] = await Promise.all([
    b24Get(`/project/${projectId}/daily-metrics?from=${weekAgo}&to=${today}&includeBySource=true`, apiKey),
    b24Get(`/project/${projectId}/mentions/sentiment?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/topics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/trending-hashtags?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/most-followers?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/project_events?date_from=${monthAgo}&date_to=${today}&sort_order=desc&limit=10`, apiKey),
    b24Get(`/project/${projectId}/ai-summary?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/demographics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/domains/?date_from=${weekAgo}&date_to=${today}`, apiKey),
  ]);

  // Process daily metrics
  const days = dailyMetrics?.days || [];
  const totalMentions = days.reduce((s, d) => s + (d.mentions_count || 0), 0);
  const totalReach = days.reduce((s, d) => s + (d.reach_total || 0), 0);
  const totalEngagement = days.reduce((s, d) => {
    const e = d.engagement || {};
    return s + (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
  }, 0);

  // Sentiment totals
  const sentimentData = sentiment || {};
  const posTotal = sentimentData.total_positive || days.reduce((s, d) => s + (d.sentiment?.positive || 0), 0);
  const negTotal = sentimentData.total_negative || days.reduce((s, d) => s + (d.sentiment?.negative || 0), 0);
  const neuTotal = Math.max(totalMentions - posTotal - negTotal, 0);

  // Platform breakdown from daily metrics
  const platformTotals = {};
  days.forEach(d => {
    (d.by_source || []).forEach(src => {
      if (!platformTotals[src.source]) platformTotals[src.source] = { mentions: 0, reach: 0 };
      platformTotals[src.source].mentions += src.mentions_count || 0;
      platformTotals[src.source].reach += src.reach || 0;
    });
  });

  const result = {
    configured: true,
    fetchedAt: new Date().toISOString(),
    period: { from: weekAgo, to: today },
    projectId,

    // Core metrics
    totalMentions,
    totalReach,
    totalEngagement,
    sentiment: {
      positive: posTotal,
      negative: negTotal,
      neutral: neuTotal,
      positivePercent: totalMentions > 0 ? Math.round((posTotal / totalMentions) * 100) : 0,
      negativePercent: totalMentions > 0 ? Math.round((negTotal / totalMentions) * 100) : 0,
    },

    // Daily breakdown
    dailyMetrics: days.map(d => ({
      date: d.date,
      mentions: d.mentions_count || 0,
      reach: d.reach_total || 0,
      sentiment: d.sentiment || {},
      engagement: d.engagement || {},
      bySource: d.by_source || [],
    })),

    // Platform breakdown
    platforms: Object.entries(platformTotals)
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.mentions - a.mentions),

    // AI topics
    topics: (topics?.topics || []).map(t => ({
      id: t.topic_id,
      name: t.name,
      description: t.description,
      mentions: t.mentions,
      reach: t.reach,
      sentiment: t.sentiment,
      shareOfVoice: t.share_of_voice,
    })),

    // Trending hashtags
    hashtags: (hashtags?.hashtags || []).slice(0, 20).map(h => ({
      hashtag: h.hashtag,
      mentions: h.mentions_count,
      reach: h.social_media_reach,
      sentiment: h.sentiment_score,
    })),

    // Top influencers
    influencers: (influencers || []).slice(0, 15).map(a => ({
      name: a.name,
      url: a.url,
      followers: a.follower_count,
      mentions: a.mentions_count,
      reach: a.reach,
    })),

    // Anomaly events (spikes)
    events: (events?.anomalies || []).map(e => ({
      date: e.anomaly_date,
      description: e.description,
      peakMentions: e.peak_mentions,
      peakReach: e.peak_reach,
    })),

    // AI summary
    aiSummary: typeof aiSummary === "string" ? aiSummary : aiSummary?.summary || null,

    // Demographics
    demographics: demographics || null,

    // Top domains
    domains: (domains?.domains || []).slice(0, 20).map(d => ({
      domain: d.domain,
      mentions: d.mentions_count,
      reach: d.reach,
      influence: d.influence_score,
    })),
  };

  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  // Track daily snapshot for trend history
  try {
    await kvListPush("brand24_history", {
      date: new Date().toISOString(),
      totalMentions,
      totalReach,
      totalEngagement,
      posPercent: result.sentiment.positivePercent,
      negPercent: result.sentiment.negativePercent,
      platforms: result.platforms.length,
      topicsCount: result.topics.length,
    }, 365);
  } catch {}

  res.status(200).json(result);
}
