const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const LeaveModel = require('../models/leave.model')
const DepartmentModel = require('../models/department.model')
const HolidayModel = require('../models/holiday.model')
const ScheduleModel = require('../models/schedule.model')
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
    .populate( "userId", "name email displayImage isActive")
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
      }))

      console.log(employees)

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

      // Track overtime
      if (record.isOvertime) {
        totalOvertimeMinutes += record.overtimeMinutes || 0
        overtimeRecords.push({
          date: record.date,
          scheduledEnd: record.scheduledEnd,
          actualTimeOut: record.timeOut,
          overtimeMinutes: record.overtimeMinutes
        })
      }

      // Track undertime
      if (record.isUndertime) {
        totalUndertimeMinutes += record.undertimeMinutes || 0
        undertimeRecords.push({
          date: record.date,
          scheduledEnd: record.scheduledEnd,
          actualTimeOut: record.timeOut,
          undertimeMinutes: record.undertimeMinutes
        })
      }

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
}