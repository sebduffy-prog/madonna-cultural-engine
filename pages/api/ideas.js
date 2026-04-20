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
    const { name, description, mockupUrl, extensions, tactics, audience, createdBy } = body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const idea = {
      id: uuid(),
      name,
      description: description || "",
      mockupUrl: mockupUrl || "",
      tactics: tactics || [],
      extensions: extensions || [],
      audience: audience || "",
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
