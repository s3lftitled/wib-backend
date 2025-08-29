const UserModel = require('../models/user.model')
const HTTP_STATUS = require('../constants/httpConstants')
const ROLE_CONSTANTS = require('../constants/roleConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const EmailUtil = require('../utils/emailUtils')
const validator = require('validator')
const logger = require('../logger/logger')

const createEmployeeAccountService = async (name, email) => {
  try {
    console.log(email)
    appAssert(typeof name === "string", 'Invalid name, please try again', HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isEmail(email), 'Invalid email, please try again', HTTP_STATUS.BAD_REQUEST)

    const existingEmployee = await UserModel.findOne({ email })
    appAssert(!existingEmployee, 'Employee email already exists', HTTP_STATUS.BAD_REQUEST)

    const hashedPassword = await PasswordUtil.createTempPassword()

    const newEmployee = await UserModel.create({
      email,
      name,
      password: hashedPassword,
      role: ROLE_CONSTANTS[101]
    })

    await newEmployee.save()
  
    await EmailUtil.sendPasswordSetupEmail(email)

    logger.info(`New employee created ${email}`)

    return { newEmployee, message: 'New employee successfully created!'}
  } catch (error) {
    throw error
  }
}

module.exports = {
  createEmployeeAccountService,
}