import { Model } from "clarifai-nodejs";
import { verifyAuthToken } from '../lib/firebase-admin.js';
import { clarifaiLimiter } from '../lib/rate-limiter.js';

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

  // Build image payload - only include the field that has a value
  const imagePayload = {};
  if (base64) {
    imagePayload.base64 = base64;
  } else if (url) {
    imagePayload.url = url;
  }

  const model = getClarifaiModel();

  const response = await model.predict({
    methodName: "predict",
    inputs: [
      {
        data: {
          image: imagePayload,
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

  //STEP 1: Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      clarifaiLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve(result);
      });
    });
  } catch (rateLimitError) {
    return;
  }

  //STEP 2: Verify authentication
  try {
    await verifyAuthToken(req);
  } catch (authError) {
    return res.status(401).json({ error: authError.message });
  }

  const { imageUrl, imageBase64 } = req.body || {};

  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: "imageUrl or imageBase64 is required" });
  }

  // Validate Base64 size to prevent memory exhaustion
  if (imageBase64 && imageBase64.length > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({ error: "Image too large. Maximum 10MB." });
  }

  // Validate URL format
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return res.status(400).json({ error: "Only HTTP(S) URLs are allowed" });
      }
    } catch (error) {
      return res.status(400).json({ error: "Invalid image URL" });
    }
  }

  try {
    const concepts = await callClarifai({ url: imageUrl, base64: imageBase64 });
    return res.status(200).json({ concepts });
  } catch (error) {
    console.error("Clarifai handler error:", error);
    return res.status(500).json({ error: "Failed to detect ingredients" });
  }
}

export { callClarifai };
