export default async function handler(req, res) {
  // Allow Expo / RN requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // For Vercel Blob v2, we return the client token
    // The frontend will use this to upload directly
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!token) {
      return res.status(500).json({
        error: "BLOB_READ_WRITE_TOKEN not configured",
      });
    }

    return res.status(200).json({ 
      token,
      uploadApiUrl: "https://blob.vercel-storage.com"
    });
  } catch (err) {
    console.error("❌ Failed to get upload credentials:", err);
    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}