// Social Listening Dashboard API
// Sources: Reddit JSONL (r/Madonna) + YouTube live API (new/viral comments)
// Returns unified feed, sentiment, volume by hour, themes, top authors, engagement

import fs from "fs";
import path from "path";
import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "social_dashboard";
const CACHE_TTL = 3600; // 1 hour

// Theme classification
const THEMES = [
  { id: "nostalgia", label: "Nostalgia", color: "#A78BFA", keywords: ["remember", "childhood", "grew up", "memories", "miss", "classic", "timeless", "back in the day", "years ago"] },
  { id: "musical", label: "Musical", color: "#2DD4BF", keywords: ["voice", "song", "music", "album", "production", "beat", "melody", "dance", "sound", "vocal", "masterpiece"] },
  { id: "icon", label: "Icon", color: "#FFD500", keywords: ["queen", "icon", "legend", "goat", "greatest", "best", "pioneer", "original", "influence"] },
  { id: "emotional", label: "Emotional", color: "#F472B6", keywords: ["love", "heart", "cry", "feel", "beautiful", "amazing", "perfect", "tears", "moved"] },
  { id: "hype", label: "Hype & Anticipation", color: "#34D399", keywords: ["can't wait", "excited", "hype", "finally", "omg", "lets go", "ready", "announcement", "coming", "confirmed", "drop"] },
  { id: "coadf", label: "COADF2 / New Album", color: "#FB923C", keywords: ["coadf", "confessions", "dance floor", "new album", "stuart price", "single", "track", "release"] },
  { id: "criticism", label: "Criticism", color: "#6B7280", keywords: ["overrated", "hate", "bad", "worst", "surgery", "cringe", "fake", "flop"] },
  { id: "cultural", label: "Cultural", color: "#60A5FA", keywords: ["era", "generation", "culture", "fashion", "style", "trend", "relevant", "queer", "lgbtq", "pride", "club"] },
  { id: "discovery", label: "Discovery", color: "#2DD4BF", keywords: ["first time", "just found", "discovered", "never heard", "wow", "new fan"] },
  { id: "humour", label: "Humour", color: "#06B6D4", keywords: ["lol", "lmao", "haha", "funny", "hilarious", "slay", "ate", "serve", "camp"] },
];

const POSITIVE_WORDS = ["love", "amazing", "incredible", "best", "queen", "icon", "legend", "slay", "masterpiece", "brilliant", "beautiful", "stunning", "perfect", "obsessed", "iconic", "goat", "excited", "can't wait", "incredible"];
const NEGATIVE_WORDS = ["hate", "bad", "worst", "overrated", "cringe", "fake", "flop", "awful", "terrible", "cancelled", "embarrassing", "dead"];

function classify(text) {
  const lower = (text || "").toLowerCase();
  for (const theme of THEMES) {
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) return theme.id;
    }
  }
  return "general";
}

function sentiment(text) {
  const lower = (text || "").toLowerCase();
  const hasPos = POSITIVE_WORDS.some(w => lower.includes(w));
  const hasNeg = NEGATIVE_WORDS.some(w => lower.includes(w));
  if (hasPos && !hasNeg) return "positive";
  if (hasNeg && !hasPos) return "negative";
  return "neutral";
}

function loadReddit() {
  const dir = path.join(process.cwd(), "Market Research");
  const items = [];

  // Posts
  try {
    const lines = fs.readFileSync(path.join(dir, "r_madonna_posts.jsonl"), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        if (!d.title && !d.selftext) continue;
        const text = `${d.title || ""} ${d.selftext || ""}`;
        items.push({
          id: d.id,
          platform: "reddit",
          type: "post",
          author: d.author || "",
          text: text.slice(0, 500),
          title: d.title || "",
          date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
          timestamp: d.created_utc || 0,
          score: d.score || 0,
          comments: d.num_comments || 0,
          url: d.permalink ? `https://reddit.com${d.permalink}` : "",
          subreddit: d.subreddit || "Madonna",
          theme: classify(text),
          sentiment: sentiment(text),
        });
      } catch {}
    }
  } catch {}

  // Comments
  try {
    const lines = fs.readFileSync(path.join(dir, "r_madonna_comments.jsonl"), "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        if (!d.body || d.body === "[deleted]" || d.body === "[removed]") continue;
        items.push({
          id: d.id,
          platform: "reddit",
          type: "comment",
          author: d.author || "",
          text: (d.body || "").slice(0, 500),
          title: "",
          date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
          timestamp: d.created_utc || 0,
          score: d.score || 0,
          comments: 0,
          url: d.permalink ? `https://reddit.com${d.permalink}` : "",
          subreddit: d.subreddit || "Madonna",
          theme: classify(d.body),
          sentiment: sentiment(d.body),
        });
      } catch {}
    }
  } catch {}

  return items;
}

export default async function handler(req, res) {
  const { refresh } = req.query;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.platforms) return res.status(200).json(cached);
    } catch {}
  }

  // ── Load Reddit data ──
  const redditItems = loadReddit();

  // ── Load YouTube live data from youtube-rag cache ──
  let youtubeItems = [];
  try {
    const ytData = await Promise.race([kvGet("youtube_rag_comments"), new Promise((_, r) => setTimeout(() => r(), 3000))]);
    if (Array.isArray(ytData)) {
      youtubeItems = ytData.slice(0, 5000).map((c) => ({
        id: `yt_${c.videoId}_${(c.text || "").slice(0, 20)}`,
        platform: "youtube",
        type: "comment",
        author: c.author || "",
        text: (c.text || "").replace(/<[^>]+>/g, "").slice(0, 500),
        title: c.videoTitle || "",
        date: c.publishedAt || "",
        timestamp: c.publishedAt ? Math.floor(new Date(c.publishedAt).getTime() / 1000) : 0,
        score: c.likeCount || 0,
        comments: 0,
        url: c.videoId ? `https://youtube.com/watch?v=${c.videoId}` : "",
        subreddit: "",
        theme: classify(c.text),
        sentiment: sentiment(c.text),
        isViral: c.isViral || false,
      }));
    }
  } catch {}

  const allItems = [...redditItems, ...youtubeItems];

  // ── Sort by date (newest first) ──
  allItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // ── Time-based analysis: volume by hour (last 3 days) ──
  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  const hourlyBuckets = {};
  const recentItems = allItems.filter(i => i.timestamp * 1000 > threeDaysAgo);

  for (let h = 0; h < 72; h++) {
    const bucketStart = threeDaysAgo + h * 3600000;
    const bucketEnd = bucketStart + 3600000;
    const key = new Date(bucketStart).toISOString().slice(0, 13) + ":00";
    const inBucket = recentItems.filter(i => {
      const t = i.timestamp * 1000;
      return t >= bucketStart && t < bucketEnd;
    });
    hourlyBuckets[key] = {
      total: inBucket.length,
      reddit: inBucket.filter(i => i.platform === "reddit").length,
      youtube: inBucket.filter(i => i.platform === "youtube").length,
      positive: inBucket.filter(i => i.sentiment === "positive").length,
      negative: inBucket.filter(i => i.sentiment === "negative").length,
      neutral: inBucket.filter(i => i.sentiment === "neutral").length,
    };
  }

  // ── Sentiment breakdown ──
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  allItems.forEach(i => { sentimentCounts[i.sentiment]++; });
  const sentTotal = Math.max(allItems.length, 1);

  // ── Theme breakdown ──
  const themeCounts = {};
  THEMES.forEach(t => { themeCounts[t.id] = 0; });
  themeCounts.general = 0;
  allItems.forEach(i => { themeCounts[i.theme] = (themeCounts[i.theme] || 0) + 1; });

  // ── Platform breakdown ──
  const platformCounts = { reddit: redditItems.length, youtube: youtubeItems.length };

  // ── Top authors ──
  const authorMap = {};
  allItems.forEach(i => {
    if (!i.author || i.author === "[deleted]") return;
    if (!authorMap[i.author]) authorMap[i.author] = { name: i.author, platform: i.platform, count: 0, totalScore: 0, sentiments: { positive: 0, negative: 0, neutral: 0 } };
    authorMap[i.author].count++;
    authorMap[i.author].totalScore += i.score;
    authorMap[i.author].sentiments[i.sentiment]++;
  });
  const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 20);
  const topEngaged = Object.values(authorMap).sort((a, b) => b.totalScore - a.totalScore).slice(0, 20);

  // ── Top posts by engagement ──
  const topPosts = allItems.filter(i => i.type === "post" || i.score > 5).sort((a, b) => b.score - a.score).slice(0, 20);

  // ── Word frequency (bigrams) ──
  const wordFreq = {};
  allItems.forEach(i => {
    const words = (i.text || "").toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 3);
    for (let j = 0; j < words.length - 1; j++) {
      const bigram = `${words[j]} ${words[j + 1]}`;
      wordFreq[bigram] = (wordFreq[bigram] || 0) + 1;
    }
  });
  const topBigrams = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([word, count]) => ({ word, count }));

  // ── Sentiment by platform ──
  const sentimentByPlatform = {};
  ["reddit", "youtube"].forEach(p => {
    const pItems = allItems.filter(i => i.platform === p);
    const total = Math.max(pItems.length, 1);
    sentimentByPlatform[p] = {
      positive: Math.round((pItems.filter(i => i.sentiment === "positive").length / total) * 100),
      negative: Math.round((pItems.filter(i => i.sentiment === "negative").length / total) * 100),
      neutral: Math.round((pItems.filter(i => i.sentiment === "neutral").length / total) * 100),
    };
  });

  // ── Theme by platform heatmap ──
  const themeByPlatform = {};
  THEMES.forEach(t => {
    themeByPlatform[t.id] = {
      reddit: allItems.filter(i => i.platform === "reddit" && i.theme === t.id).length,
      youtube: allItems.filter(i => i.platform === "youtube" && i.theme === t.id).length,
    };
  });

  // ── Daily volume (last 14 days) ──
  const dailyVolume = {};
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  allItems.filter(i => i.timestamp * 1000 > fourteenDaysAgo).forEach(i => {
    const day = new Date(i.timestamp * 1000).toISOString().slice(0, 10);
    if (!dailyVolume[day]) dailyVolume[day] = { total: 0, reddit: 0, youtube: 0 };
    dailyVolume[day].total++;
    dailyVolume[day][i.platform]++;
  });

  const result = {
    fetchedAt: new Date().toISOString(),
    totalItems: allItems.length,
    platforms: platformCounts,
    themes: THEMES.map(t => ({ ...t, count: themeCounts[t.id] || 0 })),
    generalCount: themeCounts.general || 0,
    sentiment: {
      positive: Math.round((sentimentCounts.positive / sentTotal) * 100),
      negative: Math.round((sentimentCounts.negative / sentTotal) * 100),
      neutral: Math.round((sentimentCounts.neutral / sentTotal) * 100),
      counts: sentimentCounts,
    },
    sentimentByPlatform,
    themeByPlatform,
    hourlyVolume: Object.entries(hourlyBuckets).map(([hour, data]) => ({ hour, ...data })),
    dailyVolume: Object.entries(dailyVolume).sort().map(([day, data]) => ({ day, ...data })),
    topAuthors,
    topEngaged,
    topPosts,
    topBigrams,
    // Recent feed items (newest 50)
    feed: allItems.slice(0, 50),
    // Stats
    recentCount: recentItems.length,
    redditPosts: redditItems.filter(i => i.type === "post").length,
    redditComments: redditItems.filter(i => i.type === "comment").length,
    youtubeComments: youtubeItems.length,
  };

  try { await Promise.race([kvSet(CACHE_KEY, result, CACHE_TTL), new Promise((_, r) => setTimeout(() => r(), 5000))]); } catch {}

  res.status(200).json(result);
}
