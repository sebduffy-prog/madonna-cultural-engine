// Storage layer
// - In-memory: fast reads for short-lived cache (TTL data)
// - Vercel Blob: persistent storage for history/trends that survive cold starts
// - Dev fallback: JSON file on disk
//
// kvGet/kvSet: in-memory first, Blob backup for persistence
// kvListPush/kvListGet: always Blob (trend history must persist)

const IS_DEV = process.env.NODE_ENV === "development";
// Try Blob if token exists. On Vercel, BLOB_READ_WRITE_TOKEN is auto-injected
// when a Blob store is linked to the project in the Vercel dashboard.
const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// ── In-memory cache ──
let mem = {};

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
    await put(`sweet-tooth/${key}.json`, JSON.stringify(value), {
      access: "public", contentType: "application/json", addRandomSuffix: false,
    });
    return true;
  } catch { return false; }
}

async function blobGet(key) {
  if (!HAS_BLOB) return null;
  try {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: `sweet-tooth/${key}.json`, limit: 1 });
    if (result.blobs.length === 0) return null;
    const res = await fetch(result.blobs[0].url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Public API ──

export async function kvGet(key) {
  ensureDev();
  // Check memory first
  const entry = mem[key];
  if (entry) return entry.value;
  // Fall back to Blob
  const blobData = await blobGet(key);
  if (blobData != null) {
    // Populate memory cache from Blob
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
  // Persist to Blob (non-blocking)
  blobPut(key, value).catch(() => {});
}

// Lists (trend history) -- always persisted to Blob
export async function kvListPush(key, item, maxLength = 52) {
  ensureDev();
  // Read current list from memory or Blob
  const entry = mem[key];
  let list = (entry && Array.isArray(entry.value)) ? entry.value : [];
  if (list.length === 0) {
    const blobList = await blobGet(`list/${key}`);
    if (Array.isArray(blobList)) list = blobList;
  }
  list.unshift(item);
  if (list.length > maxLength) list.length = maxLength;
  mem[key] = { value: list, expiry: null, storedAt: Date.now() };
  devSave();
  // Persist to Blob
  blobPut(`list/${key}`, list).catch(() => {});
}

export async function kvListGet(key, start = 0, end = -1) {
  ensureDev();
  const entry = mem[key];
  let list = (entry && Array.isArray(entry.value)) ? entry.value : [];
  // If memory is empty, try Blob
  if (list.length === 0) {
    const blobList = await blobGet(`list/${key}`);
    if (Array.isArray(blobList)) {
      list = blobList;
      mem[key] = { value: list, expiry: null, storedAt: Date.now() };
    }
  }
  return end === -1 ? list.slice(start) : list.slice(start, end + 1);
}
