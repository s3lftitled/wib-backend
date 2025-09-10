const express = require('express')          // Import Express framework
const router = express.Router()             // Create a new router instance
const AuthController = require('../controllers/authController') // Import the Auth controller

// Define the login route
// POST request to /v1/sign-in will trigger the logInController method
router.post('/v1/sign-in', AuthController.logInController)
router.put('/v1/change-password/:userId', AuthController.changePassword)

// Export the router to use in the main app
module.exports = router
