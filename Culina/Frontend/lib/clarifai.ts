<<<<<<< Updated upstream
import {
  CLARIFAI_APP_ID,
  CLARIFAI_MODEL_ID,
  CLARIFAI_MODEL_VERSION_ID,
  CLARIFAI_PAT,
  CLARIFAI_USER_ID,
} from "@/lib/secrets";

export async function detectFoodFromImage(imageUrl: string) {
  const raw = JSON.stringify({
    user_app_id: {
      user_id: CLARIFAI_USER_ID,
      app_id: CLARIFAI_APP_ID,
    },
    inputs: [{ data: { image: { url: imageUrl } } }],
  });

  const res = await fetch(
    `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/versions/${CLARIFAI_MODEL_VERSION_ID}/outputs`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Key ${CLARIFAI_PAT}`,
      },
      body: raw,
    }
  );

  if (!res.ok) throw new Error("Clarifai request failed");
  const json = await res.json();

  // Extract the top few predicted ingredients
  const concepts = json.outputs?.[0]?.data?.concepts || [];
  return concepts.map((c: any) => ({
    name: c.name,
    confidence: c.value,
  }));
}
=======
type ClarifaiImageSource = {
  url?: string;
  base64?: string;
};

const API_BASE = "https://culina-backend.vercel.app/api";

export async function detectFoodFromImage(source: ClarifaiImageSource) {
  if (!source?.url && !source?.base64) {
    throw new Error("Clarifai detection requires a url or base64 image source");
  }

  try {
    // Only send base64 if available, otherwise send URL
    const payload = source.base64
      ? { imageBase64: source.base64 }
      : { imageUrl: source.url };

    console.log("Sending to Clarifai backend:", { 
      hasBase64: !!source.base64, 
      hasUrl: !!source.url 
    });

    const res = await fetch(`${API_BASE}/clarifai-ingredient-detection`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Clarifai backend request failed (${res.status}): ${text}`);
    }

    const json = await res.json();
    const concepts = json?.concepts ?? [];
    
    console.log("Detection successful:", concepts);
    
    return concepts.map((c: any) => ({
      name: c.name,
      confidence: c.confidence,
    }));
  } catch (err) {
    console.error("Clarifai detection error:", err);
    throw err;
  }
}
>>>>>>> Stashed changes
