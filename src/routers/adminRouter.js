const express = require('express')
const router = express.Router()
const AdminController = require('../controllers/adminController')

router.post('/v1/create-employee', AdminController.createEmployeeAccount)
router.get('/v1/fetch-active-employees', AdminController.fetchAllActiveEmployee)
router.get('/v1/fetch-leave-requests', AdminController.fetchAllRequestLeave)

module.exports = router