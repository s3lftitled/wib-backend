const UserModel = require('../models/user.model')         // User model for authentication
const EmployeeModel = require('../models/employee.model') // Employee model for attendance tracking
const LeaveModel = require('../models/leave.model')
const HTTP_STATUS = require('../constants/httpConstants') // HTTP status codes (200, 401, 404, 409, etc.)
const { appAssert } = require('../utils/appAssert')       // Utility for throwing structured errors
const PasswordUtil = require('../utils/passwordUtils')   // Password hashing and comparison utility
const logger = require('../logger/logger')
const { LEAVE_TYPES } = require('../constants/leaveRelatedConstants')

// Get current attendance status and determine what button to show
const getEmployeeStatusService = async (email) => {
  try {
    const user = await UserModel.findOne({ email })
    if (!user) return { status: 'logged_out' }

    const employee = await EmployeeModel.findOne({ userId: user._id })
    if (!employee) return { status: 'not_employee' }

    // Get current date in Philippine time
    const philippineTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    // Find today's attendance record
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

    // Check current state
    if (!todayAttendance.timeOut) {
      // Currently clocked in
      if (todayAttendance.onBreak) {
        return {
          status: 'on_break',
          buttonText: 'Time In',
          action: 'back_from_break',
          workStarted: todayAttendance.timeIn,
          breakTime: todayAttendance.breakTime || 0
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
    } else {
      // Already completed for the day
      return {
        status: 'completed',
        buttonText: 'Completed',
        action: 'none',
        totalHours: todayAttendance.totalHours,
        breakTime: todayAttendance.breakTime || 0,
        workStarted: todayAttendance.timeIn,
        workEnded: todayAttendance.timeOut
      }
    }
  } catch (error) {
    return { status: 'error', error: error.message }
  }
}

const employeeTimeActionService = async (email, password, skipBreak = false) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "Invalid email or password", HTTP_STATUS.UNAUTHORIZED)

    const isMatch = await PasswordUtil.comparePassword(password, user.password)
    appAssert(isMatch, "Invalid email or password", HTTP_STATUS.UNAUTHORIZED)

    const employee = await EmployeeModel.findOne({ userId: user._id })
    appAssert(employee, "Employee not found", HTTP_STATUS.NOT_FOUND )

    // Get current date in Philippine time
    const now = new Date()
    const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)

    // Find today's attendance record
    let todayAttendance = employee.attendance.find(att => {
      const attDate = new Date(att.date.toISOString().split('T')[0])
      return attDate.getTime() === todayDate.getTime()
    })

    const actionTime = new Date()

    if (!todayAttendance) {
      // FIRST TIME IN FOR THE DAY
      employee.attendance.push({
        date: todayDate,
        timeIn: actionTime,
        breakTime: 0,
        onBreak: false
      })

      await employee.save()
      logger.info(`${user.name} started work day: ${actionTime}`)

      return {
        action: 'time_in',
        message: 'Started work day successfully',
        nextAction: 'go_on_break',
        nextButtonText: 'Break',
        timeIn: actionTime
      }
    }

    if (!todayAttendance.timeOut) {
      // CURRENTLY ACTIVE (either working or on break)

      if (!todayAttendance.onBreak) {
        // CURRENTLY WORKING - GO ON BREAK
        if (skipBreak) {
          // SKIP BREAK - END DAY DIRECTLY
          todayAttendance.timeOut = actionTime
          const totalWorked = (actionTime - todayAttendance.timeIn) / (1000 * 60 * 60)
          todayAttendance.totalHours = Math.max(0, totalWorked - (todayAttendance.breakTime || 0))

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
        // CURRENTLY ON BREAK - COME BACK FROM BREAK
        const breakDuration = (actionTime - todayAttendance.breakStart) / (1000 * 60 * 60)
        todayAttendance.breakTime += breakDuration
        todayAttendance.onBreak = false
        delete todayAttendance.breakStart

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
      // ALREADY COMPLETED FOR THE DAY
      appAssert(false, "Work day already completed", HTTP_STATUS.CONFLICT)
    }
  } catch (error) {
    throw error
  }
}

// Separate function for final time out (when not on break)
const employeeTimeOutService = async (email, password) => {
  try {
    const user = await UserModel.findOne({ email })
    appAssert(user, "Invalid email or password", HTTP_STATUS.UNAUTHORIZED)

    const isMatch = await PasswordUtil.comparePassword(password, user.password)
    appAssert(isMatch, "Invalid email or password", HTTP_STATUS.UNAUTHORIZED)

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

    appAssert(todayAttendance, "No time-in record found for today", HTTP_STATUS.BAD_REQUEST)
    appAssert(!todayAttendance.timeOut, "Already timed out for today", HTTP_STATUS.BAD_REQUEST)
    appAssert(!todayAttendance.onBreak, "Cannot time out while on break", HTTP_STATUS.BAD_REQUEST)

    const timeOutRecord = new Date()
    todayAttendance.timeOut = timeOutRecord

    // Calculate total hours minus break time
    const totalWorked = (timeOutRecord - todayAttendance.timeIn) / (1000 * 60 * 60)
    todayAttendance.totalHours = Math.max(0, totalWorked - (todayAttendance.breakTime || 0))

    await employee.save()
    logger.info(`${user.name} ended work day: ${timeOutRecord} (Total: ${todayAttendance.totalHours.toFixed(2)} hours, Break: ${(todayAttendance.breakTime || 0).toFixed(2)} hours)`)

    return {
      action: 'time_out',
      message: 'Work day completed successfully',
      nextAction: 'none',
      nextButtonText: 'Completed',
      timeOut: timeOutRecord,
      totalHours: todayAttendance.totalHours,
      breakTime: todayAttendance.breakTime || 0
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
    const attendanceData = {}
    
    monthlyAttendance.forEach(att => {
      const dateKey = att.date.toISOString().split('T')[0] // YYYY-MM-DD format
      
      attendanceData[dateKey] = {
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
      data: attendanceData,
      month: month,
      year: year
    }

  } catch (error) {
    throw error
  }
}

const requestLeaveService = async (userId, reason, startDate, endDate) => {
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
    endDateObj.setHours(0, 0, 0, 0) /
    
    appAssert(startDateObj > today, 'Start date must be in the future', HTTP_STATUS.BAD_REQUEST)
    
    appAssert(endDateObj >= startDateObj, 'End date must be after or equal to start date', HTTP_STATUS.BAD_REQUEST)
    
    const leaveType = startDateObj.getTime() === endDateObj.getTime() ? LEAVE_TYPES.SINGLE_DAY : LEAVE_TYPES.MULTI_DAY
    
    const newLeaveRequest = await LeaveModel.create({
      employee: user._id,
      reason,
      startDate,
      endDate,
      leaveType
    })
    
    logger.info(`${leaveType} leave request submitted by ${user.name}`)
    
    return { 
      newLeaveRequest, 
      message: 'Successfully submitted the leave request'
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
}
