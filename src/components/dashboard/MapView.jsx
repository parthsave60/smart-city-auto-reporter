import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, ChevronRight, AlertCircle, Map as MapIcon } from 'lucide-react'
import { Card, StatusBadge, IssueTypeTag } from '../ui'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api'
import { darkMapStyles } from '../../services/maps'

const containerStyle = {
  width: '100%',
  height: '600px'
};

const center = {
  lat: 19.8055, // Default Region (e.g. Palghar / NH48 / Mumbai corridor)
  lng: 72.8258
};

// Clean library array without deprecated visualization
const libraries = [];

export default function MapView({ issues = [], onSelectIssue }) {
  const [selectedMarker, setSelectedMarker] = useState(null)

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';
  const [authError, setAuthError] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapsApiKey,
    libraries: libraries
  })

  const [map, setMap] = useState(null)

  useEffect(() => {
    // Intercept Google Maps API authentication errors (gm_authFailure)
    window.gm_authFailure = () => {
      console.warn('[Google Maps] Authentication notification (gm_authFailure): verify Maps JavaScript API is enabled in Google Cloud Console.');
      setAuthError('Google Maps API authentication requires Maps JavaScript API enabled in Google Cloud Console.');
    };

    if (loadError) {
      console.error('Maps API Load Error:', loadError);
    }

    return () => {
      window.gm_authFailure = null;
    };
  }, [loadError, mapsApiKey])

  const onLoad = React.useCallback(function callback(mapInstance) {
    setMap(mapInstance)
  }, [])

  const onUnmount = React.useCallback(function callback() {
    setMap(null)
  }, [])

  // Dynamic center based on available issues with valid coordinates
  const mapCenter = React.useMemo(() => {
    const issueWithCoords = issues.find(i => i.location?.lat && i.location?.lng);
    if (issueWithCoords) {
      return { lat: Number(issueWithCoords.location.lat), lng: Number(issueWithCoords.location.lng) };
    }
    return center;
  }, [issues]);

  // If API load error, show helpful message
  if (loadError) {
    return (
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card hover={false} padding={false} className="overflow-hidden flex items-center justify-center h-[600px] bg-cream">
            <div className="text-center p-6 max-w-md">
              <h3 className="text-xl font-bold text-slate mb-4">Map Temporarily Unavailable</h3>
              <p className="text-slate-muted mb-4">
                The Google Maps API is initializing or experiencing a connection restriction.
              </p>
              <div className="bg-cream-dark/50 rounded-lg p-3 mb-4 text-left">
                <p className="text-slate text-sm mb-2"><strong>What you can still do:</strong></p>
                <ul className="text-slate-muted text-sm space-y-1">
                  <li>• View all issues in the Recent Issues list on the right</li>
                  <li>• Click any report to view and update its status</li>
                  <li>• Use the Refresh button after verifying API key</li>
                </ul>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blueprint text-cream rounded-lg font-semibold hover:bg-blueprint/90 transition"
              >
                Try Refreshing
              </button>
            </div>
          </Card>
        </div>
        <SidePanel issues={issues} onSelectIssue={onSelectIssue} />
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card hover={false} padding={false} className="overflow-hidden flex items-center justify-center h-[600px] bg-cream">
            <div className="text-center p-6">
              <h3 className="text-xl font-bold text-slate mb-2">Map Loading...</h3>
              <p className="text-slate-muted">Connecting to Google Maps JavaScript API...</p>
            </div>
          </Card>
        </div>
        <SidePanel issues={issues} onSelectIssue={onSelectIssue} />
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative bg-cream border-2 border-cream-muted shadow-paper overflow-hidden h-[600px]"
        >
          {/* Map Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate/90 via-slate/60 to-transparent p-4 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="w-8 h-8 bg-blueprint/20 backdrop-blur-sm flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-blueprint" />
              </div>
              <span className="font-display text-sm font-semibold text-cream">
                Interactive Map View
              </span>
            </div>
          </div>

          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={13}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              styles: darkMapStyles,
              disableDefaultUI: false,
              zoomControl: true,
            }}
          >
            {issues.map((issue) => (
              issue.location?.lat && issue.location?.lng && (
                <MarkerF
                  key={issue.id}
                  position={{ 
                    lat: Number(issue.location.lat), 
                    lng: Number(issue.location.lng) 
                  }}
                  onClick={() => {
                    setSelectedMarker(issue);
                    if (onSelectIssue) onSelectIssue(issue);
                  }}
                >
                  {selectedMarker?.id === issue.id && (
                    <InfoWindowF
                      position={{ 
                        lat: Number(issue.location.lat), 
                        lng: Number(issue.location.lng) 
                      }}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div 
                        className="bg-cream text-slate p-3 cursor-pointer max-w-xs"
                        onClick={() => {
                          if (onSelectIssue) onSelectIssue(issue);
                        }}
                      >
                        <div className="mb-1.5">
                          <IssueTypeTag 
                            type={issue.category || issue.manualLabel || issue.issueType || issue.type || 'other'} 
                            size="sm" 
                          />
                        </div>
                        <p className="text-xs font-body text-slate font-medium line-clamp-2 leading-relaxed">
                          {issue.description || 'No description provided.'}
                        </p>
                        <p className="text-[11px] font-body text-slate-muted mt-1.5 line-clamp-1">
                          📍 {issue.location?.address || 'Coordinates marked on map'}
                        </p>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-cream-muted">
                          <StatusBadge status={issue.status || 'Submitted'} size="sm" />
                          <span className="text-[10px] text-accent font-display font-semibold uppercase tracking-wider">
                            Inspect Report →
                          </span>
                        </div>
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              )
            ))}
          </GoogleMap>
          
          {/* Issue count badge */}
          <div className="absolute bottom-4 left-4 bg-slate/90 backdrop-blur-sm px-4 py-2 border border-cream/20">
            <span className="font-display text-sm text-cream">
              <span className="font-bold">{issues.length}</span> issues visible
            </span>
          </div>
        </motion.div>
      </div>

      <SidePanel issues={issues} onSelectIssue={onSelectIssue} />
    </div>
  )
}

function SidePanel({ issues = [], onSelectIssue }) {
  return (
    <div className="lg:col-span-1">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-cream border-2 border-cream-muted h-[600px] overflow-hidden flex flex-col shadow-paper"
      >
        {/* Header */}
        <div className="p-5 border-b-2 border-cream-muted shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate">Recent Issues</h3>
              <p className="text-slate-muted font-body text-xs">
                {issues.length} total on map
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Issues list - no slicing so last report is never hidden */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
          <AnimatePresence>
            {issues.map((issue, index) => (
              <motion.button
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                onClick={() => {
                  if (onSelectIssue) onSelectIssue(issue);
                }}
                whileHover={{ x: 4 }}
                className="group w-full text-left p-3 bg-cream border-2 border-cream-muted hover:border-blueprint/50 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-14 h-14 shrink-0 bg-cream-dark">
                    <img
                      src={issue.imageUrl || 'https://via.placeholder.com/150'}
                      alt={issue.category || 'Issue'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border border-cream-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <IssueTypeTag 
                      type={issue.category || issue.manualLabel || issue.issueType || issue.type || 'other'} 
                      size="sm" 
                    />
                    <p className="text-slate text-sm mt-1.5 line-clamp-1 font-body">
                      {issue.location?.address || 'Unknown Location'}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <StatusBadge status={issue.status || 'Submitted'} size="sm" />
                      <span className="text-xs text-slate-muted font-display">
                        {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          
          {issues.length === 0 && (
            <div className="text-center py-12 text-slate-muted text-xs font-body">
              No civic issues recorded yet.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
