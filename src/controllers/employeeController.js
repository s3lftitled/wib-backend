// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (200, 500, etc.)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
  employeeTimeIn, // Service function that handles employee time-in logic
  employeeTimeOut, // Service function that handles employee time-out logic
} = require('../services/employeeServices')

class EmployeeController {
  // Controller method to handle employee time-in requests
  async employeeTimeIn(req, res, next) {
    // Extract employee credentials from the request body
    const { email, password } = req.body

    try {
      // Call the employeeTimeIn service with the provided credentials
      // Service returns employee details and a message if successful
      const { employee, message } = await employeeTimeIn(email, password)

      // Send a success response with HTTP 200 status
      return res.status(HTTP_STATUS.OK).json({ employee, message })
    } catch (error) {
      // Log the error for debugging
      logger.error(error)

      // Send an error response with the appropriate status code
      next(error)
    }
  }
  async employeeTimeOut(req, res, next) {
    const { email, password } = req.body

    try {
      const { employee, message } = await employeeTimeOut(email, password)
      return res.status(HTTP_STATUS.OK).json({ employee, message })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }
}

// Export a single instance of EmployeeController to be used in routes
module.exports = new EmployeeController()
