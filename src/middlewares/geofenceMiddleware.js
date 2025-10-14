const axios = require('axios')
const geolib = require('geolib')

// Define the geofence center and radius (in meters)
const geofenceCenter = {
  latitude: 16.41930528979611,  // Latitude of the center (your location)
  longitude: 120.59050429611695 // Longitude of the center (your location)
}
const geofenceRadius = 5000 // 5 km radius for the geofence

// Function to get geolocation by IP
const getGeolocationByIp = async (ip) => {
  try {
    // Handle localhost/development cases
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || !ip || ip === 'unknown') {
      console.log('Development/localhost detected, using default location for testing')
      // Return a test location within geofence for development
      return { 
        latitude: geofenceCenter.latitude, 
        longitude: geofenceCenter.longitude 
      }
    }

    // Call ipstack API - note the correct property names
    const response = await axios.get(`https://api.ipstack.com/51.52.102.0?access_key=af46c10199f27040ae932e1384b804a3`)
    
    // Check if the API call was successful
    if (!response.data.success && response.data.success !== undefined) {
      console.error('ipstack API error:', response.data.error)
      throw new Error(`API Error: ${response.data.error?.info || 'Unknown error'}`)
    }

    const { latitude, longitude } = response.data
    
    if (!latitude || !longitude) {
      throw new Error('Invalid coordinates received from API')
    }

    return { 
      latitude: parseFloat(latitude), 
      longitude: parseFloat(longitude) 
    }
  } catch (error) {
    console.error('Error fetching geolocation:', error.message)
    
    // If it's an API quota/auth error, you might want to handle differently
    if (error.response?.status === 401) {
      throw new Error('API authentication failed - check your API key')
    }
    if (error.response?.status === 403) {
      throw new Error('API quota exceeded or access forbidden')
    }
    
    throw new Error('Unable to fetch geolocation')
  }
}

// Alternative function using a free service (ipapi.co) as fallback
const getGeolocationByIpFallback = async (ip) => {
  try {
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || !ip || ip === 'unknown') {
      return { 
        latitude: geofenceCenter.latitude, 
        longitude: geofenceCenter.longitude 
      }
    }

    const response = await axios.get(`https://ipapi.co/${ip}/json/`)
    const { latitude, longitude } = response.data
    
    if (!latitude || !longitude) {
      throw new Error('Invalid coordinates received from fallback API')
    }

    return { 
      latitude: parseFloat(latitude), 
      longitude: parseFloat(longitude) 
    }
  } catch (error) {
    console.error('Fallback geolocation service also failed:', error.message)
    throw new Error('All geolocation services failed')
  }
}

// Helper function to get real client IP
const getRealClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown'
}

// Geofencing Middleware
const geofenceMiddleware = async (req, res, next) => {
  try {
    // Get the client's IP address with better detection
    const clientIp = getRealClientIp(req)
    console.log(`Client IP detected: ${clientIp}`)

    // Get the geolocation of the client
    let clientLocation
    try {
      clientLocation = await getGeolocationByIp(clientIp)
    } catch (error) {
      console.log('Primary geolocation service failed, trying fallback...')
      try {
        clientLocation = await getGeolocationByIpFallback(clientIp)
      } catch (fallbackError) {
        console.error('All geolocation services failed:', fallbackError.message)
        return res.status(500).json({ 
          message: 'Could not determine location. Please try again later.',
          error: process.env.NODE_ENV === 'development' ? fallbackError.message : undefined
        })
      }
    }

    const { latitude, longitude } = clientLocation
    console.log(`Client location: ${latitude}, ${longitude}`)

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ message: 'Invalid location data received' })
    }

    // Calculate the distance from the geofence center
    const distance = geolib.getDistance(
      { latitude: geofenceCenter.latitude, longitude: geofenceCenter.longitude },
      { latitude, longitude }
    )

    console.log(`Distance from geofence center: ${distance} meters (limit: ${geofenceRadius} meters)`)

    // Check if the distance is within the geofence radius
    if (distance <= geofenceRadius) {
      console.log('Client is within geofenced area')
      return next()  // Request is within the geofenced area, proceed to the next middleware
    } else {
      console.log('Client is outside geofenced area')
      return res.status(403).json({ 
        message: 'Access restricted to certain geographical areas only',
        distance: `${(distance / 1000).toFixed(2)} km from allowed area`
      })
    }
  } catch (error) {
    console.error('Geofencing middleware error:', error)
    return res.status(500).json({ 
      message: 'Internal server error during location verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

module.exports = geofenceMiddleware