import { put } from "@vercel/blob";
import { verifyAuthToken } from '../lib/firebase-admin.js';
import { uploadLimiter } from '../lib/rate-limiter.js';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    sizeLimit: "5mb", // Limit payload to 5MB
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ STEP 1: Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      uploadLimiter(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result);
        }
        resolve(result);
      });
    });
  } catch (rateLimitError) {
    return;
  }

  // ✅ STEP 2: Verify authentication before allowing uploads
  let userInfo;
  try {
    userInfo = await verifyAuthToken(req);
  } catch (authError) {
    return res.status(401).json({ error: authError.message });
  }

  try {
    // Read raw binary data from the request stream
    const chunks = [];
    
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    
    const imageBuffer = Buffer.concat(chunks);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // ✅ SECURITY FIX: Validate file size
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Image too large. Maximum 5MB." });
    }

    console.log(`📦 Received image buffer of ${imageBuffer.length} bytes from user ${userInfo.uid}`);

    // ✅ SECURITY FIX: Include user ID in filename to prevent collisions and track ownership
    const filename = `ingredients/${userInfo.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    // Upload to Vercel Blob
    const blob = await put(filename, imageBuffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    console.log(`✅ Uploaded to Vercel Blob: ${blob.url}`);

    return res.status(200).json({ 
      url: blob.url,
    });
  } catch (err) {
    console.error("❌ Failed to upload image:", err);
    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}