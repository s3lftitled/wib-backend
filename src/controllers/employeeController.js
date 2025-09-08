// Import constants, logger, and services
const HTTP_STATUS = require('../constants/httpConstants') // Centralized HTTP status codes (200, 500, etc.)
const logger = require('../logger/logger') // Logger utility for error/info logging
const { 
  getEmployeeStatusService,
  employeeTimeActionService,
  employeeTimeOutService,
  getMonthlyAttendanceService,
  requestLeaveService,
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
    } catch (error) {
      // Log the error for debugging
      logger.error(error)
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

      if (!year || month === undefined) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Year and month are required'
        })
      }

      const yearInt = parseInt(year)
      const monthInt = parseInt(month)

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
    }
  }

  async requestLeaveController (req, res, next) {
    const { userId } = req.params
    const { reason, startDate, endDate } = req.body
    try {
      const { newLeaveRequest, message } = await requestLeaveService(userId, reason, startDate, endDate)

      res.status(HTTP_STATUS.OK).json({ message })
    } catch (error) {
      logger.error('Error submitting the leave request:', error)
      next(error)
    }
  }
}

// Export a single instance of EmployeeController to be used in routes
module.exports = new EmployeeController()

