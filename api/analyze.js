// api/analyze.js
// POST /api/analyze
// Body: { type: "article", title, description }
//    or { type: "briefing", headlines: [] }
// Uses OpenRouter SDK with meta-llama/llama-3.2-3b-instruct:free

import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: "OPENROUTER_API_KEY not configured on server" });

  const { type, title, description, headlines } = req.body;

  let prompt = "";
  if (type === "article") {
    if (!title) return res.status(400).json({ error: "Missing title" });
    prompt = `Analyze this news article in exactly 2 sentences. First: key implication for tech/finance professionals. Second: sentiment with one-word reason.

Title: ${title}
Description: ${description || ""}

Respond with valid JSON only, no markdown, no explanation: {"summary": "...", "sentiment": "bullish|bearish|neutral"}`;
  } else if (type === "briefing") {
    if (!headlines?.length) return res.status(400).json({ error: "Missing headlines" });
    prompt = `You are a senior analyst. Write a 3-sentence executive briefing from these headlines. Plain text only, no markdown, no bullet points.

Headlines: ${headlines.join("; ")}`;
  } else {
    return res.status(400).json({ error: "type must be 'article' or 'briefing'" });
  }

  try {
    // OpenRouter is OpenAI-compatible — use openai sdk pointed at OpenRouter
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

    if (type === "briefing") {
      return res.status(200).json({ briefing: text });
    }

    // Article — parse JSON from model response
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      // If JSON parse fails, extract sentiment with regex fallback
      const match = text.match(/\b(bullish|bearish|neutral)\b/i);
      return res.status(200).json({
        summary: text,
        sentiment: match ? match[1].toLowerCase() : "neutral",
      });
    }
  } catch (err) {
    console.error("analyze.js error:", err);
    return res.status(500).json({ error: "OpenRouter request failed", detail: err.message });
  }
}
