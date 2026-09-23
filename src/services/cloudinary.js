/**
 * Cloudinary Image Upload Service
 * 
 * Secure upload architecture for civic report images.
 * Uses Cloudinary Unsigned Upload Preset or local backend proxy to avoid exposing API secrets.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload an image file to Cloudinary
 * @param {File|Blob} file - The image file to upload
 * @param {Function} [onProgress] - Optional upload progress callback (0-100)
 * @returns {Promise<{ imageUrl: string, publicId: string, format: string, bytes: number }>}
 */
export async function uploadImageToCloudinary(file, onProgress = null) {
  if (!file) {
    throw new Error('No image file provided for upload.');
  }

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();

  // 1. Check if direct unsigned Cloudinary configuration is available
  if (cloudName && uploadPreset) {
    console.log(`[Cloudinary] Uploading to cloud: ${cloudName} with preset: ${uploadPreset}`);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Cloudinary upload failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Cloudinary] Upload successful:', data.secure_url);

      return {
        imageUrl: data.secure_url,
        publicId: data.public_id,
        format: data.format,
        bytes: data.bytes,
        width: data.width,
        height: data.height,
      };
    } catch (error) {
      console.error('[Cloudinary] Direct upload error:', error);
      throw error;
    }
  }

  // 2. Try backend upload proxy endpoint if direct preset is not configured
  try {
    console.log('[Cloudinary] Attempting upload via backend proxy (/api/upload-image)...');
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) {
        return {
          imageUrl: data.imageUrl,
          publicId: data.publicId || `cloudinary_${Date.now()}`,
          format: data.format || 'jpg',
          bytes: file.size,
        };
      }
    }
  } catch (proxyError) {
    console.warn('[Cloudinary] Backend upload proxy unavailable:', proxyError.message);
  }

  // 3. Fallback warning with actionable setup instruction
  const missing = [];
  if (!cloudName) missing.push('VITE_CLOUDINARY_CLOUD_NAME');
  if (!uploadPreset) missing.push('VITE_CLOUDINARY_UPLOAD_PRESET');
  throw new Error(
    `Cloudinary configuration missing: ${missing.join(', ')}. Please update your .env file with your Cloudinary credentials.`
  );
}

export default {
  uploadImageToCloudinary,
};
