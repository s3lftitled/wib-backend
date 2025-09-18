const HTTP_STATUS = require('../constants/httpConstants')
const logger = require('../logger/logger')
const { 
  createEmployeeAccountService,
  fetchAllActiveEmployeeService,
  fetchAllRequestLeaveService,
  approveLeaveRequestService,
  declineLeaveRequestService,
  createNewDepartmentService,
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

  async fetchAllRequestLeave (req, res, next) {
    try {
      const { page, pageSize } = req.query

      const { leaves, pagination } = await fetchAllRequestLeaveService(page, pageSize)

      res.status(HTTP_STATUS.OK).json({ leaves, pagination })
    } catch (error) {
      logger.error(`Error fetching all leave requests - ${error.message}`)
      next(error)
    }
  }

  async approveLeaveRequest (req, res, next) {
    const { leaveId, approvedBy } = req.params
    const { leaveCategory } = req.body
    
    try {
      const { leaveRequest, message } = await approveLeaveRequestService(leaveId, approvedBy, leaveCategory)

      res.status(HTTP_STATUS.OK).json({ leaveRequest, message })
    } catch (error) {
      logger.error(`Error approving leave request - ${error.message}`)
      next(error)
    }
  }

  async declineLeaveRequest (req, res, next) {
    const { leaveId, declinedBy } = req.params
    const { reason } = req.body
    
    try {
      const { leaveRequest, message } = await declineLeaveRequestService(leaveId, declinedBy, reason)

      res.status(HTTP_STATUS.OK).json({ leaveRequest, message })
    } catch (error) {
      logger.error(`Error declining leave request - ${error.message}`)
      next(error)
    }
  }

  async createNewDepartment (req, res, next) {
    const { departmentName } = req.body
    const { createdBy } = req.params
    
    try {
      const { newDepartment, message } = await createNewDepartmentService(departmentName, createdBy)

      res.status(HTTP_STATUS.OK).json({ newDepartment, message })
    } catch (error) {
      logger.error(`Error creating new department - ${error.message}`)
      next(error)
    }
  }
}

module.exports = new AdminController()