/**
 * Custom Civic Issue Classifier Service
 * 
 * Communicates with the PyTorch MobileNetV3 inference server.
 * Replaces Google Cloud Vision for civic issue identification.
 */

const CLASSIFIER_URL = import.meta.env.VITE_CLASSIFIER_API_URL || 'https://smart-city-classifier-api.onrender.com/api/classify';

/**
 * Classify a civic issue image with strict session independence
 * @param {string|File|Blob} imageInput - Cloudinary image URL or File object
 * @returns {Promise<{ predictedClass: string, confidence: number, classIndex: number, issueTypeId: string, isUncertain: boolean, topPredictions: Array }>}
 */
export async function classifyCivicIssue(imageInput) {
  if (!imageInput) {
    throw new Error('Image URL or file is required for classification.');
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[Classifier] [${requestId}] Starting classification:`, typeof imageInput === 'string' ? imageInput : 'File/Blob');

  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Primary URL is the live ML backend API
  const urlsToTry = [CLASSIFIER_URL];
  // Only attempt relative fallback on localhost to avoid static SPA HTML rewrites on production
  if (isLocalHost && !urlsToTry.includes('/api/classify')) {
    urlsToTry.push('/api/classify');
  }

  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const targetUrl of urlsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        let response;
        const headers = {
          'X-Request-ID': `${requestId}_att${attempt}`,
          'X-Session-Timestamp': String(Date.now()),
        };

        if (typeof imageInput === 'string') {
          headers['Content-Type'] = 'application/json';
          response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ imageUrl: imageInput }),
            signal: controller.signal,
          });
        } else {
          const formData = new FormData();
          formData.append('file', imageInput);
          response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal,
          });
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Classifier API returned HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(`Invalid response format from ${targetUrl} (expected JSON, got ${contentType})`);
        }

        const result = await response.json();
        console.log(`[Classifier] [${requestId}] Model prediction received:`, result);
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        console.warn(`[Classifier] [${requestId}] Attempt ${attempt + 1} to ${targetUrl} failed:`, err.message);
      }
    }
    // Brief 500ms backoff before retry attempt
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.warn(`[Classifier] [${requestId}] All inference attempts failed:`, lastError?.message);
  return {
    predictedClass: 'Civic Issue (Inspection Needed)',
    confidence: 0.65,
    classIndex: -1,
    issueTypeId: 'other',
    isUncertain: true,
    error: lastError?.message || 'Inference call failed',
    topPredictions: [],
  };
}

export default {
  classifyCivicIssue,
};
