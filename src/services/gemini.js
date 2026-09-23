/**
 * Google Gemini AI Service
 * 
 * Generates natural-language municipal complaint descriptions using the image URL
 * and the custom civic-issue classification model's prediction.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const CLOUD_FUNCTION_BASE = 'https://generatedescriptionhttp-u32gmpf24a-uc.a.run.app';

// Professional municipal complaint templates for the 9 civic issue classes
const CIVIC_DESCRIPTIONS = {
  'Damaged concrete structures': 'Damaged concrete structure identified on public infrastructure. Surface crumbling and spalling visible; structural inspection and masonry repair recommended.',
  'DamagedElectricalPoles': 'Damaged electrical utility pole observed. Compromised structural stability poses a potential public safety hazard; urgent municipal inspection required.',
  'DamagedRoadSigns': 'Damaged or defaced traffic sign observed along the roadway. Impaired legibility affects traffic guidance; municipal sign replacement recommended.',
  'DeadAnimalsPollution': 'Biological hazard or animal waste pollution detected in public space. Immediate municipal sanitation dispatch recommended to maintain hygiene.',
  'FallenTrees': 'Fallen tree or hazardous broken limbs obstructing public pathway or roadway. Urban forestry clearance needed to restore safe pedestrian and vehicular flow.',
  'Garbage': 'Accumulation of uncollected refuse and municipal solid waste in a public area. Sanitation collection requested to prevent neighborhood litter and hygiene hazards.',
  'Graffitti': 'Unauthorized graffiti vandalism visible on public infrastructure surface. Pressure washing or repainting recommended to restore public space.',
  'IllegalParking': 'Vehicle parked in violation of municipal regulations, impeding traffic flow or sidewalk accessibility. Parking enforcement dispatch requested.',
  'Potholes and RoadCracks': 'Road surface deterioration and pothole/cracks observed on the pavement. Asphalt patching and resurfacing recommended to ensure motorist safety.',
  'Waterlogging': 'Severe street waterlogging and stormwater accumulation overflowing the roadway. Standing water impedes traffic and pedestrian mobility; immediate stormwater drainage clearance requested.',
  'other': 'Civic infrastructure issue observed requiring municipal inspection and maintenance.'
};

/**
 * Generate human-readable complaint description using Gemini AI
 * @param {string} imageUrl - Cloudinary URL of the issue image
 * @param {Object} classificationResult - Result from custom classifier { predictedClass, confidence, issueTypeId }
 * @returns {Promise<{ description: string, suggestedPriority: string, confidence: number }>}
 */
export async function generateDescription(imageUrl, classificationResult = {}) {
  const predictedClass = classificationResult.predictedClass || 'Civic Issue';
  const confidence = classificationResult.confidence || 0.85;
  const issueType = classificationResult.issueTypeId || 'other';

  // 1. If direct Gemini API key is provided, use Google Generative AI REST API
  if (GEMINI_API_KEY) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      console.log('[Gemini] Generating complaint description using Gemini API...');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const promptText = `You are a professional smart city assistant. A citizen reported an infrastructure problem.
The custom AI classifier identified the issue as: "${predictedClass}" with ${Math.round(confidence * 100)}% confidence.
Generate a concise, professional 2-sentence municipal maintenance description suitable for city public works officials.
State clearly what problem is reported and why maintenance attention is needed. Do not invent unobservable facts.`;

      const body = {
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText && candidateText.length > 15) {
          console.log('[Gemini] Successfully generated description:', candidateText);
          return {
            description: candidateText,
            suggestedPriority: suggestPriority(predictedClass),
            confidence: confidence,
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[Gemini] Direct API call fallback:', err.message);
    }
  }

  // 2. Try Firebase Cloud Function endpoint if available (with 3s timeout)
  const fnController = new AbortController();
  const fnTimeoutId = setTimeout(() => fnController.abort(), 3000);
  try {
    const response = await fetch(CLOUD_FUNCTION_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        classificationResult,
        predictedClass,
      }),
      signal: fnController.signal,
    });
    clearTimeout(fnTimeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.description) {
        return {
          description: data.description,
          suggestedPriority: data.suggestedPriority || suggestPriority(predictedClass),
          confidence: data.confidence || confidence,
        };
      }
    }
  } catch (err) {
    clearTimeout(fnTimeoutId);
    console.log('[Gemini] Cloud Function fallback used:', err.message);
  }

  // 3. High quality contextual default for the detected class
  const templateDescription = CIVIC_DESCRIPTIONS[predictedClass] || CIVIC_DESCRIPTIONS[issueType] || CIVIC_DESCRIPTIONS.other;

  return {
    description: templateDescription,
    suggestedPriority: suggestPriority(predictedClass),
    confidence: confidence,
  };
}

/**
 * Determine priority based on civic issue severity
 */
export function suggestPriority(issueClass = '') {
  const highPriority = [
    'DamagedElectricalPoles',
    'DeadAnimalsPollution',
    'FallenTrees',
    'Potholes and RoadCracks',
    'Waterlogging',
    'pothole',
    'electrical-pole',
    'waterlogging'
  ];

  if (highPriority.some(p => issueClass.toLowerCase().includes(p.toLowerCase()))) {
    return 'high';
  }
  return 'medium';
}

export default {
  generateDescription,
  suggestPriority,
};
