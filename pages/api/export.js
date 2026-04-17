// Full data export — dumps ALL stored data from KV/Blob with timestamps
// Used by the "Download Memory" button

import { kvGet, kvListGet } from "../../lib/kv";

const ALL_CACHE_KEYS = [
  "media_trend_cache",
  "media_feed_pool",
  "feeds:madonna",
  "feeds:fashion",
  "feeds:gay",
  "feeds:culture",
  "brand24_data",
  "brand24_data_14d",
  "brand24_data_30d",
  "social_dashboard",
  "social_composite",
  "youtube_rag_cache",
  "youtube_rag_videos",
  "youtube_rag_comments",
  "youtube_rag_themes",
  "ai_recommendations",
  "ideas_data",
  "calendar_data",
  "custom_map_pins",
  "audience_bridge_docs",
  "bear_hunt_docs",
  "spotify_data",
];

const ALL_HISTORY_KEYS = [
  "media_trend_history",
  "brand24_history",
  "social_composite_history",
  "youtube_rag_history",
  "spotify_popularity_history",
  "wikipedia_history",
];

export default async function handler(req, res) {
  const result = {
    exportedAt: new Date().toISOString(),
    cacheData: {},
    historyData: {},
  };

  // Fetch all cache keys
  for (const key of ALL_CACHE_KEYS) {
    try {
      const data = await kvGet(key);
      if (data != null) {
        result.cacheData[key] = {
          fetchedAt: data.fetchedAt || data.cachedAt || data.generatedAt || null,
          data,
        };
      }
    } catch {}
  }

  // Fetch all history lists (up to 365 entries each)
  for (const key of ALL_HISTORY_KEYS) {
    try {
      const list = await kvListGet(key, 0, 364);
      if (list && list.length > 0) {
        result.historyData[key] = list;
      }
    } catch {}
  }

  res.status(200).json(result);
}
