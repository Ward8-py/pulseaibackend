// api/test.js — directly tests Groq key, visit in browser to diagnose
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Say the word OK and nothing else." }],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(200).json({
        groq_reachable: true,
        groq_status: r.status,
        groq_error: data,
        key_prefix: key.slice(0, 8) + "...",
      });
    }

    return res.status(200).json({
      groq_reachable: true,
      groq_status: 200,
      groq_response: data.choices?.[0]?.message?.content,
      key_prefix: key.slice(0, 8) + "...",
    });
  } catch (err) {
    return res.status(200).json({
      groq_reachable: false,
      error: err.message,
    });
  }
}
