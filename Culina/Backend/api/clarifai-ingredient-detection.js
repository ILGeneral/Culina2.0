const fetch = require("node-fetch");

const {
  CLARIFAI_USER_ID,
  CLARIFAI_APP_ID,
  CLARIFAI_MODEL_ID,
  CLARIFAI_MODEL_VERSION_ID,
  CLARIFAI_PAT,
} = process.env;

if (!CLARIFAI_USER_ID || !CLARIFAI_APP_ID || !CLARIFAI_MODEL_ID || !CLARIFAI_MODEL_VERSION_ID || !CLARIFAI_PAT) {
  console.warn("Clarifai credentials are not fully configured. Please set CLARIFAI_USER_ID, CLARIFAI_APP_ID, CLARIFAI_MODEL_ID, CLARIFAI_MODEL_VERSION_ID, and CLARIFAI_PAT.");
}

async function callClarifai(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("A valid imageUrl string is required");
  }

  const body = {
    user_app_id: {
      user_id: CLARIFAI_USER_ID,
      app_id: CLARIFAI_APP_ID,
    },
    inputs: [
      {
        data: {
          image: {
            url: imageUrl,
          },
        },
      },
    ],
  };

  const response = await fetch(
    `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/versions/${CLARIFAI_MODEL_VERSION_ID}/outputs`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Key ${CLARIFAI_PAT}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clarifai request failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const concepts = json.outputs?.[0]?.data?.concepts || [];

  return concepts.map((concept) => ({
    name: concept.name,
    confidence: concept.value,
  }));
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { imageUrl } = req.body || {};

  if (!imageUrl || typeof imageUrl !== "string") {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }

  try {
    const concepts = await callClarifai(imageUrl);
    res.status(200).json({ concepts });
  } catch (error) {
    console.error("Clarifai handler error:", error);
    res.status(500).json({ error: "Failed to detect ingredients" });
  }
}

module.exports = handler;
module.exports.callClarifai = callClarifai;
