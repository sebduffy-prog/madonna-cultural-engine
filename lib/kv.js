// Storage layer
// - In-memory: fast reads within a single invocation
// - Vercel Blob: persistent storage that survives cold starts and deploys
// - Dev fallback: JSON file on disk
//
// CRITICAL: Blob writes are AWAITED, not fire-and-forget.
// Keys are sanitized to be URL-safe for blob paths.

const IS_DEV = process.env.NODE_ENV === "development";
const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// ── In-memory cache ──
let mem = {};

// Sanitize keys for blob storage paths (replace colons, slashes etc)
function safeKey(key) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ── Dev disk fallback ──
function devRead() {
  if (!IS_DEV) return {};
  try {
    const fs = require("fs");
    const p = require("path").join(process.cwd(), ".cache-store.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {}
  return {};
}

let devLoaded = false;
function ensureDev() {
  if (devLoaded) return;
  devLoaded = true;
  if (IS_DEV) mem = devRead();
}

let devSaveTimer = null;
function devSave() {
  if (!IS_DEV) return;
  if (devSaveTimer) clearTimeout(devSaveTimer);
  devSaveTimer = setTimeout(() => {
    try {
      const fs = require("fs");
      fs.writeFileSync(require("path").join(process.cwd(), ".cache-store.json"), JSON.stringify(mem), "utf-8");
    } catch {}
  }, 500);
}

// ── Blob helpers ──
async function blobPut(key, value) {
  if (!HAS_BLOB) return false;
  try {
    const { put } = await import("@vercel/blob");
    await put(`sweet-tooth/${safeKey(key)}.json`, JSON.stringify(value), {
      access: "public", contentType: "application/json", addRandomSuffix: false,
    });
    return true;
  } catch (err) {
    console.error(`[kv] blobPut failed for ${key}:`, err.message);
    return false;
  }
}

async function blobGet(key) {
  if (!HAS_BLOB) return null;
  try {
    const { list } = await import("@vercel/blob");
    const safe = safeKey(key);
    const result = await list({ prefix: `sweet-tooth/${safe}.json`, limit: 1 });
    if (result.blobs.length === 0) return null;
    const res = await fetch(result.blobs[0].url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[kv] blobGet failed for ${key}:`, err.message);
    return null;
  }
}

// ── Public API ──

export async function kvGet(key) {
  ensureDev();
  const entry = mem[key];
  if (entry) return entry.value;
  // Fall back to Blob
  const blobData = await blobGet(key);
  if (blobData != null) {
    mem[key] = { value: blobData, storedAt: Date.now() };
    return blobData;
  }
  return null;
}

export async function kvIsFresh(key) {
  ensureDev();
  const entry = mem[key];
  if (!entry) return false;
  if (!entry.expiry) return true;
  return Date.now() < entry.expiry;
}

export async function kvSet(key, value, ttlSeconds) {
  ensureDev();
  mem[key] = {
    value,
    expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    storedAt: Date.now(),
  };
  devSave();
  // AWAIT the blob write — don't let it get lost
  await blobPut(key, value);
}

// Lists (trend history) -- always persisted to Blob
export async function kvListPush(key, item, maxLength = 52) {
  ensureDev();
  const entry = mem[key];
  let list = (entry && Array.isArray(entry.value)) ? entry.value : [];
  if (list.length === 0) {
    const blobList = await blobGet(`list_${key}`);
    if (Array.isArray(blobList)) list = blobList;
  }
  list.unshift(item);
  if (list.length > maxLength) list.length = maxLength;
  mem[key] = { value: list, expiry: null, storedAt: Date.now() };
  devSave();
  // AWAIT the blob write
  await blobPut(`list_${key}`, list);
}

export async function kvListGet(key, start = 0, end = -1) {
  ensureDev();
  const entry = mem[key];
  let list = (entry && Array.isArray(entry.value)) ? entry.value : [];
  if (list.length === 0) {
    const blobList = await blobGet(`list_${key}`);
    if (Array.isArray(blobList)) {
      list = blobList;
      mem[key] = { value: list, expiry: null, storedAt: Date.now() };
    }
  }
  return end === -1 ? list.slice(start) : list.slice(start, end + 1);
}

// Diagnostic: check if Blob storage is working
export async function kvDiagnostic() {
  const result = { hasToken: HAS_BLOB, canWrite: false, canRead: false, error: null };
  if (!HAS_BLOB) {
    result.error = "BLOB_READ_WRITE_TOKEN not set";
    return result;
  }
  try {
    const testKey = "_diagnostic_test";
    const testVal = { t: Date.now() };
    result.canWrite = await blobPut(testKey, testVal);
    if (result.canWrite) {
      const read = await blobGet(testKey);
      result.canRead = read?.t === testVal.t;
    }
  } catch (err) {
    result.error = err.message;
  }
  return result;
}
