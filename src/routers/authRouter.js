const express = require('express')          // Import Express framework
const router = express.Router()             // Create a new router instance
const AuthController = require('../controllers/authController') // Import the Auth controller

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and password management
 */

/**
 * @swagger
 * /api/auth/v1/sign-in:
 *   post:
 *     summary: Log in a user and return access and refresh tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - loginType
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@example.com
 *               password:
 *                 type: string
 *                 example: mySecretPassword123
 *               loginType:
 *                 type: string
 *                 example: admin
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                       example: Juan Dela Cruz
 *                     email:
 *                       type: string
 *                       example: juan@example.com
 *                     role:
 *                       type: string
 *                       example: admin
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 message:
 *                   type: string
 *                   example: Logged in successfully
 *       400:
 *         description: Invalid credentials or unauthorized login type
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/v1/sign-in', AuthController.logInController)

/**
 * @swagger
 * /api/auth/v1/change-password/{userId}:
 *   put:
 *     summary: Change the password for an existing user
 *     tags: [Authentication]
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
 *               - currentPassword
 *               - newPassword
 *               - newPasswordConfirmation
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 example: newPassword456
 *               newPasswordConfirmation:
 *                 type: string
 *                 example: newPassword456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         description: Invalid inputs or password mismatch
 *       401:
 *         description: Invalid user ID or unauthorized attempt
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/change-password/:userId', AuthController.changePassword)

// Export the router to use in the main app
module.exports = router
