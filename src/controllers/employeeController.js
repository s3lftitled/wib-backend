// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (200, 500, etc.)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
<<<<<<< HEAD
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
=======
  getEmployeeStatusService,
  employeeTimeActionService,
  employeeTimeOutService,
  getMonthlyAttendanceService,
} = require('../services/employeeServices')

class EmployeeController {
  
  async getEmployeeeStatusController(req, res, next) {
    const { email } = req.body

    try {
      const data = await getEmployeeStatusService(email)
      return res.status(HTTP_STATUS.OK).json({ data })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  async employeeTimeActionController(req, res, next) {
    const { email, password } = req.body

    try {
      const { action, nextAction, nextButton, message, timeIn } = await employeeTimeActionService(email, password)
      return res.status(HTTP_STATUS.OK).json({ action, nextAction, nextButton, message, timeIn })
>>>>>>> 727bd4f (feat(employee-controller): add endpoints for attendance management)
    } catch (error) {
      // Log the error for debugging
      logger.error(error)
<<<<<<< HEAD

      // Send an error response with the appropriate status code
      return res
        .status(error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ message: error.message })
=======
      next(error)
    }
  }

  async employeeTimeOutController(req, res, next) {
    const { email, password } = req.body

    try {
      const data = await employeeTimeOutService(email, password)
      return res.status(HTTP_STATUS.OK).json({ data })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  async getMonthlyAttendanceController(req, res, next) {
    try {
      const { year, month, email } = req.query

      // Validate required parameters
      if (!year || month === undefined) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Year and month are required'
        })
      }

      const yearInt = parseInt(year)
      const monthInt = parseInt(month) // 0-11 (JS month format)

      if (yearInt < 1900 || yearInt > 2100) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid year'
        })
      }

      if (monthInt < 0 || monthInt > 11) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid month (0-11)'
        })
      }

      const result = await getMonthlyAttendanceService(email, yearInt, monthInt)

      res.status(HTTP_STATUS.OK).json(result)

    } catch (error) {
      logger.error('Get monthly attendance error:', error)
      next(error)
>>>>>>> 727bd4f (feat(employee-controller): add endpoints for attendance management)
    }
  }
}

// Export a single instance of EmployeeController to be used in routes
module.exports = new EmployeeController()

