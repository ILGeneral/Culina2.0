import {
  CLARIFAI_APP_ID,
  CLARIFAI_MODEL_ID,
  CLARIFAI_MODEL_VERSION_ID,
  CLARIFAI_PAT,
  CLARIFAI_USER_ID,
} from "@/lib/secrets";

type ClarifaiImageSource = {
  url?: string;
  base64?: string;
};

const API_BASE = "https://culina-backend.vercel.app/api";

const hasDirectClarifaiCredentials = Boolean(
  CLARIFAI_USER_ID &&
    CLARIFAI_APP_ID &&
    CLARIFAI_MODEL_ID &&
    CLARIFAI_MODEL_VERSION_ID &&
    CLARIFAI_PAT
);

export async function detectFoodFromImage(source: ClarifaiImageSource) {
  if (!source?.url && !source?.base64) {
    throw new Error("Clarifai detection requires a url or base64 image source");
  }

  const backendResult = await tryBackendClarifai(source);
  if (backendResult) return backendResult;

  if (hasDirectClarifaiCredentials) {
    return directClarifai(source);
  }

  throw new Error("Clarifai detection failed: backend unavailable and direct credentials missing");
}

async function tryBackendClarifai(source: ClarifaiImageSource) {
  try {
    const res = await fetch(`${API_BASE}/clarifai-ingredient-detection`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageUrl: source.url,
        imageBase64: source.base64,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Clarifai backend request failed (${res.status}): ${text}`);
    }

    const json = await res.json();
    const concepts = json?.concepts ?? [];
    return concepts.map((c: any) => ({
      name: c.name,
      confidence: c.confidence,
    }));
  } catch (err) {
    console.warn("Clarifai backend request failed, attempting direct fallback", err);
    return null;
  }
}

async function directClarifai(source: ClarifaiImageSource) {
  const imagePayload = source.base64 ? { base64: source.base64 } : { url: source.url };

  const raw = JSON.stringify({
    user_app_id: {
      user_id: CLARIFAI_USER_ID,
      app_id: CLARIFAI_APP_ID,
    },
    inputs: [{ data: { image: imagePayload } }],
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clarifai direct request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const concepts = json.outputs?.[0]?.data?.concepts || [];
  return concepts.map((c: any) => ({
    name: c.name,
    confidence: c.value,
  }));
}
