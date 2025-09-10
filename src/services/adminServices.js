const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const LeaveModel = require('../models/leave.model')
const HTTP_STATUS = require('../constants/httpConstants')
const ROLE_CONSTANTS = require('../constants/roleConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const EmailUtil = require('../utils/emailUtils')
const validator = require('validator')
const logger = require('../logger/logger')

const createEmployeeAccountService = async (name, email) => {
  try {
   
    appAssert(typeof name === "string", 'Invalid name, please try again', HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isEmail(email), 'Invalid email, please try again', HTTP_STATUS.BAD_REQUEST)

    const existingEmployee = await UserModel.findOne({ email })
    appAssert(!existingEmployee, 'Employee email already exists', HTTP_STATUS.BAD_REQUEST)

    const hashedPassword = await PasswordUtil.createTempPassword()

    const newUser = await UserModel.create({
      email,
      name,
      password: hashedPassword,
      role: ROLE_CONSTANTS[101]
    })

    await newUser.save()

    const newEmployee = await EmployeeModel.create({
      userId: newUser._id,
    })

    await newEmployee.save()
  
    await EmailUtil.sendPasswordSetupEmail(email)

    logger.info(`New employee created ${email}`)

    return { newEmployee, message: 'New employee successfully created!'}
  } catch (error) {
    throw error
  }
}

const fetchAllActiveEmployeeService = async () => {
  try {
    const allEmployees = await EmployeeModel.find()
    .populate( "userId", "name email displayImage isActive")
    
    const employees = allEmployees.map(emp => ({
        name: emp.userId.name,
        email: emp.userId.email,
        displayImage: emp.userId.displayImage,
        isActive: emp.userId.isActive,
      }))

    appAssert(employees.length > 0, 'No active employees found', HTTP_STATUS.NOT_FOUND)

    return { employees, message: 'Succesfully fetched all employees'}
  } catch (error) {
    throw error
  }
}

// Fetch request leaves service
const fetchAllRequestLeaveService = async (page = 1, pageSize = 10) => {
  try {
    // Validate that page and pageSize are positive integers
    appAssert(!page <= 0 || !pageSize <= 0, 'Page and pageSize must be positive integers.', HTTP_STATUS.BAD_REQUEST) 

    // Calculate the skip value (number of records to skip)
    const skip = (page - 1) * pageSize

    // Fetch the paginated leave requests
    const allLeaveRequest = await LeaveModel.find()
      .skip(skip)           // Skip the appropriate number of records
      .limit(pageSize);    // Limit the results to the pageSize

    // Count the total number of leave requests for pagination metadata
    const totalRequests = await LeaveModel.countDocuments()

    // Calculate total pages
    const totalPages = Math.ceil(totalRequests / pageSize)

    // Check if any leave requests are found
    appAssert(allLeaveRequest.length > 0, 'No request leave found', HTTP_STATUS.NOT_FOUND)

    // Return paginated data along with metadata
    return {
      data: allLeaveRequest,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalPages: totalPages,
        totalRequests: totalRequests
      }
    }

  } catch (error) {
    throw error
  }
}


module.exports = {
  createEmployeeAccountService,
  fetchAllActiveEmployeeService,
  fetchAllRequestLeaveService,
}