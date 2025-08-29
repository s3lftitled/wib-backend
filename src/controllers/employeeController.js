// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (200, 500, etc.)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
  employeeTimeIn, // Service function that handles employee time-in logic
} = require('../services/employeeServices')

class EmployeeController {
  // Controller method to handle employee time-in requests
  async employeeTimeIn(req, res) {
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
      return res
        .status(error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: error.message })
    }
  }
}

// Export a single instance of EmployeeController to be used in routes
module.exports = new EmployeeController()
