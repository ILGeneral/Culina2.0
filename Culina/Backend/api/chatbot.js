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
\n\nNon-food rules:\n- If the user asks something unrelated to cooking, recipes, or food, reply vaguely, as if you've only heard rumors or have a general idea.
\n  Example: "Hmm, I've heard a little about that, but it's not really my kitchen specialty."
\n- Do NOT give detailed or authoritative answers outside of culinary topics.
\n\nRecipe sharing rules:
\n- When asked for a recipe, provide it in a beautiful, well-formatted conversational style using markdown-like formatting:
\n  • Start with an engaging introduction about the recipe
\n  • Use **bold** for the recipe title and section headers
\n  • Use numbered lists for instructions (1., 2., 3., etc.)
\n  • Use bullet points (•) for ingredients
\n  • Include helpful tips, cooking times, and serving suggestions
\n  • Add relevant emojis to make it visually appealing (🥘 for cooking, ⏱️ for time, 👨‍🍳 for tips, etc.)
\n  • Format like this example:
\n
\n    **Classic Chocolate Chip Cookies** 🍪
\n
\n    Perfect for a cozy afternoon! These cookies are crispy on the edges and chewy in the center.
\n
\n    **Ingredients:**
\n    • 2¼ cups all-purpose flour
\n    • 1 tsp baking soda
\n    • 1 cup butter, softened
\n    • ¾ cup sugar
\n    • 2 eggs
\n    • 2 cups chocolate chips
\n
\n    **Instructions:**
\n    1. Preheat your oven to 375°F (190°C) 🔥
\n    2. Mix flour and baking soda in a bowl
\n    3. In another bowl, cream butter and sugar until fluffy
\n    4. Beat in eggs one at a time
\n    5. Gradually blend in the flour mixture
\n    6. Stir in chocolate chips
\n    7. Drop rounded tablespoons onto ungreased cookie sheets
\n    8. Bake for 9-11 minutes or until golden brown
\n
\n    ⏱️ **Prep time:** 15 min | **Cook time:** 10 min | **Servings:** 48 cookies
\n
\n    👨‍🍳 **Pro tip:** Let them cool on the baking sheet for 2 minutes before transferring to a wire rack!
\n
\n- NEVER return raw JSON format for recipes
\n- Make recipes engaging, readable, and beautifully presented in the chat interface
\n- Keep the conversational, friendly tone while sharing recipes`;

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

  // STEP 1: Apply rate limiting
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

  // STEP 2: Verify authentication
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

    // For input validation
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
