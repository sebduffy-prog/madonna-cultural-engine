// Persistence layer -- uses Vercel KV (Redis) when available, falls back to in-memory
// No crash if KV is not configured -- everything degrades gracefully

let kvClient = null;
let kvAvailable = false;

async function getKV() {
  if (kvClient !== null) return kvAvailable ? kvClient : null;
  try {
    const { kv } = await import("@vercel/kv");
    // Test connection
    await kv.ping();
    kvClient = kv;
    kvAvailable = true;
    return kv;
  } catch {
    kvClient = false;
    kvAvailable = false;
    return null;
  }
}

// In-memory fallback cache
const memCache = {};

export async function kvGet(key) {
  const kv = await getKV();
  if (kv) {
    try {
      return await kv.get(key);
    } catch {
      return memCache[key]?.value || null;
    }
  }
  const entry = memCache[key];
  if (!entry) return null;
  if (entry.expiry && Date.now() > entry.expiry) {
    delete memCache[key];
    return null;
  }
  return entry.value;
}

export async function kvSet(key, value, ttlSeconds) {
  const kv = await getKV();
  if (kv) {
    try {
      if (ttlSeconds) {
        await kv.set(key, value, { ex: ttlSeconds });
      } else {
        await kv.set(key, value);
      }
    } catch {
      // Fallback to memory
      memCache[key] = { value, expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
    }
  } else {
    memCache[key] = { value, expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
  }
}

// Append to a list (for history tracking)
export async function kvListPush(key, item, maxLength = 52) {
  const kv = await getKV();
  if (kv) {
    try {
      await kv.lpush(key, JSON.stringify(item));
      await kv.ltrim(key, 0, maxLength - 1);
      return;
    } catch { /* fall through */ }
  }
  // In-memory fallback
  if (!memCache[key]) memCache[key] = { value: [] };
  memCache[key].value.unshift(item);
  if (memCache[key].value.length > maxLength) {
    memCache[key].value = memCache[key].value.slice(0, maxLength);
  }
}

export async function kvListGet(key, start = 0, end = -1) {
  const kv = await getKV();
  if (kv) {
    try {
      const items = await kv.lrange(key, start, end);
      return items.map((i) => typeof i === "string" ? JSON.parse(i) : i);
    } catch { /* fall through */ }
  }
  const entry = memCache[key];
  if (!entry || !Array.isArray(entry.value)) return [];
  return end === -1 ? entry.value.slice(start) : entry.value.slice(start, end + 1);
}

export async function isKVAvailable() {
  await getKV();
  return kvAvailable;
}
