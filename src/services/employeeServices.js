const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const LeaveModel = require('../models/leave.model')
const ScheduleModel = require("../models/schedule.model")
const HTTP_STATUS = require('../constants/httpConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const OvertimeRecordModel = require('../models/overtimerecords.model')
const logger = require('../logger/logger')
const { LEAVE_TYPES } = require('../constants/leaveRelatedConstants')
const EmailUtil = require('../utils/emailUtils')
const validator = require('validator')

// Helper function to add attendance history entry
const addAttendanceHistory = (employee, action, attendanceDate, details = {}, req = null) => {
  const historyEntry = {
    action: action,
    timestamp: new Date(),
    attendanceDate: attendanceDate,
    details: details
  }
  
  // Add IP address and user agent if request object is available
  if (req) {
    historyEntry.ipAddress = req.ip || req.connection.remoteAddress
    historyEntry.userAgent = req.get('user-agent')
  }
  
  employee.attendanceHistory.push(historyEntry)
  logger.info(`Attendance history logged: ${action} for ${attendanceDate.toISOString().split('T')[0]}`)
}

// Get current attendance status and determine what button to show
const getEmployeeStatusService = async (email) => {
  try {
    const user = await UserModel.findOne({ email })
    if (!user) return { status: 'logged_out' }

    const employee = await EmployeeModel.findOne({ userId: user._id })
    if (!employee) return { status: 'not_employee' }

    const philippineTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    const todayAttendance = employee.attendance.find(att => {
      const attDate = new Date(att.date.toISOString().split('T')[0])
      return attDate.getTime() === todayDate.getTime()
    })

    if (!todayAttendance) {
      return {
        status: 'not_clocked_in',
        buttonText: 'Time In',
        action: 'time_in'
      }
    }

    if (!todayAttendance.timeOut) {
      if (todayAttendance.onBreak) {
        return {
          status: 'on_break',
          buttonText: 'Time In',
          action: 'back_from_break',
          workStarted: todayAttendance.timeIn,
          breakTime: todayAttendance.breakTime || 0
        }
      } else {
        if (todayAttendance.breakTime && todayAttendance.breakTime > 0) {
          return {
            status: 'ready_for_time_out',
            buttonText: 'Time Out',
            action: 'time_out',
            workStarted: todayAttendance.timeIn,
            breakTime: todayAttendance.breakTime,
            canTimeOut: true
          }
        } else {
          return {
            status: 'working',
            buttonText: 'Break',
            action: 'go_on_break',
            workStarted: todayAttendance.timeIn,
            canSkipBreak: true
          }
        }
      }
    } else {
      const existingOvertimeRecord = await OvertimeRecordModel.findOne({
        employeeId: employee._id,
        attendanceId: todayAttendance._id,
        type: "Overtime"
      })

      const existingUndertimeRecord = await OvertimeRecordModel.findOne({
        employeeId: employee._id,
        attendanceId: todayAttendance._id,
        type: "Undertime"
      })

      let needsOvertimeReason = false
      let overtimeType = null

      if (todayAttendance.scheduledEnd && todayAttendance.timeOut) {
        const scheduledEnd = todayAttendance.scheduledEnd
        const actualTimeOut = todayAttendance.timeOut
        const minutesDiff = (actualTimeOut - scheduledEnd) / (1000 * 60)

        if (minutesDiff > 20 && !existingOvertimeRecord) {
          needsOvertimeReason = true
          overtimeType = "Overtime"
        } else if (minutesDiff < -5 && !existingUndertimeRecord) {
          needsOvertimeReason = true
          overtimeType = "Undertime"
        }
      }

      return {
        status: 'completed',
        buttonText: 'Completed',
        action: 'none',
        totalHours: todayAttendance.totalHours,
        breakTime: todayAttendance.breakTime || 0,
        workStarted: todayAttendance.timeIn,
        workEnded: todayAttendance.timeOut,
        needsOvertimeReason: needsOvertimeReason,
        overtimeType: overtimeType
      }
    }
  } catch (error) {
    return { status: 'error', error: error.message }
  }
}

const employeeTimeActionService = async (email, password, skipBreak = false, req = null) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const isMatch = await PasswordUtil.comparePassword(password, user.password)
    appAssert(isMatch, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const employee = await EmployeeModel.findOne({ userId: user._id })
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    const now = new Date()
    const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    const todaySchedule = await ScheduleModel.findOne({
      assignedEmployee: employee._id,
      date: {
        $gte: todayDate,
        $lt: new Date(todayDate.getTime() + 24 * 60 * 60 * 1000)
      }
    })

    appAssert(todaySchedule, "No schedule found for today", HTTP_STATUS.NOT_FOUND)

    let todayAttendance = employee.attendance.find(att => {
      const attDate = new Date(att.date.toISOString().split('T')[0])
      return attDate.getTime() === todayDate.getTime()
    })

    const actionTime = new Date()

    if (!todayAttendance) {
      // FIRST TIME IN FOR THE DAY
      const scheduledStart = todaySchedule.time.start
      const lateMinutes = Math.max(0, (actionTime - scheduledStart) / (1000 * 60))
      const GRACE_PERIOD_MINUTES = 5
      
      let isLate = false
      let gracePeriodUsed = false
      
      if (lateMinutes > 0 && lateMinutes <= GRACE_PERIOD_MINUTES) {
        if (employee.lateGracePeriodCount > 0) {
          employee.lateGracePeriodCount -= 1
          gracePeriodUsed = true
          isLate = false
          logger.info(`${user.name} used late grace period (${Math.round(lateMinutes)} mins late). Remaining: ${employee.lateGracePeriodCount}`)
        } else {
          isLate = true
          logger.info(`${user.name} late by ${Math.round(lateMinutes)} mins. No grace periods remaining.`)
        }
      } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
        isLate = true
        logger.info(`${user.name} late by ${Math.round(lateMinutes)} mins (beyond grace period)`)
      }
      
      const newAttendance = {
        date: todayDate,
        scheduleId: todaySchedule._id,
        scheduledStart: scheduledStart,
        scheduledEnd: todaySchedule.time.end,
        timeIn: actionTime,
        breakTime: 0,
        onBreak: false,
        isLate: isLate,
        lateMinutes: Math.round(lateMinutes),
        isAbsent: false,
        status: isLate ? "Late" : "Present"
      }

      employee.attendance.push(newAttendance)
      
      // ADD TO HISTORY
      addAttendanceHistory(employee, 'time_in', todayDate, {
        isLate: isLate,
        lateMinutes: Math.round(lateMinutes),
        gracePeriodUsed: gracePeriodUsed,
        remainingGracePeriods: employee.lateGracePeriodCount,
        scheduledStart: scheduledStart
      }, req)
      
      await employee.save()

      logger.info(`${user.name} started work day: ${actionTime} ${isLate ? `(Late by ${Math.round(lateMinutes)} minutes)` : ''}`)

      return {
        action: 'time_in',
        message: isLate 
          ? `Started work day (Late by ${Math.round(lateMinutes)} minutes)${gracePeriodUsed ? ` - Grace period used. Remaining: ${employee.lateGracePeriodCount}` : ''}` 
          : 'Started work day successfully',
        nextAction: 'go_on_break',
        nextButtonText: 'Break',
        timeIn: actionTime,
        isLate: isLate,
        lateMinutes: Math.round(lateMinutes),
        scheduledStart: scheduledStart,
        gracePeriodUsed: gracePeriodUsed,
        remainingGracePeriods: employee.lateGracePeriodCount
      }
    }

    if (!todayAttendance.timeOut) {
      // CURRENTLY ACTIVE
      if (!todayAttendance.onBreak) {
        // CURRENTLY WORKING
        if (skipBreak) {
          // SKIP BREAK - END DAY DIRECTLY
          todayAttendance.timeOut = actionTime
          const totalWorked = (actionTime - todayAttendance.timeIn) / (1000 * 60 * 60)
          todayAttendance.totalHours = Math.max(0, totalWorked - (todayAttendance.breakTime || 0))

          // ADD TO HISTORY
          addAttendanceHistory(employee, 'skip_break_time_out', todayDate, {
            totalHours: todayAttendance.totalHours,
            breakTime: todayAttendance.breakTime || 0
          }, req)

          await employee.save()
          logger.info(`${user.name} ended work day (skipped break): ${actionTime} (Total: ${todayAttendance.totalHours.toFixed(2)} hours)`)

          return {
            action: 'skip_break_time_out',
            message: 'Work day completed (break skipped)',
            nextAction: 'none',
            nextButtonText: 'Completed',
            timeOut: actionTime,
            totalHours: todayAttendance.totalHours,
            breakTime: todayAttendance.breakTime || 0
          }
        } else {
          if (todayAttendance.breakTime) {
            appAssert(false, "You have already used your break for today", HTTP_STATUS.CONFLICT)
          }

          // GO ON BREAK
          todayAttendance.onBreak = true
          todayAttendance.breakStart = actionTime

          // ADD TO HISTORY
          addAttendanceHistory(employee, 'go_on_break', todayDate, {}, req)

          await employee.save()
          logger.info(`${user.name} went on break: ${actionTime}`)

          return {
            action: 'go_on_break',
            message: 'Break started successfully',
            nextAction: 'back_from_break',
            nextButtonText: 'Time In',
            breakStart: actionTime
          }
        }
      } else {
        // CURRENTLY ON BREAK - COME BACK
        const breakDuration = (actionTime - todayAttendance.breakStart) / (1000 * 60 * 60)
        todayAttendance.breakTime += breakDuration
        todayAttendance.onBreak = false
        delete todayAttendance.breakStart

        // ADD TO HISTORY
        addAttendanceHistory(employee, 'back_from_break', todayDate, {
          breakDuration: breakDuration,
          totalBreakTime: todayAttendance.breakTime
        }, req)

        await employee.save()
        logger.info(`${user.name} returned from break: ${actionTime} (Break duration: ${breakDuration.toFixed(2)} hours)`)

        return {
          action: 'back_from_break',
          message: 'Back from break successfully',
          nextAction: 'time_out',
          nextButtonText: 'Time Out',
          breakDuration: breakDuration.toFixed(2),
          totalBreakTime: todayAttendance.breakTime
        }
      }
    } else {
      appAssert(false, "Work day already completed", HTTP_STATUS.CONFLICT)
    }
  } catch (error) {
    throw error
  }
}

const employeeTimeOutService = async (email, password, req = null) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const isMatch = await PasswordUtil.comparePassword(password, user.password)
    appAssert(isMatch, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const employee = await EmployeeModel.findOne({ userId: user._id })
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    const now = new Date()
    const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    const todayAttendance = employee.attendance.find(att => {
      const attDate = new Date(att.date.toISOString().split('T')[0])
      return attDate.getTime() === todayDate.getTime()
    })

    appAssert(todayAttendance, "No time-in record found for today", HTTP_STATUS.BAD_REQUEST)
    appAssert(!todayAttendance.timeOut, "Already timed out for today", HTTP_STATUS.BAD_REQUEST)
    appAssert(!todayAttendance.onBreak, "Cannot time out while on break", HTTP_STATUS.BAD_REQUEST)

    const todaySchedule = await ScheduleModel.findOne({
      assignedEmployee: employee._id,
      date: {
        $gte: todayDate,
        $lt: new Date(todayDate.getTime() + 24 * 60 * 60 * 1000)
      }
    })

    const actionTime = new Date()
    todayAttendance.timeOut = actionTime

    const scheduledEnd = todaySchedule.time.end
    const minutesDiff = (actionTime - scheduledEnd) / (1000 * 60)

    let requiresOvertimeReason = false
    let requiresUndertimeReason = false

    if (minutesDiff > 20) {
      todayAttendance.isOvertime = true
      todayAttendance.overtimeMinutes = Math.round(minutesDiff)
      requiresOvertimeReason = true
    } else if (minutesDiff < -5) {
      todayAttendance.isUndertime = true
      todayAttendance.undertimeMinutes = Math.round(Math.abs(minutesDiff))
      requiresUndertimeReason = true
    }

    const totalWorked = (actionTime - todayAttendance.timeIn) / (1000 * 60 * 60)
    const breakHours = todayAttendance.breakTime || 0;
    todayAttendance.totalHours = Math.max(0, totalWorked - breakHours)

    // ADD TO HISTORY
    addAttendanceHistory(employee, 'time_out', todayDate, {
      totalHours: todayAttendance.totalHours,
      breakTime: todayAttendance.breakTime || 0,
      isOvertime: todayAttendance.isOvertime || false,
      overtimeMinutes: todayAttendance.overtimeMinutes || 0,
      isUndertime: todayAttendance.isUndertime || false,
      undertimeMinutes: todayAttendance.undertimeMinutes || 0,
      scheduledEnd: scheduledEnd
    }, req)

    await employee.save()
    logger.info(`${user.name} ended work day: ${actionTime} (Total: ${todayAttendance.totalHours.toFixed(2)} hours, Break: ${(todayAttendance.breakTime || 0).toFixed(2)} hours)${todayAttendance.isOvertime ? ` [OVERTIME: ${todayAttendance.overtimeMinutes} mins]` : ''}${todayAttendance.isUndertime ? ` [UNDERTIME: ${todayAttendance.undertimeMinutes} mins]` : ''}`)

    return {
      action: 'time_out',
      message: todayAttendance.isOvertime 
        ? `Work day completed (Overtime: ${todayAttendance.overtimeMinutes} minutes)` 
        : todayAttendance.isUndertime
          ? `Work day completed (Undertime: ${todayAttendance.undertimeMinutes} minutes)`
          : 'Work day completed successfully',
      nextAction: requiresOvertimeReason || requiresUndertimeReason ? 'provide_reason' : 'none',
      nextButtonText: requiresOvertimeReason || requiresUndertimeReason ? 'Provide Reason' : 'Completed',
      timeOut: actionTime,
      totalHours: todayAttendance.totalHours,
      breakTime: todayAttendance.breakTime || 0,
      isOvertime: todayAttendance.isOvertime || false,
      overtimeMinutes: todayAttendance.overtimeMinutes || 0,
      isUndertime: todayAttendance.isUndertime || false,
      undertimeMinutes: todayAttendance.undertimeMinutes || 0,
      requiresOvertimeReason: requiresOvertimeReason,
      requiresUndertimeReason: requiresUndertimeReason,
      scheduledEnd: scheduledEnd
    }
  } catch (error) {
    throw error
  }
}

const getMonthlyAttendanceService = async (email, year, month) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "User not found", HTTP_STATUS.NOT_FOUND)

    const employee = await EmployeeModel.findOne({ userId: user._id })
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    // Create date range for the month (month is 0-indexed in JS)
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0) // Last day of the month

    // Filter attendance records for the specified month
    const monthlyAttendance = employee.attendance.filter(att => {
      const attDate = new Date(att.date)
      return attDate >= startDate && attDate <= endDate
    })

    // Format the data for frontend consumption
    const userAttendanceData = {}
    
    monthlyAttendance.forEach(att => {
      const dateKey = att.date.toISOString().split('T')[0] // YYYY-MM-DD format
      
      userAttendanceData[dateKey] = {
        date: dateKey,
        timeIn: att.timeIn ? att.timeIn.toISOString() : null,
        timeOut: att.timeOut ? att.timeOut.toISOString() : null,
        breakTime: att.breakTime,
        totalHours: att.totalHours,
        onBreak: att.onBreak || false,
        status: att.timeOut ? 'completed' : (att.onBreak ? 'on_break' : 'working')
      }
    })

    return {
      success: true,
      data: userAttendanceData,
      month: month,
      year: year
    }

  } catch (error) {
    throw error
  }
}

const requestLeaveService = async (userId, reason, startDate, endDate, leaveCategory) => {
  try {
    const user = await UserModel.findById(userId)
    
    appAssert(user, 'User not found', HTTP_STATUS.NOT_FOUND)
    
    appAssert(typeof reason === "string", 'Reason should be a text', HTTP_STATUS.BAD_REQUEST)
    
    appAssert(reason.trim().length >= 15, 'Reason must be at least 15 characters long', HTTP_STATUS.BAD_REQUEST)
    appAssert(reason.trim().length <= 200, 'Reason must not exceed 200 characters', HTTP_STATUS.BAD_REQUEST)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0) 
    
    const startDateObj = new Date(startDate)
    startDateObj.setHours(0, 0, 0, 0) 
    
    const endDateObj = new Date(endDate)
    endDateObj.setHours(0, 0, 0, 0)
    
    appAssert(startDateObj > today, 'Start date must be in the future', HTTP_STATUS.BAD_REQUEST)
    
    appAssert(endDateObj >= startDateObj, 'End date must be after or equal to start date', HTTP_STATUS.BAD_REQUEST)
    
    // Calculate number of days
    const timeDifference = endDateObj.getTime() - startDateObj.getTime()
    const numberOfDays = Math.floor(timeDifference / (1000 * 60 * 60 * 24)) + 1
    
    const leaveType = startDateObj.getTime() === endDateObj.getTime() ? LEAVE_TYPES.SINGLE_DAY : LEAVE_TYPES.MULTI_DAY
    
    const newLeaveRequest = await LeaveModel.create({
      employee: user._id,
      reason,
      startDate,
      endDate,
      leaveCategory,
      leaveType,
      numberOfDays,
    })
    
    logger.info(`${leaveType} leave request submitted by ${user.name} for ${numberOfDays} day(s)`)
    
    // Get admin emails and send notification
    const admins = await UserModel.find({ 
      role: 'admin' 
    }).select('email')
    
    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    
    if (adminEmails.length > 0) {
      await EmailUtil.sendLeaveRequestNotification(adminEmails, newLeaveRequest, user)
    } else {
      logger.warn('No admin emails found to notify about leave request')
    }
    
    return { 
      newLeaveRequest, 
      numberOfDays,
      message: 'Successfully submitted the leave request'
    }
  } catch (error) {
    throw error
  }
}

const activateAccountService = async (email, token, newPassword, newPasswordConfirmation) => {
  try {
    // Input validation
    appAssert(validator.isEmail(email), 'Invalid email format', HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof token === 'string' && token.length > 0, 'Invalid token', HTTP_STATUS.BAD_REQUEST)
    appAssert(typeof newPassword === 'string' && newPassword.length >= 8, 'Password must be at least 8 characters', HTTP_STATUS.BAD_REQUEST)
    appAssert(newPassword === newPasswordConfirmation, 'Passwords do not match', HTTP_STATUS.BAD_REQUEST)

    // Find user by email
    const user = await UserModel.findOne({ email })
    appAssert(user, 'User not found', HTTP_STATUS.NOT_FOUND)

    // Check if token matches
    appAssert(user.token === token, 'Invalid or expired token', HTTP_STATUS.BAD_REQUEST)

    // Check if token exists and has expiration
    appAssert(user.token, 'No activation token found for this user', HTTP_STATUS.BAD_REQUEST)
    appAssert(user.tokenExpires, 'Token expiration not set', HTTP_STATUS.BAD_REQUEST)

    // Check if token is not expired
    const currentTime = new Date()
    appAssert(user.tokenExpires > currentTime, 'Token has expired. Please request a new activation link', HTTP_STATUS.BAD_REQUEST)

    // Hash the new password
    const hashedPassword = await PasswordUtil.hashPassword(newPassword)

    // Update user - set new password and clear token data
    user.password = hashedPassword
    user.token = undefined
    user.tokenExpires = undefined
    user.isActive = true 

    await user.save()

    logger.info(`Account activated successfully for user: ${email}`)

    return { 
      message: 'Account activated successfully. You can now login with your new password.',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActive: user.isActive
      }
    }

  } catch (error) {
    logger.error(`Account activation failed for ${email}: ${error.message}`)
    throw error
  }
}

const submitOvertimeReasonService = async (email, password, reason, type) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const isMatch = await PasswordUtil.comparePassword(password, user.password)
    appAssert(isMatch, "Invalid email or password", HTTP_STATUS.BAD_REQUEST)

    const employee = await EmployeeModel.findOne({ userId: user._id })
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND)

    // Get current date in Philippine time
    const now = new Date()
    const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    // Find today's attendance record
    const todayAttendance = employee.attendance.find(att => {
      const attDate = new Date(att.date.toISOString().split('T')[0])
      return attDate.getTime() === todayDate.getTime()
    })

    appAssert(todayAttendance, "No attendance record found for today", HTTP_STATUS.BAD_REQUEST)
    appAssert(todayAttendance.timeOut, "You must time out first", HTTP_STATUS.BAD_REQUEST)

    // Validate type
    appAssert(
      type === "Overtime" || type === "Undertime",
      "Invalid type. Must be 'Overtime' or 'Undertime'",
      HTTP_STATUS.BAD_REQUEST
    )

    // Check if record already exists
    const existingRecord = await OvertimeRecordModel.findOne({
      employeeId: employee._id,
      attendanceId: todayAttendance._id,
      type: type
    })

    appAssert(!existingRecord, "Reason already submitted for this record", HTTP_STATUS.CONFLICT)

    // Calculate minutes difference
    const scheduledEnd = todayAttendance.scheduledEnd
    const actualTimeOut = todayAttendance.timeOut
    const minutesDiff = (actualTimeOut - scheduledEnd) / (1000 * 60)
    
    let minutes = 0
    if (type === "Overtime") {
      minutes = Math.max(0, Math.round(minutesDiff))
      appAssert(minutes > 20, "No significant overtime recorded", HTTP_STATUS.BAD_REQUEST)
    } else if (type === "Undertime") {
      minutes = Math.max(0, Math.round(Math.abs(minutesDiff)))
      appAssert(minutes > 5, "No significant undertime recorded", HTTP_STATUS.BAD_REQUEST)
    }

    // Find admin users BEFORE creating record
    const adminUsers = await UserModel.find({ role: 'admin' }).select('email')
    const adminEmails = adminUsers.map(admin => admin.email).filter(Boolean)
    
    appAssert(adminEmails.length > 0, "No admin users found to notify", HTTP_STATUS.INTERNAL_SERVER_ERROR)

    // Prepare overtime record data
    const overtimeRecordData = {
      employeeId: employee._id,
      attendanceId: todayAttendance._id,
      type: type,
      date: todayAttendance.date,
      scheduledEnd: scheduledEnd,
      actualTimeOut: actualTimeOut,
      minutes: minutes,
      reason: reason,
      status: "Pending"
    }

    try {
      await EmailUtil.sendOvertimeNotification(
        adminEmails,
        overtimeRecordData,
        { name: user.name, email: user.email },
        employee
      )
    } catch (emailError) {
      logger.error('Failed to send overtime notification email:', emailError)
      throw new Error('Failed to send notification to admins. Please try again later.')
    }

    // Only create the record if email was sent successfully
    const overtimeRecord = await OvertimeRecordModel.create(overtimeRecordData)

    logger.info(`${user.name} submitted ${type} reason: ${reason}`)

    return {
      success: true,
      message: `${type} reason submitted successfully`,
      recordId: overtimeRecord._id,
      type: type,
      minutes: overtimeRecord.minutes,
      status: overtimeRecord.status,
      submittedAt: overtimeRecord.submittedAt
    }
  } catch (error) {
    throw error
  }
}

// Export the service function
module.exports = {
  getEmployeeStatusService,
  employeeTimeActionService,
  employeeTimeOutService,
  getMonthlyAttendanceService,
  requestLeaveService,
  activateAccountService,
  submitOvertimeReasonService,
}
