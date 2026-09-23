import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Camera, Image, X, ArrowRight, AlertCircle } from 'lucide-react'
import { Button, Card } from '../ui'
import { uploadImageToCloudinary } from '../../services/cloudinary'
import { getCurrentLocation } from '../../services/maps'
import { MapPin } from 'lucide-react'

export default function StepUpload({ reportData, updateReportData, onNext }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const handleFileSelect = useCallback(async (file) => {
    const isImage = file && (
      (file.type && file.type.startsWith('image/')) ||
      (file.name && /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name))
    );
    if (!isImage) {
      setUploadError('Please select a valid image file.')
      setIsUploading(false)
      return
    }

    setUploadError(null)
    setIsUploading(true)
    setIsLocating(true)

    // Instant local preview for zero-latency UI rendering
    const instantPreviewUrl = URL.createObjectURL(file)
    updateReportData({
      image: file,
      imagePreview: instantPreviewUrl,
      imageUrl: null,
      cloudinaryPublicId: null,
      location: null,
      analysisResult: null,
      validationError: null,
      civicIssueDetected: null,
      predictedClass: null,
      description: '',
    })

    // Start location capture in parallel with maximumAge: 0
    const locationPromise = getCurrentLocation().catch(err => {
      console.warn("[StepUpload] Location capture error:", err)
      return null
    })

    try {
      // Upload to Cloudinary with compression & isolation
      const cloudinaryResult = await uploadImageToCloudinary(file)
      console.log('Image uploaded to Cloudinary successfully:', cloudinaryResult.imageUrl)

      // Clean up object URL to prevent memory leaks on mobile
      try {
        URL.revokeObjectURL(instantPreviewUrl)
      } catch (e) {
        // ignore
      }

      updateReportData({
        image: file,
        imagePreview: cloudinaryResult.imageUrl,
        imageUrl: cloudinaryResult.imageUrl,
        cloudinaryPublicId: cloudinaryResult.publicId,
        imageFormat: cloudinaryResult.format,
      })

      setIsUploading(false)

      // Handle location result
      const location = await locationPromise
      setIsLocating(false)

      if (location) {
        console.log("[StepUpload] Fresh location captured:", location)
        updateReportData({
          location: {
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy,
            timestamp: location.timestamp,
            address: location.address,
          }
        })
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(`Upload failed: ${error.message}`)
      setIsUploading(false)
      setIsLocating(false)
    }
  }, [updateReportData])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files && e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
    // Critical fix: Reset input value so reselecting the same file triggers onChange every time
    e.target.value = ''
  }

  const removeImage = () => {
    updateReportData({
      image: null,
      imagePreview: null,
      imageUrl: null,
      cloudinaryPublicId: null,
      analysisResult: null,
      validationError: null,
      civicIssueDetected: null,
      predictedClass: null,
      description: '',
    })
  }

  return (
    <div className="space-y-6">
      <Card hover={false} className="p-8">
        <h2 className="font-display text-xl font-semibold text-slate mb-2">
          Capture or Upload Image
        </h2>
        <p className="text-slate-muted font-body mb-6">
          Take a photo or upload an image of the city issue you want to report. Our AI will analyze it to verify the issue type.
        </p>

        {reportData.imagePreview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <img
              src={reportData.imagePreview}
              alt="Issue preview"
              className="w-full h-80 object-cover border border-cream-muted"
            />
            <button
              onClick={removeImage}
              className="absolute top-3 right-3 p-2 bg-cream/80 backdrop-blur-sm text-slate hover:bg-danger hover:text-cream transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed p-12 text-center
              transition-all duration-300 cursor-pointer
              ${isDragging
                ? 'border-blueprint bg-blueprint/5'
                : 'border-cream-muted hover:border-blueprint/50 hover:bg-cream-dark/30'
              }
            `}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center">
              <motion.div
                animate={{ y: isDragging ? -10 : 0 }}
                className="w-20 h-20 bg-blueprint/10 flex items-center justify-center mb-6"
              >
                <Upload className="w-10 h-10 text-blueprint" />
              </motion.div>

              <p className="font-display text-lg font-medium text-slate mb-2">
                {isDragging ? 'Drop your image here' : 'Drag and drop your image'}
              </p>
              <p className="text-slate-muted font-body mb-4">or click to browse</p>

              <div className="flex items-center gap-2 text-sm text-slate-muted font-body">
                <Image className="w-4 h-4" />
                <span>Supports JPG, PNG, HEIC up to 10MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Mobile camera option */}
        <div className="mt-6 flex flex-col gap-3">
          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30">
              <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              <p className="text-sm text-danger font-body">{uploadError}</p>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 p-3 bg-blueprint/10 border border-blueprint/30">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4"
              >
                <Upload className="w-4 h-4 text-blueprint" />
              </motion.div>
              <p className="text-sm text-blueprint font-body">Uploading image...</p>
            </div>

          )}

          {/* Location Status - Shows Coordinates only (No readable address on first page) */}
          {(isLocating || (reportData.location && reportData.location.lat && reportData.location.lng)) && (
            <div className={`p-3.5 border ${reportData.location ? 'bg-success/10 border-success/30' : 'bg-blueprint/10 border-blueprint/30'}`}>
              <div className="flex items-center gap-2">
                <MapPin className={`w-5 h-5 shrink-0 ${reportData.location ? 'text-success' : 'text-blueprint'}`} />
                <p className={`text-sm font-display font-medium ${reportData.location ? 'text-success' : 'text-blueprint'}`}>
                  {isLocating ? "Capturing current device coordinates..." : "Location Coordinates"}
                </p>
              </div>
              {reportData.location && reportData.location.lat && reportData.location.lng && (
                <div className="mt-2 text-xs font-mono text-slate space-y-0.5 pl-7">
                  <div>
                    <span className="text-slate-muted">Latitude: </span>
                    <span className="font-semibold">{Number(reportData.location.lat).toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-slate-muted">Longitude: </span>
                    <span className="font-semibold">{Number(reportData.location.lng).toFixed(6)}</span>
                  </div>
                  {reportData.location.accuracy != null && (
                    <div>
                      <span className="text-slate-muted">Accuracy: </span>
                      <span>{Math.round(reportData.location.accuracy)} m</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleInputChange}
              disabled={isUploading}
              className="hidden"
            />
            <div className={`flex items-center justify-center gap-2 px-4 py-4 border border-cream-muted hover:border-blueprint/50 transition-colors min-h-[44px] ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Camera className="w-5 h-5 text-blueprint" />
              <span className="text-slate font-display font-medium">Take Photo</span>
            </div>
          </label>

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 px-4 py-4 border border-cream-muted hover:border-accent/50 transition-colors min-h-[44px]">
              <Upload className="w-5 h-5 text-accent" />
              <span className="text-slate font-display font-medium">Upload File</span>
            </div>
          </label>
        </div>
      </Card >

      {/* Next Button */}
      < div className="flex justify-end" >
        <Button
          onClick={onNext}
          disabled={!reportData.imageUrl || isUploading}
          icon={ArrowRight}
          iconPosition="right"
          size="lg"
        >
          Continue to Analysis
        </Button>
      </div >
    </div >
  )
}
