const mongoose = require("mongoose")

const ScheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  time: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }   
  },
  assignedEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null  
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Admin who created the schedule
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model("Schedule", ScheduleSchema)
