// Cultural feed API - aggregates Brave Search results and RSS feeds
// Brave API key goes in .env.local as BRAVE_API_KEY

const RSS_FEEDS = {
  fashion: [
    // Majors
    { name: "Vogue", url: "https://www.vogue.com/feed/rss" },
    { name: "Vogue UK", url: "https://www.vogue.co.uk/feed/rss" },
    { name: "Vanity Fair", url: "https://www.vanityfair.com/feed/rss" },
    { name: "Harper's Bazaar", url: "https://www.harpersbazaar.com/rss/all.xml/" },
    { name: "Elle", url: "https://www.elle.com/rss/all.xml/" },
    { name: "W Magazine", url: "https://www.wmagazine.com/feed/rss" },
    // Independent / editorial
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
    // LGBTQ+ outlets
    { name: "PinkNews", url: "https://www.pinknews.co.uk/feed/" },
    { name: "Them", url: "https://www.them.us/feed/rss" },
    { name: "Attitude", url: "https://www.attitude.co.uk/feed/" },
    { name: "Gay Times", url: "https://www.gaytimes.co.uk/feed/" },
    { name: "Out Magazine", url: "https://www.out.com/rss.xml" },
    { name: "The Advocate", url: "https://www.advocate.com/rss.xml" },
    { name: "Queerty", url: "https://www.queerty.com/feed" },
    { name: "LGBTQ Nation", url: "https://www.lgbtqnation.com/feed/" },
    { name: "Towleroad", url: "https://www.towleroad.com/feed/" },
    // Crossover culture
    { name: "Dazed", url: "https://www.dazeddigital.com/rss" },
    { name: "Paper Magazine", url: "https://www.papermag.com/rss" },
    { name: "Nylon", url: "https://www.nylon.com/feed/rss" },
  ],
  underground: [
    // Underground / club / music culture
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
  ],
};

// General trending queries run on every tab to surface what's big right now
const TRENDING_QUERIES = [
  "trending now",
  "viral today",
  "pop culture news",
  "celebrity news today",
  "entertainment news today",
  "what is trending on social media",
  "biggest story today",
  "cultural moment",
];

const BRAVE_QUERIES = {
  fashion: [
    // Madonna
    "Madonna",
    "Madonna news",
    // Fashion
    "fashion trends",
    "fashion week",
    "Met Gala",
    "celebrity style",
    "luxury fashion",
    "beauty trends",
    "designer news",
    "runway trends",
    "street style",
    "fashion collaboration",
    "supermodel",
    "haute couture",
    "fashion campaign",
  ],
  gay: [
    // Madonna
    "Madonna",
    "Madonna news",
    // LGBTQ
    "LGBTQ news",
    "pride",
    "queer culture",
    "drag race",
    "ballroom voguing",
    "gay rights",
    "queer music",
    "trans rights news",
    "LGBTQ celebrities",
    "nightlife culture",
    "queer art",
    "pride festival",
  ],
  underground: [
    // Madonna
    "Madonna",
    "Madonna news",
    // Music / club / underground
    "music news",
    "new album release",
    "club culture",
    "dance music",
    "electronic music",
    "festival news",
    "DJ news",
    "house music",
    "techno",
    "disco",
    "hip hop",
    "vinyl culture",
    "independent music",
    "streaming charts",
  ],
};

async function fetchRSS(url, sourceName) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MadonnaCulturalEngine/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();
    const items = [];
    // Simple XML parsing for RSS items
    const itemMatches = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const item of itemMatches.slice(0, 5)) {
      const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "";
      const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "";
      const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "";
      const cleanTitle = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
      const cleanDesc = desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
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
    const params = new URLSearchParams({ q: query, count: "8", freshness: "pm" });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      description: (r.description || "").slice(0, 300),
      date: r.page_age || "",
      source: new URL(r.url).hostname.replace("www.", ""),
      type: "brave",
    }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { category = "fashion" } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.fashion;
  const categoryQueries = BRAVE_QUERIES[category] || BRAVE_QUERIES.fashion;
  // Combine category-specific + general trending queries
  const queries = [...categoryQueries, ...TRENDING_QUERIES];

  // Fetch all sources in parallel
  const rssPromises = feeds.map((f) => fetchRSS(f.url, f.name));
  const bravePromises = queries.map((q) => fetchBraveSearch(q, apiKey));

  const [rssResults, braveResults] = await Promise.all([
    Promise.all(rssPromises),
    Promise.all(bravePromises),
  ]);

  const allRss = rssResults.flat();
  const allBrave = braveResults.flat();

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

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  res.status(200).json({
    category,
    hasBraveKey: !!apiKey,
    items: combined.slice(0, 50),
  });
}
