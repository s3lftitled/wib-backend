const express = require('express')
const router = express.Router()
const EmployeeController = require('../controllers/employeeController')

router.post('/v1/time-in', EmployeeController.employeeTimeIn )

module.exports = router