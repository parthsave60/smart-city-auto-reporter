/**
 * Multimodal Vision API Service
 * 
 * Independent Civic-Issue Validation Gate and Waterlogging Detection Layer.
 * Evaluates whether an image contains a legitimate civic issue.
 * Operates independently of the custom 9-class PyTorch model.
 */

const MULTIMODAL_API_URL = import.meta.env.VITE_MULTIMODAL_API_URL || 'https://smart-city-classifier-api.onrender.com/api/multimodal/validate';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CATEGORY_TO_ID = {
  'Damaged concrete structures': 'damaged-concrete',
  'DamagedElectricalPoles': 'electrical-pole',
  'DamagedRoadSigns': 'damaged-road-sign',
  'DeadAnimalsPollution': 'dead-animal-pollution',
  'FallenTrees': 'fallen-tree',
  'Garbage': 'garbage',
  'Graffitti': 'graffiti',
  'IllegalParking': 'illegal-parking',
  'Potholes and RoadCracks': 'pothole',
  'Waterlogging': 'waterlogging',
  'None': null,
};

function mapCategoryToIssueTypeId(category) {
  if (!category || category === 'None') return null;
  if (CATEGORY_TO_ID[category]) return CATEGORY_TO_ID[category];
  const lower = String(category).toLowerCase();
  if (lower.includes('waterlog') || lower.includes('flood')) return 'waterlogging';
  if (lower.includes('pothole') || lower.includes('crack')) return 'pothole';
  if (lower.includes('garbage') || lower.includes('trash') || lower.includes('litter')) return 'garbage';
  if (lower.includes('pole') || lower.includes('electrical')) return 'electrical-pole';
  if (lower.includes('concrete')) return 'damaged-concrete';
  if (lower.includes('tree')) return 'fallen-tree';
  if (lower.includes('sign')) return 'damaged-road-sign';
  if (lower.includes('graffiti')) return 'graffiti';
  if (lower.includes('parking')) return 'illegal-parking';
  if (lower.includes('animal') || lower.includes('pollution')) return 'dead-animal-pollution';
  return 'other';
}

/**
 * Validates whether an image contains a recognized civic issue, detects Waterlogging,
 * and filters out non-civic (food, pets, screenshots, furniture, selfies) and unclear images.
 * 
 * @param {string|File|Blob} imageInput - Image URL or File object
 * @param {Object} [classifierResult] - Optional 9-class model result
 * @returns {Promise<{
 *   civicIssueDetected: boolean,
 *   category: string,
 *   confidence: number,
 *   reason: string,
 *   issueTypeId: string|null,
 *   isUnclear: boolean,
 *   message: string|null,
 *   source?: string
 * }>}
 */
async function getImageBase64(imageInput) {
  try {
    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      const [header, data] = imageInput.split(',', 2);
      const mimeMatch = header.match(/:(.*?);/);
      return {
        mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
        data: data
      };
    }

    if (typeof imageInput === 'string' && imageInput.startsWith('http')) {
      const res = await fetch(imageInput);
      const blob = await res.blob();
      const mimeType = blob.type || 'image/jpeg';
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = String(reader.result || '');
          const base64String = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          resolve({ mimeType, data: base64String });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    if (imageInput instanceof Blob || imageInput instanceof File) {
      const mimeType = imageInput.type || 'image/jpeg';
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = String(reader.result || '');
          const base64String = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          resolve({ mimeType, data: base64String });
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageInput);
      });
    }
  } catch (e) {
    console.warn('[MultimodalVision] getImageBase64 failed:', e);
  }
  return null;
}

/**
 * Validates whether an image contains a recognized civic issue, detects Waterlogging,
 * and filters out non-civic (food, pets, screenshots, furniture, selfies) and unclear images.
 * 
 * @param {string|File|Blob} imageInput - Image URL or File object
 * @param {Object} [classifierResult] - Optional 9-class model result
 * @returns {Promise<{
 *   civicIssueDetected: boolean,
 *   category: string,
 *   confidence: number,
 *   reason: string,
 *   issueTypeId: string|null,
 *   isUnclear: boolean,
 *   message: string|null,
 *   source?: string
 * }>}
 */
export async function validateCivicIssue(imageInput, classifierResult = null) {
  if (!imageInput) {
    return {
      civicIssueDetected: false,
      isUnclear: true,
      category: 'None',
      issueTypeId: null,
      confidence: 0.0,
      reason: 'No image provided for validation.',
      message: 'Unable to verify a civic issue. Please upload a clearer image.',
      source: 'client_validation'
    };
  }

  // 1. If direct Gemini API key is available, attempt direct Gemini Vision validation with real image data
  if (GEMINI_API_KEY) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      console.log('[MultimodalVision] Calling Gemini Multimodal Vision API directly...');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const promptText = `You are an expert AI civic infrastructure inspector and safety validator.
Analyze this photo carefully.
Determine if the image clearly shows a genuine outdoor public infrastructure defect or municipal civic issue, or if it is an unrelated non-civic image.

Civic issues include:
- "Waterlogging" (road or street flooded with water, stormwater accumulation, water pooling on roadway)
- "Potholes and RoadCracks" (pothole or road cracks on asphalt/pavement)
- "Garbage" (litter, solid waste, trash, uncollected refuse on street/sidewalk)
- "Damaged concrete structures" (broken curb, crumbled wall, cracked bridge/sidewalk)
- "DamagedElectricalPoles" (leaning or broken utility pole, dangling wire)
- "DamagedRoadSigns" (bent, fallen, defaced traffic or street sign)
- "DeadAnimalsPollution" (animal carcass, bio-hazard, or sewage pollution in public area)
- "FallenTrees" (fallen tree or large branch blocking street/path)
- "Graffitti" (unauthorized graffiti spray paint on public wall/infrastructure)
- "IllegalParking" (vehicle blocking sidewalk, bike lane, or illegal spot)

If the image is a screenshot of a computer/phone screen, website, desktop, document, text, selfie, food, pet, indoor room, or contains NO civic issue, set "civicIssueDetected" to false and "category" to "None".

Return JSON ONLY with this schema:
{
  "civicIssueDetected": boolean,
  "category": "Waterlogging" | "Potholes and RoadCracks" | "Garbage" | "Damaged concrete structures" | "DamagedElectricalPoles" | "DamagedRoadSigns" | "DeadAnimalsPollution" | "FallenTrees" | "Graffitti" | "IllegalParking" | "Other" | "None",
  "confidence": number,
  "reason": "Clear 1-sentence explanation"
}`;

      const imgPayload = await getImageBase64(imageInput);
      const parts = [];
      if (imgPayload && imgPayload.data) {
        parts.push({
          inlineData: {
            mimeType: imgPayload.mimeType,
            data: imgPayload.data
          }
        });
      }
      parts.push({ text: promptText });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 250,
            responseMimeType: "application/json"
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const geminiJson = await res.json();
        const candidateRaw = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateRaw) {
          const cleaned = candidateRaw.replace(/```(?:json)?\s*|\s*```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          const isDetected = Boolean(parsed.civicIssueDetected && parsed.category && parsed.category.toLowerCase() !== 'none');
          const finalCategory = isDetected ? parsed.category : 'None';
          console.log('[MultimodalVision] Direct Gemini Vision Result:', parsed);
          return {
            civicIssueDetected: isDetected,
            category: finalCategory,
            confidence: Number(parsed.confidence) || 0.90,
            reason: parsed.reason || (isDetected ? `Detected ${finalCategory}` : 'No civic issue detected'),
            issueTypeId: mapCategoryToIssueTypeId(finalCategory),
            isUnclear: false,
            message: isDetected ? null : "No civic issue detected in this image. Please upload an image showing a valid civic issue.",
            source: 'gemini_multimodal_vision'
          };
        }
      }
    } catch (directErr) {
      clearTimeout(timeoutId);
      console.warn('[MultimodalVision] Direct Gemini Vision fallback:', directErr.message);
    }
  }

  // 2. Call backend Multimodal Vision Validation Service
  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const urlsToTry = [MULTIMODAL_API_URL];
  // Only attempt relative fallback on localhost to avoid static SPA HTML rewrites on production
  if (isLocalHost && !urlsToTry.includes('/api/multimodal/validate')) {
    urlsToTry.push('/api/multimodal/validate');
  }

  const requestId = `val_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
            body: JSON.stringify({
              imageUrl: imageInput,
              classifierResult: classifierResult
            }),
            signal: controller.signal
          });
        } else {
          const formData = new FormData();
          formData.append('file', imageInput);
          if (classifierResult) {
            formData.append('classifierResult', JSON.stringify(classifierResult));
          }
          response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal
          });
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Multimodal Vision API returned HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(`Invalid response format from ${targetUrl} (expected JSON, got ${contentType})`);
        }

        const data = await response.json();
        console.log(`[MultimodalVision] [${requestId}] Validation API Response:`, data);

        const isDetected = Boolean(data.civicIssueDetected && data.category && data.category !== 'None');
        const finalCategory = isDetected ? (data.category || 'Civic Issue') : 'None';
        const isUnclear = Boolean(data.isUnclear);

        return {
          civicIssueDetected: isDetected,
          category: finalCategory,
          confidence: Number(data.confidence) || (isDetected ? 0.88 : 0.0),
          reason: data.reason || data.reasoning || (isDetected ? `Confirmed ${finalCategory}` : 'No civic issue detected'),
          issueTypeId: mapCategoryToIssueTypeId(finalCategory),
          isUnclear: isUnclear,
          message: isDetected ? null : (data.message || (isUnclear 
            ? "Unable to verify a civic issue. Please upload a clearer image." 
            : "No civic issue detected in this image. Please upload an image showing a valid civic issue.")),
          source: data.source || 'multimodal_vision'
        };
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        console.warn(`[MultimodalVision] [${requestId}] Attempt ${attempt + 1} to ${targetUrl} failed:`, error.message);
      }
    }
    // Brief backoff before retry attempt
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.warn(`[MultimodalVision] [${requestId}] All validation endpoints failed:`, lastError?.message);

  // If custom model predicted a civic class, allow it safely
  const customClass = (classifierResult?.predictedClass && 
    !['Uncertain / Other', 'None', 'Unspecified', 'Civic Issue (Inspection Needed)'].includes(classifierResult.predictedClass))
    ? classifierResult.predictedClass
    : classifierResult?.rawClass;

  if (classifierResult && classifierResult.confidence >= 0.35 && 
      customClass && !['Uncertain / Other', 'None', 'Unspecified', 'Civic Issue (Inspection Needed)'].includes(customClass)) {
    return {
      civicIssueDetected: true,
      category: customClass,
      confidence: classifierResult.confidence,
      reason: `Confirmed ${customClass} on public infrastructure.`,
      issueTypeId: classifierResult.issueTypeId || classifierResult.rawIssueTypeId || mapCategoryToIssueTypeId(customClass) || 'other',
      isUnclear: false,
      message: null,
      source: 'classifier_safe_fallback'
    };
  }

  // When validation fails completely or cannot connect, reject safely
  return {
    civicIssueDetected: false,
    isUnclear: true,
    category: 'None',
    issueTypeId: null,
    confidence: 0.0,
    reason: 'Unable to verify civic issue through multimodal vision.',
    message: 'Unable to verify a civic issue. Please upload a clearer image.',
    source: 'error_fallback'
  };
}

export default {
  validateCivicIssue,
  mapCategoryToIssueTypeId
};
