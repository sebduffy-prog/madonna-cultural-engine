// Campaign Calendar API — Madonna events + AI cultural search + block plans

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "calendar_data";

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Hardcoded campaign timeline events
const CAMPAIGN_EVENTS = [
  { id: "ce1", date: "2026-04-15", title: "Album Announce & Beta Phase", detail: "Tease OOH. Pre-order: Media Mths - Vinyl/CD for ticket access", type: "campaign", category: "madonna" },
  { id: "ce2", date: "2026-04-17", title: "Big event appearance", detail: "", type: "campaign", category: "madonna" },
  { id: "ce3", date: "2026-04-29", title: "'I feel so free' Single", detail: "First single release", type: "campaign", category: "madonna" },
  { id: "ce4", date: "2026-05-01", title: "David Wears Prada Premiere", detail: "30 sec clip with Anna Wintour", type: "campaign", category: "madonna" },
  { id: "ce5", date: "2026-05-13", title: "Bizarre TBC", detail: "", type: "campaign", category: "madonna" },
  { id: "ce6", date: "2026-05-15", title: "NYC Listening Party", detail: "", type: "campaign", category: "madonna" },
  { id: "ce7", date: "2026-05-20", title: "NYC Listening Party (General)", detail: "", type: "campaign", category: "madonna" },
  { id: "ce8", date: "2026-06-08", title: "London Film Screening & M Q&A", detail: "8 min D&G film", type: "campaign", category: "madonna" },
  { id: "ce9", date: "2026-06-19", title: "'Bring Your Love' Big Single", detail: "Major single release", type: "campaign", category: "madonna" },
  { id: "ce10", date: "2026-06-26", title: "Album Release - Dancefloria (UK)", detail: "Alternative date: July 3", type: "campaign", category: "madonna" },
  { id: "ce11", date: "2026-07-02", title: "Warehouse Project Manchester", detail: "Alternative date: July 3", type: "campaign", category: "madonna" },
  { id: "ce12", date: "2026-07-04", title: "Pride", detail: "Route map on website", type: "campaign", category: "madonna" },
];

export default async function handler(req, res) {
  if (req.method === "GET") {
    const stored = await kvGet(CACHE_KEY) || {};
    const culturalEvents = stored.culturalEvents || [];
    const blockPlans = stored.blockPlans || [];
    return res.status(200).json({
      campaignEvents: CAMPAIGN_EVENTS,
      culturalEvents,
      blockPlans,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { action } = body;

  let stored = await kvGet(CACHE_KEY) || {};
  if (!stored.culturalEvents) stored.culturalEvents = [];
  if (!stored.blockPlans) stored.blockPlans = [];

  if (action === "add-block") {
    const { startDate, endDate, channel, title, description, comment, audience, sourceType, sourceId, createdBy } = body;
    if (!startDate || !title || !channel) {
      return res.status(400).json({ error: "startDate, channel, and title are required" });
    }
    const block = {
      id: uuid(),
      startDate,
      endDate: endDate || startDate,
      channel,
      title,
      description: description || "",
      comment: comment || "",
      audience: audience || "",
      sourceType: sourceType || null,   // "idea" | "tactic" | null
      sourceId: sourceId || null,
      createdBy: createdBy || "Anonymous",
      createdAt: new Date().toISOString(),
      type: "block",
    };
    stored.blockPlans.push(block);
    await kvSet(CACHE_KEY, stored);
    return res.status(200).json({ ok: true, block });
  }

  if (action === "update-block") {
    const { blockId, startDate, endDate, channel, title, description, comment, audience } = body;
    const block = stored.blockPlans.find(b => b.id === blockId);
    if (!block) return res.status(404).json({ error: "Block not found" });
    if (startDate !== undefined) block.startDate = startDate;
    if (endDate !== undefined) block.endDate = endDate;
    if (channel !== undefined) block.channel = channel;
    if (title !== undefined) block.title = title;
    if (description !== undefined) block.description = description;
    if (comment !== undefined) block.comment = comment;
    if (audience !== undefined) block.audience = audience;
    block.updatedAt = new Date().toISOString();
    await kvSet(CACHE_KEY, stored);
    return res.status(200).json({ ok: true, block });
  }

  if (action === "update-from-source") {
    // Propagate edits from an idea/tactic to any block plans it spawned.
    const { sourceType, sourceId, title, description, audience } = body;
    if (!sourceType || !sourceId) return res.status(400).json({ error: "sourceType and sourceId required" });
    let touched = 0;
    stored.blockPlans.forEach(b => {
      if (b.sourceType === sourceType && b.sourceId === sourceId) {
        if (title !== undefined) b.title = title;
        if (description !== undefined) b.description = description;
        if (audience !== undefined) b.audience = audience;
        b.updatedAt = new Date().toISOString();
        touched += 1;
      }
    });
    await kvSet(CACHE_KEY, stored);
    return res.status(200).json({ ok: true, touched });
  }

  if (action === "delete-block") {
    const { blockId } = body;
    stored.blockPlans = stored.blockPlans.filter(b => b.id !== blockId);
    await kvSet(CACHE_KEY, stored);
    return res.status(200).json({ ok: true });
  }

  if (action === "search-events") {
    const { categories = ["fashion", "culture", "nightlife", "lgbtq"], months } = body;
    const braveKey = process.env.BRAVE_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!braveKey || !anthropicKey) {
      return res.status(200).json({ error: "Brave and Anthropic API keys required for cultural event search" });
    }

    const targetMonths = months || ["May 2026", "June 2026", "July 2026"];
    const allResults = [];

    for (const cat of categories) {
      for (const month of targetMonths) {
        try {
          const q = `UK ${cat} events ${month}`;
          const params = new URLSearchParams({ q, count: "15", freshness: "pm" });
          const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
            headers: { "X-Subscription-Token": braveKey, Accept: "application/json" },
            signal: AbortSignal.timeout(10000),
          });
          if (r.ok) {
            const data = await r.json();
            const items = (data.web?.results || []).slice(0, 5).map(r => ({
              title: r.title || "",
              description: (r.description || "").slice(0, 300),
              url: r.url || "",
              category: cat,
              month,
            }));
            allResults.push(...items);
          }
        } catch {}
      }
    }

    if (allResults.length === 0) {
      return res.status(200).json({ ok: true, events: [], message: "No results found" });
    }

    // AI parsing
    try {
      const batch = allResults.map((r, i) =>
        `${i + 1}. [${r.category}] [${r.month}] ${r.title} — ${r.description}`
      ).join("\n");

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: `You extract UK cultural events from search results. For each real event found, return JSON array of objects with: date (YYYY-MM-DD, estimate if only month known), title, venue (if known), city, category (fashion/culture/nightlife/lgbtq), relevance (1-10 how relevant to Madonna's audience). Only include actual events, not articles or listicles. Return ONLY the JSON array.`,
          messages: [{ role: "user", content: `Extract UK cultural events from these search results:\n\n${batch}` }],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const text = data.content?.[0]?.text || "";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const events = JSON.parse(match[0]).map(e => ({
            ...e,
            id: uuid(),
            type: "cultural",
            source: "ai-search",
            searchedAt: new Date().toISOString(),
          }));

          // Merge with existing, dedup by title
          const existingTitles = new Set(stored.culturalEvents.map(e => e.title?.toLowerCase()));
          const newEvents = events.filter(e => !existingTitles.has(e.title?.toLowerCase()));
          stored.culturalEvents = [...stored.culturalEvents, ...newEvents];
          await kvSet(CACHE_KEY, stored);

          return res.status(200).json({ ok: true, events: newEvents, total: stored.culturalEvents.length });
        }
      }
    } catch (err) {
      console.error("[calendar] AI parse error:", err.message);
    }

    return res.status(200).json({ ok: true, events: [], message: "AI parsing failed" });
  }

  res.status(400).json({ error: "Unknown action" });
}
