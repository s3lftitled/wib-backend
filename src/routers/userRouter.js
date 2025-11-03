const express = require('express')
const router = express.Router()
const UserController = require('../controllers/userController')

/**
 * @swagger
 * tags:
 *   name: User
 *   description: Endpoints for managing user profile information
 */

/**
 * @swagger
 * /api/user/v1/change-name/{userId}:
 *   put:
 *     summary: Change the user's display name
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: 654a1df47e88bfeef3a9c6e1
 *         description: The ID of the user whose name will be changed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newName
 *             properties:
 *               newName:
 *                 type: string
 *                 example: Juan Dela Cruz
 *     responses:
 *       200:
 *         description: User name changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: "Name changed successfully"
 *       400:
 *         description: Invalid user ID format or name
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/change-name/:userId', UserController.changeName)

/**
 * @swagger
 * /api/user/v1/change-display-image/{userId}:
 *   put:
 *     summary: Upload or change the user's display image
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: 654a1df47e88bfeef3a9c6e1
 *         description: The ID of the user whose display image will be changed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base64Image
 *             properties:
 *               base64Image:
 *                 type: string
 *                 description: Base64 encoded image string (JPEG, JPG, PNG)
 *                 example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..."
 *     responses:
 *       200:
 *         description: Display image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 message: "Display picture uploaded successfully"
 *       400:
 *         description: Invalid input or unsupported image format
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/v1/change-display-image/:userId', UserController.uploadDisplayImage)

module.exports = router
