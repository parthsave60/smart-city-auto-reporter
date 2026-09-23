/**
 * Cloudinary Image Upload Service
 * 
 * Secure upload architecture for civic report images.
 * Uses Cloudinary Unsigned Upload Preset or local backend proxy to avoid exposing API secrets.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Compress and normalize any image file (including mobile camera captures and HEIC)
 * to a standard, web-optimized JPEG Blob before upload.
 * Reduces 15MB+ camera photos to ~250KB and normalizes orientation.
 */
export async function compressAndNormalizeImage(file, maxDimension = 1600, quality = 0.85) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  // If already a small JPEG, keep as is
  if (file.size && file.size < 350000 && file.type === 'image/jpeg') {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        // Fill white background in case of transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              console.log(`[Cloudinary] Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB (${width}x${height})`);
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        console.warn('[Cloudinary] Image compression load error, using raw file:', err);
        resolve(file);
      };

      img.src = objectUrl;
    } catch (e) {
      console.warn('[Cloudinary] Canvas compression exception, using raw file:', e);
      resolve(file);
    }
  });
}

/**
 * Upload an image file to Cloudinary with guaranteed session isolation
 * @param {File|Blob} file - The image file to upload
 * @param {Function} [onProgress] - Optional upload progress callback (0-100)
 * @returns {Promise<{ imageUrl: string, publicId: string, format: string, bytes: number, width: number, height: number }>}
 */
export async function uploadImageToCloudinary(file, onProgress = null) {
  if (!file) {
    throw new Error('No image file provided for upload.');
  }

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();

  // Compress and normalize to standard JPEG to prevent mobile 15MB upload stalls
  const uploadBlob = await compressAndNormalizeImage(file, 1600, 0.85);

  // Generate a strictly unique filename per upload to prevent cross-device/session asset collisions
  const uniqueFilename = `civic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.jpg`;

  // 1. Check if direct unsigned Cloudinary configuration is available
  if (cloudName && uploadPreset) {
    console.log(`[Cloudinary] Uploading isolated asset: ${uniqueFilename} to cloud: ${cloudName}`);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', uploadBlob, uniqueFilename);
    formData.append('upload_preset', uploadPreset);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

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

      // Ensure delivery URL applies standard format and responsive limits
      let secureUrl = data.secure_url || data.url;
      if (secureUrl && secureUrl.includes('/image/upload/')) {
        secureUrl = secureUrl.replace('/image/upload/', '/image/upload/f_jpg,q_auto,w_1280,c_limit/');
      }

      return {
        imageUrl: secureUrl,
        publicId: data.public_id,
        format: data.format || 'jpg',
        bytes: data.bytes || uploadBlob.size,
        width: data.width,
        height: data.height,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Cloudinary] Direct upload error:', error);
      throw error;
    }
  }

  // 2. Try backend upload proxy endpoint if direct preset is not configured
  try {
    console.log('[Cloudinary] Attempting upload via backend proxy (/api/upload-image)...');
    const formData = new FormData();
    formData.append('image', uploadBlob, uniqueFilename);

    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) {
        return {
          imageUrl: data.imageUrl,
          publicId: data.publicId || `civic_${Date.now()}`,
          format: data.format || 'jpg',
          bytes: uploadBlob.size || file.size,
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
  compressAndNormalizeImage,
};
