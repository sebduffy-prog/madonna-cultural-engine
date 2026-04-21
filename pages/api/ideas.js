// Ideas Board API — CRUD + reactions (like/dislike/comment)
// Stores ideas in Vercel Blob via kv layer

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "ideas_data";

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const ideas = await kvGet(CACHE_KEY) || [];
    return res.status(200).json({ ideas });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { action } = body;

  let ideas = await kvGet(CACHE_KEY) || [];

  if (action === "create") {
    const { name, description, mockupUrl, extensions, tactics, audience, pillar, status, createdBy } = body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const idea = {
      id: uuid(),
      name,
      description: description || "",
      mockupUrl: mockupUrl || "",
      tactics: tactics || [],
      extensions: extensions || [],
      audience: audience || "",
      pillar: pillar || "",
      status: status || "Proposed",
      order: Date.now(),
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "Anonymous",
    };
    ideas.unshift(idea);
    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true, idea });
  }

  if (action === "update") {
    const { ideaId, name, description, mockupUrl, tactics, audience, pillar, status, order, editedBy } = body;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    const tracked = ["name", "description", "mockupUrl", "tactics", "audience", "pillar", "status"];
    const incoming = { name, description, mockupUrl, tactics, audience, pillar, status };
    const changes = [];
    for (const k of tracked) {
      const next = incoming[k];
      if (next === undefined) continue;
      const prev = idea[k];
      // Skip snapshotting mockup data URIs so the log doesn't balloon
      if (k === "mockupUrl" && typeof next === "string" && next.startsWith("data:")) continue;
      const same = JSON.stringify(prev ?? "") === JSON.stringify(next ?? "");
      if (!same) changes.push({ field: k, from: prev ?? "", to: next });
    }
    if (changes.length > 0) {
      idea.revisions = [
        { date: new Date().toISOString(), editedBy: editedBy || "Anonymous", changes },
        ...(idea.revisions || []),
      ].slice(0, 50);
    }

    if (name !== undefined) idea.name = name;
    if (description !== undefined) idea.description = description;
    if (mockupUrl !== undefined) idea.mockupUrl = mockupUrl;
    if (tactics !== undefined) idea.tactics = tactics;
    if (audience !== undefined) idea.audience = audience;
    if (pillar !== undefined) idea.pillar = pillar;
    if (status !== undefined) idea.status = status;
    if (order !== undefined) idea.order = order;
    idea.updatedAt = new Date().toISOString();
    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true, idea });
  }

  if (action === "reorder") {
    const { items } = body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items required" });
    const byId = new Map(items.map((i) => [i.id, i.order]));
    for (const idea of ideas) if (byId.has(idea.id)) idea.order = byId.get(idea.id);
    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true });
  }

  if (action === "like" || action === "dislike") {
    const { ideaId, userId } = body;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    const user = userId || "anonymous";

    if (action === "like") {
      // Remove from disliked if present
      if (idea.dislikedBy?.includes(user)) {
        idea.dislikedBy = idea.dislikedBy.filter(u => u !== user);
        idea.dislikes = Math.max(0, (idea.dislikes || 0) - 1);
      }
      // Toggle like
      if (idea.likedBy?.includes(user)) {
        idea.likedBy = idea.likedBy.filter(u => u !== user);
        idea.likes = Math.max(0, (idea.likes || 0) - 1);
      } else {
        idea.likedBy = [...(idea.likedBy || []), user];
        idea.likes = (idea.likes || 0) + 1;
      }
    } else {
      // Remove from liked if present
      if (idea.likedBy?.includes(user)) {
        idea.likedBy = idea.likedBy.filter(u => u !== user);
        idea.likes = Math.max(0, (idea.likes || 0) - 1);
      }
      // Toggle dislike
      if (idea.dislikedBy?.includes(user)) {
        idea.dislikedBy = idea.dislikedBy.filter(u => u !== user);
        idea.dislikes = Math.max(0, (idea.dislikes || 0) - 1);
      } else {
        idea.dislikedBy = [...(idea.dislikedBy || []), user];
        idea.dislikes = (idea.dislikes || 0) + 1;
      }
    }

    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true, idea });
  }

  if (action === "comment") {
    const { ideaId, author, text } = body;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return res.status(404).json({ error: "Idea not found" });
    if (!text) return res.status(400).json({ error: "Comment text required" });

    const comment = {
      id: uuid(),
      author: author || "Anonymous",
      text,
      date: new Date().toISOString(),
    };
    idea.comments = [...(idea.comments || []), comment];
    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true, comment });
  }

  if (action === "delete") {
    const { ideaId } = body;
    ideas = ideas.filter(i => i.id !== ideaId);
    await kvSet(CACHE_KEY, ideas);
    return res.status(200).json({ ok: true });
  }

  res.status(400).json({ error: "Unknown action" });
}
