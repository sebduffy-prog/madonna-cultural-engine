// AI Strategy Recommendations — reads prompt from strategy-prompt.md
// Edit that file to train the AI as a media strategist

import { kvGet, kvSet, kvListPush } from "../../lib/kv";
import fs from "fs";
import path from "path";

const CACHE_KEY = "ai_recommendations";
const CACHE_TTL = 604800; // 7 days

function loadPrompt() {
  try {
    const filePath = path.join(process.cwd(), "strategy-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8");
    // Extract everything after the --- frontmatter delimiter
    const parts = content.split("---");
    return parts.length > 2 ? parts.slice(2).join("---").trim() : content.trim();
  } catch {
    return "You are a senior cultural strategist advising Madonna's management team. Generate strategic recommendations.";
  }
}

async function gatherIntelligence() {
  const parts = [];

  for (const cat of ["madonna", "fashion", "gay", "culture"]) {
    const feed = await kvGet(`feeds_${cat}`);
    if (feed?.items) {
      parts.push(`\n## ${cat.toUpperCase()} FEED (${feed.items.length} articles):`);
      feed.items.slice(0, 15).forEach((item) => {
        parts.push(`- [${item.source}] ${item.title}`);
      });
    }
  }

  const spotify = await kvGet("spotify_snapshot");
  if (spotify?.artist) {
    parts.push("\n## SPOTIFY DATA:");
    parts.push(`Artist: ${spotify.artist.name}, Popularity: ${spotify.artist.popularity}/100`);
    if (spotify.topTracks?.length) {
      parts.push("Top tracks: " + spotify.topTracks.slice(0, 5).map((t) => `${t.name} (${t.popularity})`).join(", "));
    }
  }

  const mediaIndex = await kvGet("media_trend_cache");
  if (mediaIndex) {
    parts.push("\n## MEDIA TREND INDEX:");
    parts.push(`Overall index: ${mediaIndex.index}% vs baseline`);
    if (mediaIndex.queryScores) {
      mediaIndex.queryScores.forEach((q) => {
        parts.push(`- ${q.label}: ${q.todayCount} results (${q.pctChange > 0 ? "+" : ""}${q.pctChange}%)`);
      });
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      hasApiKey: false,
      error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to Vercel Environment Variables.",
    });
  }

  if (!refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      return res.status(200).json(cached);
    }
  }

  const intelligence = await gatherIntelligence();
  const systemPrompt = loadPrompt();

  if (!intelligence) {
    return res.status(200).json({
      hasApiKey: true,
      error: "No feed data available yet. Run a New Search in the Media tab first.",
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
        system: systemPrompt,
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ hasApiKey: true, error: "Could not parse AI response" });
    }

    const recommendations = JSON.parse(jsonMatch[0]);

    const result = {
      hasApiKey: true,
      generatedAt: new Date().toISOString(),
      recommendations,
      promptFile: "strategy-prompt.md",
    };

    await kvSet(CACHE_KEY, result, CACHE_TTL);

    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({ hasApiKey: true, error: `Failed to generate: ${err.message}` });
  }
}
