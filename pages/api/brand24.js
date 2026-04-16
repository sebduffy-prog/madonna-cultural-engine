// Brand24 Social Listening Integration
// Uses Brand24 Data API: https://api-data.brand24.com
// Auth: X-Api-Key header
//
// SETUP:
// 1. Get API key from app.brand24.com/account/integrations-api-data
// 2. Get project ID from your Brand24 Madonna project URL
// 3. Add BRAND24_API_KEY and BRAND24_PROJECT_ID to Vercel Environment Variables

import { kvGet, kvSet, kvListPush } from "../../lib/kv";

const CACHE_KEY = "brand24_data";
const CACHE_TTL = 43200;
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
      console.error(`[brand24] ${r.status} on ${path}: ${errText.slice(0, 300)}`);
      return null;
    }
    const json = await r.json();
    // Brand24 wraps responses in { status: "success", data: ... } or { status: "success", message: ... }
    // But some endpoints return arrays directly, others return objects
    if (json.status === "success") return json.data ?? json.message ?? json;
    if (json.status === "fail" || json.status === "error") {
      console.error(`[brand24] API error on ${path}: ${json.message}`);
      return null;
    }
    // Some endpoints may not wrap in status
    return json;
  } catch (err) {
    console.error(`[brand24] Error on ${path}:`, err.message);
    return null;
  }
}

function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

// Safely get array from response (handles both array and object-with-array)
function safeArray(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (key && data[key] && Array.isArray(data[key])) return data[key];
  // Try common wrapper keys
  for (const k of [key, "items", "results", "list", "data"].filter(Boolean)) {
    if (data[k] && Array.isArray(data[k])) return data[k];
  }
  return [];
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
        step2: "Get your project ID from the Brand24 dashboard URL",
        step3: "Add BRAND24_API_KEY and BRAND24_PROJECT_ID to Vercel env vars",
      },
    });
  }

  if (!projectId || action === "list-projects") {
    const accountId = req.query.accountId || process.env.BRAND24_ACCOUNT_ID;
    if (accountId) {
      const projects = await b24Get(`/account/${accountId}/projects_list/`, apiKey);
      return res.status(200).json({ configured: true, needsProjectId: true, accountId, projects });
    }
    return res.status(200).json({
      configured: true, needsProjectId: true,
      error: "BRAND24_PROJECT_ID not set.",
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

  // Fetch ALL Brand24 endpoints in parallel — every metric available
  const [
    dailyMetricsRaw, sentimentRaw, mentionCountRaw, reachRaw,
    topicsRaw, hashtagsRaw, influencersRaw, eventsRaw,
    aiSummaryRaw, aiInsightsRaw, demographicsRaw,
    domainsRaw, hotHoursRaw, trendingLinksRaw, activeSitesRaw,
  ] = await Promise.all([
    b24Get(`/project/${projectId}/daily-metrics?from=${weekAgo}&to=${today}&includeBySource=true`, apiKey),
    b24Get(`/project/${projectId}/mentions/sentiment?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/mentions/count?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/mentions/reach?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/topics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/trending-hashtags?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/most-followers?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/project_events?date_from=${monthAgo}&date_to=${today}&sort_order=desc&limit=20`, apiKey),
    b24Get(`/project/${projectId}/ai-summary?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/ai-insights?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/demographics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/domains/?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/hot-hours?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/trending-links?date_from=${weekAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/most-active-sites?date_from=${weekAgo}&date_to=${today}`, apiKey),
  ]);

  // Process daily metrics — the core data
  const days = safeArray(dailyMetricsRaw, "days");
  const totalMentions = days.reduce((s, d) => s + (d.mentions_count || 0), 0);
  const totalReach = days.reduce((s, d) => s + (d.reach_total || 0), 0);
  const totalEngagement = days.reduce((s, d) => {
    const e = d.engagement || {};
    return s + (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
  }, 0);

  // Sentiment
  const posTotal = sentimentRaw?.total_positive || days.reduce((s, d) => s + (d.sentiment?.positive || 0), 0);
  const negTotal = sentimentRaw?.total_negative || days.reduce((s, d) => s + (d.sentiment?.negative || 0), 0);
  const neuTotal = Math.max(totalMentions - posTotal - negTotal, 0);

  // Platform breakdown
  const platformTotals = {};
  days.forEach(d => {
    safeArray(d, "by_source").forEach(src => {
      const p = src.source || "web";
      if (!platformTotals[p]) platformTotals[p] = { mentions: 0, reach: 0, engagement: 0 };
      platformTotals[p].mentions += src.mentions_count || 0;
      platformTotals[p].reach += src.reach || 0;
    });
  });

  // Topics
  const topicsArr = safeArray(topicsRaw, "topics");

  // Hashtags
  const hashtagsArr = safeArray(hashtagsRaw, "hashtags");

  // Influencers — could be array directly or nested
  const influencersArr = safeArray(influencersRaw, "authors");

  // Events
  const eventsArr = safeArray(eventsRaw, "anomalies");

  // Domains
  const domainsArr = safeArray(domainsRaw, "domains");

  // Hot hours
  const hotHoursArr = safeArray(hotHoursRaw, "hot_hours");

  // Mention counts daily (from dedicated endpoint)
  const mentionCountDaily = mentionCountRaw?.daily || mentionCountRaw?.data || mentionCountRaw;
  const mentionCountTotal = mentionCountRaw?.total || totalMentions;

  // Reach daily (from dedicated endpoint — social vs non-social split)
  const reachDaily = reachRaw?.daily || reachRaw?.data || reachRaw;
  const reachSocial = reachRaw?.total_social_media_reach || 0;
  const reachNonSocial = reachRaw?.total_non_social_media_reach || 0;

  // AI Summary
  let aiSummary = null;
  if (typeof aiSummaryRaw === "string") aiSummary = aiSummaryRaw;
  else if (aiSummaryRaw?.summary) aiSummary = aiSummaryRaw.summary;
  else if (aiSummaryRaw?.text) aiSummary = aiSummaryRaw.text;

  // AI Insights (charts, headlines, actionable insights)
  const aiInsights = safeArray(aiInsightsRaw, "insights");

  // Trending links
  const trendingLinks = safeArray(trendingLinksRaw, "trending_links");

  // Most active sites
  const activeSites = safeArray(activeSitesRaw, "sites");

  // ═══ DERIVED / COMPUTED METRICS ═══

  // Mention velocity (mentions per hour, trending direction)
  const mentionVelocity = days.length > 1 ? {
    current: days[days.length - 1]?.mentions_count || 0,
    previous: days[days.length - 2]?.mentions_count || 0,
    perHour: Math.round(((days[days.length - 1]?.mentions_count || 0) / 24) * 10) / 10,
    trend: days.length >= 2 ? ((days[days.length - 1]?.mentions_count || 0) - (days[days.length - 2]?.mentions_count || 0)) : 0,
    weekAvg: days.length > 0 ? Math.round(totalMentions / days.length) : 0,
  } : null;

  // Engagement rate = engagement / reach
  const engagementRate = totalReach > 0 ? Math.round((totalEngagement / totalReach) * 10000) / 100 : 0;

  // Sentiment-weighted reach = positive reach - negative reach (net positive exposure)
  const sentimentWeightedReach = totalReach > 0 && totalMentions > 0
    ? Math.round(totalReach * ((posTotal - negTotal) / totalMentions))
    : 0;

  // Virality index = shares / total mentions (how shareable is the conversation)
  const totalShares = days.reduce((s, d) => s + (d.engagement?.shares || 0), 0);
  const viralityIndex = totalMentions > 0 ? Math.round((totalShares / totalMentions) * 1000) / 10 : 0;

  // Platform diversity score (0-100, higher = more evenly spread across platforms)
  const platformMentions = Object.values(platformTotals).map(p => p.mentions);
  const platformDiversity = platformMentions.length > 1 ? (() => {
    const total = platformMentions.reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    const shares = platformMentions.map(v => v / total);
    const entropy = -shares.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
    const maxEntropy = Math.log2(platformMentions.length);
    return Math.round((entropy / maxEntropy) * 100);
  })() : 0;

  // Influence concentration = top 5 influencer reach / total reach
  const top5InfluencerReach = influencersArr.slice(0, 5).reduce((s, a) => s + (a.reach || 0), 0);
  const influenceConcentration = totalReach > 0 ? Math.round((top5InfluencerReach / totalReach) * 100) : 0;

  // Social vs media split
  const socialReachPct = (reachSocial + reachNonSocial) > 0
    ? Math.round((reachSocial / (reachSocial + reachNonSocial)) * 100)
    : 50;

  // Momentum score (composite: velocity trend + sentiment + engagement)
  const momentumScore = Math.round(
    (mentionVelocity?.trend > 0 ? 30 : mentionVelocity?.trend < 0 ? -10 : 10) +
    ((posTotal / Math.max(totalMentions, 1)) * 40) +
    (Math.min(engagementRate, 5) * 6)
  );

  const result = {
    configured: true,
    fetchedAt: new Date().toISOString(),
    period: { from: weekAgo, to: today },
    projectId,

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

    dailyMetrics: days.map(d => ({
      date: d.date,
      mentions: d.mentions_count || 0,
      reach: d.reach_total || 0,
      sentiment: d.sentiment || {},
      engagement: d.engagement || {},
      bySource: safeArray(d, "by_source"),
    })),

    // Sentiment daily breakdown (from dedicated endpoint)
    sentimentDaily: sentimentRaw?.daily || sentimentRaw?.data || null,

    platforms: Object.entries(platformTotals)
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.mentions - a.mentions),

    topics: topicsArr.map(t => ({
      id: t.topic_id, name: t.name, description: t.description,
      mentions: t.mentions, reach: t.reach, sentiment: t.sentiment,
      shareOfVoice: t.share_of_voice,
    })),

    hashtags: hashtagsArr.slice(0, 30).map(h => ({
      hashtag: h.hashtag, mentions: h.mentions_count,
      reach: h.social_media_reach, sentiment: h.sentiment_score,
    })),

    influencers: influencersArr.slice(0, 20).map(a => ({
      name: a.name || a.author_name, url: a.url,
      followers: a.follower_count || a.followers,
      mentions: a.mentions_count || a.mentions, reach: a.reach,
    })),

    events: eventsArr.map(e => ({
      date: e.anomaly_date || e.date,
      description: e.description,
      peakMentions: e.peak_mentions, peakReach: e.peak_reach,
    })),

    hotHours: hotHoursArr.slice(0, 10).map(h => ({
      day: h.day_of_week, hour: h.hour, mentions: h.mentions_count,
    })),

    aiSummary,
    demographics: demographicsRaw || null,

    domains: domainsArr.slice(0, 25).map(d => ({
      domain: d.domain, mentions: d.mentions_count,
      reach: d.reach, influence: d.influence_score, visits: d.visits,
    })),

    trendingLinks: trendingLinks.slice(0, 20).map(l => ({
      url: l.url, mentions: l.mentions_count,
    })),

    activeSites: activeSites.slice(0, 20).map(s => ({
      domain: s.domain, mentions: s.mentions_count, reach: s.reach,
    })),

    aiInsights: aiInsights.slice(0, 10).map(i => ({
      type: i.insightType, chartType: i.chartType,
      headline: i.headline, text: i.text, link: i.link,
    })),

    // Reach split (social vs non-social)
    reachBreakdown: {
      social: reachSocial,
      nonSocial: reachNonSocial,
      socialPct: socialReachPct,
    },

    // Mention count daily (granular from dedicated endpoint)
    mentionCountDaily: typeof mentionCountDaily === "object" && !Array.isArray(mentionCountDaily) ? mentionCountDaily : null,

    // ═══ DERIVED METRICS ═══
    derived: {
      mentionVelocity,
      engagementRate,
      sentimentWeightedReach,
      viralityIndex,
      platformDiversity,
      influenceConcentration,
      socialReachPct,
      momentumScore,
      totalShares,
      totalLikes: days.reduce((s, d) => s + (d.engagement?.likes || 0), 0),
      totalComments: days.reduce((s, d) => s + (d.engagement?.comments || 0), 0),
    },

    // Debug info
    _debug: {
      dailyMetricsType: typeof dailyMetricsRaw,
      dailyMetricsKeys: dailyMetricsRaw ? Object.keys(dailyMetricsRaw).slice(0, 5) : null,
      influencersType: typeof influencersRaw,
      influencersIsArray: Array.isArray(influencersRaw),
      topicsType: typeof topicsRaw,
      topicsKeys: topicsRaw ? Object.keys(topicsRaw).slice(0, 5) : null,
      hashtagsKeys: hashtagsRaw ? Object.keys(hashtagsRaw).slice(0, 5) : null,
      eventsKeys: eventsRaw ? Object.keys(eventsRaw).slice(0, 5) : null,
      domainsKeys: domainsRaw ? Object.keys(domainsRaw).slice(0, 5) : null,
      sentimentKeys: sentimentRaw ? Object.keys(sentimentRaw).slice(0, 5) : null,
      aiSummaryType: typeof aiSummaryRaw,
    },
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}

  try {
    await kvListPush("brand24_history", {
      date: new Date().toISOString(),
      totalMentions, totalReach, totalEngagement,
      posPercent: result.sentiment.positivePercent,
      negPercent: result.sentiment.negativePercent,
      platforms: result.platforms.length,
    }, 365);
  } catch {}

  res.status(200).json(result);
}
