import { GROQ_API_KEY, GROQ_MODEL } from "@/lib/secrets";

export async function generateRecipeFromInventory(
  ingredients: any[],
  preferences: { diet?: string; religion?: string; caloriePlan?: string }
) {
  const prompt = `
You are a culinary AI assistant that creates creative, healthy recipes.

User Preferences:
- Diet: ${preferences.diet || "None"}
- Religion: ${preferences.religion || "None"}
- Calorie Goal: ${preferences.caloriePlan || "Maintain weight"}

Available ingredients (with quantity & units):
${ingredients.map(i => `${i.name} - ${i.quantity} ${i.unit}`).join(", ")}

Please generate one recipe that fits all preferences and uses only these ingredients.
Return the result as structured JSON with these keys:
{
  "title": string,
  "description": string,
  "ingredients": string[],
  "instructions": string[],
  "servings": number,
  "estimatedCalories": number
}
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    }),
  });

  if (!response.ok) throw new Error("Groq API request failed");

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Invalid JSON response from AI");
  }
}
