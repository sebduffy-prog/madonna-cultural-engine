// Social Listening — Composite aggregator
// Reads from cached sources: social_dashboard, feeds:madonna, spotify_data
// Falls back gracefully if any source is empty
// NOTE: Keep this as a lightweight aggregator. If Brand24 API integration is added,
// it will feed into social_dashboard cache and this aggregator will pick it up automatically.

import { kvGet, kvSet, kvListPush, kvListGet } from "../../lib/kv";

const CACHE_KEY = "social_composite";
const CACHE_TTL = 3600; // 1 hour

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.signals) return res.status(200).json(cached);
    } catch {}
  }

  // Gather signals from cached sources
  const signals = {};
  let totalSentiment = { positive: 0, negative: 0, neutral: 0 };
  const platforms = [];

  // 1. Social dashboard (Reddit JSONL + YouTube comments)
  try {
    const socialDash = await kvGet("social_dashboard");
    if (socialDash?.platforms) {
      const redditCount = socialDash.platforms.reddit || 0;
      const youtubeCount = socialDash.platforms.youtube || 0;

      if (redditCount > 0) {
        signals.redditVolume = { value: redditCount, label: "Reddit posts & comments" };
        platforms.push("reddit");
      }
      if (youtubeCount > 0) {
        signals.youtubeEngagement = {
          value: youtubeCount,
          label: "YouTube comments tracked",
          sentiment: socialDash.sentimentByPlatform?.youtube ? `${socialDash.sentimentByPlatform.youtube.positive}% positive` : null,
        };
        platforms.push("youtube");
      }

      if (socialDash.sentiment) {
        totalSentiment.positive += socialDash.sentiment.counts?.positive || 0;
        totalSentiment.negative += socialDash.sentiment.counts?.negative || 0;
        totalSentiment.neutral += socialDash.sentiment.counts?.neutral || 0;
      }
    }
  } catch {}

  // 2. News feeds (Brave discussions)
  try {
    const newsFeed = await kvGet("feeds:madonna");
    if (newsFeed?.items) {
      const discussions = newsFeed.items.filter(i => i.type === "discussion");
      if (discussions.length > 0) {
        signals.braveDiscussions = {
          value: discussions.length,
          label: "Forum & discussion mentions",
        };
        platforms.push("brave_discussions");
      }

      // Total media mentions
      signals.mediaMentions = {
        value: newsFeed.totalFound || newsFeed.items.length,
        label: "Total media mentions",
        braveResults: newsFeed.braveResults || 0,
        rssResults: newsFeed.rssResults || 0,
      };
    }
  } catch {}

  // 3. Spotify popularity
  try {
    const spotify = await kvGet("spotify_data");
    if (spotify?.artist) {
      signals.spotifyPopularity = {
        value: spotify.artist.popularity,
        label: "Spotify popularity score",
        followers: spotify.artist.followers,
      };
      platforms.push("spotify");

      // Get trend from history
      try {
        const history = await kvListGet("spotify_popularity_history", 0, 1);
        if (history?.length >= 2) {
          signals.spotifyPopularity.delta = history[0].artistPopularity - history[1].artistPopularity;
        }
      } catch {}
    }
  } catch {}

  // 4. Brand24 social listening (if configured)
  try {
    const brand24 = await kvGet("brand24_data");
    if (brand24?.configured && brand24.totalMentions > 0) {
      signals.brand24Mentions = {
        value: brand24.totalMentions,
        label: "Brand24 mentions (7d)",
        reach: brand24.totalReach,
        engagement: brand24.totalEngagement,
      };
      signals.brand24Sentiment = {
        value: brand24.sentiment?.positivePercent || 0,
        label: "Brand24 positive sentiment",
      };
      platforms.push("brand24");

      // Brand24 sentiment is more accurate — use it as primary if available
      if (brand24.sentiment) {
        totalSentiment.positive += brand24.sentiment.positive || 0;
        totalSentiment.negative += brand24.sentiment.negative || 0;
        totalSentiment.neutral += brand24.sentiment.neutral || 0;
      }

      // Add platform breakdown
      if (brand24.platforms?.length > 0) {
        brand24.platforms.forEach(p => {
          if (!platforms.includes(p.platform)) platforms.push(p.platform);
        });
      }
    }
  } catch {}

  // 5. Media trend index
  try {
    const mediaIndex = await kvGet("media_trend_cache");
    if (mediaIndex) {
      signals.mediaIndex = {
        value: mediaIndex.index,
        label: "Media trend index vs baseline",
        totalToday: mediaIndex.totalToday,
        baseline: mediaIndex.totalBaseline,
      };
    }
  } catch {}

  // Compute composite index (weighted average of available signals)
  let compositeIndex = 0;
  let weights = 0;

  if (signals.mediaIndex) {
    compositeIndex += (signals.mediaIndex.value || 0) * 3;
    weights += 3;
  }
  if (signals.spotifyPopularity) {
    compositeIndex += (signals.spotifyPopularity.value || 0) * 1;
    weights += 1;
  }
  if (signals.redditVolume) {
    compositeIndex += Math.min(signals.redditVolume.value / 10, 100) * 1;
    weights += 1;
  }
  if (signals.youtubeEngagement) {
    compositeIndex += Math.min(signals.youtubeEngagement.value / 50, 100) * 1;
    weights += 1;
  }

  const index = weights > 0 ? Math.round((compositeIndex / weights) * 10) / 10 : 0;

  // Sentiment totals
  const sentTotal = Math.max(totalSentiment.positive + totalSentiment.negative + totalSentiment.neutral, 1);

  const result = {
    fetchedAt: new Date().toISOString(),
    index,
    signals,
    platforms,
    sentiment: {
      positive: Math.round((totalSentiment.positive / sentTotal) * 100),
      negative: Math.round((totalSentiment.negative / sentTotal) * 100),
      neutral: Math.round((totalSentiment.neutral / sentTotal) * 100),
      counts: totalSentiment,
    },
    isFirstRun: platforms.length === 0,
  };

  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  // Track history
  try {
    await kvListPush("social_composite_history", {
      date: new Date().toISOString(),
      index,
      platforms: platforms.length,
    }, 365);
  } catch {}

  result.history = [];
  try { result.history = await kvListGet("social_composite_history", 0, 29); } catch {}

  res.status(200).json(result);
}
