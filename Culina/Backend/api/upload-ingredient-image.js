import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    sizeLimit: "5mb", // Limit payload to 5MB
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

    console.log(`📦 Received image buffer of ${imageBuffer.length} bytes`);

    // Generate a unique filename
    const filename = `ingredient-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

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