/**
 * Custom Civic Issue Classifier Service
 * 
 * Communicates with the PyTorch MobileNetV3 inference server.
 * Replaces Google Cloud Vision for civic issue identification.
 */

const CLASSIFIER_URL = import.meta.env.VITE_CLASSIFIER_API_URL || 'https://smart-city-classifier-api.onrender.com/api/classify';

/**
 * Classify a civic issue image
 * @param {string|File|Blob} imageInput - Cloudinary image URL or File object
 * @returns {Promise<{ predictedClass: string, confidence: number, classIndex: number, issueTypeId: string, isUncertain: boolean, topPredictions: Array }>}
 */
export async function classifyCivicIssue(imageInput) {
  if (!imageInput) {
    throw new Error('Image URL or file is required for classification.');
  }

  console.log('[Classifier] Calling custom model with:', typeof imageInput === 'string' ? imageInput : 'File/Blob');

  const urlsToTry = [CLASSIFIER_URL];
  if (!CLASSIFIER_URL.startsWith('/') && !urlsToTry.includes('/api/classify')) {
    urlsToTry.push('/api/classify');
  }

  let lastError = null;

  for (const targetUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      let response;
      if (typeof imageInput === 'string') {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: imageInput }),
          signal: controller.signal,
        });
      } else {
        const formData = new FormData();
        formData.append('file', imageInput);
        response = await fetch(targetUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Classifier API returned HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[Classifier] Model prediction received:', result);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`[Classifier] Request to ${targetUrl} failed:`, err.message);
    }
  }

  console.warn('[Classifier] All inference attempts failed, returning fallback:', lastError?.message);
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
