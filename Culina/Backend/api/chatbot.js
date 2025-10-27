import { verifyAuthToken } from '../lib/firebase-admin.js';
import { chatbotLimiter } from '../lib/rate-limiter.js';

const sanitizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry) => entry && typeof entry === "object")
    .map(({ role, content }) => ({ role, content }))
    .filter(
      (entry) =>
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        entry.content.trim().length > 0
    )
    .slice(-10); // keep last 10 exchanges for brevity
};

const SYSTEM_PROMPT = `You are Culina 🍳, a cheerful, confident, and supportive AI kitchen companion.
\nYou speak like a warm friend who loves cooking, always encouraging and making the user feel excited.
\nUse natural, human-like tone (like "Let's whip this up!" or "Ooo, that combo sounds delicious!").
\n\nPersonality rules:\n- Be friendly, positive, and sprinkle in light emojis (🥕🔥🍋🍫), but not too many.
\n- Sound confident and human — avoid robotic phrasing.\n- If the user seems unsure, reassure them with kindness.
\n\nKnowledge rules:
\n- You have **deep expertise** in culinary arts, recipes, cooking techniques, food science, and ingredients.
\n- Always answer thoroughly and with confidence when the question is food-related.
\n\nNon-food rules:\n- If the user asks something unrelated to cooking, recipes, or food, reply vaguely, as if you’ve only heard rumors or have a general idea.
\n  Example: "Hmm, I’ve heard a little about that, but it’s not really my kitchen specialty."
\n- Do NOT give detailed or authoritative answers outside of culinary topics.
\n\nRecipe rules:\n- If asked for a recipe, respond ONLY in **valid JSON** format:
\n  {\n    "title": "string",\n    "ingredients": ["item1", "item2"],
\n    "instructions": ["step 1", "step 2"]\n  }
\nOtherwise, reply with natural conversation.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ STEP 1: Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      chatbotLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve(result);
      });
    });
  } catch (rateLimitError) {
    // Rate limit exceeded - limiter already sent response
    return;
  }

  // ✅ STEP 2: Verify authentication
  try {
    await verifyAuthToken(req);
  } catch (authError) {
    return res.status(401).json({ error: authError.message });
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY environment variable" });
  }

  try {
    const { message, history, model } = req.body || {};

    // ✅ SECURITY FIX: Add input validation
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "`message` is required and must be a string" });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long. Maximum 2000 characters." });
    }

    const conversation = sanitizeHistory(history);
    const activeModel = typeof model === "string" && model.trim().length
      ? model.trim()
      : "llama-3.1-8b-instant";

    const payload = {
      model: activeModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversation,
        { role: "user", content: message.trim() },
      ],
      temperature: 0.7,
      max_tokens: 800,
    };

    const fetch = (await import("node-fetch")).default;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", errorText);
      return res.status(502).json({ error: "Groq service unavailable" });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("Empty Groq response:", data);
      return res.status(502).json({ error: "Empty response from Groq" });
    }

    return res.status(200).json({ reply, model: activeModel });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({ error: error.message || "Chatbot request failed" });
  }
};
