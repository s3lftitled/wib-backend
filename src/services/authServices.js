const UserModel = require('../models/user.model')
const HTTP_STATUS = require('../constants/httpConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')

const logInService = async (email, password) => {
  try {

    const user = await UserModel.findOne({ email })

    if (!user) {
      appAssert(user, "User is not found", HTTP_STATUS.NOT_FOUND)
    }

    const isPasswordValid = PasswordUtil.comparePassword(password, user.password)
    
    if (!isPasswordValid) {
      appAssert(isPasswordValid, "Password is incorrect, please try again", HTTP_STATUS.BAD_REQUEST)
    }

    return { user, message: 'Logged in succesfully' }
  } catch (error) {
    throw error
  }
}

module.exports = { 
  logInService,
}