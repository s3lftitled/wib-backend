const express = require('express')                       // Import Express framework
const router = express.Router()                          // Create a new router instance
const EmployeeController = require('../controllers/employeeController') // Import Employee controller

// Define the time-in route
// POST request to /v1/time-in will trigger the employeeTimeIn method
router.post('/v1/time-in', EmployeeController.employeeTimeIn)
router.post('/v1/time-out', EmployeeController.employeeTimeOut)

// Export the router to use in the main app
module.exports = router
