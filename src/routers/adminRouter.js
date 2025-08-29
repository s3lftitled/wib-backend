const express = require('express')
const router = express.Router()
const AdminController = require('../controllers/adminController')

router.post('/v1/create-employee', AdminController.createEmployeeAccount)

module.exports = router