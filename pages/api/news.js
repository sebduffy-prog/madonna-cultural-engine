// Cultural feed API - aggregates Brave Search + RSS feeds
// Brave API key goes in .env.local as BRAVE_API_KEY
//
// BUDGET: 6,000 queries/month (Brave paid tier)
// News: 6 queries per category × 4 categories = 24 per daily refresh = 720/month
// Social: ~25 queries per daily refresh = 750/month
// Total committed: ~1,470/month — manual refreshes use the rest
// RSS feeds are free/unlimited — scan deep

import { kvGet, kvSet, kvIsFresh } from "../../lib/kv";

const CACHE_TTL = 43200; // 12 hours — daily cron refreshes

const RSS_FEEDS = {
  madonna: [
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
    { name: "BBC Music", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
    { name: "The Telegraph", url: "https://www.telegraph.co.uk/music/rss.xml" },
    { name: "Evening Standard", url: "https://www.standard.co.uk/showbiz/rss" },
    { name: "People", url: "https://people.com/feed/" },
    { name: "Entertainment Weekly", url: "https://ew.com/feed/" },
    { name: "E! Online", url: "https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml" },
    { name: "TMZ", url: "https://www.tmz.com/rss.xml" },
    { name: "Page Six", url: "https://pagesix.com/feed/" },
    { name: "Daily Mail Showbiz", url: "https://www.dailymail.co.uk/tvshowbiz/index.rss" },
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
    { name: "Marie Claire", url: "https://www.marieclaire.com/rss/all.xml/" },
    { name: "InStyle", url: "https://www.instyle.com/feed" },
    { name: "Glamour", url: "https://www.glamourmagazine.co.uk/feed/rss" },
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
    { name: "INTO", url: "https://www.intomore.com/feed/" },
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
    { name: "Fact Magazine", url: "https://www.factmag.com/feed/" },
    { name: "Loud And Quiet", url: "https://www.loudandquiet.com/feed/" },
  ],
};

// 6 queries per category — deep and specific
const BRAVE_QUERIES = {
  madonna: [
    "Madonna",
    "Madonna news interview profile feature 2026",
    "Madonna album OR tour OR concert OR comeback OR Netflix",
    "Madonna \"Stuart Price\" OR \"Warner Records\" OR \"new album\" OR \"new single\"",
    "Madonna fashion OR style OR \"Met Gala\" OR Vogue OR campaign OR \"red carpet\"",
    "Madonna legacy OR influence OR \"cultural impact\" OR tribute OR documentary",
  ],
  fashion: [
    "Madonna fashion style designer campaign editorial",
    "Madonna Dolce Gabbana OR Versace OR \"Jean Paul Gaultier\" OR couture",
    "fashion trends Met Gala runway couture celebrity style 2026",
    "luxury fashion designer collaboration editorial campaign 2026",
    "pop star fashion icon celebrity style influence",
    "street style fashion week emerging designer trend",
  ],
  gay: [
    "Madonna LGBTQ pride queer \"gay icon\" ballroom",
    "Madonna pride OR drag OR \"ballroom scene\" OR \"queer community\"",
    "LGBTQ news pride queer culture drag ballroom 2026",
    "queer celebrities trans visibility gay rights pride month",
    "LGBTQ music artists queer pop culture nightlife",
    "drag race ballroom culture vogue dance queer art",
  ],
  culture: [
    "Madonna music club culture dance electronic",
    "Madonna \"club culture\" OR \"dance music\" OR DJ OR underground OR remix",
    "club culture dance music house techno disco 2026",
    "underground music scene electronic festival DJ new releases",
    "pop culture music trends viral moment cultural impact",
    "nightlife club scene dance floor underground party",
  ],
};

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018").replace(/&#8217;/g, "\u2019")
    .replace(/&#8211;/g, "\u2013").replace(/&#8212;/g, "\u2014")
    .replace(/&#8230;/g, "\u2026").replace(/&#038;/g, "&").replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace(/&#|;/g, ""), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    });
}

function parseRSSItem(item) {
  const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "";
  const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] ||
    (item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [])[1] || "";
  const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] ||
    (item.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1] ||
    (item.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || [])[1] || "";
  const cleanTitle = decodeEntities(title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
  const cleanDesc = decodeEntities(desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
  const cleanLink = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return { title: cleanTitle, url: cleanLink, description: cleanDesc, date: pubDate };
}

function parseAtomEntry(entry) {
  const title = (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const linkHref = (entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i) || [])[1] || "";
  const linkBody = (entry.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "";
  const desc = (entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [])[1] ||
    (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || [])[1] || "";
  const pubDate = (entry.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || [])[1] ||
    (entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1] || "";
  const cleanTitle = decodeEntities(title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
  const cleanDesc = decodeEntities(desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
  const cleanLink = (linkHref || linkBody).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return { title: cleanTitle, url: cleanLink, description: cleanDesc, date: pubDate };
}

async function fetchRSS(url, sourceName, maxItems = 15) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MadonnaCulturalEngine/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const items = [];

    // RSS <item> format
    const rssMatches = text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const raw of rssMatches.slice(0, maxItems)) {
      const parsed = parseRSSItem(raw);
      if (parsed.title) {
        items.push({ ...parsed, description: parsed.description.slice(0, 400), source: sourceName, type: "rss" });
      }
    }

    // Atom <entry> format
    if (items.length === 0) {
      const atomMatches = text.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
      for (const raw of atomMatches.slice(0, maxItems)) {
        const parsed = parseAtomEntry(raw);
        if (parsed.title) {
          items.push({ ...parsed, description: parsed.description.slice(0, 400), source: sourceName, type: "rss" });
        }
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
    const params = new URLSearchParams({ q: query, count: "20", freshness: "pw" });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    // Pull from both web results AND discussions
    const web = (data.web?.results || []).map((r) => ({
      title: decodeEntities(r.title || ""),
      url: r.url || "",
      description: decodeEntities((r.description || "").slice(0, 400)),
      date: r.page_age || "",
      source: (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
      type: "brave",
    }));

    const discussions = (data.discussions?.results || []).map((r) => ({
      title: decodeEntities(r.title || ""),
      url: r.url || "",
      description: decodeEntities((r.description || "").slice(0, 400)),
      date: r.data?.question_posted_at || r.page_age || "",
      source: r.data?.forum_name || (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return ""; } })(),
      type: "brave",
      comments: r.data?.num_answers || 0,
    }));

    return [...web, ...discussions];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { category = "madonna", refresh } = req.query;
  const apiKey = process.env.BRAVE_API_KEY || "";
  const cacheKey = `feeds:${category}`;

  // Return cached data if not force-refreshing
  if (!refresh) {
    const cached = await kvGet(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }
  }

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.madonna;
  const queries = BRAVE_QUERIES[category] || BRAVE_QUERIES.madonna;

  // RSS is free — scan deep. Madonna tab scans 50 items per feed.
  const rssDepth = category === "madonna" ? 50 : 20;
  const rssPromises = feeds.map((f) => fetchRSS(f.url, f.name, rssDepth));
  const bravePromises = queries.map((q) => fetchBraveSearch(q, apiKey));

  const [rssResults, braveResults] = await Promise.all([
    Promise.all(rssPromises),
    Promise.all(bravePromises),
  ]);

  let allRss = rssResults.flat();
  const allBrave = braveResults.flat();

  // Madonna tab: prioritise Madonna-specific, but always include all if few found
  if (category === "madonna") {
    const matched = allRss.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return text.includes("madonna");
    });
    allRss = matched.length >= 5 ? matched : [...matched, ...allRss.filter(item => !matched.includes(item))];
  }

  // Deduplicate by URL
  const seen = new Set();
  const combined = [...allBrave, ...allRss].filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Sort by date (newest first)
  combined.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  const maxItems = category === "madonna" ? 100 : 60;

  const result = {
    category,
    hasBraveKey: !!apiKey,
    items: combined.slice(0, maxItems),
    totalFound: combined.length,
    braveResults: allBrave.length,
    rssResults: allRss.length,
    queriesUsed: queries.length,
    cachedAt: new Date().toISOString(),
  };

  await kvSet(cacheKey, result, CACHE_TTL);

  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  res.status(200).json(result);
}
