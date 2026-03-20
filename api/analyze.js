// api/analyze.js — article sentiment analysis via Groq

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  if (!body) return res.status(400).json({ error: "Empty body" });

  const { title, description } = body;
  if (!title) return res.status(400).json({ error: "Missing title" });

  const prompt = `Analyze this news article in exactly 2 sentences. First: key implication for tech/finance professionals. Second: sentiment with one-word reason.

Title: ${title}
Description: ${description || ""}

Respond with valid JSON only, no markdown: {"summary": "...", "sentiment": "bullish|bearish|neutral"}`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("[analyze] Groq error:", err);
      return res.status(502).json({ error: "Groq error", detail: err });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return res.status(200).json(JSON.parse(clean));
    } catch {
      const match = text.match(/\b(bullish|bearish|neutral)\b/i);
      return res.status(200).json({
        summary: text,
        sentiment: match ? match[1].toLowerCase() : "neutral",
      });
    }
  } catch (err) {
    console.error("[analyze] error:", err.message);
    return res.status(500).json({ error: "Failed to contact Groq", detail: err.message });
  }
}
