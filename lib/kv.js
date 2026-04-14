// Persistence layer
// Dev: in-memory + JSON file on disk (survives HMR restarts)
// Production (Vercel): in-memory only (cron refreshes keep it populated)

const IS_DEV = process.env.NODE_ENV === "development";

// In-memory store -- this is the primary store on Vercel
let store = {};
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  if (IS_DEV) {
    try {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(process.cwd(), ".cache-store.json");
      if (fs.existsSync(file)) {
        store = JSON.parse(fs.readFileSync(file, "utf-8"));
      }
    } catch { store = {}; }
  }
}

let saveTimer = null;
function saveToDisk() {
  if (!IS_DEV) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(path.join(process.cwd(), ".cache-store.json"), JSON.stringify(store), "utf-8");
    } catch { /* ignore */ }
  }, 500);
}

export async function kvGet(key) {
  ensureLoaded();
  const entry = store[key];
  if (!entry) return null;
  return entry.value;
}

export async function kvIsFresh(key) {
  ensureLoaded();
  const entry = store[key];
  if (!entry) return false;
  if (!entry.expiry) return true;
  return Date.now() < entry.expiry;
}

export async function kvSet(key, value, ttlSeconds) {
  ensureLoaded();
  store[key] = {
    value,
    expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    storedAt: Date.now(),
  };
  saveToDisk();
}

export async function kvListPush(key, item, maxLength = 52) {
  ensureLoaded();
  const entry = store[key];
  const list = (entry && Array.isArray(entry.value)) ? entry.value : [];
  list.unshift(item);
  if (list.length > maxLength) list.length = maxLength;
  store[key] = { value: list, expiry: null, storedAt: Date.now() };
  saveToDisk();
}

export async function kvListGet(key, start = 0, end = -1) {
  ensureLoaded();
  const entry = store[key];
  if (!entry || !Array.isArray(entry.value)) return [];
  const list = entry.value;
  return end === -1 ? list.slice(start) : list.slice(start, end + 1);
}
