import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Brain, 
  Trash2, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Home, 
  ShieldCheck, 
  FileText 
} from 'lucide-react'
import { IssueTypeTag, StatusBadge } from '../ui'
import { useState, useEffect } from 'react'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { updateReportStatus } from '../../services/dataService'
import { useAuth } from '../../context/AuthContext'
import { REPORT_STATUSES } from '../../utils/userUtils'

export default function IssueDetailModal({ issue, isOpen, onClose, onUpdated }) {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState(issue?.status || 'Submitted')
  const [statusNotes, setStatusNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Keep state synchronized whenever the selected issue changes
  useEffect(() => {
    if (issue) {
      setCurrentStatus(issue.status || 'Submitted')
      setStatusNotes('')
      setUpdateError(null)
      setSuccessMessage(null)
    }
  }, [issue?.id, issue?.status, isOpen])

  if (!issue) return null;

  const handleStatusUpdate = async () => {
    setIsUpdating(true)
    setUpdateError(null)
    setSuccessMessage(null)

    try {
      console.log(`[Authority] Updating issue ${issue.id} status to: ${currentStatus}`)
      const updatedBy = user?.email || 'Authority';
      
      await updateReportStatus(issue.id, currentStatus, updatedBy, statusNotes);

      console.log('[Authority] Status updated successfully in Firestore:', issue.id, currentStatus)
      setSuccessMessage(`Status updated to "${currentStatus}" successfully!`)
      setIsUpdating(false)

      const updatedReport = {
        ...issue,
        status: currentStatus,
        updatedAt: new Date().toISOString()
      };

      if (onUpdated) {
        onUpdated(updatedReport);
      }
      
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      console.error('[Authority] Error updating issue status:', error)
      setUpdateError(error.message || 'Failed to update status in Firestore. Please check permissions.')
      setIsUpdating(false)
    }
  }

  const handleDeleteIssue = async () => {
    setIsDeleting(true)
    setUpdateError(null)

    try {
      const issueRef = doc(db, 'issues', issue.id)
      await deleteDoc(issueRef)
      setIsDeleting(false)
      if (onUpdated) onUpdated({ id: issue.id, deleted: true });
      onClose()
    } catch (error) {
      console.error('Error deleting issue:', error)
      setUpdateError(error.message || 'Failed to delete report.')
      setIsDeleting(false)
    }
  }

  const reporterName = issue.reporterName || 
    `${issue.reporterFirstName || ''} ${issue.reporterLastName || ''}`.trim() || 
    issue.reportedBy || 
    'Citizen';

  const confidencePct = issue.classifierConfidence !== null && issue.classifierConfidence !== undefined
    ? (issue.classifierConfidence * 100).toFixed(1)
    : issue.aiAnalysis?.confidence !== undefined
    ? (issue.aiAnalysis.confidence * 100).toFixed(1)
    : null;

  const formattedDate = issue.createdAt 
    ? new Date(issue.createdAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Recent Submission';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative bg-cream border-2 border-cream-muted shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col my-auto z-10 overflow-hidden"
          >
            {/* Header Image Banner */}
            <div className="relative h-48 sm:h-56 bg-slate shrink-0">
              {issue.imageUrl ? (
                <img
                  src={issue.imageUrl}
                  alt={issue.category || issue.type || 'Civic Issue'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cream/40">
                  <FileText className="w-12 h-12" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate/95 via-slate/50 to-transparent" />
              
              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Close details"
                className="absolute top-3 right-3 p-2 bg-cream/90 backdrop-blur-sm text-slate hover:bg-cream transition-colors shadow-md rounded-none border border-cream-muted"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Overlay info */}
              <div className="absolute bottom-3 left-4 right-4 text-cream">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <IssueTypeTag 
                    type={issue.category || issue.manualLabel || issue.issueType || issue.type || 'other'} 
                    size="md" 
                  />
                  <StatusBadge status={issue.status || 'Submitted'} size="md" />
                  {confidencePct && (
                    <span className="px-2 py-0.5 bg-blueprint/80 backdrop-blur-sm text-cream text-[11px] font-display font-bold uppercase tracking-wider">
                      AI Conf: {confidencePct}%
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-cream/80">
                  <span>ID: {issue.id}</span>
                  <span>📅 {formattedDate}</span>
                </div>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 font-body">

              {/* Success / Error Banners */}
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-success/15 border-2 border-success text-success text-xs font-display font-semibold uppercase tracking-wider flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </motion.div>
              )}

              {updateError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-danger/15 border-2 border-danger text-danger text-xs font-body flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Error: {updateError}</span>
                </motion.div>
              )}

              {/* Citizen Reporter Profile Section */}
              <div className="p-4 bg-cream-dark/50 border border-cream-muted">
                <h3 className="font-display text-xs uppercase tracking-wider text-slate-muted mb-2.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>Citizen Reporter Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate">
                    <User className="w-4 h-4 text-slate-muted shrink-0" />
                    <span className="font-semibold font-display">{reporterName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate truncate">
                    <Mail className="w-4 h-4 text-slate-muted shrink-0" />
                    <span className="truncate">{issue.reporterEmail || issue.userEmail || 'Email not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate">
                    <Phone className="w-4 h-4 text-slate-muted shrink-0" />
                    <span>{issue.reporterPhone || 'Phone not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate truncate">
                    <Home className="w-4 h-4 text-slate-muted shrink-0" />
                    <span className="truncate">{issue.reporterAddress || 'Address not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Municipal Complaint Description */}
              <div>
                <h3 className="font-display text-xs text-slate-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-accent" />
                  <span>Municipal Complaint Description</span>
                </h3>
                <div className="p-4 bg-cream border border-cream-muted leading-relaxed">
                  <p className="text-slate font-body text-sm">
                    {issue.description || issue.aiAnalysis?.summary || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Location & GPS Geocoding */}
              <div>
                <h3 className="font-display text-xs text-slate-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>Location & GPS Geocoding</span>
                </h3>
                <div className="p-3.5 bg-cream border border-cream-muted flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate font-body text-sm font-medium">
                      {issue.location?.address || 'Location on map'}
                    </p>
                    {issue.location?.lat && (
                      <p className="text-xs text-slate-muted font-mono mt-1">
                        GPS Coordinates: {Number(issue.location.lat).toFixed(6)}, {Number(issue.location.lng).toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Authority Status Update Controls (Always reachable by scrolling) */}
              <div className="bg-cream-dark/40 p-5 border-2 border-cream-muted">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-slate uppercase tracking-wider">
                      Authority Status Management
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-muted">Target Status:</span>
                      <StatusBadge status={currentStatus} size="sm" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-muted font-body mt-0.5">
                    Select the status to update this report and assign department notes.
                  </p>
                </div>
                
                {/* Status Selection Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {REPORT_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setCurrentStatus(status)}
                      className={`px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider transition-all border ${
                        currentStatus === status
                          ? 'bg-slate text-cream border-slate shadow-sm ring-1 ring-slate'
                          : 'bg-cream text-slate-muted border-cream-muted hover:border-slate/40'
                      }`}
                      disabled={isUpdating}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Notes / Comments */}
                <div className="mb-4">
                  <label className="block font-display text-xs uppercase tracking-wider text-slate mb-1">
                    Official Department Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="e.g. Verified by Road Maintenance Squad; repair completed."
                    className="w-full px-3 py-2 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-xs placeholder:text-slate-muted/50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleStatusUpdate}
                    disabled={isUpdating || (currentStatus === issue?.status && !statusNotes)}
                    className={`flex-1 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                      isUpdating || (currentStatus === issue?.status && !statusNotes)
                        ? 'bg-cream-muted text-slate-muted cursor-not-allowed border border-cream-muted'
                        : 'bg-accent text-cream hover:bg-accent-hover shadow-sm cursor-pointer'
                    }`}
                  >
                    {isUpdating ? 'Saving Status to Firestore...' : 'Apply Status Update'}
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isUpdating || isDeleting}
                    className="px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-cream transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Status History Timeline */}
              {issue.statusHistory && issue.statusHistory.length > 0 && (
                <div>
                  <h3 className="font-display text-xs text-slate-muted mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span>Status History Timeline</span>
                  </h3>
                  <div className="space-y-2 border-l-2 border-cream-muted pl-4 ml-1">
                    {issue.statusHistory.map((hist, i) => (
                      <div key={i} className="relative text-xs font-body">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-cream" />
                        <div className="flex items-center justify-between">
                          <span className="font-display font-semibold text-slate uppercase tracking-wider">
                            {hist.status}
                          </span>
                          <span className="text-[11px] text-slate-muted">
                            {hist.timestamp ? new Date(hist.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        {hist.notes && (
                          <p className="text-slate-muted mt-0.5">{hist.notes}</p>
                        )}
                        <p className="text-[10px] text-slate-muted/70">Updated by: {hist.updatedBy || 'Authority'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-slate/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-cream p-6 max-w-md w-full border-2 border-danger shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-danger/10 flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-danger" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate">Delete Civic Report?</h3>
                      <p className="text-xs text-slate-muted font-body">This action permanently deletes this record.</p>
                    </div>
                  </div>
                  <p className="text-slate font-body text-xs mb-5">
                    Are you sure you want to permanently delete report #{issue.id}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 font-display text-xs font-semibold uppercase tracking-wider bg-cream border border-cream-muted text-slate hover:bg-cream-dark"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteIssue}
                      disabled={isDeleting}
                      className="flex-1 py-2 font-display text-xs font-semibold uppercase tracking-wider bg-danger text-cream hover:bg-danger/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
