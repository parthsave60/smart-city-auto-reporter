import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import StepUpload from '../components/report/StepUpload'
import StepAnalysis from '../components/report/StepAnalysis'
import StepLocation from '../components/report/StepLocation'
import StepConfirm from '../components/report/StepConfirm'
import { StepProgress, ErrorBoundary } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { saveIssueReport } from '../services/dataService'

export default function ReportIssue() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [reportData, setReportData] = useState({
    image: null,
    imagePreview: null,
    imageUrl: null,
    cloudinaryPublicId: null,
    analysisResult: null,
    predictedClass: null,
    confidence: null,
    description: '',
    issueType: null,
    location: null,
  })

  const updateReportData = (data) => {
    setReportData((prev) => ({ ...prev, ...data }))
  }

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const { user, userProfile, isAuthority } = useAuth();
  const [submitting, setSubmitting] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState(null) // null | 'success' | 'error'
  const [submissionError, setSubmissionError] = useState('')

  const handleSubmit = async () => {
    if (submitting) return;

    if (!reportData.imageUrl) {
      alert('Please upload an issue photo before submitting.');
      setCurrentStep(1);
      return;
    }

    if (reportData.civicIssueDetected === false) {
      alert(reportData.validationError || 'No civic issue detected in this image. Please upload an image showing a valid civic issue.');
      setCurrentStep(2);
      return;
    }

    if (!reportData.location || !reportData.location.lat || !reportData.location.lng) {
      alert('Device coordinates are required to submit a report. Please detect your location in Step 3.');
      setCurrentStep(3);
      return;
    }

    if (!user) {
      alert('You must be signed in to submit a report.');
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setSubmissionStatus(null);
    setSubmissionError('');
    console.log('[ReportSubmit] Initiating report submission...');

    try {
      const reporterFirstName = userProfile?.firstName || (user.displayName?.split(' ')[0]) || 'Citizen';
      const reporterLastName = userProfile?.lastName || (user.displayName?.split(' ').slice(1).join(' ')) || '';
      const reporterFullName = `${reporterFirstName} ${reporterLastName}`.trim();

      const issuePayload = {
        imageUrl: reportData.imageUrl,
        cloudinaryPublicId: reportData.cloudinaryPublicId || null,
        imageFormat: reportData.imageFormat || 'jpg',
        description: reportData.description || 'No description provided',
        manualLabel: reportData.issueType || 'Unspecified',
        category: reportData.predictedClass || reportData.issueType || 'Unspecified',
        predictedClass: reportData.predictedClass || null,
        classifierConfidence: reportData.confidence || null,
        location: {
          lat: reportData.location.lat,
          lng: reportData.location.lng,
          accuracy: reportData.location.accuracy || null,
          timestamp: reportData.location.timestamp || Date.now(),
          address: reportData.location.address || `${reportData.location.lat.toFixed(6)}, ${reportData.location.lng.toFixed(6)}`
        },
        status: 'Submitted',
        userId: user.uid,
        userEmail: user.email,
        reporterFirstName,
        reporterLastName,
        reporterName: reporterFullName,
        reporterPhone: userProfile?.phone || '',
        reporterAddress: userProfile?.address || '',
        aiAnalysis: {
          predictedClass: reportData.predictedClass || null,
          confidence: reportData.confidence || null,
          confidenceScore: reportData.confidence || 0,
          summary: reportData.description || '',
          verified: (reportData.confidence || 0) > 0.8,
          classifier: reportData.analysisResult?.classifier || null,
        }
      };

      console.log('[ReportSubmit] Saving issue payload:', issuePayload);
      const savedId = await saveIssueReport(issuePayload);
      console.log('[ReportSubmit] Issue saved with ID:', savedId);

      // Stop loading immediately on success
      setSubmitting(false);
      setSubmissionStatus('success');

      // Reset state so that future reports start completely fresh
      setTimeout(() => {
        setReportData({
          image: null,
          imagePreview: null,
          imageUrl: null,
          cloudinaryPublicId: null,
          analysisResult: null,
          predictedClass: null,
          confidence: null,
          description: '',
          issueType: null,
          location: null,
          civicIssueDetected: null,
          validationError: null,
        });
        setCurrentStep(1);

        if (isAuthority) {
          navigate('/dashboard');
        } else {
          navigate('/my-reports');
        }
      }, 1200);

    } catch (error) {
      console.error('[ReportSubmit] Error submitting report:', error);
      // Stop loading immediately on failure
      setSubmitting(false);
      setSubmissionStatus('error');
      setSubmissionError(error.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
      console.log('[ReportSubmit] Submitting state cleared.');
    }
  }

  const validationCheck = (data) => {
    // Add any quick checks here
    return true;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepUpload
            reportData={reportData}
            updateReportData={updateReportData}
            onNext={nextStep}
          />
        )
      case 2:
        return (
          <StepAnalysis
            reportData={reportData}
            updateReportData={updateReportData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 3:
        return (
          <StepLocation
            reportData={reportData}
            updateReportData={updateReportData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 4:
        return (
          <StepConfirm
            reportData={reportData}
            updateReportData={updateReportData}
            onSubmit={handleSubmit}
            isSubmitting={submitting}
            submissionStatus={submissionStatus}
            submissionError={submissionError}
            onBack={prevStep}
          />
        )
      default:
        return null
    }
  }

  const stepHints = [
    '📸 Upload an image of the issue (pothole, graffiti, broken light, etc.)',
    '🤖 Our AI model identifies the civic issue automatically and Gemini drafts the complaint description',
    '📍 Mark the exact location so city officials can find it',
    '✅ Review and submit your report to help improve your city'
  ]

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-cream">
      {/* Blueprint grid background */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#3B7DD8 1px, transparent 1px),
            linear-gradient(90deg, #3B7DD8 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <span className="inline-block font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-3">
            Civic Reporting
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-slate mb-3 tracking-tight">
            Report an Issue
          </h1>
          <p className="text-slate-muted font-body text-lg">
            Help improve your city by reporting infrastructure problems
          </p>
        </motion.div>

        {/* Enhanced Step Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <StepProgress currentStep={currentStep} />
          <motion.p 
            key={currentStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-slate-muted font-body text-sm mt-6 max-w-md mx-auto"
          >
            {stepHints[currentStep - 1]}
          </motion.p>
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ErrorBoundary key={currentStep} onBack={prevStep}>
              {renderStep()}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
