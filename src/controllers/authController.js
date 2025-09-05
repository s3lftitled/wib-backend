// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (e.g., 200, 400, 500)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
  logInService, // Service function that handles the login logic
} = require('../services/authServices')

class AuthController {
  
  // Controller method to handle login requests
  async logInController(req, res, next) {
    const {  email, password } = req.body
    try {

      const { user, message } = await logInService(email, password)
      
      return res.status(HTTP_STATUS.OK).json({ user, message })
    } catch (error) {
      // Log the error for debugging/monitoring
      logger.error(`Login error - ${error.message}`)
      
      // Pass the error to the next middleware (Express error handler)
      next(error)
    }
  }
}

// Export a single instance of AuthController to be used in routes
module.exports = new AuthController()
