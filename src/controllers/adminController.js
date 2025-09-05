const HTTP_STATUS = require('../constants/httpConstants')
const logger = require('../logger/logger')
const { 
  createEmployeeAccountService,
  fetchAllActiveEmployeeService,
} = require('../services/adminServices')

class AdminController {
  async createEmployeeAccount (req, res, next) {
    const { email, name } = req.body
    try {
      const { newEmployee, message } = await createEmployeeAccountService(name, email)

      res.status(HTTP_STATUS.CREATED).json({ newEmployee, message })
    } catch (error) {
      logger.error(`Error creating an employee account - ${error.message}`)
      next(error)
    }
  }

  async fetchAllActiveEmployee (req, res, next) {
    try {
      const { employees, message } = await fetchAllActiveEmployeeService()

      res.status(HTTP_STATUS.OK).json({ employees, message })
    } catch (error) {
      logger.error(`Error fetching all active employees - ${error.message}`)
      next(error)
    }
  }
}

module.exports = new AdminController()