const UserModel = require('../models/user.model')
const { appAssert } = require('../utils/appAssert')
const HTTP_STATUS = require('../constants/httpConstants')
const jwt = require('jsonwebtoken')
const logger = require('../logger/logger')
require('dotenv').config()

const refreshAccessToken = async (refreshToken) => {
  try {
    console.log('refresh token request received')
    
    if (!refreshToken) {
      logger.error("Missing refresh token")
      throw new Error("Missing refresh token")
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
    const userId = decoded.id

    // Fetch user and exclude sensitive fields like password
    const user = await UserModel.findById(userId).select("-password")
    
    appAssert(user, 'User not found', HTTP_STATUS.NOT_FOUND)

    // Generate new short-lived access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )

    // Return both token and user
    return { newAccessToken, user }
  } catch (error) {
    logger.error(error.message)
    throw new Error(error.message)
  }
}

module.exports = {
  refreshAccessToken,
}