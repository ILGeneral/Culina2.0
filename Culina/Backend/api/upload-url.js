export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // SECURITY FIX: Endpoint deprecated to prevent credential exposure
  return res.status(410).json({
    error: 'Endpoint deprecated for security reasons',
    message: 'This endpoint exposed storage credentials. Please use /api/upload-ingredient-image instead.',
    deprecated: true,
    migrationGuide: {
      oldUsage: 'GET /api/upload-url → returns credentials → client uploads',
      newUsage: 'POST /api/upload-ingredient-image with Base64 data',
    },
  });
}