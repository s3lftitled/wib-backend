const mongoose = require('mongoose')

const LeaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",   // links to Users collection
    required: true 
  },
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
    type: Date,
    required: true
  },
})

module.exports = mongoose.model("Leave", LeaveSchema)