// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants')
const logger = require('../logger/logger')
const { 
  logInService,
} = require('../services/authServices')

class AuthController {
  
  async logInController(req, res, next) {
    const {  email, password } = req.body
    try {

      const { user, message } = await logInService(email, password)
      
      return res.status(HTTP_STATUS.OK).json({ user, message })
    } catch (error) {
      logger.error(`Login error - ${error.message}`)
      next(error)
    }
  }
}

module.exports = new AuthController()