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
const CACHE_TTL = 10800;
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

  // Time range support: ?range=30 (default), ?range=7, ?range=14, ?range=90
  const range = parseInt(req.query.range) || 30;
  const cacheKeySuffix = range !== 30 ? `_${range}d` : "";

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY + cacheKeySuffix), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.dailyMetrics) return res.status(200).json(cached);
    } catch {}
  }

  const today = dateStr(0);
  const rangeAgo = dateStr(range);
  const monthAgo = dateStr(30);

  // Fetch ALL Brand24 endpoints in parallel — every metric available
  const [
    dailyMetricsRaw, sentimentRaw, mentionCountRaw, reachRaw,
    topicsRaw, hashtagsRaw, influencersRaw, eventsRaw,
    aiSummaryRaw, aiInsightsRaw, demographicsRaw,
    domainsRaw, hotHoursRaw, trendingLinksRaw, activeSitesRaw,
  ] = await Promise.all([
    b24Get(`/project/${projectId}/daily-metrics?from=${rangeAgo}&to=${today}&includeBySource=true`, apiKey),
    b24Get(`/project/${projectId}/mentions/sentiment?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/mentions/count?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/mentions/reach?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/topics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/trending-hashtags?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/most-followers?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/project_events?date_from=${monthAgo}&date_to=${today}&sort_order=desc&limit=20`, apiKey),
    b24Get(`/project/${projectId}/ai-summary?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/ai-insights?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/demographics?date_from=${monthAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/domains/?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/hot-hours?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/trending-links?date_from=${rangeAgo}&date_to=${today}`, apiKey),
    b24Get(`/project/${projectId}/most-active-sites?date_from=${rangeAgo}&date_to=${today}`, apiKey),
  ]);

  // Process daily metrics — the core data
  const days = safeArray(dailyMetricsRaw, "days");
  const totalMentions = days.reduce((s, d) => s + (d.mentions_count || 0), 0);
  const totalReach = days.reduce((s, d) => s + (d.reach_total || 0), 0);
  const totalEngagement = days.reduce((s, d) => {
    const e = d.engagement || {};
    return s + (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
  }, 0);

  // ─── Sentiment: reconcile across endpoints ───
  // daily-metrics gives us mentions_count per day (source of truth for totals).
  // sentiment endpoint gives positive/negative counts.
  // Per-day sentiment counts come from sentimentRaw.daily when available (raw ints),
  // otherwise fall back to proportion * mentions_count (introduces rounding drift).
  const sentimentMentionsTotal = sentimentRaw?.total_mentions ?? sentimentRaw?.mentions?.total ?? null;
  const posTotal = sentimentRaw?.total_positive_mentions ?? sentimentRaw?.positive_mentions?.total ?? 0;
  const negTotal = sentimentRaw?.total_negative_mentions ?? sentimentRaw?.negative_mentions?.total ?? 0;

  // Use daily-metrics mentions sum as the canonical total; neutral derived against it.
  const canonicalMentionsTotal = totalMentions;
  const neuTotal = Math.max(canonicalMentionsTotal - posTotal - negTotal, 0);
  const sentDenominator = Math.max(posTotal + negTotal + neuTotal, 1);

  // Build a reconciliation record so discrepancies are visible instead of hidden.
  const sentimentEndpointMismatch =
    sentimentMentionsTotal !== null && sentimentMentionsTotal !== canonicalMentionsTotal;
  const reconciliation = {
    dailyMetricsTotal: canonicalMentionsTotal,
    sentimentEndpointTotal: sentimentMentionsTotal,
    mentionCountEndpointTotal: mentionCountRaw?.total ?? null,
    canonicalSource: "daily-metrics",
    delta: sentimentEndpointMismatch ? (sentimentMentionsTotal - canonicalMentionsTotal) : 0,
    deltaPercent: sentimentEndpointMismatch && canonicalMentionsTotal > 0
      ? Math.round(((sentimentMentionsTotal - canonicalMentionsTotal) / canonicalMentionsTotal) * 1000) / 10
      : 0,
    note: sentimentEndpointMismatch
      ? "Brand24's sentiment endpoint and daily-metrics endpoint returned different mention totals for the same window. Displayed totals use daily-metrics; investigate if delta > 5%."
      : null,
  };

  // Index raw per-day sentiment counts from the sentiment endpoint (if provided).
  const sentimentDailyRaw = safeArray(sentimentRaw, "daily").concat(safeArray(sentimentRaw, "data"));
  const sentimentDailyByDate = {};
  sentimentDailyRaw.forEach(d => {
    const date = d.date || d.day;
    if (!date) return;
    sentimentDailyByDate[date] = {
      positive: d.positive ?? d.positive_mentions ?? null,
      negative: d.negative ?? d.negative_mentions ?? null,
      neutral: d.neutral ?? d.neutral_mentions ?? null,
      total: d.total ?? d.mentions ?? null,
    };
  });

  // Platform breakdown — normalise every incoming source name to a canonical key,
  // because Brand24 uses a mix of singular/plural/numeric/capitalised forms across
  // endpoints (e.g. "blog" vs "blogs", "video" vs "videos", source id 7 vs "news").
  function normaliseSource(s) {
    const v = String(s || "").toLowerCase().trim();
    if (["1", "twitter", "x", "tweet", "tweets"].includes(v)) return "twitter";
    if (["2", "instagram", "ig"].includes(v)) return "instagram";
    if (["5", "facebook", "fb"].includes(v)) return "facebook";
    if (["11", "tiktok"].includes(v)) return "tiktok";
    if (["4", "video", "videos", "youtube", "vimeo"].includes(v)) return "videos";
    if (["6", "forum", "forums", "reddit", "discussion"].includes(v)) return "forums";
    if (["3", "blog", "blogs"].includes(v)) return "blogs";
    if (["9", "podcast", "podcasts"].includes(v)) return "podcasts";
    if (["7", "news"].includes(v)) return "news";
    if (["8", "web", "website", "webpage"].includes(v)) return "web";
    return v || "web";
  }

  const platformTotals = {};
  const rawSourceKeys = new Set();
  days.forEach(d => {
    safeArray(d, "by_source").forEach(src => {
      const rawKey = src.source ?? src.source_type ?? src.type ?? src.name ?? src.id;
      rawSourceKeys.add(String(rawKey));
      const p = normaliseSource(rawKey);
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
  // Compute social vs non-social from platform breakdown if dedicated endpoint is empty
  const socialPlatforms = ["twitter", "facebook", "instagram", "tiktok", "reddit", "youtube", "linkedin"];
  let reachSocial = reachRaw?.total_social_media_reach || 0;
  let reachNonSocial = reachRaw?.total_non_social_media_reach || 0;
  if (reachSocial === 0 && reachNonSocial === 0) {
    Object.entries(platformTotals).forEach(([p, data]) => {
      if (socialPlatforms.includes(p)) reachSocial += data.reach;
      else reachNonSocial += data.reach;
    });
  }

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
  const sentimentWeightedReach = totalReach > 0 && sentDenominator > 0
    ? Math.round(totalReach * ((posTotal - negTotal) / sentDenominator))
    : 0;

  const totalShares = days.reduce((s, d) => s + (d.engagement?.shares || 0), 0);

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

  // ─── Anomaly types from Brand24's project_events endpoint ───
  // Brand24 classifies each anomaly with flags: hashtag / user-discussion / emotional
  // / news / social-media / non-social-media. Surface them so the UI can say WHY a day spiked.
  function anomalyTypes(e) {
    const types = [];
    if (e.is_hashtag_anomaly)          types.push("hashtag");
    if (e.is_emotional_anomaly)        types.push("emotional");
    if (e.is_news_anomaly)             types.push("news");
    if (e.is_social_media_anomaly)     types.push("social");
    if (e.is_non_social_media_anomaly) types.push("media");
    if (e.is_user_discussion_anomaly)  types.push("discussion");
    return types;
  }
  const eventsByDate = {};
  eventsArr.forEach(e => {
    const d = (e.anomaly_date || e.date || "").slice(0, 10);
    if (!d) return;
    eventsByDate[d] = {
      description: e.description || null,
      peakMentions: e.peak_mentions || 0,
      peakReach: e.peak_reach || 0,
      types: anomalyTypes(e),
    };
  });

  // ─── Significant days: flag spikes above 2x the trailing 7-day average ───
  // For each day compute the mean of the preceding up-to-7 days (excluding itself).
  // Days with mentions >= 2x that average are flagged as significant, then merged
  // with any matching Brand24 anomaly entry so we can label WHY the day spiked.
  const significantDays = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const m = d.mentions_count || 0;
    const window = days.slice(Math.max(0, i - 7), i);
    if (window.length < 3) continue; // need at least 3 days of baseline
    const baseline = window.reduce((s, w) => s + (w.mentions_count || 0), 0) / window.length;
    if (baseline < 1) continue;
    const multiple = m / baseline;
    if (multiple >= 2) {
      const event = eventsByDate[d.date];
      significantDays.push({
        date: d.date,
        mentions: m,
        baselineMentions: Math.round(baseline),
        multiple: Math.round(multiple * 10) / 10,
        reach: d.reach_total || 0,
        severity: multiple >= 4 ? "major" : multiple >= 3 ? "notable" : "mild",
        anomalyTypes: event?.types || [],
        anomalyDescription: event?.description || null,
      });
    }
  }

  // ─── Source coverage: all known Brand24 source categories with status ───
  // Makes Brand24 blind spots (Instagram, Facebook) explicit rather than silently absent.
  const KNOWN_SOURCES = [
    { key: "news",      label: "News",                   typicallyCovered: true },
    { key: "twitter",   label: "Twitter / X",            typicallyCovered: true },
    { key: "tiktok",    label: "TikTok",                 typicallyCovered: true },
    { key: "forums",    label: "Forums",                 typicallyCovered: true },
    { key: "blogs",     label: "Blogs",                  typicallyCovered: true },
    { key: "videos",    label: "Videos (YouTube etc.)",  typicallyCovered: true },
    { key: "web",       label: "Web",                    typicallyCovered: true },
    { key: "podcasts",  label: "Podcasts",               typicallyCovered: true, caveat: "Partial coverage — only podcasts Brand24 has indexed." },
    { key: "instagram", label: "Instagram",              typicallyCovered: false, caveat: "Meta blocks third-party API access. Brand24 cannot collect Instagram mentions." },
    { key: "facebook",  label: "Facebook",               typicallyCovered: false, caveat: "Meta blocks third-party API access. Brand24 cannot collect Facebook mentions." },
  ];
  const coverage = KNOWN_SOURCES.map(s => {
    const found = platformTotals[s.key];
    const mentions = found?.mentions || 0;
    const status = !s.typicallyCovered ? "not-covered"
                 : mentions === 0 ? "no-mentions"
                 : "covered";
    return {
      key: s.key,
      label: s.label,
      mentions,
      reach: found?.reach || 0,
      status,
      caveat: s.caveat || null,
    };
  });

  const result = {
    configured: true,
    fetchedAt: new Date().toISOString(),
    period: { from: rangeAgo, to: today, days: range },
    projectId,

    totalMentions,
    totalReach,
    totalEngagement,
    sentiment: {
      positive: posTotal,
      negative: negTotal,
      neutral: neuTotal,
      positivePercent: Math.round((posTotal / sentDenominator) * 100),
      negativePercent: Math.round((negTotal / sentDenominator) * 100),
      neutralPercent: Math.round((neuTotal / sentDenominator) * 100),
    },

    dailyMetrics: days.map(d => {
      const m = d.mentions_count || 0;
      const sp = d.sentiment || {};
      const rawCounts = sentimentDailyByDate[d.date];
      // Prefer raw integer counts from the sentiment endpoint; fall back to proportion × mentions.
      const pos = rawCounts?.positive != null ? rawCounts.positive : Math.round((sp.positive || 0) * m);
      const neg = rawCounts?.negative != null ? rawCounts.negative : Math.round((sp.negative || 0) * m);
      const neu = rawCounts?.neutral != null ? rawCounts.neutral : Math.max(m - pos - neg, 0);
      return {
        date: d.date,
        mentions: m,
        reach: d.reach_total || 0,
        sentiment: {
          positive: pos,
          negative: neg,
          neutral: neu,
          positivePct: m > 0 ? Math.round((pos / m) * 100) : 0,
          negativePct: m > 0 ? Math.round((neg / m) * 100) : 0,
          source: rawCounts ? "sentiment-endpoint" : "daily-metrics-proportion",
        },
        engagement: d.engagement || {},
        bySource: safeArray(d, "by_source"),
      };
    }),

    // Sentiment daily breakdown (from dedicated endpoint)
    sentimentDaily: sentimentRaw?.daily || sentimentRaw?.data || null,

    platforms: Object.entries(platformTotals)
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.mentions - a.mentions),

    topics: topicsArr.map(t => ({
      id: t.topic_id,
      name: t.name || (t.description || "").split(/[.,;!?]/).filter(Boolean)[0]?.trim().slice(0, 50) || `Topic ${t.topic_id}`,
      description: t.description,
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
      peakMentions: e.peak_mentions,
      peakReach: e.peak_reach,
      types: anomalyTypes(e),
      isHashtag: !!e.is_hashtag_anomaly,
      isEmotional: !!e.is_emotional_anomaly,
      isNews: !!e.is_news_anomaly,
      isSocial: !!e.is_social_media_anomaly,
      isNonSocial: !!e.is_non_social_media_anomaly,
      isDiscussion: !!e.is_user_discussion_anomaly,
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

    // Source coverage: all 10 Brand24 source categories with explicit status
    // so blind spots (Instagram, Facebook) are visible instead of appearing as
    // "no conversation on that platform".
    coverage,

    // Days where mentions exceeded 2x the trailing 7-day average
    significantDays,

    // Totals reconciliation across Brand24 endpoints
    _reconciliation: reconciliation,

    // Mention count daily (granular from dedicated endpoint)
    mentionCountDaily: typeof mentionCountDaily === "object" && !Array.isArray(mentionCountDaily) ? mentionCountDaily : null,

    // ═══ DERIVED METRICS ═══
    derived: {
      mentionVelocity,
      engagementRate,
      sentimentWeightedReach,
      platformDiversity,
      influenceConcentration,
      socialReachPct,
      totalShares,
      totalLikes: days.reduce((s, d) => s + (d.engagement?.likes || 0), 0),
      totalComments: days.reduce((s, d) => s + (d.engagement?.comments || 0), 0),
    },

    // Debug info
    _debug: {
      rawSourceKeys: Array.from(rawSourceKeys).slice(0, 15),
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

  try { await kvSet(CACHE_KEY + cacheKeySuffix, result, CACHE_TTL); } catch {}

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
