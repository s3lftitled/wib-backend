const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const HTTP_STATUS = require('../constants/httpConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')

const employeeTimeIn = async (email, password) => {
    try {
        const user = await UserModel.findOne({ email })
        appAssert(user, HTTP_STATUS.UNAUTHORIZED, "Invalid email or password")

        const isMatch = await PasswordUtil.comparePassword(password, user.password)
        appAssert(isMatch, HTTP_STATUS.UNAUTHORIZED, "Invalid email or password")

        const employee = await EmployeeModel.findOne({ userId: user._id })
        appAssert(employee, HTTP_STATUS.NOT_FOUND, "Employee not found")

        // Check if the employee is already clocked in
        if (employee.attendance.length > 0) {
            const lastAttendance = employee.attendance[employee.attendance.length - 1]
            if (!lastAttendance.timeOut) {
                appAssert(false, HTTP_STATUS.CONFLICT, "Employee is already clocked in")
            }
        }

        // Clock in the employee
        employee.attendance.push({ timeIn: new Date() })
        await employee.save();

        return { employee, message: 'Timed-in succesfully' }
    } catch (error) {
        throw error
    }
}

module.exports = {
    employeeTimeIn,
}
