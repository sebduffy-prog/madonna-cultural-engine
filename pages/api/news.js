// Cultural feed API - aggregates Brave Search results and RSS feeds
// Brave API key goes in .env.local as BRAVE_API_KEY
//
// WHEN BRAVE API SEARCHES HAPPEN:
// - Server-side, when a user loads a tab for the first time
// - Results are cached in-memory for 1 hour to avoid repeat calls
// - Each tab fires 3-5 Brave queries (combined terms, not individual)
// - Free tier = 2,000 queries/month
// - RSS feeds are free and unlimited

const RSS_FEEDS = {
  madonna: [
    // Pull from ALL sources - Madonna content rises to the top via search
    { name: "Vogue", url: "https://www.vogue.com/feed/rss" },
    { name: "Vogue UK", url: "https://www.vogue.co.uk/feed/rss" },
    { name: "Vanity Fair", url: "https://www.vanityfair.com/feed/rss" },
    { name: "Dazed", url: "https://www.dazeddigital.com/rss" },
    { name: "i-D", url: "https://i-d.co/feed/" },
    { name: "PinkNews", url: "https://www.pinknews.co.uk/feed/" },
    { name: "Them", url: "https://www.them.us/feed/rss" },
    { name: "Attitude", url: "https://www.attitude.co.uk/feed/" },
    { name: "Gay Times", url: "https://www.gaytimes.co.uk/feed/" },
    { name: "NME", url: "https://www.nme.com/feed" },
    { name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss" },
    { name: "Mixmag", url: "https://mixmag.net/feed/rss" },
    { name: "Billboard", url: "https://www.billboard.com/feed/" },
    { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/" },
    { name: "The Guardian Music", url: "https://www.theguardian.com/music/rss" },
    { name: "Paper Magazine", url: "https://www.papermag.com/rss" },
    { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" },
    { name: "Harper's Bazaar", url: "https://www.harpersbazaar.com/rss/all.xml/" },
    { name: "W Magazine", url: "https://www.wmagazine.com/feed/rss" },
    { name: "The Face", url: "https://theface.com/feed" },
  ],
  fashion: [
    { name: "Vogue", url: "https://www.vogue.com/feed/rss" },
    { name: "Vogue UK", url: "https://www.vogue.co.uk/feed/rss" },
    { name: "Vanity Fair", url: "https://www.vanityfair.com/feed/rss" },
    { name: "Harper's Bazaar", url: "https://www.harpersbazaar.com/rss/all.xml/" },
    { name: "Elle", url: "https://www.elle.com/rss/all.xml/" },
    { name: "W Magazine", url: "https://www.wmagazine.com/feed/rss" },
    { name: "Dazed", url: "https://www.dazeddigital.com/rss" },
    { name: "i-D", url: "https://i-d.co/feed/" },
    { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" },
    { name: "AnOther", url: "https://www.anothermag.com/feed" },
    { name: "Business of Fashion", url: "https://www.businessoffashion.com/feed" },
    { name: "Hypebeast", url: "https://hypebeast.com/feed" },
    { name: "WWD", url: "https://wwd.com/feed/" },
    { name: "CR Fashion Book", url: "https://crfashionbook.com/feed/" },
  ],
  gay: [
    { name: "PinkNews", url: "https://www.pinknews.co.uk/feed/" },
    { name: "Them", url: "https://www.them.us/feed/rss" },
    { name: "Attitude", url: "https://www.attitude.co.uk/feed/" },
    { name: "Gay Times", url: "https://www.gaytimes.co.uk/feed/" },
    { name: "Out Magazine", url: "https://www.out.com/rss.xml" },
    { name: "The Advocate", url: "https://www.advocate.com/rss.xml" },
    { name: "Queerty", url: "https://www.queerty.com/feed" },
    { name: "LGBTQ Nation", url: "https://www.lgbtqnation.com/feed/" },
    { name: "Towleroad", url: "https://www.towleroad.com/feed/" },
    { name: "Dazed", url: "https://www.dazeddigital.com/rss" },
    { name: "Paper Magazine", url: "https://www.papermag.com/rss" },
    { name: "Nylon", url: "https://www.nylon.com/feed/rss" },
  ],
  culture: [
    { name: "Dazed", url: "https://www.dazeddigital.com/rss" },
    { name: "i-D", url: "https://i-d.co/feed/" },
    { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" },
    { name: "Resident Advisor", url: "https://ra.co/xml/news.xml" },
    { name: "Mixmag", url: "https://mixmag.net/feed/rss" },
    { name: "DJ Mag", url: "https://djmag.com/feed" },
    { name: "The Face", url: "https://theface.com/feed" },
    { name: "Crack Magazine", url: "https://crackmagazine.net/feed/" },
    { name: "Clash", url: "https://www.clashmusic.com/feed/" },
    { name: "The FADER", url: "https://www.thefader.com/rss" },
    { name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss" },
    { name: "NME", url: "https://www.nme.com/feed" },
    { name: "Complex", url: "https://www.complex.com/feed" },
    { name: "Paper Magazine", url: "https://www.papermag.com/rss" },
    { name: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss" },
    { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/" },
  ],
};

// Each query string is ONE Brave API call. Pack related terms together.
const BRAVE_QUERIES = {
  madonna: [
    // Expansive Madonna search - cast a wide net
    "Madonna",
    "Madonna news 2026",
    "Madonna album tour fashion",
    "Madonna interview feature profile",
    "Madonna Netflix Stuart Price Warner Records",
  ],
  fashion: [
    "Madonna fashion",
    "fashion trends celebrity style Met Gala runway",
    "luxury fashion designer collaboration couture campaign",
    "trending fashion beauty street style",
  ],
  gay: [
    "Madonna LGBTQ pride",
    "LGBTQ news pride queer culture drag ballroom",
    "gay rights trans visibility queer celebrities nightlife",
    "trending queer pop culture",
  ],
  culture: [
    "Madonna music club",
    "club culture dance music house techno disco electronic",
    "trending music new album festival DJ underground",
    "cultural trends viral pop culture entertainment",
  ],
};

// In-memory cache: { key: { data, timestamp } }
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&#038;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace(/&#|;/g, ""), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    });
}

async function fetchRSS(url, sourceName, maxItems = 5) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MadonnaCulturalEngine/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();
    const items = [];
    const itemMatches = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const item of itemMatches.slice(0, maxItems)) {
      const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "";
      const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "";
      const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "";
      const cleanTitle = decodeEntities(title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
      const cleanDesc = decodeEntities(desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
      const cleanLink = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      if (cleanTitle) {
        items.push({ title: cleanTitle, url: cleanLink, description: cleanDesc.slice(0, 300), date: pubDate, source: sourceName, type: "rss" });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchBraveSearch(query, apiKey) {
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ q: query, count: "15", freshness: "pw" });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map((r) => ({
      title: decodeEntities(r.title || ""),
      url: r.url || "",
      description: decodeEntities((r.description || "").slice(0, 300)),
      date: r.page_age || "",
      source: new URL(r.url).hostname.replace("www.", ""),
      type: "brave",
    }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { category = "madonna", refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  // Check cache (skip if ?refresh=1)
  const cacheKey = `${category}_${!!apiKey}`;
  const cached = cache[cacheKey];
  if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json(cached.data);
  }

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.madonna;
  const queries = BRAVE_QUERIES[category] || BRAVE_QUERIES.madonna;

  // Fetch all sources in parallel
  // Madonna tab: scan more RSS items per feed to find mentions
  const rssDepth = category === "madonna" ? 20 : 5;
  const rssPromises = feeds.map((f) => fetchRSS(f.url, f.name, rssDepth));
  const bravePromises = queries.map((q) => fetchBraveSearch(q, apiKey));

  const [rssResults, braveResults] = await Promise.all([
    Promise.all(rssPromises),
    Promise.all(bravePromises),
  ]);

  let allRss = rssResults.flat();
  const allBrave = braveResults.flat();

  // Madonna tab: only keep articles that actually mention Madonna
  if (category === "madonna") {
    allRss = allRss.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return text.includes("madonna");
    });
  }

  // Deduplicate by URL
  const seen = new Set();
  const combined = [...allBrave, ...allRss].filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Sort by date (newest first), falling back to source order
  combined.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  // Madonna tab: show everything found. Other tabs: cap at 50.
  const maxItems = category === "madonna" ? 80 : 50;

  const result = {
    category,
    hasBraveKey: !!apiKey,
    items: combined.slice(0, maxItems),
    cachedAt: new Date().toISOString(),
  };

  // Store in cache
  cache[cacheKey] = { data: result, timestamp: Date.now() };

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  res.status(200).json(result);
}
