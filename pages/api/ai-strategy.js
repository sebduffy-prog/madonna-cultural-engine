// AI-powered strategic recommendations using Claude
// Analyses the week's feeds, Spotify data, and social mentions
// Generates fresh recommendations per category

import { kvGet, kvSet, kvListPush } from "../../lib/kv";

const CACHE_KEY = "ai:recommendations";
const CACHE_TTL = 604800; // 7 days

const SYSTEM_PROMPT = `You are a senior cultural strategist at a leading media agency, advising Madonna's management team. You are sharp, specific, and never generic. Your recommendations must reference actual current events, trends, and data points.

You will receive this week's intelligence data: RSS/search results from fashion, LGBTQ, and cultural outlets, plus Spotify streaming data and social media mentions.

Generate exactly 3 strategic recommendations for each of these 4 categories:
1. MADONNA (cross-platform, her brand overall)
2. FASHION (fashion press, designer partnerships, style positioning)
3. GAY COMMUNITY (LGBTQ culture, Pride, ballroom, queer media)
4. CULTURE (club culture, music scene, underground, broader cultural trends)

Each recommendation must have:
- "type": one of "Media", "Strategic", or "Partnership"
- "title": punchy, actionable title (max 8 words)
- "description": 2-3 sentences explaining the recommendation with specific references to this week's data

Respond in valid JSON format:
{
  "madonna": [{"type":"...","title":"...","description":"..."},...],
  "fashion": [...],
  "gay": [...],
  "culture": [...]
}`;

async function gatherIntelligence() {
  const parts = [];

  // Gather cached feed data
  for (const cat of ["madonna", "fashion", "gay", "culture"]) {
    const feed = await kvGet(`feeds:${cat}`);
    if (feed?.items) {
      parts.push(`\n## ${cat.toUpperCase()} FEED (${feed.items.length} articles):`);
      feed.items.slice(0, 15).forEach((item) => {
        parts.push(`- [${item.source}] ${item.title}`);
      });
    }
  }

  // Spotify data
  const spotify = await kvGet("spotify:snapshot");
  if (spotify?.artist) {
    parts.push("\n## SPOTIFY DATA:");
    parts.push(`Artist popularity: ${spotify.artist.popularity}/100, Followers: ${spotify.artist.followers?.toLocaleString()}`);
    if (spotify.topTracks?.length) {
      parts.push("Top tracks: " + spotify.topTracks.slice(0, 5).map((t) => `${t.name} (${t.popularity})`).join(", "));
    }
  }

  // Social mentions
  const social = await kvGet("social:pulse");
  if (social?.platforms) {
    parts.push("\n## SOCIAL MENTIONS:");
    if (social.sentiment) {
      parts.push(`Sentiment: ${social.sentiment.positive}% positive, ${social.sentiment.neutral}% neutral, ${social.sentiment.negative}% negative (${social.sentiment.total} mentions)`);
    }
    social.platforms.forEach((p) => {
      if (p.items.length > 0) {
        parts.push(`${p.label}: ${p.items.slice(0, 5).map((i) => i.title).join(" | ")}`);
      }
    });
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      hasApiKey: false,
      error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local",
    });
  }

  // Check cache
  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      return res.status(200).json(cached);
    }
  }

  // Gather intelligence
  const intelligence = await gatherIntelligence();

  if (!intelligence) {
    return res.status(200).json({
      hasApiKey: true,
      error: "No feed data available yet. Run a New Search in the Cultural Feed first, then generate recommendations.",
    });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Here is this week's intelligence data. Generate strategic recommendations based on what's actually happening:\n\n${intelligence}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(200).json({ hasApiKey: true, error: `Claude API error: ${anthropicRes.status} ${errText.slice(0, 200)}` });
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ hasApiKey: true, error: "Could not parse AI response" });
    }

    const recommendations = JSON.parse(jsonMatch[0]);

    const result = {
      hasApiKey: true,
      generatedAt: new Date().toISOString(),
      recommendations,
    };

    // Cache for 7 days
    await kvSet(CACHE_KEY, result, CACHE_TTL);

    // Store in history
    await kvListPush("ai:recommendations:history", {
      date: result.generatedAt,
      recommendations,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({ hasApiKey: true, error: `Failed to generate: ${err.message}` });
  }
}
