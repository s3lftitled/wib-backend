const mongoose = require("mongoose")

const OvertimeRecordSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true
  },
  
  attendanceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // Note: This references the attendance entry in the Employee's attendance array
    // Store the parent employee's _id and the specific attendance entry's _id
  },

  type: {
    type: String,
    enum: ["Overtime", "Undertime"],
    required: true
  },

  date: {
    type: Date,
    required: true
  },

  scheduledEnd: {
    type: Date,
    required: true
  },

  actualTimeOut: {
    type: Date,
    required: true
  },

  minutes: {
    type: Number,
    required: true,
    min: 0
  },

  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  status: {
    type: String,
    enum: ["Pending", "Approved", "Declined"],
    default: "Pending"
  },

  submittedAt: {
    type: Date,
    default: Date.now
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  reviewedAt: {
    type: Date
  },

  reviewNotes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
})

// Index for faster queries
OvertimeRecordSchema.index({ employeeId: 1, date: -1 })
OvertimeRecordSchema.index({ status: 1 })
OvertimeRecordSchema.index({ type: 1, status: 1 })

module.exports = mongoose.model("OvertimeRecord", OvertimeRecordSchema)