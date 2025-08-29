  // Import constants and logger
  const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (e.g., 500 for server error)
  const logger = require('../logger/logger') // Logger utility for logging errors

  // Express error-handling middleware
  const errorHandler = (err, req, res, next) => { 
    // Determine the HTTP status code (fallback to 500 if not provided)
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR

    // Use the error's message or a generic fallback
    const message = err.message || 'Something went wrong!'

    // Log the error details (custom logger that may include request info)
    logger.logError(err, req)

    // Send a structured error response
    res.status(statusCode).json({ 
      success: false,          // Indicates failure
      message,                 // Error message
      errors: err.errors || null // Additional validation/field errors if available
    })
  }

  // Export the middleware to be used in app.js / server.js
  module.exports = errorHandler
