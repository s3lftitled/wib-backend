const mongoose = require("mongoose")
const ROLE_CONSTANTS = require("../constants/roleConstants")

const employeeLeaveSchema = new mongoose.Schema({
  beginning: { type: Number, default: 0 },  // Starting balance
  availments: { type: Number, default: 0 }, // Taken
  remaining: { type: Number, default: 0 },  // Left
  active: { type: Number, default: 0 },     // Currently active
  reserved: { type: Number, default: 0 },   // Reserved
}, { _id: false }); // Disable _id for subdocument

const EmployeeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",   // links to Users collection
    required: true 
  },

  // Fixed role
  role: { 
    type: String, 
    default: ROLE_CONSTANTS[101], 
    immutable: true 
  },

  // Holidays requested by the employee
  holidaysTaken: [
    {
      holidayId: { type: mongoose.Schema.Types.ObjectId, ref: "Holiday" },
      status: { 
        type: String, 
        enum: ["Pending", "Approved", "Declined"], 
        default: "Pending" 
      },
      requestedAt: { type: Date, default: Date.now }
    }
  ],

  // Attendance records
  attendance: [
    {
      date: { type: Date, default: Date.now }, // calendar day
      timeIn: { type: Date },   // full Date (day + time)  
      timeOut: { type: Date },  // full Date (day + time)
      breakTime: { type: Number, default: 0 }, // total break time in hours
      totalHours: { type: Number, default: 0 }, // final calculated work hours
      onBreak: { type: Boolean, default: false }, // currently on break status
      breakStart: { type: Date } // when current break started
    }
  ],
  // Leave balances by type
  leaveBalance: {
    sickLeave: { type: employeeLeaveSchema, default: () => ({}) },
    vacationLeave: { type: employeeLeaveSchema, default: () => ({}) }
  },
})

module.exports = mongoose.model("Employee", EmployeeSchema)