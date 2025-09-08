const mongoose = require('mongoose')
const { LEAVE_TYPES, LEAVE_STATUS } = require('../constants/leaveRelatedConstants')

const LeaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",   // links to Users collection
    required: true 
  },
  leaveType: { 
    type: String, 
    enum: [LEAVE_TYPES.SINGLE_DAY, LEAVE_TYPES.MULTI_DAY] },
  reason: {
    type: String,
    required: true,
    maxLength: 200,
    minLength: 15,
  },
  startDate: {
    type: Date,
    required: true
  }, 
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(LEAVE_STATUS), 
    default: LEAVE_STATUS.PENDING      
  }
})

module.exports = mongoose.model("Leave", LeaveSchema)