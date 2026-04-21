// Debug endpoint — shows raw Brave Search numbers for each query
// Hit /api/social-debug to see what total_count and item counts look like

export default async function handler(req, res) {
  const apiKey = process.env.BRAVE_API_KEY || "";
  if (!apiKey) return res.status(200).json({ error: "No Brave API key" });

  // Run 5 test queries with different freshness to see raw numbers
  const tests = [
    { q: "site:reddit.com Madonna", freshness: "pd", label: "Reddit Madonna (past day)" },
    { q: "site:reddit.com Madonna", freshness: "pw", label: "Reddit Madonna (past week)" },
    { q: "site:youtube.com Madonna", freshness: "pd", label: "YouTube Madonna (past day)" },
    { q: "site:youtube.com Madonna", freshness: "pw", label: "YouTube Madonna (past week)" },
    { q: "site:tiktok.com Madonna", freshness: "pw", label: "TikTok Madonna (past week)" },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const params = new URLSearchParams({ q: test.q, count: "20", freshness: test.freshness });
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        results.push({ ...test, error: `HTTP ${r.status}`, totalCount: null, itemsReturned: 0 });
        continue;
      }
      const data = await r.json();
      const webResults = data.web?.results || [];
      const discussions = data.discussions?.results || [];

      results.push({
        label: test.label,
        query: test.q,
        freshness: test.freshness,
        // Raw Brave response fields
        totalCount: data.web?.total_count,
        totalCountType: typeof data.web?.total_count,
        webResultsReturned: webResults.length,
        discussionsReturned: discussions.length,
        totalItemsReturned: webResults.length + discussions.length,
        // Check what other count fields exist
        rawWebKeys: Object.keys(data.web || {}),
        rawTopKeys: Object.keys(data),
        // Sample first result
        firstResult: webResults[0] ? {
          title: webResults[0].title,
          url: webResults[0].url,
          page_age: webResults[0].page_age,
          age: webResults[0].age,
        } : null,
        // First discussion
        firstDiscussion: discussions[0] ? {
          title: discussions[0].title,
          url: discussions[0].url,
          num_answers: discussions[0].data?.num_answers,
          score: discussions[0].data?.score,
        } : null,
      });

      // Small delay between calls
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      results.push({ ...test, error: err.message });
    }
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    queriesRun: results.length,
    results,
  });
}
