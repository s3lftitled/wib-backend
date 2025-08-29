const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
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
  role: { 
    type: String, 
    enum: ["employee", "admin"], 
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
  }
});

module.exports = mongoose.model("User", userSchema)
