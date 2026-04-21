// Custom Map Pins API — shared across all users
// Stores pins in Vercel Blob via kv layer

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "custom_map_pins";

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const pins = await kvGet(CACHE_KEY) || [];
    return res.status(200).json({ pins });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { action } = body;

  let pins = await kvGet(CACHE_KEY) || [];

  if (action === "add") {
    const { lat, lng, title, address, description, color } = body;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
    const pin = {
      id: uuid(),
      lat, lng, title: title || "", address: address || "",
      description: description || "", color: color || "#FFD500",
      createdAt: new Date().toISOString(),
    };
    pins.push(pin);
    await kvSet(CACHE_KEY, pins);
    return res.status(200).json({ ok: true, pin });
  }

  if (action === "delete") {
    const { pinId } = body;
    pins = pins.filter(p => p.id !== pinId);
    await kvSet(CACHE_KEY, pins);
    return res.status(200).json({ ok: true });
  }

  res.status(400).json({ error: "Unknown action" });
}
