import { put } from '@vercel/blob';
import sharp from 'sharp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { base64 } = req.body || {};

  if (!base64) {
    res.status(400).json({ error: 'base64 image data is required' });
    return;
  }

  try {
    // Decode Base64 to Buffer
    let buffer = Buffer.from(base64, 'base64');
    const originalSizeMB = buffer.length / 1024 / 1024;

    console.log(`🖼️ Original size: ${originalSizeMB.toFixed(2)}MB`);

    // Optional: reject if larger than 10MB (Vercel body limit)
    if (originalSizeMB > 9.5) {
      return res.status(413).json({ error: 'Image too large (limit ~10MB)' });
    }

    // Compress with sharp
    buffer = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60, progressive: true })
      .toBuffer();

    const compressedSizeMB = buffer.length / 1024 / 1024;
    console.log(`🗜️ Compressed size: ${compressedSizeMB.toFixed(2)}MB`);

    // Upload to Vercel Blob
    const fileName = `ingredients/${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}.jpg`;

    const blob = await put(fileName, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('❌ Image compression or upload error:', error);
    res.status(500).json({ error: 'Failed to process and upload image' });
  }
}
