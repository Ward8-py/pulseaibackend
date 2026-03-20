// api/analyze.js
import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: "OPENROUTER_API_KEY not set" });

  // ── Parse body — handles both raw string and pre-parsed object ──
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON body" }); }
  }
  if (!body) return res.status(400).json({ error: "Empty body" });

  const { type, title, description, headlines } = body;

  let prompt = "";
  if (type === "article") {
    if (!title) return res.status(400).json({ error: "Missing title" });
    prompt = `Analyze this news article in exactly 2 sentences. First: key implication for tech/finance professionals. Second: sentiment with one-word reason.

Title: ${title}
Description: ${description || ""}

Respond with valid JSON only, no markdown: {"summary": "...", "sentiment": "bullish|bearish|neutral"}`;
  } else if (type === "briefing") {
    if (!headlines?.length) return res.status(400).json({ error: "Missing headlines" });
    prompt = `You are a senior analyst. Write a 3-sentence executive briefing from these headlines. Plain text only, no markdown, no bullet points.

Headlines: ${headlines.join("; ")}`;
  } else {
    return res.status(400).json({ error: "type must be 'article' or 'briefing'" });
  }

  try {
    const client = new OpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://pulseai.vercel.app",
        "X-Title": "PulseAI",
      },
    });

    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-3.2-3b-instruct:free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: type === "briefing" ? 200 : 150,
      temperature: 0.3,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[analyze] type=${type} response:`, text.slice(0, 100));

    if (type === "briefing") {
      return res.status(200).json({ briefing: text });
    }

    // Article — parse JSON
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
    return res.status(500).json({ error: "OpenRouter request failed", detail: err.message });
  }
}
