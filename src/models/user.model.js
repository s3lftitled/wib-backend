const mongoose = require("mongoose")
const ROLE_CONSTANTS = require("../constants/roleConstants")

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: { 
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String,
    required: true
  },
  displayPicture: {
    type: String,
    default: null,
  },
  role: { 
    type: String,
    enum: [ROLE_CONSTANTS[101], ROLE_CONSTANTS[202]],
    required: true
  },
  createdAt: { 
    type: Date,
    default: Date.now
  },
  isActive: { 
    type: Boolean,
    default: true,
    required: true
  },
})

module.exports = mongoose.model("User", UserSchema)
