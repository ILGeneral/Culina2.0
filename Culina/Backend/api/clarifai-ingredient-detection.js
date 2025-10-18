const { Model } = require("clarifai-nodejs");

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

let clarifaiModel = null;

function getClarifaiModel() {
  if (!clarifaiModel) {
    const baseUrl = `https://clarifai.com/${CLARIFAI_USER_ID}/${CLARIFAI_APP_ID}/models/${CLARIFAI_MODEL_ID}`;
    const url = CLARIFAI_MODEL_VERSION_ID ? `${baseUrl}/versions/${CLARIFAI_MODEL_VERSION_ID}` : baseUrl;

    clarifaiModel = new Model({
      url,
      authConfig: {
        pat: CLARIFAI_PAT,
      },
    });
  }
  return clarifaiModel;
}

async function callClarifai({ url, base64 }) {
  if (!url && !base64) {
    throw new Error("A valid image url or base64 string is required");
  }

  const imagePayload = base64 ? { base64 } : { url };

  const model = getClarifaiModel();

  const response = await model.predict({
    methodName: "predict",
    inputs: [
      {
        data: {
          image: {
            ...imagePayload,
          },
        },
      },
    ],
  });

  const outputData = Model.getOutputDataFromModelResponse(response) || [];

  const concepts = outputData.flatMap((item) => item?.concepts || []);

  return concepts.map((concept) => ({
    name: concept.name,
    confidence: concept.value ?? concept.confidence,
  }));
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { imageUrl, imageBase64 } = req.body || {};

  if (!imageUrl && !imageBase64) {
    res.status(400).json({ error: "imageUrl or imageBase64 is required" });
    return;
  }

  try {
    const concepts = await callClarifai({ url: imageUrl, base64: imageBase64 });
    res.status(200).json({ concepts });
  } catch (error) {
    console.error("Clarifai handler error:", error);
    res.status(500).json({ error: "Failed to detect ingredients" });
  }
}

module.exports = handler;
module.exports.callClarifai = callClarifai;
