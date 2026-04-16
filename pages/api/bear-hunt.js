// Bear Hunt — Word doc upload/retrieve for market research

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "bear_hunt_docs";

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const docs = await kvGet(CACHE_KEY) || [];
    return res.status(200).json({ documents: docs });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action } = body;

    if (action === "delete") {
      const { docId } = body;
      let docs = await kvGet(CACHE_KEY) || [];
      docs = docs.filter(d => d.id !== docId);
      await kvSet(CACHE_KEY, docs);
      return res.status(200).json({ ok: true });
    }

    // Upload action
    const { name, content, uploadedBy } = body;
    if (!name || !content) {
      return res.status(400).json({ error: "Name and content are required" });
    }

    let docs = await kvGet(CACHE_KEY) || [];

    const doc = {
      id: uuid(),
      name,
      content,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || "Anonymous",
    };

    docs.unshift(doc);
    await kvSet(CACHE_KEY, docs);
    return res.status(200).json({ ok: true, document: doc });
  }

  res.status(405).json({ error: "Method not allowed" });
}
