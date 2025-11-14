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

  // NEW: Attendance History - logs all attendance actions
  attendanceHistory: [
    {
      action: {
        type: String,
        enum: [
          "time_in",
          "go_on_break", 
          "back_from_break",
          "time_out",
          "skip_break_time_out"
        ],
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now,
        required: true
      },
      attendanceDate: {
        type: Date,
        required: true
      },
      details: {
        isLate: { type: Boolean },
        lateMinutes: { type: Number },
        gracePeriodUsed: { type: Boolean },
        remainingGracePeriods: { type: Number },
        breakDuration: { type: Number },
        totalBreakTime: { type: Number },
        totalHours: { type: Number },
        isOvertime: { type: Boolean },
        overtimeMinutes: { type: Number },
        isUndertime: { type: Boolean },
        undertimeMinutes: { type: Number },
        scheduledStart: { type: Date },
        scheduledEnd: { type: Date }
      },
      ipAddress: { type: String },
      userAgent: { type: String }
    }
  ],

  leaveBalance: {
    sickLeave: { type: employeeLeaveSchema, default: () => ({}) },
    vacationLeave: { type: employeeLeaveSchema, default: () => ({}) }
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  lateGracePeriodCount: {
    type: Number,
    default: 3
  },
})

module.exports = mongoose.model("Employee", EmployeeSchema)