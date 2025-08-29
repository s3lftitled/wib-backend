const HTTP_STATUS = require('../constants/httpConstants')
const logger = require('../logger/logger')
const { 
  createEmployeeAccountService,
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
}

module.exports = new AdminController()