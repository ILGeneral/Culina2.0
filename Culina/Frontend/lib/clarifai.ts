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

export async function detectFoodFromImage(source: ClarifaiImageSource) {
  if (!source?.url && !source?.base64) {
    throw new Error("Clarifai detection requires a url or base64 image source");
  }

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

  if (!res.ok) throw new Error("Clarifai request failed");
  const json = await res.json();

  // Extract the top few predicted ingredients
  const concepts = json.outputs?.[0]?.data?.concepts || [];
  return concepts.map((c: any) => ({
    name: c.name,
    confidence: c.value,
  }));
}
