import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, MapPin, Brain, CheckCircle, AlertCircle } from 'lucide-react'
import { Button, Card, IssueTypeTag } from '../ui'

export default function StepConfirm({ 
  reportData, 
  onSubmit, 
  onBack, 
  isSubmitting,
  submissionStatus,
  submissionError 
}) {
  return (
    <div className="space-y-6">
      <Card hover={false} className="p-8">
        <h2 className="font-display text-xl font-semibold text-slate mb-2">
          Review Your Report
        </h2>
        <p className="text-slate-muted font-body mb-6">
          Please verify all information before submitting
        </p>

        <div className="space-y-6">
          {/* Image and issue type */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">Issue Photo</label>
              <img
                src={reportData.imagePreview || reportData.imageUrl}
                alt="Issue"
                className="w-full h-48 object-cover border border-cream-muted"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">Issue Type</label>
                <IssueTypeTag type={reportData.category || reportData.predictedClass || reportData.issueType} size="lg" />
              </div>
              <div>
                <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">Model Confidence</label>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-accent" />
                  <div className="flex-1 h-2 bg-cream-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(reportData.confidence || reportData.analysisResult?.classifier?.confidence || 0.85) * 100}%` }}
                      className="h-full bg-gradient-to-r from-blueprint to-accent"
                    />
                  </div>
                  <span className="text-sm font-display font-bold text-slate">
                    {((reportData.confidence || reportData.analysisResult?.classifier?.confidence || 0.85) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">Description</label>
            <div className="p-4 bg-cream-dark/30 border border-cream-muted">
              <p className="text-slate font-body text-sm leading-relaxed">
                {reportData.description}
              </p>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">Location</label>
            <div className="flex items-start gap-3 p-4 bg-cream-dark/30 border border-cream-muted">
              <MapPin className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-slate font-body">{reportData.location?.address}</p>
                {reportData.location?.lat && reportData.location?.lng && (
                  <p className="text-sm text-slate-muted font-mono mt-1">
                    {reportData.location.lat.toFixed(6)}, {reportData.location.lng.toFixed(6)}
                    {reportData.location.accuracy ? ` (±${reportData.location.accuracy}m accuracy)` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Feedbacks */}
        {submissionStatus === 'success' && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-success/10 border-l-4 border-success flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-success shrink-0" />
            <div>
              <p className="font-display font-semibold text-success text-sm">
                Report Submitted Successfully!
              </p>
              <p className="text-xs text-slate-muted font-body">
                Your report has been saved to the municipal registry. Redirecting to reports...
              </p>
            </div>
          </motion.div>
        )}

        {submissionError && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-danger/10 border-l-4 border-danger flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-danger shrink-0" />
            <div>
              <p className="font-display font-semibold text-danger text-sm">
                Submission Notice
              </p>
              <p className="text-xs text-danger font-body">
                {submissionError}
              </p>
            </div>
          </motion.div>
        )}

        {/* Submission notice */}
        <div className="mt-6 p-4 bg-blueprint/5 border-l-4 border-blueprint">
          <p className="text-sm text-slate font-body">
            <span className="text-blueprint font-display font-semibold">Note:</span> By submitting this report,
            you agree to share the image and location data with city authorities for issue resolution.
          </p>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="secondary" 
          onClick={onBack} 
          icon={ArrowLeft}
          disabled={isSubmitting || submissionStatus === 'success'}
        >
          Back
        </Button>
        <Button
          onClick={onSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || submissionStatus === 'success' || reportData.civicIssueDetected === false}
          icon={submissionStatus === 'success' ? CheckCircle : Send}
          iconPosition="right"
          size="lg"
        >
          {isSubmitting 
            ? 'Submitting Report...' 
            : submissionStatus === 'success' 
              ? 'Report Submitted!' 
              : 'Submit Report'}
        </Button>
      </div>
    </div>
  )
}
