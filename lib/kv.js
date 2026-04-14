// Persistence layer -- uses Vercel Blob when available, falls back to in-memory
// Vercel Blob: 500MB free, no setup beyond connecting in Vercel dashboard
// Stores JSON objects as blobs with key-based naming

let blobAvailable = null; // null = untested, true/false after first attempt

async function getBlob() {
  if (blobAvailable === false) return null;
  try {
    const blob = await import("@vercel/blob");
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      blobAvailable = false;
      return null;
    }
    blobAvailable = true;
    return blob;
  } catch {
    blobAvailable = false;
    return null;
  }
}

function blobKey(key) {
  return `madonna-engine/${key.replace(/:/g, "/")}.json`;
}

// In-memory fallback
const memCache = {};

export async function kvGet(key) {
  const blob = await getBlob();
  if (blob) {
    try {
      const { list } = blob;
      const result = await list({ prefix: blobKey(key), limit: 1 });
      if (result.blobs.length > 0) {
        const res = await fetch(result.blobs[0].url);
        if (res.ok) {
          const data = await res.json();
          // Check TTL
          if (data._expiry && Date.now() > data._expiry) {
            // Expired -- delete and return null
            try { await blob.del(result.blobs[0].url); } catch {}
            return null;
          }
          return data._value !== undefined ? data._value : data;
        }
      }
      return null;
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
  const blob = await getBlob();
  if (blob) {
    try {
      const payload = {
        _value: value,
        _expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
        _storedAt: new Date().toISOString(),
      };
      await blob.put(blobKey(key), JSON.stringify(payload), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      return;
    } catch {
      // Fall through to memory
    }
  }
  memCache[key] = { value, expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
}

// Append to a list (for history tracking)
export async function kvListPush(key, item, maxLength = 52) {
  const existing = await kvGet(key) || [];
  const list = Array.isArray(existing) ? existing : [];
  list.unshift(item);
  if (list.length > maxLength) list.length = maxLength;
  await kvSet(key, list); // No TTL -- history is permanent
}

export async function kvListGet(key, start = 0, end = -1) {
  const list = await kvGet(key) || [];
  if (!Array.isArray(list)) return [];
  return end === -1 ? list.slice(start) : list.slice(start, end + 1);
}

export async function isKVAvailable() {
  await getBlob();
  return blobAvailable === true;
}
