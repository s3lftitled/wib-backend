const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const LeaveModel = require('../models/leave.model')
const DepartmentModel = require('../models/department.model')
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
// Fetch request leaves service
const fetchAllRequestLeaveService = async (page, pageSize) => {
  try {
    // Validate that page and pageSize are positive integers
    appAssert(page > 0 && pageSize > 0, 'Page and pageSize must be positive integers.', HTTP_STATUS.BAD_REQUEST)

    // Calculate the skip value (number of records to skip)
    const skip = (page - 1) * pageSize

    // Fetch the paginated leave requests, including employee name & email
    const allLeaveRequests = await LeaveModel.find()
      .populate("employee", "name email") // ✅ only get employee name & email
      .skip(skip)
      .limit(pageSize)

    // Count the total number of leave requests for pagination metadata
    const totalRequests = await LeaveModel.countDocuments()

    // Calculate total pages
    const totalPages = Math.ceil(totalRequests / pageSize)

    // Check if any leave requests are found
    appAssert(allLeaveRequests.length > 0, 'No request leave found', HTTP_STATUS.NOT_FOUND)

    // Format response
    const formattedLeaves = allLeaveRequests.map(leave => ({
      id: leave._id,
      employeeName: leave.employee?.name || "Unknown",
      employeeEmail: leave.employee?.email || "Unknown",
      reason: leave.reason,
      startDate: leave.startDate,
      endDate: leave.endDate,
      numberOfDays: leave.numberOfDays,
      leaveType: leave.leaveType,
      leaveCategory: leave.leaveCategory,
      status: leave.status,
      approvedBy: leave.approvedBy,
      declinedBy: leave.declinedBy,
      declineReason: leave.declineReason,
      daysApproved: leave.daysApproved,
      createdAt: leave.createdAt
    }))

    // Return paginated data along with metadata
    return {
      leaves: formattedLeaves,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages,
        totalRequests
      },
      message: "Successfully fetched leave requests"
    }

  } catch (error) {
    throw error
  }
}


const approveLeaveRequestService = async (leaveId, approvedBy, leaveCategory) => {
  try {
    // Find leave request
    const leaveRequest = await LeaveModel.findById(leaveId).populate("employee")
    appAssert(leaveRequest, "Leave request not found", HTTP_STATUS.NOT_FOUND)

    // Ensure it's pending
    appAssert(leaveRequest.status === "PENDING", "Leave request already processed", HTTP_STATUS.BAD_REQUEST)

    // Find the user
    const user = await UserModel.findById(leaveRequest.employee)
    appAssert(user, "User not found", HTTP_STATUS.NOT_FOUND)

    // Calculate total days
    const start = new Date(leaveRequest.startDate)
    const end = new Date(leaveRequest.endDate)
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1

    // Ensure leave balance exists
    appAssert(user.leaveBalance && user.leaveBalance[leaveCategory], "Invalid leave category", HTTP_STATUS.BAD_REQUEST)

    const leaveData = user.leaveBalance[leaveCategory]

    // Ensure enough remaining
    appAssert(leaveData.remaining >= days, "Not enough leave balance", HTTP_STATUS.BAD_REQUEST)

    // Update balances
    leaveData.availments += days
    leaveData.remaining -= days
    leaveData.active += days

    // Save changes
    await user.save()

    // Update leave request status
    leaveRequest.status = "APPROVED"
    leaveRequest.approvedBy = approvedBy
    leaveRequest.daysApproved = days
    await leaveRequest.save()

    logger.info(`Leave request ${leaveId} approved for ${user.name}`)

    return { leaveRequest, message: "Leave request approved successfully" }
  } catch (error) {
    throw error
  }
}

const declineLeaveRequestService = async (leaveId, declinedBy, reason) => {
  try {
    const leaveRequest = await LeaveModel.findById(leaveId).populate("employee")
    appAssert(leaveRequest, "Leave request not found", HTTP_STATUS.NOT_FOUND)

    appAssert(leaveRequest.status === "PENDING", "Leave request already processed", HTTP_STATUS.BAD_REQUEST)

    leaveRequest.status = "DECLINED"
    leaveRequest.declinedBy = declinedBy
    leaveRequest.declineReason = reason
    await leaveRequest.save()

    logger.info(`Leave request ${leaveId} declined for ${leaveRequest.employee.name}`)

    return { leaveRequest, message: "Leave request declined successfully" }
  } catch (error) {
    throw error
  }
}

const createNewDepartmentService = async (departmentName, createdBy) => {
  try {
    // Input validation
    appAssert(typeof departmentName === "string", 'Invalid department name, please try again', HTTP_STATUS.BAD_REQUEST)
    appAssert(departmentName.trim().length > 0, 'Department name cannot be empty', HTTP_STATUS.BAD_REQUEST)
    appAssert(departmentName.trim().length <= 100, 'Department name must be 100 characters or less', HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof createdBy === "string", 'Invalid createdBy parameter', HTTP_STATUS.BAD_REQUEST)

    // Sanitize department name - remove extra spaces and convert to proper case
    const sanitizedName = departmentName.trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()) // Convert to Title Case

    // Validate department name format (only letters, numbers, spaces, and basic punctuation)
    const nameRegex = /^[a-zA-Z0-9\s&\-().,]+$/
    appAssert(nameRegex.test(sanitizedName), 'Department name contains invalid characters', HTTP_STATUS.BAD_REQUEST)

    // Check if department already exists (case-insensitive)
    const existingDepartment = await DepartmentModel.findOne({ 
      name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') }
    })
    appAssert(!existingDepartment, 'Department already exists', HTTP_STATUS.CONFLICT)

    // Verify that the createdBy user exists and has appropriate permissions
    const creator = await UserModel.findById(createdBy)
    appAssert(creator, 'Creator user not found', HTTP_STATUS.NOT_FOUND)
    appAssert(creator.isActive, 'Creator account is not active', HTTP_STATUS.FORBIDDEN)

    // Create new department
    const newDepartment = await DepartmentModel.create({
      name: sanitizedName,
      createdBy: creator.email,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await newDepartment.save()

    // Populate creator information for response
    await newDepartment.populate('createdBy', 'name email')

    logger.info(`New department created: ${sanitizedName} by ${creator.name} (${creator.email})`)

    return { 
      department: {
        id: newDepartment._id,
        name: newDepartment.name,
        isActive: newDepartment.isActive,
        createdAt: newDepartment.createdAt
      },
      message: 'Department created successfully!'
    }

  } catch (error) {
    throw error
  }
}

module.exports = {
  createEmployeeAccountService,
  fetchAllActiveEmployeeService,
  fetchAllRequestLeaveService,
  approveLeaveRequestService,
  declineLeaveRequestService,
  createNewDepartmentService,
}