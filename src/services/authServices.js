const UserModel = require('../models/user.model')
const HTTP_STATUS = require('../constants/httpConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const logger = require('../logger/logger')
const { generateTokens } = require('../middlewares/jsonWebTokens')
const mongoose = require('mongoose')

const logInService = async (email, password, loginType) => {
  try {
    // Find user by email in the database
    const user = await UserModel.findOne({ email })

    // If user not found, throw an error
    appAssert(user, "User is not found", HTTP_STATUS.NOT_FOUND)

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await PasswordUtil.comparePassword(password, user.password)
    
    appAssert(isPasswordValid, "Password is incorrect, please try again", HTTP_STATUS.BAD_REQUEST)

    // Check if the login type matches the user's actual role
    appAssert(
      user.role === loginType,
      `You are not authorized to log in as ${loginType}`,
      HTTP_STATUS.BAD_REQUEST
    )

    const tokens = generateTokens(user)
    const { accessToken, refreshToken } = tokens

    logger.info(`${user.name} logged in as ${user.role}`)

    return { user, accessToken, refreshToken, message: 'Logged in successfully' }

  } catch (error) {
    throw error
  }
}

const changePasswordService = async (userId, currentPassword, newPassword, newPasswordConfirmation) => {
  try {
    appAssert(mongoose.Types.ObjectId.isValid(userId), 'Invalid user id', HTTP_STATUS.UNAUTHORIZED)

    appAssert(
      typeof(currentPassword) === 'string',
      typeof(newPassword) === 'string',
      typeof(newPasswordConfirmation) === 'string',
      'Invalid inputs, password should be a string',
      HTTP_STATUS.BAD_REQUEST
    )

    const user = await UserModel.findById(userId)

    const isPasswordValid = await PasswordUtil.comparePassword(currentPassword, user.password)

    appAssert(isPasswordValid, 'Incorrect password, please try again', HTTP_STATUS.BAD_REQUEST)

    appAssert(newPassword === newPasswordConfirmation,
      'New password does not match',
      HTTP_STATUS.BAD_REQUEST
    )

    const hashedPassword = await PasswordUtil.hashPassword(newPassword)

    user.password = hashedPassword

    await user.save()

    return { message: 'Password changed succesfully' }
  } catch (error) {
    throw error
  }
}

// Export the service function for use in controllers
module.exports = { 
  logInService,
  changePasswordService,
}
