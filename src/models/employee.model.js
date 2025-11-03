const mongoose = require("mongoose")
const ROLE_CONSTANTS = require("../constants/roleConstants")

const employeeLeaveSchema = new mongoose.Schema({
  beginning: { type: Number, default: 0 },
  availments: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  active: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
}, { _id: false });

const EmployeeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true 
  },

  role: { 
    type: String, 
    default: ROLE_CONSTANTS[101], 
    immutable: true 
  },

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

  // Updated attendance with late/absent tracking
  attendance: [
    {
      date: { type: Date, default: Date.now },
      scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule" }, 
      scheduledStart: { type: Date },
      scheduledEnd: { type: Date },  
      timeIn: { type: Date },
      timeOut: { type: Date },
      breakTime: { type: Number, default: 0 },
      totalHours: { type: Number, default: 0 },
      onBreak: { type: Boolean, default: false },
      breakStart: { type: Date },
      isLate: { type: Boolean, default: false }, 
      lateMinutes: { type: Number, default: 0 }, 
      isAbsent: { type: Boolean, default: false }, 
      isOvertime: { type: Boolean, default: false },
      overtimeMinutes: { type: Number, default: 0 },
      isUndertime: { type: Boolean, default: false },
      undertimeMinutes: { type: Number, default: 0 },
      status: { 
        type: String, 
        enum: ["Present", "Late", "Absent", "OnLeave"],
        default: "Present" 
      }
    }
  ],

  leaveBalance: {
    sickLeave: { type: employeeLeaveSchema, default: () => ({}) },
    vacationLeave: { type: employeeLeaveSchema, default: () => ({}) }
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }
})

module.exports = mongoose.model("Employee", EmployeeSchema)