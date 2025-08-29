const express = require('express')
const router = express.Router()
const AuthController = require('../controllers/authController')

router.post('/v1/sign-in', AuthController.logInController )

module.exports = router