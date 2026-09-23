import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, MapPin, Navigation, Map as MapIcon, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card } from '../ui'
import { getCurrentLocation } from '../../services/maps'

export default function StepLocation({ reportData, updateReportData, onNext, onBack }) {
  const [isDetecting, setIsDetecting] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [manualAddress, setManualAddress] = useState(reportData.location?.address || '')

  useEffect(() => {
    if (reportData.location?.address) {
      setManualAddress(reportData.location.address)
    }
  }, [reportData.location?.address])

  const handleDetectLocation = async () => {
    setIsDetecting(true)
    setLocationError(null)
    try {
      const location = await getCurrentLocation()
      updateReportData({
        location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          address: location.address,
        },
      })
      setManualAddress(location.address)
    } catch (error) {
      console.error('[StepLocation] Geolocation capture failed:', error)
      let msg = 'Unable to detect location. Please check device location/GPS settings and try again.'
      if (error.code === 1) {
        msg = 'Location permission was denied. Please allow location access in your browser settings to report a civic issue.'
      } else if (error.code === 2) {
        msg = 'Location unavailable. Please ensure your device has a network or GPS connection and retry.'
      } else if (error.code === 3) {
        msg = 'Location request timed out. Please try again.'
      }
      setLocationError(msg)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleAddressChange = (e) => {
    const val = e.target.value
    setManualAddress(val)
    if (reportData.location) {
      updateReportData({
        location: {
          ...reportData.location,
          address: val,
        },
      })
    }
  }

  const isLowAccuracy = reportData.location?.accuracy && reportData.location.accuracy > 500

  return (
    <div className="space-y-6">
      <Card hover={false} className="p-8">
        <h2 className="font-display text-xl font-semibold text-slate mb-2">
          Pin the Location
        </h2>
        <p className="text-slate-muted font-body mb-6">
          Your device coordinates mark the exact spot for city public works teams.
        </p>

        {/* Location detection / retry button */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleDetectLocation}
            loading={isDetecting}
            variant={reportData.location ? 'secondary' : 'primary'}
            icon={reportData.location ? RefreshCw : Navigation}
            className="flex-1"
            size="lg"
          >
            {isDetecting
              ? 'Getting your current location...'
              : reportData.location
                ? 'Recapture / Refresh Location'
                : 'Detect My Location'}
          </Button>
        </div>

        {/* Location Error Alert */}
        {locationError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mb-6 bg-danger/10 border-l-4 border-danger flex items-start gap-3 text-danger font-body text-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{locationError}</p>
              <p className="text-xs mt-1 text-slate-muted">
                Device coordinates are required so authorities can dispatch repair crews to the exact location.
              </p>
            </div>
          </motion.div>
        )}

        {/* Low Accuracy Warning */}
        {isLowAccuracy && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mb-6 bg-warning/10 border-l-4 border-warning flex items-start gap-3 text-slate font-body text-sm"
          >
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning">
                Location accuracy is low (~{Math.round(reportData.location.accuracy)}m).
              </p>
              <p className="text-xs text-slate-muted mt-1">
                Laptops without dedicated GPS rely on network positioning which may be approximate. Please enable device location/GPS and try again if possible.
              </p>
            </div>
          </motion.div>
        )}

        {/* Mock map */}
        <div className="relative overflow-hidden bg-cream-dark border border-cream-muted mb-6">
          <div className="h-64 relative">
            {/* Map background with blueprint grid */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(rgba(59,125,216,0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59,125,216,0.08) 1px, transparent 1px),
                  linear-gradient(135deg, #F7F5F0 0%, #EDE8DE 50%, #E8E3D9 100%)
                `,
                backgroundSize: '30px 30px, 30px 30px, 100% 100%',
              }}
            />

            {/* Roads */}
            <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate/10" />
            <div className="absolute top-0 bottom-0 left-1/3 w-2 bg-slate/10" />
            <div className="absolute top-0 bottom-0 right-1/4 w-1 bg-slate/5" />

            {/* Location pin */}
            {reportData.location?.lat && reportData.location?.lng && (
              <motion.div
                initial={{ scale: 0, y: -50 }}
                animate={{ scale: 1, y: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-accent flex items-center justify-center shadow-lg">
                    <MapPin className="w-5 h-5 text-cream" />
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rotate-45" />
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-accent/30"
                  />
                </div>
              </motion.div>
            )}

            {/* Map overlay if location not yet captured */}
            {(!reportData.location?.lat || !reportData.location?.lng) && (
              <div className="absolute inset-0 flex items-center justify-center bg-cream/60 backdrop-blur-sm">
                <div className="text-center p-4">
                  <MapIcon className="w-12 h-12 text-slate-muted mx-auto mb-3" />
                  <p className="text-slate-muted font-body font-medium">Click &quot;Detect My Location&quot; to capture device GPS coordinates</p>
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-2 right-2 text-xs text-slate-muted bg-cream/80 px-2 py-1 font-body">
            © SmartCity Maps
          </div>
        </div>

        {/* Address input */}
        <div>
          <label className="block font-display text-sm text-slate-muted mb-2 uppercase tracking-wider">
            Address / Readable Location Details
          </label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-muted" />
            <input
              type="text"
              value={manualAddress}
              onChange={handleAddressChange}
              placeholder="Captured address from coordinates..."
              className="w-full pl-12 pr-4 py-3 bg-cream border border-cream-muted focus:border-blueprint/50 focus:outline-none text-slate font-body placeholder-slate-muted"
            />
          </div>
        </div>

        {/* Development & Verification Coordinates Panel */}
        {reportData.location && reportData.location.lat && reportData.location.lng && (
          <div className="mt-4 p-3 bg-cream-dark/40 border border-cream-muted text-xs font-mono text-slate space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-muted">Latitude:</span>
              <span className="font-bold">{reportData.location.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-muted">Longitude:</span>
              <span className="font-bold">{reportData.location.lng.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-muted">Accuracy:</span>
              <span className="font-bold">{reportData.location.accuracy ? `${reportData.location.accuracy}m` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-muted">Timestamp:</span>
              <span>{reportData.location.timestamp ? new Date(reportData.location.timestamp).toLocaleTimeString() : 'N/A'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack} icon={ArrowLeft}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!reportData.location?.lat || !reportData.location?.lng}
          icon={ArrowRight}
          iconPosition="right"
          size="lg"
        >
          Review Report
        </Button>
      </div>
    </div>
  )
}
