const CLARIFAI_USER_ID = process.env.CLARIFAI_USER_ID;
const CLARIFAI_APP_ID = process.env.CLARIFAI_APP_ID;
const CLARIFAI_MODEL_ID = process.env.CLARIFAI_MODEL_ID;
const CLARIFAI_MODEL_VERSION_ID = process.env.CLARIFAI_MODEL_VERSION_ID;
const CLARIFAI_PAT = process.env.CLARIFAI_PAT;

if (
  !CLARIFAI_USER_ID ||
  !CLARIFAI_APP_ID ||
  !CLARIFAI_MODEL_ID ||
  !CLARIFAI_MODEL_VERSION_ID ||
  !CLARIFAI_PAT
) {
  console.warn("Clarifai credentials are not fully configured.");
}

async function callClarifaiAPI({ imageUrl, imageBase64 }) {
  const payload = {
    user_app_id: {
      user_id: CLARIFAI_USER_ID,
      app_id: CLARIFAI_APP_ID,
    },
    inputs: [
      {
        data: {
          image: imageBase64
            ? { base64: imageBase64 }
            : { url: imageUrl },
        },
      },
    ],
  };

  const response = await fetch(
    `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/versions/${CLARIFAI_MODEL_VERSION_ID}/outputs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${CLARIFAI_PAT}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clarifai API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.status?.code !== 10000) {
    throw new Error(
      `Clarifai error: ${data.status?.description || "Unknown error"}`
    );
  }

  const concepts = data.outputs?.[0]?.data?.concepts || [];

  return concepts.map((concept) => ({
    name: concept.name,
    confidence: concept.value,
  }));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl, imageBase64 } = req.body || {};

  if (!imageUrl && !imageBase64) {
    return res
      .status(400)
      .json({ error: "imageUrl or imageBase64 is required" });
  }

  try {
    console.log(
      `🔍 Detecting food from image: ${imageUrl ? "URL" : "base64"}`
    );
    const concepts = await callClarifaiAPI({ imageUrl, imageBase64 });
    console.log(`✅ Detected ${concepts.length} concepts`);
    return res.status(200).json({ concepts });
  } catch (error) {
    console.error("Clarifai detection error:", error);
    return res.status(500).json({
      error: error.message || "Failed to detect ingredients",
    });
  }
}