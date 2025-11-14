const express = require('express')                       
const router = express.Router()                          
const EmployeeController = require('../controllers/employeeController') 

/**
 * @swagger
 * tags:
 *   name: Employee
 *   description: Endpoints for employee attendance, leave requests, and account activation
 */

/**
 * @swagger
 * /api/employee/v1/get-employee-status:
 *   get:
 *     summary: Get the current attendance status of an employee
 *     tags: [Employee]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: juan@example.com
 *     responses:
 *       200:
 *         description: Employee status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 status: working
 *                 buttonText: "Break"
 *                 action: "go_on_break"
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/get-employee-status', EmployeeController.getEmployeeeStatusController)

/**
 * @swagger
 * /api/employee/v1/time-in:
 *   post:
 *     summary: Time in for work or return from break
 *     tags: [Employee]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               password:
 *                 type: string
 *                 example: myPassword123
 *               skipBreak:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Time-in recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 action: "time_in"
 *                 message: "Started work day successfully"
 *                 nextAction: "go_on_break"
 *       400:
 *         description: Invalid credentials or bad request
 *       404:
 *         description: Employee or schedule not found
 *       409:
 *         description: Break already used or conflict in action
 *       500:
 *         description: Internal server error
 */
router.post('/v1/time-in', EmployeeController.employeeTimeActionController)

/**
 * @swagger
 * /api/employee/v1/time-out:
 *   post:
 *     summary: Log out or finish the work day
 *     tags: [Employee]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               password:
 *                 type: string
 *                 example: myPassword123
 *     responses:
 *       200:
 *         description: Time-out recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: "Work day completed successfully"
 *                 totalHours: 8.5
 *                 breakTime: 1
 *       400:
 *         description: Invalid credentials or already timed out
 *       404:
 *         description: Employee or attendance not found
 *       500:
 *         description: Internal server error
 */
router.post('/v1/time-out', EmployeeController.employeeTimeOutController)

/**
 * @swagger
 * /api/employee/v1/monthly-record:
 *   get:
 *     summary: Retrieve an employee's monthly attendance record
 *     tags: [Employee]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           example: juan@example.com
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2025
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Monthly record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 success: true
 *                 month: 10
 *                 year: 2025
 *                 data:
 *                   "2025-10-02":
 *                     timeIn: "2025-10-02T08:00:00Z"
 *                     timeOut: "2025-10-02T17:00:00Z"
 *                     breakTime: 1
 *                     totalHours: 8
 *                     status: "completed"
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User or employee not found
 *       500:
 *         description: Internal server error
 */
router.get('/v1/monthly-record', EmployeeController.getMonthlyAttendanceController)

/**
 * @swagger
 * /api/employee/v1/submit-leave-request/{userId}:
 *   post:
 *     summary: Submit a leave request
 *     tags: [Employee]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: 654a1df47e88bfeef3a9c6e1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - startDate
 *               - endDate
 *               - leaveCategory
 *             properties:
 *               reason:
 *                 type: string
 *                 example: I have a medical appointment and need to rest for recovery.
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-11-10
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-11-11
 *               leaveCategory:
 *                 type: string
 *                 example: Sick Leave
 *     responses:
 *       200:
 *         description: Leave request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: "Successfully submitted the leave request"
 *                 numberOfDays: 2
 *       400:
 *         description: Invalid input or dates
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/v1/submit-leave-request/:userId', EmployeeController.requestLeaveController)

/**
 * @swagger
 * /api/employee/v1/activate-account:
 *   put:
 *     summary: Activate a user's account using email and activation token
 *     tags: [Employee]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - newPassword
 *               - newPasswordConfirmation
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               token:
 *                 type: string
 *                 example: "2f89b3abce8f"
 *               newPassword:
 *                 type: string
 *                 example: newPassword123
 *               newPasswordConfirmation:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: "Account activated successfully. You can now login with your new password."
 *       400:
 *         description: Invalid email, token, or password
 *       401:
 *         description: Unauthorized request
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/activate-account', EmployeeController.activateAccount)

router.post('/v1/submit-reason', EmployeeController.submitOvertimeReason)

// Export router
module.exports = router
