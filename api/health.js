export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    status: "ok",
    keys: {
      newsapi:  !!process.env.NEWS_API_KEY,
      groq:     !!process.env.GROQ_API_KEY,
    },
    model: "llama-3.3-70b-versatile",
    timestamp: new Date().toISOString(),
  });
}
