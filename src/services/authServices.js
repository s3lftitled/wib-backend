const UserModel = require('../models/user.model')
const HTTP_STATUS = require('../constants/httpConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const logger = require('../logger/logger')
const { generateTokens } = require('../middlewares/jsonWebTokens')
const mongoose = require('mongoose')

// Service function to handle user login
const logInService = async (email, password) => {
  try {
    // Find user by email in the database
    const user = await UserModel.findOne({ email })

    // If user not found, throw an error
    appAssert(user, "User is not found", HTTP_STATUS.NOT_FOUND)

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await PasswordUtil.comparePassword(password, user.password)
    
    // If password is invalid, throw an error
    appAssert(isPasswordValid, "Password is incorrect, please try again", HTTP_STATUS.BAD_REQUEST)

    const tokens = generateTokens(user)
    const { accessToken, refreshToken } = tokens

    logger.info(`${user.name} logged in`)

    return { user, accessToken, refreshToken, message: 'Logged in succesfully' }
  } catch (error) {
    // Propagate the error to be handled by controller or middleware
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
