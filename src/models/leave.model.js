const mongoose = require("mongoose")

const LeaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",   
    required: true
  },
  reason: {
    type: String,
    required: true,
    minlength: 15,
    maxlength: 200
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  numberOfDays: {
    type: Number,
    required: true
  },
  leaveType: {
    type: String,
    enum: ["single", "multi"],
    required: true
  },
  leaveCategory: {
    type: String,
    enum: ["sickLeave", "vacationLeave"], // must match user.leaveBalance keys
    required: true
  },

  // Workflow
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "DECLINED"],
    default: "PENDING"
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  declinedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  declineReason: {
    type: String,
    default: null
  },
  daysApproved: {
    type: Number,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model("Leave", LeaveSchema)
