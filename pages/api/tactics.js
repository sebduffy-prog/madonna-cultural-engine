// Tactics Board API — CRUD + reactions (like/dislike/comment)
// Stores tactics in Vercel Blob via kv layer

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "tactics_data";

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const tactics = await kvGet(CACHE_KEY) || [];
    return res.status(200).json({ tactics });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { action } = body;

  let tactics = await kvGet(CACHE_KEY) || [];

  if (action === "create") {
    const { channel, roleOfChannel, audience, audienceDetail, format, phase, budget, startDate, endDate, notes, createdBy } = body;
    if (!channel) return res.status(400).json({ error: "Channel is required" });

    const tactic = {
      id: uuid(),
      channel,
      roleOfChannel: roleOfChannel || "",
      audience: audience || [],
      audienceDetail: audienceDetail || "",
      format: format || "",
      phase: phase || "",
      budget: budget || "",
      startDate: startDate || "",
      endDate: endDate || "",
      notes: notes || "",
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "Anonymous",
    };
    tactics.unshift(tactic);
    await kvSet(CACHE_KEY, tactics);
    return res.status(200).json({ ok: true, tactic });
  }

  if (action === "update") {
    const { tacticId, channel, roleOfChannel, audience, audienceDetail, format, phase, budget, startDate, endDate, notes } = body;
    const tactic = tactics.find(t => t.id === tacticId);
    if (!tactic) return res.status(404).json({ error: "Tactic not found" });
    if (channel !== undefined) tactic.channel = channel;
    if (roleOfChannel !== undefined) tactic.roleOfChannel = roleOfChannel;
    if (audience !== undefined) tactic.audience = audience;
    if (audienceDetail !== undefined) tactic.audienceDetail = audienceDetail;
    if (format !== undefined) tactic.format = format;
    if (phase !== undefined) tactic.phase = phase;
    if (budget !== undefined) tactic.budget = budget;
    if (startDate !== undefined) tactic.startDate = startDate;
    if (endDate !== undefined) tactic.endDate = endDate;
    if (notes !== undefined) tactic.notes = notes;
    tactic.updatedAt = new Date().toISOString();
    await kvSet(CACHE_KEY, tactics);
    return res.status(200).json({ ok: true, tactic });
  }

  if (action === "like" || action === "dislike") {
    const { tacticId, userId } = body;
    const tactic = tactics.find(t => t.id === tacticId);
    if (!tactic) return res.status(404).json({ error: "Tactic not found" });

    const user = userId || "anonymous";

    if (action === "like") {
      if (tactic.dislikedBy?.includes(user)) {
        tactic.dislikedBy = tactic.dislikedBy.filter(u => u !== user);
        tactic.dislikes = Math.max(0, (tactic.dislikes || 0) - 1);
      }
      if (tactic.likedBy?.includes(user)) {
        tactic.likedBy = tactic.likedBy.filter(u => u !== user);
        tactic.likes = Math.max(0, (tactic.likes || 0) - 1);
      } else {
        tactic.likedBy = [...(tactic.likedBy || []), user];
        tactic.likes = (tactic.likes || 0) + 1;
      }
    } else {
      if (tactic.likedBy?.includes(user)) {
        tactic.likedBy = tactic.likedBy.filter(u => u !== user);
        tactic.likes = Math.max(0, (tactic.likes || 0) - 1);
      }
      if (tactic.dislikedBy?.includes(user)) {
        tactic.dislikedBy = tactic.dislikedBy.filter(u => u !== user);
        tactic.dislikes = Math.max(0, (tactic.dislikes || 0) - 1);
      } else {
        tactic.dislikedBy = [...(tactic.dislikedBy || []), user];
        tactic.dislikes = (tactic.dislikes || 0) + 1;
      }
    }

    await kvSet(CACHE_KEY, tactics);
    return res.status(200).json({ ok: true, tactic });
  }

  if (action === "comment") {
    const { tacticId, author, text } = body;
    const tactic = tactics.find(t => t.id === tacticId);
    if (!tactic) return res.status(404).json({ error: "Tactic not found" });
    if (!text) return res.status(400).json({ error: "Comment text required" });

    const comment = {
      id: uuid(),
      author: author || "Anonymous",
      text,
      date: new Date().toISOString(),
    };
    tactic.comments = [...(tactic.comments || []), comment];
    await kvSet(CACHE_KEY, tactics);
    return res.status(200).json({ ok: true, comment });
  }

  if (action === "delete") {
    const { tacticId } = body;
    tactics = tactics.filter(t => t.id !== tacticId);
    await kvSet(CACHE_KEY, tactics);
    return res.status(200).json({ ok: true });
  }

  res.status(400).json({ error: "Unknown action" });
}
