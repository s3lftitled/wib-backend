const express = require('express')
const router = express.Router()
const TokenController = require('../controllers/tokenController')

/**
 * @swagger
 * tags:
 *   name: Token
 *   description: Token management and authentication refresh endpoints
 */

/**
 * @swagger
 * /api/token/refresh:
 *   post:
 *     summary: Refresh the user's access token using a valid refresh token
 *     tags: [Token]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The JWT refresh token previously issued to the user
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Successfully generated a new access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 newAccessToken:
 *                   type: string
 *                   description: A newly generated access token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   description: User details excluding sensitive information
 *                   example:
 *                     _id: 654a1df47e88bfeef3a9c6e1
 *                     name: "Juan Dela Cruz"
 *                     email: "juan@domain.com"
 *                     role: "employee"
 *       400:
 *         description: Missing or invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               example:
 *                 message: "Missing refresh token"
 *       401:
 *         description: Expired or invalid token signature
 *         content:
 *           application/json:
 *             schema:
 *               example:
 *                 message: "Invalid or expired refresh token"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               example:
 *                 message: "User not found"
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', TokenController.refreshAccessToken)

module.exports = router
