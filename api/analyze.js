// api/analyze.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  // ── Parse body — Vercel can pass it as string, object, or undefined ──
  let body = req.body;
  if (!body) {
    // Try reading raw body from stream
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      return res.status(400).json({ error: "Could not parse body" });
    }
  }
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const title = body?.title;
  const description = body?.description || "";
  const type = body?.type; // optional — supports both old and new frontend

  if (!title && type !== "briefing") {
    return res.status(400).json({ error: "Missing title" });
  }

  // Build prompt based on type
  let prompt = "";
  if (type === "briefing") {
    const headlines = body?.headlines || [];
    if (!headlines.length) return res.status(400).json({ error: "Missing headlines" });
    prompt = `You are a senior analyst. Write a 3-sentence executive briefing from these headlines. Plain text only, no markdown.

Headlines: ${headlines.join("; ")}`;
  } else {
    prompt = `Analyze this news article in exactly 2 sentences. First: key implication for tech/finance professionals. Second: the overall sentiment.

Title: ${title}
Description: ${description}

Respond with valid JSON only — no markdown, no explanation:
{"summary": "two sentence analysis here", "sentiment": "bullish|bearish|neutral"}`;
  }

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
        max_tokens: type === "briefing" ? 200 : 150,
        temperature: 0.3,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("[analyze] Groq rejected:", JSON.stringify(data));
      return res.status(502).json({
        error: "Groq error",
        status: r.status,
        detail: data,
      });
    }

    const text = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[analyze] ok | type:", type || "article", "| text:", text.slice(0, 80));

    if (type === "briefing") {
      return res.status(200).json({ briefing: text });
    }

    // Parse JSON response
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      // Find JSON object in response even if model adds extra text
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json({
          summary: parsed.summary || text,
          sentiment: ["bullish","bearish","neutral"].includes(parsed.sentiment)
            ? parsed.sentiment : "neutral",
        });
      }
      throw new Error("no JSON found");
    } catch {
      // Fallback: extract sentiment from raw text
      const match = text.match(/\b(bullish|bearish|neutral)\b/i);
      return res.status(200).json({
        summary: text,
        sentiment: match ? match[1].toLowerCase() : "neutral",
      });
    }
  } catch (err) {
    console.error("[analyze] fetch threw:", err.message);
    return res.status(500).json({ error: "Network error contacting Groq", detail: err.message });
  }
}
