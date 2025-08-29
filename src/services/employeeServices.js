const UserModel = require('../models/user.model')         // User model for authentication
const EmployeeModel = require('../models/employee.model') // Employee model for attendance tracking
const HTTP_STATUS = require('../constants/httpConstants') // HTTP status codes (200, 401, 404, 409, etc.)
const { appAssert } = require('../utils/appAssert')       // Utility for throwing structured errors
const PasswordUtil = require('../utils/passwordUtils')   // Password hashing and comparison utility
const logger = require('../logger/logger')

// Service function to handle employee "time-in"
const employeeTimeIn = async (email, password) => {
    try {
        // Find the user by email
        const user = await UserModel.findOne({ email })
        appAssert(user, HTTP_STATUS.UNAUTHORIZED, "Invalid email or password")

        // Check if the password matches
        const isMatch = await PasswordUtil.comparePassword(password, user.password)
        appAssert(isMatch, HTTP_STATUS.UNAUTHORIZED, "Invalid email or password")

        // Find the corresponding employee record
        const employee = await EmployeeModel.findOne({ userId: user._id })
        appAssert(employee, HTTP_STATUS.NOT_FOUND, "Employee not found")

        // Check if employee is already clocked in
        if (employee.attendance.length > 0) {
            const lastAttendance = employee.attendance[employee.attendance.length - 1]
            if (!lastAttendance.timeOut) {
                appAssert(false, HTTP_STATUS.CONFLICT, "Employee is already clocked in")
            }
        }
      
        const employeeTimeIn = new Date()

        // Clock in the employee
        employee.attendance.push({ timeIn: employeeTimeIn})
        await employee.save()

        logger.info(`${user.name} timed in:  ${employeeTimeIn}`)

        // Return the employee object and success message
        return { employee, message: 'Timed-in succesfully' }
    } catch (error) {
        // Propagate the error to be handled by the controller/middleware
        throw error
    }
}

// Export the service function
module.exports = {
    employeeTimeIn,
}
