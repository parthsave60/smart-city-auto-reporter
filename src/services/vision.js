/**
 * [DEPRECATED] Google Cloud Vision API Service
 * 
 * Replaced by Custom PyTorch Civic Issue Classifier (MobileNetV3).
 * This file is retained as a compatibility layer redirecting to the custom classifier.
 */

import { classifyCivicIssue } from './classifier';

/**
 * Legacy analyzeImage function redirected to custom PyTorch classifier
 * @param {string} imageUrl - Image URL to classify
 * @returns {Promise<Object>} - Analysis results in compatible schema
 */
export async function analyzeImage(imageUrl) {
  console.log('[Vision Service -> Replaced] Delegating to custom PyTorch classifier');
  const result = await classifyCivicIssue(imageUrl);
  return {
    labels: [
      { description: result.predictedClass, score: result.confidence }
    ],
    detectedIssueType: result.issueTypeId,
    confidence: result.confidence,
    customClassifier: result
  };
}

export async function detectText() {
  return [];
}

export function mapLabelsToIssueType() {
  return 'other';
}

export default {
  analyzeImage,
  detectText,
  mapLabelsToIssueType,
};
