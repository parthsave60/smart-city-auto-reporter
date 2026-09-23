/**
 * Google Maps Service - Integration Point
 * 
 * This file is a placeholder for Google Maps JavaScript API integration.
 * In production, this will handle:
 * - Interactive map display
 * - Custom marker placement
 * - Geocoding (address to coordinates)
 * - Reverse geocoding (coordinates to address)
 * - Geolocation (user's current position)
 * 
 * Required APIs:
 * - Google Maps JavaScript API
 * - Google Geocoding API
 * - Google Places API (optional, for address autocomplete)
 */

// Google Maps JavaScript API - Using new functional API (v2.0+)
// Documentation: https://github.com/googlemaps/js-api-loader
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';

// Configure API key for all library imports
setOptions({
  apiKey: MAPS_API_KEY,
  version: 'weekly'
})

/**
 * Initialize Google Map
 * @param {HTMLElement} element - DOM element to render map
 * @param {Object} options - Map configuration options
 * @returns {Promise<google.maps.Map>} - Google Maps instance
 */
export async function initializeMap(element, options = {}) {
  try {
    const { Map } = await importLibrary('maps')
    return new Map(element, {
      center: options.center || { lat: 40.7128, lng: -74.0060 },
      zoom: options.zoom || 13,
      styles: darkMapStyles,
      ...options
    })
  } catch (error) {
    console.error('[Google Maps] Failed to initialize map:', error)
    return null
  }
}

/**
 * Get user's current location from browser/device Geolocation API
 * SOURCE OF TRUTH: navigator.geolocation.getCurrentPosition
 * Strictly avoids IP-based fallbacks or hardcoded default locations.
 * @returns {Promise<{lat: number, lng: number, accuracy: number, timestamp: number, address: string}>}
 */
export async function getCurrentLocation() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser/device.');
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  };

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = position.timestamp || Date.now();

  // Log captured coordinates, accuracy, and timestamp for developer verification
  console.log('[Geolocation] SOURCE OF TRUTH captured from device:');
  console.log('  Latitude: ', latitude);
  console.log('  Longitude:', longitude);
  console.log('  Accuracy: ', `${Math.round(accuracy * 10) / 10} meters`);
  console.log('  Timestamp:', new Date(timestamp).toISOString());

  // Derive readable address from the actual coordinates via reverse geocoding
  const address = await reverseGeocode(latitude, longitude);

  return {
    lat: latitude,
    lng: longitude,
    accuracy: Math.round(accuracy * 10) / 10,
    timestamp,
    address,
  };
}

/**
 * Reverse geocode coordinates to a human-readable address.
 * Attempts Google Maps Geocoder first; gracefully falls back to OpenStreetMap Nominatim.
 * Never invents or hardcodes a city.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Formatted address
 */
export async function reverseGeocode(lat, lng) {
  // 1. Try Google Maps Geocoding if API key is configured
  if (MAPS_API_KEY) {
    try {
      const { Geocoder } = await importLibrary('geocoding');
      const geocoder = new Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results && response.results[0]?.formatted_address) {
        return response.results[0].formatted_address;
      }
    } catch (googleError) {
      console.warn('[Google Maps] Geocoder library error, trying Nominatim fallback:', googleError.message);
    }
  }

  // 2. Reverse geocode via OpenStreetMap Nominatim
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const parts = [
          data.address.road || data.address.suburb || data.address.neighbourhood || data.address.hamlet,
          data.address.city || data.address.town || data.address.village || data.address.county,
          data.address.state,
        ].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      if (data?.display_name) {
        return data.display_name.split(',').slice(0, 3).join(',').trim();
      }
    }
  } catch (osmError) {
    clearTimeout(timeoutId);
    console.warn('[Geolocation] Reverse geocode fallback notice:', osmError.message);
  }

  // 3. Exact coordinates representation if no reverse geocode service responds
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Add custom marker to map
 * @param {google.maps.Map} map - Map instance
 * @param {Object} position - Marker position
 * @param {Object} options - Marker options
 */
export async function addMarker(map, position, options = {}) {
  try {
    const { AdvancedMarkerElement } = await importLibrary('marker')
    return new AdvancedMarkerElement({
      map,
      position,
      ...options
    })
  } catch (error) {
    console.error('[Google Maps] Failed to add marker:', error)
    return null
  }
}

/**
 * Dark theme map styles for the app
 */
export const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a3e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f3460' }],
  },
]

export default {
  initializeMap,
  getCurrentLocation,
  reverseGeocode,
  addMarker,
  darkMapStyles,
}
