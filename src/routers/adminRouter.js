const express = require('express')
const router = express.Router()
const AdminController = require('../controllers/adminController')

router.post('/v1/create-employee', AdminController.createEmployeeAccount)
router.get('/v1/fetch-active-employees', AdminController.fetchAllActiveEmployee)
router.get('/v1/fetch-leave-requests', AdminController.fetchAllRequestLeave)
router.put('/v1/approve-leave-request/:leaveId/:approvedBy', AdminController.approveLeaveRequest)
router.put('/v1/decline-leave-request/:leaveId/:declinedBy', AdminController.declineLeaveRequest)
router.post('/v1/create-new-department/:createdBy', AdminController.createNewDepartment)

module.exports = router