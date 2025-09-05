const express = require('express')                       // Import Express framework
const router = express.Router()                          // Create a new router instance
const EmployeeController = require('../controllers/employeeController') // Import Employee controller

<<<<<<< HEAD
// Define the time-in route
// POST request to /v1/time-in will trigger the employeeTimeIn method
router.post('/v1/time-in', EmployeeController.employeeTimeIn)
=======
router.get('/v1/get-employee-status', EmployeeController.getEmployeeeStatusController)
router.post('/v1/time-in', EmployeeController.employeeTimeActionController )
router.post('/v1/time-out', EmployeeController.employeeTimeOutController)
router.get('/v1/monthly-record', EmployeeController.getMonthlyAttendanceController)
>>>>>>> 0006688 (feat(routes): expand employee routes for attendance management)

// Export the router to use in the main app
module.exports = router
