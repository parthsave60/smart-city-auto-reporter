import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Brain, Cloud, Sparkles, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card, IssueTypeTag, issueTypes, AIAnalysisPanel } from '../ui'
import { classifyCivicIssue } from '../../services/classifier'
import { validateCivicIssue } from '../../services/multimodalVision'
import { generateDescription } from '../../services/gemini'
import { MODEL_CLASSES } from '../../utils/userUtils'

const analysisStages = [
  { id: 'upload', label: 'Cloudinary Image Loaded', icon: Cloud },
  { id: 'classify', label: 'Custom 9-Class Classifier Running...', icon: Brain },
  { id: 'validate', label: 'Multimodal Vision & Waterlogging Check...', icon: Sparkles },
  { id: 'gemini', label: 'Gemini Drafting Complaint...', icon: Sparkles },
]

export default function StepAnalysis({ reportData, updateReportData, onNext, onBack }) {
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [currentStage, setCurrentStage] = useState(0)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [uncertaintyNotice, setUncertaintyNotice] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const handleRetry = () => {
    setValidationError(null)
    setIsAnalyzing(true)
    setCurrentStage(0)
    updateReportData({
      civicIssueDetected: null,
      validationError: null,
      analysisResult: null,
      predictedClass: null,
    })
    setRetryTrigger(r => r + 1)
  }

  useEffect(() => {
    if (reportData?.validationError || reportData?.civicIssueDetected === false) {
      setValidationError(reportData.validationError || "No civic issue detected in this image. Please upload an image showing a valid civic issue.")
      setIsAnalyzing(false)
      return
    }

    if (reportData?.analysisResult && reportData?.predictedClass) {
      setIsAnalyzing(false)
      setCurrentStage(analysisStages.length - 1)
      setEditedDescription(typeof reportData.description === 'string' ? reportData.description : '')
      return
    }

    const runAnalysis = async () => {
      try {
        const imageSource = reportData?.imageUrl || reportData?.image || reportData?.imagePreview;
        if (!imageSource) {
          console.warn('[StepAnalysis] No image available, skipping analysis')
          setIsAnalyzing(false)
          return
        }

        // Stage 1: Image Loaded
        setCurrentStage(0)
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Stage 2: Dual Pipeline Execution
        // Run BOTH the Custom 9-Class Classifier AND Gemini Multimodal Validation
        setCurrentStage(1)
        console.log('[StepAnalysis] Running Custom 9-Class Classifier & Gemini Multimodal Validation')

        const classificationResult = await classifyCivicIssue(imageSource).catch(err => {
          console.warn('[StepAnalysis] Classifier error:', err)
          return { predictedClass: 'Uncertain / Other', confidence: 0.0, isUncertain: true, issueTypeId: 'other' }
        })

        const validationResult = await validateCivicIssue(imageSource, classificationResult).catch(err => {
          console.warn('[StepAnalysis] Multimodal validation error:', err)
          return { civicIssueDetected: false, isUnclear: true, category: 'None', message: 'Unable to verify a civic issue. Please upload a clearer image.' }
        })

        // Stage 3: Validate & Decide
        setCurrentStage(2)
        console.log('[StepAnalysis] Custom Classifier:', {
          prediction: classificationResult?.predictedClass,
          confidence: classificationResult?.confidence
        })
        console.log('[StepAnalysis] Civic Validator:', {
          civicIssueDetected: validationResult?.civicIssueDetected,
          category: validationResult?.category,
          confidence: validationResult?.confidence,
          reason: validationResult?.reason
        })

        const customClass = classificationResult?.predictedClass
        const isCustomValid = customClass && 
          MODEL_CLASSES.includes(customClass) && 
          customClass !== 'Uncertain / Other' && 
          customClass !== 'Civic Issue (Inspection Needed)'
        const customConfidence = Number(classificationResult?.confidence) || 0.0
        const isCustomConfident = isCustomValid && customConfidence >= 0.40 && !classificationResult?.isUncertain

        const isWaterlogging = (validationResult?.category === 'Waterlogging' || validationResult?.issueTypeId === 'waterlogging')
        const isCivicValid = Boolean(validationResult?.civicIssueDetected && validationResult?.category !== 'None')

        // ============================================================
        // RULE 1: INDEPENDENT CIVIC ISSUE VALIDATION GATE
        // Rejects screenshots, normal photos, food, pets, random objects, and blurry images
        // ============================================================
        const isConfirmedNonCivicOrUnclear = Boolean(
          validationResult && 
          (validationResult.isUnclear || 
           (validationResult.civicIssueDetected === false && (
             validationResult.reason?.toLowerCase().includes('non-civic') ||
             validationResult.reason?.toLowerCase().includes('screenshot') ||
             validationResult.reason?.toLowerCase().includes('food') ||
             validationResult.reason?.toLowerCase().includes('pet')
           )))
        )

        const isUnverified = !isCivicValid && !isCustomConfident

        if ((isConfirmedNonCivicOrUnclear && !isCustomConfident) || isUnverified) {
          const isUnclear = Boolean(validationResult?.isUnclear)
          const validationMsg = validationResult?.message || (isUnclear
            ? "Unable to verify a civic issue. Please upload a clearer image."
            : "No civic issue detected in this image. Please upload an image showing a valid civic issue.")
          
          console.warn('[StepAnalysis] Submission BLOCKED by Civic Issue Validator:', validationMsg)
          setValidationError(validationMsg)
          updateReportData({
            civicIssueDetected: false,
            isUnclear: isUnclear,
            validationError: validationMsg,
            predictedClass: null,
            category: null,
            description: '',
            analysisResult: {
              classifier: classificationResult || {},
              validation: validationResult || {}
            }
          })
          setIsAnalyzing(false)
          return // Hard block: do not proceed to description, location, or Firestore!
        }

        // ============================================================
        // RULE 2: WATERLOGGING (Identified via Gemini / Vision Validation Layer)
        // If the custom model predicts Garbage but Gemini identifies Waterlogging, final category is Waterlogging!
        // ============================================================
        let finalCategory = null
        let finalIssueTypeId = null
        let finalConfidence = 0.85
        let detectionSource = 'custom_model'

        if (isWaterlogging) {
          console.log('[StepAnalysis] Waterlogging confirmed by Gemini/Vision validation. Prioritizing Waterlogging.')
          finalCategory = 'Waterlogging'
          finalIssueTypeId = 'waterlogging'
          finalConfidence = Math.max(Number(validationResult?.confidence) || 0.90, 0.85)
          detectionSource = validationResult?.source || 'gemini_multimodal_vision'
        } else if (isCustomConfident) {
          // ============================================================
          // RULE 3: GENUINE 9-CLASS CIVIC ISSUES
          // ============================================================
          finalCategory = customClass
          finalIssueTypeId = classificationResult?.issueTypeId || 'other'
          finalConfidence = customConfidence
          detectionSource = 'custom_model_validated'
        } else if (validationResult?.category && validationResult.category !== 'None') {
          finalCategory = validationResult.category
          finalIssueTypeId = validationResult?.issueTypeId || 'other'
          finalConfidence = Number(validationResult?.confidence) || 0.85
          detectionSource = 'gemini_multimodal_vision'
        } else {
          finalCategory = customClass || 'Civic Issue'
          finalIssueTypeId = classificationResult?.issueTypeId || 'other'
          finalConfidence = Number(classificationResult?.confidence) || 0.75
          detectionSource = 'civic_issue_general'
          setUncertaintyNotice(true)
        }

        console.log('[StepAnalysis] Final Decision:', {
          finalCategory,
          finalIssueTypeId,
          decisionReason: detectionSource
        })

        // Stage 4: Gemini Description Generation (ONLY called after civic issue is confirmed)
        setCurrentStage(3)
        console.log('[StepAnalysis] Civic issue validated. Generating description with Gemini AI for:', finalCategory)
        let geminiDescription = ''
        try {
          const descSource = reportData?.imageUrl || reportData?.imagePreview || imageSource;
          const geminiResult = await generateDescription(descSource, {
            predictedClass: finalCategory,
            confidence: finalConfidence,
            issueTypeId: finalIssueTypeId
          })
          console.log('[StepAnalysis] Gemini Output:', geminiResult)
          const rawDesc = geminiResult?.description
          geminiDescription = typeof rawDesc === 'string' ? rawDesc : (rawDesc?.text || '')
        } catch (geminiErr) {
          console.warn('[StepAnalysis] Gemini description generation warning, using template fallback:', geminiErr)
        }

        // Guaranteed professional template fallback
        if (!geminiDescription || typeof geminiDescription !== 'string') {
          geminiDescription = `A civic infrastructure issue identified as "${finalCategory}" requires municipal inspection and maintenance at this location.`
        }

        await new Promise((resolve) => setTimeout(resolve, 300))

        setValidationError(null)
        setUncertaintyNotice(Boolean(classificationResult?.isUncertain && finalCategory !== 'Waterlogging'))

        updateReportData({
          civicIssueDetected: true,
          isUnclear: false,
          validationError: null,
          category: finalCategory,
          predictedClass: finalCategory,
          confidence: finalConfidence,
          issueType: finalIssueTypeId,
          description: geminiDescription,
          detectionSource: detectionSource,
          analysisResult: {
            classifier: classificationResult || {},
            validation: validationResult || {},
            gemini: { description: geminiDescription, confidence: finalConfidence },
          },
        })

        setEditedDescription(geminiDescription)
        setIsAnalyzing(false)
      } catch (error) {
        console.error('[StepAnalysis] Analysis execution error:', error)
        setIsAnalyzing(false)
        const validationMsg = "Unable to complete civic issue analysis. Please try again or upload a different image."
        setValidationError(validationMsg)
        updateReportData({
          civicIssueDetected: false,
          isUnclear: true,
          validationError: validationMsg,
          description: '',
          predictedClass: null,
          category: null
        })
      }
    }

    runAnalysis()
  }, [reportData?.imageUrl, reportData?.image, reportData?.imagePreview, retryTrigger])

  const handleIssueTypeSelect = (typeId) => {
    if (reportData?.civicIssueDetected === false) return;
    const selectedType = issueTypes.find(t => t.id === typeId);
    const categoryName = selectedType ? (selectedType.id === 'waterlogging' ? 'Waterlogging' : selectedType.label) : (typeId || 'other');
    updateReportData({ 
      issueType: typeId || 'other',
      predictedClass: categoryName,
      category: categoryName
    });
    setUncertaintyNotice(false);
  }

  if (isAnalyzing) {
    return (
      <Card hover={false} className="p-8">
        <div className="flex flex-col items-center py-12">
          {/* Image preview */}
          <div className="relative w-48 h-48 overflow-hidden mb-8 border border-cream-muted">
            <img
              src={reportData.imagePreview || reportData.imageUrl}
              alt="Analyzing"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-cream/80 to-transparent" />

            {/* Scanning animation */}
            <motion.div
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blueprint to-transparent"
            />
          </div>

          {/* Progress stages */}
          <div className="space-y-4 w-full max-w-sm mb-8">
            {analysisStages.map((stage, index) => {
              const Icon = stage.icon
              const isComplete = index < currentStage
              const isCurrent = index === currentStage

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-3 p-3 transition-colors
                    ${isCurrent ? 'bg-blueprint/10 border border-blueprint/30' : ''}
                    ${isComplete ? 'opacity-60' : ''}
                  `}
                >
                  <div
                    className={`
                      w-8 h-8 flex items-center justify-center
                      ${isComplete ? 'bg-success text-cream' : ''}
                      ${isCurrent ? 'bg-blueprint/20 text-blueprint' : ''}
                      ${!isComplete && !isCurrent ? 'bg-cream-muted text-slate-muted' : ''}
                    `}
                  >
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`
                      text-sm font-display font-medium
                      ${isCurrent ? 'text-blueprint' : isComplete ? 'text-slate-muted' : 'text-slate-muted/70'}
                    `}
                  >
                    {stage.label}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <p className="text-center text-slate-muted font-body text-sm">
            Custom 9-Class PyTorch Model + Multimodal Vision API + Gemini AI
          </p>
        </div>
      </Card>
    )
  }

  // If validation failed or analysis had an error
  if (validationError || reportData?.civicIssueDetected === false) {
    return (
      <div className="space-y-6">
        <Card hover={false} className="p-8 border border-danger/40 bg-danger/5">
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-danger/10 text-danger flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-slate uppercase tracking-wider mb-2">
              Verification Notice
            </h3>
            <p className="font-body text-base text-slate font-semibold max-w-lg mb-6 leading-relaxed">
              {validationError || "No civic issue detected in this image. Please upload an image showing a valid civic issue."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="secondary" onClick={onBack} icon={ArrowLeft} size="lg">
                Upload Different Image
              </Button>
              <Button variant="primary" onClick={handleRetry} icon={RefreshCw} size="lg">
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const hasImage = Boolean(reportData?.imageUrl || reportData?.image || reportData?.imagePreview);
  if (!hasImage) {
    return (
      <div className="space-y-6">
        <Card hover={false} className="p-8 border border-warning/40 bg-warning/5 text-center">
          <div className="w-16 h-16 bg-warning/10 text-warning flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="font-display text-lg font-bold text-slate uppercase tracking-wider mb-2">
            No Image Provided
          </h3>
          <p className="font-body text-base text-slate-muted max-w-md mx-auto mb-6">
            Please capture or upload a photo of the civic issue to run AI analysis.
          </p>
          <Button variant="primary" onClick={onBack} icon={ArrowLeft} size="lg">
            Back to Upload
          </Button>
        </Card>
      </div>
    );
  }

  const rawConfidence = reportData?.confidence !== null && reportData?.confidence !== undefined
    ? reportData.confidence
    : reportData?.analysisResult?.classifier?.confidence;
  const numConfidence = typeof rawConfidence === 'number' && !isNaN(rawConfidence)
    ? rawConfidence
    : (Number(rawConfidence) || 0.85);
  const currentConfidence = Math.min(Math.max(numConfidence, 0), 1);

  const isWaterloggingDetected = 
    reportData?.category === 'Waterlogging' || 
    reportData?.predictedClass === 'Waterlogging' ||
    reportData?.issueType === 'waterlogging';

  const matchedType = issueTypes.find(t => t.id === reportData?.issueType);
  const currentClassLabel = reportData?.predictedClass || matchedType?.label || (isWaterloggingDetected ? 'Waterlogging & Flooding' : 'Issue Detected');
  const activeIssueType = reportData?.issueType || (isWaterloggingDetected ? 'waterlogging' : 'pothole');
  const safeDescription = typeof reportData?.description === 'string' && reportData.description
    ? reportData.description
    : (typeof editedDescription === 'string' ? editedDescription : '');
  const topPredictions = Array.isArray(reportData?.analysisResult?.classifier?.topPredictions)
    ? reportData.analysisResult.classifier.topPredictions
    : [];

  return (
    <div className="space-y-6">
      {/* Uncertainty warning if model confidence is low */}
      {uncertaintyNotice && (
        <div className="p-4 bg-warning/10 border border-warning/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm font-body text-slate">
            <span className="font-semibold text-warning">Notice:</span> Model prediction confidence was moderate. Please review and confirm or adjust the detected issue type below.
          </div>
        </div>
      )}

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        isAnalyzing={false}
        analysisResult={{
          issueType: matchedType || issueTypes[0],
          confidence: currentConfidence,
          reasoning: isWaterloggingDetected
            ? `Multimodal Vision API detected road waterlogging and drainage accumulation with ${(currentConfidence * 100).toFixed(1)}% confidence.`
            : `Custom classifier identified "${currentClassLabel}" with ${(currentConfidence * 100).toFixed(1)}% confidence. Description crafted with Gemini AI.`,
          generatedDescription: safeDescription,
        }}
        description={safeDescription}
        onDescriptionChange={(newDesc) => {
          const validDesc = typeof newDesc === 'string' ? newDesc : String(newDesc || '');
          setEditedDescription(validDesc)
          updateReportData({ description: validDesc })
        }}
        imagePreview={reportData?.imagePreview || reportData?.imageUrl}
      />

      {/* Issue Type Selection (All 10 Civic Categories: 9 Model Classes + Waterlogging) */}
      <Card hover={false} className="p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block font-display text-sm text-slate-muted uppercase tracking-wider">
            Confirm or Adjust Civic Issue Category
          </label>
          <span className="text-xs font-mono text-slate-muted">
            {issueTypes.length} Available Categories
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {issueTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleIssueTypeSelect(type.id)}
              className={`
                transition-all duration-200
                ${activeIssueType === type.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-cream' : 'opacity-80 hover:opacity-100'}
              `}
            >
              <IssueTypeTag type={type.id} />
            </button>
          ))}
        </div>

        {/* Top Predictions from custom model if available */}
        {topPredictions.length > 1 && (
          <div className="mt-5 pt-4 border-t border-cream-muted">
            <label className="block font-display text-xs text-slate-muted mb-2 uppercase tracking-wider">
              Custom Model Predictions
            </label>
            <div className="flex flex-wrap gap-2">
              {topPredictions.map((pred, index) => {
                if (!pred) return null;
                const predConf = Number(pred.confidence) || 0;
                const predClass = pred.className || `Class ${index + 1}`;
                const predTypeId = pred.issueTypeId || 'other';
                return (
                  <button
                    key={index}
                    onClick={() => handleIssueTypeSelect(predTypeId)}
                    className="px-2.5 py-1.5 bg-cream-dark hover:bg-blueprint/10 border border-cream-muted font-display text-xs text-slate flex items-center gap-1.5 transition-colors"
                  >
                    <span className="font-semibold">{predClass}:</span>
                    <span className="text-blueprint font-mono">{(predConf * 100).toFixed(1)}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack} icon={ArrowLeft}>
          Back
        </Button>
        <Button onClick={onNext} icon={ArrowRight} iconPosition="right" size="lg">
          Continue to Location
        </Button>
      </div>
    </div>
  )
}
