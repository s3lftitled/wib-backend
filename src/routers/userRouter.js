const express = require('express')                       // Import Express framework
const router = express.Router()     
const UserController = require('../controllers/userController')

router.put('/v1/change-name/:userId', UserController.changeName)
router.put('/v1/change-display-image/:userId', UserController.uploadDisplayImage)

module.exports = router