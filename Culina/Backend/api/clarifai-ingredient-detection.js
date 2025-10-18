const sharp = require("sharp");
const { put } = require("@vercel/blob");
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

async function compressAndUploadImage(base64String) {
  try {
    // Remove data URI prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Compress image using sharp
    const compressedBuffer = await sharp(buffer)
      .resize(640, 640, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 60, progressive: true })
      .toBuffer();

    const originalSize = Buffer.byteLength(base64Data, "base64");
    const compressedSize = compressedBuffer.length;

    console.log(
      `Image compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
    );

    // Upload to Vercel Blob
    const filename = `ingredient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const blob = await put(filename, compressedBuffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    console.log(`Image uploaded to: ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error("Image compression/upload failed:", error);
    throw new Error("Failed to process image");
  }
}

async function callClarifai({ url, base64 }) {
  if (!url && !base64) {
    throw new Error("A valid image url or base64 string is required");
  }

  let imageUrl = url;

  // If base64 is provided, compress and upload to get a URL
  if (base64) {
    console.log("Base64 detected, compressing and uploading to Blob Storage...");
    imageUrl = await compressAndUploadImage(base64);
    console.log("Image URL from Blob Storage:", imageUrl);
  }

  // Use Clarifai REST API directly instead of SDK
  const requestBody = {
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clarifai API request failed (${response.status}): ${text}`);
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