// api/news.js
// GET /api/news?q=technology&page=1
// Proxies NewsAPI — key stays server-side

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query param: q" });

  const key = process.env.NEWS_API_KEY;
  if (!key) return res.status(500).json({ error: "NEWS_API_KEY not configured on server" });

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=30&page=${page}&apiKey=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.status === "error") return res.status(400).json({ error: data.message });
    const articles = (data.articles || []).filter(a => a.title && a.title !== "[Removed]");
    return res.status(200).json({ articles, total: data.totalResults || articles.length });
  } catch (err) {
    console.error("news.js error:", err);
    return res.status(500).json({ error: "Failed to fetch from NewsAPI" });
  }
}
