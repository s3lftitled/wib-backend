const express = require('express') 
const router = express.Router()
const AdminController = require('../controllers/adminController')

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management and operations
 */

/**
 * @swagger
 * /api/admin/v1/create-employee/{departmentId}:
 *   post:
 *     summary: Create a new employee under a department
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID where employee will be added
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Juan Dela Cruz
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               position:
 *                 type: string
 *                 example: Developer
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       400:
 *         description: Invalid input data or existing employee email
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
router.post('/v1/create-employee/:departmentId', AdminController.createEmployeeAccount)

/**
 * @swagger
 * /api/admin/v1/fetch-active-employees:
 *   get:
 *     summary: Fetch all active employees
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of active employees
 *       404:
 *         description: No active employees found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/fetch-active-employees', AdminController.fetchAllActiveEmployee)

/**
 * @swagger
 * /api/admin/v1/fetch-leave-requests:
 *   get:
 *     summary: Fetch all leave requests
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: List of leave requests
 *       400:
 *         description: Invalid pagination values
 *       404:
 *         description: No leave requests found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/fetch-leave-requests', AdminController.fetchAllRequestLeave)

/**
 * @swagger
 * /api/admin/v1/approve-leave-request/{leaveId}/{approvedBy}:
 *   put:
 *     summary: Approve a leave request
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: leaveId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: approvedBy
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leave approved successfully
 *       400:
 *         description: Leave already processed or insufficient balance
 *       404:
 *         description: Leave or employee not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/approve-leave-request/:leaveId/:approvedBy', AdminController.approveLeaveRequest)

/**
 * @swagger
 * /api/admin/v1/decline-leave-request/{leaveId}/{declinedBy}:
 *   put:
 *     summary: Decline a leave request
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: leaveId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: declinedBy
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leave declined successfully
 *       400:
 *         description: Leave already processed
 *       404:
 *         description: Leave request not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/decline-leave-request/:leaveId/:declinedBy', AdminController.declineLeaveRequest)

/**
 * @swagger
 * /api/admin/v1/create-new-department/{createdBy}:
 *   post:
 *     summary: Create a new department
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: createdBy
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin ID who created the department
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               departmentName:
 *                 type: string
 *                 example: Human Resources
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Invalid department name
 *       404:
 *         description: Creator user not found
 *       409:
 *         description: Department already exists
 *       500:
 *         description: Internal server error
 */
router.post('/v1/create-new-department/:createdBy', AdminController.createNewDepartment)

/**
 * @swagger
 * /api/admin/v1/fetch-departments:
 *   get:
 *     summary: Fetch all departments
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of departments
 *       404:
 *         description: No departments found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/fetch-departments', AdminController.fetchAllDepartments)

/**
 * @swagger
 * /api/admin/v1/add-holiday/{createdBy}:
 *   post:
 *     summary: Add a new holiday
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: createdBy
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2025-12-25
 *               description:
 *                 type: string
 *                 example: Christmas Day
 *     responses:
 *       201:
 *         description: Holiday added successfully
 *       400:
 *         description: Invalid holiday input
 *       409:
 *         description: Holiday already exists
 *       500:
 *         description: Internal server error
 */
router.post('/v1/add-holiday/:createdBy', AdminController.createHoliday)

/**
 * @swagger
 * /api/admin/v1/fetch-all-holidays:
 *   get:
 *     summary: Fetch all holidays
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of holidays
 *       404:
 *         description: No holidays found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/fetch-all-holidays', AdminController.fetchHolidays)

/**
 * @swagger
 * /api/admin/v1/add-schedule-slot/{adminUserId}:
 *   post:
 *     summary: Create a new schedule slot
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 example: 08:00
 *               endTime:
 *                 type: string
 *                 example: 17:00
 *     responses:
 *       201:
 *         description: Schedule slot created
 *       400:
 *         description: Invalid input or overlapping time
 *       403:
 *         description: Only admins can create schedule slots
 *       500:
 *         description: Internal server error
 */
router.post('/v1/add-schedule-slot/:adminUserId', AdminController.createScheduleSlot)

/**
 * @swagger
 * /api/admin/v1/delete/schedule-slot/{scheduleId}:
 *   delete:
 *     summary: Delete a schedule slot
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Internal server error
 */
router.delete('/v1/delete/schedule-slot/:scheduleId', AdminController.deleteScheduleSlot)

/**
 * @swagger
 * /api/admin/v1/assign-employee-schedule/{scheduleId}/{employeeId}:
 *   post:
 *     summary: Assign an employee to a schedule
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee successfully assigned
 *       400:
 *         description: Invalid schedule or employee ID
 *       404:
 *         description: Schedule or employee not found
 *       409:
 *         description: Employee already has a conflicting schedule
 *       500:
 *         description: Internal server error
 */
router.post('/v1/assign-employee-schedule/:scheduleId/:employeeId', AdminController.assignEmployeeToSchedule)

/**
 * @swagger
 * /api/admin/v1/change-assigned-employee/{scheduleId}/{employeeId}:
 *   put:
 *     summary: Change the employee assigned to a schedule
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assigned employee changed successfully
 *       400:
 *         description: Invalid input or same employee already assigned
 *       404:
 *         description: Schedule or employee not found
 *       409:
 *         description: Employee has a conflicting schedule
 *       500:
 *         description: Internal server error
 */
router.put('/v1/change-assigned-employee/:scheduleId/:employeeId', AdminController.changeAssignedEmployee)

/**
 * @swagger
 * /api/admin/v1/fetch-schedule-slots:
 *   get:
 *     summary: Fetch all schedule slots
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of schedule slots
 *       400:
 *         description: Invalid date filter
 *       404:
 *         description: No schedule slots found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/fetch-schedule-slots', AdminController.fetchScheduleSlots)

/**
 * @swagger
 * /api/admin/v1/generate-employee-monthly-report/{employeeId}:
 *   get:
 *     summary: Generate a monthly attendance report for a specific employee
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Monthly report generated successfully
 *       400:
 *         description: Invalid employee or date input
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/generate-employee-monthly-report/:employeeId', AdminController.generateEmployeeMonthlyReport)

module.exports = router
