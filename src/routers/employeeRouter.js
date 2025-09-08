const express = require('express')                       // Import Express framework
const router = express.Router()                          // Create a new router instance
const EmployeeController = require('../controllers/employeeController') // Import Employee controller

router.get('/v1/get-employee-status', EmployeeController.getEmployeeeStatusController)
router.post('/v1/time-in', EmployeeController.employeeTimeActionController )
router.post('/v1/time-out', EmployeeController.employeeTimeOutController)
router.get('/v1/monthly-record', EmployeeController.getMonthlyAttendanceController)
router.post('/v1/submit-leave-request/:userId', EmployeeController.requestLeaveController)

// Export the router to use in the main app
module.exports = router
