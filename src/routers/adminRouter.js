const express = require('express')
const router = express.Router()
const AdminController = require('../controllers/adminController')

router.post('/v1/create-employee', AdminController.createEmployeeAccount)
router.get('/v1/fetch-active-employees', AdminController.fetchAllActiveEmployee)

module.exports = router