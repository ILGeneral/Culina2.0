const REQUIRED_ENV_VARS = [
  "EXPO_PUBLIC_CLARIFAI_PAT",
  "EXPO_PUBLIC_CLARIFAI_USER_ID",
  "EXPO_PUBLIC_CLARIFAI_APP_ID",
  "EXPO_PUBLIC_CLARIFAI_MODEL_ID",
  "EXPO_PUBLIC_CLARIFAI_MODEL_VERSION_ID",
] as const;

function getEnvVariable(name: (typeof REQUIRED_ENV_VARS)[number]) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const CLARIFAI_PAT = getEnvVariable("EXPO_PUBLIC_CLARIFAI_PAT");
const CLARIFAI_USER_ID = getEnvVariable("EXPO_PUBLIC_CLARIFAI_USER_ID");
const CLARIFAI_APP_ID = getEnvVariable("EXPO_PUBLIC_CLARIFAI_APP_ID");
const CLARIFAI_MODEL_ID = getEnvVariable("EXPO_PUBLIC_CLARIFAI_MODEL_ID");
const CLARIFAI_MODEL_VERSION_ID = getEnvVariable("EXPO_PUBLIC_CLARIFAI_MODEL_VERSION_ID");

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
