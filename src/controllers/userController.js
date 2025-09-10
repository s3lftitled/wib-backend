// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (200, 500, etc.)
const logger = require('../logger/logger') // Logger utility for error/info logging
const {
  changeNameService,
  uploadDisplayImageService, 
} = require('../services/userServices')

class UserController {
  async changeName (req, res, next) {
    try {
      const { userId } = req.params
      const { newName } = req.body

      const message = await changeNameService(userId, newName)

      return res.status(HTTP_STATUS.OK).json(message)
    } catch (error) {
      logger.error(`Error uploading image ${error.message}`)
      next(error)
    }
  }

  async uploadDisplayImage (req, res, next) {
    try {
      const { userId } = req.params
      const { base64Image } = req.body

      const message = await uploadDisplayImageService(userId, base64Image)

      return res.status(HTTP_STATUS.OK).json(message)
    } catch (error) {
      logger.error(`Error uploading image ${error.message}`)
      next(error)
    }
  }
}

module.exports = new UserController()