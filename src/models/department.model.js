const mongoose = require("mongoose")

const DepartmentSchema= new mongoose.Schema({
  name: {
    type: String,
    unique: true,
  },
  staffs: [{
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  createdBy: {
    type: String,
  },
  createdAt: { 
    type: Date,
    default: Date.now
  },
})

module.exports = mongoose.model("Department", DepartmentSchema)