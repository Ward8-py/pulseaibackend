// api/health.js
// GET /api/health — check server is alive and keys are set
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    status: "ok",
    keys: {
      newsapi:    !!process.env.NEWS_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    },
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    timestamp: new Date().toISOString(),
  });
}
