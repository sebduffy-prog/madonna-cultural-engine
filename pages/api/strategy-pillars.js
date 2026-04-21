// Strategy Pillars API — stores channels attached to each pillar
// Shape: { tease: [{id, channel, role, approach, budget}], launch: [...], sustain: [...] }

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "strategy_pillar_channels";
const PILLARS = ["tease", "launch", "sustain"];

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function emptyShape() {
  return Object.fromEntries(PILLARS.map((p) => [p, []]));
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const data = (await kvGet(CACHE_KEY)) || emptyShape();
    for (const p of PILLARS) if (!Array.isArray(data[p])) data[p] = [];
    return res.status(200).json({ pillars: data });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { action } = body;
  const data = (await kvGet(CACHE_KEY)) || emptyShape();
  for (const p of PILLARS) if (!Array.isArray(data[p])) data[p] = [];

  if (action === "add") {
    const { pillar, channel, role, approach, budget } = body;
    if (!PILLARS.includes(pillar)) return res.status(400).json({ error: "Invalid pillar" });
    if (!channel) return res.status(400).json({ error: "Channel required" });
    const entry = { id: uuid(), channel, role: role || "", approach: approach || "", budget: budget || "" };
    data[pillar].push(entry);
    await kvSet(CACHE_KEY, data);
    return res.status(200).json({ ok: true, entry, pillars: data });
  }

  if (action === "update") {
    const { pillar, id, channel, role, approach, budget } = body;
    if (!PILLARS.includes(pillar)) return res.status(400).json({ error: "Invalid pillar" });
    const arr = data[pillar];
    const idx = arr.findIndex((e) => e.id === id);
    if (idx < 0) return res.status(404).json({ error: "Not found" });
    if (channel !== undefined) arr[idx].channel = channel;
    if (role !== undefined) arr[idx].role = role;
    if (approach !== undefined) arr[idx].approach = approach;
    if (budget !== undefined) arr[idx].budget = budget;
    await kvSet(CACHE_KEY, data);
    return res.status(200).json({ ok: true, entry: arr[idx], pillars: data });
  }

  if (action === "delete") {
    const { pillar, id } = body;
    if (!PILLARS.includes(pillar)) return res.status(400).json({ error: "Invalid pillar" });
    data[pillar] = data[pillar].filter((e) => e.id !== id);
    await kvSet(CACHE_KEY, data);
    return res.status(200).json({ ok: true, pillars: data });
  }

  return res.status(400).json({ error: "Unknown action" });
}
