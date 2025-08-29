const HTTP_STATUS = require('../constants/httpConstants')
const logger = require('../logger/logger')
const { 
  employeeTimeIn
} = require('../services/employeeServices')

class EmployeeController {
  async employeeTimeIn(req, res) {
    const { email, password } = req.body

    try {
      const { employee, message } = await employeeTimeIn(email, password)
      return res.status(HTTP_STATUS.OK).json({ employee, message })
    } catch (error) {
      logger.error(error)
      return res.status(error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: error.message })
    }
  }
}

module.exports = new EmployeeController()
