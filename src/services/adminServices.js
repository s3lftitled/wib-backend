const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const LeaveModel = require('../models/leave.model')
const DepartmentModel = require('../models/department.model')
const HolidayModel = require('../models/holiday.model')
const ScheduleModel = require('../models/schedule.model')
const OvertimeRecordModel = require('../models/overtimerecords.model')
const HTTP_STATUS = require('../constants/httpConstants')
const ROLE_CONSTANTS = require('../constants/roleConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const EmailUtil = require('../utils/emailUtils')
const validator = require('validator')
const logger = require('../logger/logger')

const createEmployeeAccountService = async (name, email, departmentId) => {
  try {
    appAssert(typeof name === "string", 'Invalid name, please try again', HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isEmail(email), 'Invalid email, please try again', HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(departmentId), 'Invalid department id, please try again', HTTP_STATUS.BAD_REQUEST)

    const department = await DepartmentModel.findById(departmentId)
    appAssert(department, 'Department is not found', HTTP_STATUS.NOT_FOUND)

    const existingEmployee = await UserModel.findOne({ email })
    appAssert(!existingEmployee, 'Employee email already exists', HTTP_STATUS.BAD_REQUEST)

    const hashedPassword = await PasswordUtil.createTempPassword()
    const token = EmailUtil.generateToken()

    // Set token expiration (4 hours from now)
    const tokenExpiration = new Date()
    tokenExpiration.setHours(tokenExpiration.getHours() + 4)

    const newUser = await UserModel.create({
      email,
      name,
      password: hashedPassword,
      role: ROLE_CONSTANTS[101],
      token: token,
      tokenExpires: tokenExpiration,
    })

    await newUser.save()

    const newEmployee = await EmployeeModel.create({
      userId: newUser._id,
      department: department._id,
    })

    await newEmployee.save()

    department.staffs.push(newUser._id)

    await department.save()
  
    await EmailUtil.sendPasswordSetupEmail(email, token) 

    logger.info(`New employee created ${email} with token expiring at ${tokenExpiration}`)

    return { newEmployee, message: 'New employee successfully created!'}
  } catch (error) {
    throw error
  }
}

const fetchAllActiveEmployeeService = async () => {
  try {
    const allEmployees = await EmployeeModel.find()
      .populate("userId", "name email displayImage isActive")
      .populate("department", "name")

    console.log(allEmployees)
    
    const employees = allEmployees.map(emp => ({
      id: emp._id,
      name: emp.userId.name,
      email: emp.userId.email,
      displayImage: emp.userId.displayImage,
      isActive: emp.userId.isActive,
      department: emp.department ? emp.department.name : "N/A",
      leaveBalance: emp.leaveBalance,
      attendanceHistory: emp.attendanceHistory.map(history => ({
        action: history.action,
        timestamp: history.timestamp,
        attendanceDate: history.attendanceDate,
        details: history.details,
        ipAddress: history.ipAddress,
        userAgent: history.userAgent
      })).sort((a, b) => b.timestamp - a.timestamp) // Sort by most recent first
    }))

    appAssert(employees.length > 0, 'No active employees found', HTTP_STATUS.NOT_FOUND)

    return { employees, message: 'Successfully fetched all employees'}
  } catch (error) {
    throw error
  }
}

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
    appAssert(allLeaveRequests.length > 0, 'No request leave found', HTTP_STATUS.OK)

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
    const employee = await EmployeeModel.findOne({ userId: leaveRequest.employee })
    appAssert(employee, "User not found", HTTP_STATUS.NOT_FOUND)

    // Calculate total days
    const start = new Date(leaveRequest.startDate)
    const end = new Date(leaveRequest.endDate)
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1

    // Ensure leave balance exists
    appAssert(employee.leaveBalance && employee.leaveBalance[leaveCategory], "Invalid leave category", HTTP_STATUS.BAD_REQUEST)

    const leaveData = employee.leaveBalance[leaveCategory]

    // Ensure enough remaining
    appAssert(leaveData.remaining >= days, "Not enough leave balance", HTTP_STATUS.BAD_REQUEST)

    // Update balances
    leaveData.availments += days
    leaveData.remaining -= days
    leaveData.active += days

    // Save changes
    await employee.save()

    // Update leave request status
    leaveRequest.status = "APPROVED"
    leaveRequest.approvedBy = approvedBy
    leaveRequest.daysApproved = days
    await leaveRequest.save()

    logger.info(`Leave request ${leaveId} approved for ${employee.name}`)

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

const fetchDepartmentsService = async () => {
  try {
    const departments = await DepartmentModel.find({})

    appAssert(departments || departments.length !== 0, 'No departments found', HTTP_STATUS.NOT_FOUND)

    return { message: "Departments fetched successfully", departments }
  } catch (error) {
    throw error
  }
}

const createHolidayService = async (name, holidate, description, type, createdBy) => {
  try {
    // ✅ Validate inputs
    appAssert(typeof name === "string" && name.trim().length > 0, 'Invalid holiday name', HTTP_STATUS.BAD_REQUEST)
    appAssert(holidate && !isNaN(Date.parse(holidate)), 'Invalid holiday date', HTTP_STATUS.BAD_REQUEST)

    // ✅ Sanitize name
    const sanitizedName = name.trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()) // Title Case

    // ✅ Check if holiday already exists for the same date
    const existingHoliday = await HolidayModel.findOne({ 
      name: sanitizedName, 
      holidate: new Date(holidate) 
    })
    appAssert(!existingHoliday, 'Holiday already exists on this date', HTTP_STATUS.CONFLICT)

    // ✅ Create new holiday
    const newHoliday = await HolidayModel.create({
      name: sanitizedName,
      holidate: new Date(holidate),
      description: description || "",
      type: type || "public",
      createdBy: createdBy || "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await newHoliday.save()

    logger.info(`New holiday created: ${sanitizedName} on ${holidate}`)

    return { 
      holiday: {
        id: newHoliday._id,
        name: newHoliday.name,
        holidate: newHoliday.holidate,
        description: newHoliday.description,
        type: newHoliday.type,
      },
      message: 'Holiday created successfully!'
    }

  } catch (error) {
    throw error
  }
}

const fetchHolidaysService = async (year, type) => {
  try {
    // Build query filter
    let query = {}

    // ✅ Filter by year if provided
    if (year) {
      appAssert(!isNaN(year) && year > 1900 && year < 3000, 'Invalid year provided', HTTP_STATUS.BAD_REQUEST)
      
      const startDate = new Date(`${year}-01-01`)
      const endDate = new Date(`${year}-12-31`)
      
      query.holidate = {
        $gte: startDate,
        $lte: endDate
      }
    }

    // ✅ Filter by type if provided
    if (type) {
      appAssert(typeof type === "string" && type.trim().length > 0, 'Invalid holiday type', HTTP_STATUS.BAD_REQUEST)
      query.type = type.toLowerCase()
    }

    // ✅ Fetch holidays sorted by date
    const holidays = await HolidayModel.find(query)
      .sort({ holidate: 1 }) // Sort by date ascending
      .lean() // For better performance

    appAssert(holidays && holidays.length > 0, 'No holidays found', HTTP_STATUS.OK)

    // ✅ Format response
    const formattedHolidays = holidays.map(holiday => ({
      id: holiday._id,
      name: holiday.name,
      date: holiday.holidate,
      description: holiday.description || "",
      type: holiday.type,
      createdBy: holiday.createdBy,
      createdAt: holiday.createdAt
    }))

    logger.info(`Fetched ${holidays.length} holidays${year ? ` for year ${year}` : ''}${type ? ` of type ${type}` : ''}`)

    return { 
      holidays: formattedHolidays,
      count: holidays.length,
      message: 'Holidays fetched successfully!'
    }

  } catch (error) {
    throw error
  }
}

const createScheduleSlotService = async (date, startTime, endTime, adminUserId) => {
  try {
    appAssert(date, "Date is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(startTime, "Start time is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(endTime, "End time is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(adminUserId, "Admin user ID is required", HTTP_STATUS.BAD_REQUEST)

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    appAssert(start < end, "Start time must be before end time", HTTP_STATUS.BAD_REQUEST)

    const admin = await UserModel.findById(adminUserId)
    appAssert(admin && admin.role === ROLE_CONSTANTS[202], "Only admins can create schedule slots", HTTP_STATUS.FORBIDDEN)

    const newSchedule = await ScheduleModel.create({
      date: new Date(date),
      time: { start, end },
      createdBy: adminUserId
    })

    return {
      schedule: {
        id: newSchedule._id,
        date: newSchedule.date,
        start: newSchedule.time.start,
        end: newSchedule.time.end
      },
      message: "Schedule slot created successfully"
    }
  } catch (error) {
    throw error
  }
}

const deleteScheduleSlotService = async (scheduleId) => {
  try {
    appAssert(scheduleId, "Schedule ID is required", HTTP_STATUS.BAD_REQUEST)

    const schedule = await ScheduleModel.findById(scheduleId)
    appAssert(schedule, "Schedule not found", HTTP_STATUS.NOT_FOUND)

    await ScheduleModel.findByIdAndDelete(scheduleId)

    return {
      message: "Schedule deleted successfully",
      deletedSchedule: schedule,
    }
  } catch (error) {
    throw error
  }
}

const assignEmployeeToScheduleService = async (scheduleId, employeeId) => {
  try {
    appAssert(scheduleId, "Schedule ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(employeeId, "Employee ID is required", HTTP_STATUS.BAD_REQUEST)

    const schedule = await ScheduleModel.findById(scheduleId)
    appAssert(schedule, "Schedule not found", HTTP_STATUS.NOT_FOUND)
    appAssert(!schedule.assignedEmployee, "Schedule already has an assigned employee", HTTP_STATUS.CONFLICT)

    const employee = await EmployeeModel.findById(employeeId)
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    // Check if employee has a conflicting schedule
    const conflict = await ScheduleModel.findOne({
      assignedEmployee: employeeId,
      date: schedule.date,
      "time.start": { $lt: schedule.time.end },
      "time.end": { $gt: schedule.time.start }
    })

    appAssert(!conflict, "Employee has a conflicting schedule", HTTP_STATUS.CONFLICT)

    schedule.assignedEmployee = employeeId
    await schedule.save()

    return {
      message: `Employee assigned to schedule ${scheduleId}`,
      scheduleId: schedule._id,
      employeeId: employee._id
    }
  } catch (error) {
    throw error
  }
}

const changeAssignedEmployeeService = async (scheduleId, employeeId) => {
  try {
    appAssert(scheduleId, "Schedule ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(employeeId, "Employee ID is required", HTTP_STATUS.BAD_REQUEST)

    const schedule = await ScheduleModel.findById(scheduleId)
    appAssert(schedule, "Schedule not found", HTTP_STATUS.NOT_FOUND)
    appAssert(schedule.assignedEmployee, "No employee currently assigned to this schedule", HTTP_STATUS.BAD_REQUEST)

    // Prevent reassigning to the same employee
    if (schedule.assignedEmployee.toString() === employeeId) {
      appAssert(false, "This employee is already assigned to the schedule", HTTP_STATUS.CONFLICT)
    }

    const employee = await EmployeeModel.findById(employeeId)
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    // Check if employee has a conflicting schedule
    const conflict = await ScheduleModel.findOne({
      assignedEmployee: employeeId,
      date: schedule.date,
      "time.start": { $lt: schedule.time.end },
      "time.end": { $gt: schedule.time.start }
    })

    appAssert(!conflict, "Employee has a conflicting schedule", HTTP_STATUS.CONFLICT)

    // Update assigned employee
    schedule.assignedEmployee = employeeId
    await schedule.save()

    return {
      message: `Employee for schedule ${scheduleId} has been changed successfully`,
      scheduleId: schedule._id,
      newEmployeeId: employee._id
    }
  } catch (error) {
    throw error
  }
} 

const fetchScheduleSlotService = async (month, year) => {
  try {
    // Validate inputs
    appAssert(!isNaN(year) && year > 1900 && year < 3000, 'Invalid year provided', HTTP_STATUS.BAD_REQUEST)
    appAssert(!isNaN(month) && month >= 1 && month <= 12, 'Invalid month provided', HTTP_STATUS.BAD_REQUEST)

    // Create date range for the month
    const startDate = new Date(year, month - 1, 1) // month is 0-indexed in Date
    const endDate = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month

    // Build query
    const query = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }

    const startTime = Date.now()

    const scheduleSlots = await ScheduleModel.find(query)
      .populate({
        path: 'assignedEmployee',
        populate: {
          path: 'userId',
          select: 'name email displayImage isActive'
        }
      })
      .populate('createdBy', 'name email')
      .sort({ date: 1, 'time.start': 1 })
      .lean()

    const duration = Date.now() - startTime
    logger.info(`⏱ Query executed in ${duration} ms for ${scheduleSlots.length} schedules`)

    appAssert(scheduleSlots && scheduleSlots.length > 0, 'No schedule slots found for this period', HTTP_STATUS.OK)

    // Format response with populated employee details
    const formattedSchedules = scheduleSlots.map(schedule => ({
      id: schedule._id,
      date: schedule.date,
      startTime: schedule.time.start,
      endTime: schedule.time.end,
      assignedEmployee: schedule.assignedEmployee ? {
        id: schedule.assignedEmployee._id,
        name: schedule.assignedEmployee.userId?.name || 'Unknown',
        email: schedule.assignedEmployee.userId?.email || 'Unknown',
        displayImage: schedule.assignedEmployee.userId?.displayImage || null,
        isActive: schedule.assignedEmployee.userId?.isActive || false
      } : null,
      createdBy: {
        id: schedule.createdBy._id,
        name: schedule.createdBy.name,
        email: schedule.createdBy.email
      },
      createdAt: schedule.createdAt
    }))

    logger.info(`Fetched ${scheduleSlots.length} schedule slots for ${year}-${month}`)

    return {
      schedules: formattedSchedules,
      count: scheduleSlots.length,
      period: {
        month,
        year,
        startDate,
        endDate
      },
      message: 'Schedule slots fetched successfully!'
    }

  } catch (error) {
    throw error
  }
}

const generateEmployeeMonthlyReportService = async (employeeId, month, year) => {
  try {
    // Validate inputs
    appAssert(employeeId, "Employee ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(!isNaN(year) && year > 1900 && year < 3000, 'Invalid year provided', HTTP_STATUS.BAD_REQUEST)
    appAssert(!isNaN(month) && month >= 1 && month <= 12, 'Invalid month provided', HTTP_STATUS.BAD_REQUEST)

    // Find employee
    const employee = await EmployeeModel.findById(employeeId)
      .populate('userId', 'name email displayImage')
      .populate('holidaysTaken.holidayId', 'name holidate type')
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    // Create date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // Filter attendance records for the specified month
    const monthlyAttendance = employee.attendance.filter(record => {
      const recordDate = new Date(record.date)
      return recordDate >= startDate && recordDate <= endDate
    })

    // Initialize counters
    let totalPresent = 0
    let totalLate = 0
    let totalAbsent = 0
    let totalLateMinutes = 0
    let totalOvertimeMinutes = 0
    let totalUndertimeMinutes = 0
    let totalWorkHours = 0
    let totalBreakHours = 0

    // Detailed breakdown arrays
    const lateRecords = []
    const absentRecords = []
    const overtimeRecords = []
    const undertimeRecords = []
    const presentRecords = []

    // Process each attendance record
    monthlyAttendance.forEach(record => {
      // Count by status
      if (record.status === "Present") totalPresent++
      else if (record.status === "Late") {
        totalPresent++
        totalLate++
        totalLateMinutes += record.lateMinutes || 0
        lateRecords.push({
          date: record.date,
          scheduledStart: new Date(record.scheduledStart).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          actualTimeIn: record.timeIn,
          lateMinutes: record.lateMinutes
        })
      }
      else if (record.status === "Absent") {
        totalAbsent++
        absentRecords.push({
          date: record.date,
          scheduledStart: record.scheduledStart,
          scheduledEnd: record.scheduledEnd
        })
      }

      // Accumulate work hours and break time
      totalWorkHours += record.totalHours || 0
      totalBreakHours += record.breakTime || 0

      // Track present records
      if (record.timeIn && record.timeOut && !record.isAbsent) {
        presentRecords.push({
          date: record.date,
          timeIn: record.timeIn,
          timeOut: record.timeOut,
          totalHours: record.totalHours,
          breakTime: record.breakTime
        })
      }
    })

    // Get APPROVED overtime records from OvertimeRecord collection
    const approvedOvertimeRecords = await OvertimeRecordModel.find({
      employeeId: employeeId,
      type: "Overtime",
      status: "Approved",
      date: { $gte: startDate, $lte: endDate }
    }).populate('reviewedBy', 'name email')

    // Process approved overtime records
    approvedOvertimeRecords.forEach(overtimeRecord => {
      totalOvertimeMinutes += overtimeRecord.minutes
      overtimeRecords.push({
        date: overtimeRecord.date,
        scheduledEnd: overtimeRecord.scheduledEnd,
        actualTimeOut: overtimeRecord.actualTimeOut,
        overtimeMinutes: overtimeRecord.minutes,
        reason: overtimeRecord.reason,
        reviewedBy: overtimeRecord.reviewedBy ? {
          id: overtimeRecord.reviewedBy._id,
          name: overtimeRecord.reviewedBy.name,
          email: overtimeRecord.reviewedBy.email
        } : null,
        reviewedAt: overtimeRecord.reviewedAt,
        reviewNotes: overtimeRecord.reviewNotes
      })
    })

    // Get APPROVED undertime records from OvertimeRecord collection
    const approvedUndertimeRecords = await OvertimeRecordModel.find({
      employeeId: employeeId,
      type: "Undertime",
      status: "Approved",
      date: { $gte: startDate, $lte: endDate }
    }).populate('reviewedBy', 'name email')

    // Process approved undertime records
    approvedUndertimeRecords.forEach(undertimeRecord => {
      totalUndertimeMinutes += undertimeRecord.minutes
      undertimeRecords.push({
        date: undertimeRecord.date,
        scheduledEnd: undertimeRecord.scheduledEnd,
        actualTimeOut: undertimeRecord.actualTimeOut,
        undertimeMinutes: undertimeRecord.minutes,
        reason: undertimeRecord.reason,
        reviewedBy: undertimeRecord.reviewedBy ? {
          id: undertimeRecord.reviewedBy._id,
          name: undertimeRecord.reviewedBy.name,
          email: undertimeRecord.reviewedBy.email
        } : null,
        reviewedAt: undertimeRecord.reviewedAt,
        reviewNotes: undertimeRecord.reviewNotes
      })
    })

    // Get approved leaves for the month from Leave collection
    const approvedLeaves = await LeaveModel.find({
      employee: employee.userId._id,
      status: "APPROVED",
      $or: [
        {
          startDate: { $gte: startDate, $lte: endDate }
        },
        {
          endDate: { $gte: startDate, $lte: endDate }
        },
        {
          startDate: { $lte: startDate },
          endDate: { $gte: endDate }
        }
      ]
    }).populate('approvedBy', 'name email')

    // Calculate total leave days taken in this month
    let totalLeaveDaysTaken = 0
    let sickLeaveDaysTaken = 0
    let vacationLeaveDaysTaken = 0

    const leaveDetails = approvedLeaves.map(leave => {
      const leaveStart = new Date(Math.max(leave.startDate, startDate))
      const leaveEnd = new Date(Math.min(leave.endDate, endDate))
      const daysInMonth = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1
      
      totalLeaveDaysTaken += daysInMonth

      // Track by leave category
      if (leave.leaveCategory === 'sickLeave') {
        sickLeaveDaysTaken += daysInMonth
      } else if (leave.leaveCategory === 'vacationLeave') {
        vacationLeaveDaysTaken += daysInMonth
      }

      return {
        leaveType: leave.leaveType,
        leaveCategory: leave.leaveCategory,
        startDate: leave.startDate,
        endDate: leave.endDate,
        daysInMonth,
        totalDays: leave.numberOfDays,
        daysApproved: leave.daysApproved,
        reason: leave.reason,
        approvedBy: leave.approvedBy ? {
          id: leave.approvedBy._id,
          name: leave.approvedBy.name,
          email: leave.approvedBy.email
        } : null,
        createdAt: leave.createdAt
      }
    })

    // Get holidays taken in this month
    const holidaysTakenInMonth = employee.holidaysTaken.filter(holiday => {
      if (!holiday.holidayId) return false
      const holidayDate = new Date(holiday.holidayId.holidate)
      return holidayDate >= startDate && holidayDate <= endDate
    }).map(holiday => ({
      name: holiday.holidayId.name,
      date: holiday.holidayId.holidate,
      type: holiday.holidayId.type,
    }))

    // Get scheduled days for the month
    const scheduledDays = await ScheduleModel.countDocuments({
      assignedEmployee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    })

    // Calculate working days (scheduled days - leaves - holidays)
    const expectedWorkingDays = scheduledDays - totalLeaveDaysTaken - holidaysTakenInMonth.filter(h => h.status === "Approved").length

    // Calculate attendance rate
    const attendanceRate = expectedWorkingDays > 0 
      ? ((totalPresent + totalLate) / expectedWorkingDays * 100).toFixed(2)
      : 0

    // Calculate punctuality rate (on-time arrivals)
    const punctualityRate = (totalPresent + totalLate) > 0
      ? (totalPresent / (totalPresent + totalLate) * 100).toFixed(2)
      : 0

    // Get current leave balances
    const leaveBalances = {
      sickLeave: {
        beginning: employee.leaveBalance?.sickLeave?.beginning || 0,
        availments: employee.leaveBalance?.sickLeave?.availments || 0,
        remaining: employee.leaveBalance?.sickLeave?.remaining || 0,
        active: employee.leaveBalance?.sickLeave?.active || 0,
        reserved: employee.leaveBalance?.sickLeave?.reserved || 0
      },
      vacationLeave: {
        beginning: employee.leaveBalance?.vacationLeave?.beginning || 0,
        availments: employee.leaveBalance?.vacationLeave?.availments || 0,
        remaining: employee.leaveBalance?.vacationLeave?.remaining || 0,
        active: employee.leaveBalance?.vacationLeave?.active || 0,
        reserved: employee.leaveBalance?.vacationLeave?.reserved || 0
      }
    }

    // Build comprehensive report
    const report = {
      employee: {
        id: employee._id,
        name: employee.userId.name,
        email: employee.userId.email,
        displayImage: employee.userId.displayImage
      },
      period: {
        month,
        year,
        startDate,
        endDate,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' })
      },
      summary: {
        scheduledDays,
        expectedWorkingDays,
        totalPresent,
        totalLate,
        totalAbsent,
        attendanceRate: `${attendanceRate}%`,
        punctualityRate: `${punctualityRate}%`
      },
      timeTracking: {
        totalWorkHours: totalWorkHours.toFixed(2),
        totalBreakHours: totalBreakHours.toFixed(2),
        totalLateMinutes,
        totalLateHours: (totalLateMinutes / 60).toFixed(2),
        totalOvertimeMinutes,
        totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(2),
        totalUndertimeMinutes,
        totalUndertimeHours: (totalUndertimeMinutes / 60).toFixed(2),
        averageWorkHoursPerDay: monthlyAttendance.length > 0 
          ? (totalWorkHours / monthlyAttendance.length).toFixed(2)
          : 0
      },
      detailedRecords: {
        lateRecords: lateRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
        absentRecords: absentRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
        overtimeRecords: overtimeRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
        undertimeRecords: undertimeRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
        presentRecords: presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date))
      },
      leaves: {
        totalDaysTaken: totalLeaveDaysTaken,
        sickLeaveDaysTaken,
        vacationLeaveDaysTaken,
        approvedLeavesCount: approvedLeaves.length,
        approvedLeaves: leaveDetails,
        currentBalances: leaveBalances
      },
      holidays: {
        totalTaken: holidaysTakenInMonth.length,
        details: holidaysTakenInMonth
      },
      generatedAt: new Date(),
      generatedBy: "System"
    }

    logger.info(`Monthly report generated for employee ${employee.userId.name} (${month}/${year})`)

    return {
      report,
      message: "Monthly report generated successfully"
    }

  } catch (error) {
    throw error
  }
}

const addNewAdmin = async (name, email) => {

  try {
    // Basic type check
    appAssert(typeof name === "string", 'Invalid name', HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof email === "string", 'Invalid email', HTTP_STATUS.BAD_REQUEST)

    // Trim and sanitize
    name = validator.escape(name.trim())
    email = validator.normalizeEmail(email)

    // Validate name length and pattern
    appAssert(name.length >= 2 && name.length <= 50, 'Name must be between 2 and 50 characters', HTTP_STATUS.BAD_REQUEST)
    appAssert(/^[A-Za-z\s]+$/.test(name), 'Name should only contain letters and spaces', HTTP_STATUS.BAD_REQUEST)

    // Validate email format
    appAssert(validator.isEmail(email), 'Invalid email format', HTTP_STATUS.BAD_REQUEST)

    // Check for duplicates
    const existingUser = await UserModel.findOne({ email })
    appAssert(!existingUser, 'Email is already registered', HTTP_STATUS.CONFLICT)

    const hashedPassword = await PasswordUtil.createTempPassword()
    const token = EmailUtil.generateToken()

    // Set token expiration (4 hours from now)
    const tokenExpiration = new Date()
    tokenExpiration.setHours(tokenExpiration.getHours() + 4)

    const newAdmin = await UserModel.create({
      email,
      name,
      role: ROLE_CONSTANTS[202],
      token: token,
      tokenExpires: tokenExpiration,
    })

    await newAdmin.save()
  } catch (error) {
    throw error
  }
}

/**
 * Fetch all overtime/undertime records with pagination and filters
 */
const fetchAllOvertimeRecordsService = async (page = 1, pageSize = 10, status = null, type = null) => {
  try {
    // Validate pagination
    appAssert(page > 0 && pageSize > 0, 'Page and pageSize must be positive integers', HTTP_STATUS.BAD_REQUEST)

    // Build query filter
    const query = {}
    
    if (status && status !== 'all') {
      appAssert(['Pending', 'Approved', 'Declined'].includes(status), 'Invalid status', HTTP_STATUS.BAD_REQUEST)
      query.status = status
    }
    
    if (type && type !== 'all') {
      appAssert(['Overtime', 'Undertime'].includes(type), 'Invalid type', HTTP_STATUS.BAD_REQUEST)
      query.type = type
    }

    // Calculate skip
    const skip = (page - 1) * pageSize

    // Fetch records with pagination
    const overtimeRecords = await OvertimeRecordModel.find(query)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email displayImage'
        }
      })
      .populate('reviewedBy', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(pageSize)

    // Count total records
    const totalRecords = await OvertimeRecordModel.countDocuments(query)
    const totalPages = Math.ceil(totalRecords / pageSize)

    // Format response
    const formattedRecords = overtimeRecords.map(record => ({
      id: record._id,
      employeeName: record.employeeId?.userId?.name || "Unknown",
      employeeEmail: record.employeeId?.userId?.email || "Unknown",
      employeeImage: record.employeeId?.userId?.displayImage || null,
      type: record.type,
      date: record.date,
      scheduledEnd: record.scheduledEnd,
      actualTimeOut: record.actualTimeOut,
      minutes: record.minutes,
      reason: record.reason,
      status: record.status,
      submittedAt: record.submittedAt,
      reviewedBy: record.reviewedBy ? {
        id: record.reviewedBy._id,
        name: record.reviewedBy.name,
        email: record.reviewedBy.email
      } : null,
      reviewedAt: record.reviewedAt,
      reviewNotes: record.reviewNotes
    }))

    return {
      records: formattedRecords,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages,
        totalRecords
      },
      message: "Overtime records fetched successfully"
    }

  } catch (error) {
    throw error
  }
}

/**
 * Approve overtime/undertime record
 */
const approveOvertimeRecordService = async (recordId, reviewedBy, reviewNotes = null) => {
  try {
    // Validate inputs
    appAssert(recordId, "Record ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(reviewedBy, "Reviewer ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(recordId), "Invalid record ID", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(reviewedBy), "Invalid reviewer ID", HTTP_STATUS.BAD_REQUEST)

    // Find the reviewer (admin)
    const admin = await UserModel.findById(reviewedBy)
    appAssert(admin, "Reviewer not found", HTTP_STATUS.NOT_FOUND)
    appAssert(admin.role === ROLE_CONSTANTS[202], "Only admins can review overtime records", HTTP_STATUS.FORBIDDEN)

    // Find overtime record
    const overtimeRecord = await OvertimeRecordModel.findById(recordId)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
    
    appAssert(overtimeRecord, "Overtime record not found", HTTP_STATUS.NOT_FOUND)
    appAssert(overtimeRecord.status === "Pending", "Record has already been reviewed", HTTP_STATUS.BAD_REQUEST)

    // Update record status
    overtimeRecord.status = "Approved"
    overtimeRecord.reviewedBy = reviewedBy
    overtimeRecord.reviewedAt = new Date()
    if (reviewNotes) {
      overtimeRecord.reviewNotes = reviewNotes.trim()
    }

    await overtimeRecord.save()

    logger.info(`${overtimeRecord.type} record ${recordId} approved by ${admin.name} for employee ${overtimeRecord.employeeId.userId.name}`)

    return {
      record: {
        id: overtimeRecord._id,
        type: overtimeRecord.type,
        status: overtimeRecord.status,
        reviewedBy: {
          id: admin._id,
          name: admin.name,
          email: admin.email
        },
        reviewedAt: overtimeRecord.reviewedAt,
        reviewNotes: overtimeRecord.reviewNotes
      },
      message: `${overtimeRecord.type} record approved successfully`
    }

  } catch (error) {
    throw error
  }
}

/**
 * Decline overtime/undertime record
 */
const declineOvertimeRecordService = async (recordId, reviewedBy, reviewNotes) => {
  try {
    // Validate inputs
    appAssert(recordId, "Record ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(reviewedBy, "Reviewer ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(reviewNotes, "Review notes are required when declining", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(recordId), "Invalid record ID", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(reviewedBy), "Invalid reviewer ID", HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof reviewNotes === "string" && reviewNotes.trim().length > 0, "Review notes cannot be empty", HTTP_STATUS.BAD_REQUEST)

    // Find the reviewer (admin)
    const admin = await UserModel.findById(reviewedBy)
    appAssert(admin, "Reviewer not found", HTTP_STATUS.NOT_FOUND)
    appAssert(admin.role === ROLE_CONSTANTS[202], "Only admins can review overtime records", HTTP_STATUS.FORBIDDEN)

    // Find overtime record
    const overtimeRecord = await OvertimeRecordModel.findById(recordId)
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
    
    appAssert(overtimeRecord, "Overtime record not found", HTTP_STATUS.NOT_FOUND)
    appAssert(overtimeRecord.status === "Pending", "Record has already been reviewed", HTTP_STATUS.BAD_REQUEST)

    // Update record status
    overtimeRecord.status = "Declined"
    overtimeRecord.reviewedBy = reviewedBy
    overtimeRecord.reviewedAt = new Date()
    overtimeRecord.reviewNotes = reviewNotes.trim()

    await overtimeRecord.save()

    logger.info(`${overtimeRecord.type} record ${recordId} declined by ${admin.name} for employee ${overtimeRecord.employeeId.userId.name}. Reason: ${reviewNotes}`)

    return {
      record: {
        id: overtimeRecord._id,
        type: overtimeRecord.type,
        status: overtimeRecord.status,
        reviewedBy: {
          id: admin._id,
          name: admin.name,
          email: admin.email
        },
        reviewedAt: overtimeRecord.reviewedAt,
        reviewNotes: overtimeRecord.reviewNotes
      },
      message: `${overtimeRecord.type} record declined successfully`
    }

  } catch (error) {
    throw error
  }
}

/**
 * Get overtime statistics for dashboard
 */
const getOvertimeStatisticsService = async (startDate = null, endDate = null) => {
  try {
    // Build date filter
    const dateFilter = {}
    
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }

    // Get counts by status
    const pendingCount = await OvertimeRecordModel.countDocuments({ ...dateFilter, status: "Pending" })
    const approvedCount = await OvertimeRecordModel.countDocuments({ ...dateFilter, status: "Approved" })
    const declinedCount = await OvertimeRecordModel.countDocuments({ ...dateFilter, status: "Declined" })

    // Get counts by type
    const overtimeCount = await OvertimeRecordModel.countDocuments({ ...dateFilter, type: "Overtime" })
    const undertimeCount = await OvertimeRecordModel.countDocuments({ ...dateFilter, type: "Undertime" })

    // Calculate total minutes
    const approvedOvertimeRecords = await OvertimeRecordModel.find({ 
      ...dateFilter, 
      status: "Approved", 
      type: "Overtime" 
    })
    const totalOvertimeMinutes = approvedOvertimeRecords.reduce((sum, record) => sum + record.minutes, 0)

    const approvedUndertimeRecords = await OvertimeRecordModel.find({ 
      ...dateFilter, 
      status: "Approved", 
      type: "Undertime" 
    })
    const totalUndertimeMinutes = approvedUndertimeRecords.reduce((sum, record) => sum + record.minutes, 0)

    return {
      statistics: {
        byStatus: {
          pending: pendingCount,
          approved: approvedCount,
          declined: declinedCount,
          total: pendingCount + approvedCount + declinedCount
        },
        byType: {
          overtime: overtimeCount,
          undertime: undertimeCount
        },
        approvedMinutes: {
          overtime: totalOvertimeMinutes,
          overtimeHours: (totalOvertimeMinutes / 60).toFixed(2),
          undertime: totalUndertimeMinutes,
          undertimeHours: (totalUndertimeMinutes / 60).toFixed(2)
        }
      },
      message: "Overtime statistics fetched successfully"
    }

  } catch (error) {
    throw error
  }
}

const editEmployeeLeaveBalanceService = async (employeeId, leaveType, beginningBalance, adminUserId) => {
  try {
    // Validate inputs
    appAssert(employeeId, "Employee ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(employeeId), "Invalid employee ID", HTTP_STATUS.BAD_REQUEST)
    appAssert(leaveType, "Leave type is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(['sickLeave', 'vacationLeave'].includes(leaveType), 
      "Leave type must be 'sickLeave' or 'vacationLeave'", HTTP_STATUS.BAD_REQUEST)
    appAssert(beginningBalance !== undefined && beginningBalance !== null, 
      "Beginning balance is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof beginningBalance === 'number', 
      "Beginning balance must be a number", HTTP_STATUS.BAD_REQUEST)
    appAssert(beginningBalance >= 0, 
      "Beginning balance cannot be negative", HTTP_STATUS.BAD_REQUEST)
    appAssert(Number.isFinite(beginningBalance), 
      "Beginning balance must be a finite number", HTTP_STATUS.BAD_REQUEST)
    appAssert(adminUserId, "Admin user ID is required", HTTP_STATUS.BAD_REQUEST)
    appAssert(validator.isMongoId(adminUserId), "Invalid admin user ID", HTTP_STATUS.BAD_REQUEST)

    // Verify admin user exists and has correct role
    const admin = await UserModel.findById(adminUserId)
    appAssert(admin, "Admin user not found", HTTP_STATUS.NOT_FOUND)
    appAssert(admin.role === ROLE_CONSTANTS[202], 
      "Only admins can edit employee leave balances", HTTP_STATUS.FORBIDDEN)
    appAssert(admin.isActive, "Admin account is not active", HTTP_STATUS.FORBIDDEN)

    // Find employee
    const employee = await EmployeeModel.findById(employeeId)
      .populate('userId', 'name email isActive')
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)
    appAssert(employee.userId.isActive, "Employee account is not active", HTTP_STATUS.BAD_REQUEST)

    // Get current balance
    const currentBalance = employee.leaveBalance[leaveType]
    const previousBeginning = currentBalance.beginning
    const currentAvailments = currentBalance.availments

    // Calculate new remaining balance
    // remaining = beginning - availments
    const newRemaining = beginningBalance - currentAvailments

    // Validate that new remaining is not negative
    appAssert(newRemaining >= 0, 
      `New beginning balance (${beginningBalance}) cannot be less than current availments (${currentAvailments})`, 
      HTTP_STATUS.BAD_REQUEST)

    // Update employee leave balance
    const updateFields = {
      [`leaveBalance.${leaveType}.beginning`]: beginningBalance,
      [`leaveBalance.${leaveType}.remaining`]: newRemaining
    }

    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('userId', 'name email displayImage')

    const updatedBalance = updatedEmployee.leaveBalance[leaveType]

    // Log the change
    const leaveTypeName = leaveType === 'sickLeave' ? 'Sick Leave' : 'Vacation Leave'
    logger.info(`Leave balance updated by ${admin.name} (${admin.email}) for employee ${employee.userId.name} (${employee.userId.email})`)
    logger.info(`Leave Type: ${leaveTypeName}`)
    logger.info(`Beginning Balance: ${previousBeginning} → ${beginningBalance}`)
    logger.info(`Remaining Balance: ${currentBalance.remaining} → ${newRemaining}`)

    return {
      employee: {
        id: updatedEmployee._id,
        name: updatedEmployee.userId.name,
        email: updatedEmployee.userId.email,
        displayImage: updatedEmployee.userId.displayImage
      },
      leaveType: leaveTypeName,
      previousBalance: {
        beginning: previousBeginning,
        availments: currentAvailments,
        remaining: currentBalance.remaining,
        active: currentBalance.active,
        reserved: currentBalance.reserved
      },
      updatedBalance: {
        beginning: updatedBalance.beginning,
        availments: updatedBalance.availments,
        remaining: updatedBalance.remaining,
        active: updatedBalance.active,
        reserved: updatedBalance.reserved
      },
      updatedBy: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      },
      updatedAt: new Date(),
      message: `${leaveTypeName} beginning balance updated successfully`
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
  fetchDepartmentsService,
  createHolidayService,
  fetchHolidaysService,
  createScheduleSlotService,
  deleteScheduleSlotService,
  assignEmployeeToScheduleService,
  changeAssignedEmployeeService,
  fetchScheduleSlotService,
  generateEmployeeMonthlyReportService,
  fetchAllOvertimeRecordsService,
  approveOvertimeRecordService,
  declineOvertimeRecordService,
  getOvertimeStatisticsService,
  editEmployeeLeaveBalanceService,
}