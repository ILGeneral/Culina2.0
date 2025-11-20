/**
 * Upload image to Cloudinary (free alternative to Firebase Storage)
 *
 * Free tier: 25GB storage, 25GB bandwidth/month
 * No credit card required!
 */

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export async function uploadImageAsync(uri: string, userId: string, folder: string = 'inventory') {
  try {
    console.log(`[uploadImageAsync] Starting Cloudinary upload for ${folder}/${userId}`);
    console.log(`[uploadImageAsync] URI: ${uri}`);

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error('Cloudinary credentials not configured. Please check your .env file.');
    }

    // Create form data
    const formData = new FormData();

    // Extract file extension from URI
    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}_${userId}_${Date.now()}.${fileExtension}`;

    // Add the image file
    formData.append('file', {
      uri,
      type: `image/${fileExtension}`,
      name: fileName,
    } as any);

    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `culina/${folder}/${userId}`);

    // Optional: Add tags for better organization
    formData.append('tags', `${folder},user_${userId}`);

    console.log(`[uploadImageAsync] Uploading to Cloudinary...`);

    // Upload to Cloudinary
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[uploadImageAsync] Cloudinary error response:', errorData);
      throw new Error(`Cloudinary upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[uploadImageAsync] Upload complete`);
    console.log(`[uploadImageAsync] Cloudinary URL: ${data.secure_url}`);

    // Return the secure URL
    return data.secure_url;

  } catch (error: any) {
    console.error("[uploadImageAsync] Upload failed:", error);
    console.error("[uploadImageAsync] Error details:", error.message);
    throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
  }
}
