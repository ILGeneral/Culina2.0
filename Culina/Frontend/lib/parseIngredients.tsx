// lib/parseIngredients.ts
import { GROQ_API_KEY, GROQ_MODEL } from "@/lib/secrets";

export interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Uses Groq to parse a list of ingredient strings into structured objects.
 */
export async function parseIngredientsWithGroq(ingredients: string[]): Promise<ParsedIngredient[]> {
  try {
    const prompt = `
You are an AI that parses cooking ingredients into structured data.
Convert this list into JSON with name, quantity (number), and unit (string).

Example:
Input: ["2 pcs tomatoes", "100 g chicken", "a pinch of salt"]
Output: [
  { "name": "tomatoes", "quantity": 2, "unit": "pcs" },
  { "name": "chicken", "quantity": 100, "unit": "g" },
  { "name": "salt", "quantity": 0.5, "unit": "tsp" }
]

Now parse this:
${JSON.stringify(ingredients)}
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? "";

    // Try to parse JSON output
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Invalid response format");
    return parsed;
  } catch (err) {
    console.error("Error parsing ingredients with Groq:", err);
    return [];
  }
}
