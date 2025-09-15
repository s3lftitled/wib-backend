// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (e.g., 200, 400, 500)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
  logInService, // Service function that handles the login logic
  changePasswordService,
} = require('../services/authServices')

class AuthController {
  
  // Controller method to handle login requests
  async logInController(req, res, next) {
    const {  email, password, logInType } = req.body
    try {

      const { user, accessToken, refreshToken,  message } = await logInService(email, password, logInType)

        // Set cookies
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
      })
      
      return res.status(HTTP_STATUS.OK).json({ user, accessToken, message })
    } catch (error) {
      // Log the error for debugging/monitoring
      logger.error(`Login error - ${error.message}`)
      
      // Pass the error to the next middleware (Express error handler)
      next(error)
    }
  }

  async changePassword(req, res, next) {
    try {
      const { userId } = req.params
      const { currentPassword, newPassword, newPasswordConfirmation } = req.body

      const message = await changePasswordService(userId, currentPassword, newPassword, newPasswordConfirmation)

      return res.status(HTTP_STATUS.OK).json(message)
    } catch (error) {
      logger.error(`Error changing password - ${error.message}`)
      next(error)
    }
  }
}

// Export a single instance of AuthController to be used in routes
module.exports = new AuthController()
