// Wikipedia Pageviews — daily pageview counts for Madonna-related articles.
// Authoritative, free attention signal. Spikes correlate with news events.
// Docs: https://wikimedia.org/api/rest_v1/
//
// Add more articles by editing the ARTICLES list below.

import { kvGet, kvSet } from "../../lib/kv";

const CACHE_KEY = "wikipedia_pageviews";
const CACHE_TTL = 21600; // 6 hours

const ARTICLES = [
  { id: "madonna",         title: "Madonna_(entertainer)",      label: "Madonna" },
  { id: "coadf",           title: "Confessions_on_a_Dance_Floor", label: "Confessions on a Dance Floor" },
  { id: "like_a_prayer",   title: "Like_a_Prayer_(album)",      label: "Like a Prayer (album)" },
  { id: "ray_of_light",    title: "Ray_of_Light",                label: "Ray of Light" },
  { id: "madame_x",        title: "Madame_X_(album)",            label: "Madame X" },
  { id: "celebration_tour",title: "The_Celebration_Tour",        label: "The Celebration Tour" },
  { id: "confessions_tour",title: "Confessions_Tour",            label: "Confessions Tour" },
  { id: "erotica",         title: "Erotica_(Madonna_album)",     label: "Erotica" },
  { id: "american_life",   title: "American_Life",               label: "American Life" },
  { id: "music_album",     title: "Music_(Madonna_album)",       label: "Music (album)" },
];

function fmtDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchPageviews(title, startDate, endDate) {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${startDate}/${endDate}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "madonna-cultural-engine/1.0 (vccp strategy tool)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { items: [], error: `HTTP ${r.status}` };
    const j = await r.json();
    return { items: j.items || [] };
  } catch (err) {
    return { items: [], error: err.message };
  }
}

export default async function handler(req, res) {
  const { refresh } = req.query;
  const days = parseInt(req.query.days) || 60;

  if (!refresh) {
    try {
      const cached = await Promise.race([kvGet(CACHE_KEY), new Promise((_, r) => setTimeout(() => r(), 3000))]);
      if (cached?.articles) return res.status(200).json(cached);
    } catch {}
  }

  const end = new Date(Date.now() - 86400000 * 2); // Wikipedia pageviews lag ~1 day
  const start = new Date(end.getTime() - 86400000 * days);
  const startStr = fmtDate(start);
  const endStr = fmtDate(end);

  const results = await Promise.all(
    ARTICLES.map(async a => {
      const { items, error } = await fetchPageviews(a.title, startStr, endStr);
      const daily = items.map(i => ({
        date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
        views: i.views,
      }));
      const total = daily.reduce((s, d) => s + d.views, 0);
      const avg = daily.length > 0 ? Math.round(total / daily.length) : 0;
      const recent7 = daily.slice(-7).reduce((s, d) => s + d.views, 0);
      const previous7 = daily.slice(-14, -7).reduce((s, d) => s + d.views, 0);
      const weekChange = previous7 > 0
        ? Math.round(((recent7 - previous7) / previous7) * 1000) / 10
        : 0;
      return {
        id: a.id,
        title: a.title,
        label: a.label,
        daily,
        total,
        avgDaily: avg,
        last7days: recent7,
        previous7days: previous7,
        weekChangePercent: weekChange,
        error: error || null,
      };
    })
  );

  const ranked = [...results].sort((a, b) => b.last7days - a.last7days);
  const topMover = [...results].filter(r => r.previous7days > 100).sort((a, b) => b.weekChangePercent - a.weekChangePercent)[0] || null;

  const result = {
    source: "wikipedia-pageviews",
    fetchedAt: new Date().toISOString(),
    period: { from: startStr, to: endStr, days },
    articles: results,
    ranked: ranked.map(r => ({ id: r.id, label: r.label, last7days: r.last7days, weekChangePercent: r.weekChangePercent })),
    topMover: topMover ? { id: topMover.id, label: topMover.label, weekChangePercent: topMover.weekChangePercent } : null,
  };

  try { await kvSet(CACHE_KEY, result, CACHE_TTL); } catch {}
  return res.status(200).json(result);
}
