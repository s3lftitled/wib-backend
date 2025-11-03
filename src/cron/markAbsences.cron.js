// File: cron/markAbsences.cron.js
const cron = require('node-cron')
const EmployeeModel = require('../models/employee.model')
const ScheduleModel = require('../models/schedule.model')
const LeaveModel = require('../models/leave.model')
const logger = require('../logger/logger')

/**
 * Service to mark employees as absent if they didn't clock in
 */
const markAbsentEmployeesService = async () => {
  try {
    // Get current date in Philippine time
    const philippineTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
    const todayDateString = philippineTime.toISOString().split('T')[0]
    const todayDate = new Date(todayDateString)
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000)

    logger.info(`Running absence marker cron for date: ${todayDateString}`)

    // Find all schedules for today
    const todaySchedules = await ScheduleModel.find({
      date: {
        $gte: todayDate,
        $lt: tomorrowDate
      },
      assignedEmployee: { $ne: null } // Only schedules with assigned employees
    }).populate('assignedEmployee')

    if (todaySchedules.length === 0) {
      logger.info('No schedules found for today')
      return { message: 'No schedules to process', absencesMarked: 0 }
    }

    logger.info(`Found ${todaySchedules.length} schedule(s) for today`)

    let absencesMarked = 0
    let employeesOnLeave = 0
    let alreadyMarked = 0

    // Process each schedule
    for (const schedule of todaySchedules) {
      if (!schedule.assignedEmployee) continue

      const employee = schedule.assignedEmployee
      const employeeUserId = employee.userId

      // Check if employee is on approved leave today
      const isOnLeave = await LeaveModel.findOne({
        employee: employeeUserId,
        status: "APPROVED",
        startDate: { $lte: todayDate },
        endDate: { $gte: todayDate }
      })

      if (isOnLeave) {
        logger.info(`Employee ${employee._id} is on approved leave - skipping absence mark`)
        employeesOnLeave++
        
        // Check if attendance record exists for today
        const hasAttendanceRecord = employee.attendance.some(att => {
          const attDate = new Date(att.date.toISOString().split('T')[0])
          return attDate.getTime() === todayDate.getTime()
        })

        // If no attendance record, add OnLeave status
        if (!hasAttendanceRecord) {
          employee.attendance.push({
            date: todayDate,
            scheduleId: schedule._id,
            scheduledStart: schedule.time.start,
            scheduledEnd: schedule.time.end,
            timeIn: null,
            timeOut: null,
            breakTime: 0,
            totalHours: 0,
            isAbsent: false,
            isLate: false,
            status: "OnLeave"
          })
          await employee.save()
          logger.info(`Marked employee ${employee._id} as OnLeave`)
        }
        
        continue
      }

      // Check if employee has already clocked in today
      const todayAttendance = employee.attendance.find(att => {
        const attDate = new Date(att.date.toISOString().split('T')[0])
        return attDate.getTime() === todayDate.getTime()
      })

      if (todayAttendance) {
        // Employee has attendance record (either clocked in or already marked absent)
        if (todayAttendance.isAbsent) {
          logger.info(`Employee ${employee._id} already marked as absent`)
          alreadyMarked++
        } else {
          logger.info(`Employee ${employee._id} has clocked in - no action needed`)
        }
        continue
      }

      // Employee didn't clock in and is not on leave - mark as absent
      employee.attendance.push({
        date: todayDate,
        scheduleId: schedule._id,
        scheduledStart: schedule.time.start,
        scheduledEnd: schedule.time.end,
        timeIn: null,
        timeOut: null,
        breakTime: 0,
        totalHours: 0,
        isAbsent: true,
        isLate: false,
        lateMinutes: 0,
        status: "Absent"
      })

      await employee.save()
      absencesMarked++
      
      logger.info(`Marked employee ${employee._id} as ABSENT for ${todayDateString}`)
    }

    const summary = {
      date: todayDateString,
      totalSchedules: todaySchedules.length,
      absencesMarked,
      employeesOnLeave,
      alreadyMarked,
      message: `Absence marking completed: ${absencesMarked} new absence(s) marked`
    }

    logger.info(`Absence Marker Summary: ${JSON.stringify(summary)}`)
    
    return summary

  } catch (error) {
    logger.error(`Error in markAbsentEmployeesService: ${error.message}`)
    throw error
  }
}

/**
 * Setup cron job to run every day at 10 PM
 * Cron format: second minute hour day month weekday
 * '0 22 * * *' = At 10:00 PM every day
 */
const setupAbsenceMarkerCron = () => {
  // Run at 10 PM every day (Philippine time is handled in the service)
  cron.schedule('0 22 * * *', async () => {
    logger.info('Cron job triggered: Marking absent employees')
    try {
      await markAbsentEmployeesService()
    } catch (error) {
      logger.error(`Cron job failed: ${error.message}`)
    }
  }, {
    timezone: "Asia/Manila" // Run in Philippine timezone
  })

  logger.info('Absence marker cron job scheduled (10 PM daily, Asia/Manila)')
}

// Optional: Manual trigger endpoint (for testing)
const manualTriggerAbsenceMarker = async () => {
  logger.info('Manual trigger: Marking absent employees')
  return await markAbsentEmployeesService()
}

module.exports = {
  setupAbsenceMarkerCron,
  markAbsentEmployeesService,
  manualTriggerAbsenceMarker
}